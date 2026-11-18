/**
 * THE HANDLE COVERS NO TEXT AT ANY SCROLL POSITION — issue #1693.
 *
 * `015u` / `g9r2` (PR #1288) cleared the handle at the TOP of a page: a
 * themed page's header has an empty middle for it, and a viewer or replica
 * reserves its band with padding. Neither survives a scroll. The handle is
 * `position: fixed`, so once the page moved it sat over the middle of a body
 * line, readable either side of it, and a link centred under it opened the
 * glass instead. Measured on the built `platform.html` at 1280x900: 9 of 21
 * scroll positions.
 *
 * The fix keeps the band reserved while scrolled: `placeHandleBand` in
 * `docs-ui.js` shows an opaque strip, the handle's own height, across the
 * content column behind it. Text scrolls UNDER the strip, as under any sticky
 * bar.
 *
 * ## What "covers text" means here, and why it is not a bare rect test
 *
 * A text line whose rect meets the handle's is a DEFECT only if the reader can
 * see that line around the handle. Under the strip the line is hidden across
 * its whole width, the same as a line scrolled above the viewport. So each
 * line that meets the handle is sampled with elementFromPoint at the handle's
 * row, at the line's two ends and its middle: if any sample lands on page
 * content, the line is visible beside the handle and the test fails. Before
 * the fix every body line under the handle fails this way, because it runs
 * well past both sides of a 90 px pill.
 *
 * The fixture is a standalone page with docs-ui inlined, as `glass.e2e.ts`
 * does, with a FIXED side bar like the theme's desktop rail, so the strip is
 * also checked to stop at the rail's edge rather than cover its controls.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERAL that builds the page (bean `bmr0`).
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

const PARA =
  "A process here is not a picture of a workflow drawn after the fact. The file is the source " +
  "of truth, and the running instance is committed so a sibling session sees the same position. " +
  '<a href="#p-3">A link in the middle of a line</a> that a click under the handle used to miss.';

const BODY = Array.from({ length: 40 }, (_, i) =>
  (i % 6 === 0 ? '<h2 id="h-' + i + '">Section ' + i + "</h2>" : "") +
  '<p id="p-' + i + '">' + PARA + "</p>",
).join("\n");

/** A long page with a fixed left rail, the shape of the theme's desktop layout. */
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${CSS}</style>
<style>
  body { margin: 0; background: #ffffff; color: #222; font: 16px/1.6 sans-serif; }
  .side-bar { position: fixed; left: 0; top: 0; bottom: 0; width: 56px; background: #f5f6fa; }
  .side-bar a { display: block; padding: 4px; font-size: 12px; }
  .main { margin-left: 56px; padding: 0 32px 50vh; }
  @media (max-width: 600px) {
    .side-bar { position: static; width: auto; height: 60px; }
    .main { margin-left: 0; padding: 0 14px 50vh; }
  }
</style></head><body>
<div class="side-bar"><a href="#top">Top</a></div>
<div class="main"><h1 id="top">A long page</h1>
${BODY}
</div>
<script>${JS}</script></body></html>`;

const URL_PAGE = "http://scroll.test/long.html";
const handle = ".fa-glass-handle";
const band = ".fa-glass-band";

test.beforeEach(async ({ page }) => {
  await page.route("http://scroll.test/**", (route) => {
    if (route.request().url().split("#")[0].endsWith("/long.html")) {
      return route.fulfill({ contentType: "text/html", body: PAGE });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
});

async function open(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.mouse.move(700, 600);
  await page.goto(URL_PAGE);
  await page.waitForSelector(handle, { state: "attached" });
}

/** Scroll instantly and let the band's rAF update land. */
async function scrollTo(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Text lines that meet the handle AND can be seen beside it. */
function visibleTextUnderHandle(page: Page) {
  return page.evaluate(() => {
    const hb = document.querySelector(".fa-glass-handle")!.getBoundingClientRect();
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      const p = n.parentElement;
      if (!p || p.closest(".fa-glass-handle, .fa-sticky-layer, .fa-glass-band, script, style")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const b of Array.from(range.getClientRects())) {
        if (b.width < 1 || b.height < 1) continue;
        const meets = b.right > hb.left && b.left < hb.right && b.bottom > hb.top && b.top < hb.bottom;
        if (!meets) continue;
        const cy = (Math.max(b.top, hb.top) + Math.min(b.bottom, hb.bottom)) / 2;
        for (const x of [b.left + 1, (b.left + b.right) / 2, b.right - 1]) {
          const xx = Math.min(Math.max(x, 0), window.innerWidth - 1);
          const top = document.elementFromPoint(xx, cy);
          // Visible means the reader sees THIS text there: the element on top
          // is the text's own element or inside it. Anything else on top (the
          // band, the handle, an opened nav) is covering it.
          if (top && (p.contains(top) || top.contains(p))) {
            // Say what the reader sees there and where the band is, so a
            // failure in a browser we cannot run locally names its cause.
            const bandEl = document.querySelector(".fa-glass-band") as HTMLElement | null;
            const br = bandEl && bandEl.getBoundingClientRect();
            const bandState = !bandEl ? "no band" : bandEl.hidden ? "band hidden"
              : "band " + [br!.left, br!.top, br!.width, br!.height].map(Math.round).join(",");
            out.push(Math.round(b.top) + "px: " + n.nodeValue.trim().slice(0, 30) +
              " | at x" + Math.round(xx) + " top=" + top.tagName.toLowerCase() +
              (top.className ? "." + String(top.className).split(" ")[0] : "") +
              " | " + bandState + " | handle " + [hb.left, hb.top, hb.width, hb.height].map(Math.round).join(","));
            break;
          }
        }
      }
    }
    return out;
  });
}

for (const [width, height] of [[1280, 900], [390, 800]] as const) {
  test(`at ${width} px, scrolled top to bottom, the handle covers no visible text`, async ({ page }) => {
    await open(page, width, height);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    // The fixture must be long enough to mean something.
    expect(max).toBeGreaterThan(height * 2);
    const findings: string[] = [];
    // 37 px steps, so a line cannot slip between two samples.
    for (let y = 0; y <= max; y += 37) {
      await scrollTo(page, y);
      for (const f of await visibleTextUnderHandle(page)) findings.push(`scrollY ${y}, ${f}`);
    }
    expect(findings).toEqual([]);
  });
}

test("at the top of the page the band is hidden: the resting layout is unchanged", async ({ page }) => {
  await open(page, 1280, 900);
  await scrollTo(page, 0);
  await expect(page.locator(band)).toBeHidden();
  await scrollTo(page, 400);
  await expect(page.locator(band)).toBeVisible();
  await scrollTo(page, 0);
  await expect(page.locator(band)).toBeHidden();
});

test("the band sits behind the handle at its height, and stops at a FIXED side bar", async ({ page }) => {
  await open(page, 1280, 900);
  // The rail AT REST: CI's Chrome rests the pointer on it, and a hovered rail
  // widens to the open nav. That case has its own test below.
  await page.mouse.move(700, 600);
  await page.waitForTimeout(200);
  await scrollTo(page, 600);
  expect(await page.evaluate(() => document.querySelector(".side-bar")!.matches(":hover"))).toBe(false);
  const hb = (await page.locator(handle).boundingBox())!;
  const bb = (await page.locator(band).boundingBox())!;
  const sb = (await page.locator(".side-bar").boundingBox())!;
  expect(Math.round(bb.y)).toBe(Math.round(hb.y));
  expect(Math.round(bb.height)).toBe(Math.round(hb.height));
  expect(Math.round(bb.x)).toBe(Math.round(sb.x + sb.width));
  const mainLeft = await page.evaluate(() => document.querySelector(".main")!.getBoundingClientRect().left);
  expect(Math.round(bb.x)).toBe(Math.round(mainLeft));
  // The rail's own control is still the thing a click lands on.
  const hit = await page.evaluate(() => document.elementFromPoint(10, 10)?.closest(".side-bar") != null);
  expect(hit).toBe(true);
  // And the handle is still on top of the band.
  const onTop = await page.evaluate(() => {
    const r = document.querySelector(".fa-glass-handle")!.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".fa-glass-handle") !== null;
  });
  expect(onTop).toBe(true);
});

test("with the pointer resting on the side bar, the band still starts at the page's content, not the opened nav", async ({ page }) => {
  // CI's Chrome 153 found this: the pointer at rest over the rail makes
  // `.side-bar:hover` widen it to the OPEN nav width (264 px). The band took
  // that edge and left the text between the collapsed rail and 264 px
  // readable beside the handle at every scroll position. The opened nav
  // paints above the band anyway (z-index 100 against 89), so the band's left
  // edge is where the page content starts, whatever the rail is doing.
  await open(page, 1280, 900);
  await page.mouse.move(20, 400);
  const railOpen = await page.evaluate(() => document.querySelector(".side-bar")!.matches(":hover"));
  expect(railOpen).toBe(true);
  for (const y of [300, 600, 900]) {
    await scrollTo(page, y);
    expect(await visibleTextUnderHandle(page)).toEqual([]);
  }
  // The pointer leaves and the nav closes WITHOUT a scroll, so the band keeps
  // the edge it last measured. Measured on the rail's hover width, that edge
  // would leave the text between the rail and 264 px exposed.
  await page.mouse.move(700, 600);
  await page.waitForTimeout(200);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await page.evaluate(() => document.querySelector(".side-bar")!.matches(":hover"))).toBe(false);
  expect(await visibleTextUnderHandle(page)).toEqual([]);
  const bb = (await page.locator(band).boundingBox())!;
  const mainLeft = await page.evaluate(() => document.querySelector(".main")!.getBoundingClientRect().left);
  expect(Math.round(bb.x)).toBeLessThanOrEqual(Math.round(mainLeft));
});

test("scrolled, the handle is still a keyboard-reachable button with its name", async ({ page }) => {
  await open(page, 1280, 900);
  await scrollTo(page, 800);
  const h = page.locator(handle);
  await expect(h).toHaveAttribute("aria-expanded", "false");
  await expect(h).toHaveAccessibleName(/folio/i);
  await h.focus();
  await page.keyboard.press("Enter");
  await expect(h).toHaveAttribute("aria-expanded", "true");
  // The band is decoration: out of the accessibility tree and the tab order.
  await expect(page.locator(band)).toHaveAttribute("aria-hidden", "true");
});

test("an anchor jump lands its target below the band, not under it", async ({ page }) => {
  await open(page, 1280, 900);
  await page.evaluate(() => { location.hash = "#p-24"; });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expect.poll(async () => {
    const t = await page.locator("#p-24").boundingBox();
    const b = await page.locator(band).boundingBox();
    return t && b ? t.y >= b.y + b.height : false;
  }).toBe(true);
});

test("on a page whose body paints no background, the band is still opaque", async ({ page }) => {
  // A replica may leave its background to html. The band inherits body's, so
  // there it would be see-through and every line would show through it.
  await page.route("http://scroll.test/bare.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: PAGE.replace("body { margin: 0; background: #ffffff;", "body { margin: 0; background: none;"),
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://scroll.test/bare.html");
  await page.waitForSelector(handle, { state: "attached" });
  await scrollTo(page, 600);
  await expect(page.locator(band)).toHaveAttribute("data-fa-band-fallback", "");
  const bg = await page.locator(band).evaluate((b) => getComputedStyle(b).backgroundColor);
  expect(bg).not.toMatch(/rgba\([^)]*,\s*0\)$|transparent/);
  expect(await visibleTextUnderHandle(page)).toEqual([]);
});
