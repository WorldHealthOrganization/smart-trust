/**
 * A STICKY'S HOME, AND PIN TO THE FOLIO GLASS — beans `pv6g`, `dxje` (#1925).
 *
 * Owner, 2026-09-21: *"stickies can detach from the panel and placed on the
 * 'display window/glass' and dont scroll when the folio/document/page
 * scrolls. when closed tehy returned to their home display panel."*
 *
 * Owner, 2026-10-02: *"pin to glass should pin to folio glass. its not
 * working right."* So Pin is no longer a page-level floating copy in a second
 * store: a pinned sticky IS a folio asset (`todo/<id>` or `landing/<slot>`,
 * `shown: true`), drawn by the glass's own card path with the glass's tools.
 * Unpin shelves it (the entry stays), and the pin is a toggle whose pressed
 * state is the folio store's answer.
 *
 * Three pages, because the rule is about moving BETWEEN them:
 * - LANDING: a landing board whose cells are slots — the home of two stickies
 * - BOARD:   a just-the-docs page with a todo index — the todo board's home
 * - AWAY:    a replica page with neither — the glass is still the reader's
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const cell = (id: string, title: string, body: string) => `
  <div class="fa-sticky-cell" data-fa-home-slot="${id}">
    <article class="fa-sticky fa-landing-sticky" data-fa-sticky-theme="cat" data-fa-art-card="/art/${id}.png"
             aria-labelledby="fa-sticky-${id}-summary">
      <h2 id="fa-sticky-${id}-summary" class="fa-sr-only">${title}</h2>
      <div class="fa-landing-sticky__text"><div class="fa-landing-sticky__body"><p>${body}</p></div></div>
    </article>
  </div>`;

/** The landing page: a slide-away panel holding the landing board, as `landing.html` renders it. */
const LANDING = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Home page</title>
<style>${CSS}</style></head><body>
<details class="fa-sticky-panel" open><summary>Stickies</summary><div class="fa-sticky-panel__body">
<div class="fa-sticky-board fa-landing-board" data-fa-home-panel="landing">
${cell("alpha", "Alpha note", "The alpha body text.")}
${cell("beta", "Beta note", "The beta body text.")}
</div></div></details>
<script>${JS}</script></body></html>`;

/** The landing page WITH a todo index, so the todo board mounts INSIDE the landing board. */
const LANDING_TODOS = LANDING.replace(
  "<title>Home page</title>",
  '<title>Home page</title><meta name="fa-todo-src" content="/assets/todos/index.json">',
);

/** A page with no home panel at all — a library replica. */
const AWAY = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Away</title>
<style>${CSS}</style></head><body><h1>A library page</h1>
<script>${JS}</script></body></html>`;

const ITEMS = [
  { id: "t-one", summary: "First todo", comment: "Why it matters.", status: "open", priority: "high",
    origin: "agent", createdAt: "2026-09-23",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] } },
];

/** A just-the-docs page, so the todo board mounts. */
const BOARD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Board page</title>
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}</style></head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">Site</a></div><nav class="site-nav"></nav></div>
<div class="main-content-wrap"><div class="main-content" id="main-content"><h1>Harness</h1></div></div>
<script>${JS}</script></body></html>`;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.route("http://home.test/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/landing.html") return route.fulfill({ contentType: "text/html", body: LANDING });
    if (path === "/landing-todos.html") return route.fulfill({ contentType: "text/html", body: LANDING_TODOS });
    if (path === "/away.html") return route.fulfill({ contentType: "text/html", body: AWAY });
    if (path === "/board.html") return route.fulfill({ contentType: "text/html", body: BOARD });
    if (path.startsWith("/art/")) return route.fulfill({ contentType: "image/png", body: PNG });
    if (path === "/assets/todos/index.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: ITEMS }) });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
});

const go = async (page: Page, name: string) => {
  await page.goto(`http://home.test/${name}.html`);
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
};
const alphaCell = '[data-fa-home-slot="alpha"]';
const alphaPin = `${alphaCell} .fa-sticky-act-pin`;
const glassCard = (key: string) => `.fa-sticky-layer .fa-glass-asset[data-fa-asset="${key}"]`;
const folio = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fa-folio-assets") || "{}"));
const openGlass = async (page: Page) => {
  await page.locator(".fa-glass-handle").click();
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
};

test.describe("pin puts a landing sticky on the FOLIO glass", () => {
  test("every landing sticky has one pin, unpressed, in its icon row", async ({ page }) => {
    await go(page, "landing");
    await expect(page.locator('[data-fa-home-panel="landing"] .fa-sticky-act-pin')).toHaveCount(2);
    await expect(page.locator(alphaPin)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(alphaPin)).toHaveAttribute("aria-label", "Pin Alpha note to your folio glass");
  });

  test("pinning writes a FOLIO asset, shown, and presses the pin", async ({ page }) => {
    await go(page, "landing");
    await page.locator(alphaPin).click();
    await expect(page.locator(alphaPin)).toHaveAttribute("aria-pressed", "true");
    const store = await folio(page);
    expect(store["landing/alpha"]).toMatchObject({
      shown: true, title: "Alpha note", kind: "sticky", theme: "cat", text: "The alpha body text.",
    });
    // The old second store is not written.
    expect(await page.evaluate(() => localStorage.getItem("fa-pinned-stickies"))).toBeNull();
    // No page-level floating copy any more.
    await expect(page.locator(".fa-sticky-floating")).toHaveCount(0);
  });

  test("the glass draws it with the glass's own card and tools, themed", async ({ page }) => {
    await go(page, "landing");
    await page.locator(alphaPin).click();
    await openGlass(page);
    const card = page.locator(glassCard("landing/alpha"));
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/fa-glass-sticky/);
    await expect(card).toHaveAttribute("data-fa-sticky-theme", "cat");
    await expect(card).toContainText("The alpha body text.");
    await expect(card.locator('.fa-glass-asset-tools [data-fa-control="move"]')).toHaveCount(1);
    await expect(card.locator(".fa-glass-asset-close")).toHaveCount(1);
    // One id, one element: the glass card is built, not cloned.
    expect(await page.locator("#fa-sticky-alpha-summary").count()).toBe(1);
  });

  test("pressing the pin again shelves it — the entry stays, the pin un-presses", async ({ page }) => {
    await go(page, "landing");
    await page.locator(alphaPin).click();
    await page.locator(alphaPin).click();
    await expect(page.locator(alphaPin)).toHaveAttribute("aria-pressed", "false");
    const store = await folio(page);
    expect(store["landing/alpha"]).toMatchObject({ shown: false });
    await openGlass(page);
    await expect(page.locator(glassCard("landing/alpha"))).toHaveCount(0);
  });

  test("the glass's own × shelves it too, and the row's pin follows", async ({ page }) => {
    await go(page, "landing");
    await page.locator(alphaPin).click();
    await openGlass(page);
    await page.locator(`${glassCard("landing/alpha")} .fa-glass-asset-close`).click();
    // × asks first (#1900), and a landing sticky goes back to ITS PAGE, the
    // one it was pinned from: never "your Todos", a list it was never on.
    const dlg = page.getByRole("dialog", { name: "Back on its page?" });
    await expect(dlg).toBeVisible();
    await expect(dlg).not.toContainText("Todos");
    const pinnedFrom = new URL(page.url()).pathname;
    await expect(dlg.getByRole("link").first()).toHaveAttribute("href", pinnedFrom);
    await dlg.getByRole("button", { name: "Put it back" }).click();
    await expect(page.locator(glassCard("landing/alpha"))).toHaveCount(0);
    expect((await folio(page))["landing/alpha"]).toMatchObject({ shown: false });
    await expect(page.locator(alphaPin)).toHaveAttribute("aria-pressed", "false");
  });

  test("a pin, and where it was moved to, survive a reload", async ({ page }) => {
    await go(page, "landing");
    await page.locator(alphaPin).click();
    await openGlass(page);
    const card = page.locator(glassCard("landing/alpha"));
    const left0 = await card.evaluate((n) => parseFloat((n as HTMLElement).style.left));
    await card.locator('[data-fa-control="move"]').click();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Escape");
    await go(page, "landing");
    await expect(page.locator(alphaPin)).toHaveAttribute("aria-pressed", "true");
    await openGlass(page);
    const again = page.locator(glassCard("landing/alpha"));
    await expect(again).toBeVisible();
    expect(await again.evaluate((n) => parseFloat((n as HTMLElement).style.left))).toBeLessThan(left0);
  });

  test("re-pinning puts it back where the reader left it", async ({ page }) => {
    await go(page, "landing");
    await page.locator(alphaPin).click();
    await page.evaluate(() => {
      const m = JSON.parse(localStorage.getItem("fa-folio-assets") || "{}");
      m["landing/alpha"].geom = { left: 40, top: 50, width: 300, height: 300 };
      localStorage.setItem("fa-folio-assets", JSON.stringify(m));
    });
    await page.locator(alphaPin).click();
    await page.locator(alphaPin).click();
    expect((await folio(page))["landing/alpha"].geom).toEqual({ left: 40, top: 50, width: 300, height: 300 });
  });
});

test.describe("the folio is the reader's: a pinned sticky is on every page", () => {
  test("on a page with no home panel it is on the glass, from its stored TEXT", async ({ page }) => {
    await go(page, "landing");
    await page.locator(alphaPin).click();
    await go(page, "away");
    await openGlass(page);
    const card = page.locator(glassCard("landing/alpha"));
    await expect(card).toBeVisible();
    await expect(card).toContainText("Alpha note");
    await expect(card).toContainText("The alpha body text.");
    await expect(card.locator(".fa-glass-asset-name")).toHaveAttribute("href", "/landing.html");
  });

  test("stored text is rendered as TEXT, never as markup", async ({ page }) => {
    await go(page, "away");
    await page.evaluate(() => localStorage.setItem("fa-folio-assets", JSON.stringify({
      "landing/x": { shown: true, kind: "sticky", title: "<img src=x onerror=alert(1)>",
                     text: "<b>bold</b>", href: "javascript:alert(1)", theme: "x\"><b>" },
    })));
    await go(page, "away");
    await openGlass(page);
    const card = page.locator(glassCard("landing/x"));
    await expect(card).toContainText("<img src=x onerror=alert(1)>");
    expect(await card.locator("img[src=x], b").count()).toBe(0);
    // A refused scheme is no link at all, never a link to it.
    expect(await card.locator("a").count()).toBe(0);
  });
});

test.describe("the old pin store migrates into the folio, once", () => {
  test("an old landing pin and an old todo pin become folio assets on the glass", async ({ page }) => {
    await go(page, "away");
    await page.evaluate(() => localStorage.setItem("fa-pinned-stickies", JSON.stringify({
      "landing/alpha": { panel: "landing", slot: "alpha", title: "Alpha note", text: "Old text",
                         href: "/landing.html", label: "Home page",
                         geom: { left: 10, top: 20, width: 240, height: 220 } },
      "todos/t-one": { panel: "todos", slot: "t-one", title: "First todo", text: "", href: "/board.html" },
    })));
    await go(page, "away");
    const store = await folio(page);
    expect(store["landing/alpha"]).toMatchObject({
      shown: true, kind: "sticky", title: "Alpha note", text: "Old text",
      geom: { left: 10, top: 20, width: 240, height: 220 },
    });
    expect(store["todo/t-one"]).toMatchObject({ shown: true, kind: "todos", title: "First todo" });
    expect(await page.evaluate(() => localStorage.getItem("fa-pinned-stickies"))).toBeNull();
    await openGlass(page);
    await expect(page.locator(glassCard("landing/alpha"))).toBeVisible();
    await expect(page.locator(glassCard("todo/t-one"))).toBeVisible();
  });

  test("a folio entry the reader already has is not overwritten by the migration", async ({ page }) => {
    await go(page, "away");
    await page.evaluate(() => {
      localStorage.setItem("fa-folio-assets", JSON.stringify({
        "todo/t-one": { shown: false, kind: "todos", title: "Kept", href: "" },
      }));
      localStorage.setItem("fa-pinned-stickies", JSON.stringify({
        "todos/t-one": { panel: "todos", slot: "t-one", title: "First todo" },
      }));
    });
    await go(page, "away");
    expect((await folio(page))["todo/t-one"]).toMatchObject({ shown: false, title: "Kept" });
  });

  test("the landing page fills in a migrated pin's theme and picture", async ({ page }) => {
    await go(page, "away");
    await page.evaluate(() => localStorage.setItem("fa-pinned-stickies", JSON.stringify({
      "landing/alpha": { panel: "landing", slot: "alpha", title: "Alpha note", text: "Old text" },
    })));
    await go(page, "landing");
    await expect(page.locator(alphaPin)).toHaveAttribute("aria-pressed", "true");
    expect((await folio(page))["landing/alpha"]).toMatchObject({ theme: "cat", art: "/art/alpha.png" });
  });
});

test.describe("the todo board is a home too", () => {
  const openBoard = async (page: Page) => {
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Todos" }).click();
  };
  const todoPin = '[data-fa-home-slot="t-one"] .fa-sticky-act-pin';

  test("pinning a todo puts it on the folio glass under the Todos panel's own key", async ({ page }) => {
    await go(page, "board");
    await openBoard(page);
    await page.locator(todoPin).click();
    await expect(page.locator(todoPin)).toHaveAttribute("aria-pressed", "true");
    expect((await folio(page))["todo/t-one"]).toMatchObject({ shown: true, kind: "todos", title: "First todo" });
    // A fresh page, so the board's launcher is closed and nothing covers the handle.
    await go(page, "board");
    await openGlass(page);
    const card = page.locator(glassCard("todo/t-one"));
    await expect(card).toBeVisible();
    await expect(card.locator(".fa-glass-asset-close")).toHaveCount(1);
  });

  test("it is still pinned on the next page, and the pin un-pins it", async ({ page }) => {
    await go(page, "board");
    await openBoard(page);
    await page.locator(todoPin).click();
    await go(page, "board");
    await openBoard(page);
    await expect(page.locator(todoPin)).toHaveAttribute("aria-pressed", "true");
    await page.locator(todoPin).click();
    await expect(page.locator(todoPin)).toHaveAttribute("aria-pressed", "false");
    expect((await folio(page))["todo/t-one"]).toMatchObject({ shown: false });
  });

  test("with the todo board nested inside the landing board, each panel keeps its own slots", async ({ page }) => {
    // Panels nest: the todo board mounts inside the landing board.
    await go(page, "landing-todos");
    await expect(page.locator('[data-fa-home-panel="landing"] [data-fa-home-panel="todos"]')).toHaveCount(1);
    await expect(page.locator('[data-fa-home-panel="todos"] [data-fa-home-slot="t-one"]')).toHaveCount(1);
    // Each sticky has exactly one pin, keyed to its own folio entry.
    await expect(page.locator('[data-fa-folio-pin="landing/alpha"]')).toHaveCount(1);
    await expect(page.locator('[data-fa-folio-pin="todo/t-one"]')).toHaveCount(1);
  });
});

test.describe("landing stickies start as TILES, and a tile opens a window — bean z1ug", () => {
  test("each landing sticky is a tile; the full card is not drawn in the panel", async ({ page }) => {
    await go(page, "landing");
    await expect(page.locator('[data-fa-home-panel="landing"] .fa-sticky-tile')).toHaveCount(2);
    await expect(page.locator(`${alphaCell} > .fa-sticky`)).toBeHidden();
    await expect(page.locator(alphaPin)).toBeVisible();
  });

  test("pressing a tile opens the full card as a board window", async ({ page }) => {
    await go(page, "landing");
    await page.locator(`${alphaCell} .fa-sticky-tile`).click();
    const win = page.locator('.fa-board-window[data-fa-window="landing:alpha"]');
    await expect(win).toBeVisible();
    await expect(win).toContainText("The alpha body text.");
    await expect(win.locator(".fa-board-window-title")).toHaveText("Alpha note");
    await expect(win).toBeFocused();
    // A COPY — one id, one element.
    expect(await page.locator("#fa-sticky-alpha-summary").count()).toBe(1);
  });

  test("× closes it and focus returns to the tile — the way back", async ({ page }) => {
    await go(page, "landing");
    await page.locator(`${alphaCell} .fa-sticky-tile`).click();
    await page.locator('.fa-board-window[data-fa-window="landing:alpha"] [data-fa-control="close"]').click();
    await expect(page.locator('.fa-board-window[data-fa-window="landing:alpha"]')).toHaveCount(0);
    await expect(page.locator(`${alphaCell} .fa-sticky-tile`)).toBeFocused();
  });

  test("Escape closes it too", async ({ page }) => {
    await go(page, "landing");
    await page.locator(`${alphaCell} .fa-sticky-tile`).click();
    await page.keyboard.press("Escape");
    await expect(page.locator('.fa-board-window[data-fa-window="landing:alpha"]')).toHaveCount(0);
  });

  test("two windows stack — selecting one raises it", async ({ page }) => {
    await go(page, "landing");
    await page.locator(`${alphaCell} .fa-sticky-tile`).click();
    await page.locator('[data-fa-home-slot="beta"] .fa-sticky-tile').click();
    const a = page.locator('.fa-board-window[data-fa-window="landing:alpha"]');
    const b = page.locator('.fa-board-window[data-fa-window="landing:beta"]');
    await expect(b).toHaveAttribute("data-fa-z", "2");
    await a.locator(".fa-board-window-title").click();
    await expect(a).toHaveAttribute("data-fa-z", "2");
    await expect(b).toHaveAttribute("data-fa-z", "1");
  });

  test("an open window does NOT cover the other tiles — they stay clickable", async ({ page }) => {
    await go(page, "landing");
    await page.locator(`${alphaCell} .fa-sticky-tile`).click();
    const beta = (await page.locator('[data-fa-home-slot="beta"] .fa-sticky-tile').boundingBox())!;
    const hit = await page.evaluate(([x, y]) => {
      const e = document.elementFromPoint(x, y);
      return !!(e && e.closest(".fa-sticky-tile"));
    }, [beta.x + beta.width / 2, beta.y + beta.height / 2]);
    expect(hit).toBe(true);
  });

  test("the window's pin is the same toggle as the row's, on the same folio key", async ({ page }) => {
    await go(page, "landing");
    await page.locator(`${alphaCell} .fa-sticky-tile`).click();
    const winPin = page.locator('.fa-board-window[data-fa-window="landing:alpha"] [data-fa-control="pin"]');
    await expect(winPin).toHaveAttribute("aria-pressed", "false");
    await winPin.click();
    await expect(winPin).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(alphaPin)).toHaveAttribute("aria-pressed", "true");
    expect((await folio(page))["landing/alpha"]).toMatchObject({ shown: true });
    await winPin.click();
    await expect(page.locator(alphaPin)).toHaveAttribute("aria-pressed", "false");
  });
});
