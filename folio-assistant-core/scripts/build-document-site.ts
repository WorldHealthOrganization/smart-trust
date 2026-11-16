#!/usr/bin/env bun
/**
 * build-document-site — a DOCUMENT folio rendered as a browsable site, for
 * staging previews and the review page. Bean `fyu2`, epic `q4jm`.
 *
 * ## Why this exists
 *
 * `folio-staging.yml` (bean `ojcx`) publishes whatever a folio's
 * `build_command` writes, and the platform had no command a document folio
 * could name. `publish.yml` builds a PAPER, through LaTeX. The document
 * adapter's `document_render_html` MCP tool renders one document to HTML, but
 * only as a tool call, through pandoc, into a build directory. A CI job wants a
 * command, a site directory, and no system install.
 *
 * So this reuses the adapter's own assembly, `buildDocumentMarkdown`, which
 * already emits `<a id="<label>">` before every labelled block, section and
 * chapter. Those anchors are what the review page and the ChangeSet link to.
 * It renders with `remark-html`, already a dependency, so no pandoc is
 * needed, and with `remark-gfm`, so a block's Markdown table is a `<table>`
 * rather than a paragraph of raw pipes (bean fz39, the owner's approval
 * 2026-09-23).
 *
 * ## Output
 *
 *   <out>/index.html             every document in the folio, linked
 *   <out>/en/<slug>/index.html   one page per document, block anchors intact
 *   <out>/en/<slug>/media/       the document's images, copied from folio/<slug>/media/
 *   <out>/en/review/index.html   what changed from main, read from the preview's
 *                                changeset.json when opened (bean txut)
 *   <out>/outline.json           every document's chapters, sections and blocks
 *                                in manifest order, for the review page's
 *                                outline and minimap (bean eb4l)
 *   <out>/<slug>/blocks/         a lazy document's block text, as data (bean v433)
 *   <out>/<slug>/kg/             every block's knowledge-graph node, as committed
 *   <out>/<slug>/graph.jsonld    the document's graph: every node in one file
 *   <out>/values.jsonld          every {{ … }} value the text refers to, as KG nodes
 *
 * Pages are under the page locale and data is not (issue #2527): see
 * `document-site-route.ts`, which says where each one goes.
 *
 * ## The outline's section keys are the ChangeSet's
 *
 * `folio-assistant-core/schemas/changeset.ts` names a section
 * `<manifest dir, relative to the folio>::<label ?? title>`, from the text of
 * the manifest. The outline writes exactly that key, so the review page can
 * join the two without guessing, and a test holds them equal on a real folio.
 * A section REFERENCE (its own `.ts`) is skipped here, as the Markdown build
 * skips it.
 *
 * ## Failure is loud
 *
 * A folio with no document, or a document whose assembly reports an error,
 * exits non-zero. So does a block with no `.jsonld` node, or a stale one
 * ({@link documentGraph}). A site that silently omitted a document would be a preview
 * that reads "that document was deleted" to a reviewer.
 *
 * Raw HTML in the assembled Markdown is kept (`sanitize: false`), because the
 * block anchors ARE raw HTML. The content is the folio's own, published by
 * the folio's own workflow, which is the same trust the build command already
 * has.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { remark } from "remark";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";

import { folioDir, readDeclaration, visualisationResolves, visualisationsOf, type CatHarnessDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { loadContributions, readHarnessConfig } from "@litlfred/cat-harness-tools/schemas/kg/harness-config.js";
import { detectRepoUrl, ownerRepo } from "@litlfred/cat-harness-tools/src/core/git-refs.js";
import { DEFAULT_TEMPLATE, compactActionsScript, injectBlockActions, readIssueForm, type BlockActionsConfig, type BlockContext } from "./block-actions.js";
import type { Chapter, Paper, Section, SectionRef } from "@litlfred/cat-harness-tools/schemas/types.js";
import { buildDocumentMarkdown } from "@litlfred/cat-harness-tools/pipeline/render-markdown.js";
import { loadBlocksUnder } from "@litlfred/cat-harness-tools/pipeline/block-module.js";
import { blockToJsonLd, serialise as serialiseNode } from "@litlfred/cat-harness-tools/pipeline/gen-block-jsonld.js";
import { atInstanceContext } from "@litlfred/cat-harness-tools/pipeline/instance-document-context.js";
import { writeValuesJsonLd } from "@litlfred/cat-harness-tools/pipeline/gen-values-jsonld.js";
import { bundleEditorProfiles } from "@litlfred/cat-harness-tools/pipeline/editor-profiles.js";
import { ContributionRegistry, type FolioContribution } from "@litlfred/cat-harness-tools/schemas/content/contributions.js";
import { reviewPageHtml } from "@litlfred/cat-harness-tools/scripts/gen-review-page.js";
import { darkRules } from "@litlfred/cat-harness-tools/scripts/lib/scheme-css.ts";
import { visualiserNavDeclaration, type VisualiserNavEntry } from "@litlfred/cat-harness-tools/scripts/lib/navbar.js";
import { wrapRaw } from "@litlfred/cat-harness-tools/scripts/lib/liquid-raw.ts";
import { scopeCss } from "./scope-css.js";
import { lightenDataElements, linkKindLabels, structuredAssets, structuredAssetsBody } from "./structured-assets.ts";

/** The structured-assets page's folder, beside the document page. */
const ASSETS_DIR = "assets";
import { liveFigures, withLiveFigures } from "./live-figures.js";
import { linkTerms, termLinks as glossaryTermLinks, type TermLink } from "./glossary-term-links.ts";
import { externalGlossaries, firstGlossaryLabel, withExternalGlossaries } from "./external-glossaries.ts";
import { referenceSegment } from "../schemas/reference.ts";
import { DOC_CLASS, DOCUMENT_END_MARKER, documentDataDir, documentExportDir, documentPage, documentPageDir, fromPageDir, hydratedPage, REVIEW_PAGE_DIR } from "./document-site-route.js";
import { latestNames } from "./document-export.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Tables, set apart from the narrative in the ArchiMate poster's look
 * (cat-harness-tools `archimate/scripts/figure-theme.ts`, THEME): a white card
 * with a deep ink header strip, pale banded rows and light rules, centred,
 * with room above and below. White in light and dark mode alike, as figures
 * are, so a table reads the same on every document page. Owner, 2026-11-01:
 * tables "run into narrative text", "use theme stylings", "smart-ra poster
 * colors/styling". `scope` prefixes every selector (the themed page).
 */
export function tableStyle(scope = ""): string {
  const s = scope ? `${scope} ` : "";
  return `
  ${s}table { display: block; box-sizing: border-box; width: max-content; min-width: 0; max-width: 100%; overflow-x: auto; margin: 1.5rem 0; border-collapse: collapse;
    background: #fff; color: #2d3748; border: 1px solid #14213d; border-radius: 6px; box-shadow: 0 1px 4px rgba(20, 33, 61, .18); font-size: .92em; }
  ${s}th, ${s}td { border: 1px solid #c9cfd8; padding: .4rem .65rem; text-align: left; vertical-align: top; background: #fff; color: #2d3748; }
  ${s}thead th { background: #14213d; color: #fff; font-weight: 600; border-color: #14213d; }
  ${s}tbody tr:nth-child(even) > td { background: #f3f4f6; }
  ${s}table a { color: #0b5cad; }
  ${s}table code { color: inherit; background: none; padding: 0; }
  /* The card is white in both modes, so its cells are too: a dark theme's own
     "th, td" fill (just-the-docs dark: #302d36) put ink on ink, and its
     "table { min-width: 100% }" stretched the card past its rows into a white
     strip (owner, 2026-11-08: "light mode hard to read", "and dark mode",
     "ugly white padding on right"). */
  /* Tables sit at the start of the reading column, never centred or pushed past it ("tables should be left aligned",
     2026-11-02); a table wider than the column scrolls inside it. */
`;
}

/** The standalone page's own stylesheet. Light and dark follow the reader's system setting. */
const PAGE_STYLE = `<style>
  :root { color-scheme: light dark; --fg: #1b1b1b; --bg: #fdfdfb; --muted: #5b5b5b; --link: #0b5cad; }
  ${darkRules(`:root { --fg: #e8e8e6; --bg: #161616; --muted: #a8a8a4; --link: #7db4ff; }`)}
  body { margin: 0; font: 1.05rem/1.6 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
  /* The column and its gutters belong to main, not body: the harness rail sets
     body padding-left to clear its strip, which replaced a body's own gutter and
     put the text flush against the rail (owner, 2026-10-05). No tag names in
     this comment: the rail injector finds the page's first body and main tags
     by text. */
  main { max-width: 46rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
  a { color: var(--link); }
  a:focus-visible { outline: 3px solid var(--link); outline-offset: 2px; }
  h1, h2, h3 { line-height: 1.25; }
${tableStyle()}  :target, main [id] { scroll-margin-top: 1rem; }
  .katex-display { overflow-x: auto; overflow-y: hidden; }
  dfn.defterm { font-style: normal; font-weight: 600; }
  .cite { color: var(--muted); }
  .fa-blk:empty { min-height: 3rem; }
  .fa-one-page { font-size: .85rem; color: var(--muted); }
  .fa-downloads { font-size: .9rem; color: var(--muted); }
  .fa-live-figure, .fa-live-figure img { display: block; max-width: 100%; height: auto; }
  .fa-live-figure-note { display: block; font-size: .85rem; color: var(--muted); }
</style>`;

/** A readable page shell. Light and dark follow the reader's system setting. */
function page(title: string, body: string, math?: MathOptions, tail = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${PAGE_STYLE}${math ? mathHead(math) : ""}
</head>
<body>
<main>
${body}
</main>${tail}
</body>
</html>
`;
}

// ── Themed pages: the document inside the site's layout (--document-layout) ─
//
// A standalone page wears only the injected rail. On a folio site that Jekyll
// builds, the document page can instead name the site's layout, as the landing
// can (`landingPage`), and wear the full chrome: top bar, search, sidebar.
// Inside the layout the standalone page's stylesheet would restyle the theme
// (`:root`, `body`, `main`, `a`, `table`), so a themed page carries its own,
// every rule under {@link DOC_CLASS}, and inherits the theme's colours and
// type. The page is built standalone first, so [edit]/[feedback] (which need
// the head and body tags) go in the one way, and is then taken apart.

export { DOC_CLASS };

/** The themed page's own rules: what the standalone stylesheet does that the theme does not. */
const THEMED_STYLE = `
.${DOC_CLASS} :target, .${DOC_CLASS} [id] { scroll-margin-top: 4rem; }
.${DOC_CLASS} .katex-display { overflow-x: auto; overflow-y: hidden; }
.${DOC_CLASS} dfn.defterm { font-style: normal; font-weight: 600; }
.${DOC_CLASS} .cite { opacity: .72; }
.${DOC_CLASS} .fa-blk:empty { min-height: 3rem; }
.${DOC_CLASS} .fa-one-page { font-size: .85rem; opacity: .72; }
.${DOC_CLASS} .fa-downloads { font-size: .9rem; }
.${DOC_CLASS} .pc-bar { position: static; background: none; }
${tableStyle(`.${DOC_CLASS}`)}`;

/** A layout name as front matter may carry it, or a throw. */
function layoutName(layout: string, what: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(layout)) throw new Error(`${what} layout ${JSON.stringify(layout)} is not a layout name`);
  return layout;
}

/**
 * Give each heading the assembly anchored an `id` of its own, `h-<label>`, so
 * the theme's "On this page" (docs-ui.js, which lists `h2[id]`/`h3[id]`) has
 * destinations. The anchor before the heading keeps its id, which every
 * existing link uses. Unique against every id on the page; a heading that
 * already has an id is left alone.
 */
export function headingIds(html: string): string {
  const taken = new Set(idsIn(html));
  return html.replace(/(<p><a id="([^"]+)"><\/a><\/p>\s*<(h[1-6]))(\s[^>]*)?>/g, (m, lead: string, label: string, _tag: string, attrs = "") => {
    if (/\sid=/.test(attrs)) return m;
    let id = `h-${label}`;
    for (let n = 2; taken.has(id); n++) id = `h-${label}-${n}`;
    taken.add(id);
    return `${lead} id="${id}"${attrs}>`;
  });
}

/**
 * A standalone document page (from {@link page}, actions already injected) as
 * a JEKYLL page in `layout`: front matter, then one Liquid raw block holding
 * the scoped styles, the head's scripts and stylesheet links (KaTeX), the
 * document in a `div.fa-doc`, the page's trailing scripts, and
 * {@link DOCUMENT_END_MARKER} where a later step adds to the page. Out of
 * search (`search_exclude`): the page is far larger than the index wants.
 */
export function themedDocumentPage(layout: string, title: string, html: string): string {
  layoutName(layout, "document");
  const h0 = html.indexOf("<head>\n");
  const h1 = html.indexOf("</head>");
  const b0 = html.indexOf("<body>\n<main>\n");
  const b1 = html.lastIndexOf("</body>");
  if (h0 < 0 || h1 < h0 || b0 < h1 || b1 < b0) throw new Error("themedDocumentPage: not a page this command built");
  let head = html.slice(h0 + "<head>\n".length, h1);
  if (!head.includes(PAGE_STYLE)) throw new Error("themedDocumentPage: the page's stylesheet is not the standalone one");
  head = head.replace(PAGE_STYLE, "").replace(/<meta [^>]*>\n?/g, "").replace(/<title>[\s\S]*?<\/title>\n?/, "");
  const styles: string[] = [];
  head = head.replace(/<style>([\s\S]*?)<\/style>/g, (_m, css: string) => (styles.push(scopeCss(css, `.${DOC_CLASS}`)), ""));
  const inner = html.slice(b0 + "<body>\n<main>\n".length, b1);
  const end = inner.lastIndexOf("\n</main>");
  if (end < 0) throw new Error("themedDocumentPage: the page has no main column");
  const body = [
    `<style>${THEMED_STYLE}${styles.join("")}</style>`,
    ...(head.trim() ? [head.trim()] : []),
    `<div class="${DOC_CLASS}">`,
    inner.slice(0, end),
    `</div>${inner.slice(end + "\n</main>".length).replace(/\n+$/, "")}`,
    DOCUMENT_END_MARKER,
  ].join("\n");
  return [`---`, `layout: ${layout}`, `title: ${JSON.stringify(title)}`, `search_exclude: true`, `---`, ...wrapRaw(body), ``].join("\n");
}

/**
 * The page's contents, declared for the harness rail (owner, 2026-10-07:
 * *"LHS navbar should show page TOCs"*). The rail indexes headings that carry
 * an `id`, and a document's headings carry none: the assembly writes each
 * chapter's and section's label as an anchor JUST BEFORE its heading
 * (`<p><a id="sec:1-1"></a></p>` then `<h3>`), because those ids are what the
 * review page, the change-sets and the comment notes link to. So the index is
 * declared, pointing at those anchors, rather than moving an id every other
 * link already depends on.
 *
 * Chapters are rows and their sections are the rows' children, one level, as
 * the declaration allows. A heading with no anchor before it is not a
 * destination and is left out. Absent when fewer than two rows result: an
 * index of the one chapter in view is a menu that does nothing.
 */
export function pageContents(html: string): string {
  const entries: VisualiserNavEntry[] = [];
  const text = (h: string) =>
    h
      .replace(/<[^>]*>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  const re = /<p><a id="([^"]+)"><\/a><\/p>\s*<(h2|h3)\b[^>]*>([\s\S]*?)<\/\2>/g;
  for (const m of html.matchAll(re)) {
    const row = { label: text(m[3]!), href: `#${m[1]}` };
    if (!row.label) continue;
    const parent = entries[entries.length - 1];
    if (m[2] === "h3" && parent) parent.items = [...(parent.items ?? []), row];
    else entries.push(row);
  }
  return entries.length < 2 ? "" : visualiserNavDeclaration(entries) + "\n";
}

// ── Lazy pages: the block text as data (bean v433, owner 2026-10-06) ────────
//
// *"that can be dynamic JS load of KG, as should of rest of content"*. A large
// document's page is a SHELL: every heading, every block anchor (so links, the
// review page, [edit]/[feedback] and the comment notes all still find their
// block) and an empty placeholder per block. Each block's rendered HTML is
// published as data, `<slug>/blocks/NNN.json`, in document order, a chunk of
// {@link LAZY_CHUNK} blocks each. The page loads the chunks near the reader,
// then the rest in idle time. `index.hydrated.html` is the whole document on one page,
// as before: a `file://` open (where fetch fails), a reader without
// JavaScript, and any tool that wants the text in the page all get that.
//
// Small documents stay one page: below {@link LAZY_THRESHOLD} blocks there is
// nothing to save, and one file is simpler to read and to test. Searching the
// comments is the dashboard's job (owner: "only the visualizer search for the
// PCs"), so nothing here needs the text in the page to be findable at once.

// ── The knowledge graph, published (owner 2026-10-14) ───────────────────────
//
// Every block is a KG node: its `<block>.jsonld`, written by
// `gen-block-jsonld.ts` and committed beside it. Bean v433 was asked for a
// *"dynamic JS load of KG"* and published rendered HTML only, and this
// builder never read a node, so a document folio's site carried no graph at
// all, and a folio that had never generated one looked no different
// (litlfred/dth-hrh, found 2026-10-14). The nodes are now published as data,
// one per block under `kg/` and all together in `graph.jsonld`, and a node
// that is missing, or that differs from what the generator would write now,
// fails the build: a site whose graph is silently absent or out of date is
// the failure this replaces.

/** A document's block nodes, as committed, and what is wrong with them. */
export async function documentGraph(
  docDir: string,
  slug: string,
  contributions?: ContributionRegistry,
): Promise<{ nodes: Array<{ rel: string; text: string }>; errors: string[] }> {
  // A dependency's kinds (a DAK layer's personas, scenarios, requirements) are blocks too.
  const kinds = new Set(contributions?.contributedBuilders().values() ?? []);
  const { blocks, failures } = await loadBlocksUnder(docDir, kinds);
  const errors = failures.map((f) => `${relative(docDir, f.file)} did not load: ${f.error}`);
  const nodes: Array<{ rel: string; text: string }> = [];
  for (const b of [...blocks.values()].sort((x, y) => x.file.localeCompare(y.file))) {
    const path = b.file.replace(/\.ts$/, ".jsonld");
    const rel = relative(docDir, path);
    if (!existsSync(path)) {
      errors.push(`${rel}: no KG node (run gen-block-jsonld.ts)`);
      continue;
    }
    const text = readFileSync(path, "utf-8");
    // The generator names the context of the layer the file sits in
    // (`atInstanceContext`, bean folio-assistant-63q4), so compare with that.
    if (text !== serialiseNode(atInstanceContext(blockToJsonLd(b, slug, [], [], contributions), path))) errors.push(`${rel}: KG node is stale (run gen-block-jsonld.ts)`);
    nodes.push({ rel, text });
  }
  return { nodes, errors };
}

/** Errors past this many are counted, not listed: one cause usually explains them all. */
const GRAPH_ERRORS_LISTED = 20;

/** The site's variable values (`gen-values-jsonld`), at the site root. */
export const VALUES_FILE = "values.jsonld";
/** Where the ✍ suggest editor's profile bundles are published, from the site root. */
export const SUGGEST_DIR = "assets/suggest";

export const LAZY_THRESHOLD = 200;

/**
 * First in a lazy page's body, so it runs before any block is laid out: a
 * page opened at a link draws its empty placeholders, and the links of blocks
 * not shown, at no height, so the text arriving above the link never pushes
 * it down (dth-hrh, owner 2026-10-31: "when this loads, it scrolls"). The
 * loader then folds what is above the link (`data-fold`) and adds a
 * "Show this chapter's text" button under each folded chapter's heading.
 */
export const LAZY_OPEN = `<script>if (location.hash.length > 1) document.documentElement.setAttribute("data-fa-open", "");</script>
<style>
html[data-fa-open] .fa-blk:not([data-filled]), html[data-fa-open] .fa-blk[data-fold] { min-height: 0; }
html[data-fa-open] .fa-blk[data-below]:not([data-filled]) { min-height: 3rem; }
html[data-fa-open] p:has(+ .fa-blk:not([data-filled])) > .block-actions,
html[data-fa-open] p:has(+ .fa-blk[data-fold]) > .block-actions,
html[data-fa-open] p:has(+ .fa-blk[data-fold]) > .pc-note { display: none; }
.fa-unfold { font: inherit; font-size: .85rem; margin: .2rem 0 .8rem; padding: .35rem .8rem; border-radius: .4rem; cursor: pointer; }
</style>
`;
export const LAZY_CHUNK = 40;

export interface BlockSplit {
  /** The document with each listed block's body replaced by a placeholder. */
  shell: string;
  /** Each listed block's Markdown, in document order. */
  blocks: { label: string; markdown: string }[];
}

/**
 * Split the assembled Markdown at block anchors. A block runs from its
 * `<a id="<label>"></a>` line to the next anchor or heading; lines inside a
 * fenced code block are never read as either. Anchors that are not block
 * labels (sections, chapters) stay in the shell, with their headings.
 */
export function splitBlocks(markdown: string, labels: Set<string>): BlockSplit {
  const ANCHOR = /^<a id="([^"]+)"><\/a>\s*$/;
  const HEADING = /^#{1,6}\s/;
  const FENCE = /^\s*(```|~~~)/;
  const FRAME = /^<div class="fa-numbered[\s"][^>]*>\s*$/;
  const shell: string[] = [];
  const blocks: BlockSplit["blocks"] = [];
  let cur: { label: string; lines: string[] } | null = null;
  let inFence = false;
  const close = () => {
    if (cur) blocks.push({ label: cur.label, markdown: cur.lines.join("\n").trim() + "\n" });
    cur = null;
  };
  for (const line of markdown.split("\n")) {
    if (!inFence) {
      const m = line.match(ANCHOR);
      if (m) {
        close();
        // A figure, table or diagram opens its frame (render-markdown.ts,
        // `.fa-numbered`) before its anchor and closes it after its text. Left
        // in the shell, the opener had no closer there, so every later block
        // of the page sat inside that frame: its 66% caption width put the
        // block icons mid-page (smart-ra, 2026-11-02). The opener goes with
        // its block, so the shell and each block stay balanced.
        let opener: string[] = [];
        if (labels.has(m[1]!)) {
          let k = shell.length - 1;
          while (k >= 0 && shell[k]!.trim() === "") k--;
          if (k >= 0 && FRAME.test(shell[k]!)) opener = shell.splice(k);
        }
        shell.push(line);
        if (labels.has(m[1]!)) {
          shell.push("", `<div class="fa-blk" data-blk="${esc(m[1]!)}"></div>`, "");
          cur = { label: m[1]!, lines: opener.filter((l) => l.trim() !== "").concat("") };
        }
        continue;
      }
      if (HEADING.test(line)) {
        close();
        shell.push(line);
        continue;
      }
    }
    if (FENCE.test(line)) inFence = !inFence;
    if (cur) cur.lines.push(line);
    else shell.push(line);
  }
  close();
  return { shell: shell.join("\n"), blocks };
}

/** Every `id="…"` in a block's HTML, so a link to a term inside an unloaded block finds its chunk. */
const idsIn = (html: string) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);

/**
 * The loader a lazy page runs. Index: label and inner id -> chunk number.
 * `blocks` is the chunks' directory relative to the page: the page is under
 * the locale and its data is not (`document-site-route.ts`).
 */
function lazyLoader(index: { chunks: number; of: Record<string, number>; ids: Record<string, number> }, blocks: string): string {
  const json = JSON.stringify(index).replace(/</g, "\\u003c");
  const dir = JSON.stringify(`${blocks}/`).replace(/</g, "\\u003c");
  return `
<script type="application/json" id="fa-blocks">${json}</script>
<script>
(() => {
  const ix = JSON.parse(document.getElementById("fa-blocks").textContent);
  const pending = new Map();
  let failed = false;
  const fill = (data) => window.faKeepPlace(() => {
    for (const [label, html] of Object.entries(data)) {
      const ph = document.querySelector('.fa-blk[data-blk="' + CSS.escape(label) + '"]');
      if (!ph || ph.dataset.filled) continue;
      ph.innerHTML = html;
      ph.dataset.filled = "1";
      if (window.faMathObserve) window.faMathObserve(ph);
    }
  });
  // Fetch fails when the page is opened from disk: the whole document is one
  // page away, so go there rather than show empty blocks.
  const load = (n) => {
    if (!pending.has(n)) pending.set(n, fetch(${dir} + String(n).padStart(3, "0") + ".json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(fill)
      .catch(() => { if (!failed) { failed = true; location.replace("index.hydrated.html" + location.search + location.hash); } }));
    return pending.get(n);
  };
  // Blocks above the target fill in after it is reached (and figures and
  // math render), pushing it down the page. So jump (not the theme's smooth
  // scroll, which a growing page outruns) and hold the target where it
  // landed, each frame, until the reader scrolls, clicks or types, or the
  // page has kept still for a few seconds.
  let unpin = () => {};
  let pinned = null;
  const pin = (el) => {
    unpin();
    pinned = el;
    el.scrollIntoView({ behavior: "instant" });
    const top = el.getBoundingClientRect().top;
    let still = performance.now(), frame, lastY = scrollY;
    const hold = (now) => {
      const d = el.getBoundingClientRect().top - top, dy = scrollY - lastY;
      // A scroll that carried the target the other way is someone's own (a
      // scrollbar drag fires none of the events below, and page-layout lands
      // a link under the stuck bar): let it stand. Text growing above moves
      // the target down, and the browser's anchoring then scrolls down too.
      if (Math.abs(dy) > 2 && dy * d < 0) return unpin();
      if (Math.abs(d) > 1) { scrollBy({ top: d, behavior: "instant" }); still = now; }
      lastY = scrollY;
      if (now - still > 4000) unpin(); else frame = requestAnimationFrame(hold);
    };
    const stop = ["wheel", "touchstart", "pointerdown", "keydown"];
    const off = () => { pinned = null; cancelAnimationFrame(frame); for (const t of stop) removeEventListener(t, off, true); };
    unpin = off;
    for (const t of stop) addEventListener(t, off, { capture: true, passive: true });
    frame = requestAnimationFrame(hold);
  };
  // Whatever a later script adds above the pinned target (a comment count, a
  // bar), it is put back in the same frame, so it is never seen to move. The
  // hold above corrects a frame later; this is for additions we can wrap.
  const keep = (f) => {
    const t = pinned;
    const y = t ? t.getBoundingClientRect().top : 0;
    f();
    if (!t || y >= innerHeight) return;
    const d = t.getBoundingClientRect().top - y;
    if (Math.abs(d) > 0.5) scrollBy({ top: d, behavior: "instant" });
  };
  window.faKeepPlace = keep;
  const blks = [...document.querySelectorAll(".fa-blk")];
  const loadAll = (list) => Promise.all([...new Set(list.map((b) => ix.of[b.dataset.blk]))].map(load));
  // OPENED AT A LINK (#chap:, #prose:, a term), the page opens there and stays
  // still (owner, 2026-10-31: "when this loads, it scrolls"). The text before
  // the link loads in the background too, but stays folded under its chapter
  // heading, so nothing above the reader grows: one tap opens a chapter, and
  // the browser's find opens a block (\`hidden="until-found"\`). Below the
  // link an empty block keeps its room, so the link can reach the top of the
  // window before its text arrives. \`LAZY_OPEN\` drew all this at no height
  // from the first paint.
  const folded = new Set();
  const unfold = (list) => keep(() => { for (const ph of list) { ph.removeAttribute("hidden"); delete ph.dataset.fold; folded.delete(ph); } });
  let foldAt = null;
  if (document.documentElement.hasAttribute("data-fa-open")) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = location.hash.slice(1); }
    foldAt = document.getElementById(id) || (ix.ids[id] !== undefined ? blks.find((b) => ix.of[b.dataset.blk] === ix.ids[id]) : null) || null;
  }
  if (!foldAt) document.documentElement.removeAttribute("data-fa-open");
  else {
    const before = (a, b) => !!(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_PRECEDING);
    const heads = [...(blks[0].closest(".fa-doc, main") || document).querySelectorAll("h2")];
    const groups = new Map();
    for (const ph of blks) {
      if (!before(ph, foldAt)) { ph.dataset.below = ""; continue; }
      ph.dataset.fold = "";
      ph.setAttribute("hidden", "until-found");
      folded.add(ph);
      const h = heads.filter((x) => before(x, ph)).pop() || null;
      if (!groups.has(h)) groups.set(h, []);
      groups.get(h).push(ph);
    }
    for (const [h, list] of groups) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fa-unfold";
      b.textContent = "Show this chapter's text";
      b.addEventListener("click", () => { b.disabled = true; b.textContent = "Opening…"; loadAll(list).then(() => { unfold(list); b.remove(); }); });
      if (h) h.after(b); else list[0].before(b);
    }
    addEventListener("beforematch", (e) => { if (e.target.dataset && "fold" in e.target.dataset) unfold([e.target]); });
    // Land now, before the first paint: the styles are in (a script waits for
    // them), and nothing above the link will grow from here on.
    if (foldAt.id) pin(foldAt);
  }
  // A link to a block, or to a term inside one, loads its chunk and lands on it.
  // A link back into the folded text opens all of it first.
  const go = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = location.hash.slice(1); }
    if (!id) return;
    let n = ix.of[id] ?? ix.ids[id];
    const el = document.getElementById(id);
    const open = folded.size && (!el || [...folded].some((ph) => ph === el || ph.contains(el) || (el.compareDocumentPosition(ph) & Node.DOCUMENT_POSITION_FOLLOWING))) ? [...folded] : [];
    const land = () => {
      if (open.length) { for (const ph of open) { ph.removeAttribute("hidden"); delete ph.dataset.fold; folded.delete(ph); } for (const b of document.querySelectorAll(".fa-unfold")) b.remove(); }
      const t = document.getElementById(id);
      if (t) pin(t);
    };
    Promise.all([n === undefined ? null : load(n), loadAll(open)]).then(land);
  };
  addEventListener("hashchange", go);
  go();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); load(ix.of[e.target.dataset.blk]); }
  }, { rootMargin: "2000px 0px" });
  for (const ph of blks) if (!folded.has(ph)) io.observe(ph);
  // Then the rest, one chunk at a time while the browser is idle, so the whole
  // text is there for reading on and for the browser's own find.
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
  let next = 0;
  const more = () => { while (next < ix.chunks && pending.has(next)) next++; if (next < ix.chunks) load(next).then(() => idle(more)); };
  addEventListener("load", () => idle(more));
})();
</script>`;
}


// ── Math, glossary directives and citations (bean dsm1, owner 2026-10-05) ──
//
// A PAPER folio's blocks carry TeX: `$…$`, `$$…$$`, `:defterm[…]{#slug}` /
// `:refterm[…]{#slug}` and `\cite{key}`. Rendered as plain Markdown they reach
// a reader as raw source — and worse than raw, because Markdown reads `_` and
// `*` inside an equation as emphasis and corrupts it. So, when math is on:
//
// - `remark-math` claims the math BEFORE emphasis is parsed, and emits it as
//   `code.math-inline` / `pre > code.math-display`. KaTeX renders those in the
//   browser — the same KaTeX 0.16.11, from the same CDN, with the same
//   `\name -> tex` macro table, that the viewer already uses, built from the
//   paper manifest's `macros`.
// - Math is OPT-IN. A document folio writes "$5 million" in prose, and
//   `remark-math` would turn the text between two dollar signs into an
//   equation. It is on by default only for a `contentType: "paper"` layer;
//   `--math` / `--no-math` override.
//
// Directives and citations are handled whatever the content type, because
// they are unambiguous: a `:defterm` becomes a `dfn` with its slug as the id, a
// `:refterm` links to that id, and a directive of any OTHER name is put back
// as the text it was written as (prose like "note:x" must not vanish).
// `\cite{a,b}` becomes a muted `[a, b]` carrying the keys. Given
// `--bibliography-url` (the published bibliography page, e.g. the platform's
// `<base>/folio-assistant-core/bibliography/`), each key links to its entry
// there; without it the keys are not links, because a page has no way to know
// where the bibliography is published.

export interface MathOptions {
  /** `\name` -> TeX, as KaTeX's `macros` option takes it. */
  macros: Record<string, string>;
}

const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist";

function mathHead(math: MathOptions): string {
  const macros = JSON.stringify(math.macros).replace(/</g, "\\u003c");
  return `
<link rel="stylesheet" href="${KATEX}/katex.min.css">
<script defer src="${KATEX}/katex.min.js"></script>
<script>
addEventListener("DOMContentLoaded", () => {
  // Rendered as each equation nears the viewport, not all at once: a paper
  // page can hold ~80,000 equations, and rendering them up front measured 78 s
  // before the page was usable (qou, 2026-10-05).
  const macros = ${macros};
  const render = (el) => {
    const display = el.classList.contains("math-display");
    const out = document.createElement(display ? "div" : "span");
    try { katex.render(el.textContent, out, { throwOnError: false, displayMode: display, macros }); }
    catch { return; }
    const host = display && el.parentElement && el.parentElement.tagName === "PRE" ? el.parentElement : el;
    host.replaceWith(out);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); render(e.target); }
  }, { rootMargin: "1500px 0px" });
  // Blocks a lazy page loads later call this on what they add (bean v433).
  window.faMathObserve = (root) => { for (const el of root.querySelectorAll("code.math-inline, code.math-display")) io.observe(el); };
  window.faMathObserve(document);
});
</script>`;
}

/** The viewer's macro table (`buildKatexMacros` in cat-harness-tools/viewer/index.html), from a paper manifest. */
export function katexMacros(paperMacros: Record<string, { tex: string }> | undefined): Record<string, string> {
  const m: Record<string, string> = { "\\bigbowtie": "\\bowtie", "\\smallmatrix": "\\begin{smallmatrix}", "\\qed": "\\square" };
  for (const [name, def] of Object.entries(paperMacros ?? {})) m["\\" + name] = def.tex;
  return m;
}

/** `\cite{a,b}` -> a muted `[a, b]`, outside fenced code. */
export function citationsToHtml(markdown: string, opts: { bibliographyUrl?: string } = {}): string {
  // Per fenced/unfenced run rather than per line: a `\cite{a,\n b}` wrapped by
  // the author's line breaks is one citation (qou notation-collisions, found
  // by the rendered-content QA as visible raw TeX).
  const runs: { lines: string[]; fenced: boolean }[] = [];
  let run = { lines: [] as string[], fenced: false };
  for (const line of markdown.split("\n")) {
    const fence = /^\s*(```|~~~)/.test(line);
    if (fence && !run.fenced) {
      runs.push(run);
      run = { lines: [line], fenced: true };
    } else if (fence) {
      run.lines.push(line);
      runs.push(run);
      run = { lines: [], fenced: false };
    } else run.lines.push(line);
  }
  runs.push(run);
  return runs
    .filter((r) => r.lines.length > 0)
    .map((r) => (r.fenced ? r.lines.join("\n") : cite(r.lines.join("\n"))))
    .join("\n");

  function cite(text: string): string {
    // `\cite[p.~3]{k}`: the optional note is shown after the keys, `~` as a space.
    return text.replace(/\\cite[pt]?(?:\[([^\]]*)\])?\{([^}]+)\}/g, (_m, note: string | undefined, keys: string) => {
      const list = keys.split(",").map((k) => k.trim()).filter(Boolean);
      // With a bibliography to point at, each key links to its entry's own
      // page there (bean 63q4): `<url>/<key>/`, a slash address, no `#`.
      const base = opts.bibliographyUrl?.replace(/\/*$/, "/");
      const shown = base
        ? list.map((k) => `<a href="${esc(base)}${esc(referenceSegment(k))}/">${esc(k)}</a>`).join(", ")
        : esc(list.join(", "));
      const after = note?.trim() ? `, ${esc(note.trim().replace(/~/g, " "))}` : "";
      return `<span class="cite" data-keys="${esc(list.join(" "))}">[${shown}${after}]</span>`;
    });
  }
}

/** The slice of an mdast node this plugin reads; the directive fields come from `remark-directive`. */
interface MdNode {
  type: string;
  name?: string;
  value?: string;
  attributes?: Record<string, string | null | undefined>;
  children?: MdNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

/** `:defterm` / `:refterm` -> a definition and its link; any other directive back to its source text. */
function glossaryDirectives(source: string) {
  return () => (tree: MdNode) => {
    visit(tree as Parameters<typeof visit>[0], (raw, index, rawParent) => {
      const node = raw as unknown as MdNode;
      const parent = rawParent as unknown as MdNode | undefined;
      if (!["textDirective", "leafDirective", "containerDirective"].includes(node.type)) return;
      const label = (node.children ?? []).map((c) => c.value ?? "").join("");
      const slug = (node.attributes?.id ?? label).toString().trim().toLowerCase().replace(/\s+/g, "-");
      if (node.type === "textDirective" && node.name === "defterm") {
        node.data = { hName: "dfn", hProperties: { className: ["defterm"], id: `term-${slug}` } };
      } else if (node.type === "textDirective" && node.name === "refterm") {
        node.data = { hName: "a", hProperties: { className: ["refterm"], href: `#term-${slug}` } };
      } else if (parent?.children && typeof index === "number" && node.position) {
        const text = source.slice(node.position.start.offset, node.position.end.offset);
        parent.children.splice(index, 1, { type: "text", value: text });
      }
    });
  };
}

/**
 * A line that is ONLY `$$…$$` is display math as its author meant it, but
 * `remark-math` reads `$$x$$` on one line as inline. Split it onto three lines,
 * outside fenced code, so it renders as a display.
 */
export function displayMathLines(markdown: string): string {
  let fenced = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      const m = fenced ? null : /^(\s*)\$\$(.+)\$\$\s*$/.exec(line);
      return m && !m[2].includes("$$") ? `${m[1]}$$\n${m[1]}${m[2]}\n${m[1]}$$` : line;
    })
    .join("\n");
}


/**
 * Four ways valid TeX in a Markdown block is misread before KaTeX sees it,
 * each found by the rendered-content QA on qou (folio-site-qa.ts), and each
 * fixed here by rewriting to an equivalent KaTeX accepts. Outside fenced code.
 *
 * - `\text{$n$-body}` inside math: the inner `$` ends the outer equation.
 *   Rewritten to `\text{\(n\)-body}`, which KaTeX reads the same way.
 * - `|` inside math in a GFM table row: the table splits the cell on it.
 *   Rewritten to `\vert `.
 * - `$a$$b$` — two inline equations with nothing between them reads as `$$`.
 *   A space is put between them.
 * - `\ref{x}` / `\eqref{x}` in prose: a link to the label's anchor.
 * - `psmallmatrix` (mathtools), which KaTeX lacks: `\left(` `smallmatrix` `\right)`.
 */
export function texInMarkdown(markdown: string): string {
  let fenced = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      if (fenced) return line;
      let out = line.replace(/\\text\{([^{}]*)\}/g, (m, body: string) => {
        if (!body.includes("$")) return m;
        let open = true;
        return `\\text{${body.replace(/\$/g, () => ((open = !open) ? "\\)" : "\\("))}}`;
      });
      if (/^\s*\|/.test(out)) out = out.replace(/\$([^$\n]+)\$/g, (_m, tex: string) => `$${tex.replace(/(?<!\\)\|/g, "\\vert ")}$`);
      if (!/^\s*\$\$/.test(out)) out = out.replace(/([^$\s\\])\$\$([^$\s])/g, "$1$ $$$2");
      // mathtools' `psmallmatrix` is not a KaTeX environment; `smallmatrix` in parentheses is the same matrix.
      out = out.replace(/\\begin\{psmallmatrix\}/g, "\\left(\\begin{smallmatrix}").replace(/\\end\{psmallmatrix\}/g, "\\end{smallmatrix}\\right)");
      out = out.replace(/\\(?:eq)?ref\{([^}]+)\}/g, (_m, label: string) => `<a href="#${esc(label)}">${esc(label)}</a>`);
      return out;
    })
    .join("\n");
}

/** One document's Markdown to HTML. */
export async function renderDocumentHtml(markdown: string, opts: { math: boolean; bibliographyUrl?: string; termLinks?: readonly TermLink[] }): Promise<string> {
  const source = citationsToHtml(opts.math ? texInMarkdown(displayMathLines(markdown)) : markdown, { bibliographyUrl: opts.bibliographyUrl });
  const base = opts.math ? remark().use(remarkMath) : remark();
  const proc = base.use(remarkGfm).use(remarkDirective).use(glossaryDirectives(source)).use(linkTerms(opts.termLinks ?? [])).use(remarkHtml, { sanitize: false });
  return String(await proc.process(source));
}

/** Every document in the folio: `folio/<slug>/<slug>.ts`, as the adapter resolves them. */
export function documentManifests(repoRoot: string): { slug: string; path: string }[] {
  const root = folioDir(repoRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ slug: d.name, path: join(root, d.name, `${d.name}.ts`) }))
    .filter((d) => existsSync(d.path))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export const OUTLINE_SCHEMA = "folio-outline/v1" as const;

export interface OutlineSection {
  /** The ChangeSet's section key: `<chapter dir>::<label ?? title>`. */
  key: string;
  title: string;
  label?: string;
  /** Block labels in manifest order. */
  blocks: string[];
}
export interface OutlineDocument {
  slug: string;
  title: string;
  /** The document's page, relative to the site root: `en/<slug>/index.html` (`document-site-route.ts`). */
  page: string;
  chapters: Array<{ title: string; label?: string; sections: OutlineSection[] }>;
  /**
   * Present when the page is lazy (bean v433): `page` is then a shell, the
   * text is in `<slug>/blocks/NNN.json` and the whole document in `hydrated`. `of`
   * maps each block to its chunk, so a change can name the file it alters
   * (rendered impact, bean `bnjs`).
   */
  lazy?: { hydrated: string; chunks: number; of: Record<string, number> };
}
export interface Outline {
  $schema: typeof OUTLINE_SCHEMA;
  documents: OutlineDocument[];
}

const isRef = (s: Section | SectionRef): s is SectionRef => !("blocks" in s);

/** One document's outline. Loads the manifests the Markdown build already loads. */
export async function documentOutline(manifestPath: string, folioRoot: string, slug: string): Promise<OutlineDocument> {
  const docDir = dirname(manifestPath);
  const paper = (await import(manifestPath)).default as Paper;
  const doc: OutlineDocument = { slug, title: paper.title ?? slug, page: documentPage(slug), chapters: [] };
  for (const chRef of paper.chapters) {
    const chDir = join(docDir, chRef.dir);
    const chPath = join(chDir, `${chRef.dir}.ts`);
    if (!existsSync(chPath)) continue;
    const chapter = (await import(chPath)).default as Chapter;
    const rel = relative(folioRoot, chDir) || ".";
    const sections: OutlineSection[] = [];
    const walk = async (secs: Array<Section | SectionRef>) => {
      for (const sec of secs) {
        if (isRef(sec)) continue;
        const labels: string[] = [];
        for (const root of sec.blocks) {
          const ts = join(chDir, `${root}.ts`);
          if (!existsSync(ts)) continue;
          const b = (await import(ts)).default as { label?: string };
          if (b.label) labels.push(b.label);
        }
        sections.push({ key: `${rel}::${sec.label ?? sec.title}`, title: sec.title, ...(sec.label ? { label: sec.label } : {}), blocks: labels });
        if (sec.subsections) await walk(sec.subsections);
      }
    };
    await walk(chapter.sections);
    doc.chapters.push({ title: chapter.title, ...(chapter.label ? { label: chapter.label } : {}), sections });
  }
  return doc;
}

/**
 * Every labelled block of one document, with its source file and section, in
 * manifest order: what [edit] and [feedback] are built from (`block-actions`).
 * The source is the block's `.md` when it has one (the prose a person edits),
 * else its `.ts` manifest.
 */
export async function documentBlocks(manifestPath: string, repoRoot: string, slug: string): Promise<BlockContext[]> {
  const docDir = dirname(manifestPath);
  const paper = (await import(manifestPath)).default as Paper;
  const out: BlockContext[] = [];
  for (const chRef of paper.chapters) {
    const chDir = join(docDir, chRef.dir);
    const chPath = join(chDir, `${chRef.dir}.ts`);
    if (!existsSync(chPath)) continue;
    const chapter = (await import(chPath)).default as Chapter;
    const walk = async (secs: Array<Section | SectionRef>) => {
      for (const sec of secs) {
        if (isRef(sec)) continue;
        for (const root of sec.blocks) {
          const ts = join(chDir, `${root}.ts`);
          if (!existsSync(ts)) continue;
          const b = (await import(ts)).default as { label?: string };
          if (!b.label) continue;
          const md = join(chDir, `${root}.md`);
          out.push({ label: b.label, source: relative(repoRoot, existsSync(md) ? md : ts), section: sec.title, page: documentPage(slug) });
        }
        if (sec.subsections) await walk(sec.subsections);
      }
    };
    await walk(chapter.sections);
  }
  return out;
}

/**
 * Where [edit] and [feedback] point, from the build's environment: the
 * repository is `GITHUB_REPOSITORY` in CI, else the checkout's `origin`; the
 * issue form is the folio's `.github/ISSUE_TEMPLATE/block-feedback.yml` when
 * it has one. Explicit options win.
 */
export function defaultBlockActions(repoRoot: string, over: Partial<BlockActionsConfig> = {}): BlockActionsConfig {
  const origin = detectRepoUrl(repoRoot);
  const repo = over.repo ?? process.env.GITHUB_REPOSITORY ?? (origin?.includes("github.com") ? ownerRepo(origin) : undefined);
  const template = over.template ?? DEFAULT_TEMPLATE;
  const fields = readIssueForm(repoRoot, template);
  return {
    ...(repo ? { repo } : {}),
    branch: over.branch ?? "main",
    ...(fields ? { template, templateFields: fields } : {}),
    ...(over.labels ? { labels: over.labels } : {}),
    ...(over.siteUrl ? { siteUrl: over.siteUrl } : {}),
    ...(over.content ? { content: over.content } : {}),
    ...(over.values ? { values: over.values } : {}),
    ...(over.graph ? { graph: over.graph } : {}),
    ...(over.suggest ? { suggest: over.suggest } : {}),
  };
}

/**
 * The document's downloads, as one line: the current Word (.docx) and PDF, by
 * the export's STABLE names (`latestNames`), so the link is always the newest
 * export and never names a commit; and the Export page, which lists every file
 * with its commit, size and checksum. `from` is the directory of the page the
 * line goes on, so the links are relative and the site works under any base.
 *
 * The files are written by `document-export.ts release`, a later site step,
 * into {@link documentExportDir}; the page only links them. A folio turns the
 * line on (`--downloads`) when its site build runs that step.
 */
export function downloadLinks(slug: string, from: string): string {
  const dir = fromPageDir(from, documentExportDir(slug));
  const latest = latestNames(slug);
  const at = (f: string) => esc(`${dir}/${f}`);
  return (
    `<p class="fa-downloads">Download the current version: ` +
    `<a href="${at(latest.reviewDocx)}" download type="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word (.docx)</a> · ` +
    `<a href="${at(latest.pdf)}" download type="application/pdf">PDF</a> · ` +
    `<a href="${esc(dir)}/">all formats</a></p>\n`
  );
}

/** `line` just after the page's first `</h1>`, the document's title; at the top when it has none. */
export function afterTitle(html: string, line: string): string {
  const i = html.indexOf("</h1>");
  return i < 0 ? line + html : html.slice(0, i + 5) + "\n" + line + html.slice(i + 5);
}

/** The current Word and PDF of a document, relative to the site root. */
export function downloadTargets(slug: string): { docx: string; pdf: string } {
  const latest = latestNames(slug);
  return { docx: `${documentExportDir(slug)}/${latest.reviewDocx}`, pdf: `${documentExportDir(slug)}/${latest.pdf}` };
}

export interface SiteBuildResult {
  /** `title`: the manifest's title, with its `meta.status` (e.g. "Working Draft") when it declares one. */
  /** `assets`: the structured-assets page, relative to the site root, when the document has any structured block. */
  /** `downloads`: the current Word and PDF, relative to the site root, when built with `downloads` ({@link downloadLinks}). */
  documents: { slug: string; title: string; blocks: number; page: string; assets?: string; downloads?: { docx: string; pdf: string } }[];
  errors: string[];
}

export async function buildDocumentSite(
  repoRoot: string,
  outDir: string,
  opts: {
    math?: boolean;
    actions?: Partial<BlockActionsConfig> | false;
    lazy?: "auto" | "always" | "never";
    /** Write the landing as a Jekyll page in this layout ({@link landingPage}). */
    landingLayout?: string;
    /**
     * Write each document's page as a Jekyll page in this layout
     * ({@link themedDocumentPage}). The one-page `index.hydrated.html` of a
     * lazy document stays standalone.
     */
    documentLayout?: string;
    /** The published bibliography sub-graph page whose entries each `\cite` key links (`<url>/<key>/`). Absent: citations are not links. */
    bibliographyUrl?: string;
    /** Link each Capitalized glossary term in prose to its glossary entry (`glossary-term-links.ts`). */
    linkTerms?: boolean;
    /** Put the Word and PDF download links ({@link downloadLinks}) under each document's title, on its structured-assets page and on the landing. */
    downloads?: boolean;
  } = {},
): Promise<SiteBuildResult> {
  // Math defaults on only for a paper layer; see the note on renderDocumentHtml.
  const math = opts.math ?? readHarnessConfig(repoRoot)?.contentType === "paper";
  const docs = documentManifests(repoRoot);
  const result: SiteBuildResult = { documents: [], errors: [] };
  const lazyOf = new Map<string, NonNullable<OutlineDocument["lazy"]>>();
  if (docs.length === 0) {
    result.errors.push(`no document manifest under ${folioDir(repoRoot)} (expected folio/<slug>/<slug>.ts)`);
    return result;
  }
  if (opts.landingLayout) layoutName(opts.landingLayout, "landing");
  const themed = opts.documentLayout === undefined ? undefined : layoutName(opts.documentLayout, "document");
  mkdirSync(outDir, { recursive: true });
  const contributions = await loadContributions<FolioContribution, ContributionRegistry>(repoRoot, new ContributionRegistry());
  // The ✍ suggest editor's checks and Crepe settings for this content type
  // (editor-checker nodes, bean 4dx7), bundled once for every document.
  const contentType = readHarnessConfig(repoRoot)?.contentType;
  const suggestProfiles = contentType ? await bundleEditorProfiles(repoRoot, contentType, join(outDir, ...SUGGEST_DIR.split("/")), "") : [];
  for (const d of docs) {
    const built = await buildDocumentMarkdown(d.path);
    for (const i of built.issues) if (i.level === "error") result.errors.push(`${d.slug}: ${i.message}`);
    const manifest = (await import(d.path)).default as Paper;
    // A document with a status ("Working Draft") carries it in its title
    // everywhere: the heading, the page title and the landing list.
    const status = typeof manifest.meta?.status === "string" ? manifest.meta.status : undefined;
    const title = withStatus(manifest.title ?? d.slug, status);
    if (status && manifest.title) built.markdown = built.markdown.replace(`# ${manifest.title}\n`, `# ${title}\n`);
    const termLinks = opts.linkTerms ? await glossaryTermLinks(repoRoot, documentPageDir(d.slug)) : undefined;
    // A figure that is a view of the layer's ArchiMate model is drawn from
    // the model, linked to the view's page (live-figures.ts); the PNG stays the fallback.
    const live = liveFigures(repoRoot, documentPageDir(d.slug));
    // The structured-assets page (structured-assets.ts): every requirement,
    // persona, scenario and data element in one table per kind; each card's
    // kind label links to its table (owner, card Q-SAV-1 = A, 2026-11-02).
    const assets = await structuredAssets(d.path);
    const assetKinds = new Set(assets.map((a) => a.kind));
    // Data element cards fold their table and link their glossary entry (Q-DE-1 A).
    const entryLinks = assetKinds.has("data-element") ? (termLinks ?? (await glossaryTermLinks(repoRoot, documentPageDir(d.slug)))) : [];
    // External glossaries the layer cites, noted above the document's own
    // glossary (owner, 2026-11-02; external-glossaries.ts).
    const extGlossaries = externalGlossaries(repoRoot);
    const firstEntry = extGlossaries.length ? await firstGlossaryLabel(d.path) : undefined;
    const render = async (md: string) => {
      const h = withExternalGlossaries(
        withLiveFigures(await renderDocumentHtml(md, { math, bibliographyUrl: opts.bibliographyUrl, termLinks }), live),
        firstEntry,
        extGlossaries,
      );
      return assetKinds.size ? lightenDataElements(linkKindLabels(h, assetKinds), entryLinks) : h;
    };
    const pageDirOf = documentPageDir(d.slug);
    const downloads = opts.downloads ? downloadLinks(d.slug, pageDirOf) : "";
    const html = afterTitle(await render(built.markdown), downloads);
    // The page under the locale, its data where it was (document-site-route.ts).
    const dir = join(outDir, ...documentPageDir(d.slug).split("/"));
    const data = join(outDir, ...documentDataDir(d.slug).split("/"));
    mkdirSync(dir, { recursive: true });
    const mathOpts = math ? { macros: katexMacros(manifest.macros) } : undefined;
    const blocks = await documentBlocks(d.path, repoRoot, d.slug);
    // `values`: where the ✍ suggest editor reads each variable's current value,
    // `graph` the labels and keys its checks warn against, `suggest` its profiles;
    // all relative to this page.
    const pageDir = documentPageDir(d.slug);
    const suggest = suggestProfiles.length
      ? { katexMacros: mathOpts?.macros ?? {}, profiles: suggestProfiles.map((p) => ({ ...p, module: fromPageDir(pageDir, `${SUGGEST_DIR}/${p.module}`) })) }
      : undefined;
    const cfg = opts.actions === false ? undefined : defaultBlockActions(repoRoot, {
      content: d.slug,
      values: fromPageDir(pageDir, VALUES_FILE),
      graph: fromPageDir(pageDir, `${documentDataDir(d.slug)}/graph.jsonld`),
      ...(suggest ? { suggest } : {}),
      ...(opts.actions ?? {}),
    });
    // [edit] and [feedback] on every block (REQ-17, bean uphx). Off only when asked.
    // The compact form brings the runtime with it. The full form (a small,
    // one-page document) gets it too: the runtime is what adds ✍ suggest beside
    // every ✎ edit, and a document is not less editable for being short.
    const withActions = (h: string, compact = false) => {
      if (!cfg) return h;
      const r = injectBlockActions(h, blocks, cfg, { compact });
      return compact || r.inserted === 0 ? r.html : r.html.replace("</body>", `${compactActionsScript(cfg, documentPage(d.slug))}</body>`);
    };
    const lazy = opts.lazy === "always" || ((opts.lazy ?? "auto") === "auto" && blocks.length >= LAZY_THRESHOLD);
    // Themed, the theme's sidebar is the page's index, built from heading ids;
    // the rail's declared contents (pageContents) would be a second one.
    if (!lazy) {
      if (themed) writeFileSync(join(dir, "index.html"), themedDocumentPage(themed, title, withActions(page(title, headingIds(html), mathOpts))));
      else writeFileSync(join(dir, "index.html"), withActions(page(title, pageContents(html) + html, mathOpts)));
    } else {
      // The whole document on one page, for file://, no-JS readers and tools.
      writeFileSync(join(dir, "index.hydrated.html"), withActions(page(title, pageContents(html) + html, mathOpts)));
      const split = splitBlocks(built.markdown, new Set(blocks.map((b) => b.label)));
      const index = { chunks: 0, of: {} as Record<string, number>, ids: {} as Record<string, number> };
      mkdirSync(join(data, "blocks"), { recursive: true });
      for (let i = 0; i < split.blocks.length; i += LAZY_CHUNK) {
        const n = index.chunks++;
        const chunk: Record<string, string> = {};
        for (const b of split.blocks.slice(i, i + LAZY_CHUNK)) {
          const h = await render(b.markdown);
          chunk[b.label] = h;
          index.of[b.label] = n;
          for (const id of idsIn(h)) index.ids[id] ??= n;
        }
        writeFileSync(join(data, "blocks", `${String(n).padStart(3, "0")}.json`), JSON.stringify(chunk));
      }
      lazyOf.set(d.slug, { hydrated: hydratedPage(d.slug), chunks: index.chunks, of: index.of });
      const shellHtml = afterTitle(await render(split.shell), downloads);
      const note = LAZY_OPEN + `<p class="fa-one-page">The text loads as you read. <a href="index.hydrated.html">The whole document on one page.</a></p>\n<noscript><p><a href="index.hydrated.html">Read the whole document on one page.</a></p></noscript>\n`;
      const loader = lazyLoader(index, fromPageDir(documentPageDir(d.slug), `${documentDataDir(d.slug)}/blocks`));
      if (themed) writeFileSync(join(dir, "index.html"), themedDocumentPage(themed, title, withActions(page(title, note + headingIds(shellHtml), mathOpts, loader), true)));
      else writeFileSync(join(dir, "index.html"), withActions(page(title, pageContents(shellHtml) + note + shellHtml, mathOpts, loader), true));
    }
    if (assets.length) {
      const assetsDir = join(dir, ASSETS_DIR);
      mkdirSync(assetsDir, { recursive: true });
      const body = afterTitle(structuredAssetsBody(title, assets), opts.downloads ? downloadLinks(d.slug, `${pageDirOf}/${ASSETS_DIR}`) : "");
      const assetsTitle = `${title}: structured assets`;
      writeFileSync(join(assetsDir, "index.html"), themed ? themedDocumentPage(themed, assetsTitle, page(assetsTitle, body)) : page(assetsTitle, body));
    }
    // A document's images live in `folio/<slug>/media/` and its blocks link
    // them as `media/<file>`, relative to the document's page, so they go
    // beside the page. Copied, so a figure in the preview is the figure in the folio.
    const graph = await documentGraph(dirname(d.path), d.slug, contributions);
    for (const e of graph.errors.slice(0, GRAPH_ERRORS_LISTED)) result.errors.push(`${d.slug}: ${e}`);
    if (graph.errors.length > GRAPH_ERRORS_LISTED) result.errors.push(`${d.slug}: … and ${graph.errors.length - GRAPH_ERRORS_LISTED} more KG node errors`);
    for (const n of graph.nodes) {
      mkdirSync(dirname(join(data, "kg", n.rel)), { recursive: true });
      writeFileSync(join(data, "kg", n.rel), n.text);
    }
    mkdirSync(data, { recursive: true });
    writeFileSync(join(data, "graph.jsonld"), JSON.stringify({ "@graph": graph.nodes.map((n) => JSON.parse(n.text) as unknown) }) + "\n");
    const media = join(dirname(d.path), "media");
    if (existsSync(media)) cpSync(media, join(dir, "media"), { recursive: true });
    result.documents.push({
      slug: d.slug,
      title,
      blocks: built.blockCount,
      page: documentPage(d.slug),
      ...(assets.length ? { assets: `${documentPageDir(d.slug)}/${ASSETS_DIR}/index.html` } : {}),
      ...(opts.downloads ? { downloads: downloadTargets(d.slug) } : {}),
    });
  }
  const list = result.documents
    // A reader looks for the document by its title, not its folder name (owner, 2026-11-01).
    .map(
      (d) =>
        `<li><a href="${esc(d.page)}">${esc(d.title)}</a>${d.assets ? ` · <a href="${esc(d.assets)}">structured assets</a>` : ""}` +
        (d.downloads ? ` · download <a href="${esc(d.downloads.docx)}" download>Word (.docx)</a> or <a href="${esc(d.downloads.pdf)}" download>PDF</a>` : "") +
        `</li>`,
    )
    .join("\n");
  const outline: Outline = { $schema: OUTLINE_SCHEMA, documents: [] };
  for (const d of docs) {
    const o = await documentOutline(d.path, folioDir(repoRoot), d.slug);
    const lz = lazyOf.get(d.slug);
    outline.documents.push(lz ? { ...o, lazy: lz } : o);
  }
  writeFileSync(join(outDir, "outline.json"), JSON.stringify(outline) + "\n");
  // The values the text refers to, as KG nodes, beside the outline: what the
  // ✍ suggest editor shows a variable's current value from (gen-values-jsonld).
  writeValuesJsonLd(repoRoot, outDir);
  const review = join(outDir, ...REVIEW_PAGE_DIR.split("/"));
  mkdirSync(review, { recursive: true });
  writeFileSync(join(review, "index.html"), reviewPageHtml());
  // The documents are listed above, by title; a second "The document" link to the same page only confuses.
  const pages = new Set(result.documents.map((d) => dirname(d.page) + "/"));
  const also = landingLinks(readDeclaration(repoRoot), (p) => existsSync(join(repoRoot, p))).filter((l) => !pages.has(l.href.replace(/\/?$/, "/")));
  const landing =
    `<h1>Documents</h1>\n<p><a href="${esc(REVIEW_PAGE_DIR)}/index.html">What changed from main</a></p>\n<ul>\n${list}\n</ul>` +
    (also.length ? `\n<h2>Also on this site</h2>\n<ul>\n${also.map((l) => `<li><a href="${esc(l.href)}">${esc(l.title)}</a></li>`).join("\n")}\n</ul>` : "");
  if (opts.landingLayout) writeFileSync(join(outDir, "index.md"), landingPage(opts.landingLayout, "Documents", landing));
  else writeFileSync(join(outDir, "index.html"), page("Documents", landing));
  return result;
}

/**
 * The landing as a JEKYLL page, for a folio site whose source Jekyll builds
 * (`build-instance-site.ts`): front matter naming `layout`, so the page wears
 * the site's full chrome — top bar, search, sidebar with its Folders — rather
 * than standing alone with the injected rail (owner, 2026-10-14: "what
 * happened to rest of chrome? isnt there a default layout?").
 *
 * Use it or a `--home` page, not both: each is the site's `index.md`. The
 * body is held `raw`: it is generated HTML, and a `{{` in a document title is
 * text, not Liquid.
 */
export function landingPage(layout: string, title: string, body: string): string {
  layoutName(layout, "landing");
  return [`---`, `layout: ${layout}`, `title: ${JSON.stringify(title)}`, `nav_order: 1`, `---`, ``, ...wrapRaw(body), ``].join("\n");
}

/**
 * The other pages this folio's site publishes, for its landing page: every
 * visualisation the layer DECLARES (`coverage.visualiser`) whose page
 * resolves — on disk, or built at publish by a declared `writer` whose scripts
 * exist (`visualisationResolves`, the one rule tiles and coverage also use).
 *
 * Until this, a folio's landing listed its documents and nothing else, so a
 * graph the build also renders — smart-ra's ArchiMate models at `/archimate/`
 * (2026-10-09, owner: "how is archimate visualizer integrated into smart-ra
 * landing page") — was reachable only by typing its address. The navbar's
 * tiles do not help a folio: on a foreign site they come from the PLATFORM's
 * `harness.json`, where a folio's layer is not listed.
 *
 * A `ref` is repository-relative, and a folio's site is built from its root,
 * so the ref IS the site path; `index.html` becomes its directory, the form
 * every other link here uses. A staging-only page is left off, since this
 * landing is also main's; so is any ref that is absolute or climbs out.
 */
export function landingLinks(decl: CatHarnessDeclaration | undefined, exists: (repoRelative: string) => boolean): { title: string; href: string }[] {
  const out: { title: string; href: string }[] = [];
  for (const d of decl?.directories ?? []) {
    for (const v of visualisationsOf(d.coverage, d.id)) {
      if (v.publish !== undefined || v.ref.startsWith("/") || v.ref.split("/").includes("..")) continue;
      if (!visualisationResolves(v, exists)) continue;
      out.push({ title: v.title, href: v.ref.replace(/(^|\/)index\.(html|md)$/, "$1").replace(/\.md$/, ".html") || "./" });
    }
  }
  return out;
}

/**
 * What this builder READS (bean `ehh6`): the folio directory, repo-relative.
 * Its config and declaration sit at the repository root, which the document
 * predictor already counts as read. `args` are the ones the build command passes.
 */
export function siteReads(repoRoot: string, args: string[] = []): string[] {
  const i = args.indexOf("--repo");
  const repo = i >= 0 && args[i + 1] ? resolve(repoRoot, args[i + 1]!) : repoRoot;
  return [relative(repoRoot, folioDir(repo)).split("\\").join("/")];
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (args.includes("--help")) {
    console.log(
      "usage: bun run folio-assistant-core/scripts/build-document-site.ts [--repo <folio repo root>] [--out _site] [--math | --no-math]\n" +
        "         [--github <owner/repo>] [--edit-branch main] [--issue-template block-feedback.yml] [--site-url <url>] [--no-block-actions]\n" +
        "         [--lazy auto|always|never]   (auto: a document of " + LAZY_THRESHOLD + "+ blocks loads its text as data)\n" +
        "         [--landing-layout <name>]   (write the landing as a Jekyll page in that layout, e.g. default)\n" +
        "         [--document-layout <name>]  (write each document's page as a Jekyll page in that layout, e.g. default)\n" +
        "         [--bibliography-url <url>]  (link each \\cite key to its entry on this published bibliography page)\n" +
        "         [--link-terms]              (link each Capitalized glossary term in prose to its glossary entry)\n" +
        "         [--downloads]               (link the current Word and PDF, written by document-export.ts release into <out>/en/<slug>/export, under each title)",
    );
    process.exit(0);
  }
  const repo = resolve(opt("repo") ?? process.cwd());
  const out = resolve(repo, opt("out") ?? "_site");
  const math = args.includes("--math") ? true : args.includes("--no-math") ? false : undefined;
  const actions = args.includes("--no-block-actions")
    ? false
    : {
        ...(opt("github") ? { repo: opt("github") } : {}),
        ...(opt("edit-branch") ? { branch: opt("edit-branch") } : {}),
        ...(opt("issue-template") ? { template: opt("issue-template") } : {}),
        ...(opt("site-url") ? { siteUrl: opt("site-url") } : {}),
      };
  const lazyOpt = opt("lazy");
  if (lazyOpt && !["auto", "always", "never"].includes(lazyOpt)) {
    console.error(`✗ --lazy must be auto, always or never, not ${lazyOpt}`);
    process.exit(2);
  }
  const landingLayout = opt("landing-layout");
  const documentLayout = opt("document-layout");
  const bibliographyUrl = opt("bibliography-url");
  const r = await buildDocumentSite(repo, out, {
    math,
    actions,
    ...(lazyOpt ? { lazy: lazyOpt as "auto" | "always" | "never" } : {}),
    ...(landingLayout ? { landingLayout } : {}),
    ...(documentLayout ? { documentLayout } : {}),
    ...(bibliographyUrl ? { bibliographyUrl } : {}),
    ...(args.includes("--link-terms") ? { linkTerms: true } : {}),
    ...(args.includes("--downloads") ? { downloads: true } : {}),
  });
  for (const d of r.documents) console.error(`  ${d.page}  ${d.blocks} block(s)`);
  if (r.errors.length > 0) {
    for (const e of r.errors) console.error(`✗ ${e}`);
    process.exit(1);
  }
  console.error(`✓ ${r.documents.length} document(s) → ${relative(repo, out) || "."}`);
}

/** A document's title with its status, "Title - Working Draft", or the title alone. */
export function withStatus(title: string, status?: string): string {
  return status ? `${title} - ${status}` : title;
}
