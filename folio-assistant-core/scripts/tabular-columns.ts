/**
 * What a column of cells IS, as a CSVW datatype — shared by the CSV and XLSX
 * extractors (bean `eief`).
 *
 * @module folio-assistant-core/scripts/tabular-columns
 * @covers tabular-metadata
 *
 * The skill's rule, verbatim: *"Never guess a datatype to avoid an
 * `undetermined`. A column of `1, 2, 3, N/A` is not an integer column."* So a
 * column gets one of three answers:
 *
 * - **a typed datatype, `measured`**: every non-empty value classifies as
 *   that type (or as a narrower one: integers in a decimal column);
 * - **`string`, `measured`**: no value classifies as any typed datatype, so
 *   it is text, and that is a reading rather than a fallback;
 * - **`any`, `undetermined`**: some values classify and some do not (the
 *   `N/A` case), or the column holds no value at all. Either way there is
 *   nothing to measure a type from.
 *
 * One rule sits before the three: **a zero-padded digit string is a code**.
 * `008` read as an integer is 8, and the padding was the point (ISO 4217
 * numeric currency codes, measured on the country-codes table, bean `urat`).
 * So a padded value never classes as a number, and a column of digit strings
 * holding any padded one is `string`, measured.
 *
 * The typed classes are CSVW's own built-in datatype names (CSVW Metadata
 * §5.11.1), so the record's `datatype` is a term a CSVW reader knows.
 */
import type { z } from "zod";

import type { CsvwColumnSchema } from "@litlfred/cat-harness-tools/schemas/library/tabular-csvw.js";

export type CsvwColumn = z.infer<typeof CsvwColumnSchema>;

/** Typed classes, narrowest first. A value's class is the first that matches. */
const CLASSES: ReadonlyArray<{ datatype: string; test: (v: string) => boolean }> = [
  { datatype: "boolean", test: (v) => /^(true|false)$/i.test(v) },
  { datatype: "integer", test: (v) => /^[+-]?\d+$/.test(v) },
  { datatype: "decimal", test: (v) => /^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(v) },
  { datatype: "date", test: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) },
  {
    datatype: "datetime",
    test: (v) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(v) && !Number.isNaN(Date.parse(v.replace(" ", "T"))),
  },
];

/** Which typed classes widen into which: an integer is also a decimal. */
const WIDENS: Readonly<Record<string, string>> = { integer: "decimal" };

/** `008`, `-01`: a leading zero before another digit. `0`, `0.5` are numbers. */
export const isZeroPadded = (v: string): boolean => /^[+-]?0\d/.test(v);

function classOf(value: string): string | null {
  if (isZeroPadded(value)) return null;
  for (const c of CLASSES) if (c.test(value)) return c.datatype;
  return null;
}

/**
 * The datatype of one column's cell values (header excluded). Values are
 * trimmed; an empty value is absence, not evidence.
 */
export function classifyColumn(values: readonly string[]): Pick<CsvwColumn, "datatype" | "datatypeSource"> {
  const present = values.map((v) => v.trim()).filter((v) => v !== "");
  if (present.length === 0) return { datatype: "any", datatypeSource: "undetermined" };
  if (present.some(isZeroPadded) && present.every((v) => /^\d+$/.test(v))) return { datatype: "string", datatypeSource: "measured" };
  const classes = new Set(present.map(classOf));
  if (classes.size === 1 && classes.has(null)) return { datatype: "string", datatypeSource: "measured" };
  if (classes.has(null)) return { datatype: "any", datatypeSource: "undetermined" };
  if (classes.size === 1) return { datatype: [...classes][0]!, datatypeSource: "measured" };
  // Two typed classes: fine only when one widens into the other.
  const widened = new Set([...classes].map((c) => WIDENS[c!] ?? c));
  if (widened.size === 1) return { datatype: [...widened][0]!, datatypeSource: "measured" };
  return { datatype: "any", datatypeSource: "undetermined" };
}

/**
 * A column's CSVW `name`: the title made into a token, or CSVW's own default
 * `_col.N` when there is no usable title (CSVW Metadata §5.6, `name`).
 * Duplicate names get a numeric suffix so each stays unique within the table,
 * as CSVW requires.
 */
export function columnNames(titles: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return titles.map((t, i) => {
    const base = t.trim().replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || `_col.${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
}

/**
 * Is a first row a header? Determined only from what the row and the rest of
 * the table SHOW:
 *
 * - every cell is non-empty and the cells are distinct, AND
 * - no cell classifies as a typed value while its column below it does.
 *
 * Returns `true` (a header) or `false` (data from row 1). It never returns
 * "probably": when the first test fails the row is data, which is CSVW's
 * `header: false`, and the columns are named `_col.N`.
 */
export function firstRowIsHeader(first: readonly string[], rest: readonly (readonly string[])[]): boolean {
  const cells = first.map((c) => c.trim());
  if (cells.length === 0 || cells.some((c) => c === "")) return false;
  if (new Set(cells).size !== cells.length) return false;
  return cells.every((c, i) => {
    if (classOf(c) === null) return true;
    const below = classifyColumn(rest.map((r) => r[i] ?? ""));
    return below.datatypeSource !== "measured" || below.datatype === "string";
  });
}
