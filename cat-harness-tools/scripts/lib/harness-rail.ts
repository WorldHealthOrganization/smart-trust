/**
 * The harness rail — now a thin ADAPTER over the shared navbar.
 *
 * ## What moved, and why this file still exists
 *
 * Owner, 2026-09-21: *"we should have same navbar across all folios though.
 * presented same way. need to comine the two."* The markup, the stylesheet and
 * the three-region layout are in `lib/navbar.ts`; what stays here is the one
 * thing that is genuinely about MOUNTED PAGES:
 *
 * > a page Jekyll never rendered gets no layout, so the harness's navigation
 * > has to be injected into somebody else's finished document.
 *
 * `mount-instance-docs.ts` does that injection and this file gives it the
 * model. Nothing about the navbar's appearance is decided here any more, which
 * is the whole point: the rail and the site sidebar stopped being two
 * implementations that agree by maintenance.
 *
 * ## Why the rail went first
 *
 * Owner's ruling on the collision, 2026-09-21: split by layer. `603s` (PR
 * #791) is mid-flight on the harness avatars and themes, and the Jekyll
 * sidebar's own include is where the two would collide — so the sidebar
 * switches to `navbar.ts` after that lands. The rail is the side with no other
 * claimant, which makes it the side where the component can be got right
 * without re-resolving against three moving branches.
 *
 * ## No JavaScript, and here it is not a preference
 *
 * These documents are copied verbatim from layers the harness does not
 * control. Injecting a nav into somebody else's page is one claim; injecting
 * script into it is a larger one.
 *
 * @module scripts/lib/harness-rail
 */
export {
  documentIndexOf,
  visualiserNavOf,
  NAV_COLLAPSED_PX,
  NAV_GLYPH_PX,
  NAV_OPEN_PX,
  NAV_PAD_PX,
  injectNavbar,
  navbarCss,
  navbarHtml,
} from "./navbar.js";
export type { NavGroup, NavItem, NavbarModel } from "./navbar.js";

import { GROUP_GLYPHS, NAVBAR_CSS, RAIL_SECTION_LABELS, bodyTag, folderName, folderOfPage, hasRail, headEndTag, documentIndexOf, injectNavbar, navbarRegionsHtml, visualiserLabelOf, visualiserNavOf, type NavGroup, type NavItem, type NavbarModel } from "./navbar.js";

/** What a mounted page needs in order to describe its own navbar. */
export interface RailOptions {
  /** The layer whose page this is. */
  instance: string;
  /** Path back to the site root from this page — `..`, `../..`, … */
  toRoot: string;
  /** The layer's own themed root, for the fixed top — never inside the graphs group. */
  root?: NavItem;
  /** This layer's own graphs — the scrollable middle. */
  links: readonly NavItem[];
  /**
   * The instantiated harnesses, for the fixed bottom.
   *
   * Optional because a caller that cannot read `_data/harness.json` must be
   * able to say so by OMITTING the region rather than by passing an empty one.
   * An empty disclosure labelled "Harnesses" invites a click that does
   * nothing, and reads as a site with no harnesses rather than as a navbar
   * that could not find out.
   */
  harnesses?: readonly NavItem[];
  /**
   * The site's own page tree, for the "Pages" section — rows from
   * `pagesNav` (`lib/jekyll-pages-nav.ts`). Absent, no Pages section.
   */
  pages?: readonly NavItem[];
  /**
   * Where the header's home link goes, when the page's site is one part of a
   * larger site: an IG composed into smart-html-jtd is a subgraph of that
   * site's KG, so its home is the composed site's landing page (owner,
   * 2026-11-10). Default `${toRoot}/`, the page's own site root.
   */
  homeHref?: string;
  /**
   * What the header is called when {@link homeHref} is a larger site's
   * landing page: "SMART Guidelines" on the IGs smart-html-jtd composes
   * (owner, 2026-11-10). Absent, the header names the instance.
   */
  homeName?: string;
  /**
   * The folder the page is in, for the header's second line (owner,
   * 2026-11-13). Absent, it is derived from {@link links} and {@link here}
   * ({@link folderOfPage}); empty, the page is in none.
   */
  folder?: string;
  /**
   * Where the PLATFORM's site root is from this page, when it is not `toRoot`
   * — a folio's own Pages site, whose platform links and row files live on the
   * platform's site (`platformBase`). Default `toRoot`. Bean `lhvt`.
   */
  assetRoot?: string;
  /**
   * Where the icon row's SITE-ROOT hrefs and counts resolve (`data-fa-root`),
   * when that is not {@link assetRoot}. On a folio's own site the row's code is
   * the platform's, but after `scopeNavbarRow` every root-relative href left in
   * the row is the FOLIO's own (`/beans/`), and so is the `count.json` beside
   * it: composed against the platform, the folio's beans icon opened, and
   * counted, the platform's work plan (issue #46, gap 2). Default `assetRoot`.
   */
  rowRoot?: string;
  /**
   * Where the rail's own CODE and STYLE are loaded from — `navbar.js`,
   * `navbar.css`, `navbar-row.js`, `navbar-row.css` — when that is not
   * {@link assetRoot}. Owner, 2026-10-15, "pinned copy per site": a folio's or
   * an IG's site ships these files itself, at its pinned platform version,
   * rather than linking the platform's live site, while the rail's LINKS still
   * point at the platform's pages. Default `assetRoot`.
   */
  chromeRoot?: string;
  /**
   * The row's script and stylesheet, to be INLINED rather than linked — for a
   * standalone viewer page that fetches nothing (`withViewerNav`), as its
   * narrow-viewport rules already are. Bean `lhvt`.
   */
  inlineRowAssets?: { js: string; css: string };
  /**
   * THE RAIL FROM SHARED DATA — owner, 2026-10-05: *"4. Option 3 everywhere"*
   * (bean `lnoy`). Given this, the page carries only what is ITS OWN (where
   * it is, its own section) and a placeholder `<nav>`; everything the rail
   * shares with its siblings is written ONCE, through this callback, as
   * `assets/navbar/rail-<hash>.js`, and `navbar.js` draws the rail from both.
   * Absent, the rail is rendered into the page as before (no script needed).
   */
  emitRailData?: (file: string, body: string) => void;
  /**
   * The page's own published path (`/cat-harness/library/`) — its row in the
   * rail is drawn as "you are here" rather than as a link to itself. Given
   * with {@link emitRailData}; a caller rendering markup marks the row itself.
   */
  here?: string;
  /**
   * The open document's own index, for the fixed top.
   *
   * Optional, and ABSENT rather than empty when the page has fewer than two
   * addressable headings — `documentIndexOf` makes that call, because "this
   * page has no index" and "we did not look" must not render the same.
   */
  documentIndex?: NavGroup;
  /**
   * The layer's mark for the header — avatar, or tone for its initial.
   * `instanceMark` in `mount-instance-docs.ts` reads it off the same
   * `_data/harness.json` the harnesses region comes from.
   */
  mark?: NavbarModel["mark"];
  /**
   * The harness's NAVBAR ROW — the icon row (todos, beans, processes, kg,
   * fsh-guts, launcher) — exactly as `_data/harness.json` carries it under
   * `navbar`, which is what the Jekyll sidebar reads through
   * `head_custom.html`'s `#fa-navbar-row`.
   *
   * Bean `wckf` (#2147), owner 2026-10-05: still no left-hand icons in the top
   * navbar on the IRIS replica's page (paraphrased), then *"this should be a
   * common navbar functionality in harness"* (bean `9rq1`). The row is drawn by ONE function,
   * `mountNavIconRow` in `docs-ui.js`; a railed page lacked only its DATA, so
   * this writes the same block the theme writes and the same function draws
   * the same row. No second renderer here, and no script: the rail stays
   * script-free, and a page without `docs-ui.js` simply shows no row.
   *
   * Three states, as everywhere the row is read: `undefined` — the caller
   * could not find out, nothing is written; `null` — declared none, written as
   * `null`, which `readNavbarRow` reports at info level; an object — the row.
   */
  navbarRow?: unknown;
  /**
   * THE ICON ROW'S DATA FROM A SHARED FILE, not inlined — with
   * {@link emitRailData} only. The row is the same on every page a pass rails
   * alike (measured on a folio site, 2026-10-10: 1,956 B of byte-identical
   * JSON on each of 434 pages, 849 KB of the 1.76 MB of railed HTML), so it is
   * written once as `assets/navbar/row-<hash>.js`, beside the rail's own
   * shared data, and the page keeps an EMPTY `#fa-navbar-row` that names it.
   * The same class `kg-render.js`'s header records for the translation index.
   * See {@link withNavbarRow} for what a reader sees when that file fails.
   */
  shareNavbarRow?: boolean;
  /**
   * What the page's own section is CALLED — the visualiser's name, `todos` on
   * `/todos/`. Absent on a mounted document, whose section is "On this page".
   */
  visualiserLabel?: string;
  /**
   * What the home row is called — the site's title from `harness.json`, the
   * same words the Jekyll sidebar's home row shows (bean `ob3m` finding 6).
   * Absent falls back to `folio-assistant`.
   */
  homeLabel?: string;
}

/**
 * The model for a mounted page.
 *
 * There is no home row in the fixed bottom any more (owner, 2026-10-30: *"dont
 * need home on bottomof harnes navbars"*; retired in bean `sjic`, 2026-11-02).
 * The header is the home link, and its href is the one this file composes,
 * because `toRoot` is the only piece of routing a mounted page knows about itself.
 */
/** The header's folder line: declared, or the Folders row whose route holds {@link RailOptions.here}. */
function folderOf(o: RailOptions): string | undefined {
  if (o.folder !== undefined) return o.folder || undefined;
  if (o.here === undefined) return undefined;
  const paths = [`${o.toRoot}${o.here}`, ...(o.assetRoot ? [`${o.assetRoot}${o.here}`] : [])];
  const hit = folderOfPage(o.links, paths, o.instance);
  return hit ? folderName(hit) : undefined;
}

export function railModel(o: RailOptions): NavbarModel & { graphs: NavGroup } {
  const harnesses: NavGroup | undefined =
    o.harnesses === undefined
      ? undefined
      : { label: RAIL_SECTION_LABELS.harnesses, icon: "H", glyphPath: GROUP_GLYPHS.harnesses, items: o.harnesses, collapsible: true };
  return {
    instance: o.instance,
    ...(o.mark ? { mark: o.mark } : {}),
    ...(o.root ? { root: o.root } : {}),
    // THE PAGE'S OWN INDEX IS ITS VISUALISER SECTION (#1757), open on arrival,
    // and it sits at the head of the scrolling middle rather than in the fixed
    // top. It was a "Contents" disclosure in the top that arrived FOLDED while
    // "Graphs" arrived open — the one section about this page was the one you
    // had to open. *"by default, only the current pages visualiers LHS navbar
    // is open"*.
    ...(o.documentIndex ? { visualiser: o.documentIndex } : {}),
    // Collapsible so the whole stack folds in one click -- the owner's
    // "librarues should be in hambuger menu so can collase all" -- and FOLDED
    // on arrival on every page: owner, 2026-10-05 (#2150), *"also have the
    // "Graphs" section start closed on LHS navbar"*. It was open whenever the
    // page had no section of its own. `navbarRegionsHtml` still opens it when
    // one of its rows is the current page, so the reader's place stays visible.
    // "Folders", not "Graphs" (owner, 2026-10-15): the theme sidebar's word
    // for the same rows, so the section reads the same on every site.
    ...(o.pages && o.pages.length > 0 ? { pages: { label: RAIL_SECTION_LABELS.pages, icon: "P", glyphPath: GROUP_GLYPHS.pages, items: o.pages, collapsible: true, open: false } } : {}),
    graphs: { label: RAIL_SECTION_LABELS.folders, icon: "F", glyphPath: GROUP_GLYPHS.folders, items: o.links, collapsible: true, open: false },
    ...(harnesses ? { harnesses } : {}),
    // No home row (owner, 2026-10-30: "dont need home on bottomof harnes
    // navbars"): the header's mark and name are the link to the landing page.
    headHref: o.homeHref ?? `${o.toRoot}/`,
    ...(folderOf(o) ? { folder: folderOf(o)! } : {}),
    ...(o.homeName ? { headName: o.homeName } : {}),
  };
}

const OPT_OUT_RE = /<meta\s+[^>]*name=["']folio-navbar["'][^>]*content=["']none["'][^>]*>/i;
const OPT_OUT_RE_SWAPPED = /<meta\s+[^>]*content=["']none["'][^>]*name=["']folio-navbar["'][^>]*>/i;

/**
 * Does this page explicitly decline the navbar (`<meta name="folio-navbar"
 * content="none">`, either attribute order)?
 *
 * HERE, beside {@link injectRail}, so that EVERY pass that injects a rail can
 * ask it — the generator's own write (`viewer-page.ts`) and the post-build
 * site walk (`railStandalonePages`). Until #1881 only the first asked, so a
 * page that declined at generation was railed anyway by the second, in CI only:
 * a 2.8 KB library entry shell published at 25 KB.
 */
export function declinesNavbar(html: string): boolean {
  return OPT_OUT_RE.test(html) || OPT_OUT_RE_SWAPPED.test(html);
}

/**
 * The declaration a THIN page makes — rail me, but LINK the rail's style and
 * the row's script rather than inlining them. Owner, 2026-10-05: *"1. Shared
 * rail style first"*, for the library entries, OpenAPI operations and todo
 * pages that declined the rail because inlined it outweighed the page (bean
 * `lnoy`). Any pass that rails a page honours it, so the decision lives on the
 * page, as `none` does.
 */
export const NAVBAR_LINKED = `<meta name="folio-navbar" content="linked">`;
const LINKED_RE = /<meta\s+[^>]*name=["']folio-navbar["'][^>]*content=["']linked["'][^>]*>/i;
const LINKED_RE_SWAPPED = /<meta\s+[^>]*content=["']linked["'][^>]*name=["']folio-navbar["'][^>]*>/i;

/** Does this page ask for the rail with its style LINKED ({@link NAVBAR_LINKED})? */
export function wantsLinkedRail(html: string): boolean {
  return LINKED_RE.test(html) || LINKED_RE_SWAPPED.test(html);
}

/**
 * Put the rail into a finished document. Refuses a page with no `<body>`.
 *
 * THE DOCUMENT INDEX IS READ OFF `html` HERE, not passed in, and that is the
 * point: this function already holds the finished page, so the caller cannot
 * hand it an index belonging to a different document. `mount-instance-docs.ts`
 * loops over hundreds of files, and "the right nav with the previous page's
 * contents" is the failure that shape invites.
 *
 * An explicit `o.documentIndex` still wins, for a caller that has a better
 * answer than the headings — a declared index in the graph, say.
 */
export function injectRail(html: string, o: RailOptions): string | undefined {
  const label = o.visualiserLabel ?? visualiserLabelOf(html) ?? RAIL_SECTION_LABELS.onThisPage;
  // A DECLARED index (`data-fa-visualiser-nav`) is the same on every page of
  // one guide, so with shared data it goes in the shared file, not the page
  // (bean gp2f: ~4 KB off every IG page). A headings index is the page's own.
  const declared = o.documentIndex ? undefined : visualiserNavOf(html, label);
  const documentIndex = o.documentIndex ?? declared ?? documentIndexOf(html, label);
  const root = o.assetRoot ?? o.toRoot;
  const chrome = o.chromeRoot ?? root;
  if (o.emitRailData) {
    const railed = withSharedRail(html, o, root, documentIndex, declared !== undefined);
    return railed === undefined
      ? undefined
      : withNavbarRow(railed, o.navbarRow, {
          root: chrome,
          dataRoot: o.rowRoot ?? root,
          ...(o.shareNavbarRow ? { shared: { emit: o.emitRailData, toRoot: o.toRoot } } : {}),
        });
  }
  // A page that asked for LINKED assets gets them linked, whatever the caller
  // would otherwise inline: the page's declaration is the decision.
  const linked = wantsLinkedRail(html);
  const railed = injectNavbar(
    html,
    railModel({ ...o, ...(documentIndex ? { documentIndex } : {}) }),
    linked ? { cssHref: `${chrome}/${NAVBAR_CSS}` } : {},
  );
  return railed === undefined
    ? undefined
    : withNavbarRow(railed, o.navbarRow, {
        root: chrome,
        dataRoot: o.rowRoot ?? root,
        ...(o.inlineRowAssets && !linked ? { inline: o.inlineRowAssets } : {}),
      });
}

/** The id `docs-ui.js`'s `readNavbarRow` looks for — the same one `head_custom.html` writes. */
export const NAVBAR_ROW_ID = "fa-navbar-row";

/** Where the row's drawing and style are published, relative to the site root. */
export const NAVBAR_ROW_JS = "assets/js/navbar-row.js";
export const NAVBAR_ROW_CSS = "assets/css/navbar-row.css";
/** The attribute an INLINED copy of the row's script and style carries. */
export const NAVBAR_ROW_INLINE = "data-fa-navbar-row-inline";
/** The attribute an EMPTY `#fa-navbar-row` carries: the shared file that fills it. */
export const NAVBAR_ROW_SRC = "data-fa-row-src";

/**
 * The row's shared file: a script that fills the page's empty island with the
 * row's JSON (as text — the readers parse it, exactly as they parse an inlined
 * one) and drops the name, so a filled island and an inlined one look alike.
 * Named by a constant rather than the row's content (bean `g196`, owner
 * 2026-10-30) so a count or note change does not rewrite every railed page.
 */
export function navbarRowAsset(json: string): { name: string; file: string; body: string } {
  const name = `row-${contentHash(json && "shared")}`;
  const body =
    `(function(n){if(n&&n.getAttribute(${JSON.stringify(NAVBAR_ROW_SRC)})===${JSON.stringify(name)}&&!n.textContent)` +
    `{n.textContent=${JSON.stringify(json)};n.removeAttribute(${JSON.stringify(NAVBAR_ROW_SRC)})}})` +
    `(document.getElementById(${JSON.stringify(NAVBAR_ROW_ID)}));\n`;
  return { name, file: `${RAIL_DATA_DIR}/${name}.js`, body };
}

/**
 * The row's JSON as a browser sees it once the shared file ran — for an AUDIT
 * or a test. Inlined, it is the island's text; shared, `readFile(file)` returns
 * the file `navbarRowAsset` wrote. `undefined` when the page has no island or
 * the file cannot be read.
 */
export function navbarRowJsonOf(html: string, readFile: (file: string) => string | undefined): string | undefined {
  const m = new RegExp(`<script type="application/json" id="${NAVBAR_ROW_ID}"([^>]*)>([\\s\\S]*?)</script>`).exec(html);
  if (!m) return undefined;
  const src = new RegExp(`${NAVBAR_ROW_SRC}="([^"]+)"`).exec(m[1]!);
  if (!src) return m[2];
  const body = readFile(`${RAIL_DATA_DIR}/${src[1]}.js`);
  if (body === undefined) return undefined;
  const lit = /n\.textContent=("(?:[^"\\]|\\.)*")/.exec(body);
  return lit ? (JSON.parse(lit[1]!) as string) : undefined;
}

/**
 * The navbar row's data block, written right after the opening `<body>` —
 * once, and never when `row` is `undefined` (see {@link RailOptions.navbarRow}).
 *
 * `<` is escaped so a value can never close the script element early: the
 * hrefs are generated, but "generated" is not "trusted" (`docs-ui.js`
 * `safeHref`'s own argument), and the bytes land inside somebody else's page.
 *
 * WITH `toRoot`, ALSO WHAT DRAWS IT — beans `lhvt`, `9rq1`. The data alone
 * was written onto 2,747 railed pages by #2149, and on the 2,709 of them that
 * never load `docs-ui.js` nothing drew it. `navbar-row.js` and its stylesheet
 * are linked before `</head>`, each once; a row the layer declined (`null`)
 * still gets them, so the decline is reported the same way on every page.
 */
export function withNavbarRow(
  html: string,
  row: unknown,
  at?: {
    root: string;
    dataRoot?: string;
    inline?: { js: string; css: string };
    /** Write the row's data ONCE as a shared file — {@link RailOptions.shareNavbarRow}. */
    shared?: { emit: (file: string, body: string) => void; toRoot: string };
  },
): string {
  if (row === undefined) return html;
  let out = html;
  let sharedTag = "";
  if (!out.includes(`id="${NAVBAR_ROW_ID}"`)) {
    const body = bodyTag(out);
    if (!body) return html;
    const pos = body.index + body[0].length;
    const json = JSON.stringify(row).replace(/</g, "\\u003c");
    // `data-fa-root` — the site root the row's site-root hrefs (`/beans/`) are
    // composed against. A railed page carries no `fa-baseurl` meta, and an
    // INLINED script has no address of its own to derive one from. `dataRoot`
    // when the row's own paths live on a different site from its code.
    const root = at ? ` data-fa-root="${(at.dataRoot ?? at.root).replace(/"/g, "&quot;")}"` : "";
    if (at?.shared) {
      // The island stays — every reader finds the row where it always did, and
      // `data-fa-root` stays per page — but EMPTY, naming the file that fills
      // it. That file is a deferred script placed ahead of every reader, so
      // by the time `navbar-row.js` or `docs-ui.js` reads the island it holds
      // the row. Left empty WITH the name, the load failed, and the readers
      // say so instead of reading it as "declared none" (an empty island).
      const asset = navbarRowAsset(json);
      at.shared.emit(asset.file, asset.body);
      out = out.slice(0, pos) + `<script type="application/json" id="${NAVBAR_ROW_ID}"${root} ${NAVBAR_ROW_SRC}="${asset.name}"></script>` + out.slice(pos);
      sharedTag = `<script src="${at.shared.toRoot}/${asset.file}" defer></script>`;
    } else {
      out = out.slice(0, pos) + `<script type="application/json" id="${NAVBAR_ROW_ID}"${root}>${json}</script>` + out.slice(pos);
    }
  }
  if (sharedTag) {
    // AHEAD of any reader already linked, else before `</head>`: deferred
    // scripts run in document order, and the readers are deferred too.
    const reader = out.search(/<script\b[^>]*(navbar-row\.js|docs-ui\.js)/i);
    const head = headEndTag(out);
    const at2 = reader >= 0 ? reader : head ? head.index : -1;
    if (at2 >= 0) out = out.slice(0, at2) + sharedTag + out.slice(at2);
  }
  if (at === undefined || out.includes(NAVBAR_ROW_JS) || out.includes(NAVBAR_ROW_INLINE)) return out;
  const tags = at.inline
    ? `<style ${NAVBAR_ROW_INLINE}>${at.inline.css}</style><script ${NAVBAR_ROW_INLINE}>${at.inline.js}</script>`
    : `<link rel="stylesheet" href="${at.root}/${NAVBAR_ROW_CSS}">` + `<script src="${at.root}/${NAVBAR_ROW_JS}" defer></script>`;
  const head = headEndTag(out);
  if (head) return out.slice(0, head.index) + tags + out.slice(head.index);
  const body = bodyTag(out);
  return body ? out.slice(0, body.index + body[0].length) + tags + out.slice(body.index + body[0].length) : out;
}

/* ── THE RAIL FROM SHARED DATA — bean `lnoy` ───────────────────────────────
 *
 * Owner, 2026-10-05, choosing between a full rail in every page (+3.8 KB
 * gzipped each) and one drawn from shared data (+0.1 KB): *"4. Option 3
 * everywhere"*. Measured on a library entry: the rail's MARKUP was 20.8 KB of
 * a 26 KB page — 25 links, each with its glyph, tone and description twice.
 *
 * Split by what varies. SHARED (one file per distinct content, named by its
 * hash, so callers whose rails agree share it): the layer, its mark, root,
 * graphs, harnesses and home label. THE PAGE'S OWN: its depth, its published
 * path (for "you are here") and its own section. `navbar.js` — a bundle of
 * THIS module and `navbar.ts`, so the browser runs the same drawing the build
 * always ran — joins the two. One drawing, two places it runs.
 */

/** Stands for the site root inside shared data; each page puts back its own. */
export const RAIL_ROOT = "@fa-rail-root@";
/**
 * Stands for the page's OWN site root inside shared data, when that is not
 * {@link RAIL_ROOT} — a foreign site, whose rail links the platform's pages
 * (`RAIL_ROOT`) and its own (its Pages, its own graphs) from one file.
 */
export const RAIL_TO_ROOT = "@fa-rail-to-root@";
/** Where shared rail data is published, relative to the site root. */
export const RAIL_DATA_DIR = "assets/navbar";
/** The bundle that draws a rail from shared data. */
export const NAVBAR_JS = "assets/js/navbar.js";
/** The page's own rail block. */
export const RAIL_PAGE_ID = "fa-rail";

/** What every page railed alike shares. Hrefs carry {@link RAIL_ROOT}. */
export interface RailShared {
  instance: string;
  mark?: NavbarModel["mark"];
  root?: NavItem;
  links: readonly NavItem[];
  pages?: readonly NavItem[];
  harnesses?: readonly NavItem[];
  homeLabel?: string;
  /** A document index every page of a guide shares — its declared IG menu. A page's own wins. */
  documentIndex?: NavGroup;
}

/** What is the page's own, carried in its `#fa-rail` block. */
export interface RailPage {
  /** The shared data's name, `rail-<hash>`. */
  data: string;
  /** Back to the page's own site root — home is the page's site's. */
  toRoot: string;
  /** Back to the platform's site root, where the shared links point. */
  root: string;
  here?: string;
  documentIndex?: NavGroup;
  /**
   * The header's home link, from the block's `data-fa-home`, when the site is
   * composed into a larger one (smart-html-jtd sets it). Absent, home is `toRoot`.
   */
  home?: string;
  /** The header's name for that home, from `data-fa-home-name`. Absent, the shared data's or the instance's. */
  homeName?: string;
}

/** cyrb53 — a short, stable, dependency-free name for shared content. Not security. */
function contentHash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The shared data as text, with the caller's root replaced by {@link RAIL_ROOT}. */
export function railSharedJson(o: RailOptions, root: string, documentIndex?: NavGroup): string {
  const shared: RailShared = {
    instance: o.instance,
    ...(o.mark ? { mark: o.mark } : {}),
    ...(o.root ? { root: o.root } : {}),
    links: o.links,
    ...(o.pages && o.pages.length > 0 ? { pages: o.pages } : {}),
    ...(o.harnesses ? { harnesses: o.harnesses } : {}),
    ...(o.homeLabel ? { homeLabel: o.homeLabel } : {}),
    ...(documentIndex ? { documentIndex } : {}),
  };
  // Every root-relative value the caller composed starts `<root>/`; put the
  // placeholder there so the SAME data serves a page at any depth.
  const json = JSON.stringify(shared).split(`"${root}/`).join(`"${RAIL_ROOT}/`);
  return o.toRoot === root ? json : json.split(`"${o.toRoot}/`).join(`"${RAIL_TO_ROOT}/`);
}

/**
 * The shared data file's name and its script body.
 *
 * Named by the rail's SCOPE (`instance`, `root`, whether `pages` is whole-site
 * or scoped, and the declared `documentIndex`'s identity), never by its
 * contents (`links`, `pages`, `harnesses`, `mark`, `homeLabel`): when a graph,
 * page tree, harness or note changes, only the shared `.js` file changes and
 * every railed HTML page stays byte-identical (bean `g196`, owner 2026-10-30).
 */
export function railDataAsset(json: string): { name: string; file: string; body: string } {
  const s = JSON.parse(json) as RailShared;
  const k = JSON.stringify({
    instance: s.instance,
    ...(s.root ? { root: { href: s.root.href, current: !!s.root.current } } : {}),
    ...(s.pages?.length ? { pages: s.pages[0]?.href === "@fa-rail-root@/" || s.pages[0]?.href === "@fa-rail-to-root@/" ? "root" : "scoped" } : {}),
    ...(s.documentIndex
      ? {
          documentIndex: {
            label: s.documentIndex.label,
            first: s.documentIndex.items[0]?.label,
            current: s.documentIndex.items.findIndex((item) => !item.href),
          },
        }
      : {}),
  });
  const name = `rail-${contentHash(k)}`;
  const body = `(self.FaRailData=self.FaRailData||{})[${JSON.stringify(name)}]=${JSON.stringify(json)};\n`;
  return { name, file: `${RAIL_DATA_DIR}/${name}.js`, body };
}

/** The rail's regions for one page, from its shared data — what `navbar.js` runs. */
export function renderRailRegions(sharedJson: string, page: RailPage): string {
  const shared = JSON.parse(sharedJson.split(RAIL_TO_ROOT).join(page.toRoot).split(RAIL_ROOT).join(page.root)) as RailShared;
  // "You are here": the page's own row loses its link (a link to here is a
  // control that does nothing — `state-visualizer.test.ts`).
  const links =
    page.here === undefined
      ? shared.links
      : shared.links.map((item) => {
          if (item.href !== `${page.root}${page.here}`) return item;
          const { href: _here, ...rest } = item;
          return { ...rest, current: true };
        });
  // The page tree, at any depth, marks the page too — but KEEPS its link.
  // Owner, 2026-11-08, on a section landing page: *"you should be able to navigate
  // to pages like [that one] by click on Page name on LHS navbar but it doesnt
  // work"*. A page that has children is a section's landing page; as a dead,
  // dimmed row it read as broken. It stays a link, drawn as current
  // (`aria-current="page"`), so a click reloads it the way a reader expects.
  const markHere = (items: readonly NavItem[]): NavItem[] =>
    items.map((item) => {
      const kids = item.children ? { children: markHere(item.children) } : {};
      // The site's own pages are linked from the page's own root.
      if (page.here === undefined || item.href !== `${page.toRoot}${page.here}`) return { ...item, ...kids };
      return { ...item, ...kids, current: true };
    });
  // The page's folder, from the rows BEFORE "you are here" took a link away.
  const inFolder =
    page.here === undefined
      ? undefined
      : folderOfPage(shared.links, [`${page.toRoot}${page.here}`, `${page.root}${page.here}`], shared.instance);
  return navbarRegionsHtml(
    railModel({
      ...shared,
      links,
      folder: inFolder ? folderName(inFolder) : "",
      ...(shared.pages ? { pages: markHere(shared.pages) } : {}),
      toRoot: page.toRoot,
      ...(page.home ? { homeHref: page.home } : {}),
      ...(page.homeName ? { homeName: page.homeName } : {}),
      // A page's own index is already its own; a SHARED one (a guide's
      // declared menu) is marked here like the page tree, so the fold that
      // holds the page arrives open.
      ...(page.documentIndex
        ? { documentIndex: page.documentIndex }
        : shared.documentIndex
          ? { documentIndex: { ...shared.documentIndex, items: markHere(shared.documentIndex.items) } }
          : {}),
    }),
  );
}

const PENDING = 'data-fa-rail="pending"';

/** Inject the page block, the placeholder `<nav>` and the three links; emit the shared data. */
function withSharedRail(
  html: string,
  o: RailOptions,
  root: string,
  documentIndex: NavGroup | undefined,
  shareIndex: boolean,
): string | undefined {
  if (hasRail(html)) return undefined;
  const body = bodyTag(html);
  if (!body) return undefined;
  const asset = railDataAsset(railSharedJson(o, root, shareIndex ? documentIndex : undefined));
  o.emitRailData!(asset.file, asset.body);
  const own = shareIndex ? undefined : documentIndex;
  const page = { data: asset.name, ...(o.here ? { here: o.here } : {}), ...(own ? { documentIndex: own } : {}) };
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const block =
    `<script type="application/json" id="${RAIL_PAGE_ID}" data-fa-root="${esc(root)}" data-fa-to-root="${esc(o.toRoot)}">` +
    JSON.stringify(page).replace(/</g, "\\u003c") +
    `</script>`;
  // Without script the reader still has a way home rather than a blank strip.
  const nav =
    `<nav class="fa-nav" aria-label="folio-assistant" ${PENDING}>` +
    `<a href="${esc(o.toRoot)}/">${esc(o.homeLabel ?? "folio-assistant")}</a></nav>`;
  const at = body.index + body[0].length;
  let out = html.slice(0, at) + block + nav + html.slice(at);
  // The drawing and its style are the platform's code, loaded from
  // `chromeRoot` — the site's own pinned copy on a foreign site.
  const chrome = o.chromeRoot ?? root;
  const tags =
    `<link rel="stylesheet" href="${chrome}/${NAVBAR_CSS}">` +
    // The DATA is written into the site being railed, so it is fetched from
    // this page's own root.
    `<script src="${o.toRoot}/${asset.file}" defer></script>` +
    `<script src="${chrome}/${NAVBAR_JS}" defer></script>`;
  const head = headEndTag(out);
  out = head ? out.slice(0, head.index) + tags + out.slice(head.index) : out.slice(0, at) + tags + out.slice(at);
  return out;
}

/** The shared JSON inside a rail data file's body (what {@link railDataAsset} wrote). */
export function railDataJson(body: string): string {
  return JSON.parse(body.slice(body.indexOf("]=") + 2, body.lastIndexOf(";"))) as string;
}

/** Read a page's own rail block back, or `undefined` when it has none. */
export function railPageOf(html: string): RailPage | undefined {
  const m = new RegExp(`<script type="application/json" id="${RAIL_PAGE_ID}" data-fa-root="([^"]*)" data-fa-to-root="([^"]*)"(?: data-fa-home="([^"]*)")?(?: data-fa-home-name="([^"]*)")?>([^<]*)</script>`).exec(html);
  if (!m) return undefined;
  const unesc = (v: string) => v.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&");
  return {
    ...(JSON.parse(m[5]!) as Omit<RailPage, "root" | "toRoot" | "home" | "homeName">),
    root: unesc(m[1]!),
    toRoot: unesc(m[2]!),
    ...(m[3] !== undefined ? { home: unesc(m[3]) } : {}),
    ...(m[4] !== undefined ? { homeName: unesc(m[4]) } : {}),
  };
}

/**
 * The page as a browser shows it once `navbar.js` has run — for an AUDIT or a
 * test that reads the rail's markup. `readData(name)` returns the shared JSON.
 * A page with no pending rail is returned unchanged.
 */
export function expandRail(html: string, readData: (name: string) => string | undefined): string {
  if (!html.includes(PENDING)) return html;
  const page = railPageOf(html);
  const json = page ? readData(page.data) : undefined;
  if (!page || json === undefined) return html;
  return html.replace(
    new RegExp(`<nav class="fa-nav" aria-label="folio-assistant" ${PENDING}>[\\s\\S]*?</nav>`),
    `<nav class="fa-nav" aria-label="folio-assistant">${renderRailRegions(json, page)}</nav>`,
  );
}
