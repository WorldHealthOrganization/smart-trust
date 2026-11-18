import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * GETTING AROUND THE GLASS — bean `b8eq`, issue #1154.
 *
 * Owner, 2026-09-23:
 *
 * > need to be able to zoom in and out of folio and move it around (plus snap
 * > back to home). slider and two finger. todos should have stick note avatar.
 * > should be able to drag and drop "more" tiles between it and bottom. bottom
 * > flip panel should be togglebe to stay open, but should slide away
 *
 * and, asked: the strip slides away **only by a button**, and **only More is
 * fixed** on the strip.
 *
 * Every gesture here has a pressing path beside it, and each is asserted: the
 * declared interaction profile is low-dexterity, and WCAG 2.5.7 asks that
 * anything done by dragging can be done without.
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const COVER = "/library/who-iris/book-cover.png";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const REPLICA = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Glass</title>
<style>${CSS}</style></head><body><main>
<table><tbody>
<tr data-fa-library-item="who-iris/book" data-fa-library-title="A handbook"
    data-fa-library-href="/lib.html#book" data-fa-library-avatar="${COVER}">
  <td data-fa-pullout-host>book</td><td>A handbook</td></tr>
</tbody></table></main>
<script>${JS}</script></body></html>`;

const TILES = [
  { id: "fsh-guts", directory: "fsh-guts", title: "fsh-guts", ref: "x", href: "/fsh-guts/",
    surfaces: ["navbar", "board", "glass"], hidden: false },
  { id: "library", directory: "library", title: "library", ref: "x", href: "/library/",
    surfaces: ["navbar", "board", "glass"], hidden: false },
];
const TODOS = { items: [{ id: "t-one", summary: "First thing to do" }] };
const PINS = ["glass-todos", "glass-filter", "glass-settings"];
const ZOOM = { belowPx: 220, byKind: { todo: { belowPx: 300, because: "a todo needs more room" } } };

test.beforeEach(async ({ page }) => {
  // The strip starts HIDDEN on a first open (owner, 2026-10-01). These specs
  // are about what is ON the strip, so they arrive as a reader who has shown
  // it; `glass-strip-default-hidden.e2e.ts` holds the default itself.
  await page.addInitScript(() => {
    try { if (localStorage.getItem("fa-glass-strip-hidden") === null) localStorage.setItem("fa-glass-strip-hidden", "0"); } catch { /* no storage */ }
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("http://replica.test/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: REPLICA });
    if (url.pathname === "/assets/harness/tiles.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(TILES) });
    }
    // The DECLARED pins (bean `ob3m` finding 10). These specs are about
    // arranging the strip, so they declare the glass's three own tiles and
    // leave the fitting to `glass-strip-fit.e2e.ts`.
    if (url.pathname === "/assets/harness/glass-strip.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(PINS) });
    }
    if (url.pathname === "/assets/todos/index.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(TODOS) });
    }
    if (url.pathname === "/assets/semantic-zoom.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(ZOOM) });
    }
    if (url.pathname === COVER) return route.fulfill({ contentType: "image/png", body: PNG });
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto("http://replica.test/page.html");
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  // The pins arrive by fetch on a replica page; wait for them, not for luck.
  await page.waitForSelector('.fa-glass-tiles [data-fa-strip-item="glass-filter"]', { state: "attached" });
});

const layer = ".fa-sticky-layer";
const shelf = ".fa-glass-shelf";
const book = '.fa-glass-asset[data-fa-asset="who-iris/book"]';
const open = async (page: Page) => {
  await page.click(".fa-glass-handle");
  await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
};
const reopen = async (page: Page) => {
  await page.reload();
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  await open(page);
};
const pullBook = async (page: Page) => {
  await page.click('[data-fa-library-item="who-iris/book"] .fa-pullout');
  await open(page);
  await expect(page.locator(book)).toBeVisible();
};
const scaleOf = (page: Page) =>
  page.locator(shelf).evaluate((n) => Number(n.getAttribute("data-fa-scale")));
const transformOf = (page: Page) => page.locator(shelf).evaluate((n) => (n as HTMLElement).style.transform);
const stripIds = (page: Page) =>
  page.locator(".fa-glass-tiles > *").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-fa-glass-chrome") || e.getAttribute("data-fa-tile")));

test.describe("zoom and pan, and Home — \"slider and two finger\"", () => {
  test("the buttons and the slider zoom, and the readout says how far", async ({ page }) => {
    await open(page);
    await expect(page.locator(".fa-glass-zoom-value")).toHaveText("100%");
    await page.click('[data-fa-zoom-control="out"]');
    expect(await scaleOf(page)).toBe(0.9);
    await expect(page.locator(".fa-glass-zoom-value")).toHaveText("90%");
    await page.click('[data-fa-zoom-control="in"]');
    await page.click('[data-fa-zoom-control="in"]');
    expect(await scaleOf(page)).toBe(1.1);
    // The slider is a real range input: the keyboard drives it.
    await page.locator(".fa-glass-zoom-slider").focus();
    await page.keyboard.press("ArrowLeft");
    expect(await scaleOf(page)).toBe(1.05);
  });

  test("it never zooms past its bounds, however often it is pressed", async ({ page }) => {
    await open(page);
    for (let i = 0; i < 12; i++) await page.click('[data-fa-zoom-control="out"]');
    expect(await scaleOf(page)).toBe(0.25);
    for (let i = 0; i < 25; i++) await page.click('[data-fa-zoom-control="in"]');
    expect(await scaleOf(page)).toBe(2);
  });

  test("zoomed out, a card turns to its avatar — and its saved size is untouched", async ({ page }) => {
    await pullBook(page);
    await expect(page.locator(book)).toHaveAttribute("data-fa-zoom", "card");
    const width = await page.locator(book).evaluate((n) => (n as HTMLElement).style.width);
    for (let i = 0; i < 5; i++) await page.click('[data-fa-zoom-control="out"]');
    // 50% of a 288px card is 144px, under the declared 220.
    await expect(page.locator(book)).toHaveAttribute("data-fa-zoom", "avatar");
    // The VIEW changed, not the card: Home can undo a view; it could not
    // undo a rewritten geometry.
    expect(await page.locator(book).evaluate((n) => (n as HTMLElement).style.width)).toBe(width);
  });

  test("a drag on empty glass pans it", async ({ page }) => {
    await open(page);
    const box = (await page.locator(shelf).boundingBox())!;
    const x = box.x + box.width - 60, y = box.y + 200;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 100, y + 50, { steps: 5 });
    await page.mouse.up();
    expect(await transformOf(page)).toBe("translate(-100px, 50px) scale(1)");
  });

  test("Ctrl + wheel — a trackpad pinch — zooms about the pointer", async ({ page }) => {
    await open(page);
    const box = (await page.locator(shelf).boundingBox())!;
    await page.mouse.move(box.x + 300, box.y + 150);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, 60);
    await page.keyboard.up("Control");
    await expect.poll(() => scaleOf(page)).toBeLessThan(1);
  });

  test("a two-finger pinch zooms the glass", async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await page.route("http://replica.test/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: REPLICA });
      return route.fulfill({ status: 404, body: "not found" });
    });
    await page.goto("http://replica.test/page.html");
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    await page.click(".fa-glass-handle");
    const box = (await page.locator(shelf).boundingBox())!;
    const cx = box.x + 400, cy = box.y + 150;
    const cdp = await ctx.newCDPSession(page);
    const touch = (type: string, d: number) => cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [
        { x: cx - d, y: cy, id: 1 },
        { x: cx + d, y: cy, id: 2 },
      ],
    });
    await touch("touchStart", 50);
    for (const d of [60, 70, 80, 90, 100]) await touch("touchMove", d);
    await touch("touchEnd", 100);
    // Fingers twice as far apart: twice the zoom.
    await expect.poll(() => scaleOf(page)).toBe(2);
    await ctx.close();
  });

  test("a card dragged on a zoomed glass stays under the pointer", async ({ page }) => {
    await pullBook(page);
    for (let i = 0; i < 5; i++) await page.click('[data-fa-zoom-control="out"]');
    const left = () => page.locator(book).evaluate((n) => parseFloat((n as HTMLElement).style.left));
    const before = await left();
    const r = (await page.locator(`${book} .fa-glass-avatar`).boundingBox())!;
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 4 });
    await page.mouse.up();
    // 40 screen pixels at 50% is 80 of the card's own.
    expect(await left()).toBe(before + 80);
  });

  test("Home snaps back to 100% where the folio starts — and the view is remembered until then", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-zoom-control="out"]');
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass-home", "false");
    await reopen(page);
    expect(await scaleOf(page)).toBe(0.9);
    await page.click('[data-fa-zoom-control="home"]');
    expect(await scaleOf(page)).toBe(1);
    expect(await transformOf(page)).toBe("");
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass-home", "true");
    await expect(page.locator(".fa-glass-sheet > .fa-sr-only")).toContainText("Back home");
  });
});

test.describe("a todo's avatar is a sticky note", () => {
  test("in the Todos panel and on the glass", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-todos"]');
    const row = page.locator('[data-fa-library-item="todo/t-one"]');
    await expect(row.locator(".fa-sticky-note-avatar")).toBeVisible();
    await row.locator(".fa-pullout").click();
    const card = page.locator('.fa-glass-asset[data-fa-asset="todo/t-one"]');
    await expect(card.locator(".fa-sticky-note-avatar")).toBeVisible();
    // Yellow, measured, not assumed.
    const bg = await card.locator(".fa-sticky-note-avatar").evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(bg).toBe("rgb(251, 227, 142)");
  });
});

test.describe("tiles move between the strip and More — \"Only More is fixed\"", () => {
  const openMore = async (page: Page) => {
    await page.click('[data-fa-glass-chrome="glass-more"]');
    await expect(page.locator('.fa-glass-more [data-fa-tile="fsh-guts"]')).toBeVisible();
  };

  test("the Strip button puts a visualisation on the strip, and it stays there", async ({ page }) => {
    await open(page);
    await openMore(page);
    await page.locator('[data-fa-more-item="fsh-guts"] .fa-glass-arrange').click();
    expect(await stripIds(page)).toEqual(["glass-todos", "glass-filter", "glass-settings", "fsh-guts", "glass-more"]);
    // Focus follows the tile to its new place in the list.
    await expect(page.locator('[data-fa-strip-row="fsh-guts"] button')).toBeFocused();
    await expect(page.locator('.fa-glass-more [data-fa-tile="fsh-guts"]')).toHaveCount(0);
    await reopen(page);
    expect(await stripIds(page)).toEqual(["glass-todos", "glass-filter", "glass-settings", "fsh-guts", "glass-more"]);
  });

  test("the More button takes one of the glass's own tiles off the strip — and it still works from More", async ({ page }) => {
    await open(page);
    await openMore(page);
    await page.locator('[data-fa-strip-row="glass-filter"] button').click();
    expect(await stripIds(page)).toEqual(["glass-todos", "glass-settings", "glass-more"]);
    const filter = page.locator('[data-fa-more-item="glass-filter"] [data-fa-glass-chrome="glass-filter"]');
    await expect(filter).toBeVisible();
    await filter.click();
    await expect(page.locator(".fa-glass-panel")).toHaveAttribute("data-fa-panel", "glass-filter");
  });

  test("More itself cannot leave the strip", async ({ page }) => {
    await open(page);
    await openMore(page);
    await expect(page.locator('[data-fa-strip-row="glass-more"]')).toHaveCount(0);
    await expect(page.locator('[data-fa-more-item="glass-more"]')).toHaveCount(0);
    // Everything else off the strip: More is still there, and still last.
    for (const id of ["glass-todos", "glass-filter", "glass-settings"]) {
      await page.locator(`[data-fa-strip-row="${id}"] button`).click();
    }
    expect(await stripIds(page)).toEqual(["glass-more"]);
  });

  test("a drag from More onto the strip lands where it is dropped — and opens nothing", async ({ page }) => {
    await open(page);
    await openMore(page);
    // Scrolled clear of the strip, which overlays the glass's bottom edge.
    const tile = page.locator('.fa-glass-more [data-fa-tile="fsh-guts"]');
    await tile.evaluate((n) => n.scrollIntoView({ block: "start" }));
    const from = (await tile.boundingBox())!;
    const onto = (await page.locator('.fa-glass-tiles [data-fa-glass-chrome="glass-filter"]').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(onto.x + 5, onto.y + onto.height / 2, { steps: 8 });
    await expect(page.locator(layer)).toHaveAttribute("data-fa-drop", "strip");
    await page.mouse.up();
    // Dropped on Filter's LEFT half: before Filter.
    expect(await stripIds(page)).toEqual(["glass-todos", "fsh-guts", "glass-filter", "glass-settings", "glass-more"]);
    // The drag was not also a press of the link.
    expect(new URL(page.url()).pathname).toBe("/page.html");
    await expect(page.locator(".fa-glass-tile-ghost")).toHaveCount(0);
  });

  test("a strip tile dragged onto More goes into More, with More's panel shut", async ({ page }) => {
    await open(page);
    const from = (await page.locator('[data-fa-glass-chrome="glass-settings"]').boundingBox())!;
    const onto = (await page.locator('[data-fa-glass-chrome="glass-more"]').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(onto.x + onto.width / 2, onto.y + onto.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(await stripIds(page)).toEqual(["glass-todos", "glass-filter", "glass-more"]);
    // Settings did not open on the way.
    await expect(page.locator(".fa-glass-panel")).toBeHidden();
  });

  test("a drag along the strip reorders it", async ({ page }) => {
    await open(page);
    const from = (await page.locator('[data-fa-glass-chrome="glass-settings"]').boundingBox())!;
    const onto = (await page.locator('[data-fa-glass-chrome="glass-todos"]').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(onto.x + 5, onto.y + onto.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(await stripIds(page)).toEqual(["glass-settings", "glass-todos", "glass-filter", "glass-more"]);
  });

  test("a plain press on a tile still opens it", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await expect(page.locator(".fa-glass-panel")).toHaveAttribute("data-fa-panel", "glass-settings");
  });
});

test.describe("the strip slides away — \"Only by a button\"", () => {
  const dock = ".fa-glass-dock";
  const tab = ".fa-glass-strip-toggle";

  test("it never hides by itself", async ({ page }) => {
    await open(page);
    await page.mouse.move(640, 200);
    await page.waitForTimeout(1500);
    await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "shown");
  });

  test("Hide slides it off-screen; the tab stays on screen; Show brings it back", async ({ page }) => {
    await open(page);
    await expect(page.locator(tab)).toHaveText("▾ Hide tiles");
    await page.click(tab);
    await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "hidden");
    await expect(page.locator(tab)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(tab)).toContainText("▴ Show tiles");
    // Hidden means unreachable by keyboard too — not merely off-screen.
    await expect(page.locator(".fa-glass-tiles")).toHaveAttribute("inert", "");
    // The way back is on screen.
    await expect.poll(async () => {
      const t = (await page.locator(tab).boundingBox())!;
      return t.y + t.height <= 800 && t.y >= 800 - 60;
    }).toBe(true);
    // And the strip is below the fold once the slide settles.
    await expect.poll(async () => (await page.locator(".fa-glass-tiles").boundingBox())!.y).toBeGreaterThanOrEqual(799);
    await page.click(tab);
    await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "shown");
    await expect(page.locator(".fa-glass-tiles")).not.toHaveAttribute("inert", "");
  });

  test("the choice is remembered", async ({ page }) => {
    await open(page);
    await page.click(tab);
    await reopen(page);
    await expect(page.locator(dock)).toHaveAttribute("data-fa-strip", "hidden");
  });
});

test.describe("on a phone the column stands", () => {
  test("no zoom bar and no transform — the phone's own pinch zooms the column", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await expect(page.locator(".fa-glass-zoom")).toBeHidden();
    const t = await page.locator(shelf).evaluate((n) => getComputedStyle(n).transform);
    expect(t).toBe("none");
    // The strip and its tab are still there.
    await expect(page.locator(".fa-glass-strip-toggle")).toBeVisible();
  });
});

test.describe("accessibility of the new controls", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`no WCAG A/AA violations on the glass — zoom bar, More's arrangement, ${colorScheme}`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme, viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await page.route("http://replica.test/**", (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: REPLICA });
        if (url.pathname === "/assets/harness/tiles.json") {
          return route.fulfill({ contentType: "application/json", body: JSON.stringify(TILES) });
        }
        return route.fulfill({ status: 404, body: "not found" });
      });
      await page.goto("http://replica.test/page.html");
      await page.waitForSelector(".fa-glass-handle", { state: "attached" });
      await page.click(".fa-glass-handle");
      // The strip starts hidden on a first open (owner, 2026-10-01): the
      // Show tiles tab is the first control a reader meets, so it is pressed
      // here rather than skipped by a stored choice.
      await page.click(".fa-glass-strip-toggle");
      await page.click('[data-fa-glass-chrome="glass-more"]');
      await expect(page.locator('[data-fa-strip-row="glass-todos"]')).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .include(".fa-glass-sheet")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(violations.map((v) => `${v.id}: ` +
        v.nodes.map((n) => n.failureSummary ?? n.html).join(" | "))).toEqual([]);
      await ctx.close();
    });
  }
});
