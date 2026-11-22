/**
 * A GLASS PANEL OPENS IN VIEW, CLEAR OF THE TILE DOCK.
 *
 * The defect (wireframe `navbar` Findings, "Seen on the build", re-drawn in
 * #2295; first noted in #1810 as "found, not fixed"): at 1280×800, opening
 * Glass settings put the panel at y = 591. The panel sat in the glass's flow
 * BELOW the shelf (`min-height: 50vh`), so its body was under the fixed tile
 * dock, and the reader had to scroll the glass to reach the controls the tile
 * had just opened.
 *
 * Every assertion is on the rendered page: the panel's box against the dock's
 * VISIBLE top (the dock is fixed and overlays the glass, so "under the dock"
 * is a geometry fact, not a style one), and a hit test on each control, so a
 * control that is inside the box but painted over still fails. The glass's
 * own scroll positions are checked too: a panel that is in view only because
 * something scrolled the glass to it is the defect.
 *
 * Both dock states, because the dock's visible height differs (the hidden dock
 * still shows its header row with the Show/Hide tab), and both viewports,
 * because below 37.5rem the glass is laid out as one scrolling column.
 *
 * A phone has less room than Glass settings has content (about 940 px against
 * about 650 px with the dock shown), so there the panel's BODY scrolls inside
 * a frame that stays above the dock. That is asserted as such, not hidden.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const TILES = ["library", "processes", "tools", "skills", "beans"].map((id) => ({
  id, directory: id, title: id, ref: "x", href: `/${id}/`, surfaces: ["navbar", "board", "glass"], hidden: false,
}));
const PINS = ["glass-todos", "glass-settings", "library", "processes", "tools", "skills"];
const attr = (v: unknown) => JSON.stringify(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Panel</title>
<meta name="fa-tiles" content="${attr(TILES)}">
<meta name="fa-glass-strip" content="${attr(PINS)}">
<style>body { margin: 0; } ${CSS}</style></head><body><main><h1>A page</h1><p>Page.</p></main>
<script>${JS}</script></body></html>`;

/** just-the-docs' shape: a sidebar with a header, so the ▦ launcher mounts and
 *  Glass settings draws its "Page settings →" cross-link as its first row. */
const QR = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");
const WITH_SIDEBAR = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Panel</title>
<meta name="fa-tiles" content="${attr(TILES)}">
<meta name="fa-glass-strip" content="${attr(PINS)}">
<style>
  body { margin: 0; }
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; background: #27262b; color: #fff; }
  .site-header { width: 100%; display: flex; align-items: center; }
  .site-title { flex: 1; }
  .main { margin-left: 16.5rem; }
  @media (max-width: 50rem) {
    .side-bar { position: static; width: 100%; height: auto; }
    .main { margin-left: 0; }
  }
  ${CSS}
</style></head><body>
  <div class="side-bar">
    <div class="site-header"><a class="site-title">folio-assistant</a></div>
    <nav class="site-nav"><a href="#">Home</a></nav>
  </div>
  <div class="main"><div class="main-content"><h1>A page</h1></div></div>
  <script>${QR}<\/script>
  <script>${JS}<\/script>
</body></html>`;

const layer = ".fa-sticky-layer";
const dock = ".fa-glass-dock";
const panel = ".fa-glass-panel";

type Shape = "bare" | "launcher";
async function openGlass(page: Page, shape: Shape = "bare"): Promise<void> {
  await page.goto(shape === "bare" ? "http://panel.test/p.html" : "http://panel.test/side.html");
  await page.click(".fa-glass-handle");
  await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
  if ((await page.locator(dock).getAttribute("data-fa-strip")) !== "shown") await page.click(".fa-glass-strip-toggle");
  await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "shown");
}

/** Open Glass settings from its strip tile, then leave the dock in `strip` state. */
async function openSettings(page: Page, strip: "shown" | "hidden", shape: Shape = "bare"): Promise<void> {
  await openGlass(page, shape);
  await page.click('[data-fa-glass-chrome="glass-settings"]');
  await expect(page.locator(panel)).toHaveAttribute("data-fa-panel", "glass-settings");
  if (strip === "hidden") {
    await page.click(".fa-glass-strip-toggle");
    await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "hidden");
    // The tab took focus; the title had it when the panel opened.
    await page.locator(`${panel} .fa-glass-panel-title`).focus();
  }
  // The dock slides (0.25 s); measure where it comes to rest.
  await page.waitForTimeout(400);
}

/** Where the panel sits, against the viewport and the dock's visible top edge. */
async function geometry(page: Page) {
  return page.evaluate(([p, d]) => {
    const pr = document.querySelector(p)!.getBoundingClientRect();
    const dr = document.querySelector(d)!.getBoundingClientRect();
    return { top: pr.top, bottom: pr.bottom, left: pr.left, right: pr.right, dockTop: dr.top,
             vw: window.innerWidth, vh: window.innerHeight };
  }, [panel, dock] as const);
}

/**
 * Every control in the panel that a point at its centre does NOT reach.
 *
 * With `scroll`, each control is first brought into view by scrolling the
 * PANEL'S BODY only, and the glass itself must not have moved.
 */
async function unreachable(page: Page, scroll: boolean): Promise<string[]> {
  return page.evaluate(([p, sc]) => {
    const out: string[] = [];
    const root = document.querySelector(p as string)!;
    const body = root.querySelector(".fa-glass-panel-body") as HTMLElement;
    const sheet = document.querySelector(".fa-glass-sheet") as HTMLElement;
    const layerEl = document.querySelector(".fa-sticky-layer") as HTMLElement;
    const glassAt = [sheet.scrollTop, layerEl.scrollTop, window.scrollY].join(",");
    root.querySelectorAll("button, input, select, a[href], h2").forEach((c) => {
      const el = c as HTMLElement;
      if (sc && body.contains(el)) {
        const b = body.getBoundingClientRect(), r0 = el.getBoundingClientRect();
        body.scrollTop += (r0.top + r0.height / 2) - (b.top + b.height / 2);
      }
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) {
        out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.id || "").trim().slice(0, 40)}" at y=${Math.round(y)}`);
      }
    });
    const after = [sheet.scrollTop, layerEl.scrollTop, window.scrollY].join(",");
    if (after !== glassAt) out.push(`the glass scrolled: ${glassAt} -> ${after}`);
    return out;
  }, [panel, scroll] as const);
}

test.beforeEach(async ({ page }) => {
  await page.route("http://panel.test/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/p.html") return route.fulfill({ contentType: "text/html", body: PAGE });
    if (path === "/side.html") return route.fulfill({ contentType: "text/html", body: WITH_SIDEBAR });
    return route.fulfill({ status: 404, body: "" });
  });
});

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test.describe(`at ${width}×${height}`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width, height }); });

    for (const [strip, shape] of [["shown", "bare"], ["hidden", "bare"], ["shown", "launcher"], ["hidden", "launcher"]] as const) {
      const on = shape === "bare" ? "" : ", on a page with the launcher (its cross-link drawn)";
      test(`Glass settings opens wholly above the dock, with the dock ${strip}${on}`, async ({ page }) => {
        await openSettings(page, strip, shape);
        if (shape === "launcher") await expect(page.locator(`${panel} [data-fa-settings-crosslink="page"]`)).toBeVisible();
        const g = await geometry(page);
        expect(g.top, "panel top is on screen").toBeGreaterThanOrEqual(0);
        expect(g.bottom, `panel bottom ${Math.round(g.bottom)} is above the dock's top ${Math.round(g.dockTop)}`)
          .toBeLessThanOrEqual(g.dockTop + 0.5);
        expect(g.left).toBeGreaterThanOrEqual(0);
        expect(g.right).toBeLessThanOrEqual(g.vw + 0.5);
        // Its title and its way out are on screen as it opens.
        await expect(page.locator(`${panel} .fa-glass-panel-title`)).toBeInViewport({ ratio: 1 });
        await expect(page.locator(`${panel} .fa-glass-panel-close`)).toBeInViewport({ ratio: 1 });
        if (width >= 1280) {
          // Room for all of it: every control is drawn and reachable at once.
          expect(await unreachable(page, false)).toEqual([]);
          await expect(page.locator("#fa-glass-opacity")).toBeInViewport({ ratio: 1 });
          await expect(page.locator(`${panel} .fa-glass-defaults`)).toBeInViewport({ ratio: 1 });
        } else {
          // Less room than content: the BODY scrolls inside the frame, never
          // under the dock, and every control is reached that way without
          // moving the glass.
          const scrolls = await page.locator(`${panel} .fa-glass-panel-body`)
            .evaluate((b) => b.scrollHeight > b.clientHeight && getComputedStyle(b).overflowY === "auto");
          expect(scrolls, "the panel body is its own scroller").toBe(true);
          expect(await unreachable(page, true)).toEqual([]);
        }
      });
    }

    test("opening it does not scroll the glass, and the title takes focus", async ({ page }) => {
      await openGlass(page);
      const at = () => page.evaluate(() =>
        [document.querySelector(".fa-glass-sheet")!.scrollTop, document.querySelector(".fa-sticky-layer")!.scrollTop]);
      const before = await at();
      await page.click('[data-fa-glass-chrome="glass-settings"]');
      await expect(page.locator(`${panel} .fa-glass-panel-title`)).toBeFocused();
      expect(await at()).toEqual(before);
    });

    test("it is still a panel the tile closes, and the strip's other panels open in view too", async ({ page }) => {
      await openSettings(page, "shown");
      await page.click('[data-fa-glass-chrome="glass-settings"]');
      await expect(page.locator(panel)).toBeHidden();
      await page.click('[data-fa-glass-chrome="glass-todos"]');
      await expect(page.locator(panel)).toHaveAttribute("data-fa-panel", "glass-todos");
      const g = await geometry(page);
      expect(g.top).toBeGreaterThanOrEqual(0);
      expect(g.bottom).toBeLessThanOrEqual(g.dockTop + 0.5);
    });
  });
}
