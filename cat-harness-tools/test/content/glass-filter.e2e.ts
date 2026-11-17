/**
 * THE GLASS'S FILTER — bean `7m6g`, issue #1075.
 *
 * Owner, 2026-09-21: *"visualizer filter by document, library, graph, and one
 * each thing in folio (working space)"*. Owner, 2026-09-23, choosing its
 * shape: **"Kind + From + items"** — a Kind select, a From select, and a
 * checkbox per item; what a thing IS kept apart from where it CAME FROM.
 *
 * The glass holds all three kinds here: two books from two libraries, a
 * pinned landing sticky — a folio asset like the rest since #1925 — and a
 * todo pulled out of the Todos panel.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const row = (key: string, title: string) =>
  `<tr data-fa-library-item="${key}" data-fa-library-title="${title}"><td data-fa-pullout-host>${key}</td></tr>`;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Home page</title>
<style>${CSS}</style></head><body>
<details class="fa-sticky-panel" open><summary>Stickies</summary><div class="fa-sticky-panel__body">
<div class="fa-sticky-board fa-landing-board" data-fa-home-panel="landing">
<div class="fa-sticky-cell" data-fa-home-slot="alpha"><article class="fa-sticky fa-landing-sticky">
<h2 id="fa-sticky-alpha-summary" class="fa-sr-only">Alpha note</h2>
<div class="fa-landing-sticky__text"><div class="fa-landing-sticky__body"><p>Alpha.</p></div></div></article></div>
</div></div></details>
<table><tbody>${row("who-iris/handbook", "A handbook")}${row("smart-base/guide", "A guide")}</tbody></table>
<script>${JS}</script></body></html>`;

const TODOS = { items: [{ id: "t-one", summary: "First thing to do" }] };

test.beforeEach(async ({ page }) => {
  // The strip starts HIDDEN on a first open (owner, 2026-10-01). These specs
  // are about what is ON the strip, so they arrive as a reader who has shown
  // it; `glass-strip-default-hidden.e2e.ts` holds the default itself.
  await page.addInitScript(() => {
    try { if (localStorage.getItem("fa-glass-strip-hidden") === null) localStorage.setItem("fa-glass-strip-hidden", "0"); } catch { /* no storage */ }
  });
  await page.route("http://filter.test/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/p.html") return route.fulfill({ contentType: "text/html", body: PAGE });
    if (path === "/assets/todos/index.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(TODOS) });
    }
    // Filter is not among this site's declared pins (bean `ob3m` finding 10),
    // so this page declares a strip that holds it — the specs are about the
    // filter, not about where its tile lives.
    if (path === "/assets/harness/glass-strip.json") {
      return route.fulfill({ contentType: "application/json",
        body: JSON.stringify(["glass-todos", "glass-filter", "glass-settings"]) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto("http://filter.test/p.html");
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  await page.waitForSelector('.fa-glass-tiles [data-fa-strip-item="glass-filter"]', { state: "attached" });
  // Fill the glass: two books, one sticky, one todo.
  await page.locator('[data-fa-library-item="who-iris/handbook"] .fa-pullout').click();
  await page.locator('[data-fa-library-item="smart-base/guide"] .fa-pullout').click();
  await page.locator('[data-fa-home-slot="alpha"] .fa-sticky-act-pin').click();
  await page.click(".fa-glass-handle");
  await page.click('[data-fa-glass-chrome="glass-todos"]');
  await page.locator('[data-fa-library-item="todo/t-one"] .fa-pullout').click();
  await page.click('[data-fa-glass-chrome="glass-filter"]');
});

const visible = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll(
    ".fa-sticky-layer .fa-glass-asset",
  )).filter((n) => getComputedStyle(n).display !== "none").map((n) =>
    n.getAttribute("data-fa-asset")).sort());

test("with no filter, all four are on the glass", async ({ page }) => {
  expect(await visible(page)).toEqual(["landing/alpha", "smart-base/guide", "todo/t-one", "who-iris/handbook"]);
});

test("Kind offers only what the glass holds, and 'Books' shows the two books", async ({ page }) => {
  const opts = await page.locator("#fa-glass-filter-kind option").allTextContents();
  expect(opts).toEqual(["Any", "Books", "Stickies", "Todos"]);
  await page.selectOption("#fa-glass-filter-kind", "book");
  expect(await visible(page)).toEqual(["smart-base/guide", "who-iris/handbook"]);
});

test("From names where each came from — one library, not the other", async ({ page }) => {
  const opts = await page.locator("#fa-glass-filter-from option").allTextContents();
  expect(opts).toEqual(["Any", "Home page", "Todo board", "smart-base library", "who-iris library"]);
  await page.selectOption("#fa-glass-filter-from", "who-iris library");
  expect(await visible(page)).toEqual(["who-iris/handbook"]);
});

test("the two axes are ANDed — Kind and From together", async ({ page }) => {
  await page.selectOption("#fa-glass-filter-kind", "todo");
  await page.selectOption("#fa-glass-filter-from", "Todo board");
  expect(await visible(page)).toEqual(["todo/t-one"]);
});

test("one checkbox per item hides just that item", async ({ page }) => {
  await expect(page.locator("[data-fa-filter-item]")).toHaveCount(4);
  await page.uncheck('[data-fa-filter-item="landing/alpha"]');
  expect(await visible(page)).toEqual(["smart-base/guide", "todo/t-one", "who-iris/handbook"]);
  await expect(page.locator(".fa-glass-filter-status")).toHaveText("Showing 3 of 4.");
});

test("a filter that hides everything SAYS so — not the empty-glass message", async ({ page }) => {
  await page.selectOption("#fa-glass-filter-kind", "book");
  await page.selectOption("#fa-glass-filter-from", "Home page");
  expect(await visible(page)).toEqual([]);
  await expect(page.locator(".fa-glass-filtered-note")).toContainText("Nothing on your glass matches this filter");
  await expect(page.locator(".fa-glass-empty")).toBeHidden();
});

test("Clear shows everything again in one press", async ({ page }) => {
  await page.selectOption("#fa-glass-filter-kind", "book");
  await page.uncheck('[data-fa-filter-item="who-iris/handbook"]');
  await page.click(".fa-glass-filter-clear");
  expect(await visible(page)).toHaveLength(4);
  await expect(page.locator(".fa-glass-filtered-note")).toHaveCount(0);
});

test("it commits nothing — a reload shows everything, and the folio is untouched", async ({ page }) => {
  await page.selectOption("#fa-glass-filter-kind", "book");
  const before = await page.evaluate(() => localStorage.getItem("fa-folio-assets"));
  await page.reload();
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  await page.click(".fa-glass-handle");
  expect(await visible(page)).toHaveLength(4);
  expect(await page.evaluate(() => localStorage.getItem("fa-folio-assets"))).toBe(before);
});
