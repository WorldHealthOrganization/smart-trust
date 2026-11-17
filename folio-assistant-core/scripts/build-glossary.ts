/**
 * Glossary builder (Phase D of the `\defterm` / `\refterm` rollout).
 *
 * Walks every block in a paper, collects each block's `defines[]`,
 * resolves the canonical site (chapter + section + block label +
 * Lean declaration) and emits:
 *
 *   - `glossary.json`  — machine-readable index for the viewer / Lean
 *   - `chapters/glossary.tex` — chapter-grouped, alphabetical-within-chapter
 *     LaTeX glossary chapter. Duplicates (same slug declared by multiple
 *     blocks) render in red with a "(also defined at …)" cross-link.
 *   - `<glossary dir>/paper-<paper>.glossary.json` — the same terms as a
 *     `folio-glossary/v1` SKOS scheme, written into the glossary directory
 *     the paper's LAYER declares, so core's glossary page picks it up
 *     through `collect()` like any other scheme. See {@link toFolioGlossary}.
 *
 * ## Converged on SKOS, and stopped there (bean `lqo9`, ruling 2)
 *
 * Owner, 2026-09-24: *"Converge on SKOS"*. A paper's glossary and the KG
 * glossary answer the same question for a reader, so the paper's terms are
 * now one more `folio-glossary/v1` scheme rather than a second mechanism. The
 * convergence STOPS at SKOS: a clinical code system stays a FHIR CodeSystem,
 * and nothing here gives a term a version or a designation use.
 *
 * `glossary.json` and `glossary.tex` are unchanged, byte for byte: the TeX
 * chapter and the Lean synonyms module read them, and their `--check` gate is
 * what downstream CI runs. The scheme is added beside them.
 *
 * Run modes:
 *
 *   bun run folio-assistant-core/scripts/build-glossary.ts <paper-dir>           # write outputs
 *   bun run folio-assistant-core/scripts/build-glossary.ts <paper-dir> --check    # CI gate
 *
 * In `--check` mode the script exits non-zero if any glossary slug is
 * duplicated, if `glossary.json` on disk would change, if the SKOS scheme on
 * disk would change, or if two slugs would mint one term IRI. A scheme not
 * written yet is REPORTED, not failed, so a paper that has not regenerated
 * since the convergence keeps a green gate until it does.
 *
 * @module scripts/build-glossary
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, dirname, join, relative, resolve } from "path";
import type { Block, Chapter, Paper, Section } from "@litlfred/cat-harness-tools/schemas/types.js";
import { ChapterSchema, PaperSchema } from "@litlfred/cat-harness-tools/schemas/constraints.js";
import {
  findInstanceRoot,
  instanceDirectoryForGraph,
  readDeclaration,
  siblingScopeFor,
} from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import {
  GLOSSARY_SCHEMA_ID,
  GlossarySchema,
  type Glossary,
  type Term,
} from "../schemas/glossary";

// ── Types ────────────────────────────────────────────────────────

export interface GlossaryEntry {
  /** Canonical slug (lowercase, hyphen-separated). */
  slug: string;
  /** Chapter directory name (e.g. "quantum-universes"). */
  chapter: string;
  /** Chapter title (resolved from chapter manifest). */
  chapterTitle: string;
  /** Section title within the chapter, if any. */
  section: string | null;
  /** Block label (e.g. "def:rigid-monoidal-category"). */
  block: string;
  /** Block kind (definition, theorem, …). */
  kind: string;
  /** Lean ref URI (e.g. "qou:QOU.Foo.bar"), if any. */
  lean: string | null;
}

export interface GlossaryIndex {
  /** Build timestamp (ISO 8601). */
  generated: string;
  /** Source paper directory name. */
  paper: string;
  /** All entries, alphabetical by slug. */
  entries: GlossaryEntry[];
  /** Slugs declared by more than one block (slug → list of block labels). */
  duplicates: Record<string, string[]>;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Locate the chapter+section that contains a given block name. */
function locateBlock(
  blockName: string,
  chapter: Chapter,
): { sectionTitle: string | null } {
  for (const sec of chapter.sections) {
    if ("blocks" in sec) {
      const s = sec as Section;
      if (s.blocks.includes(blockName)) {
        return { sectionTitle: s.title ?? null };
      }
    }
  }
  return { sectionTitle: null };
}

/**
 * Walk a paper directory, importing the paper manifest, every chapter
 * manifest, and every block .ts file. Returns the flat list of glossary
 * entries plus the duplicate map.
 */
export async function buildGlossary(paperDir: string): Promise<GlossaryIndex> {
  return (await walkPaper(paperDir)).index;
}

/**
 * Where each entry was found: the block's `.md` and the paper's title. Kept
 * OUT of {@link GlossaryEntry}, because adding a field there changes
 * `glossary.json` and fails every downstream `--check` on upgrade.
 */
export interface EntrySite {
  entry: GlossaryEntry;
  /** Absolute path of the block's `.md` body (may not exist). */
  md: string;
}

/** {@link buildGlossary}, plus each entry's site and the paper's title. */
export async function walkPaper(
  paperDir: string,
): Promise<{ index: GlossaryIndex; sites: EntrySite[]; title: string; paperDir: string }> {
  const paperName = basename(paperDir);
  const paperManifest = join(paperDir, `${paperName}.ts`);
  if (!existsSync(paperManifest)) {
    throw new Error(`Paper manifest not found: ${paperManifest}`);
  }

  const paperMod = await import(paperManifest);
  const paperParsed = PaperSchema.safeParse(paperMod.default);
  if (!paperParsed.success) {
    throw new Error(`Invalid paper manifest: ${paperManifest}`);
  }
  const paper: Paper = paperMod.default;

  const entries: GlossaryEntry[] = [];
  const sites: EntrySite[] = [];

  for (const chRef of paper.chapters) {
    const chDir = join(paperDir, chRef.dir);
    const chManifest = join(chDir, `${chRef.dir}.ts`);
    if (!existsSync(chManifest)) continue;

    const chMod = await import(chManifest);
    const chParsed = ChapterSchema.safeParse(chMod.default);
    if (!chParsed.success) continue;
    const chapter: Chapter = chMod.default;

    // Collect block names from sections, in document order.
    const blockNames: string[] = [];
    for (const sec of chapter.sections) {
      if ("blocks" in sec) blockNames.push(...(sec as Section).blocks);
    }

    for (const name of blockNames) {
      const tsPath = join(chDir, `${name}.ts`);
      if (!existsSync(tsPath)) continue;
      try {
        const mod = await import(tsPath);
        const block: Block = mod.default;
        // `defines` and `lean` are declared on some kinds and not others, so
        // the `in` test is the real check; `label` is on all of them.
        const defines = "defines" in block ? block.defines : undefined;
        if (!defines || defines.length === 0) continue;

        const { sectionTitle } = locateBlock(name, chapter);
        const lean = ("lean" in block ? block.lean?.ref : undefined) ?? null;

        for (const slug of defines) {
          const entry: GlossaryEntry = {
            slug,
            chapter: chRef.dir,
            chapterTitle: chapter.title ?? chRef.dir,
            section: sectionTitle,
            block: block.label ?? name,
            kind: block.kind,
            lean,
          };
          entries.push(entry);
          sites.push({ entry, md: join(chDir, `${name}.md`) });
        }
      } catch {
        // Skip unimportable blocks; the main validator will report them.
      }
    }
  }

  // Sort entries alphabetically by slug, then by chapter for stability.
  entries.sort((a, b) => a.slug.localeCompare(b.slug) || a.chapter.localeCompare(b.chapter));

  // Build duplicate map.
  const duplicates: Record<string, string[]> = {};
  const bySlug = new Map<string, GlossaryEntry[]>();
  for (const e of entries) {
    const list = bySlug.get(e.slug) ?? [];
    list.push(e);
    bySlug.set(e.slug, list);
  }
  for (const [slug, list] of bySlug) {
    if (list.length > 1) duplicates[slug] = list.map(e => e.block);
  }

  return {
    index: {
      generated: new Date().toISOString(),
      paper: paperName,
      entries,
      duplicates,
    },
    sites,
    title: paper.title,
    paperDir,
  };
}

// ── SKOS: the paper's glossary as a folio-glossary/v1 scheme ─────

/** The prefix of a paper's scheme id. One scheme per paper; the paper directory names it. */
export const PAPER_SCHEME_PREFIX = "paper-";

/** A string as a `folio-glossary/v1` local id: lowercase, `[a-z0-9._-]`, starting alphanumeric. */
export function localId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/-+$/, "");
}

const DIRECTIVE = /:(defterm|refterm)\[([^\]]*)\](\{[^}]*\})?/g;

/** The slug a `:defterm[Label]{#slug}` names: the explicit id, else the label. */
function directiveSlug(label: string, attrs: string | undefined): string {
  const m = attrs ? /(?:#|id=)["']?([^"'\s}]+)/.exec(attrs) : null;
  return (m ? m[1]! : label).trim();
}

/**
 * The defining occurrence of `slug` in a block's markdown: the paragraph
 * holding its `:defterm`, with every directive replaced by its visible label
 * and whitespace folded. Verbatim otherwise, as the KG extractor is: the
 * author's words, never a paraphrase.
 */
export function definingParagraph(md: string, slug: string): { label: string; text: string } | undefined {
  for (const para of md.split(/\n\s*\n/)) {
    for (const m of para.matchAll(DIRECTIVE)) {
      if (m[1] !== "defterm" || directiveSlug(m[2]!, m[3]) !== slug) continue;
      const text = para
        .replace(DIRECTIVE, (_all, _k, label: string) => label)
        .replace(/\s+/g, " ")
        .trim();
      return { label: m[2]!.trim() || slug, text };
    }
  }
  return undefined;
}

/**
 * The paper's glossary as a `folio-glossary/v1` scheme (bean `lqo9`, ruling 2).
 *
 * **Status by provenance** (owner, 2026-09-24): a definition AUTHORED in the
 * paper is `authored`; an extracted one is `candidate`.
 *
 * | the owning block | its `:defterm` paragraph | status |
 * |---|---|---|
 * | `kind: "definition"` | found | `authored`: the author wrote a definition block and marked the defining sentence |
 * | any other kind (theorem, remark, …) | found | `candidate`: a term introduced in passing, its sentence extracted rather than written as a definition |
 * | any | not found (no `.md`, or no `:defterm` for the slug) | `could-not-extract`, with the reason |
 *
 * **IRIs** are in the paper LAYER's namespace (`instanceNs`), never the
 * root's when the paper sits in a sub-layer, so two layers' papers
 * cannot collide; the scheme id is `paper-<paper directory>`, unique in the
 * layer because a directory name is.
 *
 * The slug is the term's `notation` (the paper's own code for it, used in
 * `\label{term:<slug>}`) and, normalised by {@link localId}, its id. A
 * duplicated slug is ONE concept whose scope note names every other site;
 * `--check` already fails on the duplicate itself.
 */
export function toFolioGlossary(
  walked: { index: GlossaryIndex; sites: EntrySite[]; title: string; paperDir: string },
  opts: { relTo: string },
): { glossary: Glossary; collisions: string[] } {
  const { index, sites, title } = walked;
  const bySlug = new Map<string, EntrySite[]>();
  for (const site of sites) {
    const list = bySlug.get(site.entry.slug) ?? [];
    list.push(site);
    bySlug.set(site.entry.slug, list);
  }
  const terms: Term[] = [];
  const idOwner = new Map<string, string>();
  const collisions: string[] = [];
  for (const [slug, list] of [...bySlug].sort(([a], [b]) => a.localeCompare(b))) {
    const id = localId(slug);
    if (!id) {
      collisions.push(`slug "${slug}" has no usable characters for a term id`);
      continue;
    }
    const prior = idOwner.get(id);
    if (prior !== undefined) {
      collisions.push(`slugs "${prior}" and "${slug}" both mint the term id "${id}"`);
      continue;
    }
    idOwner.set(id, slug);
    const { entry, md } = list[0]!;
    const rel = relative(opts.relTo, md).split("\\").join("/");
    let found: { label: string; text: string } | undefined;
    let reason: string | undefined;
    if (!existsSync(md)) reason = `the block ${entry.block} has no .md body at ${rel}`;
    else {
      found = definingParagraph(readFileSync(md, "utf-8"), slug);
      if (!found) reason = `no :defterm for "${slug}" in ${rel}`;
    }
    const where = [
      `Defined at ${entry.block} (${entry.kind}) in "${entry.chapterTitle}"`,
      entry.section ? `, section "${entry.section}"` : "",
      entry.lean ? `; Lean: ${entry.lean}` : "",
      list.length > 1 ? `; also defined at ${list.slice(1).map((x) => x.entry.block).join(", ")}` : "",
      ".",
    ].join("");
    const term: Term = {
      id,
      prefLabel: found?.label ?? slug.replace(/-/g, " "),
      notation: slug,
      scopeNote: where,
      source: `${rel}#${entry.block}`,
      status: found ? (entry.kind === "definition" ? "authored" : "candidate") : "could-not-extract",
      ...(found ? { definition: found.text } : {}),
      ...(reason ? { reason } : {}),
    };
    terms.push(term);
  }
  const glossary = GlossarySchema.parse({
    $schema: GLOSSARY_SCHEMA_ID,
    id: `${PAPER_SCHEME_PREFIX}${localId(index.paper)}`,
    title: `${title}: glossary`,
    description:
      `Terms defined in the paper "${title}", from its blocks' defines[] and each term's :defterm paragraph. ` +
      `Generated by build-glossary.ts; an authored term is one a definition block defines.`,
    source: relative(opts.relTo, walked.paperDir).split("\\").join("/") || undefined,
    terms,
  });
  return { glossary, collisions };
}

/**
 * Where the paper's scheme is written: the glossary directory the paper's
 * OWN layer declares (a sub-layer's, never the root's). That placement
 * is what puts the IRIs in the layer's namespace: `collect()` mints every
 * scheme's IRIs from the layer whose directory holds it (`instanceNs`).
 */
export function paperSchemeTarget(
  paperDir: string,
  schemeId: string,
): { file: string; instance: string; repo: string } | { missing: string } {
  const root = findInstanceRoot(paperDir);
  if (root === undefined) return { missing: `no instance declaration above ${paperDir}` };
  // A declaration that does not read is reported, never a crash: the
  // glossary.json/TeX half of this builder must keep working regardless.
  let decl: ReturnType<typeof readDeclaration>;
  let dir: string | undefined;
  try {
    decl = readDeclaration(root);
    dir = decl ? instanceDirectoryForGraph(root, "glossary") : undefined;
  } catch (e) {
    return { missing: `the declaration at ${root} could not be read (${e instanceof Error ? e.message.split("\n")[0] : String(e)})` };
  }
  if (!decl) return { missing: `the instance at ${root} has no readable declaration` };
  if (dir === undefined) {
    return {
      missing:
        `instance "${decl.name}" declares no glossary directory; add ` +
        `{ "id": "glossary", "path": "glossary/", "graphTypologies": ["glossary"] } to its directories`,
    };
  }
  return {
    file: join(dir, `${schemeId}.glossary.json`),
    instance: decl.name,
    repo: checkoutRoot(root),
  };
}

/**
 * What a term's `source` path is relative to: the git checkout holding the
 * layer, as the KG extractor's sources are repository-relative. With no
 * checkout (a fixture, an unpacked tarball), the layer's sibling scope.
 */
function checkoutRoot(instanceRoot: string): string {
  for (let dir = resolve(instanceRoot); ; ) {
    if (existsSync(join(dir, ".git"))) return dir;
    const up = resolve(dir, "..");
    if (up === dir) return siblingScopeFor(instanceRoot);
    dir = up;
  }
}

/**
 * Another scheme in the same glossary directory claiming the paper's scheme
 * id: two documents minting one scheme IRI. Named, never overwritten.
 */
export function schemeIdClash(file: string, schemeId: string): string | undefined {
  const dir = dirname(file);
  if (!existsSync(dir)) return undefined;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".glossary.json")).sort()) {
    const p = join(dir, f);
    if (p === file) continue;
    try {
      const id = (JSON.parse(readFileSync(p, "utf-8")) as { id?: unknown }).id;
      if (id === schemeId) return f;
    } catch {
      // Not ours to judge: check:glossary reports an unparseable document.
    }
  }
  return undefined;
}

/** The scheme file's text: stable, so `--check` compares it byte for byte. */
export function renderScheme(g: Glossary): string {
  return JSON.stringify(g, null, 2) + "\n";
}

// ── LaTeX rendering ──────────────────────────────────────────────

/**
 * Escape body text for LaTeX. Covers the full set of fragile characters
 * (`\\ _ & % # $ { } ~ ^`) so the output is safe in any text-mode context
 * (chapter/section titles, item bodies, `\texttt{}` arguments, etc.).
 *
 * Inline math segments delimited by `$…$` are passed through verbatim
 * so that section titles like `Reeb derivation for $\mathrm{SU}(2)$`
 * render correctly.
 */
function texEscapeText(s: string): string {
  // Split on inline math; even-indexed pieces are text, odd-indexed are math.
  const parts = s.split(/(\$[^$]*\$)/g);
  // Single-pass replacement so each character is matched at most once
  // (silences the CodeQL `js/incomplete-sanitization` false positive
  // that flags chained `replace` calls even when backslash is handled
  // first).
  const map: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "_": "\\_",
    "&": "\\&",
    "%": "\\%",
    "#": "\\#",
    "$": "\\$",
    "{": "\\{",
    "}": "\\}",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return parts
    .map((p, i) => (i % 2 === 1 ? p : p.replace(/[\\_&%#${}~^]/g, c => map[c])))
    .join("");
}

/**
 * Return a label string suitable as the first argument of `\label{}`,
 * `\hyperref[…]`, or `\ref{…}`. LaTeX label arguments are literal
 * identifiers — escaping `_` (or any other character) here would break
 * cross-references to `\label{def:foo_bar}` written elsewhere in the
 * document. The label is therefore returned verbatim.
 */
function texEscapeLabel(s: string): string {
  return s;
}

/**
 * Render the glossary as a generated LaTeX chapter.
 *
 * Layout: chapter-grouped (in paper.chapters order); within each chapter
 * the slugs are alphabetical. Duplicates render in red with a
 * "(also defined at …)" cross-reference.
 */
export function renderGlossaryTex(index: GlossaryIndex): string {
  const lines: string[] = [];
  lines.push("% Generated by folio-assistant-core/scripts/build-glossary.ts — do not edit by hand.");
  lines.push("\\chapter{Glossary}");
  lines.push("\\label{chap:glossary}");
  lines.push("");

  // Group by chapter, preserving declaration order.
  const byChapter = new Map<string, { title: string; entries: GlossaryEntry[] }>();
  for (const e of index.entries) {
    let bucket = byChapter.get(e.chapter);
    if (!bucket) {
      bucket = { title: e.chapterTitle, entries: [] };
      byChapter.set(e.chapter, bucket);
    }
    bucket.entries.push(e);
  }

  for (const [chap, { title, entries }] of byChapter) {
    lines.push(`\\section*{${texEscapeText(title)}}`);
    lines.push(`\\label{glossary:${texEscapeLabel(chap)}}`);
    lines.push("\\begin{description}");
    // Alphabetical within chapter.
    const sorted = [...entries].sort((a, b) => a.slug.localeCompare(b.slug));
    for (const e of sorted) {
      const isDup = (index.duplicates[e.slug] ?? []).length > 1;
      const term = `\\refterm{${texEscapeLabel(e.slug)}}`;
      const labelLink = `\\hyperref[${texEscapeLabel(e.block)}]{${texEscapeText(e.block)}}`;
      let body = `defined at ${labelLink}`;
      if (e.section) body += ` (\\S{}${texEscapeText(e.section)})`;
      if (e.lean) body += `; Lean: \\texttt{${texEscapeText(e.lean)}}`;
      if (isDup) {
        const others = (index.duplicates[e.slug] ?? []).filter(b => b !== e.block);
        const otherLinks = others
          .map(b => `\\hyperref[${texEscapeLabel(b)}]{${texEscapeText(b)}}`)
          .join(", ");
        body = `\\textcolor{red}{${body}; also defined at ${otherLinks}}`;
      }
      lines.push(`  \\item[${term}] ${body}`);
    }
    lines.push("\\end{description}");
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

// ── CLI entry point ──────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const checkMode = args.includes("--check");
  const positional = args.filter(a => !a.startsWith("--"));
  // The ARGUMENT is tested before it is resolved, and that order is the fix.
  // `resolve("")` returns the CWD — truthy, and it exists — so `resolve(positional[0] || "")`
  // made the guard below unreachable for the no-argument case: a bare
  // `bun run folio-assistant-core/scripts/build-glossary.ts` fell through it into `buildGlossary`, which threw
  // `Paper manifest not found: <cwd>/<cwd-basename>.ts` and exited 1 with a stack
  // trace. The usage line never printed and the exit code said "it broke" rather
  // than "you did not tell me which paper", which is the could-not-determine
  // state this script otherwise gets right everywhere.
  if (positional.length === 0) {
    console.error(`Usage: build-glossary.ts <paper-dir> [--check]`);
    process.exit(2);
  }
  const paperDir = resolve(positional[0]!);
  if (!existsSync(paperDir)) {
    console.error(`Usage: build-glossary.ts <paper-dir> [--check]\n  no such directory: ${paperDir}`);
    process.exit(2);
  }

  const walked = await walkPaper(paperDir);
  const index = walked.index;
  const tex = renderGlossaryTex(index);
  const schemeId = `${PAPER_SCHEME_PREFIX}${localId(index.paper)}`;
  const target = paperSchemeTarget(paperDir, schemeId);
  const skos =
    "missing" in target ? undefined : { target, ...toFolioGlossary(walked, { relTo: target.repo }) };
  const clash = "missing" in target ? undefined : schemeIdClash(target.file, schemeId);
  const skosProblems = [
    ...(skos?.collisions ?? []).map((c) => `term IRI collision: ${c}`),
    ...(clash ? [`scheme id "${schemeId}" is already taken by ${clash} in the same glossary directory`] : []),
  ];

  const jsonOutPath = join(paperDir, "glossary.json");
  // chapters/ is the conventional generated-LaTeX location at the repo root.
  const repoRoot = resolve(dirname(paperDir), "..");
  const texOutDir = join(repoRoot, "chapters");
  const texOutPath = join(texOutDir, "glossary.tex");

  if (checkMode) {
    let drift = false;
    const expected = JSON.stringify(index, null, 2) + "\n";
    if (existsSync(jsonOutPath)) {
      const onDisk = readFileSync(jsonOutPath, "utf-8");
      // Compare excluding the `generated` timestamp which changes per run.
      const stripTimestamp = (s: string) => s.replace(/"generated":\s*"[^"]*",?\s*\n?/g, "");
      if (stripTimestamp(onDisk) !== stripTimestamp(expected)) {
        console.error(`✗ glossary.json is out of date — re-run without --check.`);
        drift = true;
      }
    } else {
      console.error(`✗ glossary.json missing at ${jsonOutPath}`);
      drift = true;
    }
    if (Object.keys(index.duplicates).length > 0) {
      for (const [slug, owners] of Object.entries(index.duplicates)) {
        console.error(`✗ duplicate slug "${slug}" declared by: ${owners.join(", ")}`);
      }
      drift = true;
    }
    // The SKOS scheme. Stale or colliding fails; not yet written is reported,
    // so a paper that predates the convergence keeps its gate green.
    if ("missing" in target) {
      console.log(`· SKOS scheme not checked: ${target.missing}`);
    } else if (skos) {
      for (const p of skosProblems) {
        console.error(`✗ ${p}`);
        drift = true;
      }
      if (!existsSync(target.file)) {
        console.log(`· SKOS scheme not written yet at ${target.file}: re-run without --check.`);
      } else if (readFileSync(target.file, "utf-8") !== renderScheme(skos.glossary)) {
        console.error(`✗ ${target.file} is out of date — re-run without --check.`);
        drift = true;
      }
    }
    console.log(`Glossary entries: ${index.entries.length}, duplicates: ${Object.keys(index.duplicates).length}`);
    process.exit(drift ? 1 : 0);
  }

  writeFileSync(jsonOutPath, JSON.stringify(index, null, 2) + "\n");
  if (!existsSync(texOutDir)) mkdirSync(texOutDir, { recursive: true });
  writeFileSync(texOutPath, tex);
  console.log(`✓ Wrote ${jsonOutPath}`);
  console.log(`✓ Wrote ${texOutPath}`);
  console.log(`  ${index.entries.length} entries, ${Object.keys(index.duplicates).length} duplicates`);
  if ("missing" in target) {
    console.log(`· SKOS scheme not written: ${target.missing}`);
  } else if (skos && skosProblems.length) {
    for (const p of skosProblems) console.error(`✗ ${p}`);
    console.error("SKOS scheme not written: two terms or schemes would share an IRI.");
    process.exit(1);
  } else if (skos) {
    mkdirSync(dirname(target.file), { recursive: true });
    writeFileSync(target.file, renderScheme(skos.glossary));
    const by = (st: string) => skos.glossary.terms.filter((t) => t.status === st).length;
    console.log(
      `✓ Wrote ${target.file} (${target.instance}): ${by("authored")} authored, ` +
        `${by("candidate")} candidate, ${by("could-not-extract")} could-not-extract`,
    );
  }
}
