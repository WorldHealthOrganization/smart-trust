#!/usr/bin/env bun
/**
 * tabular-csv: a delimited text file read into a `folio-tabular-csvw/v1`
 * record. It replaces the `tabular-csv` STUB (bean `eief`).
 *
 * @module folio-assistant-core/scripts/tabular-csv
 * @covers tabular-metadata
 *
 * ```sh
 * bun run folio-assistant-core/scripts/tabular-csv.ts <file> [--doc-id <id>] [--out <tabular.csvw.json>]
 * ```
 *
 * Writes the record to `--out`, or to stdout. The record is validated against
 * `TabularCsvwTablesSchema` before it is written, so nothing invalid reaches disk.
 *
 * ## Routing is a content question, never an extension guess
 *
 * A CSV has no magic bytes, and bean `p67i` ruled out routing on `.csv`. The
 * skill's question is the only one asked: **do the first rows split into the
 * same number of fields, more than one?** Each of `,` `;` TAB `|` is tried, and
 * the delimiter is the one under which the first rows (up to 20) agree on a
 * field count of two or more. No delimiter agreeing, or two agreeing on
 * different counts, is a refusal (exit 2), never a pick: the file is not
 * shown to be a table.
 *
 * ## What each field is, in the three states
 *
 * | field | value | state |
 * |---|---|---|
 * | `fac:anchor` | sheet `null`, cell `null`, row 1, column 1 | DETERMINED: a CSV has no sheets and no A1 refs, and its one table is the file |
 * | `fac:headerRow` | `1`, or `null` when row 1 is data | from {@link firstRowIsHeader} |
 * | `fac:extent` | data rows × columns | `measured`; `undetermined` (both null) when rows disagree on their field count, because then the table has no single width |
 * | column `datatype` | from {@link classifyColumn} | `measured`, or `any` + `undetermined` |
 *
 * **One convention, stated rather than hidden.** When every column is text,
 * nothing in the data separates a header from a first data row. The record
 * then takes CSVW's own default, `header: true` (CSVW Dialect §5.9), because
 * that is the standard's declared reading, not a measurement. The
 * `tabular-metadata` skill records the same thing.
 *
 * Parsing is RFC 4180: double-quoted fields, `""` for a quote inside one, and
 * CR LF or LF line ends, with newlines allowed inside a quoted field. A
 * leading UTF-8 BOM is dropped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import { TABULAR_CSVW_SCHEMA_ID, type TabularCsvwTables, TabularCsvwTablesSchema } from "@litlfred/cat-harness-tools/schemas/library/tabular-csvw.js";
import { classifyColumn, columnNames, firstRowIsHeader } from "./tabular-columns.js";

export const DELIMITERS = [",", ";", "\t", "|"] as const;

/** RFC 4180 records. A trailing empty line is not a record. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export class NotATableError extends Error {}

/**
 * The delimiter under which the first rows agree on a field count of two or
 * more. Throws {@link NotATableError} when none does, or when more than one
 * does on DIFFERENT counts, which leaves the table's shape ambiguous.
 */
export function sniffDelimiter(text: string, probe = 20): string {
  const agreeing: Array<{ d: string; n: number }> = [];
  for (const d of DELIMITERS) {
    const rows = parseDelimited(text, d).slice(0, probe);
    if (rows.length === 0) continue;
    const n = rows[0]!.length;
    if (n >= 2 && rows.every((r) => r.length === n)) agreeing.push({ d, n });
  }
  if (agreeing.length === 0)
    throw new NotATableError("no delimiter splits the first rows into the same number of fields (two or more): not shown to be a table");
  if (new Set(agreeing.map((a) => a.n)).size > 1)
    throw new NotATableError(
      `delimiters disagree on the table's width (${agreeing.map((a) => `${JSON.stringify(a.d)}→${a.n}`).join(", ")}): ambiguous, not guessed`,
    );
  return agreeing[0]!.d;
}

/** The record for one delimited text. Pure: no filesystem. */
export function extractCsv(text: string, opts: { url: string; docId: string }): TabularCsvwTables {
  const delimiter = sniffDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  const width = Math.max(...rows.map((r) => r.length));
  const ragged = rows.some((r) => r.length !== width);
  const header = firstRowIsHeader(rows[0]!, rows.slice(1));
  const data = header ? rows.slice(1) : rows;
  const titles = header ? rows[0]! : Array.from({ length: width }, () => "");
  const names = columnNames(Array.from({ length: width }, (_, i) => titles[i] ?? ""));
  const record: TabularCsvwTables = {
    $schema: TABULAR_CSVW_SCHEMA_ID,
    doc_id: opts.docId,
    tables: [
      {
        url: opts.url,
        tableSchema: {
          columns: names.map((name, i) => ({
            name,
            titles: (titles[i] ?? "").trim(),
            ...classifyColumn(data.map((r) => r[i] ?? "")),
          })),
        },
        "fac:anchor": { sheet: null, cell: null, row: 1, column: 1 },
        "fac:headerRow": header ? 1 : null,
        "fac:extent": ragged
          ? { rows: null, columns: null, source: "undetermined" }
          : { rows: data.length, columns: width, source: "measured" },
      },
    ],
  };
  return TabularCsvwTablesSchema.parse(record);
}

function main(argv: string[]): number {
  const file = argv.find((a, i) => !a.startsWith("--") && !["--doc-id", "--out"].includes(argv[i - 1] ?? ""));
  if (!file) {
    console.error("usage: tabular-csv.ts <file> [--doc-id <id>] [--out <tabular.csvw.json>]");
    return 2;
  }
  const flag = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const url = basename(file);
  const docId = flag("--doc-id") ?? url.replace(/\.[^.]+$/, "");
  let record: TabularCsvwTables;
  try {
    record = extractCsv(readFileSync(file, "utf-8"), { url, docId });
  } catch (e) {
    if (e instanceof NotATableError) {
      console.error(`tabular-csv: ${file}: ${e.message}`);
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
