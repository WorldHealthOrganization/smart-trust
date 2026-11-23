import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * The three sidebar disclosure panels — QR, reading preferences, language —
 * must open where nothing clips them.
 *
 * Reported broken by a reader on 2026-09-18: the language selector and the
 * reading-preferences panel were invisible or overlapping, while the QR panel
 * worked. Cause: just-the-docs hard-caps `.site-header` height at the desktop
 * breakpoint. QR mounted its panel into `.side-bar` and escaped; the other two
 * did not. The language bar additionally opened UPWARD to dodge the cap, which
 * only moved the clipping to the top of the column.
 *
 * This harness reproduces the theme's structure — the fixed sidebar, the
 * height-capped header, and a sticky banner like the staging one — because the
 * bug only appears when the cap is present. Testing against a page without it
 * would pass on the broken code.
 *
 * ## Three panels became one, and the property did not change
 *
 * Bean `1le7` collapsed the four header toggles into a single action-tile
 * launcher, so there is now ONE panel in the sidebar column with a view per
 * action. That removes the class of bug by construction — three panels cannot
 * solve one placement problem three different ways if there is one panel — but
 * "cannot recur by construction" is a claim, and this file is what checks it.
 * Every assertion below is the same assertion it was, asked of the panel that
 * exists now and of each view that renders into it.
 */

// `import.meta.dir` is a Bun extension and is undefined under Node, which is
// what Playwright runs the spec with.
const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
// The QR encoder must load FIRST: `mountQr` returns early without it, and
// mountQr is what mounts the theme toggle, reading preferences and language
// switcher too. Omitting it mounts nothing and every assertion below fails
// for the wrong reason.
const QR = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");

const HARNESS = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  body { margin: 0; }
  /* The staging banner: sticky, above everything. */
  .banner { position: sticky; top: 0; z-index: 9999; background: #4F6F52; color: #fff; padding: 8px; }
  /* just-the-docs' sidebar column and its CAPPED header — the cause. */
  /* The offset rule the staging workflow injects alongside the banner. */
  :root { --fa-staging-offset: 0px; }
  .side-bar { top: var(--fa-staging-offset, 0px) !important; }
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; align-items: flex-end;
              background: #27262b; color: #fff; }
  .site-header { width: 100%; max-height: 3.75rem; overflow: hidden; display: flex; align-items: center; }
  .site-title { flex: 1; }
  .site-nav { width: 100%; overflow-y: auto; }
  ${CSS}
</style></head><body>
  <div class="banner" data-fa-staging-banner>FEATURE BRANCH</div>
  <script>(function(){function s(){var b=document.querySelector('[data-fa-staging-banner]');if(!b)return;document.documentElement.style.setProperty('--fa-staging-offset',b.getBoundingClientRect().height+'px');}if(document.readyState!=='loading')s();else document.addEventListener('DOMContentLoaded',s);window.addEventListener('resize',s);window.addEventListener('load',s);})();<\/script>
  <div class="side-bar">
    <div class="site-header"><a class="site-title">folio-assistant</a></div>
    <nav class="site-nav"><a href="#">Home</a></nav>
  </div>
  <div class="main"><div class="main-content"><h1>x</h1></div></div>
  <script>${QR}<\/script>
  <script>${JS}<\/script>
</body></html>`;

/** Each action's tile, and the thing its view must actually show. */
const VIEWS = [
  { name: "settings", tile: "Page settings", content: ".fa-a11y-panel" },
  { name: "language", tile: "Language", content: ".fa-lang-bar" },
  { name: "QR", tile: "QR code", content: ".fa-qr-panel" },
];

/** Open the launcher, then the named tile's view. */
async function openView(page: import("@playwright/test").Page, tile: string): Promise<void> {
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: tile }).first().click();
}

test.describe("sidebar disclosure panels", () => {
  test("the one panel escapes the height-capped header", async ({ page }) => {
    await page.setContent(HARNESS);
    const panel = page.locator(".fa-tiles");
    await expect(panel).toHaveCount(1);
    // The whole bug in one assertion: a panel inside .site-header is clipped
    // by its max-height, whatever else is done to it.
    const inHeader = await panel.evaluate((el) => !!el.closest(".site-header"));
    expect(inHeader).toBe(false);
    const inSideBar = await panel.evaluate((el) => !!el.closest(".side-bar"));
    expect(inSideBar).toBe(true);
  });

  for (const v of VIEWS) {
    test(`${v.name}: opens fully visible, not under the banner`, async ({ page }) => {
      await page.setContent(HARNESS);
      await openView(page, v.tile);
      const content = page.locator(v.content).first();
      await expect(content).toBeVisible();

      const box = await content.boundingBox();
      expect(box).not.toBeNull();
      // Non-zero area — a clipped panel collapses.
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.width).toBeGreaterThan(0);
      // Below the banner's bottom edge. The upward-opening language bar failed
      // exactly here: it rendered above its toggle and under the banner.
      const bannerBottom = (await page.locator(".banner").boundingBox())!.y
        + (await page.locator(".banner").boundingBox())!.height;
      expect(box!.y).toBeGreaterThanOrEqual(bannerBottom - 1);
      // And on-screen at all.
      expect(box!.y).toBeGreaterThanOrEqual(0);
    });
  }

  test("the banner pushes the fixed sidebar down instead of covering it", async ({ page }) => {
    // The defect a reader hit: `.side-bar` is `position: fixed; top: 0` and a
    // sticky banner is in normal flow, so it moved nothing and sat on top of
    // the sidebar's title and toolbar. The workflow now measures the banner
    // and publishes its height as --fa-staging-offset.
    await page.setContent(HARNESS);
    const banner = (await page.locator(".banner").boundingBox())!;
    const sideBar = (await page.locator(".side-bar").boundingBox())!;
    expect(sideBar.y).toBeGreaterThanOrEqual(banner.y + banner.height - 1);

    // And the toolbar control is therefore actually clickable rather than
    // sitting under the banner.
    const b = (await page.locator(".fa-tiles-toggle").boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(banner.y + banner.height - 1);
  });

  test("an opened panel does not overlap the nav — it pushes it down", async ({ page }) => {
    await page.setContent(HARNESS);
    await page.locator(".fa-tiles-toggle").click();
    const panel = (await page.locator(".fa-tiles").boundingBox())!;
    const nav = (await page.locator(".site-nav").boundingBox())!;
    // Normal flow, not an overlay: the nav starts at or below the panel's end.
    expect(nav.y).toBeGreaterThanOrEqual(panel.y + panel.height - 1);
  });

  test("a view pushes the nav down too, not just the grid", async ({ page }) => {
    // The grid is short; a view is taller. Checking only the grid would let a
    // view that overflows the column pass — which is the original bug in a new
    // place, since the content that used to be clipped now lives in a view.
    await page.setContent(HARNESS);
    await openView(page, "Page settings");
    const panel = (await page.locator(".fa-tiles").boundingBox())!;
    const nav = (await page.locator(".site-nav").boundingBox())!;
    expect(nav.y).toBeGreaterThanOrEqual(panel.y + panel.height - 1);
  });
});
