#!/usr/bin/env bun
/**
 * Write the document blocks a layer draws from its ArchiMate data: each
 * table `cat-archimate.config.json` lists under `tables`, and the SVG of each
 * figure under `figures` that names an `svg`. The Tool `archimate-blocks`.
 *
 * @module cat-harness/archimate/scripts/archimate-blocks
 * @conformsTo opengroup-archimate-3.0
 * @covers archimate
 *
 * Owner, 2026-11-01 (smart-ra Q-RAC-1 "B"): the reference architecture's
 * tables and figures that restate the model are generated, not typed. A table
 * is rewritten in place: the caption above it and any footnote below it are
 * the editors', and are left alone. A figure's SVG is drawn from the view by
 * `render-view.ts`, the same drawing the view's own page shows.
 *
 * A `relationship-rules` table with a `model` also checks the model against
 * the rules (`schemas/rules.ts`). The rules are in charge: a relationship no
 * rule covers is reported, never added to the table.
 *
 * Usage:
 *   bun run cat archimate:blocks --instance <dir> [--check] [--strict] [--format text|json]
 *
 * Without `--check` it writes every block and SVG. With `--check` it writes
 * nothing and exits 1 when a block or SVG is not what the data draws. The
 * rules check only reports, unless `--strict`, which also exits 1 when the
 * model breaks a rule or a rule is one ArchiMate does not allow.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readArchimate, type ArchimateConfig, type ArchimateModel } from "../schemas/archimate.ts";
import { relationshipTable } from "../schemas/metamodel.ts";
import {
  checkRules,
  relationshipTypesTableMarkdown,
  RelationshipRulesSchema,
  rulesCheckReport,
  rulesTableMarkdown,
  type RelationshipRules,
  type RulesCheck,
} from "../schemas/rules.ts";
import { archimateDir, readConfig } from "./check-archimate.ts";
import { renderViewSvg } from "./render-view.ts";
import { posterFits, renderPosterSvg } from "./render-poster.ts";

export const TOOL_ID = "archimate-blocks";

/**
 * Replace the first Markdown table in `md` with `table`, keeping everything
 * before it (the caption) and after it (footnotes). A block with no table
 * gets the table after its text.
 */
export function replaceTable(md: string, table: string): string {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trimStart().startsWith("|"));
  if (start < 0) return `${md.replace(/\n*$/, "")}\n\n${table}\n`;
  let end = start;
  while (end < lines.length && lines[end]!.trimStart().startsWith("|")) end++;
  return [...lines.slice(0, start), ...table.split("\n"), ...lines.slice(end)].join("\n");
}

/** The rules file a table names, read and validated. */
export function readRules(path: string): RelationshipRules {
  const r = RelationshipRulesSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!r.success) throw new Error(`${path}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return r.data;
}

/** One file the Tool writes, and what it should hold. */
export interface BlockOutput {
  /** Instance-relative path. */
  path: string;
  /** What draws it: `Table 3.3`, `Figure 3.7.1`. */
  label: string;
  content: string;
}

export interface BlocksResult {
  outputs: BlockOutput[];
  checks: Array<{ label: string; check: RulesCheck }>;
}

/** Everything the config draws, without writing anything. */
export function blocksOf(instanceRoot: string, config: ArchimateConfig = readConfig(instanceRoot)): BlocksResult {
  const dir = archimateDir(instanceRoot, config);
  const models = new Map<string, ArchimateModel>();
  const modelOf = (id: string): ArchimateModel => {
    let m = models.get(id);
    if (m === undefined) {
      const decl = config.models.find((x) => x.id === id);
      if (decl === undefined) throw new Error(`no model "${id}" in ${config.models.map((x) => x.id).join(", ")}`);
      m = readArchimate(readFileSync(join(dir, decl.file)));
      models.set(id, m);
    }
    return m;
  };
  const outputs: BlockOutput[] = [];
  const checks: BlocksResult["checks"] = [];
  for (const t of config.tables ?? []) {
    const blockPath = join(instanceRoot, t.block);
    if (!existsSync(blockPath)) throw new Error(`${t.label}: block ${t.block} does not exist`);
    const rules = readRules(join(dir, t.rules));
    const table = t.kind === "relationship-rules" ? rulesTableMarkdown(rules) : relationshipTypesTableMarkdown(rules);
    outputs.push({ path: t.block, label: t.label, content: replaceTable(readFileSync(blockPath, "utf8"), table) });
    if (t.kind === "relationship-rules" && t.model !== undefined) {
      checks.push({ label: t.label, check: checkRules(modelOf(t.model), t.model, rules, relationshipTable()) });
    }
  }
  for (const f of config.figures ?? []) {
    if (f.svg === undefined) continue;
    const m = modelOf(f.model);
    const view = m.views.find((v) => v.id === f.view);
    if (view === undefined) throw new Error(`${f.label}: model ${f.model} has no view ${f.view}`);
    // The same drawing the view's own page shows: a poster for a banded view, the themed layout otherwise.
    outputs.push({ path: f.svg, label: f.label, content: posterFits(m, view) ? renderPosterSvg(m, view, config.poster) : renderViewSvg(m, view) });
  }
  return { outputs, checks };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const instance = arg("instance");
  const format = arg("format") ?? "text";
  if (!instance || !["text", "json"].includes(format)) {
    console.error("usage: archimate-blocks.ts --instance <dir> [--check] [--strict] [--format text|json]");
    process.exit(2);
  }
  const root = resolve(instance);
  const check = process.argv.includes("--check");
  const { outputs, checks } = blocksOf(root);
  const stale: string[] = [];
  for (const o of outputs) {
    const p = join(root, o.path);
    const now = existsSync(p) ? readFileSync(p, "utf8") : undefined;
    if (now === o.content) continue;
    if (check) stale.push(`${o.label}: ${o.path} is not what the data draws; run archimate:blocks to rewrite it`);
    else {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, o.content);
      console.error(`wrote ${o.path} (${o.label})`);
    }
  }
  if (format === "json") console.log(JSON.stringify({ outputs: outputs.map((o) => ({ path: o.path, label: o.label })), stale, checks }, null, 2));
  else {
    for (const s of stale) console.log(`✗ ${s}`);
    if (!stale.length) console.log(`✓ ${outputs.length} block(s) and SVG(s) match the data`);
    for (const c of checks) console.log(rulesCheckReport(c.check, c.label));
  }
  const broken = checks.some((c) => c.check.uncovered.length > 0 || c.check.notAllowed.length > 0);
  if (stale.length || (process.argv.includes("--strict") && broken)) process.exit(1);
}
