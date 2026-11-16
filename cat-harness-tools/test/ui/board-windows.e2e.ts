/**
 * Semantic zoom and windows, in the real `docs-ui.js`.
 *
 * Bean `folio-assistant-51wf`. Owner, 2026-09-20: *"start everyrting in
 * avatar"*, `[x]` closes to the avatar, and on which mechanism wins —
 *
 * > open is like window, avatar/tiles project open panels onto window. sum
 * > functionality, need to handle z-order.. selecting any part raises
 *
 * ## Why this file mirrors `schemas/window-stack.test.ts` case for case
 *
 * The stack's rules are specified and unit-tested in `schemas/ui/window-stack.ts`;
 * `docs-ui.js` is a browser script and cannot import it, so there are two
 * implementations of one rule and they can drift. That cost is named rather
 * than hoped away: every rule the unit test pins has a case here against the
 * real file, so a drift fails one of the two.
 *
 * ## The board no longer zooms — #1925
 *
 * Owner, 2026-10-02: *"upper smaller same size closed looks niceer"*. Every
 * board slot is its closed tile at every width, so semantic zoom is the
 * GLASS's now (`glass-zoom-steady.e2e.ts`). The bean's trap — *"zoom falsified
 * in BOTH directions"* — is kept the other way round: the tile is checked on
 * both sides of the declared threshold, so a board that quietly started
 * zooming again fails here.
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

const ITEMS = ["alpha", "beta", "gamma"].map((id, i) => ({
  id,
  summary: `Card ${id}`,
  comment: `Body of ${id}.`,
  status: "open",
  priority: "high",
  origin: "agent",
  createdAt: `2026-09-1${i}`,
  tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
  relations: [],
}));

/** A declared threshold with one kind override, so provenance is exercised. */
const ZOOM = {
  $schema: "folio-semantic-zoom/v1",
  belowPx: 200,
  byKind: { todo: { belowPx: 320, because: "a todo carries a summary sentence" } },
};

const URL_BOARD = "http://board.test/page.html";

/** `.fa-landing-board` is what makes the board render INLINE rather than hidden. */
function page(withZoom: boolean, widthPx: number): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
${withZoom ? '<meta name="fa-zoom-src" content="/assets/semantic-zoom.json">' : ""}
<style>${CSS}
/* The board's width, on both sides of the declared threshold. The grid's own
   tracks are the stylesheet's: every slot is one fixed-size tile. */
.fa-sticky-board { width: ${widthPx + 40}px; }
</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <div class="fa-landing-board"></div>
</div></div>
<script>${JS}</script></body></html>`;
}

async function boot(page_: import("@playwright/test").Page): Promise<void> {
  await page_.waitForFunction(() =>
    Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard),
  );
}

function routes(withZoom: boolean, widthPx: number) {
  return async (page_: import("@playwright/test").Page) => {
    await page_.route("http://board.test/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/page.html")) {
        return route.fulfill({ contentType: "text/html", body: page(withZoom, widthPx) });
      }
      if (url.endsWith("/assets/todos/index.json")) {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ $schema: "folio-todo-index/v1", items: ITEMS }),
        });
      }
      if (url.endsWith("/assets/semantic-zoom.json")) {
        return withZoom
          ? route.fulfill({ contentType: "application/json", body: JSON.stringify(ZOOM) })
          : route.fulfill({ status: 404, body: "not found" });
      }
      return route.fulfill({ status: 404, body: "not found" });
    });
  };
}

test.describe("every card starts as its avatar", () => {
  test("an avatar per card, and no window open, at a width well above the threshold", async ({ page: p }) => {
    // "start everyrting in avatar" is about the OPEN state, and it holds at
    // any width: nothing is open until somebody opens it.
    await routes(true, 600)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    await expect(p.locator(".fa-sticky-avatar")).toHaveCount(3);
    await expect(p.locator(".fa-board-window")).toHaveCount(0);
  });

  test("every avatar is the one sticky tile, named by its own words — never blank", async ({ page: p }) => {
    // #1925: one component for every sticky. The tile says its kind and
    // carries the card's own title, so no avatar is an empty square.
    await routes(true, 600)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    const kinds = await p
      .locator(".fa-sticky-avatar")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.faStickyKind));
    expect(new Set(kinds)).toEqual(new Set(["todo"]));
    await expect(p.locator(".fa-sticky-avatar").first().locator(".fa-sticky-tile-title")).toHaveText("Card alpha");
    const box = await p.locator(".fa-sticky-avatar").first().boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);
  });
});

test.describe("no semantic zoom on the board — checked on BOTH sides of the threshold", () => {
  /** Each slot's tile size, and whether any slot carries a zoom state. */
  async function tiles(p: import("@playwright/test").Page) {
    return p.locator(".fa-sticky-slot").evaluateAll((els) => els.map((e) => {
      const t = e.querySelector(".fa-sticky-tile")!.getBoundingClientRect();
      return { w: Math.round(t.width), h: Math.round(t.height), zoom: e.getAttribute("data-fa-avatar") };
    }));
  }

  test("above the declared threshold every slot is its closed tile", async ({ page: p }) => {
    await routes(true, 400)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    const t = await tiles(p);
    expect(t.length).toBe(3);
    for (const x of t) expect(x.zoom).toBeNull();
    await expect(p.locator(".fa-sticky-slot > .fa-sticky").first()).toBeHidden();
  });

  test("below it, the same tiles at the same size — nothing flips", async ({ page: p }) => {
    // 320 is the `todo` override: below it a zooming board would have flipped.
    await routes(true, 400)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    const wide = await tiles(p);
    await routes(true, 240)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    const narrow = await tiles(p);
    expect(narrow).toEqual(wide);
    await expect(p.locator(".fa-sticky-slot > .fa-sticky-tile").first()).toBeVisible();
  });

  test("with NO declaration the board is the same tiles — the threshold is never invented", async ({ page: p }) => {
    await routes(false, 100)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    await expect(p.locator('.fa-sticky-slot[data-fa-avatar="true"]')).toHaveCount(0);
    await expect(p.locator(".fa-sticky-slot > .fa-sticky-tile")).toHaveCount(3);
  });
});

test.describe("opening projects a window", () => {
  test("clicking an avatar opens one; `[x]` closes it back to the avatar", async ({ page: p }) => {
    await routes(true, 600)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    await p.locator(".fa-sticky-avatar").first().click();
    await expect(p.locator(".fa-board-window")).toHaveCount(1);
    await p.locator('[data-fa-control="close"]').click();
    await expect(p.locator(".fa-board-window")).toHaveCount(0);
    // The avatar is still there, and focus came back to it — the way back is
    // reachable, which is the whole of `l4zi`.
    await expect(p.locator(".fa-sticky-avatar").first()).toBeFocused();
  });

  test("opening an already-open card raises it rather than opening a second", async ({ page: p }) => {
    await routes(true, 600)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    const first = p.locator(".fa-sticky-avatar").nth(0);
    await first.click();
    await p.locator(".fa-sticky-avatar").nth(1).click();
    // Driven from the KEYBOARD, because by now a window is painted over the
    // first avatar and moving one is `le8b`'s, not this unit's. Focus does not
    // care what is on top, which is exactly why the keyboard path has to work
    // — and it is the path this layer's low-dexterity profile relies on.
    await first.focus();
    await p.keyboard.press("Enter");
    await expect(p.locator(".fa-board-window")).toHaveCount(2);
    await expect(p.locator('.fa-board-window[data-fa-window="alpha"]')).toHaveAttribute(
      "data-fa-z",
      "2",
    );
  });

  test("the avatar is keyboard-operable — a board action is never mouse-only", async ({ page: p }) => {
    await routes(true, 600)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    await p.locator(".fa-sticky-avatar").first().focus();
    await p.keyboard.press("Enter");
    await expect(p.locator(".fa-board-window")).toHaveCount(1);
  });
});

test.describe("an open window survives anything the grid does", () => {
  test("the grid reflows and the window stays", async ({ page: p }) => {
    // The window is a separate layer, not the card grown large — so a
    // reflow of the grid under it changes nothing about it.
    await routes(true, 600)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    await p.locator(".fa-sticky-avatar").first().click();
    await expect(p.locator(".fa-board-window")).toHaveCount(1);
    await p.evaluate(() => {
      const board = document.querySelector(".fa-sticky-board") as HTMLElement;
      board.style.width = "180px";
    });
    await expect(p.locator(".fa-board-window")).toHaveCount(1);
    await expect(p.locator(".fa-board-window")).toBeVisible();
  });
});

test.describe("selecting any part raises it", () => {
  test("a click anywhere in a window puts it on top", async ({ page: p }) => {
    await routes(true, 600)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    await p.locator(".fa-sticky-avatar").nth(0).click();
    await p.locator(".fa-sticky-avatar").nth(1).click();
    await expect(p.locator('.fa-board-window[data-fa-window="beta"]')).toHaveAttribute("data-fa-z", "2");

    // The lower window's TITLE BAR, which the cascade deliberately leaves
    // visible — "selecting any part raises". If this ever needs a force click
    // the cascade has become tight enough to bury the bar, which is the defect
    // the offsets exist to prevent.
    await p.locator('.fa-board-window[data-fa-window="alpha"] .fa-board-window-title').click();
    await expect(p.locator('.fa-board-window[data-fa-window="alpha"]')).toHaveAttribute("data-fa-z", "2");
    await expect(p.locator('.fa-board-window[data-fa-window="beta"]')).toHaveAttribute("data-fa-z", "1");
  });

  test("no two open windows share a stacking index", async ({ page: p }) => {
    await routes(true, 600)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    for (const i of [0, 1, 2]) {
      await p.locator(".fa-sticky-avatar").nth(i).focus();
      await p.keyboard.press("Enter");
    }
    const zs = await p
      .locator(".fa-board-window")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.faZ));
    expect(new Set(zs).size).toBe(zs.length);
    expect(zs.length).toBe(3);
  });

  test("closing the middle one leaves the rest contiguous", async ({ page: p }) => {
    await routes(true, 600)(p);
    await p.goto(URL_BOARD);
    await boot(p);
    for (const i of [0, 1, 2]) {
      await p.locator(".fa-sticky-avatar").nth(i).focus();
      await p.keyboard.press("Enter");
    }
    // Raise it first, the way a person would: a covered window's `[x]` is
    // reached by selecting the window, not by clicking through what is on top
    // of it.
    await p.locator('.fa-board-window[data-fa-window="beta"] .fa-board-window-title').click();
    await p.locator('.fa-board-window[data-fa-window="beta"] [data-fa-control="close"]').click();
    await expect(p.locator(".fa-board-window")).toHaveCount(2);
    const zs = await p
      .locator(".fa-board-window")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.faZ).sort());
    expect(zs).toEqual(["1", "2"]);
  });
});
