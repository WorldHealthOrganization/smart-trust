import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { railedViewer } from "./railed-fixture.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";
import { COPY_ID_SUFFIX } from "../scripts/gen-navbar-include.ts";

/**
 * Bean `ob3m` finding 1 — the owner's ruling, 2026-10-01, option 1 of 4:
 * *"Make ▦ Harnesses visible on the landing page too, and show each icon's
 * name as a tooltip on hover or keyboard focus."*
 *
 * Measured on #1762's head (644d04b9959) before this was written, 1280x800:
 * the landing strip showed six icons and no ▦ (`opacity: 0` and
 * `max-height: 0` at rest), so reaching a harness took a hover and then a
 * click; the icons were named by `aria-label` only, and hovering one widened
 * the strip and moved the icon out from under the pointer. Every test here
 * FAILED against that head.
 *
 * WHAT IS SERVED, not a restatement: the docs site's own `docs-ui.css` and
 * `docs-ui.js`, the GENERATED bottom region (`_includes/generated/
 * navbar-footer.html`, its Liquid resolved the way `relative_url` would), the
 * row this layer resolved (`_data/harness.json`), and a standalone viewer
 * page railed by the generators' own `withViewerNav` (`railed-fixture.ts`).
 * Only the theme's own
 * sidebar container is hand-built, as `navbar-row.e2e.ts` does, because the
 * theme arrives through `remote_theme` and is not in this checkout.
 *
 * NO BACKTICKS INSIDE THE PAGE TEMPLATE LITERAL — one ends the string, and
 * the file then reports "No tests found" rather than a syntax error (`bmr0`).
 */

const ROOT = join(HARNESS_ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));
// The row's own stylesheet FIRST, as `head_custom.html` links it (beans `lhvt`, `9rq1`).
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/navbar-row.css"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
// `navbar-row.js` FIRST — it draws the row, and `docs-ui.js` calls it — as `head_custom.html` loads them.
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const QR = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");
const BASEURL = "/folio-assistant";
const ROW = (JSON.parse(readFileSync(overlayPath(join(SITE, "_data/harness.json")), "utf8")) as { navbar: unknown }).navbar;

/** The canonical (non-staging) bottom region, with `relative_url` applied. */
const FOOTER = (() => {
  const src = readFileSync(overlayPath(join(SITE, "_includes/generated/navbar-footer.html")), "utf8");
  const line = src.split("\n").find((l) => l.startsWith('<div class="fa-nav-in">'));
  if (!line) throw new Error("navbar-footer.html carries no regions line — run `bun run cat navbar:include`.");
  // The FIRST copy of the include, as the theme renders it: its ids carry no
  // per-copy suffix (gen-navbar-include COPY_ID_SUFFIX).
  return line.split(COPY_ID_SUFFIX).join("").replace(/\{\{\s*'([^']*)'\s*\|\s*relative_url\s*\}\}/g, (_m, p: string) => BASEURL + p);
})();

// BUILT, not read (2026-10-07). This read one committed standalone viewer —
// `beans/`, then `qa/`, then `translation-status/` — and lost it each time
// that page moved onto the theme's layout. The rail is the subject, so the
// rail is what `railedViewer()` builds, through the generators' own writer.
const VIEWER = railedViewer();

function landing(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="fa-baseurl" content="${BASEURL}">
  <style>
  body { margin: 0; font-family: sans-serif; }
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; align-items: flex-end;
              background: #f5f6fa; color: #27262b; }
  .site-header { width: 100%; max-height: 3.75rem; overflow: hidden; display: flex; align-items: center; }
  .site-title { flex: 1; }
  .site-nav { width: 100%; overflow-y: auto; }
  .site-nav a { display: block; padding: 4px 32px; font-size: 14px; line-height: 24px; }
  ${CSS}
</style></head><body>
  <script type="application/json" id="fa-navbar-row">${JSON.stringify(ROW)}<\/script>
  <div class="side-bar">
    <div class="site-header"><a class="site-title" href="#"><span class="fa-site-mark"></span><span class="fa-site-title">C@T Harness</span></a></div>
    <nav class="site-nav"><a href="#">Navigation link</a></nav>
    <footer class="site-footer"><input type="checkbox" class="fa-nav-open" id="fa-nav-open">${FOOTER}</footer>
  </div>
  <div class="main"><div class="main-content"><h1 id="t">Landing</h1></div></div>
  <script>window.jtd = { theme: "light",
    getTheme: function () { return this.theme; },
    setTheme: function (t) { this.theme = t; } };<\/script>
  <script>${QR}<\/script>
  <script>${JS}<\/script>
</body></html>`;
}

/** A file under the site's `assets/`, served as itself — `undefined` for anything else. */
function siteAsset(path: string): { contentType: string; body: string } | undefined {
  const at = path.indexOf("/assets/");
  if (at < 0) return undefined;
  const file = join(SITE, path.slice(at + 1));
  if (!existsSync(file)) return undefined;
  const type = file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : "application/octet-stream";
  return { contentType: type, body: readFileSync(file, "utf8") };
}

async function open(p: Page, which: "landing" | "viewer"): Promise<string[]> {
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.route("http://rail.fixture/**", (r) => {
    // A committed viewer links the row's own files (`injectRail`, bean
    // `lhvt`); serve the real ones there rather than the page's HTML.
    const path = new URL(r.request().url()).pathname;
    // The site's own assets — the row's and the rail's files a railed page links (beans `lhvt`, `lnoy`).
    const asset = siteAsset(path);
    if (asset) return r.fulfill(asset);
    return r.fulfill({ contentType: "text/html", body: which === "landing" ? landing() : VIEWER });
  });
  await p.goto("http://rail.fixture/" + which + "/", { waitUntil: "load" });
  // At rest means the pointer is NOT on the strip — see navbar-row.e2e.ts.
  await p.mouse.move(1200, 700);
  await p.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await Promise.all(
      document.getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    );
  });
  return errors;
}

const STRIP = { landing: ".side-bar", viewer: ".fa-nav" } as const;

/**
 * The Harnesses ICON, at rest: drawn, opaque, inside the strip and the
 * viewport. Owner, 2026-11-13: *"remove the harnesses navbar, instead add an
 * icon to the controls to show the harnesses"* -- it was a disclosure's summary.
 */
async function harnessesAtRest(p: Page, which: "landing" | "viewer") {
  return p.evaluate((sel) => {
    const strip = document.querySelector(sel)!.getBoundingClientRect();
    const sum = document.querySelector(sel + ' button.fa-nav-harnesses[aria-label="Harnesses"]') as HTMLElement | null;
    if (!sum) return null;
    const g = sum.querySelector("svg")!.getBoundingClientRect();
    let op = 1;
    for (let n: Element | null = sum; n; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    return {
      strip: Math.round(strip.width),
      glyph: { left: Math.round(g.left), right: Math.round(g.right), top: Math.round(g.top), bottom: Math.round(g.bottom) },
      opacity: op,
      x: g.left + g.width / 2,
      y: g.top + g.height / 2,
    };
  }, STRIP[which]);
}

/** Harness links a reader can see AND press: drawn, opaque, on screen, on top. */
async function visibleHarnessLinks(p: Page, which: "landing" | "viewer"): Promise<number> {
  return p.evaluate((sel) => {
    const strip = document.querySelector(sel)!.getBoundingClientRect();
    return [...document.querySelectorAll(sel + " #fa-nav-harnesses a")].filter((a) => {
      const r = a.getBoundingClientRect();
      let op = 1;
      for (let n: Element | null = a; n; n = n.parentElement) op *= +getComputedStyle(n).opacity;
      if (!(r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && op > 0.5)) return false;
      // HIT-TESTED, not inferred from a box: a closed disclosure's rows keep
      // boxes in Chromium, and a row under the home link is not one a reader
      // can press.
      const x = Math.min(r.left + 20, strip.right - 2);
      const hit = document.elementFromPoint(x, r.top + r.height / 2);
      return !!hit && a.contains(hit);
    }).length;
  }, STRIP[which]);
}

for (const which of ["landing", "viewer"] as const) {
  test(`${which}: ▦ Harnesses is visible at rest in a 56px strip, and ONE click reaches a harness`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = await open(page, which);
    expect(errors).toEqual([]);
    const at = await harnessesAtRest(page, which);
    expect(at).not.toBeNull();
    expect(at!.strip).toBe(56);
    // At the row's own resting opacity (`.fa-nav-icon`, .8), like every icon
    // beside it; not faded further.
    expect(at!.opacity).toBeGreaterThanOrEqual(0.8);
    expect(at!.glyph.left).toBeGreaterThanOrEqual(0);
    expect(at!.glyph.right).toBeLessThanOrEqual(56);
    expect(at!.glyph.bottom).toBeLessThanOrEqual(800);
    expect(await visibleHarnessLinks(page, which)).toBe(0);
    // ONE action: a click where the ▦ is drawn at rest.
    await page.mouse.click(at!.x, at!.y);
    await page.waitForTimeout(300);
    expect(await visibleHarnessLinks(page, which)).toBeGreaterThan(0);
  });
}

test.describe("landing: every icon in the strip is named on hover and on keyboard focus", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("hover: the tooltip is the aria-label, beside the 56px strip, not over the icon", async ({ page }) => {
    expect(await open(page, "landing")).toEqual([]);
    const icons = page.locator(".side-bar > .fa-nav-icons > .fa-nav-icon");
    const n = await icons.count();
    // Every declared slot (the retired `close` aside) plus the light/dark
    // switch. Read from the declaration, not a number: the owner changes the
    // row (2026-10-05 dropped processes and kg, bean `82qs`).
    const declared = (JSON.parse(readFileSync(join(HARNESS_ROOT, "cat-harness.json"), "utf-8"))
      .navbarIcons as string[]).filter((i) => i !== "close");
    // The light/dark switch, the Folio icon (owner, 2026-11-13) and the rail's
    // own Harnesses icon, which the row carries along.
    const extra = 2 + (await page.locator(".side-bar > .fa-nav-icons > .fa-nav-harnesses").count());
    expect(n).toBe(declared.length + extra);
    for (let i = 0; i < n; i++) {
      const box = (await icons.nth(i).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(250);
      const r = await icons.nth(i).evaluate((e) => {
        const a = getComputedStyle(e, "::after");
        return {
          name: e.getAttribute("aria-label"),
          content: a.content,
          opacity: +a.opacity,
          left: parseFloat(a.left),
          strip: document.querySelector(".side-bar")!.getBoundingClientRect().width,
          hovered: e.matches(":hover"),
          iconRight: e.getBoundingClientRect().right,
        };
      });
      expect(r.hovered).toBe(true);
      // The strip did not peek: the icon is still where the pointer is.
      expect(r.strip).toBe(56);
      expect(r.content).toContain(JSON.stringify(r.name));
      expect(r.opacity).toBeGreaterThan(0.9);
      expect(r.left).toBeGreaterThan(r.iconRight);
      expect(r.left).toBeGreaterThanOrEqual(56);
    }
  });

  test("keyboard focus: the tooltip shows, and the accessible name is still ONE name", async ({ page }) => {
    expect(await open(page, "landing")).toEqual([]);
    await page.locator(".side-bar .site-title").focus();
    // The row is at the FOOT of the bar since 2026-11-13 (owner: "put these
    // controls at the bottom of the navbar"), so the keyboard reaches it after
    // the bar's other stops: Tab until it lands in the row, bounded.
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => !!document.activeElement?.closest(".fa-nav-icons"))) break;
    }
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement;
      const a = getComputedStyle(e, "::after");
      return {
        inRow: !!e.closest(".fa-nav-icons"),
        role: e.tagName === "A" ? "link" : "button",
        fv: e.matches(":focus-visible"),
        name: e.getAttribute("aria-label"),
        content: a.content,
        opacity: +a.opacity,
        left: parseFloat(a.left),
        strip: document.querySelector(".side-bar")!.getBoundingClientRect().right,
      };
    });
    expect(r.inRow).toBe(true);
    expect(r.fv).toBe(true);
    expect(r.opacity).toBeGreaterThan(0.9);
    expect(r.content).toContain(JSON.stringify(r.name));
    expect(r.left).toBeGreaterThan(r.strip);
    // The tooltip's text has an EMPTY alternative, so a screen reader hears
    // the aria-label once — exact-name lookup finds exactly one control.
    await expect(page.getByRole(r.role as "link" | "button", { name: r.name!, exact: true })).toHaveCount(1);
    const snap = await page.locator(".side-bar .fa-nav-icons").ariaSnapshot();
    expect(snap).not.toContain(r.name + " " + r.name);
  });

  test("reduced motion: the tooltip appears without a transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await open(page, "landing")).toEqual([]);
    const first = page.locator(".side-bar .fa-nav-icon").first();
    const box = (await first.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const { d, shown } = await first.evaluate((e) => {
      const a = getComputedStyle(e, "::after");
      return { d: a.transitionDuration, shown: +a.opacity > 0.9 && a.content.includes(e.getAttribute("aria-label")!) };
    });
    expect(shown).toBe(true);
    // At most a millisecond: the site's global reduced-motion rule writes
    // 1e-6s rather than 0, which is instant to a reader.
    expect(d.split(",").every((x) => parseFloat(x) < 0.001)).toBe(true);
  });

  test("both schemes: the tooltip inverts against the page", async ({ page }) => {
    expect(await open(page, "landing")).toEqual([]);
    const ink = async () =>
      page.locator(".side-bar .fa-nav-icon").first().evaluate((e) => {
        const a = getComputedStyle(e, "::after");
        return [a.backgroundColor, a.color];
      });
    await page.evaluate(() => document.documentElement.setAttribute("data-fa-scheme", "light"));
    expect(await ink()).toEqual(["rgb(31, 35, 40)", "rgb(255, 255, 255)"]);
    await page.evaluate(() => document.documentElement.setAttribute("data-fa-scheme", "dark"));
    expect(await ink()).toEqual(["rgb(255, 255, 255)", "rgb(31, 35, 40)"]);
  });
});
