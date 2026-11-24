import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * THE FIRST PAINT IS DARK — owner, 2026-09-24, verbatim:
 *
 * > when any page/foio-asst/cat-harness first loads if flashes white before
 * > goignt o dark mode. instead it should deafult dark mode then turn to
 * > light mode to prevent light flash in dark.
 *
 * ## Where the white came from
 *
 * The site is configured dark (`color_scheme: dark`), so just-the-docs'
 * first stylesheet already IS the dark one. But `docs-ui.js` is deferred,
 * and on load it applied a STORED preference by calling `jtd.setTheme(name)`
 * — which swaps that first stylesheet's `href`. Swapping it to the dark file
 * when the default file is already dark still UNLOADS the sheet that was
 * painting the page, and until the replacement arrives nothing paints the
 * ground: the browser's white canvas shows. Every reader who had ever
 * pressed the light/dark control got that flash on every page, in dark mode.
 *
 * And nothing painted `html` at all, so any moment without the theme's
 * stylesheet — a swap, a slow CDN — was white by default.
 *
 * ## What this holds
 *
 * - the scheme is decided by an inline snippet in `<head>` BEFORE the bundle
 *   runs — stored choice, else the OS, else LIGHT (owner, 2026-10-15:
 *   *"follow os else light"*) — and `html` is painted in that scheme by the
 *   very first CSS;
 * - a stored choice that the loaded stylesheet already shows is never swapped;
 * - a light reader still ends up light.
 *
 * The snippet is READ from `_includes/head_custom.html` between its markers
 * rather than retyped, so this spec tests the bytes the site ships — and the
 * generated shells that emit their own `<head>` are checked to carry the same
 * bytes.
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const HEAD_CUSTOM = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "_includes/head_custom.html"))), "utf8");

const BEGIN = "<!-- fa-first-paint:begin -->";
const END = "<!-- fa-first-paint:end -->";
/** The shipped snippet, or "" when the include carries none. */
const SNIPPET = (() => {
  const a = HEAD_CUSTOM.indexOf(BEGIN);
  const b = HEAD_CUSTOM.indexOf(END);
  return a >= 0 && b > a ? HEAD_CUSTOM.slice(a, b + END.length) : "";
})();

/**
 * just-the-docs' theme switch, READ from this site's copy of the theme's
 * `just-the-docs.js` between its `fa-theme-switch` markers (cat-harness#820),
 * so this spec runs the functions the site ships. The gem's own version
 * rewrote the first stylesheet's href, which left the page unstyled while the
 * new file loaded; the shipped one loads it beside the old.
 */
const JTD_SRC = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/just-the-docs.js"))), "utf8");
const THEME_SWITCH = (() => {
  const a = JTD_SRC.indexOf("// fa-theme-switch:begin");
  const b = JTD_SRC.indexOf("// fa-theme-switch:end");
  if (a < 0 || b < a) throw new Error("just-the-docs.js has no fa-theme-switch block");
  return JTD_SRC.slice(a, b).replace(/\{\{\s*"assets\/css\/just-the-docs-"\s*\|\s*relative_url\s*\}\}/g, "/assets/css/just-the-docs-");
})();
const JTD = `window.jtd = window.jtd || {};\n${THEME_SWITCH}`;

/** The theme's head, in the theme's order: its stylesheet, its script, then head_custom. */
const PAGE = `<!doctype html><html lang="en-US"><head><meta charset="UTF-8">
<link rel="stylesheet" href="/assets/css/just-the-docs-default.css">
<script src="/assets/js/just-the-docs.js"></script>
<script type="application/json" id="fa-site-scheme">{"scheme": "dark"}</script>
${SNIPPET}
<style>${CSS}</style>
<script src="/assets/js/docs-ui.js" defer></script>
</head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">folio-assistant</a></div><nav class="site-nav"></nav></div>
<div class="main"><div class="main-content-wrap"><div class="main-content"><h1 id="t">A page</h1></div></div></div>
</body></html>`;

// The configured scheme's compiled sheet, and the two the switch can name.
const DARK_CSS = "body { background-color: #27262b; color: #e6e1e8; }";
const LIGHT_CSS = "body { background-color: #ffffff; color: #5c5962; }";

type Hold = { release: () => void };

async function serve(page: Page, opts: { holdBundle?: boolean; holdDarkSheet?: boolean; holdLightSheet?: boolean } = {}): Promise<Hold> {
  let release!: () => void;
  const released = new Promise<void>((r) => { release = r; });
  await page.route("http://replica.test/**", async (route: Route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/page.html") return route.fulfill({ contentType: "text/html", body: PAGE });
    if (p === "/assets/js/just-the-docs.js") return route.fulfill({ contentType: "text/javascript", body: JTD });
    if (p === "/assets/js/docs-ui.js") {
      if (opts.holdBundle) await released;
      return route.fulfill({ contentType: "text/javascript", body: JS });
    }
    if (p === "/assets/css/just-the-docs-default.css") return route.fulfill({ contentType: "text/css", body: DARK_CSS });
    if (p === "/assets/css/just-the-docs-dark.css") {
      // A slow network, made indefinite: whatever paints while this is in
      // flight is what a reader sees during a swap.
      if (opts.holdDarkSheet) await new Promise(() => {});
      return route.fulfill({ contentType: "text/css", body: DARK_CSS });
    }
    if (p === "/assets/css/just-the-docs-light.css") {
      if (opts.holdLightSheet) await released;
      return route.fulfill({ contentType: "text/css", body: LIGHT_CSS });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  return { release };
}

/** The ground the reader actually sees: body's paint, else html's, else the white canvas. */
const ground = (page: Page) =>
  page.evaluate(() => {
    const opaque = (c: string) => c !== "rgba(0, 0, 0, 0)" && c !== "transparent";
    const b = getComputedStyle(document.body).backgroundColor;
    const h = getComputedStyle(document.documentElement).backgroundColor;
    return opaque(b) ? b : opaque(h) ? h : "rgb(255, 255, 255)";
  });
const htmlBg = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
const luminance = (c: string) => {
  const v = c.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((x) => x / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const isDark = (c: string) => luminance(c) < 0.1;
const isLight = (c: string) => luminance(c) > 0.6;
const bundleRan = (page: Page) => page.evaluate(() => !!document.querySelector(".fa-glass-handle"));

test.describe("the first paint follows the reader, else the OS, else light — no flash either way", () => {
  test("head_custom carries the snippet FIRST — before every stylesheet it emits — and it is plain HTML", () => {
    expect(SNIPPET, "head_custom.html has the fa-first-paint block").not.toBe("");
    expect(SNIPPET).not.toMatch(/\{\{|\{%/);
    const at = HEAD_CUSTOM.indexOf(BEGIN);
    const firstSheet = Math.min(
      ...[/<link rel="stylesheet"/g, /<style[\s>]/g].map((re) => {
        const m = re.exec(HEAD_CUSTOM);
        return m ? m.index : Infinity;
      }),
    );
    expect(at).toBeLessThan(firstSheet);
    // The configured scheme it reads is published above it.
    expect(HEAD_CUSTOM.indexOf('id="fa-site-scheme"')).toBeLessThan(at);
  });

  // Only "dark": Chromium answers `(prefers-color-scheme: light)` TRUE under
  // Playwright's "no-preference" emulation, so that case cannot be told from
  // an OS that asked for light, and a test of it would test the emulator.
  for (const colorScheme of ["dark"] as const) {
    test(`nothing stored, OS ${colorScheme}: html is DARK at first paint, before the bundle runs`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme });
      const page = await ctx.newPage();
      const hold = await serve(page, { holdBundle: true });
      await page.goto("http://replica.test/page.html", { waitUntil: "commit" });
      await page.waitForSelector("#t", { state: "attached" });
      expect(await bundleRan(page)).toBe(false);
      expect(await page.evaluate(() => document.documentElement.getAttribute("data-fa-scheme"))).toBe("dark");
      const bg = await htmlBg(page);
      expect(isDark(bg), `html background at first paint was ${bg}`).toBe(true);
      hold.release();
      await page.waitForSelector(".fa-glass-handle", { state: "attached" });
      expect(isDark(await ground(page))).toBe(true);
      await ctx.close();
    });
  }

  test("a STORED dark choice never unloads the dark sheet — no white while a swap loads", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    await ctx.addInitScript(() => { try { localStorage.setItem("fa-color-scheme", "dark"); } catch { /* */ } });
    const page = await ctx.newPage();
    await serve(page, { holdDarkSheet: true });
    // "commit", not "load": a sheet in flight holds the load event, and a
    // sheet in flight is the state being measured.
    await page.goto("http://replica.test/page.html", { waitUntil: "commit" });
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    const g = await ground(page);
    expect(isDark(g), `the page ground after the bundle ran was ${g}`).toBe(true);
    // And the reason: the sheet already painting dark was left alone.
    expect(await page.evaluate(() => document.querySelector('[rel="stylesheet"]')!.getAttribute("href")))
      .toBe("/assets/css/just-the-docs-default.css");
    await ctx.close();
  });

  test("a STORED light choice ends up light — and is light before the bundle runs", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    await ctx.addInitScript(() => { try { localStorage.setItem("fa-color-scheme", "light"); } catch { /* */ } });
    const page = await ctx.newPage();
    const hold = await serve(page, { holdBundle: true });
    await page.goto("http://replica.test/page.html", { waitUntil: "commit" });
    await page.waitForSelector("#t", { state: "attached" });
    expect(await bundleRan(page)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-fa-scheme"))).toBe("light");
    hold.release();
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    await expect.poll(async () => isLight(await ground(page))).toBe(true);
    expect(isLight(await htmlBg(page))).toBe(true);
    await expect(page.locator(".fa-scheme-mini")).toHaveAttribute("aria-pressed", "false");
    await ctx.close();
  });

  test("a light reader is never UNSTYLED while the light sheet loads (cat-harness#820)", async ({ browser }) => {
    // Owner, 2026-10-31: "whenever a page loads fresh a giant blue letter
    // flashes". The swap left no theme sheet until the light file arrived, so
    // the page painted with browser defaults. Held in flight here: the dark
    // sheet must still be painting, and only one sheet may remain after.
    const ctx = await browser.newContext({ colorScheme: "dark" });
    await ctx.addInitScript(() => { try { localStorage.setItem("fa-color-scheme", "light"); } catch { /* */ } });
    const page = await ctx.newPage();
    const hold = await serve(page, { holdLightSheet: true });
    await page.goto("http://replica.test/page.html", { waitUntil: "commit" });
    await page.waitForSelector("#t", { state: "attached" });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Opaque AND dark: with no theme sheet, body's background is transparent.
    expect(bg !== "rgba(0, 0, 0, 0)" && isDark(bg), `body background while the light sheet loads was ${bg}`).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { jtd: { getTheme(): string } }).jtd.getTheme())).toBe("light");
    hold.release();
    await expect.poll(async () => isLight(await ground(page))).toBe(true);
    const sheets = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href")).filter((h) => /just-the-docs-/.test(h || "")));
    expect(sheets).toEqual(["/assets/css/just-the-docs-light.css"]);
    await ctx.close();
  });

  test("nothing stored, the OS says nothing: LIGHT before the bundle runs, and after", async ({ browser }) => {
    // Chromium cannot emulate "no preference" (see above), so the OS is made
    // silent the way an old or locked-down browser is: no matchMedia at all.
    const ctx = await browser.newContext({ colorScheme: "dark" });
    await ctx.addInitScript(() => { try { delete (window as { matchMedia?: unknown }).matchMedia; (window as { matchMedia?: unknown }).matchMedia = undefined; } catch { /* */ } });
    const page = await ctx.newPage();
    const hold = await serve(page, { holdBundle: true });
    await page.goto("http://replica.test/page.html", { waitUntil: "commit" });
    await page.waitForSelector("#t", { state: "attached" });
    expect(await bundleRan(page)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-fa-scheme"))).toBe("light");
    hold.release();
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    await expect.poll(async () => isLight(await ground(page))).toBe(true);
    await ctx.close();
  });

  test("nothing stored, OS light: ends up light", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "light" });
    const page = await ctx.newPage();
    await serve(page);
    await page.goto("http://replica.test/page.html");
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    await expect.poll(async () => isLight(await ground(page))).toBe(true);
    await ctx.close();
  });

  test("the toggle still works both ways after the snippet decided", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    const page = await ctx.newPage();
    await serve(page);
    await page.goto("http://replica.test/page.html");
    const mini = page.locator(".fa-scheme-mini");
    await expect(mini).toHaveAttribute("aria-pressed", "true");
    await mini.focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => isLight(await ground(page))).toBe(true);
    await page.keyboard.press("Enter");
    await expect.poll(async () => isDark(await ground(page))).toBe(true);
    await ctx.close();
  });
});

/* THE GENERATED DASHBOARDS that wrote their OWN <head> were measured here,
 * with JavaScript OFF in a light-preferring browser. Since #2418 none is left:
 * `todos/` (#1906), `beans/` and every other state dashboard, and then
 * translation-status, auto-docs, library, schemas, voices, uploads and
 * document-kinds, are themed pages that paint through the theme and
 * `head_custom.html` like every other site page — the cases above. A loop
 * over an empty list would pass while measuring nothing, so it is gone
 * rather than kept vacuous. */
