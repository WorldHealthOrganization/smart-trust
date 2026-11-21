/**
 * `/beans/` is a THEMED page and its work plan can be searched — issue #2418.
 *
 * Owner, 2026-10-07: *"https://litlfred.github.io/folio-assistant/beans/ (and
 * other pages) have no top search/folio/local on the display. also on beans/
 * visualizer no way to search within beans.... (separate search like public
 * comments)"*.
 *
 * ## What is real here and what is not
 *
 * Real: the COMMITTED generated page (`docs/en/cat-harness/beans/index.html`, written by
 * `state-visualizer.ts`), the real `kg-render.js`, `work-plan.js` and
 * `work-plan.css`, and the real bean projection.
 *
 * Not real: Jekyll. The page body is served in a minimal stand-in for the
 * layout carrying what the theme contributes to it: `fa-beans-src` AND
 * `fa-todo-src` from `head_custom.html` — both, because the layout puts both
 * on every page, and the container must still ask for beans only. The band
 * itself is `docs-ui.js`'s and is covered by its own specs; the unit test
 * asserts the page is on the layout that loads it.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";

import { siteDirFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { declaredPagePath, firstPaintBlock, SCHEME_INK } from "./support/site-pages.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));
const read = (rel: string) => readFileSync(overlayPath(join(SITE, rel)), "utf8");

const PAGE = readFileSync(overlayPath(declaredPagePath(ROOT, "beans")), "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
const CSS = read("assets/css/work-plan.css");
const KG = read("assets/js/kg-render.js");
const WP = read("assets/js/work-plan.js");
const INDEX = read("assets/beans/index.json");
const ITEMS = (JSON.parse(INDEX) as { items: { id: string; title: string }[] }).items;

function shell(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Beans</title>
<meta name="fa-beans-src" content="/assets/beans/index.json">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}</style>
<!-- The theme's ground, from head_custom.html's own first-paint block: the
     scheme the board's inks resolve to and the ground under them are one, as
     on the site. An unstyled white page, or the dark ground under light inks,
     fails contrast for a reason no reader ever sees. -->
${firstPaintBlock(SITE)}${SCHEME_INK}</head><body>
<main class="main-content" id="main-content">
${PAGE}
</main>
<script>${KG}</script>
<script>${WP}</script></body></html>`;
}

let todoAsked = false;

async function open(p: Page, query = ""): Promise<void> {
  todoAsked = false;
  await p.route("http://site.test/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/beans/") return route.fulfill({ contentType: "text/html", body: shell() });
    if (url.pathname === "/assets/beans/index.json") {
      return route.fulfill({ contentType: "application/json", body: INDEX });
    }
    if (url.pathname === "/assets/todos/index.json") todoAsked = true;
    return route.fulfill({ status: 404, body: "not found" });
  });
  await p.goto("http://site.test/beans/" + (query ? "?q=" + encodeURIComponent(query) : ""));
  await expect(p.locator("#fa-workplan-q")).toBeVisible();
}

/** A word that is in some titles and not in all of them, taken from the data. */
function probe(): { term: string; count: number } {
  const lower = ITEMS.map((b) => b.title.toLowerCase());
  for (const word of lower.join(" ").split(/[^a-z]+/).filter((w) => w.length >= 6)) {
    const count = lower.filter((t) => t.includes(word)).length;
    if (count > 0 && count < ITEMS.length) return { term: word, count };
  }
  throw new Error("no discriminating word in the bean titles");
}

test.describe("/beans/ — themed, beans only, and searchable (#2418)", () => {
  test("the board mounts from beans only, never asking for the todo index", async ({ page: p }) => {
    expect(ITEMS.length).toBeGreaterThan(0);
    await open(p);
    await expect(p.locator(".fa-workplan-board")).toHaveCount(1);
    expect(todoAsked).toBe(false);
    await expect(p.locator(".fa-workplan-failed")).toHaveCount(0);
  });

  test("typing narrows to the beans that match, and lists them", async ({ page: p }) => {
    const { term } = probe();
    await open(p);
    await p.locator("#fa-workplan-q").fill(term);
    const results = p.locator(".fa-workplan-results");
    await expect(results).toHaveCount(1);
    // Matched as the generator matches: every bean whose id/title/status/type/
    // preview carries the term, so the expected count is computed the same way.
    const all = JSON.parse(INDEX) as {
      items: { id: string; title: string; status: string; type: string; preview?: string }[];
    };
    const expected = all.items.filter((b) =>
      [b.id, b.title, b.status, b.type, b.preview].join(" ").toLowerCase().includes(term),
    ).length;
    await expect(results.locator(".fa-workplan-chart-title")).toContainText(String(expected));
    await expect(results.locator(".fa-workplan-bean-row")).toHaveCount(Math.min(expected, 200));
    // Focus stays in the field across the rebuild, so typing can go on.
    await expect(p.locator("#fa-workplan-q")).toBeFocused();
    // And the search is in the URL, so it can be linked.
    await expect.poll(() => new URL(p.url()).searchParams.get("q")).toBe(term);
  });

  test("a linked ?q= opens already searched", async ({ page: p }) => {
    const { term } = probe();
    await open(p, term);
    await expect(p.locator("#fa-workplan-q")).toHaveValue(term);
    await expect(p.locator(".fa-workplan-results")).toHaveCount(1);
  });

  test("no match says so rather than showing an empty list", async ({ page: p }) => {
    await open(p, "zzzz-no-bean-has-this-zzzz");
    await expect(p.locator(".fa-workplan-results .fa-workplan-chart-title")).toContainText(/No (bean|work item) matches/);
    await expect(p.locator(".fa-workplan-results .fa-workplan-bean-row")).toHaveCount(0);
  });

  test("multi-term search narrows results using logical AND", async ({ page: p }) => {
    const candidate = ITEMS.find((b) => b.title.split(/\s+/).filter((w) => w.length >= 4).length >= 2);
    expect(candidate).toBeDefined();
    const words = candidate!.title.split(/\s+/).filter((w) => w.length >= 4);
    const query = `${words[0]} ${words[1]}`;
    await open(p, query);
    const results = p.locator(".fa-workplan-results");
    await expect(results).toHaveCount(1);
    const shortId = candidate!.id.replace(/^folio-assistant-/, "");
    await expect(results.locator(".fa-workplan-bean-row")).toContainText([shortId]);
  });

  test("the searched page has no WCAG A/AA violations", async ({ page: p }) => {
    const { term } = probe();
    await open(p, term);
    const { violations } = await new AxeBuilder({ page: p })
      .include(".fa-workplan")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map((v) => `${v.id} [${v.impact}] ×${v.nodes.length} — ${v.help}: ` +
        v.nodes.map((n) => `${n.target.join(" ")} (${n.failureSummary ?? ""})`).join("; ")),
    ).toEqual([]);
  });
});
