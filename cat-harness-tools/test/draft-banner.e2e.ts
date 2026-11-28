import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The DRAFT banner (owner, 2026-11-17): every page served anywhere but
 * smart.who.int shows a clear DRAFT banner at the top; smart.who.int does
 * not. Decided from `location.hostname` at load, so ONE page is served here
 * from several hosts, intercepted, and judged on each.
 *
 * WHAT IS SERVED: this layer's `draft-banner.js`, `page-layout.css` and
 * `draft-banner-noscript.css`, and the `<noscript>` fallback `pageLayoutTags`
 * emits, read from `page-layout.ts` (which names its files through bun's
 * `import.meta.dir`, so Playwright, under node, reads them by path instead). The rail and page bar
 * are hand-built with their real classes.
 *
 * NO BACKTICKS INSIDE THE PAGE TEMPLATE LITERAL (`bmr0`).
 */
const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "../scripts");
const BANNER_JS = readFileSync(join(SCRIPTS, "templates/draft-banner.js"), "utf8");
const LAYOUT_CSS = readFileSync(join(SCRIPTS, "templates/page-layout.css"), "utf8");
const NOSCRIPT_CSS = readFileSync(join(SCRIPTS, "templates/draft-banner-noscript.css"), "utf8");
const NOSCRIPT = (() => {
  const src = readFileSync(join(SCRIPTS, "page-layout.ts"), "utf8");
  const file = /export const DRAFT_BANNER_NOSCRIPT_CSS_FILE = "([^"]+)";/.exec(src);
  const tag = /export function draftBannerNoscript\(up: string\): string \{\s*return `([^`]*)`;/.exec(src);
  if (!file || !tag) throw new Error("page-layout.ts: draftBannerNoscript not found in the expected shape");
  return tag[1]!.replace("${up}", "/").replace("${DRAFT_BANNER_NOSCRIPT_CSS_FILE}", file[1]!);
})();
/** Paths the page fetched, so a test can say what a scripted page did NOT load. */
let fetched: string[] = [];

function html(staging: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>body{padding-inline-start:56px}.fa-nav{position:fixed;top:0;left:0;bottom:0;width:56px;background:#1f2328}</style>
<style>${LAYOUT_CSS}</style>
<script src="/assets/draft-banner.js" defer data-fa-page-layout></script>${NOSCRIPT}</head><body>
${staging ? '<div data-fa-staging-banner style="position:fixed;top:0;left:0;right:0;background:#4F6F52;color:#fff"><b>FEATURE BRANCH</b> <span data-fa-staging-detail></span></div>' : ""}
<nav class="fa-nav"></nav><div class="fa-page-bar">Site</div><main class="fa-page-main"><h1>Page</h1></main></body></html>`;
}

async function open(p: Page, url: string, staging = false): Promise<void> {
  fetched = [];
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url());
    fetched.push(u.pathname);
    if (u.pathname.endsWith("/draft-banner.js")) return r.fulfill({ contentType: "text/javascript", body: BANNER_JS });
    if (u.pathname.endsWith("/draft-banner-noscript.css")) return r.fulfill({ contentType: "text/css", body: NOSCRIPT_CSS });
    return r.fulfill({ contentType: "text/html", body: html(staging) });
  });
  await p.goto(url);
}

const DRAFT_HOSTS = [
  "https://worldhealthorganization.github.io/dth-hrh/en/dth-hrh/index.html",
  "https://litlfred.github.io/folio-assistant/index.html",
  "http://localhost:4000/index.html",
];

test.describe("the DRAFT banner", () => {
  test.use({ viewport: { width: 1280, height: 700 } });

  for (const url of DRAFT_HOSTS) {
    test(`shows at the top on ${new URL(url).hostname}, above the rail, which it pushes down`, async ({ page: p }) => {
      await open(p, url);
      const banner = p.locator("[data-fa-draft-banner]");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("DRAFT");
      const box = (await banner.boundingBox())!;
      expect(box.y).toBe(0);
      expect(box.x).toBe(0);
      expect(box.width).toBe(1280);
      // The rail starts below the banner, not under it.
      const rail = (await p.locator("nav.fa-nav").boundingBox())!;
      expect(Math.abs(rail.y - box.height)).toBeLessThanOrEqual(1);
      // And the page's content starts below it: nothing it covers.
      const h1 = (await p.locator("h1").boundingBox())!;
      expect(h1.y).toBeGreaterThanOrEqual(box.height);
      // The no-script stylesheet is for pages that run no script; this one did.
      expect(fetched.filter((f) => f.endsWith("/draft-banner-noscript.css"))).toEqual([]);
    });
  }

  test("is absent on smart.who.int, the official host", async ({ page: p }) => {
    await open(p, "https://smart.who.int/trust/index.html");
    await expect(p.locator("html")).toHaveAttribute("data-fa-official", "");
    await expect(p.locator("[data-fa-draft-banner]")).toHaveCount(0);
    expect(await p.evaluate(() => document.documentElement.style.getPropertyValue("--fa-staging-offset"))).toBe("");
  });

  test("is not a subdomain or look-alike match: smart.who.int.example.org is a draft", async ({ page: p }) => {
    await open(p, "https://smart.who.int.example.org/index.html");
    await expect(p.locator("[data-fa-draft-banner]")).toBeVisible();
  });

  test("on a branch preview, says DRAFT inside the staging banner rather than drawing a second strip", async ({ page: p }) => {
    await open(p, "https://litlfred.github.io/dth-hrh/branches/x/index.html", true);
    await expect(p.locator("[data-fa-draft-banner]")).toHaveCount(0);
    const chip = p.locator("[data-fa-staging-banner] [data-fa-draft-chip]");
    await expect(chip).toHaveText("DRAFT");
    await expect(chip).toBeVisible();
  });
});

test.describe("the DRAFT banner with no script", () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1280, height: 700 } });

  test("still says DRAFT, since the page cannot tell where it is served", async ({ page: p }) => {
    await open(p, "https://worldhealthorganization.github.io/dth-hrh/index.html");
    const before = await p.evaluate(() => getComputedStyle(document.body, "::before").content);
    expect(before).toContain("DRAFT");
    expect(fetched).toContain("/assets/draft-banner-noscript.css");
  });
});
