/**
 * tabular-csv and the column classifier it shares with tabular-xlsx (bean
 * `eief`). Each test pins one rule from the `tabular-metadata` skill.
 */
import { describe, expect, it } from "bun:test";

import { TabularCsvwTablesSchema, toCsvw } from "@litlfred/cat-harness-tools/schemas/library/tabular-csvw.js";
import { classifyColumn, columnNames, firstRowIsHeader } from "./tabular-columns.js";
import { extractCsv, NotATableError, parseDelimited, sniffDelimiter } from "./tabular-csv.js";

const opts = { url: "comments.csv", docId: "comments" };

// The shape of a public-comment export (schemas/public-comment.ts): an id, the
// section commented on, free text with commas and quotes, and a date.
const COMMENTS = [
  "id,section,comment,submitted,votes",
  '1,2.1,"Agree, with one caveat",2026-03-01,4',
  '2,2.3,"The term ""registry"" is undefined",2026-03-02,0',
  "3,3.1,Fine as is,2026-03-04,12",
  "",
].join("\r\n");

describe("parseDelimited (RFC 4180)", () => {
  it("rfc4180Quoting", () => {
    expect(parseDelimited('a,"b,c","say ""hi"""\r\n"multi\nline",x,y\n', ",")).toEqual([
      ["a", "b,c", 'say "hi"'],
      ["multi\nline", "x", "y"],
    ]);
  });

  it("bomAndTrailingNewline", () => {
    expect(parseDelimited("﻿a,b\n1,2\n", ",")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("routing is a content question", () => {
  it("sniffsAgreedDelimiter", () => {
    expect(sniffDelimiter("a;b;c\n1;2;3\n")).toBe(";");
    expect(sniffDelimiter("a\tb\n1\t2\n")).toBe("\t");
    expect(sniffDelimiter(COMMENTS)).toBe(",");
  });

  it("oneFieldRowsNotTable", () => {
    expect(() => sniffDelimiter("just a line\nand another\n")).toThrow(NotATableError);
  });

  it("ambiguousDelimitersRefused", () => {
    // Decimal commas in a semicolon file: ',' sees 3 fields, ';' sees 2.
    expect(() => sniffDelimiter("1,5;2,5\n3,5;4,5\n")).toThrow(/ambiguous/);
  });
});

describe("classifyColumn: never guess a datatype", () => {
  it("naNotInteger", () => {
    expect(classifyColumn(["1", "2", "3", "N/A"])).toEqual({ datatype: "any", datatypeSource: "undetermined" });
  });

  it("decimalsWiden", () => {
    expect(classifyColumn(["1", "2.5", "-3"])).toEqual({ datatype: "decimal", datatypeSource: "measured" });
  });

  it("textIsReading", () => {
    expect(classifyColumn(["Agree", "Disagree"])).toEqual({ datatype: "string", datatypeSource: "measured" });
  });

  it("emptyIsAbsence", () => {
    expect(classifyColumn(["2026-01-01", "", " "])).toEqual({ datatype: "date", datatypeSource: "measured" });
    expect(classifyColumn(["", ""])).toEqual({ datatype: "any", datatypeSource: "undetermined" });
  });

  it("zeroPaddedAreCodes", () => {
    expect(classifyColumn(["008", "012", "971"])).toEqual({ datatype: "string", datatypeSource: "measured" });
    expect(classifyColumn(["008", "1.5"])).toEqual({ datatype: "any", datatypeSource: "undetermined" });
    expect(classifyColumn(["0", "10", "0.5"])).toEqual({ datatype: "decimal", datatypeSource: "measured" });
  });

  it("datesAndIntegersNoWiden", () => {
    expect(classifyColumn(["2026-01-01", "7"])).toEqual({ datatype: "any", datatypeSource: "undetermined" });
  });
});

describe("header and names", () => {
  it("numericFirstRowIsData", () => {
    expect(firstRowIsHeader(["2024", "2025"], [["1", "2"], ["3", "4"]])).toBe(false);
    expect(firstRowIsHeader(["year", "count"], [["2024", "2"]])).toBe(true);
  });

  it("emptyOrRepeatedTitleIsData", () => {
    expect(firstRowIsHeader(["a", ""], [["x", "y"]])).toBe(false);
    expect(firstRowIsHeader(["a", "a"], [["x", "y"]])).toBe(false);
  });

  it("columnNamesTokens", () => {
    expect(columnNames(["Submitted on", "", "a", "a"])).toEqual(["Submitted_on", "_col.2", "a", "a_2"]);
  });
});

describe("extractCsv", () => {
  it("publicCommentExport", () => {
    const r = extractCsv(COMMENTS, opts);
    expect(TabularCsvwTablesSchema.safeParse(r).success).toBe(true);
    const t = r.tables[0]!;
    expect(t.tableSchema.columns.map((c) => [c.name, c.datatype, c.datatypeSource])).toEqual([
      ["id", "integer", "measured"],
      ["section", "decimal", "measured"],
      ["comment", "string", "measured"],
      ["submitted", "date", "measured"],
      ["votes", "integer", "measured"],
    ]);
    expect(t["fac:headerRow"]).toBe(1);
    expect(t["fac:extent"]).toEqual({ rows: 3, columns: 5, source: "measured" });
  });

  it("csvAnchorDeterminedNull", () => {
    expect(extractCsv(COMMENTS, opts).tables[0]!["fac:anchor"]).toEqual({ sheet: null, cell: null, row: 1, column: 1 });
  });

  it("neverStub", () => {
    const t = extractCsv(COMMENTS, opts).tables[0]!;
    expect(t["fac:stub"]).toBeUndefined();
    expect(t.tableSchema.columns.length).toBeGreaterThan(0);
  });

  it("headerlessNumeric", () => {
    const t = extractCsv("1,2\n3,4\n", opts).tables[0]!;
    expect(t["fac:headerRow"]).toBeNull();
    expect(t.tableSchema.columns.map((c) => c.name)).toEqual(["_col.1", "_col.2"]);
    expect(t["fac:extent"]).toEqual({ rows: 2, columns: 2, source: "measured" });
  });

  it("raggedExtentUndetermined", () => {
    const head = Array.from({ length: 25 }, (_, i) => `${i},x`).join("\n");
    const t = extractCsv(`a,b\n${head}\n99,x,extra\n`, opts).tables[0]!;
    expect(t["fac:extent"]).toEqual({ rows: null, columns: null, source: "undetermined" });
  });

  it("csvwNoOwnKeys", () => {
    const csvw = toCsvw(extractCsv(COMMENTS, opts));
    expect(JSON.stringify(csvw)).not.toContain("fac:");
    expect(JSON.stringify(csvw)).not.toContain("datatypeSource");
  });
});
