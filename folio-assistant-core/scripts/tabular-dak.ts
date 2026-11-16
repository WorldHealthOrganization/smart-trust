/**
 * A WHO DAK decision table, read as one: a key/value preamble, a two-row
 * header, `–` as don't-care (bean `folio-core-scn4`).
 *
 * @module folio-assistant-core/scripts/tabular-dak
 * @covers tabular-metadata
 *
 * The generic reader (`tabular-xlsx.ts`) asks only "is the first row a
 * header?" and, rightly, answers no for these: it would have to guess. So the
 * DAK shape is routed BY CONTENT: a block whose top-left cell is
 * `Decision ID`. Measured on the IMMZ decision-support workbook (smart-
 * immunizations bd7fa72): 90 decision tables, 87 of one shape.
 *
 * ```
 * Decision ID   | IMMZ.D2.DT.DTP.On-time          ← preamble: key | value, nothing else
 * Business rule | Determine if …
 * Trigger       | IMMZ.D2 …
 * Inputs        |  …  | Output | Guidance … | Annotations | Reference(s)   ← group row
 * DTP schedule …                                   ← section row(s), optional
 * Number of …   | Client's age | –                ← title row, optional: outputs empty
 * –             | < 1 year     | – | Client is due | Should vaccinate …     ← rules
 * ```
 *
 * - The group row's FIRST label (usually `Inputs`; BCG's contraindication
 *   tables say `Potential contraindications`) spans every column up to the
 *   next label. Those are the input columns: `fac:group` is that label, and
 *   their titles come from the title row.
 * - Every later label heads one column (`Output`, `Guidance displayed to
 *   health worker`, …) and is that column's title.
 * - A section row (only its first cell filled) is a rule set's caption. It is
 *   kept in the preamble under the reader's own key `Section`, not invented
 *   into a column.
 * - The title row is the first row whose output columns are all empty. A rule
 *   always has an output, so a row without one is not a rule. When there is
 *   none, the input columns are untitled (`_col.N`), not guessed.
 * - `–` (or `-`) in a rule is a don't-care: recorded as `fac:wildcard` and not
 *   counted as evidence for a column's datatype.
 *
 * Anything that does not fit (no group row, a preamble that runs to the end)
 * returns `null`, and the generic reader takes the block. Not fitting is
 * not an error.
 */
import type { CsvwColumn } from "./tabular-columns.js";
import { classifyColumn, columnNames } from "./tabular-columns.js";

/**
 * The don't-care markers of the WHO DAK workbooks: U+2013 EN DASH, and the
 * ASCII hyphen some sheets use instead (13 of the IMMZ workbook's 29 sheets
 * use both). Only a cell that is EXACTLY one of these; `3-dose` is text.
 */
export const DAK_WILDCARDS: ReadonlySet<string> = new Set(["–", "-"]);
const isWildcard = (c: string) => DAK_WILDCARDS.has(c.trim());

/** What the reader adds to a table, beyond the url, anchor and merged ranges the caller knows. */
export interface DecisionTableReading {
  columns: CsvwColumn[];
  headerRow: number;
  rows: number;
  preamble: { key: string; value: string }[];
  /** The don't-care markers this table's rules actually use. */
  wildcard?: string[];
}

/** Is this block a DAK decision table? Its top-left cell says so. */
export const isDecisionTable = (grid: readonly (readonly string[])[]): boolean => grid[0]?.[0]?.trim() === "Decision ID";

const filled = (row: readonly string[], from = 0, to = row.length) => row.slice(from, to).filter((c) => c.trim() !== "").length;

/**
 * Read a decision table from its block's grid (`grid[0][0]` is `Decision ID`).
 * `top` is the sheet row of `grid[0]`, so the header row can be stated in
 * sheet terms.
 */
export function readDecisionTable(grid: readonly (readonly string[])[], top: number): DecisionTableReading | null {
  if (!isDecisionTable(grid)) return null;
  const width = grid[0]!.length;

  // Preamble: key in the first cell, value in the second, nothing beyond.
  const preamble: { key: string; value: string }[] = [];
  let r = 0;
  while (r < grid.length && grid[r]![0]!.trim() !== "" && filled(grid[r]!, 2) === 0) {
    preamble.push({ key: grid[r]![0]!.trim(), value: grid[r]![1]!.trim() });
    r++;
  }
  if (r >= grid.length) return null;

  // Group row: the first label opens the input span; the next label closes it.
  const groupIdx = r;
  const group = grid[r]!;
  const inputLabel = group[0]!.trim();
  const outStart = group.findIndex((c, i) => i > 0 && c.trim() !== "");
  if (inputLabel === "" || outStart < 0) return null;
  r++;

  // Section rows: only the first cell.
  while (r < grid.length && grid[r]![0]!.trim() !== "" && filled(grid[r]!, 1) === 0) {
    preamble.push({ key: "Section", value: grid[r]![0]!.trim() });
    r++;
  }

  // Title row: inputs present, and every output cell empty or repeating its
  // group label (Hepatitis B (old) repeats `Output`, `Guidance …` there).
  const isTitleRow = (row: readonly string[]) =>
    filled(row, 0, outStart) > 0 && row.every((c, i) => i < outStart || c.trim() === "" || c.trim() === group[i]!.trim());
  const titleRow = r < grid.length && isTitleRow(grid[r]!) ? r : null;
  const dataStart = titleRow === null ? r : r + 1;
  const data = grid.slice(dataStart);
  if (data.length === 0) return null;

  const titles = Array.from({ length: width }, (_, i) => {
    if (i >= outStart) return group[i]!.trim();
    const t = titleRow === null ? "" : grid[titleRow]![i]!.trim();
    return isWildcard(t) ? "" : t;
  });
  const names = columnNames(titles);
  const seen = [...DAK_WILDCARDS].filter((w) => data.some((row) => row.some((c) => c.trim() === w)));
  const columns = names.map((name, i) => ({
    name,
    titles: titles[i]!,
    ...classifyColumn(data.map((row) => (isWildcard(row[i]!) ? "" : row[i]!))),
    ...(i < outStart ? { "fac:group": inputLabel } : {}),
  }));

  return {
    columns,
    headerRow: top + (titleRow ?? groupIdx),
    rows: data.length,
    preamble,
    ...(seen.length > 0 ? { wildcard: seen } : {}),
  };
}
