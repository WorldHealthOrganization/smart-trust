/**
 * The shared navbar — its three regions, and the rail as an adapter over it.
 *
 * Owner, 2026-09-21: *"we should have same navbar across all folios though.
 * presented same way. need to comine the two."*
 *
 * This replaces `harness-rail.test.ts`, which tested a rail that owned its own
 * markup. It does not any more: `lib/navbar.ts` renders, `harness-rail.ts`
 * builds a model, and `mount-instance-docs.ts` injects. **The assertions that
 * matter moved with the code** — they are now about the REGIONS, because the
 * regions are what the owner specified and what a second caller (the Jekyll
 * sidebar, after #791 lands) has to be able to satisfy.
 *
 * The tests of this file that read the whole checkout (draws the navbar rows
 * of who-iris's declared graphs) live in `test/navbar-checkout.test.ts` (bean
 * `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "../../../test/support/site-fs.ts";
import { join } from "node:path";

import {
  NAV_COLLAPSED_PX,
  NAV_GLYPH_PX,
  NAV_OPEN_PX,
  NAV_PAD_PX,
  injectNavbar,
  navbarCss,
  navbarHtml,
  navbarRegionsHtml,
  type NavGroup,
  type NavbarModel,
} from "../../lib/navbar.js";
import { NAVBAR_LINKED, NAVBAR_ROW_CSS, NAVBAR_ROW_INLINE, NAVBAR_ROW_JS, declinesNavbar, expandRail, injectRail, railDataJson, railPageOf, wantsLinkedRail, railModel, withNavbarRow } from "../../lib/harness-rail.js";
import { injectRailOnce } from "../../lib/rail-once.js";
import { HOME_GLYPH, NAVBAR_CSS, NAV_RESIZE_MAX_PX, NAV_RESIZE_MIN_PX, NAV_WIDTH_KEY, documentIndexOf, numberedHeading, visualiserLabelOf, wireNavResize } from "../../lib/navbar.js";
import { BLANK_AVATAR } from "../../../schemas/ui/blank-avatar.js";
import { thinPageHtml } from "../../thin-page.js";
import {
  BEGIN,
  END,
  NAVBAR_GEOMETRY_MARKER_ERROR,
  navbarGeometryCssPath,
  renderNavbarGeometryCss,
  withGeometry,
} from "../../gen-navbar-geometry-css.js";
import { publishedUrlOf, solveCrop } from "../../harness-tiles.js";
import { siteDirFor } from "../../../schemas/kg/cat-harness.js";
import { declaredGraphs, toRootFor, visualiserHref } from "../../mount-instance-docs.js";
import { kindTitle } from "../../lib/nav-label.js";
import { graphTypologyRowDecor } from "../../lib/graph-typology-nav.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { siteNotBuilt } from "../../../test/support/checkout.ts";

// Typed WITH its middle region, because this fixture is a mounted page's
// navbar and a mounted page always has one. `graphs` became optional for the
// Jekyll surface, where the theme's own `<nav id="site-nav">` owns that
// region; saying so here keeps the tests below asserting on a present group
// rather than guarding a case this fixture does not have.
const model: NavbarModel & { graphs: NavGroup } = {
  instance: "who-iris",
  root: { href: "../who-iris/", label: "who-iris", icon: "◆", current: true },
  graphs: {
    label: "Graphs",
    items: [
      { href: "../docs/who-iris/", label: "docs", icon: "D" },
      // Declared with no published viewer — a GAP, drawn as a non-link, and
      // now SAYING which of the four reasons applies. The wording is the
      // generator's (`inertNote`); nothing in the renderer chooses it.
      { label: "catalogue", icon: "C", note: "no viewer yet" },
    ],
    collapsible: true,
    open: true,
  },
  harnesses: {
    label: "Harnesses",
    items: [
      { href: "../who-iris/", label: "who-iris" },
      { href: "../", label: "cat-harness", avatar: { src: "../assets/img/icons/cat-mark.svg" }, tone: 268 },
      { label: "bootstrap", tone: 96 },
    ],
    collapsible: true,
  },
  headHref: "../",
};

/**
 * Everything between a region's opening div and the NEXT REGION's.
 *
 * Bound to the three region names rather than to "the next `fa-nav-` div".
 * The first version did the latter and cut `fa-nav-top` short at the
 * `fa-nav-sub` inside its own `<details>` — reporting the document index as
 * missing from the region it was sitting in. A helper that is almost right
 * fails the code, not itself.
 */
const REGIONS = ["fa-nav-top", "fa-nav-graphs", "fa-nav-bottom"] as const;
const region = (html: string, cls: (typeof REGIONS)[number]): string => {
  const at = html.indexOf(`<div class="${cls}">`);
  expect({ cls, found: at > -1 }).toEqual({ cls, found: true });
  const next = REGIONS.map((r) => html.indexOf(`<div class="${r}">`, at + 1))
    .filter((i) => i > -1)
    .sort((a, b) => a - b)[0];
  return html.slice(at, next ?? html.length);
};

describe("three regions, and only the middle one scrolls", () => {
  const css = navbarCss();

  it("the middle grows and scrolls; the other two do neither", () => {
    // "KG libraries is a scrollable stacks between fixed top an bottom parts".
    expect(css).toContain(".fa-nav-top{flex:0 0 auto}");
    expect(css).toContain(".fa-nav-graphs{flex:1 1 auto;min-height:0;overflow-y:auto");
    expect(css).toContain(".fa-nav-bottom{flex:0 0 auto");
  });

  it("the middle declares `min-height:0`, or the fixed bottom scrolls away", () => {
    // NOT a tidy-up. A flex child defaults to `min-height:auto`, which refuses
    // to shrink below its content — so the column grows past the viewport and
    // the bottom region goes off-screen, taking the harnesses and home with
    // it. The failure looks like "the navbar lost its footer", not like a
    // layout bug.
    const rule = css.slice(css.indexOf(".fa-nav-graphs{"), css.indexOf("}", css.indexOf(".fa-nav-graphs{")));
    expect(rule).toContain("min-height:0");
  });

  it("renders the regions in the owner's order", () => {
    const html = navbarHtml(model);
    expect(html.indexOf("fa-nav-top")).toBeLessThan(html.indexOf("fa-nav-graphs"));
    expect(html.indexOf("fa-nav-graphs")).toBeLessThan(html.indexOf("fa-nav-bottom"));
  });

  it("puts the graphs in the MIDDLE and the harnesses in the BOTTOM", () => {
    // The regions are structural, so an item in the wrong one is a real
    // defect: a harness in the scrollable middle scrolls away, and a graph in
    // the fixed bottom eats the space the middle needs.
    const html = navbarHtml(model);
    expect(region(html, "fa-nav-graphs")).toContain("../docs/who-iris/");
    const bottom = html.slice(html.indexOf('<div class="fa-nav-bottom">'));
    expect(bottom).toContain("Harnesses");
    expect(region(html, "fa-nav-graphs")).not.toContain("Harnesses");
  });

  it("the instance's ROOT is in the fixed top, not inside the graphs group", () => {
    // A group labelled "Graphs" containing the layer itself is a label that
    // does not tell the truth — and the root is the one destination that must
    // stay reachable when the graphs are folded away, since the `☰` beside it
    // is a toggle rather than a link.
    const html = navbarHtml(model);
    expect(region(html, "fa-nav-top")).toContain('aria-current="page"');
    expect(region(html, "fa-nav-graphs")).not.toContain("../who-iris/");
  });

  it("the graphs FOLD IN ONE CLICK, and arrive open", () => {
    // Owner: "librarues should be in hambuger menu so can collase all". Open
    // by default, because a navbar whose content arrives folded looks empty.
    const html = navbarHtml(model);
    expect(region(html, "fa-nav-graphs")).toContain('<details class="fa-nav-group" open>');
  });

  it("an inert row SAYS why, in text a screen reader gets for free", () => {
    // THIS IS THE ASSERTION THAT WAS MISSING, and its absence is what let the
    // two navbars diverge. The Jekyll sidebar said why with
    // `title="declared, with no published viewer"` on a `<span>` — hover-only,
    // no keyboard path, not reliably announced — and this rail said nothing
    // whatever: `opacity:.55` and no words, state carried by contrast alone.
    // Both are `gjli`; the fix for both is that the reason is CONTENT.
    const graphs = region(navbarHtml(model), "fa-nav-graphs");
    expect(graphs).toContain('<span class="fa-nav-note">no viewer yet</span>');
    // Inside the same element as the label, so it is read as one row rather
    // than as a label and a detached aside.
    expect(graphs).toMatch(/<span class="fa-nav-dead" title="catalogue">.*?catalogue.*?no viewer yet.*?<\/span>/s);
    // NOT `aria-disabled`, and this is the owner's "so it does not read as a
    // control": nothing here is disabled, because nothing here is a control.
    // Marking a `<span>` disabled announces a widget that does not exist.
    expect(graphs).not.toContain("aria-disabled");
    // And not `title` either — the thing that was already tried. A row's
    // title is its full NAME (its label is cut to one line, owner
    // 2026-11-14), never the reason, which stays content.
    expect(graphs).not.toMatch(/title="[^"]*viewer/);
  });

  it("a row that OPENS carries no note — only an inert row owes a reason", () => {
    const graphs = region(navbarHtml(model), "fa-nav-graphs");
    const docs = graphs.slice(graphs.indexOf("../docs/who-iris/"));
    expect(docs.slice(0, docs.indexOf("</a>"))).not.toContain("fa-nav-note");
  });

  it("a declared graph with NO viewer is listed, as a non-link", () => {
    // "there shuold be all the harness controlled dirs/graphs". Omitting the
    // unpublished ones answers "what is in this KG" with a shorter and wronger
    // list than the declaration gives. `harness-tiles` words it exactly right:
    // declared and not rendered is a GAP, not a dead link — and `pb04` is why
    // it must not be drawn as a link.
    const graphs = region(navbarHtml(model), "fa-nav-graphs");
    expect(graphs).toContain("catalogue");
    expect(graphs).toContain('<span class="fa-nav-dead" title="catalogue">');
    expect(graphs).not.toContain('href="undefined"');
  });

  it("no home row: the header's mark and name are the link to the landing page (owner, 2026-10-30)", () => {
    // "who eblmen not clicable to go to landing page. also dont need home on
    // bottomof harnes navbars."
    const html = navbarHtml(model);
    const bottom = html.slice(html.indexOf('<div class="fa-nav-bottom">'));
    expect(bottom).not.toContain("\u2302");
    const head = region(html, "fa-nav-top");
    expect(head).toContain('<a class="fa-nav-head-link" href="../"');
    // The open/close label stays, so a touch screen can still open the bar.
    expect(head).toContain('<label class="fa-nav-head-toggle" for="fa-nav-open"');
  });
});

describe("the exploding menu", () => {
  it("is a <details>, so it works with no script and announces its state", () => {
    // The reason `nav_footer_custom.html` already gives: this IS navigation,
    // and a scripted disclosure is one a keyboard and a screen reader have to
    // be told about separately.
    const html = navbarHtml(model);
    expect(html).toContain('<details class="fa-nav-group"');
    expect(html).toContain("<summary>");
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html.toLowerCase()).not.toContain("onclick");
  });

  it("uses a harness's AVATAR when it has one and its initial when it does not", () => {
    // `603s`/#791 is landing the avatars; they arrive through the model and
    // nothing in the renderer changes. Until then an item falls back to an
    // initial — not a question mark, because a navbar is not the place to
    // render a gap as a glyph.
    const html = navbarHtml(model);
    expect(html).toContain('<img src="../assets/img/icons/cat-mark.svg"');
    expect(html).toContain(">B</span>"); // bootstrap, no avatar declared
  });

  it("does not repeat a label that is its own initial (\"A A\")", () => {
    // A glossary's letter headings put rows labelled "A", "B" … in Contents;
    // the mark already shows the letter (owner, 2026-10-10: "don't duplicate").
    const one: NavbarModel = { instance: "x", root: { href: "#letter-A", label: "A" } };
    const html = navbarHtml(one);
    expect(html).toContain('<span class="fa-nav-label"><span class="fa-nav-sr">A</span></span>');
    // A longer label keeps its visible text beside its initial.
    expect(navbarHtml(model)).toContain('<span class="fa-nav-label">bootstrap</span>');
  });

  it("carries a declared tone through to the mark", () => {
    expect(navbarHtml(model)).toContain("--fa-nav-hue:268");
  });

  it("an item with nowhere to go is NOT a link", () => {
    // `pb04`: a dead link is worse than no link, because it invites a click
    // and then reads as "this site is broken". `bootstrap` has href null.
    const html = navbarHtml(model);
    expect(html).toContain('<span class="fa-nav-dead" title="bootstrap">');
    expect(html).not.toContain('<a href="undefined"');
  });
});

describe("at rest it is a strip, and opens three ways", () => {
  const css = navbarCss();

  it("rests at exactly the glyph column and its gutters", () => {
    expect(NAV_COLLAPSED_PX).toBe(NAV_PAD_PX * 2 + NAV_GLYPH_PX);
    expect(css).toContain(`width:${NAV_COLLAPSED_PX}px`);
    expect(css).toContain(`body{padding-inline-start:${NAV_COLLAPSED_PX}px}`);
  });

  it("mirrors on a right-to-left page: no physical left or right edge (owner, 2026-11-12)", () => {
    // "in RTL, the LHS navbar needs to be RHS". Every edge is a logical
    // property, so `dir="rtl"` moves the bar, the page's padding, the indents,
    // the drag edge and the tooltips to the other side with no second set of
    // numbers. The avatar crop (`left:`/`top:` inside its own frame) is a
    // position within an image, not an edge of the page, and is inline.
    expect(css).not.toMatch(/(?:^|[;{])(?:left|right|padding-left|padding-right|margin-left|margin-right)\s*:/);
    expect(css).toContain(".fa-nav{position:fixed;top:0;inset-inline-start:0;");
    // The two arrows are the only thing a mirror cannot infer.
    expect(css).toContain('[dir="rtl"] .fa-nav-twisty[aria-expanded="false"]>span');
    expect(css).toContain('[dir="rtl"] .fa-nav-head-toggle>span[aria-hidden]{transform:scaleX(-1)}');
    // The drag edge widens toward the page on either side.
    const src = wireNavResize.toString();
    expect(src).toContain('direction === "rtl"');
    expect(src).toContain("clientWidth - m.clientX");
  });

  it("is CLOSED, not gone", () => {
    // The correction that cost a round: "clicking it away completelt
    // disappeared … i expected … that it slides to the far left, icon width
    // thick."
    expect(css).not.toContain("visibility:hidden");
    expect(css).not.toContain("translateX(-100%)");
  });

  it("slides the rail but steps the page, and holds still under reduced motion (owner, 2026-11-15, #2343)", () => {
    // Animating the page's padding re-laid out the whole document every
    // frame. Only the rail's width may carry a duration; the page's padding
    // moves once, so its only transition is a 0s one.
    expect(css).not.toMatch(/transition:padding-inline-start \.?[1-9]/);
    expect(css).toContain("body{transition:padding-inline-start 0s linear .14s}");
    const motion = css.indexOf("@media(prefers-reduced-motion:no-preference){.fa-nav{transition:width .14s ease}");
    expect(motion).toBeGreaterThan(-1);
    // No width transition on the rail outside that guard.
    expect(css.replace(/@media\(prefers-reduced-motion:no-preference\)\{[^@]*?\}\}/g, "")).not.toContain("transition:width");
  });

  it("opens on hover, on keyboard focus, and on the pinned checkbox", () => {
    expect(css).toContain(
      `.fa-nav:hover,.fa-nav:has(:focus-visible),.fa-nav:has(.fa-nav-open:checked){width:var(--fa-nav-w,${NAV_OPEN_PX}px)}`,
    );
  });

  it("opens to the width the reader dragged it to, else the default (owner, 2026-11-10, option D)", () => {
    // Every open width reads `--fa-nav-w`: the bar, its column and the page's padding.
    expect(css).not.toMatch(new RegExp(`(?<!--fa-nav-w,)\\b${NAV_OPEN_PX}px`));
    expect(css).toContain(`.fa-nav-in{width:var(--fa-nav-w,${NAV_OPEN_PX}px)`);
    expect(css).toContain(`padding-inline-start:var(--fa-nav-w,${NAV_OPEN_PX}px)`);
    // The drag edge's limits and key are stated once: the inlined function says the same.
    const src = wireNavResize.toString();
    expect(src).toContain(String(NAV_RESIZE_MIN_PX));
    expect(src).toContain(String(NAV_RESIZE_MAX_PX));
    expect(src).toContain(`"${NAV_WIDTH_KEY}"`);
    // One line, full name on hover (owner, 2026-11-14, replacing option D's wrap).
    expect(css).toContain(".fa-nav-label{min-width:0;flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
  });

  it("renders no [x] and no ☰ — the header is the one control (#1757)", () => {
    const html = navbarHtml(model);
    expect(html).not.toContain("fa-nav-close");
    expect(html).not.toContain("&#9776;");
    expect(html).not.toContain("☰");
    expect(css).not.toContain(".fa-nav-close");
  });

  it("ONE control drives the checkbox, and it is in the header", () => {
    const html = navbarHtml(model);
    const id = /<input[^>]*class="fa-nav-open"[^>]*id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeDefined();
    const labels = [...html.matchAll(new RegExp(`<label class="([^"]+)" for="${id}"`, "g"))];
    // With a landing page the header is the home link and the label sits in
    // it (owner, 2026-10-30); without one the header is the label.
    expect(labels.map((m) => m[1])).toEqual(["fa-nav-head-toggle"]);
    const bare = navbarHtml({ ...model, headHref: undefined });
    expect([...bare.matchAll(new RegExp(`<label class="([^"]+)" for="${id}"`, "g"))].map((m) => m[1])).toEqual(["fa-nav-head"]);
  });

  it("the header carries the instance's mark — the home icon when no avatar is declared (owner, 2026-11-02)", () => {
    const html = navbarHtml({ ...model, instance: "who-iris" });
    expect(region(html, "fa-nav-top")).toContain(`<path d="${HOME_GLYPH}"`);
    expect(region(html, "fa-nav-top")).not.toMatch(/<span class="fa-nav-glyph[^"]*"[^>]*>W<\/span>/);
    // A blank declared mark is no mark of the site's own, so it is the house too.
    const blank = navbarHtml({ ...model, mark: { glyphPath: BLANK_AVATAR.glyph, tone: 184 } });
    expect(region(blank, "fa-nav-top")).toContain(`<path d="${HOME_GLYPH}"`);
    expect(region(blank, "fa-nav-top")).toContain("--fa-nav-hue:184");
    expect(region(blank, "fa-nav-top")).not.toContain("fa-nav-blank");
  });

  it("a declared glyph or letter beats the home icon", () => {
    const glyph = navbarHtml({ ...model, mark: { glyphPath: "M3 18h18" } });
    expect(region(glyph, "fa-nav-top")).not.toContain(HOME_GLYPH);
    const icon = navbarHtml({ ...model, mark: { icon: "Q" } });
    expect(region(icon, "fa-nav-top")).toMatch(/>Q<\/span>/);
  });

  it("the header carries the declared avatar when there is one", () => {
    const html = navbarHtml({ ...model, mark: { avatar: { src: "../a.svg" }, tone: 268 } });
    expect(region(html, "fa-nav-top")).toContain('<img src="../a.svg" alt="" loading="lazy" decoding="async">');
    expect(region(html, "fa-nav-top")).toContain("--fa-nav-hue:268");
  });

  it("every avatar image is lazy, so a folded Harnesses row fetches nothing until opened (2026-10-10)", () => {
    // Three harness marks are crops of full landing-card pictures (100-355 KB
    // each) and two sat in a folded disclosure on every folio page.
    const crop = { src: "../card.webp", region: { x: 0, y: 0, w: 0.5, h: 0.5 } };
    const html = navbarHtml({ ...model, mark: { avatar: crop, tone: 268 } });
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(imgs.length).toBeGreaterThan(0);
    for (const i of imgs) expect(i).toContain('loading="lazy"');
  });

  it("an avatar that declares its ground `none` sits on the rail itself — no tone square (issue #46, gap 5)", () => {
    const html = navbarHtml({ ...model, mark: { avatar: { src: "../a.svg", ground: "none" }, tone: 268 } });
    expect(region(html, "fa-nav-top")).toContain('<img src="../a.svg" alt="" loading="lazy" decoding="async">');
    expect(region(html, "fa-nav-top")).not.toContain("--fa-nav-hue:268");
  });

  it("escapes what it is given", () => {
    const html = navbarHtml({ ...model, instance: '<img src=x onerror="pwn">' });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("the document index sits in the FIXED top", () => {
  it("appears there when a document is open", () => {
    // "when a document or other indexed object is opened, the document
    // index/idices are shown in a navbar tab/menu." In the fixed top, because
    // it is about the thing the reader is looking at rather than about the
    // graph they are in — so it must not scroll away with the graphs.
    const html = navbarHtml({
      ...model,
      documentIndex: { label: "Contents", items: [{ href: "#s1", label: "Introduction" }], collapsible: true },
    });
    expect(region(html, "fa-nav-top")).toContain("Introduction");
  });

  it("is ABSENT when nothing is open, not empty", () => {
    // An empty disclosure labelled "Contents" invites a click that does
    // nothing.
    expect(navbarHtml(model)).not.toContain("Contents");
  });
});

describe("the rail is an adapter, not a second navbar", () => {
  const opts = { instance: "who-iris", toRoot: "..", links: model.graphs.items };

  it("builds a model rather than markup", () => {
    const m = railModel(opts);
    expect(m.instance).toBe("who-iris");
    expect(m.graphs.items).toEqual(model.graphs.items);
    expect(m.graphs.collapsible).toBe(true);
    expect(m.headHref).toBe("../");
  });

  it("sends home to the composed site when the page names one (data-fa-home)", () => {
    // Owner, 2026-11-10: an IG composed into smart-html-jtd is a subgraph of
    // that site's KG, so the rail's home is the composed site's landing page.
    expect(railModel({ ...opts, homeHref: "/smart-html-jtd/" }).headHref).toBe("/smart-html-jtd/");
    const files = new Map<string, string>();
    const railed = injectRailOnce(`<html><body><h2 id="a">A</h2></body></html>`, { ...opts, emitRailData: (f: string, b: string) => void files.set(f, b) })!;
    const read = (n: string) => railDataJson(files.get(`assets/navbar/${n}.js`)!);
    const own = expandRail(railed, read);
    expect(own).toContain('<a class="fa-nav-head-link" href="../"');
    const composed = railed.replace(/(id="fa-rail" data-fa-root="[^"]*" data-fa-to-root="[^"]*")/, '$1 data-fa-home="/smart-html-jtd/"');
    expect(railPageOf(composed)!.home).toBe("/smart-html-jtd/");
    expect(railPageOf(railed)!.home).toBeUndefined();
    const home = expandRail(composed, read);
    expect(home).toContain('<a class="fa-nav-head-link" href="/smart-html-jtd/"');
    // Only home moves: the rest of the rail is the same.
    expect(home.replace('href="/smart-html-jtd/"', 'href="../"').replace(' data-fa-home="/smart-html-jtd/"', "")).toBe(own);
  });

  it("names the header for a LARGER home: SMART Guidelines on a composed IG (2026-11-10)", () => {
    const files = new Map<string, string>();
    const emit = { ...opts, emitRailData: (f: string, b: string) => void files.set(f, b) };
    const read = (n: string) => railDataJson(files.get(`assets/navbar/${n}.js`)!);
    const head = (html: string) => /<div class="fa-nav-head fa-nav-head--home">[\s\S]*?<\/div>/.exec(html)![0];
    // From the page's block — a composing site (`data-fa-home-name`).
    const own = injectRailOnce(`<html><body><h2 id="a">A</h2></body></html>`, emit)!;
    const composed = own.replace(/(id="fa-rail" data-fa-root="[^"]*" data-fa-to-root="[^"]*")/, '$1 data-fa-home="/smart-html-jtd/" data-fa-home-name="SMART Guidelines"');
    expect(railPageOf(composed)!.homeName).toBe("SMART Guidelines");
    const h = head(expandRail(composed, read));
    expect(h).toContain('href="/smart-html-jtd/" title="SMART Guidelines: landing page"');
    expect(h).toContain('<span class="fa-nav-name fa-nav-label">SMART Guidelines</span>');
    expect(h).toContain(`d="${HOME_GLYPH}"`);
    expect(head(expandRail(own, read))).toContain('title="who-iris: landing page"');
  });

  it("OMITS the harnesses region when it could not be read", () => {
    // Third state, said by absence: `[]` would render an empty "Harnesses"
    // disclosure, which reads as a site with no harnesses rather than as a
    // navbar that could not find out.
    expect(railModel(opts).harnesses).toBeUndefined();
    expect(railModel({ ...opts, harnesses: [{ label: "x" }] }).harnesses?.items).toHaveLength(1);
  });

  describe("injection", () => {
    const page = '<!doctype html><html><body><nav class="main">IRIS</nav><p>x</p></body></html>';

    it("puts the navbar first in the DOM and leaves the page intact", () => {
      const out = injectRail(page, opts)!;
      expect(out).toContain('<nav class="main">'); // the host's own chrome survives
      expect(out.indexOf("fa-nav")).toBeLessThan(out.indexOf('nav class="main"'));
    });

    it("REFUSES a document with no body rather than passing it through", () => {
      // A fragment, a redirect stub or a file that is HTML only by extension
      // is not a page this belongs on. Returning the input unchanged would
      // make "injected" and "left alone" indistinguishable to a caller that
      // reports a count.
      expect(injectRail("<p>just a fragment</p>", opts)).toBeUndefined();
    });

    it("refuses a page that already carries one", () => {
      // Mounting twice into the same site directory is a real sequence — the
      // workflows re-run — and a second navbar would stack on the first.
      expect(injectNavbar(injectRail(page, opts)!, model)).toBeUndefined();
    });
  });
});

describe("toRoot depth — the arithmetic that broke first", () => {
  // IMPORTED, not restated. The first version of this block defined its own
  // copy "so the test would not share the buggy one" — and when the bug was
  // planted back into `mount-instance-docs.ts`, all twelve tests went on
  // passing while 57 rail links broke.

  it("a mount index at depth 1 reaches the root with one hop", () => {
    expect(toRootFor("smart-trust", "index.html")).toBe("..");
  });

  it("a page NESTED in that mount needs one more", () => {
    expect(toRootFor("smart-trust", "artifact/ValueSet-X.html")).toBe("../..");
  });

  it("a two-segment route at depth 2 reaches the root with two", () => {
    expect(toRootFor("library/who-iris", "index.html")).toBe("../..");
  });

  it("and nested inside THAT, three", () => {
    expect(toRootFor("library/who-iris", "a/b.html")).toBe("../../..");
  });
});

describe("where a kind's navbar link actually goes", () => {
  it("an index under the published tree addresses as its directory", () => {
    expect(visualiserHref("cat-harness/docs/cat-harness/library/who-iris/index.html", "cat-harness/docs")).toBe(
      "cat-harness/library/who-iris/",
    );
  });

  it("a page that is NOT an index addresses as itself", () => {
    expect(visualiserHref("cat-harness/docs/qa/axes.html", "cat-harness/docs")).toBe("qa/axes.html");
  });

  it("REFUSES a visualiser outside the published tree rather than composing a URL", () => {
    expect(visualiserHref("who-iris/library/index.html", "cat-harness/docs")).toBeUndefined();
  });
});

describe("every declared graph reaches the navbar, linked or not", () => {
  // The owner's report: "there shuold be all the harness controlled
  // dirs/graphs". The navbar listed two of who-iris's six.
  //
  // THIS IS BOUND TO `declaredGraphs`, not to a hand-built model. The
  // renderer's handling of a non-link is tested above against a fixture, and
  // that fixture went on passing while the PRODUCER emitted only the mounted
  // kinds — the regression was visible only by building a site. A test that
  // cannot see the producer cannot see this defect.
  const kinds = (linked: Record<string, string> = {}) =>
    declaredGraphs("who-iris", new Map(Object.entries(linked))).map((i) => i.label);
  // Rows say the kind's DISPLAY name since bean `ob3m` finding 6 ("One name
  // everywhere"), so a kind word is compared through the same function.
  const K = (kind: string): string => kindTitle(kind);

  it("is sorted, so the order is a function of the declaration", () => {
    expect(kinds()).toEqual([...kinds()].sort());
  });

  it("never labels a row that OPENS, even if a stale reason is passed for it", () => {
    // The href wins. A `note` left behind for a kind whose viewer has since
    // been published would otherwise caption a working link "no viewer yet" —
    // and the note's whole job is to be true.
    const got = declaredGraphs(
      "who-iris",
      new Map([["docs", "../docs/who-iris/"]]),
      new Map([["docs", { note: "no viewer yet" }]]),
    );
    expect(got.find((i) => i.label === K("docs"))?.note).toBeUndefined();
  });

  it("returns EMPTY for an instance that declares nothing readable", () => {
    // Not a throw and not a guess. An unparseable declaration is
    // `kg:schema:check`'s finding, not this script's; here it is an empty
    // middle, and the caller still renders the root and the harnesses.
    expect(declaredGraphs("does-not-exist", new Map())).toEqual([]);
  });
});

describe("the geometry is stated ONCE — `sjic`", () => {
  // The defect this guards was invisible to a suite that had a test on each
  // side: `navbar.ts` asserted its own numbers and `sidebar-strip.test.ts`
  // asserted `docs-ui.css`'s, and they were 40px against 56px at rest.
  // DERIVED, not spelled out. `site-dir-single-answer` refuses a literal site
  // root anywhere in source, including here — and it caught this file's first
  // draft, which is the gate working: a test that hardcodes `docs/` is a
  // second answer to the question `siteDirFor` exists to answer, and it goes
  // on passing against a path nothing serves.
  const INSTANCE = HARNESS_ROOT;
  const uiCss = readFileSync(join(INSTANCE, navbarGeometryCssPath(INSTANCE)), "utf8");
  // The generated REGION, sliced out of the authored stylesheet it now lives
  // in. See the "self-sufficient" spec below for why it is a region rather
  // than a second file.
  const geometryCss = uiCss.slice(uiCss.indexOf(BEGIN), uiCss.indexOf(END) + END.length);

  it("the generated stylesheet carries the module's own numbers", () => {
    expect(geometryCss).toBe(renderNavbarGeometryCss());
  });

  it("the rail's px and the sidebar's rem are THE SAME LENGTH", () => {
    // The whole bean in one assertion. Read the rem out of the generated file
    // rather than restating it, or this test becomes a third copy.
    const rem = (name: string): number => {
      const m = new RegExp(`--fa-nav-${name}:\\s*([0-9.]+)rem`).exec(geometryCss);
      expect({ name, found: m !== null }).toEqual({ name, found: true });
      return Number(m![1]) * 16;
    };
    expect(rem("collapsed")).toBe(NAV_COLLAPSED_PX);
    expect(rem("open")).toBe(NAV_OPEN_PX);
    expect(rem("mark")).toBe(NAV_GLYPH_PX);
  });

  it("defines every width ONLY inside the generated region", () => {
    // The duplication this bean exists to end, checked from the other side: a
    // hand-authored definition anywhere outside the fences is the second copy
    // coming back.
    //
    // NOT "exactly once" — the first draft asserted that and was wrong about
    // the CSS rather than finding a bug in it. `--fa-nav-open` is defined
    // TWICE on purpose, at `:root` and again inside the wide media query,
    // because the theme widens its own sidebar there. The invariant is about
    // WHERE a definition may appear, not how many there are.
    const authored = uiCss.slice(0, uiCss.indexOf(BEGIN)) + uiCss.slice(uiCss.indexOf(END));
    for (const prop of ["--fa-nav-collapsed", "--fa-nav-open", "--fa-nav-mark", "--fa-nav-pad"]) {
      expect({ prop, definedOutsideTheRegion: new RegExp(`${prop}:\\s*[0-9]`).test(authored) }).toEqual({
        prop,
        definedOutsideTheRegion: false,
      });
      expect({ prop, definedInside: new RegExp(`${prop}:\\s*[0-9]`).test(geometryCss) }).toEqual({
        prop,
        definedInside: true,
      });
    }
    expect(uiCss).toContain("var(--fa-nav-collapsed)");
  });

  it("docs-ui.css is SELF-SUFFICIENT — the region travels with it", () => {
    // WHY A REGION AND NOT A SECOND FILE, and it cost a debugging session.
    //
    // The first version generated `navbar-geometry.css` beside docs-ui.css and
    // linked it from `head_custom.html`. That made docs-ui.css depend on a
    // file 23 sources inline it WITHOUT — every e2e fixture that builds a page
    // from `readFileSync(docs-ui.css)`. Those pages got
    // `width: var(--fa-nav-collapsed)` with the property undefined, which is
    // INVALID AT COMPUTED-VALUE TIME and therefore silent: the sidebar took
    // `auto` width, `.side-bar + .main` lost its margin, the main column
    // landed on top of the fixed sidebar, and a11y clicks timed out against a
    // button that was visible, enabled and stable throughout.
    //
    // Patching 23 fixtures would have been 23 places to forget. One
    // self-sufficient stylesheet is none.
    expect(uiCss.indexOf(BEGIN)).toBeGreaterThanOrEqual(0);
    expect(uiCss.indexOf(END)).toBeGreaterThan(uiCss.indexOf(BEGIN));
    // Before every rule that reads it, or the cascade order stops being true.
    expect(uiCss.indexOf(END)).toBeLessThan(uiCss.indexOf("var(--fa-nav-collapsed)"));
  });

  it("refuses an unterminated region rather than guessing where it ends", () => {
    // A wrong guess eats authored CSS, which is the one outcome a generator
    // over a hand-written file must never have.
    expect(() => withGeometry(`${BEGIN}\n:root{}\n/* no end */`)).toThrow(
      NAVBAR_GEOMETRY_MARKER_ERROR,
    );
  });

  it("is idempotent — regenerating replaces the region, never stacks it", () => {
    const once = withGeometry("body{}");
    expect(withGeometry(once)).toBe(once);
    expect([...withGeometry(once).matchAll(/navbar-geometry:begin/g)]).toHaveLength(1);
  });

  it("the strip is the mark and its two gutters, derived either way", () => {
    expect(NAV_COLLAPSED_PX).toBe(NAV_PAD_PX * 2 + NAV_GLYPH_PX);
  });
});

describe("the document index — `documentIndexOf`", () => {
  const page = (body: string) => `<html><body>${body}</body></html>`;

  it("gives a heading's NUMBER to the mark and keeps only the title as the label — owner 2026-10-30", () => {
    // "lots of waste in navbar dont spell out Chapter 1".
    const g = documentIndexOf(
      page(`<h2 id="a">About this draft</h2><h2 id="c1">Chapter 1. Why registries matter</h2><h3 id="s">7.1 Identity management</h3><h2 id="x">Annex 9: Glossary</h2>`),
    )!;
    expect(g.items.map((i) => [i.icon, i.label])).toEqual([
      [undefined, "About this draft"],
      ["1", "Why registries matter"],
      ["9", "Glossary"],
    ]);
    expect(g.items[1]!.children?.map((i) => [i.icon, i.label])).toEqual([["7.1", "Identity management"]]);
  });

  it("numberedHeading leaves a heading with no number, or nothing but a number, alone", () => {
    expect(numberedHeading("Introduction")).toEqual({ label: "Introduction" });
    expect(numberedHeading("Chapter 3")).toEqual({ label: "Chapter 3" });
    expect(numberedHeading("2024 in review")).toEqual({ label: "2024 in review" });
    expect(numberedHeading("Appendix A Data elements")).toEqual({ icon: "A", label: "Data elements" });
    expect(numberedHeading("1.1.1 What is a reference architecture?")).toEqual({ label: "1.1.1 What is a reference architecture?" });
  });

  it("takes h2 and h3 that carry an id, nesting the h3s", () => {
    const g = documentIndexOf(
      page(`<h2 id="a">Alpha</h2><h3 id="b">Beta</h3><h2 id="c">Gamma</h2>`),
    );
    // An h3 is a CHILD of the h2 above it, folded (bean `r2ld`).
    expect(g?.items.map((i) => [i.href, i.label, i.depth ?? 0])).toEqual([
      ["#a", "Alpha", 0],
      ["#c", "Gamma", 0],
    ]);
    expect(g?.items[0]!.children?.map((i) => [i.href, i.label, i.depth])).toEqual([["#b", "Beta", 1]]);
    expect(g?.items[0]!.fold).toBe("1 sub-section");
    expect(g?.items[1]!.fold).toBeUndefined();
  });

  it("FOLDS sub-sections under their section, closed, toggled FROM THE SECTION'S ROW — owners 2026-10-05 and 2026-10-15", () => {
    // "on this page should have sub-sections collapsible" (bean `r2ld`).
    const g = documentIndexOf(
      page(`<h2 id="a">Alpha</h2><h3 id="b">Beta</h3><h3 id="b2">Beta 2</h3><h2 id="c">Gamma</h2>`),
    )!;
    expect(g.items[0]!.fold).toBe("2 sub-sections");
    const html = navbarHtml({ instance: "x", graphs: { label: "Graphs", items: [] }, documentIndex: g });
    // The section stays a plain link; its toggle sits BESIDE it on the same
    // row, closed, and no bare "2 sub-sections" row is drawn ("what is 26?
    // why unlabeled?", owner 2026-10-15).
    expect(html).toMatch(
      /<a href="#a"[^>]*>[\s\S]*?<\/a><button type="button" class="fa-nav-twisty" aria-expanded="false" aria-controls="(fa-nav-fold-\d+)" aria-label="Show Alpha's 2 sub-sections"[^>]*>[\s\S]*?<\/button><div class="fa-nav-kids" id="\1" hidden>/,
    );
    expect(html).not.toContain("fa-nav-fold\"");
    expect(html).not.toMatch(/<summary>[^<]*<span class="fa-nav-label">\d+ sub-sections?</);
    expect(html).toContain('href="#b2"');
  });

  it("an h3 BEFORE any h2 stays a row of its own", () => {
    const g = documentIndexOf(page(`<h3 id="x">Lead</h3><h2 id="a">A</h2><h3 id="b">B</h3>`))!;
    expect(g.items.map((i) => i.label)).toEqual(["Lead", "A"]);
    expect(g.items[0]!.depth).toBe(1);
  });

  it("SKIPS a heading with no id — it is not a destination", () => {
    // `pb04` one layer in: a fragment link to a heading with no id goes
    // nowhere, and a dead row invites a click and then reads as broken.
    const g = documentIndexOf(page(`<h2 id="a">Alpha</h2><h2>Nowhere</h2><h2 id="c">Gamma</h2>`));
    expect(g?.items.map((i) => i.label)).toEqual(["Alpha", "Gamma"]);
  });

  it("ignores h1 and h4 — the title, and past where an index helps", () => {
    const g = documentIndexOf(
      page(`<h1 id="t">Title</h1><h2 id="a">A</h2><h4 id="d">D</h4><h2 id="b">B</h2>`),
    );
    expect(g?.items.map((i) => i.label)).toEqual(["A", "B"]);
  });

  it("strips markup and entities out of a heading's text", () => {
    const g = documentIndexOf(page(`<h2 id="a">A <code>b&amp;c</code></h2><h2 id="z">Z</h2>`));
    expect(g?.items[0]!.label).toBe("A b&c");
  });

  it("is ABSENT below two rows, never an empty or one-row menu", () => {
    // Same rule as the harnesses region: an empty disclosure invites a click
    // that does nothing, and a "Contents" holding the one section the reader
    // is looking at is that defect with a row in it.
    expect(documentIndexOf(page(`<p>no headings</p>`))).toBeUndefined();
    expect(documentIndexOf(page(`<h2 id="a">Only</h2>`))).toBeUndefined();
  });

  it("`injectRail` reads it off the page it is given", () => {
    // Not passed in: the mount loops over hundreds of files, and the other
    // shape invites the right nav carrying the previous page's contents.
    const html = injectRail(page(`<h2 id="a">Alpha</h2><h2 id="b">Beta</h2>`), {
      instance: "who-iris",
      toRoot: "..",
      links: [],
    });
    expect(html).toContain("Alpha");
    expect(html).toContain('href="#b"');
  });

  it("a page with nothing to index gets NO index region", () => {
    const html = injectRail(page(`<p>flat</p>`), { instance: "who-iris", toRoot: "..", links: [] })!;
    // Asserted on the FIXED TOP, not on the page: `fa-nav-group` is also the
    // graphs group's class and that region always renders. The first draft of
    // this test checked the whole document and failed for that reason — which
    // is the assertion being wrong, not the code.
    expect(region(html, "fa-nav-top")).not.toContain("fa-nav-group");
    expect(html).toContain("fa-nav-graphs");
  });

  it("is the page's OWN section: first in the middle, the only group open (#1757)", () => {
    const html = injectRail(page(`<h2 id="a">A</h2><h2 id="b">B</h2>`), {
      instance: "who-iris",
      toRoot: "..",
      links: [],
    });
    // It moved OUT of the fixed top: there it arrived folded while Graphs
    // arrived open — the one section about this page was the one you had to open.
    expect(region(html!, "fa-nav-top")).not.toContain('href="#a"');
    const graphs = region(html!, "fa-nav-graphs");
    expect(graphs).toContain('href="#a"');
    const open = [...graphs.matchAll(/<details class="fa-nav-group"( open)?><summary>[\s\S]*?<span class="fa-nav-label">([^<]*)</g)];
    expect(open.filter((m) => m[1]).map((m) => m[2])).toEqual(["On this page"]);
  });

  it("is named for the visualiser when the caller says which", () => {
    const html = injectRail(page(`<h2 id="a">A</h2><h2 id="b">B</h2>`), {
      instance: "cat-harness",
      toRoot: "..",
      links: [],
      visualiserLabel: "todos",
    });
    expect(region(html!, "fa-nav-graphs")).toContain('<span class="fa-nav-label">todos</span>');
  });

  it("prefers a DECLARED visualiser nav over the headings", () => {
    const decl = `<script type="application/json" data-fa-visualiser-nav>` +
      `[{"label":"node-x","href":"#node-x","items":[{"label":"t1","href":"#todo-t1"}]}]</script>`;
    const html = injectRail(page(`${decl}<h2 id="a">A</h2><h2 id="b">B</h2>`), {
      instance: "cat-harness",
      toRoot: "..",
      links: [],
    });
    const graphs = region(html!, "fa-nav-graphs");
    expect(graphs).toContain('href="#todo-t1"');
    expect(graphs).not.toContain('href="#a"');
  });

  it("folds a declared entry's items under its row, open only where the page is (IG menu, 2026-11-10)", () => {
    const decl = `<script type="application/json" data-fa-visualiser-nav>` +
      `[{"label":"Home","items":[{"label":"Summary","href":"./index.html"},{"label":"Changes","href":"./changes.html"}]},` +
      `{"label":"Indices","items":[{"label":"Artifacts","href":"./artifacts.html"}]}]</script>`;
    const files = new Map<string, string>();
    const opts = { instance: "ig", toRoot: ".", links: [], emitRailData: (f: string, b: string) => void files.set(f, b) };
    const read = (n: string) => railDataJson(files.get(`assets/navbar/${n}.js`)!);
    const html = expandRail(injectRailOnce(page(decl), { ...opts, here: "/changes.html" })!, read);
    const graphs = region(html, "fa-nav-graphs");
    // Each group is a row with a twisty, and its pages sit inside the fold.
    const twisties = [...graphs.matchAll(/<button type="button" class="fa-nav-twisty" aria-expanded="(true|false)" aria-controls="([^"]+)"/g)];
    expect(twisties.map((m) => m[1])).toEqual(["true", "false"]);
    expect(graphs).toMatch(new RegExp(`<div class="fa-nav-kids" id="${twisties[0]![2]}">[\\s\\S]*?href="./changes.html"[^>]*aria-current="page"`));
    expect(graphs).toMatch(new RegExp(`<div class="fa-nav-kids" id="${twisties[1]![2]}" hidden>[\\s\\S]*?href="./artifacts.html"`));
    expect(graphs).toContain('data-fa-fold="2 pages"');
  });

  it("injectRailOnce drops the declaration once the rail has read it, and keeps a malformed one (gp2f)", () => {
    const decl = `<script type="application/json" data-fa-visualiser-nav>[{"label":"node-x","href":"#node-x"}]</script>`;
    const opts = { instance: "cat-harness", toRoot: "..", links: [] };
    const read = injectRailOnce(page(`${decl}<h2 id="a">A</h2>`), opts)!;
    expect(region(read, "fa-nav-graphs")).toContain('href="#node-x"');
    expect(read).not.toContain("data-fa-visualiser-nav");
    const bad = `<script type="application/json" data-fa-visualiser-nav>not json</script>`;
    expect(injectRailOnce(page(`${bad}<h2 id="a">A</h2>`), opts)!).toContain(bad);
    // Railed from shared data, the page carries the menu not at all: the
    // declared menu is the same on every page of a guide, so it goes in the
    // shared file, and two pages of one guide share ONE file.
    const files = new Map<string, string>();
    const emit = { ...opts, emitRailData: (f: string, b: string) => void files.set(f, b) };
    const one = injectRailOnce(page(`${decl}<h2 id="a">A</h2>`), { ...emit, here: "/one.html" })!;
    const two = injectRailOnce(page(`${decl}<h2 id="b">B</h2>`), { ...emit, here: "/two.html" })!;
    expect(one).not.toContain("data-fa-visualiser-nav");
    expect(railPageOf(one)!.documentIndex).toBeUndefined();
    expect(files.size).toBe(1);
    expect(railPageOf(two)!.data).toBe(railPageOf(one)!.data);
    const read2 = (n: string) => railDataJson(files.get(`assets/navbar/${n}.js`)!);
    expect(region(expandRail(one, read2), "fa-nav-graphs")).toContain('href="#node-x"');
    // A headings index is the page's own, and stays in the page.
    const headed = injectRailOnce(page(`<h2 id="a">A</h2><h2 id="b">B</h2>`), emit)!;
    expect(railPageOf(headed)!.documentIndex).toBeDefined();
  });
});

describe("a declared avatar region crops the mark — `603s`", () => {
  const withRegion = (region?: { x: number; y: number; w: number; h: number }) =>
    navbarHtml({
      instance: "i",
      graphs: { label: "Graphs", items: [] },
      harnesses: {
        label: "Harnesses",
        items: [{ href: "/x", label: "X", avatar: { src: "/a.png", ...(region ? { region } : {}) } }],
      },
    });

  it("an avatar with NO region is the plain image it always was", () => {
    const h = withRegion();
    expect(h).toContain('<img src="/a.png"');
    expect(h).not.toContain("fa-nav-crop");
  });

  it("scales by 1/w and 1/h and offsets by -x and -y of the SCALED image", () => {
    // `603s`'s arithmetic. A half-width, half-height box at (0, 0.46) — the
    // measured `landing-card` crop — doubles the image and lifts it 92%.
    const h = withRegion({ x: 0, y: 0.46, w: 0.5, h: 0.5 });
    expect(h).toContain("width:200%");
    expect(h).toContain("height:200%");
    expect(h).toContain("left:0%");
    expect(h).toContain("top:-92%");
  });

  it("clips, and the frame is a positioning context", () => {
    const css = navbarCss();
    expect(css).toContain(".fa-nav-crop{position:relative;overflow:hidden");
    // Without these the `img` rule's fixed width and height fight the inline
    // percentages and the crop silently does nothing.
    expect(css).toContain(".fa-nav-crop img{position:absolute;width:auto;height:auto;max-width:none}");
  });

  it("the region is stated in PERCENTAGES, so it survives a mark resize", () => {
    const h = withRegion({ x: 0.25, y: 0.25, w: 0.25, h: 0.25 });
    expect(h).not.toContain("px;");
    expect(h).toContain("width:400%");
    expect(h).toContain("left:-100%");
  });
});

describe("a coverage path is a SOURCE file, not a URL — `publishedUrlOf`", () => {
  // Owner, 2026-09-22: *"fix the .md paths in the harness tabs too."*
  //
  // Swept with a HEAD request per link against a local build: 3 of 31 distinct
  // harness-tab links 404'd, all three `index.md`. The conversion had handled
  // `.html` and passed `.md` through untouched.

  it("an index leaf addresses as its directory — either extension", () => {
    expect(publishedUrlOf("processes/index.md")).toBe("/processes/");
    expect(publishedUrlOf("processes/index.html")).toBe("/processes/");
  });

  it("any OTHER page addresses as itself, with `.html`", () => {
    // This is the row that stops the obvious fix from being right. Stripping
    // `.md` would give `/tool-graph/`, which is a 404 — measured against the
    // built site, where `/tool-graph.html` is 200 and `/tool-graph/` is not.
    expect(publishedUrlOf("tool-graph.md")).toBe("/tool-graph.html");
    expect(publishedUrlOf("subgraph-viewers.md")).toBe("/subgraph-viewers.html");
  });

  it("a directory is already a URL and is left alone", () => {
    expect(publishedUrlOf("cat-harness/library/cat-harness/")).toBe("/cat-harness/library/cat-harness/");
  });

  it("does not mistake a mid-path `index` for the leaf", () => {
    // `.../index/skills/...` is a real shape here — the auto-docs tree — and a
    // rule anchored anywhere but the end would eat a directory called `index`.
    expect(publishedUrlOf("cat-harness/auto-docs/index/skills/")).toBe(
      "/cat-harness/auto-docs/index/skills/",
    );
  });

  it.skipIf(
    siteNotBuilt(
      "the harness data `docs:harness` writes at publish (gitignored)",
      join(HARNESS_ROOT, siteDirFor(HARNESS_ROOT), "_data", "harness.json"),
    ),
  )("no harness tab link ends in `.md`, over the REAL committed data", () => {
    // The regression guard, run over what actually ships rather than over a
    // fixture: a fixture would have passed throughout the defect.
    // Derived, never spelled out — `site-dir-single-answer` refuses a literal
    // site root anywhere in source, and it caught this file once already.
    const root = HARNESS_ROOT;
    const data = JSON.parse(
      readFileSync(join(root, siteDirFor(root), "_data", "harness.json"), "utf8"),
    ) as { harnesses: { name: string; visualisations?: { kind: string; path?: string }[] }[] };
    const offenders = data.harnesses.flatMap((h) =>
      (h.visualisations ?? [])
        .filter((v) => v.path?.endsWith(".md"))
        .map((v) => `${h.name}:${v.kind} -> ${v.path}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("the crop is ONE sum, and two renderers do it", () => {
  /**
   * `solveCrop` solves a declared `avatarRegion` for the Jekyll sidebar, where
   * the consumer is Liquid; `mark()` solves the same region inline for a
   * mounted page. The arithmetic is `603s`'s and it is written out twice,
   * which is the shape that let the navbar widths be stated twice with a test
   * per copy — both green, and disagreeing (`sjic`).
   *
   * Nothing here says the arithmetic is RIGHT; `schemas/avatar-region.test.ts`
   * owns the declaration and this file's other tests own the markup. What it
   * says is that the two surfaces cannot drift apart silently, which is the
   * failure neither of those would notice.
   */
  const regions = [
    // who-iris: the WHO emblem cut out of a 581x178 emblem-and-wordmark.
    { x: 0, y: 0, w: 0.3064, h: 1 },
    { x: 0, y: 0, w: 1, h: 1 },
    { x: 0.25, y: 0.46, w: 0.5, h: 0.5 },
    // A third that divides badly on purpose: 1/0.3 is not representable, and
    // agreement has to survive the rounding rather than dodge it.
    { x: 0.1, y: 0.1, w: 0.3, h: 0.3 },
  ];

  /** What the rail actually writes, read back off its own markup. */
  function railCrop(r: { x: number; y: number; w: number; h: number }) {
    const html = navbarHtml({
      instance: "x",
      root: { href: "./", label: "x", avatar: { src: "m.svg", region: r } },
      graphs: { label: "Graphs", items: [] },
      harnesses: { label: "Harnesses", items: [] },
    });
    const style = /style="(width:[^"]+)"/.exec(html)?.[1] ?? "";
    const num = (k: string) => Number(new RegExp(k + ":([-0-9.]+)%").exec(style)?.[1]);
    return { width: num("width"), height: num("height"), left: num("left"), top: num("top") };
  }

  it.each(regions.map((r) => [r] as const))("agrees on %p", (r) => {
    expect(railCrop(r)).toEqual(solveCrop(r));
  });

  it("the whole image is the identity crop, not a no-op that skips the branch", () => {
    // A renderer that treated w=h=1 as "no crop" would agree with the other by
    // accident on every other case and diverge on this one.
    expect(solveCrop({ x: 0, y: 0, w: 1, h: 1 })).toEqual({
      width: 100,
      height: 100,
      left: 0,
      top: 0,
    });
  });
});

/**
 * `sjic`'s last box — ONE renderer for a Jekyll page and a mounted page, with
 * the difference DECLARED rather than branched on.
 *
 * Three differences are declared, and each has a test here that fails if the
 * declaration stops being honoured. What is NOT tested is the absence of a
 * fourth: that is what `navbarHtml` delegating to `navbarRegionsHtml` is for,
 * since there is then no second copy of the region order to disagree.
 */
describe("the two surfaces differ by DECLARATION, not by branch", () => {
  it("the wrapper is the only thing `navbarHtml` adds", () => {
    // If this ever stops holding, the two surfaces have grown a second
    // difference that nothing declares — which is the defect `sjic` is about.
    expect(navbarHtml(model)).toBe(
      `<nav class="fa-nav" aria-label="folio-assistant">${navbarRegionsHtml(model)}</nav>`,
    );
  });

  it("a mounted page's markup is UNCHANGED by the extension", () => {
    // The 46 generated viewer pages and every mount are gated on their own
    // bytes. A model that declares none of the new fields must render exactly
    // what it rendered before, or this is a rewrite wearing a refactor's name.
    const html = navbarHtml(model);
    expect(html).toContain('<input type="checkbox" class="fa-nav-open" id="fa-nav-open">');
    expect(html).toContain('<div class="fa-nav-graphs">');
    expect(html).not.toContain("fa-nav-row");
    expect(html).not.toContain("relative_url");
  });

  describe("hrefs — resolved, or wrapped in Jekyll's filter", () => {
    it("`liquid` wraps every href and every avatar src", () => {
      // Both, and the `src` is the one that was missed before: `68au` is every
      // graph tile in the navbar 404ing because an href was composed without
      // the baseurl, and an avatar is composed the same way.
      const m: NavbarModel = {
        instance: "who-iris",
        hrefs: "liquid",
        graphs: {
          label: "Graphs",
          items: [{ href: "/library/", label: "Library", avatar: { src: "/assets/a.png" } }],
        },
      };
      const html = navbarRegionsHtml(m);
      expect(html).toContain(`href="{{ '/library/' | relative_url }}"`);
      expect(html).toContain(`src="{{ '/assets/a.png' | relative_url }}"`);
    });

    it("a row with no destination gains no filter", () => {
      // A dead row has no href to wrap. Emitting `relative_url` around nothing
      // would render a link to the site root, which is `pb04` exactly: a dead
      // link invites a click and then reads as a broken site.
      const m: NavbarModel = {
        instance: "who-iris",
        hrefs: "liquid",
        graphs: { label: "Graphs", items: [{ label: "qa", note: "no viewer yet" }] },
      };
      const html = navbarRegionsHtml(m);
      expect(html).toContain("fa-nav-dead");
      expect(html).not.toContain("relative_url");
    });

    it("resolved is the default, so no caller has to say so", () => {
      const m: NavbarModel = {
        instance: "who-iris",
        graphs: { label: "Graphs", items: [{ href: "../library/", label: "Library" }] },
      };
      expect(navbarRegionsHtml(m)).toContain('href="../library/"');
    });
  });

  describe("the middle region is ABSENT when another navigation owns it", () => {
    it("no `graphs` renders no graphs region — not an empty one", () => {
      // The Jekyll theme renders its own `<nav id="site-nav">` page tree in
      // this slot. An empty disclosure there would be a second, emptier answer
      // to the same question.
      const m: NavbarModel = { instance: "folio-assistant", harnesses: { label: "Harnesses", items: [{ label: "x" }] } };
      const html = navbarRegionsHtml(m);
      expect(html).not.toContain("fa-nav-graphs");
      expect(html).toContain("fa-nav-bottom");
    });
  });

  describe("the open control is rendered once per PAGE, not once per copy", () => {
    it("`labels` renders the labels and not the input", () => {
      // just-the-docs includes its footer extension point twice per page by
      // design. With the input in both, `id="fa-nav-open"` appeared twice on
      // 429 of 1,283 built pages (`uknu`).
      const m: NavbarModel = { instance: "folio-assistant", openControl: "labels" };
      const html = navbarRegionsHtml(m);
      expect(html).not.toContain('type="checkbox"');
      // The labels still point at the input the FIRST copy rendered, which is
      // the whole mechanism: one control, operated from both copies.
      expect(html).toContain('for="fa-nav-open"');
      expect(html).toContain("fa-nav-head");
    });

    it("`input` is the default, so an injected rail needs no declaration", () => {
      const m: NavbarModel = { instance: "who-iris" };
      expect(navbarRegionsHtml(m)).toContain('<input type="checkbox"');
    });
  });
});

/**
 * The rows the Jekyll sidebar has rendered since `603s` and this rail never
 * has. Until now they were the largest difference between the two surfaces —
 * `sjic`: *"two implementations of one navbar, disagreeing about whether a
 * reader can reach a graph."*
 */
describe("a harness row carries its own graphs and its own control", () => {
  const harness: NavbarModel = {
    instance: "folio-assistant",
    harnesses: {
      label: "Harnesses",
      collapsible: true,
      items: [
        {
          href: "/who-iris/",
          label: "who-iris",
          action: {
            data: "data-fa-harness-config",
            value: "who-iris",
            label: "Configuration of who-iris",
            glyph: "⚙︎",
          },
          children: [
            { href: "/who-iris/library/", label: "library" },
            { label: "qa", note: "declared, no viewer" },
          ],
        },
      ],
    },
  };

  it("the children are reachable, and the dead one still says why", () => {
    const html = navbarRegionsHtml(harness);
    expect(html).toContain('href="/who-iris/library/"');
    expect(html).toContain("declared, no viewer");
  });

  it("the control is a SIBLING of the link, never inside it", () => {
    // A control nested in a link is two targets a keyboard cannot tell apart.
    // Asserted on the markup rather than trusted to review, because the nested
    // form also renders and looks identical.
    const html = navbarRegionsHtml(harness);
    const a = html.indexOf('<a href="/who-iris/"');
    const close = html.indexOf("</a>", a);
    const button = html.indexOf("<button", a);
    expect(button).toBeGreaterThan(close);
  });

  it("a row with neither gains no wrapper", () => {
    // The wrapper exists for the row+control line. Emitting it unconditionally
    // would change the markup of every existing rail for no reason.
    const plain: NavbarModel = {
      instance: "who-iris",
      graphs: { label: "Graphs", items: [{ href: "../x/", label: "x" }] },
    };
    expect(navbarRegionsHtml(plain)).not.toContain("fa-nav-row");
  });
});

describe("adjacent graph rows cannot be confused (bean yag0)", () => {
  // The owner clicked who-iris's `docs` row meaning `library` on 2026-09-23:
  // adjacent rows, each a one-letter initial beside a bare kind word, and at
  // rest the strip shows only the marks. `catalogue` and `code` shared `C`.
  const rows = declaredGraphs("who-iris", new Map([["docs", "../docs/who-iris/"], ["library", "../cat-harness/library/who-iris/"]]));

  it("every row has a mark no other row has", () => {
    const marks = rows.map((r) => r.glyphPath ?? r.icon);
    expect(marks.every((m) => m !== undefined)).toBe(true);
    expect(new Set(marks).size).toBe(rows.length);
  });
});

describe("the rail's Graphs group starts closed (#2150)", () => {
  // Owner, 2026-10-05: "also have the "Graphs" section start closed on LHS navbar".
  const graphsSummary = /<details class="fa-nav-group"( open)?><summary><span class="fa-nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M3 6\.5h6\.5l2 2H21V19H3z"/;

  it("is folded on arrival on a page with no section of its own", () => {
    const html = navbarRegionsHtml(railModel({ instance: "x", toRoot: "..", links: [{ href: "../a/", label: "a" }] }));
    expect(graphsSummary.exec(html)?.[1]).toBeUndefined();
    expect(graphsSummary.test(html)).toBe(true);
  });

  it("opens when one of its rows is the page being read", () => {
    const html = navbarRegionsHtml(
      railModel({ instance: "x", toRoot: "..", links: [{ href: "../a/", label: "a" }, { label: "b", current: true }] }),
    );
    expect(graphsSummary.exec(html)?.[1]).toBe(" open");
  });

  it("stays folded beside the page's own section, which is the one open group", () => {
    const html = navbarRegionsHtml(
      railModel({
        instance: "x",
        toRoot: "..",
        links: [{ label: "b", current: true }],
        documentIndex: { label: "Contents", items: [{ href: "#a", label: "A" }], collapsible: true, open: true },
      }),
    );
    expect(graphsSummary.exec(html)?.[1]).toBeUndefined();
  });
});

describe("a harness row is not a graph-typology row, whatever its mark (#2151)", () => {
  // Owner, 2026-10-05: "alignment of harnesses is off". `fa-nav-kind` (the
  // strip-column indent) was inferred from "has an SVG glyph"; #2122 gave
  // harnesses glyph marks, and smart-trust / SMART Base took the kind indent.
  //
  // Rows built from `graphTypologyRowDecor` itself, the one function that sets
  // `NavItem.kind`, so this holds in a standalone cat-harness layer. That the
  // rows `declaredGraphs` builds for a REAL layer carry it is asserted in
  // `cat-harness-tools/scripts/tests/ui/navbar-kind-rows.test.ts`, because it
  // reads who-iris's declaration, which only the monorepo has.
  const kinds = ["docs", "library", "skills"].map((k) => ({ href: `../${k}/`, label: k, ...graphTypologyRowDecor(k, "x") }));

  it("graphTypologyRowDecor DECLARES the row a kind, whatever mark it draws", () => {
    expect(kinds.every((r) => r.kind === true)).toBe(true);
  });

  it("a glyph-marked harness row gets no kind class, and nor does an avatar one", () => {
    const html = navbarRegionsHtml(
      railModel({
        instance: "cat-harness",
        toRoot: "..",
        links: kinds,
        harnesses: [
          { href: "../smart-trust/", label: "smart-trust", glyphPath: "M12 3l7 3v6", tone: 199 },
          { href: "../", label: "C@T Harness", avatar: { src: "../a.webp" }, tone: 268 },
        ],
      }),
    );
    const at = html.indexOf('<div class="fa-nav-bottom">');
    expect(html.slice(at)).toContain('<a href="../smart-trust/" title="smart-trust"><span class="fa-nav-glyph');
    expect(html.slice(at)).not.toContain("fa-nav-kind");
    // ...while the kind rows above keep it.
    expect(html.slice(0, at)).toContain('class="fa-nav-kind"');
  });
});

describe("the harness row's data reaches a railed page (bean wckf, #2147)", () => {
  // `injectRail` writes the same `#fa-navbar-row` block `head_custom.html`
  // writes for the theme, so `docs-ui.js`'s ONE `mountNavIconRow` draws the
  // same row on both surfaces. The browser half is `rail-icon-row.e2e.ts`.
  const SHELL = "<!doctype html><html><head></head><body><h1>x</h1></body></html>";
  const opts = { instance: "WHO IRIS", toRoot: "..", links: [] };

  it("an object row is written once, right after <body>, and parses back to itself", () => {
    const row = { icons: ["todos", "beans"], hrefs: { todos: "/todos/" } };
    const out = injectRail(SHELL, { ...opts, navbarRow: row })!;
    const m = /<body><script type="application\/json" id="fa-navbar-row" data-fa-root="\.\.">([^<]*)<\/script>/.exec(out);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1]!)).toEqual(row);
    expect(withNavbarRow(out, row)).toBe(out); // never twice
  });

  it("a value cannot close the script element early", () => {
    const out = injectRail(SHELL, { ...opts, navbarRow: { notes: { kg: "</script><img src=x onerror=alert(1)>" } } })!;
    expect(out).not.toContain("</script><img");
    expect(out).toContain("\\u003c/script>");
  });

  it("declared none is written as null; could-not-tell writes nothing", () => {
    expect(injectRail(SHELL, { ...opts, navbarRow: null })).toContain('id="fa-navbar-row" data-fa-root="..">null</script>');
    expect(injectRail(SHELL, { ...opts })).not.toContain("fa-navbar-row");
  });

  // WHAT DRAWS IT — bean `lhvt`. #2149 wrote the data and nothing else, and on
  // the 2,709 railed pages without `docs-ui.js` nothing drew it.
  it("links the row's script and stylesheet, once, in <head>, at the page's own depth", () => {
    const out = injectRail(SHELL, { ...opts, navbarRow: { icons: ["todos"] } })!;
    const head = out.slice(0, out.indexOf("</head>"));
    expect(head).toContain(`<script src="../${NAVBAR_ROW_JS}" defer></script>`);
    expect(head).toContain(`<link rel="stylesheet" href="../${NAVBAR_ROW_CSS}">`);
    expect(withNavbarRow(out, { icons: ["todos"] }, { root: ".." })).toBe(out);
    expect(out.split(NAVBAR_ROW_JS).length - 1).toBe(1);
  });

  it("a folio's site links the PLATFORM's row files and composes the row's hrefs there", () => {
    const BASE = "https://litlfred.github.io/folio-assistant";
    const out = injectRail(SHELL, { ...opts, assetRoot: BASE, navbarRow: { icons: ["todos"] } })!;
    expect(out).toContain(`<script src="${BASE}/${NAVBAR_ROW_JS}" defer></script>`);
    expect(out).toContain(`data-fa-root="${BASE}"`);
  });

  it("a folio's own row paths and counts resolve on ITS site, while its files stay the platform's (issue #46, gap 2)", () => {
    const BASE = "https://litlfred.github.io/folio-assistant";
    const out = injectRail(SHELL, { ...opts, assetRoot: BASE, rowRoot: "..", navbarRow: { icons: ["beans"], hrefs: { beans: "/beans/" } } })!;
    expect(out).toContain(`<script src="${BASE}/${NAVBAR_ROW_JS}" defer></script>`);
    expect(out).toContain('id="fa-navbar-row" data-fa-root=".."');
    expect(out).not.toContain(`data-fa-root="${BASE}"`);
  });

  it("a page that fetches nothing gets the row INLINED, not linked", () => {
    const out = injectRail(SHELL, { ...opts, navbarRow: { icons: ["todos"] }, inlineRowAssets: { js: "/*JS*/", css: "/*CSS*/" } })!;
    expect(out).not.toContain("<script src=");
    expect(out).not.toContain('rel="stylesheet"');
    expect(out).toContain(">/*JS*/</script>");
    expect(out).toContain(">/*CSS*/</style>");
    expect(out.split("/*JS*/").length - 1).toBe(1);
  });

  it("no row data, no row script — and a declined row still gets one, to say so", () => {
    expect(injectRail(SHELL, { ...opts })).not.toContain(NAVBAR_ROW_JS);
    expect(injectRail(SHELL, { ...opts, navbarRow: null })).toContain(NAVBAR_ROW_JS);
  });
});

describe("a thin page asks for the rail with its style LINKED (bean lnoy)", () => {
  // Owner, 2026-10-05: "1. Shared rail style first". Inlined, the rail was
  // 7.9 KB (4.3 KB of CSS) on pages of 1.4-3 KB, which is why they declined it.
  const opts = { instance: "C@T Harness", toRoot: "../..", links: [{ label: "Library", href: "../../library/" }], navbarRow: { icons: ["todos"] } };
  const thin = `<!doctype html><html><head>${NAVBAR_LINKED}<title>x</title></head><body><main>x</main></body></html>`;

  it("links navbar.css and the row's files, and inlines neither", () => {
    const out = injectRail(thin, { ...opts, inlineRowAssets: { js: "/*JS*/", css: "/*CSS*/" } })!;
    expect(out).toContain(`<link rel="stylesheet" href="../../${NAVBAR_CSS}">`);
    expect(out).toContain(`<script src="../../${NAVBAR_ROW_JS}" defer></script>`);
    expect(out).not.toContain("<style>");
    expect(out).not.toContain("/*JS*/");
    expect(out).toContain('<nav class="fa-nav"');
  });

  it("is a fraction of the inlined rail's weight", () => {
    const plain = thin.replace(NAVBAR_LINKED, "");
    const inlined = injectRail(plain, opts)!.length - plain.length;
    const linked = injectRail(thin, opts)!.length - thin.length;
    expect(linked).toBeLessThan(inlined / 2);
  });

  it("the meta is read in either attribute order, and `none` is still `none`", () => {
    expect(wantsLinkedRail('<meta content="linked" name="folio-navbar">')).toBe(true);
    expect(wantsLinkedRail('<meta name="folio-navbar" content="none">')).toBe(false);
  });

  it("thinPageHtml names its own address as canonical: `./` by default, the file when given", () => {
    const base = { title: "x", configId: "x-config", config: {}, body: "<main></main>", script: "x.js", jsonld: "x.jsonld" };
    expect(thinPageHtml(base)).toContain('<link rel="canonical" href="./">');
    const file = thinPageHtml({ ...base, canonical: "StructureDefinition-a.html" });
    expect(file).toContain('<link rel="canonical" href="StructureDefinition-a.html">');
    expect(file).not.toContain('href="./"');
  });

  it("thinPageHtml writes `linked`, not `none`", () => {
    const html = thinPageHtml({ title: "x", configId: "x-config", config: {}, body: "<main></main>", script: "x.js", jsonld: "x.jsonld" });
    expect(wantsLinkedRail(html)).toBe(true);
    expect(declinesNavbar(html)).toBe(false);
  });
});

describe("the row's glyphs are docs-ui.js's glyphs (bean lhvt)", () => {
  // `navbar-row.js` carries copies of the six drawings; `docs-ui.js` still
  // draws them on its tiles. Evaluated, not grepped: the constants are string
  // concatenations, so the comparison is of the SVG each produces.
  // Both live in the harness's site CHROME, `site-chrome/` (its own subgraph
  // since cat-harness 19e5d6ba), not in `docs/`.
  const js = join(HARNESS_ROOT, "site-chrome", "assets", "js");
  const glyphs = (file: string): Record<string, string> => {
    const src = readFileSync(join(js, file), "utf-8");
    const out: Record<string, string> = {};
    for (const name of ["STICKY_GLYPH", "BEANS_GLYPH", "PROCESS_GLYPH", "NET_GLYPH", "TILES_GLYPH", "FISH_GLYPH", "QR_GLYPH"]) {
      const m = new RegExp(`var ${name} =([\\s\\S]*?);\\n`).exec(src);
      if (!m) throw new Error(`${file}: ${name} not found`);
      const expr = m[1]!.replace(/^\s*\/\/.*$/gm, "");
      // input-site: inert #042100c0 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
      out[name] = new Function(`return (${expr});`)() as string;
    }
    return out;
  };

  it("all seven are identical in both files", () => {
    const row = glyphs("navbar-row.js");
    const ui = glyphs("docs-ui.js");
    expect(Object.keys(row).length).toBe(7);
    expect(row).toEqual(ui);
  });
});

describe("every committed railed page carries the harness row's data (bean wckf, #2147)", () => {
  // THE GATE. A page with the rail and no `#fa-navbar-row` shows the harness's
  // navbar without the harness's row — the defect the owner reported on
  // who-iris. It reached 92 committed pages across nine generators before this
  // existed, because each generator had to be regenerated to pick the block up
  // and CI named them one at a time. Reads only `cat-harness/docs`, so it holds
  // standing alone too.
  const docs = join(HARNESS_ROOT, "docs");
  const pages = [...new Bun.Glob("**/*.html").scanSync({ cwd: docs })];
  const railed: string[] = [];
  const missing: string[] = [];
  const undrawn: string[] = [];
  for (const rel of pages) {
    const html = readFileSync(join(docs, rel), "utf-8");
    if (!html.includes('<nav class="fa-nav"')) continue;
    railed.push(rel);
    if (!html.includes('id="fa-navbar-row"')) missing.push(rel);
    // The data alone drew nothing on 2,709 published pages (bean `lhvt`): a
    // railed page must also load what draws it, itself or through docs-ui.js.
    if (!html.includes(NAVBAR_ROW_JS) && !html.includes(NAVBAR_ROW_INLINE)) undrawn.push(rel);
  }

  // Since 2026-10-07 every committed generated page is on the theme's layout,
  // and the theme's sidebar is its navigation, so the committed tree carries
  // NO railed page: the rail is injected at build (`folio-navbar: linked`) or
  // into a folio's built `_site`. Zero railed pages is therefore the expected
  // reading, and the guard against an empty scan is on the pages READ instead.
  it("the scan read the committed docs tree — an empty scan is not a clean one", () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it("none of them is missing the row's data", () => {
    expect(missing).toEqual([]);
  });

  it("every one of them loads navbar-row.js, which draws it (bean lhvt)", () => {
    expect(undrawn).toEqual([]);
  });
});

// Bean `mftp`: a page may NAME its own section (an IG site names it after the IG).
describe("a page's declared section label", () => {
  const page = (head: string) => `<html><head>${head}</head><body><script type="application/json" data-fa-visualiser-nav>[{"label":"Home","href":"/x/"}]</script><p>hi</p></body></html>`;
  it("is read off the page and names the section", () => {
    expect(visualiserLabelOf(page('<meta name="fa-visualiser-label" content="WHO SMART Trust">'))).toBe("WHO SMART Trust");
    const railed = injectRail(page('<meta name="fa-visualiser-label" content="WHO SMART Trust">'), { instance: "x", toRoot: "..", links: [] })!;
    expect(railed).toContain("WHO SMART Trust");
  });
  it("is absent when undeclared, and the section is \"On this page\" (the theme sidebar's name, 2026-10-15)", () => {
    expect(visualiserLabelOf(page(""))).toBeUndefined();
    expect(injectRail(page(""), { instance: "x", toRoot: "..", links: [] })!).toContain("On this page");
  });
});

describe("a fold opens from its parent's row — owner, 2026-10-15: \"what is 26? why unlabeled?\"", () => {
  const items = [
    { href: "/s/", label: "Skill schema reference", children: [{ href: "/s/a", label: "A" }, { href: "/s/b", label: "B" }], fold: "2 pages" },
    { href: "/g/", label: "Guides", children: [{ label: "Here", current: true }], fold: "1 page" },
  ];
  const html = navbarHtml({ instance: "x", pages: { label: "Pages", items, collapsible: true } });
  it("every fold is a button on the parent's row with a name that says whose and how many", () => {
    const buttons = [...html.matchAll(/<button type="button" class="fa-nav-twisty"[^>]*>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain(`aria-label="Show Skill schema reference's 2 pages"`);
    expect(buttons[0]).toContain(`aria-expanded="false"`);
    expect(buttons[0]).toContain("data-fa-tip=");
  });
  it("ids are unique and each toggle controls its own list", () => {
    const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]!);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(html).toContain(`<div class="fa-nav-kids" id="${id}"`);
  });
  it("a fold holding the reader's page arrives OPEN, named 'Hide'", () => {
    expect(html).toContain(`aria-expanded="true" aria-controls="fa-nav-fold-2" aria-label="Hide Guides's 1 page"`);
    expect(html).toMatch(/<div class="fa-nav-kids" id="fa-nav-fold-2">/);
  });
  it("no row in any rail is a bare count", () => {
    expect(html).not.toMatch(/<span class="fa-nav-label">\d+ (?:pages?|sub-sections?)<\/span>/);
  });
  it("a rail rendered INTO a page carries its script: the fold toggles, the drag edge and the reader's anchor", () => {
    const page = "<!doctype html><html><head></head><body><p>x</p></body></html>";
    expect(injectNavbar(page, { instance: "x", pages: { label: "Pages", items, collapsible: true } })!).toContain("<script data-fa-nav-folds>");
    // With no fold the drag edge still needs it (owner, 2026-11-10, option D).
    expect(injectNavbar(page, { instance: "x" })!).toContain("wireNavResize");
    // And the reader keeps their place when it opens, closes or is dragged
    // (owner, 2026-11-16; driven in Chromium by rail-keeps-place.e2e.ts).
    expect(injectNavbar(page, { instance: "x" })!).toContain("wireNavAnchor");
    // ...but not on a thin page, whose style is linked (bean lnoy): a few KB
    // of content has no place to lose, and the weight is the point there.
    expect(injectNavbar(page, { instance: "x" }, { cssHref: "../../assets/css/navbar.css" })!).not.toContain("wireNavAnchor");
  });
});

describe("a toned mark's ground follows the scheme", () => {
  it("light mode gives the mark a pale ground and its own deep ink", () => {
    const css = navbarCss();
    expect(css).toContain('.fa-nav-tone[style*="--fa-nav-hue"]{background:hsl(var(--fa-nav-hue) 45% 28%);color:#f6f8fa}');
    expect(css).toContain(':root[data-fa-scheme="light"] .fa-nav-tone[style*="--fa-nav-hue"]{background:hsl(var(--fa-nav-hue) 50% 90%)');
  });
});
