import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * The translation drawer — bean `cat-tools-bbnd` (owner, 2026-10-10; built
 * 2026-10-20 on the owner's "do translation drawer").
 *
 * One control beside the coverage badge opens a `fa-qa-panel` drawer with two
 * scopes: THIS PAGE, from the inline `fa-translation-meta`, and THIS SITE, from
 * the layer's `folio-translation-status/v1` projection fetched on open.
 * Officiality is the projection's, computed by the officiality gate's reader,
 * so a disagreement between the PO headers and `status.json` is shown as one.
 *
 * Fixtures are written here, never read off the corpus.
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const STATUS_URL = "/assets/translation-status/index.json";

const STATUS = {
  $schema: "folio-translation-status/v1",
  changedAt: "2026-10-20",
  scope: "cat-harness/translations",
  page: "en/cat-harness/translation-status/",
  locales: [
    {
      locale: "fr", templates: 4, catalogues: 4, entries: 200, translated: 150, fuzzy: 10, untranslated: 40, unreadable: [],
      officiality: { state: "official", signedOffBy: "Dr. A", signedOffAt: "2026-10-01", officialCatalogues: 4, findings: 0 },
      files: [
        { path: "index.po", entries: 120, translated: 100, fuzzy: 5, untranslated: 15, official: "yes" },
        { path: "guides/onboarding.po", entries: 80, translated: 50, fuzzy: 5, untranslated: 25, official: "yes" },
      ],
    },
    {
      locale: "ar", templates: 4, catalogues: 2, entries: 100, translated: 20, fuzzy: 0, untranslated: 80, unreadable: [],
      officiality: { state: "disagree", officialCatalogues: 1, findings: 1 },
    },
    {
      locale: "zh", templates: 4, catalogues: 1, entries: 50, translated: 0, fuzzy: 0, untranslated: 50, unreadable: [],
      officiality: { state: "unofficial", officialCatalogues: 0, findings: 0 },
    },
  ],
};

const META = {
  lang: "fr",
  translationStatus: "unverified",
  translationSource: "guides/agent-onboarding",
  supportedLocales: ["ar", "zh", "en", "fr", "ru", "es"],
  availableLocales: ["en", "fr"],
  sweep: { run: false },
  statusSrc: STATUS_URL,
};

/** A block's TR badge, as `gen-docs-pages.ts` emits it, pointing at a projection. */
const BLOCK_SRC = "/assets/qa/harness/overview.translation.json";
const BLOCK_BADGE =
  `<p>A block. <button type="button" class="fa-qa-badge fa-qa-fam-translation" lang="en" dir="ltr" ` +
  `data-qa-family="translation" data-qa-key="overview" data-qa-label="Translation QA" ` +
  `data-qa-src="${BLOCK_SRC}" aria-expanded="false" aria-label="Translation QA: 1 warn">` +
  `<span class="fa-qa-tag">TR</span></button></p>`;
const witness = (freshness: string) => ({ kind: "script", id: "translation-block-qa.ts", version: "v1", freshness });
const BLOCK_PROJECTION = {
  $schema: "qa-witness/v1",
  family: "translation",
  subject: "overview — translations",
  state: "warn",
  counts: { fail: 0, warn: 1, pass: 2, na: 0, unknown: 0 },
  criteria: [
    { id: "translation-coverage", result: "pass", locale: "fr", witnesses: [witness("fresh")] },
    { id: "translation-not-echo", result: "pass", locale: "fr", witnesses: [witness("fresh")] },
    { id: "translation-coverage", result: "warn", locale: "ar", witnesses: [witness("stale")] },
  ],
};

function harness(meta: object, scheme: "light" | "dark", body = "<p>Body.</p>"): string {
  return (
    `<!doctype html><html lang="fr" data-fa-scheme="${scheme}"><head><meta charset="utf-8">` +
    `<style>body{background:${scheme === "light" ? "#fff" : "#27262b"}}${CSS}</style>` +
    `<script type="application/json" id="fa-translation-meta">${JSON.stringify(meta)}<\/script>` +
    `</head><body><div class="main-content" id="main-content"><h1>Page</h1>${body}</div>` +
    `<script>${JS}<\/script></body></html>`
  );
}

async function serve(page: Page, scheme: "light" | "dark", status: { code: number; body?: unknown }, meta: object = META, body?: string) {
  await page.route("http://tr.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/page.html")) return route.fulfill({ contentType: "text/html", body: harness(meta, scheme, body) });
    if (url.endsWith(BLOCK_SRC)) return route.fulfill({ contentType: "application/json", body: JSON.stringify(BLOCK_PROJECTION) });
    if (url.endsWith(STATUS_URL)) {
      return status.code === 200
        ? route.fulfill({ contentType: "application/json", body: JSON.stringify(status.body) })
        : route.fulfill({ status: status.code, body: "" });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto("http://tr.test/page.html");
}

const toggle = (p: Page) => p.locator(".fa-translation-badges .fa-tr-drawer-toggle");
const drawer = (p: Page) => p.locator(".fa-tr-drawer");

for (const scheme of ["dark", "light"] as const) {
  test.describe(`the translation drawer (${scheme} scheme)`, () => {
    test("one control opens a drawer with this page's facts and this site's per-locale officiality", async ({ page }) => {
      await serve(page, scheme, { code: 200, body: STATUS });
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
      await expect(drawer(page)).toBeVisible();
      await expect(drawer(page)).toHaveClass(/fa-qa-panel/);

      const facts = drawer(page).locator(".fa-tr-drawer__facts");
      await expect(facts).toContainText("Translation of");
      await expect(facts).toContainText("guides/agent-onboarding");
      await expect(facts).toContainText("not reviewed by a subject-matter expert");
      await expect(facts).toContainText("Not yet in");

      const row = (l: string) => drawer(page).locator(`tr[data-fa-tr-locale="${l}"]`);
      await expect(row("fr")).toContainText("official, signed off by Dr. A on 2026-10-01");
      await expect(row("fr")).toContainText("150 / 200 (75%)");
      // A disagreement between the two records is shown AS one, never as either side.
      await expect(row("ar").locator("td").last()).toHaveAttribute("data-fa-tr-officiality", "disagree");
      await expect(row("ar")).toContainText("records disagree");
      await expect(row("zh")).toContainText("not signed off");

      await expect(drawer(page).locator(".fa-tr-drawer__more a")).toHaveAttribute("href", "/en/cat-harness/translation-status/");

      // The drawer's text is readable in this scheme: not the colour of its own background.
      const contrast = await drawer(page).evaluate((n) => {
        const cs = getComputedStyle(n);
        return { fg: cs.color, bg: getComputedStyle(document.body).backgroundColor };
      });
      expect(contrast.fg).not.toBe(contrast.bg);
    });

    test("the inverse is reachable: Close, and the control again, both close it", async ({ page }) => {
      await serve(page, scheme, { code: 200, body: STATUS });
      await toggle(page).click();
      await drawer(page).locator(".fa-qa-close").click();
      await expect(drawer(page)).toHaveCount(0);
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
      await toggle(page).click();
      await expect(drawer(page)).toHaveCount(1);
      await toggle(page).click();
      await expect(drawer(page)).toHaveCount(0);
    });

    test("a site that publishes no status says so; a failed load says could-not-determine", async ({ page }) => {
      await serve(page, scheme, { code: 404 });
      await toggle(page).click();
      await expect(drawer(page)).toContainText("This site publishes no translation status.");
      // The page half still answers: absence of the site half does not empty the drawer.
      await expect(drawer(page).locator(".fa-tr-drawer__facts")).toContainText("Language");
    });

    test("the unverified-translation warning opens the same drawer", async ({ page }) => {
      await serve(page, scheme, { code: 200, body: STATUS });
      await page.locator(".fa-translation-warning summary").click();
      await page.locator(".fa-translation-warning__details").click();
      await expect(drawer(page)).toHaveCount(1);
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
      // Pressed again, it does not open a second drawer.
      await page.locator(".fa-translation-warning__details").click();
      await expect(drawer(page)).toHaveCount(1);
    });

    test("a block's TR panel is the drawer's block scope: stale vs current, and signed-off, per locale", async ({ page }) => {
      await serve(page, scheme, { code: 200, body: STATUS }, META, BLOCK_BADGE);
      await page.locator('.fa-qa-badge[data-qa-key="overview"]').click();
      const sec = page.locator(".fa-qa-panel .fa-tr-drawer__block");
      await expect(sec).toBeVisible();
      await expect(sec.locator('dd[data-fa-tr-locale="fr"] .fa-tr-drawer__fresh')).toHaveAttribute("data-fa-tr-fresh", "fresh");
      await expect(sec.locator('dd[data-fa-tr-locale="ar"] .fa-tr-drawer__fresh')).toHaveAttribute("data-fa-tr-fresh", "stale");
      await expect(sec.locator('dd[data-fa-tr-locale="ar"]')).toContainText("the source changed after 1 of 1 verdict(s)");
      await expect(sec.locator('dd[data-fa-tr-locale="fr"]')).toContainText("signed off: official, signed off by Dr. A");
      await expect(sec.locator('dd[data-fa-tr-locale="ar"] .fa-tr-drawer__official')).toHaveAttribute("data-fa-tr-officiality", "disagree");
      // ...and it reaches the page drawer.
      await sec.locator(".fa-translation-warning__details").click();
      await expect(page.locator(".fa-tr-drawer:not(.fa-qa-panel-warn):not(.fa-qa-panel-pass)").filter({ has: page.locator(".fa-tr-drawer__site") })).toHaveCount(1);
    });

    test("the status page's rows each open the catalogues behind their numbers", async ({ page }) => {
      // The row shape gen-translation-status.ts draws: `.ts-page` table rows
      // carrying `data-fa-tr-locale`, the locale in the row's `th`.
      const table =
        `<div class="ts-page"><table><tbody>` +
        `<tr data-fa-tr-locale="fr"><th scope="row"><code>fr</code></th><td>4 / 4</td></tr>` +
        `<tr data-fa-tr-locale="zh"><th scope="row"><code>zh</code></th><td>1 / 4</td></tr>` +
        `</tbody></table></div>`;
      await serve(page, scheme, { code: 200, body: STATUS }, { ...META, translationStatus: "" }, table);
      const fr = page.locator('tr[data-fa-tr-locale="fr"] .fa-tr-row-toggle');
      await fr.click();
      const drawerRow = page.locator('tr[data-fa-tr-locale="fr"] + tr.fa-tr-row-drawer');
      await expect(drawerRow).toBeVisible();
      await expect(drawerRow).toContainText("official, signed off by Dr. A");
      await expect(drawerRow).toContainText("guides/onboarding.po");
      await expect(drawerRow).toContainText("50 / 80 (63%)");
      // An older projection without per-catalogue rows says so instead of drawing an empty table.
      await page.locator('tr[data-fa-tr-locale="zh"] .fa-tr-row-toggle').click();
      await expect(page.locator('tr[data-fa-tr-locale="zh"] + tr.fa-tr-row-drawer')).toContainText("predates per-catalogue detail");
      // And it closes again.
      await fr.click();
      await expect(page.locator('tr[data-fa-tr-locale="fr"] + tr.fa-tr-row-drawer')).toHaveCount(0);
      await expect(fr).toHaveAttribute("aria-expanded", "false");
    });

    test("a server error is NOT reported as 'publishes none'", async ({ page }) => {
      await serve(page, scheme, { code: 500 });
      await toggle(page).click();
      await expect(drawer(page)).toContainText("Could not load the translation status (HTTP 500)");
    });
  });
}
