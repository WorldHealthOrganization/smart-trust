import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { FRAGMENT } from "../../scripts/staging-banner.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * THE SEARCH MAGNIFIER IS ON SCREEN AT EVERY SCROLL POSITION — issue #1732.
 *
 * #1715 / PR #1720 made search a magnifier at the top of the display window
 * that opens to the panel's full width. It was IN FLOW, so it scrolled away
 * with the page: measured on a local build of `platform.html`, it could be
 * pressed at 1 of 14 sampled scroll positions at 1280px and 2 of 25 at
 * 390px. The owner decided (2026-10-01) it should ALWAYS be on screen.
 *
 * It is now `position: sticky` below the Folio handle's row. What this spec
 * holds, by HIT TEST rather than by visibility (a control under another
 * element is "visible" to every locator and still cannot be pressed):
 *
 *   - at every scroll position, top to bottom, the magnifier takes the press;
 *   - it never shares a box with the Folio handle, PR #1709's
 *     `.fa-glass-band`, the staging banner, or the phone header's menu
 *     button — at 1280 and 390, light and dark, LTR and RTL;
 *   - opened mid-page it still spans the panel, focus goes into the field,
 *     Escape closes and returns focus, `aria-expanded` follows;
 *   - and the reader keeps their place: just-the-docs scrolls the window to
 *     the top on every keystroke (`window.scroll(0, -1)` then `(0, 0)`, an
 *     iOS workaround for ITS full-screen overlay), which mid-page threw the
 *     reader back to the top of the page. That call is now refused while our
 *     field is open and focused.
 *
 * The page mounts the staging banner the injector actually ships
 * (`FRAGMENT`), a just-the-docs-shaped side bar with its `#menu-button`, and
 * docs-ui inlined, so the handle and the band are the real ones.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERAL that builds the page (bean `bmr0`).
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const SEARCH =
  '<div class="search" role="search"><div class="search-input-wrap">' +
  '<input type="text" id="search-input" class="search-input" autocomplete="off">' +
  '<label for="search-input" class="search-label"><span class="sr-only">Search folio-assistant</span></label>' +
  '</div><div id="search-results" class="search-results"></div></div>';

const PARA =
  "<p>A process here is not a picture of a workflow drawn after the fact. The file is the source " +
  "of truth, and the running instance is committed so a sibling session sees the same position.</p>";

function page(dir: "ltr" | "rtl"): string {
  return `<!doctype html><html lang="${dir === "rtl" ? "ar" : "en"}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${CSS}</style>
<style>
  body { margin: 0; font: 16px/1.6 sans-serif; }
  :root[data-fa-scheme="light"] body { background: #ffffff; color: #222; }
  :root[data-fa-scheme="dark"] body { background: #27262b; color: #e6e9ee; }
  .side-bar { position: fixed; inset-inline-start: 0; top: 0; bottom: 0; width: 56px; }
  .site-header { display: flex; justify-content: space-between; align-items: center; height: 48px; }
  #menu-button { width: 40px; height: 40px; }
  .main { margin-inline-start: 56px; }
  .main-content-wrap { padding: 0 32px 50vh; }
  @media (max-width: 799px) {
    .side-bar { position: static; width: auto; }
    .main { margin-inline-start: 0; }
    .main-content-wrap { padding: 0 14px 50vh; }
  }
</style></head><body>${FRAGMENT}
<div class="side-bar"><div class="site-header"><a class="site-title">folio-assistant</a>
<button id="menu-button" class="site-button" aria-label="Menu">=</button></div></div>
<div class="main"><div class="main-header">${SEARCH}</div><div class="main-content-wrap">
<div class="main-content"><h1>A long page</h1>${PARA.repeat(60)}</div></div></div>
<script>${JS}<\/script></body></html>`;
}

const HOST = "http://pinned.test/folio-assistant/STAGING/some-branch/";

async function open(p: Page, width: number, scheme: string, dir: "ltr" | "rtl") {
  await p.route("http://pinned.test/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith("/page.html")) return route.fulfill({ contentType: "text/html", body: page(dir) });
    return route.fulfill({ status: 404, body: "not found" });
  });
  await p.addInitScript((s) => { try { localStorage.setItem("fa-color-scheme", s); } catch { /* none */ } }, scheme);
  await p.setViewportSize({ width, height: 844 });
  await p.goto(HOST + "page.html");
  await p.waitForSelector(".fa-search-peek");
  await p.waitForSelector(".fa-glass-handle", { state: "attached" });
}

async function scrollTo(p: Page, y: number) {
  await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), y);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Where the magnifier is, whether a press lands on it, and what it overlaps. */
function probe(p: Page) {
  return p.evaluate(() => {
    const box = (s: string) => {
      const e = document.querySelector(s) as HTMLElement | null;
      if (!e || e.hidden) return null;
      const r = e.getBoundingClientRect();
      return r.width && r.height ? r : null;
    };
    const m = box(".fa-search-peek")!;
    const meets = (o: DOMRect | null) =>
      !!o && m.left < o.right && o.left < m.right && m.top < o.bottom && o.top < m.bottom;
    const hit = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
    const overlaps = Object.entries({
      // NOT the glass band: since #2201 the magnifier lives IN it, and the
      // band is the row it is pinned by. `inBand` below says so.
      "Folio handle": box(".fa-glass-handle"),
      "staging banner": box("[data-fa-staging-banner]"),
      "menu button": box("#menu-button"),
    }).filter(([, o]) => meets(o)).map(([k]) => k);
    const band = box(".fa-glass-band");
    return {
      inBand: !!band && m.left >= band.left && m.right <= band.right && m.top >= band.top && m.bottom <= band.bottom,
      onScreen: m.top >= 0 && m.bottom <= innerHeight && m.left >= 0 && m.right <= innerWidth,
      pressable: !!hit && !!hit.closest(".fa-search-peek"),
      overlaps,
    };
  });
}

for (const dir of ["ltr", "rtl"] as const) {
  for (const width of [1280, 390]) {
    for (const scheme of ["light", "dark"]) {
      test.describe(`pinned search magnifier — ${width}px ${scheme} ${dir}`, () => {
        test.beforeEach(async ({ page: p }) => { await open(p, width, scheme, dir); });

        test("reachable and overlapping nothing at every scroll position", async ({ page: p }) => {
          await expect(p.locator("[data-fa-staging-banner]")).toBeVisible();
          const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
          expect(max).toBeGreaterThan(2000);
          const findings: string[] = [];
          // 97px steps: never a multiple of a line height, so the samples drift
          // across every phase of the scroll rather than repeating one.
          for (let y = 0; y <= max + 97; y += 97) {
            await scrollTo(p, Math.min(y, max));
            const s = await probe(p);
            if (!s.onScreen) findings.push(`scrollY ${y}: off screen`);
            else if (!s.pressable) findings.push(`scrollY ${y}: covered`);
            if (!s.inBand) findings.push(`scrollY ${y}: not inside the glass band`);
            for (const o of s.overlaps) findings.push(`scrollY ${y}: overlaps the ${o}`);
          }
          expect(findings).toEqual([]);
        });

        test("opened mid-page: full width, focus in, place kept, Escape back", async ({ page: p }) => {
          await scrollTo(p, 1500);
          const before = await p.evaluate(() => scrollY);
          const peek = p.locator(".fa-search-peek");
          await peek.focus();
          await p.keyboard.press("Enter");
          await expect(p.locator("#search-input")).toBeFocused();
          await expect(peek).toHaveAttribute("aria-expanded", "true");
          // just-the-docs' per-keystroke reset, exactly as the theme makes it.
          await p.evaluate(() => { window.scroll(0, -1); window.scroll(0, 0); });
          // The row is in flow at the page top, so opening it may shift the
          // document by the row's own height — and no more.
          const after = await p.evaluate(() => scrollY);
          expect(Math.abs(after - before)).toBeLessThanOrEqual(60);
          // Full panel width, on screen, below the handle's row and band.
          const wrap = await p.locator(".main-content-wrap").evaluate((w) => {
            const r = w.getBoundingClientRect();
            const cs = getComputedStyle(w);
            return { left: r.left + parseFloat(cs.paddingLeft), right: r.right - parseFloat(cs.paddingRight) };
          });
          // The band spans the panel; search runs to its inline end (#2201,
          // the locale selector holds the inline-start).
          const band = (await p.locator(".fa-glass-band").boundingBox())!;
          expect(Math.abs(band.x - wrap.left)).toBeLessThanOrEqual(1);
          expect(Math.abs(band.x + band.width - wrap.right)).toBeLessThanOrEqual(1);
          const row = (await p.locator(".fa-search-home").boundingBox())!;
          if (dir === "ltr") expect(Math.abs(row.x + row.width - wrap.right)).toBeLessThanOrEqual(1);
          else expect(Math.abs(row.x - wrap.left)).toBeLessThanOrEqual(1);
          expect(row.y).toBeGreaterThanOrEqual(0);
          const s = await probe(p);
          expect(s.overlaps).toEqual([]);
          await p.evaluate(() => {
            document.documentElement.classList.add("search-active");
            document.getElementById("search-results")!.innerHTML =
              '<ul class="search-results-list"><li><a class="search-result" href="#">A hit</a></li></ul>';
          });
          const rb = (await p.locator("#search-results").boundingBox())!;
          const ib = (await p.locator("#search-input").boundingBox())!;
          expect(Math.abs(rb.width - ib.width)).toBeLessThanOrEqual(2);
          await p.keyboard.press("Escape");
          await expect(peek).toBeFocused();
          await expect(peek).toHaveAttribute("aria-expanded", "false");
          // Closed, the window scrolls freely again: the refusal is scoped to
          // an open, focused field.
          await p.evaluate(() => window.scroll(0, 0));
          expect(await p.evaluate(() => scrollY)).toBe(0);
        });
      });
    }
  }
}
