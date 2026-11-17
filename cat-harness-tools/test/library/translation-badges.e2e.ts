import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteDirFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { UN_LOCALES } from "../../schemas/content/translation.ts";
import { qaResultHref } from "../../scripts/qa-result-link.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * What the reader is told about translation, at the top of every page.
 *
 * Two defects this spec exists to keep fixed, both from issue #687.
 *
 * **The source language is a language.** The coverage badge read `0/5` on a
 * page authored in English on a six-UN-language site, because both halves of
 * that fraction excluded the source locale — the denominator was hardcoded to
 * `supported.length - 1`, and the numerator came from `available_locales`,
 * which the generator derives by resolving `translations/<locale>/<stem>.po`, a
 * lookup the source language can never satisfy. The same key had also drifted
 * into two meanings between the generated and the hand-authored halves of the
 * corpus, and `docs/fr/index.md` rendered `6/5 languages` — a numerator larger
 * than its denominator, which is what such a disagreement looks like once it
 * reaches a reader. Both front-matter conventions are exercised below, and both
 * must now produce the same answer.
 *
 * **A page carries ONE badge row.** The page-level `TR` badge is
 * server-rendered by `gen-docs-pages.ts` — whether a page's blocks carry any
 * translation verdict is structure, not a verdict — and `docs-ui.js` lifts it
 * into the coverage/sweep row it builds in the same place. If that lift
 * regressed the page would grow a second row under the title, so the hoist is
 * asserted rather than left to look right.
 *
 * The fixtures are written here, never read off the corpus: a spec whose
 * expected value is a live measurement goes red when the corpus gets better,
 * which `test/support/qa-fixture.ts` records `main` doing once already.
 */

const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const PAGE_URL = "http://tr.test/page.html";
const QA_INDEX_URL = "/assets/qa/harness/qa-index.json";
const QA_SRC_URL = "/assets/qa/harness/page.translation.json";
/** The published list of authored pages that HAVE a projection (bean `4l4d`). */
const QA_LIST_URL = "/assets/qa/translation-qa-pages.json";

interface Meta {
  lang: string;
  translationStatus?: string;
  /** The page this one translates. `docs-ui.js` shows it in the unverified
   *  notice's drawer, so the notice specs need to be able to set it. */
  translationSource?: string;
  translationQa?: { key: string; src: string; index: string; slug?: string; list?: string } | null;
  availableLocales?: string[];
  supportedLocales?: string[];
  sweep?: Record<string, unknown>;
}

/**
 * The page-level badge exactly as `gen-docs-pages.ts` emits it.
 *
 * Kept in this spec rather than lifted off a generated page: the corpus has one
 * such badge today and it would disappear the moment its single French sidecar
 * did, taking the coverage with it.
 */
const PAGE_BADGE =
  `<p><span class="fa-qa-badges fa-page-qa-badges">` +
  `<button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-translation" lang="en" dir="ltr" ` +
  `data-qa-family="translation" data-qa-key="page.translation" ` +
  `data-qa-label="Translation QA" data-qa-noun="page" ` +
  `data-qa-src="${QA_SRC_URL}" data-qa-index="${QA_INDEX_URL}" ` +
  `aria-expanded="false" aria-busy="true" title="Translation QA: loading the verdict…" ` +
  `aria-label="Translation QA: loading the verdict…">` +
  `<span class="fa-qa-tag">TR</span>` +
  `<span class="fa-qa-glyph" aria-hidden="true">…</span></button></span></p>`;

function harness(meta: Meta, body = "", scheme?: "light" | "dark"): string {
  return (
    `<!doctype html><html lang="${meta.lang}"` +
    (scheme ? ` data-fa-scheme="${scheme}"` : "") +
    `><head><meta charset="utf-8">` +
    `<style>body{background:${scheme === "light" ? "#fff" : "#27262b"}}${CSS}</style>` +
    `<script type="application/json" id="fa-translation-meta">${JSON.stringify(meta)}<\/script>` +
    `</head><body>` +
    `<div class="main-content" id="main-content"><h1>Harness</h1>${body}</div>` +
    `<script>${JS}<\/script></body></html>`
  );
}

/** Serve one page, and optionally the QA index and projection behind it. */
async function serve(
  page: Page,
  meta: Meta,
  opts: {
    body?: string;
    index?: unknown;
    projection?: unknown;
    /** The `translation-qa-pages.json` body; omitted, the list 404s. */
    list?: unknown;
    scheme?: "light" | "dark";
    /** Where the page is served; the notice derives its source link from it. */
    path?: string;
  } = {},
): Promise<void> {
  await page.route("http://tr.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/page.html")) {
      return route.fulfill({
        contentType: "text/html",
        body: harness(meta, opts.body, opts.scheme),
      });
    }
    if (url.endsWith(QA_LIST_URL) && opts.list !== undefined) {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(opts.list) });
    }
    if (url.endsWith(QA_INDEX_URL) && opts.index !== undefined) {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(opts.index) });
    }
    if (url.endsWith(QA_SRC_URL) && opts.projection !== undefined) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(opts.projection),
      });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto(opts.path ? `http://tr.test${opts.path}` : PAGE_URL);
}

const coverage = ".fa-lang-coverage-badge";

test.describe("the coverage badge counts the language the page is written in", () => {
  test("an untranslated English page is 1/6, not 0/5", async ({ page }) => {
    await serve(page, { lang: "en", availableLocales: [] });
    await expect(page.locator(coverage)).toContainText(`1/${UN_LOCALES.length} languages`);
  });

  test("the fraction's denominator is every supported locale, not one fewer", async ({ page }) => {
    // Read off the schema rather than written as `6`: the assertion is that the
    // denominator IS the supported set, and a literal would keep passing if the
    // set changed underneath it.
    await serve(page, { lang: "en", availableLocales: [] });
    const text = await page.locator(coverage).innerText();
    expect(text).not.toContain(`/${UN_LOCALES.length - 1}`);
  });

  test("a page with one translation is 2/6 — the source language and the translation", async ({
    page,
  }) => {
    await serve(page, { lang: "en", availableLocales: ["en", "fr"] });
    await expect(page.locator(coverage)).toContainText("2/6 languages");
  });

  test("the PO-derived list, which omits the source locale, still counts it", async ({ page }) => {
    // The shape `gen-docs-pages.ts` used to stamp, and that a downstream folio
    // on an older generator still carries. The page's own `lang` supplies what
    // the list cannot, so the two conventions converge at the point of use.
    await serve(page, { lang: "en", availableLocales: ["fr"] });
    await expect(page.locator(coverage)).toContainText("2/6 languages");
  });

  test("a complete page names the languages without repeating the set twice", async ({ page }) => {
    // The partial wording carries an "of <every supported locale>" tail, which
    // is what makes a partial count actionable — it names what is missing. At
    // 6/6 nothing is missing and that tail read "ar, zh, en, fr, ru, es — of
    // ar, zh, en, fr, ru, es".
    await serve(page, { lang: "en", availableLocales: ["ar", "zh", "en", "fr", "ru", "es"] });
    const title = await page.locator(coverage).getAttribute("title");
    expect(title).toContain("every supported language");
    expect(title).not.toContain("\u2014 of");
  });

  test("a translated page stamped with all six reads 6/6, never 6/5", async ({ page }) => {
    // `docs/fr/index.md`, which rendered a numerator larger than its
    // denominator until the `- 1` came out.
    await serve(page, {
      lang: "fr",
      availableLocales: ["ar", "zh", "en", "fr", "ru", "es"],
    });
    const text = await page.locator(coverage).innerText();
    expect(text).toContain("6/6 languages");
    expect(text).not.toContain("6/5");
  });

  test("a locale outside the supported set cannot inflate the count", async ({ page }) => {
    await serve(page, {
      lang: "en",
      availableLocales: ["fr", "tlh"],
      supportedLocales: ["en", "fr"],
    });
    await expect(page.locator(coverage)).toContainText("2/2 languages");
  });

  test("source-language-only says so, rather than 'no translations available'", async ({
    page,
  }) => {
    await serve(page, { lang: "en", availableLocales: [] });
    const title = await page.locator(coverage).getAttribute("title");
    expect(title).toContain("not yet translated");
    // The old wording claimed the page was available in nothing at all.
    expect(title).not.toContain("No translations available");
  });
});

test.describe("the language bar knows which language the page is in", () => {
  test("a French page offers French as current, not as untranslated", async ({ page }) => {
    await serve(page, {
      lang: "fr",
      availableLocales: ["ar", "zh", "en", "fr", "ru", "es"],
    });
    const fr = page.locator(".fa-page-lang-tab", { hasText: "FR" }).first();
    await expect(fr).toHaveClass(/is-current/);
    await expect(fr).not.toHaveClass(/is-unavailable/);
  });

  test("English is NOT clickable on a folio that has no English", async ({ page }) => {
    // The bar hardcoded `loc === "en"` as "always available". On an instance
    // authored in French with no English translation that offered a link to a
    // page which does not exist.
    await serve(page, {
      lang: "fr",
      availableLocales: ["fr", "es"],
      supportedLocales: ["en", "fr", "es"],
    });
    const en = page.locator(".fa-page-lang-tab", { hasText: "EN" }).first();
    await expect(en).toHaveClass(/is-unavailable/);
  });
});

test.describe("the page-level translation badge joins the badge row", () => {
  const index = {
    badges: {
      "page.translation": {
        state: "warn",
        counts: { fail: 0, warn: 1, pass: 2, na: 0, unknown: 1 },
      },
    },
  };

  test("it is lifted into the row under the title, leaving no second row", async ({ page }) => {
    await serve(page, { lang: "en", availableLocales: ["en", "fr"] }, { body: PAGE_BADGE, index });
    await expect(page.locator(".fa-translation-badges .fa-qa-badge")).toHaveCount(1);
    // The emptied wrapper and the paragraph kramdown put it in both go: left
    // behind, the paragraph keeps its margins and opens a gap under the title
    // that reads as a rendering fault.
    await expect(page.locator(".fa-page-qa-badges")).toHaveCount(0);
  });

  test("it still paints its verdict after being moved", async ({ page }) => {
    await serve(page, { lang: "en", availableLocales: ["en", "fr"] }, { body: PAGE_BADGE, index });
    const b = page.locator('.fa-qa-badge[data-qa-key="page.translation"]');
    await expect(b).toHaveClass(/fa-qa-warn/);
    await expect(b.locator(".fa-qa-glyph")).toHaveText("!");
  });

  test("it stands on its own when the badge row is not built", async ({ page }) => {
    // No `fa-translation-meta`, so `mountTranslationBadges` returns early. The
    // badge must remain where the generator put it rather than vanishing —
    // server-rendered markup that depends on a script to be visible is markup
    // that disappears whenever the script does not run.
    await page.route("http://tr.test/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/page.html")) {
        return route.fulfill({
          contentType: "text/html",
          body:
            `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
            `<style>${CSS}</style></head><body>` +
            `<div class="main-content" id="main-content"><h1>Harness</h1>${PAGE_BADGE}</div>` +
            `<script>${JS}<\/script></body></html>`,
        });
      }
      if (url.endsWith(QA_INDEX_URL)) {
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(index) });
      }
      return route.fulfill({ status: 404, body: "not found" });
    });
    await page.goto(PAGE_URL);
    await expect(page.locator(".fa-page-qa-badges .fa-qa-badge")).toHaveCount(1);
  });

  test("a rolled-up criterion says WHICH block it ruled on", async ({ page }) => {
    // The whole reason a page-level panel is legible: one panel carries
    // verdicts about many blocks, and a `fail` with no subject is a page-wide
    // alarm nobody can act on.
    const projection = {
      $schema: "qa-witness/v1",
      family: "translation",
      subject: "Harness — translations",
      sidecars: ["docs/source/concepts-harness/overview.fr.translation-qa.json"],
      state: "warn",
      counts: { fail: 0, warn: 1, pass: 2, na: 0, unknown: 1 },
      criteria: [
        {
          id: "translation-not-echo",
          result: "warn",
          locale: "fr",
          block: "sec:harness-overview",
          metrics: { echoed: 3, translated: 12 },
          witnesses: [
            {
              kind: "script",
              id: "pipeline/translation-block-qa.ts",
              freshness: "fresh",
            },
          ],
        },
      ],
    };
    await serve(
      page,
      { lang: "en", availableLocales: ["en", "fr"] },
      { body: PAGE_BADGE, index, projection },
    );
    await page.locator('.fa-qa-badge[data-qa-key="page.translation"]').click();
    await expect(page.locator(".fa-qa-chip.fa-qa-block")).toHaveText("sec:harness-overview");
    await expect(page.locator(".fa-qa-chip.fa-qa-locale")).toHaveText("fr");
  });
});

test.describe("a hand-authored page builds its own TR badge", () => {
  // The bean-`pp93` case. A generated page has its badge written into the
  // markup; `docs/fr/index.md` has no generator, so `docs-ui.js` builds one
  // from the paths `head_custom.html` publishes — but ONLY where a projection
  // exists, which the published `translation-qa-pages.json` says and the page
  // does not guess. A badge emitted unconditionally would 404 and paint
  // `unknown`, "could not determine", which is a different answer from "not
  // swept". Since bean `4l4d` that list is FETCHED rather than baked into the
  // page by Jekyll, so the committed site no longer depends on the QA corpus.
  const tq = {
    key: "page.translation",
    slug: "harness",
    src: QA_SRC_URL,
    index: QA_INDEX_URL,
    list: QA_LIST_URL,
  };
  const listed = { $schema: "folio-qa-translation-pages/v1", corpus: "present", pages: ["harness"] };
  const unlisted = { $schema: "folio-qa-translation-pages/v1", corpus: "present", pages: ["index"] };
  const index = {
    badges: {
      "page.translation": {
        state: "warn",
        counts: { fail: 0, warn: 14, pass: 1, na: 0, unknown: 5 },
      },
    },
  };

  test("with a projection, the badge appears and paints", async ({ page }) => {
    await serve(
      page,
      { lang: "fr", availableLocales: ["ar", "zh", "en", "fr", "ru", "es"], translationQa: tq },
      { index, list: listed },
    );
    const b = page.locator('.fa-qa-badge[data-qa-key="page.translation"]');
    await expect(b).toHaveCount(1);
    await expect(b).toHaveClass(/fa-qa-warn/);
    // In the badge row, not loose in the page.
    await expect(page.locator(".fa-translation-badges .fa-qa-badge")).toHaveCount(1);
  });

  test("with NO projection, no badge at all — not a broken one", async ({ page }) => {
    await serve(page, { lang: "en", availableLocales: [] }, { index });
    await expect(page.locator(".fa-qa-badge")).toHaveCount(0);
  });

  test("a list that does not name the page means no projection, and no badge", async ({ page }) => {
    // Wait for the list to have been answered, not for a timeout: an absence
    // asserted before the fetch lands would pass vacuously.
    const answered = page.waitForResponse((r) => r.url().endsWith(QA_LIST_URL));
    await serve(page, { lang: "en", availableLocales: ["en", "fr"], translationQa: tq }, { index, list: unlisted });
    await answered;
    await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
    await expect(page.locator(".fa-qa-badge")).toHaveCount(0);
  });

  for (const [why, list] of [
    ["the list says the corpus was absent", { $schema: "folio-qa-translation-pages/v1", corpus: "absent", pages: [] }],
    ["the list will not load", undefined],
  ] as const) {
    test(`${why}: the badge reads "not available in this build", never a verdict`, async ({ page }) => {
      await serve(page, { lang: "fr", availableLocales: ["en", "fr"], translationQa: tq }, { index, list });
      const b = page.locator('.fa-qa-badge[data-qa-key="page.translation"]');
      await expect(b).toHaveClass(/fa-qa-unavailable/);
      for (const wrong of ["fa-qa-pass", "fa-qa-warn", "fa-qa-fail", "fa-qa-pending"]) {
        await expect(b).not.toHaveClass(new RegExp(wrong));
      }
      // Inert: nothing to open.
      expect(await b.evaluate((n) => n.tagName)).toBe("SPAN");
      await expect(b).toHaveAccessibleName(
        "Translation QA: not available in this build — the QA results were not fetched, so whether this was swept is unknown",
      );
    });
  }

  test("it does not double up when the generator already emitted one", async ({ page }) => {
    // A generated page carries `fa-page-qa-badges` in its markup AND would get
    // `translationQa` from the same front-matter lookup. Two badges for one
    // subject is two controls that can disagree about one verdict.
    await serve(
      page,
      { lang: "en", availableLocales: ["en", "fr"], translationQa: tq },
      { body: PAGE_BADGE, index, list: listed },
    );
    await expect(page.locator('.fa-qa-badge[data-qa-key="page.translation"]')).toHaveCount(1);
  });

  test("the panel opens on a per-locale roll-up", async ({ page }) => {
    const projection = {
      $schema: "qa-witness/v1",
      family: "translation",
      subject: "index — translations",
      sidecars: ["test/results/translation-qa/docs/index.fr.translation-qa.json"],
      state: "warn",
      counts: { fail: 0, warn: 2, pass: 0, na: 0, unknown: 0 },
      criteria: [
        {
          id: "translation-coverage",
          result: "warn",
          locale: "ar",
          metrics: { translated: 36, total: 43, pct: 84 },
          witnesses: [{ kind: "script", id: "x", freshness: "fresh" }],
        },
        {
          id: "translation-coverage",
          result: "warn",
          locale: "fr",
          metrics: { translated: 36, total: 43, pct: 84 },
          witnesses: [{ kind: "script", id: "x", freshness: "fresh" }],
        },
      ],
    };
    await serve(
      page,
      { lang: "fr", availableLocales: ["ar", "zh", "en", "fr", "ru", "es"], translationQa: tq },
      { index, projection, list: listed },
    );
    await page.locator('.fa-qa-badge[data-qa-key="page.translation"]').click();
    await expect(page.locator(".fa-qa-chip.fa-qa-locale")).toHaveCount(2);
  });

  /**
   * The panel's links to the result files: bean `bejf`, issue #2217. The owner
   * found `…/blob/main/test/results/translation-qa/docs/index.ar…json` dead on
   * `/fr/`. The panel composed it as `blob/main/` + an instance-relative path.
   * It now renders the href the generator stamped (`qa-result-link.ts`) and
   * composes nothing, so these drive the RENDERED anchor, not the helper.
   */
  const SHA = "941df8d8eb29173e60cd5ed56d02aa8a425bbb56";
  const REPO_PATH = "cat-harness/test/results/translation-qa/docs/index.fr.translation-qa.json";
  const rollUp = (extra: Record<string, unknown>) => ({
    $schema: "qa-witness/v1",
    family: "translation",
    subject: "index — translations",
    sidecars: ["test/results/translation-qa/docs/index.fr.translation-qa.json"],
    state: "warn",
    counts: { fail: 0, warn: 1, pass: 0, na: 0, unknown: 0 },
    criteria: [
      { id: "translation-coverage", result: "warn", locale: "fr", witnesses: [{ kind: "script", id: "x", freshness: "fresh" }] },
    ],
    ...extra,
  });

  test("a result file links to its entry on the qa-reports branch, never to blob/main", async ({ page }) => {
    const link = qaResultHref({
      repoWeb: "https://github.com/litlfred/folio-assistant",
      repoPath: REPO_PATH,
      storedOn: "cat/cat-harness/qa-reports",
      key: `main/${SHA}`,
    });
    await serve(
      page,
      { lang: "fr", availableLocales: ["en", "fr"], translationQa: tq },
      { index, projection: rollUp({ sidecarLinks: [link] }), list: listed },
    );
    await page.locator('.fa-qa-badge[data-qa-key="page.translation"]').click();
    const a = page.locator("a.fa-qa-sidecar-link");
    await expect(a).toHaveCount(1);
    await expect(a).toHaveText(REPO_PATH);
    await expect(a).toHaveAttribute(
      "href",
      `https://github.com/litlfred/folio-assistant/blob/cat/cat-harness/qa-reports/main/${SHA}/${REPO_PATH}`,
    );
    await expect(a).toHaveAttribute("data-qa-addressed-by", "entry");
  });

  test("a projection with no stamped links shows the paths and links nothing", async ({ page }) => {
    // The old renderer composed a URL here. One that 404s invites the click
    // that proves the page broken, so an unstamped projection gets plain text.
    await serve(
      page,
      { lang: "fr", availableLocales: ["en", "fr"], translationQa: tq },
      { index, projection: rollUp({}), list: listed },
    );
    await page.locator('.fa-qa-badge[data-qa-key="page.translation"]').click();
    await expect(page.locator("a.fa-qa-sidecar-link")).toHaveCount(0);
    await expect(page.locator("code.fa-qa-sidecar-link")).toHaveText("test/results/translation-qa/docs/index.fr.translation-qa.json");
  });
});

/**
 * The badge row takes its colours from the stylesheet, in both schemes.
 *
 * Bean `n7vv`. `mountTranslationBadges` built these two badges and the
 * unverified-translation notice from inline literals — `#14532d`, `#78350f`,
 * `#1e293b`, `#e2e8f0` — so a dark-green `Swept` chip and a dark-brown
 * `languages` chip sat on the page's LIGHT main content beside a `TR` chip that
 * had been themed properly. Never a contrast failure (light text on a dark fill
 * is fine inside each chip); two of three controls in one row simply ignored
 * the scheme.
 *
 * The ratios below are asserted rather than trusted to a comment. Every number
 * written beside a token in `docs-ui.css` is computed here from what the
 * browser actually resolves, so a token edited without re-measuring fails.
 */
test.describe("the translation badges are themed, not painted inline", () => {
  const STATES: Array<[string, string, string[]]> = [
    ["is-ok", "every supported language", ["ar", "zh", "en", "fr", "ru", "es"]],
    ["is-partial", "some of them", ["en", "fr"]],
    ["is-idle", "the source language alone", []],
  ];

  /** WCAG relative-luminance contrast, from two resolved `rgb(...)` strings. */
  const CONTRAST = `(a, b) => {
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const lum = (s) => {
      const [r, g, b] = (s.match(/\\d+(\\.\\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number);
      const [R, G, B] = [r, g, b].map((v) => lin(v / 255));
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    };
    const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
    return (hi + 0.05) / (lo + 0.05);
  }`;

  test("no badge carries an inline style attribute", async ({ page }) => {
    // The literal test. Every colour these used to hold is a token now, and a
    // regression would most likely arrive as a convenient inline `style`.
    await serve(page, { lang: "en", availableLocales: ["en", "fr"], translationStatus: "unverified" });
    for (const sel of [".fa-lang-coverage-badge", ".fa-sweep-badge", ".fa-translation-warning"]) {
      const el = page.locator(sel);
      await expect(el).toHaveCount(1);
      expect(await el.getAttribute("style")).toBeNull();
    }
  });

  for (const [cls, why, locales] of STATES) {
    test(`the coverage badge carries ${cls} when a page is in ${why}`, async ({ page }) => {
      await serve(page, { lang: "en", availableLocales: locales });
      await expect(page.locator(".fa-lang-coverage-badge")).toHaveClass(
        new RegExp(`fa-translation-badge(?=.*\\b${cls}\\b)`),
      );
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    test(`every state's text clears 4.5:1 on its own fill in ${scheme}`, async ({ page }) => {
      for (const [, , locales] of STATES) {
        await serve(page, { lang: "en", availableLocales: locales }, { scheme });
        const r = await page.evaluate((fn) => {
          const e = document.querySelector(".fa-lang-coverage-badge") as HTMLElement;
          const c = getComputedStyle(e);
          return (eval(fn) as (a: string, b: string) => number)(c.color, c.backgroundColor);
        }, CONTRAST);
        expect(r).toBeGreaterThanOrEqual(4.5);
      }
    });

    test(`every state's border clears 3:1 on its own fill in ${scheme}`, async ({ page }) => {
      // 3:1 is the non-text threshold: the border is what separates the chip
      // from the page, and it is a shape rather than a glyph. Asserted at the
      // real number — the dark `idle` border sat at 2.92:1 under a comment
      // claiming 3:1, and was raised rather than the assertion lowered.
      for (const [, , locales] of STATES) {
        await serve(page, { lang: "en", availableLocales: locales }, { scheme });
        const r = await page.evaluate((fn) => {
          const e = document.querySelector(".fa-lang-coverage-badge") as HTMLElement;
          const c = getComputedStyle(e);
          return (eval(fn) as (a: string, b: string) => number)(c.borderTopColor, c.backgroundColor);
        }, CONTRAST);
        expect(r).toBeGreaterThanOrEqual(3);
      }
    });
  }

  test("the two schemes resolve to DIFFERENT colours", async ({ page }) => {
    // Without this the suite would pass on a stylesheet that declared the dark
    // values once and never overrode them — which is the defect, not the fix.
    const read = async (scheme: "light" | "dark") => {
      await serve(page, { lang: "en", availableLocales: ["en", "fr"] }, { scheme });
      return page.evaluate(() => {
        const c = getComputedStyle(document.querySelector(".fa-lang-coverage-badge")!);
        return c.backgroundColor + "|" + c.color;
      });
    };
    expect(await read("light")).not.toBe(await read("dark"));
  });
});

/* ── The unreviewed-translation notice is PROMINENT, and fails closed ───────
 *
 * Owner, 2026-11-13: *"need VERY prominent disclaimer when any translated text
 * on page has not been human translated/adjudicated"* (cat-harness#1311). That
 * supersedes the 2026-09-21 ruling for a slim one-line notice: the line was
 * easy to miss, and it appeared only for the status "unverified".
 *
 * So the notice is now a full-width block, first in the content, in the
 * page's language and then English, linking to the source-language page. The
 * detail the one-line form opened to is kept, behind a "Translation details"
 * disclosure (`.fa-translation-warning__more`); the tests below that open it
 * are the ones that guarded the old drawer, re-aimed at its new place.
 *
 * The first five cases moved here from cat-harness
 * `test/docs-ui-translation-notice.test.ts`, which put a browser test in the
 * content layer (`check:content-code-free`) where the unit-test job has no
 * Chromium.
 */
test.describe("the unreviewed-translation notice", () => {
  const FR = { lang: "fr", translationStatus: "unverified", translationSource: "page.md", availableLocales: ["en", "fr"] };
  const prominent = ".fa-translation-warning--prominent";

  test("an unverified French page shows it first, full width, in French and English, linking to the source", async ({ page }) => {
    await serve(page, FR, { path: "/fr/page.html" });
    const notice = page.locator(prominent);
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText("Traduction automatique");
    await expect(notice).toContainText("Machine translation");
    const r = await notice.evaluate((e) => ({
      first: e.parentElement!.firstElementChild === e,
      width: (e as HTMLElement).offsetWidth / (e.parentElement as HTMLElement).clientWidth,
    }));
    expect(r.first).toBe(true);
    expect(r.width).toBeGreaterThan(0.95);
    await expect(notice.locator(".fa-translation-warning__source").first()).toHaveAttribute("href", "/page.html");
  });

  test("a translated page with no status fails closed and shows it", async ({ page }) => {
    await serve(page, { ...FR, translationStatus: "" }, { path: "/fr/page.html" });
    await expect(page.locator(prominent)).toContainText("Traduction automatique");
  });

  test("a stale translation shows it", async ({ page }) => {
    await serve(page, { ...FR, translationStatus: "stale" }, { path: "/fr/page.html" });
    await expect(page.locator(prominent)).toContainText("Machine translation");
  });

  test("a locale with no notice text of its own falls back to English", async ({ page }) => {
    await serve(page, { ...FR, lang: "de", availableLocales: ["en", "de"] }, { path: "/de/page.html" });
    await expect(page.locator(prominent)).toContainText("Machine translation");
    await expect(page.locator(prominent)).not.toContainText("Traduction automatique");
  });

  test("a verified translation, and a source-language page, show none", async ({ page }) => {
    await serve(page, { ...FR, translationStatus: "verified" }, { path: "/fr/page.html" });
    await expect(page.locator(".fa-translation-warning")).toHaveCount(0);
    await page.unrouteAll();
    await serve(page, { lang: "en", translationStatus: "", translationSource: "", availableLocales: ["en", "fr"] });
    await expect(page.locator(".fa-translation-warning")).toHaveCount(0);
  });

  test("the detail is collapsed under the notice, not the notice itself", async ({ page }) => {
    await serve(page, { lang: "fr", translationStatus: "unverified", translationSource: "index.md" });
    const notice = page.locator(".fa-translation-warning");
    await expect(notice).toHaveCount(1);
    await expect(notice).toHaveClass(/fa-translation-warning--prominent/);
    await expect(notice.locator(".fa-translation-warning__more")).not.toHaveAttribute("open", "");
  });

  test("the detail is hidden until opened, then reachable", async ({ page }) => {
    await serve(page, { lang: "fr", translationStatus: "unverified", translationSource: "index.md" });
    const notice = page.locator(".fa-translation-warning");
    const summary = notice.locator("summary");
    const body = notice.locator(".fa-translation-warning__body");

    await expect(body).toBeHidden();
    // Off-centre, as a reader clicks: `tr1m` (owner, 2026-09-22) accepted the
    // glass handle's overlap at the column's centre, and the test below
    // guards that acceptance.
    await summary.click({ position: { x: 24, y: 12 } });
    await expect(body).toBeVisible();
    await expect(body).toContainText("index.md");
    await expect(body).toContainText("translation_signoff");
  });

  test("the glass handle takes a slice of the notice, never the line", async ({ page }) => {
    // The guard on the overlap `tr1m` accepted: IF the handle meets the
    // disclosure's line, a tenth of it at most (it was 71 of 1238, or 5.7%).
    await serve(page, { lang: "fr", translationStatus: "unverified", translationSource: "index.md" });
    const s = (await page.locator(".fa-translation-warning summary").boundingBox())!;
    const h = (await page.locator(".fa-glass-handle").boundingBox())!;
    const overlapX = Math.max(0, Math.min(s.x + s.width, h.x + h.width) - Math.max(s.x, h.x));
    const overlapY = Math.max(0, Math.min(s.y + s.height, h.y + h.height) - Math.max(s.y, h.y));
    if (overlapY > 0) expect(overlapX / s.width).toBeLessThan(0.1);
  });

  test("the detail opens from the keyboard, and closing is reachable — `l4zi`", async ({ page }) => {
    await serve(page, { lang: "fr", translationStatus: "unverified", translationSource: "index.md" });
    const more = page.locator(".fa-translation-warning__more");
    const summary = more.locator("summary");

    await summary.press("Enter");
    await expect(more).toHaveAttribute("open", "");
    await summary.press("Enter");
    await expect(more).not.toHaveAttribute("open", "");
  });

  test("offers the QA report only when there IS one", async ({ page }) => {
    // `pb04`: a control that opens nothing is worse than no control. The
    // button is drawn from `translationQa.src`, so a page with no projection
    // gets the notice and no dead button.
    await serve(page, { lang: "fr", translationStatus: "unverified", translationQa: null });
    await expect(page.locator(".fa-translation-warning")).toHaveCount(1);
    await expect(page.locator(".fa-translation-warning__report")).toHaveCount(0);
  });

  test("with the published list, the report is offered only for a listed page", async ({ page }) => {
    // Since bean `4l4d` every page carries the paths, so `src` alone no longer
    // means a report exists; the fetched list decides.
    const tq = { key: "page.translation", slug: "harness", src: QA_SRC_URL, index: QA_INDEX_URL, list: QA_LIST_URL };
    const index = { badges: { "page.translation": { state: "warn", counts: { fail: 0, warn: 1, pass: 0, na: 0, unknown: 0 } } } };
    const answered = page.waitForResponse((r) => r.url().endsWith(QA_LIST_URL));
    await serve(page, { lang: "fr", translationStatus: "unverified", translationQa: tq }, {
      index,
      list: { $schema: "folio-qa-translation-pages/v1", corpus: "present", pages: ["index"] },
    });
    await answered;
    await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
    await expect(page.locator(".fa-translation-warning__report")).toHaveCount(1);
    await expect(page.locator(".fa-translation-warning__report")).toBeHidden();
  });

  test("and it is shown once the listed page's badge is built", async ({ page }) => {
    const tq = { key: "page.translation", slug: "harness", src: QA_SRC_URL, index: QA_INDEX_URL, list: QA_LIST_URL };
    const index = { badges: { "page.translation": { state: "warn", counts: { fail: 0, warn: 1, pass: 0, na: 0, unknown: 0 } } } };
    await serve(page, { lang: "fr", translationStatus: "unverified", translationQa: tq }, {
      index,
      list: { $schema: "folio-qa-translation-pages/v1", corpus: "present", pages: ["harness"] },
    });
    await page.locator(".fa-translation-warning summary").first().press("Enter");
    await expect(page.locator(".fa-translation-warning__report")).toBeVisible();
  });

  /* ── On an Arabic page each language block is laid out as its own ──────
   *
   * Bean `giiw`, from an owner screenshot of the Arabic staging preview: an
   * English sentence that inherited `dir="rtl"` from <html> lost its start
   * off the LEFT edge. The prominent notice now carries an Arabic block and
   * an English one, so each must carry its own `lang` and `dir`, and the
   * English detail disclosure must still compute ltr. The harness sets
   * `dir="rtl"` itself (as `init()` does for `ar`). */
  const AR = { lang: "ar", translationStatus: "unverified", translationSource: "index.md" } as const;

  test("the Arabic block is rtl, the English block and the detail are ltr, on an RTL page", async ({ page }) => {
    await serve(page, AR);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    const notice = page.locator(".fa-translation-warning");
    const blocks = notice.locator(".fa-translation-warning__lang");
    await expect(blocks).toHaveCount(2);
    await expect(blocks.nth(0)).toHaveAttribute("lang", "ar");
    await expect(blocks.nth(0)).toHaveAttribute("dir", "rtl");
    await expect(blocks.nth(1)).toHaveAttribute("lang", "en");
    await expect(blocks.nth(1)).toHaveAttribute("dir", "ltr");
    for (const sel of [".fa-translation-warning__more summary", ".fa-translation-warning__body"]) {
      const d = await notice.locator(sel).evaluate((e) => ({
        dir: getComputedStyle(e).direction,
        lang: e.closest("[lang]")!.getAttribute("lang"),
      }));
      expect(d).toEqual({ dir: "ltr", lang: "en" });
    }
  });

  test("at a narrow width the English sentence starts at its left edge and wraps rather than clips", async ({ page }) => {
    // The old one-line notice truncated with an ellipsis; the prominent one
    // wraps (`white-space: normal`), so nothing is clipped and the start of
    // the English sentence is at the block's LEFT edge even on an RTL page.
    await page.setViewportSize({ width: 480, height: 800 });
    await serve(page, AR);
    const r = await page.locator(".fa-translation-warning__lang[lang=en] .fa-translation-warning__text").evaluate((t) => {
      const tn = document.createTreeWalker(t, NodeFilter.SHOW_TEXT).nextNode()!;
      const range = document.createRange();
      range.setStart(tn, 0);
      range.setEnd(tn, 1);
      const first = range.getBoundingClientRect();
      const box = t.getBoundingClientRect();
      return {
        firstLeft: first.left - box.left,
        firstInside: first.left >= box.left && first.right <= box.right,
        clipped: (t as HTMLElement).scrollWidth > (t as HTMLElement).clientWidth + 1,
        lines: box.height / parseFloat(getComputedStyle(t).lineHeight),
      };
    });
    expect(r.firstInside).toBe(true);
    expect(r.firstLeft).toBeLessThan(24);
    expect(r.clipped).toBe(false);
    expect(r.lines).toBeGreaterThan(1);
  });

  test("the coverage and sweep badges are marked English too", async ({ page }) => {
    await serve(page, { ...AR, availableLocales: ["ar", "en"] });
    for (const sel of [".fa-lang-coverage-badge", ".fa-sweep-badge"]) {
      await expect(page.locator(sel)).toHaveAttribute("lang", "en");
      await expect(page.locator(sel)).toHaveAttribute("dir", "ltr");
    }
    // ...but the ROW keeps the page's direction: its order is the page's.
    const rowDir = await page.locator(".fa-translation-badges").evaluate((e) => getComputedStyle(e).direction);
    expect(rowDir).toBe("rtl");
  });

  test("and a verified page gets no notice at all", async ({ page }) => {
    // The control that makes the rest mean something: every assertion above
    // would pass over a notice injected onto every page.
    await serve(page, { lang: "fr", translationStatus: "verified" });
    await expect(page.locator(".fa-translation-warning")).toHaveCount(0);
  });
});

test.describe("on a folio's site the sweep badge is the folio's or says why — #2263 follow-up", () => {
  // `compose-docs --shell` no longer ships the platform's
  // `_data/translation-qa.json` into a folio's site, so the sweep there is
  // absent. `head_custom.html` then passes `foreignSite.absent.translationQa`
  // as `sweep.absent`. "Swept 49/689" on every page of an IG folio's site was the
  // platform's sweep, and "QA: not run" would be a claim about the folio
  // that nobody made.
  const note = "ig-folio publishes no translation QA sweep on this site";

  test("absent: inert, in words, with no ratio and no 'not run'", async ({ page }) => {
    await serve(page, { lang: "en", availableLocales: [], sweep: { absent: note, run: false, totalPages: 0, pagesWithTranslations: 0, complete: false } });
    const badge = page.locator(".fa-sweep-badge");
    await expect(badge).toHaveText("– QA: not published");
    await expect(badge).toHaveClass(/is-idle/);
    await expect(badge).toHaveAttribute("title", "Translation QA: " + note + ".");
  });

  test("a site that publishes a sweep shows it, note or no note", async ({ page }) => {
    await serve(page, { lang: "en", availableLocales: [], sweep: { absent: null, run: true, sweptAt: "t", totalPages: 12, pagesWithTranslations: 3, complete: true } });
    await expect(page.locator(".fa-sweep-badge")).toContainText("Swept 3/12");
  });

  test("with no note the platform's own wording stands", async ({ page }) => {
    await serve(page, { lang: "en", availableLocales: [], sweep: { run: false } });
    await expect(page.locator(".fa-sweep-badge")).toContainText("QA: not run");
  });
});

/* ── The rest of the chrome on an Arabic page — bean `giiw`, item 2 ───────
 *
 * The notice and the coverage/sweep badges were the first round. The audit
 * that closed it found English chrome still inheriting `dir="rtl"` from <html>
 * everywhere else docs-ui draws: the actions panel (Page settings among its
 * views), the glass and its handle, the search band, the sidebar's icon row
 * and its tooltips, Folders, Pages, ▦ Harnesses, the document index's heading,
 * the QA panels a badge opens, and the badges themselves — the generated
 * markup had `direction: ltr` from CSS only, and a translated copy of a
 * generated page has not even that in its markup.
 *
 * Each case asserts the element's nearest `lang` is `en` AND its computed
 * direction is `ltr`, on a page whose <html> is `dir="rtl"`. The CONTROLS are
 * the other half: what IS translated (the page's own headings in the index,
 * `.site-nav`) and the rows whose order should mirror (the icon row, the band)
 * keep the page's direction, so marking everything English would fail too.
 *
 * A sidebar fixture, as `harness-row-alignment.e2e.ts` builds it: the
 * committed footer include and navbar row data, with `navbar-row.js` inlined.
 */
test.describe("on an Arabic page the rest of the chrome is English, laid out as English", () => {
  const SITE_ABS = join(ROOT, SITE);
  const ROW_JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js"))), "utf8");
  const NAVBAR = (JSON.parse(readFileSync(overlayPath(join(SITE_ABS, "_data/harness.json")), "utf8")) as { navbar: unknown }).navbar;
  const FOOTER = (() => {
    const src = readFileSync(overlayPath(join(SITE_ABS, "_includes/generated/navbar-footer.html")), "utf8");
    const line = src.split("\n").find((l) => l.startsWith('<div class="fa-nav-in">'));
    if (!line) throw new Error("navbar-footer.html carries no regions line — run `bun run cat navbar:include`.");
    return line.replace(/\{\{\s*'([^']*)'\s*\|\s*relative_url\s*\}\}/g, (_m, p: string) => "/folio-assistant" + p);
  })();
  /** The page badge as a TRANSLATED copy of a generated page still carries it: no `lang`, no `dir`. */
  const LEGACY_BADGE = PAGE_BADGE.replace(' lang="en" dir="ltr"', "");
  const projection = {
    $schema: "qa-witness/v1",
    family: "translation",
    subject: "Harness — translations",
    sidecars: [],
    state: "warn",
    counts: { fail: 0, warn: 1, pass: 0, na: 0, unknown: 0 },
    criteria: [{ id: "translation-not-echo", result: "warn", locale: "ar", block: "sec:a", witnesses: [] }],
  };
  const index = { badges: { "page.translation": { state: "warn", counts: projection.counts } } };
  const AR_START = "البدء";

  function arabicPage(): string {
    const meta = { lang: "ar", availableLocales: ["ar", "en"] };
    return (
      `<!doctype html><html lang="ar"><head><meta charset="utf-8">` +
      `<meta name="fa-baseurl" content="/folio-assistant">` +
      `<style>body{margin:0;background:#fff}` +
      `.side-bar{position:fixed;top:0;right:0;width:16.5rem;height:100%;display:flex;flex-flow:column nowrap}` +
      `.site-header{display:flex;align-items:center}.site-title{flex:1}${CSS}</style>` +
      `<script type="application/json" id="fa-translation-meta">${JSON.stringify(meta)}<\/script>` +
      `<script type="application/json" id="fa-navbar-row">${JSON.stringify(NAVBAR)}<\/script>` +
      `</head><body>` +
      `<div class="side-bar">` +
      `<div class="site-header"><a class="site-title" href="#"><span class="fa-site-title">C@T Harness</span></a></div>` +
      `<div class="search"><div class="search-input-wrap"><input type="text" id="search-input" placeholder="Search folio-assistant"></div>` +
      `<div id="search-results" class="search-results"></div></div>` +
      `<nav class="site-nav" id="site-nav"><ul class="nav-list"><li class="nav-list-item">` +
      `<a class="nav-list-link" href="#">${AR_START}</a></li></ul></nav>` +
      `<footer class="site-footer"><input type="checkbox" class="fa-nav-open" id="fa-nav-open">${FOOTER}</footer>` +
      `</div>` +
      `<div class="main"><div class="main-content" id="main-content"><h1>Harness</h1>${LEGACY_BADGE}` +
      // An older generator's inert badge, as `process/ar/evidence.md` still
      // carries it: no index, so nothing ever paints it.
      `<p>${AR_START} <span class="fa-qa-badges"><span class="fa-qa-badge fa-qa-unswept fa-qa-fam-block" ` +
      `title="Content QA: not swept"><span class="fa-qa-tag">QA</span></span></span></p>` +
      `<h2 id="a">أربعة أمور</h2><h3 id="a1">فرعي</h3>` +
      `<h2 id="b">الخطوات</h2></div></div>` +
      `<script>window.jtd={theme:"light",getTheme:function(){return this.theme},setTheme:function(t){this.theme=t}};<\/script>` +
      `<script>${ROW_JS}<\/script><script>${JS}<\/script></body></html>`
    );
  }

  async function open(p: Page): Promise<string[]> {
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.route("http://tr.test/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/page.html")) return route.fulfill({ contentType: "text/html", body: arabicPage() });
      if (url.endsWith(QA_INDEX_URL)) return route.fulfill({ contentType: "application/json", body: JSON.stringify(index) });
      if (url.endsWith(QA_SRC_URL)) return route.fulfill({ contentType: "application/json", body: JSON.stringify(projection) });
      return route.fulfill({ status: 404, body: "not found" });
    });
    await p.goto(PAGE_URL);
    expect(await p.evaluate(() => document.documentElement.dir)).toBe("rtl");
    return errors;
  }

  /** Every match's nearest declared language and its computed direction. */
  async function langDir(p: Page, sel: string): Promise<{ lang: string | null; dir: string }[]> {
    await expect(p.locator(sel).first()).toBeAttached();
    return p.locator(sel).evaluateAll((els) =>
      els.map((e) => {
        const holder = e.closest("[lang]");
        return { lang: holder ? holder.getAttribute("lang") : null, dir: getComputedStyle(e).direction };
      }),
    );
  }
  const ENGLISH = { lang: "en", dir: "ltr" };

  for (const [what, sel] of [
    ["the actions panel (Page settings is one of its views)", ".fa-tiles"],
    ["the header's three buttons", ".fa-qr-host > button"],
    ["the glass", ".fa-sticky-layer"],
    ["the glass handle (Folio ▾)", ".fa-glass-handle"],
    ["the search band's search", ".fa-search-home"],
    // The rail's own controls (`[data-fa-nav-control]`, e.g. Harnesses) join
    // the row but are named in the PAGE's language, so `navbar-row.js` leaves
    // them unmarked (cat-harness 2565c93fa). Only the row's own icons are English.
    ["each icon in the sidebar's row, so its tooltip and count", ".fa-nav-icons > :not([data-fa-nav-control])"],
    ["the page's TR badge, from a translated copy's markup", '.fa-qa-badge[data-qa-key="page.translation"]'],
    ["an older generator's inert badge, which nothing paints", ".fa-qa-badge.fa-qa-fam-block"],
  ] as const) {
    test(`${what} is marked English and computes ltr`, async ({ page: p }) => {
      const errors = await open(p);
      const got = await langDir(p, sel);
      expect(got.length).toBeGreaterThan(0);
      for (const g of got) expect(g).toEqual(ENGLISH);
      expect(errors).toEqual([]);
    });
  }

  test("an icon's tooltip sits beside the strip, which is on the RIGHT", async ({ page: p }) => {
    // Item 3 of the bean. The tooltip's `left` was the strip's width plus a
    // gap, so on an RTL page — strip docked right — "Beans — 535 open" was
    // drawn at the page's LEFT edge, a viewport's width from its icon.
    await open(p);
    const icon = p.locator(".fa-nav-icons > [data-fa-tip]").first();
    await icon.hover();
    const g = await icon.evaluate((e) => {
      const s = getComputedStyle(e, "::after");
      const r = e.getBoundingClientRect();
      // A fixed box's computed insets are RESOLVED, so `right` is a length
      // even where the rule says `left: auto` — the box's right edge.
      return { right: parseFloat(s.right), iconLeft: r.left, vw: document.documentElement.clientWidth };
    });
    const tipRightEdge = g.vw - g.right;
    // Its right edge is left of the icon's, and close to it — not across the page.
    expect(tipRightEdge).toBeLessThanOrEqual(g.iconLeft + 1);
    expect(g.iconLeft - tipRightEdge).toBeLessThan(400);
  });

  test("Page settings, opened, is English laid out as English", async ({ page: p }) => {
    await open(p);
    // The header's own toggle is hidden once the icon row carries its proxy;
    // the proxy clicks it, so clicking it directly is the same path.
    await p.locator(".fa-tiles-toggle").evaluate((b: HTMLElement) => b.click());
    await p.locator(".fa-tile", { hasText: "Page settings" }).evaluate((b: HTMLElement) => b.click());
    for (const g of await langDir(p, ".fa-tiles-view .fa-a11y-label")) expect(g).toEqual(ENGLISH);
  });

  test("the QA panel the TR badge opens is English", async ({ page: p }) => {
    await open(p);
    await p.locator('.fa-qa-badge[data-qa-key="page.translation"]').click();
    for (const g of await langDir(p, ".fa-qa-panel")) expect(g).toEqual(ENGLISH);
  });

  test("the search leaves the reader's text and the results their own direction", async ({ page: p }) => {
    await open(p);
    await expect(p.locator(".fa-search-home input")).toHaveAttribute("dir", "auto");
    await expect(p.locator(".fa-search-home #search-results")).toHaveAttribute("dir", "auto");
    await p.locator(".fa-search-peek").click();
    await p.locator(".fa-search-home input").fill(AR_START);
    expect(await p.locator(".fa-search-home input").evaluate((e) => getComputedStyle(e).direction)).toBe("rtl");
  });

  test("what is translated, and the rows that mirror, keep the page's direction", async ({ page: p }) => {
    await open(p);
    // The sections of the sidebar ("On this page", "Pages", "Folders",
    // "Harnesses") are the folio rail's since 2026-10-15 and are drawn on the
    // server (cat-harness-tools `lib/navbar.ts`), English-marked there.
    // Rows whose ORDER is layout mirror with the page.
    for (const sel of [".fa-nav-icons", ".fa-glass-band"]) {
      expect(await p.locator(sel).first().evaluate((e) => getComputedStyle(e).direction)).toBe("rtl");
    }
  });
});
