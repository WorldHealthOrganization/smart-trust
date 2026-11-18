import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { darkRules, withSavedScheme } from "../scripts/lib/scheme-css.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * The navbar's light bulb and launcher on a FOLIO's page — issue #2208.
 *
 * Owner, 2026-10-05, on smart-ra's public-comment page: *"the LHS navbar icons
 * work for the links like beans and todos, but not for the other javscript
 * ones like light bulb"*. A folio's page loads `docs-ui.js` from the platform
 * (`withPlatformUi`) but has no just-the-docs: no `jtd.setTheme`, and no
 * sidebar header for the actions panel. Measured before the fix: the bulb
 * returned early without changing anything, and the launcher clicked a
 * button that did not exist.
 *
 * The fixture is that page's shape and nothing more: the rail, the row's
 * data, a sheet written with `darkRules` as the folio generators write theirs,
 * and the platform's two scripts.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERAL that builds the page (bean `bmr0`).
 */

const ROOT = join(HARNESS_ROOT);
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const LIGHT_BG = "rgb(253, 253, 251)";
const DARK_BG = "rgb(22, 22, 22)";

const ROW = JSON.stringify({ icons: ["beans", "launcher"], hrefs: { beans: "https://example.org/beans/" }, folders: [] });

const PAGE = withSavedScheme(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>folio page</title>
<style>
  :root { color-scheme: light dark; --bg: #fdfdfb; }
  ${darkRules(":root { --bg: #161616; }")}
  body { margin: 0; background: var(--bg); }
</style>
<script type="application/json" id="fa-navbar-row">${ROW}</script>
</head><body>
<nav class="fa-nav"><div class="fa-nav-in"><div class="fa-nav-top"></div></div></nav>
<main><p>A folio page.</p></main>
</body></html>`);

async function load(page: Page, html: string = PAGE): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("https://folio.test/**", (r) =>
    r.request().url().endsWith("/page.js")
      ? r.fulfill({ contentType: "text/javascript", body: JS })
      : r.fulfill({ contentType: "text/html", body: html.replace("</body>", '<script src="/page.js"></script></body>') }),
  );
  await page.goto("https://folio.test/");
  await page.locator(".fa-nav-scheme").waitFor();
  return errors;
}

const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const scheme = (page: Page) => page.evaluate(() => document.documentElement.getAttribute("data-fa-scheme"));

test.describe("a folio's page, with no just-the-docs", () => {
  test("the light bulb SWITCHES the page, both ways, and remembers", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    const errors = await load(page);
    expect(await bg(page)).toBe(LIGHT_BG);
    await page.locator(".fa-nav-scheme").click();
    expect(await scheme(page)).toBe("dark");
    expect(await bg(page)).toBe(DARK_BG);
    expect(await page.evaluate(() => localStorage.getItem("fa-color-scheme"))).toBe("dark");
    await page.locator(".fa-nav-scheme").click();
    expect(await bg(page)).toBe(LIGHT_BG);
    expect(errors).toEqual([]);
  });

  test("with no choice made, the OS decides — and the bulb starts from it", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await load(page);
    expect(await bg(page)).toBe(DARK_BG);
    await expect(page.locator(".fa-nav-scheme")).toHaveAttribute("aria-pressed", "true");
    await page.locator(".fa-nav-scheme").click();
    expect(await bg(page)).toBe(LIGHT_BG);
  });

  test("a saved choice wins over the OS on the next page", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await load(page);
    await page.locator(".fa-nav-scheme").click();
    await page.reload();
    await page.locator(".fa-nav-scheme").waitFor();
    expect(await bg(page)).toBe(LIGHT_BG);
  });

  test("the launcher is LEFT OUT where there is no panel for it to open", async ({ page }) => {
    await load(page);
    await expect(page.locator(".fa-nav-icons")).toHaveAttribute("data-fa-row", "full");
    await expect(page.locator('.fa-nav-icons [aria-label^="More actions"]')).toHaveCount(0);
    await expect(page.locator('.fa-nav-icons a[href="https://example.org/beans/"]')).toHaveCount(1);
  });
});
