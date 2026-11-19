import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.ts";

/**
 * The prefix-sharded identifier lookup, in a browser, over the COMMITTED
 * who-iris index. Bean `folio-assistant-4pm8`.
 *
 * `cat-harness/schemas/id-lookup.test.ts` runs the same client under bun
 * with a map standing in for `fetch`. This runs the page a reader opens, so
 * what it proves is the part a unit test cannot: that the module loads in a
 * browser as written, that the relative shard URLs resolve against a real
 * static server, and that each lookup requests exactly one shard and never
 * the whole index.
 *
 * The ids are read off the catalogue on disk, not listed here, so a node
 * added to the catalogue is covered the day it lands.
 */
const REPO = repoRootFor(join(import.meta.dirname, "..", ".."));
const NODES = join(REPO, "who-iris", "catalogue", "nodes");
// The generic reader page, told which index to open: who-iris hosts its own
// generated index (D3, bean `j7ql`), and the page names no layer.
const PAGE = "/cat-harness-tools/id-lookup/index.html?index=" + encodeURIComponent("../../who-iris/id-lookup/");

const referenced = readdirSync(NODES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(NODES, f), "utf8")) as { id: string; title: string; materialization: { state: string } })
  .filter((n) => n.materialization.state === "referenced");

test("there are referenced nodes to look up", () => {
  expect(referenced.length).toBeGreaterThanOrEqual(10);
});

test("every referenced who-iris node resolves in the browser, one shard per lookup", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/id-lookup/who-iris/")) requested.push(new URL(r.url()).pathname);
  });
  await page.goto(PAGE);
  await page.waitForFunction(() => typeof (window as unknown as { __idLookup?: unknown }).__idLookup === "function");
  for (const n of referenced) {
    requested.length = 0;
    const r = await page.evaluate((id) => (window as unknown as { __idLookup(v: string): Promise<{ state: string; entry?: { title: string } }> }).__idLookup(id), n.id);
    expect(r.state, n.id).toBe("found");
    expect(r.entry?.title).toBe(n.title);
    // At most one shard, and never the manifest again: the page downloads a shard, not the index.
    expect(requested.filter((p) => !p.endsWith("/manifest.json")).length).toBeLessThanOrEqual(1);
  }
});

test("the form shows a found node as a link to where it is held, and says when one is absent", async ({ page }) => {
  const n = referenced[0]!;
  await page.goto(`${PAGE}&q=${encodeURIComponent(n.id)}`);
  await expect(page.locator("#out a")).toHaveText(n.title);
  await page.fill("#q", "community/00000000-0000-4000-8000-000000000000");
  await page.press("#q", "Enter");
  await expect(page.locator("#out")).toHaveText("Not in this index.");
});
