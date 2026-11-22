/**
 * Glossary translations held in the glossary itself (owner, option C,
 * 2026-11-18): language-tagged labels and definitions, unofficial unless
 * signed off, and an UNTERM record of exactly the source text read as official.
 */
import { describe, expect, test } from "bun:test";

import jsonld from "jsonld";

import {
  GlossarySchema,
  SKOSXL_NS,
  sourceLanguageOf,
  sourceTextOf,
  textIn,
  toSkos,
  translatedLocales,
  translationStateOf,
  translationStatusIri,
  type Glossary,
} from "./glossary.ts";
import { CORE_NAMESPACE } from "./own-namespace.ts";

const NS = "https://example.org/hb/v0/ns/";
const SKOS = "http://www.w3.org/2004/02/skos/core#";

const glossary = (over: Record<string, unknown> = {}, terms?: unknown[]): Glossary =>
  GlossarySchema.parse({
    $schema: "folio-glossary/v1",
    id: "hb",
    title: "Handbook",
    terms: terms ?? [
      {
        id: "policy",
        prefLabel: { en: "Policy", fr: "Politique", es: "Política", ar: "سياسة" },
        altLabel: ["Rulebook"],
        definition: { en: "A set of rules.", fr: "Un ensemble de règles." },
        status: "authored",
        translationStatus: { es: "official" },
        translationSource: {
          fr: { source: "unterm:12345", sourceText: "Policy" },
          ar: { source: "unterm:999", sourceText: "Public policy" },
        },
      },
      { id: "rule", prefLabel: "Rule", definition: "One rule.", status: "authored" },
    ],
    ...over,
  });

describe("the schema", () => {
  test("acceptsSourceLanguageAndTranslationSource", () => {
    const g = glossary({ sourceLanguage: "fr" });
    expect(sourceLanguageOf(g)).toBe("fr");
    expect(sourceLanguageOf(glossary())).toBe("en");
    expect(g.terms[0]!.translationSource?.fr?.source).toBe("unterm:12345");
  });

  test("refusesABadLocaleOrAnEmptySource", () => {
    const bad = (ts: unknown) =>
      GlossarySchema.safeParse({ $schema: "folio-glossary/v1", id: "g", title: "G", terms: [{ id: "a", prefLabel: "A", status: "candidate", translationSource: ts }] }).success;
    expect(bad({ fr: { source: "unterm:1" } })).toBe(true);
    expect(bad({ French: { source: "unterm:1" } })).toBe(false);
    expect(bad({ fr: { source: "" } })).toBe(false);
    expect(bad({ fr: { source: "unterm:1", extra: 1 } })).toBe(false);
    expect(GlossarySchema.safeParse({ $schema: "folio-glossary/v1", id: "g", title: "G", sourceLanguage: "English", terms: [] }).success).toBe(false);
  });
});

describe("text in a language", () => {
  test("plainStringIsTheSourceLanguage", () => {
    expect(textIn("Rule", "en")).toBe("Rule");
    expect(textIn("Rule", "fr")).toBeUndefined();
    expect(textIn("Règle", "fr", "fr")).toBe("Règle");
    expect(textIn({ en: "Policy", fr: "Politique" }, "fr")).toBe("Politique");
    expect(textIn(undefined, "fr")).toBeUndefined();
  });

  test("sourceTextIsTheDeclaredLanguageElseTheFirst", () => {
    expect(sourceTextOf({ fr: "Politique", en: "Policy" })).toBe("Policy");
    expect(sourceTextOf({ en: "Policy", fr: "Politique" }, "fr")).toBe("Politique");
    expect(sourceTextOf({ fr: "Politique" })).toBe("Politique");
  });

  test("translatedLocalesExcludeTheSource", () => {
    const t = glossary().terms[0]!;
    expect(translatedLocales(t)).toEqual(["ar", "es", "fr"]);
    expect(translatedLocales(glossary().terms[1]!)).toEqual([]);
  });
});

describe("what a reader is told about each locale", () => {
  const t = glossary().terms[0]!;
  test("signedOffIsOfficial", () => {
    expect(translationStateOf(t, "es")).toBe("official");
  });
  test("untermExactSourceTextIsOfficial", () => {
    // An official candidate: the UN's record of exactly this term.
    expect(translationStateOf(t, "fr")).toBe("official");
  });
  test("untermOtherSourceTextIsCandidate", () => {
    expect(translationStateOf(t, "ar")).toBe("candidate");
  });
  test("untermWithoutSourceTextIsCandidate", () => {
    expect(translationStateOf({ ...t, translationSource: { fr: { source: "unterm:1" } } }, "fr")).toBe("candidate");
  });
  test("exactMeansExact", () => {
    // Case and spacing are part of the text a record translates.
    expect(translationStateOf({ ...t, translationSource: { fr: { source: "unterm:1", sourceText: "policy" } } }, "fr")).toBe("candidate");
  });
  test("anyOtherSourceIsUnofficial", () => {
    expect(translationStateOf({ ...t, translationSource: { fr: { source: "https://example.org/glossary" } } }, "fr")).toBe("unofficial");
    expect(translationStateOf(glossary().terms[1]!, "fr")).toBe("unofficial");
  });
  test("theSourceLanguageDecidesTheMatch", () => {
    const fr = { prefLabel: { fr: "Politique", en: "Policy" }, translationSource: { en: { source: "unterm:1", sourceText: "Politique" } } };
    expect(translationStateOf(fr, "en", "fr")).toBe("official");
    expect(translationStateOf(fr, "en", "en")).toBe("candidate");
  });
});

describe("the SKOS export", () => {
  const doc = toSkos(glossary(), NS) as { "@context": Record<string, string>; "@graph": Array<Record<string, unknown>> };
  const node = (id: string) => doc["@graph"].find((n) => n["@id"] === id)!;
  const policy = `${NS}glossary/hb/policy`;

  test("everyLabelAndDefinitionIsLanguageTagged", () => {
    expect(node(policy)["skos:prefLabel"]).toContainEqual({ "@value": "Politique", "@language": "fr" });
    expect(node(policy)["skos:definition"]).toContainEqual({ "@value": "A set of rules.", "@language": "en" });
    expect(node(policy)["skos:altLabel"]).toEqual([{ "@value": "Rulebook", "@language": "en" }]);
    // A plain string is in the source language, and says so.
    expect(node(`${NS}glossary/hb/rule`)["skos:prefLabel"]).toEqual([{ "@value": "Rule", "@language": "en" }]);
    const fr = toSkos(glossary({ sourceLanguage: "fr" }), NS) as typeof doc;
    expect(fr["@graph"].find((n) => n["@id"] === `${NS}glossary/hb/rule`)!["skos:prefLabel"]).toEqual([{ "@value": "Rule", "@language": "fr" }]);
  });

  test("eachTranslatedLabelIsASkosXlLabelWithItsStatus", () => {
    expect(node(policy)["skosxl:prefLabel"]).toEqual([{ "@id": `${policy}#label-ar` }, { "@id": `${policy}#label-es` }, { "@id": `${policy}#label-fr` }]);
    expect(node(`${policy}#label-fr`)).toEqual({
      "@id": `${policy}#label-fr`,
      "@type": "skosxl:Label",
      "skosxl:literalForm": { "@value": "Politique", "@language": "fr" },
      "fa:translationStatus": "official",
      "dcterms:source": "unterm:12345",
    });
    expect(node(`${policy}#label-ar`)["fa:translationStatus"]).toBe("candidate");
    expect(node(`${policy}#label-es`)["fa:translationStatus"]).toBe("official");
    expect(doc["@context"]["skosxl"]).toBe(SKOSXL_NS);
    expect(doc["@context"]["fa"]).toBe(CORE_NAMESPACE);
  });

  test("noTranslationsNoSkosXl", () => {
    const plain = toSkos(glossary({}, [{ id: "rule", prefLabel: "Rule", definition: "One rule.", status: "authored" }]), NS) as typeof doc;
    expect(plain["@context"]["skosxl"]).toBeUndefined();
    expect(plain["@graph"].some((n) => n["@type"] === "skosxl:Label")).toBe(false);
  });

  test("readThroughJsonldAsLanguageTaggedTriples", async () => {
    const quads = (await jsonld.toRDF(doc as never, { format: undefined } as never)) as unknown as Array<{
      subject: { value: string };
      predicate: { value: string };
      object: { value: string; language?: string; termType: string };
    }>;
    const of = (s: string, p: string) => quads.filter((q) => q.subject.value === s && q.predicate.value === p).map((q) => q.object);
    expect(of(policy, `${SKOS}prefLabel`).map((o) => `${o.value}@${o.language}`).sort()).toEqual(["Policy@en", "Politique@fr", "Política@es", "سياسة@ar"].sort());
    expect(of(policy, `${SKOS}altLabel`).map((o) => `${o.value}@${o.language}`)).toEqual(["Rulebook@en"]);
    expect(of(`${policy}#label-fr`, translationStatusIri(CORE_NAMESPACE)).map((o) => o.value)).toEqual(["official"]);
    expect(of(`${policy}#label-fr`, `${SKOSXL_NS}literalForm`).map((o) => `${o.value}@${o.language}`)).toEqual(["Politique@fr"]);
    expect(of(policy, `${SKOSXL_NS}prefLabel`).map((o) => o.termType)).toEqual(["NamedNode", "NamedNode", "NamedNode"]);
  });
});
