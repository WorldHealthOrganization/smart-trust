import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { Liquid } from "liquidjs";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * ENTER OPENS THE FULL RESULTS, FILTERED BY KNOWLEDGE GRAPH — owner,
 * 2026-11-17:
 *
 *   "When you search for something in the navigation bar and hit enter, it
 *   doesn't show you the full page of results but selects the first one even
 *   if you haven't moved the arrow down. [...] you should be able to open up
 *   a fuller panel and see the results and scroll down and navigate them. If
 *   there are filters, for example which knowledge graph a result came from,
 *   that should apply."
 *
 * Pinned on the real theme override rendered through Liquid and the real
 * `docs-ui.js`, as `search-scoped.e2e.ts` does:
 *
 *   - Enter with nothing highlighted opens the panel and does not navigate;
 *   - an arrow-highlighted result still opens on Enter, as before;
 *   - the panel lists every result, PANEL_PAGE at a time, and a filter per
 *     knowledge graph (layer) narrows them, the counts summing to the whole;
 *   - the arrow keys move through the panel's rows, Escape closes it and
 *     gives the field its focus back;
 *   - the dropdown's "Show all" control opens the same panel.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERAL that builds the page (bean `bmr0`).
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const UI = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const LUNR = readFileSync(createRequire(import.meta.url).resolve("lunr/lunr.min.js"), "utf8");

async function renderedJtd(): Promise<string> {
  const src = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/just-the-docs.js"))), "utf8").replace(/^---[\s\S]*?---\n/, "");
  const liquid = new Liquid({ dynamicPartials: false, templates: { "lunr/custom-index.js": "", "js/custom.js": "" } });
  liquid.registerFilter("relative_url", (p: string) => `/site/${String(p).replace(/^\//, "")}`);
  const site = { search_enabled: true, search: { tokenizer_separator: String.raw`/[\s\-/]+/` }, baseurl: "/site" };
  return liquid.parseAndRender(src, { site });
}

const SEARCH =
  '<div class="search" role="search"><div class="search-input-wrap">' +
  '<input type="text" id="search-input" class="search-input" autocomplete="off">' +
  '<label for="search-input" class="search-label"><span class="sr-only">Search</span></label>' +
  '</div><div id="search-results" class="search-results"></div></div>';

const entry = (title: string, relUrl: string) => ({ doc: title, title, content: `${title}: health records.`, url: `/site${relUrl}`, relUrl });

/**
 * A small site published as ONE scope, as `search-split` writes it under its
 * whole-site budget, with its layers named for the filter: 60 handbook
 * sections, 3 pages of a second layer (one of them translated), 2 site pages.
 */
function siteIndex(): Record<string, ReturnType<typeof entry>> {
  const out: Record<string, ReturnType<typeof entry>> = {};
  let n = 0;
  for (let i = 1; i <= 60; i++) out[String(n++)] = entry(`Handbook section ${i}`, `/en/handbook/#s${i}`);
  out[String(n++)] = entry("Library one", "/en/library/one.html");
  out[String(n++)] = entry("Library two", "/en/library/two.html");
  out[String(n++)] = entry("Library deux", "/fr/library/two.html");
  out[String(n++)] = entry("Home", "/");
  out[String(n++)] = entry("About", "/about/");
  return out;
}
const INDEX = siteIndex();
const TOTAL = Object.keys(INDEX).length;
const MANIFEST = {
  $schema: "folio-search-manifest/v1",
  source: { path: "assets/js/search-data.json", sha256: "x", entries: TOTAL, bytes: 1 },
  scopes: [{ id: "_platform", kind: "platform", path: "assets/js/search/_platform.json", entries: TOTAL, bytes: 1 }],
  layers: ["handbook", "library"],
};

async function load(page: Page, path = "/en/handbook/", manifest: Record<string, unknown> = MANIFEST) {
  const JTD = await renderedJtd();
  const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>p</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { margin: 0; } ${CSS}</style>
<script>${LUNR}<\/script><script>${JTD}<\/script></head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">site</a>
<button id="menu-button" class="site-button btn-reset" aria-label="Menu"></button></div><nav class="site-nav" id="site-nav"></nav></div>
<div class="main"><div class="main-header" id="main-header">${SEARCH}</div><div class="main-content-wrap">
<div class="main-content"><h1>Page</h1><p>Text.</p></div></div></div>
<script>${UI}<\/script></body></html>`;
  const serve: Record<string, unknown> = {
    "/assets/js/search/manifest.json": manifest,
    "/assets/js/search/_platform.json": INDEX,
    "/assets/js/search-data.json": INDEX,
  };
  await page.route("http://replica.test/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.startsWith("/site/") && p.endsWith(".json")) {
      const body = serve[p.slice("/site".length)];
      return body ? route.fulfill({ contentType: "application/json", body: JSON.stringify(body) }) : route.fulfill({ status: 404, body: "" });
    }
    if (p.startsWith("/site/")) return route.fulfill({ contentType: "text/html", body: PAGE });
    return route.fulfill({ status: 404, body: "" });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://replica.test/site${path}`);
  await page.waitForSelector(".fa-search-peek");
  expect(errors, "page errors while loading the replica").toEqual([]);
  return errors;
}

async function search(page: Page, q: string) {
  await page.click(".fa-search-peek");
  await page.fill("#search-input", "");
  await page.keyboard.type(q);
  await expect(page.locator("#search-results .search-result").first()).toBeVisible();
}

const panel = (page: Page) => page.locator(".fa-search-panel");
const rows = (page: Page) => page.locator(".fa-search-panel-list .search-result");
const facet = (page: Page, name: RegExp) => page.locator(".fa-search-panel-facet", { hasText: name });

test("Enter with nothing highlighted opens the full results, and does not navigate", async ({ page }) => {
  const errors = await load(page);
  await search(page, "health");
  const before = page.url();
  await page.keyboard.press("Enter");
  await expect(panel(page)).toBeVisible();
  expect(page.url()).toBe(before);
  await expect(page.locator(".fa-search-panel-title")).toHaveText(`${TOTAL} results for “health”`);
  // The first PANEL_PAGE (50) rows, then more on request.
  await expect(rows(page)).toHaveCount(50);
  const more = page.locator(".fa-search-panel-more");
  await expect(more).toHaveText(`Show ${TOTAL - 50} more (${TOTAL - 50} not shown)`);
  await more.click();
  await expect(rows(page)).toHaveCount(TOTAL);
  await expect(more).toBeHidden();
  // The list scrolls inside the panel, not the page.
  const overflow = await page.locator(".fa-search-panel-list").evaluate((n) => getComputedStyle(n).overflowY);
  expect(overflow).toBe("auto");
  expect(errors).toEqual([]);
});

test("a result highlighted with the arrow keys still opens on Enter", async ({ page }) => {
  await load(page);
  await search(page, "library");
  await page.keyboard.press("ArrowDown");
  const href = await page.locator("#search-results .search-result.active").getAttribute("href");
  await page.keyboard.press("Enter");
  await expect(panel(page)).toBeHidden();
  await page.waitForURL(`http://replica.test${href}`);
});

test("one filter per knowledge graph; each narrows the list, and the counts sum to the whole", async ({ page }) => {
  await load(page);
  await search(page, "health");
  await page.keyboard.press("Enter");
  await expect(facet(page, /^All \(65\)$/)).toHaveAttribute("aria-pressed", "true");
  await expect(facet(page, /^handbook \(60\)$/)).toBeVisible();
  // The translated page is the same layer's: /<locale>/<layer>/.
  await expect(facet(page, /^library \(3\)$/)).toBeVisible();
  await expect(facet(page, /^This site \(2\)$/)).toBeVisible();
  await facet(page, /^library/).click();
  await expect(facet(page, /^library/)).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(3);
  await expect(page.locator(".fa-search-panel-title")).toHaveText("3 results for “health” in library");
  for (const href of await rows(page).evaluateAll((as) => as.map((a) => a.getAttribute("href")))) expect(href).toMatch(/\/library\//);
  await facet(page, /^This site/).click();
  await expect(rows(page)).toHaveCount(2);
  await facet(page, /^All/).click();
  await expect(rows(page)).toHaveCount(50);
});

test("the arrow keys move through the panel's rows; Escape closes it and gives the field back", async ({ page }) => {
  await load(page);
  await search(page, "library");
  await page.keyboard.press("Enter");
  const list = rows(page);
  await expect(list).toHaveCount(3);
  await expect(list.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(list.nth(1)).toBeFocused();
  await expect(list.nth(1)).toHaveClass(/fa-active/);
  await page.keyboard.press("ArrowUp");
  await expect(list.nth(0)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(page.locator("#search-input")).toBeFocused();
  await expect(page.locator("#search-input")).toHaveValue("library");
  // A closed panel's rows are never what the dropdown's Enter opens.
  expect(await page.locator(".search-result.active").count()).toBe(0);
});

test("the dropdown's 'Show all' control opens the same panel", async ({ page }) => {
  await load(page);
  await search(page, "health");
  const all = page.locator(".search-show-all");
  await expect(all).toHaveText(`Show all ${TOTAL} results, by knowledge graph (Enter)`);
  await all.click();
  await expect(panel(page)).toBeVisible();
  await expect(rows(page)).toHaveCount(50);
});

// Owner, 2026-11-18, "KG slice only, linked": a site that publishes its
// knowledge-graph search names it in the manifest (`kgSearch`); the panel links
// it with the reader's query and loads nothing of it itself.
test("the panel links the site's knowledge-graph search with the query, and loads none of it", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (r) => { if (/slices|sqlite/.test(r.url())) asked.push(r.url()); });
  await load(page, "/en/handbook/", { ...MANIFEST, kgSearch: "slices/search.html?slice=kg" });
  await search(page, "health records");
  await page.keyboard.press("Enter");
  const kg = page.locator(".fa-search-panel-kg");
  await expect(kg).toHaveText("Search the knowledge graph for \u201chealth records\u201d \u2192");
  expect(await kg.getAttribute("href")).toBe("/site/slices/search.html?slice=kg&q=health%20records");
  expect(asked).toEqual([]);
});

test("no kgSearch in the manifest, no link", async ({ page }) => {
  await load(page);
  await search(page, "health");
  await page.keyboard.press("Enter");
  await expect(page.locator(".fa-search-panel")).toBeVisible();
  await expect(page.locator(".fa-search-panel-kg")).toHaveCount(0);
});
