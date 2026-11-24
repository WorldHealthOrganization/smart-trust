/**
 * Acronyms in prose (owner, 2026-10-31): which tokens are acronyms, which
 * expansions a document gives, and which a glossary already holds.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { abbreviationTable, findAcronyms, inlineExpansions, isAcronym, isCode, lowerWords, missingAcronyms, singular, visibleLabels } from "./acronyms.ts";
import { checkAcronymInGlossary } from "../pipeline/qa-checkers-acronyms.ts";

describe("isAcronym", () => {
  test("capitalsDigitsMixedAreAcronyms", () => {
    for (const t of ["WHO", "GS1", "HL7", "eLMIS", "OpenHIE", "WHODrug", "ICD-11", "DH&I", "GHSC-PSM"]) expect(isAcronym(t)).toBe(true);
  });
  test("wordsNumeralsHeadingsNotAcronyms", () => {
    for (const t of ["Health", "McDonald", "II", "XIV", "A", "INTRODUCTION", "iPhone"]) expect(isAcronym(t)).toBe(false);
  });
});

describe("codes, plurals and words in capitals", () => {
  test("folioIdsAreCodes", () => {
    for (const t of ["PC-R-05", "PC-BP-01", "MFR001"]) expect(isCode(t)).toBe(true);
    for (const t of ["ICD-11", "ITU-T", "GS1"]) expect(isCode(t)).toBe(false);
  });
  test("pluralCountedUnderSingular", () => {
    expect(singular("GTINs")).toBe("GTIN");
    expect(singular("FAQs")).toBe("FAQ");
    expect(singular("eLMIS")).toBe("eLMIS");
  });
  test("capitalsWordDroppedWhoKept", () => {
    const md = "RESOURCES and STEPS for RWANDA. The resources, the steps, Rwanda. Who said it? WHO did, OF course.";
    expect(findAcronyms(md).map((h) => h.acronym)).toEqual(["WHO"]);
    expect(lowerWords(md).has("rwanda")).toBe(true);
  });
});

describe("findAcronyms", () => {
  test("readsProseOnlyWithLines", () => {
    const md = "The WHO and GS1 standards.\n`FHIR` in code and [a link](https://x.org/HL7) are skipped.\nUNICEF too.";
    expect(findAcronyms(md)).toEqual([
      { acronym: "WHO", line: 1 },
      { acronym: "GS1", line: 1 },
      { acronym: "UNICEF", line: 3 },
    ]);
  });
});

describe("expansions", () => {
  test("longNameExpansionShortestRun", () => {
    const m = inlineExpansions("Funded by the United States Agency for International Development (USAID) and the World Health Organization (WHO).");
    expect(m.get("USAID")).toBe("United States Agency for International Development");
    expect(m.get("WHO")).toBe("World Health Organization");
  });
  test("abbreviationTableReadAsWritten", () => {
    const m = abbreviationTable("*Abbreviations*\n\n| Abbreviation | Definition |\n| --- | --- |\n| FDA | Food and Drugs Authority |\n| HL7 | Health Level Seven® |\n\n| Other | x |\n| --- | --- |\n| NO | no |");
    expect([...m]).toEqual([["FDA", "Food and Drugs Authority"], ["HL7", "Health Level Seven®"]]);
  });
});

describe("the acronym-in-glossary checker", () => {
  const root = mkdtempSync(join(tmpdir(), "acr-"));
  mkdirSync(join(root, "glossary"));
  mkdirSync(join(root, "mounted", "glossary"), { recursive: true });
  mkdirSync(join(root, "folio", "ch1"), { recursive: true });
  const g = (id: string, terms: unknown[]) => JSON.stringify({ $schema: "folio-glossary/v1", id, title: id, terms });
  writeFileSync(join(root, "glossary", "here.glossary.json"), g("here", [{ id: "who", prefLabel: "World Health Organization", notation: "WHO", status: "candidate" }]));
  writeFileSync(join(root, "mounted", "glossary", "there.glossary.json"), g("there", [{ id: "hl7", prefLabel: "Health Level Seven", altLabel: ["HL7"], status: "candidate" }]));
  const md = join(root, "folio", "ch1", "p.md");
  writeFileSync(md, "WHO and HL7 work with GS1.\nGS1 again, and UNICEF.\n");

  test("mountedGlossaryCounts", () => {
    const labels = visibleLabels(md);
    expect(labels.has("WHO")).toBe(true);
    expect(labels.has("HL7")).toBe(true);
    expect(missingAcronyms(findAcronyms("WHO HL7 GS1 GS1"), labels).map((h) => h.acronym)).toEqual(["GS1"]);
  });

  test("warnsOncePerAcronym", () => {
    const r = checkAcronymInGlossary({ md });
    expect(r.result).toBe("warn");
    expect(r.hits.map((h) => [h.line, h.text.split(" ")[0]])).toEqual([[1, "GS1"], [2, "UNICEF"]]);
  });

  test("naWithoutProse", () => {
    expect(checkAcronymInGlossary({}).result).toBe("n/a");
    rmSync(root, { recursive: true, force: true });
  });
});
