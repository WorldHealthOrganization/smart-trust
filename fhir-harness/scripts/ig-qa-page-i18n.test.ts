import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HARNESS_TRANSLATIONS, QA_PAGE_STRINGS, qaPageCatalogue, qaScriptLabels, qaStrings, readQaCatalogue } from "./ig-qa-page-i18n.ts";
import { buildQaPage, renderQaPage } from "./ig-qa-page.ts";

const LOCALES = ["ar", "es", "fr", "ru", "zh"];
const KEYS = Object.keys(QA_PAGE_STRINGS);

function dirWith(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "qa-i18n-"));
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(d, f, ".."), { recursive: true });
    writeFileSync(join(d, f), body);
  }
  return d;
}

const MESSAGES = {
  $schema: "ig-qa-messages/v1",
  groups: [{ file: "a.json", messages: [{ severity: "warning", text: "Reference to experimental CodeSystem http://x/CS", messageId: "MSG_EXPERIMENTAL" }] }],
};

describe("ig-qa-page-i18n", () => {
  test("everyLocaleTranslatesEveryStringOfThePage", () => {
    for (const l of LOCALES) {
      const c = readQaCatalogue(HARNESS_TRANSLATIONS, l);
      expect({ locale: l, refused: c.refused }).toEqual({ locale: l, refused: [] });
      expect(KEYS.filter((k) => !c.strings.has(k as never))).toEqual([]);
    }
  });

  test("aStaleOrBrokenEntryShowsTheEnglish", () => {
    const d = mkdtempSync(join(tmpdir(), "qa-po-"));
    mkdirSync(join(d, "fr", "generated-pages"), { recursive: true });
    writeFileSync(
      qaPageCatalogue(d, "fr"),
      [
        'msgctxt "fhirQa"\nmsgid "FHIR QA (old)"\nmsgstr "AQ FHIR"',
        'msgctxt "validity"\nmsgid "**Validity for this checkout:** {verdict}."\nmsgstr "**Validité :** inconnue."',
        'msgctxt "kgQa"\nmsgid "Knowledge-graph QA"\nmsgstr "AQ du graphe"',
      ].join("\n\n"),
    );
    const c = readQaCatalogue(d, "fr");
    expect(c.refused.map((r) => r.key).sort()).toEqual(["fhirQa", "validity"]);
    const t = qaStrings("fr", d);
    expect(t("fhirQa")).toBe("FHIR QA");
    expect(t("validity", { verdict: "`valid`" })).toBe("**Validity for this checkout:** `valid`.");
    expect(t("kgQa")).toBe("AQ du graphe");
    // The script gets its words unfilled: it fills them itself.
    expect(qaScriptLabels("fr").jsResultsFor).toBe("Résultats de validation pour {title}");
  });

  test("aTranslatedPageSaysWhatStaysEnglishAndPointsAtItsOwnMessages", () => {
    const ast = dirWith({ "qa.json": JSON.stringify({ errs: 0, warnings: 1, hints: 0 }), "qa-messages.json": JSON.stringify(MESSAGES) });
    const fhir = { publisher: { errs: 0 }, messages: MESSAGES as never };
    const fr = renderQaPage({ title: qaStrings("fr")("title"), fhir, kg: { view: "en/h/qa/", instances: [] }, up: "../", locale: "fr", translated: true });
    expect(fr).toContain("# Rapport d’assurance qualité");
    expect(fr).toContain("## Assurance qualité FHIR");
    expect(fr).toContain('data-messages="../assets/fhir-qa/qa-messages.fr.json"');
    expect(fr).toContain("Afficher l’anglais");
    expect(fr).toContain("../assets/fhir-qa/i18n-usage.json");
    // The KG half is cat-harness-tools' English: marked as English, and said so.
    expect(fr).toContain('<div lang="en" dir="ltr" markdown="1">');
    expect(fr).toContain("Cette partie du rapport n’existe qu’en anglais.");
    const en = renderQaPage({ title: "QA Report", fhir, kg: { view: "en/h/qa/", instances: [] } });
    expect(en).toContain('data-messages="assets/fhir-qa/qa-messages.json"');
    expect(en).not.toContain('lang="en" dir="ltr"');
    expect(ast).toBeTruthy();
  });

  test("buildsThePageInEachLocaleFromCachedPublisherBundles", () => {
    const ast = dirWith({
      "qa.json": JSON.stringify({ errs: 0, warnings: 1, hints: 0 }),
      "qa-messages.json": JSON.stringify(MESSAGES),
      "manifest.json": JSON.stringify({ toolchain: { core: "9.9.9" } }),
    });
    const cache = dirWith({ "9.9.9/Messages.properties": "MSG_EXPERIMENTAL = Reference to experimental {2} {0}", "9.9.9/Messages_ru.properties": "MSG_EXPERIMENTAL = Ссылка {2} {0}" });
    const r = buildQaPage({ root: ast, ast, i18n: { locales: ["ru", "zh"], cache } });
    expect(Object.keys(r.pages).sort()).toEqual(["en", "ru", "zh"]);
    expect(r.localised.get("ru")!.counts).toEqual({ publisher: 1, machine: 0, source: 0 });
    // zh: the Publisher has none; this layer's catalogue fills it.
    expect(r.localised.get("zh")!.counts).toEqual({ publisher: 0, machine: 1, source: 0 });
    expect(r.i18n).toContain("Publisher bundles of core 9.9.9");
    // A build without the AST's core version says why, and still writes the pages.
    const noCore = buildQaPage({ root: ast, ast: dirWith({ "qa.json": "{}", "qa-messages.json": JSON.stringify(MESSAGES) }), i18n: { locales: ["fr"], cache } });
    expect(noCore.i18n).toContain("no Publisher bundles (the AST records no core version)");
    expect(noCore.localised.get("fr")!.counts.machine).toBe(1);
  });
});
