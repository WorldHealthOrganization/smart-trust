import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * THE LANGUAGE PICKER GOES WHERE THE PAGE SAYS — owner, 2026-10-15: *"move
 * the language picker INTO the IG top bar"*.
 *
 * docs-ui drew the picker in its own band, which on an IG's pages sat above
 * the IG's top bar (composed pages) or below its header (thin pages), apart
 * from the search box the bar carries. A page now offers the picker a place,
 * an element marked `data-fa-slot="locale"`, and docs-ui puts it there. A
 * page without one keeps the band, so every folio site without such a bar is
 * unchanged; the third case holds that.
 *
 * The bar here is a fixture in the IG bar's shape, with its link rule
 * (`a { color: #fff }`), because that rule outranks the picker's own and is
 * what the slotted styles must undo. Nothing in docs-ui knows which layer
 * writes the slot.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERALS that build the pages (bean `bmr0`).
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const META = JSON.stringify({ lang: "en", supportedLocales: ["ar", "zh", "en", "fr", "ru", "es"], availableLocales: ["en", "fr"] });

const HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="application/json" id="fa-translation-meta">${META}</script>
<link rel="stylesheet" href="/assets/css/docs-ui.css">
<style>
.bar{display:flex;align-items:center;gap:1rem;padding:.5rem 1rem;background:#1c4b7c;color:#fff}
.bar a{color:#fff;text-decoration:none}
.bar input{margin-left:auto}
</style>
<script src="/assets/js/docs-ui.js" defer></script></head>`;

const SLOTTED = `${HEAD}<body>
<header class="bar"><a href="index.html">ACME IG</a><form role="search"><input type="search" id="search-input"></form><span data-fa-slot="locale"></span></header>
<main><h1>Page</h1><p>Text.</p></main></body></html>`;

const NO_SLOT = `${HEAD}<body>
<header class="bar"><a href="index.html">ACME IG</a></header>
<main><h1>Page</h1><p>Text.</p></main></body></html>`;

async function serve(page: Page, body: string): Promise<void> {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("assets/css/docs-ui.css")) return route.fulfill({ status: 200, contentType: "text/css", body: CSS });
    if (url.pathname.endsWith("assets/js/docs-ui.js")) return route.fulfill({ status: 200, contentType: "text/javascript", body: JS });
    if (url.pathname !== "/acme/") return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "text/html", body });
  });
  await page.goto("http://127.0.0.1:8080/acme/");
  await page.waitForLoadState("networkidle");
}

for (const width of [1280, 390]) {
  test.describe(`a page that offers a slot, at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("the picker is in the slot, beside the search box, and not in the band", async ({ page }) => {
      await serve(page, SLOTTED);
      const bar = page.locator('[data-fa-slot="locale"] > .fa-page-lang-bar[data-fa-slotted]');
      await expect(bar).toHaveCount(1);
      await expect(page.locator(".fa-page-lang-bar")).toHaveCount(1);
      await expect(page.locator(".fa-glass-band .fa-page-lang-bar")).toHaveCount(0);
      const toggle = bar.locator(".fa-page-lang-toggle");
      await expect(toggle).toBeVisible();
      // In the bar's row: its box lies inside the header's.
      const h = (await page.locator("header.bar").boundingBox())!;
      const t = (await toggle.boundingBox())!;
      expect(t.y).toBeGreaterThanOrEqual(h.y);
      expect(t.y + t.height).toBeLessThanOrEqual(h.y + h.height + 0.5);
      // After the search box, on its line.
      const s = (await page.locator("#search-input").boundingBox())!;
      expect(t.x).toBeGreaterThan(s.x);
    });

    test("it opens and closes as in the band, and the host's link colour does not win", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await serve(page, SLOTTED);
      await page.evaluate(() => document.documentElement.setAttribute("data-fa-scheme", "light"));
      const toggle = page.locator(".fa-page-lang-toggle");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const fr = page.locator("a.fa-page-lang-tab", { hasText: "FR" });
      await expect(fr).toBeVisible();
      // The light token (#1d4ed8), not the bar's white.
      expect(await fr.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(29, 78, 216)");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(fr).toBeHidden();
    });
  });
}

test("a page without a slot keeps the picker in the band, as before", async ({ page }) => {
  await serve(page, NO_SLOT);
  await expect(page.locator(".fa-glass-band .fa-page-lang-bar")).toHaveCount(1);
  await expect(page.locator(".fa-page-lang-bar[data-fa-slotted]")).toHaveCount(0);
});
