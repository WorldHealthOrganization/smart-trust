/**
 * Build pipeline: content objects → LaTeX chapters.
 *
 * Loads a paper manifest (with ChapterRef[]), resolves chapter .ts files,
 * loads all blocks from chapter directories, renders to LaTeX,
 * validates AST integrity, writes output.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/build.ts [paper.ts] [--out-dir chapters/]
 *
 * @module pipeline/build
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname, resolve, relative } from "path";
import type { Paper, Chapter, Section, Block, RenderOptions } from "../schemas/types.ts";
import { extractBlockLabel, isCrossPaperRef } from "../schemas/types.ts";
import {
  renderChapter,
  validateLatexAst,
  type LatexTranslationOptions,
} from "./render-latex";
import { generateMainTex, resolvePaperPreamble } from "./generate-main-tex";
import { collectReferencedTerms } from "./markdown-ast";
import { mergePoSources, poResolveContext, resolvePoSources } from "./po-resolve";
import { parsePo } from "./po-inject";
// The LaTeX preflight and the live block-status overlay are the science
// layer's: reached through pipeline slots that a higher layer fills through
// its `pipeline-plugins` graph (beans `squu`, `saqd`).
import { optionalPipelinePlugin, runPreflight } from "./pipeline-plugins";
import { findContentRepoRoot, findPapers } from "./repo-root";

// ── Build ────────────────────────────────────────────────────────

export interface BuildResult {
  /** Rendered LaTeX per chapter (keyed by chapter number). */
  chapters: Map<number, string>;
  /** Chapter slug names derived from directory names (e.g. "quantum-observable-universe"). */
  chapterSlugs: Map<number, string>;
  /**
   * Standalone appendix chapters — excluded from the main paper PDF and
   * compiled as separate PDFs. Detected as back-matter chapters: those
   * with a `tabLabel` that appear after all numbered (non-tabLabel) chapters
   * in the manifest. The Introduction (tabLabel "I", typically first) is
   * never treated as an appendix.
   */
  appendixChapters: Map<number, { slug: string; title: string; tabLabel: string }>;
  /**
   * Labels from blocks in excluded appendix chapters. These are emitted
   * as phantom labels in main.tex so that \hyperref references from the
   * main body resolve without "undefined" warnings.
   */
  appendixPhantomLabels: string[];
  /** Validation issues encountered. */
  issues: { level: string; message: string }[];
  /** Whether all rendered LaTeX passes AST validation. */
  astValid: boolean;
}

/**
 * Build a paper from its manifest.
 *
 * Resolves ChapterRef[] → Chapter[] by importing chapter .ts manifests
 * from their directories, then loads block .ts + .md pairs from the
 * same chapter directories.
 *
 * @param paperPath - Path to the paper .ts manifest
 * @param opts - Render options (print mode, compact inline refs)
 */
export async function buildPaper(
  paperPath: string,
  opts: RenderOptions & LatexTranslationOptions & { folioRoot?: string } = {},
): Promise<BuildResult> {
  const issues: { level: string; message: string }[] = [];
  const paperDir = dirname(paperPath);

  // 1. Load paper manifest
  const paperMod = await import(paperPath);
  const paper: Paper = paperMod.default;

  // 2. Resolve chapters and load all blocks
  const resolvedChapters: { chapter: Chapter; manifestIdx: number; dir: string }[] = [];
  const chapterSlugs = new Map<number, string>();
  const chapterMeta = new Map<number, { slug: string; title: string; tabLabel?: string }>();
  const blocks = new Map<string, { block: Block; mdContent: string; sourceDir?: string }>();

  for (let chIdx = 0; chIdx < paper.chapters.length; chIdx++) {
    const chRef = paper.chapters[chIdx];
    const chDir = join(paperDir, chRef.dir);
    const chPath = join(chDir, `${chRef.dir}.ts`);

    if (!existsSync(chPath)) {
      issues.push({ level: "error", message: `Chapter manifest not found: ${chPath}` });
      continue;
    }

    try {
      const chMod = await import(chPath);
      const chapter: Chapter = chMod.default;
      resolvedChapters.push({ chapter, manifestIdx: chIdx, dir: chRef.dir });

      // Chapter slug is now simply the directory name (no ch#- prefix to strip).
      const slug = chRef.dir;
      // Use manifest index as key to preserve author-defined chapter order
      chapterSlugs.set(chIdx, slug);
      chapterMeta.set(chIdx, { slug, title: chapter.title, tabLabel: chapter.tabLabel });

      // Load blocks from the chapter directory. Sections may nest one
      // level of `subsections`, each carrying its own `blocks`; the render
      // side (renderSection) flattens those, so the loader must too — else
      // subsection-only blocks are never loaded into the block map and
      // silently drop from the paper (their labels come out undefined).
      for (const sec of chapter.sections) {
        if (!("blocks" in sec)) continue;
        const section = sec as Section;
        const subBlocks = Array.isArray(section.subsections)
          ? section.subsections.flatMap((s) =>
              "blocks" in s ? (s as Section).blocks : [],
            )
          : [];
        for (const rootName of [...section.blocks, ...subBlocks]) {
          if (blocks.has(rootName)) continue;

          const tsPath = join(chDir, `${rootName}.ts`);
          const mdPath = join(chDir, `${rootName}.md`);

          try {
            const mod = await import(tsPath);
            const block: Block = mod.default;
            const mdContent = existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : "";
            // sourceDir relative to repo root (one level above content/)
            const repoRoot = resolve(paperDir, "..");
            const sourceDir = relative(repoRoot, chDir);
            // Overlay LIVE status so the PDF margin marks reflect the actual
            // formalisation, not the (usually `not_checked`) hand-set field —
            // the science layer's Lean overlay (bean `saqd`). When no mounted
            // layer fills the slot the block keeps what its manifest records.
            // Looked up here, inside the per-block `try`, so a contributor
            // that fails to load is reported against the block as before.
            optionalPipelinePlugin("block-status-overlay")?.overlay(block, tsPath, paperDir);
            blocks.set(rootName, { block, mdContent, sourceDir });
          } catch (e) {
            issues.push({
              level: "error",
              message: `Failed to load block "${rootName}": ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }
      }
    } catch (e) {
      issues.push({
        level: "error",
        message: `Failed to load chapter "${chRef.dir}": ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // 2b. Detect standalone appendix chapters.
  // Back-matter chapters are tabLabel'd chapters that appear AFTER all
  // numbered (non-tabLabel) chapters in the manifest. The Introduction
  // (first chapter, tabLabel "I") is never an appendix. Chapters like
  // Preface or Acknowledgments that precede numbered content would also
  // be kept in the main paper by this logic.
  const appendixChapters = new Map<number, { slug: string; title: string; tabLabel: string }>();
  let lastNumberedIdx = -1;
  for (const [idx, meta] of chapterMeta) {
    if (!meta.tabLabel) lastNumberedIdx = idx;
  }
  if (lastNumberedIdx > -1) {
    for (const [idx, meta] of chapterMeta) {
      if (meta.tabLabel && idx > lastNumberedIdx) {
        appendixChapters.set(idx, {
          slug: meta.slug,
          title: meta.title,
          tabLabel: meta.tabLabel,
        });
      }
    }
  }

  // 2c. Collect phantom labels from excluded appendix chapters.
  // When appendix chapters are excluded from main.tex (compiled standalone),
  // their block labels are undefined in the main paper. We collect these
  // labels so main.tex can declare phantom anchors, preventing hyperref
  // "undefined" warnings.
  const appendixPhantomLabels: string[] = [];
  for (const [idx] of appendixChapters) {
    const resolved = resolvedChapters.find(r => r.manifestIdx === idx);
    if (!resolved) continue;
    const ch = resolved.chapter;
    // Collect chapter label
    if (ch.label) appendixPhantomLabels.push(ch.label);
    for (const sec of ch.sections) {
      if (!("blocks" in sec)) continue;
      const s = sec as Section;
      // Collect section label
      if (s.label) appendixPhantomLabels.push(s.label);
      // Collect block labels
      for (const rootName of s.blocks) {
        const entry = blocks.get(rootName);
        if (!entry) continue;
        const label = extractBlockLabel(entry.block);
        if (label) appendixPhantomLabels.push(label);
      }
    }
  }

  // 3. Render chapters
  const chapters = new Map<number, string>();
  let astValid = true;

  // Paper slug = the last path segment of paperDir, used to build the
  // `\sourcebase`-relative chapter URL inside \chapterannot{}.
  const paperSlug = paperDir.split("/").filter(Boolean).pop() ?? "";

  // Document-wide glossary-term references. Chapters render
  // independently, so this must be computed once over ALL blocks before
  // the loop: body prose citing a glossary term is almost always in a
  // different chapter from the entry that defines it, and a chapter-local
  // scan cannot see across that boundary.
  const renderOpts: RenderOptions & LatexTranslationOptions = {
    ...opts,
    referencedTerms: collectReferencedTerms(blocks),
  };

  const locale = opts.locale;
  const shouldResolvePo = Boolean(locale && locale !== "en");
  const folioRoot = opts.folioRoot ?? (() => {
    const p2 = resolve(paperDir, "..", "..");
    const p1 = resolve(paperDir, "..");
    if (existsSync(join(p2, "translations"))) return p2;
    if (existsSync(join(p1, "translations"))) return p1;
    return paperDir;
  })();
  const poCtx = shouldResolvePo ? poResolveContext(folioRoot) : undefined;

  for (const { chapter, manifestIdx, dir } of resolvedChapters) {
    let chapterOpts: RenderOptions & LatexTranslationOptions = renderOpts;
    if (shouldResolvePo && locale) {
      const chSources = resolvePoSources(
        { folioRoot, locale, chapterSlug: dir, blockStem: dir },
        poCtx,
      );
      const chTranslations = mergePoSources(chSources, parsePo);
      if (opts.translations) {
        for (const [k, v] of opts.translations) chTranslations.set(k, v);
      }
      const blockTranslations = new Map<string, Map<string, string>>(opts.blockTranslations ?? []);
      for (const sec of chapter.sections) {
        if (!("blocks" in sec)) continue;
        const section = sec as Section;
        const subBlocks = Array.isArray(section.subsections)
          ? section.subsections.flatMap((s) => ("blocks" in s ? (s as Section).blocks : []))
          : [];
        for (const rootName of [...section.blocks, ...subBlocks]) {
          if (blockTranslations.has(rootName)) continue;
          const blkSources = resolvePoSources(
            { folioRoot, locale, chapterSlug: dir, blockStem: rootName },
            poCtx,
          );
          if (blkSources.length > 0) {
            const blkMap = mergePoSources(blkSources, parsePo);
            if (opts.translations) {
              for (const [k, v] of opts.translations) blkMap.set(k, v);
            }
            blockTranslations.set(rootName, blkMap);
          }
        }
      }
      chapterOpts = {
        ...renderOpts,
        translations: chTranslations,
        blockTranslations,
      };
    }
    const latex = renderChapter(chapter, blocks, chapterOpts, dir, paperSlug);
    chapters.set(manifestIdx, latex);

    // AST validation
    const ast = validateLatexAst(latex);
    if (!ast.valid) {
      astValid = false;
      for (const err of ast.errors) {
        issues.push({ level: "error", message: `Chapter ${chapter.number ?? chapter.title} AST: ${err}` });
      }
    }
  }

  // 4. Cross-reference validation: detect \hyperref targets that have
  //    no corresponding \label in the rendered output.
  //    Collect all defined labels (from blocks, sections, chapters).
  const definedLabels = new Set<string>();
  for (const [name, entry] of blocks) {
    if (!entry.block || typeof entry.block !== "object") {
      console.warn(`build: skipping malformed block entry for "${name}" `
        + `(block is ${entry.block === null ? "null"
          : typeof entry.block})`);
      continue;
    }
    const label = extractBlockLabel(entry.block);
    if (label) definedLabels.add(label);
  }
  for (const { chapter } of resolvedChapters) {
    if (chapter.label) definedLabels.add(chapter.label);
    for (const sec of chapter.sections) {
      if (!("blocks" in sec)) continue;
      if ((sec as Section).label) definedLabels.add((sec as Section).label!);
    }
  }

  // A `\label{…}` written inside the markdown — typically in a ```tex
  // fence around `\begin{equation}\label{eq:foo}` — defines a perfectly
  // good LaTeX anchor and IS resolvable by `[text](#eq:foo)`. Collecting
  // only block/chapter/section labels above therefore under-counts what
  // is defined, and every equation cross-reference in the corpus was
  // reported "referenced but no content block defines this label".
  //
  // Measured on the qou paper: all 10 remaining pipeline warnings were
  // this one blind spot — the `eq:` namespace has zero *block* labels by
  // construction, because equations are labelled inline rather than
  // promoted to `equation` blocks. Several of the reported labels were
  // resolving fine in the built PDF at the time they were being warned
  // about, which is the signature of a checker looking in the wrong place.
  for (const [, entry] of blocks) {
    for (const m of entry.mdContent.matchAll(/\\label\{([^}]+)\}/g)) {
      definedLabels.add(m[1]);
    }
  }

  // Scan all markdown content for [text](#label) cross-references
  const referencedLabels = new Set<string>();
  for (const [, entry] of blocks) {
    const matches = entry.mdContent.matchAll(/\[([^\]]*)\]\(#([^)]+)\)/g);
    for (const match of matches) {
      const label = match[2];
      // Skip cross-paper references (handled separately in render)
      if (!isCrossPaperRef(label)) {
        referencedLabels.add(label);
      }
    }
  }

  // Report undefined references as warnings
  for (const label of referencedLabels) {
    if (!definedLabels.has(label)) {
      issues.push({
        level: "warning",
        message: `Undefined cross-reference: "${label}" — referenced but no content block defines this label`,
      });
    }
  }

  return { chapters, chapterSlugs, appendixChapters, appendixPhantomLabels, issues, astValid };
}

// ── CLI entry point ──────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  // Resolve relative paths against cwd so `bun run cat-harness-tools/pipeline/build.ts rel/path` works.
  // Only treat args[0] as a paper path if it's a positional argument (not a --flag);
  // otherwise fall back to the default paper. This allows invocations like
  // `bun run cat-harness-tools/pipeline/build.ts --generate-main --main-out main.tex` without a path.
  const firstPositional = args[0] && !args[0].startsWith("--") ? args[0] : undefined;

  // The default was
  //   join(HARNESS_ROOT, "content", "quantum-observable-universe", "quantum-observable-universe.ts")
  // — a specific FOLIO paper, named in PLATFORM code and resolved relative to
  // this file, so it pointed at `<platform>/content/quantum-observable-universe`
  // which exists in no checkout. Discover the folio's papers instead, the way
  // `validate.ts` already does. One paper is unambiguous; several need an
  // explicit argument; none is an error worth stating rather than a path that
  // fails to import.
  const contentRoot = findContentRepoRoot();
  const paperPath = resolve(firstPositional ?? (() => {
    const papers = findPapers(contentRoot);
    if (papers.length === 1) return join(folioDir(contentRoot),  papers[0], `${papers[0]}.ts`);
    if (papers.length === 0) {
      console.error(`No paper found under ${folioDir(contentRoot)}.`);
      console.error("folio-assistant is the PLATFORM; papers live in a folio. Run this from the folio,");
      console.error("or pass a paper manifest explicitly: bun run cat-harness-tools/pipeline/build.ts <paper>/<paper>.ts");
      process.exit(1);
    }
    console.error(`${papers.length} papers found (${papers.join(", ")}) — name one:`);
    console.error("  bun run cat-harness-tools/pipeline/build.ts folio/<paper>/<paper>.ts");
    process.exit(1);
  })());
  const outDirIdx = args.indexOf("--out-dir");
  // The default was `join(HARNESS_ROOT, "chapters")` — this file's
  // own location, so the PLATFORM checkout. `chapters/*.tex` is folio build
  // output; every CI invocation passes `--out-dir ../chapters/` from inside
  // the folio, which is why this never showed there. `server.ts` invokes
  // this script twice WITHOUT the flag, and those runs wrote a paper's
  // chapters into the platform repo. `findContentRepoRoot()` walks up from
  // cwd — it must not use `import.meta.dir`, which resolves through the
  // folio's `folio-assistant/` symlink back to the platform.
  const outDir = resolve(
    outDirIdx >= 0 ? args[outDirIdx + 1] : join(contentRoot, "chapters"),
  );

  // Parse print mode options
  const printModeIdx = args.indexOf("--print-mode");
  const printMode = printModeIdx >= 0 ? args[printModeIdx + 1] as "formal" | "compact" : "compact";
  const noInlineRefs = args.includes("--no-inline-refs");

  console.log(`Building paper: ${paperPath}`);
  console.log(`Output dir: ${outDir}`);
  console.log(`Print mode: ${printMode}${noInlineRefs ? " (inline refs disabled)" : ""}\n`);

  const result = await buildPaper(paperPath, {
    printMode,
    compactInlineRefs: !noInlineRefs,
  });

  // Print issues
  for (const issue of result.issues) {
    const icon = issue.level === "error" ? "✗" : issue.level === "warning" ? "⚠" : "ℹ";
    console.log(`  ${icon} ${issue.message}`);
  }

  // Write chapter output
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  for (const [num, latex] of result.chapters) {
    const slug = result.chapterSlugs.get(num);
    const filename = slug ? `${slug}.tex` : `chapter-${num}.tex`;
    const outPath = join(outDir, filename);
    writeFileSync(outPath, latex);
    console.log(`  → ${outPath}`);
  }

  // Generate main.tex from paper manifest + shared preamble
  if (args.includes("--generate-main")) {
    const mainOutIdx = args.indexOf("--main-out");
    const mainOutPath = resolve(mainOutIdx >= 0 ? args[mainOutIdx + 1] : "main.tex");
    const preambleIdx = args.indexOf("--preamble");
    const preamblePath = await resolvePaperPreamble(
      preambleIdx >= 0 ? args[preambleIdx + 1] : undefined,
    );
    // The platform carries no preamble since bean 0uu2 (it was one folio's,
    // and the folio keeps the corrected copy); the paper adapter supplies its
    // print template when installed (bean 4dj5). Say that, rather than ENOENT.
    if (!existsSync(preamblePath)) {
      console.error(
        `--generate-main needs a preamble and ${preamblePath} does not exist. ` +
          "Install the paper content adapter or pass --preamble <the folio's preamble.tex>.",
      );
      process.exit(2);
    }
    // Compute relative chapters dir from the main.tex output location
    const chaptersDirIdx = args.indexOf("--chapters-dir");
    const chaptersDir = chaptersDirIdx >= 0 ? args[chaptersDirIdx + 1] : "chapters/";

    const paperMod = await import(paperPath);
    const paperData: Paper = paperMod.default;

    // Exclude standalone appendix chapters from the main paper PDF
    const excludeChapterIndices = new Set(result.appendixChapters.keys());

    const mainTex = generateMainTex(paperData, {
      preamblePath,
      chaptersDir,
      chapterSlugs: result.chapterSlugs,
      excludeChapterIndices,
      phantomLabels: result.appendixPhantomLabels,
    });
    writeFileSync(mainOutPath, mainTex);
    console.log(`\n  → main.tex: ${mainOutPath}`);

    // Generate standalone .tex files for each appendix chapter
    const { generateStandaloneAppendixTex } = await import("./generate-main-tex");
    const mainOutDir = dirname(mainOutPath);
    for (const [_idx, info] of result.appendixChapters) {
      const appendixTex = generateStandaloneAppendixTex(paperData, info.slug, info.title, {
        preamblePath,
        chaptersDir,
      });
      const appendixPath = join(mainOutDir, `standalone-${info.slug}.tex`);
      writeFileSync(appendixPath, appendixTex);
      console.log(`  → standalone: ${appendixPath}`);
    }

    // LaTeX preflight (macro lint) on the generated compile unit. Catches
    // the recurring fatal-pdflatex classes (duplicate \newcommand,
    // undefined control sequence, fragile math-accent script) that the
    // unified-latex AST validation cannot see. Reported here for local
    // feedback; CI gates on it separately in publish.yml.
    const pre = runPreflight(mainOutPath);
    if (pre.ok) {
      console.log(
        `  → LaTeX preflight: ✓ clean (${pre.usedCount} macros, ` +
          `${pre.filesScanned} files)`,
      );
    } else {
      console.log(`  → LaTeX preflight: ✗ ${pre.issues.length} issue(s)`);
      for (const iss of pre.issues.slice(0, 30)) {
        console.log(`     [${iss.check}] ${iss.message}`);
      }
      if (pre.issues.length > 30) {
        console.log(`     … and ${pre.issues.length - 30} more`);
      }
    }
  }

  console.log(`\nAST validation: ${result.astValid ? "✓ pass" : "✗ fail"}`);
  const errorCount = result.issues.filter(i => i.level === "error").length;
  console.log(`Issues: ${errorCount} error(s), ${result.issues.length - errorCount} warning(s)`);

  process.exit(errorCount > 0 ? 1 : 0);
}
