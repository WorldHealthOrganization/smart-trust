/**
 * The tile listing is the artefact; the board is an overlay over it.
 *
 * Owner, 2026-09-21: *"this dymanic moving state is overlayed, its an 'extra'.
 * on stndard folio just simple tile based listing"*, and from the original
 * ask, *"but ALWAYS collapsable to linearly rendablee/just the docs."* Bean
 * `folio-assistant-0jtj`.
 *
 * ## What was actually wrong
 *
 * Measured on `main`, 2026-09-21: every note on an ordinary page was built by
 * `docs-ui.js` from a `fetch` of `assets/todos/index.json`. With JavaScript
 * off a reader got **nothing** — no note, no count, no hint that notes exist.
 * That is not a degraded board, it is an absent artefact, and it is why the
 * floor had to be built rather than merely asserted.
 *
 * ## Why these run against `renderTodoListing` rather than a fixture
 *
 * The bean asks for the assertion to be against the SERVED HTML rather than a
 * DOM the board built, and a hand-written fixture is neither: it can agree
 * with the test while the generator disagrees with both. So the page these
 * serve is the output of the same function `gen-docs-pages.ts` writes into
 * `_includes/generated/todo-listing.html`.
 *
 * **The limit, stated rather than hidden**: Jekyll still wraps that fragment
 * in a layout and resolves one Liquid `relative_url` call inside it. These
 * tests prove the listing is in the served bytes and readable without
 * JavaScript; they do not prove Jekyll's `baseurl` resolution, which is
 * `site-links.test.ts`'s job.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { groupTodosByPage, renderTodoListing } from "../../scripts/todo-listing.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const ITEMS = [
  {
    id: "zeta-note",
    summary: "Zeta comes first in the file",
    comment: "Body of zeta.",
    status: "open",
    priority: "high",
    origin: "agent",
    createdAt: "2026-09-19",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
    relations: [],
    viewHref: "https://example.invalid/zeta",
  },
  {
    id: "alpha-note",
    summary: "Alpha comes second in the file",
    comment: "Body of alpha.",
    status: "blocked",
    priority: "low",
    origin: "human",
    createdAt: "2026-09-20",
    target: { page: "beans-and-todos", node: "human-todos", label: "sec:beans-and-todos-human-todos" },
    targetLabel: "sec:beans-and-todos-human-todos",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
    relations: [],
  },
];

/**
 * The listing exactly as the generator writes it, minus the one Liquid call.
 *
 * `pageHref` is the ONLY thing the two callers differ on, and it differs
 * because `relative_url` is Jekyll's filter and means nothing to a static
 * server. Everything a test could usefully catch — the field set, the order,
 * the escaping, the elements — comes from the shared function.
 */
const LISTING = renderTodoListing(ITEMS, {
  pageHref: (page, node) => `/${page}.html#${node}`,
});

/** A page with the listing in its BYTES and the script tag after it. */
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}</style></head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">Site</a></div><nav class="site-nav"></nav></div>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <h1>Harness</h1>
  <p>Body text.</p>
  ${LISTING}
</div></div>
<script>${JS}</script></body></html>`;

/**
 * A PAGE'S OWN LISTING — bean `lwjc`. What `footer_custom.html` includes on
 * `beans-and-todos`: the fragment `gen-docs-pages.ts` writes for that page,
 * from the same grouping and the same renderer. A page with no note attached
 * includes nothing at all, which `BARE_PAGE` stands for.
 */
const OWN_LISTING = renderTodoListing(groupTodosByPage(ITEMS).pages.get("beans-and-todos") ?? [], {
  pageHref: (page, node) => `/${page}.html#${node}`,
  scope: "page",
});
const pageWith = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${CSS}</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <h1>A page</h1>
  <p>Body text.</p>
  ${body}
</div></div></body></html>`;
const URL_OWN = "http://floor.test/beans-and-todos.html";
const URL_BARE = "http://floor.test/bare.html";

const URL_PAGE = "http://floor.test/page.html";
const URL_TODOS = "http://floor.test/todos/index.html";

/**
 * todos/index.html — the dedicated notes dashboard — serves the same listing
 * in its bytes via footer_custom.html on the default layout (bean folio-assistant-dm4j).
 */
const TODOS_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}</style></head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">Site</a></div><nav class="site-nav"></nav></div>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <h1 id="todos">Todos</h1>
  <p class="fs-5 fw-300">A PERSON's outstanding items — the human half of memory, as against <code>beans/</code>, which is the agent's workflow management.</p>
  <details class="fa-sticky-panel" lang="en" dir="ltr" open>
    <summary class="fa-sticky-panel__handle">
      <span class="fa-sticky-panel__label">Stickies</span>
    </summary>
    <div class="fa-sticky-panel__body">
      <div class="fa-sticky-board fa-landing-board" data-fa-home-panel="landing"></div>
    </div>
  </details>
  ${LISTING}
</div></div>
<script>${JS}</script></body></html>`;

test.beforeEach(async ({ page }) => {
  await page.route("http://floor.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/page.html")) {
      return route.fulfill({ contentType: "text/html", body: PAGE });
    }
    if (url.endsWith("/todos/index.html") || url.endsWith("/todos/")) {
      return route.fulfill({ contentType: "text/html", body: TODOS_PAGE });
    }
    if (url.endsWith("/beans-and-todos.html")) {
      return route.fulfill({ contentType: "text/html", body: pageWith(OWN_LISTING) });
    }
    if (url.endsWith("/bare.html")) {
      return route.fulfill({ contentType: "text/html", body: pageWith("") });
    }
    if (url.endsWith("/assets/todos/index.json")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ $schema: "folio-todo-index/v1", items: ITEMS }),
      });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
});

test.describe("with JavaScript disabled", () => {
  // The whole point. `docs-ui.js` is in the page and never runs, so anything
  // visible here came out of the server's bytes.
  test.use({ javaScriptEnabled: false });

  test("every note renders, with its summary and its body", async ({ page }) => {
    await page.goto(URL_PAGE);
    const items = page.locator("#fa-todo-listing .fa-todo-listing-item");
    await expect(items).toHaveCount(2);
    await expect(page.getByText("Zeta comes first in the file")).toBeVisible();
    await expect(page.getByText("Alpha comes second in the file")).toBeVisible();
    await expect(page.getByText("Body of zeta.")).toBeVisible();
  });

  test("in DOCUMENT ORDER — the file's order, not the board's stacking", async ({ page }) => {
    await page.goto(URL_PAGE);
    const ids = await page
      .locator("#fa-todo-listing .fa-todo-listing-item")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.faTodo));
    expect(ids).toEqual(["zeta-note", "alpha-note"]);
  });

  test("the board did not run, and nothing of it is on the page", async ({ page }) => {
    // Guards against the assertion above passing because the board happened
    // to build the same list: if `docs-ui.js` had run, this would be non-zero.
    await page.goto(URL_PAGE);
    await expect(page.locator(".fa-sticky-board")).toHaveCount(0);
    await expect(page.locator(".fa-todo-listing-details")).toHaveCount(0);
  });

  test("a note's attachment is named, and its status is readable", async ({ page }) => {
    await page.goto(URL_PAGE);
    await expect(page.getByText("beans-and-todos › human-todos")).toBeVisible();
    await expect(page.locator("#fa-todo-listing").getByText("blocked")).toBeVisible();
  });

  test("the count on the section is the number of notes in it", async ({ page }) => {
    // The same cardinality rule the badge follows: a count that is not the
    // panel's own cardinality is a number somebody will act on.
    await page.goto(URL_PAGE);
    const declared = await page.locator("#fa-todo-listing").getAttribute("data-fa-todo-count");
    const actual = await page.locator("#fa-todo-listing .fa-todo-listing-item").count();
    expect(Number(declared)).toBe(actual);
  });

  test("a page lists ONLY its own notes, and its count is its own (bean lwjc)", async ({ page }) => {
    await page.goto(URL_OWN);
    const listing = page.locator("#fa-todo-listing");
    await expect(listing).toHaveAttribute("data-fa-todo-scope", "page");
    const ids = await page
      .locator("#fa-todo-listing .fa-todo-listing-item")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.faTodo));
    // `alpha-note` is attached here; `zeta-note` is attached to no page.
    expect(ids).toEqual(["alpha-note"]);
    expect(await listing.getAttribute("data-fa-todo-count")).toBe("1");
    await expect(page.getByText("Zeta comes first in the file")).toHaveCount(0);
  });

  test("a page with no note attached carries NO listing — not an empty one (bean lwjc)", async ({ page }) => {
    await page.goto(URL_BARE);
    await expect(page.locator("#fa-todo-listing")).toHaveCount(0);
    await expect(page.locator(".fa-todo-listing-none")).toHaveCount(0);
  });

  test("todos/index.html serves the notes listing in its own bytes without JavaScript (folio-assistant-dm4j)", async ({ page }) => {
    await page.goto(URL_TODOS);
    const listing = page.locator("#fa-todo-listing");
    await expect(listing).toBeVisible();
    const items = page.locator("#fa-todo-listing .fa-todo-listing-item");
    await expect(items).toHaveCount(2);
    await expect(page.getByText("Zeta comes first in the file")).toBeVisible();
    await expect(page.getByText("Alpha comes second in the file")).toBeVisible();
    await expect(page.getByText("Body of zeta.")).toBeVisible();
  });
});

test.describe("with JavaScript enabled", () => {
  test("the board mounts OVER the listing — it is collapsed, never removed", async ({ page }) => {
    await page.goto(URL_PAGE);
    await page.waitForFunction(() => Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard));
    // Still in the document, still carrying both notes. Bean `l4zi`: an
    // action whose inverse is not reachable is not a toggle, and a listing
    // the board deleted would have no way back with the board open.
    await expect(page.locator("#fa-todo-listing .fa-todo-listing-item")).toHaveCount(2);
    await expect(page.locator(".fa-todo-listing-details #fa-todo-listing")).toHaveCount(1);
  });

  test("the way back is one disclosure, reachable from the keyboard", async ({ page }) => {
    await page.goto(URL_PAGE);
    await page.waitForFunction(() => Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard));
    const details = page.locator(".fa-todo-listing-details");
    await expect(details).toHaveJSProperty("open", false);
    await page.locator(".fa-todo-listing-toggle").focus();
    await page.keyboard.press("Enter");
    await expect(details).toHaveJSProperty("open", true);
    // Scoped to the listing: the board carries the same prose, so an
    // unscoped match resolves to two elements and would pass on the board's
    // copy — the exact substitution this spec exists to rule out.
    await expect(page.locator("#fa-todo-listing").getByText("Body of zeta.")).toBeVisible();
  });

  test("the disclosure's label carries the same count as the listing", async ({ page }) => {
    await page.goto(URL_PAGE);
    await page.waitForFunction(() => Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard));
    await expect(page.locator(".fa-todo-listing-toggle")).toHaveText("Linear listing (2)");
  });

  test("the listing is not duplicated — one copy, moved rather than cloned", async ({ page }) => {
    // Two copies in one document is two answers to "how many are open", and
    // a screen reader reads both.
    await page.goto(URL_PAGE);
    await page.waitForFunction(() => Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard));
    await expect(page.locator("#fa-todo-listing")).toHaveCount(1);
    await expect(page.locator('[data-fa-todo="zeta-note"]')).toHaveCount(1);
  });

  test("on todos/index.html the board mounts OVER the listing — it is collapsed, never removed", async ({ page }) => {
    await page.goto(URL_TODOS);
    await page.waitForFunction(() => Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard));
    await expect(page.locator("#fa-todo-listing .fa-todo-listing-item")).toHaveCount(2);
    await expect(page.locator(".fa-todo-listing-details #fa-todo-listing")).toHaveCount(1);
  });
});
