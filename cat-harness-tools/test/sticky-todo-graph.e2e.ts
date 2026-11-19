/**
 * The board reads `todos.jsonld` — follow-up 2 of #1941.
 *
 * The index (`assets/todos/index.json`) says what a sticky LOOKS like; the
 * graph (`todos.jsonld`) says what it is CONNECTED to: a node
 * (`schema:about`), people (`schema:agent`) and beans (`dcterms:isPartOf`).
 * The board filters and groups by those edges, and every sticky links to its
 * own `todos/<id>/` page.
 *
 * Real: the committed `/todos/` page rendered through the real
 * `_includes/landing.html`, the real `docs-ui.js` / `docs-ui.css`, the real
 * index and the real graph. Varied: one test rewrites the graph's assignees
 * and beans so a person and a bean control have something to choose between,
 * because the committed corpus has one person and would not show them.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Liquid } from "liquidjs";
import { AxeBuilder } from "@axe-core/playwright";

import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { declaredPagePath } from "./support/site-pages.ts";
import { overlayPath, writePathOf } from "../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const TODOS = readFileSync(overlayPath(join(SITE, "assets/todos/index.json")), "utf8");
const GRAPH_TEXT = readFileSync(overlayPath(join(SITE, "todos.jsonld")), "utf8");

interface GraphTodo {
  identifier: string;
  status: string;
  target?: { label?: string };
  assignee?: { "@id": string; identifier?: string }[];
  bean?: { "@id": string; identifier?: string }[];
}
const GRAPH = JSON.parse(GRAPH_TEXT) as { "@graph": GraphTodo[] };
const IDS = GRAPH["@graph"].map((t) => t.identifier);
const NODES = [...new Set(GRAPH["@graph"].map((t) => t.target?.label).filter(Boolean))] as string[];

const engine = new Liquid({
  // The output root first: includes generated at publish (`generated/todo-listing.html`)
  // are written there, not in the mount (bean cat-tools-sm8r).
  root: [...new Set([writePathOf(join(SITE, "_includes")), join(SITE, "_includes")])],
  extname: ".html",
  jekyllInclude: true,
  dynamicPartials: false,
});
engine.registerFilter("relative_url", (s: unknown) => String(s ?? ""));
engine.registerFilter("markdownify", (s: unknown) => String(s ?? ""));
const data = {
  harness: JSON.parse(readFileSync(overlayPath(join(SITE, "_data/harness.json")), "utf8")),
  stickies: JSON.parse(readFileSync(overlayPath(join(SITE, "_data/stickies.json")), "utf8")),
};

async function body(): Promise<string> {
  const src = readFileSync(overlayPath(declaredPagePath(ROOT, "todos")), "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
  return engine.parseAndRender(src, { site: { data } });
}

function shell(inner: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Todos</title>
<meta name="fa-todo-src" content="/assets/todos/index.json">
<meta name="fa-todo-graph" content="/todos.jsonld">
<style>${CSS}</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
${inner}
</div></div>
<script>${JS}</script></body></html>`;
}

/** Open `/todos/` with `graph` as the published `todos.jsonld`, or a 404 when null. */
async function open(p: Page, graph: string | null = GRAPH_TEXT): Promise<void> {
  const inner = await body();
  await p.route("http://site.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/todos/")) return route.fulfill({ contentType: "text/html", body: shell(inner) });
    if (url.endsWith("/assets/todos/index.json")) {
      return route.fulfill({ contentType: "application/json", body: TODOS });
    }
    if (url.endsWith("/todos.jsonld") && graph !== null) {
      return route.fulfill({ contentType: "application/ld+json", body: graph });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  await p.goto("http://site.test/todos/");
  await p.waitForFunction(() => Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard));
}

const board = (p: Page) => p.locator('[data-fa-home-panel="todos"]');
const shown = (p: Page) => board(p).locator("[data-fa-home-slot]:not([hidden])");

/** The committed graph with two people and two beans spread over its todos. */
function variedGraph(): string {
  const g = JSON.parse(GRAPH_TEXT) as { "@graph": GraphTodo[] };
  g["@graph"].forEach((t, i) => {
    t.assignee = i === 0
      ? [{ "@id": "https://github.com/alice", identifier: "github:alice" },
         { "@id": "https://github.com/bob", identifier: "github:bob" }]
      : [{ "@id": "https://github.com/bob", identifier: "github:bob" }];
    t.bean = i === 0 ? [] : [{ "@id": "https://example.test/bean/x", identifier: "folio-assistant-xxxx" }];
  });
  return JSON.stringify(g);
}

test.describe("the board reads todos.jsonld (#1941 follow-up 2)", () => {
  test("every sticky links to its own todos/<id>/ page", async ({ page: p }) => {
    expect(IDS.length).toBeGreaterThan(0);
    await open(p);
    for (const id of IDS) {
      const link = board(p).locator(`[data-fa-home-slot="${id}"] a[data-fa-act="page"]`);
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", `http://site.test/todos/${encodeURIComponent(id)}/`);
      await expect(link).toHaveAccessibleName(/^Open the page for /);
    }
  });

  test("the node filter comes from the graph, and narrows the board", async ({ page: p }) => {
    expect(NODES.length).toBeGreaterThan(1);
    await open(p);
    const select = p.locator("#fa-filter-node");
    await expect(select.locator("option")).toHaveCount(NODES.length + 1);
    const node = NODES[0]!;
    const want = GRAPH["@graph"].filter((t) => t.target?.label === node).map((t) => t.identifier);
    await select.selectOption(node);
    await expect(shown(p)).toHaveCount(want.length);
    for (const id of want) await expect(board(p).locator(`[data-fa-home-slot="${id}"]`)).toBeVisible();
    await select.selectOption("");
    await expect(shown(p)).toHaveCount(IDS.length);
  });

  test("group by node files every sticky under one heading per node", async ({ page: p }) => {
    await open(p);
    const group = p.locator("#fa-group-by");
    await expect(group.locator("option")).toHaveText(["none", "node", "status", "person", "bean"]);
    await group.selectOption("node");
    await expect(board(p)).toHaveAttribute("data-fa-grouped", "node");
    const heads = board(p).locator(".fa-sticky-group-head");
    await expect(heads).toHaveText([...NODES].sort());
    // Every sticky follows the heading of ITS node, before the next heading.
    const filed = await board(p).locator(".fa-sticky-grid").evaluate((grid) => {
      const out: Record<string, string> = {};
      let head = "";
      for (const c of Array.from(grid.children)) {
        if (c.classList.contains("fa-sticky-group-head")) head = c.textContent ?? "";
        const id = c.getAttribute("data-fa-home-slot");
        if (id) out[id] = head;
      }
      return out;
    });
    for (const t of GRAPH["@graph"]) expect(filed[t.identifier]).toBe(t.target?.label);
    await group.selectOption("");
    await expect(heads).toHaveCount(0);
  });

  test("person and bean: multi-valued, filtered on ANY value, grouped once", async ({ page: p }) => {
    await open(p, variedGraph());
    const person = p.locator("#fa-filter-person");
    await expect(person.locator("option")).toHaveText(["any person", "github:alice", "github:bob"]);
    await person.selectOption("github:alice");
    await expect(shown(p)).toHaveCount(1);
    await person.selectOption("github:bob");
    await expect(shown(p)).toHaveCount(IDS.length);
    await person.selectOption("");

    // The first todo has no bean: a bean filter excludes it, and grouping
    // files it under "no bean", last.
    await p.locator("#fa-group-by").selectOption("bean");
    const heads = board(p).locator(".fa-sticky-group-head");
    await expect(heads).toHaveText(["folio-assistant-xxxx", "no bean"]);
    // A filter that empties a group hides that group's heading too.
    await p.locator("#fa-filter-status").selectOption(GRAPH["@graph"][0]!.status);
    const visibleHeads = board(p).locator(".fa-sticky-group-head:not([hidden])");
    await expect(visibleHeads.last()).toHaveText("no bean");
  });

  test("no graph: the board still mounts, with no node, person or bean control and no page links", async ({ page: p }) => {
    await open(p, null);
    await expect(board(p).locator("[data-fa-home-slot]")).toHaveCount(IDS.length);
    await expect(p.locator("#fa-filter-node, #fa-filter-person, #fa-filter-bean")).toHaveCount(0);
    await expect(board(p).locator('a[data-fa-act="page"]')).toHaveCount(0);
    await expect(p.locator("#fa-group-by option")).toHaveText(["none", "status"]);
  });

  test("grouped and filtered, the page has no WCAG A/AA violations", async ({ page: p }) => {
    await open(p);
    await p.locator("#fa-group-by").selectOption("node");
    const { violations } = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => `${v.id} ×${v.nodes.length} — ${v.help}: ` + v.nodes.map((n) => `${n.target.join(" ")} ${n.html.slice(0, 200)} (${n.failureSummary ?? ""})`).join("; "))).toEqual([]);
  });
});
