import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { candidates, merge, readRows, rowsOf, sectionKind, sectionsUnder, splitAcronym, termId, termSection } from "./glossary-from-source.ts";

const terms = `| Term | Definition |
| --- | --- |
| Care pathway | A complex intervention.<br>With parts. |
| Digital adaptation kits (DAKs) | Software-neutral documentation. |
**Minimum viable product**: A product with the least features.
Deploy – Make the software available.`;
const abbrev = `---
section_title: "Abbreviations"
---
| Abbreviation | Definition |
| --- | --- |
| MVP | minimum viable product |
| ANC | antenatal care |`;

describe("glossary-from-source (folio-assistant-core#498)", () => {
  test("readsRowsWithLines", () => {
    expect(readRows(terms).map((r) => [r.head, r.line])).toEqual([
      ["Care pathway", 3],
      ["Digital adaptation kits (DAKs)", 4],
      ["Minimum viable product", 5],
      ["Deploy", 6],
    ]);
    expect(readRows(terms)[0]!.body).toBe("A complex intervention.\nWith parts.");
  });

  test("sectionKindFromTitle", () => {
    expect(sectionKind(abbrev)).toBe("abbreviations");
    expect(sectionKind("## Glossary\n")).toBe("terms");
    expect(sectionKind("## Introduction\n")).toBeUndefined();
  });

  test("bracketedAcronymNotation", () => {
    expect(splitAcronym("Digital adaptation kits (DAKs)")).toEqual({ label: "Digital adaptation kits", acronym: "DAK" });
    expect(splitAcronym("Care (general)")).toEqual({ label: "Care (general)" });
    expect(termId("Person-centred point of service")).toBe("person-centred-point-of-service");
  });

  test("acronymsFoldIntoTerms", () => {
    const t = candidates([
      { path: "g.md", kind: "terms", md: terms },
      { path: "a.md", kind: "abbreviations", md: abbrev },
    ]);
    expect(t.find((x) => x.id === "minimum-viable-product")!.notation).toBe("MVP");
    expect(t.find((x) => x.id === "digital-adaptation-kits")!.notation).toBe("DAK");
    const anc = t.find((x) => x.id === "antenatal-care")!;
    expect([anc.notation, anc.definition, anc.status, anc.source]).toEqual(["ANC", undefined, "candidate", "a.md#L7"]);
    expect(t.every((x) => x.status === "candidate")).toBe(true);
  });

  test("headingTermOneRow", () => {
    const md = `---\nsection_title: "2.1.1. Actor"\n---\n### 2.1.1. Actor\n\n<a id="x"></a>\n\nA human or [tool](#t) in the system.\n\n> NOTE`;
    const row = readRows(termSection(md)!)[0]!;
    expect([row.head, row.body, row.line]).toEqual(["Actor", "A human or tool in the system.", 8]);
  });

  test("mergeKeepsPersonOwned", () => {
    const found = candidates([{ path: "g.md", kind: "terms", md: terms }]);
    const first = merge(undefined, found, { id: "s", title: "S" });
    const edited = {
      ...first,
      terms: first.terms.map((t) => (t.id === "deploy" ? { ...t, status: "authored" as const, definition: "Ship it.", scopeNote: "Adopted." } : t)),
    };
    const again = merge(edited, found, { id: "s", title: "S" });
    expect(again.terms.find((t) => t.id === "deploy")!.definition).toBe("Ship it.");
    expect(again.terms.length).toBe(first.terms.length);
    expect(merge(first, found, { id: "s", title: "S" })).toEqual(first);
  });
});

// An L1 section as a PDF prints a glossary: term on its own line(s), definition below (9789240116191-eng).
const l1 = (title: string, body: string) => `---\ndoc_id: d\nsection_id: sec-002\nsection_title: "${title}"\nsource_pdf: d.pdf\n---\n${body}`;
const stackedGlossary = l1("Glossary", [
  "Glossary",
  "Data element",
  "A unit of data that has a specific and precise meaning.",
  "Digitization",
  "The process of converting and organizing data from paper records into a digital format for easier ",
  "entry, storage and retrieval. Digitization is the initial step towards digital transformation.1, 2",
  "Generic product ",
  "or product information",
  "In this handbook, the terms 'generic product' or 'product information' pertain to the general details.",
].join("\n"));
const stackedAbbrev = l1("Abbreviations and acronyms", ["AEFI", "Adverse effects following immunisation", "DH&I WG", "Digital Health and Interoperability Working Group", "eLMIS", "Electronic logistic management information system"].join("\n"));

describe("glossaries as a PDF prints them (re-ingest pilot, 2026-11-14)", () => {
  test("stackedTermsRead", () => {
    const rows = rowsOf(stackedGlossary, "terms");
    expect(rows.map((r) => r.head)).toEqual(["Data element", "Digitization", "Generic product or product information"]);
    expect(rows[1]!.body).toBe("The process of converting and organizing data from paper records into a digital format for easier entry, storage and retrieval. Digitization is the initial step towards digital transformation.");
    expect(rows[0]!.line).toBe(8);
  });

  test("stackedAcronymsFoldIntoTerms", () => {
    const rows = rowsOf(stackedAbbrev, "abbreviations");
    expect(rows.map((r) => [r.head, r.body])).toEqual([
      ["AEFI", "Adverse effects following immunisation"],
      ["DH&I WG", "Digital Health and Interoperability Working Group"],
      ["eLMIS", "Electronic logistic management information system"],
    ]);
  });

  test("titleWordsOpenTheTitle", () => {
    expect(sectionKind(l1("Step 2. Define coding scheme, data definitions and structures", ""))).toBeUndefined();
    expect(sectionKind(l1("II.\u0003Definition of key terms", ""))).toBe("terms");
    expect(sectionKind(l1("Annex G. Definition of terms used in the Toolkit", ""))).toBe("terms");
    expect(sectionKind(l1("Annex 5. Standardized definitions used in this guide", ""))).toBe("terms");
    expect(sectionKind(l1("List of abbreviations", ""))).toBe("abbreviations");
    expect(sectionKind(l1("Defining the DHSC architecture", ""))).toBeUndefined();
  });

  test("titledSectionWithNoRowIsAnInput", () => {
    // The arm then reports partial ("found but no term read"), never "none in the source".
    const dir = join(mkdtempSync(join(tmpdir(), "glo-")), "sections");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "sec-002-glossary.md"), l1("Glossary", "A paragraph of prose with no term layout in it at all, ending here."));
    writeFileSync(join(dir, "sec-003-intro.md"), l1("Introduction", "Prose."));
    const inputs = sectionsUnder(dir, dir);
    expect(inputs.map((i) => [i.path, i.kind])).toEqual([["sec-002-glossary.md", "terms"]]);
    expect(candidates(inputs)).toEqual([]);
  });
});
