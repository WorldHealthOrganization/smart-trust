import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteDirFor } from "../schemas/kg/cat-harness.ts";
import { publishedPagePath } from "../scripts/lib/jekyll-permalink.ts";
import { serveThemed } from "./support/themed-page.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * Every todo has its own page, and the page renders it from its JSON-LD —
 * issue #1908.
 *
 * The page at `<site>/todo/<id>/` is a committed thin shell carrying the
 * todo's id and nothing else (`scripts/todo-page.ts`). A grep of the HTML
 * cannot say whether it works, so this loads it in a browser and checks that
 * the summary, the attachment and the edges arrive from the published
 * JSON-LD — and that the JSON-LD alternate, the graph and the attached node's
 * IRI are all served.
 *
 * Served from the repository root by `test-server.mjs`, like every e2e here;
 * the page's paths are relative, so they resolve under this prefix as they do
 * on the published site. The page is THEMED since 2026-10-07, so it is served
 * in the layout stand-in (`support/themed-page.ts`), which writes the
 * `alternate` link from the front matter as `head_custom.html` does.
 */
const SITE = process.env.FA_SITE_URL ?? "http://127.0.0.1:8080";
const DOCS = "/cat-harness/docs";
const SITE_BASE = "https://litlfred.github.io/folio-assistant/";

const ROOT = HARNESS_ROOT;  // the site is the harness's (bean 70lx)
const SITE_DIR = join(ROOT, siteDirFor(ROOT));
const index = JSON.parse(
  readFileSync(overlayPath(join(SITE_DIR, "assets", "todos", "index.json")), "utf8"),
) as { items: Array<{ id: string; summary: string; target?: { page: string; node: string } }> };

function listen(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  return errors;
}

for (const item of index.items) {
  test(`todo ${item.id}: its page renders it from its JSON-LD`, async ({ page }) => {
    const errors = listen(page);
    await serveThemed(page, { fsRoot: SITE_DIR, urlPrefix: `${DOCS}/` });
    const res = await page.goto(`${SITE}${DOCS}/todo/${item.id}/`, { waitUntil: "networkidle" });
    expect(res?.status(), "the todo's page must be a materialized file").toBe(200);

    // The summary is NOT in the shell, so it came from the JSON-LD.
    await expect(page.locator("#fa-todo-summary")).toHaveText(item.summary);
    await expect(page.locator("#fa-todo-meta")).toContainText("Status");
    await expect(page.locator("#fa-todo-edges")).toContainText("JSON-LD");

    // The alternate is the asset, and its @id is its own address.
    const alt = await page.locator('link[rel="alternate"][type="application/ld+json"]').getAttribute("href");
    const ld = await page.request.get(new URL(alt!, page.url()).href);
    expect(ld.status()).toBe(200);
    const asset = (await ld.json()) as { "@id": string; target?: { "@id": string } };
    // The IRI is extensionless, `<site>/todo/<id>` (Q-THIN-2/4 A); the data is the IRI plus `.jsonld`.
    expect(asset["@id"]).toBe(`${SITE_BASE}todo/${item.id}`);

    // The attachment: the rendering link goes to the block, and the node's IRI
    // is a file this site serves.
    if (item.target && asset.target) {
      // `target.page` is the block's SOURCE page; the link goes where Jekyll
      // PUBLISHES it, which since bean `kc7k` differs for the docs-folder
      // pages (`process/x` → `docs/cat-harness/process/x.html`).
      const about = page.locator("#fa-todo-meta dd a").first();
      const published = publishedPagePath(SITE_DIR, item.target.page);
      // The page resolves the href against itself before writing it (`safeHref`
      // in todo-page.js keeps only http(s)), so the attribute is absolute.
      await expect(about).toHaveAttribute("href", new URL(`../../${published}#${item.target.node}`, page.url()).href);
      const node = await page.request.get(`${SITE}${DOCS}/${asset.target["@id"].slice(SITE_BASE.length)}`);
      expect(node.status(), `${asset.target["@id"]} must dereference`).toBe(200);
    }

    // The way back to every todo.
    await expect(page.locator(".fa-todo-page-up a")).toHaveAttribute("href", "../../todos/");
    expect(errors).toEqual([]);
  });
}

test("the whole graph is published and names every todo", async ({ request }) => {
  const res = await request.get(`${SITE}${DOCS}/todos.jsonld`);
  expect(res.status()).toBe(200);
  const g = (await res.json()) as { hasPart: string[] };
  expect(g.hasPart).toEqual(index.items.map((i) => `${SITE_BASE}todo/${i.id}`));
});

test("a todo page whose JSON-LD is missing says so rather than showing nothing", async ({ page }) => {
  const first = index.items[0]!;
  await page.route(`**/todo/${first.id}.jsonld`, (r) => r.fulfill({ status: 404, body: "" }));
  await serveThemed(page, { fsRoot: SITE_DIR, urlPrefix: `${DOCS}/` });
  await page.goto(`${SITE}${DOCS}/todo/${first.id}/`, { waitUntil: "networkidle" });
  await expect(page.locator("#fa-todo-status")).toContainText("Could not load this todo");
});
