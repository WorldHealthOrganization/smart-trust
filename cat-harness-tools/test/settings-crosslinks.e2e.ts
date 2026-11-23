import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * TWO SETTINGS PANELS, TWO NAMES, EACH POINTS TO THE OTHER — bean `ob3m`
 * finding 12.
 *
 * The defect: the glass's ⚙ panel (theme, avatars, opacity, blur) and the ▦
 * Actions launcher's panel (scheme, reading preferences, the Discarded fish,
 * Declared kinds) were both "Settings", both wore a gear, and neither pointed
 * at the other. A reader looking for Discarded items who opened the glass one
 * found nothing there and nothing saying where else to look.
 *
 * Owner, 2026-10-01, option 2 of 4: *"Rename: 'Glass settings' and 'Page
 * settings', each with a link to the other."*
 *
 * Every assertion is on the RENDERED controls, not on the source: a link that
 * exists but opens nothing — or opens its target underneath the glass — is the
 * failure this file exists to catch, and only a browser can see it. The
 * source-level half (the two labels differ) is
 * `scripts/tests/settings-labels-distinct.test.ts`.
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const QR = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");

/** just-the-docs' shape: a sidebar with a header (so the launcher mounts) and a main column. */
const WITH_SIDEBAR = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
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

/** A page with a glass and NO sidebar — a replica, the harness page. No launcher, so no Page settings. */
const NO_SIDEBAR = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head>
<body><h1>Replica</h1><script>${JS}<\/script></body></html>`;

const layer = ".fa-sticky-layer";
const glassPanel = ".fa-glass-panel";
const pageView = ".fa-tiles-view";

async function load(page: Page, html = WITH_SIDEBAR): Promise<void> {
  await page.setContent(html);
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
}

/**
 * The strip starts HIDDEN on a first open (owner, 2026-10-01, bean `ob3m`
 * finding 10), and `setContent` pages have no storage to remember a choice in,
 * so a spec that clicks a strip tile shows the strip first — through the tab,
 * as a reader would. `glass-strip-default-hidden.e2e.ts` holds the default.
 */
async function showStrip(page: Page): Promise<void> {
  if ((await page.locator(".fa-glass-dock").getAttribute("data-fa-strip")) === "hidden") {
    await page.click(".fa-glass-strip-toggle");
  }
  await expect(page.locator(".fa-glass-dock")).toHaveAttribute("data-fa-strip", "shown");
}

async function openGlassSettings(page: Page): Promise<void> {
  await page.click(".fa-glass-handle");
  await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
  await showStrip(page);
  await page.click('[data-fa-glass-chrome="glass-settings"]');
  await expect(page.locator(glassPanel)).toHaveAttribute("data-fa-panel", "glass-settings");
  await expect(page.locator(glassPanel)).toBeVisible();
}

async function openPageSettings(page: Page): Promise<void> {
  await page.locator(".fa-tiles-toggle").click();
  await page.locator('.fa-tiles-grid .fa-tile:has(.fa-tile-caption:text-is("Page settings"))').click();
  await expect(page.locator(pageView)).toBeVisible();
}

/** The Page settings view is OPEN and SHOWING: launcher open, its heading, its reading preferences. */
async function expectPageSettingsOpen(page: Page): Promise<void> {
  await expect(page.locator(".fa-tiles-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(pageView)).toBeVisible();
  await expect(page.locator(`${pageView} .fa-tiles-title`)).toHaveText("Page settings");
  // The page's own settings, visible — not merely the view's frame. (The
  // Discarded control appears only once its document loads, which this page
  // does not serve, so the reading preferences are the stable witness.)
  await expect(page.locator(`${pageView} .fa-a11y-panel`)).toBeVisible();
  await expect(page.locator(`${pageView} .fa-tiles-title`)).toBeFocused();
  // Not underneath the glass: a panel opened beneath it has not opened.
  await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "closed");
}

/** The Glass settings panel is OPEN and SHOWING: glass down, panel visible, heading focused. */
async function expectGlassSettingsOpen(page: Page): Promise<void> {
  await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
  await expect(page.locator(glassPanel)).toBeVisible();
  await expect(page.locator(glassPanel)).toHaveAttribute("data-fa-panel", "glass-settings");
  await expect(page.locator(`${glassPanel} .fa-glass-panel-title`)).toContainText("Glass settings");
  await expect(page.locator("#fa-glass-opacity")).toBeVisible();
  await expect(page.locator(`${glassPanel} .fa-glass-panel-title`)).toBeFocused();
}

test.describe("ob3m 12 — the two settings panels do not share a name", () => {
  test("tile captions, accessible names and panel headings all differ", async ({ page }) => {
    await load(page);
    await page.click(".fa-glass-handle");
    await showStrip(page);
    const glassTile = page.locator('[data-fa-glass-chrome="glass-settings"]').first();
    await expect(glassTile.locator(".fa-tile-caption")).toHaveText("Glass settings");
    // Label in name (WCAG 2.5.3): the accessible name STARTS with the caption.
    expect(await glassTile.getAttribute("aria-label")).toMatch(/^Glass settings/);
    await page.click(".fa-glass-handle");

    await page.locator(".fa-tiles-toggle").click();
    const captions = await page.locator(".fa-tiles-grid .fa-tile-caption").allTextContents();
    expect(captions).toContain("Page settings");
    // The bare word is gone from BOTH surfaces — it was the collision.
    expect(captions).not.toContain("Settings");
    expect(captions).not.toContain("Glass settings");
    await page.locator(".fa-tiles-toggle").click();

    await openPageSettings(page);
    const pageHeading = (await page.locator(`${pageView} .fa-tiles-title`).textContent())!.trim();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await openGlassSettings(page);
    const glassHeading = (await page.locator(`${glassPanel} .fa-glass-panel-title`).textContent())!.trim();
    expect(pageHeading).toBe("Page settings");
    expect(glassHeading).toMatch(/^Glass settings/);
    expect(pageHeading).not.toBe(glassHeading);
  });
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`ob3m 12 — each panel opens the other (${viewport.width}×${viewport.height})`, () => {
    test.use({ viewport });

    test("Glass settings → Page settings, by pointer", async ({ page }) => {
      await load(page);
      await openGlassSettings(page);
      const link = page.locator(`${glassPanel} [data-fa-settings-crosslink="page"]`);
      await expect(link).toBeVisible();
      await expect(link).toHaveText(/^Page settings \(scheme, reading, Discarded\) →$/);
      // FIRST in the panel body, before any of the glass's own settings.
      expect(await page.locator(`${glassPanel} .fa-glass-panel-body > *`).first()
        .getAttribute("data-fa-settings-crosslink")).toBe("page");
      await link.click();
      await expectPageSettingsOpen(page);
      await expect(page.locator(glassPanel)).toBeHidden();
    });

    test("Page settings → Glass settings, by pointer", async ({ page }) => {
      await load(page);
      await openPageSettings(page);
      const link = page.locator(`${pageView} [data-fa-settings-crosslink="glass"]`);
      await expect(link).toBeVisible();
      await expect(link).toHaveText(/^Glass settings \(theme, avatars, opacity, blur\) →$/);
      expect(await page.locator(`${pageView} .fa-tile-content > *`).first()
        .getAttribute("data-fa-settings-crosslink")).toBe("glass");
      await link.click();
      await expectGlassSettingsOpen(page);
      // The launcher shut, so the reader is not left with two panels open.
      await expect(page.locator(".fa-tiles-toggle")).toHaveAttribute("aria-expanded", "false");
    });

    test("both links work from the keyboard, and round-trip", async ({ page }) => {
      await load(page);
      await openPageSettings(page);
      // The heading has focus; the link is the next stop.
      await page.keyboard.press("Tab");
      await expect(page.locator(`${pageView} [data-fa-settings-crosslink="glass"]`)).toBeFocused();
      await page.keyboard.press("Enter");
      await expectGlassSettingsOpen(page);

      // The glass panel heading has focus; Tab past the close button to the link.
      const toPage = page.locator(`${glassPanel} [data-fa-settings-crosslink="page"]`);
      for (let i = 0; i < 4 && !(await toPage.evaluate((n) => n === document.activeElement)); i++) {
        await page.keyboard.press("Tab");
      }
      await expect(toPage).toBeFocused();
      await page.keyboard.press("Space");
      await expectPageSettingsOpen(page);
    });

    test("the link opens its target even when the target was already open", async ({ page }) => {
      // `openPanel` TOGGLES — a second call closes. A link that sometimes shuts
      // its own target is not a link.
      await load(page);
      await openGlassSettings(page);
      await page.evaluate(() => {
        const toggle = document.querySelector(".fa-tiles-toggle") as HTMLButtonElement;
        toggle.click();
        (Array.from(document.querySelectorAll(".fa-tiles-grid .fa-tile"))
          .find((t) => t.textContent?.includes("Page settings")) as HTMLButtonElement).click();
        (document.querySelector('[data-fa-settings-crosslink="glass"]') as HTMLButtonElement).click();
      });
      await expectGlassSettingsOpen(page);
    });
  });
}

test("a page with a glass and no launcher draws no Page settings link — never a link to nothing", async ({ page }) => {
  await load(page, NO_SIDEBAR);
  await openGlassSettings(page);
  await expect(page.locator('[data-fa-settings-crosslink="page"]')).toHaveCount(0);
});
