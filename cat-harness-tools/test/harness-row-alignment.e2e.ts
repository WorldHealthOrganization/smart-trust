import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { railedViewer } from "./railed-fixture.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";
import { COPY_ID_SUFFIX } from "../scripts/gen-navbar-include.ts";

/**
 * Every harness row in "▦ Harnesses" sits at ONE indent, whatever its mark is
 * drawn with. Issue #2151, owner 2026-10-05: *"alignment of harnesses is off"*.
 *
 * Measured before the fix on the committed `beans/index.html`: the
 * avatar-marked rows (Folio Assistant, WHO IRIS, C@T Harness, Bootstrap) had
 * their mark at one x and the glyph-marked rows (smart-trust, SMART Base,
 * given glyphs by #2122) sat flush left at another. `itemHtml` used to infer
 * `fa-nav-kind`, the graph-typology row class that `navbarCss()` pulls back into
 * the strip column, from "has an SVG glyph". Since #2122 a harness can have
 * one too. The class is now declared (`NavItem.kind`), set only by
 * `graphTypologyRowDecor`.
 *
 * WHAT IS SERVED, not a restatement: a standalone viewer page railed by the
 * generators' own `withViewerNav` (`railed-fixture.ts`, with its inline
 * `navbarCss()`), and the Jekyll sidebar built the
 * way `rail-tips.e2e.ts` builds it from the generated footer include.
 *
 * NO BACKTICKS INSIDE THE PAGE TEMPLATE LITERAL (`bmr0`).
 */

const ROOT = join(HARNESS_ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const QR = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");
const BASEURL = "/folio-assistant";
const DATA = JSON.parse(readFileSync(overlayPath(join(SITE, "_data/harness.json")), "utf8")) as {
  navbar: unknown;
  harnesses: { name: string; instantiated?: boolean; mark?: { src?: string; glyph?: string } | null }[];
};
// BUILT, not read (2026-10-07): see `railed-fixture.ts` — every committed
// standalone viewer this read has since moved onto the theme's layout.
const VIEWER = railedViewer();
const FOOTER = (() => {
  const src = readFileSync(overlayPath(join(SITE, "_includes/generated/navbar-footer.html")), "utf8");
  const line = src.split("\n").find((l) => l.startsWith('<div class="fa-nav-in">'));
  if (!line) throw new Error("navbar-footer.html carries no regions line — run `bun run cat navbar:include`.");
  // The FIRST copy of the include, as the theme renders it: its ids carry no
  // per-copy suffix (gen-navbar-include COPY_ID_SUFFIX).
  return line.split(COPY_ID_SUFFIX).join("").replace(/\{\{\s*'([^']*)'\s*\|\s*relative_url\s*\}\}/g, (_m, p: string) => BASEURL + p);
})();

function landing(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="fa-baseurl" content="${BASEURL}">
  <style>
  body { margin: 0; font-family: sans-serif; }
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; align-items: flex-end;
              background: #f5f6fa; color: #27262b; }
  .site-header { width: 100%; max-height: 3.75rem; overflow: hidden; display: flex; align-items: center; }
  .site-title { flex: 1; }
  .site-nav { width: 100%; overflow-y: auto; }
  ${CSS}
</style></head><body>
  <script type="application/json" id="fa-navbar-row">${JSON.stringify(DATA.navbar)}<\/script>
  <div class="side-bar">
    <div class="site-header"><a class="site-title" href="#"><span class="fa-site-mark"></span><span class="fa-site-title">C@T Harness</span></a></div>
    <nav class="site-nav"><a href="#">Navigation link</a></nav>
    <footer class="site-footer"><input type="checkbox" class="fa-nav-open" id="fa-nav-open">${FOOTER}</footer>
  </div>
  <div class="main"><div class="main-content"><h1 id="t">Landing</h1></div></div>
  <script>window.jtd = { theme: "light",
    getTheme: function () { return this.theme; },
    setTheme: function (t) { this.theme = t; } };<\/script>
  <script>${QR}<\/script>
  <script>${JS}<\/script>
</body></html>`;
}

/** The instantiated harnesses, and which of them are drawn with a glyph rather than an image. */
const SHOWN = DATA.harnesses.filter((h) => h.instantiated === true);
const GLYPHED = SHOWN.filter((h) => h.mark?.glyph && !h.mark?.src);

async function open(p: Page, which: "landing" | "viewer"): Promise<string[]> {
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.route("http://align.fixture/**", (r) =>
    r.fulfill({ contentType: "text/html", body: which === "landing" ? landing() : VIEWER }),
  );
  await p.goto("http://align.fixture/" + which + "/", { waitUntil: "load" });
  // Pinned open, with ▦ unfolded: the state the owner's screenshot shows.
  await p.evaluate(() => {
    const box = document.getElementById("fa-nav-open") as HTMLInputElement | null;
    if (box) box.checked = true;
  });
  // The harness list is the panel the Harnesses icon opens (owner, 2026-11-13).
  await p.locator("button.fa-nav-harnesses").first().click();
  await p.mouse.move(1200, 700);
  await p.waitForTimeout(300);
  return errors;
}

/** Each harness row's mark: its row's label, its left edge, and whether it is an image or a drawn glyph. */
async function harnessMarks(p: Page) {
  return p.evaluate(() => {
    const sub = document.getElementById("fa-nav-harnesses");
    if (!sub) return [];
    // A harness row is a direct link of the group, or the link of a
    // `.fa-nav-row` (a row with a ⚙ or children). Never a nested graph row.
    const rows = [...sub.querySelectorAll(":scope > a, :scope > .fa-nav-row > a")];
    return rows.map((a) => {
      const g = a.querySelector(":scope > .fa-nav-glyph")!;
      return {
        label: a.querySelector(".fa-nav-label")?.textContent?.trim() ?? "",
        x: Math.round(g.getBoundingClientRect().left),
        drawn: g.querySelector("svg") !== null ? "glyph" : g.querySelector("img") !== null ? "image" : "letter",
        kindClass: a.classList.contains("fa-nav-kind"),
      };
    });
  });
}

for (const which of ["viewer", "landing"] as const) {
  test(`${which}: every harness row's mark has the same left edge, glyph or image (#2151)`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await open(page, which)).toEqual([]);
    const marks = await harnessMarks(page);
    expect(marks.length).toBe(SHOWN.length);
    // Not vacuous: the case the bug needs, both kinds of mark, is present.
    expect(GLYPHED.length).toBeGreaterThan(0);
    expect(marks.some((m) => m.drawn === "glyph")).toBe(true);
    expect(marks.some((m) => m.drawn === "image")).toBe(true);
    // A harness row is not a graph-typology row, whatever its mark is drawn with.
    expect(marks.filter((m) => m.kindClass).map((m) => m.label)).toEqual([]);
    const xs = new Set(marks.map((m) => m.x));
    expect([...xs], JSON.stringify(marks)).toHaveLength(1);
  });
}
