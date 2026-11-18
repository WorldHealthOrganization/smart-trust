#!/usr/bin/env bun
/**
 * Publish the library as a projection, and a viewer over it.
 *
 * @module scripts/gen-library-viz
 * @graphNode none — a generator over the library graph, not a schema itself
 * @covers none — writer — regenerates the visualisation; judges nothing
 *
 * The same three pieces as `gen-schema-viz.ts`: a reader
 * (`library-graph.ts`), a projection under `<site>/assets/<graph>/`, and a
 * zero-dependency viewer under `<site>/<graph>/` that fetches the projection
 * relative to its own location. The published segment is the DECLARED
 * directory's own name, so a rename moves the source and the URL together.
 *
 * ## Two views of ONE projection
 *
 * - **Listing** — every column sortable, every metadatum visible ("which is
 *   the biggest", "which has no OCR", "which came from which upload").
 * - **Desktop** — the corpus as tiles, the folio board metaphor ("what is in
 *   here").
 *
 * ## Read-only
 *
 * Nothing here edits a section, a structure or an OCR page; materialising
 * into a folio and uploading are writes and live elsewhere.
 *
 * ## Three ingestion states
 *
 * **0 OCR pages because the source was never scanned is not a failure**, and
 * an `ocr/` directory that exists and is empty is a third answer. The viewer
 * renders `scanned`, `not scanned` and `empty` distinctly, none styled as an
 * error.
 *
 * Usage:
 *   bun run cat library:viz          # write
 *   bun run cat library:viz:check    # fail if either artefact is stale
 */
import { inScope as siteInScope, scopeArg, siteScope } from "./lib/site-scope.ts";
import { overlayPath } from "./lib/layer-output.ts";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { readLibraryGraph, referencedCatalogueEntries, type LibraryGraph, type LibraryBlock, type LibraryEntry,
  readEntryBlocks, instanceOf,
} from "./library-graph.ts";
import { tally } from "./summaries.ts";
import { WITHHELD_VIEW_JS } from "./lib/library-withheld-view.ts";
import { DOCUMENT_VIEW_JS, entryFigureCopies, readEntryDocument, type EntryKeywordLists } from "./lib/library-document.ts";
import { LANGUAGE_TOGGLE_JS, entryLanguages, listingTitles, summaryHtml, versionsHtml } from "./lib/library-languages.ts";
import { upstreamPdfOf } from "./lib/library-upstream-pdf.ts";
import { KEYWORD_VARIANTS, keywordsGraphs } from "./library-keywords.ts";
import { repoOf } from "../src/core/edit-links.ts";
import { detectRepoUrl } from "../src/core/git-refs.ts";
import { VIEWER_PATH, embed as pdfEmbed } from "./pdf-viewer.ts";
import { blobUrl, elsewhereLinks, entryRepoLinks, forgeAt, sourceFileOf, viewableOf, type RepoLink, type ViewSource } from "./lib/library-source.ts";
import { ADDRESS_JS } from "./lib/library-address.ts";
import { LIBRARY_JSONLD_SITE_DIR, libraryAssetIri, libraryAssetSitePath, libraryStubSitePath } from "../schemas/library/library-iri.ts";
import { termCurie, termIri } from "../schemas/kg/namespaces.ts";
import { entryGraphFiles, entryGraphSitePath, type EntryGraphFile } from "./lib/library-entry-graphs.ts";
import { subgraphOutDir } from "./gen-subgraph-jsonld.ts";
import { SUBGRAPH_INDEX_FILE } from "../schemas/kg/subgraph-manifest.ts";
import { scanLibraryRefs, type RefSource } from "./library-refs.ts";
import { orphanSubjectPages, viewerPlacement } from "./gen-schema-viz.ts";
import { readDeclaration } from "../schemas/kg/cat-harness.ts";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.ts";
import { checkoutRootFor, findInstanceRoot, layerRootsIn, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { directoryByVisualisationRef } from "./graph-tiles.ts";
import { tileCounts } from "../schemas/ui/tile-count.js";
import { itemState } from "./gen-uploads-viz.ts";
import { makeEmit } from "./viewer-page.ts";
import { readPathAt, writePathAt } from "./lib/layer-output.ts";
import { themedPage } from "./lib/themed-page.ts";
import { escHtml, nodeStubPageHtml, themedNodeDeclaration, type PageNode } from "./thin-page.ts";
import { declaredPageRoute, declaredRoute, withRenderedByFrontMatter, tileDirectories } from "./viewer-declarations.js";
import { checkoutDirectoriesForGraph, corpusDirectoriesForGraph, declarationChain } from "../schemas/kg/harness-config.js";
import { gateOwnsFile } from "./lib/gate-own.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteTarget } from "./lib/site-target.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "library-viewer";

const ROOT = join(HARNESS_ROOT);
const REPO_ROOT = repoRootFor(ROOT);
const CHECKOUT = checkoutRootFor(ROOT);
/**
 * In a layer's PR checks, `--check` judges only the output the caller commits
 * (owner ruling 2026-11-05, "Move the checks", generator checks included; `lib/gate-own.ts`). The
 * viewer is written into the harness's docs site, so a layer above is not
 * judged on it; the index's own gates, unscoped, still are.
 */
const mineToCheck = (abs: string): boolean => gateOwnsFile(relative(REPO_ROOT, abs)) !== false;
const check = process.argv.includes("--check");
/**
 * This harness's own repository. NOT where an entry's links point: an entry
 * is held by its own layer, in that layer's repository, which
 * `forgeAt` reads from the mount lock (`lib/library-source.ts`). This is the
 * fallback for a path no mount covers when the checkout's origin is unknown.
 */
const LINK_REPO = (() => {
  const d = readDeclaration(ROOT) as { livesAt?: { repository?: string }; repository?: string } | undefined;
  return d?.livesAt?.repository ?? d?.repository;
})();

/** The projection. Everything the reader found; it is already small. Exported for the fixture test of {@link entryBlocks}. */
export function projection(
  g: LibraryGraph,
  /** Per-page counts, `directory id -> [count, unit]`. Empty is normal. */
  scoped: Readonly<Record<string, readonly [number, string]>>,
): unknown {
  return {
    $schema: "folio-library-index/v1",
    // TWO tiles, ONE dataset — the case `schemas/ui/tile-count.ts` is keyed by
    // directory for. `flh4` put the queue block here rather than under a
    // second projection, "since two projections over it would be two answers
    // to how many are queued", and `gen-uploads-viz.ts` publishes a viewer
    // with no projection of its own. So this file owes both numbers.
    //
    // They are DIFFERENT questions, not one number shown twice:
    //   `library` — how much corpus there is, which is `entries`
    //   `uploads` — how much is WAITING, which is not an array length at all.
    //     A total would read as reassurance; the queue exists because the
    //     corpus grep searches `library/` only, so a file still waiting here
    //     makes a clean grep read as "nobody has done this" (#836).
    //
    // `itemState` rather than a second `ingestedBy` test: one definition of
    // waiting, and it is the viewer's own.
    //
    // `uploads` is keyed directly because its page is UNSCOPED — the queue
    // view shows every waiting unit — so a total is the count of the page that
    // tile opens. Everything else comes through `scoped`, computed per page.
    //
    // THE LIBRARY ENTRY USED TO BE KEYED HERE TOO, AS `g.entries.length`, AND
    // IT WAS WRONG. The `library` directory declares its visualiser as
    // `.../library/cat-harness/index.html` — the cat-harness-SCOPED page — and
    // cat-harness holds no entries at all (its own declaration says "THIS
    // INSTANCE HOLDS NONE"; bean `frs5` moved all four out). So the badge read
    // 8 over a page showing 0: not merely imprecise, but the single most
    // misleading number that tile could carry, and precisely the
    // empty-viewer case bean `v18c` observed and this whole feature exists to
    // surface. Shipped that way in #862 and corrected in #863.
    ...tileCounts({
      uploads: [g.uploads.filter((u) => itemState(u) === "waiting").length, "waiting"],
      ...scoped,
    }),
    ...g,
  };
}

/**
 * The viewer's stylesheet — published ONCE at `assets/library/viewer.css` and
 * referenced by every library page, so a page is a shell rather than a copy
 * (owner, 2026-10-02, #1881).
 *
 * SCOPED to `.lib-page` since 2026-10-07, when the pages moved onto the
 * theme's layout ({@link libraryPageHtml}): no rule on `body`, `:root` or
 * `a`, and the palette keyed on the scheme the site paints.
 */
export const VIEWER_CSS = `/* The block content panel — bean lrmo. Tokens only, so it follows the light
   and dark palettes below rather than hardcoding either. */
.lib-page #document .seg { margin: .2rem 0 .8rem; }
.lib-page #document .seg button[aria-selected="true"] { font-weight: 600; }
.lib-page #document .docbody { padding: 0 16px 8px; }
.lib-page #document .dockw { padding: 4px 16px; }
/* Kept figures and transcribed tables (who-iris#224). */
.lib-page #document .doc-gallery { display: flex; flex-direction: column; gap: 8px; margin: .5rem 0 1rem; }
.lib-page #document .doc-figure { margin: 0; display: flex; align-items: center; gap: 12px; border: 1px solid var(--border, #8884); border-radius: 6px; padding: 6px; background: var(--card, transparent); }
.lib-page #document .fig-thumb { flex: 0 0 auto; padding: 0; border: 0; background: #fff; border-radius: 4px; cursor: zoom-in; }
.lib-page #document .fig-thumb:focus-visible { outline: 2px solid #58a6ff; outline-offset: 2px; }
.lib-page #document .doc-figure img { display: block; width: 120px; height: 90px; object-fit: contain; border-radius: 4px; }
.lib-page #document .doc-figure figcaption { flex: 1 1 auto; min-width: 0; font-size: .9em; display: flex; gap: 8px; align-items: baseline; }
.lib-page #document .fig-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.lib-page .fig-print-desc { display: none; }
.lib-page .doc-print { margin-inline-start: 8px; font-size: .8rem; cursor: pointer; }
@media print {
  .lib-page .fig-print-desc { display: block; margin: 4px 0 0; font-size: .85em; }
  .lib-page #document .doc-figure { display: block; break-inside: avoid; }
  .lib-page #document .doc-figure img { width: auto; height: auto; max-width: 100%; max-height: 60vh; }
  .lib-page #document .fig-thumb { cursor: default; }
  .lib-page .doc-print, .lib-page .fig-pop { display: none; }
}
.lib-page .fig-pop { max-width: min(92vw, 1100px); max-height: 92vh; padding: 0; border: 1px solid var(--border, #8884); border-radius: 8px; background: var(--bg, #fff); color: inherit; }
.lib-page .fig-pop::backdrop { background: rgba(0,0,0,.6); }
.lib-page .fig-pop-box { position: relative; padding: 12px 16px; }
.lib-page .fig-pop-box img { display: block; max-width: 100%; max-height: 70vh; margin: 8px auto; background: #fff; object-fit: contain; }
.lib-page .fig-pop-box h3 { margin: 0 32px 0 0; }
.lib-page .fig-pop-x { position: absolute; top: 6px; inset-inline-end: 8px; min-width: 32px; min-height: 32px; font-size: 22px; line-height: 1; border: 0; background: none; color: inherit; cursor: pointer; }
.lib-page #document .doc-table { margin: .4rem 0; }
.lib-page #document .doc-table-scroll { overflow-x: auto; max-width: 100%; }
.lib-page #document .doc-table table { font-size: .85em; }
.lib-page #document p.kw, .lib-page #document .dockw p.kw { display: inline; margin: 0; }
.lib-page #document .docsec p.kw { display: block; margin: 2px 0 6px; }
.lib-page #document p.kw .pill { margin: 0 2px 2px 0; }
.lib-page #document ul.toc, .lib-page #document ul.toc ul { list-style: none; margin: 0; padding-left: 1.1rem; }
.lib-page #document ul.toc { padding-left: 0; }
.lib-page #document ul.toc li { margin: .15rem 0; }
.lib-page #document ul.toc li.leaf { padding-left: 1rem; }
.lib-page #document ul.toc summary { cursor: pointer; }
.lib-page #document td ul { margin: .3rem 0 0; padding-left: 1.1rem; }
.lib-page #document .docsec { margin: 0 0 1rem; }
.lib-page #document .docsec h3 { margin: .2rem 0 .3rem; font-size: 1rem; }
.lib-page #document .sum { padding: .55rem .7rem; border: 1px dashed var(--line); border-radius: 6px; }
.lib-page #document .sum p { margin: .35rem 0 0; }
.lib-page #document td { white-space: normal; vertical-align: top; }
.lib-page #blocks details > summary { cursor: pointer; }
.lib-page #blocks .block-body { margin: .4rem 0 .2rem; }
.lib-page #blocks .block-body pre {
  white-space: pre-wrap; word-break: break-word; margin: 0;
  padding: .55rem .7rem; background: var(--panel); border: 1px solid var(--line);
  border-radius: 6px; font-size: 12.5px; line-height: 1.45; max-height: 22rem; overflow: auto;
}
.lib-page #blocks .block-body .note { margin: .35rem 0 0; font-size: 11.5px; color: var(--muted); }
/* EXTRACT AND AGENT SUMMARY, SIDE BY SIDE -- owner, 2026-09-24: "the extract
   of a node is shown, but no agentic summary". Beside, never instead: the
   extract is the source's words and the summary is an agent's account of
   them, so a reader must be able to hold one against the other. Two columns
   where there is room, stacked on a phone, extract first either way. */
.lib-page #blocks td { white-space: normal; vertical-align: top; }
.lib-page #blocks td.bt { min-width: 15rem; }
.lib-page #blocks .pair { display: grid; grid-template-columns: 1fr; gap: .6rem; }
@media (min-width: 760px) { .lib-page #blocks .pair { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.lib-page #blocks .pair > div { min-width: 0; }
.lib-page #blocks .lbl { margin: 0 0 .3rem; font-size: 11.5px; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: .04em; }
.lib-page #blocks .sum { padding: .55rem .7rem; border: 1px dashed var(--line); border-radius: 6px;
  font-size: 13px; line-height: 1.5; }
.lib-page #blocks .sum p { margin: .35rem 0 0; }
/* A WITHHELD ENTRY -- issue #1794. Said in words, styled as information
   rather than as an error: not publishing a refused work is the system
   working, and the banner is there so it is not mistaken for a gap. */
.lib-page #blocks .wh-banner { margin: 8px 16px 12px; padding: .6rem .8rem; border: 1px solid var(--info);
  background: var(--info-soft); border-radius: 8px; font-size: .86rem; line-height: 1.5; }
.lib-page #blocks .wh-banner p { margin: 0 0 .35rem; }
.lib-page #blocks .wh-banner p:last-child { margin: 0; }
.lib-page #blocks .wh-line { color: var(--muted); font-size: .8rem; }
/* THEMED, since 2026-10-07: every library page sits on the site's default
   layout, inside the theme's content column, so this sheet styles ONE
   wrapper. Every selector starts .lib-page, and there is no rule on body,
   :root or a -- a rule there would restyle the theme on every page that
   shares this file's reader. The palette is keyed on the scheme the SITE
   paints (data-fa-scheme on html, set by head_custom.html's first-paint
   block and by docs-ui.js's toggle), so it follows the reader's choice
   rather than the OS alone. Dark is the default because the site's is.
   --bg is the theme's own ground, which a sticky header must paint over. */
.lib-page {
  --bg:#27262b; --fg:#e8eaed; --muted:#a9b0b8; --line:#4a4950; --panel:#1f1e23;
  --accent:#7fc7a1; --accent-soft:#16291f; --warn:#e0b25e; --warn-soft:#2a2213;
  --info:#8db4ec; --info-soft:#1d2937; --box:#1f1e23;
}
html[data-fa-scheme="light"] .lib-page {
  --bg:#fff; --fg:#17191c; --muted:#5b6168; --line:#d9dde2; --panel:#f6f7f9;
  --accent:#276749; --accent-soft:#e6f2ec; --warn:#8a5300; --warn-soft:#fdf3e0;
  --info:#1a5fb4; --info-soft:#e7eefb; --box:#fff;
}
.lib-page, .lib-page * { box-sizing:border-box; }
/* The theme's list bullet is drawn by li::before in .main-content; the
   table of contents is a tree, not a bulleted list. */
.lib-page ul.toc li::before { content:none; }
.lib-page .lib-head { padding:16px 0; border-bottom:1px solid var(--line); }
.lib-page h1 { margin:0 0 6px; }
.lib-page .badges { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0 0; }
.lib-page .badge { border:1px solid var(--line); border-radius:8px; padding:5px 10px; font-size:.82rem; background:var(--panel); }
.lib-page .badge b { font-variant-numeric:tabular-nums; }
.lib-page .badge.q b { color:var(--warn); }
/* The view panel (viewPanelHtml): the entry's primary asset, under the head. */
.lib-page .lib-view { padding:10px 0; border-bottom:1px solid var(--line); }
.lib-page .lib-view summary { cursor:pointer; font-size:1rem; }
.lib-page .lib-view .pdf-viewer { margin:.6rem 0 0 !important; }
.lib-page .lib-view img { display:block; max-width:100%; height:auto; border:1px solid var(--line); border-radius:6px; }
.lib-page .lib-view-absent p { margin:0; }
.lib-page .lib-record { padding:6px 0; border-bottom:1px solid var(--line); }
.lib-page .lib-record p { margin:0; }
.lib-page .lib-summary { padding:6px 0 10px; border-bottom:1px solid var(--line); }
.lib-page .lib-summary h2 { margin:.4rem 0; }
.lib-page .lib-summary p { margin:.3rem 0; max-width:60rem; }
.lib-page .lib-versions { padding:6px 0; border-bottom:1px solid var(--line); }
.lib-page .lib-versions p { margin:0; }
.lib-page .lib-lang-toggle { margin:.5rem 0 0; }
.lib-page .lib-lang-toggle a.seg-link { display:inline-block; min-height:24px; line-height:24px; padding:2px 10px; border:1px solid var(--line); text-decoration:none; }
.lib-page details.lib-all { padding:10px 0; border-top:1px solid var(--line); }
.lib-page details.lib-all > summary { cursor:pointer; font-size:1rem; min-height:24px; }
.lib-page .toolbar { padding:10px 0; display:flex; flex-wrap:wrap; gap:8px; align-items:center; border-bottom:1px solid var(--line); }
.lib-page input, .lib-page select, .lib-page button { font:inherit; color:var(--fg); background:var(--box);
  border:1px solid var(--line); border-radius:6px; padding:6px 9px; }
.lib-page input { flex:1 1 200px; min-width:0; }
.lib-page .seg { display:inline-flex; border:1px solid var(--line); border-radius:6px; overflow:hidden; }
.lib-page .seg button { border:0; border-radius:0; background:transparent; cursor:pointer; padding:6px 12px; }
.lib-page .seg button[aria-pressed="true"] { background:var(--accent-soft); color:var(--fg); font-weight:600; }
.lib-page .lib-main { padding:0 0 40px; }
.lib-page table { border-collapse:collapse; width:100%; font-size:.86rem; }
/* min-width, border-left, background and font-size undo the theme's own
   cell rules, which are type selectors and so lose to these. */
.lib-page th, .lib-page td { text-align:left; padding:7px 10px; border:0; border-bottom:1px solid var(--line); white-space:nowrap;
  min-width:0; background:transparent; font-size:inherit; }
.lib-page th { position:sticky; top:0; background:var(--bg); color:var(--muted); font-size:.74rem;
  text-transform:uppercase; letter-spacing:.04em; }
.lib-page th button { border:0; background:transparent; padding:0; font:inherit; color:inherit;
  cursor:pointer; text-transform:inherit; letter-spacing:inherit; }
.lib-page th button:hover { color:var(--fg); text-decoration:underline; }
.lib-page th[aria-sort] button::after { content:" ▲"; }
.lib-page th[aria-sort="descending"] button::after { content:" ▼"; }
.lib-page td.num { text-align:right; font-variant-numeric:tabular-nums; }
.lib-page tbody tr:hover { background:var(--panel); }
.lib-page .slug { font-family:var(--fa-font-mono,Menlo,Consolas,monospace); }
/* A row's secondary links -- source, README, a referenced entry's own -- are
   24 px targets (WCAG 2.5.8). As plain inline text they were 16 px tall and
   sat closer than 24 px to the title link beside them. */
.lib-page a.src { display:inline-block; min-width:24px; min-height:24px; line-height:24px; }
/* The row's PRIMARY links -- the title and the slug -- are 24 px targets too.
   Fixing a.src alone left the title a 16 px inline box, and wherever the
   title cell wrapped (a short title whose "source" link falls to the next
   line, which depends on the fonts the runner has) that 24 px source link
   sat 10.6 px below the title's centre: axe's target-size, serious, on
   main's CI for cat-harness/nist-sp-800-207 ("Zero Trust Architecture").
   A rule for the CLASS of link, not that entry: every listing link is a
   24 px target whatever wraps next to it. */
.lib-page a.lib-title, .lib-page a.lib-view { display:inline-block; min-height:24px; line-height:24px; }
.lib-page .pill { display:inline-block; font-size:.7rem; padding:1px 7px; border-radius:999px;
  border:1px solid var(--line); color:var(--muted); }
.lib-page .pill.ok { color:var(--accent); background:var(--accent-soft); border-color:var(--accent); }
.lib-page .pill.warn { color:var(--warn); background:var(--warn-soft); border-color:var(--warn); }
.lib-page .pill.info { color:var(--info); background:var(--info-soft); border-color:var(--info); }
.lib-page #desktop { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr));
  gap:14px; padding:16px; }
.lib-page .card { border:1px solid var(--line); border-radius:10px; background:var(--panel);
  padding:12px; display:flex; flex-direction:column; gap:6px; }
.lib-page .card h3 { margin:0; font-size:.92rem; line-height:1.3; }
.lib-page .card .slug { font-size:.74rem; color:var(--muted); }
.lib-page .card .rows { font-size:.78rem; color:var(--muted); display:grid;
  grid-template-columns:auto 1fr; gap:1px 8px; margin-top:2px; }
.lib-page .card .rows b { color:var(--fg); font-weight:600; font-variant-numeric:tabular-nums; }
.lib-page .card .tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
.lib-page .spine { height:6px; border-radius:3px; background:var(--accent); opacity:.65; }
.lib-page .empty { color:var(--muted); padding:24px 16px; }
.lib-page h2 { font-size:.95rem; margin:24px 0 4px; }
.lib-page p.note { color:var(--muted); font-size:.82rem; margin:0 0 8px; }
.lib-page .wrap { overflow:auto; }
/* THE BOOK'S AVATAR, first in its row -- bean zrvt, issue #1006. A fixed box
   so a row does not reflow when the cover arrives, and a glyph of the same
   size when there is no picture, so "no cover" never looks like a broken one. */
.lib-page .lib-ava { display:inline-flex; align-items:center; justify-content:center;
  width:34px; height:46px; margin-right:8px; vertical-align:middle; flex:0 0 auto;
  border:1px solid var(--line); background:var(--panel); overflow:hidden; }
.lib-page .lib-ava img { width:100%; height:100%; object-fit:cover; display:block; }
.lib-page .lib-ava svg { width:22px; height:22px; fill:none; stroke:var(--muted); stroke-width:1.6; }
.lib-page td.lib-first { white-space:nowrap; }
.lib-page .card .lib-ava { width:56px; height:76px; }
/* THE LISTING FITS MORE OF ITSELF, AND SAYS WHEN IT DOES NOT -- bean gnqa,
   findings 1 and 2. Measured 2026-10-02 at 1280 px: a 3636 px table in a
   1224 px box, every cell nowrap, so the title and source path alone were
   2,000 px and nine of thirteen columns sat past the right edge with
   nothing on screen saying so. The long TEXT cells now wrap inside a
   bounded width; the short numeric and pill cells keep nowrap, because a
   count broken over two lines is harder to read than one scrolled to. */
.lib-page #listing td.lib-first { white-space:normal; min-width:13rem; max-width:17rem; }
.lib-page #listing td.t-title { white-space:normal; min-width:14rem; max-width:22rem; }
/* A long title is capped at three lines (owner, 2026-11-13: "some titles are
   really long. need cap + hover for complete"). The rest stays in the DOM, so
   a screen reader reads all of it; the title attribute shows it on hover. */
.lib-page #listing td.t-title a.lib-title, .lib-page #listing td.t-title .lib-title-locale {
  display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; line-clamp:3; overflow:hidden; min-height:24px; }
.lib-page #listing td.t-title .lib-title-locale { font-size:.85em; color:var(--muted); line-height:1.35; }
.lib-page #listing td.t-source { white-space:normal; min-width:9rem; max-width:14rem; }
.lib-page #listing td.t-source .slug { overflow-wrap:anywhere; }
.lib-page #listing td.t-source .pill { white-space:nowrap; }
.lib-page #queue td.slug { white-space:normal; overflow-wrap:anywhere; min-width:12rem; max-width:24rem; }
/* "Referenced by" OPENS rather than hovers -- finding 6. A title tooltip is
   unreachable by touch and by keyboard; a details element is both. */
.lib-page details.refs > summary { cursor:pointer; list-style:none; display:inline-flex; align-items:center; min-height:28px; }
.lib-page details.refs > summary::-webkit-details-marker { display:none; }
.lib-page details.refs > summary .pill::after { content:" \\25B8"; }
.lib-page details.refs[open] > summary .pill::after { content:" \\25BE"; }
.lib-page details.refs ul { margin:.3rem 0 0; padding-left:1rem; font-size:.72rem; color:var(--muted);
  white-space:normal; overflow-wrap:anywhere; max-width:22rem; }
/* THE EDGE CUE AT DESKTOP WIDTH. narrow-viewport.css fades a table's
   overflowing edge below 800 px; above it the scroll box is .wrap, and it
   had mask-image none. Same mask, same scroll-driven animation, so a box
   that does not overflow shows no fade. */
@media (min-width: 800px) {
  /* The entry's identity stays in view while the reader scrolls to its
     numbers: the first column is pinned to the scroll box's left edge. */
  .lib-page #listing th:first-child, .lib-page #listing td.lib-first { position:sticky; left:0; z-index:1;
    background:var(--bg); box-shadow:1px 0 0 var(--line); }
  .lib-page #listing th:first-child { z-index:2; }
  @supports (animation-timeline: scroll()) {
    /* Right edge only: the pinned first column already shows what is to
       the left, and a left fade would dim the entry's own name. */
    .lib-page #listing.wrap, .lib-page #queue.wrap {
      mask-image: linear-gradient(to right,
        #000 calc(100% - var(--fa-cue-r)), transparent 100%);
      animation: fa-scroll-cue linear both;
      animation-timeline: scroll(self inline);
    }
  }
}
/* ON A PHONE A ROW IS A CARD -- finding 2. At 390 px a sideways-scrolling
   table showed one column of thirteen: the cover, the slug and a button,
   none of the metadata the listing exists for. Each row now lays its cells
   out in a two-column grid, every cell labelled from its own header, and
   the header row stays as the SORT controls. Overrides narrow-viewport.css
   by id, which outranks its type selector. */
@media (max-width: 799.98px) {
  .lib-page #listing table, .lib-page #queue table { display:block; mask-image:none; animation:none; overflow:visible; }
  .lib-page #listing thead, .lib-page #queue thead, .lib-page #listing tbody, .lib-page #queue tbody { display:block; }
  .lib-page #listing thead tr, .lib-page #queue thead tr { display:flex; flex-wrap:wrap; gap:2px 12px; padding:6px 10px; }
  .lib-page #listing thead th, .lib-page #queue thead th { position:static; border:0; padding:2px 0; }
  .lib-page #listing thead tr::before { content:"Sort by"; font-size:.74rem; color:var(--muted); align-self:center; }
  .lib-page #listing tbody tr, .lib-page #queue tbody tr { display:grid; grid-template-columns:1fr 1fr; gap:2px 10px;
    padding:10px; border-bottom:1px solid var(--line); }
  .lib-page #listing tbody td, .lib-page #queue tbody td { display:block; border:0; padding:2px 0; white-space:normal;
    min-width:0; max-width:none; text-align:left; overflow-wrap:anywhere; }
  .lib-page #listing td.lib-first, .lib-page #listing td.t-title, .lib-page #listing td.t-source, .lib-page #listing td.t-refs, .lib-page #queue td.slug { grid-column:1 / -1; }
  .lib-page #listing td[data-label]::before, .lib-page #queue td[data-label]::before { content:attr(data-label);
    display:block; font-size:.66rem; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); }
  .lib-page #listing td.lib-first::before, .lib-page #listing td.t-title::before { content:none; }
}
`;

/**
 * The viewer's script — published ONCE at `assets/library/viewer.js`.
 *
 * NO BACKTICKS INSIDE IT — not in strings, not in comments. It is one template
 * literal, so a backtick terminates it and the rest becomes TypeScript; that
 * has happened twice. `viz-generators.test.ts` imports this module, so a stray
 * one reddens the suite rather than only the generator.
 */
export const VIEWER_JS = `"use strict";
var G = null, SORT = { key: "id", dir: 1 }, VIEW = "list";
/* THE PAGE'S IDENTITY, and the only thing a page carries -- owner,
   2026-10-02 (#1881): every page is a thin shell that loads its content from
   the published assets. Attributes on the page's own element rather than script, so a shell
   holds no code of its own. DATA_HREF is made ABSOLUTE here, once, before
   anything can rewrite the address bar (see honourAddress). */
var CONFIG = (function(){
  /* data-kg-* on the page's .lib-page element (issue #1830) -- no private block. */
  var el = document.querySelector(".lib-page");
  var d = el ? el.dataset : {};
  var c = { data: d.kgData || "", scope: d.kgScope || "", libRoot: d.kgLibRoot };
  if (d.kgEntry !== undefined) c.entry = d.kgEntry;
  return c;
})();
var DATA_HREF = new URL(String(CONFIG.data || ""), location.href).href;
/* ARRIVING AT #lib-view OPENS THE VIEW PANEL -- the folio glass's eye links
   here (owner, 2026-10-16: "there should be [eye] icon to look at it"), and a
   reader who pressed it came to look, not to press a second toggle. Opening
   the panel is what loads the viewer (pdf-viewer's toggle rule). */
function openViewPanel(){
  if (location.hash !== "#lib-view") return;
  var d = document.querySelector("#lib-view details");
  if (d && !d.open) d.open = true;
}
openViewPanel();
window.addEventListener("hashchange", openViewPanel);
/* The SUBJECT this page is scoped to, or "" for the handler's whole view.
   One projection serves both — a second JSON per subject would be the same
   facts written N+1 times, free to disagree the moment one is regenerated. */
var SCOPE = typeof CONFIG.scope === "string" ? CONFIG.scope : "";
function inScope(x){ return !SCOPE || x.instance === SCOPE; }
/* THE SITE ROOT, derived from the projection's own relative address rather
   than declared -- the page is served at more than one depth, and DATA_HREF
   is already the one path that is right at every one of them. */
var SITE_ROOT = new URL(DATA_HREF.slice(0, DATA_HREF.length - "assets/library/index.json".length)).pathname;
/* An entry's avatar URL, or "". The projection carries a SITE-ROOT path
   (library-graph.ts avatarOf), absent when there is no picture or the site
   does not serve it; nothing is guessed here either. */
function avatarUrl(e){
  var h = e.avatar && typeof e.avatar.href === "string" ? e.avatar.href : "";
  return h.charAt(0) === "/" ? SITE_ROOT + h.slice(1) : "";
}
var BOOK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>';
/* A cover that fails to load falls back to the glyph. ONE capturing listener
   rather than an inline onerror per image: 'error' does not bubble, and an
   inline handler is a script-src relaxation this site does not make. */
document.addEventListener("error", function(ev){
  var t = ev.target;
  if (t && t.tagName === "IMG" && t.parentNode && t.parentNode.classList &&
      t.parentNode.classList.contains("lib-ava")) t.parentNode.innerHTML = BOOK_SVG;
}, true);
function avatarHtml(e){
  var u = avatarUrl(e);
  return '<span class="lib-ava">' + (u
    ? '<img src="' + esc(u) + '" alt="" loading="lazy">'
    : BOOK_SVG) + "</span>";
}
/* A REFERENCED entry's own links -- the published IG, this site's artefact
   index. Owner, 2026-10-02. An entry recorded by reference holds nothing to
   open, so without these its row names a thing and goes nowhere. A site path
   (leading slash) is composed against SITE_ROOT like an avatar; anything
   else must be http(s), so a record cannot put a script URL in an href. */
function linkHref(h){
  h = typeof h === "string" ? h : "";
  if (h.charAt(0) === "/") return SITE_ROOT + h.slice(1);
  return /^https?:[/][/]/i.test(h) ? h : "";
}
function linksHtml(e){
  return (e.links || []).map(function(l){
    var h = linkHref(l.href);
    return h ? ' <a class="src" href="' + esc(h) + '">' + esc(l.label) + "</a>" : "";
  }).join("");
}
/* EVERY ENTRY HAS ITS OWN IRI, AND IT IS A PATH -- owner, 2026-10-02
   (#1881): "each asset gets its own IRI", "no query strings", materialized
   on gh-pages rather than routed by a 404. The generator writes a shell at
   <library>/<instance>/<id>/ for every entry, so a row links there. LIB_ROOT
   is the library's own directory, given relative to the page by CONFIG and
   resolved once against where the page was LOADED. */
var LIB_ROOT = new URL(String(CONFIG.libRoot || "./"), location.href).pathname;
${ADDRESS_JS}
function entryHref(e){
  return LIB_ROOT + encodeURIComponent(e.instance) + "/" + encodeURIComponent(e.id) + "/";
}
function $(i){ return document.getElementById(i); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function kb(n){ return n >= 1048576 ? (n/1048576).toFixed(1)+" MB" : Math.round(n/1024)+" KB"; }

/* The three-state OCR display jbx2 asks for. "Never scanned" is a DETERMINED
   answer, not a failure, and an ocr/ directory that exists and is empty is a
   third answer again — so none of the three is styled as an error. */
function ocrState(e){
  if (!e.hasOcr) return { label: "not scanned", cls: "" };
  if (e.ocrPages > 0) return { label: e.ocrPages + " OCR pages", cls: "info" };
  return { label: "ocr/ present, empty", cls: "warn" };
}
/* Three states again, and the middle one is the point of the whole column.
   The library is L1 because every reference to a source resolves through it,
   so a slug nothing names is a slug that claim is NOT true of -- a finding
   rather than a blank. A scan that did not run is a third answer: the
   projection carries no refScan, so nobody looked.
   (No backticks in here. See the warning at the top of viewerHtml.) */
function refState(e){
  if (!e.referencedBy) return { label: "not scanned", cls: "", n: -1 };
  var n = e.referencedBy.length;
  if (n === 0) return { label: "referenced by nothing", cls: "warn", n: 0 };
  var kinds = {};
  e.referencedBy.forEach(function(r){ kinds[r.kind] = (kinds[r.kind]||0) + 1; });
  var parts = Object.keys(kinds).sort().map(function(k){ return kinds[k] + " " + k; });
  return { label: parts.join(", "), cls: "ok", n: n };
}
function uploadState(e){
  return {
    match:   { label: "source verified", cls: "ok" },
    differs: { label: "source DIFFERS", cls: "warn" },
    absent:  { label: "source not in a queue", cls: "warn" },
    unknown: { label: "no source named", cls: "" }
  }[e.upload] || { label: e.upload, cls: "" };
}
/* THE PAGE'S LANGUAGE: ?lang=, else the locale segment of its path
   (/en/.../library/), else the page's own lang, else English. */
var LOCALE = (function(){
  var l = "";
  try { l = new URL(location.href).searchParams.get("lang") || ""; } catch (_e) {}
  if (!l) { var m = /[/]([a-z]{2})(?:-[A-Za-z]{2})?[/]/.exec(location.pathname); l = m ? m[1] : ""; }
  if (!l && document.documentElement) l = document.documentElement.getAttribute("lang") || "";
  return (l || "en").toLowerCase().split("-")[0];
})();
/* A TITLE NOT IN THE PAGE'S LANGUAGE SHOWS THE READER'S UNDER IT -- owner,
   2026-11-13: "when display title not in locale, then display locale if
   present under original". Only an official edition's title (e.titles, from
   the projection); nothing when there is none, and nothing is translated.
   A long title is capped to three lines by CSS; the whole of it is in the
   DOM for a screen reader and in a title attribute for a pointer. */
function titleHtml(e, href){
  var t = String(e.title == null ? "" : e.title);
  var h = '<a class="lib-title" href="'+esc(href)+'" title="'+esc(t)+'"'+(e.lang ? ' lang="'+esc(e.lang)+'"' : "")+">"+esc(t)+"</a>";
  var mine = e.lang && e.lang !== LOCALE && e.titles && typeof e.titles[LOCALE] === "string" ? e.titles[LOCALE] : "";
  return mine ? h + '<span class="lib-title-locale" lang="'+esc(LOCALE)+'" title="'+esc(mine)+'">'+esc(mine)+"</span>" : h;
}

var COLS = [
  /* THE SLUG OPENS THE ENTRY'S VISUALISER -- e.view, generated per entry by
     the projection (owner, 2026-10-02, paraphrased: clicking an entry's slug
     should open its visualiser). A site-root path, composed like an avatar; an entry
     whose projection carries none keeps a plain slug. */
  { k:"id",       t:"slug",     n:false, f:function(e){
      var v = typeof e.view === "string" && e.view.charAt(0) === "/" ? SITE_ROOT + e.view.slice(1) : "";
      var s = '<span class="slug">'+esc(e.id)+"</span>";
      return avatarHtml(e) + (v ? '<a class="lib-view" href="'+esc(v)+'">'+s+"</a>" : s); } },
  /* Bean qgjh: an entry can be OPENED. The title is a link to the item's own
     page (its generated README) where one exists, and the document's upstream
     record rides beside it: arXiv or DOI, from the identifier its manifest
     records. Nothing is linked that the projection does not carry. */
  { k:"title",    t:"title",    n:false, c:"t-title", f:function(e){
      /* THE TITLE OPENS THE ENTRY'S OWN PAGE -- its path IRI (#1881). It
         used to open the item's README on GitHub, which a referenced entry
         may not have (owner, 2026-10-02: a DAK IG's title went to a
         404). The README stays as a secondary link, only when one exists. */
      var t = titleHtml(e, entryHref(e));
      var src = e.arxiv ? "https://arxiv.org/abs/"+encodeURIComponent(e.arxiv) : e.doi ? "https://doi.org/"+e.doi : "";
      return t + (src ? ' <a class="src" href="'+esc(src)+'">source</a>' : "") +
        (e.readme ? ' <a class="src" href="'+esc(e.readme)+'">README</a>' : "") + linksHtml(e);
    } },
  { k:"instance", t:"instance", n:false, f:function(e){ return '<span class="pill">'+esc(e.instance)+"</span>"; } },
  { k:"rung",     t:"rung",     n:false, f:function(e){ return '<span class="pill '+(e.rung==="none"?"warn":"ok")+'">'+esc(e.rung)+"</span>"; } },
  { k:"sections", t:"sections", n:true },
  { k:"blocks",   t:"blocks",   n:true },
  { k:"images",   t:"images",   n:true },
  { k:"figures",  t:"figures",  n:true, f:function(e){ return e.figures==null?'<span class="pill">—</span>':esc(String(e.figures)); } },
  { k:"ocrPages", t:"ocr",      n:true, f:function(e){ var s=ocrState(e); return '<span class="pill '+s.cls+'">'+esc(s.label)+"</span>"; } },
  { k:"pageEnd",  t:"pages",    n:true, f:function(e){ return e.pageStart==null?'<span class="pill">—</span>':esc(e.pageStart+"–"+e.pageEnd); } },
  { k:"words",    t:"words",    n:true, f:function(e){ return e.words.toLocaleString(); } },
  { k:"bytes",    t:"size",     n:true, f:function(e){ return kb(e.bytes); } },
  { k:"refCount", t:"referenced by", n:true, c:"t-refs", f:function(e){ var s=refState(e);
      /* The referencing files used to ride in a title attribute, which touch
         and keyboard readers cannot reach (bean gnqa, finding 6). A details
         element is focusable and opens on tap, Enter or Space. */
      var refs = e.referencedBy || [];
      var pill = '<span class="pill '+s.cls+'">'+esc(s.label)+"</span>";
      if (!refs.length) return pill;
      return '<details class="refs"><summary>'+pill+'</summary><ul>' + refs.map(function(r){
        return "<li>"+esc(r.from)+" ("+r.count+")</li>"; }).join("") + "</ul></details>"; } },
  /* THE SOURCE FILE NAME OPENS IT -- owner, 2026-10-30: "the link to the
     source should be clickable to view under source". An entry whose held
     source has a viewer (e.viewable, set by the projection from viewableOf)
     links to its own page's view panel, #lib-view, which opens on arrival,
     in a NEW TAB (owner, 2026-10-30, option B) so the listing stays where the
     reader left it. Any other entry keeps the plain name. */
  { k:"upload",   t:"source",   n:false, c:"t-source", f:function(e){ var s=uploadState(e);
      var name = '<span class="slug" style="font-size:.72rem;color:var(--muted)">'+esc(e.sourceFile)+"</span>";
      if (e.sourceFile && e.viewable) name = '<a class="src lib-src" href="'+esc(entryHref(e))+'#lib-view" target="_blank" rel="noopener">'+esc(e.sourceFile)+"</a>";
      /* Owner, 2026-11-13: every source file name is a link. One not viewable
         here opens its entry page, which says where the file is held. */
      else if (e.sourceFile) name = '<a class="src lib-src" href="'+esc(entryHref(e))+'">'+esc(e.sourceFile)+"</a>";
      return '<span class="pill '+s.cls+'">'+esc(s.label)+"</span>"+(e.sourceFile?"<br>"+name:""); } }
];

function rows(){
  var q = $("q").value.trim().toLowerCase();
  var r = G.entries.filter(function(e){
    if (!inScope(e)) return false;
    if (!q) return true;
    return (e.id+" "+e.title+" "+(e.extractedTitle||"")+" "+e.sourceFile+" "+e.docId+" "+e.instance).toLowerCase().indexOf(q) >= 0;
  });
  var k = SORT.key, d = SORT.dir;
  return r.sort(function(a,b){
    var x=a[k], y=b[k];
    if (typeof x === "number" && typeof y === "number") return (x-y)*d;
    return String(x==null?"":x).localeCompare(String(y==null?"":y))*d;
  });
}

function renderList(){
  var r = rows();
  var h = "<table><thead><tr>" + COLS.map(function(c){
    var sorted = SORT.key === c.k;
    return "<th" + (sorted ? ' aria-sort="'+(SORT.dir>0?"ascending":"descending")+'"' : "") +
      '><button type="button" data-k="'+c.k+'">'+esc(c.t)+"</button></th>";
  }).join("") + "</tr></thead><tbody>";
  h += r.map(rowHtml).join("") || '<tr><td colspan="'+COLS.length+'"><p class="empty">Nothing matches.</p></td></tr>';
  $("listing").innerHTML = h + "</tbody></table>";
}

/* THE ENTRY'S OWN ROW, AT THE TOP OF ITS PAGE -- owner, 2026-11-14: "i
   wanted this at the top of the page". The row the whole-library listing
   draws for this entry was the only place its counts were said, and on an
   entry page that listing is folded away at the bottom. The same COLS and
   the same rowHtml, so the two rows cannot disagree; a plain header, since
   one row has nothing to sort. */
function renderEntryRow(e){
  var el = $("entry-row");
  if (!el) return;
  el.hidden = false;
  el.innerHTML = '<table class="entry-row"><thead><tr>' + COLS.map(function(c){ return "<th>" + esc(c.t) + "</th>"; }).join("") +
    "</tr></thead><tbody>" + rowHtml(e) + "</tbody></table>";
}

function rowHtml(e){
    /* THE ROW DECLARES ITSELF, and the folio reads nothing else.
       A selector guessing at cell positions would bind to this generator's
       markup and break silently the next time a column moves; an attribute
       is a contract. docs-ui.js decorates any row carrying these and
       ignores every page that has none -- so this generator knows nothing
       about the folio beyond emitting three attributes. R30, bean j2if. */
    var key = e.instance + "/" + e.id;
    /* THE HREF IS THIS PAGE, ANCHORED -- and it is composed from
       location.pathname rather than declared anywhere.

       Measured 2026-09-22 before choosing: an ingested library document has
       NO published page of its own. Nothing writes one; this viewer is the
       only thing that renders these entries at all. So there was no stale
       URL to fix, there was no URL. The owner named the reason a per-asset
       route was the wrong shape -- "asset has too much drift" -- and ruled
       the route belongs to the HARNESS.

       cat-harness owns this viewer, so the viewer IS the asset's address.
       Composing it from the page's own location means the same generator
       emits both the row and the page it points at, and a reader arriving
       at the anchor gets the row selected rather than a 404. Nothing to
       declare, so nothing to drift -- the folio-mount's argument for
       deriving its root, applied one level in.

       Since 2026-10-02 the address is the entry's PATH (entryHref above),
       which the generator backs with a page that lands on this same anchor
       -- so the anchor is still the contract, and the path is a name a
       person can type and share. */
    var href = entryHref(e);
    /* data-fa-pullout-host puts the pull-out control in the FIRST cell.
       It used to land in the last one, which on a table wider than the
       screen is past its right edge -- the owner could not find a way onto
       the glass at all (issue #1006). */
    return '<tr data-fa-library-item="' + esc(key) + '"' +
      ' data-fa-library-href="' + esc(href) + '"' +
      ' data-fa-library-avatar="' + esc(avatarUrl(e)) + '"' +
      ' data-fa-library-title="' + esc(e.title || e.id) + '">' + COLS.map(function(c, i){
      var cls = i === 0 ? "lib-first" : [c.n ? "num" : "", c.c || ""].join(" ").trim();
      return "<td" + (cls ? ' class="'+cls+'"' : "") + (i === 0 ? " data-fa-pullout-host" : "") +
        ' data-label="'+esc(c.t)+'">' + (c.f ? c.f(e) : esc(e[c.k])) + "</td>";
    }).join("") + "</tr>";
}

function renderDesk(){
  var r = rows();
  $("desktop").innerHTML = r.map(function(e){
    var o = ocrState(e), u = uploadState(e);
    /* The SAME three attributes the listing row carries, so a card is a
       library item too and the folio's pull-out finds it in either view. */
    var key = e.instance + "/" + e.id;
    return '<article class="card" data-fa-library-item="' + esc(key) + '"' +
      ' data-fa-library-href="' + esc(entryHref(e)) + '"' +
      ' data-fa-library-avatar="' + esc(avatarUrl(e)) + '"' +
      ' data-fa-library-title="' + esc(e.title || e.id) + '"><div class="spine"></div>' +
      '<div data-fa-pullout-host style="display:flex;gap:8px;align-items:flex-start">' + avatarHtml(e) +
      "<h3>"+esc(e.title)+"</h3></div>" +
      '<div class="slug">'+esc(e.instance)+" / "+esc(e.id)+"</div>" +
      '<div class="rows">' +
        "<span>sections</span><b>"+e.sections+"</b>" +
        "<span>blocks</span><b>"+e.blocks+"</b>" +
        (e.summaries && e.summaries.prose ? "<span>summarised</span><b>"+e.summaries.summarised+" / "+e.summaries.prose+"</b>" : "") +
        "<span>images</span><b>"+e.images+"</b>" +
        "<span>figures</span><b>"+(e.figures==null?"—":e.figures)+"</b>" +
        "<span>pages</span><b>"+(e.pageStart==null?"—":e.pageStart+"–"+e.pageEnd)+"</b>" +
        "<span>words</span><b>"+e.words.toLocaleString()+"</b>" +
        "<span>size</span><b>"+kb(e.bytes)+"</b>" +
      "</div>" +
      '<div class="tags"><span class="pill '+(e.rung==="none"?"warn":"ok")+'">'+esc(e.rung)+"</span>" +
        '<span class="pill '+o.cls+'">'+esc(o.label)+"</span>" +
        '<span class="pill '+u.cls+'">'+esc(u.label)+"</span>" +
        '<span class="pill '+refState(e).cls+'">'+esc(refState(e).label)+"</span></div>" +
      "</article>";
  }).join("") || '<p class="empty">Nothing matches.</p>';
}


/* LAZY on an entry page (owner, 2026-11-14: "do lazy load content"): the
   whole library's listing sits in a closed <details> under the entry, and
   drawing every row there is work for a reader who never opens it. It is
   drawn on the first open; until then nothing is. */
function render(){
  var fold = $("listing").closest("details.lib-all");
  if (fold && !fold.open) {
    if (!fold.getAttribute("data-lazy")) {
      fold.setAttribute("data-lazy", "1");
      fold.addEventListener("toggle", function(){ if (fold.open) render(); });
    }
    return;
  }
  if (VIEW === "list") renderList(); else renderDesk();
}

/* WHICH ENTRY THIS PAGE IS ABOUT -- read off its own PATH (#1881).

   THREE OUTCOMES, and the middle one is why this is not a one-liner. The
   path names an entry of this page's library and it is selected; the path
   names something the library does not hold, and the page says "not found"
   with a link to the library rather than showing an unfiltered table as if
   it had worked (pb04); or the page is a library page, with no entry, and
   nothing happens.

   A LEGACY #<instance>/<id> link is honoured ONCE and normalised to the path
   IRI: replaceState when the entry is this page's own, a real navigation
   when it belongs to another library page. Nothing emits the fragment form
   any more. Every URL composed here is built from an entry the PROJECTION
   holds, never from the address bar's text. */
function byKey(key){
  return G.entries.filter(function(e){ return e.instance + "/" + e.id === key; })[0];
}
function selectEntry(known){
  if (VIEW !== "list") setView("list");
  $("q").value = known.id;
  render();
  /* The entry's own row is drawn at the top first, so on an entry page --
     where the whole-library listing is folded and drawn only when opened --
     the anchored row is that one; a listing row, when drawn, is anchored too. */
  renderEntryRow(known);
  var key = known.instance + "/" + known.id;
  var rows = document.querySelectorAll('[data-fa-library-item="' + key.replace(/"/g, '\\"') + '"]');
  Array.prototype.forEach.call(rows, function(r){ r.setAttribute("data-fa-anchored", "1"); });
  var listed = $("listing") && $("listing").querySelector('[data-fa-anchored="1"]');
  if (listed && !listed.closest("details:not([open])")) listed.scrollIntoView({ block: "center" });
  document.title = (known.title || known.id) + " \u2014 " + known.instance + " library";
  /* The graph of the thing the reader just opened -- bean 7nvr. */
  loadDocument(known.id);
  loadBlocks(known.id, known);
}
function honourAddress(){
  var legacy = legacyKey(location.hash);
  if (legacy) {
    var old = byKey(legacy);
    if (old) {
      var to = entryHref(old);
      if (SCOPE && old.instance === SCOPE) history.replaceState(null, "", to);
      else { location.replace(to); return; }
    }
  }
  var at = entryFromPath(location.pathname, LIB_ROOT);
  if (!at) return;
  var known = at.instance === SCOPE ? byKey(at.instance + "/" + at.id) : undefined;
  if (!known) {
    var lib = LIB_ROOT + encodeURIComponent(SCOPE) + "/";
    $("status").innerHTML = "No entry at this address in the " + esc(SCOPE) + ' library. <a href="' + esc(lib) +
      '">Open the ' + esc(SCOPE) + " library</a>.";
    $("status").setAttribute("data-fa-not-found", "1");
    return;
  }
  selectEntry(known);
}

/* THE BLOCK GRAPH OF ONE ENTRY, fetched only when a reader opens one.
   Bean 7nvr.

   The index carries a COUNT of blocks; this is what they are. It is a
   separate fetch because the corpus holds 1715 blocks over about a megabyte
   of JSON-LD against a 44 KB index, so inlining would multiply the cost of
   the page that answers "what is in here" to serve a question asked about
   one entry at a time.

   THREE OUTCOMES, like honourAnchor above. The file loads and the blocks are
   listed; the file loads and the entry genuinely has none, which is a
   determined answer and says so; or the fetch fails, which is reported as a
   failure rather than rendered as an empty document. An entry with no blocks
   and an entry we could not read must never look the same. */
function blocksHref(id){
  var dir = DATA_HREF.slice(0, DATA_HREF.lastIndexOf("/") + 1);
  return dir + "entries/" + encodeURIComponent(id) + ".json";
}
function renderBlocks(id, data, err, entry){
  var el = $("blocks");
  el.hidden = false;
  if (err) {
    el.innerHTML = '<h2>Blocks</h2><p class="empty">Could not read the block graph for ' +
      esc(id) + ' \u2014 ' + esc(err) + '. This is a failure to read, not an empty document.</p>';
    return;
  }
  var bs = (data && data.blocks) || [];
  /* The Contents tree's leaves (library-document.ts) come from these. */
  DOC_BLOCKS = bs;
  if (DOC && DOC_ID === id && DOC_TAB === "contents") renderDocument(id, DOC, null);
  if (!bs.length) {
    el.innerHTML = '<h2>Blocks</h2><p class="empty">' + esc(id) +
      ' has no blocks. Nothing failed \u2014 the entry carries none.</p>';
    return;
  }
  /* THE DRAIN, for this entry -- counted over the rows below, so the line and
     the table cannot disagree. Advisory: a backlog is work nobody has done
     yet, not a defect. */
  var sums = bs.filter(function(b){ return b.summary; }).map(function(b){ return b.summary.status; });
  var prose = sums.filter(function(x){ return x !== "empty" && x !== "unreadable"; }).length;
  var done = sums.filter(function(x){ return x === "draft" || x === "confirmed"; }).length;
  var drain = prose ? '<p class="note">Agent summaries: <b>' + done + '</b> of ' + prose +
    ' prose block(s) summarised, <b>' + (prose - done) + '</b> still in the queue. ' +
    'Summaries are drafted by an agent a few at a time and confirmed only by a person.</p>' : '';
  el.innerHTML = '<h2>Blocks \u2014 ' + esc(id) + ' <span class="note">(' + bs.length +
    ', in page order)</span></h2>' + withheldBanner(entry, bs) + drain + '<table><thead><tr>' +
    '<th>page</th><th>kind</th><th>types</th><th>title</th><th>narrative / summary</th></tr></thead><tbody>' +
    bs.map(function(b){
      /* BOTH types, never one. A block is dual-typed so a DoCO reader gets
         something without knowing our vocabulary, and showing only ours
         would hide the half this project did not invent. */
      var pages = b.pageStart == null ? '\u2014'
        : (b.pageEnd != null && b.pageEnd !== b.pageStart ? b.pageStart + '\u2013' + b.pageEnd : String(b.pageStart));
      /* A narrative state is three-valued and none of them is an error:
         not-authored means nobody has written one, which is a fact rather
         than a gap. Rendered as plain text for that reason. */
      var nar = b.summary ? summaryDisclosure(b.summary)
        : b.narrative == null ? '\u2014' : esc(b.narrative);
      /* THE CONTENT IS BEHIND A NATIVE <details> — bean lrmo.
         The owner opened this view and said "i expected to be able to see
         narrative content of extracted node": a row carrying only a state
         says a description exists without saying what it is.

         <details> rather than a scripted panel because it expands, collapses
         and takes focus from the keyboard with no JavaScript at all, which is
         one less thing to get wrong and one less thing to test. gjli.

         TRUNCATION IS DECLARED, never inferred from length. A reader who
         cannot tell a short section from a cut one is being shown a claim the
         data does not support. */
      /* THE CONTENT CELL is blockBody -- summary, withheld line, or the
         neutral "(no content carried)", in that order (issue #1794). Its
         text lives in scripts/lib/library-withheld-view.ts so a test runs
         exactly what this page runs. */
      var body = blockBody(b, entry);
      return '<tr id="' + esc(blockAnchor(b.id)) + '"><td class="num">' + esc(pages) + '</td><td>' + esc(b.kind) +
        '</td><td>' + esc((b.types || []).join(' + ')) + '</td><td class="bt">' + body +
        '</td><td>' + nar + '</td></tr>';
    }).join("") + '</tbody></table>';
}
/* A BLOCK SUMMARY'S STATE, in words. Owner, 2026-09-24. Every state is said
   as text rather than colour alone, and none is styled as an error: "not yet
   summarised" is the drain's backlog, which is expected and slow on purpose.
   A draft names its MODEL, because "a model wrote this" without which one is
   the provenance gap schemas/content/attribution.ts closes. */
function summaryLabel(s){
  var d = s.draftedBy;
  switch (s.status) {
    case "draft":
      return { cls: "info", t: d && d.kind === "agent"
        ? (d.model === "not-disclosed" ? "agent draft (model not disclosed)" : "agent draft (model " + (d.model || "unknown") + ")")
        : "draft by " + (d ? d.id : "unknown") };
    case "confirmed": return { cls: "ok", t: "confirmed by " + (s.confirmedBy || "a person") };
    case "stale": return { cls: "warn", t: "stale: source changed" };
    case "rejected": return { cls: "warn", t: "rejected \u2014 back in the queue" };
    case "empty": return { cls: "", t: "no text to summarise" };
    case "unreadable": return { cls: "warn", t: "text unreadable" };
    default: return { cls: "", t: "not yet summarised" };
  }
}
${WITHHELD_VIEW_JS}
/* The shared edit/feedback recipe (bean v433) builds the Document panel's
   [source], [feedback] and [edit] links (bean zcak). It is NOT inlined here
   any more: every library page is a themed Jekyll page, whose head already
   loads assets/js/edit-links.js, so the inline copy was about 79 KB every
   library page downloaded and parsed twice (owner, 2026-11-14: "do lazy load
   content and libs"). withEditLinks, in DOCUMENT_VIEW_JS, waits for that copy
   and loads it itself on a host that has none. */
${DOCUMENT_VIEW_JS}
function summaryBadge(s){
  var l = summaryLabel(s);
  return '<span class="pill ' + l.cls + '">' + esc(l.t) + '</span>';
}
/* THE SUMMARY TEXT, BEHIND A DISCLOSURE -- owner, 2026-11-14: "disclosure
   agent summary even if not verified. just indicate". The cell used to carry
   the state alone, so 62 drafted summaries read as 62 identical pills. The
   pill stays as the disclosure's label, so an unconfirmed draft still says it
   is one before anyone opens it; summaryPanel inside says who drafted it and
   that no person has confirmed it. A state with no text keeps the bare pill. */
function summaryDisclosure(s){
  if (!s.text) return summaryBadge(s);
  return '<details class="sumd"><summary>' + summaryBadge(s) + '</summary>' + summaryPanel(s).replace(summaryBadge(s), '') + '</details>';
}
function summaryPanel(s){
  var why = {
    "not-summarised": "No agent has summarised this block yet. The queue is drained a few blocks at a time.",
    "empty": "The block holds no text, so there is nothing to summarise.",
    "unreadable": "The block names a text file that could not be read."
  }[s.status];
  var who = s.draftedBy
    ? "Drafted by " + s.draftedBy.kind + " " + s.draftedBy.id +
      (s.draftedBy.model === "not-disclosed" ? ", model not disclosed (recoverable from its session)" : s.draftedBy.model ? ", model " + s.draftedBy.model : "") + (s.draftedAt ? ", " + s.draftedAt : "") + ". " +
      (s.status === "confirmed" ? "Confirmed by " + (s.confirmedBy || "a person") + "."
        : s.status === "stale" ? "The block's text has changed since; this summary may no longer match it."
        : s.status === "rejected" ? "Rejected by a person: " + (s.rejectionReason || "no reason recorded") + "."
        : "Not yet confirmed by a person.")
    : "";
  return '<div class="sum">' + summaryBadge(s) +
    (s.text ? '<p>' + esc(s.text) + '</p>' : '<p>' + esc(why || "") + '</p>') +
    (who ? '<p class="note">' + esc(who) + '</p>' : '') + '</div>';
}
/* REVALIDATED, NOT REFETCHED: "no-cache" asks the server every time, as
   "no-store" did, so a page never shows a stale graph -- but an unchanged
   file comes back as a 304 rather than its whole body again (on who-iris,
   66 KB an entry on average and 2.3 MB at most). */
function fetchBlocks(id){
  return fetch(blocksHref(id), {cache: "no-cache"})
    .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
}
function loadBlocks(id, entry){
  DOC_BLOCKS = null;
  takeEarly("blocks", id, fetchBlocks)
    .then(function(d){ renderBlocks(id, d, null, entry); })
    .catch(function(e){ renderBlocks(id, null, String(e && e.message || e), entry); });
}

function setView(v){
  VIEW = v;
  $("vList").setAttribute("aria-pressed", String(v === "list"));
  $("vDesk").setAttribute("aria-pressed", String(v === "desk"));
  $("listing").hidden = v !== "list";
  $("desktop").hidden = v !== "desk";
  render();
}

/* THE ENTRY'S OWN FILES START NOW, beside the index rather than behind it.
   An entry page exists to show one document, and its id is in the page's own
   path: waiting for the whole library's index.json before asking for the
   entry's document and blocks put a full round trip, and the largest file on
   the page, in front of the thing the reader came for. The responses are
   held here and handed to loadDocument and loadBlocks when selectEntry
   (which needs the index, for the entry's row) calls them, so nothing is
   fetched twice. A path that names no entry of this library starts nothing:
   honourAddress still says "not found", from the index, as before. */
var EARLY = {};
function takeEarly(kind, id, start){
  var held = EARLY[kind];
  if (held && held.id === id) { EARLY[kind] = null; return held.p; }
  return start(id);
}
(function startEntry(){
  if (!SCOPE) return;
  var at = entryFromPath(location.pathname, LIB_ROOT);
  if (!at || at.instance !== SCOPE) return;
  /* A rejection is caught where it is TAKEN; this only stops an unhandled
     warning when it never is (an id the index turns out not to hold). */
  EARLY.blocks = { id: at.id, p: fetchBlocks(at.id) };
  EARLY.blocks.p.catch(function(){});
  EARLY.document = { id: at.id, p: fetchDocument(at.id) };
  EARLY.document.p.catch(function(){});
})();

fetch(DATA_HREF).then(function(r){
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}).then(function(data){
  G = data;
  /* A sortable number for the referenced-by column. -1 for "not scanned" so
     it sorts apart from a real zero rather than beside it. */
  G.entries.forEach(function(e){ e.refCount = e.referencedBy ? e.referencedBy.length : -1; });
  var scoped = G.entries.filter(inScope);
  var words = scoped.reduce(function(n,e){ return n + e.words; }, 0);
  $("status").textContent = (SCOPE ? SCOPE + " · " : "") + scoped.length + " entries · " +
    words.toLocaleString() + " words · " +
    scoped.reduce(function(n,e){ return n + e.sections; }, 0) + " sections";
  if (SCOPE) document.title = SCOPE + " — library";
  $("badges").innerHTML = G.queues.filter(inScope).map(function(q){
    return '<span class="badge q"><b>'+q.uningested+"</b> uningested in <code>"+esc(q.dir)+
      "</code> <span style=\\"color:var(--muted)\\">of "+q.total+"</span></span>";
  }).join("");
  /* THE SUMMARY DRAIN'S BACKLOG, for the entries this page shows. Advisory,
     like every drain here: styled as a count, never as a failure. Absent
     when the projection carries no count -- nobody counted is not zero. */
  var counted = scoped.filter(function(e){ return e.summaries; });
  if (counted.length) {
    var sb = counted.reduce(function(n,e){ return n + e.summaries.backlog; }, 0);
    var sp = counted.reduce(function(n,e){ return n + e.summaries.prose; }, 0);
    var sd = counted.reduce(function(n,e){ return n + e.summaries.draft; }, 0);
    $("badges").innerHTML += '<span class="badge"><b>' + sb + "</b> of " + sp +
      " prose block(s) not yet summarised" + (sd ? ", <b>" + sd + "</b> agent draft(s) awaiting a person" : "") + "</span>";
  }
  if (G.refScan) {
    var none = scoped.filter(function(e){ return e.refCount === 0 && e.provenance !== "catalogued"; }).length;
    $("badges").innerHTML += '<span class="badge">' +
      (none ? '<b>'+none+"</b> entr(ies) referenced by nothing" : "references scanned") +
      (G.refScan.unreadable.length
        ? ' <span class="pill warn" title="'+esc(G.refScan.unreadable.join("\\n"))+'">'+
          G.refScan.unreadable.length+" unreadable — the zeros are provisional</span>"
        : "") + "</span>";
  }
  $("q").addEventListener("input", render);
  $("vList").addEventListener("click", function(){ setView("list"); });
  $("vDesk").addEventListener("click", function(){ setView("desk"); });
  $("listing").addEventListener("click", function(e){
    var b = e.target.closest("button[data-k]");
    if (!b) return;
    var k = b.getAttribute("data-k");
    SORT = { key: k, dir: SORT.key === k ? -SORT.dir : 1 };
    renderList();
  });
  render();
  // The uploads queue has its own page (gen-uploads-viz.ts); the library page shows the corpus only (owner, 2026-11-13).
  honourAddress();
  window.addEventListener("hashchange", honourAddress);
}).catch(function(e){
  $("status").textContent = "could not load the projection: " + e.message;
  $("listing").innerHTML = '<p class="empty">The projection at <code>' + esc(DATA_HREF) + '</code> could not be read. ' +
    "That is not an empty corpus \\u2014 it is a corpus that could not be loaded, and the page says so rather than showing nothing.</p>";
});
${LANGUAGE_TOGGLE_JS}`;

/** The entry a shell is about, when it is one — its identity only, never its content. */
export interface ShellEntry {
  id: string;
  /** Href of the entry's published JSON-LD, relative to the page — the `alternate`. */
  jsonld?: string;
  /** The JSON-LD graphs of the entry's declared sub-graphs (e.g. its L1 extraction), relative to the page — bean 8pzh. */
  graphs?: { label: string; href: string }[];
  /** Every published file the page renders — {@link entrySources}. */
  sources?: SourceLink[];
  /** Set when the entry names a source file this site does not hold — {@link notHeldHtml}. */
  notHeld?: { file: string; elsewhere: { label: string; href: string }[] };
  /** The entry's catalogue record (its Dublin Core) and upstream Handle — {@link recordHtml}. */
  record?: readonly SourceLink[];
  /** The entry's title, for the page heading. */
  title?: string;
  /** Its language versions and toggle, and its summary, as HTML (`scripts/lib/library-languages.ts`). */
  versions?: string;
  summary?: string;
}

// ── WHAT A PAGE IS RENDERED FROM, LINKED ON THE PAGE (owner, 2026-10-15) ──
//
//   > graphs and subgrpahs (e.g. library) should also link to their source
//   > jslon(ld)'s as well as assets like in the library
//
// The manifest was a `<link rel="alternate">` and a `<noscript>` line, which a
// reader never sees. So each page lists, visibly, the published files it is a
// rendering of. Every href is computed from the SAME path function the writer
// below publishes to, and a file not on the site is not listed: the entry's
// source PDF, `structure.json`, `sections/` and `blocks/` JSON-LD are not
// published, and a link to them would be a 404 dressed as a source.

/** One published file a library page renders, href relative to the page. */
export interface SourceLink {
  label: string;
  href: string;
  /** What the file is, in a reader's words — e.g. `JSON-LD`, `projection (JSON)`. */
  what: string;
  /** The entry's primary asset, shown in the page's view panel — {@link viewPanelHtml}. */
  view?: ViewSource;
}

/** One layer's library, as the whole-library page lists it. */
export interface LibrarySubgraphLink {
  instance: string;
  entries: number;
  /** The layer's library page, when this handler renders one. */
  page?: string;
  /** The layer's published subgraph JSON-LD, which holds its `library` directory as a member. */
  jsonld?: string;
}

/** `abs` as an href from the page in `fromDir`. */
const hrefFrom = (fromDir: string, abs: string): string => relative(fromDir, abs).split(sep).join("/");

/** Where an entry's two projections are published — one function for the writer and the links. */
export function entryDataFiles(dataDir: string, id: string): { blocks: string; doc: string } {
  return { blocks: join(dataDir, "entries", `${id}.json`), doc: join(dataDir, "entries", `${id}.doc.json`) };
}

/**
 * A layer's subgraph JSON-LD on disk under this harness's site, or
 * `undefined` when none is published. There is no document for the library
 * alone: `gen-subgraph-jsonld.ts` frames subgraphs under the KG directories
 * only, and the library is a member (`#directory/library`) of the layer's
 * root, so the root is the graph the library page links.
 */
export function instanceSubgraphFile(harnessRoot: string, site: string, instance?: string): string | undefined {
  let dir: string;
  try {
    // Relative to the site root, so the same place is asked of a `--site` build.
    dir = relative(siteDirFor(harnessRoot), subgraphOutDir(harnessRoot));
  } catch {
    return undefined; // no `docs` directory, so nothing is framed here
  }
  const abs = instance === undefined ? join(site, dir, SUBGRAPH_INDEX_FILE) : join(site, dir, instance, SUBGRAPH_INDEX_FILE);
  // The subgraph writer publishes at the layer's output root in a composed
  // checkout (bean sm8r): ask there, and return the site address a link uses.
  return existsSync(overlayPath(abs)) ? abs : undefined;
}

/**
 * One entry's own subgraph JSON-LD (cat-harness#180): since library entries
 * are framed, `library/<doc>/` is a subgraph of its layer's tree, at the
 * entry's path relative to its layer. `undefined` when it is not on disk
 * (subgraphs are built before this writer, and not on every run).
 */
export function entrySubgraphFile(harnessRoot: string, site: string, instance: string, entryAbs: string): string | undefined {
  const inst = findInstanceRoot(entryAbs);
  if (inst === undefined) return undefined;
  const base = instanceSubgraphFile(harnessRoot, site, instance);
  if (base === undefined) return undefined;
  const abs = join(dirname(base), relative(inst, entryAbs), SUBGRAPH_INDEX_FILE);
  return existsSync(abs) ? abs : undefined;
}

/**
 * The layer roots a site COMPOSES — owner, 2026-10-15: *"a harness should
 * combine it libray/ (or whatever) sites of it and all its depndencies"*.
 * When the checkout's root declares a layer (a per-repository site such
 * as a folio), that layer and its transitive `needs` (`declarationChain`);
 * when it declares none (a hub index), `undefined`: every layer listed.
 */
export function composedInstanceRoots(repoRoot: string): Set<string> | undefined {
  let name: string | undefined;
  try {
    name = readDeclaration(repoRoot)?.name;
  } catch {
    name = undefined; // unreadable: check:declaration-filename's finding; compose everything
  }
  if (name === undefined) return undefined;
  return new Set(declarationChain(repoRoot).map((c) => resolve(c.root)));
}

/** Whether `repoRel` (a path in the checkout) belongs to a layer the site composes. */
export function inComposition(scope: ReadonlySet<string> | undefined, repoRoot: string, repoRel: string): boolean {
  if (scope === undefined) return true;
  const inst = findInstanceRoot(join(repoRoot, repoRel));
  return inst !== undefined && scope.has(resolve(inst));
}

/**
 * The files an entry page renders: its manifest, the files of its declared
 * sub-graphs, its two projections and its avatar — each at the path the
 * writer publishes it to (`libraryAssetSitePath`, `entryGraphSitePath`,
 * {@link entryDataFiles}, `avatarCopies`).
 */
export function entrySources(
  o: {
    site: string;
    dataDir: string;
    /** The entry page's directory — every href is relative to it. */
    shellDir: string;
    instance: string;
    entry: Pick<LibraryEntry, "id" | "avatar">;
    /** Whether the manifest is published — it is copied only when the source has one. */
    manifest: boolean;
    /** The sub-graph files published for it (`entryGraphFiles`; none for a withheld entry). */
    files: readonly EntryGraphFile[];
    /** The source file and the KG files in the repository that holds the entry (`entryRepoLinks`). */
    repo?: readonly RepoLink[];
    /** The entry's own subgraph index ({@link entrySubgraphFile}), when published. */
    subgraph?: string;
  },
): SourceLink[] {
  const { site, shellDir, instance, entry: e } = o;
  const at = (sitePath: string): string => hrefFrom(shellDir, join(site, sitePath));
  const data = entryDataFiles(o.dataDir, e.id);
  return [
    ...(o.manifest ? [{ label: "manifest.jsonld", href: at(libraryAssetSitePath(instance, e.id)), what: "the entry's JSON-LD" }] : []),
    ...(o.subgraph ? [{ label: SUBGRAPH_INDEX_FILE, href: hrefFrom(shellDir, o.subgraph), what: "the entry's subgraph (JSON-LD)" }] : []),
    ...o.files.map((f) => ({
      label: f.rel,
      href: at(entryGraphSitePath(instance, e.id, f.rel)),
      what: f.jsonld ? `${f.kind} sub-graph (JSON-LD)` : `${f.kind} sub-graph file`,
    })),
    ...(o.repo ?? []),
    { label: basename(data.doc), href: hrefFrom(shellDir, data.doc), what: "document projection (JSON)" },
    { label: basename(data.blocks), href: hrefFrom(shellDir, data.blocks), what: "block projection (JSON)" },
    ...(e.avatar ? [{ label: basename(e.avatar.href), href: at(e.avatar.href.slice(1)), what: `avatar (${e.avatar.source})` }] : []),
  ];
}

/** The files a layer's page renders: the projection, its subgraph JSON-LD, and each entry's manifest. */
export function instanceSources(
  o: { pageDir: string; dataFile: string; subgraph?: string; manifests: readonly { id: string; abs: string }[] },
): SourceLink[] {
  return [
    { label: basename(o.dataFile), href: hrefFrom(o.pageDir, o.dataFile), what: "library projection (JSON)" },
    ...(o.subgraph ? [{ label: SUBGRAPH_INDEX_FILE, href: hrefFrom(o.pageDir, o.subgraph), what: "the instance's subgraph (JSON-LD)" }] : []),
    ...o.manifests.map((m) => ({ label: `source/${m.id}.jsonld`, href: hrefFrom(o.pageDir, m.abs), what: "entry JSON-LD" })),
  ];
}

/**
 * Every layer in the CHECKOUT that declares a library, with its page and
 * its subgraph JSON-LD. Owner, 2026-10-15: the whole-library page *"should
 * also link to the library sub-graphs from the other harnesses"*, and *"a
 * harness should combine it libray/ (or whatever) sites of it and all its
 * depndencies"*. So the set is read from the checkout's declarations
 * (`checkoutDirectoriesForGraph`), never listed: on folio-assistant it is every
 * layer, on one repository's site its own and its mounted `needs`. A
 * layer with no page here (no entries, no queue) is still listed.
 */
export function librarySubgraphs(
  o: {
    harnessRoot: string;
    repoRoot: string;
    site: string;
    pageDir: string;
    pages: ReadonlySet<string>;
    entries: readonly { instance: string }[];
    /** {@link composedInstanceRoots}; `undefined` lists every layer. */
    scope?: ReadonlySet<string>;
  },
): LibrarySubgraphLink[] {
  const names = new Set(o.pages);
  for (const d of checkoutDirectoriesForGraph("library", o.repoRoot)) {
    if (inComposition(o.scope, o.repoRoot, relative(o.repoRoot, d))) names.add(instanceOf(d, o.repoRoot));
  }
  return [...names].sort().map((instance) => {
    const subgraph = instanceSubgraphFile(o.harnessRoot, o.site, instance);
    return {
      instance,
      entries: o.entries.filter((e) => e.instance === instance).length,
      ...(o.pages.has(instance) ? { page: `${encodeURIComponent(instance)}/` } : {}),
      ...(subgraph ? { jsonld: hrefFrom(o.pageDir, subgraph) } : {}),
    };
  });
}

/** The visible list of {@link SourceLink}s, and on the whole-library page the table of every layer's library. */
export function sourcesHtml(links: readonly SourceLink[], libraries: readonly LibrarySubgraphLink[] = []): string {
  if (links.length === 0 && libraries.length === 0) return "";
  const a = (href: string, text: string): string => `<a href="${escHtml(href)}">${escHtml(text)}</a>`;
  const table = libraries.length === 0 ? "" : `<h3 id="lib-subgraphs">Library subgraphs in this checkout</h3>
<table class="lib-subgraphs"><thead><tr><th>Instance</th><th>Entries</th><th>Library page</th><th>Subgraph JSON-LD</th></tr></thead><tbody>
${libraries
  .map((l) => `<tr><td>${escHtml(l.instance)}</td><td>${l.entries}</td><td>${l.page ? a(l.page, l.instance) : "—"}</td><td>${
    l.jsonld ? a(l.jsonld, SUBGRAPH_INDEX_FILE) : "not published"
  }</td></tr>`)
  .join("\n")}
</tbody></table>`;
  const list = links.length === 0 ? "" : `<ul>
${links.map((l) => `<li>${a(l.href, l.label)} <span class="note">${escHtml(l.what)}</span></li>`).join("\n")}
</ul>`;
  return `<section class="lib-sources" id="lib-sources">
<h2>Source JSON-LD and assets</h2>
<p class="note">The published files this page is a rendering of.</p>
${list}${table}
</section>`;
}

/**
 * THE VIEW PANEL — owner, 2026-10-16: *"library pages … should have a panel to
 * open and view item towards the top of the page. sometimes accessible at
 * bottom under sources (like PDF), but primary asset should have a view panel
 * (if that asset kind has a viewer)"*.
 *
 * The first source marked `view` is the primary asset. The panel is a closed
 * `<details>` under the page heading. A PDF is the site's shared pdf.js embed
 * (`pdf-viewer.ts` `embed`, the one WHO-IRIS item pages use), whose client
 * points the frame at the viewer only when the panel is opened, so a visitor
 * who never opens it fetches none of pdf.js. An image is a lazy `<img>`, not
 * fetched while the panel is closed. An entry with no viewable source held
 * gets no panel — its sources list already says what is published.
 */
export function viewPanelHtml(links: readonly SourceLink[]): string {
  const l = links.find((x) => x.view);
  const v = l?.view;
  if (!l || !v) return "";
  const body = v.kind === "pdf" && v.viewer
    ? pdfEmbed({ src: v.src, title: l.label, route: { viewer: v.viewer } })
    : v.kind === "image"
      ? `<img src="${escHtml(v.src)}" alt="${escHtml(l.label)}" loading="lazy">`
      : "";
  if (!body) return "";
  return `<section class="lib-view" id="lib-view">
<details>
<summary>View <strong>${escHtml(l.label)}</strong> <span class="note">${v.kind === "pdf" ? "source PDF" : "source image"}</span></summary>
${body}
</details>
</section>`;
}

/**
 * Where the view panel would be, for a source this site does not hold — owner,
 * 2026-10-16: some sources are not held for rights reasons, and the viewer may
 * not load a file from another origin (XSS). So the page says so and links
 * out, in a new tab, to wherever the entry's identifiers point
 * ({@link elsewhereLinks}); with none recorded it says only that.
 */
export function notHeldHtml(n: { file: string; elsewhere: readonly { label: string; href: string }[] }): string {
  const out = n.elsewhere.length
    ? ` Find it at ${n.elsewhere
        .map((l) => `<a href="${escHtml(l.href)}" target="_blank" rel="noopener noreferrer">${escHtml(l.label)}</a>`)
        .join(" or ")}.`
    : " No public link is recorded for it.";
  return `<section class="lib-view lib-view-absent" id="lib-view">
<p><strong>${escHtml(n.file)}</strong> is not held on this site.${out}</p>
</section>`;
}

/**
 * The entry's CATALOGUE RECORD, at the top of its page — owner, 2026-11-10:
 * library entry pages *"should have dublin core linked at top"*. The links
 * come from {@link catalogueRecordLinks}; an entry no catalogue node names
 * gets nothing here.
 */
export function recordHtml(links: readonly SourceLink[]): string {
  if (links.length === 0) return "";
  return `<section class="lib-record" id="lib-record">
<p><strong>Catalogue record:</strong> ${links
    .map((l) => `<a href="${escHtml(l.href)}"${/^https?:/.test(l.href) ? ' rel="noopener"' : ""}>${escHtml(l.label)}</a> <span class="note">${escHtml(l.what)}</span>`)
    .join(" &middot; ")}</p>
</section>`;
}

/**
 * The links {@link recordHtml} draws for one entry: its Dublin Core record on
 * the repository host, and its Handle at the global resolver. Only what the
 * catalogue node records, and only a record file that exists.
 */
export function catalogueRecordLinks(o: {
  repoRoot: string;
  checkoutRepo: string | undefined;
  catalogue?: { record?: string; handle?: string; node?: string };
  /**
   * The record's Dublin Core XML rendering on this site, page-relative. When
   * given it IS the Dublin Core link (owner, 2026-11-10: *"dublic core sould
   * be the XML"*); the GitHub JSON is the fallback for a record with none.
   */
  xmlHref?: string;
}): SourceLink[] {
  const out: SourceLink[] = [];
  const at = o.catalogue?.record ? forgeAt(o.repoRoot, o.catalogue.record, o.checkoutRepo) : undefined;
  if (o.xmlHref && o.catalogue?.record) {
    const stem = basename(o.catalogue.record).replace(/\.dc\.json$/, "");
    out.push({ label: `Dublin Core XML — ${stem}.dc.xml`, href: o.xmlHref, what: "the item's metadata record" });
  } else if (at && o.catalogue?.record) out.push({ label: `Dublin Core — ${basename(o.catalogue.record)}`, href: blobUrl(at), what: "the item's metadata record, on GitHub" });
  const node = o.catalogue?.node ? forgeAt(o.repoRoot, o.catalogue.node, o.checkoutRepo) : undefined;
  if (node && o.catalogue?.node) out.push({ label: `KG node — ${basename(o.catalogue.node)}`, href: blobUrl(node), what: "the item's catalogue node, on GitHub" });
  const h = o.catalogue?.handle;
  if (h && /^\d+(\.\d+)*\/\S+$/.test(h)) out.push({ label: `hdl:${h}`, href: `https://hdl.handle.net/${h.split("/").map(encodeURIComponent).join("/")}`, what: "the item upstream" });
  return out;
}

/**
 * The element every library page's viewer reads its identity from — the
 * `data-kg-*` attributes on `<div class="lib-page">` (issue #1830: no private
 * config block). An entry's page also declares its node there, in RDFa, with
 * a JSON-LD stub beside it.
 */
const LIBRARY_MOUNT = "lib-page";

/** An entry's class: the library's `SourceDocument`, as its manifest types it (`gen-library-jsonld.ts`). */
const ENTRY_TYPE = termCurie("SourceDocument");
const ENTRY_PREFIXES = { [ENTRY_TYPE.split(":")[0]!]: termIri("SourceDocument").slice(0, -"SourceDocument".length) };

/**
 * The skeleton {@link VIEWER_JS} fills — this head, then the view panel when
 * there is one, then {@link VIEWER_BODY}: the same on the handler's page, a
 * layer's page and every entry page, since the script decides from the
 * config and the page's own path what to draw into it.
 */
const VIEWER_HEAD = `<div class="lib-head">
  <h1 id="lib-title">Library</h1>
  <p class="empty" id="status" style="padding:0">loading…</p>
  <div class="badges" id="badges"></div>
</div>`;

/** The rest of the skeleton, below the head and the view panel. */
const VIEWER_BODY = `<div class="toolbar">
  <input id="q" type="search" placeholder="Search entries…" aria-label="Search entries">
  <span class="seg" role="group" aria-label="View">
    <button type="button" id="vList" aria-pressed="true">Listing</button>
    <button type="button" id="vDesk" aria-pressed="false">Desktop</button>
  </span>
</div>
<div class="lib-main">
  <section id="listing" class="wrap"></section>
  <section id="desktop" hidden></section>
  <section id="document" class="wrap" hidden aria-live="polite"></section>
  <section id="blocks" class="wrap" hidden aria-live="polite"></section>
</div>`;

/**
 * An ENTRY page's body — owner, 2026-11-10: the entry's
 * summary, sections and keywords were drawn BELOW the whole library's
 * listing, so a reader arriving at one document saw a table of every other
 * one first. Here the document comes first and the library listing folds
 * away under it. Same ids as {@link VIEWER_BODY}, so the script is unchanged.
 */
const ENTRY_BODY = `<div class="lib-main">
  <section id="document" class="wrap" hidden aria-live="polite"></section>
  <section id="blocks" class="wrap" hidden aria-live="polite"></section>
</div>
<details class="lib-all">
<summary>The whole library</summary>
${VIEWER_BODY.replace(/\n\s*<section id="(?:document|blocks)"[^\n]*<\/section>/g, "")}
</details>`;

/**
 * THE ENTRY'S OWN LISTING ROW, first thing under its catalogue record —
 * owner, 2026-11-14: "i wanted this at the top of the page". `renderEntryRow`
 * fills it with the row the whole library draws for this entry.
 */
const ENTRY_ROW = `<section id="entry-row" class="wrap" hidden></section>\n`;

/** The shared stylesheet and script sit beside the projection. */
const assetsOf = (dataHref: string): string => dataHref.slice(0, dataHref.lastIndexOf("/") + 1);

/** What one library page is: its title, its identity, and what it says without script. */
interface LibraryPage {
  /** The page title, plain text — the layout's `<title>`. */
  title: string;
  /** The projection's href, relative to the page. The shared assets sit beside it. */
  dataHref: string;
  /** The page's identity, read by {@link VIEWER_JS} from `data-kg-*`. Never an entry's content. */
  config: { data: string; scope: string; libRoot: string; entry?: string };
  /** The entry this page renders, declared in RDFa and a JSON-LD stub. Absent on a library's own page. */
  node?: PageNode;
  /** The `<noscript>` content, as HTML; the caller escapes what it interpolates. */
  noscript: string;
  /** The entry's published JSON-LD, relative to the page — its `alternate`. */
  alternate?: string;
  /** Keep the page out of the site search — set on the per-entry pages. */
  searchExclude?: boolean;
  /** The visible source list, as HTML — {@link sourcesHtml}. */
  sources?: string;
  /** The primary asset's view panel, as HTML — {@link viewPanelHtml}. Drawn under the head. */
  view?: string;
  /** The entry's catalogue record line, as HTML — {@link recordHtml}. Drawn right under the head. */
  record?: string;
  /** Set on an entry page: its title for the heading, and {@link ENTRY_BODY} in place of {@link VIEWER_BODY}. */
  entryTitle?: string;
  /** The entry's language versions and toggle, as HTML — `versionsHtml`. */
  versions?: string;
  /** The entry's summary, as HTML — `summaryHtml`. */
  summary?: string;
}

/**
 * Wrap a library page as a THEMED Jekyll page (2026-10-07).
 *
 * Every page here was a standalone `<!doctype html>` document, so the library
 * was a family on the site without the top band — search, Folio, language —
 * which `docs-ui.js` builds and `_includes/head_custom.html` delivers only to
 * pages on the theme's `default` layout. `gen-auto-docs.ts` `themedPage()` is
 * the precedent and this is its shape: front matter with a quoted title and
 * `nav_exclude`, a generated-by note, then a Liquid-raw body.
 *
 * - **No rail and no folio mount.** The theme's sidebar is the navigation,
 *   and the layout loads `docs-ui.js` and `docs-ui.css` on every page, so the
 *   mount fragment would load them a second time. `check:folio-mount` counts
 *   a page on the layout as mounted for exactly that reason.
 * - **The body is LIQUID-RAW**, through the shared `lib/themed-page.ts`.
 * - **The `alternate` is front matter** (`alternate_jsonld`), because the page
 *   has no head of its own: `head_custom.html` writes the link from it. It is
 *   relative to the page, as it was in the standalone head, and the page's
 *   path is unchanged, so it resolves to the same file.
 * - The shared stylesheet is LINKED from the body (a `stylesheet` link is
 *   allowed there) and scoped to `.lib-page`; `data-fa-no-filter` keeps the
 *   site-wide table filter off tables this viewer already searches.
 */
function libraryPageHtml(p: LibraryPage): string {
  const assets = assetsOf(p.dataHref);
  const attrs = Object.entries({ data: p.config.data, scope: p.config.scope, "lib-root": p.config.libRoot, entry: p.config.entry })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` data-kg-${k}="${escHtml(v!)}"`)
    .join("");
  const decl = p.node ? themedNodeDeclaration(p.node, ENTRY_PREFIXES) : undefined;
  return themedPage({
    title: p.title,
    generator: "cat-harness-tools/scripts/gen-library-viz.ts",
    command: "bun run library:viz",
    frontMatter: {
      search_exclude: p.searchExclude ? true : undefined,
      alternate_jsonld: p.alternate,
    },
    body: `<link rel="stylesheet" href="${escHtml(assets)}viewer.css">
<div class="${LIBRARY_MOUNT}" data-fa-no-filter${decl?.attrs ?? ""}${attrs}>
${decl ? `${decl.stub}\n` : ""}${p.entryTitle === undefined ? VIEWER_HEAD : VIEWER_HEAD.replace('<h1 id="lib-title">Library</h1>', `<h1 id="lib-title">${escHtml(p.entryTitle)}</h1>`)}
${p.record ? `${p.record}\n` : ""}${p.entryTitle === undefined ? "" : ENTRY_ROW}${p.versions ? `${p.versions}\n` : ""}${p.summary ? `${p.summary}\n` : ""}${p.view ? `${p.view}\n` : ""}${p.entryTitle === undefined ? VIEWER_BODY : ENTRY_BODY}
${p.sources ?? ""}
</div>
<noscript>${p.noscript}</noscript>
<script src="${escHtml(assets)}viewer.js"></script>`,
  });
}

/**
 * A library page that is NOT about one entry — the handler's whole view or a
 * layer's library: a THIN SHELL — owner, 2026-10-02, #1881: *"each
 * link/page needs to be materialized on the CDN (gh-pagees), just load the
 * content from the KG json(ld) assets already published"*.
 *
 * What differs between these pages is the identity in the config block — the
 * projection's href, the scope, the library root. Styles and script are the
 * shared assets {@link VIEWER_CSS} and {@link VIEWER_JS}, found beside the
 * projection. Nothing about any entry's content is written here; the script
 * loads it. A themed page — {@link libraryPageHtml}.
 *
 * @param libRoot  the library root relative to this page: `./` or `../`
 */
export function viewerHtml(
  dataHref: string,
  scope = "",
  libRoot?: string,
  sources: { links?: readonly SourceLink[]; libraries?: readonly LibrarySubgraphLink[] } = {},
): string {
  return libraryPageHtml({
    sources: sourcesHtml(sources.links ?? [], sources.libraries ?? []),
    title: scope ? `${scope} — library` : "Library",
    dataHref,
    config: { data: dataHref, scope, libRoot: libRoot ?? (scope ? "../" : "./") },
    noscript: `<p class="note">This page loads its entries from <a href="${escHtml(dataHref)}">the library projection</a>; it needs JavaScript to draw them.</p>`,
  });
}

/**
 * One ENTRY's page, at `<library>/<instance>/<id>/` (#1881, #1899).
 *
 * The same skeleton ({@link VIEWER_BODY}) the layer page draws into, with
 * the entry's identity in the config; the `<noscript>` names both sources the
 * page loads — the library projection and the entry's JSON-LD — and the
 * JSON-LD is the page's `alternate`. Kept out of the site search: seventy
 * pages with one skeleton would be seventy identical results.
 *
 * @param libRoot  the library root relative to this page: `../../`
 */
export function entryPageHtml(dataHref: string, scope: string, libRoot: string, entry: ShellEntry): string {
  return libraryPageHtml({
    title: `${entry.id} — ${scope} library`,
    dataHref,
    config: { data: dataHref, scope, libRoot, entry: entry.id },
    // The entry's IRI is its manifest's (`library-iri.ts`), declared only when the manifest is published.
    ...(entry.jsonld ? { node: { iri: libraryAssetIri(scope, entry.id), types: [ENTRY_TYPE] } } : {}),
    noscript: `<p class="note">This page loads its entries from <a href="${escHtml(dataHref)}">the library projection</a>${
      entry.jsonld ? ` and this entry from <a href="${escHtml(entry.jsonld)}">its JSON-LD</a>` : ""
    }; it needs JavaScript to draw them.</p>${
      entry.graphs?.length
        ? `<p class="note">Graphs read out of this entry: ${entry.graphs
            .map((g) => `<a href="${escHtml(g.href)}">${escHtml(g.label)}</a>`)
            .join(", ")}.</p>`
        : ""
    }`,
    ...(entry.jsonld ? { alternate: entry.jsonld } : {}),
    sources: sourcesHtml(entry.sources ?? []),
    view: viewPanelHtml(entry.sources ?? []) || (entry.notHeld ? notHeldHtml(entry.notHeld) : ""),
    record: recordHtml(entry.record ?? []),
    entryTitle: entry.title ?? entry.id,
    ...(entry.versions ? { versions: entry.versions } : {}),
    ...(entry.summary ? { summary: entry.summary } : {}),
    searchExclude: true,
  });
}

/**
 * A library page's identity, read from its config block — or `undefined` when
 * it carries none. The page names itself there (#1881), which is what lets a
 * later run prune its own stale output and nothing else.
 */
export function libraryConfigOf(content: string): { data?: unknown; scope?: unknown; libRoot?: unknown; entry?: unknown } | undefined {
  const tag = new RegExp(`<div class="${LIBRARY_MOUNT}"[^>]*>`).exec(content)?.[0];
  if (tag === undefined) return undefined;
  const get = (k: string): string | undefined => {
    const v = new RegExp(`\\sdata-kg-${k}="([^"]*)"`).exec(tag)?.[1];
    return v === undefined ? undefined : v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  };
  const data = get("data");
  if (data === undefined) return undefined;
  const out: { data?: unknown; scope?: unknown; libRoot?: unknown; entry?: unknown } = { data };
  const scope = get("scope");
  const libRoot = get("lib-root");
  const entry = get("entry");
  if (scope !== undefined) out.scope = scope;
  if (libRoot !== undefined) out.libRoot = libRoot;
  if (entry !== undefined) out.entry = entry;
  return out;
}

/**
 * `orphanSubjectPages`' ownership test for a SUBJECT page: it names the
 * directory it sits in as its scope, and no entry. The library viewer's form of
 * `declaresItsOwnDirectory`, which reads a `var SCOPE` line this page no longer
 * carries now that its script is a shared asset.
 */
export const isSubjectShell = (content: string, name: string): boolean => {
  const c = libraryConfigOf(content);
  return c !== undefined && c.scope === name && c.entry === undefined;
};

/** The same, for an ENTRY page at `<subject>/<name>/`: scope and entry both match. */
export function isEntryShellFor(instance: string): (content: string, name: string) => boolean {
  return (content, name) => {
    const c = libraryConfigOf(content);
    return c !== undefined && c.scope === instance && c.entry === name;
  };
}

/** Every file under `root` (recursively) that is not in `wanted` — absolute paths, sorted. */
export function orphanFiles(root: string, wanted: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const f of existsSync(d) ? readdirSync(d, { withFileTypes: true }) : []) {
      const abs = join(d, f.name);
      if (f.isDirectory()) walk(abs);
      else if (!wanted.has(abs)) out.push(abs);
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Every layer whose declaration publishes a renderable directory at its
 * ROOT route (`instanceRoot: true`), by name → its site-root path `/<name>/`.
 * The route rule is `mount-instance-docs.ts` `withRoutes`: a declared root
 * answers at `/<instance>/`.
 */
export function instanceRootRoutes(repoRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const inst of layerRootsIn(repoRoot)) {
    let decl;
    try {
      decl = readDeclaration(inst);
    } catch {
      continue; // an unreadable declaration is check:declaration-filename's to report
    }
    const name = decl?.name;
    if (!name) continue;
    const rooted = (decl?.directories ?? []).some((d) => (d as { instanceRoot?: boolean }).instanceRoot === true);
    if (rooted) out.set(name, `/${name}/`);
  }
  return out;
}

/**
 * An entry's `view` — the site-root path of the page that RENDERS it.
 *
 * Owner, 2026-10-02 (paraphrased): clicking a referenced layer's slug
 * should open that layer's visualiser. Two cases:
 *
 * - a REFERENCED entry whose record links a `site_path` that is another
 *   layer's DECLARED root route (`instanceRootRoutes`) is rendered there —
 *   a DAK IG's viewer at its `/<instance>/` root. The link chooses the
 *   candidate; the declaration is what makes it a visualiser rather than a
 *   page that merely exists, so a link to anything else is not taken;
 * - every other entry is rendered by this viewer, at its own entry page.
 *
 * Generated into the projection, never stored in the asset.
 */
export function entryView(
  e: { links?: { href: string }[] },
  roots: ReadonlyMap<string, string>,
  entryPage: string,
): string {
  const declared = new Set(roots.values());
  const hit = (e.links ?? []).map((l) => l.href).find((h) => declared.has(h));
  return hit ?? `/${entryPage}/`;
}

/**
 * Each entry's block file, as the viewer publishes it — and its summary
 * counts, set on the entry because the index carries them.
 *
 * A withheld entry (bean `cw35`) publishes no verbatim text: its blocks are
 * read with `verbatim: false`. A function rather than a loop in the writer so
 * a test can run a DECLARED fixture through the very derivation the writer
 * uses (owner ruling 2026-10-09, folio-assistant#2521 option b): the real
 * withheld list is empty by the owner's choice, and a check over the committed
 * data alone then proves nothing.
 */
export function entryBlocks(g: LibraryGraph, repoRoot: string): Map<string, LibraryBlock[]> {
  const blocksOf = new Map<string, LibraryBlock[]>();
  for (const e of g.entries) {
    const blocks = readEntryBlocks(join(repoRoot, e.dir), { verbatim: !e.withheld });
    blocksOf.set(e.id, blocks);
    e.summaries = tally(blocks.flatMap((b) => (b.summary ? [b.summary] : [])));
  }
  return blocksOf;
}

/**
 * Every avatar copy the writer makes, `site path -> source path`, both
 * absolute. An entry without an avatar — a withheld one has none
 * (`library-graph.ts`) — gets no copy, and the orphan sweep removes any copy
 * left from before it was withheld. Exported for the same fixture test as
 * {@link entryBlocks}.
 */
export function avatarCopies(g: LibraryGraph, site: string, repoRoot: string): Map<string, string> {
  return new Map(
    g.entries.flatMap((e) => (e.avatar ? [[join(site, e.avatar.href.slice(1)), join(repoRoot, e.avatar.src)] as const] : [])),
  );
}

let stale = 0;
/**
 * The one writer, for pages and data alike: it writes what it is given.
 *
 * The pages went through a second emitter that injected the harness rail
 * (bean `edx7`) until 2026-10-07. They are THEMED pages now
 * ({@link libraryPageHtml}), and the theme's sidebar is their navigation.
 */
const emitAny = makeEmit({ check, onStale: () => { stale++; } });
/** `emitAny`, but a `--check` skips output the caller does not commit (see {@link mineToCheck}). */
const emit = (path: string, content: string): void => {
  if (check && !mineToCheck(path)) return;
  emitAny(path, content);
};

/** `emit` for a binary file: same check-or-write contract, compared byte for byte. */
function emitBytes(path: string, content: Buffer): void {
  if (check) {
    if (!mineToCheck(path)) return;
    const at = readPathAt(CHECKOUT, path);
    if (existsSync(at) && readFileSync(at).equals(content)) return;
    console.error(`  ✗ ${path} ${existsSync(at) ? "is stale" : "is missing"}`);
    stale++;
    return;
  }
  const to = writePathAt(CHECKOUT, path);
  if (existsSync(to) && readFileSync(to).equals(content)) return;
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, content);
  console.log(`  ✓ ${to}`);
}

/**
 * Avatar copies under `avatarRoot/<instance>/` that no entry names — this
 * generator's own stale output (bean `cw35`). `wanted` holds absolute paths.
 * The directory is written by this generator alone, which is what makes a
 * file in it that nothing names safe to call an orphan.
 */
export function orphanAvatars(avatarRoot: string, wanted: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const inst of existsSync(avatarRoot) ? readdirSync(avatarRoot) : []) {
    const d = join(avatarRoot, inst);
    for (const f of existsSync(d) ? readdirSync(d) : []) {
      const abs = join(d, f);
      if (!wanted.has(abs)) out.push(abs);
    }
  }
  return out.sort();
}

if (import.meta.main) {
  const repoRoot = repoRootFor(ROOT);
  const g = readLibraryGraph([ROOT, repoRoot]);
  if (g === null) {
    console.log("  · no library or uploads directory is declared — nothing to publish");
    process.exit(0);
  }
  // A per-repository site composes its own layer and its `needs`, not
  // every layer its checkout happens to mount (`composedInstanceRoots`).
  const scope = composedInstanceRoots(repoRoot);
  g.entries = g.entries.filter((e) => inComposition(scope, repoRoot, e.dir));
  g.queues = g.queues.filter((q) => inComposition(scope, repoRoot, q.dir));
  g.uploads = g.uploads.filter((u) => inComposition(scope, repoRoot, u.path));
  // A scoped site (`--scope`, owner 2026-11-08 Q-SZ-2 "B") publishes its scope's
  // entries only; every other layer's library stays on that layer's own site.
  const siteOnly = siteScope();
  if (siteOnly !== undefined) {
    const before = g.entries.length;
    g.entries = g.entries.filter((e) => siteInScope(siteOnly, e.instance));
    g.queues = g.queues.filter((q) => siteInScope(siteOnly, q.instance));
    g.uploads = g.uploads.filter((u) => siteInScope(siteOnly, u.instance));
    console.log(`  · scope ${scopeArg(siteOnly)}: ${g.entries.length} of ${before} entr(ies)`);
  }
  // Items the catalogue holds BY REFERENCE get an entry and a page too
  // (owner, 2026-11-10: a referenced item's link goes to "our ingested record
  // in linbrary and associated KG", not IRIS). Pages only — see
  // `referencedCatalogueEntries` for why the graph itself leaves them out.
  {
    const taken = new Set(g.entries.map((e) => `${e.instance}/${e.id}`));
    const extra = referencedCatalogueEntries([ROOT, repoRoot], repoRoot, taken).filter(
      (e) => inComposition(scope, repoRoot, e.dir) && (siteOnly === undefined || siteInScope(siteOnly, e.instance)),
    );
    if (extra.length) console.log(`  · ${extra.length} entr(ies) catalogued by reference`);
    g.entries.push(...extra);
  }
  const site = siteTarget(join(ROOT, siteDirFor(ROOT)));
  // ── Who references a slug — bean `jbx2`'s third ask ───────────────────
  //
  // The sources are DERIVED: every layer's own declaration, every
  // directory it names, labelled by that directory's declared graph typology. So
  // `catalogue` and `voices` appear because they are declared and carry the
  // field, not because this file lists them — and a new kind that starts
  // referencing slugs shows up the day it is declared.
  //
  // Each layer's SITE directory is skipped: it holds published copies of
  // the catalogue and of this projection, so scanning it would count the page
  // that displays a reference as a reference.
  {
    const repo = repoRootFor(ROOT);
    const sources: RefSource[] = [];
    for (const inst of layerRootsIn(repo)) {
      const decl = readDeclaration(inst);
      if (!decl) continue;
      const siteDir = join(inst, siteDirFor(inst));
      for (const d of decl.directories ?? []) {
        const dir = join(inst, d.path);
        if (dir === siteDir || dir.startsWith(siteDir + "/")) continue;
        if (dir === site || dir.startsWith(site + "/")) continue; // a `--site` target holds published copies too
        for (const kind of d.graphTypologies ?? []) sources.push({ kind, instance: decl.name ?? basename(inst), dir });
      }
    }
    const scan = scanLibraryRefs(sources, repo);
    for (const e of g.entries) e.referencedBy = scan.bySlug[e.id] ?? [];
    // `scan.filesRead` is NOT carried into the projection — bean `65oe`. It is
    // a count of files on disk, so it differs between CI and a local checkout
    // and made this committed artefact unable to agree with itself. It is
    // reported on the line below instead, where a statistic about a run
    // belongs.
    g.refScan = { unreadable: scan.unreadable };
    // An entry catalogued by reference is not an L1 source, so nothing is
    // expected to cite it: it is not counted as an orphan.
    const orphans = g.entries.filter((e) => e.provenance !== "catalogued" && (e.referencedBy?.length ?? 0) === 0).map((e) => e.id);
    console.log(
      `  · references: ${scan.filesRead} json file(s) read, ` +
        `${Object.keys(scan.bySlug).length} slug(s) referenced, ` +
        `${orphans.length} entr(ies) referenced by nothing` +
        (orphans.length > 0 ? ` (${orphans.join(", ")})` : "") +
        (scan.unreadable.length > 0 ? ` — ${scan.unreadable.length} file(s) UNREADABLE, so the zeros are provisional` : ""),
    );
  }

  // The published segment is the DECLARED directory's own name — the same
  // rule `gen-schema-viz.ts` follows, and for the same reason: writing
  // "library" here would be a second answer to a question `harness.json`
  // already answers, and `check:declared-paths` would be right to say so.
  const libDirs = corpusDirectoriesForGraph(ROOT, "library");
  // The TOP-LEVEL declared directory: a corpus declared from within a named
  // sub-graph (cat-harness's `library/graph.json` → `corpus/`) publishes
  // under the sub-graph's name, which is what `harness.json` declares and
  // what its `builtAtPublish` (`docs/assets/library/`) and the slice read.
  const topOf = (d: string): string => {
    const first = relative(ROOT, d).split(sep)[0]!;
    return first === "" || first === ".." ? basename(d) : first;
  };
  const seg = libDirs.length > 0 ? topOf(libDirs[0]!) : null;
  if (seg === null) {
    // No library directory declared by this layer — the uploads half alone
    // has nowhere to hang, and composing a name would be exactly the literal
    // the rule forbids.
    console.log("  · no library directory declared by this instance — nothing to publish");
    process.exit(0);
  }
  // ── Rule 1: a HANDLER rendering a kind's assets ────────────────────────
  //
  // Owner, 2026-09-20, reducing three cases to two:
  //
  //   (paraphrased) two rules, not three: one is cat-harness handling the
  //   library/ dir, which holds a content layer's assets; the other is that
  //   layer's own handler, which replicates the source website.
  //
  // So the form is `<base>/<handler>/<kind>/<optional subject>` — which is the
  // owner's own first example, `<base>/cat-harness/docs/<instance>/`. The
  // handler is THIS layer (the machinery), the kind names what it renders,
  // and the subject scopes it to one layer's assets.
  //
  // **A subject page must NOT be published at `<base>/<subject>/<kind>/`.**
  // That is rule 2's namespace — `<base>/<instance>/` is the IRIS replica presenting
  // ITSELF, mocking the IRIS website — and a viewer parked there would squat
  // on the layer's own site. An earlier draft of this file was about to do
  // exactly that.
  const handler = readDeclaration(ROOT)?.name;
  if (!handler) {
    console.log("  · this instance declares no name — no handler segment to publish under");
    process.exit(0);
  }

  // THE ROUTE IS DECLARED (owner, 2026-10-09): `<locale>/<harness>/<id>/`, from the
  // visualiser this harness declares `renderedBy` this Tool — never composed
  // here from the directory's name.
  const route = declaredPageRoute(ROOT, VIEWER_TOOL);
  if (route === undefined) {
    console.log(`  · no visualiser declared rendered by ${VIEWER_TOOL} — nothing to publish`);
    process.exit(0);
  }
  const { pageDir, dataDir, dataHref } = viewerPlacement(site, route, seg);

  // NO FOLIO MOUNT since 2026-10-07: the pages are on the theme's layout,
  // which loads docs-ui.js and docs-ui.css itself (`libraryPageHtml`).

  // One page per SUBJECT — the layers whose assets this handler renders.
  // Read from the entries and the queues rather than from the directory list,
  // so a declared-but-empty directory gets no page claiming to show it.
  const subjects = [...new Set([
    ...g.entries.map((e) => e.instance),
    ...g.queues.map((q) => q.instance),
  ])].sort();

  /**
   * Each page's tile count, keyed by the DECLARED directory id — #863.
   *
   * Matched on the page rather than composed from the subject name. The
   * declaration already names the exact page each directory is visualised by,
   * and this run already knows the exact page it is about to write, so the
   * match is an identity rather than a heuristic. `directoryByVisualisationRef`
   * carries the corpus that rules composition out.
   *
   * Counted FOR THE PAGE, which is the whole correction: the `library`
   * directory's page is the cat-harness-scoped one, so its count is
   * cat-harness's entries — zero — and not the eight entries the graph holds
   * across every layer.
   */
  // THE LANDING HARNESS'S directories only, because those are the ones that
  // produce tiles (`tileDirectories`, the list `sync-docs-harness.ts` hands
  // `graphTiles`; #931: reading `ROOT`'s own declaration keyed every count by
  // a cat-harness id once the landing moved to the core content layer). Scanning every layer was the first draft and it was
  // wrong in a way worth recording, because it looked more thorough:
  //
  // a page is NOT uniquely owned by one directory id. The page at
  // `.../library/agent-skills/` is `agent-skills-library` to this layer and
  // plain `library` to the agent-skills layer, which declares its own view
  // of it. Scanning both meant the first-wins rule picked an id that is not a
  // tile here, so `agent-skills-library` silently lost its badge while
  // `uploads` gained a count over the wrong page entirely.
  //
  // The rule that falls out: look the ref up in the SAME list the tiles came
  // from, or the ids do not correspond to tiles at all.
  const byRef = directoryByVisualisationRef(tileDirectories(REPO_ROOT, ROOT));
  const refOf = (dirPath: string): string =>
    relative(REPO_ROOT, join(viewerPlacement(site, dirPath, seg).pageDir, "index.html"))
      .split(sep)
      .join("/");
  const scoped: Record<string, readonly [number, string]> = {};
  // The unit is pluralised HERE because `tile-count.ts` puts pluralisation on
  // the declarer: only it knows whether its unit pluralises regularly, and
  // `entry`/`entries` does not. A tile reading "1 entries" is a small thing
  // that makes a careful reader trust the number less.
  const entries = (n: number): readonly [number, string] =>
    [n, n === 1 ? "entry" : "entries"];
  // A tile's ref is the page where it IS (`existingPageDir`): under the
  // localised route once this has written there, but at the address before
  // the locale segment while only a committed copy sits there. Either is the
  // same page, so either finds its directory, and the counts do not depend on
  // whether this is the first run since the move.
  const oldRoute = declaredRoute(ROOT, VIEWER_TOOL)!;
  const idOf = (sub: string): string | undefined => byRef.get(refOf(`${route}${sub}`)) ?? byRef.get(refOf(`${oldRoute}${sub}`));
  const wholeId = idOf("");
  if (wholeId !== undefined) scoped[wholeId] = entries(g.entries.length);
  for (const subject of subjects) {
    const id = idOf(`/${subject}`);
    if (id === undefined) continue;
    scoped[id] = entries(g.entries.filter((e) => e.instance === subject).length);
  }

  // Each entry's blocks are read ONCE, before the index is written, because
  // the index now carries the summary drain's counts (owner, 2026-09-24:
  // "slowly drain") and those are a fact about the blocks. The per-entry
  // files below reuse the same reading, so the count on the index and the
  // rows a reader opens cannot disagree.
  const blocksOf = entryBlocks(g, repoRoot);

  // ── EACH ENTRY'S RENDERING, DERIVED (owner, 2026-10-02, #1881) ────────
  //
  // `view` is where the entry is SHOWN — written here, into this generated
  // index, and never into the asset ("asset doesnt know about its
  // renderings"). See `entryView` for the rule.
  const roots = instanceRootRoutes(repoRoot);
  // The checkout's own repository, for a path no mount covers.
  const checkoutRepo = repoOf(detectRepoUrl(repoRoot), "") || LINK_REPO;
  for (const e of g.entries) {
    e.view = entryView(e, roots, relative(site, join(pageDir, e.instance, e.id)).split(sep).join("/"));
    // The same test the entry page's view panel passes (`entryRepoLinks`): a
    // held, published source whose kind has a viewer.
    const kind = viewableOf(repoRoot, e, g.uploads, checkoutRepo);
    if (kind) e.viewable = kind;
  }
  // Each entry's title language, and its held editions' titles (listingTitles).
  for (const subject of new Set(g.entries.map((e) => e.instance))) {
    const mine = g.entries.filter((e) => e.instance === subject);
    const titled = listingTitles(mine, entryLanguages(
      mine.map((e) => ({ id: e.id, ...(e.catalogue?.node ? { node: join(repoRoot, e.catalogue.node) } : {}) })),
      new Set(mine.map((e) => e.id)),
    ));
    for (const e of mine) Object.assign(e, titled.get(e.id));
  }

  emit(join(dataDir, "index.json"), JSON.stringify(projection(g, scoped), null, 2) + "\n");

  // ── PER-ENTRY BLOCK GRAPHS (bean `7nvr`) ──────────────────────────────
  //
  // One file per entry, fetched only when a reader opens that entry.
  //
  // NOT folded into `index.json`, and the numbers are the argument: the corpus
  // holds 1715 blocks over roughly a megabyte of JSON-LD, against a 44 KB
  // index. Inlining them would multiply the cost of the page that answers
  // "what is in here" by twenty-five, to serve the question "what is in THIS
  // one" — which a reader asks about one entry at a time, if at all.
  //
  // The library's block JSON-LD is not published to the site, so the viewer
  // cannot simply fetch the source; a projection is what it reads. (Each
  // entry's MANIFEST is published since #1881 — see the entry pages below —
  // as the `alternate` of the entry's own IRI, not as the viewer's input.)
  // ── PER-ENTRY DOCUMENT VIEWS (issue #2302, bean `turh`) ──────────────
  //
  // The browsable document — TOC, pages with their printed labels, figures
  // and tables, sections with a summary or an extract, the document checks —
  // read from the INGESTION SCHEMA (`pdf-structure/v1`), so every library
  // entry of every layer gets it. Written for every entry: one with no
  // structure.json gets `{absent: true}`, a determined answer rather than a
  // 404 the viewer would have to tell apart from a failure.
  // The default variant of the derived keywords graph (cat-harness#1144),
  // computed here rather than read from the site, so the panel does not
  // depend on `library:keywords` having run first.
  const kwVariant = KEYWORD_VARIANTS[0]!.id;
  const keywordsOf = new Map<string, EntryKeywordLists>(
    keywordsGraphs(undefined, repoRoot, KEYWORD_VARIANTS.slice(0, 1)).map((k) => [
      `${k.instance}/${k.entry}`,
      { document: k.document[kwVariant] ?? [], sections: Object.fromEntries(Object.entries(k.sections).map(([sid, v]) => [sid, v[kwVariant] ?? []])) },
    ]),
  );
  for (const e of g.entries) {
    // [source] and [feedback] on the document and each section (bean zcak).
    // No [edit]: an entry is frozen, and this layer materialises none.
    // In the repository that HOLDS the entry, at its path there — never this
    // harness's repository plus the checkout path (owner, 2026-10-15: a 404).
    const at = forgeAt(repoRoot, e.dir, checkoutRepo);
    const kws = keywordsOf.get(`${e.instance}/${e.id}`);
    const doc = readEntryDocument(join(repoRoot, e.dir), e.id, {
      withheld: !!e.withheld,
      ...(kws ? { keywords: kws } : {}),
      ...(at ? { links: { repo: at.repo, dir: at.path } } : {}),
    });
    // The entry's resolved title, not the page-1 guess in structure.json
    // (issue #1794: the guess is never a library entry's title).
    if (doc && e.title) doc.title = e.title;
    emit(
      entryDataFiles(dataDir, e.id).doc,
      JSON.stringify(doc ?? { $schema: "folio-library-document/v1", id: e.id, absent: true }, null, 2) + "\n",
    );
    // The figures and table CSVs the document view shows (who-iris#224),
    // COPIED like the avatars: the entry's directory is not on the site.
    // A withheld entry shows none, so none is copied.
    if (doc && !e.withheld)
      for (const { rel, source } of entryFigureCopies(join(repoRoot, e.dir)))
        emitBytes(join(dataDir, "files", e.id, rel), readFileSync(join(repoRoot, e.dir, source)));
  }

  for (const e of g.entries) {
    const blocks = blocksOf.get(e.id) ?? [];
    // An entry with no blocks still gets a file. The alternative is a 404 the
    // viewer has to tell apart from a network failure, and "this entry has no
    // blocks" is a determined answer that deserves to be served as one.
    emit(
      entryDataFiles(dataDir, e.id).blocks,
      JSON.stringify({ $schema: "folio-library-entry/v1", id: e.id, blocks }, null, 2) + "\n",
    );
  }

  // ── AVATARS (bean `zrvt`) ─────────────────────────────────────────────
  //
  // Each entry's picture, COPIED under the site so it resolves wherever the
  // committed tree is served — the layer mount exists only on the built
  // site. `--check` compares BYTES, so a cover regenerated upstream and not
  // re-copied here is stale, never silently old.
  const copies = avatarCopies(g, site, repoRoot);
  for (const [dest, src] of copies) emitBytes(dest, readFileSync(src));
  // AVATAR ORPHANS (bean `cw35`). A copy the graph no longer names stays
  // committed AND published — the 2026-09-24 audit found both refused covers
  // still served from here after their entries were withheld. This directory
  // is written by this generator alone, so a file in it that no entry names
  // is its own stale output: pruned on a write, a finding under `--check`.
  {
    const avatarRoot = join(site, "assets", "library", "avatars");
    const wanted = new Set(copies.keys());
    for (const abs of orphanAvatars(avatarRoot, wanted)) {
      if (check) {
        if (!mineToCheck(abs)) continue;
        console.error(`  ✗ ${abs} is an orphan avatar — no entry names it`);
        stale++;
        continue;
      }
      const prune = writePathAt(CHECKOUT, abs);
      if (existsSync(prune)) {
        rmSync(prune);
        console.log(`  ✗ pruned orphan avatar ${prune}`);
      }
    }
  }
  // ── THE SHARED VIEWER ASSETS (#1881) ──────────────────────────────────
  //
  // Published ONCE beside the projection and referenced by every page, so a
  // page is a shell of a few KB rather than ~60 KB of the same CSS and script
  // per URL. Through `emit`, so `--check` compares them like any page.
  emit(join(dataDir, "viewer.css"), VIEWER_CSS);
  emit(join(dataDir, "viewer.js"), VIEWER_JS);

  // The whole-library page links the projection, the repository's subgraph
  // index, and every layer's library in the checkout (`librarySubgraphs`).
  const dataFile = join(dataDir, "index.json");
  const repoIndex = instanceSubgraphFile(ROOT, site);
  emit(
    join(pageDir, "index.html"),
    withRenderedByFrontMatter(
      viewerHtml(dataHref, "", "./", {
        links: [
          { label: basename(dataFile), href: hrefFrom(pageDir, dataFile), what: "library projection (JSON)" },
          ...(repoIndex ? [{ label: `subgraph/${SUBGRAPH_INDEX_FILE}`, href: hrefFrom(pageDir, repoIndex), what: "the repository's subgraph index (JSON-LD)" }] : []),
        ],
        libraries: librarySubgraphs({ harnessRoot: ROOT, repoRoot, site, pageDir, pages: new Set(subjects), entries: g.entries, ...(scope ? { scope } : {}) }),
      }),
      VIEWER_TOOL,
    ),
  );
  const wantedJsonld = new Set<string>();
  // An artefact this harness declares it builds at publish (`builtAtPublish`
  // in its declaration), by its path in the harness's own site. Under
  // `--site` the same site-relative path is asked, so the answer does not
  // depend on where the site is being written.
  const builtAtPublish = readDeclaration(ROOT)?.builtAtPublish ?? [];
  const builtHere = (dest: string): boolean =>
    isBuiltAtPublish(builtAtPublish, relative(ROOT, join(ROOT, siteDirFor(ROOT), relative(site, dest))).split(sep).join("/"));
  for (const subject of subjects) {
    const sub = viewerPlacement(site, `${route}/${subject}`, seg);
    const manifests = g.entries
      .filter((e) => e.instance === subject && existsSync(join(repoRoot, e.dir, "manifest.jsonld")))
      .map((e) => ({ id: e.id, abs: join(site, libraryAssetSitePath(subject, e.id)) }));
    emit(
      join(sub.pageDir, "index.html"),
      withRenderedByFrontMatter(
        viewerHtml(sub.dataHref, subject, "../", {
          links: instanceSources({ pageDir: sub.pageDir, dataFile, subgraph: instanceSubgraphFile(ROOT, site, subject), manifests }),
        }),
        VIEWER_TOOL,
      ),
    );

    // ── EVERY ENTRY'S OWN IRI, MATERIALIZED (owner, 2026-10-02, #1881) ──
    //
    //   > each link/page needs to be materialized on the CDN (gh-pagees),
    //   > just load the content from the KG json(ld) assets already published
    //   > … no query strings... each asset gets its own IRI
    //
    // So `<library>/<instance>/<id>/` is a REAL file — no 404 routing, which
    // the owner ruled "a hack" — and it is the SAME template as the layer
    // page with the entry's identity in its config: nothing of the entry's
    // content is written into it. The script reads the projection and the
    // entry's block file, both already published, and selects the entry from
    // the page's own path.
    //
    // The entry's JSON-LD manifest was NOT published before this (the
    // per-entry note above records it). It is the KG's own serialisation of
    // the entry, so it is copied as-is rather than re-expressed, and each
    // shell names it as its `alternate`.
    const mine = g.entries.filter((e) => e.instance === subject);
    const languages = entryLanguages(
      mine.map((e) => ({ id: e.id, ...(e.catalogue?.node ? { node: join(repoRoot, e.catalogue.node) } : {}) })),
      new Set(mine.map((e) => e.id)),
    );
    for (const e of mine) {
      const shellDir = join(sub.pageDir, e.id);
      const src = join(repoRoot, e.dir, "manifest.jsonld");
      let jsonld: string | undefined;
      if (existsSync(src)) {
        // At the path its IRI names (`schemas/library/library-iri.ts`), so the entry's
        // `@id` dereferences to exactly this file — one function decides both.
        const dest = join(site, libraryAssetSitePath(subject, e.id));
        wantedJsonld.add(dest);
        emitBytes(dest, readFileSync(src));
        jsonld = relative(shellDir, dest).split(sep).join("/");
        // The stub AT the IRI (Q-THIN-3 A): it declares the node and points
        // to the entry's page, so the extensionless IRI resolves to a page.
        const stub = join(site, libraryStubSitePath(subject, e.id));
        wantedJsonld.add(stub);
        const from = (abs: string): string => relative(dirname(stub), abs).split(sep).join("/");
        emit(
          stub,
          nodeStubPageHtml({
            title: e.title || e.id,
            node: { iri: libraryAssetIri(subject, e.id), types: [ENTRY_TYPE] },
            prefixes: ENTRY_PREFIXES,
            jsonld: from(dest),
            page: `${from(shellDir)}/`,
          }),
        );
      }
      // ── THE ENTRY'S DECLARED SUB-GRAPHS, BESIDE ITS MANIFEST (bean 8pzh) ──
      //
      // Owner, 2026-10-12: *"if its a part of the KG it should be
      // published."* A directory DECLARED inside the entry with a typology
      // that is `within: "library"` (an `l1-extraction`, say) is part of
      // the entry's KG, so every file of it is published at its path relative
      // to the entry, under the manifest's own directory — copied as-is, like
      // the manifest. A withheld entry publishes none. Its JSON-LD documents
      // are linked from the page (here, and through the projection's `links`).
      //
      // The copies are NOT committed (owner, 2026-10-15, "H1"): their bytes
      // come from the entry's layer at whatever pin the checkout mounts, so
      // this harness declares them `builtAtPublish` and `derive:publish` runs
      // this writer to lay them down. A declared copy has no committed bytes
      // for `--check` to compare, so it is skipped there (the `folio:viz`
      // rule) and written otherwise; the page that links it is still checked.
      const graphs: { label: string; href: string }[] = [];
      const files = e.withheld ? [] : entryGraphFiles(join(repoRoot, e.dir));
      for (const f of files) {
        const dest = join(site, entryGraphSitePath(subject, e.id, f.rel));
        wantedJsonld.add(dest);
        if (!(check && builtHere(dest))) emitBytes(dest, readFileSync(f.abs));
        if (f.jsonld) graphs.push({ label: f.rel, href: relative(shellDir, dest).split(sep).join("/") });
      }
      emit(
        join(shellDir, "index.html"),
        entryPageHtml(`../${sub.dataHref}`, subject, "../../", {
          id: e.id,
          title: e.title || e.id,
          ...(() => {
            const l = languages.get(e.id);
            if (!l) return {};
            const versions = versionsHtml(e.id, l, (id) => `../${encodeURIComponent(id)}/`);
            const summary = summaryHtml(l.abstract);
            return { ...(versions ? { versions } : {}), ...(summary ? { summary } : {}) };
          })(),
          ...(jsonld ? { jsonld } : {}),
          ...(graphs.length ? { graphs } : {}),
          ...(() => {
            // No viewable source held, and the entry names one: say so where the panel would be.
            const held = sourceFileOf(repoRoot, e, g.uploads);
            return !held && e.sourceFile && e.provenance !== "referenced"
              ? { notHeld: { file: e.sourceFile, elsewhere: [...elsewhereLinks(e), ...(e.upstream ?? []), ...(() => {
                  // The file this entry was derived from, at its source (script./lib/library-upstream-pdf.ts).
                  const u = upstreamPdfOf(e.catalogue?.node ? join(repoRoot, e.catalogue.node) : undefined, e.id);
                  return u ? [{ label: `${u.file} at its source`, href: u.href }] : [];
                })()] } }
              : {};
          })(),
          ...(() => {
            const record = catalogueRecordLinks({
              repoRoot, checkoutRepo, ...(e.catalogue ? { catalogue: e.catalogue } : {}),
              ...(e.catalogue?.xml ? { xmlHref: hrefFrom(shellDir, join(site, e.catalogue.xml)) } : {}),
            });
            return record.length ? { record } : {};
          })(),
          sources: entrySources({
            site, dataDir, shellDir, instance: subject, entry: e, manifest: jsonld !== undefined, files,
            subgraph: entrySubgraphFile(ROOT, site, subject, join(repoRoot, e.dir)),
            repo: entryRepoLinks({
              repoRoot,
              dir: e.dir,
              source: sourceFileOf(repoRoot, e, g.uploads),
              checkoutRepo,
              viewerHref: hrefFrom(shellDir, join(site, VIEWER_PATH)),
              withheld: !!e.withheld,
            }),
          }),
        }),
      );
    }

    // A shell whose entry is gone is this generator's own stale output: the
    // subject-page orphan rule (bean `ankg`) one level down, recognised by
    // the shell's own config block rather than by its name.
    const shells = orphanSubjectPages(sub.pageDir, mine.map((e) => e.id), isEntryShellFor(subject));
    for (const name of shells.foreign) {
      console.error(`  ! ${join(sub.pageDir, name)} is not an entry page and does not identify itself — left in place`);
    }
    for (const name of shells.owned) {
      const dir = join(sub.pageDir, name);
      if (check) {
        if (!mineToCheck(dir)) continue;
        console.error(`  ✗ ${dir} is an orphan entry page — no ${subject} entry is named ${name}`);
        stale++;
        continue;
      }
      const prune = writePathAt(CHECKOUT, dir);
      if (existsSync(prune)) {
        rmSync(prune, { recursive: true });
        console.log(`  ✗ pruned ${prune}`);
      }
    }
  }

  // Published JSON-LD no entry names any more — the avatar rule (bean `cw35`):
  // the directory is this generator's alone, so pruned on a write and a
  // finding under `--check`.
  for (const abs of orphanFiles(join(site, LIBRARY_JSONLD_SITE_DIR), wantedJsonld)) {
    if (check) {
      console.error(`  ✗ ${abs} is an orphan — no entry publishes it`);
      stale++;
      continue;
    }
    const prune = writePathAt(CHECKOUT, abs);
    if (existsSync(prune)) {
      rmSync(prune);
      console.log(`  ✗ pruned orphan ${prune}`);
    }
  }


  // ── ORPHANS (bean `ankg`) ──────────────────────────────────────────────
  //
  // A subject page the declaration no longer describes. `emit()` cannot see
  // one — it compares only the files it is about to write — so this is asked
  // separately, and in `--check` an orphan is a FINDING rather than silence.
  const { owned, foreign } = orphanSubjectPages(pageDir, subjects, isSubjectShell);
  for (const name of foreign) {
    // Reported and LEFT. Ownership could not be established from the file, and
    // `deletion-requires-confirmation` is about exactly this case.
    console.error(`  ! ${join(pageDir, name)} is not a subject and does not identify itself — left in place`);
  }
  for (const name of owned) {
    const dir = join(pageDir, name);
    if (check) {
      console.error(`  ✗ ${dir} is an orphan — it serves a subject the declaration no longer describes`);
      stale++;
      continue;
    }
    const prune = writePathAt(CHECKOUT, dir);
    if (existsSync(prune)) {
      rmSync(prune, { recursive: true });
      console.log(`  ✗ pruned ${prune}`);
    }
  }

  if (!check) {
    console.log(
      `  ${g.entries.length} entr(ies), ${g.queues.length} queue(s), ` +
        `${g.queues.reduce((n, q) => n + q.uningested, 0)} uningested, ` +
        `${subjects.length} subject page(s)`,
    );
  }
  if (stale > 0) {
    console.error(`\n${stale} artefact(s) stale — run \`bun run cat library:viz\``);
    process.exit(1);
  }
}
