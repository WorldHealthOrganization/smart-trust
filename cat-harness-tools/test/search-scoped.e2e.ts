import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { Liquid } from "liquidjs";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { buildIndex } from "../scripts/search-split.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * A PAGE SEARCHES ITS OWN SCOPE, AND CAN ALWAYS WIDEN TO THE WHOLE SITE —
 * bean `2tfy`, issue #1972 step A.
 *
 * `search-split.ts` cuts the site index into one index per scope and writes a
 * manifest naming them. The site's copy of the theme script reads that
 * manifest on first focus of the search box and loads only the scope the page
 * lives in — a smart-trust page 1.5 MB of a 13.7 MB index — and puts a
 * "Search everywhere" button under the results so that nothing findable
 * before the split becomes unfindable after it.
 *
 * Pinned here, on the real override rendered through Liquid and the real
 * `docs-ui.js`, with search opened through the launcher's own control (see
 * `search-lazy.e2e.ts` for why it must be the control):
 *
 *   - a layer page fetches the manifest and ITS scope, never the whole;
 *   - its results come from that scope only;
 *   - "Search everywhere" fetches the whole index once and re-runs the query;
 *   - with no manifest the page falls back to the whole index, as before;
 *   - a page outside every layer and locale gets the platform scope.
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const UI = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const LUNR = readFileSync(createRequire(import.meta.url).resolve("lunr/lunr.min.js"), "utf8");

async function renderedJtd(): Promise<string> {
  const src = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/just-the-docs.js"))), "utf8").replace(/^---[\s\S]*?---\n/, "");
  const liquid = new Liquid({ dynamicPartials: false, templates: { "lunr/custom-index.js": "", "js/custom.js": "" } });
  liquid.registerFilter("relative_url", (p: string) => `/folio-assistant/${String(p).replace(/^\//, "")}`);
  // As Jekyll renders the theme's default; see search-lazy.e2e.ts.
  const site = { search_enabled: true, search: { tokenizer_separator: String.raw`/[\s\-/]+/` }, baseurl: "/folio-assistant" };
  return liquid.parseAndRender(src, { site });
}

const SEARCH =
  '<div class="search" role="search"><div class="search-input-wrap">' +
  '<input type="text" id="search-input" class="search-input" autocomplete="off">' +
  '<label for="search-input" class="search-label"><span class="sr-only">Search folio-assistant</span></label>' +
  '</div><div id="search-results" class="search-results"></div></div>';

const entry = (title: string, content: string, relUrl: string) => ({ doc: title, title, content, url: `/folio-assistant${relUrl}`, relUrl });
const PLATFORM = { 0: entry("Gates", "Every gate CI runs.", "/gates/") };
const TRUST = { 1: entry("Trust lists", "Trust lists of the network.", "/smart-trust/lists.html") };
const REFERENCE = { 2: entry("Schema reference", "Every schema field.", "/reference/schemas.html") };
const WHOLE = { ...PLATFORM, ...TRUST, ...REFERENCE };
const MANIFEST = {
  $schema: "folio-search-manifest/v1",
  source: { path: "assets/js/search-data.json", sha256: "x", entries: 3, bytes: 13_700_000 },
  scopes: [
    { id: "_platform", kind: "platform", path: "assets/js/search/_platform.json", entries: 1, bytes: 1 },
    { id: "smart-trust", kind: "instance", path: "assets/js/search/smart-trust.json", entries: 1, bytes: 1 },
    { id: "section-reference", kind: "section", path: "assets/js/search/section-reference.json", entries: 1, bytes: 1 },
  ],
  remote: [{ id: "who-iris", kind: "id-lookup", href: "id-lookup/?index=who-iris/", entries: 10 }],
};

interface Load { fetched: (suffix: string) => number }

async function load(
  page: Page,
  path: string,
  withManifest = true,
  extra: { manifest?: unknown; serve?: Record<string, unknown> } = {},
): Promise<Load> {
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
  const counts = new Map<string, number>();
  const serve: Record<string, unknown> = {
    "/assets/js/search-data.json": WHOLE,
    "/assets/js/search/_platform.json": PLATFORM,
    "/assets/js/search/smart-trust.json": TRUST,
    "/assets/js/search/section-reference.json": REFERENCE,
  };
  if (withManifest) serve["/assets/js/search/manifest.json"] = extra.manifest ?? MANIFEST;
  Object.assign(serve, extra.serve ?? {});
  await page.route("http://replica.test/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === `/folio-assistant${path}`) return route.fulfill({ contentType: "text/html", body: PAGE });
    for (const [suffix, body] of Object.entries(serve)) {
      if (p === `/folio-assistant${suffix}`) {
        counts.set(suffix, (counts.get(suffix) ?? 0) + 1);
        return route.fulfill({ contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
      }
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://replica.test/folio-assistant${path}`);
  await page.waitForSelector(".fa-search-peek");
  expect(errors, "page errors while loading the replica").toEqual([]);
  return { fetched: (suffix) => counts.get(suffix) ?? 0 };
}

const results = (page: Page) => page.locator("#search-results .search-result");

async function search(page: Page, q: string) {
  await page.click(".fa-search-peek");
  await page.fill("#search-input", "");
  await page.keyboard.type(q);
}

test("an instance page searches its own scope, never the whole index", async ({ page }) => {
  const { fetched } = await load(page, "/smart-trust/page.html");
  await search(page, "trust");
  await expect(results(page)).not.toHaveCount(0);
  expect(fetched("/assets/js/search/manifest.json")).toBe(1);
  expect(fetched("/assets/js/search/smart-trust.json")).toBe(1);
  expect(fetched("/assets/js/search-data.json")).toBe(0);
  expect(fetched("/assets/js/search/_platform.json")).toBe(0);
});

test("'Search everywhere' loads the whole index once and finds what the scope could not", async ({ page }) => {
  const { fetched } = await load(page, "/smart-trust/page.html");
  await search(page, "gate");
  const everywhere = page.locator(".search-everywhere");
  await expect(everywhere).toHaveCount(1);
  await expect(results(page)).toHaveCount(0); // a platform page's term is not in smart-trust's scope
  await everywhere.click();
  await expect(results(page)).not.toHaveCount(0);
  expect(fetched("/assets/js/search-data.json")).toBe(1);
  await expect(everywhere).toHaveCount(0); // widened once; the button has done its job
});

test("with no manifest the page falls back to the whole index, as the theme always did", async ({ page }) => {
  const { fetched } = await load(page, "/smart-trust/page.html", false);
  await search(page, "gate");
  await expect(results(page)).not.toHaveCount(0);
  expect(fetched("/assets/js/search-data.json")).toBe(1);
  await expect(page.locator(".search-everywhere")).toHaveCount(0);
});

test("a page outside every instance and locale searches the platform scope", async ({ page }) => {
  const { fetched } = await load(page, "/guides/page.html");
  await search(page, "gate");
  await expect(results(page)).not.toHaveCount(0);
  expect(fetched("/assets/js/search/_platform.json")).toBe(1);
  expect(fetched("/assets/js/search/smart-trust.json")).toBe(0);
  expect(fetched("/assets/js/search-data.json")).toBe(0);
});

// Bean `mm2n`: a platform section over the split's budget has a scope of its
// own, and both a page below it and its index page load it.
for (const path of ["/reference/schemas.html", "/reference/"]) {
  test(`a page in a platform section with its own scope (${path}) loads that section`, async ({ page }) => {
    const { fetched } = await load(page, path);
    await search(page, "schema");
    await expect(results(page)).not.toHaveCount(0);
    expect(fetched("/assets/js/search/section-reference.json")).toBe(1);
    expect(fetched("/assets/js/search/_platform.json")).toBe(0);
    expect(fetched("/assets/js/search-data.json")).toBe(0);
  });
}

// Bean `1br0`: each identifier lookup the manifest names is one link under the
// results — a page of its own, never loaded here — and it carries the query.
test("the search box links to each identifier lookup, carrying the reader's query", async ({ page }) => {
  const { fetched } = await load(page, "/smart-trust/page.html");
  await search(page, "10665/123");
  const link = page.locator(".search-remote-link");
  await expect(link).toHaveCount(1);
  await expect(link).toContainText("who-iris");
  expect(await link.getAttribute("href")).toBe("/folio-assistant/id-lookup/?index=who-iris/&q=10665%2F123");
  // A link, not a load: nothing under id-lookup/ is fetched by the search box.
  expect(fetched("/id-lookup/who-iris/manifest.json")).toBe(0);
});

test("no remote in the manifest, no link", async ({ page }) => {
  await load(page, "/smart-trust/page.html", false);
  await search(page, "gate");
  await expect(results(page)).not.toHaveCount(0); // the search has run, so the box is built
  await expect(page.locator(".search-remote-link")).toHaveCount(0);
});

// Bean `lrzn`: a scope the manifest publishes with a prebuilt index is LOADED.
// The index here is built from a version of the entry that also says "zebra",
// which the served entries do not — so "zebra" is found only if the page used
// the prebuilt index rather than building its own from the entries.
const IDX_PATH = "/assets/js/search/smart-trust.idx.json";
const PREBUILT_MANIFEST = {
  ...MANIFEST,
  scopes: MANIFEST.scopes.map((s) => (s.id === "smart-trust" ? { ...s, index: { path: IDX_PATH.slice(1), bytes: 1 } } : s)),
};
const ZEBRA = buildIndex({ 1: { ...TRUST[1], content: `${TRUST[1].content} zebra` } });

test("a prebuilt scope index is loaded, not built — and it is the scope's only index fetch", async ({ page }) => {
  const { fetched } = await load(page, "/smart-trust/page.html", true, { manifest: PREBUILT_MANIFEST, serve: { [IDX_PATH]: ZEBRA } });
  await search(page, "zebra");
  await expect(results(page)).toHaveCount(1);
  expect(fetched(IDX_PATH)).toBe(1);
  expect(fetched("/assets/js/search/smart-trust.json")).toBe(1); // results are rendered from the entries
  expect(fetched("/assets/js/search-data.json")).toBe(0);
  await expect(page.locator(".search-everywhere")).toHaveCount(1);
  // The load path sets the site's separator too: it splits the reader's query
  // on "/", which lunr's own default does not, so "zebra/lists" is two terms.
  await page.fill("#search-input", "");
  await page.keyboard.type("zebra/lists");
  await expect(results(page)).toHaveCount(1);
});

test("a prebuilt index that will not load falls back to building from the entries", async ({ page }) => {
  await load(page, "/smart-trust/page.html", true, { manifest: PREBUILT_MANIFEST, serve: { [IDX_PATH]: "{\"version\":\"2.3.9\"}" } });
  await search(page, "trust");
  await expect(results(page)).not.toHaveCount(0);
  await page.fill("#search-input", "");
  await page.keyboard.type("zebra");
  await expect(page.locator("#search-results")).toContainText("No results");
});
