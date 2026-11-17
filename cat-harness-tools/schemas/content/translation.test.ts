/**
 * TranslationNodeSchema's locale: a BCP 47 tag, region and script subtags
 * included, said consistently in the label, the node and its status.
 *
 * The owner, 2026-11-14: region-tagged locales (`pt-BR`, `zh-Hans`) are
 * supported. The label had taken only `^trans:[a-z]{2,}\/`.
 */

import { describe, expect, test } from "bun:test";

import { TRANSLATION_LABEL, TranslationNodeSchema, localeIsRtl } from "./translation.ts";

const node = (locale: string, over: Record<string, unknown> = {}) => ({
  label: `trans:${locale}/start/a`,
  locale,
  sourceFile: "start/a.md",
  poFile: `translations/${locale}/start/a.po`,
  status: { locale, official: false, generatedBy: "agent" },
  ...over,
});

describe("a translation node's locale is a BCP 47 tag", () => {
  for (const locale of ["fr", "zh", "ar", "pt-BR", "zh-Hans", "zh-Hant-TW", "es-419", "sr-Latn", "fil"]) {
    test(`accepts ${locale}`, () => {
      expect(TranslationNodeSchema.safeParse(node(locale)).success).toBe(true);
      expect(TRANSLATION_LABEL.exec(`trans:${locale}/x`)?.[1]).toBe(locale);
    });
  }

  for (const locale of ["f", "FR", "pt_BR", "pt-", "pt-B", "fr-toolongsubtag", "1a"]) {
    test(`refuses ${JSON.stringify(locale)}`, () => {
      expect(TranslationNodeSchema.safeParse(node(locale)).success).toBe(false);
    });
  }

  test("refuses a label without the trans: prefix or the slash", () => {
    expect(TranslationNodeSchema.safeParse(node("fr", { label: "fr/start/a" })).success).toBe(false);
    expect(TranslationNodeSchema.safeParse(node("pt-BR", { label: "trans:pt-BR" })).success).toBe(false);
  });
});

describe("the locale is the same in the label, the node and its status", () => {
  test("a label naming another locale is refused, on the label", () => {
    const r = TranslationNodeSchema.safeParse(node("pt-BR", { label: "trans:pt/start/a" }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["label"]);
  });

  test("a status naming another locale is refused, on status.locale", () => {
    const r = TranslationNodeSchema.safeParse(node("zh-Hans", { status: { locale: "zh", official: false } }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["status.locale"]);
  });
});

describe("localeIsRtl reads a region-tagged locale by its primary subtag", () => {
  test("ar, ar-EG and fa-IR are right-to-left; fr, pt-BR and zh-Hans are not", () => {
    expect(["ar", "ar-EG", "fa-IR"].map(localeIsRtl)).toEqual([true, true, true]);
    expect(["fr", "pt-BR", "zh-Hans"].map(localeIsRtl)).toEqual([false, false, false]);
  });
});
