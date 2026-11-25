/**
 * One page per authored term (folio-assistant-core#498, owner 2026-11-01,
 * Q-GLO-2 A): its glossary row is the defining site (Q-GLO-3 C), and the
 * narrative passages that explain or use it are listed as provenance.
 */
import { describe, expect, test } from "bun:test";

import {
  renderAuthoredPage,
  renderLocalePage,
  renderTermPage,
  setProvenance,
  termPagesOf,
  termPermalink,
  translationBadge,
  translationsBlock,
  withGlossaryLocales,
  withTranslations,
  type GlossarySource,
} from "./glossary-page.ts";
import { templateName } from "./glossary-pot.ts";
import type { Passage } from "./term-passages.ts";

const ns = "https://example.org/hb/v0/ns#";
const hb: GlossarySource = {
  instance: "hb",
  ns,
  file: "glossary/hb.glossary.json",
  declaredBy: "hb",
  glossary: {
    $schema: "folio-glossary/v1",
    id: "hb",
    title: "Handbook",
    terms: [
      { id: "component", prefLabel: "Application Component", notation: "AC", status: "authored", definition: "A piece of software.", source: "folio/doc/glossary/t-gloss.md", broader: ["element"], related: ["service"] },
      { id: "element", prefLabel: "Element", status: "authored", definition: "A thing in the model." },
      { id: "service", prefLabel: "Application Service", status: "candidate" },
    ],
  } as GlossarySource["glossary"],
};
const c = { glossaries: [hb] } as never;
const passage = (kind: Passage["kind"], label: string): Passage => ({
  kind,
  document: "doc",
  section: `Section ${label}`,
  label,
  href: `en/doc/index.html#${label}`,
  source: `folio/doc/${label}.md`,
  excerpt: `words around ${label}`,
});

describe("term pages", () => {
  setProvenance(
    new Map([["hb--hb--component", [passage("explains", "p-c1"), passage("mentions", "p-3")]]]),
    new Map([["folio/doc/glossary/t-gloss", "en/doc/index.html#tbl:glossary"]]),
  );
  const page = renderTermPage(c, hb, hb.glossary.terms[0]!);

  test("onePagePerTerm", () => {
    expect(termPermalink(hb, "component")).toMatch(/\/instance\/hb\/hb\/component\/$/);
    expect([...termPagesOf(c).keys()].map((p) => p.split("/").slice(-3, -1).join("/"))).toEqual(["hb/component", "hb/element", "hb/service"]);
    expect(page).toContain(`permalink: ${termPermalink(hb, "component")}`);
    expect(page).toContain("nav_exclude: true");
  });

  test("definingSiteIsRow", () => {
    expect(page).toContain("<h2>Defined in</h2>");
    expect(page).toContain("{{ '/en/doc/index.html#tbl:glossary' | relative_url }}");
    expect(page).toContain("#hb--hb--component' | relative_url }}\">glossary entry</a>");
  });

  test("broaderNarrowerRelatedLink", () => {
    expect(page).toContain("<h2>Broader</h2>");
    expect(page).toContain(`{{ '${termPermalink(hb, "element")}' | relative_url }}`);
    expect(page).toContain("<h2>Related</h2>");
    const element = renderTermPage(c, hb, hb.glossary.terms[1]!);
    expect(element).toContain("<h2>Narrower</h2>");
    expect(element).toContain(`{{ '${termPermalink(hb, "component")}' | relative_url }}`);
  });

  test("passagesAsProvenance", () => {
    expect(page.indexOf("Explained in:")).toBeLessThan(page.indexOf("Used in:"));
    expect(page).toContain("{{ '/en/doc/index.html#p-c1' | relative_url }}");
    expect(page).toContain('"prov:wasDerivedFrom"');
    expect(page).toContain('"dcterms:isReferencedBy"');
    expect(page).toContain(`"@id": "${ns}glossary/hb/component"`);
  });

  test("noPassageSaysSo", () => {
    expect(renderTermPage(c, hb, hb.glossary.terms[2]!)).toContain("No passage of a document in this folio names this term.");
  });

  test("glossaryRowLinksTermPage", () => {
    expect(renderAuthoredPage(c, "@hb")).toContain(`<a href="{{ '${termPermalink(hb, "component")}' | relative_url }}">Term page</a>`);
  });
});

describe("a term's own translations (owner, option C, 2026-11-18)", () => {
  const tr: GlossarySource = {
    ...hb,
    glossary: {
      $schema: "folio-glossary/v1",
      id: "tr",
      title: "Translated",
      terms: [
        {
          id: "policy",
          prefLabel: { en: "Policy", fr: "Politique", ar: "سياسة", es: "Política" },
          definition: { en: "A set of rules.", fr: "Un ensemble de règles." },
          status: "authored",
          translationStatus: { es: "official" },
          translationSource: { fr: { source: "unterm:12345", sourceText: "Policy" }, ar: { source: "unterm:9", sourceText: "Public policy" } },
        },
        { id: "rule", prefLabel: "Rule", definition: "One rule.", status: "authored" },
      ],
    } as GlossarySource["glossary"],
  };
  const tc = { glossaries: [tr] } as never;
  const page = renderTermPage(tc, tr, tr.glossary.terms[0]!);

  test("everyLocaleWithItsStatus", () => {
    const block = translationsBlock(tr, tr.glossary.terms[0]!);
    expect(page).toContain(block);
    expect(block).toContain("<h2>Translations</h2>");
    expect(block).toContain(`<tr data-locale="fr"><th scope="row">fr</th><td lang="fr" dir="auto">Politique</td><td lang="fr" dir="auto">Un ensemble de règles.</td><td>${translationBadge("official")}</td></tr>`);
    expect(block).toContain(`<tr data-locale="ar"><th scope="row">ar</th><td lang="ar" dir="auto">سياسة</td><td><em>untranslated</em></td><td>${translationBadge("candidate")}</td></tr>`);
    expect(block).toContain(`<td lang="es" dir="auto">Política</td><td><em>untranslated</em></td><td>${translationBadge("official")}</td>`);
    // Locales in a stable order, the source never among them.
    expect(["ar", "es", "fr"].map((l) => block.indexOf(`data-locale="${l}"`))).toEqual([...["ar", "es", "fr"].map((l) => block.indexOf(`data-locale="${l}"`))].sort((a, b) => a - b));
    expect(block).not.toContain(`data-locale="en"`);
  });

  test("unofficialIsTheDefault", () => {
    const t = { ...tr.glossary.terms[0]!, translationStatus: undefined, translationSource: undefined };
    expect(translationsBlock(tr, t)).not.toContain("fa-gloss-tstatus-official");
    expect(translationsBlock(tr, t)).toContain(translationBadge("unofficial"));
  });

  test("noTranslationsNoSection", () => {
    expect(translationsBlock(tr, tr.glossary.terms[1]!)).toBe("");
    expect(renderTermPage(tc, tr, tr.glossary.terms[1]!)).not.toContain("<h2>Translations</h2>");
  });

  test("headingIsTheSourceLabel", () => {
    expect(page).toContain("# Policy");
    expect(page).toContain(`title: "Policy"`);
    expect(page).toContain("<p>A set of rules.</p>");
  });

  test("jsonLdCarriesEveryLanguage", () => {
    const ld = JSON.parse(page.split('<script type="application/ld+json">')[1]!.split("</script>")[0]!);
    expect(ld["skos:prefLabel"]).toContainEqual({ "@value": "Politique", "@language": "fr" });
    expect(ld["skos:prefLabel"]).toContainEqual({ "@value": "Policy", "@language": "en" });
    expect(ld["skos:definition"]).toContainEqual({ "@value": "Un ensemble de règles.", "@language": "fr" });
    const rule = JSON.parse(renderTermPage(tc, tr, tr.glossary.terms[1]!).split('<script type="application/ld+json">')[1]!.split("</script>")[0]!);
    expect(rule["skos:prefLabel"]).toEqual([{ "@value": "Rule", "@language": "en" }]);
  });

  test("theLocalePageLeadsWithTheLocalesText", () => {
    const fr = renderLocalePage(tc, "fr", new Map(), ["fr"]);
    const row = fr.split("\n").find((l) => l.includes("Politique"))!;
    expect(row).toBeDefined();
    // The locale's label first, then the source, then its status.
    expect(row.indexOf("Politique")).toBeLessThan(row.indexOf("(Policy)"));
    expect(row).toContain(`<span lang="fr">**Politique**</span> <span lang="en">(Policy)</span> ${translationBadge("official")}`);
    expect(row).toContain("Un ensemble de règles.");
    // A term with no French text of its own falls back to the source, marked.
    expect(fr.split("\n").find((l) => l.includes("**Rule"))).toContain("_(untranslated)_");
  });

  test("theGlossarysOwnTextWinsOverAPo", () => {
    const po = new Map([["fr", new Map([[templateName(tr), new Map([["Policy", "Police"], ["Rule", "Règle"]])]])]]);
    const fr = renderLocalePage(tc, "fr", po.get("fr")!, ["fr"]);
    expect(fr).toContain("**Politique**");
    expect(fr).not.toContain("**Police**");
    expect(fr).toContain("**Règle**");
    const merged = withTranslations(tr, po);
    expect(merged.terms[0]!.prefLabel).toEqual({ en: "Policy", fr: "Politique", ar: "سياسة", es: "Política" });
    expect(merged.terms[1]!.prefLabel).toEqual({ en: "Rule", fr: "Règle" });
  });

  test("aLocaleOnlyTheGlossaryCarriesGetsAPage", () => {
    expect([...withGlossaryLocales(tc, new Map()).keys()]).toEqual(["ar", "es", "fr"]);
    const de = new Map([["de", new Map()]]);
    expect([...withGlossaryLocales(tc, de).keys()]).toEqual(["ar", "de", "es", "fr"]);
  });

  test("termPageInBrowser", async () => {
    // e2e: the section as a browser lays it out and a screen reader reads it.
    let chromium: typeof import("playwright").chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      return; // no browser here; the markup tests above still hold
    }
    const browser = await chromium.launch().catch(() => undefined);
    if (browser === undefined) return;
    try {
      const p = await browser.newPage();
      await p.setContent(`<!doctype html><html lang="en"><body><main>${translationsBlock(tr, tr.glossary.terms[0]!)}</main></body></html>`);
      expect(await p.getByRole("heading", { name: "Translations" }).isVisible()).toBe(true);
      const table = p.getByRole("table");
      expect(await table.getByRole("columnheader").allInnerTexts()).toEqual(["Language", "Label", "Definition", "Status"]);
      const fr = table.getByRole("row", { name: /^fr / });
      expect(await fr.getByRole("cell").first().innerText()).toBe("Politique");
      expect(await fr.locator("td").first().getAttribute("lang")).toBe("fr");
      expect(await fr.locator(".fa-gloss-tstatus").innerText()).toBe("official");
      expect(await table.getByRole("row", { name: /^ar / }).locator(".fa-gloss-tstatus").innerText()).toBe("candidate");
      // Arabic is laid out right to left by its own script (`dir="auto"`), inside its cell.
      const ar = table.getByRole("row", { name: /^ar / }).locator("td").first();
      expect(await ar.evaluate((el) => getComputedStyle(el).direction)).toBe("rtl");
      expect(await fr.locator("td").first().evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
      expect(await ar.innerText()).toBe("سياسة");
      expect(await p.locator("[lang]").evaluateAll((els) => els.map((e) => e.getAttribute("lang")))).toEqual(["en", "ar", "es", "fr", "fr"]);
    } finally {
      await browser.close();
    }
  }, 30_000);
});
