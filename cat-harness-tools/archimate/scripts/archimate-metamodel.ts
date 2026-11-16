#!/usr/bin/env bun
/**
 * Derive the metamodel each ArchiMate model of a layer uses, and check it
 * against ArchiMate's relationship table. The Tool `archimate-metamodel`.
 *
 * @module cat-harness/archimate/scripts/archimate-metamodel
 * @conformsTo opengroup-archimate-3.0
 * @covers archimate
 *
 * What it reports, per model (`schemas/metamodel.ts`):
 *
 * - the element types used, with counts;
 * - every (source type, relationship, target type) pattern, with counts, and
 *   whether ArchiMate allows it;
 * - placeholder elements, named after their own type, which is how a
 *   metamodel gets drawn by hand inside a model.
 *
 * `archimate-pages` draws the same result on each model's "Metamodel in use"
 * page; this is the command-line half, for a check in CI and for an author
 * asking "what does my model actually use?".
 *
 * Usage:
 *   bun run cat archimate:metamodel --instance <dir> [--model <id>] [--format text|json|dot|mmd] [--check]
 *
 * `--check` exits 1 when any relationship follows a pattern ArchiMate does not
 * allow. Placeholders are reported, never fatal: removing them is the model
 * authors' call.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readArchimate } from "../schemas/archimate.ts";
import { metamodelDot, metamodelMermaid, metamodelOf, typeName, verbOf, type Metamodel } from "../schemas/metamodel.ts";
import { archimateDir, readConfig } from "./check-archimate.ts";

export const TOOL_ID = "archimate-metamodel";
const FORMATS = ["text", "json", "dot", "mmd"] as const;
type Format = (typeof FORMATS)[number];

/** The metamodel of every model the layer's config names, or of one. */
export function metamodelsOf(instanceRoot: string, only?: string): Metamodel[] {
  const config = readConfig(instanceRoot);
  const dir = archimateDir(instanceRoot, config);
  const models = config.models.filter((m) => only === undefined || m.id === only);
  if (only !== undefined && models.length === 0) {
    throw new Error(`no model "${only}" in ${config.models.map((m) => m.id).join(", ")}`);
  }
  return models.map((m) => metamodelOf(readArchimate(readFileSync(join(dir, m.file))), m.id));
}

/** A plain-text report: what a person reads in a terminal or a CI log. */
export function report(mm: Metamodel): string {
  const lines = [
    `${mm.model} (${mm.name}): ${mm.types.length} element type(s), ${mm.patterns.length} relationship pattern(s), checked against ArchiMate ${mm.archimateVersion}`,
  ];
  const bad = mm.patterns.filter((p) => p.allowed === false);
  const unknown = mm.patterns.filter((p) => p.allowed === undefined);
  lines.push(bad.length ? `  ✗ ${mm.notAllowed} relationship(s) in ${bad.length} pattern(s) ArchiMate does not allow:` : "  ✓ every relationship follows a pattern ArchiMate allows");
  for (const p of bad) lines.push(`    ${typeName(p.source)} ${verbOf(p.relationship)} ${typeName(p.target)} ×${p.count}: ${p.relationships.slice(0, 5).join(", ")}${p.count > 5 ? ", …" : ""}`);
  for (const p of unknown) lines.push(`  ? not in the table: ${p.source} ${p.relationship} ${p.target} ×${p.count}`);
  if (mm.placeholders.length) {
    lines.push(
      `  ! ${mm.placeholders.length} placeholder element(s) named after their own type, with ${mm.placeholderRelationships.length} relationship(s), left out of the patterns:`,
      `    ${mm.placeholders.map((e) => e.name).join(", ")}`,
    );
  }
  return lines.join("\n");
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const instance = arg("instance");
  const format = (arg("format") ?? "text") as Format;
  if (!instance || !FORMATS.includes(format)) {
    console.error(`usage: archimate-metamodel.ts --instance <dir> [--model <id>] [--format ${FORMATS.join("|")}] [--check]`);
    process.exit(2);
  }
  const all = metamodelsOf(resolve(instance), arg("model"));
  if (format === "json") console.log(JSON.stringify(all.length === 1 ? all[0] : all, null, 2));
  else if (format === "dot" || format === "mmd") {
    if (all.length !== 1) {
      console.error(`--format ${format} draws one model: pass --model (${all.map((m) => m.model).join(", ")})`);
      process.exit(2);
    }
    process.stdout.write(format === "dot" ? metamodelDot(all[0]) : metamodelMermaid(all[0]));
  } else console.log(all.map(report).join("\n"));
  if (process.argv.includes("--check") && all.some((m) => m.notAllowed > 0)) process.exit(1);
}
