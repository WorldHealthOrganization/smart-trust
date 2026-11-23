/**
 * Shape is a function of WHERE the sticky is — bean `624f`.
 *
 * Owner, 2026-09-21:
 *
 * > when sitckes are square, and they ahould always be in the docker/panel
 * > […] they are only onsquare to fit contents when the pop to the
 * > window/glass
 *
 * ## Why this is a BROWSER test and not a source check over the stylesheet
 *
 * The rule has to beat a cascade. `--fa-sticky-aspect` is aliased per crop
 * and re-aliased at two breakpoints, and the docked rule wins by setting
 * `aspect-ratio` directly rather than the custom property. A source check
 * would confirm the declaration exists; only a rendered box confirms it
 * WINS — which is the half that breaks when somebody adds a third
 * breakpoint.
 *
 * The fixture is hand-built for the same reason `glass.e2e.ts` builds a
 * replica: the real page is Liquid, and a test that needed a Jekyll build
 * would not run here at all.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");

/** A landing sticky as `landing.html` emits it: a LAPTOP crop, deliberately
 *  wide, so a square result can only have come from the docked rule. */
const STICKY = `
<article class="fa-sticky fa-landing-sticky fa-sticky--backdrop fa-landing-sticky--fixed"
         data-fa-shape="laptop"
         style="--fa-aspect-laptop:1.7758;--fa-aspect-mobile:0.5635;--fa-aspect-card:1;
                --fa-tx-laptop:.1;--fa-ty-laptop:.1;--fa-tw-laptop:.8;--fa-th-laptop:.8;
                --fa-tx-card:.1;--fa-ty-card:.1;--fa-tw-card:.8;--fa-th-card:.8;">
  <div class="fa-landing-sticky__text"><div class="fa-landing-sticky__body"><p>Words.</p></div></div>
</article>`;

const page_ = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${CSS}</style></head><body>${body}</body></html>`;

const URL_PAGE = "http://shape.test/page.html";

async function serve(page: import("@playwright/test").Page, body: string) {
  await page.route("http://shape.test/**", (route) =>
    route.fulfill({ contentType: "text/html", body: page_(body) }),
  );
  await page.goto(URL_PAGE);
}

/** width / height — a ratio rather than two numbers, because the claim is
 *  about SHAPE and the box's absolute size is not the subject. */
async function ratio(page: import("@playwright/test").Page, sel: string): Promise<number> {
  const box = (await page.locator(sel).boundingBox())!;
  return box.width / box.height;
}

/* SQUARE MEANS SQUARE TO WITHIN A PIXEL, and the tolerance is the claim
 * rather than slack in it.
 *
 * `toBe(1)` failed at 700px and 400px with a measured 1.01 — a box like
 * 396 x 392, which is `aspect-ratio: 1` honoured and then laid out on a
 * device pixel grid. Asserting exact equality there asserts the browser's
 * rounding, not the rule, and would break on a viewport nobody chose for a
 * reason nobody could act on.
 *
 * 0.05 is two orders tighter than the ratio being overridden (1.7758), so a
 * crop leaking through still fails loudly. */
const SQUARE_TOLERANCE = 0.05;

test.describe("in the dock a sticky is SQUARE, whatever its crop says", () => {
  test("inside a sticky cell", async ({ page }) => {
    // The crop declares 1.7758 — a wide laptop card. A square result can
    // only come from the docked rule overriding it.
    await serve(page, `<div class="fa-sticky-cell">${STICKY}</div>`);
    expect(Math.abs((await ratio(page, ".fa-landing-sticky--fixed")) - 1)).toBeLessThan(SQUARE_TOLERANCE);
  });

  test("inside a sticky panel", async ({ page }) => {
    await serve(page, `<div class="fa-sticky-panel"><div>${STICKY}</div></div>`);
    expect(Math.abs((await ratio(page, ".fa-landing-sticky--fixed")) - 1)).toBeLessThan(SQUARE_TOLERANCE);
  });

  test("inside a sticky board", async ({ page }) => {
    await serve(page, `<div class="fa-sticky-board"><div>${STICKY}</div></div>`);
    expect(Math.abs((await ratio(page, ".fa-landing-sticky--fixed")) - 1)).toBeLessThan(SQUARE_TOLERANCE);
  });

  test("and the SAME markup outside a dock keeps its crop — the control", async ({ page }) => {
    // Without this the suite would pass on a stylesheet that squared every
    // sticky everywhere, which is a different rule and the wrong one.
    await serve(page, `<div>${STICKY}</div>`);
    expect(await ratio(page, ".fa-landing-sticky--fixed")).toBeCloseTo(1.7758, 1);
  });
});

test.describe("the docked rule beats the BREAKPOINT aliases", () => {
  // The half a source check cannot see. Both breakpoints re-alias
  // `--fa-sticky-aspect`; the docked rule sets `aspect-ratio` directly, so
  // it wins at every width. A third breakpoint added later cannot quietly
  // un-square the dock without failing here.
  for (const width of [1280, 700, 400]) {
    test(`square at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await serve(page, `<div class="fa-sticky-cell">${STICKY}</div>`);
      expect(Math.abs((await ratio(page, ".fa-landing-sticky--fixed")) - 1)).toBeLessThan(SQUARE_TOLERANCE);
    });
  }
});

test.describe("on the glass a sticky is shaped to its CONTENT", () => {
  test("the fixed ratio is cleared when floating", async ({ page }) => {
    // `.fa-sticky-floating` is what `placeFloating` adds. The card then
    // carries its own geometry, and a leftover `aspect-ratio` would fight
    // it — the card would letterbox on the glass.
    await serve(
      page,
      `<div class="fa-sticky-layer"><div class="fa-sticky-floating" style="width:300px;height:120px">${STICKY}</div></div>`,
    );
    const computed = await page
      .locator(".fa-landing-sticky--fixed")
      .evaluate((el) => getComputedStyle(el).aspectRatio);
    expect(computed).toBe("auto");
  });

  test("a DOCKED sticky still reports a ratio — the control", async ({ page }) => {
    // Proves the assertion above is reading a real difference rather than a
    // property the browser reports as `auto` everywhere.
    await serve(page, `<div class="fa-sticky-cell">${STICKY}</div>`);
    const computed = await page
      .locator(".fa-landing-sticky--fixed")
      .evaluate((el) => getComputedStyle(el).aspectRatio);
    expect(computed).not.toBe("auto");
  });
});

/* ── The backdrop scrolls WITH the words — owner, 2026-09-23 ─────────────
 *
 * Offered four readings of *"background will scrll accoringing"*, the owner
 * chose **"scrolls with text"**: picture and words are one surface; the
 * picture stays whole; text past its end continues on the theme colour. */
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const withArt = (words: string) => `
<div class="fa-sticky-cell" style="width:300px">
<article class="fa-sticky fa-landing-sticky fa-sticky--backdrop fa-landing-sticky--fixed" data-fa-shape="card"
         style="--fa-aspect-card:1;--fa-tx-card:.1;--fa-ty-card:.1;--fa-tw-card:.8;--fa-th-card:.5;">
  <picture><img class="fa-sticky-art" src="${PNG_1x1}" alt=""></picture>
  <div class="fa-landing-sticky__text"><div class="fa-landing-sticky__body">${words}</div></div>
</article></div>`;
const LONG = Array.from({ length: 30 }, (_, i) => `<p>Line ${i + 1} of a note far longer than its square.</p>`).join("");
const card = ".fa-landing-sticky";

test.describe("an overrunning sticky scrolls as ONE surface — art and words together", () => {
  test("the CARD scrolls; the text box does not scroll on its own", async ({ page }) => {
    await serve(page, withArt(LONG));
    const m = await page.locator(card).evaluate((c) => {
      const t = c.querySelector(".fa-landing-sticky__text") as HTMLElement;
      return { cardScroll: c.scrollHeight - c.clientHeight, textScroll: t.scrollHeight - t.clientHeight };
    });
    expect(m.cardScroll).toBeGreaterThan(100);
    expect(m.textScroll).toBeLessThanOrEqual(1);
    // Still square in the dock: the scroll is INSIDE the square.
    expect(Math.abs((await ratio(page, card)) - 1)).toBeLessThan(SQUARE_TOLERANCE);
  });

  test("scrolling moves the picture and the words by the SAME amount", async ({ page }) => {
    await serve(page, withArt(LONG));
    const before = await page.locator(card).evaluate((c) => ({
      art: c.querySelector("picture")!.getBoundingClientRect().top,
      words: c.querySelector(".fa-landing-sticky__text")!.getBoundingClientRect().top,
    }));
    await page.locator(card).evaluate((c) => { c.scrollTop = 120; });
    const after = await page.locator(card).evaluate((c) => ({
      art: c.querySelector("picture")!.getBoundingClientRect().top,
      words: c.querySelector(".fa-landing-sticky__text")!.getBoundingClientRect().top,
    }));
    expect(Math.round(before.art - after.art)).toBe(120);
    expect(Math.round(before.words - after.words)).toBe(120);
  });

  test("the picture stays whole — one square, not stretched to the text", async ({ page }) => {
    await serve(page, withArt(LONG));
    const m = await page.locator(card).evaluate((c) => ({
      art: c.querySelector("picture")!.getBoundingClientRect().height,
      square: c.clientHeight,
      fit: getComputedStyle(c.querySelector(".fa-sticky-art")!).objectFit,
    }));
    expect(Math.abs(m.art - m.square)).toBeLessThanOrEqual(1);
    expect(m.fit).toBe("contain");
  });

  test("a SHORT note does not scroll at all, and still sits in its cloud", async ({ page }) => {
    await serve(page, withArt("<p>Short.</p>"));
    const m = await page.locator(card).evaluate((c) => {
      const t = c.querySelector(".fa-landing-sticky__text") as HTMLElement;
      return { cardScroll: c.scrollHeight - c.clientHeight, textTop: t.offsetTop, h: c.clientHeight };
    });
    expect(m.cardScroll).toBeLessThanOrEqual(1);
    // --fa-ty-card .1: the words start a tenth of the way down, where the art put the cloud.
    expect(Math.abs(m.textTop - m.h * 0.1)).toBeLessThanOrEqual(2);
  });

  test("on the GLASS the rule does not apply — a floating sticky is shaped to its content", async ({ page }) => {
    await serve(page, withArt(LONG).replace("fa-landing-sticky--fixed\"", "fa-landing-sticky--fixed fa-sticky-floating\""));
    const ov = await page.locator(card).evaluate((c) => getComputedStyle(c).overflowY);
    expect(ov).toBe("auto");   // `.fa-sticky-floating`'s own rule, not this one's
    const minH = await page.locator(".fa-landing-sticky__text").evaluate((t) => getComputedStyle(t).minHeight);
    expect(minH === "0px" || minH === "auto").toBe(true);
  });
});
