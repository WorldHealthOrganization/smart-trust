import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { resolveChromium } from "../scripts/playwright-chromium";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { ensureThemesCss } from "./support/themes-css.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * SMALL IS NOT BLANK, AND THE ZOOM CONTROLS DO NOT MOVE — owner, 2026-10-01:
 *
 * > if todo is small zoomed, it shows no content at all. instead it should
 * > cleanup whitespace and show condended first part of todo that is dsplay.
 * > also, when zoom in/out, the buttons dont stay same place so have to move
 * > cursor... not good.
 *
 * The owner has limited hand function, so the second sentence is an
 * accessibility defect: a control that moves under the pointer after a press
 * is a re-aim per press. Each test here was seen to FAIL against the code
 * before the fix and pass after it.
 *
 * ## Classic scrollbars, on purpose
 *
 * Playwright launches Chromium with `--hide-scrollbars`, which makes every
 * scrollbar an overlay that takes no width. The zoom bar's jump is exactly a
 * scrollbar TAKING width — the glass overflows on a zoom-in, the content box
 * narrows by 15px, and the right-aligned bar slides left — so with the default
 * flag the defect is invisible and a test of it passes over the bug. This file
 * drops the flag, so it runs with the scrollbars a desktop reader has.
 */
test.use({
  launchOptions: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ignoreDefaultArgs: ["--hide-scrollbars"],
    executablePath: resolveChromium(process.env as Record<string, string | undefined>).path,
  },
});

const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const THEMES = readFileSync(ensureThemesCss(ROOT), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const ART_PATH = "/assets/img/harness/landing-library-card.webp";
const ART = readFileSync(overlayPath(join(ROOT, SITE, ART_PATH.slice(1))));

const GLASS = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Glass</title>
<style>${CSS}</style><style>${THEMES}</style></head><body><main><p>A page.</p></main>
<script>${JS}</script></body></html>`;

const SUMMARY = "The human-todos page   still says\n'Not built yet'";
const TODOS = {
  items: [
    {
      id: "t-one",
      summary: SUMMARY,
      // Runs of spaces, blank lines, a heading, emphasis and a list: the noise
      // the small state must condense away.
      comment: "The page opens **\"Not built yet\"**,   and that is\n\n\nno longer *true*.\n\n" +
        "## What it still gets right\n\n- Do not repurpose beans.\n- When a todo is shown.",
      status: "open",
      priority: "medium",
      theme: "library",
      relations: [],
    },
    { id: "t-two", summary: "Second   thing\n\nto do", comment: "", status: "open", priority: "low", relations: [] },
  ],
  themeArt: { library: { card: ART_PATH, laptop: ART_PATH, mobile: ART_PATH } },
};
const ZOOM = { belowPx: 220, byKind: { todo: { belowPx: 300, because: "a todo needs more room" } } };

async function serveGlass(page: Page, height: number) {
  await page.setViewportSize({ width: 1280, height });
  // The strip starts HIDDEN on a first open (owner, 2026-10-01, bean `ob3m`
  // finding 10). These specs click a strip tile, so they arrive as a reader
  // who has shown it; `glass-strip-default-hidden.e2e.ts` holds the default.
  await page.addInitScript(() => {
    try { if (localStorage.getItem("fa-glass-strip-hidden") === null) localStorage.setItem("fa-glass-strip-hidden", "0"); } catch { /* no storage */ }
  });
  await page.route("http://replica.test/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: GLASS });
    if (url.pathname === "/assets/todos/index.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(TODOS) });
    }
    if (url.pathname === "/assets/semantic-zoom.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(ZOOM) });
    }
    if (url.pathname === ART_PATH) return route.fulfill({ contentType: "image/webp", body: ART });
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto("http://replica.test/page.html");
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  await page.click(".fa-glass-handle");
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
  await page.click('[data-fa-glass-chrome="glass-todos"]');
  await page.locator('[data-fa-library-item="todo/t-one"] .fa-pullout').click();
  await page.locator('[data-fa-library-item="todo/t-two"] .fa-pullout').click();
  await page.click('[data-fa-glass-chrome="glass-todos"]');
  await expect(page.locator(themed)).toBeVisible();
  // The themed card is dressed from the index asynchronously; wait for it.
  await expect(page.locator(`${themed} .fa-glass-sticky-body`)).toBeAttached();
}

const themed = '.fa-glass-asset[data-fa-asset="todo/t-one"]';
const plain = '.fa-glass-asset[data-fa-asset="todo/t-two"]';
const zoomOut = async (page: Page, n: number) => {
  for (let i = 0; i < n; i++) await page.click('[data-fa-zoom-control="out"]');
};

/** What a sighted reader sees of an element: its rendered text, if it is drawn at all. */
const seen = (l: Locator) => l.evaluate((n) => {
  const e = n as HTMLElement;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" ? e.innerText : "";
});

test.describe("a todo zoomed small shows its first words, condensed — not nothing", () => {
  test("zoomed out to its avatar, a themed todo shows its gist: visible, whitespace-collapsed, no markdown", async ({ page }) => {
    await serveGlass(page, 800);
    await zoomOut(page, 7); // 30%
    const card = page.locator(themed);
    await expect(card).toHaveAttribute("data-fa-zoom", "avatar");
    const gist = card.locator(".fa-glass-asset-gist");
    await expect(gist).toBeVisible();
    const text = await gist.evaluate((n) => n.textContent || "");
    // The FIRST part of what the todo displays — its title, then its words.
    expect(text.startsWith("The human-todos page still says 'Not built yet'")).toBe(true);
    expect(text).toContain("The page opens \"Not built yet\", and that is no longer true.");
    // Whitespace collapsed and markdown dropped.
    expect(text).not.toMatch(/\s{2,}|\n/);
    expect(text).not.toMatch(/\*|^#|##|(^| )- /);
    // Seen, and at a size that can be read: the shelf's 30% is divided out.
    expect((await seen(gist)).trim().length).toBeGreaterThan(10);
    const px = await gist.evaluate((n) => {
      const shelf = n.closest(".fa-glass-shelf") as HTMLElement;
      return parseFloat(getComputedStyle(n).fontSize) * Number(shelf.getAttribute("data-fa-scale"));
    });
    expect(px).toBeGreaterThanOrEqual(11);
    // Clamped to what fits: the gist's box stays inside its card.
    const g = (await gist.boundingBox())!;
    const c = (await card.boundingBox())!;
    expect(g.y + g.height).toBeLessThanOrEqual(c.y + c.height + 0.5);
    // Still text in the accessibility tree.
    expect(await card.ariaSnapshot()).toContain("The human-todos page still says");
  });

  test("an unthemed todo shows its gist too, on a strip over its plain note", async ({ page }) => {
    await serveGlass(page, 800);
    await zoomOut(page, 7);
    const card = page.locator(plain);
    await expect(card).toHaveAttribute("data-fa-zoom", "avatar");
    expect((await seen(card.locator(".fa-glass-asset-gist"))).replace(/\s+/g, " ").trim()).toBe("Second thing to do");
  });

  test("at full size the gist is not drawn — the title and body already say it", async ({ page }) => {
    await serveGlass(page, 800);
    await expect(page.locator(themed)).toHaveAttribute("data-fa-zoom", "card");
    await expect(page.locator(`${themed} .fa-glass-asset-gist`)).toBeHidden();
  });
});

test.describe("the zoom controls stay where the pointer is", () => {
  const rects = (page: Page) => page.evaluate(() =>
    ["out", "in", "home"].map((k) => {
      const r = document.querySelector(`[data-fa-zoom-control="${k}"]`)!.getBoundingClientRect();
      return { k, x: r.x, y: r.y, w: r.width, h: r.height };
    }));
  const same = (a: { x: number; y: number; w: number; h: number }[], b: typeof a) =>
    a.every((r, i) => Math.abs(r.x - b[i].x) <= 0.5 && Math.abs(r.y - b[i].y) <= 0.5 &&
      Math.abs(r.w - b[i].w) <= 0.5 && Math.abs(r.h - b[i].h) <= 0.5);

  test("−, + and Home do not move across zoom clicks — through the glass starting to overflow and back", async ({ page }) => {
    // 680 tall: the glass fits at 100% and overflows from 105%, so the clicks
    // below cross the moment a scrollbar appears, and Home crosses it back.
    await serveGlass(page, 680);
    const sheet = page.locator(".fa-glass-sheet");
    const start = await rects(page);
    let overflowed = false;
    const moves: string[] = [];
    const press = async (k: string) => {
      await page.click(`[data-fa-zoom-control="${k}"]`);
      overflowed ||= await sheet.evaluate((n) => n.scrollHeight > n.clientHeight);
      const now = await rects(page);
      if (!same(start, now)) moves.push(`${k} → ${JSON.stringify(now)}`);
    };
    for (let i = 0; i < 4; i++) await press("out");
    for (let i = 0; i < 12; i++) await press("in");
    await press("home");
    for (let i = 0; i < 3; i++) await press("in");
    await press("home");
    // The condition the defect needs was actually met, or this test proves nothing.
    expect(overflowed).toBe(true);
    expect(moves, `start ${JSON.stringify(start)}`).toEqual([]);
  });

  test("a card's − and + stay under the pointer as it is resized", async ({ page }) => {
    await serveGlass(page, 800);
    const card = page.locator(plain);
    for (const [label, n] of [["larger", 3], ["smaller", 5], ["larger", 2]] as const) {
      const btn = card.locator(`button[aria-label^="Make Second"][aria-label$=" ${label}"]`);
      for (let i = 0; i < n; i++) {
        const before = (await btn.boundingBox())!;
        await btn.click();
        const after = (await btn.boundingBox())!;
        expect(Math.abs(after.x - before.x), `${label} #${i + 1} x`).toBeLessThanOrEqual(0.5);
        expect(Math.abs(after.y - before.y), `${label} #${i + 1} y`).toBeLessThanOrEqual(0.5);
      }
    }
  });
});

/* ── The same defect on the BOARD: an avatar slot was a bare glyph ───────
 *
 * Since #1925 the board does not zoom at all: every slot is its closed tile,
 * and the tile carries the card's condensed words at every width (owner,
 * 2026-10-02: "upper smaller same size closed looks niceer"). So the defect
 * this half guarded — a closed sticky that was a bare glyph — is asserted on
 * BOTH sides of the declared threshold, against the tile. */
test.describe("a board todo's closed tile shows its first words, at every width", () => {
  const board = (widthPx: number) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<meta name="fa-zoom-src" content="/assets/semantic-zoom.json">
<style>${CSS}
.fa-sticky-board { width: ${widthPx + 40}px; }
</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <div class="fa-landing-board"></div>
</div></div>
<script>${JS}</script></body></html>`;
  const ITEM = {
    id: "alpha", summary: "Card   alpha\n\nsummary", comment: "**Body**   of\n\n- alpha.",
    status: "open", priority: "high", origin: "agent", createdAt: "2026-09-10",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
    relations: [],
  };
  const serveBoard = async (page: Page, widthPx: number) => {
    await page.route("http://board.test/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/page.html")) return route.fulfill({ contentType: "text/html", body: board(widthPx) });
      if (url.endsWith("/assets/todos/index.json")) {
        return route.fulfill({ contentType: "application/json",
          body: JSON.stringify({ $schema: "folio-todo-index/v1", items: [ITEM] }) });
      }
      if (url.endsWith("/assets/semantic-zoom.json")) {
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(ZOOM) });
      }
      return route.fulfill({ status: 404, body: "not found" });
    });
    await page.goto("http://board.test/page.html");
    await page.waitForFunction(() => Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard));
  };

  for (const width of [240, 400]) {
    test(`at ${width}px: the tile is the card's condensed words, and nothing zooms`, async ({ page }) => {
      await serveBoard(page, width);
      const tile = page.locator('.fa-sticky-slot[data-fa-home-slot="alpha"] .fa-sticky-tile');
      await expect(tile).toBeVisible();
      // One line from prose that was never one line — never a bare glyph.
      await expect(tile.locator(".fa-sticky-tile-title")).toHaveText("Card alpha summary");
      await expect(page.locator('.fa-sticky-slot[data-fa-avatar="true"]')).toHaveCount(0);
      await expect(page.locator(".fa-sticky-avatar-gist")).toHaveCount(0);
    });
  }
});
