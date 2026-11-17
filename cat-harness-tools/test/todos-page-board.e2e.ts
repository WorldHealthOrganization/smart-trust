/**
 * `/todos/` mounts the SAME sticky panel as the landing page, and nothing else
 * from the old dashboard — issue #1906, bean `folio-assistant-72gk`.
 *
 * Owner, 2026-10-02: *"https://litlfred.github.io/folio-assistant/todos/
 * should also have the same stickies panel. not sure why all the graphs are
 * listed on the todos page. cluttery"* — and of the by-node list that sat
 * under it: *"are not functional for more info or anything"*.
 *
 * ## What is real here and what is not
 *
 * Real: the COMMITTED generated page (`docs/en/cat-harness/todos/index.html`, written by
 * `state-visualizer.ts`), the real `_includes/landing.html` it includes, the
 * real `_data/stickies.json` that include iterates, the real `docs-ui.js` and
 * `docs-ui.css`, and the real todo projection. The landing page is rendered
 * the same way from the real `index.md`, so "the same panel" is compared
 * between the two pages rather than asserted against a class name copied
 * into this file.
 *
 * Not real: Jekyll. The page is rendered with `liquidjs` (already a
 * dependency) in its Jekyll-include mode, `relative_url` is the identity at
 * an empty baseurl, `markdownify` passes through, and the layout is a
 * minimal stand-in carrying what the theme contributes to this page: the
 * `fa-todo-src` meta from `head_custom.html`, and the no-JS floor that
 * `footer_custom.html` includes on every page — rendered from the real
 * `_includes/footer_custom.html`, so the floor under test is the one that
 * ships. A defect that lives only in the theme's layout is
 * not caught here; `bun run cat preview:site` is the check for that.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Liquid } from "liquidjs";
import { AxeBuilder } from "@axe-core/playwright";

import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { declaredPagePath } from "./support/site-pages.ts";
import { overlayPath, writePathOf } from "../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));
/** The page under test, at the route the harness declares for `todos`. */
const TODOS_PAGE = declaredPagePath(ROOT, "todos");
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const TODOS = readFileSync(overlayPath(join(SITE, "assets/todos/index.json")), "utf8");
const ITEM_COUNT = (JSON.parse(TODOS) as { items: unknown[] }).items.length;

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

/** A page's body with its front matter removed, through Liquid. `rel` is site-relative, or absolute. */
async function render(rel: string): Promise<string> {
  const src = readFileSync(overlayPath(resolve(SITE, rel)), "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
  return engine.parseAndRender(src, { site: { data } });
}

function shell(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Todos</title>
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
${body}
</div></div>
<script>${JS}</script></body></html>`;
}

/**
 * The floor, exactly as `footer_custom.html` includes it on every page.
 *
 * Only the floor and not the whole footer: the footer's other part, the build
 * stamp, is site-wide chrome styled by the theme this stand-in does not load.
 * Unstyled, its link fails contrast (browser-default blue at the stamp's 0.6
 * opacity), which says nothing about this page.
 */
async function footer(): Promise<string> {
  const src = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "_includes/footer_custom.html"))), "utf8");
  const line = /\{%-?\s*include generated\/todo-listing\.html\s*-?%\}/.exec(src);
  if (!line) throw new Error("footer_custom.html no longer includes the todo floor");
  return engine.parseAndRender(line[0], { site: { data } });
}

async function open(p: Page, rel: string, onlyLandingInclude = false): Promise<void> {
  let body = await render(rel);
  // The landing page's markdown is not Jekyll's to convert here; only its
  // include matters for the comparison, so take the panel and nothing else.
  if (onlyLandingInclude) body = body.slice(body.indexOf("<details"), body.indexOf("</details>") + 10);
  body += await footer();
  await p.route("http://site.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/page.html")) return route.fulfill({ contentType: "text/html", body: shell(body) });
    if (url.endsWith("/assets/todos/index.json")) {
      return route.fulfill({ contentType: "application/json", body: TODOS });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  await p.goto("http://site.test/page.html");
  await p.waitForFunction(() => Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard));
}

/** The board's structure, as class lists from the panel down — what "same" means. */
async function boardShape(p: Page): Promise<string[]> {
  return p.locator(".fa-sticky-panel").evaluate((panel) => {
    const out: string[] = [];
    const landing = panel.querySelector(".fa-landing-board");
    const todos = panel.querySelector('[data-fa-home-panel="todos"]');
    out.push(landing ? landing.className : "no landing board");
    out.push(todos ? todos.className : "no todo board");
    out.push(todos && landing && landing.contains(todos) ? "todo board inside landing board" : "detached");
    return out;
  });
}

test.describe("/todos/ is the stickies panel (#1906)", () => {
  test("the panel is mounted, open, and carries every todo as a sticky", async ({ page: p }) => {
    expect(ITEM_COUNT).toBeGreaterThan(0);
    await open(p, TODOS_PAGE);
    await expect(p.locator("details.fa-sticky-panel")).toHaveCount(1);
    await expect(p.locator("details.fa-sticky-panel")).toHaveAttribute("open", "");
    const board = p.locator('.fa-landing-board [data-fa-home-panel="todos"]');
    await expect(board).toHaveCount(1);
    await expect(board).toBeVisible();
    // One home slot per item in the projection: every todo is on the page,
    // which is wireframe finding 1 ("the items are not on the page").
    await expect(board.locator("[data-fa-home-slot]")).toHaveCount(ITEM_COUNT);
  });

  test("it is the SAME board the landing page mounts", async ({ page: p }) => {
    await open(p, TODOS_PAGE);
    const onTodos = await boardShape(p);
    await p.unrouteAll();
    await open(p, "index.md", true);
    const onLanding = await boardShape(p);
    expect(onTodos).toEqual(onLanding);
    expect(onTodos[2]).toBe("todo board inside landing board");
    // And the landing page's panel stays slid away, as the owner asked there.
    await expect(p.locator("details.fa-sticky-panel")).not.toHaveAttribute("open", "");
  });

  test("the rendered page has no WCAG A/AA violations", async ({ page: p }) => {
    // The audit `state-dashboards.e2e.ts` runs over every standalone state
    // page, at the same tags. This page is themed, so it is audited here,
    // AFTER rendering, rather than as the unbuilt source that spec serves.
    await open(p, TODOS_PAGE);
    const { violations } = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map(
        (v) =>
          `${v.id} [${v.impact}] ×${v.nodes.length} — ${v.help}: ` +
          v.nodes.map((n) => `${n.target.join(" ")} ${n.html} (${n.failureSummary ?? ""})`).join("; "),
      ),
    ).toEqual([]);
  });

  test("no state-graph list and no plain-text by-node list", async ({ page: p }) => {
    await open(p, TODOS_PAGE);
    const text = await p.locator("body").innerText();
    expect(text).not.toMatch(/State graphs this harness declares/i);
    expect(text).not.toMatch(/Todos by the node they are attached to/i);
  });

  test("each listed todo opens for more: its body, View source, Edit, and its node's page", async ({ page: p }) => {
    // Owner, 2026-10-02, of the by-node list this page used to carry: "are
    // not functional for more info or anything". That list is gone; the
    // listing on this page is the floor, and every item in it must be a way
    // IN — not a line of text.
    await open(p, TODOS_PAGE);
    // Collapsed into a disclosure once the board mounts, never removed.
    const floor = p.locator("details.fa-todo-listing-details");
    await expect(floor).toHaveCount(1);
    await floor.locator("summary").click();
    const items = p.locator("#fa-todo-listing .fa-todo-listing-item");
    await expect(items).toHaveCount(ITEM_COUNT);
    for (let i = 0; i < ITEM_COUNT; i++) {
      const it = items.nth(i);
      await expect(it.locator(".fa-todo-listing-body")).not.toBeEmpty();
      await expect(it.getByRole("link", { name: "View source" })).toHaveAttribute("href", /^https:\/\//);
      await expect(it.getByRole("link", { name: "Edit", exact: true })).toHaveAttribute("href", /\/edit\//);
      // The node it is attached to is a link to that node's page and anchor,
      // resolved by the generator rather than composed here.
      await expect(it.locator("dd a[href*='.html#']").first()).toBeVisible();
    }
  });
});
