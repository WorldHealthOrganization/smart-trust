import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { TRANSLATION_META_ID, translationMetaBlock, withTranslationMeta } from "../scripts/lib/translation-meta.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * A MOUNTED page wears the docs pages' locale globe — issue #2219.
 *
 * Owner, 2026-10-05: *"Why no translations on /who-iris/?"*, then *"declared
 * languages should still be there, just greyed out if not declared. USE THE
 * SAME CHROME AS FOLIO-ASSISTANT."*
 *
 * The page is the one `gen-iris-pages.ts` wrote, so this exercises the real
 * emitter and the real `docs-ui.js`, not a fixture's idea of either. The
 * control is the same page WITHOUT the block, which must keep its layout:
 * `folio-mount.e2e.ts` holds the replica's fidelity on that.
 *
 * ## Two blocks, two cases (bean `lffo`, #2229)
 *
 * Since #2229 the generator writes the replica in all six UN languages and
 * puts its OWN block on every page, with every locale available, and
 * `withTranslationMeta` keeps a page's own block rather than overwriting it.
 * So the generated page now shows the TRANSLATED case: every declared locale
 * live. The case #2219 was about, a mounted page with no per-locale build,
 * still exists for any layer that has not translated, and the owner's
 * ruling, *"declared languages should still be there, just greyed out"*,
 * still governs it. That case and the no-block control are built from the
 * generated page with its own block REMOVED. Both are fixtures derived in
 * this file rather than real pages picked for being untranslated, so
 * translating a real page cannot turn them red. That is the shape
 * `nav-locale.e2e.ts` paid for three times.
 */

const ROOT = join(HARNESS_ROOT);
const REPO = repoRootFor(ROOT);

const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const PAGE_FILE = join(REPO, "who-iris", "site", "index.html");
const PAGE = existsSync(overlayPath(PAGE_FILE)) ? readFileSync(overlayPath(PAGE_FILE), "utf8") : "";

/** The generated page with its own `fa-translation-meta` block taken out. */
function withoutTranslationMeta(html: string): string {
  const open = `<script type="application/json" id="${TRANSLATION_META_ID}">`;
  const i = html.indexOf(open);
  if (i < 0) return html;
  const j = html.indexOf("</script>", i) + "</script>".length;
  return html.slice(0, i) + html.slice(j);
}

/** The replica as an UNTRANSLATED layer's page: no block of its own. */
const UNTRANSLATED = withoutTranslationMeta(PAGE);
/** ...and that page as `mount-instance-docs.ts` publishes it: the mount-time block, no per-locale build. */
const MOUNTED_UNTRANSLATED = withTranslationMeta(UNTRANSLATED, translationMetaBlock(join(REPO, "who-iris")));

async function serve(page: import("@playwright/test").Page, body: string): Promise<void> {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("assets/css/docs-ui.css")) {
      return route.fulfill({ status: 200, contentType: "text/css", body: CSS });
    }
    if (url.pathname.endsWith("assets/js/docs-ui.js")) {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: JS });
    }
    if (url.pathname !== "/who-iris/") return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "text/html", body });
  });
  await page.goto("http://127.0.0.1:8080/who-iris/");
  await page.waitForLoadState("networkidle");
}

test("the fixtures are what they claim: the generated page has a block, the derived ones do not", () => {
  // Every case below is vacuous if the strip did nothing: the mount-time
  // block would then be ignored in favour of the page's own. So the premise
  // is asserted rather than assumed.
  expect(PAGE, `${PAGE_FILE} is missing — run \`bun run cat iris:pages\``).not.toBe("");
  expect(PAGE).toContain(`id="${TRANSLATION_META_ID}"`);
  expect(UNTRANSLATED).not.toContain(`id="${TRANSLATION_META_ID}"`);
  expect(MOUNTED_UNTRANSLATED).toContain('"availableLocales":[]');
});

for (const width of [1280, 390]) {
  test.describe(`/who-iris/ at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("the translated replica: the band carries the globe and every declared locale is live", async ({ page }) => {
      await serve(page, PAGE);
      const toggle = page.locator(".fa-glass-band .fa-page-lang-toggle");
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      const tabs = page.locator(".fa-page-lang-tab");
      await expect(tabs).toHaveText(["AR", "ZH", "EN", "FR", "RU", "ES"]);
      // Every one is a link and none is greyed: #2229 built every locale.
      await expect(page.locator("a.fa-page-lang-tab")).toHaveText(["AR", "ZH", "EN", "FR", "RU", "ES"]);
      await expect(page.locator("span.fa-page-lang-tab.is-unavailable")).toHaveCount(0);
      // ...and each goes where the generator wrote that locale's page. Since
      // cat-harness 622931623 a tab follows the page's own declared
      // `<link rel="alternate" hreflang>`, and gen-iris-pages declares the file
      // (`fr/index.html`); the directory and its index.html are one page on a
      // static host, so either spelling of that one address is right.
      await expect(page.locator("a.fa-page-lang-tab", { hasText: "FR" })).toHaveAttribute("href", /^\/who-iris\/fr\/(index\.html)?$/);
      await expect(page.locator("a.fa-page-lang-tab", { hasText: "EN" })).toHaveAttribute("href", /^\/who-iris\/(index\.html)?$/);
    });

    test("an untranslated mounted page: the globe, every declared locale, only English live", async ({ page }) => {
      await serve(page, MOUNTED_UNTRANSLATED);
      const toggle = page.locator(".fa-glass-band .fa-page-lang-toggle");
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      const tabs = page.locator(".fa-page-lang-tab");
      await expect(tabs).toHaveText(["AR", "ZH", "EN", "FR", "RU", "ES"]);
      // Only the source is a link; the rest are the main site's greyed spans.
      await expect(page.locator("a.fa-page-lang-tab")).toHaveText(["EN"]);
      await expect(page.locator("span.fa-page-lang-tab.is-unavailable")).toHaveCount(5);
    });
  });
}

test("without the block, the replica keeps its layout", async ({ page }) => {
  await serve(page, UNTRANSLATED);
  await expect(page.locator(".fa-glass-handle")).toBeVisible();
  await expect(page.locator(".fa-page-lang-toggle")).toHaveCount(0);
});
