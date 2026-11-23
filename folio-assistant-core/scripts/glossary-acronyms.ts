#!/usr/bin/env bun
/**
 * Every acronym a folio's prose uses that no glossary it can see holds, with
 * how often, where first, and the expansion the document itself gives (its
 * abbreviations table, or "Long Name (ACR)" in the text). Owner, 2026-10-31:
 * "make QA review identify acronyms for potential inclusion".
 *
 * A REPORT for a person, never an edit: each row is a candidate, and the
 * glossary-terms skill says how to add one (an organization gets `focus`).
 * The per-block QA criterion is `acronym-in-glossary`.
 *
 *   bun run folio-assistant-core/scripts/glossary-acronyms.ts [--folio folio/] [--json] [--all]
 *
 * `--all` lists the acronyms already in a glossary too, marked.
 *
 * @module folio-assistant-core/scripts/glossary-acronyms
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { abbreviationTable, findAcronyms, inlineExpansions, lowerWords, visibleLabels } from "../schemas/acronyms.ts";

export interface AcronymRow {
  acronym: string;
  count: number;
  first: string;
  expansion?: string;
  expansionFrom?: "abbreviations table" | "text";
  inGlossary: boolean;
}

function mdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e.startsWith(".") || e === "node_modules") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...mdFiles(p));
    else if (e.endsWith(".md")) out.push(p);
  }
  return out.sort();
}

/** The rows for every Markdown file under `folio`, most used first. */
export function acronymReport(folio: string, root = process.cwd()): AcronymRow[] {
  const files = mdFiles(folio);
  const table = new Map<string, string>();
  const inline = new Map<string, string>();
  const rows = new Map<string, AcronymRow>();
  const labels = files.length ? visibleLabels(files[0]!) : new Set<string>();
  const texts = files.map((f) => [f, readFileSync(f, "utf-8")] as const);
  const words = new Set<string>();
  for (const [, md] of texts) for (const w of lowerWords(md)) words.add(w);
  for (const [f, md] of texts) {
    for (const [k, v] of abbreviationTable(md)) if (!table.has(k)) table.set(k, v);
    for (const [k, v] of inlineExpansions(md)) if (!inline.has(k)) inline.set(k, v);
    for (const h of findAcronyms(md, words)) {
      const r = rows.get(h.acronym);
      if (r) r.count++;
      else rows.set(h.acronym, { acronym: h.acronym, count: 1, first: `${relative(root, f)}:${h.line}`, inGlossary: labels.has(h.acronym) });
    }
  }
  for (const r of rows.values()) {
    const t = table.get(r.acronym);
    const i = inline.get(r.acronym);
    if (t) Object.assign(r, { expansion: t, expansionFrom: "abbreviations table" });
    else if (i) Object.assign(r, { expansion: i, expansionFrom: "text" });
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.acronym.localeCompare(b.acronym));
}

export function toMarkdown(rows: readonly AcronymRow[], all: boolean): string {
  const shown = all ? rows : rows.filter((r) => !r.inGlossary);
  const cell = (s: string) => s.replace(/\|/g, "\\|");
  return [
    `${rows.filter((r) => !r.inGlossary).length} acronym(s) are in no glossary this folio can see; ${rows.filter((r) => r.inGlossary).length} are.`,
    "",
    "| Acronym | Uses | Expansion the document gives | From | First use |" + (all ? " In glossary |" : ""),
    "|---|---|---|---|---|" + (all ? "---|" : ""),
    ...shown.map(
      (r) =>
        `| ${cell(r.acronym)} | ${r.count} | ${cell(r.expansion ?? "")} | ${r.expansionFrom ?? "none found"} | ${cell(r.first)} |` +
        (all ? ` ${r.inGlossary ? "yes" : "no"} |` : ""),
    ),
  ].join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--folio");
  const folio = at >= 0 ? argv[at + 1]! : "folio";
  const rows = acronymReport(folio);
  console.log(argv.includes("--json") ? JSON.stringify(rows, null, 2) : toMarkdown(rows, argv.includes("--all")));
}
