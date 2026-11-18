import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ONE RAIL AND ONE TOP BAR ON EVERY PAGE, in a browser — owner, 2026-10-15:
 * "folio rail everywhere" (option A: a pass after Jekyll replaces the
 * theme's side bar), "Top bar, like IG sites", and on the Pages screenshot
 * "what is 26? why unlabeled?" (a fold opens from its parent's row).
 *
 * The site is written by `one-rail-fixture.build.ts` with the REAL rail pass
 * over theme pages and a page the theme never laid out, and the shipped
 * `navbar.js` and `docs-ui.js` draw it here.
 */

let SITE = "";
test.beforeAll(() => {
  const out = mkdtempSync(join(tmpdir(), "one-rail-"));
  execFileSync("bun", ["run", fileURLToPath(new URL("./one-rail-fixture.build.ts", import.meta.url)), out], { stdio: "pipe" });
  SITE = join(out, "site");
});

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

async function open(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("http://site.test/**", (route) => {
    let p = join(SITE, decodeURIComponent(new URL(route.request().url()).pathname));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
    if (!existsSync(p)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[extname(p)] ?? "application/octet-stream", body: readFileSync(p) });
  });
  await page.goto(`http://site.test${path}`);
  await page.locator("nav.fa-nav:not([data-fa-rail])").waitFor({ state: "attached" });
  return errors;
}

const sections = (page: Page) => page.locator("nav.fa-nav details.fa-nav-group > summary .fa-nav-label").allTextContents();

test.describe("one rail on every page (owner, 2026-10-15, option A)", () => {
  test("a theme page wears the rail, not the theme's side bar", async ({ page }) => {
    const errors = await open(page, "/guide/install.html");
    await expect(page.locator(".side-bar")).toHaveCount(0);
    await expect(page.locator("#site-nav")).toHaveCount(0);
    expect(await sections(page)).toEqual(["On this page", "Pages", "Folders"]);
    // Harnesses is an icon's panel since 2026-11-13 (owner: "remove the
    // harnesses navbar, instead add an icon to the controls").
    await expect(page.locator('nav.fa-nav button.fa-nav-harnesses[aria-controls="fa-nav-harnesses"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test("a page the theme never laid out wears the same rail, the same sections", async ({ page }) => {
    const errors = await open(page, "/replica/page.html");
    expect(await sections(page)).toEqual(["On this page", "Pages", "Folders"]);
    // Harnesses is an icon's panel since 2026-11-13 (owner: "remove the
    // harnesses navbar, instead add an icon to the controls").
    await expect(page.locator('nav.fa-nav button.fa-nav-harnesses[aria-controls="fa-nav-harnesses"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test("the reader's page is marked in Pages, and its fold arrives open", async ({ page }) => {
    await open(page, "/guide/install.html");
    // Folded with the rest of Pages until the reader opens the rail, so found by its name, not its role.
    const toggle = page.locator(`button.fa-nav-twisty[aria-label="Hide Guide's 2 pages"]`);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`#${await toggle.getAttribute("aria-controls")}`)).not.toHaveAttribute("hidden", "");
  });
});

test.describe("a fold opens from its parent's row — \"what is 26? why unlabeled?\"", () => {
  test("no row is a bare count; the chevron is named, states aria-expanded, and toggles", async ({ page }) => {
    await open(page, "/");
    // Open the rail as a reader does, by pointing at it, then open Pages.
    await page.locator("nav.fa-nav").hover();
    await page.locator("nav.fa-nav summary", { hasText: "Pages" }).click();
    await expect(page.locator("nav.fa-nav .fa-nav-label", { hasText: /^\d+ pages?$/ })).toHaveCount(0);
    const named = page.getByRole("button", { name: "Show Guide's 2 pages" });
    await expect(named).toHaveAttribute("aria-expanded", "false");
    // Held by what it controls, since its name changes with its state.
    const id = await named.getAttribute("aria-controls");
    const toggle = page.locator(`button.fa-nav-twisty[aria-controls="${id}"]`);
    const list = page.locator(`#${id}`);
    await expect(list).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAccessibleName("Hide Guide's 2 pages");
    await expect(list).toBeVisible();
    await toggle.press("Enter");
    await expect(list).toBeHidden();
  });
});

test.describe("one top bar on every page — \"Top bar, like IG sites\"", () => {
  for (const path of ["/guide/install.html", "/replica/page.html"]) {
    test(`${path}: the bar holds the site's name, the search box, and stays out of the band`, async ({ page }) => {
      const errors = await open(page, path);
      const bar = page.locator("#main-header.fa-page-bar");
      await expect(bar).toHaveCount(1);
      await expect(bar.locator("a.fa-page-bar-home")).toHaveCount(1);
      await expect(bar.locator("#search-input")).toHaveCount(1);
      // docs-ui (on the pages that load it) leaves a search that is in the page's bar where it is.
      if (await page.locator('script[src$="assets/js/docs-ui.js"]').count()) {
        await page.waitForFunction(() => !!document.querySelector(".fa-glass-handle"));
      }
      await expect(page.locator(".fa-search-home #search-input")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("the top bar is FULL WIDTH on every page (owner, 2026-10-15)", () => {
  test("on a page whose body is a centred column, the bar still spans from the rail to the window, flush with the top", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "/replica/page.html");
    await expect.poll(async () => page.locator("#main-header.fa-page-bar").evaluate((b) => {
      const r = b.getBoundingClientRect();
      const rail = document.querySelector("nav.fa-nav")!.getBoundingClientRect().right;
      return Math.round(r.left - rail) === 0 && Math.round(document.documentElement.clientWidth - r.right) === 0 && Math.round(r.top) === 0;
    })).toBe(true);
  });

  test("the bar follows the rail as it opens and closes, so it is never left under the open rail", async ({ page }) => {
    // Opened (pointed at), the rail widens body's padding-left from 56px to
    // 264px; a body whose max-width fixes its content box does not resize
    // when only its padding does. Measured before the fix in a headless
    // shell, whose pointer rests at the window's corner over the rail: the
    // bar stayed at 264..1488 in a 1280px window, its start under the rail.
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "/replica/page.html");
    const spans = () => page.locator("#main-header.fa-page-bar").evaluate((b) => {
      const r = b.getBoundingClientRect();
      const rail = document.querySelector("nav.fa-nav")!.getBoundingClientRect().right;
      return { start: Math.round(r.left - rail), end: Math.round(document.documentElement.clientWidth - r.right), top: Math.round(r.top), rail: Math.round(rail) };
    });
    await page.mouse.move(20, 400);
    await expect.poll(async () => { const s = await spans(); return s.rail > 56 ? { ...s, rail: "open" } : s; }).toEqual({ start: 0, end: 0, top: 0, rail: "open" });
    await page.mouse.move(900, 400);
    await expect.poll(spans).toEqual({ start: 0, end: 0, top: 0, rail: 56 });
  });
});
