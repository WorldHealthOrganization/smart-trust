#!/usr/bin/env bun
/**
 * tabular-xlsx: a workbook read into a `folio-tabular-csvw/v1` record, one
 * table per rectangular block of cells. It replaces the `tabular-xlsx` STUB
 * (bean `eief`).
 *
 * @module folio-assistant-core/scripts/tabular-xlsx
 * @covers tabular-metadata
 *
 * ```sh
 * bun run folio-assistant-core/scripts/tabular-xlsx.ts <file.xlsx> [--doc-id <id>] [--out <tabular.csvw.json>]
 * ```
 *
 * ## No new dependency
 *
 * An `.xlsx` is a ZIP of SpreadsheetML (ECMA-376). The ZIP is read here with
 * `node:zlib` (stored and deflated entries, which is everything ECMA-376
 * permits), and the XML with `fast-xml-parser`, which this package already
 * declares. A fixture needing an undeclared dependency is one CI cannot
 * build. Routing is by content: a file without the ZIP signature and an
 * `xl/workbook.xml` is refused, whatever its extension says.
 *
 * ## Where a table is: the case CSVW cannot express
 *
 * A workbook's sheet may hold a table that does not start at A1, a header that
 * is not row 1, and several tables. So a sheet's cells are split into
 * **blocks**:
 * - rows are banded wherever a whole row is empty;
 * - each band is split wherever a whole column of that band is empty.
 *
 * Each block is one CSVW table. Its `fac:anchor` is the block's top-left cell,
 * which is DETERMINED: sheet name, A1 ref, row and column. Its header is
 * judged by the same rule as a CSV's. Its extent is measured from the block.
 * The table's `url` is `<file>#<sheet>!<A1 range>`. CSVW requires a URL and
 * none is standard for a range in a workbook, so this one is written to be
 * read, not resolved.
 *
 * An empty sheet produces no table: there is nothing to describe, and an
 * extent of zero columns is not one CSVW can state.
 *
 * ## Dates are a number with a format
 *
 * SpreadsheetML stores a date as a serial number. Read without its format it
 * classifies as `integer`: a WRONG measurement, the kind the three-state rule
 * exists to prevent. So `xl/styles.xml` is read too. A numeric cell whose
 * number format is a date format is converted to an ISO date (or datetime,
 * when the serial has a time part) before it is classified. Date formats are
 * the built-in ids 14–22 and 45–47, and any custom format code with a date or
 * time token outside quotes and brackets (ECMA-376 Part 1 §18.8.30–31).
 *
 * Not read, by design: formulas (a cell's cached value `<v>` is read, its
 * `<f>` is not) and styling. Merged ranges ARE read since bean `scn4`, as
 * `fac:merged` on the table they fall inside: a merge is a fact about the
 * sheet, and losing it made a DAK decision table's spanning cells read as
 * empty. CSVW cannot express them, so `toCsvw` drops them.
 *
 * A block whose top-left cell is `Decision ID` is a WHO DAK decision table,
 * and `tabular-dak.ts` reads it (preamble, two-row header, don't-care). A
 * block that does not fit that shape falls back to the generic reading.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { inflateRawSync } from "node:zlib";

import { XMLParser, XMLValidator } from "fast-xml-parser";

import { TABULAR_CSVW_SCHEMA_ID, type TabularCsvwTables, TabularCsvwTablesSchema } from "@litlfred/cat-harness-tools/schemas/library/tabular-csvw.js";
import { classifyColumn, columnNames, firstRowIsHeader } from "./tabular-columns.js";
import { NotATableError } from "./tabular-csv.js";
import { readDecisionTable } from "./tabular-dak.js";

// ── ZIP (APPNOTE.TXT §4.3) ───────────────────────────────────────

/** Every entry of a ZIP, by name. Stored (0) and deflated (8) only. */
export function readZip(buf: Buffer): Map<string, Buffer> {
  // End of central directory: signature 0x06054b50, within the last 64 KiB + 22.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new NotATableError("not a ZIP archive, so not a workbook");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new NotATableError("corrupt ZIP central directory");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf-8", p + 46, p + 46 + nameLen);
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataAt, dataAt + size);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, inflateRawSync(raw));
    else throw new NotATableError(`ZIP entry ${name} uses compression method ${method}, which ECMA-376 does not permit`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ── SpreadsheetML ────────────────────────────────────────────────

// `htmlEntities` is what decodes numeric references: Excel writes a line
// break in a title as `&#10;`, and without it the WHO IMMZ data dictionary's
// "ICD-11&#10;code" came through verbatim (bean `urat`). A named entity XML
// does not define cannot reach the parser: `XMLValidator` refuses the part.
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", removeNSPrefix: true, parseTagValue: false, trimValues: false, htmlEntities: true });
const list = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** The text of an `<si>` or `<is>`: its `<t>`, or every run's `<t>` joined. */
function richText(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node;
  const n = node as Record<string, unknown>;
  const t = (x: unknown) => (typeof x === "object" && x !== null ? String((x as Record<string, unknown>)["#text"] ?? "") : String(x ?? ""));
  if (n.t !== undefined) return list(n.t).map(t).join("");
  return list(n.r as unknown[]).map((r) => list((r as Record<string, unknown>).t).map(t).join("")).join("");
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Does a custom number format code show a date or time? Quoted text and `[...]` sections are not tokens. */
export function isDateFormat(code: string): boolean {
  const bare = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  return /[dmyhs]/i.test(bare) && !/^[#0.,%\s]*$/.test(bare);
}

/** Style index → whether a numeric cell with that style is a date. */
function dateStyles(stylesXml: string | undefined): boolean[] {
  if (!stylesXml) return [];
  const ss = xml.parse(stylesXml).styleSheet ?? {};
  const custom = new Map<number, string>();
  for (const f of list(ss.numFmts?.numFmt)) custom.set(Number(f["@numFmtId"]), String(f["@formatCode"]));
  return list(ss.cellXfs?.xf).map((xf) => {
    const id = Number(xf["@numFmtId"] ?? 0);
    return BUILTIN_DATE_FORMATS.has(id) || (custom.has(id) && isDateFormat(custom.get(id)!));
  });
}

/** An Excel serial (1900 date system) as an ISO date, or datetime when it has a time part. */
export function serialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000);
  const iso = new Date(ms).toISOString();
  return Number.isInteger(serial) ? iso.slice(0, 10) : iso.replace(/\.000Z$/, "Z");
}

/** `B7` → { row: 7, column: 2 }. */
export function parseRef(ref: string): { row: number; column: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`not an A1 reference: ${ref}`);
  const column = [...m[1]!].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return { row: Number(m[2]), column };
}

/** { row: 7, column: 2 } → `B7`. */
export function toRef(row: number, column: number): string {
  let s = "";
  for (let c = column; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  return `${s}${row}`;
}

/** A sheet's merged ranges (`<mergeCells>`), A1 notation, in document order. */
function mergedRanges(sheetXml: string): string[] {
  const ws = xml.parse(sheetXml).worksheet ?? {};
  return list(ws.mergeCells?.mergeCell).map((m) => String(m["@ref"])).filter((ref) => /^[A-Z]+\d+:[A-Z]+\d+$/.test(ref));
}

/** The merged ranges lying wholly inside a block. */
export function mergedWithin(ranges: readonly string[], b: Block): string[] {
  return ranges.filter((ref) => {
    const [a, z] = ref.split(":").map(parseRef) as [{ row: number; column: number }, { row: number; column: number }];
    return a.row >= b.top && z.row <= b.bottom && a.column >= b.left && z.column <= b.right;
  });
}

/** One sheet's non-empty cells as text, keyed `row:column`. */
function sheetCells(sheetXml: string, shared: string[], isDate: boolean[]): Map<string, string> {
  const cells = new Map<string, string>();
  const ws = xml.parse(sheetXml).worksheet ?? {};
  for (const row of list(ws.sheetData?.row)) {
    for (const c of list(row.c)) {
      const ref = c["@r"];
      if (!ref) continue;
      const type = c["@t"] ?? "n";
      const v = c.v === undefined ? undefined : String(typeof c.v === "object" ? c.v["#text"] ?? "" : c.v);
      let text: string;
      if (type === "s") text = shared[Number(v)] ?? "";
      else if (type === "inlineStr") text = richText(c.is);
      else if (type === "b") text = v === "1" ? "true" : v === "0" ? "false" : "";
      else if (type === "n" && v !== undefined && v !== "" && isDate[Number(c["@s"] ?? 0)]) text = serialToIso(Number(v));
      else text = v ?? "";
      if (text.trim() === "") continue;
      const { row: r, column: col } = parseRef(ref);
      cells.set(`${r}:${col}`, text);
    }
  }
  return cells;
}

export interface Block { top: number; left: number; bottom: number; right: number }

/** Rectangular blocks of cells: bands split on empty rows, then on empty columns within each band. */
export function findBlocks(cells: ReadonlyMap<string, string>): Block[] {
  const keys = [...cells.keys()].map((k) => k.split(":").map(Number) as [number, number]);
  if (keys.length === 0) return [];
  const rows = [...new Set(keys.map(([r]) => r))].sort((a, b) => a - b);
  const bands: number[][] = [];
  for (const r of rows) {
    const last = bands.at(-1);
    if (last && r === last.at(-1)! + 1) last.push(r);
    else bands.push([r]);
  }
  const blocks: Block[] = [];
  for (const band of bands) {
    const inBand = new Set(band);
    const cols = [...new Set(keys.filter(([r]) => inBand.has(r)).map(([, c]) => c))].sort((a, b) => a - b);
    let start = cols[0]!;
    for (let i = 1; i <= cols.length; i++) {
      if (i === cols.length || cols[i] !== cols[i - 1]! + 1) {
        const right = cols[i - 1]!;
        const used = band.filter((r) => Array.from({ length: right - start + 1 }, (_, k) => start + k).some((c) => cells.has(`${r}:${c}`)));
        blocks.push({ top: used[0]!, left: start, bottom: used.at(-1)!, right });
        if (i < cols.length) start = cols[i]!;
      }
    }
  }
  return blocks;
}

/** A block shrunk to the rows and columns that hold a cell, or null when it holds none. */
function trimBlock(b: Block, cells: ReadonlyMap<string, string>): Block | null {
  let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity;
  for (let r = b.top; r <= b.bottom; r++)
    for (let c = b.left; c <= b.right; c++)
      if (cells.has(`${r}:${c}`)) { top = Math.min(top, r); bottom = Math.max(bottom, r); left = Math.min(left, c); right = Math.max(right, c); }
  return top === Infinity ? null : { top, left, bottom, right };
}

/**
 * A block split at each `Decision ID` cell that is not already its top-left
 * (bean `scn4`). One stray cell is enough to join a decision table to its
 * neighbour: a backtick in Measles!E51, a `7` in JE!A1. So each `Decision ID`
 * starts its own block, running to the next one or the block's end. Whatever
 * lies above or left of it stays a block of its own, read generically, rather
 * than being dropped.
 */
export function splitAtDecisionIds(b: Block, cells: ReadonlyMap<string, string>): Block[] {
  const ids: { row: number; column: number }[] = [];
  for (let r = b.top; r <= b.bottom; r++)
    for (let c = b.left; c <= b.right; c++)
      if (cells.get(`${r}:${c}`)?.trim() === "Decision ID") { ids.push({ row: r, column: c }); break; }
  if (ids.length === 0 || (ids.length === 1 && ids[0]!.row === b.top && ids[0]!.column === b.left)) return [b];
  const out: (Block | null)[] = [];
  out.push(trimBlock({ ...b, bottom: ids[0]!.row - 1 }, cells));
  ids.forEach((id, i) => {
    const bottom = i + 1 < ids.length ? ids[i + 1]!.row - 1 : b.bottom;
    if (id.column > b.left) out.push(trimBlock({ top: id.row, left: b.left, bottom, right: id.column - 1 }, cells));
    out.push(trimBlock({ top: id.row, left: id.column, bottom, right: b.right }, cells));
  });
  return out.filter((x): x is Block => x !== null);
}

/** The record for one workbook. Pure: no filesystem. */
export function extractXlsx(buf: Buffer, opts: { url: string; docId: string }): TabularCsvwTables {
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) throw new NotATableError("no ZIP signature, so not a workbook");
  const zip = readZip(buf);
  // A malformed part is refused, not half-read: the parser is lenient, and a
  // lenient read of a broken sheet is a thin table that looks like a real one.
  const text = (name: string) => {
    const t = zip.get(name)?.toString("utf-8");
    if (t !== undefined && XMLValidator.validate(t) !== true) throw new NotATableError(`${name} is not well-formed XML`);
    return t;
  };
  const workbook = text("xl/workbook.xml");
  if (!workbook) throw new NotATableError("a ZIP without xl/workbook.xml is not a SpreadsheetML workbook");

  const rels = new Map<string, string>();
  for (const r of list(xml.parse(text("xl/_rels/workbook.xml.rels") ?? "").Relationships?.Relationship))
    rels.set(r["@Id"], String(r["@Target"]).replace(/^\/?(xl\/)?/, "xl/"));
  const shared = list(xml.parse(text("xl/sharedStrings.xml") ?? "").sst?.si).map(richText);
  const isDate = dateStyles(text("xl/styles.xml"));

  const tables: TabularCsvwTables["tables"] = [];
  for (const sheet of list(xml.parse(workbook).workbook?.sheets?.sheet)) {
    const name = String(sheet["@name"]);
    const target = rels.get(sheet["@id"]);
    const sheetXml = target ? text(target) : undefined;
    if (!sheetXml) throw new NotATableError(`sheet "${name}" names a part that is not in the archive`);
    const cells = sheetCells(sheetXml, shared, isDate);
    const merges = mergedRanges(sheetXml);
    for (const b of findBlocks(cells).flatMap((blk) => splitAtDecisionIds(blk, cells))) {
      const grid: string[][] = [];
      for (let r = b.top; r <= b.bottom; r++) {
        const row: string[] = [];
        for (let c = b.left; c <= b.right; c++) row.push(cells.get(`${r}:${c}`) ?? "");
        grid.push(row);
      }
      const width = b.right - b.left + 1;
      const url = `${opts.url}#${name}!${toRef(b.top, b.left)}:${toRef(b.bottom, b.right)}`;
      const anchor = { sheet: name, cell: toRef(b.top, b.left), row: b.top, column: b.left };
      const merged = mergedWithin(merges, b);
      const extras = merged.length > 0 ? { "fac:merged": merged } : {};
      const dt = readDecisionTable(grid, b.top);
      if (dt) {
        tables.push({
          url,
          tableSchema: { columns: dt.columns },
          "fac:anchor": anchor,
          "fac:headerRow": dt.headerRow,
          "fac:extent": { rows: dt.rows, columns: width, source: "measured" },
          "fac:preamble": dt.preamble,
          ...(dt.wildcard ? { "fac:wildcard": dt.wildcard } : {}),
          ...extras,
        });
        continue;
      }
      const header = grid.length > 1 && firstRowIsHeader(grid[0]!, grid.slice(1));
      const data = header ? grid.slice(1) : grid;
      const titles = header ? grid[0]! : Array.from({ length: width }, () => "");
      const names = columnNames(titles);
      tables.push({
        url,
        tableSchema: {
          columns: names.map((n, i) => ({ name: n, titles: titles[i]!.trim(), ...classifyColumn(data.map((r) => r[i]!)) })),
        },
        "fac:anchor": anchor,
        "fac:headerRow": header ? b.top : null,
        "fac:extent": { rows: data.length, columns: width, source: "measured" },
        ...extras,
      });
    }
  }
  return TabularCsvwTablesSchema.parse({ $schema: TABULAR_CSVW_SCHEMA_ID, doc_id: opts.docId, tables });
}

function main(argv: string[]): number {
  const file = argv.find((a, i) => !a.startsWith("--") && !["--doc-id", "--out"].includes(argv[i - 1] ?? ""));
  if (!file) {
    console.error("usage: tabular-xlsx.ts <file.xlsx> [--doc-id <id>] [--out <tabular.csvw.json>]");
    return 2;
  }
  const flag = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const url = basename(file);
  let record: TabularCsvwTables;
  try {
    record = extractXlsx(readFileSync(file), { url, docId: flag("--doc-id") ?? url.replace(/\.[^.]+$/, "") });
  } catch (e) {
    if (e instanceof NotATableError) {
      console.error(`tabular-xlsx: ${file}: ${e.message}`);
      return 2;
    }
    throw e;
  }
  const json = JSON.stringify(record, null, 2) + "\n";
  const out = flag("--out");
  if (out) writeFileSync(out, json);
  else process.stdout.write(json);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
