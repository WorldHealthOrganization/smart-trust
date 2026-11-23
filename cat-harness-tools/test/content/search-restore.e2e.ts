import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { FRAGMENT } from "../../scripts/staging-banner.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * SEARCH IS A MAGNIFIER THAT OPENS TO FULL WIDTH — owner, 2026-09-30,
 * verbatim (issue #1715):
 *
 * > search that should be a collsaible icon/avatar on top of display
 * > window... that when open is full span width of all avaioblae
 *
 * This spec used to hold the navbar/corner design's way back: "hiding search
 * makes it go away compleletey, cant restore" (2026-09-24), where the corner
 * card was drawn UNDER the staging banner. That lesson is kept — the page
 * here mounts the banner the staging injector actually ships (`FRAGMENT`,
 * imported rather than retyped), and reachability is asserted by HIT TEST,
 * not by visibility, because a control under another element is "visible" to
 * every locator assertion and still cannot be pressed.
 *
 * What it now asserts, measured on a local build before the change:
 *
 *   - CLOSED costs no vertical space. The open row cost 48px at 1280 and
 *     42px at 390 on every page before the first line of content.
 *   - OPEN spans the display panel, and so do the results. They were capped
 *     at the theme's 536px under a 992px field.
 *   - The keyboard round trip: Enter opens and puts the cursor in the field,
 *     Escape closes and hands focus back. Escape used to do nothing.
 *   - It never shares a box with the Folio handle, which is fixed at the top
 *     centre (and, with PR #1709, has a fixed strip behind it while scrolled).
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const SEARCH =
  '<div class="search" role="search"><div class="search-input-wrap">' +
  '<input type="text" id="search-input" class="search-input" autocomplete="off">' +
  '<label for="search-input" class="search-label"><span class="sr-only">Search folio-assistant</span></label>' +
  '</div><div id="search-results" class="search-results"></div></div>';

const PARA = "<p>Text of a page that is long enough to wrap onto a second line at a phone width, so the float has something to flow beside.</p>";

/** A preview page: the banner first in the body, as the injector places it,
 *  and the search-index stamp a preview build writes — so the notice under
 *  the field is rendered here, as it is on every page the owner reviews. */
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>p</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="fa-search-index" content="published">
<style>body { margin: 0; } .main-content-wrap { padding: 0 2rem; } ${CSS}</style></head><body>${FRAGMENT}
<div class="side-bar"><div class="site-header"><a class="site-title">folio-assistant</a></div><nav class="site-nav"></nav></div>
<div class="main"><div class="main-header">${SEARCH}</div><div class="main-content-wrap">
<div class="main-content"><h1>Getting started</h1>${PARA.repeat(40)}</div></div></div>
<script>${JS}<\/script></body></html>`;

const URL_ = "http://replica.test/folio-assistant/STAGING/some-branch/page.html";

async function load(page: Page) {
  await page.route("http://replica.test/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith("/page.html")) return route.fulfill({ contentType: "text/html", body: PAGE });
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto(URL_);
  await page.waitForSelector(".fa-search-home");
}

/** Is THIS element what a press at its centre lands on? */
const pressable = (page: Page, sel: string) =>
  page.locator(sel).evaluate((n) => {
    const r = n.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return "no box";
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (hit && (hit === n || n.contains(hit))) return "yes";
    return hit ? `covered by ${hit.tagName}${(hit as HTMLElement).hasAttribute("data-fa-staging-banner") ? " [staging banner]" : ""}` : "nothing";
  });

/** Do two elements' boxes intersect? */
const overlaps = (page: Page, a: string, b: string) =>
  page.evaluate(([a, b]) => {
    const p = document.querySelector(a)?.getBoundingClientRect();
    const q = document.querySelector(b)?.getBoundingClientRect();
    if (!p || !q || !p.width || !q.width) return false;
    return p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
  }, [a, b] as const);

const home = ".fa-search-home";
const peek = ".fa-search-peek";
const input = "#search-input";

for (const width of [1280, 390]) {
  test.describe(`search collapses to a magnifier and opens full width — ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await load(page);
      await expect(page.locator("[data-fa-staging-banner]")).toBeVisible();
    });

    test("closed on load: a named magnifier, reachable, costing no vertical space", async ({ page }) => {
      await expect(page.locator(home)).toHaveAttribute("data-open", "false");
      await expect(page.locator(input)).toBeHidden();
      // Still IN the document: the theme finds its input by id.
      await expect(page.locator(input)).toHaveCount(1);
      const p = page.locator(peek);
      await expect(p).toHaveAccessibleName("Search");
      await expect(p).toHaveAttribute("aria-expanded", "false");
      expect(await pressable(page, peek)).toBe("yes");
      const b = (await p.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(24);
      expect(b.width).toBeGreaterThanOrEqual(24);
      // At the TOP of the display panel, at its inline end — in the band's
      // row since #2201, which pads the row by 2px.
      const wrap = (await page.locator(".main-content-wrap").boundingBox())!;
      expect(Math.abs(b.y - wrap.y)).toBeLessThanOrEqual(4);
      expect(b.x + b.width).toBeGreaterThan(wrap.x + wrap.width * 0.75);
      // No vertical cost: the heading starts where it would with no search.
      const cost = await page.evaluate(() => {
        const h = document.querySelector(".main-content h1")!;
        const withIt = h.getBoundingClientRect().top;
        (document.querySelector(".fa-search-home") as HTMLElement).style.display = "none";
        const without = h.getBoundingClientRect().top;
        (document.querySelector(".fa-search-home") as HTMLElement).style.display = "";
        return withIt - without;
      });
      expect(cost).toBe(0);
    });

    test("open spans the rest of the band — field AND results — with the magnifier still at the end", async ({ page }) => {
      // #2201: the band's row holds the locale selector at the inline-start,
      // so the field spans from there to the panel's end, and the magnifier
      // STAYS at the end rather than moving to the field's leading edge.
      await page.locator(peek).click();
      await expect(page.locator(home)).toHaveAttribute("data-open", "true");
      await expect(page.locator(peek)).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(input)).toBeFocused();
      const wrap = await page.locator(".main-content-wrap").evaluate((w) => {
        const r = w.getBoundingClientRect();
        const cs = getComputedStyle(w);
        return { left: r.left + parseFloat(cs.paddingLeft), right: r.right - parseFloat(cs.paddingRight) };
      });
      const row = (await page.locator(home).boundingBox())!;
      const lang = (await page.locator(".fa-page-lang-bar").boundingBox())!;
      expect(row.x).toBeGreaterThanOrEqual(lang.x + lang.width);
      expect(Math.abs(row.x + row.width - wrap.right)).toBeLessThanOrEqual(1);
      // One row: the field, then the magnifier at the end, the same height.
      const pb = (await page.locator(peek).boundingBox())!;
      const ib = (await page.locator(input).boundingBox())!;
      expect(Math.abs(pb.y - ib.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(pb.height - ib.height)).toBeLessThanOrEqual(1);
      expect(ib.x + ib.width).toBeLessThanOrEqual(pb.x);
      expect(Math.abs(pb.x + pb.width - wrap.right)).toBeLessThanOrEqual(1);
      // The field takes most of what is left.
      expect(ib.width).toBeGreaterThan((wrap.right - (lang.x + lang.width)) * 0.6);
      // Results take the field's width, below it. Shown here the way the
      // theme shows them (`search-active` on <html>) with one hit, since this
      // page loads no index.
      await page.evaluate(() => {
        document.documentElement.classList.add("search-active");
        document.getElementById("search-results")!.innerHTML =
          '<ul class="search-results-list"><li class="search-results-list-item"><a class="search-result" href="#">A hit</a></li></ul>';
      });
      const rb = (await page.locator("#search-results").boundingBox())!;
      expect(Math.abs(rb.x - ib.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(rb.width - ib.width)).toBeLessThanOrEqual(2);
      expect(rb.y).toBeGreaterThanOrEqual(ib.y + ib.height - 1);
    });

    test("keyboard: Enter or Space opens into the field, Escape closes back onto the magnifier", async ({ page }) => {
      const p = page.locator(peek);
      await p.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(input)).toBeFocused();
      await expect(p).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.type("bean");
      await page.keyboard.press("Escape");
      await expect(page.locator(home)).toHaveAttribute("data-open", "false");
      await expect(p).toHaveAttribute("aria-expanded", "false");
      await expect(p).toBeFocused();
      await expect(page.locator(input)).toBeHidden();
      // Closing is not clearing: the same node, with what was typed.
      await expect(page.locator(input)).toHaveValue("bean");
      await page.keyboard.press(" ");
      await expect(page.locator(input)).toBeFocused();
      await expect(page.locator(input)).toHaveValue("bean");
      // The magnifier is the toggle both ways.
      await p.click();
      await expect(page.locator(home)).toHaveAttribute("data-open", "false");
      await expect(p).toBeFocused();
    });

    test("every page arrives with search closed, even after it was left open", async ({ page }) => {
      // Owner, 2026-10-05: "start with search bar closed". The open state
      // used to be remembered per viewer and restored on the next page.
      await page.locator(peek).click();
      await expect(page.locator(home)).toHaveAttribute("data-open", "true");
      await page.reload();
      await page.waitForSelector(home);
      await expect(page.locator(home)).toHaveAttribute("data-open", "false");
      await expect(page.locator(input)).toBeHidden();
      expect(await pressable(page, peek)).toBe("yes");
    });

    test("never overlaps the Folio handle, closed or open, at rest or scrolled", async ({ page }) => {
      await page.waitForSelector(".fa-glass-handle", { state: "attached" });
      expect(await overlaps(page, peek, ".fa-glass-handle")).toBe(false);
      // Open, the field spans the band's centre, so the handle steps aside
      // (#2201) rather than sitting on it — hidden, and back once closed.
      await page.locator(peek).click();
      await expect(page.locator(".fa-glass-handle")).toBeHidden();
      await page.locator(peek).click();
      await expect(page.locator(".fa-glass-handle")).toBeVisible();
      // Scrolled, the magnifier goes with the content; the handle stays fixed
      // at the top centre, and the one never lands on the other's box while
      // the other is still pressable.
      for (const y of [20, 60, 120]) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        expect(await pressable(page, ".fa-glass-handle")).toBe("yes");
      }
    });
  });
}
