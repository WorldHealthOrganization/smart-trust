/**
 * Assemble a folio into a single Markdown document — the render path that
 * needs no TeX installation.
 *
 * ## Why this exists rather than reusing the LaTeX pipeline
 *
 * `render-latex.ts` is a *translator*: block `.md` is Markdown, LaTeX is not,
 * so ~1,800 lines convert one to the other and the fidelity of that
 * conversion is most of the file. Assembling the same corpus into Markdown is
 * a different job — the block bodies are already in the target language, so
 * what is left is structure: headings, block headers, labels, anchors and
 * ordering. Routing Markdown through the LaTeX renderer and back out again
 * would introduce an escaping round-trip that can only lose information.
 *
 * The consequence worth stating: this module is not a second renderer to keep
 * in sync with the first. It shares the *inputs* (the same manifests, the
 * same `.md` files) and nothing else, so a change to LaTeX escaping has no
 * counterpart here to drift from.
 *
 * ## What it deliberately does not do
 *
 * No citation resolution, no bibliography, no glossary, no cross-reference
 * numbering. Those are real features of the LaTeX pipeline and their absence
 * here is a gap, not a design statement — but each needs a decision about
 * what the Markdown analogue *is* (a footnote? a link? CSL JSON?), and
 * guessing wrong would be worse than the honest omission. Cross-references
 * are emitted as anchor links, which is the one case where the analogue is
 * unambiguous. `\cite{…}` is left verbatim so it is visible in the output
 * rather than silently dropped.
 *
 * @module pipeline/render-markdown
 */

import { resolveLiquidValues } from "./liquid-values";
import { existsSync, readFileSync } from "fs";
import { basename, dirname, isAbsolute, join, resolve } from "path";

import type { Block, Chapter, Paper, Section } from "../schemas/types.ts";
import { isSectionRef } from "../adapters/manifest-entries";
import { kindHeading } from "../schemas/content/translation.ts";
import { mergePoSources, poResolveContext, resolvePoSources } from "./po-resolve";
import { injectMarkdown, parsePo, translateBlockFields, translateManifestText } from "./po-inject";
import { dmnRefusalNote, placeDmnTable, renderDmnFile, type BlockRef, type BlockRefs } from "./render-dmn-table";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

// ── Block headers ────────────────────────────────────────────────

/**
 * The heading shown above a block, by kind.
 *
 * `prose` is absent on purpose: a prose block is narrative, and stamping
 * "**Prose.**" above every paragraph of a policy document would be noise on
 * the most common kind in the corpus. Every other kind names itself, because
 * a reader needs to know whether they are looking at an example or a
 * normative statement.
 *
 * This lookup now delegates to `kindHeading(kind, locale)` from
 * `schemas/content/translation.ts`, which carries translations in all six UN
 * languages and falls back to English → title-cased kind name. The old
 * English-only `KIND_HEADING` map is retired; the function preserves
 * the same design intent (prose returns `undefined`).
 */

/** A block as this module needs it: the manifest plus its narrative body. */
export interface LoadedBlockEntry {
  block: Block;
  mdContent: string;
  /**
   * The block's decision table, drawn from its `.dmn` companion
   * (`render-dmn-table.ts`), or the note saying why it was not. Placed in the
   * body at `<!-- dmn:table -->`, else after it (issue #1323).
   */
  dmnTable?: string;
}

export interface MarkdownRenderOptions {
  /**
   * Emit an HTML anchor (`<a id="…">`) before each labelled block.
   *
   * On by default because a label is the only stable handle a cross-reference
   * has, and GFM's heading-derived anchors change whenever a title is edited
   * — which is exactly when a link most needs to keep working.
   */
  anchors?: boolean;
  /** Heading level the chapter title is emitted at. Sections take this + 1. */
  baseHeadingLevel?: number;
  /**
   * BCP 47 locale for block kind headings (e.g. "Définition" instead of
   * "Definition" when rendering in French) and PO resolution in
   * `buildDocumentMarkdown`. Defaults to "en".
   */
  locale?: string;
  /**
   * Pre-merged gettext translations (`parsePo` / `mergePoSources` map).
   * When provided, `renderBlockMarkdown`, `renderSectionMarkdown`, and
   * `renderChapterMarkdown` translate manifest metadata (`title`, `caption`,
   * `narrative`, section/chapter titles) and inject translations into each
   * block's `.md` narrative body (G5).
   */
  translations?: Map<string, string>;
  /**
   * Optional per-block translation map (`rootName -> Map<string, string>`),
   * populated by `buildDocumentMarkdown` when `locale` is non-source so
   * block-specific `.po` files (`translations/<locale>/<stem>.po`) override
   * chapter/folio `.po` files without leaking across blocks.
   */
  blockTranslations?: Map<string, Map<string, string>>;
  /**
   * Folio root directory used by `buildDocumentMarkdown` to resolve
   * `translations/<locale>/*.po` via `resolvePoSources` when `locale` is
   * set and `translations` is not explicitly supplied.
   */
  folioRoot?: string;
}

/**
 * Translate a loaded block entry (manifest metadata + `.md` narrative body)
 * against a merged gettext map (G5).
 */
export function translateBlockEntry(
  entry: LoadedBlockEntry,
  translations: Map<string, string>,
  locale?: string,
): LoadedBlockEntry {
  if (translations.size === 0) return entry;
  const block = translateBlockFields(
    entry.block as Block & Record<string, unknown>,
    translations,
    locale,
  ) as Block;
  const mdContent = entry.mdContent
    ? injectMarkdown(entry.mdContent, translations).translated
    : entry.mdContent;
  return { block, mdContent };
}

/** `#` repeated, clamped to the six levels HTML actually has. */
function hashes(level: number): string {
  return "#".repeat(Math.max(1, Math.min(6, level)));
}

function blockLabel(block: Block): string | undefined {
  return "label" in block && typeof block.label === "string" ? block.label : undefined;
}

function blockTitle(block: Block): string | undefined {
  return "title" in block && typeof block.title === "string" ? block.title : undefined;
}

/** Kinds whose source publication numbers them ("Fig. 6", "Table 2"). */
const NUMBERED_KINDS = new Set(["figure", "diagram", "table"]);

/**
 * The number a caption starts with, and the caption without it.
 *
 * Ingested figures keep their source number in the caption (`Fig. 1. Product
 * master data`, `Fig 1.`, `Figure 2.13:`, `Table 3.`). Until 2026-10-31 the
 * heading printed a bare `**Figure.**` and the number survived only in the
 * italic caption under the image, so a reader could not see or cite "Figure 1"
 * where the block starts (owner, dth-pc preview). A caption that names several
 * figures (`Fig. 26. ...; Fig. 27. ...`) keeps its full text and the heading
 * takes the range. No number is invented: a caption with none returns null.
 */
export function captionNumber(caption: string): { number: string; rest: string } | null {
  const m = /^\s*(?:Fig\.?|Figure|Table|Tbl\.?)\s*(\d+(?:\.\d+)*)\s*[.:]?\s*/i.exec(caption);
  if (!m) return null;
  const all = [...caption.matchAll(/\b(?:Fig\.?|Figure|Table)\s*(\d+(?:\.\d+)*)/gi)].map((x) => x[1]!);
  const distinct = [...new Set(all)];
  if (distinct.length > 1) return { number: `${distinct[0]}\u2013${distinct[distinct.length - 1]}`, rest: caption.trim() };
  return { number: m[1]!, rest: caption.slice(m[0].length).trim() };
}

/**
 * A link to the block's own anchor, drawn with the theme's `#svg-link` icon
 * like every heading's, so a figure or table can be linked to and copied the
 * way a section can. Its own class, not `anchor-heading`: that class is the
 * theme's, positioned for headings, and its text is what
 * `check-inline-scripts.ts` treats as a rewrite signature.
 */
function blockAnchorLink(label: string, what: string): string {
  return `<a href="#${label}" class="block-anchor" aria-label="Link to ${what}" title="Link to ${what}"><svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><use xlink:href="#svg-link"></use></svg></a>`;
}

/**
 * Render one block: an optional anchor, a bolded kind heading, then the body
 * verbatim.
 *
 * The body is emitted **unchanged**. That is the whole point of the Markdown
 * path — whatever an author wrote, including raw HTML, footnotes and GFM
 * tables, survives to the output because nothing translates it.
 */
export function renderBlockMarkdown(
  entry: LoadedBlockEntry,
  opts: MarkdownRenderOptions = {},
): string {
  const effectiveEntry =
    opts.translations && opts.translations.size > 0
      ? translateBlockEntry(entry, opts.translations, opts.locale)
      : entry;
  const { block, mdContent } = effectiveEntry;
  const lines: string[] = [];
  const label = blockLabel(block);
  const locale = opts.locale ?? "en";
  // prose's node declares an empty heading, so kindHeading returns "" for it;
  // suppressed here as well, because stamping "**Prose.**" over every
  // paragraph is noise and a contributed node could say otherwise.
  const rawHeading = kindHeading(block.kind, locale);
  const heading = block.kind === "prose" ? undefined : rawHeading;

  if (opts.anchors !== false && label) lines.push(`<a id="${label}"></a>`);

  const title = blockTitle(block);
  const caption =
    "caption" in block && typeof block.caption === "string" && block.caption.trim() !== ""
      ? block.caption
      : undefined;
  const numbered = heading && NUMBERED_KINDS.has(block.kind) && caption ? captionNumber(caption) : null;
  // Every other headed kind (requirements, personas, scenarios, data
  // elements, definitions, remarks…) is a structured block: a light card with
  // a small kind label, an id chip and a compact metadata row (owner,
  // 2026-11-01: "structured content in the narrative doesnt really appear
  // so. needs _light_ styling", "make more condensed", "look at all the
  // structured assets"). Rendering only; the source text is unchanged.
  if (heading && !NUMBERED_KINDS.has(block.kind)) {
    const prose = resolveLiquidValues(mdContent).trim();
    const body = entry.dmnTable ? placeDmnTable(prose, entry.dmnTable) : prose;
    return structuredBlockMarkdown(block, heading, title, caption, body, lines);
  }
  if (heading) {
    const name = numbered ? `${heading} ${numbered.number}` : heading;
    const link = opts.anchors !== false && label && NUMBERED_KINDS.has(block.kind) ? ` ${blockAnchorLink(label, name)}` : "";
    // A numbered block says its caption once, on the heading line (owner,
    // 2026-11-01, of a figure: "why figure 5 repeated twice?"). It used to
    // print "Figure 5." above and the caption again in italics below.
    const named = title ?? (numbered && numbered.rest ? numbered.rest : undefined);
    lines.push((named ? `**${name}.** *${named}*` : `**${name}.**`) + link);
    lines.push("");
  } else if (title) {
    // A kind with no heading is `prose`, and unheaded prose is the whole
    // reason `KIND_HEADING` omits it — stamping "**Prose.**" over every
    // paragraph would be noise on the corpus's most common kind. But a prose
    // block that carries a *title* is not anonymous narrative: it is the
    // pattern `normative-statements` prescribes for a recommendation, where
    // the title is the headline a reader cites. Dropping it here would lose
    // the most load-bearing line of a policy document.
    lines.push(`**${title}.**`);
    lines.push("");
  }

  // Same resolver as the LaTeX path (`liquid-values.ts`, bean kott), so the
  // site and the PDF print one number; pass-through prefixes (`site.data`)
  // are left for Jekyll / the IG Publisher.
  const prose = resolveLiquidValues(mdContent).trim();
  const body = entry.dmnTable ? placeDmnTable(prose, entry.dmnTable) : prose;
  if (body) lines.push(body);

  if (caption && caption !== title && !(numbered && numbered.rest && !title)) {
    // A numbered heading already says "Figure 1", so the caption drops its
    // own "Fig. 1." rather than print the number twice.
    const shown = numbered && numbered.rest ? numbered.rest : caption;
    if (body) lines.push("");
    lines.push(`*${shown}*`);
  }

  if (!NUMBERED_KINDS.has(block.kind)) return lines.join("\n");
  // Figures, diagrams and tables sit in one frame each, so every document
  // site styles them the same way (owner, 2026-11-01: "consistent style
  // across all document like things"; figures centred, titles centred and
  // at most 66% of the width, "also applies to tables"). The blank lines keep
  // the inside Markdown for CommonMark, and `markdown="1"` does it for kramdown.
  return [`<div class="fa-numbered fa-numbered-${block.kind}" markdown="1">`, "", ...lines, "", "</div>"].join("\n");
}

/** The block's own identifier, when its fields carry one (`FR-AN-01`, `NFR-01`, an indicator's `1-01`). */
function blockId(block: Block): string | undefined {
  const meta = "meta" in block && block.meta && typeof block.meta === "object" ? (block.meta as Record<string, unknown>) : {};
  for (const k of ["requirementId", "indicatorId", "id"]) {
    const v = meta[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}

const escHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Text with Markdown emphasis and a trailing ellipsis or period removed, for comparing a title to the body. */
const plain = (s: string): string => s.replace(/[*_`]/g, "").replace(/(\u2026|\.\.\.|\.)\s*$/, "").trim().toLowerCase();

/** A paragraph that is a metadata line: it opens with an italic `*Label:*`. */
const META_LINE = /^\*[^*\n]{1,40}:\*/;

/** A paragraph that is not plain text: a list, table, heading, HTML, quote, image, fence or display math. */
const BLOCK_START = /^(?:[-*+] |\d+[.)] |[|#<>!]|```|~~~|\$\$| {4})/;

/**
 * A structured block as a light card: `<kind label> <id chip> title`, run into
 * the body's first paragraph when the body opens with the id, then the body,
 * with trailing `*Label:* …` paragraphs set as a compact metadata row.
 *
 * The body says its id again in bold (`**FR-AN-01.** Standard reports…`), and
 * an ingested title is often the body's first sentence cut short. Both are
 * dropped from the HEADING, never from the body, so nothing the author wrote
 * is lost and nothing is said twice.
 */
function structuredBlockMarkdown(
  block: Block,
  heading: string,
  title: string | undefined,
  caption: string | undefined,
  body: string,
  lines: string[],
): string {
  const id = blockId(block);
  const head = [`<span class="fa-block-kind">${escHtml(heading)}</span>`];
  if (id) head.push(`<span class="fa-block-id">${escHtml(id)}</span>`);

  // Only the first paragraph and the trailing metadata lines are touched; the
  // rest of the body is kept byte for byte (a fenced block may hold blank lines).
  let rest = body;
  const cutFirst = (): string => {
    const end = rest.search(/\n\s*\n/);
    const first = end < 0 ? rest : rest.slice(0, end);
    rest = end < 0 ? "" : rest.slice(end).replace(/^\s+/, "");
    return first;
  };
  let runIn: string | undefined;
  const named = title ?? caption;
  const idHead = id ? new RegExp(`^\\*\\*${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\.\\*\\*\\s*|\\s+(.+?)\\*\\*)`).exec(rest) : null;
  if (idHead) {
    // "**FR-AN-01.** text" -> "text"; "**NFR-01 Security.** text" -> "**Security.** text".
    const first = cutFirst();
    runIn = idHead[1] !== undefined ? `**${idHead[1]}**${first.slice(idHead[0].length)}` : first.slice(idHead[0].length);
  } else if (rest && !BLOCK_START.test(rest)) {
    // A first paragraph of plain text runs in after the heading, as a paper's
    // run-in heads do, so the block opens on one line.
    runIn = cutFirst();
  }
  // The title is left off the heading when the run-in text already opens with it
  // (an ingested title is often the body's first words, or its bold lead).
  const said = runIn !== undefined && !!named && plain(runIn).startsWith(plain(named));
  if (named && !said) head.push(`**${named.replace(/\.\s*$/, "")}.**`);

  const meta: string[] = [];
  for (;;) {
    const cut = rest.search(/\n\s*\n(?![\s\S]*\n\s*\n)/);
    const last = cut < 0 ? rest : rest.slice(cut).trim();
    if (!last || !META_LINE.test(last)) break;
    meta.unshift(last);
    rest = cut < 0 ? "" : rest.slice(0, cut).trimEnd();
  }

  if ((block.kind as string) === "indicator") indicatorParts(block, meta, (html) => (rest = rest ? `${rest}\n\n${html}` : html));

  lines.push(runIn !== undefined && runIn !== "" ? `${head.join(" ")} ${runIn}` : head.join(" "));
  if (rest) lines.push("", rest);
  if (caption && title && caption !== title) lines.push("", `*${caption}*`);
  if (meta.length > 0) lines.push("", `<div class="fa-block-meta" markdown="1">`, "", meta.join("\n\n"), "", "</div>");
  return [`<div class="fa-block fa-block-${block.kind}" markdown="1">`, "", ...lines, "", "</div>"].join("\n");
}

/** An indicator's fields, read from its `meta` (Q-IND-1 A, 2026-11-02). */
const INDICATOR_META: ReadonlyArray<readonly [key: string, label: string]> = [
  ["module", "Module"],
  ["disaggregation", "Disaggregation"],
  ["dataSources", "Data sources"],
];

/**
 * An indicator card shows its calculation as a fraction, numerator over
 * denominator (times its unit), and its module, disaggregation and data
 * sources as metadata lines. Owner, 2026-11-02: "do we have node kind /
 * viewers for indicators yet?"; card Q-IND-1 = A. A field the text already
 * gives as a `*Numerator:*`-style line is not repeated.
 */
function indicatorParts(block: Block, meta: string[], addBody: (html: string) => void): void {
  const m = "meta" in block && block.meta && typeof block.meta === "object" ? (block.meta as Record<string, unknown>) : {};
  const str = (k: string): string | undefined => (typeof m[k] === "string" && (m[k] as string).trim() !== "" ? (m[k] as string).trim() : undefined);
  const said = (label: string): boolean => meta.some((l) => l.toLowerCase().startsWith(`*${label.toLowerCase()}:*`));
  const num = str("numerator");
  const den = str("denominator");
  if (num && den && !said("Numerator") && !said("Denominator")) {
    const unit = str("unit");
    addBody(
      `<div class="fa-block-ratio" role="group" aria-label="Calculation">` +
        `<div class="fa-block-ratio-frac"><span class="fa-block-ratio-num"><span class="fa-block-ratio-label">Numerator</span> ${escHtml(num)}</span>` +
        `<span class="fa-block-ratio-den"><span class="fa-block-ratio-label">Denominator</span> ${escHtml(den)}</span></div>` +
        (unit ? `<span class="fa-block-ratio-unit">\u00d7 ${escHtml(unit)}</span>` : "") +
        `</div>`,
    );
  }
  // One metadata line, like a requirement's "*Priority:* … *Linked use cases:* …".
  const line = INDICATOR_META.flatMap(([k, label]) => {
    const v = str(k);
    return v && !said(label) ? [`*${label}:* ${v}`] : [];
  }).join(" \u00b7 ");
  if (line) meta.push(line);
}

/**
 * The block root-names a section contributes, its subsections included, at
 * every depth. One level only until 2026-10-04: a document's 3.5.3.1 lost its
 * blocks, because the walk stopped at 3.5.3 (issue #197, the DPI-H draft).
 */
function sectionBlocks(sec: Section): string[] {
  const own = Array.isArray(sec.blocks) ? sec.blocks : [];
  const subs = Array.isArray(sec.subsections)
    ? sec.subsections.flatMap((s) => (isSectionRef(s) ? [] : sectionBlocks(s)))
    : [];
  return [...own, ...subs];
}

/**
 * Render one section: its heading, its own blocks in order, then each
 * subsection one heading level deeper.
 *
 * Subsections were flattened into the parent until 2026-10-04: their blocks
 * were rendered, their HEADINGS were not, so "1.1.1 What is a reference
 * architecture" vanished from a document whose reviewers cite it by number.
 * A heading level past six stays at six, which Markdown has no seventh of.
 */
export function renderSectionMarkdown(
  section: Section,
  blocks: Map<string, LoadedBlockEntry>,
  opts: MarkdownRenderOptions = {},
): string {
  const level = Math.min(6, (opts.baseHeadingLevel ?? 1) + 1);
  const lines: string[] = [];

  if (opts.anchors !== false && section.label) lines.push(`<a id="${section.label}"></a>`);
  // A chapter's LEAD (`Section.lead`) gets an anchor and no heading: the
  // chapter heading directly above already says it.
  if (!section.lead) {
    const secTitle =
      opts.translations && opts.translations.size > 0
        ? translateManifestText(section.title, opts.translations, "title")
        : section.title;
    lines.push(`${hashes(level)} ${secTitle}`);
    lines.push("");
  }

  for (const rootName of Array.isArray(section.blocks) ? section.blocks : []) {
    const entry = blocks.get(rootName);
    // A missing block is reported, never skipped in silence: a section that
    // renders short is otherwise indistinguishable from a section that is
    // short, and the manifest naming a block that does not exist is a real
    // finding that `content_validate` will also raise.
    if (!entry) {
      lines.push(`> **Missing block:** \`${rootName}\` is named by this section but was not loaded.`);
      lines.push("");
      continue;
    }
    const blockOpts = opts.blockTranslations?.has(rootName)
      ? { ...opts, translations: opts.blockTranslations.get(rootName) }
      : opts;
    lines.push(renderBlockMarkdown(entry, blockOpts));
    lines.push("");
  }

  for (const sub of Array.isArray(section.subsections) ? section.subsections : []) {
    if (isSectionRef(sub)) continue;
    lines.push(renderSectionMarkdown(sub, blocks, { ...opts, baseHeadingLevel: level }));
  }

  return lines.join("\n");
}

/** Render one chapter: its heading, then each section in manifest order. */
export function renderChapterMarkdown(
  chapter: Chapter,
  blocks: Map<string, LoadedBlockEntry>,
  opts: MarkdownRenderOptions = {},
): string {
  const level = opts.baseHeadingLevel ?? 1;
  const lines: string[] = [];

  if (opts.anchors !== false && chapter.label) lines.push(`<a id="${chapter.label}"></a>`);
  const chTitle =
    opts.translations && opts.translations.size > 0
      ? translateManifestText(chapter.title, opts.translations, "title")
      : chapter.title;
  lines.push(`${hashes(level)} ${chTitle}`);
  lines.push("");

  for (const sec of chapter.sections) {
    if (isSectionRef(sec)) continue;
    lines.push(renderSectionMarkdown(sec, blocks, opts));
  }

  return lines.join("\n");
}

// ── Whole-folio build ────────────────────────────────────────────

/**
 * A block's decision table from its `.dmn` companion, if it has one.
 *
 * The companion is `meta.dmnFile` when the block names one, else
 * `<root>.dmn` beside the block, the same stem rule as every other companion.
 * The decision is the block's `decisionId`, else the file's only decision.
 * Keyed on the companion, not on a kind name: the kind is a content layer's
 * (a DAK layer's `decision-table`), and this layer does not name it.
 *
 * A table the reader refuses is a warning and a visible note in its place,
 * not a build error: the refusal is about the content, and the DMN checks
 * (`dmn:report`) are where a layer chooses to make that a failure.
 */
function dmnCompanion(block: Block, chDir: string, rootName: string): string | undefined {
  const rec = block as unknown as { meta?: { dmnFile?: unknown } };
  const named = typeof rec.meta?.dmnFile === "string" ? rec.meta.dmnFile : undefined;
  const dmnPath = join(chDir, named ?? `${rootName}.dmn`);
  return named || existsSync(dmnPath) ? dmnPath : undefined;
}

function hasDmnCompanion(block: Block, chDir: string, rootName: string): boolean {
  return dmnCompanion(block, chDir, rootName) !== undefined;
}

async function blockDmnTable(
  block: Block,
  chDir: string,
  rootName: string,
  issues: MarkdownBuildResult["issues"],
  refs: BlockRefs,
): Promise<string | undefined> {
  const dmnPath = dmnCompanion(block, chDir, rootName);
  if (!dmnPath) return undefined;
  const rec = block as unknown as { decisionId?: unknown };
  const decisionId = typeof rec.decisionId === "string" ? rec.decisionId : undefined;
  const r = await renderDmnFile(dmnPath, decisionId, { refs });
  if (r.ok) return r.html;
  issues.push({ level: "warn", message: `Decision table not drawn for ${rootName}: ${r.reason}` });
  return dmnRefusalNote(r.reason);
}

export interface MarkdownBuildResult {
  /** The assembled document. */
  markdown: string;
  /** Chapter directory names, in manifest order. */
  chapterSlugs: string[];
  /** How many blocks were loaded and rendered. */
  blockCount: number;
  /** Anything that went wrong, at the level it went wrong at. */
  issues: { level: "error" | "warn"; message: string }[];
}

/**
 * Build a whole document to Markdown from its `.ts` manifest.
 *
 * Mirrors `buildPaper`'s traversal — manifest → chapter dirs → block `.ts` +
 * `.md` pairs — minus the Lean status overlay and the LaTeX render, neither
 * of which a document folio has any use for.
 *
 * @param paperPath - Path to the document's `.ts` manifest.
 */
export async function buildDocumentMarkdown(
  paperPath: string,
  opts: MarkdownRenderOptions = {},
): Promise<MarkdownBuildResult> {
  const issues: MarkdownBuildResult["issues"] = [];
  // `import()` of a relative specifier resolves against THIS module, not the
  // caller's cwd — so a relative `paperPath` silently looks for the folio
  // inside the platform. Resolve against cwd here rather than making every
  // caller remember to.
  const manifestPath = isAbsolute(paperPath) ? paperPath : resolve(process.cwd(), paperPath);
  const docDir = dirname(manifestPath);

  // input-site: traced #72b22832 — a document folio's manifest, loaded by path, as block-module and json-manifest load theirs: a run that reaches it records no hash
  inputSiteReached("render-markdown: document manifest");
  const paperMod = await import(manifestPath);
  const paper: Paper = paperMod.default;

  const blocks = new Map<string, LoadedBlockEntry>();
  const chapterSlugs: string[] = [];
  const rendered: string[] = [];
  const chapterRenders: (() => string)[] = [];
  const dmnPending: { rootName: string; chDir: string }[] = [];

  const locale = opts.locale;
  const shouldResolvePo = Boolean(locale && locale !== "en");
  // Default folioRoot: if docDir sits under `<folioRoot>/folio/<doc>` or `<folioRoot>/content/<doc>`,
  // try docDir's parent's parent if it has `translations/`, else docDir's parent, else docDir.
  const folioRoot = opts.folioRoot ?? (() => {
    const p2 = resolve(docDir, "..", "..");
    const p1 = resolve(docDir, "..");
    if (existsSync(join(p2, "translations"))) return p2;
    if (existsSync(join(p1, "translations"))) return p1;
    return docDir;
  })();
  const poCtx = shouldResolvePo ? poResolveContext(folioRoot) : undefined;
  const docStem = basename(manifestPath).replace(/\.ts$/, "");
  const docTranslations = (() => {
    const m = new Map<string, string>();
    if (shouldResolvePo && locale) {
      const sources = resolvePoSources({ folioRoot, locale, blockStem: docStem }, poCtx);
      for (const [k, v] of mergePoSources(sources, parsePo)) m.set(k, v);
      for (const chRef of paper.chapters) {
        const chSources = resolvePoSources(
          { folioRoot, locale, chapterSlug: chRef.dir, blockStem: chRef.dir },
          poCtx,
        );
        for (const [k, v] of mergePoSources(chSources, parsePo)) {
          if (!m.has(k)) m.set(k, v);
        }
      }
    }
    if (opts.translations) {
      for (const [k, v] of opts.translations) m.set(k, v);
    }
    return m;
  })();

  const rawDocTitle = paper.title ?? "Untitled document";
  const docTitle =
    docTranslations.size > 0
      ? translateManifestText(rawDocTitle, docTranslations, "title")
      : rawDocTitle;
  rendered.push(`# ${docTitle}`, "");


  for (const chRef of paper.chapters) {
    const chDir = join(docDir, chRef.dir);
    const chPath = join(chDir, `${chRef.dir}.ts`);
    if (!existsSync(chPath)) {
      issues.push({ level: "error", message: `Chapter manifest not found: ${chPath}` });
      continue;
    }

    let chapter: Chapter;
    try {
      // input-site: traced #b082593c — a chapter's manifest, loaded by path: a run that reaches it records no hash
      inputSiteReached("render-markdown: chapter manifest");
      chapter = (await import(chPath)).default as Chapter;
    } catch (e) {
      issues.push({
        level: "error",
        message: `Chapter manifest failed to import: ${chPath} — ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }
    chapterSlugs.push(chRef.dir);

    const chapterTranslations = new Map<string, string>(docTranslations);
    if (shouldResolvePo && locale) {
      const chSources = resolvePoSources(
        { folioRoot, locale, chapterSlug: chRef.dir, blockStem: chRef.dir },
        poCtx,
      );
      for (const [k, v] of mergePoSources(chSources, parsePo)) chapterTranslations.set(k, v);
      if (opts.translations) {
        for (const [k, v] of opts.translations) chapterTranslations.set(k, v);
      }
    }
    const blockTranslations = new Map<string, Map<string, string>>(opts.blockTranslations ?? []);

    for (const sec of chapter.sections) {
      if (isSectionRef(sec)) continue;
      for (const rootName of sectionBlocks(sec)) {
        if (shouldResolvePo && locale && !blockTranslations.has(rootName)) {
          const blkSources = resolvePoSources(
            { folioRoot, locale, chapterSlug: chRef.dir, blockStem: rootName },
            poCtx,
          );
          if (blkSources.length > 0) {
            const blkMap = new Map<string, string>(docTranslations);
            for (const [k, v] of mergePoSources(blkSources, parsePo)) blkMap.set(k, v);
            if (opts.translations) {
              for (const [k, v] of opts.translations) blkMap.set(k, v);
            }
            blockTranslations.set(rootName, blkMap);
          }
        }
        if (blocks.has(rootName)) continue;
        const tsPath = join(chDir, `${rootName}.ts`);
        const mdPath = join(chDir, `${rootName}.md`);
        if (!existsSync(tsPath)) {
          issues.push({ level: "error", message: `Block manifest not found: ${tsPath}` });
          continue;
        }
        try {
          // input-site: traced #f24abebe — a content block's manifest, loaded by path: a run that reaches it records no hash
          inputSiteReached("render-markdown: block manifest");
          const block = (await import(tsPath)).default as Block;
          const mdContent = existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : "";
          if (!mdContent.trim() && !hasDmnCompanion(block, chDir, rootName)) {
            issues.push({ level: "warn", message: `Block has no narrative body: ${mdPath}` });
          }
          blocks.set(rootName, { block, mdContent });
          dmnPending.push({ rootName, chDir });
        } catch (e) {
          issues.push({
            level: "error",
            message: `Block manifest failed to import: ${tsPath} — ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }
    }

    chapterRenders.push(() =>
      renderChapterMarkdown(chapter, blocks, {
        baseHeadingLevel: 2,
        ...opts,
        translations: chapterTranslations.size > 0 ? chapterTranslations : opts.translations,
        blockTranslations: blockTranslations.size > 0 ? blockTranslations : opts.blockTranslations,
      }),
    );
  }

  // Decision tables are drawn once every block is loaded, so a label in a
  // table can link to a block in any chapter, shown by its title.
  const refs = new Map<string, BlockRef>();
  for (const { block } of blocks.values()) {
    const label = blockLabel(block);
    if (label) refs.set(label, { title: blockTitle(block), href: `#${label}` });
  }
  for (const { rootName, chDir } of dmnPending) {
    const entry = blocks.get(rootName)!;
    const dmnTable = await blockDmnTable(entry.block, chDir, rootName, issues, refs);
    if (dmnTable) entry.dmnTable = dmnTable;
  }
  for (const render of chapterRenders) rendered.push(render());

  return {
    markdown: rendered.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n",
    chapterSlugs,
    blockCount: blocks.size,
    issues,
  };
}
