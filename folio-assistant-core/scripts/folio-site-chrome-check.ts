#!/usr/bin/env bun
/**
 * folio-site-chrome-check — does a staged folio page actually carry the
 * harness chrome, measured in a browser rather than read from the markup?
 *
 * Owner, 2026-10-05, after reviewing a staging build: *"staging is missing
 * staging banner"*, *"light mode did not change light mode"*, *"math and
 * narrative fonts not same height"*, *"missing the harness chrome"*. Each of
 * those passed every source-level check, and each is a fact about the page in
 * a browser. This is the `rendered-verification` skill's method made into a
 * gate: computed styles, a real click on the scheme toggle, and assertions
 * that fail loudly.
 *
 *   bun run folio-assistant-core/scripts/folio-site-chrome-check.ts --url <page> [--assets <dir>] [--katex <dir>] [--shot out.png]
 *
 * `--assets` serves the platform's published assets (`https://…/folio-assistant/…`)
 * from a local copy, and `--katex` the KaTeX CDN from `node_modules/katex/dist`,
 * for a sandbox that cannot reach either; `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
 * names a preinstalled browser when Playwright's pinned build is absent,
 * as such a sandbox may need. Exit 0 every check passed, 1 a check
 * failed, 2 the browser could not run (never a pass).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ChromeCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export async function checkChrome(opts: { url: string; assets?: string; katex?: string; shot?: string }): Promise<ChromeCheck[]> {
  const { chromium } = await import("playwright");
  // A sandbox's preinstalled Chromium may not be the build this Playwright pins;
  // PLAYWRIGHT_CHROMIUM_EXECUTABLE names it instead of downloading one.
  const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (opts.katex) {
      await page.route("https://cdn.jsdelivr.net/npm/katex@*/dist/**", (r) => {
        const f = r.request().url().split("/dist/")[1] ?? "";
        try {
          void r.fulfill({ body: readFileSync(join(opts.katex!, f)) });
        } catch {
          void r.abort();
        }
      });
    }
    if (opts.assets) {
      await page.route("https://litlfred.github.io/folio-assistant/**", (r) => {
        const f = join(opts.assets!, new URL(r.request().url()).pathname.replace(/^\/folio-assistant\//, ""));
        try {
          void r.fulfill({ body: readFileSync(f), contentType: f.endsWith(".css") ? "text/css" : "application/javascript" });
        } catch {
          void r.fulfill({ status: 404, body: "" });
        }
      });
    }
    await page.goto(opts.url, { waitUntil: "load" });
    await page.mouse.move(900, 600); // off the rail, which widens on hover
    await page.waitForTimeout(3000);
    const read = () =>
      page.evaluate(() => {
        const k = document.querySelector("main .katex");
        const para = k?.closest("p, li, td");
        const px = (e: Element | null | undefined) => (e ? parseFloat(getComputedStyle(e).fontSize) : NaN);
        // What a reader sees: KaTeX keeps the TeX source in hidden MathML (<annotation>) for
        // screen readers, and a source disclosure shows TeX on purpose, so neither counts.
        const main = document.querySelector("main")?.cloneNode(true) as HTMLElement | undefined;
        main?.querySelectorAll(".katex-mathml, annotation, details, pre, code").forEach((n) => n.remove());
        const visible = (main?.textContent ?? "").replace(/\s+/g, " ");
        return {
          banner: !!document.querySelector("[data-fa-staging-banner]"),
          nav: !!document.querySelector("nav.fa-nav"),
          contents: !!document.querySelector("nav.fa-nav .folio-contents"),
          scheme: document.documentElement.getAttribute("data-fa-scheme"),
          bg: getComputedStyle(document.body).backgroundColor,
          katexPx: px(k),
          textPx: px(para),
          rawTex: /\\(begin|end)\{|:(def|ref)term\[/.test(visible),
          blocks: document.querySelectorAll(".block").length,
        };
      });
    const a = await read();
    const toggle = await page.$("nav.fa-nav .fa-nav-scheme");
    if (toggle) {
      await toggle.click();
      await page.waitForTimeout(400);
    }
    const b = await read();
    if (opts.shot) await page.screenshot({ path: opts.shot });
    return [
      { name: "content loaded", ok: a.blocks > 0, detail: `${a.blocks} block(s)` },
      { name: "staging banner", ok: a.banner, detail: a.banner ? "present" : "no [data-fa-staging-banner]" },
      { name: "harness navbar", ok: a.nav, detail: a.nav ? "present" : "no nav.fa-nav — the rail was not injected" },
      { name: "contents in the navbar", ok: !a.nav || a.contents, detail: a.contents ? "adopted" : "not adopted into the navbar" },
      {
        name: "scheme toggle changes the page",
        ok: !!toggle && a.scheme !== b.scheme && a.bg !== b.bg,
        detail: toggle ? `${a.scheme} ${a.bg} → ${b.scheme} ${b.bg}` : "no scheme toggle in the navbar",
      },
      {
        name: "math is the height of the text",
        ok: Number.isNaN(a.katexPx) || Math.abs(a.katexPx - a.textPx) < 0.5,
        detail: Number.isNaN(a.katexPx) ? "no math on the page" : `math ${a.katexPx}px, text ${a.textPx}px`,
      },
      { name: "no raw TeX in the text", ok: !a.rawTex, detail: a.rawTex ? "\\begin / :defterm text visible" : "none" },
      { name: "no script errors", ok: errors.length === 0, detail: errors.slice(0, 3).join(" | ") || "none" },
    ];
  } finally {
    await browser.close();
  }
}

if (import.meta.main) {
  const arg = (n: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const url = arg("url");
  if (!url) {
    console.error("usage: folio-site-chrome-check.ts --url <page> [--assets <dir>] [--katex <dir>] [--shot out.png]");
    process.exit(2);
  }
  let checks: ChromeCheck[];
  try {
    checks = await checkChrome({ url, assets: arg("assets"), katex: arg("katex"), shot: arg("shot") });
  } catch (e) {
    console.error(`? the browser check could not run: ${(e as Error).message}`);
    process.exit(2);
  }
  for (const c of checks) console.log(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  process.exit(checks.every((c) => c.ok) ? 0 : 1);
}
