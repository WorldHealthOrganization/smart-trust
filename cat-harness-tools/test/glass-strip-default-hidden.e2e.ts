/**
 * THE STRIP STARTS HIDDEN — owner, 2026-10-01: *"have folio bottom strip
 * tiles default to hidden away when folio first opened"*.
 *
 * With no stored choice, the folio opens with its tiles slid away, and only
 * the tab is showing. The tab says how many tiles are behind it and toggles
 * both ways (`l4zi`). A reader's later choice is remembered in this browser.
 * When storage cannot be read, the default (hidden) applies.
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
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Strip</title>
<meta name="fa-tiles" content="${attr(TILES)}">
<meta name="fa-glass-strip" content="${attr(PINS)}">
<style>${CSS}</style></head><body><main><p>Page.</p></main>
<script>${JS}</script></body></html>`;

const dock = ".fa-glass-dock";
const tab = ".fa-glass-strip-toggle";
const tiles = ".fa-glass-tiles";

const load = async (page: Page) => {
  await page.goto("http://hidden.test/p.html");
  await page.click(".fa-glass-handle");
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
};

test.beforeEach(async ({ page }) => {
  await page.route("http://hidden.test/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/p.html") return route.fulfill({ contentType: "text/html", body: PAGE });
    return route.fulfill({ status: 404, body: "" });
  });
});

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test.describe(`at ${width}×${height}`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width, height }); });

    test("first open, nothing stored: the tiles are hidden and the tab is on screen, with the count", async ({ page }) => {
      await load(page);
      await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "hidden");
      await expect(page.locator(tiles)).toHaveAttribute("inert", "");
      const t = page.locator(tab);
      await expect(t).toBeVisible();
      await expect(t).toHaveAttribute("aria-expanded", "false");
      // 5 declared tiles + Todos, Filter, Settings.
      await expect(t).toContainText("Show tiles (8)");
      await expect.poll(async () => {
        const b = (await t.boundingBox())!;
        return b.y >= 0 && b.y + b.height <= height;
      }).toBe(true);
      // The tiles themselves are below the fold.
      await expect.poll(async () => (await page.locator(tiles).boundingBox())!.y).toBeGreaterThanOrEqual(height - 1);
    });

    test("the tab toggles both ways — by pointer and by keyboard", async ({ page }) => {
      await load(page);
      await page.click(tab);
      await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "shown");
      await expect(page.locator(tab)).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(tiles)).not.toHaveAttribute("inert", "");
      await expect(page.locator(`${tiles} [data-fa-glass-chrome="glass-todos"]`)).toBeVisible();
      await page.locator(tab).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "hidden");
      await page.keyboard.press("Space");
      await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "shown");
    });

    test("the reader's choice survives a reload, either way", async ({ page }) => {
      await load(page);
      await page.click(tab);
      await load(page);
      await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "shown");
      await page.click(tab);
      await load(page);
      await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "hidden");
    });
  });
}

test("storage that throws falls back to hidden, and the tab still works", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  await load(page);
  await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "hidden");
  await page.click(tab);
  await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "shown");
});
