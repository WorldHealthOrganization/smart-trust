/**
 * THE GLASS ON A PHONE AND ON A TABLET — bean `c132`, issue #1031.
 *
 * Owner, 2026-09-23: *"Mobile phone is maybe linearized view due to space.
 * But tablet should be like laptops."*
 *
 * Measured before the change, at these same sizes: on a phone a pinned sticky
 * covered a third of the page with the glass CLOSED and sat over the tile
 * strip; on a tablet the layout was already the laptop one but a FINGER could
 * not drag a card, because `wireMove` listened for mouse events only.
 *
 * Since #1925 a pinned sticky IS a folio-glass card (owner, 2026-10-02: *"pin
 * to glass should pin to folio glass"*), so both things this page puts on the
 * glass are `.fa-glass-asset` cards with the same tools, on every device.
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

const cell = (id: string, t: string) => `<div class="fa-sticky-cell" data-fa-home-slot="${id}">
  <article class="fa-sticky fa-landing-sticky"><h2 id="fa-sticky-${id}-summary" class="fa-sr-only">${t}</h2>
  <div class="fa-landing-sticky__text"><div class="fa-landing-sticky__body"><p>${t} body text.</p></div></div></article></div>`;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Home</title><style>${CSS}</style></head><body>
<details class="fa-sticky-panel" open><summary>Stickies</summary><div class="fa-sticky-panel__body">
<div class="fa-sticky-board fa-landing-board" data-fa-home-panel="landing">${cell("a", "Alpha")}${cell("b", "Beta")}</div>
</div></details>
<table><tbody><tr data-fa-library-item="i/book" data-fa-library-title="A handbook" data-fa-library-href="/x">
<td data-fa-pullout-host>book</td><td>t</td></tr></tbody></table>
<p>${"Page text. ".repeat(80)}</p><script>${JS}</script></body></html>`;

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 820, height: 1180 };

const setup = async (page: Page, size: { width: number; height: number }) => {
  await page.setViewportSize(size);
  await page.route("http://dev.test/**", (r) =>
    r.request().url().endsWith("/p.html")
      ? r.fulfill({ contentType: "text/html", body: PAGE })
      : r.fulfill({ status: 404, body: "" }));
  await page.goto("http://dev.test/p.html");
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  // One of each thing the glass holds: a pinned sticky and a library asset.
  await page.locator('[data-fa-home-slot="a"] .fa-sticky-act-pin').click();
  await page.locator('[data-fa-library-item="i/book"] .fa-pullout').click();
};

const pin = '.fa-sticky-layer .fa-glass-asset[data-fa-asset="landing/a"]';
const asset = '.fa-glass-asset[data-fa-asset="i/book"]';
const openGlass = async (page: Page) => {
  await page.click(".fa-glass-handle");
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
};

test.describe("a PHONE gets one column", () => {
  test("closed, nothing floats over the page — the handle says how many wait", async ({ page }) => {
    await setup(page, PHONE);
    await expect(page.locator(pin)).toBeHidden();
    await expect(page.locator(".fa-glass-handle")).toHaveAttribute("data-fa-count", "2");
    const after = await page.locator(".fa-glass-handle").evaluate((h) => getComputedStyle(h, "::after").content);
    expect(after).toContain("2");
  });

  test("open, the glass is ONE column in reading order, full width, no sideways scroll", async ({ page }) => {
    await setup(page, PHONE);
    await openGlass(page);
    const a = (await page.locator(asset).boundingBox())!;
    const p = (await page.locator(pin).boundingBox())!;
    // One column, in the shelf's key order: the book, then the pinned sticky.
    expect(p.y).toBeGreaterThanOrEqual(a.y + a.height);
    // Each nearly the whole width, and the same width: a column, not a grid.
    expect(a.width).toBeGreaterThan(PHONE.width - 40);
    expect(Math.abs(a.width - p.width)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width);
  });

  test("move and resize are gone; close stays, on the sticky too", async ({ page }) => {
    await setup(page, PHONE);
    await openGlass(page);
    await expect(page.locator(`${asset} [data-fa-control="move"]`)).toBeHidden();
    await expect(page.locator(`${asset} button[aria-label^="Make "]`).first()).toBeHidden();
    await expect(page.locator(`${pin} [data-fa-control="move"]`)).toBeHidden();
    await expect(page.locator(`${asset} .fa-glass-asset-close`)).toBeVisible();
    await expect(page.locator(`${pin} .fa-glass-asset-close`)).toBeVisible();
  });

  test("a place saved on a laptop is left alone, not overwritten by the column", async ({ page }) => {
    await setup(page, PHONE);
    await page.evaluate(() => {
      const m = JSON.parse(localStorage.getItem("fa-folio-assets") || "{}");
      m["landing/a"].geom = { left: 40, top: 50, width: 300, height: 200 };
      localStorage.setItem("fa-folio-assets", JSON.stringify(m));
    });
    await page.reload();
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    await openGlass(page);
    const geom = await page.evaluate(() => JSON.parse(localStorage.getItem("fa-folio-assets") || "{}")["landing/a"].geom);
    expect(geom).toEqual({ left: 40, top: 50, width: 300, height: 200 });
  });
});

test.describe("a TABLET is a laptop, and a finger can drag", () => {
  test("the free-positioning surface is kept, with its move controls", async ({ page }) => {
    await setup(page, TABLET);
    await openGlass(page);
    await expect(page.locator(pin)).toBeVisible();
    expect(await page.locator(pin).evaluate((n) => getComputedStyle(n).position)).toBe("absolute");
    await expect(page.locator(`${pin} [data-fa-control="move"]`)).toBeVisible();
    expect(await page.locator(asset).evaluate((n) => getComputedStyle(n).position)).toBe("absolute");
    await expect(page.locator(`${asset} [data-fa-control="move"]`)).toBeVisible();
  });

  const touchDrag = (page: Page, selector: string, dx: number, dy: number) =>
    page.evaluate(([sel, dx, dy]) => {
      const target = document.querySelector(sel as string) as HTMLElement;
      const b = target.getBoundingClientRect();
      const x = b.left + 5, y = b.top + 5;
      const ev = (type: string, px: number, py: number) => new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true,
        clientX: px, clientY: py, button: 0,
      });
      target.dispatchEvent(ev("pointerdown", x, y));
      document.dispatchEvent(ev("pointermove", x + (dx as number) / 2, y + (dy as number) / 2));
      document.dispatchEvent(ev("pointermove", x + (dx as number), y + (dy as number)));
      document.dispatchEvent(ev("pointerup", x + (dx as number), y + (dy as number)));
    }, [selector, dx, dy]);
  const leftOf = (page: Page) => page.locator(asset).evaluate((n) => parseFloat((n as HTMLElement).style.left));

  test("a finger on the card's GRIP drags it", async ({ page }) => {
    await setup(page, TABLET);
    await openGlass(page);
    const before = await leftOf(page);
    await touchDrag(page, `${asset} [data-fa-grip]`, 60, 30);
    expect(await leftOf(page)).toBe(before + 60);
  });

  test("a finger elsewhere on the card does NOT drag — it is free to scroll", async ({ page }) => {
    await setup(page, TABLET);
    await openGlass(page);
    const before = await leftOf(page);
    await touchDrag(page, `${asset} .fa-glass-asset-tools`, 60, 30);
    expect(await leftOf(page)).toBe(before);
  });

  test("the grip tells the browser not to scroll it", async ({ page }) => {
    await setup(page, TABLET);
    await openGlass(page);
    expect(await page.locator(`${asset} [data-fa-grip]`).evaluate((n) => getComputedStyle(n).touchAction)).toBe("none");
  });

  test("the handle shows no count — the count is for a phone's closed glass", async ({ page }) => {
    await setup(page, TABLET);
    const after = await page.locator(".fa-glass-handle").evaluate((h) => getComputedStyle(h, "::after").content);
    expect(after === "none" || after === "normal").toBe(true);
  });
});

test.describe("the count is SPOKEN, not only drawn", () => {
  // Owner, 2026-09-23: "do the spoken count on phone next". The `· N` is an
  // `::after`; the handle's aria-label replaces its content, so the number was
  // visible and silent until it joined the accessible name.
  test("on a phone, the handle's accessible name says how many are waiting", async ({ page }) => {
    await setup(page, PHONE);
    await expect(page.getByRole("button", { name: "Pull down your folio — 2 items on it" })).toBeVisible();
  });

  test("it follows the count — one item is singular", async ({ page }) => {
    await setup(page, PHONE);
    // Un-pin: the pin is a toggle, and the sticky is shelved off the glass.
    await page.locator('[data-fa-home-slot="a"] .fa-sticky-act-pin').click();
    await expect(page.locator(".fa-glass-handle")).toHaveAttribute("aria-label", "Pull down your folio — 1 item on it");
  });

  test("open, the name is the plain inverse — the cards are in front of the reader", async ({ page }) => {
    await setup(page, PHONE);
    await openGlass(page);
    await expect(page.locator(".fa-glass-handle")).toHaveAttribute("aria-label", "Put your folio away");
  });

  test("with nothing waiting there is no count to speak", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.route("http://dev.test/**", (r) => r.fulfill({ contentType: "text/html", body: PAGE }));
    await page.goto("http://dev.test/p.html");
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    await expect(page.locator(".fa-glass-handle")).toHaveAttribute("aria-label", "Pull down your folio");
  });

  test("one name on every screen — a tablet speaks the same count", async ({ page }) => {
    await setup(page, TABLET);
    await expect(page.locator(".fa-glass-handle")).toHaveAttribute("aria-label", "Pull down your folio — 2 items on it");
  });
});
