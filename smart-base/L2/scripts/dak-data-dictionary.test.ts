import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { ANNEX_SCHEMA, dataDictionaryAnnex, headerKey, readWorkbook, unzip } from "./dak-data-dictionary";

/** A minimal zip (deflated entries), enough for an xlsx fixture. */
function zip(files: Record<string, string>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text, "utf-8");
    const data = deflateRawSync(raw);
    const n = Buffer.from(name, "utf-8");
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, n, data);
    centrals.push(ch, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const sheet = (rows: string[][]) =>
  `<worksheet><sheetData>${rows
    .map((r, i) => `<row r="${i + 1}">${r.map((c, j) => (c === "" ? "" : `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t>${c}</t></is></c>`)).join("")}</row>`)
    .join("")}</sheetData></worksheet>`;

const workbook = zip({
  "xl/workbook.xml": `<workbook><sheets><sheet name="READ ME" r:id="rId1"/><sheet name="IMMZ.C Client registration" r:id="rId2"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>`,
  "xl/worksheets/sheet1.xml": sheet([["", "Data dictionary column"], ["", "Data element ID"]]),
  "xl/worksheets/sheet2.xml": sheet([
    ["Activity ID", "Data element ID", "Data element label", "Data type", "Input options *"],
    ["IMMZ.C4", "IMMZ.C.DE.1", "Unique identifier", "ID", "N/A"],
    ["", "", "", "", ""],
    ["IMMZ.C4", "IMMZ.C.DE.2", "Name &amp; surname", "String", ""],
  ]),
});

describe("dak-data-dictionary", () => {
  test("readsWorkbookSheetsAndCells", () => {
    expect([...unzip(workbook).keys()]).toContain("xl/workbook.xml");
    const s = readWorkbook(workbook);
    expect(s.map((x) => x.name)).toEqual(["READ ME", "IMMZ.C Client registration"]);
    expect(s[1]!.rows[1]).toEqual(["IMMZ.C4", "IMMZ.C.DE.1", "Unique identifier", "ID", "N/A"]);
  });

  test("headerKeyAbsorbsTemplateDrift", () => {
    expect(headerKey("Input options *")).toBe(headerKey("Input option"));
    expect(headerKey("Multiple choice type \n(if applicable)")).toBe("multiple choice type");
  });

  test("annexHoldsDataSheetsAndIdRows", () => {
    const a = dataDictionaryAnnex(workbook, "fixture.xlsx", { annexOf: "10665/380303", label: "Web Annex A", section: "dak#core-data-elements" });
    expect([a.annexOf, a.label, a.section, a.iris]).toEqual(["10665/380303", "Web Annex A", "dak#core-data-elements", undefined]);
    expect(a.$schema).toBe(ANNEX_SCHEMA);
    // READ ME names "Data element ID" as a value, not a header beside a label: not data.
    expect(a.sheets.map((s) => s.name)).toEqual(["IMMZ.C Client registration"]);
    expect(a.sheets[0]!.rows.map((r) => r[1])).toEqual(["IMMZ.C.DE.1", "IMMZ.C.DE.2"]);
    expect(a.sheets[0]!.rows[1]![2]).toBe("Name & surname");
    expect(a.source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
