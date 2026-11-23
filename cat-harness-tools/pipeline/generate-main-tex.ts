/**
 * Generate a per-paper main.tex from the shared preamble template
 * and the paper's .ts manifest.
 *
 * Paper-specific parts generated from manifest:
 *   - Custom macros (\newcommand)
 *   - Title page with CC license
 *   - hypersetup (PDF metadata)
 *   - Abstract
 *   - Chapter \input lines (excluding standalone appendices)
 *   - Appendix B: Bibliography (BibTeX)
 *
 * Standalone appendices (chapters with tabLabel other than "I") are
 * excluded from the main paper and get their own .tex files via
 * generateStandaloneAppendixTex().
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/generate-main-tex.ts <paper.ts> [--preamble preamble.tex] [--out main.tex] [--chapters-dir chapters/]
 *
 * @module pipeline/generate-main-tex
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import type { Paper } from "../schemas/types.ts";
import { escapeLatex } from "./render-latex";
import { resolveRenderTarget } from "./render-discovery";
import { findContentRepoRoot, requirePaper } from "./repo-root";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { resolveAdapterPreamble } from "../src/builtin-adapters";

/**
 * Resolve the print preamble template for a paper build: an explicit
 * `--preamble` path when given, else the template supplied by the `paper`
 * adapter through {@link resolveRenderTarget} / {@link resolveAdapterPreamble}
 * (bean `4dj5`, #2117 P2).
 *
 * Falls back to `join(HARNESS_ROOT, "latex", "preamble.tex")` only when no
 * `paper` adapter is installed, so a caller's existence check still names the
 * missing path.
 */
export async function resolvePaperPreamble(explicitPreamble?: string): Promise<string> {
  if (explicitPreamble !== undefined && explicitPreamble !== "") {
    return resolve(explicitPreamble);
  }
  const targetLookup = await resolveRenderTarget("paper");
  if (targetLookup.target?.preamblePath) {
    return resolve(targetLookup.target.preamblePath);
  }
  const contributed = await resolveAdapterPreamble("paper");
  return resolve(contributed ?? join(HARNESS_ROOT, "latex", "preamble.tex"));
}

/**
 * Escape text for use in LaTeX metadata fields (title, author, etc.).
 * Does NOT escape math or other intentional LaTeX — only structural chars.
 */
function escapeLatexMeta(text: string): string {
  return text
    .replace(/&/g, "\\&")
    .replace(/#/g, "\\#")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export interface GenerateMainTexOptions {
  /** Path to the shared preamble.tex template. */
  preamblePath: string;
  /** Directory where chapter .tex files live (for \input paths). */
  chaptersDir: string;
  /** Chapter slugs keyed by chapter number (from BuildResult). */
  chapterSlugs: Map<number, string>;
  /** Chapter indices to exclude from the main paper (standalone appendices). */
  excludeChapterIndices?: Set<number>;
  /** Labels from excluded appendix chapters to declare as phantom anchors. */
  phantomLabels?: string[];
}

/**
 * Per-document preamble tail: paper macros + the per-render print-mode read.
 * These are per-paper / per-render, emitted live after the inlined preamble.
 */
function emitPerDocPreambleTail(paper: Paper): string[] {
  const lines: string[] = [];

  // Paper-specific macros (per-paper, not shared).
  if (paper.macros && Object.keys(paper.macros).length > 0) {
    lines.push("% ── Paper macros (generated from manifest) ────────────────────────────────");
    for (const [name, macro] of Object.entries(paper.macros)) {
      const comment = macro.unicode ? `  % ${macro.unicode}` : "";
      lines.push(`\\newcommand{\\${name}}{${macro.tex}}${comment}`);
    }
    lines.push("");
  }

  // Per-render print-mode flag. `\newif\ifshowaffiliations` stays in the shared
  // preamble; only this file-read is per-document (print-mode.tex is written
  // per render by the MCP render tool). Lands after the preamble (where `\newif`
  // is defined) and before the title page (which consumes `\ifshowaffiliations`).
  lines.push("% ── Print mode (per-render) ─────────────────────────────────────────────────");
  lines.push("\\IfFileExists{print-mode.tex}{\\input{print-mode.tex}}{}");
  lines.push("");

  // Fast preview (FAST_PREVIEW=1; QOU_FAST_PREVIEW=1 is the old name and still
  // read, so existing invocations keep working): the ~2944 per-block margin
  // annotations (the ∇ / # / + source-and-issue icons, emitted as
  // \blockannot → \marginnote) cost ~50% of compile time — measured on a
  // real engine: one full pass 19.5 s → 9.2 s with them disabled.
  // No-op \marginnote for preview / iteration builds; the body (text,
  // math, labels, cross-refs) is byte-identical. The PUBLISHED build
  // leaves this flag unset and keeps every margin icon.
  // The sci skill `latex-build-cache` documents FAST_PREVIEW; this read only
  // QOU_FAST_PREVIEW, so following the skill silently did nothing (2026-10-04).
  const fastPreview = process.env.FAST_PREVIEW ?? process.env.QOU_FAST_PREVIEW;
  if (fastPreview === "1") {
    lines.push("% ── Fast preview: margin annotations disabled (~2x faster; preview only) ──");
    lines.push("\\renewcommand{\\marginnote}[2][]{}");
    lines.push("");
  }

  return lines;
}

/**
 * Emit the document preamble (the full shared preamble inlined) + the
 * per-document tail (paper macros + print-mode).
 */
function emitPreambleAndMacros(paper: Paper, preamblePath: string): string[] {
  const lines: string[] = [];
  const preamble = readFileSync(preamblePath, "utf-8");
  lines.push(preamble.trimEnd());
  lines.push("");
  lines.push(...emitPerDocPreambleTail(paper));
  return lines;
}

/**
 * Generate a complete main.tex for a paper.
 *
 * Chapters listed in `opts.excludeChapterIndices` are omitted from the
 * main PDF (they become standalone appendix PDFs instead).
 */
export function generateMainTex(
  paper: Paper,
  opts: GenerateMainTexOptions,
): string {
  const lines: string[] = [];

  // 1. Preamble + macros
  lines.push(...emitPreambleAndMacros(paper, opts.preamblePath));

  // 2. Metadata (for hypersetup PDF fields)
  lines.push("% ── Metadata (generated from manifest) ────────────────────────────────────");
  const authorName = escapeLatexMeta(paper.authors[0] || "");
  lines.push(`\\title{${escapeLatexMeta(paper.title)}}`);
  lines.push(`\\author{${authorName}}`);
  lines.push(`\\date{${paper.date ? escapeLatexMeta(paper.date) : "\\today"}}`);
  lines.push("");

  // hypersetup
  lines.push("\\hypersetup{");
  lines.push(`  pdftitle  = {${escapeLatexMeta(paper.title)}},`);
  lines.push(`  pdfauthor = {${escapeLatexMeta(paper.authors.join(", "))}},`);
  lines.push("  colorlinks = true,");
  lines.push("  linkcolor  = blue,");
  lines.push("  citecolor  = blue,");
  lines.push("  urlcolor   = blue,");
  lines.push("}");
  lines.push("");

  // 3. Begin document
  lines.push("% ──────────────────────────────────────────────────────────────────────────────");
  lines.push("\\begin{document}");
  lines.push("");

  // Title page — title, author, date only. Centered, vertically balanced.
  // The CC license + copyright notice now lives on its own page (front matter
  // book convention).
  lines.push("% ── Title page ────────────────────────────────────────────────────────────");
  lines.push("\\begin{titlepage}");
  lines.push("\\centering");
  lines.push("\\vspace*{3cm}");
  lines.push(`{\\LARGE\\bfseries ${escapeLatexMeta(paper.title)}}\\\\[2em]`);
  if (paper.affiliations?.length) {
    lines.push("\\ifshowaffiliations");
    lines.push(`  {\\large ${authorName}\\thanks{${escapeLatexMeta(paper.affiliations[0])}}}\\\\[1em]`);
    lines.push("\\else");
    lines.push(`  {\\large ${authorName}}\\\\[1em]`);
    lines.push("\\fi");
  } else {
    lines.push(`{\\large ${authorName}}\\\\[1em]`);
  }
  lines.push(`{\\large ${paper.date ? escapeLatexMeta(paper.date) : "\\today"}}`);
  lines.push("\\vfill");
  lines.push("\\end{titlepage}");
  lines.push("");

  // Copyright page — CC license notice on its own page.
  lines.push("% ── Copyright page ────────────────────────────────────────────────────────");
  lines.push("\\thispagestyle{empty}");
  lines.push("\\null\\vfill");
  lines.push("\\begin{center}{\\small");
  lines.push("  \\ccby\\\\[0.5em]");
  lines.push("  This work is licensed under a");
  lines.push("  \\href{https://creativecommons.org/licenses/by/4.0/}{%");
  lines.push("    Creative Commons Attribution 4.0 International License}.\\\\[0.3em]");
  lines.push("  You are free to share and adapt this material for any purpose,\\\\");
  lines.push("  provided appropriate credit is given, a link to the license is provided,\\\\");
  lines.push("  and any changes made are indicated.");
  lines.push("}\\end{center}");
  lines.push("\\vfill\\null");
  lines.push("\\clearpage");
  lines.push("");

  // Abstract — placed before TOC, book-style.
  if (paper.abstract) {
    lines.push("% ── Abstract ──────────────────────────────────────────────────────────────");
    lines.push("\\begin{abstract}");
    lines.push(paper.abstract);
    lines.push("\\end{abstract}");
    lines.push("");
  }

  lines.push("\\proofstatuslegend");
  lines.push("\\clearpage");
  lines.push("");

  // Introduction (if present) is emitted before the TOC per chapter-reorg
  // intent, so readers see framing before navigation.
  const sortedEntries = [...opts.chapterSlugs.entries()].sort(
    ([a], [b]) => a - b,
  );
  const introEntry = sortedEntries.find(
    ([num, slug]) => slug === "introduction" && !opts.excludeChapterIndices?.has(num),
  );
  if (introEntry) {
    lines.push("% ── Introduction (pre-TOC) ───────────────────────────────────────────────");
    lines.push(`\\input{${opts.chaptersDir}${introEntry[1]}}`);
    lines.push("");
  }

  // Table of contents — depth limited to chapters + sections by preamble.
  // The renderer prepends \clearpage to every chapter (see render-latex.ts
  // renderChapter), so no extra \clearpage is needed here.
  lines.push("% ── Table of contents ─────────────────────────────────────────────────────");
  lines.push("\\tableofcontents");
  lines.push("");

  // 4. Chapter includes (excluding standalone appendices)
  // Emits an optional `\part{...}` banner before any chapter whose
  // ChapterRef carries a `partTitle` (groups subsequent chapters
  // visually until the next `partTitle` or end-of-paper).
  lines.push("% ── Chapters (generated from manifest) ────────────────────────────────────");
  for (const [num, slug] of sortedEntries) {
    if (opts.excludeChapterIndices?.has(num)) continue;
    if (introEntry && num === introEntry[0]) continue; // already emitted pre-TOC
    const partTitle = paper.chapters[num]?.partTitle;
    if (partTitle) {
      lines.push(`\\part{${escapeLatex(partTitle)}}`);
    }
    lines.push(`\\input{${opts.chaptersDir}${slug}}`);
  }
  lines.push("");

  // 5. Appendix B: Bibliography (BibTeX)
  lines.push("% ── Appendix B: References ─────────────────────────────────────────────────");
  lines.push("\\clearpage");
  lines.push("\\chapter*{Appendix B. References}");
  lines.push("\\addcontentsline{toc}{chapter}{Appendix B. References}");
  lines.push("\\bibliographystyle{plain}");
  lines.push("\\bibliography{references}");
  lines.push("");

  // 6. Phantom labels for excluded appendix chapters.
  // Blocks in standalone appendices (glossary, knot table, etc.) are not
  // compiled into the main PDF, but may be referenced via \hyperref from
  // the main body. Declaring phantom labels prevents "Hyper reference
  // undefined" warnings without including the full appendix content.
  if (opts.phantomLabels?.length) {
    lines.push("% ── Phantom labels (excluded appendix blocks) ─────────────────────────────");
    lines.push("% These labels are defined in standalone appendix PDFs but referenced from");
    lines.push("% the main paper body. Phantom declarations prevent hyperref warnings.");
    for (const label of opts.phantomLabels) {
      lines.push(`\\phantomsection\\label{${label}}`);
    }
    lines.push("");
  }

  lines.push("\\end{document}");

  return lines.join("\n") + "\n";
}

/**
 * Generate a standalone .tex file for a single appendix chapter.
 *
 * Produces a self-contained document that can be compiled independently.
 */
export function generateStandaloneAppendixTex(
  paper: Paper,
  chapterSlug: string,
  chapterTitle: string,
  opts: { preamblePath: string; chaptersDir: string },
): string {
  const lines: string[] = [];

  // 1. Preamble + macros (same as main paper)
  lines.push(...emitPreambleAndMacros(paper, opts.preamblePath));

  // 2. Metadata
  const authorName = escapeLatexMeta(paper.authors[0] || "");
  lines.push("% ── Metadata ──────────────────────────────────────────────────────────────");
  lines.push(`\\title{${escapeLatexMeta(chapterTitle)}}`);
  lines.push(`\\author{${authorName}}`);
  lines.push(`\\date{${paper.date ? escapeLatexMeta(paper.date) : "\\today"}}`);
  lines.push("");

  lines.push("\\hypersetup{");
  lines.push(`  pdftitle  = {${escapeLatexMeta(chapterTitle)}},`);
  lines.push(`  pdfauthor = {${escapeLatexMeta(paper.authors.join(", "))}},`);
  lines.push("  colorlinks = true,");
  lines.push("  linkcolor  = blue,");
  lines.push("  citecolor  = blue,");
  lines.push("  urlcolor   = blue,");
  lines.push("}");
  lines.push("");

  // 3. Begin document
  lines.push("\\begin{document}");
  lines.push("\\maketitle");
  lines.push("");

  // 4. Include the chapter
  lines.push(`\\input{${opts.chaptersDir}${chapterSlug}}`);
  lines.push("");

  // 5. Bibliography (if the chapter has citations)
  lines.push("\\bibliographystyle{plain}");
  lines.push("\\bibliography{references}");
  lines.push("");
  lines.push("\\end{document}");

  return lines.join("\n") + "\n";
}

// ── CLI entry point ──────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  // Was `join(HARNESS_ROOT, "content", "quantum-observable-universe", "…")` — a
  // specific FOLIO paper named in PLATFORM code, under a path resolved from
  // this file, so it pointed at `<platform>/content/quantum-observable-universe`
  // which exists in no checkout. Same fix as `build.ts`.
  const contentRoot = findContentRepoRoot();
  let paperPath: string;
  try {
    paperPath = resolve(
      args[0] ||
        (() => {
          const p = requirePaper(undefined, contentRoot);
          return join(folioDir(contentRoot),  p, `${p}.ts`);
        })(),
    );
  } catch (err) {
    console.error(
      `No paper manifest found under ${contentRoot} — refusing to report success.\n` +
      "This generates main.tex for a FOLIO's content; folio-assistant is the platform.\n" +
      "Run it from the content repo, or name a paper explicitly.\n" +
      (err instanceof Error ? err.message : String(err)),
    );
    process.exit(2);
  }

  if (!existsSync(paperPath)) {
    console.error(
      `Paper manifest not found: ${paperPath} — refusing to report success.\n` +
      "This generates main.tex for a FOLIO's content; folio-assistant is the platform.\n" +
      "Run it from the content repo, or name a paper explicitly.",
    );
    process.exit(2);
  }

  const preambleIdx = args.indexOf("--preamble");
  const preamblePath = await resolvePaperPreamble(
    preambleIdx >= 0 ? args[preambleIdx + 1] : undefined,
  );
  if (!existsSync(preamblePath)) {
    console.error(
      `generate-main-tex needs a preamble and ${preamblePath} does not exist. ` +
        "Install the paper content adapter or pass --preamble <the folio's preamble.tex>.",
    );
    process.exit(2);
  }

  const outIdx = args.indexOf("--out");
  const outPath = resolve(outIdx >= 0 ? args[outIdx + 1] : "main.tex");

  const chaptersDirIdx = args.indexOf("--chapters-dir");
  const chaptersDir = chaptersDirIdx >= 0 ? args[chaptersDirIdx + 1] : "chapters/";

  console.log(`Generating main.tex for: ${paperPath}`);
  console.log(`Preamble: ${preamblePath}`);
  console.log(`Output: ${outPath}`);

  // Import paper manifest
  const paperMod = await import(paperPath);
  const paper: Paper = paperMod.default;

  // Import build to get chapter slugs
  const { buildPaper } = await import("./build");
  const result = await buildPaper(paperPath);

  const tex = generateMainTex(paper, {
    preamblePath,
    chaptersDir,
    chapterSlugs: result.chapterSlugs,
  });

  writeFileSync(outPath, tex);
  console.log(`✓ main.tex written to ${outPath}`);
}
