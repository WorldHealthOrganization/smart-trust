import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * THE TOP BAR'S SEARCH AND LANGUAGE, AS ON THE REFERENCE SITE — owner,
 * 2026-11-10: "on who-iris, smart-* and dth-* pages have styling match
 * who.int especialy for language and search parts".
 *
 * In a page's own top bar (`.fa-page-bar`) docs-ui draws the search as a
 * large magnifier that opens the field in a panel under the bar, and the
 * language picker as a translate glyph, "Select language" and a chevron,
 * opening a dropdown of the languages each named in its own language.
 *
 * The bar is a fixture in the IG bar's shape (`.ig-topbar.fa-page-bar`, its
 * search form and its locale slot). NO BACKTICKS INSIDE THE TEMPLATE
 * LITERALS that build the pages (bean `bmr0`).
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const page = (lang: string): string => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="application/json" id="fa-translation-meta">${JSON.stringify({ lang, supportedLocales: ["ar", "zh", "en", "fr", "ru", "es"], availableLocales: ["en", "fr"] })}</script>
<link rel="stylesheet" href="/assets/css/docs-ui.css">
<style>
.ig-topbar{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem 1rem;padding:.5rem 1.5rem;background:#2d4271;color:#fff}
.ig-topbar a{color:#fff;text-decoration:none}
.ig-search{position:relative;margin-left:auto;flex:0 1 18rem}
</style>
<script src="/assets/js/docs-ui.js" defer></script></head><body>
<div class="ig-topbar fa-page-bar"><a class="ig-topbar-home" href="index.html">ACME IG</a>
<form class="ig-search" role="search"><input type="search" id="search-input" class="ig-search-input"></form><span data-fa-slot="locale"></span></div>
<main><h1>Page</h1><p>Text.</p></main></body></html>`;

async function serve(p: Page, lang = "en"): Promise<void> {
  await p.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("assets/css/docs-ui.css")) return route.fulfill({ status: 200, contentType: "text/css", body: CSS });
    if (url.pathname.endsWith("assets/js/docs-ui.js")) return route.fulfill({ status: 200, contentType: "text/javascript", body: JS });
    if (url.pathname !== "/acme/") return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "text/html", body: page(lang) });
  });
  await p.goto("http://127.0.0.1:8080/acme/");
  await p.waitForLoadState("networkidle");
}

test.describe("the bar's search is a magnifier", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("closed on arrival; the magnifier opens the field with focus, Escape closes it and refocuses the magnifier", async ({ page }) => {
    await serve(page);
    const toggle = page.locator(".fa-page-bar .fa-bar-search-toggle");
    const input = page.locator("#search-input");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(input).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    // The panel hangs under the bar: it does not grow the bar.
    const bar = (await page.locator(".fa-page-bar").boundingBox())!;
    const field = (await input.boundingBox())!;
    expect(field.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    await input.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(input).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("the magnifier comes before the language picker in the bar", async ({ page }) => {
    await serve(page);
    const s = (await page.locator(".fa-bar-search-toggle").boundingBox())!;
    const l = (await page.locator(".fa-page-lang-toggle").boundingBox())!;
    expect(s.x).toBeLessThan(l.x);
  });
});

test.describe("the bar's language picker", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("reads Select language with a translate glyph, and lists the languages by their own names", async ({ page }) => {
    await serve(page);
    const toggle = page.locator(".fa-page-lang-bar[data-fa-slotted] .fa-page-lang-toggle");
    await expect(toggle.locator(".fa-page-lang-label")).toHaveText("Select language");
    await expect(toggle.locator(".fa-page-lang-glyph svg")).toHaveCount(1);
    await toggle.click();
    const items = page.locator(".fa-page-lang-list > li > .fa-page-lang-tab");
    await expect(items).toHaveText(["العربية", "中文", "English", "Français", "Русский", "Español"]);
    await expect(page.locator('.fa-page-lang-list [aria-current="page"]')).toHaveText("English");
    await expect(page.locator('a.fa-page-lang-tab[lang="fr"]')).toBeVisible();
    // Not yet translated: not a link.
    await expect(page.locator('span.fa-page-lang-tab[lang="ru"]')).toHaveCount(1);
    // A press elsewhere closes the dropdown.
    await page.locator("main h1").click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("on an Arabic page the label is in Arabic", async ({ page }) => {
    await serve(page, "ar");
    await expect(page.locator(".fa-page-lang-label")).toHaveText("اختر اللغة");
  });
});
