import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { FRAGMENT } from "../scripts/staging-banner.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * SEARCH AND THE LOCALE SELECTOR SHARE THE GLASS BAND — issue #2201.
 *
 * The owner, 2026-10-05, from two screenshots of the smart-trust pages:
 *
 *   1. the search bar must not overwrite text — the status/count line never
 *      overlaps the input;
 *   2. the magnifier stays on the right, in both states, with the closed
 *      styling;
 *   3. one click opens, one click closes, with the same button;
 *   4. the search text is kept on close and shown on reopen;
 *   5. opening search does not push the locale selector onto the next line;
 *   6. ideally both live in the `fa-glass-band`, and the Folio tab hides
 *      while either is in use.
 *
 * Measured before the change on the gh-pages build of `smart-trust/index.html`
 * at 1280px: the "Search everywhere" button at x=124, y=92 — inside the
 * input's own box — and the locale bar dropping from y=96 to y=164 on open.
 *
 * The fixture mounts the staging banner the injector ships, a just-the-docs
 * shaped side bar and panel, and the theme's search markup — including the
 * two status lines the theme's script adds (one before docs-ui runs, as when
 * the index is already cached; one after, as when its fetch settles), so
 * both arrival orders are covered.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERAL that builds the page (bean `bmr0`).
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

// The "Search everywhere" button is ALREADY there, as the theme leaves it when
// its fetch settled before docs-ui ran.
const SEARCH =
  '<div class="search" role="search"><div class="search-input-wrap">' +
  '<input type="text" id="search-input" class="search-input" autocomplete="off" placeholder="Search folio-assistant">' +
  '<label for="search-input" class="search-label"><span class="sr-only">Search folio-assistant</span></label>' +
  '</div><div id="search-results" class="search-results"></div>' +
  '<button type="button" class="search-everywhere btn btn-outline">' +
  "Search everywhere (15601 entries, 16.9 MB) — now searching smart-trust</button></div>";

const META = JSON.stringify({ lang: "en", availableLocales: ["en", "fr", "es"] });

const PARA =
  "<p>A process here is not a picture of a workflow drawn after the fact. The file is the source " +
  "of truth, and the running instance is committed so a sibling session sees the same position.</p>";

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="fa-search-index" content="published">
<script type="application/json" id="fa-translation-meta">${META}</script>
<style>${CSS}</style>
<style>
  body { margin: 0; font: 16px/1.6 sans-serif; background: #ffffff; color: #222; }
  .side-bar { position: fixed; inset-inline-start: 0; top: 0; bottom: 0; width: 56px; }
  .main { margin-inline-start: 56px; }
  .main-header { height: 60px; }
  .main-content-wrap { padding: 0 32px 50vh; }
  @media (max-width: 799px) {
    .side-bar { position: static; width: auto; height: 60px; }
    .main { margin-inline-start: 0; }
    .main-content-wrap { padding: 0 14px 50vh; }
  }
</style></head><body>${FRAGMENT}
<div class="side-bar"><div class="site-header"><a class="site-title">folio-assistant</a></div></div>
<div class="main"><div class="main-header">${SEARCH}</div><div class="main-content-wrap">
<div class="main-content"><h1>A long page</h1>${PARA.repeat(60)}</div></div></div>
<script>${JS}<\/script>
<script>
  // The theme's second status line, added when ITS fetch settles — after
  // docs-ui has run — exactly where just-the-docs puts it: at the end of the
  // results list's parent.
  setTimeout(function () {
    var results = document.getElementById("search-results");
    var box = document.createElement("div");
    box.className = "search-remote";
    box.innerHTML = '<a class="search-remote-link" href="#">Look up an identifier in who-iris (10 referenced entries) →</a>';
    results.parentNode.appendChild(box);
  }, 50);
<\/script></body></html>`;

const URL_ = "http://band.test/folio-assistant/STAGING/some-branch/page.html";

const band = ".fa-glass-band";
const peek = ".fa-search-peek";
const home = ".fa-search-home";
const input = "#search-input";
const lang = ".fa-page-lang-bar";
const langToggle = ".fa-page-lang-toggle";
const tab = ".fa-page-lang-tab";
/** At and below 40rem (640px) the toggle reads "globe EN" with a caret;
 *  above it, the globe alone. At every width it starts closed (owner,
 *  2026-10-05: "make globe click open and closed the desktop view of the
 *  locale selector. start closed too"). */
const isPhone = (width: number) => width <= 640;
const handle = ".fa-glass-handle";

async function load(page: Page, width: number) {
  await page.route("http://band.test/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith("/page.html")) return route.fulfill({ contentType: "text/html", body: PAGE });
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.setViewportSize({ width, height: 844 });
  await page.goto(URL_);
  await page.waitForSelector(home);
  await page.waitForSelector(handle, { state: "attached" });
  await page.waitForSelector(".search-remote", { state: "attached" });
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const rect = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error("no box for " + sel);
  return b;
};

/** Is THIS element what a press at its centre lands on? */
const pressable = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((n) => {
    const r = n.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return "no box";
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit && (hit === n || n.contains(hit)) ? "yes" : "covered by " + (hit ? hit.className || hit.tagName : "nothing");
  });

for (const width of [1280, 390]) {
  test.describe(`search and locale selector in the glass band — ${width}px`, () => {
    test.beforeEach(async ({ page }) => { await load(page, width); });

    test("both controls are in the band, the locale selector at the start and the magnifier at the end", async ({ page }) => {
      // The preconditions: styled, and the band in its controls mode.
      expect(await page.evaluate(() => document.styleSheets.length)).toBeGreaterThan(1);
      await expect(page.locator(band)).toHaveAttribute("data-fa-band-tools", "");
      await expect(page.locator(`${band} ${lang}`)).toHaveCount(1);
      await expect(page.locator(`${band} ${home}`)).toHaveCount(1);
      const b = await rect(page, band);
      const l = await rect(page, lang);
      const m = await rect(page, peek);
      expect(Math.abs(l.x - b.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.x + m.width - (b.x + b.width))).toBeLessThanOrEqual(1);
    });

    test("one button opens and closes, and the magnifier does not move", async ({ page }) => {
      const p = page.locator(peek);
      const closed = await rect(page, peek);
      await expect(page.locator(input)).toBeHidden();
      await p.click();
      await expect(page.locator(home)).toHaveAttribute("data-open", "true");
      await expect(p).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(input)).toBeVisible();
      const open = await rect(page, peek);
      // Same place, same size: still on the right (#2201 point 2).
      expect(Math.abs(open.x - closed.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(open.y - closed.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(open.width - closed.width)).toBeLessThanOrEqual(1);
      // Same look: the closed state's round ring.
      const radius = await p.evaluate((n) => getComputedStyle(n).borderTopLeftRadius);
      expect(radius).toBe("50%");
      // The SAME button closes it — one click.
      await p.click();
      await expect(page.locator(home)).toHaveAttribute("data-open", "false");
      await expect(p).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator(input)).toBeHidden();
    });

    test("the text is kept when search closes, and shown when it reopens", async ({ page }) => {
      const p = page.locator(peek);
      await p.click();
      await page.locator(input).fill("trust list");
      await p.click();
      await expect(page.locator(input)).toBeHidden();
      await p.click();
      await expect(page.locator(input)).toBeVisible();
      await expect(page.locator(input)).toHaveValue("trust list");
    });

    test("no status line shares the field's box — they all sit below it", async ({ page }) => {
      await page.locator(peek).click();
      const ib = await rect(page, input);
      const lines = [".search-everywhere", ".search-remote", ".fa-search-notice"];
      for (const sel of lines) {
        // Each one is really there and really shown, or the check is empty.
        await expect(page.locator(sel)).toBeVisible();
        const b = await rect(page, sel);
        const meets = b.x < ib.x + ib.width && ib.x < b.x + b.width && b.y < ib.y + ib.height && ib.y < b.y + b.height;
        expect(meets, `${sel} overlaps the field`).toBe(false);
        expect(b.y, `${sel} is not below the field`).toBeGreaterThanOrEqual(ib.y + ib.height - 1);
      }
      // And the field's own text area is what a press at its centre reaches.
      expect(await pressable(page, input)).toBe("yes");
      // No tooltip on the magnifier while open: it drew over these lines.
      await expect(page.locator(peek)).not.toHaveAttribute("title", /.*/);
    });

    test("opening search leaves the locale selector on the same line, at the same top", async ({ page }) => {
      const before = await rect(page, lang);
      await page.locator(peek).click();
      await expect(page.locator(input)).toBeVisible();
      const after = await rect(page, lang);
      expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(0.5);
      // Same line as the field, and not overlapped by the open search.
      const ib = await rect(page, input);
      expect(Math.abs(after.y - ib.y)).toBeLessThanOrEqual(2);
      const row = await rect(page, home);
      expect(row.x).toBeGreaterThanOrEqual(after.x + after.width);
      expect(await pressable(page, langToggle)).toBe("yes");
    });

    test("on arrival search is closed and the locale tabs are hidden", async ({ page }) => {
      // Owner, 2026-10-05: "start with search bar closed ... start closed too".
      await expect(page.locator(home)).toHaveAttribute("data-open", "false");
      await expect(page.locator(input)).toBeHidden();
      await expect(page.locator(langToggle)).toBeVisible();
      await expect(page.locator(langToggle)).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator(tab).first()).toBeHidden();
      await expect(page.locator(handle)).toBeVisible();
      // Not restored from an earlier page either: a viewer who left search
      // open, under the key #2202 wrote, still arrives to it closed.
      await page.evaluate(() => { try { localStorage.setItem("fa-search-open", "true"); } catch { /* none */ } });
      await page.reload();
      await page.waitForSelector(home);
      await expect(page.locator(home)).toHaveAttribute("data-open", "false");
      await expect(page.locator(input)).toBeHidden();
    });

    if (!isPhone(width)) {
      test("wide: the globe opens and closes the six inline tabs, one click each", async ({ page }) => {
        const t = page.locator(langToggle);
        // The globe alone: no language code, no caret.
        await expect(t).toBeVisible();
        await expect(page.locator(".fa-page-lang-current")).toBeHidden();
        await expect(page.locator(tab).first()).toBeHidden();
        const globe = await rect(page, langToggle);
        await t.click();
        await expect(t).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator(tab)).toHaveCount(6);
        for (let i = 0; i < 6; i++) await expect(page.locator(tab).nth(i)).toBeVisible();
        // Inline beside the globe, on the band's one line, clear of search.
        const b = await rect(page, band);
        const tops = await page.locator(tab).evaluateAll((ns) => ns.map((n) => Math.round(n.getBoundingClientRect().top)));
        expect(new Set(tops).size).toBe(1);
        const first = await rect(page, `${tab} >> nth=0`);
        expect(first.x).toBeGreaterThanOrEqual(globe.x + globe.width - 1);
        const last = await rect(page, `${tab} >> nth=5`);
        expect(last.x + last.width).toBeLessThan((await rect(page, peek)).x);
        expect(last.y + last.height).toBeLessThanOrEqual(b.y + b.height);
        // The globe did not move when they opened.
        const after = await rect(page, langToggle);
        expect(Math.abs(after.x - globe.x)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(after.y - globe.y)).toBeLessThanOrEqual(0.5);
        // One click to switch: an available locale is a link, pressable as it stands.
        const fr = page.locator(tab, { hasText: "FR" });
        await expect(fr).toHaveAttribute("href", /\/fr\//);
        expect(await pressable(page, `${tab}[href*="/fr/"]`)).toBe("yes");
        // The same globe closes them.
        await t.click();
        await expect(t).toHaveAttribute("aria-expanded", "false");
        await expect(page.locator(tab).first()).toBeHidden();
      });
    } else {
      test("phone: the tabs collapse into the globe dropdown", async ({ page }) => {
        const t = page.locator(langToggle);
        await expect(t).toBeVisible();
        await expect(t).toContainText("EN");
        await expect(page.locator(tab).first()).toBeHidden();
        await t.click();
        await expect(t).toHaveAttribute("aria-expanded", "true");
        for (let i = 0; i < 6; i++) await expect(page.locator(tab).nth(i)).toBeVisible();
        await t.click();
        await expect(page.locator(tab).first()).toBeHidden();
      });
    }

    test("the Folio tab hides while a band item is open, and comes back", async ({ page }) => {
      const h = page.locator(handle);
      await expect(h).toBeVisible();
      // Search.
      await page.locator(peek).click();
      await expect(h).toBeHidden();
      await page.locator(peek).click();
      await expect(h).toBeVisible();
      // The locale tabs (inline on a wide screen, the dropdown on a phone):
      // the same button opens and closes them.
      const t = page.locator(langToggle);
      await t.click();
      await expect(t).toHaveAttribute("aria-expanded", "true");
      await expect(h).toBeHidden();
      await t.click();
      await expect(t).toHaveAttribute("aria-expanded", "false");
      await expect(h).toBeVisible();
      // One item at a time: opening search closes the locale tabs; the
      // locale button stays where it was.
      await t.click();
      await page.locator(peek).click();
      await expect(t).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator(home)).toHaveAttribute("data-open", "true");
      await expect(h).toBeHidden();
      // Escape closes search and gives the Folio tab back.
      await page.keyboard.press("Escape");
      await expect(page.locator(home)).toHaveAttribute("data-open", "false");
      await expect(h).toBeVisible();
    });

    test("scrolled, the band sticks on the handle's row and both controls stay pressable", async ({ page }) => {
      for (const y of [400, 1500, 3000]) {
        await scrollTo(page, y);
        const hb = await rect(page, handle);
        const bb = await rect(page, band);
        expect(Math.abs(bb.y - hb.y), `band top at scrollY ${y}`).toBeLessThanOrEqual(1);
        expect(bb.height).toBeGreaterThanOrEqual(hb.height);
        expect(await pressable(page, peek)).toBe("yes");
        expect(await pressable(page, langToggle)).toBe("yes");
        // The handle sits between the two, touching neither.
        const m = await rect(page, peek);
        const l = await rect(page, langToggle);
        expect(hb.x).toBeGreaterThanOrEqual(l.x + l.width);
        expect(hb.x + hb.width).toBeLessThanOrEqual(m.x);
      }
      // Opening mid-page keeps the reader's place.
      await scrollTo(page, 1500);
      await page.locator(peek).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(input)).toBeFocused();
      expect(await page.evaluate(() => scrollY)).toBe(1500);
    });
  });
}
