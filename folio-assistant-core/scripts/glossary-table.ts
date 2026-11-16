#!/usr/bin/env bun
/**
 * glossary-table: draw a document's glossary and acronyms tables from its
 * SKOS glossaries, instead of typing them. The Tool `glossary-table`.
 *
 * Owner, 2026-11-01 (smart-ra, cards Q-RAC-1 B and Q-RAC-8 A): the RA's
 * glossary table and acronyms table restate `glossary/*.glossary.json`, so
 * they are generated from it, and `--check` keeps them from drifting. The
 * editors' marks ("Under review") live on the term as `editorialNote` and
 * print in brackets after the definition, as the document prints them.
 *
 * ## Input
 *
 * `<instance>/glossary/glossary-tables.json`, schema `folio-glossary-tables/v1`:
 *
 * ```json
 * { "$schema": "folio-glossary-tables/v1",
 *   "tables": [{ "glossary": "glossary/x.glossary.json", "block": "folio/doc/glossary/t.md", "kind": "terms" }] }
 * ```
 *
 * Paths are relative to the layer root.
 *
 * ## Kinds
 *
 * - `terms`: one row per term, in the glossary's order. Term: the prefLabel,
 *   then its altLabels in brackets. Description: the definition, then the
 *   editorial note in square brackets.
 * - `acronyms`: one row per term with a `notation`, in the glossary's order:
 *   the notation, then the prefLabel. The first row stands as the table's
 *   header, because the document prints its acronym list with no header row.
 *
 * - `element-types`: the element types of an ArchiMate model's metamodel
 *   view, one row each, as `rows` lists them (smart-ra Q-RAC-7 A, Table 3.1).
 *   The view says which types there are: each row's type must be the type of
 *   a placeholder element on it (an element named after its type). The
 *   glossary says what they mean: the term's prefLabel, its definition and
 *   its `example`, in italics. A type on the view that no row names is
 *   reported, not drawn, since a document may show only some of them.
 *
 * A line break in a label or definition is written `<br>`, so a cell never
 * ends early. Only the first Markdown table of the block is replaced; any
 * caption above it and footnotes below it are the editors'.
 *
 * Usage:
 *   bun run cat glossary:table --instance <dir> [--check]
 *
 * @module folio-assistant-core/scripts/glossary-table
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

import { readArchimate, type ArchimateModel } from "../../cat-harness-tools/archimate/schemas/archimate.ts";
import { isPlaceholder, typeName } from "../../cat-harness-tools/archimate/schemas/metamodel.ts";

import { GlossarySchema, type Glossary, type LangText, type Term } from "../schemas/glossary.ts";
import { GlossaryTablesSchema, type GlossaryTables } from "../schemas/glossary-tables.ts";

export const TOOL_ID = "glossary-table";
export { GLOSSARY_TABLES_SCHEMA_ID, GlossaryTablesSchema, type GlossaryTables } from "../schemas/glossary-tables.ts";
export const GLOSSARY_TABLES_FILE = "glossary/glossary-tables.json";


/** Text in English, or the only language given. */
export function textOf(v: LangText | undefined): string | undefined {
  if (v === undefined || typeof v === "string") return v;
  return v.en ?? Object.values(v)[0];
}

/** A Markdown table cell: a pipe or a line break may not end it early. */
const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

/** The term's label as the glossary table prints it: `Digital Public Infrastructure (DPI)`. */
export function termLabel(t: Term): string {
  const pref = textOf(t.prefLabel) ?? t.id;
  return t.altLabel?.length ? `${pref} (${t.altLabel.join(", ")})` : pref;
}

/** The description cell: the definition, then the editorial note in square brackets. */
export function termDescription(t: Term): string {
  return [textOf(t.definition), t.editorialNote ? `[${t.editorialNote}]` : undefined].filter((x) => x !== undefined).join(" ");
}

export function termsTable(g: Glossary): string {
  return [
    "| **Term** | **Description** |",
    "| --- | --- |",
    // An empty description is one space, as the document's table has it.
    ...g.terms.map((t) => `| ${cell(termLabel(t))} | ${cell(termDescription(t)) || " "} |`),
  ].join("\n");
}

export function acronymsTable(g: Glossary): string {
  const rows = g.terms.filter((t) => t.notation !== undefined).map((t) => `| ${cell(t.notation!)} | ${cell(textOf(t.prefLabel) ?? t.id)} |`);
  if (rows.length === 0) throw new Error(`glossary ${g.id} has no term with a notation, so there is no acronym to list`);
  return [rows[0]!, "| --- | --- |", ...rows.slice(1)].join("\n");
}

type TableEntry = GlossaryTables["tables"][number];
type ElementTypeRow = NonNullable<TableEntry["rows"]>[number];

/** The placeholder element types a view shows, in the order they appear on it. */
export function viewTypes(model: ArchimateModel, viewId: string): string[] {
  const view = model.views.find((v) => v.id === viewId);
  if (!view) throw new Error(`model ${model.name} has no view ${viewId}`);
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const types: string[] = [];
  for (const n of view.nodes) {
    const e = n.kind === "element" && n.ref ? elements.get(n.ref) : undefined;
    if (e && isPlaceholder(e) && !types.includes(e.type)) types.push(e.type);
  }
  return types;
}

/** The term a row's type is defined by: `term` if given, otherwise the one named after the type. */
function termFor(g: Glossary, row: ElementTypeRow): Term {
  const name = typeName(row.type).toLowerCase();
  const t = row.term !== undefined ? g.terms.find((x) => x.id === row.term) : g.terms.find((x) => (textOf(x.prefLabel) ?? "").toLowerCase() === name);
  if (!t) throw new Error(`glossary ${g.id} has no term ${row.term ?? `named "${typeName(row.type)}"`} for ${row.type}`);
  return t;
}

/**
 * The element-types table. Throws when a row's type is not on the view, or
 * its term has no definition, since the table would then say something the
 * model or the glossary does not.
 */
export function elementTypesTable(g: Glossary, shown: string[], rows: ElementTypeRow[]): string {
  const out = ["| **ArchiMate element** | **Element type** | **What it represents** | **Example in the health sector** |", "| --- | --- | --- | --- |"];
  for (const row of rows) {
    if (!shown.includes(row.type)) throw new Error(`${row.type} is not a type on the metamodel view (it shows ${shown.join(", ")})`);
    const t = termFor(g, row);
    const label = textOf(t.prefLabel) ?? t.id;
    const definition = textOf(t.definition);
    if (definition === undefined) throw new Error(`term ${t.id} has no definition, so the table cannot say what ${label} represents`);
    const example = textOf(t.example);
    const icon = row.icon ? `![${label}](${row.icon})` : " ";
    out.push(`| ${cell(icon)} | **${cell(label)}** | ${cell(definition)} | ${example ? `*${cell(example)}*` : " "} |`);
  }
  return out.join("\n");
}

/** Replace the first Markdown table in `md`, keeping what is above and below it. */
export function replaceTable(md: string, table: string): string {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trimStart().startsWith("|"));
  if (start < 0) return `${md.replace(/\n*$/, "")}\n\n${table}\n`;
  let end = start;
  while (end < lines.length && lines[end]!.trimStart().startsWith("|")) end++;
  return [...lines.slice(0, start), ...table.split("\n"), ...lines.slice(end)].join("\n");
}

function readJson<T>(path: string, schema: z.ZodType<T>): T {
  const r = schema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!r.success) throw new Error(`${path}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return r.data;
}

function tableOf(instanceRoot: string, t: TableEntry, g: Glossary): { table: string; notShown: string[] } {
  if (t.kind === "terms") return { table: termsTable(g), notShown: [] };
  if (t.kind === "acronyms") return { table: acronymsTable(g), notShown: [] };
  const a = t.archimate!;
  const shown = viewTypes(readArchimate(readFileSync(join(instanceRoot, a.model))), a.view);
  const rows = t.rows ?? shown.map((type) => ({ type }));
  return { table: elementTypesTable(g, shown, rows), notShown: shown.filter((x) => !rows.some((r) => r.type === x)) };
}

/**
 * Each block the config names, and what it should hold. `notShown` lists the
 * types an element-types table's view has and its rows leave out.
 */
export function glossaryTablesOf(instanceRoot: string): Array<{ block: string; content: string; notShown: string[] }> {
  const config = readJson(join(instanceRoot, GLOSSARY_TABLES_FILE), GlossaryTablesSchema);
  return config.tables.map((t) => {
    const g = readJson(join(instanceRoot, t.glossary), GlossarySchema);
    const blockPath = join(instanceRoot, t.block);
    if (!existsSync(blockPath)) throw new Error(`${t.block}: no such block`);
    const { table, notShown } = tableOf(instanceRoot, t, g);
    return { block: t.block, content: replaceTable(readFileSync(blockPath, "utf8"), table), notShown };
  });
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const instance = arg("instance");
  if (!instance) {
    console.error("usage: glossary-table.ts --instance <dir> [--check]");
    process.exit(2);
  }
  const root = resolve(instance);
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const o of glossaryTablesOf(root)) {
    if (o.notShown.length) console.error(`ℹ ${o.block}: the view also shows ${o.notShown.join(", ")}, which no row names`);
    const p = join(root, o.block);
    if (readFileSync(p, "utf8") === o.content) continue;
    if (check) {
      stale++;
      console.log(`✗ ${o.block} is not what the glossary draws; run glossary:table to rewrite it`);
    } else {
      writeFileSync(p, o.content);
      console.error(`wrote ${o.block}`);
    }
  }
  if (check && stale === 0) console.log("✓ every glossary table matches its glossary");
  if (stale) process.exit(1);
}
