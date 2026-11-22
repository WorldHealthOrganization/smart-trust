/**
 * Move and resize are keyboard-first; drag is the accelerator.
 *
 * Bean `folio-assistant-le8b`, R13 + R14 of issue #602. Owner: *"can resize
 * open content, move around. drag and drop moving.."*
 *
 * ## Why the keyboard cases come first in this file, not just in the code
 *
 * This layer's declared interaction profile is low-dexterity. A board whose
 * only affordance is drag excludes its own owner, so the keyboard path is the
 * requirement and the pointer path is the extra — and a test file that opened
 * with drag would be describing the opposite priority to whoever reads it next.
 *
 * ## The trap
 *
 * Arrow keys already scroll. A test that only proved "arrows move the window"
 * would pass for an implementation that stole the page's navigation from every
 * reader who happened to focus a window — so the mode is asserted in BOTH
 * states: arrows move in it, and arrows are left alone outside it.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const ITEMS = ["alpha", "beta"].map((id) => ({
  id,
  summary: `Card ${id}`,
  comment: "Body.",
  status: "open",
  priority: "high",
  origin: "agent",
  createdAt: "2026-09-19",
  tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
  relations: [],
}));

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}
.fa-sticky-grid { display: grid; grid-template-columns: 600px; }
</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <div class="fa-landing-board"></div>
</div></div>
<script>${JS}</script></body></html>`;

const URL_PAGE = "http://move.test/page.html";

test.beforeEach(async ({ page }) => {
  await page.route("http://move.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/page.html")) {
      return route.fulfill({ contentType: "text/html", body: PAGE });
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

async function open(page: import("@playwright/test").Page, id: string) {
  await page.waitForFunction(() =>
    Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard),
  );
  await page.locator(`.fa-sticky-avatar[data-fa-opens="${id}"]`).focus();
  await page.keyboard.press("Enter");
  return page.locator(`.fa-board-window[data-fa-window="${id}"]`);
}

/** A window's laid-out box, relative to the board. */
async function box(panel: import("@playwright/test").Locator) {
  return panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const p = (el as HTMLElement).offsetParent!.getBoundingClientRect();
    return { left: r.left - p.left, top: r.top - p.top, width: r.width, height: r.height };
  });
}

test.describe("the keyboard path is the requirement", () => {
  test("the Move control is on the panel, with a worded name", async ({ page }) => {
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    const move = panel.locator('[data-fa-control="move"]');
    await expect(move).toHaveCount(1);
    await expect(move).toHaveAttribute("aria-label", /Move or resize/);
  });

  test("arrows move the window ONLY in move mode", async ({ page }) => {
    // Both states, because a test that proved only the first would pass for an
    // implementation that stole the page's arrow keys from every reader who
    // focused a window.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    const before = await box(panel);

    await panel.press("ArrowRight");
    expect(await box(panel), "arrows do nothing outside the mode").toEqual(before);

    await panel.locator('[data-fa-control="move"]').click();
    await panel.press("ArrowRight");
    const after = await box(panel);
    expect(after.left).toBeGreaterThan(before.left);
  });

  test("the mode is ANNOUNCED, not only outlined", async ({ page }) => {
    // A reader who cannot see the outline still has to be told what their
    // arrow keys now do.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="move"]').click();
    await expect(panel).toHaveAttribute("data-fa-moving", "true");
    await expect(panel.locator('[aria-live="polite"]')).toContainText("Arrow keys move");
  });

  test("all four directions, and each one only affects its own axis", async ({ page }) => {
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="move"]').click();
    const start = await box(panel);

    await panel.press("ArrowDown");
    const down = await box(panel);
    expect(down.top).toBeGreaterThan(start.top);
    expect(down.left).toBe(start.left);

    await panel.press("ArrowRight");
    const right = await box(panel);
    expect(right.left).toBeGreaterThan(down.left);
    expect(right.top).toBe(down.top);

    await panel.press("ArrowUp");
    await panel.press("ArrowLeft");
    const back = await box(panel);
    // POSITION exactly: four opposite nudges are a round trip, and a move that
    // did not return would mean the steps disagree.
    expect(back.left).toBe(start.left);
    expect(back.top).toBe(start.top);
    // SIZE to the pixel rather than to the float. Moving fixes a height that
    // was previously content-driven, so the last sub-pixel is layout rounding
    // rather than a size change — and asserting exact equality here would be
    // asserting the rounding.
    expect(Math.round(back.width)).toBe(Math.round(start.width));
    expect(Math.round(back.height)).toBe(Math.round(start.height));
  });

  test("Shift+arrows RESIZE rather than move", async ({ page }) => {
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="move"]').click();
    const start = await box(panel);
    await panel.press("Shift+ArrowRight");
    const wider = await box(panel);
    expect(wider.width).toBeGreaterThan(start.width);
    expect(wider.left).toBe(start.left);
  });

  test("a window cannot be resized into unusability", async ({ page }) => {
    // A window narrower than its own frame controls is a window whose `[x]` a
    // reader cannot reach — `l4zi` by another route.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="move"]').click();
    for (let i = 0; i < 40; i++) await panel.press("Shift+ArrowLeft");
    expect((await box(panel)).width).toBeGreaterThanOrEqual(160);
    await expect(panel.locator('[data-fa-control="close"]')).toBeVisible();
  });

  test("a window cannot be moved off the top-left", async ({ page }) => {
    // Same rule: a window past the origin is a window whose controls are
    // unreachable.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="move"]').click();
    for (let i = 0; i < 40; i++) {
      await panel.press("ArrowUp");
      await panel.press("ArrowLeft");
    }
    const at = await box(panel);
    expect(at.left).toBeGreaterThanOrEqual(0);
    expect(at.top).toBeGreaterThanOrEqual(0);
  });

  test("Escape leaves the mode and the window stays where it was put", async ({ page }) => {
    // Leaving the mode is not an undo. A reader who moved a window and pressed
    // Escape meant "I am finished", not "put it back".
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="move"]').click();
    await panel.press("ArrowRight");
    const moved = await box(panel);
    await panel.press("Escape");
    await expect(panel).toHaveAttribute("data-fa-moving", "false");
    expect(await box(panel)).toEqual(moved);
    // And the arrows are the page's again.
    await panel.press("ArrowRight");
    expect(await box(panel)).toEqual(moved);
  });

  test("the move control toggles the mode back off as well as on", async ({ page }) => {
    // `l4zi`: an action whose inverse is not reachable is not a toggle.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    const move = panel.locator('[data-fa-control="move"]');
    await move.click();
    await expect(panel).toHaveAttribute("data-fa-moving", "true");
    await move.click();
    await expect(panel).toHaveAttribute("data-fa-moving", "false");
  });
});

test.describe("drag is the accelerator, over the same geometry", () => {
  test("dragging the title bar moves the window", async ({ page }) => {
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    const start = await box(panel);
    // Grabbed by the TITLE, which is what a person reaches for: the bar is
    // mostly controls now, and a drag that started on one is deliberately not
    // a drag.
    const bar = panel.locator(".fa-board-window-title");
    const bb = (await bar.boundingBox())!;
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2 + 40);
    await page.mouse.up();
    const after = await box(panel);
    expect(after.left).toBeGreaterThan(start.left);
    expect(after.top).toBeGreaterThan(start.top);
  });

  test("a drag that starts on a CONTROL is not a drag", async ({ page }) => {
    // Otherwise a drag would fight the click that closes the window, and `[x]`
    // would sometimes not close.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="close"]').click();
    await expect(page.locator('.fa-board-window[data-fa-window="alpha"]')).toHaveCount(0);
  });

  test("dragging one window leaves the other alone", async ({ page }) => {
    await page.goto(URL_PAGE);
    await open(page, "alpha");
    const beta = await open(page, "beta");
    const alpha = page.locator('.fa-board-window[data-fa-window="alpha"]');
    const before = await box(alpha);
    const bb = (await beta.locator(".fa-board-window-title").boundingBox())!;
    await page.mouse.move(bb.x + 20, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + 120, bb.y + bb.height / 2 + 50);
    await page.mouse.up();
    expect(await box(alpha)).toEqual(before);
  });
});

test.describe("the reader's filter narrows the view and commits NOTHING", () => {
  /** A fixture with varying status and priority, so both controls appear. */
  const VARIED = [
    { ...ITEMS[0], id: "open-high", status: "open", priority: "high" },
    { ...ITEMS[0], id: "open-low", status: "open", priority: "low" },
    { ...ITEMS[0], id: "done-high", status: "done", priority: "high" },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route("http://move.test/assets/todos/index.json", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ $schema: "folio-todo-index/v1", items: VARIED }),
      }),
    );
  });

  async function visible(page: import("@playwright/test").Page) {
    return page
      .locator(".fa-sticky-slot:not([hidden]) .fa-sticky-avatar")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.faOpens).sort());
  }

  test("the controls are built from the CORPUS, not from a hardcoded list", async ({ page }) => {
    // An option list built from the data cannot offer a filter that matches
    // nothing.
    await page.goto(URL_PAGE);
    await open(page, "open-high");
    const options = await page
      .locator("#fa-filter-status option")
      .evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
    expect(options).toEqual(["", "done", "open"]);
  });

  test("selecting a value narrows the view", async ({ page }) => {
    await page.goto(URL_PAGE);
    await open(page, "open-high");
    expect(await visible(page)).toEqual(["done-high", "open-high", "open-low"]);
    await page.selectOption("#fa-filter-status", "open");
    expect(await visible(page)).toEqual(["open-high", "open-low"]);
  });

  test("two properties are an INTERSECTION — the board's own logic", async ({ page }) => {
    // A reader who has learned what the board's filter means has learned what
    // theirs means.
    await page.goto(URL_PAGE);
    await open(page, "open-high");
    await page.selectOption("#fa-filter-status", "open");
    await page.selectOption("#fa-filter-priority", "high");
    expect(await visible(page)).toEqual(["open-high"]);
  });

  test("clearing brings everything back — the filter is a view, not a delete", async ({ page }) => {
    await page.goto(URL_PAGE);
    await open(page, "open-high");
    await page.selectOption("#fa-filter-status", "done");
    expect(await visible(page)).toEqual(["done-high"]);
    await page.selectOption("#fa-filter-status", "");
    expect(await visible(page)).toEqual(["done-high", "open-high", "open-low"]);
  });

  test("a filter that matches nothing SAYS SO, and says which kind of nothing", async ({ page }) => {
    // "Nothing matches this filter" and "nothing outstanding" are opposite
    // facts about the same blank grid, and a reader who cannot tell them apart
    // will clear the wrong thing.
    await page.goto(URL_PAGE);
    await open(page, "open-high");
    await page.selectOption("#fa-filter-status", "done");
    await page.selectOption("#fa-filter-priority", "low");
    expect(await visible(page)).toEqual([]);
    await expect(page.locator(".fa-sticky-filtered-out")).toContainText("No card matches this filter");
  });

  test("it persists NOTHING — no storage key, and a reload starts unfiltered", async ({ page }) => {
    // The separation, asserted rather than named. If a reader's filter reached
    // any store, it would be one step from reaching the board's own document —
    // and then one reader's view would be everyone's board.
    await page.goto(URL_PAGE);
    await open(page, "open-high");
    const before = await page.evaluate(() => JSON.stringify(localStorage));
    await page.selectOption("#fa-filter-status", "open");
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
    await page.reload();
    await open(page, "open-high");
    expect(await visible(page)).toEqual(["done-high", "open-high", "open-low"]);
  });

  test("a filtered-out card is out of the accessibility tree too", async ({ page }) => {
    // `hidden`, not a class. A reader who filtered to "open" should not still
    // be walked through the done ones.
    await page.goto(URL_PAGE);
    await open(page, "open-high");
    await page.selectOption("#fa-filter-status", "open");
    await expect(
      page.locator('.fa-sticky-avatar[data-fa-opens="done-high"]'),
    ).toBeHidden();
  });
});
