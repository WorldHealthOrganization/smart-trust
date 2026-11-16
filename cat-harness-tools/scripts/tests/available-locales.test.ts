/**
 * `9x01` box 63 and 66 — a page may not claim a language a reader cannot read
 * it in, and the gate that says so must be able to fail.
 *
 * The corpus tests are the ones that would have caught the defect. The unit
 * tests are the ones that would have caught the two ways I got the *check*
 * wrong before it went green: resolving a translated page by its own key, and
 * treating an unreadable index as an empty one.
 *
 * ## Why the corpus assertion is safe to read from the working tree
 *
 * `generated-banner-commands.test.ts` had to read `HEAD` instead of the disk,
 * because `bun test` runs files in parallel and this repository has tests that
 * spawn generators in their WRITING form — the `ymsu` signature, where a test
 * passes alone and fails in the suite. That hazard does not apply here, and the
 * reason is worth stating rather than assumed: the property under test is
 * invariant under regeneration. `gen-docs-pages.ts` now computes
 * `available_locales` from the translation index, so a page rewritten
 * mid-suite is rewritten with a CORRECT claim. A concurrent generator can
 * change the file and cannot change the verdict.
 */
import { describe, expect, test } from "bun:test";

import type { TranslationIndex } from "../../pipeline/translation-index.ts";

import {
  availableLocaleClaims,
  backedLocales,
  sourceKeyByTranslation,
} from "../check-available-locales.ts";

/** A minimal index: one source page with two translations, one with none. */
function index(): TranslationIndex {
  const page = (url: string) => ({ url, title: "t", status: "", dir: "ltr" as const });
  return {
    $schema: "folio-translation-index/v1",
    sourceLocale: "en",
    locales: ["fr", "zh"],
    pages: {
      architecture: {
        sourceUrl: "/architecture.html",
        sourceTitle: "Architecture",
        translations: { fr: page("/fr/architecture.html"), zh: page("/zh/architecture.html") },
      },
      "guides/who-smart-ig": {
        sourceUrl: "/guides/who-smart-ig.html",
        sourceTitle: "WHO SMART IG",
        translations: {},
      },
    },
  };
}

describe("the real corpus", () => {
  const report = availableLocaleClaims();

  test("the index was READABLE — a clean verdict over an unreadable one is not clean", () => {
    // `dh4f`. Checked first and separately, because every assertion below is
    // computed from this index and all of them hold vacuously if it is empty.
    expect(report.unreadable).toEqual([]);
  });

  test("pages actually declare the field — otherwise this file asserts nothing", () => {
    // `6tkl`. The first two versions of my own scanner reported a clean sweep
    // over ZERO pages: once because `translation-index` is rooted at the
    // layer rather than the repo, once because `SITE_DIR` is the site
    // directory's NAME and my pathspec matched nothing.
    expect(report.declaring).toBeGreaterThan(0);
  });

  test("translations are among them — otherwise the index inversion is untested", () => {
    // The load-bearing anti-vacuity assertion. A translated page resolves
    // through its SOURCE key; looking it up by its own key finds no entry and
    // reports every locale it claims as unbacked. That bug fails 70 pages at
    // once and is invisible if the sweep only ever sees source pages.
    expect(report.translations).toBeGreaterThan(0);
    expect(report.sourcePages).toBeGreaterThan(0);
  });

  test("no page claims a locale it has no rendered page for", () => {
    expect(report.findings.map((f) => `${f.file} claims ${f.unbacked.join(",")}`)).toEqual([]);
  });
});

describe("backedLocales — what a claim may legitimately name", () => {
  test("the source language, always, with no entry needed", () => {
    // A page with no translations still exists in the language it was written
    // in. If this were driven by the index alone, every untranslated page in
    // the corpus would fail for claiming its own language.
    expect([...backedLocales(index(), "en", "guides/who-smart-ig")]).toEqual(["en"]);
  });

  test("plus every locale with a rendered translation", () => {
    expect([...backedLocales(index(), "en", "architecture")].sort()).toEqual(["en", "fr", "zh"]);
  });

  test("and NOT a locale the index has no translation for", () => {
    // The discriminating assertion. Without it, a `backedLocales` that returned
    // every supported locale would pass every test above while asserting
    // nothing at all — and that is the shape the bug took, since the claim
    // being checked is usually the full supported set.
    expect(backedLocales(index(), "en", "architecture").has("ru")).toBe(false);
    expect(backedLocales(index(), "en", "guides/who-smart-ig").has("fr")).toBe(false);
  });

  test("an unknown key yields the source language alone, rather than throwing", () => {
    // A page absent from the index is a page with no translations, which is the
    // common case — 560 of them. Throwing here would make the gate unusable.
    expect([...backedLocales(index(), "en", "no-such-page")]).toEqual(["en"]);
  });
});

describe("sourceKeyByTranslation — the inversion", () => {
  const bySource = sourceKeyByTranslation(index());

  test("a translated page's key maps to the page it translates", () => {
    expect(bySource.get("fr/architecture")).toBe("architecture");
    expect(bySource.get("zh/architecture")).toBe("architecture");
  });

  test("a SOURCE page is absent from it, which is how the two roles are told apart", () => {
    // `undefined` is the signal for "this is a source page", so a source page
    // appearing here would silently reclassify it.
    expect(bySource.has("architecture")).toBe(false);
    expect(bySource.has("guides/who-smart-ig")).toBe(false);
  });

  test("keys are NORMALISED, not raw URLs", () => {
    // `pageKey` strips the extension and leading slash, because Jekyll serves
    // one page at several spellings under a `baseurl` this code does not know.
    // Matching on `/fr/architecture.html` would work here and break on any
    // layer with a baseurl.
    expect(bySource.has("/fr/architecture.html")).toBe(false);
  });
});
