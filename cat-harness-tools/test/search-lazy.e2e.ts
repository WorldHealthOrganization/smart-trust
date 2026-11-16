import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { Liquid } from "liquidjs";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * THE SEARCH INDEX IS BUILT WHEN A READER REACHES FOR SEARCH, NEVER ON LOAD —
 * bean `2tfy`.
 *
 * just-the-docs 0.12.0 calls `initSearch()` on every page load. Measured
 * 2026-10-03 on a local build: fetching `search-data.json` (12,040 entries,
 * 13.7 MB) and building the lunr index cost ~4.7 s of main-thread script and
 * ~315 MB of heap per page view, before anybody searched. The site's copy of
 * `assets/js/just-the-docs.js` defers it to the first focus of the search box.
 *
 * What this pins, on the real override rendered through Liquid and the real
 * `docs-ui.js` that moves the theme's search into its launcher:
 *
 *   - loading a page requests NO index;
 *   - opening search through the launcher's own Search control, and typing at
 *     once — before the index can be ready — still yields results, without
 *     re-typing, because the override replays the theme's focus handler once
 *     the index is built;
 *   - the index is requested exactly once, however often search is reopened.
 *
 * Results are asserted as RENDERED, not as visible: the replica carries no
 * theme stylesheet, and whether they show is the theme's CSS, not this change.
 *
 * Opened through the control a reader presses, not `input.focus()`: the
 * search holder is `display: none` until opened, and focusing a hidden input
 * does nothing — which is what a probe that skips the control would measure.
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const UI = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const LUNR = readFileSync(createRequire(import.meta.url).resolve("lunr/lunr.min.js"), "utf8");

/**
 * The theme's own markup that its `initNav` and `getTheme` read — `#menu-button`,
 * `#site-nav`, `#main-header` and a stylesheet link first in the head — so the
 * theme script runs as it does on the site rather than dying before the code
 * under test. (A page without them passed this spec for the wrong reason: the
 * script never ran.)
 */
/** The override, rendered as Jekyll would: front matter off, the site's search settings in. */
async function renderedJtd(): Promise<string> {
  const src = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/just-the-docs.js"))), "utf8").replace(/^---[\s\S]*?---\n/, "");
  // The two includes are the theme's empty customisation hooks; Jekyll's
  // unquoted include names need `dynamicPartials: false`.
  const liquid = new Liquid({
    dynamicPartials: false,
    templates: { "lunr/custom-index.js": "", "js/custom.js": "" },
  });
  liquid.registerFilter("relative_url", (p: string) => `/folio-assistant/${String(p).replace(/^\//, "")}`);
  liquid.registerFilter("absolute_url", (p: string) => `/folio-assistant/${String(p).replace(/^\//, "")}`);
  // The tokenizer separator is passed as Jekyll renders the theme's default.
  // liquidjs would otherwise unescape the default's string literal
  // ("/[\s\-/]+/" loses its backslashes) where Ruby Liquid keeps them, and
  // the theme's script would die on an invalid regex before fetching anything.
  const site = { search_enabled: true, search: { tokenizer_separator: String.raw`/[\s\-/]+/` }, baseurl: "/folio-assistant" };
  return liquid.parseAndRender(src, { site });
}

const SEARCH =
  '<div class="search" role="search"><div class="search-input-wrap">' +
  '<input type="text" id="search-input" class="search-input" autocomplete="off">' +
  '<label for="search-input" class="search-label"><span class="sr-only">Search folio-assistant</span></label>' +
  '</div><div id="search-results" class="search-results"></div></div>';

const INDEX = JSON.stringify({
  0: { doc: "Beans", title: "Beans", content: "A bean is a work-plan item.", url: "/folio-assistant/beans/", relUrl: "/beans/" },
  1: { doc: "Gates", title: "Gates", content: "Every gate CI runs.", url: "/folio-assistant/gates/", relUrl: "/gates/" },
  2: { doc: "Library", title: "Library", content: "Uploads and catalogue records.", url: "/folio-assistant/library/", relUrl: "/library/" },
});

/**
 * `release` lets the index response through. Held until the reader has
 * finished typing, so the replay is what produces the results — with a three-
 * entry index served at once, later keystrokes would search by themselves and
 * a missing replay would go unseen (measured: it did).
 */
async function load(page: Page): Promise<{ requests: () => number; release: () => void }> {
  let release!: () => void;
  const released = new Promise<void>((go) => { release = go; });
  const JTD = await renderedJtd();
  const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>p</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/folio-assistant/assets/css/just-the-docs-default.css">
<style>body { margin: 0; } ${CSS}</style>
<script>${LUNR}<\/script><script>${JTD}<\/script></head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">folio-assistant</a>
<button id="menu-button" class="site-button btn-reset" aria-label="Menu"></button></div><nav class="site-nav" id="site-nav"></nav></div>
<div class="main"><div class="main-header" id="main-header">${SEARCH}</div><div class="main-content-wrap">
<div class="main-content"><h1>Page</h1><p>Text.</p></div></div></div>
<script>${UI}<\/script></body></html>`;
  let n = 0;
  await page.route("http://replica.test/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith("/page.html")) return route.fulfill({ contentType: "text/html", body: PAGE });
    if (u.pathname.endsWith("/assets/js/search-data.json")) {
      n++;
      return released.then(() => route.fulfill({ contentType: "application/json", body: INDEX }));
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://replica.test/folio-assistant/page.html");
  await page.waitForSelector(".fa-search-peek");
  // The theme script must have RUN: a page error here means the replica, not
  // the override, is what got measured.
  expect(errors, "page errors while loading the replica").toEqual([]);
  return { requests: () => n, release };
}

test("loading a page requests no search index", async ({ page }) => {
  const { requests } = await load(page);
  await page.waitForLoadState("networkidle");
  expect(requests()).toBe(0);
});

test("opening search and typing at once yields results, and the index is fetched once", async ({ page }) => {
  const { requests, release } = await load(page);
  await page.click(".fa-search-peek");
  await expect(page.locator("#search-input")).toBeFocused();
  await page.keyboard.type("bean"); // every keystroke lands before the index exists
  await expect.poll(requests).toBe(1);
  release();
  await expect(page.locator("#search-results .search-result")).not.toHaveCount(0);
  expect(requests()).toBe(1);

  // Closing and reopening reuses the built index.
  await page.keyboard.press("Escape");
  await page.click(".fa-search-peek");
  await page.fill("#search-input", ""); // Escape closes the panel; it does not clear the field
  await page.keyboard.type("gate");
  await expect(page.locator("#search-results .search-result")).not.toHaveCount(0);
  expect(requests()).toBe(1);
});
