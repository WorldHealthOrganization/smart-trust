import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * FOUR THINGS THE GLASS GOT WRONG IN THE HAND — after bean `b8eq` (PR #1160).
 *
 * Owner, 2026-09-24, verbatim:
 *
 * > you shoud be able to put things on folio w/ x,y <0, can't move negative
 * > right now. exploding icon outlines the avatar but appears to do nothing
 * > else. clicking on glass, but not avatar, should pan the glass. drag drop
 * > avatar and cant un-drag when not on avata/inteact w/ todos
 *
 * One `describe` per sentence, in the owner's order. Each was written first
 * and seen to FAIL against the code it describes before that code changed.
 *
 * Every gesture has a pressing path beside it, and the pressing path is
 * asserted too: the declared interaction profile is low-dexterity.
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

const TODOS = { items: [{ id: "t-one", summary: "First thing to do" }, { id: "t-two", summary: "Second thing" }] };
const ZOOM = { belowPx: 220, byKind: { todo: { belowPx: 300, because: "a todo needs more room" } } };

async function serve(page: Page) {
  await page.route("http://replica.test/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: REPLICA });
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
}

test.beforeEach(async ({ page }) => {
  // The strip starts HIDDEN on a first open (owner, 2026-10-01). These specs
  // are about what is ON the strip, so they arrive as a reader who has shown
  // it; `glass-strip-default-hidden.e2e.ts` holds the default itself.
  await page.addInitScript(() => {
    try { if (localStorage.getItem("fa-glass-strip-hidden") === null) localStorage.setItem("fa-glass-strip-hidden", "0"); } catch { /* no storage */ }
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await serve(page);
});

const layer = ".fa-sticky-layer";
const shelf = ".fa-glass-shelf";
const book = '.fa-glass-asset[data-fa-asset="who-iris/book"]';
const todo = '.fa-glass-asset[data-fa-asset="todo/t-one"]';

const open = async (page: Page) => {
  await page.click(".fa-glass-handle");
  await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
};
const pullBook = async (page: Page) => {
  await page.click('[data-fa-library-item="who-iris/book"] .fa-pullout');
  await open(page);
  await expect(page.locator(book)).toBeVisible();
};
const geom = (page: Page, sel = book) =>
  page.locator(sel).evaluate((n) => ({
    left: parseFloat((n as HTMLElement).style.left),
    top: parseFloat((n as HTMLElement).style.top),
  }));
const transformOf = (page: Page) => page.locator(shelf).evaluate((n) => (n as HTMLElement).style.transform);
/** The middle of the book's cover — a grip, and not the title link over its top. */
const coverMiddle = async (page: Page) => {
  const r = (await page.locator(`${book} .fa-glass-avatar`).boundingBox())!;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
const drag = async (page: Page, from: { x: number; y: number }, dx: number, dy: number) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  await page.mouse.up();
};

/** A touch page: the same replica, in a context that has a touch screen. */
async function touchPage(ctxOf: () => Promise<BrowserContext>) {
  const ctx = await ctxOf();
  const page = await ctx.newPage();
  await serve(page);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type: string, points: Array<{ x: number; y: number }>) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })),
    });
  return { ctx, page, touch };
}

/* ── 1. "you shoud be able to put things on folio w/ x,y <0" ─────────────── */
test.describe("a card goes past the glass's top-left — \"put things on folio w/ x,y <0\"", () => {
  test("a drag takes it to a negative place", async ({ page }) => {
    await pullBook(page);
    const before = await geom(page);
    expect(before).toEqual({ left: 0, top: 0 });
    await drag(page, await coverMiddle(page), -120, -80);
    expect(await geom(page)).toEqual({ left: -120, top: -80 });
  });

  test("the keyboard takes it there too — Move, then arrows", async ({ page }) => {
    await pullBook(page);
    await page.locator(`${book} [data-fa-control="move"]`).click();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    expect(await geom(page)).toEqual({ left: -48, top: -16 });
  });

  test("a negative place survives a reload", async ({ page }) => {
    await pullBook(page);
    await drag(page, await coverMiddle(page), -120, -80);
    await page.reload();
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    await open(page);
    expect(await geom(page)).toEqual({ left: -120, top: -80 });
  });

  test("Home brings a card at x<0 back into view, whole", async ({ page }) => {
    await pullBook(page);
    await page.locator(`${book} [data-fa-control="move"]`).click();
    for (let i = 0; i < 25; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Escape");
    expect((await geom(page)).left).toBe(-400);
    // Off the left edge of the glass: the reader cannot see it.
    const sheet = (await page.locator(".fa-glass-sheet").boundingBox())!;
    expect((await page.locator(book).boundingBox())!.x).toBeLessThan(sheet.x);
    await page.click('[data-fa-zoom-control="home"]');
    const card = (await page.locator(book).boundingBox())!;
    expect(card.x).toBeGreaterThanOrEqual(sheet.x);
    // At 100%, and the card's own place is untouched: Home moved the VIEW.
    expect(await page.locator(shelf).getAttribute("data-fa-scale")).toBe("1");
    expect((await geom(page)).left).toBe(-400);
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass-home", "true");
  });

  test("Tidy puts a negative card back in the grid", async ({ page }) => {
    await pullBook(page);
    await drag(page, await coverMiddle(page), -120, -80);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await page.click(".fa-glass-tidy");
    expect(await geom(page)).toEqual({ left: 0, top: 0 });
  });
});

/* ── 2. "exploding icon outlines the avatar but appears to do nothing else" ── */
test.describe("the ✜ move control does what it is for — \"outlines the avatar but appears to do nothing else\"", () => {
  const bar = ".fa-glass-move-bar";

  test("pressing it says ON SCREEN what the mode does, and its buttons move the card", async ({ page }) => {
    await pullBook(page);
    await page.locator(`${book} [data-fa-control="move"]`).click();
    await expect(page.locator(book)).toHaveAttribute("data-fa-moving", "true");
    // Said where a sighted pointer user will see it, not only in a live region.
    await expect(page.locator(bar)).toBeVisible();
    await expect(page.locator(bar)).toContainText("A handbook");
    await expect(page.locator(bar)).toContainText("arrow keys");
    await page.locator(`${bar} [data-fa-step="ArrowRight"]`).click();
    await page.locator(`${bar} [data-fa-step="ArrowRight"]`).click();
    await page.locator(`${bar} [data-fa-step="ArrowDown"]`).click();
    expect(await geom(page)).toEqual({ left: 32, top: 16 });
    // And past the origin, like every other way of moving it.
    for (let i = 0; i < 4; i++) await page.locator(`${bar} [data-fa-step="ArrowLeft"]`).click();
    expect((await geom(page)).left).toBe(-32);
  });

  test("Done leaves the mode, and focus goes back to ✜", async ({ page }) => {
    await pullBook(page);
    const move = page.locator(`${book} [data-fa-control="move"]`);
    await move.click();
    await page.locator(`${bar} [data-fa-step="done"]`).click();
    await expect(page.locator(book)).toHaveAttribute("data-fa-moving", "false");
    await expect(move).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(bar)).toBeHidden();
    await expect(move).toBeFocused();
  });

  test("the bar's buttons work from the keyboard, and Escape there leaves the mode, not the glass", async ({ page }) => {
    await pullBook(page);
    await page.locator(`${book} [data-fa-control="move"]`).click();
    await page.locator(`${bar} [data-fa-step="ArrowRight"]`).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    expect((await geom(page)).left).toBe(32);
    await page.keyboard.press("Escape");
    await expect(page.locator(book)).toHaveAttribute("data-fa-moving", "false");
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
  });
});

/* ── 3. "clicking on glass, but not avatar, should pan the glass" ──────────── */
test.describe("empty glass pans — \"clicking on glass, but not avatar, should pan the glass\"", () => {
  test("a finger on empty glass BESIDE the cards pans it", async ({ browser }) => {
    const { ctx, page, touch } = await touchPage(() =>
      browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } }));
    await page.click('[data-fa-library-item="who-iris/book"] .fa-pullout');
    await page.click(".fa-glass-handle");
    // Zoomed out, the shelf's own box shrinks with it: the right of the glass
    // is empty glass that is NOT the shelf, which is where a finger failed.
    for (let i = 0; i < 5; i++) await page.click('[data-fa-zoom-control="out"]');
    const at = { x: 900, y: 300 };
    const under = await page.evaluate(([x, y]) => (document.elementFromPoint(x, y) as HTMLElement).className, [at.x, at.y]);
    expect(under).toBe("fa-glass-sheet");
    const before = await transformOf(page);
    await touch("touchStart", [at]);
    for (let i = 1; i <= 5; i++) await touch("touchMove", [{ x: at.x - 20 * i, y: at.y + 10 * i }]);
    await touch("touchEnd", []);
    const t = await transformOf(page);
    expect(t).not.toBe(before);
    expect(t).toMatch(/scale\(0\.5\)$/);
    await ctx.close();
  });

  test("two fingers landing on empty glass beside the shelf still pinch", async ({ browser }) => {
    const { ctx, page, touch } = await touchPage(() =>
      browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } }));
    await page.click(".fa-glass-handle");
    for (let i = 0; i < 5; i++) await page.click('[data-fa-zoom-control="out"]');
    const cx = 850, cy = 250;
    await touch("touchStart", [{ x: cx - 40, y: cy }, { x: cx + 40, y: cy }]);
    for (const d of [50, 60, 70, 80]) await touch("touchMove", [{ x: cx - d, y: cy }, { x: cx + d, y: cy }]);
    await touch("touchEnd", []);
    // Fingers twice as far apart: twice the zoom, from 50%.
    await expect.poll(() => page.locator(shelf).evaluate((n) => Number(n.getAttribute("data-fa-scale")))).toBe(1);
    await ctx.close();
  });

  test("a mouse drag on empty glass beside a zoomed-out shelf pans it", async ({ page }) => {
    await pullBook(page);
    for (let i = 0; i < 5; i++) await page.click('[data-fa-zoom-control="out"]');
    const before = await transformOf(page);
    const m = before.match(/translate\((-?\d+)px, (-?\d+)px\)/)!;
    await page.mouse.move(1100, 300);
    await page.mouse.down();
    await page.mouse.move(1000, 350, { steps: 5 });
    await page.mouse.up();
    expect(await transformOf(page)).toBe(`translate(${Number(m[1]) - 100}px, ${Number(m[2]) + 50}px) scale(0.5)`);
  });

  test("a CLICK on empty glass is still just a click: nothing pans, and an open panel stays open", async ({ page }) => {
    await pullBook(page);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await expect(page.locator(".fa-glass-panel")).toBeVisible();
    await page.mouse.click(1100, 300);
    expect(await transformOf(page)).toBe("");
    await expect(page.locator(".fa-glass-panel")).toBeVisible();
  });
});

/* ── 4. "drag drop avatar and cant un-drag when not on avata/inteact w/ todos" ── */
test.describe("a drag always ends, and never buries the todos — \"cant un-drag … inteact w/ todos\"", () => {
  test("a release the page never heard ends the drag at the next move", async ({ page }) => {
    // What a browser reports when the button came up somewhere the page could
    // not hear it — past the window's edge, over the browser's own chrome: the
    // pointer moves on with NO button held, and no pointerup ever arrives.
    await pullBook(page);
    const cdp = await page.context().newCDPSession(page);
    const p = await coverMiddle(page);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y, button: "none", buttons: 0 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", buttons: 1, clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x + 40, y: p.y, button: "left", buttons: 1 });
    expect((await geom(page)).left).toBe(40);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x + 60, y: p.y, button: "none", buttons: 0 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x + 300, y: p.y + 200, button: "none", buttons: 0 });
    // The card stayed where the drag ended; it does not follow a free pointer.
    expect((await geom(page)).left).toBeLessThanOrEqual(60);
    expect((await geom(page)).top).toBe(0);
  });

  test("dropped on empty glass after several drags, a card never covers the Todos tile — a todo still comes out", async ({ page }) => {
    await pullBook(page);
    // Every press raises a card; a card raised often enough used to climb over
    // the strip, the zoom bar and the panel.
    for (let i = 0; i < 4; i++) await drag(page, await coverMiddle(page), 8, 8);
    const tile = page.locator('.fa-glass-tiles [data-fa-glass-chrome="glass-todos"]');
    const tb = (await tile.boundingBox())!;
    await drag(page, await coverMiddle(page), 0, tb.y - (await coverMiddle(page)).y);
    await tile.click({ timeout: 3000 });
    await expect(page.locator(".fa-glass-panel")).toHaveAttribute("data-fa-panel", "glass-todos");
    await page.locator('[data-fa-library-item="todo/t-one"] .fa-pullout').click({ timeout: 3000 });
    await expect(page.locator(todo)).toBeVisible();
  });

  test("dropped OUTSIDE the glass — on its handle — the drag ends and a todo on the glass still answers", async ({ page }) => {
    await pullBook(page);
    await page.click('[data-fa-glass-chrome="glass-todos"]');
    await page.locator('[data-fa-library-item="todo/t-one"] .fa-pullout').click();
    await page.click('[data-fa-glass-chrome="glass-todos"]');
    const h = (await page.locator(".fa-glass-handle").boundingBox())!;
    const from = await coverMiddle(page);
    await drag(page, from, h.x + 5 - from.x, h.y + 5 - from.y);
    const settled = await geom(page);
    await page.mouse.move(700, 500, { steps: 4 });
    expect(await geom(page)).toEqual(settled);
    const move = page.locator(`${todo} [data-fa-control="move"]`);
    await move.click({ timeout: 3000 });
    await expect(page.locator(todo)).toHaveAttribute("data-fa-moving", "true");
  });

  test("Escape cancels a drag: the card goes back, and the glass stays down", async ({ page }) => {
    await pullBook(page);
    const p = await coverMiddle(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 150, p.y + 60, { steps: 5 });
    expect(await geom(page)).toEqual({ left: 150, top: 60 });
    await page.keyboard.press("Escape");
    expect(await geom(page)).toEqual({ left: 0, top: 0 });
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
    // The drag is OVER, not paused: moving on moves nothing, and nor does the release.
    await page.mouse.move(p.x + 300, p.y + 100, { steps: 3 });
    await page.mouse.up();
    expect(await geom(page)).toEqual({ left: 0, top: 0 });
    // Nor was the cancelled place saved.
    await page.reload();
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    await open(page);
    expect(await geom(page)).toEqual({ left: 0, top: 0 });
  });
});
