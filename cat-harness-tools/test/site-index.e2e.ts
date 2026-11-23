/**
 * The site index is FETCHED, and the page says whether it finished rendering.
 *
 * ## What changed, and what it bought
 *
 * `#fa-translation-index` was a `<script type="application/json">` island in
 * the `<head>` of every page. Measured 2026-10-02 on a local build of this
 * repository's docs site: **2356 pages carried it, 9482 B each, 22.34 MB in
 * total, and ONE distinct payload** (sha1 over the payloads). It is now
 * published once at `assets/harness/site.json` and fetched by `docs-ui.js`.
 *
 * `docs/concepts/architecture/folio-board-requirements.md` §R4 forbade that while it
 * required a rendering be "reachable without JavaScript"; the owner relaxed
 * that to "reachable without XSS" on 2026-10-02. The obligations the
 * relaxation came with are in
 * `skills/ui/ui-core/ui-accessibility.md` §"A rendering built client-side owes
 * two things the static one gave for free", and they are what most of this
 * file asserts.
 *
 * ## Why these tests and not a snapshot of the navbar
 *
 * `nav-locale.e2e.ts` already covers what the translation index DOES — which
 * nav items are swapped, in which locale, in both directions. It feeds the
 * ISLAND, and it still passes unchanged, which is itself one of the facts here
 * (the island wins where there is one, so nothing that carries one changed
 * behaviour). What is new and therefore untested is the TRANSPORT and the four
 * states it introduces, so that is what these assert:
 *
 *   - the fetch path produces the same result the island did;
 *   - the island still wins, so a fixture and a non-Jekyll page keep working;
 *   - a `translations: null` document is READ — a determined "no translation
 *     data", which must not look like a failure;
 *   - a fetch that FAILS says so, rather than rendering as "no translations";
 *   - a region that never registers is `failed`, not `ready` — the `dh4f`
 *     guard, falsified in the direction that matters;
 *   - a page that declares no region carries NO attribute, because "never
 *     asked" is a third state and not a value of the other two.
 *
 * ## `data-fa-render` is asserted on `<html>`, never inferred from a timing
 *
 * Every wait below is on the attribute. A test that waited a fixed number of
 * milliseconds would pass on a machine that was fast enough and would be
 * asserting the machine.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const KG = readFileSync(overlayPath(join(ROOT, SITE, "assets/js/kg-render.js")), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

/**
 * The real index, read from the corpus rather than pinned here.
 *
 * Same rule `nav-locale.e2e.ts` states for its own fixture: pinning today's
 * contents would make this a test of what the corpus said on the day it was
 * written. The assertions below name no page and no locale, so they need only
 * a well-formed index — but they need a REAL one, because the shape is the
 * thing `getTranslationIndex` validates.
 */
const INDEX = JSON.parse(
  readFileSync(overlayPath(join(ROOT, SITE, "_data/translations.json")), "utf8"),
) as { sourceLocale: string; locales: string[]; pages: Record<string, unknown> };

const SITE_INDEX_URL = "/assets/harness/site.json";

interface Fixture {
  /** The `fa-translation-index` island, or `undefined` for a page without one. */
  island?: string;
  /** Emit `<meta name="fa-site-index-src">`. Default true. */
  meta?: boolean;
  /** The declared MINIMUM number of regions. Default 1. `null` emits no meta. */
  regions?: number | null;
}

/**
 * just-the-docs' nav markup reduced to what `mountNavLocale` touches, plus the
 * two `<head>` declarations this change adds.
 *
 * The first-paint `pending` is written by a script in `<head>`, exactly as
 * `head_custom.html` writes it — not as an attribute on `<html>`, because
 * `scripts/set-html-lang.ts` rewrites that tag in the built tree and this
 * fixture must exercise the mechanism the site actually ships.
 */
function harness(fx: Fixture): string {
  const regions = fx.regions === undefined ? 1 : fx.regions;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
${regions === null ? "" : `<meta name="fa-render-regions" content="${regions}">`}
<script>document.documentElement.setAttribute("data-fa-render","pending");</script>
<script type="application/json" id="fa-translation-meta">{"lang":"en","supportedLocales":["en","fr"],"availableLocales":[]}</script>
${fx.meta === false ? "" : `<meta name="fa-site-index-src" content="${SITE_INDEX_URL}">`}
${fx.island ?? ""}
<style>body{margin:0}.side-bar{width:16rem}.site-nav{width:100%}
.nav-list{list-style:none;margin:0;padding:0}
${CSS}</style></head><body>
  <div class="side-bar">
    <div class="site-header"><a class="site-title">folio-assistant</a></div>
    <nav class="site-nav" aria-label="Main">
      <ul class="nav-list"><li class="nav-list-item"><a href="/" class="nav-list-link">Home</a></li></ul>
    </nav>
  </div>
  <div class="main"><div class="main-content"><h1>x</h1></div></div>
  <script>${KG}<\/script>
  <script>${JS}<\/script>
</body></html>`;
}

/** What the server answers for `assets/harness/site.json` on this run. */
type Served = { status: number; body?: string };

async function open(page: Page, fx: Fixture, served: Served): Promise<void> {
  await page.route("**" + SITE_INDEX_URL, (route) =>
    served.status === 200
      ? route.fulfill({ status: 200, contentType: "application/json", body: served.body ?? "{}" })
      : route.fulfill({ status: served.status, contentType: "text/plain", body: "not found" }),
  );
  // A REAL origin first, then the markup into it. `setContent` alone leaves
  // the page at `about:blank`, where a relative `fetch` has no base to resolve
  // against and `localStorage` throws — so these tests would pass by doing
  // nothing at all. `test-server.mjs` (playwright.config.ts) serves the root.
  await page.goto("/");
  await page.setContent(harness(fx));
}

const ok = JSON.stringify({
  $schema: "folio-site-index/v1",
  baseurl: "",
  translations: INDEX,
});

const html = (page: Page) => page.locator("html");
const nav = (page: Page) => page.locator(".site-nav");

test.describe("the site index is fetched", () => {
  test("a page with no island reads the fetched document, and the page goes ready", async ({ page }) => {
    await open(page, {}, { status: 200, body: ok });
    await expect(html(page)).toHaveAttribute("data-fa-render", "ready");
    // `ok`, not `empty` and not `unknown`: the index was read AND it has
    // pages. Three values, and this asserts the one that means "read".
    await expect(nav(page)).toHaveAttribute("data-fa-nav-index", "ok");
    await expect(nav(page)).toHaveAttribute("data-fa-nav-locale", INDEX.sourceLocale);
  });

  test("the island still wins, so a fixture and a non-Jekyll page keep working", async ({ page }) => {
    // The served document is DELIBERATELY the failure case while the island is
    // good. If the fetch were preferred this would read `unknown`, so the test
    // is falsified in the direction that matters rather than merely passing.
    await open(
      page,
      {
        island: `<script type="application/json" id="fa-translation-index">${JSON.stringify({
          baseurl: "",
          index: INDEX,
        })}</script>`,
      },
      { status: 404 },
    );
    await expect(nav(page)).toHaveAttribute("data-fa-nav-index", "ok");
  });

  test("no `<meta>` at all is NOT a failure — the page never asked", async ({ page }) => {
    // A who-iris replica page: no Jekyll wrote it, so it carries neither the
    // island nor the meta. The navbar degrades loudly (`unknown`) because
    // there is no index, and the PAGE is ready because nothing was pending.
    await open(page, { meta: false }, { status: 404 });
    await expect(html(page)).toHaveAttribute("data-fa-render", "ready");
    await expect(nav(page)).toHaveAttribute("data-fa-nav-index", "unknown");
  });
});

test.describe("a load that FAILS says so", () => {
  // `ui-accessibility`: *"a `console.warn` is not saying so: it reaches a
  // developer with the console open and no reader ever."* The reader-visible
  // half of that, for this region, is the attribute — which `docs-ui.css`
  // turns into a sentence on the paper and `render-wait.ts` turns into a refusal.
  test("a 404 is `failed`, and the navbar is left exactly as built", async ({ page }) => {
    await open(page, {}, { status: 404 });
    await expect(html(page)).toHaveAttribute("data-fa-render", "failed");
    await expect(nav(page)).toHaveAttribute("data-fa-nav-index", "unknown");
    // LEFT AS BUILT, asserted rather than assumed: the one nav item still
    // points where the server sent it.
    await expect(page.locator(".nav-list-link")).toHaveAttribute("href", "/");
  });

  test("a body that is not JSON is `failed`, not silently empty", async ({ page }) => {
    await open(page, {}, { status: 200, body: "{ this is not json" });
    await expect(html(page)).toHaveAttribute("data-fa-render", "failed");
  });

  test("`fa:render-failed` fires once, with the region that failed", async ({ page }) => {
    await page.route("**" + SITE_INDEX_URL, (route) => route.fulfill({ status: 500, body: "x" }));
    await page.goto("/");
    await page.setContent(harness({}));
    const seen = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const got: string[] = [];
          document.addEventListener("fa:render-failed", (e) => {
            got.push((e as CustomEvent).detail.region);
          });
          // The event may already have fired before this listener attached,
          // which is itself the correct behaviour — so the ATTRIBUTE is the
          // authority and the event is checked for not firing twice.
          setTimeout(() => resolve(got), 400);
        }),
    );
    expect(seen.length).toBeLessThanOrEqual(1);
    await expect(html(page)).toHaveAttribute("data-fa-render", "failed");
  });
});

test.describe("a determined empty is not a failure", () => {
  test("`translations: null` is READ — the build says there is no translation data", async ({ page }) => {
    // The THIRD STATE that already existed and must survive the transport.
    // `jsonify` emits `null` for an absent `_data/translations.json`, and
    // `head_custom.html` has always said a build that could not determine the
    // translation set must never render as a folio that has no translations.
    // So: the navbar is `unknown`, and the PAGE is `ready` — the document was
    // read, there is simply nothing in it to read.
    await open(page, {}, {
      status: 200,
      body: JSON.stringify({ $schema: "folio-site-index/v1", baseurl: "", translations: null }),
    });
    await expect(html(page)).toHaveAttribute("data-fa-render", "ready");
    await expect(nav(page)).toHaveAttribute("data-fa-nav-index", "unknown");
  });

  test("an index with no pages is `empty`, which is a different word from `unknown`", async ({ page }) => {
    await open(page, {}, {
      status: 200,
      body: JSON.stringify({
        baseurl: "",
        translations: { sourceLocale: "en", locales: [], pages: {} },
      }),
    });
    await expect(html(page)).toHaveAttribute("data-fa-render", "ready");
    await expect(nav(page)).toHaveAttribute("data-fa-nav-index", "empty");
  });
});

test.describe("the declared minimum cross-checks the registrations", () => {
  test("a page that declares no region carries NO attribute", async ({ page }) => {
    // "Never asked" is a third state and not a value of the other two. A
    // generated dashboard that writes its own `<head>` is exactly this case,
    // and `render-wait.ts` reads the absence as "nothing to wait for".
    await page.goto("/");
    await page.setContent(
      harness({ regions: null, meta: false }).replace(
        '<script>document.documentElement.setAttribute("data-fa-render","pending");</script>',
        "",
      ),
    );
    await expect(html(page)).not.toHaveAttribute("data-fa-render", /.*/);
  });

  test("fewer registrations than declared is `failed`, never `ready`", async ({ page }) => {
    // THE `dh4f` GUARD. Two regions declared, one registers (the site index),
    // so the page did not render what it said it would. A renderer that simply
    // counted what registered would call this `ready` — which is the one
    // answer nothing downstream can recover from, because a PDF of it is not
    // re-checkable after the fact.
    await open(page, { regions: 2 }, { status: 200, body: ok });
    await expect(html(page)).toHaveAttribute("data-fa-render", "failed");
  });

  test("the declared minimum is readable, so a generator and the renderer can be compared", async ({ page }) => {
    await open(page, { regions: 3 }, { status: 200, body: ok });
    // Cast rather than a global augmentation, the shape this repository's
    // other specs already use for a client-side global (`graph-tiles.e2e.ts`
    // does the same for `__faTodoBoard`).
    const declared = await page.evaluate(() =>
      (window as never as { faRender: { expectedRegions(): number | null } })
        .faRender.expectedRegions(),
    );
    expect(declared).toBe(3);
  });
});
