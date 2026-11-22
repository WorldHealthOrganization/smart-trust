import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * The rail scrolls itself, never the page (owner, 2026-11-17: "When the
 * pointer is over the navbar/rail and you scroll, the page scrolls, not the
 * navbar. A long navbar can't be scrolled to see all its items.").
 *
 * WHAT IS SERVED: the rail's committed `navbar.css` and this layer's
 * `page-layout.css`, linked in that order as a railed page links them. Only
 * the rail's three regions are hand-built, with enough rows to overflow.
 *
 * Measured before the fix, 1280x600: ten wheel steps over the rail's top
 * scrolled the PAGE 4000px and the rail not at all; over its middle, the
 * rail's list reached its end and the page then scrolled 1600px.
 *
 * NO BACKTICKS INSIDE THE PAGE TEMPLATE LITERAL (`bmr0`).
 */
const ROOT = join(HARNESS_ROOT);
const NAVBAR_CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/navbar.css"))), "utf8");
// `page-layout.ts` names this file through `import.meta.dir`, which is bun's; Playwright loads specs under node.
const LAYOUT_CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../scripts/templates/page-layout.css"), "utf8");

const rows = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `<a href="#${tag}-${i}">${tag} ${i}</a>`).join("");
function page(top: number, middle: number): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${NAVBAR_CSS}</style><style>${LAYOUT_CSS}</style></head><body>
<nav class="fa-nav"><div class="fa-nav-in"><div class="fa-nav-top">${rows(top, "top")}</div>
<div class="fa-nav-graphs">${rows(middle, "graph")}</div><div class="fa-nav-bottom">${rows(2, "harness")}</div></div></nav>
<main>${"<p>Body text.</p>".repeat(400)}</main></body></html>`;
}

async function wheelAt(p: Page, y: number, steps = 10): Promise<void> {
  await p.mouse.move(20, y);
  for (let i = 0; i < steps; i++) {
    await p.mouse.wheel(0, 400);
    await p.waitForTimeout(40);
  }
  await p.waitForTimeout(300);
}
const state = (p: Page) =>
  p.evaluate(() => ({
    page: window.scrollY,
    graphs: document.querySelector(".fa-nav-graphs")!.scrollTop,
    rail: document.querySelector(".fa-nav")!.scrollTop,
  }));

test.describe("the rail is its own scroll container", () => {
  test.use({ viewport: { width: 1280, height: 600 } });

  for (const [where, y] of [["top", 10], ["middle", 300], ["bottom", 590]] as const) {
    test(`a wheel over the rail's ${where} never scrolls the page`, async ({ page: p }) => {
      await p.setContent(page(2, 80));
      await wheelAt(p, y);
      const s = await state(p);
      expect(s.page).toBe(0);
      if (where === "middle") expect(s.graphs).toBeGreaterThan(0);
    });
  }

  test("a rail taller than the window scrolls to its last row", async ({ page: p }) => {
    // A top region longer than the window: the middle has no room, so the rail itself must scroll.
    await p.setContent(page(60, 3));
    const rail = await p.evaluate(() => {
      const n = document.querySelector(".fa-nav")!;
      return { overflowY: getComputedStyle(n).overflowY, overscroll: getComputedStyle(n).overscrollBehaviorY, scrollable: n.scrollHeight > n.clientHeight };
    });
    expect(rail).toEqual({ overflowY: "auto", overscroll: "contain", scrollable: true });
    await wheelAt(p, 300, 20);
    const s = await state(p);
    expect(s.page).toBe(0);
    expect(s.rail).toBeGreaterThan(0);
    await expect(p.locator('a[href="#harness-1"]')).toBeInViewport();
  });

  test("the page still scrolls when the pointer is off the rail", async ({ page: p }) => {
    await p.setContent(page(2, 80));
    await wheelAt(p, 300, 1);
    await p.mouse.move(600, 300);
    await p.mouse.wheel(0, 400);
    await p.waitForTimeout(300);
    expect((await state(p)).page).toBeGreaterThan(0);
  });
});
