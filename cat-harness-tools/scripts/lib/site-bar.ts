/**
 * ONE RAIL AND ONE TOP BAR ON EVERY PAGE — owner, 2026-10-15: "folio rail
 * everywhere" (option A: a pass after Jekyll replaces the theme's `.side-bar`
 * with the folio rail) and "Top bar, like IG sites" for the search box.
 *
 * This module holds the two page edits that pass makes, so every caller
 * (`railStandalonePages`, the mount pass) makes them the same way:
 *
 * - {@link stripThemeSidebar}: a just-the-docs page loses `header.side-bar`
 *   (its site-nav, its title, the footer include) and the `.d-md-none` copy
 *   of that include in its footer. The rail carries all of it: Pages
 *   (`lib/jekyll-pages-nav.ts`), Folders and Harnesses.
 * - {@link withSiteBar}: the page's TOP BAR. On a theme page it IS the
 *   theme's `#main-header`, kept with its own search (just-the-docs' lunr
 *   index, lazy, split by `search-split.ts`), given the site's name as its
 *   home link and the language picker's slot, and made the shared page
 *   layout's sticky bar (`page-layout.ts` `fa-page-bar`). On any other page
 *   the SAME markup is inserted, with the theme's search scripts linked when
 *   the site publishes them, so the box searches the same index. A page that
 *   already holds a page bar (an IG page's `.ig-topbar`) keeps its own.
 *
 * The bar keeps the id `main-header`: just-the-docs' search script looks it
 * up by that id when a search opens, and a null there is a thrown error.
 *
 * @module scripts/lib/site-bar
 */
import { PAGE_BAR_CLASS, PAGE_LAYOUT_MARK, pageLayoutTags } from "../page-layout.ts";
import { beforeHeadEnd, bodyTag } from "./navbar.ts";

/** The class the bar carries beside the page layout's. */
export const SITE_BAR_CLASS = "fa-site-bar";
/** Where docs-ui puts the language picker (it fills the first such slot). */
export const SITE_BAR_LOCALE = `<span class="fa-page-bar-locale" data-fa-slot="locale"></span>`;

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The index just past the element that opens at `start` — `<tag …>` matched
 * against its own `</tag>`, counting nested ones. -1 when it is not closed.
 */
export function elementEnd(html: string, start: number, tag: string): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

/** `html` without the element whose opening tag `open` matches, or unchanged. */
function without(html: string, open: RegExp, tag: string): string {
  const m = open.exec(html);
  if (!m) return html;
  const end = elementEnd(html, m.index, tag);
  return end < 0 ? html : html.slice(0, m.index) + html.slice(end);
}

/** Is this a just-the-docs page that still carries the theme's side bar? */
export function hasThemeSidebar(html: string): boolean {
  return /<header class="side-bar"/.test(html);
}

/**
 * The theme's per-page nav ACTIVATION style: `<style id="jtd-nav-activation">`,
 * which highlights and unfolds this page's row of `#site-nav` by its
 * POSITION (`li:nth-child(108) > ul > li:nth-child(4) …`).
 */
const NAV_ACTIVATION = /<style id="jtd-nav-activation">[\s\S]*?<\/style>/;

/**
 * A just-the-docs page without its side bar, the footer's mobile copy of the
 * side bar's footer, and the side bar's activation style. Unchanged when it
 * has no side bar.
 *
 * The activation style goes with the side bar because it styles nothing once
 * `#site-nav` is gone, and it is what made one page's edit touch every page:
 * it names this page's row by position in the WHOLE nav, so a page added or
 * retitled ahead of it renumbers it. Measured on gh-pages `cc01b54`, it was
 * the only nav-shaped bytes left in a stripped page (1.4 KB); the rail's own
 * data is already one shared file (`railDataAsset`, named by scope).
 */
export function stripThemeSidebar(html: string): string {
  if (!hasThemeSidebar(html)) return html;
  let out = without(html, /<header class="side-bar"[^>]*>/, "header");
  out = without(out, /<div class="d-md-none mt-4 fs-2"[^>]*>/, "div");
  return out.replace(NAV_ACTIVATION, "");
}

/** Does the page already hold a top bar of its own? */
export function hasPageBar(html: string): boolean {
  return new RegExp(`class="[^"]*\\b(?:${PAGE_BAR_CLASS}|ig-topbar)\\b`).test(html);
}

/** The theme's search box, as just-the-docs writes it — the ids its script looks up. */
export function themeSearchHtml(placeholder = "Search this site"): string {
  return (
    `<div class="search" role="search"><div class="search-input-wrap">` +
    `<input type="text" id="search-input" class="search-input" tabindex="0" placeholder="${esc(placeholder)}" autocomplete="off">` +
    `<label for="search-input" class="search-label"><span class="sr-only">${esc(placeholder)}</span></label>` +
    `</div><div id="search-results" class="search-results"></div></div>`
  );
}

/** The marker `publish-verify` reads for a page left out of the search index on purpose. */
export const SEARCH_EXCLUDE_META = '<meta name="fa-search-exclude" content="true">';

export interface SiteBarOptions {
  /** Back to the site's root from this page: `.`, `..`, … */
  toRoot: string;
  /** The site's name, the bar's home link. */
  title: string;
  /**
   * The theme's search scripts, site-relative, when the site publishes them
   * (`assets/js/vendor/lunr.min.js`, `assets/js/just-the-docs.js`). Given,
   * a page without the theme gets the box and the scripts; absent, the bar
   * has no box there rather than one that searches nothing.
   */
  search?: readonly string[];
}

/**
 * The page with its top bar. Pure. Unchanged when it already holds a page
 * bar, or has no `<body>`.
 */
export function withSiteBar(html: string, o: SiteBarOptions): string {
  if (hasPageBar(html)) return html;
  const home = `<a class="fa-page-bar-home" href="${esc(o.toRoot)}/">${esc(o.title)}</a>`;
  let out = html;
  const theme = /<div id="main-header" class="main-header"[^>]*>/.exec(out);
  if (theme) {
    // The theme's own bar: its search and its aux links stay; it gains the
    // home link first and the picker's slot last, and the layout's classes.
    const end = elementEnd(out, theme.index, "div");
    if (end < 0) return html;
    const close = out.lastIndexOf("</div>", end);
    const open = `<div id="main-header" class="main-header ${SITE_BAR_CLASS} ${PAGE_BAR_CLASS}">`;
    out = out.slice(0, theme.index) + open + home + out.slice(theme.index + theme[0].length, close) + SITE_BAR_LOCALE + out.slice(close);
  } else {
    const body = bodyTag(out);
    if (!body) return html;
    const box = o.search && o.search.length ? themeSearchHtml() : "";
    const bar = `<div id="main-header" class="main-header ${SITE_BAR_CLASS} ${PAGE_BAR_CLASS}">${home}${box}${SITE_BAR_LOCALE}</div>`;
    // After the rail, where it is the first thing in the body; else first.
    const nav = /<nav class="fa-nav"[^>]*>/.exec(out);
    const navEnd = nav ? elementEnd(out, nav.index, "nav") : -1;
    const at = navEnd > 0 ? navEnd : body.index + body[0].length;
    out = out.slice(0, at) + bar + out.slice(at);
    if (box) {
      const scripts = o.search!.map((s) => `<script src="${esc(o.toRoot)}/${esc(s)}" defer></script>`).join("");
      // A page without the theme (TypeDoc's api/, a mounted layer's own
      // HTML) gets the box but is never in the theme's index, which only
      // Jekyll builds. The marker says so, so publish-verify's search-index
      // counts it as excluded on purpose, not as a gap in the index.
      out = beforeHeadEnd(out, SEARCH_EXCLUDE_META + scripts);
    }
  }
  if (!out.includes(PAGE_LAYOUT_MARK)) out = beforeHeadEnd(out, pageLayoutTags(`${o.toRoot}/`));
  return out;
}

/** The theme's search scripts a site publishes, in load order, or `undefined` when it lacks either. */
export const THEME_SEARCH_SCRIPTS: readonly string[] = ["assets/js/vendor/lunr.min.js", "assets/js/just-the-docs.js"];
