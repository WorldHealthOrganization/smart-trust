/**
 * The PAGE LAYOUT — one stylesheet and one small script that give every
 * standalone page beside the rail the same width, top bar and scrolling.
 *
 * @module scripts/page-layout
 *
 * Standalone pages come from generators in several layers. The layout rules
 * know nothing of FHIR or of any IG, so they live HERE, the lowest layer that
 * writes standalone pages ({@link thinPageHtml} is this layer's), and the
 * layers above link this one file instead of keeping copies.
 *
 * ## What it is, matching folio-assistant's own pages
 *
 * - FULL WIDTH: the content fills from the rail's edge to the window's
 *   (`docs-ui.css`, "Full-width content on wide screens": `.main{max-width:none}`).
 * - ONE SCROLLER, THE WINDOW, under a STICKY BAR: folio-assistant's band is
 *   `position: sticky` at the top of the content column, the Folio tab sits
 *   on it, and text scrolls under it (`docs-ui.css` `.fa-glass-band[data-fa-band-tools]`).
 *   Here the page's own bar is that band, so the bare strip
 *   docs-ui draws behind the tab on a scrolled page is not drawn. Below
 *   50rem the bar scrolls away, so a phone keeps its screen.
 * - ANCHORS BELOW THE BAR: `scroll-padding-top`, from the bar's measured
 *   height, as folio-assistant pads for its band.
 * - The rail is unchanged: fixed at the left, its middle its own scroller
 *   (`navbar.css`, already one shared file).
 *
 * For a page drawn from JSON after load, the script restores what a static
 * page gets from the browser: a `#hash` scrolled to when its target is drawn,
 * and back/forward/reload returning to where the reader was.
 *
 * ## The contract is markup, so nothing changes by accident
 *
 * A page opts in by its classes: {@link PAGE_BAR_CLASS} on its top bar,
 * {@link PAGE_MAIN_CLASS} on its content column, {@link PAGE_FOOT_CLASS} on a
 * footer, {@link PAGE_WIDE_TABLE_CLASS} on a table that should fill the
 * column (any other table in the column scrolls inside its own box). A page with none of them that links the file is unchanged but for
 * `body{margin:0}`. The bar's colours are the page's: `--fa-page-bar-bg` and
 * `--fa-page-bar-fg`.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Where a site serves the two files, relative to its root. */
export const PAGE_LAYOUT_CSS_FILE = "assets/page-layout.css";
export const PAGE_LAYOUT_JS_FILE = "assets/page-layout.js";
/** The sources, in this layer. */
export const PAGE_LAYOUT_CSS_SOURCE = join(import.meta.dir, "templates", "page-layout.css");
export const PAGE_LAYOUT_JS_SOURCE = join(import.meta.dir, "templates", "page-layout.js");

/** The classes a page opts in with (browser-safe, in `lib/page-layout-classes.ts`). */
export { PAGE_BAR_CLASS, PAGE_FOOT_CLASS, PAGE_MAIN_CLASS, PAGE_WIDE_TABLE_CLASS } from "./lib/page-layout-classes.ts";

/** The attribute both tags carry, so a page is never given them twice. */
export const PAGE_LAYOUT_MARK = "data-fa-page-layout";

/**
 * The `<link>` and deferred `<script>` for a page whose site root is `up`
 * away (`""` at the root, `"../"` one level down, or a site-absolute
 * `"/base/"`).
 */
export function pageLayoutTags(up: string): string {
  return (
    `<link rel="stylesheet" href="${up}${PAGE_LAYOUT_CSS_FILE}" ${PAGE_LAYOUT_MARK}>` +
    `<script src="${up}${PAGE_LAYOUT_JS_FILE}" defer ${PAGE_LAYOUT_MARK}></script>`
  );
}

/**
 * A built page given the two tags, just before `</head>`. Pure. Returned as
 * it was when it already carries them, or has no `</head>`.
 */
export function withPageLayout(html: string, up: string): string {
  if (html.includes(PAGE_LAYOUT_MARK)) return html;
  const head = html.search(/<\/head>/i);
  if (head < 0) return html;
  return `${html.slice(0, head)}${pageLayoutTags(up)}\n${html.slice(head)}`;
}

/**
 * Write the two files under `root` (the site root, or the directory served
 * there). A file already there with the same bytes is left alone; one with
 * different bytes is replaced, since there is one layout and this is it.
 * Returns the paths written, relative to `root`.
 */
export function writePageLayout(root: string): string[] {
  const written: string[] = [];
  for (const [rel, src] of [[PAGE_LAYOUT_CSS_FILE, PAGE_LAYOUT_CSS_SOURCE], [PAGE_LAYOUT_JS_FILE, PAGE_LAYOUT_JS_SOURCE]] as const) {
    const to = join(root, rel);
    if (existsSync(to) && readFileSync(to, "utf-8") === readFileSync(src, "utf-8")) continue;
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(src, to);
    written.push(rel);
  }
  return written;
}
