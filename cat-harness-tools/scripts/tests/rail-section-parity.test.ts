import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { injectRail, railModel } from "../lib/harness-rail.ts";
import { RAIL_SECTION_LABELS, navbarRegionsHtml } from "../lib/navbar.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { harnessesControl } from "../check-viewer-nav.ts";

/**
 * ONE VOCABULARY FOR THE RAIL'S SECTIONS, on both paths that draw one —
 * owner, 2026-10-15, "folio rail everywhere" (bean `9rq1`: a capability that
 * exists on one layout and not another is a defect, not a design).
 *
 * - Path A, the just-the-docs sidebar: `docs-ui.js` builds "On this page",
 *   "Pages" and "Folders" in the browser; `gen-navbar-include.ts` writes
 *   "Harnesses" through `navbarRegionsHtml`.
 * - Path B, the `nav.fa-nav` rail: `railModel` → `navbarRegionsHtml`, on the
 *   server and (bundled as `navbar.js`) in the browser.
 *
 * Until 2026-10-15 Path B said "Graphs" and "Contents" for the sections Path A
 * called "Folders" and "On this page". Then the owner chose ONE rail on every
 * page (option A): the theme sidebar is replaced after Jekyll and Path A's
 * browser-built sections are retired. So this holds two things: the rail
 * draws the whole vocabulary, read off its rendered `<summary>` labels, and
 * `docs-ui.js` draws none of it a second time.
 */

const DOCS_UI = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/docs-ui.js")), "utf-8");

/** The group labels a rendered `fa-nav` shows, in order. */
function summaries(html: string): string[] {
  return [...html.matchAll(/<details class="fa-nav-group"[^>]*><summary>[\s\S]*?<span class="fa-nav-label">([^<]*)</g)].map((m) => m[1]!);
}

const PAGE = `<!doctype html><html><head><title>t</title></head><body><main>
<h1>T</h1><h2 id="a">A</h2><p>x</p><h2 id="b">B</h2><p>y</p></main></body></html>`;

const OPTS = {
  instance: "x",
  toRoot: "..",
  links: [{ href: "../library/", label: "Library" }],
  harnesses: [{ href: "../cat-harness/", label: "C@T Harness" }],
};

describe("the rail's sections are named alike on both paths (bean 9rq1)", () => {
  test("Path A is retired: docs-ui.js builds none of the sections in the browser any more (2026-10-15)", () => {
    // One rail on every page: the theme sidebar's sections were drawn here
    // (`mountDocumentIndex`, `mountNavPagesHeading`, `mountInstanceGraphs`,
    // `mountSidebarRail`). A second drawing is how the two came apart.
    for (const gone of ["function mountDocumentIndex", "function mountNavPagesHeading", "function mountInstanceGraphs", "function mountSidebarRail"]) {
      expect(DOCS_UI).not.toContain(gone);
    }
  });

  test("Path B — the fa-nav rail — draws On this page and Folders, in that order, and Harnesses as an icon's panel", () => {
    // Harnesses is no longer a disclosure (owner, 2026-11-13: "remove the
    // harnesses navbar, instead add an icon to the controls to show the
    // harnesses"): it is the panel the Harnesses icon opens, under the same name.
    const html = injectRail(PAGE, OPTS)!;
    expect(summaries(html)).toEqual([RAIL_SECTION_LABELS.onThisPage, RAIL_SECTION_LABELS.folders]);
    expect(harnessesControl(html)).toBe(true);
    expect(html).toContain(`<div class="fa-nav-pop-title"><span class="fa-nav-label">${RAIL_SECTION_LABELS.harnesses}</span></div>`);
  });

  test("Path B from shared data (navbar.js's code) draws the same names as the server", () => {
    const m = railModel({ ...OPTS, documentIndex: { label: RAIL_SECTION_LABELS.onThisPage, items: [{ href: "#a", label: "A" }, { href: "#b", label: "B" }], collapsible: true } });
    expect(summaries(navbarRegionsHtml(m))).toEqual([RAIL_SECTION_LABELS.onThisPage, RAIL_SECTION_LABELS.folders]);
    expect(harnessesControl(navbarRegionsHtml(m))).toBe(true);
  });

  test("no section on either path keeps a retired name", () => {
    const retired = ["Graphs", "Contents"];
    const b = summaries(injectRail(PAGE, OPTS)!);
    for (const r of retired) expect(b).not.toContain(r);
  });

  test("a page that names its own section keeps that name (an IG, a visualiser)", () => {
    const own = PAGE.replace("</head>", '<meta name="fa-visualiser-label" content="WHO SMART Trust"></head>');
    expect(summaries(injectRail(own, OPTS)!)[0]).toBe("WHO SMART Trust");
  });

  /**
   * "Pages" on Path B: the server-built page tree (`lib/jekyll-pages-nav.ts`),
   * given when the site has one. Drawn between the page's own section and
   * Folders — the order the theme sidebar uses.
   */
  test("Pages: Path B draws it when the site has a page tree, in Path A's order", () => {
    const html = injectRail(PAGE, { ...OPTS, pages: [{ href: "../guide/", label: "Guide" }] })!;
    expect(summaries(html)).toEqual([RAIL_SECTION_LABELS.onThisPage, RAIL_SECTION_LABELS.pages, RAIL_SECTION_LABELS.folders]);
  });
});
