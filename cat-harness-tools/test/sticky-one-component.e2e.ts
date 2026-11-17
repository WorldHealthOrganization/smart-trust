/**
 * ONE STICKY — issue #1925, bean `dxje`.
 *
 * Owner, 2026-10-02, verbatim: *"dont treat stickies differently. combine
 * best of each. lower faded avatar/theme looks nicer. upper smaller same size
 * closed looks niceer. icons are a mess on both. make compact underneath. [x]
 * is what? send to fsh-guts? make sure confirmed by user"*; *"(also add
 * fsh-guts icon to LHS top navbar)"*, then *"i wanted fsh guts icon here with
 * the others"*; and *"pin to glass should pin to folio glass. its not working
 * right."*
 *
 * One page carries both kinds — the landing board with the todo board
 * mounted inside it, as `landing.html` renders them — so every comparison
 * below is between a landing sticky and a todo sticky on the same screen.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { fshGutsHtml } from "../scripts/lib/navbar.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
// The row's own stylesheet FIRST, as `head_custom.html` links it (beans `lhvt`, `9rq1`).
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/navbar-row.css"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
// `navbar-row.js` FIRST — it draws the row, and `docs-ui.js` calls it — as `head_custom.html` loads them.
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const cell = (id: string, title: string) => `
  <div class="fa-sticky-cell" data-fa-home-slot="${id}">
    <article class="fa-sticky fa-landing-sticky" data-fa-sticky-theme="cat" data-fa-art-card="/art/${id}.png"
             aria-labelledby="fa-sticky-${id}-summary">
      <h2 id="fa-sticky-${id}-summary" class="fa-sr-only">${title}</h2>
      <div class="fa-landing-sticky__text"><div class="fa-landing-sticky__body"><p>${title} body.</p></div></div>
    </article>
    <p class="fa-sticky-links">
      <a class="fa-node-edit fa-sticky-view" href="https://github.com/o/r/blob/main/${id}.json" rel="noopener"
         title="View on GitHub" aria-label="View the declaration of ${title}">v</a>
      <a class="fa-node-edit fa-sticky-edit" href="https://github.com/o/r/edit/main/${id}.json" rel="noopener"
         title="Edit on GitHub" aria-label="Edit the declaration of ${title}">e</a>
    </p>
  </div>`;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Home page</title>
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}</style></head><body>
<nav class="fa-nav-icons">${fshGutsHtml({ label: "fsh-guts, discarded items" })}</nav>
<details class="fa-sticky-panel" open><summary>Stickies <span class="fa-sticky-panel__count" data-fa-sticky-count="2">2</span></summary>
<div class="fa-sticky-panel__body">
<div class="fa-sticky-board fa-landing-board" data-fa-home-panel="landing">
${cell("alpha", "Alpha note")}
${cell("beta", "Beta note")}
</div></div></details>
<script>${JS}</script></body></html>`;

const TAGS = { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] };
const INDEX = {
  themeArt: { cat: { card: "/art/cat-card.png", mobile: "/art/cat-mobile.png", laptop: "/art/cat-laptop.png" } },
  items: [
    { id: "t-one", summary: "First todo", comment: "Why it matters.", status: "open", priority: "high",
      origin: "agent", createdAt: "2026-09-23", theme: "cat", tags: TAGS,
      viewHref: "https://github.com/o/r/blob/main/todos/t-one.md",
      editHref: "https://github.com/o/r/edit/main/todos/t-one.md" },
  ],
};

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.route("http://one.test/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/landing.html") return route.fulfill({ contentType: "text/html", body: PAGE });
    if (path.startsWith("/art/")) return route.fulfill({ contentType: "image/png", body: PNG });
    if (path === "/assets/todos/index.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(INDEX) });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
});

const go = async (page: Page) => {
  await page.goto("http://one.test/landing.html");
  await page.waitForSelector('[data-fa-home-slot="t-one"] .fa-sticky-actions');
};
const landing = '[data-fa-home-slot="alpha"]';
const todo = '[data-fa-home-slot="t-one"]';
const folio = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fa-folio-assets") || "{}"));
const discarded = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fa-discarded-todos") || "[]"));

test.describe("both kinds render the same component", () => {
  test("a landing sticky and a todo sticky are the same tile, with the theme's faded art", async ({ page }) => {
    await go(page);
    const a = page.locator(`${landing} > .fa-sticky-tile`);
    const t = page.locator(`${todo} > .fa-sticky-tile`);
    await expect(a).toHaveAttribute("data-fa-sticky-kind", "landing");
    await expect(t).toHaveAttribute("data-fa-sticky-kind", "todo");
    for (const tile of [a, t]) {
      await expect(tile).toHaveClass(/fa-sticky-tile fa-sticky-avatar fa-sticky--backdrop/);
      await expect(tile).toHaveAttribute("data-fa-sticky-theme", "cat");
      await expect(tile.locator("img.fa-sticky-art")).toHaveCount(1);
    }
    // No control inside either tile: the icons are underneath.
    expect(await a.locator("button, a").count()).toBe(0);
    expect(await t.locator("button, a").count()).toBe(0);
  });

  test("the same icon row, in the same order: view, edit, pin, send to fsh-guts", async ({ page }) => {
    await go(page);
    const order = (sel: string) => page.locator(`${sel} > .fa-sticky-actions [data-fa-act]`)
      .evaluateAll((ns) => ns.map((n) => n.getAttribute("data-fa-act")));
    expect(await order(landing)).toEqual(["view", "edit", "pin", "discard"]);
    expect(await order(todo)).toEqual(["view", "edit", "pin", "discard"]);
    // Every icon-only control is named twice: for a screen reader and on hover.
    const named = await page.locator(".fa-sticky-actions [data-fa-act]")
      .evaluateAll((ns) => ns.every((n) => !!n.getAttribute("aria-label") && !!n.getAttribute("title")));
    expect(named).toBe(true);
    // The server-rendered caption has moved into the row.
    await expect(page.locator(`${landing} .fa-sticky-links`)).toHaveCount(0);
  });

  test("closed, every sticky is the same size", async ({ page }) => {
    await go(page);
    const boxes = await page.locator('[data-fa-home-panel] .fa-sticky-tile').evaluateAll((ns) =>
      ns.map((n) => { const r = n.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    expect(boxes.length).toBe(3);
    for (const b of boxes) expect(b).toEqual(boxes[0]);
    // And the rows under them are the same size too.
    const rows = await page.locator('[data-fa-home-panel] .fa-sticky-actions').evaluateAll((ns) =>
      ns.map((n) => Math.round(n.getBoundingClientRect().width)));
    for (const w of rows) expect(w).toBe(rows[0]);
  });
});

test.describe("Send to fsh-guts asks first", () => {
  for (const [name, sel, id] of [["landing", landing, "landing/alpha"], ["todo", todo, "t-one"]] as const) {
    test(`${name}: Cancel keeps the sticky and stores nothing`, async ({ page }) => {
      await go(page);
      await page.locator(`${sel} .fa-sticky-act-discard`).click();
      const dialog = page.locator("dialog.fa-fsh-confirm");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("restorable");
      // The way back is named — the fish in the icon row, which this page has.
      await expect(dialog).toContainText("the fish in the icon row");
      await expect(dialog.locator(".fa-fsh-confirm-cancel")).toBeFocused();
      await dialog.locator(".fa-fsh-confirm-cancel").click();
      await expect(dialog).toHaveCount(0);
      await expect(page.locator(sel)).toBeVisible();
      expect(await discarded(page)).not.toContain(id);
      await expect(page.locator(`${sel} .fa-sticky-act-discard`)).toBeFocused();
    });

    test(`${name}: Escape does nothing but close the dialog`, async ({ page }) => {
      await go(page);
      await page.locator(`${sel} .fa-sticky-act-discard`).click();
      await expect(page.locator("dialog.fa-fsh-confirm")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog.fa-fsh-confirm")).toHaveCount(0);
      await expect(page.locator(sel)).toBeVisible();
      expect(await discarded(page)).not.toContain(id);
    });

    test(`${name}: Confirm sends it to fsh-guts, and Restore brings it back`, async ({ page }) => {
      await go(page);
      await page.locator(`${sel} .fa-sticky-act-discard`).click();
      await page.locator("dialog.fa-fsh-confirm .fa-fsh-confirm-ok").click();
      expect(await discarded(page)).toContain(id);
      await expect(page.locator(`${sel}:visible`)).toHaveCount(0);
      // Restore, from the fish in the icon row.
      await page.locator("[data-fa-fsh-guts-open]").click();
      const list = page.locator("dialog.fa-fsh-guts-dialog");
      await expect(list).toBeVisible();
      await list.locator(".fa-discarded-restore").first().click();
      expect(await discarded(page)).not.toContain(id);
      await list.locator(".fa-fsh-guts-dialog-close").click();
      if (name === "landing") await expect(page.locator(sel)).toBeVisible();
      else {
        await page.reload();
        await page.waitForSelector(`${todo} .fa-sticky-actions`);
        await expect(page.locator(sel)).toBeVisible();
      }
    });
  }
});

test.describe("the fsh-guts button is in the icon row, with its count", () => {
  test("it shows, and its count follows a send", async ({ page }) => {
    await go(page);
    const fish = page.locator("[data-fa-fsh-guts-open]");
    await expect(fish).toBeVisible();
    // No published document and nothing discarded: the ABSENT state, not 0.
    await expect(fish.locator(".fa-nav-count")).toHaveAttribute("data-fa-count-state", "absent");
    await page.locator(`${landing} .fa-sticky-act-discard`).click();
    await page.locator("dialog.fa-fsh-confirm .fa-fsh-confirm-ok").click();
    await expect(fish.locator(".fa-nav-count")).toHaveText("1");
    await expect(fish).toHaveAttribute("aria-label", /1 item/);
  });
});

test.describe("pin puts the sticky on the folio glass, for both kinds", () => {
  for (const [name, sel, key] of [["landing", landing, "landing/alpha"], ["todo", todo, "todo/t-one"]] as const) {
    test(`${name}: pin → a glass card with glass tools; unpin shelves it; a reload keeps it`, async ({ page }) => {
      await go(page);
      const pin = page.locator(`${sel} .fa-sticky-act-pin`);
      await pin.click();
      await expect(pin).toHaveAttribute("aria-pressed", "true");
      expect((await folio(page))[key]).toMatchObject({ shown: true });
      await page.locator(".fa-glass-handle").click();
      const card = page.locator(`.fa-glass-asset[data-fa-asset="${key}"]`);
      await expect(card).toBeVisible();
      await expect(card).toHaveClass(/fa-glass-sticky/);
      await expect(card.locator('.fa-glass-asset-tools [data-fa-control="move"]')).toHaveCount(1);
      await expect(card.locator(".fa-glass-asset-close")).toHaveCount(1);
      await page.locator(".fa-glass-handle").click();

      await page.reload();
      await page.waitForSelector(`${todo} .fa-sticky-actions`);
      await expect(pin).toHaveAttribute("aria-pressed", "true");
      await page.locator(".fa-glass-handle").click();
      await expect(card).toBeVisible();
      await page.locator(".fa-glass-handle").click();

      await pin.click();
      await expect(pin).toHaveAttribute("aria-pressed", "false");
      expect((await folio(page))[key]).toMatchObject({ shown: false });
      await page.locator(".fa-glass-handle").click();
      await expect(card).toHaveCount(0);
    });
  }
});

test.describe("the open window's bar uses the same compact icons", () => {
  test("a todo window: pin and send are icon buttons with names, no text labels", async ({ page }) => {
    await go(page);
    await page.locator(`${todo} > .fa-sticky-tile`).click();
    const bar = page.locator('.fa-board-window[data-fa-window="t-one"] .fa-board-window-bar');
    for (const c of ["view", "edit", "pin", "discard"]) {
      const b = bar.locator(`[data-fa-control="${c}"]`);
      await expect(b).toHaveCount(1);
      await expect(b.locator("svg")).toHaveCount(1);
      expect((await b.innerText()).trim()).toBe("");
      expect(await b.getAttribute("title")).toBeTruthy();
      expect(await b.getAttribute("aria-label")).toBeTruthy();
    }
    // The window's pin is the same toggle on the same folio key.
    await bar.locator('[data-fa-control="pin"]').click();
    await expect(bar.locator('[data-fa-control="pin"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(`${todo} .fa-sticky-act-pin`)).toHaveAttribute("aria-pressed", "true");
    // And its send asks first, like the row's.
    await bar.locator('[data-fa-control="discard"]').click();
    await expect(page.locator("dialog.fa-fsh-confirm")).toBeVisible();
    await page.locator("dialog.fa-fsh-confirm .fa-fsh-confirm-cancel").click();
    expect(await discarded(page)).not.toContain("t-one");
  });
});
