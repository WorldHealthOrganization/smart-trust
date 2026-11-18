/**
 * Opening, closing or dragging the rail keeps the reader's place.
 *
 * ## Why this exists
 *
 * Owner, 2026-11-16, with a screen recording, on a whole-document page: open
 * the rail, follow "Glossary" under "On this page", close the rail — and the
 * text column widens, every block above the Glossary gets shorter, and the
 * same `scrollY` shows References 90–102 while the URL still says
 * `#h-chap:glossary`. The browser's own scroll anchoring stands down because
 * the push is a change to `body`'s padding, an ancestor of every anchor it
 * could pick; `wireNavAnchor` (`scripts/lib/navbar.ts`) holds the anchor.
 *
 * The page is a long document whose paragraphs re-wrap when the column
 * changes width, railed by `injectNavbar` — the CSS and the inlined script a
 * railed page ships. Each step asserts that the reader's anchor is where it
 * was, within 2px: the followed heading, or with no hash the block at the top.
 *
 * Self-contained: no network, the page is set inline.
 *
 * @covers none — a browser test of one runtime, not an audit of a declared graph
 */
import { expect, test, type Page } from "@playwright/test";

import { injectNavbar } from "../scripts/lib/navbar.ts";

const WORDS = "the reading column re-wraps every paragraph when the rail opens or closes beside it".split(" ");
function para(n: number): string {
  const out: string[] = [];
  for (let i = 0; i < 70 + (n % 5) * 9; i++) out.push(WORDS[(i * 7 + n) % WORDS.length]!);
  return `<p>${out.join(" ")}.</p>`;
}
const SECTIONS: string[] = [];
for (let s = 1; s <= 60; s++) {
  SECTIONS.push(`<section><h2 id="sec-${s}">Section ${s}</h2>${[0, 1, 2, 3].map((k) => para(s * 4 + k)).join("")}</section>`);
}
const DOC = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Whole document</title>
<style>body{margin:0;font:16px/1.5 system-ui,sans-serif}main{padding:0 24px}</style></head><body>
<main id="top">${SECTIONS.join("")}</main></body></html>`;
// A home link, as a built site has: the header is then the link, and the toggle the small ‹ beside it.
const PAGE = injectNavbar(DOC, { instance: "x", headHref: "./" })!;

/** Pin the rail open as the reader found it, before they follow a link. */
async function pinOpen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const box = document.getElementById("fa-nav-open") as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.mouse.move(1300, 450);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).paddingInlineStart)).not.toBe("56px");
}

const topOf = (page: Page, sel: string) => page.evaluate((s) => document.querySelector(s)!.getBoundingClientRect().top, sel);
const pad = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingInlineStart));
/** Wait out the rail's slide and the page's delayed step (`navbarCss`). */
const settle = (page: Page) => page.waitForTimeout(450);

for (const motion of ["no-preference", "reduce"] as const) {
  test.describe(`prefers-reduced-motion: ${motion}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.setContent(PAGE);
    });

    test("a followed heading stays put when the rail closes, reopens and is dragged", async ({ page }) => {
      await pinOpen(page);
      // Follow a deep heading, as a click in "On this page" does.
      await page.evaluate(() => {
        location.hash = "#sec-45";
      });
      await expect.poll(() => topOf(page, "#sec-45")).toBeLessThan(5);
      await settle(page);
      const at = await topOf(page, "#sec-45");
      const openPad = await pad(page);

      // Close: the toggle in the rail's head.
      await page.locator("nav.fa-nav label.fa-nav-head-toggle").click();
      await page.mouse.move(1300, 450);
      await settle(page);
      expect(await pad(page)).toBeLessThan(openPad);
      expect(Math.abs((await topOf(page, "#sec-45")) - at)).toBeLessThanOrEqual(2);

      // Reopen from the keyboard: focus the box, Space.
      await page.locator("#fa-nav-open").focus();
      await page.keyboard.press("Space");
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await settle(page);
      expect(await page.locator("#fa-nav-open").isChecked()).toBe(true);
      expect(await pad(page)).toBe(openPad);
      expect(Math.abs((await topOf(page, "#sec-45")) - at)).toBeLessThanOrEqual(2);

      // Drag the edge wider.
      const edge = (await page.locator("nav.fa-nav .fa-nav-resize").boundingBox())!;
      const y = edge.y + edge.height / 2;
      await page.mouse.move(edge.x + edge.width / 2, y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) await page.mouse.move(edge.x + edge.width / 2 + i * 25, y);
      await page.mouse.up();
      await settle(page);
      expect(await pad(page)).toBeGreaterThan(openPad + 100);
      expect(Math.abs((await topOf(page, "#sec-45")) - at)).toBeLessThanOrEqual(2);
    });

    test("with no hash, the block at the top of the pane stays put", async ({ page }) => {
      await pinOpen(page);
      // Somewhere in the middle of a section, no anchor followed.
      await page.evaluate(() => {
        const h = document.getElementById("sec-30")!;
        window.scrollTo({ top: h.getBoundingClientRect().top + scrollY + 260, behavior: "instant" });
      });
      await settle(page);
      // Mark the first paragraph wholly below the top edge, as the reader sees it.
      const at = await page.evaluate(() => {
        const p = Array.from(document.querySelectorAll("main p")).find((e) => e.getBoundingClientRect().top >= 0)!;
        p.id = "reader";
        return p.getBoundingClientRect().top;
      });
      await page.locator("nav.fa-nav label.fa-nav-head-toggle").click();
      await page.mouse.move(1300, 450);
      await settle(page);
      expect(Math.abs((await topOf(page, "#reader")) - at)).toBeLessThanOrEqual(2);
    });
  });
}
