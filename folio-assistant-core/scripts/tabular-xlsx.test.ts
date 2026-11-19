/**
 * tabular-xlsx over workbooks built here, byte by byte: a ZIP of SpreadsheetML
 * parts, so the fixture needs no spreadsheet library (bean `eief`).
 *
 * The DAK-shaped sheet is the case the owner named: several tables on one
 * sheet, not starting at A1, headers not on row 1.
 */
import { describe, expect, it } from "bun:test";
import { crc32, deflateRawSync } from "node:zlib";

import { TabularCsvwTablesSchema, toCsvw } from "@litlfred/cat-harness-tools/schemas/library/tabular-csvw.js";
import { NotATableError } from "./tabular-csv.js";
import { readDecisionTable } from "./tabular-dak.js";
import { extractXlsx, findBlocks, isDateFormat, parseRef, readZip, serialToIso, toRef } from "./tabular-xlsx.js";

/** A ZIP (APPNOTE §4.3), every entry deflated unless `stored`. */
function zip(files: Record<string, string>, stored = false): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(content, "utf-8");
    const data = stored ? raw : deflateRawSync(raw);
    const n = Buffer.from(name, "utf-8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

type Cell = string | number | boolean | { date: number } | { shared: number };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A sheet part from `{ "B3": value }`. Strings are inline; `{date}` uses style 1 (numFmtId 14). */
function sheet(cells: Record<string, Cell>): string {
  const byRow = new Map<number, string[]>();
  for (const [ref, v] of Object.entries(cells)) {
    const { row } = parseRef(ref);
    let c: string;
    if (typeof v === "string") c = `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    else if (typeof v === "boolean") c = `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
    else if (typeof v === "number") c = `<c r="${ref}"><v>${v}</v></c>`;
    else if ("date" in v) c = `<c r="${ref}" s="1"><v>${v.date}</v></c>`;
    else c = `<c r="${ref}" t="s"><v>${v.shared}</v></c>`;
    byRow.set(row, [...(byRow.get(row) ?? []), c]);
  }
  const rows = [...byRow].sort(([a], [b]) => a - b).map(([r, cs]) => `<row r="${r}">${cs.join("")}</row>`);
  return `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

function workbook(sheets: Record<string, string>, opts: { stored?: boolean; shared?: string[] } = {}): Buffer {
  const names = Object.keys(sheets);
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    "xl/workbook.xml":
      `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
      names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      `</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `</Relationships>`,
    "xl/styles.xml": `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>`,
  };
  if (opts.shared)
    files["xl/sharedStrings.xml"] =
      `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      opts.shared.map((s) => `<si><t>${esc(s)}</t></si>`).join("") +
      `</sst>`;
  names.forEach((n, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = sheets[n]!));
  return zip(files, opts.stored);
}

const opts = { url: "book.xlsx", docId: "book" };

// 2026-03-01 is serial 46082.
const COMMENTS = sheet({
  A1: { shared: 0 }, B1: { shared: 1 }, C1: { shared: 2 }, D1: "accepted",
  A2: 1, B2: "Agree, with a caveat", C2: { date: 46082 }, D2: true,
  A3: 2, B3: "Term undefined", C3: { date: 46083 }, D3: false,
});

// Two tables stacked in column B (header on row 3, then on row 9), and a
// third beside the first, past an empty column F.
const DAK = sheet({
  B1: "Decision tables: ANC",
  B3: "Input", C3: "Condition", D3: "Output", E3: "Rank",
  B4: "Age", C4: "< 18", D4: "Refer", E4: 1,
  B5: "Age", C5: ">= 18", D5: "Proceed", E5: 2,
  G3: "code", H3: "display",
  G4: "ANC.A1", H4: "First visit",
  B9: "Data element", C9: "Type",
  B10: "Gestational age", C10: "Quantity",
});

describe("ZIP and references", () => {
  it("storedAndDeflated", () => {
    for (const stored of [true, false]) expect(readZip(zip({ "a.txt": "hello" }, stored)).get("a.txt")!.toString()).toBe("hello");
  });

  it("a1RefsRoundTrip", () => {
    expect(parseRef("B7")).toEqual({ row: 7, column: 2 });
    expect(toRef(10, 28)).toBe("AB10");
    expect(parseRef(toRef(3, 703))).toEqual({ row: 3, column: 703 });
  });

  it("serialsToIso", () => {
    expect(serialToIso(46082)).toBe("2026-03-01");
    expect(serialToIso(46082.5)).toBe("2026-03-01T12:00:00Z");
  });

  it("dateFormatTokens", () => {
    expect(isDateFormat("yyyy-mm-dd")).toBe(true);
    expect(isDateFormat("[h]:mm")).toBe(true);
    expect(isDateFormat("0.00")).toBe(false);
    expect(isDateFormat('"days" 0')).toBe(false);
    expect(isDateFormat("[Red]#,##0")).toBe(false);
  });
});

describe("findBlocks", () => {
  it("findBlocksSplits", () => {
    const cells = new Map([["1:1", "x"], ["1:2", "y"], ["2:1", "z"], ["1:4", "w"], ["4:1", "v"]]);
    expect(findBlocks(cells)).toEqual([
      { top: 1, left: 1, bottom: 2, right: 2 },
      { top: 1, left: 4, bottom: 1, right: 4 },
      { top: 4, left: 1, bottom: 4, right: 1 },
    ]);
  });
});

describe("extractXlsx", () => {
  it("commentsSheetTypes", () => {
    const r = extractXlsx(workbook({ Comments: COMMENTS }, { shared: ["id", "comment", "submitted"] }), opts);
    expect(TabularCsvwTablesSchema.safeParse(r).success).toBe(true);
    const t = r.tables[0]!;
    expect(t.tableSchema.columns.map((c) => [c.name, c.datatype])).toEqual([
      ["id", "integer"],
      ["comment", "string"],
      ["submitted", "date"],
      ["accepted", "boolean"],
    ]);
    expect(t["fac:anchor"]).toEqual({ sheet: "Comments", cell: "A1", row: 1, column: 1 });
    expect(t["fac:extent"]).toEqual({ rows: 2, columns: 4, source: "measured" });
    expect(t.url).toBe("book.xlsx#Comments!A1:D3");
  });

  it("dakSheetFourTables", () => {
    const r = extractXlsx(workbook({ DAK }), opts);
    const placed = r.tables.map((t) => [t["fac:anchor"]!.cell, t["fac:headerRow"], t["fac:extent"].rows, t["fac:extent"].columns]);
    expect(placed).toEqual([
      ["B1", null, 1, 1], // the sheet title: one cell, read as data, not invented into a header
      ["B3", 3, 2, 4],
      ["G3", 3, 1, 2],
      ["B9", 9, 1, 2],
    ]);
    const anc = r.tables[1]!;
    expect(anc.tableSchema.columns.map((c) => [c.name, c.datatype])).toEqual([
      ["Input", "string"],
      ["Condition", "string"],
      ["Output", "string"],
      ["Rank", "integer"],
    ]);
  });

  it("numericReferencesDecode", () => {
    const s = sheet({ A1: "x", B1: "y", A2: "1", B2: "2" }).replace(">x<", ">ICD-11&#10;code<").replace(">y<", ">caf&#xE9;<");
    const t = extractXlsx(workbook({ S: s }), opts).tables[0]!;
    expect(t.tableSchema.columns.map((c) => c.titles)).toEqual(["ICD-11\ncode", "café"]);
  });

  it("emptySheetNoTable", () => {
    const r = extractXlsx(workbook({ Empty: sheet({}), Comments: COMMENTS }, { shared: ["id", "comment", "submitted"] }), opts);
    expect(r.tables.map((t) => t["fac:anchor"]!.sheet)).toEqual(["Comments"]);
  });

  it("storedSameAsDeflated", () => {
    const a = extractXlsx(workbook({ DAK }, { stored: true }), opts);
    const b = extractXlsx(workbook({ DAK }), opts);
    expect(a).toEqual(b);
  });

  it("routedByContent", () => {
    expect(() => extractXlsx(Buffer.from("id,name\n1,x\n"), opts)).toThrow(NotATableError);
    expect(() => extractXlsx(zip({ "word/document.xml": "<w/>" }), opts)).toThrow(/xl\/workbook\.xml/);
  });

  it("malformedSheetRefused", () => {
    const broken = sheet({ A1: "h", B1: "k", A2: "x", B2: "y" }).replace("<is><t xml:space=\"preserve\">x</t>", "<is><t>< x</t>");
    expect(() => extractXlsx(workbook({ S: broken }), opts)).toThrow(/not well-formed/);
  });

  it("neverStubNoOwnKeys", () => {
    const r = extractXlsx(workbook({ DAK }), opts);
    expect(r.tables.every((t) => !t["fac:stub"] && t.tableSchema.columns.length > 0)).toBe(true);
    expect(JSON.stringify(toCsvw(r))).not.toContain("fac:");
  });
});

/** A WHO DAK decision table, shaped as the IMMZ workbook writes one (bean scn4). */
const DT_CELLS: Record<string, Cell> = {
  B2: "Decision ID", C2: "IMMZ.D2.DT.DTP",
  B3: "Business rule", C3: "Determine if the client is due",
  B4: "Trigger", C4: "IMMZ.D2",
  B5: "Inputs", E5: "Output", F5: "Guidance displayed to health worker",
  B6: "DTP schedule, on-time start",
  B7: "Doses given", C7: "Client's age", D7: "–",
  B8: "0", C8: "< 1 year", D8: "–", E8: "Client is due", F8: "Should vaccinate",
  B9: "–", C9: "-", D9: "–", E9: "Client is not due", F9: "Should not vaccinate",
  B10: "2", C10: "≥ 1 year", D10: "–", E10: "Client is due", F10: "Check the record",
};
const withMerges = (xml: string, refs: string[]) =>
  xml.replace("</sheetData>", `</sheetData><mergeCells count="${refs.length}">${refs.map((r) => `<mergeCell ref="${r}"/>`).join("")}</mergeCells>`);

describe("DAK decision tables (scn4)", () => {
  it("decisionTableRead", () => {
    const t = extractXlsx(workbook({ DTP: sheet(DT_CELLS) }), opts).tables[0]!;
    expect(t["fac:anchor"]!.cell).toBe("B2");
    expect(t["fac:preamble"]).toEqual([
      { key: "Decision ID", value: "IMMZ.D2.DT.DTP" },
      { key: "Business rule", value: "Determine if the client is due" },
      { key: "Trigger", value: "IMMZ.D2" },
      { key: "Section", value: "DTP schedule, on-time start" },
    ]);
    expect(t["fac:headerRow"]).toBe(7);
    expect(t["fac:extent"]).toEqual({ rows: 3, columns: 5, source: "measured" });
    expect(t["fac:wildcard"]).toEqual(["–", "-"]);
    expect(t.tableSchema.columns.map((c) => [c["fac:group"] ?? null, c.titles, c.datatype])).toEqual([
      ["Inputs", "Doses given", "integer"], // `–` is not evidence: 0 and 2 are
      ["Inputs", "Client's age", "string"],
      ["Inputs", "", "any"], // titled `–` and only don't-cares below: nothing measured
      [null, "Output", "string"],
      [null, "Guidance displayed to health worker", "string"],
    ]);
  });

  it("repeatedOutputLabelsTitleRow", () => {
    const cells = { ...DT_CELLS, E7: "Output", F7: "Guidance displayed to health worker" };
    expect(extractXlsx(workbook({ S: sheet(cells) }), opts).tables[0]!["fac:headerRow"]).toBe(7);
  });

  it("noTitleRowInputsUntitled", () => {
    const cells: Record<string, Cell> = {
      B2: "Decision ID", C2: "X", B3: "Business rule", C3: "Y", B4: "Trigger", C4: "Z",
      B5: "Potential contraindications", D5: "Output",
      B6: "The client is pregnant", C6: "–", D6: "Do not vaccinate",
    };
    const t = extractXlsx(workbook({ S: sheet(cells) }), opts).tables[0]!;
    expect(t["fac:headerRow"]).toBe(5);
    expect(t.tableSchema.columns.map((c) => [c["fac:group"] ?? null, c.titles])).toEqual([
      ["Potential contraindications", ""],
      ["Potential contraindications", ""],
      [null, "Output"],
    ]);
  });

  it("strayCellOwnBlock", () => {
    const tables = extractXlsx(workbook({ JE: sheet({ ...DT_CELLS, A1: 7 }) }), opts).tables;
    expect(tables.map((t) => t.url.split("#")[1])).toEqual(["JE!A1:A1", "JE!B2:F10"]);
    expect(tables[1]!["fac:preamble"]?.[0]?.key).toBe("Decision ID");
  });

  it("mergedRangesOntoTable", () => {
    const xml = withMerges(sheet({ ...DT_CELLS, H2: "code", I2: "display", H3: "A", I3: "B" }), ["B6:F6", "F8:F9", "H2:I2"]);
    const [dt, other] = extractXlsx(workbook({ S: xml }), opts).tables;
    expect(dt!["fac:merged"]).toEqual(["B6:F6", "F8:F9"]);
    expect(other!["fac:merged"]).toEqual(["H2:I2"]);
  });

  it("partialStartGeneric", () => {
    expect(readDecisionTable([["Decision ID", "X"], ["Business rule", "Y"]], 1)).toBeNull();
    const t = extractXlsx(workbook({ S: sheet({ B2: "Decision ID", C2: "X", B3: "Trigger", C3: "Y" }) }), opts).tables[0]!;
    expect(t["fac:preamble"]).toBeUndefined();
  });

  it("csvwCarriesNone", () => {
    const csvw = JSON.stringify(toCsvw(extractXlsx(workbook({ S: sheet(DT_CELLS) }), opts)));
    for (const k of ["fac:", "preamble", "wildcard", "Section"]) expect(csvw).not.toContain(k);
  });
});
