/**
 * THE GLASS STRIP FITS, AND COUNTS WHAT DOES NOT — bean `ob3m` finding 10.
 *
 * The finding: *"the bottom strip hides most of its tiles, and says nothing
 * about it. 25 tiles in one row: 11 visible at 1280, 2½ at 390. The rest
 * scroll sideways inside the strip, with no arrow, count or edge fade."*
 *
 * Owner, 2026-10-01, option 1 of 4: **"Pinned tiles first, plus '+N more'"**.
 * The strip shows Todos, Settings and the key kinds the layer DECLARES, as
 * many as fit, then one "+N more" tile whose N is exactly the count of tiles
 * not on screen, and which opens More. No tile may be silently off-screen.
 *
 * The page carries the same two metas a Jekyll-built page does — the tiles
 * and the resolved pins — and 22 declared tiles, so with the glass's three
 * own controls the total is 25, the number the finding counted.
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

const IDS = [
  "beans", "docs", "external-schemas", "folio", "library", "methodologies", "processes", "qa",
  "root-docs", "schemas", "skills", "swimlane-glossary", "tools", "translation-sources", "uploads",
  "skills-folio-assistant", "tools-folio-assistant", "library-who-iris", "processes-bootstrap",
  "kg", "uml", "health",
];
const TILES = IDS.map((id) => ({
  id, directory: id, title: id, ref: "x", href: `/${id}/`,
  surfaces: ["navbar", "board", "glass"], hidden: false,
}));
/** What `sync-docs-harness.ts` resolves cat-harness's `glassStrip` to. */
const PINS = ["glass-todos", "glass-settings", "library", "processes", "tools", "skills"];
/** Every tile the glass can draw: 22 declared plus Todos, Filter and Settings. */
const TOTAL = IDS.length + 3;

const attr = (v: unknown) => JSON.stringify(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Strip</title>
<meta name="fa-tiles" content="${attr(TILES)}">
<meta name="fa-glass-strip" content="${attr(PINS)}">
<style>${CSS}</style></head><body><main><p>Page.</p></main>
<script>${JS}</script></body></html>`;

test.beforeEach(async ({ page }) => {
  // The strip starts HIDDEN on a first open (owner, 2026-10-01). These specs
  // are about what is ON the strip, so they arrive as a reader who has shown
  // it; `glass-strip-default-hidden.e2e.ts` holds the default itself.
  await page.addInitScript(() => {
    try { if (localStorage.getItem("fa-glass-strip-hidden") === null) localStorage.setItem("fa-glass-strip-hidden", "0"); } catch { /* no storage */ }
  });
  await page.route("http://strip.test/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/p.html") return route.fulfill({ contentType: "text/html", body: PAGE });
    if (path === "/assets/todos/index.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [] }) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
});

const more = '.fa-glass-tiles [data-fa-glass-chrome="glass-more"]';

/**
 * Open the glass and let the strip settle: laid out, then two frames for the
 * refit a resize schedules. Deliberately waits on nothing this change adds,
 * so the same specs run — and fail on substance — against the strip before it.
 */
const openGlass = async (page: Page) => {
  await page.click(".fa-glass-handle");
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
  await page.waitForFunction(() => ((document.querySelector(".fa-glass-tiles") as HTMLElement | null)?.clientWidth ?? 0) > 0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

/** What is on the strip, read off the rendered page. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const strip = document.querySelector(".fa-glass-tiles") as HTMLElement;
    const box = strip.getBoundingClientRect();
    const kids = Array.from(strip.children) as HTMLElement[];
    const shown = kids.filter((n) => getComputedStyle(n).display !== "none" && n.getAttribute("data-fa-glass-chrome") !== "glass-more");
    const m = strip.querySelector('[data-fa-glass-chrome="glass-more"]') as HTMLElement;
    const r = m.getBoundingClientRect();
    return {
      scrollWidth: strip.scrollWidth,
      clientWidth: strip.clientWidth,
      shown: shown.map((n) => n.getAttribute("data-fa-strip-item") ?? n.getAttribute("data-fa-glass-chrome")),
      // Every shown tile, and More, wholly inside the strip and the viewport.
      offscreen: [...shown, m].filter((n) => {
        const b = n.getBoundingClientRect();
        return b.left < Math.max(0, box.left) - 0.5 || b.right > Math.min(innerWidth, box.right) + 0.5;
      }).length,
      moreCaption: (m.querySelector(".fa-tile-caption")?.textContent ?? "").trim(),
      moreName: m.getAttribute("aria-label") ?? "",
      moreCount: Number(m.getAttribute("data-fa-more-count")),
      moreInView: r.left >= 0 && r.right <= innerWidth && r.width > 0,
    };
  });

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test.describe(`at ${width}×${height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("http://strip.test/p.html");
      await openGlass(page);
    });

    test("the strip does not scroll sideways, and nothing on it is off-screen", async ({ page }) => {
      const m = await measure(page);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      expect(m.offscreen).toBe(0);
      expect(await page.locator(".fa-glass-tiles").evaluate((n) => getComputedStyle(n).overflowX)).not.toBe("auto");
    });

    test("shown tiles + N is every tile, and More lists exactly the N", async ({ page }) => {
      const m = await measure(page);
      expect(m.shown.length + m.moreCount).toBe(TOTAL);
      expect(m.moreCount).toBeGreaterThan(0);
      expect(m.moreCaption).toBe(`+${m.moreCount} more`);
      expect(m.moreName).toBe(`${m.moreCount} more tiles`);
      await page.click(more);
      await expect(page.locator(".fa-glass-more .fa-glass-more-item")).toHaveCount(m.moreCount);
    });

    test("pinned tiles come first, in declared order", async ({ page }) => {
      const m = await measure(page);
      expect(m.shown.length).toBeGreaterThan(0);
      expect(m.shown).toEqual(PINS.slice(0, m.shown.length));
      // Todos and "+N more" are both on screen, at every width.
      expect(m.shown[0]).toBe("glass-todos");
      expect(m.moreInView).toBe(true);
    });

    test("\"+N more\" is a keyboard-reachable button that opens More and moves focus into it", async ({ page }) => {
      const btn = page.locator(more);
      expect(await btn.evaluate((n) => n.tagName)).toBe("BUTTON");
      expect(await btn.getAttribute("tabindex")).toBeNull();
      await btn.focus();
      await page.keyboard.press("Enter");
      const panel = page.locator('.fa-glass-panel[data-fa-panel="glass-more"]');
      await expect(panel).toBeVisible();
      await expect(btn).toHaveAttribute("aria-expanded", "true");
      expect(await panel.evaluate((p) => p.contains(document.activeElement))).toBe(true);
    });
  });
}

test("a pinned tile with no room is counted, and waits first in More", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://strip.test/p.html");
  await openGlass(page);
  const m = await measure(page);
  const overflowed = PINS.slice(m.shown.length);
  expect(overflowed.length).toBeGreaterThan(0);
  await page.click(more);
  const firstInMore = await page.locator(".fa-glass-more .fa-glass-more-item").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-fa-more-item")));
  expect(firstInMore.slice(0, overflowed.length)).toEqual(overflowed);
});

test("widening the window refits the strip: more pinned tiles, a smaller N", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://strip.test/p.html");
  await openGlass(page);
  const narrow = await measure(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(async () => (await measure(page)).shown.length).toBeGreaterThan(narrow.shown.length);
  const wide = await measure(page);
  expect(wide.shown.length + wide.moreCount).toBe(TOTAL);
  expect(wide.scrollWidth).toBeLessThanOrEqual(wide.clientWidth);
});
