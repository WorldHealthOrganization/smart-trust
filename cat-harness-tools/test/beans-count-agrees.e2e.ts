/**
 * ONE BEANS COUNT, WHEREVER BEANS IS COUNTED — bean `v215`.
 *
 * The defect (wireframe `navbar` Findings, "Seen on the build", re-drawn in
 * #2295): the icon row showed "Beans 541" (open beans, from
 * `assets/beans/count.json`), while the glass tile and the launcher tile
 * showed 943 (every bean ever filed, from the bean index's `tile.beans`, via
 * `_data/harness.json`), with no word saying what 943 counted. The board's own
 * "open" left `draft` out, so it was a third number again.
 *
 * Decision recorded on the bean: one is wrong, so they agree. Every Beans badge
 * counts OPEN beans (`openBeanCount` in `scripts/bean-store-read.ts`), the
 * owner's choice for the headline (`gkv6`), and says so in its name and tip.
 *
 * Run against the GENERATED projections, not a fixture: the failure was two
 * generated files disagreeing, and a fixture would agree by construction.
 * Since B1 (owner, 2026-10-14) they are not committed: `e2e-global-setup.ts`
 * builds both with `derive:publish`, from one `state:mount`, as the deploy
 * does — the committed pair had disagreed (190 against 179) only because each
 * was a snapshot of `cat/cat-harness/beans` taken at a different time.
 * `count.json` is what the icon row reads (`rail-icon-row.e2e.ts` holds that
 * it renders it), so each other surface is compared with that file.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";
import { siteFileAt } from "./support/site-fs.ts";

const ROOT = join(HARNESS_ROOT);
const read = (p: string) => readFileSync(overlayPath(join(ROOT, siteFileAt(ROOT, p))), "utf8");
const CSS = read("assets/css/docs-ui.css");
const JS = read("assets/js/docs-ui.js");
const QR = read("assets/js/vendor/qrcode.js");
const KG = read("assets/js/kg-render.js");
const WORKPLAN = read("assets/js/work-plan.js");
const COUNT_JSON = read("assets/beans/count.json");
const INDEX_JSON = read("assets/beans/index.json");

/** What the icon row shows: `count.json`'s number and unit. */
const ROW = (JSON.parse(COUNT_JSON) as { tile: { beans: { count: number; unit: string } } }).tile.beans;

/** The declared Beans tile, exactly as the site's pages carry it in `<meta name="fa-tiles">`. */
const HARNESS = JSON.parse(read("_data/harness.json")) as { tiles: Array<{ id: string }> };
const BEANS_TILE = HARNESS.tiles.filter((t) => t.id === "beans");

const attr = (v: unknown) => JSON.stringify(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** A page with the sidebar (so the ▦ launcher mounts) and the glass, carrying the declared Beans tile. */
const TILES_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Beans</title>
<meta name="fa-tiles" content="${attr(BEANS_TILE)}">
<meta name="fa-glass-strip" content="${attr(["glass-todos", "glass-settings", "beans"])}">
<style>
  body { margin: 0; }
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; background: #27262b; color: #fff; }
  .site-header { width: 100%; display: flex; align-items: center; }
  .site-title { flex: 1; }
  .main { margin-left: 16.5rem; }
  ${CSS}
</style></head><body>
  <div class="side-bar">
    <div class="site-header"><a class="site-title">folio-assistant</a></div>
    <nav class="site-nav"><a href="#">Home</a></nav>
  </div>
  <div class="main"><div class="main-content"><h1>A page</h1></div></div>
  <script>${QR}<\/script>
  <script>${JS}<\/script>
</body></html>`;

/** The bean board, reading the committed bean index. */
const BOARD_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Board</title>
<meta name="fa-beans-src" content="http://beans.test/assets/beans/index.json">
</head><body><div data-fa-workplan><p>Loading.</p></div>
<script>${KG}<\/script><script>${WORKPLAN}<\/script></body></html>`;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("http://beans.test/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/tiles.html") return route.fulfill({ contentType: "text/html", body: TILES_PAGE });
    if (path === "/board.html") return route.fulfill({ contentType: "text/html", body: BOARD_PAGE });
    if (path === "/assets/beans/index.json") return route.fulfill({ contentType: "application/json", body: INDEX_JSON });
    if (path === "/assets/beans/count.json") return route.fulfill({ contentType: "application/json", body: COUNT_JSON });
    return route.fulfill({ status: 404, body: "" });
  });
});

/** The badge's number, its tile's accessible name, and its tooltip. */
async function badge(page: Page, tile: string) {
  const t = page.locator(tile);
  await expect(t.locator(".fa-tile-count")).toBeVisible();
  return {
    n: Number(await t.locator(".fa-tile-count").textContent()),
    name: (await t.getAttribute("aria-label")) ?? "",
    tip: (await t.getAttribute("title")) ?? "",
  };
}

test("the committed projections declare the icon row's number for the Beans tile", () => {
  expect(BEANS_TILE).toHaveLength(1);
  const tile = BEANS_TILE[0] as unknown as { count: number; unit: string };
  expect({ count: tile.count, unit: tile.unit }).toEqual({ count: ROW.count, unit: ROW.unit });
  expect(ROW.unit).toBe("open beans");
});

test("the GLASS tile shows the icon row's number, and says it counts open beans", async ({ page }) => {
  await page.goto("http://beans.test/tiles.html");
  await page.click(".fa-glass-handle");
  if ((await page.locator(".fa-glass-dock").getAttribute("data-fa-strip")) === "hidden") {
    await page.click(".fa-glass-strip-toggle");
  }
  const b = await badge(page, '.fa-glass-tiles [data-fa-tile="beans"]');
  expect(b.n).toBe(ROW.count);
  expect(b.name).toContain(`${ROW.count} open beans`);
  expect(b.tip).toContain(`${ROW.count} open beans`);
});

test("the LAUNCHER tile shows the icon row's number, and says it counts open beans", async ({ page }) => {
  await page.goto("http://beans.test/tiles.html");
  await page.locator(".fa-tiles-toggle").click();
  const b = await badge(page, '.fa-tiles-grid [data-fa-tile="beans"]');
  expect(b.n).toBe(ROW.count);
  expect(b.name).toContain(`${ROW.count} open beans`);
  expect(b.tip).toContain(`${ROW.count} open beans`);
});

test("the BOARD's \"open\" is the same number — drafts included", async ({ page }) => {
  await page.goto("http://beans.test/board.html");
  const hero = page.locator(".fa-workplan-count.is-hero").first();
  await expect(hero.locator(".fa-workplan-count-label")).toHaveText("open");
  await expect(hero.locator(".fa-workplan-count-value")).toHaveText(String(ROW.count));
  // And the parts it is the sum of are each on the board.
  const part = async (label: string) =>
    Number(await page.locator(`.fa-workplan-count:has(.fa-workplan-count-label:text-is("${label}")) .fa-workplan-count-value`).first().textContent());
  expect((await part("draft")) + (await part("todo")) + (await part("in progress"))).toBe(ROW.count);
});
