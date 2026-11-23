#!/usr/bin/env bun
/**
 * Every recorded waiver is well formed, in a gate class that exists, and dated.
 *
 * Skill: `skills/conduct/conduct-core/confirmation-waiver.md` (a person may
 * waive confirmation, e.g. for a session or a process run).
 *
 * A node that does not parse against {@link WaiverNodeSchema} is **no
 * waiver**, reported loudly, and the gate it named stands. `gate` is a closed
 * enum, so a waiver over a non-waivable rule fails at the schema.
 *
 * | | |
 * |---|---|
 * | **in force** | parses, unexpired — listed, because a waived action is an announced one |
 * | **inert** | parses, expired — history, kept and never deleted, never a finding |
 * | **malformed** | does not parse, or the clock cannot be read — a defect, and loud |
 *
 * A declared directory holding no waiver node is a **determined empty** (no
 * waiver granted). A directory that cannot be READ exits 2, unknown.
 *
 * It reads the directories declaring the `waiver` graph (shared with
 * `memory`), so a file is a waiver by its `$schema` tag and nothing else.
 *
 * @module folio-assistant/scripts/check-waivers
 * @covers waiver
 */

import { HARNESS_ROOT } from "./lib/roots.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { WaiverNodeSchema, waiverState, type WaiverNode } from "../schemas/conduct/waiver.js";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";
import { gateDirectoriesForGraph } from "./lib/gate-own.ts";

/** The LAYER root — this file lives at `<instance>/scripts/`. */
export const INSTANCE_ROOT = HARNESS_ROOT;

/**
 * The tag that makes a file in the directory a waiver.
 *
 * The `waiver` graph is declared over the SAME directory as `memory`, so the
 * two are told apart by what each file says it is — which is the rule the
 * directory conventions already state: *"Extension is a coincidence; a
 * declaration inside the file is the contract."* The first draft of this
 * module instead hardcoded `memory/waivers/` and `check:declared-paths`
 * refused it, correctly: a literal naming a declared directory is exactly what
 * that gate exists to catch, and the subdirectory would have been a second
 * answer to a question `harness.json` already answers.
 */
export const WAIVER_SCHEMA_TAG = "folio-waiver/v1";

export interface WaiverReport {
  /** The directory examined, or `null` when the graph is declared nowhere. */
  store: string | null;
  inForce: { file: string; node: WaiverNode }[];
  inert: { file: string; node: WaiverNode }[];
  malformed: { file: string; reason: string }[];
}

/**
 * Read every waiver in the declared `waiver` graph, or in `dirs` when a gate
 * scoped them to its caller's own (owner ruling 2026-11-05, "Move the checks"; `lib/gate-own.ts`).
 */
export function checkWaivers(
  root: string = INSTANCE_ROOT,
  now: Date = new Date(),
  dirs: readonly string[] = corpusDirectoriesForGraph(root, "waiver"),
): WaiverReport {
  const out: WaiverReport = { store: null, inForce: [], inert: [], malformed: [] };
  if (dirs.length === 0) return out;
  out.store = dirs.join(", ");
  const files: { dir: string; name: string }[] = [];
  for (const dir of dirs) {
    for (const name of readdirSync(dir).sort()) if (name.endsWith(".json")) files.push({ dir, name });
  }
  for (const { dir, name } of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, name), "utf8"));
    } catch (e) {
      out.malformed.push({ file: name, reason: `not readable JSON: ${e instanceof Error ? e.message : e}` });
      continue;
    }
    // Another graph's node sharing the directory is not this check's business.
    if ((parsed as { $schema?: unknown })?.$schema !== WAIVER_SCHEMA_TAG) continue;
    const r = WaiverNodeSchema.safeParse(parsed);
    if (!r.success) {
      out.malformed.push({ file: name, reason: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") });
      continue;
    }
    const state = waiverState(r.data, now);
    if (state === "unknown") {
      out.malformed.push({ file: name, reason: `expires ${JSON.stringify(r.data.expires)} is not a readable timestamp` });
    } else if (state === "in-force") {
      out.inForce.push({ file: name, node: r.data });
    } else {
      out.inert.push({ file: name, node: r.data });
    }
  }
  return out;
}

function formatReport(r: WaiverReport): string {
  if (r.store === null) {
    return "Confirmation waivers\n  · no `waiver` graph is declared here — every gate asks.";
  }
  if (r.inForce.length + r.inert.length + r.malformed.length === 0) {
    return "Confirmation waivers\n  · none recorded — every gate asks. (A determined empty, not an unknown.)";
  }
  const out = [`Confirmation waivers (${r.inForce.length} in force, ${r.inert.length} inert)`];
  for (const { node } of r.inForce) {
    out.push(`  • ${node.gate} — ${node.scope}, expires ${node.expires}, granted by ${node.grantedBy}`);
    out.push(`      "${node.quote}"`);
    if (node.bounds) out.push(`      bounded to: ${node.bounds}`);
  }
  for (const { file } of r.inert) out.push(`  · inert (expired): ${file} — kept as history, never deleted`);
  for (const m of r.malformed) out.push(`  ✗ ${m.file}: ${m.reason}`);
  if (r.malformed.length) {
    out.push("");
    out.push("  A malformed waiver is NOT a lenient one. The gate it named still stands.");
    out.push("  Fields and their reasons: skills/conduct/conduct-core/confirmation-waiver.md");
  }
  return out.join("\n");
}

if (import.meta.main) {
  let report: WaiverReport;
  try {
    report = checkWaivers(INSTANCE_ROOT, undefined, gateDirectoriesForGraph(INSTANCE_ROOT, "waiver").dirs);
  } catch (e) {
    console.error(`Could not check waivers: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass, and it is NOT a waiver. Treat it as unknown and ask.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.malformed.length ? 1 : 0);
}
