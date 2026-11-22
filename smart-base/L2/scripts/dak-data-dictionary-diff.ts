#!/usr/bin/env bun
/**
 * dak-data-dictionary-diff.ts: what changed between two DAK data-dictionary
 * annexes, term by term. It is the diff a glossary or core-data-element
 * reviewer reads.
 *
 * Owner, 2026-10-14: every L2 component's agent-edit, human-review
 * subprocess documents its skills and tools, and builds a missing tool when
 * it is small. `l2-component-edit-review.bpmn` renders a glossary change for
 * its reviewer as a TERM diff: which data elements were added, removed or
 * changed, and in which cells. A word diff of the annex JSON is unreadable,
 * because a reordered sheet moves every line. A picture of the rendered
 * table hides a one-cell edit in a 400-row workbook.
 *
 * ## Keyed by the data element id, never by position
 *
 * Both annexes are `dak-data-dictionary/v1` (`schemas/dak-annexes.ts`), so
 * each names its `idColumn`. A row is matched to its counterpart by that id.
 * Cells are matched by column KEY (`headerKey`), so a column that moved is
 * not a change, and a column added or dropped is reported once per sheet
 * rather than once per row. An id that moves to another sheet is reported as
 * moved, not as a removal plus an addition.
 *
 * ## What it does not judge
 *
 * Whether a change is right. That is the reviewer's call. Whether ids are
 * unique and references resolve is `check-web-annexes.ts`, the glossary
 * checker that runs beside this diff in the same subprocess. A duplicated id
 * in either input is refused here (exit 2), not diffed, because "which row
 * is IMMZ.C.DE.1" would have two answers.
 *
 *   bun run smart-base/L2/scripts/dak-data-dictionary-diff.ts <before.json> <after.json> [--json]
 *
 * Exit: 0 no term changed · 1 terms changed (the diff is printed) · 2 an
 * input is unreadable or ambiguous.
 *
 * @module smart-base/L2/scripts/dak-data-dictionary-diff
 */
import { readFileSync } from "node:fs";

import { DakDataDictionaryAnnexSchema, type DakDataDictionaryAnnex } from "../../schemas/dak-annexes.ts";

export interface CellChange {
  column: string;
  before: string;
  after: string;
}

export interface TermDiff {
  /** Data elements present only in `after`, as `{ id, sheet, label }`. */
  added: { id: string; sheet: string; label: string }[];
  /** Data elements present only in `before`. */
  removed: { id: string; sheet: string; label: string }[];
  /** Data elements in both whose cells differ, with each cell named. */
  changed: { id: string; sheet: string; label: string; cells: CellChange[] }[];
  /** Data elements whose sheet changed. Their cells are compared as well. */
  moved: { id: string; from: string; to: string }[];
  /** Column keys added or dropped, per sheet name. */
  columns: { sheet: string; added: string[]; removed: string[] }[];
}

interface Term {
  sheet: string;
  cells: Map<string, string>;
}

const LABEL_KEY = "data element label";

/** Every data element of an annex by id. Refuses an id used twice. */
export function termsOf(annex: DakDataDictionaryAnnex): Map<string, Term> {
  const out = new Map<string, Term>();
  for (const s of annex.sheets) {
    const at = s.columns.findIndex((c) => c.key === annex.idColumn);
    if (at < 0) continue;
    for (const r of s.rows) {
      const id = (r[at] ?? "").trim();
      if (!id) continue;
      if (out.has(id)) throw new Error(`data element ${id} appears twice (sheets "${out.get(id)!.sheet}" and "${s.name}")`);
      out.set(id, { sheet: s.name, cells: new Map(s.columns.map((c, i) => [c.key, r[i] ?? ""])) });
    }
  }
  return out;
}

/** The term-level diff of two annexes. */
export function diffDataDictionary(before: DakDataDictionaryAnnex, after: DakDataDictionaryAnnex): TermDiff {
  const a = termsOf(before);
  const b = termsOf(after);
  const label = (t: Term) => t.cells.get(LABEL_KEY) ?? "";
  const diff: TermDiff = { added: [], removed: [], changed: [], moved: [], columns: [] };

  for (const [id, t] of b) if (!a.has(id)) diff.added.push({ id, sheet: t.sheet, label: label(t) });
  for (const [id, t] of a) if (!b.has(id)) diff.removed.push({ id, sheet: t.sheet, label: label(t) });
  for (const [id, was] of a) {
    const now = b.get(id);
    if (!now) continue;
    if (was.sheet !== now.sheet) diff.moved.push({ id, from: was.sheet, to: now.sheet });
    // Only columns both sides carry: a column added or dropped is reported
    // once, in `columns`, not as a change to every row.
    const cells: CellChange[] = [];
    for (const [col, v] of was.cells) {
      if (!now.cells.has(col)) continue;
      const w = now.cells.get(col)!;
      if (v !== w) cells.push({ column: col, before: v, after: w });
    }
    if (cells.length) diff.changed.push({ id, sheet: now.sheet, label: label(now), cells });
  }

  const cols = (x: DakDataDictionaryAnnex) => new Map(x.sheets.map((s) => [s.name, new Set(s.columns.map((c) => c.key))]));
  const ca = cols(before);
  const cb = cols(after);
  for (const [sheet, now] of cb) {
    const was = ca.get(sheet);
    if (!was) continue;
    const added = [...now].filter((k) => !was.has(k));
    const removed = [...was].filter((k) => !now.has(k));
    if (added.length || removed.length) diff.columns.push({ sheet, added, removed });
  }
  for (const k of ["added", "removed", "changed"] as const) diff[k].sort((x, y) => x.id.localeCompare(y.id));
  diff.moved.sort((x, y) => x.id.localeCompare(y.id));
  return diff;
}

/** True when nothing a reviewer would read changed. */
export const isEmpty = (d: TermDiff) =>
  !d.added.length && !d.removed.length && !d.changed.length && !d.moved.length && !d.columns.length;

/** The diff as Markdown, for a review request or a PR comment. */
export function renderMarkdown(d: TermDiff): string {
  if (isEmpty(d)) return "No data element changed.\n";
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lines: string[] = [
    `**${d.added.length} added, ${d.removed.length} removed, ${d.changed.length} changed, ${d.moved.length} moved.**`,
    "",
  ];
  if (d.added.length) {
    lines.push("### Added", "", "| id | sheet | label |", "|---|---|---|");
    for (const t of d.added) lines.push(`| ${esc(t.id)} | ${esc(t.sheet)} | ${esc(t.label)} |`);
    lines.push("");
  }
  if (d.removed.length) {
    lines.push("### Removed", "", "| id | sheet | label |", "|---|---|---|");
    for (const t of d.removed) lines.push(`| ${esc(t.id)} | ${esc(t.sheet)} | ${esc(t.label)} |`);
    lines.push("");
  }
  if (d.changed.length) {
    lines.push("### Changed", "", "| id | label | column | before | after |", "|---|---|---|---|---|");
    for (const t of d.changed) for (const c of t.cells) lines.push(`| ${esc(t.id)} | ${esc(t.label)} | ${esc(c.column)} | ${esc(c.before)} | ${esc(c.after)} |`);
    lines.push("");
  }
  if (d.moved.length) {
    lines.push("### Moved between sheets", "", "| id | from | to |", "|---|---|---|");
    for (const m of d.moved) lines.push(`| ${esc(m.id)} | ${esc(m.from)} | ${esc(m.to)} |`);
    lines.push("");
  }
  if (d.columns.length) {
    lines.push("### Columns", "");
    for (const c of d.columns) {
      if (c.added.length) lines.push(`- ${c.sheet}: added ${c.added.join(", ")}`);
      if (c.removed.length) lines.push(`- ${c.sheet}: removed ${c.removed.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length !== 2) {
    console.error("usage: dak-data-dictionary-diff.ts <before.json> <after.json> [--json]");
    process.exit(2);
  }
  let d: TermDiff;
  try {
    const [before, after] = files.map((f) => DakDataDictionaryAnnexSchema.parse(JSON.parse(readFileSync(f, "utf8"))));
    d = diffDataDictionary(before!, after!);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(2);
  }
  process.stdout.write(args.includes("--json") ? `${JSON.stringify(d, null, 1)}\n` : renderMarkdown(d));
  process.exit(isEmpty(d) ? 0 : 1);
}
