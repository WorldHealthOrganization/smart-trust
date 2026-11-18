import { describe, expect, test } from "bun:test";

import { annexRecordsOf, codeSystemsIn, dictionaryReferences, judgeWebAnnexOf, sectionRefs, judgeAnnexRecords, judgeDictionary, judgeDictionaryReferences, judgeFile, judgeSwimlanes } from "./check-web-annexes.ts";

const sheet = (rows: string[][]) => ({ name: "S", columns: [{ key: "data element id", label: "ID" }, { key: "label", label: "Label" }], rows });
const dict = (sheets: ReturnType<typeof sheet>[]) => ({
  $schema: "dak-data-dictionary/v1" as const,
  annexOf: "10665/380303",
  label: "Web Annex A",
  section: "dak#core-data-elements",
  title: "t",
  source: { label: "x.xlsx", sha256: "0".repeat(64) },
  idColumn: "data element id",
  sheets,
});

describe("the data dictionary is judged, not only typed", () => {
  test("consistentDictionaryNoFinding", () => {
    expect(judgeDictionary(dict([sheet([["A.1", "a"], ["A.2", "b"]])]))).toEqual([]);
  });
  test("idUsedTwiceIsFinding", () => {
    expect(judgeDictionary(dict([sheet([["A.1", "a"]]), sheet([["A.1", "b"]])])).join()).toContain('"A.1" is used twice');
  });
  test("emptyIdAndShortRowAreFindings", () => {
    const f = judgeDictionary(dict([sheet([["", "a"], ["A.2"]])]));
    expect(f.some((x) => x.includes("has no data element id"))).toBe(true);
    expect(f.some((x) => x.includes("1 cell(s) for 2 column(s)"))).toBe(true);
  });
});

const lanesOf = { annexOf: "10665/380303", label: "Web Annex B", section: "dak#generic-business-processes-and-workflows" };

describe("the swimlane declaration is unambiguous", () => {
  test("laneAliasAndNotPersonaIsFinding", () => {
    expect(judgeSwimlanes({ $schema: "dak-swimlanes/v1", ...lanesOf, personas: { "Health worker": ["HW"] }, notPersonas: { HW: "header" } }).join()).toContain('"HW" is declared not a persona');
  });
  test("aliasOfTwoPersonasIsFinding", () => {
    expect(judgeSwimlanes({ $schema: "dak-swimlanes/v1", ...lanesOf, personas: { A: ["X"], B: ["X"] }, notPersonas: {} }).join()).toContain('"X" names two personas');
  });
  test("otherKindFileNotJudged", () => {
    expect(judgeFile('{"$schema":"something-else/v1"}')).toBeUndefined();
  });
});

describe("what the annexes name resolves in the instance's artefact index", () => {
  const index = { artifacts: [{ resourceType: "CodeSystem", id: "A" }, { resourceType: "ValueSet", id: "B" }] };
  test("indexCodeSystemsOnly", () => {
    expect([...codeSystemsIn(index)]).toEqual(["A"]);
  });
  test("idUnderListedCodeSystemResolves", () => {
    expect(judgeDictionaryReferences(dict([sheet([["A.DE.1", "a"]])]), codeSystemsIn(index))).toEqual([]);
  });
  test("idUnderNoCodeSystemIsFinding", () => {
    const f = judgeDictionaryReferences(dict([sheet([["B.DE.1", "a"], ["Z.DE.2", "b"]])]), codeSystemsIn(index));
    expect(f).toHaveLength(2);
    expect(f[0]).toContain('"B.DE.1" belongs to no CodeSystem');
  });
  test("prefixMustEndAtDot", () => {
    expect(judgeDictionaryReferences(dict([sheet([["AB.DE.1", "a"]])]), codeSystemsIn(index))).toHaveLength(1);
  });

  const files: Record<string, string> = {
    "/ig/dict.json": JSON.stringify(dict([sheet([["A.DE.1", "a"]])])),
    "/ig/index/page.md": "# page",
  };
  const read = (abs: string) => files[abs];
  test("existingRecordsResolve", () => {
    expect(judgeAnnexRecords([{ page: "d.md", file: "../dict.json", columns: ["data element id", "label"] }, { page: "p.md", file: "page.md" }], "/ig/index", read)).toEqual([]);
  });
  test("missingFileAndColumnAreFindings", () => {
    const f = judgeAnnexRecords([{ page: "x.md", file: "gone.md" }, { page: "d.md", file: "../dict.json", columns: ["required"] }], "/ig/index", read);
    expect(f.join()).toContain("gone.md, which does not exist");
    expect(f.join()).toContain('column "required"');
  });
  test("columnsOverNonDictionaryIsFinding", () => {
    expect(judgeAnnexRecords([{ page: "p.md", file: "page.md", columns: ["x"] }], "/ig/index", read).join()).toContain("is not a dak-data-dictionary/v1");
  });
});

describe("an instance with no artefact index: ids unresolved, not failed (fm9n)", () => {
  const d = dict([sheet([["A.DE.1", "a"], ["A.DE.2", "b"]])]);
  test("noIndexCountsIdsUnresolved", () => {
    expect(dictionaryReferences(d, 0, new Set())).toEqual({ findings: [], unresolved: 2 });
  });
  test("heldIndexJudgesIds", () => {
    expect(dictionaryReferences(d, 1, new Set(["A"]))).toEqual({ findings: [] });
    expect(dictionaryReferences(d, 1, new Set(["B"])).findings).toHaveLength(2);
  });
});

describe("annex records in either shape", () => {
  test("annexRecordsArrayOrObject", () => {
    const r = [{ page: "d.md", file: "dict.json" }];
    expect(annexRecordsOf(r)).toEqual(r);
    expect(annexRecordsOf({ $schema: "ig-annexes/v1", annexes: r })).toEqual(r);
    expect(annexRecordsOf({ other: 1 })).toEqual([]);
    expect(annexRecordsOf(null)).toEqual([]);
  });
});

describe("which publication and which section a web annex names", () => {
  const kinds = [
    { id: "l1", sections: ["introduction", "annexes"] },
    { id: "l1-guideline", sections: ["recommendations"], extends: "l1" },
    { id: "dak", sections: ["core-data-elements"] },
  ];
  const sections = sectionRefs(kinds);
  const held = (ref: string) => ref === "an-ig/library/the-dak";
  test("sectionRefsIncludeExtendedKind", () => {
    expect(sections.has("dak#core-data-elements")).toBe(true);
    expect(sections.has("l1#annexes")).toBe(true);
    expect(sections.has("l1-guideline#annexes")).toBe(true);
    expect(sections.has("l1-guideline#recommendations")).toBe(true);
    expect(sections.has("l1#recommendations")).toBe(false);
  });
  test("undeclaredSectionIsFinding", () => {
    const r = judgeWebAnnexOf({ annexOf: "10665/380303", label: "Web Annex A", section: "dak#nowhere" }, sections, held);
    expect(r.findings.join()).toContain('section "dak#nowhere"');
  });
  test("libraryResolvedIrisUnverified", () => {
    expect(judgeWebAnnexOf({ annexOf: "an-ig/library/the-dak", label: "A", section: "dak#core-data-elements" }, sections, held)).toEqual({ findings: [], unverified: [] });
    expect(judgeWebAnnexOf({ annexOf: "an-ig/library/gone", label: "A", section: "dak#core-data-elements" }, sections, held).findings.join()).toContain("no library entry");
    const r = judgeWebAnnexOf({ annexOf: "10665/380303", label: "A", iris: "10665/1", section: "l1#annexes" }, sections, held);
    expect(r.findings).toEqual([]);
    expect(r.unverified).toEqual(["annexOf IRIS 10665/380303", "own IRIS record 10665/1"]);
  });
});
