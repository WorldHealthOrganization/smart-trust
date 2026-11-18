/**
 * ONE navbar, for a Jekyll page and for a mounted page alike.
 *
 * ## Why this module exists at all
 *
 * Owner, 2026-09-21, looking at the IRIS replica's rail working: *"we should have
 * same navbar across all folios though. presented same way. need to comine
 * the two."*
 *
 * There were two. `harness-rail.ts` injected one into pages Jekyll never sees;
 * `docs-ui.css` plus `nav_footer_custom.html` styled the theme's own sidebar.
 * Across three rounds of `hw9g` they were brought to the same BEHAVIOUR — a
 * strip at rest, hover or `☰` to open, `[x]` to close, an inner scroll — by
 * being edited in parallel, twice, with every number derived separately on
 * each side and a test on each asserting its own copy.
 *
 * **That is two implementations agreeing by maintenance, and the agreement has
 * to be re-bought on every change.** This module is where it stops being
 * bought.
 *
 * ## Three regions, and the middle one is the only one that scrolls
 *
 * The owner's layout, and it is structural rather than a styling convention:
 *
 * | region | holds | scrolls |
 * |---|---|---|
 * | `top` | the layer's mark (its open/close control, #1757) and the open document's index when there is one | no |
 * | `graphs` | this KG's own content — `docs/`, `library/`, every declared kind that HAS content | **yes** |
 * | `bottom` | the instantiated harnesses, expandable, each with its avatar (no home row since 2026-10-30: the header's mark, a house by default, is the home link) | no |
 *
 * *"KG libraries is a scrollable stacks between fixed top an bottom parts"*.
 * So the flex column is `0 0 auto` / `1 1 auto` + `overflow-y:auto` / `0 0
 * auto`, and the two fixed regions cannot be scrolled off. A navbar whose
 * `[x]` scrolls away is one you cannot close from the bottom of a long list.
 *
 * ## A MODEL, not a markup composer
 *
 * The caller builds `NavbarModel` and this renders it. That is what makes one
 * component possible: the rail's regions come from the mount table, the
 * sidebar's will come from Jekyll and the declaration, and neither difference
 * reaches the markup. A renderer that branched on "am I a rail or a sidebar"
 * would be the two implementations again with one import.
 *
 * ## What is NOT here, deliberately
 *
 * The harness **avatars and themes** are `603s`'s, in flight on PR #791. This
 * module takes an avatar if the model supplies one and falls back to an
 * initial otherwise; it mints none and knows no theme. When #791 lands, its
 * avatars arrive through the model and nothing here changes — which is the
 * test of whether this boundary was drawn in the right place.
 *
 * @module scripts/lib/navbar
 */

import { BLANK_AVATAR } from "../../schemas/ui/blank-avatar.js";
import {
  NAV_COLLAPSED_PX,
  NAV_MARK_PX as NAV_GLYPH_PX,
  NAV_OPEN_PX,
  NAV_OPEN_WIDE_PX,
  NAV_PAD_PX,
  NAV_STRIP_MQ_PX,
  NAV_WIDE_MQ_PX,
} from "./navbar-geometry.js";

/** One destination. */
export interface NavItem {
  /** Where it goes, already relative to the page being rendered. */
  href?: string;
  /** What it is called. */
  label: string;
  /**
   * The harness this destination belongs to, APPENDED to {@link label} where
   * the harness matters — "Schemas · C@T Harness" — and never folded into it.
   * Bean `ob3m` finding 6, "One name everywhere": the label is the
   * destination's one name on every surface, and this is the only part that
   * may vary.
   */
  qualifier?: string;
  /** A single character or short glyph, shown while the navbar rests. */
  icon?: string;
  /**
   * SVG path data in a 24×24 box, drawn as the mark instead of {@link icon}
   * — a graph typology's own avatar glyph (bean `yag0`). One letter per row made
   * `docs` and `library` two adjacent single letters, and `catalogue` and
   * `code` the SAME letter; a shape the avatar registry already draws cannot
   * collide that way.
   */
  glyphPath?: string;
  /**
   * This row opens a GRAPH TYPOLOGY — a `docs`, `library`, `beans` row — rather
   * than a harness, a page or an index entry. Set by `graphTypologyRowDecor`, the
   * one place a kind row is decorated.
   *
   * DECLARED, never inferred from the mark. A kind row sits in the strip's
   * column (bean `yag0`, the `a.fa-nav-kind` rule in {@link navbarCss}), and
   * that class used to be read off `glyphPath`: "an SVG mark means a kind".
   * True only until #2122 gave seven HARNESSES glyph marks — a DAK IG and
   * SMART Base then took the kind rows' indent and sat flush left of the
   * avatar-marked harnesses beside them (#2151, owner: *"alignment of
   * harnesses is off"*). What a row IS decides where it sits; what its mark
   * is drawn with does not.
   */
  kind?: boolean;
  /**
   * The rest of the row's ACCESSIBLE NAME, after {@link label} — rendered as
   * visually-hidden text inside the link and as its `title`. The visible
   * label stays short; the name a screen reader or a hover gives is full, and
   * always begins with the visible label (WCAG SC 2.5.3).
   */
  description?: string;
  /**
   * An image to use instead of `icon` — the harness's avatar, when it has one.
   *
   * `region` is the image's declared `avatarRegion` (`603s`), as fractions of
   * the image: the part of the art that IS the avatar. Optional, because most
   * marks are already a mark — an icon that fills its own frame needs no crop,
   * and cropping one would be inventing a box nobody measured.
   */
  avatar?: { src: string; title?: string; region?: { x: number; y: number; w: number; h: number }; ground?: "tone" | "none" };
  /** A hue for the item's mark, 0–360. `603s`'s `tone`. */
  tone?: number;
  /**
   * Whether this item has no declared avatar and renders as a themed blank mark.
   */
  blank?: boolean;
  /** True for the route the current page belongs to. */
  current?: boolean;
  /**
   * Nesting under the item above it — 0 or absent for a top-level row.
   *
   * Only the document index uses it today. It is on `NavItem` rather than in
   * that function because a *rendered* indent is the renderer's business: a
   * caller that returned pre-indented labels would be composing markup, which
   * is the thing this module exists to stop callers doing.
   */
  depth?: number;
  /**
   * WHY this row does not open, shown as text beside the label.
   *
   * Only meaningful with no {@link href} — a row that opens owes no
   * explanation — and the wording is the CALLER's, because only the caller
   * knows which of the several reasons applies. `harness-tiles` separates
   * four of them (`HarnessVisualisation.note`) and this renderer picks none
   * of them.
   *
   * ## Why text, and not `title` or `aria-disabled`
   *
   * The Jekyll sidebar reached this row first and said it with
   * `title="declared, with no published viewer"` on a `<span>`. A `<span>` is
   * not focusable, so that label has NO KEYBOARD PATH at all, and `title` on
   * a non-interactive element is not reliably announced — so the surface that
   * did say it said it to a pointer and to nothing else. This rail said
   * nothing whatever: `opacity:.55` and no words, which is state carried by
   * contrast alone. Both are `gjli`.
   *
   * Real text has neither problem and needs no ARIA to fix: it is in the
   * accessibility tree because it is content, it survives a stylesheet that
   * does not load, and it is not a second signal that can disagree with the
   * first. `aria-disabled` was the other candidate and is wrong here for a
   * plainer reason — nothing is disabled. There is no control. A `<span>`
   * marked `aria-disabled` announces a disabled widget that does not exist,
   * which is the "inert row reading as a control" failure rather than a fix
   * for it.
   */
  note?: string;
  /**
   * Rows nested UNDER this one — a harness's own graphs, under the harness.
   *
   * The Jekyll sidebar has rendered these since `603s` (`.fa-harness-tab__graphs`)
   * and this rail never has, which is the single largest difference between the
   * two surfaces: the sidebar lets a reader reach a layer's `library/` from the
   * harness row, and the rail stops at the harness. `sjic` calls that *"two
   * implementations of one navbar, disagreeing about whether a reader can reach
   * a graph"*.
   *
   * It is on `NavItem` rather than expressed as a nested {@link NavGroup}
   * because these rows are not a group: they have no label of their own, they
   * do not collapse separately, and they belong to the row above them. A group
   * would give each harness a second disclosure inside the harnesses
   * disclosure, which is a shape nobody asked for.
   */
  children?: readonly NavItem[];
  /**
   * FOLD the {@link children} under a disclosure with this summary, closed on
   * arrival. Owner, 2026-10-05: *"on this page should have sub-sections
   * collapsible"* (bean `r2ld`). The row itself stays a plain link and the
   * disclosure sits BELOW it, never around it — the shape the sidebar's
   * "Sub-graphs of …" fold already has — because a link inside a `<summary>`
   * is two targets in one row. `<details>`, so it works with no script.
   */
  fold?: string;
  /**
   * A control rendered BESIDE the row — never inside it.
   *
   * The sidebar's ⚙ opens the glass's Harnesses panel with this harness chosen
   * (#1146). Its own comment says why it is a sibling: *"the tab is a link, and
   * a control nested in a link is two targets a keyboard cannot tell apart."*
   *
   * `data` is the attribute the page's delegation reads. With no script it does
   * nothing and the row still works, so a surface that ships no script simply
   * declares no action rather than rendering a dead control.
   */
  action?: { readonly data: string; readonly value: string; readonly label: string; readonly glyph: string };
}

/** A labelled group of items, which may be collapsed behind a disclosure. */
export interface NavGroup {
  label: string;
  icon?: string;
  /**
   * SVG path data in a 24×24 box, drawn as the group's mark instead of
   * {@link icon}. Owner, 2026-11-08: *"why weird grid icons in left navbar?
   * use letters if nothing better but i am sure you get a good page and
   * folder icon"* — the `▥ ▤ ▦` glyphs read as grids, not as pages,
   * folders and harnesses. {@link GROUP_GLYPHS} holds the three.
   */
  glyphPath?: string;
  items: readonly NavItem[];
  /**
   * Render as a `<details>` the reader opens.
   *
   * The owner's "exploding menu from folio-assisnt" — and `<details>` rather
   * than a scripted disclosure for the reason `nav_footer_custom.html` already
   * records: keyboard-operable, announces its own state, and works with no
   * script at all, which matters because this IS navigation.
   */
  collapsible?: boolean;
  /** Open on arrival. Only meaningful with `collapsible`. */
  open?: boolean;
}

export interface NavbarModel {
  /** The layer this navbar belongs to, shown in the fixed top. */
  instance: string;
  /**
   * The layer's MARK in the header — its avatar image or its registry
   * glyph, whichever `harness-tiles.ts` resolved (bean `2vpn`), or failing
   * both its initial on its tone. Owner, 2026-10-01 (#1757): *"QA flag each page needs
   * avatar or atleast letter to be clickable"*.
   *
   * The header is the navbar's ONE open/close control. It was a bare `☰`
   * beside the name with a separate `[x]`, and on the Jekyll site the avatar
   * already toggled the same checkbox — three controls over one bit of state,
   * which the owner asked to be one: *"the hamburger menu thing and [x] seems
   * to replicate same functionality as clicking on avatar. excise"*.
   *
   * Absent, the header still draws a LETTER: the layer's initial. It never
   * falls back to a glyph that names an action rather than the layer.
   */
  mark?: Pick<NavItem, "avatar" | "glyphPath" | "tone" | "icon">;
  /**
   * Whether this surface renders the header at all — the FOURTH declared
   * difference between surfaces, beside {@link hrefs} and {@link openControl}.
   *
   * `"none"` on the Jekyll sidebar, and only there: the theme already draws
   * the layer's avatar as `.site-title`, which `docs-ui.js` makes the
   * open/close control from 50rem up. A second header in the footer was the
   * `☰` the owner asked to excise (#1757) — the same control, drawn twice.
   */
  head?: "mark" | "none";
  /**
   * The CURRENT visualiser's own navigation — the section that belongs to the
   * page being read rather than to the graph it sits in. Owner, 2026-10-01:
   * *"todos page should have a LHS navbar to help see todos associated the
   * KG"* and *"by default, only the current pages visualiers LHS navbar is
   * open"*.
   *
   * So when it is present it renders OPEN and {@link graphs} renders FOLDED:
   * one disclosure open on arrival, and it is the one about this page.
   * `check-viewer-nav.ts` grades both halves (`visualiser-nav`,
   * `single-open`).
   */
  visualiser?: NavGroup;
  /**
   * The SITE's own page tree — "Pages" (owner, 2026-10-15, "folio rail
   * everywhere"): on a just-the-docs site the rail carries what the theme's
   * `site-nav` carried, built on the server (`lib/jekyll-pages-nav.ts`).
   * Drawn in the scrolling middle after the page's own section and before the
   * graphs; folded on arrival unless it holds the current page and the page
   * has no section of its own — the same rule as {@link graphs}. Absent on a
   * site with no page tree, and then not drawn at all.
   */
  pages?: NavGroup;
  /**
   * The layer's own themed root — its front door, in the fixed top.
   *
   * NOT inside the graphs group: a group labelled "Graphs" that contains the
   * layer itself is a label that does not tell the truth, and the root is
   * the one destination that should stay reachable when the graphs are folded
   * away. The header beside it (the layer's mark) is a TOGGLE, not a link, so this is the
   * only way to the layer's front page from a page beneath it.
   */
  root?: NavItem;
  /**
   * The open document's index, when a document is open.
   *
   * *"when a document or other indexed object is opened, the document
   * index/idices are shown in a navbar tab/menu"*. It sits in the FIXED top
   * with the layer, not in the scrollable middle, because it is about the
   * thing the reader is looking at rather than about the graph they are in.
   * `undefined` when nothing is open, and the region is then absent rather
   * than empty — an empty disclosure invites a click that does nothing.
   */
  documentIndex?: NavGroup;
  /**
   * fsh-guts, the trashcan that is kept, as a control in the FIXED top — issue
   * #1925, owner 2026-10-02: *"(also add fsh-guts icon to LHS top navbar)"*.
   *
   * It is where a sticky sent to fsh-guts is restored from, which is why it is
   * on every page rather than inside a settings panel. Rendered `hidden`:
   * the list, the count and the restore are all script (`docs-ui.js`
   * `mountFshGutsNav`), so with no script it is absent rather than a button
   * that does nothing. Absent from the model, nothing is rendered at all.
   */
  fshGuts?: { label: string };
  /**
   * The KG's own graphs — the scrollable middle, as ONE collapsible group.
   *
   * Owner, 2026-09-21: *"librarues should be in hambuger menu so can collase
   * all"*. A group rather than a bare list, so the whole stack folds in one
   * click; `open: true` so the default is to show it, because a navbar whose
   * content arrives folded is a navbar that looks empty.
   *
   * *"there shuold be all the harness controlled dirs/graphs"* — EVERY
   * declared graph, not only the ones with a viewer. A graph with no published
   * viewer appears with no href, which `harness-tiles` already words exactly
   * right: **declared and not rendered is a gap, not a dead link.** Omitting it
   * would answer "what is in this KG" with a shorter and wronger list.
   *
   * **Absent only when another navigation already owns the middle region.**
   * That is true on exactly one surface — the Jekyll theme renders its own
   * `<nav id="site-nav">` page tree there — and it is why this became optional
   * rather than being satisfied with an empty group: an empty `<details>`
   * invites a click that does nothing, which is the rule the rest of this
   * module follows for a row with no destination.
   */
  graphs?: NavGroup;
  /**
   * The instantiated harnesses: a PANEL in the fixed bottom, opened by the
   * Harnesses icon in the controls row. Owner, 2026-11-13: *"remove the
   * harnesses navbar, instead add an icon to the controls to show the
   * harnesses."* It was a `<details>` disclosure with its own row.
   */
  harnesses?: NavGroup;
  /**
   * The FOLDER the page is in, shown under the layer's name in the header.
   * Owner, 2026-11-13: on a page opened from "Library" in Folders the header
   * reads the site's name with "Library" beneath it. Derived from the Folders list
   * by the page's address ({@link folderOfPage}); absent on a page in no
   * folder, and then the header is the name alone.
   */
  folder?: string;
  /**
   * Where the header goes: the site's landing page. Owner, 2026-10-30: *"who
   * eblmen not clicable to go to landing page. also dont need home on bottomof
   * harnes navbars."* So the layer's mark and name in the header are the
   * home link, and the separate home row at the foot of the bar is gone.
   * Absent, the header is only the open/close control, as before.
   */
  headHref?: string;
  /**
   * What the header is CALLED when home is a larger site than this one: an IG
   * composed into smart-html-jtd shows "SMART Guidelines" and the house
   * (owner, 2026-11-10), not its own name and mark. Absent, the
   * header is the instance's.
   */
  headName?: string;
  /**
   * HOW an href is written — the difference between the two surfaces, DECLARED.
   *
   * `sjic`'s last box asks for one renderer for a Jekyll page and a mounted
   * page *"with the difference DECLARED rather than branched on"*. This is one
   * of the two things that actually differ, and it is a property of the
   * SURFACE rather than of any row, which is why it sits on the model and not
   * on {@link NavItem}.
   *
   * - `"resolved"` (the default) — the caller has already made the href
   *   relative to the page being rendered. That is what every injected rail
   *   does: `railModel` composes `toRoot` and the page knows where it is.
   * - `"liquid"` — the href is site-root-relative and is emitted wrapped in
   *   Jekyll's `relative_url` filter, which applies the baseurl at build time.
   *   A Jekyll page cannot use a resolved href: the same include is rendered
   *   into pages at every depth, and the site is served from `/folio-assistant/`
   *   on the canonical deploy and from `/folio-assistant/branches/<branch>/` on a
   *   preview. `68au` is what omitting the filter costs — every graph tile in
   *   the navbar 404'd.
   *
   * Emitting a Liquid filter from a TypeScript renderer is not a new idea
   * here: `docs/_includes/generated/todo-listing.html` is generated, gated by
   * a `--check`, and emits `{{ '…' | relative_url }}` for exactly this reason.
   */
  hrefs?: "resolved" | "liquid";
  /**
   * Whether this rendering emits the open checkbox, or only labels for one
   * rendered elsewhere on the same page.
   *
   * The third declared difference, and the only one that is about a surface
   * rendering the navbar MORE THAN ONCE. An injected rail is written into a
   * page exactly once, so it always carries its own input; just-the-docs
   * includes its footer extension point twice per page by design, so the
   * second copy must render `"labels"`. See {@link navbarRegionsHtml} for what
   * the duplicate cost and why giving the second copy its own id was worse.
   */
  openControl?: "input" | "labels";
}

/** How a rendering pass writes its hrefs. Threaded rather than global. */
export interface Ctx {
  readonly liquid: boolean;
  /** Numbers the folds of ONE rendering, so each toggle names its own list. */
  readonly folds?: { n: number };
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * One href, written the way this surface declares.
 *
 * The Liquid form is single-quoted because a path may contain a double quote
 * only if somebody has gone badly wrong upstream, and `esc` has already turned
 * `"` into `&quot;` by the time this runs — so the quote that delimits the
 * filter's argument cannot be the one that closes the attribute.
 */
const href = (path: string, c: Ctx): string =>
  c.liquid ? `{{ '${esc(path)}' | relative_url }}` : esc(path);

/**
 * THE GEOMETRY IS NOT DECIDED HERE ANY MORE.
 *
 * It was, and `docs-ui.css` decided it again, separately — 40px against 56px
 * at rest and 232px against 248px open, on two navbars the owner had asked to
 * be "presented same way". `lib/navbar-geometry.ts` is the single record and
 * carries the whole argument for whose numbers won.
 *
 * `NAV_GLYPH_PX` is kept as the name callers already import; the record calls
 * the same column `markPx`, because it holds an avatar as often as a glyph.
 */
export {
  NAV_COLLAPSED_PX,
  NAV_OPEN_PX,
  NAV_OPEN_WIDE_PX,
  NAV_PAD_PX,
  NAV_WIDE_MQ_PX,
} from "./navbar-geometry.js";
export { NAV_MARK_PX as NAV_GLYPH_PX } from "./navbar-geometry.js";

/** One nesting level in the rail, px (owner, 2026-11-10: a whole 40px mark per level was too much). */
export const NAV_DEPTH_STEP_PX = 16;
/** How far a section's listed rows (Folders' kinds) sit in from its own row, px. */
export const NAV_KIND_INDENT_PX = 8;
/** The drag edge's limits on the open bar's width, px, and where the width is remembered. */
export const NAV_RESIZE_MIN_PX = 200;
export const NAV_RESIZE_MAX_PX = 600;
export const NAV_WIDTH_KEY = "fa-nav-w";

/**
 * The navbar's stylesheet, scoped to `.fa-nav` so a host page keeps its own.
 *
 * Three ways in, one way back: `:hover` while the pointer is on it,
 * `:focus-visible` inside it for a keyboard, and the header — the layer's mark —
 * which checks a box so it STAYS open, which is what a touch device needs,
 * having no hover at all. The same header unchecks it (#1757: the separate
 * `☰` and `[x]` were two more controls for that one bit). `board-windows`' `l4zi`: an action whose inverse is not
 * reachable is not a toggle.
 *
 * No JavaScript. On a mounted page that is not a preference: those documents
 * are copied verbatim from layers the harness does not control, and
 * injecting a nav into somebody else's page is one claim while injecting
 * script into it is a larger one.
 */
export function navbarCss(): string {
  return [
    // THE PALETTE FOLLOWS THE PAGE'S SCHEME (owner, 2026-10-30: *"light mode
    // navbar is not working"*). It was dark on every page, so a light page had
    // a dark bar beside it. The scheme is read the way the theme reads it:
    // `data-fa-scheme` when the page sets it, else the OS. Light is GitHub's
    // light palette; the dead-row dim is stronger there because `.55` of
    // #1f2328 over #f6f8fa is 3.6:1, under 4.5:1, while `.72` is 6.1:1.
    `.fa-nav{--fa-nav-bg:#1f2328;--fa-nav-ink:#e6edf3;--fa-nav-line:#30363d;--fa-nav-hover:#30363d;--fa-nav-dim:.55}`,
    `:root[data-fa-scheme="light"] .fa-nav{--fa-nav-bg:#f6f8fa;--fa-nav-ink:#1f2328;--fa-nav-line:#d0d7de;--fa-nav-hover:#eaeef2;--fa-nav-dim:.72}`,
    `@media(prefers-color-scheme:light){:root:not([data-fa-scheme]) .fa-nav{--fa-nav-bg:#f6f8fa;--fa-nav-ink:#1f2328;--fa-nav-line:#d0d7de;--fa-nav-hover:#eaeef2;--fa-nav-dim:.72}}`,
    // The page sits beside the strip; on desktop (>= NAV_STRIP_MQ_PX), opening
    // shrinks/pushes content beside it so they do not overlap (bean `ei4q`).
    // Phone stays an overlay drawer.
    `body{padding-inline-start:${NAV_COLLAPSED_PX}px}`,
    `.fa-nav{position:fixed;top:0;inset-inline-start:0;bottom:0;width:${NAV_COLLAPSED_PX}px;z-index:2147483000;`,
    `background:var(--fa-nav-bg);color:var(--fa-nav-ink);overflow:hidden;`,
    `font:14px/1.5 var(--fa-font-sans,system-ui,sans-serif)}`,
    `.fa-nav:hover,.fa-nav:has(:focus-visible),.fa-nav:has(.fa-nav-open:checked){width:var(--fa-nav-w,${NAV_OPEN_PX}px)}`,
    `.fa-nav:not(:hover):not(:has(:focus-visible)):not(:has(.fa-nav-open:checked)) .fa-glass-handle__label{opacity:0}`,
    `@media(min-width:${NAV_STRIP_MQ_PX}px){`,
    `body:has(.fa-nav:hover),body:has(.fa-nav :focus-visible),body:has(.fa-nav-open:checked){padding-inline-start:var(--fa-nav-w,${NAV_OPEN_PX}px)}}`,
    `@media(min-width:${NAV_WIDE_MQ_PX}px){`,
    `.fa-nav:hover,.fa-nav:has(:focus-visible),.fa-nav:has(.fa-nav-open:checked){width:var(--fa-nav-w,${NAV_OPEN_WIDE_PX}px)}`,
    `.fa-nav-in{width:var(--fa-nav-w,${NAV_OPEN_WIDE_PX}px)}`,
    `body:has(.fa-nav:hover),body:has(.fa-nav :focus-visible),body:has(.fa-nav-open:checked){padding-inline-start:var(--fa-nav-w,${NAV_OPEN_WIDE_PX}px)}}`,
    // SMOOTH: THE RAIL SLIDES, THE PAGE STEPS (owner, 2026-11-15: *"open and
    // closing the LHS navbar is not smooth"*, issue #2343). The push above
    // used to ANIMATE `body`'s padding, which re-lays out and re-wraps the
    // whole document every frame: on smart-ra's DPI-H page (22,101 elements)
    // one open was 14 layouts, 140ms of layout and 648ms of style, with 13
    // frames over 20ms. Only the rail's own width animates now; its inner
    // column has a fixed width, so that costs the rail and nothing else. The
    // page moves ONCE: at once on open, so the rail slides into the space it
    // left, and after the rail has finished on close, so the two never
    // overlap. A 0s transition with a delay is that one step. No motion at all
    // under `prefers-reduced-motion`: the rail's slide used to sit outside it.
    `@media(prefers-reduced-motion:no-preference){.fa-nav{transition:width .14s ease}`,
    `body{transition:padding-inline-start 0s linear .14s}`,
    `body:has(.fa-nav:hover),body:has(.fa-nav :focus-visible),body:has(.fa-nav-open:checked){transition-delay:0s}}`,
    // Clipped in place, never parked at `left:-9999px`: on a right-to-left
    // page that is the scrollable side, and it widened the page ~10,000px
    // (bean `2r2n`). Same rule as `.fa-nav-open` in docs-ui.css.
    `.fa-nav-open{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`,
    // THE THREE REGIONS. `min-height:0` on the middle is not optional: a flex
    // child defaults to `min-height:auto`, which refuses to shrink below its
    // content, so the column grows past the viewport and the FIXED BOTTOM
    // scrolls off the screen -- taking the harnesses and home with it.
    `.fa-nav-in{width:var(--fa-nav-w,${NAV_OPEN_PX}px);height:100%;display:flex;flex-direction:column}`,
    `.fa-nav-top{flex:0 0 auto}`,
    `.fa-nav-graphs{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden}`,
    `.fa-nav-bottom{flex:0 0 auto;border-top:1px solid var(--fa-nav-line)}`,
    `.fa-nav-head{display:flex;align-items:center;gap:8px;padding:10px ${NAV_PAD_PX}px;`,
    `border-bottom:1px solid var(--fa-nav-line);cursor:pointer;user-select:none}`,
    // The header is a <label>, which is not in the tab order; the checkbox it
    // drives is, clipped in place. So the keyboard's focus ring is drawn on
    // the header while the box has focus, or a keyboard user toggles a
    // control they cannot see is focused.
    `.fa-nav:has(.fa-nav-open:focus-visible) .fa-nav-head{outline:2px solid #58a6ff;outline-offset:-2px}`,
    // THE HEADER AS HOME LINK (owner, 2026-10-30). The label lies over the
    // link at rest, so a touch screen's first tap opens the bar. Where the
    // pointer can HOVER, hovering already opens the bar, so there the label
    // gets out of the way and a click is the home link; on a touch screen it
    // waits for the pin. A keyboard reaches the link by Tab whatever lies
    // over it. A pinned-open bar shows the label as a small close control.
    `.fa-nav-head--home{position:relative;padding:0;cursor:default}`,
    `.fa-nav .fa-nav-head-link{flex:1 1 auto;min-width:0;padding:10px ${NAV_PAD_PX}px}`,
    `.fa-nav .fa-nav-head-link:hover{background:var(--fa-nav-hover)}`,
    `.fa-nav-head-toggle{position:absolute;inset:0;cursor:pointer}`,
    `.fa-nav-head-toggle>span[aria-hidden]{display:none}`,
    `@media(hover:hover){.fa-nav:hover .fa-nav-head-toggle{display:none}}`,
    `.fa-nav:has(.fa-nav-open:checked) .fa-nav-head-toggle{display:inline-flex;position:static;align-items:center;justify-content:center;`,
    `min-width:24px;min-height:24px;margin-inline-end:${NAV_PAD_PX - 4}px;border-radius:4px;font-size:18px}`,
    `.fa-nav:has(.fa-nav-open:checked) .fa-nav-head-toggle>span[aria-hidden]{display:inline-block}`,
    `.fa-nav-head-toggle:hover{background:var(--fa-nav-hover)}`,
    `.fa-nav-glyph{flex:0 0 ${NAV_GLYPH_PX}px;text-align:center;font-size:16px}`,
    `.fa-nav-glyph.fa-nav-blank{height:${NAV_GLYPH_PX}px;display:inline-block}`,
    `.fa-nav-glyph img{width:${NAV_GLYPH_PX}px;height:${NAV_GLYPH_PX}px;display:block}`,
    // A kind's SVG glyph (bean `yag0`): drawn in the ink colour on its tone.
    `.fa-nav-glyph svg{width:${NAV_GLYPH_PX}px;height:${NAV_GLYPH_PX}px;display:block;padding:4px;box-sizing:border-box}`,
    // A CROPPED mark: the frame clips and the image is positioned inside it.
    // The `img` rule above sizes an UNCROPPED avatar; a cropped one carries
    // its own width/height inline, so this resets the two that would fight it.
    `.fa-nav-crop{position:relative;overflow:hidden;height:${NAV_GLYPH_PX}px}`,
    `.fa-nav-crop img{position:absolute;width:auto;height:auto;max-width:none}`,
    `.fa-nav-name{font-weight:600}`,
    `.fa-nav a{display:flex;align-items:center;gap:8px;padding:6px ${NAV_PAD_PX}px;`,
    `color:var(--fa-nav-ink);text-decoration:none}`,
    `.fa-nav a:hover{background:var(--fa-nav-hover)}`,
    `.fa-nav a[aria-current="page"]{background:var(--fa-nav-hover);font-weight:600}`,
    // An item with nowhere to go is NOT a link -- `pb04`: a dead link is worse
    // than no link, because it invites a click and then reads as broken.
    // THE DIM STAYS, AND IT WAS NEVER THE PROBLEM. `opacity:.55` over
    // `#1f2328` composites `#e6edf3` to `(140,146,152)`, which is 5.03:1 --
    // measured, and clear of 4.5:1. The first version of this comment claimed
    // it failed; it does not, and the fault is the other one: the dim was the
    // ONLY signal, so "declared and not built" was carried by contrast alone
    // with no words anywhere on this surface. `.fa-nav-note` is the words.
    // `cursor:default` so the pointer does not promise a click either.
    `.fa-nav-dead{display:flex;align-items:center;gap:8px;padding:6px ${NAV_PAD_PX}px;`,
    `opacity:var(--fa-nav-dim);cursor:default}`,
    // The reason sits BESIDE the label, not under it: the strip is one row per
    // item, and a second line would make these the only rows in the navbar
    // with a different height. At 11px it is small text, so it needs 4.5:1 in
    // its own right -- which it has, being the same composited ink as the
    // label it sits next to.
    `.fa-nav-note{margin-inline-start:auto;font-size:11px;font-style:italic;white-space:nowrap}`,
    // A ROW WITH A CONTROL, and its children beneath both.
    //
    // `grid` rather than flex because the row and its control share one line
    // while the children take a full-width second one, and that is a
    // two-dimensional statement. With flex it would be a wrap the browser
    // happens to make, which is the same layout only while the labels are
    // short.
    //
    // The control's column is `auto`, so a row with no control has no reserved
    // gutter — the collapsed strip is `NAV_COLLAPSED_PX` wide and a reserved
    // column it never uses is a strip that is narrower than it looks.
    `.fa-nav-row{display:grid;grid-template-columns:1fr auto;align-items:center}`,
    `.fa-nav-row>a,.fa-nav-row>.fa-nav-dead{min-width:0}`,
    `.fa-nav-kids{grid-column:1/-1}`,
    `.fa-nav-kids[hidden]{display:none}`,
    // THE FOLD TOGGLE sits on its parent's row (owner, 2026-10-15): a
    // chevron in the row's control column, turned when open. 24px target
    // (SC 2.5.8); hidden with the labels when the strip is at rest, like
    // every other control here.
    `.fa-nav-row--fold{grid-template-columns:1fr auto auto}`,
    `.fa-nav-row--fold>a,.fa-nav-row--fold>.fa-nav-dead{overflow:hidden}`,
    `.fa-nav-row--fold>a .fa-nav-label,.fa-nav-row--fold>.fa-nav-dead .fa-nav-label{overflow:hidden}`,
    `.fa-nav-twisty{display:none;align-items:center;justify-content:center;min-width:24px;min-height:24px;`,
    `margin-inline-end:${NAV_PAD_PX - 4}px;padding:0;background:none;border:0;border-radius:4px;color:inherit;cursor:pointer;opacity:.75}`,
    `.fa-nav-twisty:hover,.fa-nav-twisty:focus-visible{opacity:1;background:var(--fa-nav-hover)}`,
    `.fa-nav-twisty>span{display:inline-block;transition:transform .12s}`,
    `.fa-nav-twisty[aria-expanded="true"]>span{transform:rotate(90deg)}`,
    // RIGHT-TO-LEFT (owner, 2026-11-12: *"in RTL, the LHS navbar needs to be
    // RHS"*). Every edge above is a LOGICAL property, so on a `dir="rtl"` page
    // the bar, its padding, its indents, its drag edge and its tooltips mirror
    // with no second set of numbers. Only the two arrow glyphs need saying:
    // a closed fold points into the line (◂), and the close control points out.
    `[dir="rtl"] .fa-nav-twisty[aria-expanded="false"]>span,[dir="rtl"] .fa-nav-head-toggle>span[aria-hidden]{transform:scaleX(-1)}`,
    // The control is hidden with the labels rather than on its own timer: at
    // rest the strip shows marks only, and a ⚙ floating beside a mark with no
    // label names nothing. Same trigger as `.fa-nav-label`, so the two cannot
    // disagree about when the navbar is open.
    `.fa-nav-action{display:none;background:none;border:0;cursor:pointer;`,
    `padding:0 ${NAV_PAD_PX}px;font-size:13px;line-height:1;color:inherit;opacity:.7}`,
    `.fa-nav-action:hover,.fa-nav-action:focus-visible{opacity:1}`,
    `.fa-nav:hover .fa-nav-action,.fa-nav:has(:focus-visible) .fa-nav-action,`,
    `.fa-nav:has(.fa-nav-open:checked) .fa-nav-action{display:block}`,
    `.fa-nav:hover .fa-nav-twisty,.fa-nav:has(:focus-visible) .fa-nav-twisty,`,
    `.fa-nav:has(.fa-nav-open:checked) .fa-nav-twisty{display:inline-flex}`,
    // THE EXPLODING MENU. `<details>` so it is keyboard-operable and announces
    // its own state with no script.
    `.fa-nav-group>summary{display:flex;align-items:center;gap:8px;padding:8px ${NAV_PAD_PX}px;`,
    `cursor:pointer;user-select:none;list-style:none}`,
    `.fa-nav-group>summary::-webkit-details-marker{display:none}`,
    `.fa-nav-group>summary:hover{background:var(--fa-nav-hover)}`,
    `.fa-nav-group[open]>summary{font-weight:600}`,
    `.fa-nav-group .fa-nav-sub a{padding-inline-start:${NAV_PAD_PX + NAV_GLYPH_PX + 8}px}`,
    // A graph-typology row carries its OWN mark (bean `yag0`), so it sits in the
    // strip's column like the inert rows beside it. Indented as above, a
    // LINKED row's mark was pushed past the 56px strip at rest while an inert
    // row's was not — measured on a built IRIS replica page — so the strip showed
    // marks only for the rows that do not open.
    `.fa-nav-group .fa-nav-sub .fa-nav-dead{padding-inline-start:${NAV_PAD_PX + NAV_GLYPH_PX + 8}px}`,
    // Slightly in from the section's own row (owner, 2026-11-10: "lists of
    // folders should be slightly indented"), and the mark still inside the strip.
    `.fa-nav-group .fa-nav-sub a.fa-nav-kind,.fa-nav-group .fa-nav-sub .fa-nav-dead.fa-nav-kind{padding-inline-start:${NAV_PAD_PX + NAV_KIND_INDENT_PX}px}`,
    `.fa-nav-tone{border-radius:3px}`,
    // A TONED MARK CARRIES ITS OWN INK. Its glyph strokes in `currentColor`,
    // which was the rail's ink: light on the dark rail, but #1f2328 on a 28%
    // ground in light mode, about 1.5:1. Dark: a deep ground under light ink.
    // Light: a pale tint of the hue under a deep shade of it. Over all 360
    // hues the worst pair is 5.5:1 dark and 7.2:1 light (WCAG AA is 4.5:1).
    `.fa-nav-tone[style*="--fa-nav-hue"]{background:hsl(var(--fa-nav-hue) 45% 28%);color:#f6f8fa}`,
    `:root[data-fa-scheme="light"] .fa-nav-tone[style*="--fa-nav-hue"]{background:hsl(var(--fa-nav-hue) 50% 90%);color:hsl(var(--fa-nav-hue) 60% 20%)}`,
    `@media(prefers-color-scheme:light){:root:not([data-fa-scheme]) .fa-nav-tone[style*="--fa-nav-hue"]{background:hsl(var(--fa-nav-hue) 50% 90%);color:hsl(var(--fa-nav-hue) 60% 20%)}}`,
    // Labels are held invisible at rest rather than merely clipped: clipping
    // is a geometry argument, and a host stylesheet moves where a label starts
    // without touching any of these numbers. `opacity`, not `display:none` --
    // a screen reader should still reach them.
    // ONE LINE, FULL NAME ON HOVER (owner, 2026-11-14, replacing the
    // 2026-11-10 option D wrap): "titles on LHS navbar too long … they need
    // to be one line w/ hover to show more". A wrapped IRIS title ran to ten
    // lines. The row's `title` carries the whole name (itemHtml), and the
    // drag edge still widens the bar for a reader who wants more of it.
    `.fa-nav-label{min-width:0;flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transition:opacity .12s ease}`,
    // THE HEADER'S TWO LINES: the layer, and under it the open folder
    // (owner, 2026-11-13), each cut to one line like every label here.
    `.fa-nav-titles{display:flex;flex-direction:column;min-width:0;flex:1 1 auto;line-height:1.25}`,
    `.fa-nav-folder{font-size:12px;font-weight:400}`,
    // THE CONTROLS AND THEIR PANEL, at the foot (owner, 2026-11-13). The panel
    // opens upward over the scrolling middle, which shrinks to make room.
    `.fa-nav-controls{display:flex;flex-wrap:wrap;padding:4px 8px;gap:2px}`,
    `.fa-nav-controls:empty{display:none}`,
    // Its icon moved into the row and its panel shut, the bottom is empty.
    `.fa-nav-bottom:has(>.fa-nav-pop[hidden]):has(>.fa-nav-controls:empty){display:none}`,
    `.fa-nav .fa-nav-controls>.fa-nav-icon,.fa-nav .fa-nav-icons>.fa-nav-harnesses{display:flex;align-items:center;justify-content:center;width:32px;height:32px;`,
    `padding:0;border:0;border-radius:4px;background:none;color:inherit;cursor:pointer}`,
    `.fa-nav .fa-nav-harnesses svg{width:18px;height:18px}`,
    `.fa-nav .fa-nav-harnesses:hover,.fa-nav .fa-nav-harnesses:focus-visible,.fa-nav .fa-nav-harnesses[aria-expanded="true"]{background:var(--fa-nav-hover)}`,
    `.fa-nav-pop{max-height:50vh;overflow-y:auto;overflow-x:hidden;padding:4px 0;border-bottom:1px solid var(--fa-nav-line)}`,
    `.fa-nav-pop[hidden]{display:none}`,
    `.fa-nav-pop-title{padding:4px ${NAV_PAD_PX}px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em;opacity:.8}`,
    // A bullet is a dot, not a 32px mark: its column is the dot's width.
    `.fa-nav-glyph.fa-nav-bullet{flex-basis:8px}`,
    `.fa-nav-glyph.fa-nav-bullet:empty{flex-basis:0;margin-inline-end:-8px}`,
    // THE DRAG EDGE (owner, 2026-11-10, option D): the open bar's right edge
    // widens it; `wireNavResize` sets `--fa-nav-w` and remembers it.
    `.fa-nav-resize{position:absolute;top:0;inset-inline-end:0;bottom:0;width:6px;cursor:ew-resize;z-index:1;display:none;touch-action:none}`,
    `.fa-nav-resize:hover,.fa-nav-resize:focus-visible,.fa-nav-resize[data-active]{background:#58a6ff;outline:none}`,
    `.fa-nav:hover .fa-nav-resize,.fa-nav:has(:focus-visible) .fa-nav-resize,.fa-nav:has(.fa-nav-open:checked) .fa-nav-resize{display:block}`,
    `:root[data-fa-nav-resizing],:root[data-fa-nav-resizing] *{cursor:ew-resize!important;user-select:none!important}`,
    `:root[data-fa-nav-resizing] .fa-nav,:root[data-fa-nav-resizing] body{transition:none!important}`,
    `.fa-nav:hover .fa-nav-label,.fa-nav:has(:focus-visible) .fa-nav-label,`,
    `.fa-nav:has(.fa-nav-open:checked) .fa-nav-label{opacity:1}`,
    `@media print{.fa-nav{display:none}body{padding-inline-start:0}}`,
    `.fa-nav-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}`,
    ...railTipCss(),
  ].join("");
}

/**
 * THE TOOLTIP ON AN ICON-ONLY CONTROL — owner's ruling on bean `ob3m`
 * finding 1, 2026-10-01: *"show each icon's name as a tooltip on hover or
 * keyboard focus."* Option 1 of 4; always-visible captions were option 2 and
 * were NOT chosen, so the strip stays `NAV_COLLAPSED_PX` wide.
 *
 * WHICH CONTROLS. One whose name is in `aria-label` and nowhere visible — the
 * `⚙` here, the icon row on the docs site. A row with a `.fa-nav-label` is
 * NOT one: hover and keyboard focus open this rail, and the label then reads
 * beside its own mark, which is the name in the place a reader looks. A
 * tooltip there would say the same word twice, 8px apart.
 * `check-viewer-nav.ts`' `rail-tips` flag is the rule, read off the markup.
 *
 * CSS ONLY, because this rail carries no script (see `navbarCss`). The
 * pseudo-element is `position:fixed` with `top` left `auto`, so it takes its
 * STATIC position vertically — level with its own control — while `left`
 * puts it beyond the strip's right edge, which is what "not covering the
 * icon" means. Fixed is also what keeps it from being CLIPPED: `.fa-nav` is
 * `overflow:hidden`, and an `overflow` box clips a fixed descendant only when
 * it is that descendant's containing block, which nothing here is.
 *
 * ONE NAME, NOT TWO. `content: … / ""` gives the generated text an EMPTY
 * alternative, so it never enters the accessibility tree; the control's name
 * stays its `aria-label`. The first `content` is the fallback for an engine
 * that cannot parse the alt syntax and drops the second declaration.
 *
 * `docs-ui.css` paints the same tooltip on the docs site's strip under
 * `.side-bar`, in that theme's two schemes. Different selectors on purpose:
 * `navbar-css-single-source.test.ts` holds a SHARED selector to one body, and
 * these two differ in colour and in the widths they read.
 */
function railTipCss(): string[] {
  const at = (w: number) => `${w + 8}px`;
  return [
    `.fa-nav [data-fa-tip]::after{content:attr(data-fa-tip);content:attr(data-fa-tip) / "";`,
    `position:fixed;inset-inline-start:${at(NAV_COLLAPSED_PX)};z-index:2147483001;padding:4px 8px;border-radius:4px;`,
    `background:#1f2328;color:#ffffff;border:1px solid #58a6ff;box-shadow:0 2px 8px rgba(0,0,0,.35);`,
    `font:600 13px/1.3 var(--fa-font-sans,system-ui,sans-serif);`,
    `letter-spacing:normal;text-transform:none;white-space:nowrap;pointer-events:none;`,
    // `opacity` alone, not `visibility`: the rail is CLOSED, never hidden, and
    // `navbar.test.ts` holds this stylesheet to carrying no `visibility:hidden`
    // at all. With `pointer-events:none` an invisible tooltip intercepts nothing.
    `opacity:0}`,
    `.fa-nav [data-fa-tip]:hover::after,.fa-nav [data-fa-tip]:focus-visible::after{opacity:1}`,
    // Beyond the strip at whatever width it has: open, the controls it names
    // sit inside a wider rail and the tooltip moves out with its edge.
    `.fa-nav:hover [data-fa-tip]::after,.fa-nav:has(:focus-visible) [data-fa-tip]::after,`,
    `.fa-nav:has(.fa-nav-open:checked) [data-fa-tip]::after{inset-inline-start:calc(var(--fa-nav-w,${NAV_OPEN_PX}px) + 8px)}`,
    `@media(min-width:${NAV_WIDE_MQ_PX}px){.fa-nav:hover [data-fa-tip]::after,`,
    `.fa-nav:has(:focus-visible) [data-fa-tip]::after,.fa-nav:has(.fa-nav-open:checked) [data-fa-tip]::after{inset-inline-start:calc(var(--fa-nav-w,${NAV_OPEN_WIDE_PX}px) + 8px)}}`,
    `@media(prefers-reduced-motion:no-preference){.fa-nav [data-fa-tip]::after{transition:opacity .12s ease}}`,
  ];
}

/** The TEXT an item's mark shows, when the mark is a text glyph rather than an image, a blank or a drawn path. */
function initialOf(i: NavItem): string | undefined {
  if (i.avatar || i.blank || i.glyphPath === BLANK_AVATAR.glyph) return undefined;
  if (i.glyphPath && !i.icon) return undefined;
  return i.icon ?? i.label.slice(0, 1).toUpperCase();
}

/**
 * Every avatar image is LAZY. A mark is a crop of a full landing-card picture
 * (the declared `mark.src` of three harnesses, 100–355 KB each), and most marks
 * sit in the Harnesses disclosure, which arrives folded: measured on a folio
 * page, 2026-10-10, three card images (685 KB) were fetched for a section of
 * 5.9 KB of content, two of them for rows nobody had opened. Lazy, a folded
 * row's image is fetched when it is opened; one already in view loads as
 * before. What a mark SHOWS is unchanged — only when its bytes arrive.
 */
const IMG_LAZY = ` loading="lazy" decoding="async"`;

/** An item's mark: its avatar when it has one, its glyph otherwise. */
function mark(i: NavItem, c: Ctx): string {
  // No tone behind an image that declares its ground `none` (issue #46, gap 5).
  // The tone is passed as a HUE; the ground and the ink on it are chosen by
  // the scheme in `navbarCss` (owner, 2026-10-30: dark glyph on a dark ground
  // in light mode, "bad contrasting colors").
  const tone = i.tone && i.avatar?.ground !== "none" ? ` style="--fa-nav-hue:${i.tone}"` : "";
  if (i.avatar) {
    const t = i.avatar.title ? ` title="${esc(i.avatar.title)}"` : "";
    const r = i.avatar.region;
    if (!r) {
      return (
        `<span class="fa-nav-glyph fa-nav-tone"${tone}>` +
        `<img src="${href(i.avatar.src, c)}" alt=""${t}${IMG_LAZY}></span>`
      );
    }
    // THE CROP, and the arithmetic is `603s`'s. The frame shows `r` scaled to
    // fill it, so the IMAGE is scaled by `1/w` and `1/h` and then offset by
    // `-x` and `-y` OF THE SCALED image — which is why the offsets divide by
    // the same fractions. Percentages rather than pixels so the mark resizes
    // with `NAV_GLYPH_PX` and this never has to agree with a number again.
    //
    // `1/w` and `1/h` are applied SEPARATELY, which is exactly why
    // `KgImageSchema` refuses a non-square box in PIXELS: on a landscape image
    // equal fractions are not a square region, and the two scales then stretch
    // the art by `w/h`. The schema is the guard; this is the code it guards.
    const pct = (n: number) => `${+(n * 100).toFixed(4)}%`;
    return (
      `<span class="fa-nav-glyph fa-nav-tone fa-nav-crop"${tone}>` +
      `<img src="${href(i.avatar.src, c)}" alt=""${t}${IMG_LAZY} style="` +
      `width:${pct(1 / r.w)};height:${pct(1 / r.h)};` +
      `left:${pct(-r.x / r.w)};top:${pct(-r.y / r.h)}"></span>`
    );
  }
  // Themed blank mark: a layer or kind with no declared avatar draws a blank
  // in its theme's colour rather than an initial letter or generic question mark.
  if (i.blank || i.glyphPath === BLANK_AVATAR.glyph) {
    const blankTone = typeof i.tone === "number" ? ` style="--fa-nav-hue:${i.tone}"` : "";
    return `<span class="fa-nav-glyph fa-nav-tone fa-nav-blank"${blankTone} aria-hidden="true"></span>`;
  }
  // An initial, not a question mark. `603s` reports "no avatar declared" as a
  // FINDING elsewhere; a navbar is not the place to render a gap as a glyph.
  if (i.glyphPath && !i.icon) {
    return (
      `<span class="fa-nav-glyph fa-nav-tone"${tone} aria-hidden="true">` +
      `<svg viewBox="0 0 24 24" focusable="false"><path d="${esc(i.glyphPath)}" fill="none" ` +
      `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
    );
  }
  const glyph = i.icon ?? i.label.slice(0, 1).toUpperCase();
  // A bullet (or no mark at all) takes a dot's width, not a 32px mark's.
  const bullet = glyph === "\u00b7" || glyph === "" ? " fa-nav-bullet" : "";
  return `<span class="fa-nav-glyph fa-nav-tone${bullet}"${tone} aria-hidden="true">${esc(glyph)}</span>`;
}

function itemHtml(i: NavItem, c: Ctx): string {
  // The description is INSIDE the label span's row but hidden visually, so it
  // joins the accessible name without widening the strip.
  const sr = i.description ? `<span class="fa-nav-sr"> — ${esc(i.description)}</span>` : "";
  const q = i.qualifier ? `<span class="fa-nav-qualifier"> · ${esc(i.qualifier)}</span>` : "";
  // A label that IS its own initial ("A" under a glossary's letter headings, a
  // one-letter section) would read "A A": the mark already shows it. Its text
  // then stays for assistive technology only, so the row shows the letter once
  // (owner, 2026-10-10: "TOC looks weird when code = title. don't duplicate").
  const shown = initialOf(i);
  const same = !i.qualifier && shown !== undefined && shown.toLowerCase() === i.label.trim().toLowerCase();
  const text = same ? `<span class="fa-nav-sr">${esc(i.label)}</span>` : esc(i.label);
  const body = `${mark(i, c)}<span class="fa-nav-label">${text}${q}${sr}</span>`;
  const named = i.qualifier ? `${i.label} · ${i.qualifier}` : i.label;
  // Every row names itself in full on hover: its label is cut to one line.
  const title = ` title="${esc(i.description ? `${named} — ${i.description}` : named)}"`;
  // Indent by PADDING rather than by a nested list: a nested `<ul>` would make
  // the document index a different shape from every other group here, and the
  // rows are links either way.
  // One NAV_DEPTH_STEP_PX per level past the group's own rows, which sit at
  // the glyph column already. 40px a level (a whole mark) was "too much space"
  // (owner, 2026-11-10); a child still sits right of its parent (#1757).
  const d = i.depth && i.depth > 0 ? ` style="padding-inline-start:${NAV_PAD_PX + NAV_GLYPH_PX + 8 + NAV_DEPTH_STEP_PX * i.depth}px"` : "";
  let row: string;
  if (i.href === undefined) {
    // The note is part of the row's TEXT, inside the same element, so an
    // assistive technology reads "catalogue, no viewer yet" as one thing
    // rather than as a label and a detached aside.
    const note = i.note ? `<span class="fa-nav-note">${esc(i.note)}</span>` : "";
    // A kind row keeps the kind class whether or not it links, so a dead kind
    // and a live one sit at the same indent (and a dead NON-kind row at the
    // same indent as its linked siblings — the schemas rail put `all` one
    // step left of the subjects beside it, owner 2026-10-01).
    const deadKind = i.kind ? " fa-nav-kind" : "";
    row = `<span class="fa-nav-dead${deadKind}"${d}${title}>${body}${note}</span>`;
  } else {
    const kind = i.kind ? ' class="fa-nav-kind"' : "";
    row = `<a href="${href(i.href, c)}"${kind}${d}${title}${i.current ? ' aria-current="page"' : ""}>${body}</a>`;
  }
  if (!i.action && !i.children) return row;
  // The action is a SIBLING of the row, never inside it — a control nested in
  // a link is two targets a keyboard cannot tell apart. The children follow
  // both, so the row and its control stay adjacent in the tab order.
  const action = i.action
    ? `<button type="button" class="fa-nav-action" ${esc(i.action.data)}="${esc(i.action.value)}"` +
      ` aria-label="${esc(i.action.label)}" data-fa-tip="${esc(i.action.label)}">${esc(i.action.glyph)}</button>`
    : "";
  const inner = i.children?.length ? i.children.map((k) => itemHtml(k, c)).join("") : "";
  // A FOLDED SET OF CHILDREN is opened from ITS PARENT'S ROW — owner,
  // 2026-10-15, on a "▸ 26 pages" row under "Skill schema reference": *"what
  // is 26? why unlabeled?"*. A count on a row of its own read as an item with
  // no name. So the toggle is a chevron button beside the parent's link, as
  // the theme's site-nav draws it: the title stays the link, the button
  // expands, and its accessible name says whose children and how many
  // ({@link foldLabel}). Open on arrival when the reader's page is among them.
  let toggle = "";
  let kids = "";
  if (inner && i.fold) {
    const folds = c.folds ?? { n: 0 };
    const id = `fa-nav-fold-${++folds.n}`;
    const open = (i.children ?? []).some(holdsCurrent);
    const name = foldLabel(i.label, i.fold, open);
    toggle =
      `<button type="button" class="fa-nav-twisty" aria-expanded="${open}" aria-controls="${id}"` +
      ` aria-label="${esc(name)}" data-fa-tip="${esc(name)}" data-fa-fold="${esc(i.fold)}">` +
      `<span aria-hidden="true">\u25B8</span></button>`;
    kids = `<div class="fa-nav-kids" id="${id}"${open ? "" : " hidden"}>${inner}</div>`;
  } else if (inner) {
    kids = `<div class="fa-nav-kids">${inner}</div>`;
  }
  // `fa-nav-row` exists so the row and its action can sit on one line without
  // the children joining them. Without it the action would have to be absolutely
  // positioned against a row it is not inside, which is the kind of geometry
  // `navbar-geometry.ts` exists to stop being re-decided.
  return `<div class="fa-nav-row${toggle ? " fa-nav-row--fold" : ""}">${row}${action}${toggle}${kids}</div>`;
}

/**
 * A fold toggle's accessible name: "Show Skill schema reference's 26 pages",
 * "Hide …" once open. ONE wording, used by the server and by
 * {@link wireNavFolds} when it flips the state.
 */
export function foldLabel(parent: string, fold: string, open: boolean): string {
  return `${open ? "Hide" : "Show"} ${parent}'s ${fold}`;
}

/**
 * The fold toggles' behaviour: a click flips `aria-expanded`, the controlled
 * list's `hidden`, and the name. Delegated from the document, so a rail drawn
 * after load (`navbar.js`) is covered too, and idempotent per document.
 * Bundled into `navbar.js`; inlined beside a rail rendered into the page
 * ({@link injectNavbar}) — the same function either way.
 */
export function wireNavFolds(doc: Document): void {
  const w = doc as Document & { faNavFolds?: boolean };
  if (w.faNavFolds) return;
  w.faNavFolds = true;
  // A CONTROL THAT OPENS A PANEL IN THE RAIL (the Harnesses icon; owner,
  // 2026-11-13). The panel is beside the rail's other rows, so the rail is
  // pinned open while it shows (the labels are hidden at rest), and unpinned
  // on close only if this pinned it. Escape closes it and returns focus.
  const setPop = (b: Element, open: boolean): void => {
    const panel = doc.getElementById(b.getAttribute("aria-controls") || "");
    if (!panel) return;
    b.setAttribute("aria-expanded", String(open));
    if (open) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
    const box = doc.getElementById("fa-nav-open") as HTMLInputElement | null;
    if (!box) return;
    if (open && !box.checked) {
      box.checked = true;
      b.setAttribute("data-fa-pinned", "");
      box.dispatchEvent(new Event("change"));
    } else if (!open && b.hasAttribute("data-fa-pinned")) {
      b.removeAttribute("data-fa-pinned");
      if (box.checked) {
        box.checked = false;
        box.dispatchEvent(new Event("change"));
      }
    }
  };
  // ONE owner of the panel toggles per document: `navbar-row.js` carries the
  // same few lines for a page with no `navbar.js` (a theme page), and two
  // handlers would open and shut the panel on one click.
  const ownsPop = !(doc as Document & { faNavPop?: boolean }).faNavPop;
  (doc as Document & { faNavPop?: boolean }).faNavPop = true;
  doc.addEventListener("keydown", (e) => {
    if (!ownsPop || e.key !== "Escape") return;
    const b = doc.querySelector('button[data-fa-nav-pop][aria-expanded="true"]') as HTMLElement | null;
    if (!b) return;
    setPop(b, false);
    b.focus();
  });
  doc.addEventListener("click", (e) => {
    const t = e.target as Element | null;
    const pop = ownsPop && t && typeof t.closest === "function" ? t.closest("button[data-fa-nav-pop]") : null;
    if (pop) {
      setPop(pop, pop.getAttribute("aria-expanded") !== "true");
      return;
    }
    const b = t && typeof t.closest === "function" ? t.closest("button.fa-nav-twisty") : null;
    if (!b) return;
    const list = doc.getElementById(b.getAttribute("aria-controls") || "");
    if (!list) return;
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    if (open) list.removeAttribute("hidden");
    else list.setAttribute("hidden", "");
    const row = b.closest(".fa-nav-row");
    const label = row && row.querySelector(":scope > a .fa-nav-label, :scope > .fa-nav-dead .fa-nav-label");
    const parent = label ? (label.textContent || "").split(" — ")[0]!.trim() : "";
    const fold = b.getAttribute("data-fa-fold") || "";
    if (parent && fold) {
      const name = (open ? "Hide" : "Show") + " " + parent + "'s " + fold;
      b.setAttribute("aria-label", name);
      b.setAttribute("data-fa-tip", name);
    }
  });
}

/**
 * THE DRAG EDGE (owner, 2026-11-10, option D: "wrap and drag to widen"). A
 * thin handle on the open bar's right edge: drag it, or focus it and use the
 * arrow keys, to set `--fa-nav-w` on the root, which every open-width rule
 * reads. The width is remembered in this browser (`fa-nav-w`); a double click
 * or Home forgets it. Self-contained, since it is inlined as text as well as
 * bundled: the limits are written here, and {@link NAV_RESIZE_MIN_PX} and
 * {@link NAV_RESIZE_MAX_PX} say the same (a test holds them equal).
 */
export function wireNavResize(doc: Document): void {
  const MIN = 200;
  const MAX = 600;
  const KEY = "fa-nav-w";
  const root = doc.documentElement;
  const clamp = (w: number) => Math.max(MIN, Math.min(MAX, Math.min(w, (doc.defaultView?.innerWidth ?? MAX) - 160)));
  const apply = (w: number | undefined) => {
    if (w === undefined) root.style.removeProperty("--fa-nav-w");
    else root.style.setProperty("--fa-nav-w", `${Math.round(clamp(w))}px`);
  };
  let saved: number | undefined;
  try {
    const v = Number(doc.defaultView?.localStorage.getItem(KEY));
    if (v > 0) saved = v;
  } catch {
    /* storage blocked: the default width */
  }
  apply(saved);
  const remember = (w: number | undefined) => {
    try {
      if (w === undefined) doc.defaultView?.localStorage.removeItem(KEY);
      else doc.defaultView?.localStorage.setItem(KEY, String(Math.round(clamp(w))));
    } catch {
      /* storage blocked: this page only */
    }
  };
  doc.querySelectorAll("nav.fa-nav").forEach((nav) => {
    if (nav.querySelector(":scope > .fa-nav-resize")) return;
    const h = doc.createElement("div");
    h.className = "fa-nav-resize";
    h.setAttribute("role", "separator");
    h.setAttribute("aria-orientation", "vertical");
    h.setAttribute("aria-label", "Drag to widen or narrow the navigation"); // NAV_RESIZE_LABEL: inlined as text, so a literal
    h.setAttribute("data-fa-tip", "Drag to widen or narrow the navigation");
    h.tabIndex = 0;
    const width = () => (nav as HTMLElement).getBoundingClientRect().width;
    // On a right-to-left page the bar is on the right (`navbarCss`), so its
    // width is the distance from the pointer to the RIGHT edge, and the arrow
    // that widens it points left.
    const rtl = () => doc.defaultView?.getComputedStyle(nav as HTMLElement).direction === "rtl";
    h.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      h.setAttribute("data-active", "");
      root.setAttribute("data-fa-nav-resizing", "");
      const move = (m: PointerEvent) => apply(rtl() ? root.clientWidth - m.clientX : m.clientX);
      const up = () => {
        h.removeEventListener("pointermove", move);
        h.removeEventListener("pointerup", up);
        h.removeEventListener("pointercancel", up);
        h.removeAttribute("data-active");
        root.removeAttribute("data-fa-nav-resizing");
        remember(width());
      };
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
    });
    h.addEventListener("dblclick", () => {
      apply(undefined);
      remember(undefined);
    });
    h.addEventListener("keydown", (e) => {
      const out = rtl() ? "ArrowLeft" : "ArrowRight";
      const back = rtl() ? "ArrowRight" : "ArrowLeft";
      const step = e.key === out ? 16 : e.key === back ? -16 : 0;
      if (e.key === "Home") {
        apply(undefined);
        remember(undefined);
      } else if (step) {
        apply(width() + step);
        remember(width() + step);
      } else return;
      e.preventDefault();
    });
    nav.appendChild(h);
  });
}

/**
 * THE READER KEEPS THEIR PLACE (owner, 2026-11-16, with a screen recording):
 * on a whole-document page, follow "Glossary" from the rail and close the
 * rail, and the text column widens, every block above the Glossary gets
 * shorter, and the same `scrollY` now shows References 90–102. Opening the
 * rail, hovering it open and dragging its edge did the same.
 *
 * The browser's own scroll anchoring cannot help: the push is a change to
 * `body`'s `padding-inline-start` (`navbarCss`) or `.main`'s margin
 * (`docs-ui.css`), and a change to an ancestor's box is one of the triggers
 * that SUPPRESS native anchoring. So the anchor is held here:
 *
 * - **recorded** when a scroll comes to rest, on `hashchange`,
 *   and again just before a rail change is asked for: `pointerdown` and
 *   `keydown` on the open/close control and the drag edge. The anchor is the
 *   `location.hash` target while it is within about a screen of the top, else
 *   the first block at or below the reading pane's top edge (the page's
 *   `scroll-padding-top`, where an anchor jump lands), with its viewport top.
 *   Recording is a read only, so the `change` that flips the box would be too
 *   late: reading a box then lays out the NEW width.
 * - **restored** when the reading column's width changes and the window's
 *   did not (a window resize is the browser's to handle): a
 *   `ResizeObserver`, which runs after layout and before paint, so the jump
 *   is never drawn — on open at once, on close after the rail's slide, and on
 *   every step of a drag. The correction is `behavior: "instant"`: the page's
 *   `scroll-behavior: smooth` would animate it, and nothing here moves under
 *   `prefers-reduced-motion`.
 *
 * Self-contained, since it is inlined as text as well as bundled.
 */
export function wireNavAnchor(doc: Document): void {
  const w = doc as Document & { faNavAnchor?: boolean };
  const win = doc.defaultView;
  if (w.faNavAnchor || !win || typeof win.ResizeObserver !== "function") return;
  w.faNavAnchor = true;
  type Anchor = { el: Element; top: number; vw: number };
  let held: Anchor | undefined;
  const edge = (): number => {
    const v = parseFloat(win.getComputedStyle(doc.documentElement).scrollPaddingTop);
    return v > 0 ? v : 0;
  };
  // Not part of the reading column: the rail, and anything that does not
  // scroll with the page.
  const skip = (el: Element): boolean => {
    if (el.closest("nav.fa-nav, .side-bar, script, style, template")) return true;
    const p = win.getComputedStyle(el).position;
    return p === "fixed" || p === "sticky";
  };
  const hashTarget = (): Element | null => {
    const h = win.location.hash.slice(1);
    if (!h) return null;
    let id = h;
    try {
      id = decodeURIComponent(h);
    } catch {
      /* a malformed escape: the raw fragment */
    }
    return doc.getElementById(id) || doc.getElementsByName(id)[0] || null;
  };
  // The reading column's width as last seen by the observer below. A column
  // whose width has changed since is a change the observer has not yet
  // delivered (keyboard focus opens the rail, and the Space that pins it
  // lands in the same frame): recording now would read the NEW layout as the
  // reader's place, so the held anchor stands until `restore` has run.
  const widths = new Map<Element, number>();
  // The CONTENT box, as the observer reports it: the push is padding, which
  // leaves `body`'s border box the window's width.
  const inner = (el: Element): number => {
    const cs = win.getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  };
  const pending = (): boolean => {
    for (const [el, wd] of widths) if (Math.abs(inner(el) - wd) >= 1) return true;
    return false;
  };
  const record = (): void => {
    const body = doc.body;
    if (!body || pending()) return;
    const top = edge();
    const t = hashTarget();
    if (t && !skip(t)) {
      const r = t.getBoundingClientRect();
      if ((r.width || r.height) && Math.abs(r.top - top) <= win.innerHeight) {
        held = { el: t, top: r.top, vw: win.innerWidth };
        return;
      }
    }
    // The first BLOCK, in reading order, whose top is at or below the edge.
    // A block that ends above the edge is passed over whole; one that
    // straddles it is looked inside, then its next siblings. Inline boxes are
    // not blocks: a link inside a re-wrapping paragraph moves with the wrap.
    // Failing all (one block taller than the screen), the block that
    // straddles the edge, a few pixels above it.
    let straddle: Element | undefined;
    const first = (box: Element, depth: number): Element | undefined => {
      for (const c of Array.from(box.children)) {
        if (skip(c) || win.getComputedStyle(c).display.startsWith("inline")) continue;
        const r = c.getBoundingClientRect();
        if ((!r.width && !r.height) || r.bottom <= top) continue;
        if (r.top >= top) return c;
        straddle = c;
        const inside = depth < 32 ? first(c, depth + 1) : undefined;
        if (inside) return inside;
      }
      return undefined;
    };
    const found = first(body, 0) || straddle;
    held = found ? { el: found, top: found.getBoundingClientRect().top, vw: win.innerWidth } : undefined;
  };
  const restore = (): void => {
    const a = held;
    if (!a || !a.el.isConnected || a.vw !== win.innerWidth) return;
    const d = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(d) < 1) return;
    win.scrollBy({ top: d, behavior: "instant" as ScrollBehavior });
    held = { ...a, top: a.el.getBoundingClientRect().top };
  };
  // Once the scroll comes to rest, not every frame: deep in a long document
  // the walk is a few milliseconds, and a rail change is recorded afresh below.
  let rest: number | undefined;
  win.addEventListener(
    "scroll",
    () => {
      if (rest !== undefined) win.clearTimeout(rest);
      rest = win.setTimeout(record, 100);
    },
    { passive: true },
  );
  win.addEventListener("hashchange", () => win.requestAnimationFrame(record));
  // Just before a change is asked for, with the layout the reader is looking at.
  const before = (e: Event): void => {
    const t = e.target as Element | null;
    if (!t || typeof t.closest !== "function") return;
    if (t.closest('label[for="fa-nav-open"], #fa-nav-open, .fa-nav-resize, button[data-fa-nav-pop]')) record();
  };
  doc.addEventListener("pointerdown", before, true);
  doc.addEventListener("keydown", before, true);
  // The reading column's width: the page's own padding (`navbarCss`) and a
  // theme's `.main` margin (`docs-ui.css`) both narrow one of these.
  const ro = new win.ResizeObserver((entries) => {
    let changed = false;
    for (const e of entries) {
      const was = widths.get(e.target);
      widths.set(e.target, e.contentRect.width);
      if (was !== undefined && Math.abs(was - e.contentRect.width) >= 0.5) changed = true;
    }
    if (changed) restore();
  });
  const watch = (): void => {
    for (const el of [doc.body, ...Array.from(doc.querySelectorAll(".main, main, [role=main]"))]) {
      if (el && !widths.has(el)) {
        widths.set(el, inner(el));
        ro.observe(el);
      }
    }
    record();
  };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", watch);
  else watch();
}

/**
 * {@link wireNavFolds} and {@link wireNavResize} as an inline script, for a
 * rail rendered into the page, and {@link wireNavAnchor} unless `anchor` is
 * false. A THIN page (its style linked, bean `lnoy`) leaves the anchor out:
 * it is a few KB of content with no place to lose, and the anchor would be
 * most of the rail's weight on it.
 */
export function navFoldsScript(o: { anchor?: boolean } = {}): string {
  const anchor = o.anchor === false ? "" : `(${wireNavAnchor.toString()})(document);`;
  return `<script data-fa-nav-folds>(${wireNavFolds.toString()})(document);(${wireNavResize.toString()})(document);${anchor}</script>`;
}

/** Does this row, or any row beneath it, stand for the page being read? */
function holdsCurrent(i: NavItem): boolean {
  return i.current === true || (i.children ?? []).some(holdsCurrent);
}

/**
 * The graphs group's state on arrival (#2150).
 *
 * FOLDED when the page has a section of its own: that section IS where the
 * reader is, and it is the one disclosure open on arrival (#1757's
 * *"only the current pages visualiers LHS navbar is open"*, graded by
 * `check-viewer-nav.ts` `single-open`). Otherwise as declared — folded, from
 * `railModel` — UNLESS one of its rows is the page being read: a folded
 * default must not hide where the reader is.
 */
function graphsOnArrival(g: NavGroup, hasOwnSection: boolean): NavGroup {
  if (hasOwnSection) return { ...g, open: false };
  return g.items.some(holdsCurrent) ? { ...g, open: true } : g;
}

/**
 * The marks of the navbar's three section groups (owner, 2026-11-08, see
 * {@link NavGroup.glyphPath}): a ruled page, a folder, and a cat's framed
 * face for the harnesses — the same "framed face with ears" the cat-harness
 * avatar reads as.
 */
export const GROUP_GLYPHS = {
  pages: "M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4",
  folders: "M3 6.5h6.5l2 2H21V19H3z",
  harnesses: "M4 20V4.5l5 5h6l5-5V20z M8.5 14h1.5 M14 14h1.5 M11 17.5h2",
} as const;

function groupMark(g: NavGroup): string {
  if (g.glyphPath) {
    return `<span class="fa-nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="${esc(g.glyphPath)}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  }
  return `<span class="fa-nav-glyph" aria-hidden="true">${esc(g.icon ?? "▸")}</span>`;
}

function groupHtml(g: NavGroup, c: Ctx): string {
  const items = g.items.map((i) => itemHtml(i, c)).join("");
  if (!g.collapsible) return items;
  return (
    `<details class="fa-nav-group"${g.open ? " open" : ""}>` +
    `<summary>${groupMark(g)}` +
    `<span class="fa-nav-label">${esc(g.label)}</span></summary>` +
    `<div class="fa-nav-sub">${items}</div></details>`
  );
}

/** The navbar. */
export function navbarHtml(m: NavbarModel): string {
  return `<nav class="fa-nav" aria-label="folio-assistant">${navbarRegionsHtml(m)}</nav>`;
}

/**
 * The navbar's REGIONS, without the `<nav>` element around them.
 *
 * This exists for the one surface that already has its own container: the
 * Jekyll theme renders `.side-bar`, and `nav_footer_custom.html` is
 * just-the-docs' extension point *inside* it. Emitting a second `<nav>` there
 * would give the page two navigation landmarks and put the harness tabs in the
 * wrong one.
 *
 * **This is the second of the two declared differences**, with
 * {@link NavbarModel.hrefs} — and it is a difference in what OWNS the element,
 * not in what is rendered. `navbarHtml` is this function plus a wrapper, so
 * the two surfaces cannot drift: there is no second copy of the region order
 * to keep in step.
 */
export function navbarOpenInputHtml(): string {
  return `<input type="checkbox" class="fa-nav-open" id="fa-nav-open">`;
}

/**
 * The header: the layer's mark and name, as ONE label for the open box.
 *
 * `aria-hidden` stays off the mark when it is an image with `alt=""` — the
 * image is already silent — and the label's name is the layer, so a
 * screen reader hears "cat-harness" and the `title` says what a click does.
 */
/** The dead fish (`7vhe`), the same drawing `docs-ui.js` uses for fsh-guts. */
const FISH_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M2 12c3-4 7-6 11-6s7 2 9 6c-2 4-5 6-9 6s-8-2-11-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
  '<path d="M22 12l-3-3v6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
  '<path d="M7.2 10.2l2 2m0-2l-2 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

/**
 * The fsh-guts control. Its count starts `pending` and is written by the
 * client, which knows the four states (`absent`, `zero`, `some`, `error`); a
 * number baked here would be the build's, not this reader's.
 */
export function fshGutsHtml(f: { label: string }): string {
  return (
    `<button type="button" class="fa-nav-fsh-guts" data-fa-fsh-guts-open hidden ` +
    `aria-label="${esc(f.label)}" data-fa-tip="${esc(f.label)}">` +
    `<span class="fa-nav-glyph" aria-hidden="true">${FISH_SVG}</span>` +
    `<span class="fa-nav-label">fsh-guts</span>` +
    `<span class="fa-nav-count" data-fa-count-state="pending" aria-hidden="true">\u2026</span>` +
    `</button>`
  );
}

/**
 * The house drawn as the header's mark when the site declares no avatar or
 * glyph of its own. Owner, 2026-11-02: *"use home icon as default avatar at
 * top navbar next to harness title"* -- the header is the home link, so its
 * mark says so, where a blank square in the theme colour said nothing.
 */
export const HOME_GLYPH = "M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5";

/** The header's mark: the declared one, or {@link HOME_GLYPH} when there is none. */
export function headMark(m: NavbarModel): NavItem {
  if (m.headName !== undefined) return { label: m.headName, glyphPath: HOME_GLYPH };
  const declared = m.mark ?? {};
  const own = declared.avatar !== undefined || declared.icon !== undefined ||
    (declared.glyphPath !== undefined && declared.glyphPath !== BLANK_AVATAR.glyph);
  if (own) return { label: m.instance, ...declared };
  return { label: m.instance, glyphPath: HOME_GLYPH, ...(declared.tone !== undefined ? { tone: declared.tone } : {}) };
}

export function headHtml(m: NavbarModel, c: Ctx = { liquid: false }): string {
  const item = headMark(m);
  const name = m.headName ?? m.instance;
  // The name, and under it the open folder (owner, 2026-11-13), as one
  // column beside the mark. The name keeps its own span: `check-viewer-nav`
  // reads it.
  const titles = m.folder
    ? `<span class="fa-nav-titles"><span class="fa-nav-name fa-nav-label">${esc(name)}</span>` +
      `<span class="fa-nav-folder fa-nav-label">${esc(m.folder)}</span></span>`
    : `<span class="fa-nav-name fa-nav-label">${esc(name)}</span>`;
  const inner = mark(item, c) + titles;
  if (m.headHref === undefined) {
    return `<label class="fa-nav-head" for="fa-nav-open" title="${esc(NAV_TOGGLE_LABEL)}">` + inner + `</label>`;
  }
  // THE HEADER IS THE HOME LINK (owner, 2026-10-30), and the open/close label
  // stays beside it. At rest the label covers the whole header, so a tap on a
  // touch screen, which has no hover, still opens the bar. Open, the label
  // shrinks to a small close control at the right and the mark and name
  // become the link to the landing page.
  return (
    `<div class="fa-nav-head fa-nav-head--home">` +
    `<a class="fa-nav-head-link" href="${href(m.headHref, c)}" title="${esc(name)}: landing page">` +
    inner +
    `</a>` +
    `<label class="fa-nav-head-toggle" for="fa-nav-open" aria-label="${esc(NAV_TOGGLE_LABEL)}" data-fa-tip="${esc(NAV_TOGGLE_LABEL)}">` +
    `<span aria-hidden="true">\u2039</span></label>` +
    `</div>`
  );
}

export function navbarRegionsHtml(m: NavbarModel): string {
  const c: Ctx = { liquid: m.hrefs === "liquid", folds: { n: 0 } };
  const graphs = m.graphs && m.graphs.items.length > 0 ? m.graphs : undefined;
  const pages = m.pages && m.pages.items.length > 0 ? m.pages : undefined;
  return (
    // One checkbox behind two labels, so open and close cannot disagree.
    //
    // `openControl: "labels"` renders only the labels, for a surface that
    // renders this markup MORE THAN ONCE per page. just-the-docs includes its
    // footer extension point twice by design, and with the input in both,
    // `id="fa-nav-open"` appeared twice on 429 of 1,283 built pages (`uknu`).
    // Giving the second copy its own id was tried and was worse: the
    // stylesheet reads `.side-bar:has(.fa-nav-open:checked)` and the second
    // input is not in `.side-bar`, so it checked a box nothing reads.
    (m.openControl === "labels" ? "" : navbarOpenInputHtml()) +
    // NO `[x]` AND NO `☰` (#1757). The header below is a label for the same
    // checkbox, so it already opens AND closes: a label toggles. The `[x]`
    // was a second label for that box and the `☰` was this one wearing a
    // glyph that named the action instead of the layer.
    `<div class="fa-nav-in">` +
    `<div class="fa-nav-top">` +
    (m.head === "none" ? "" : headHtml(m, c)) +
    (m.root ? itemHtml(m.root, c) : "") +
    (m.documentIndex ? groupHtml(m.documentIndex, c) : "") +
    (m.fshGuts ? fshGutsHtml(m.fshGuts) : "") +
    `</div>` +
    // A Graphs group with no rows is not drawn: an empty fold is a control
    // that opens onto nothing (a site that holds none of its landing's graphs).
    (graphs || pages || m.visualiser
      ? `<div class="fa-nav-graphs">` +
        (m.visualiser ? groupHtml({ ...m.visualiser, collapsible: true, open: true }, c) : "") +
        (pages ? groupHtml(graphsOnArrival(pages, m.visualiser !== undefined), c) : "") +
        (graphs ? groupHtml(graphsOnArrival(graphs, m.visualiser !== undefined), c) : "") +
        `</div>`
      : "") +
    (m.harnesses ? harnessesBottomHtml(m.harnesses, c) : "") +
    `</div>`
  );
}

/**
 * The HARNESSES CONTROL and its panel, in the fixed bottom — owner,
 * 2026-11-13: *"remove the harnesses navbar, instead add an icon to the
 * controls to show the harnesses."*
 *
 * The icon is drawn HERE, by the rail itself, rather than by `navbar-row.js`:
 * a layer that declares no icon row, or a page that never loads that script,
 * still reaches its harnesses. Where the row IS drawn, `navbar-row.js` moves
 * this button into it ({@link NAV_CONTROL_ATTR}), so the controls are one line
 * at the foot of the rail. The panel is a plain list above it, hidden until
 * the button opens it ({@link wireNavFolds}).
 */
export function harnessesBottomHtml(g: NavGroup, c: Ctx): string {
  const label = g.label;
  const id = "fa-nav-harnesses";
  const items = g.items.map((i) => itemHtml(i, c)).join("");
  return (
    `<div class="fa-nav-bottom">` +
    `<div class="fa-nav-pop" id="${id}" role="region" aria-label="${esc(label)}" hidden>` +
    `<div class="fa-nav-pop-title"><span class="fa-nav-label">${esc(label)}</span></div>${items}</div>` +
    `<div class="fa-nav-controls">` +
    `<button type="button" class="fa-nav-icon fa-nav-harnesses" ${NAV_CONTROL_ATTR} data-fa-nav-pop` +
    ` aria-expanded="false" aria-controls="${id}" aria-label="${esc(label)}" data-fa-tip="${esc(label)}">` +
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${esc(g.glyphPath ?? GROUP_GLYPHS.harnesses)}"` +
    ` fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>` +
    `</button></div></div>`
  );
}

/**
 * Marks a control the rail draws for the icon row: `navbar-row.js` moves every
 * element carrying it into the row it mounts, in order, after its own icons.
 */
export const NAV_CONTROL_ATTR = "data-fa-nav-control";

/**
 * The folder the page at `path` is in: the Folders row whose ROUTE holds the
 * page, longest first. A folder's route is its href, less a final
 * layer segment (see below) — `library/<layer>/` routes `library/`, so the
 * all-layers page `schemas/` is in the Schemas folder as well as
 * `schemas/<layer>/` and every page beneath it. A route that is the site
 * root, or a locale root, holds every page and so names no folder.
 *
 * `path` and each href are compared as written, both from the page, so the
 * caller passes every spelling of the page's address it has (from the site's
 * root and from the platform's).
 */
export function folderOfPage(links: readonly NavItem[], paths: readonly string[], instance: string): NavItem | undefined {
  // The LAYER's own segment, which ends a folder's href (`library/<layer>/`):
  // the instance as named, as a slug, and — because a layer's display name
  // need not be its slug ("C@T Harness", `cat-harness`) — the last segment
  // most of the Folders rows end in, read off the rows themselves.
  const last = (h: string) => h.replace(/\/$/, "").split("/").pop() ?? "";
  const counts = new Map<string, number>();
  for (const i of links) if (i.href?.endsWith("/")) counts.set(last(i.href), (counts.get(last(i.href)) ?? 0) + 1);
  const common = [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0]?.[0];
  const layer = new Set([instance, instance.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), ...(common ? [common] : [])]);
  let best: { item: NavItem; len: number } | undefined;
  for (const item of links) {
    const h = item.href;
    if (!h || !h.endsWith("/")) continue;
    const seg = last(h);
    const route = layer.has(seg) ? h.slice(0, -seg.length - 1) : h;
    // A route must name at least one folder segment past the root and locale.
    const segs = route.replace(/^(?:\.\.?\/)+|^[a-z]+:\/\/[^/]+\//i, "").split("/").filter((x) => x && x !== "." && x !== "..");
    if (segs.length === 0 || (segs.length === 1 && /^[a-z]{2}(?:-[A-Za-z]+)?$/.test(segs[0]!))) continue;
    if (!paths.some((p) => p.startsWith(route))) continue;
    if (!best || route.length > best.len) best = { item, len: route.length };
  }
  return best?.item;
}

/** A folder row's short name: its label before any ` — ` gloss. */
export function folderName(i: NavItem): string {
  return i.label.split(" \u2014 ")[0]!.trim();
}

/**
 * Put the navbar into a finished document.
 *
 * **Returns `undefined` rather than the input when there is no `<body>` or the
 * page already carries one.** A fragment, a redirect stub or a file that is
 * HTML only by extension is not a page this belongs on, and a caller that
 * could not tell the difference would report a page injected that was not.
 */
/**
 * Does the page already carry a rail? The `<nav class="fa-nav">` ELEMENT, not
 * the attribute text: a page whose prose quotes `<nav class="fa-nav"` in a code
 * span (reference/skill-instructions/rendered-verification, 2026-10-16) was
 * taken as railed, so it got no rail and kept the theme's side bar.
 */
export function hasRail(html: string): boolean {
  return /<nav\b[^>]*\bclass="fa-nav"/.test(html);
}

export function injectNavbar(html: string, m: NavbarModel, o: { cssHref?: string } = {}): string | undefined {
  if (hasRail(html)) return undefined;
  const body = bodyTag(html);
  if (!body) return undefined;
  const at = body.index + body[0].length;
  // `cssHref`: the SAME rules, published once as {@link NAVBAR_CSS} and linked —
  // for a thin page, where 4.3 KB of inlined style is most of the page (bean `lnoy`).
  const style = o.cssHref ? `<link rel="stylesheet" href="${o.cssHref}">` : `<style>${navbarCss()}</style>`;
  const nav = navbarHtml(m);
  // The fold toggles need their few lines of script where no `navbar.js` runs.
  // The fold toggles and the drag edge need their few lines of script where no `navbar.js` runs.
  const folds = navFoldsScript({ anchor: !o.cssHref });
  return html.slice(0, at) + style + nav + folds + html.slice(at);
}

/**
 * Where {@link navbarCss} is published as a file, relative to the site root —
 * generated by `bun run navbar:css`, held to `navbarCss()` by
 * `navbar-css-file.test.ts`. Bean `lnoy`.
 */
/**
 * The first real `<tag …>` matching `tag` in a page — never one QUOTED in an
 * HTML comment or inside a `<script>`. A theme's head carries comments that
 * name `<body>` and `</head>` in prose (`head_custom.html` does), and the
 * first textual match there put the whole rail inside a comment: measured on
 * a just-the-docs page railed by `--theme-source`, 2026-10-15.
 */
export function realTag(html: string, tag: RegExp): RegExpExecArray | null {
  const re = new RegExp(`<!--[\\s\\S]*?-->|<script\\b[^>]*>[\\s\\S]*?<\\/script\\s*>|(${tag.source})`, "gi");
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1] === undefined) continue;
    const hit = [m[1]] as unknown as RegExpExecArray;
    hit.index = m.index;
    hit.input = html;
    return hit;
  }
  return null;
}
/** The page's real `<body …>` tag ({@link realTag}). */
export const bodyTag = (html: string): RegExpExecArray | null => realTag(html, /<body\b[^>]*>/);
/** The page's real `</head>` tag ({@link realTag}). */
export const headEndTag = (html: string): RegExpExecArray | null => realTag(html, /<\/head\s*>/);
/** `html` with `insert` placed just before its real `</head>`, or unchanged when it has none. */
export function beforeHeadEnd(html: string, insert: string): string {
  const h = headEndTag(html);
  return h ? html.slice(0, h.index) + insert + html.slice(h.index) : html;
}

export const NAVBAR_CSS = "assets/css/navbar.css";

/**
 * THE RAIL'S SECTION NAMES — one vocabulary on every site (owner,
 * 2026-10-15, "folio rail everywhere"). The just-the-docs sidebar
 * (`docs-ui.js`, `gen-navbar-include.ts`) and this rail used to name the same
 * sections differently: "Graphs" here, "Folders" there; "Contents" here, "On
 * this page" there. A section a reader learns on one site must be called the
 * same on the next, so every surface takes its heading from here, and
 * `rail-section-parity.test.ts` holds `docs-ui.js` (which cannot import this)
 * to the same strings.
 *
 * - `pages` — the site's own page tree (the theme's site-nav).
 * - `onThisPage` — the open document's headings.
 * - `folders` — the layer's graphs, one row per folder.
 * - `harnesses` — the harnesses this site is built on.
 *
 * The home row is not a section: it is named after the site.
 */
/** The open/close control's name and tooltip (translated by `navbar-strings.ts`). */
export const NAV_TOGGLE_LABEL = "Open or close navigation";
/** The drag edge's name and tooltip. `wireNavResize` is inlined as text, so it repeats it; a test holds them equal. */
export const NAV_RESIZE_LABEL = "Drag to widen or narrow the navigation";

export const RAIL_SECTION_LABELS = {
  pages: "Pages",
  onThisPage: "On this page",
  folders: "Folders",
  harnesses: "Harnesses",
} as const;

/**
 * The open document's own index, read off the page it is being injected into.
 *
 * Owner, 2026-09-21: *"when a document or other indexed object is opened, the
 * document index/idices are shown in a navbar tab/menu."* `NavbarModel` has
 * carried `documentIndex` since it was written; **nothing supplied one** — a
 * repo-wide search on 2026-09-22 found the type, the render branch and a
 * single test, so the sentence was unbuilt on both surfaces.
 *
 * ## Only headings the page can actually be scrolled to
 *
 * A heading with no `id` is not a destination, and a fragment link to one goes
 * nowhere. So the `id` is the filter, not the heading level — that is the same
 * `pb04` rule the rest of this module follows: a dead link invites a click and
 * then reads as a broken site. It is also what makes this safe on a document
 * the harness does not control; those pages are copied verbatim and their
 * heading ids are whatever their own generator assigned.
 *
 * ## `h2` and `h3` only
 *
 * `h1` is the document's title, which the reader is already looking at, and
 * the navbar names the layer directly above. Below `h3` an index stops
 * being a way in and becomes the document again — and this region is in the
 * FIXED top, so every row it takes is a row the scrollable middle does not
 * get.
 *
 * `h3`s are nested under the `h2` they follow, which is why they carry
 * `depth`. A flat list of eleven rows where three are subsections of the first
 * is a list that lies about the document's shape.
 *
 * ## Regex rather than a DOM
 *
 * This runs over hundreds of copied files during a mount, and the alternative
 * is a parser dependency in a script whose whole job is string injection. The
 * cost is that it sees `<h2 id>` in a comment or a `<pre>`; the consequence of
 * that is one extra row in a menu, which is why it is an acceptable trade
 * here and would not be in a validator.
 */
export function documentIndexOf(html: string, label: string = RAIL_SECTION_LABELS.onThisPage): NavGroup | undefined {
  const flat: NavItem[] = [];
  const re = /<(h2|h3)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    const text = m[3]
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const { icon, label: rest } = numberedHeading(text);
    flat.push({ href: `#${m[2]}`, label: rest, ...(icon ? { icon } : {}), ...(m[1].toLowerCase() === "h3" ? { depth: 1 } : {}) });
  }
  // SUB-SECTIONS FOLD UNDER THEIR SECTION (bean `r2ld`): an h3 becomes a
  // child of the h2 above it, behind a closed "N sub-sections" disclosure.
  // An h3 before any h2 has no section to sit in and stays a row of its own.
  const items: NavItem[] = [];
  for (const it of flat) {
    const parent = items[items.length - 1];
    if (it.depth && parent && !parent.depth) {
      const kids = [...(parent.children ?? []), it];
      items[items.length - 1] = { ...parent, children: kids, fold: subSections(kids.length) };
    } else items.push(it);
  }
  // ABSENT rather than empty, and rather than a one-item index. An empty
  // disclosure invites a click that does nothing -- the rule this module
  // already applies to the harnesses region -- and a "Contents" holding the
  // single section the reader is looking at is the same defect with a row in
  // it.
  if (flat.length < 2) return undefined;
  // `§`, not `≡`: at rest the rail shows only this glyph, directly under the
  // avatar, and `≡` there reads as the hamburger #1757 excised.
  return { label, icon: "§", items, collapsible: true };
}

/**
 * A heading's NUMBER as the row's mark, and the rest as its label.
 *
 * At rest the rail shows a row's mark and a few characters of its label, so
 * "Chapter 1. Why digital…" spent the mark on a `C` every chapter shares and
 * the label on words every chapter repeats (owner, 2026-10-30: "lots of waste
 * in navbar dont spell out Chapter 1"). A heading that opens with its number
 * -- `Chapter 7.`, `Annex 9:`, `Appendix A`, `7.1`, `3.` -- gives the
 * number to the mark (`7`, `9`, `A`, `7.1`, `3`) and keeps only the title as
 * the label. A heading with no number, whose number is all it says, or whose
 * number is too long for the mark, is left as it is. The page's own heading
 * text is not touched.
 */
export function numberedHeading(text: string): { icon?: string; label: string } {
  const m =
    /^(?:chapter|annex|appendix|part|section)\s+([0-9]+|[A-Z]|[IVXLC]+)\b[.:)]?\s*[-—–:]?\s+(.+)$/i.exec(text) ??
    /^([0-9]{1,2}(?:\.[0-9]+)*)[.)]?\s+(.+)$/.exec(text);
  // The mark holds about three characters; a deeper number (`1.1.1`) stays in
  // the label rather than overflow it.
  if (!m || !m[2]!.trim() || m[1]!.length > 3) return { label: text };
  return { icon: m[1]!.toUpperCase(), label: m[2]!.trim() };
}

/** The summary of a folded set of sub-sections — one wording, both surfaces. */
export function subSections(n: number): string {
  return n === 1 ? "1 sub-section" : `${n} sub-sections`;
}

/** The marker a visualiser puts its own navigation under. */
export const VISUALISER_NAV_ATTR = "data-fa-visualiser-nav";

/**
 * What a page calls its own section, declared beside its section:
 * `<meta name="fa-visualiser-label" content="…">`. A railed page's section is
 * "On this page" ({@link RAIL_SECTION_LABELS}) unless it says otherwise; an IG site names it after the IG
 * (owner, 2026-10-05, bean `mftp`: *"WHO SMART Trust"*). Undefined when the
 * page declares none.
 */
export function visualiserLabelOf(html: string): string | undefined {
  const m = /<meta\s+name="fa-visualiser-label"\s+content="([^"]*)"\s*\/?>/i.exec(html);
  const v = m?.[1]?.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
  return v ? v : undefined;
}

/** One row of a declared visualiser section; `items` are its children. */
export interface VisualiserNavEntry {
  label: string;
  /** Appended to the label, as {@link NavItem.qualifier}. */
  qualifier?: string;
  href?: string;
  items?: readonly { label: string; href?: string }[];
}

/**
 * The declaration a generator writes into its page — the ONE writer of the
 * format {@link visualiserNavOf} reads, so the two cannot drift.
 *
 * `<` is escaped inside the JSON so a label containing `</script>` cannot close
 * the element early; `JSON.parse` reads `\u003c` back as `<`.
 */
export function visualiserNavDeclaration(entries: readonly VisualiserNavEntry[]): string {
  const json = JSON.stringify(entries).replace(/</g, "\\u003c");
  return `<script type="application/json" ${VISUALISER_NAV_ATTR}>${json}</script>`;
}

/**
 * A declared entry's fold, named for what it holds: "9 pages" when every
 * child is a page of its own, "3 entries" when they are places on this one.
 */
function foldedEntries(kids: readonly NavItem[]): string {
  const n = kids.length;
  const pages = kids.every((k) => k.href !== undefined && !k.href.startsWith("#"));
  return pages ? (n === 1 ? "1 page" : `${n} pages`) : n === 1 ? "1 entry" : `${n} entries`;
}

/**
 * A visualiser's DECLARED navigation, read off the page it is injected into.
 *
 * Owner, 2026-10-01 (#1757): *"make a qa flag to define LHS navbar for any
 * visualizer"*. Headings are what {@link documentIndexOf} can find, and a
 * dashboard whose content is rendered by script has none at build time — the
 * `/todos/` page is exactly that. So a generator may DECLARE the section:
 *
 * ```html
 * <script type="application/json" data-fa-visualiser-nav>
 *   [{ "label": "beans-and-todos", "items": [{ "href": "#todo-x", "label": "…" }] }]
 * </script>
 * ```
 *
 * Each entry is a row; an entry's `items` are its children, one level deep —
 * enough for "todos grouped by the KG node they are attached to" and no
 * more, because a deeper tree in a 248px column is a second page.
 *
 * Returns `undefined` when the page declares nothing or declares it badly:
 * a malformed declaration falls back to the headings rather than to an empty
 * section, and `check-viewer-nav.ts` reports a page with neither.
 */
export function visualiserNavOf(html: string, label: string): NavGroup | undefined {
  const m = new RegExp(
    `<script\\b[^>]*\\b${VISUALISER_NAV_ATTR}\\b[^>]*>([\\s\\S]*?)</script>`,
    "i",
  ).exec(html);
  if (!m) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(m[1]!);
  } catch {
    return undefined;
  }
  if (!Array.isArray(raw)) return undefined;
  type Entry = { href?: unknown; label?: unknown; qualifier?: unknown; items?: unknown };
  const row = (e: Entry, depth: number): NavItem | undefined =>
    typeof e?.label === "string" && e.label
      ? {
          label: e.label,
          ...(typeof e.qualifier === "string" && e.qualifier ? { qualifier: e.qualifier } : {}),
          // A BULLET, not the row's initial. A letter per row read as a
          // column of unrelated marks (B, T, P, D — #1757 screenshot); the
          // initial is the mark for a harness, which these rows are not.
          // No ▸ here: a ▸ in the glyph column read as a toggle that did
          // nothing (2026-11-10). A row with items gets the fold's own ▸
          // button below; a row without is a plain bullet.
          icon: "·",
          ...(typeof e.href === "string" && e.href ? { href: e.href } : {}),
          ...(depth > 0 ? { depth } : {}),
        }
      : undefined;
  // An entry's items are its CHILDREN, folded under the entry's own row, so
  // the ▸ beside a group opens and closes it (owner, 2026-11-10, on an IG's
  // "Home" and "Business Requirements": *"expand collapse on LHS navbar not
  // working"*). Laid out flat after the row, the ▸ was a picture of a toggle
  // over a list that was always open.
  const items: NavItem[] = [];
  for (const e of raw as Entry[]) {
    const r = row(e, 0);
    if (!r) continue;
    const kids = Array.isArray(e.items)
      ? (e.items as Entry[]).map((k) => row(k, 1)).filter((k): k is NavItem => k !== undefined)
      : [];
    items.push(kids.length ? { ...r, icon: "", children: kids, fold: foldedEntries(kids) } : r);
  }
  if (items.length === 0) return undefined;
  return { label, icon: "§", items, collapsible: true, open: true };
}
