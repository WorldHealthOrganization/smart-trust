import { describe, expect, test } from "bun:test";

import * as k from "./l1-kgid.ts";

// Outputs of WHO smart-kg tools/kgid.mjs at 3f5e477, recorded 2026-10-07.
describe("l1-kgid mints smart-kg's IRIs", () => {
  test("publicationIriFromFirstIdentifier", () => {
    expect(k.publicationId([{ type: "iris-handle", value: "10665/340749" }, { type: "isbn", value: "978-92-4-001651-4" }])).toBe(
      "https://smart.who.int/kg/l1/publication/isbn-9789240016514",
    );
    expect(k.publicationId([{ type: "iris-handle", value: "10665/340749" }])).toBe("https://smart.who.int/kg/l1/publication/iris-handle-10665-340749");
    expect(() => k.publicationId([])).toThrow();
  });
  test("mintsSectionElementReferenceCitationIris", () => {
    const pub = "https://smart.who.int/kg/l1/publication/isbn-9789240016514";
    expect(k.sectionId(pub, "1.2")).toBe(`${pub}/section/1.2`);
    expect(k.sectionId(pub, "Annex 3")).toBe(`${pub}/section/Annex-3`);
    expect(k.publicationElementId(pub, "Table A1.1")).toBe(`${pub}/element/table-a1-1`);
    expect(k.referenceEntryId("https://smart.who.int/immunizations/artifact/x", "26")).toBe("https://smart.who.int/immunizations/artifact/x/reference/26");
    expect(k.citationId("https://smart.who.int/immunizations", "abc")).toBe(`https://smart.who.int/immunizations/citation/${k.shortHash("abc")}`);
    expect(k.dakNamespace("http://smart.who.int/immunizations/bpmn/")).toBe("https://smart.who.int/immunizations");
  });
});
