import { describe, expect, test } from "bun:test";
import { DakDataDictionaryAnnexSchema, DakSwimlaneMapSchema } from "./dak-annexes";

describe("dak-annexes", () => {
  const annex = {
    $schema: "dak-data-dictionary/v1",
    annexOf: "10665/380303",
    label: "Web Annex A",
    section: "dak#core-data-elements",
    title: "Core data dictionary",
    source: { label: "x.xlsx", sha256: "a".repeat(64) },
    idColumn: "data element id",
    sheets: [{ name: "S", columns: [{ key: "data element id", label: "Data element ID" }], rows: [["IMMZ.C.DE.1"]] }],
  };

  test("dataDictionaryRejectsRaggedRowAndStrayKey", () => {
    expect(DakDataDictionaryAnnexSchema.safeParse(annex).success).toBe(true);
    const ragged = structuredClone(annex);
    ragged.sheets[0]!.rows.push(["a", "b"]);
    expect(DakDataDictionaryAnnexSchema.safeParse(ragged).success).toBe(false);
    expect(DakDataDictionaryAnnexSchema.safeParse({ ...annex, extra: 1 }).success).toBe(false);
  });

  test("swimlaneMapPersonaAliasesMustBeList", () => {
    const map = { $schema: "dak-swimlanes/v1", annexOf: "who-iris/library/9789240099456-eng", label: "Web Annex B", section: "dak#generic-business-processes-and-workflows", personas: { "Health worker": ["HW"] }, notPersonas: { Function: "header lane" } };
    expect(DakSwimlaneMapSchema.safeParse(map).success).toBe(true);
    expect(DakSwimlaneMapSchema.safeParse({ ...map, personas: { "Health worker": "HW" } }).success).toBe(false);
  });

  test("webAnnexNamesPublicationAndSection", () => {
    expect(DakDataDictionaryAnnexSchema.safeParse({ ...annex, iris: "10665/123" }).success).toBe(true);
    const { annexOf: _a, ...noParent } = annex;
    expect(DakDataDictionaryAnnexSchema.safeParse(noParent).success).toBe(false);
    const { section: _s, ...noSection } = annex;
    expect(DakDataDictionaryAnnexSchema.safeParse(noSection).success).toBe(false);
    expect(DakDataDictionaryAnnexSchema.safeParse({ ...annex, annexOf: "the DAK" }).success).toBe(false);
    expect(DakDataDictionaryAnnexSchema.safeParse({ ...annex, iris: "380303" }).success).toBe(false);
    expect(DakDataDictionaryAnnexSchema.safeParse({ ...annex, section: "core-data-elements" }).success).toBe(false);
  });
});
