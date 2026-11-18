#!/usr/bin/env bun
/**
 * Report which of a folio's computation witnesses meet the producer contract.
 *
 * @module cat-harness-tools/scripts/witness-conformance
 *
 * Every witness in the folio's declared `computation-witness` directories is
 * read and checked against the two schemas in
 * `cat-harness/schemas/computation-witness.ts`:
 *
 * - the ENVELOPE, which every witness should meet. A failure means the file is
 *   malformed. So does a file that is not strict JSON, which Python's reader
 *   accepts (`NaN`, `Infinity`) and every other consumer rejects.
 * - the CONTRACT a producer is meant to meet. A failure is a FINDING against
 *   the producer, grouped by the fields it got wrong.
 *
 * **It reports and never writes.** A witness is generator output, and on a
 * mathematics folio its numbers are content a migration may not change. The
 * remedy for a finding is a change to the producer, then a re-run, decided
 * case by case.
 *
 *   bun run cat witness:conformance                  # the folio in the cwd
 *   bun run cat witness:conformance --dir <path>     # a directory, declared or not
 *   bun run cat witness:conformance --json           # machine-readable
 *   bun run cat witness:conformance --strict         # exit 1 on a malformed file
 *
 * Without `--dir` and with no declared directory, it says so and exits 2: a
 * clean report over nothing is not a pass.
 */
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Glob } from "bun";
import { directoriesForGraph, layerRootsIn } from "../schemas/kg/cat-harness.js";
import {
  ComputationWitnessConformanceSchema,
  ComputationWitnessSchema,
  WITNESS_SUFFIX,
} from "../schemas/computation-witness.ts";
import { findContentRepoRoot } from "../pipeline/repo-root.ts";

export interface ConformanceReport {
  directories: string[];
  witnesses: number;
  notStrictJson: string[];
  malformed: { file: string; issue: string }[];
  conforming: number;
  /** Contract failures, keyed by the sorted set of top-level fields at fault. */
  findings: { fields: string; count: number; example: string }[];
}

/** Check every `*.witness.json` under `dirs`; paths are reported relative to `root`. */
export function checkWitnesses(dirs: string[], root: string): ConformanceReport {
  const report: ConformanceReport = {
    directories: dirs.map((d) => relative(root, d) || "."),
    witnesses: 0,
    notStrictJson: [],
    malformed: [],
    conforming: 0,
    findings: [],
  };
  const groups = new Map<string, { count: number; example: string }>();
  const seen = new Set<string>();
  for (const dir of dirs) {
    for (const f of new Glob(`**/*${WITNESS_SUFFIX}`).scanSync({ cwd: dir, dot: false })) {
      const abs = join(dir, f);
      if (seen.has(abs) || abs.includes("/node_modules/")) continue;
      seen.add(abs);
      const rel = relative(root, abs);
      report.witnesses++;
      let node: unknown;
      try {
        node = JSON.parse(readFileSync(abs, "utf8"));
      } catch {
        report.notStrictJson.push(rel);
        continue;
      }
      const env = ComputationWitnessSchema.safeParse(node);
      if (!env.success) {
        const i = env.error.issues[0];
        report.malformed.push({ file: rel, issue: `${i?.path.join(".") || "(root)"}: ${i?.message}` });
        continue;
      }
      const con = ComputationWitnessConformanceSchema.safeParse(node);
      if (con.success) {
        report.conforming++;
        continue;
      }
      const fields = [...new Set(con.error.issues.map((i) => String(i.path[0] ?? "(root)")))].sort().join(", ");
      const g = groups.get(fields) ?? { count: 0, example: rel };
      g.count++;
      groups.set(fields, g);
    }
  }
  report.findings = [...groups].map(([fields, g]) => ({ fields, ...g })).sort((a, b) => b.count - a.count);
  return report;
}

function main(): number {
  const argv = process.argv.slice(2);
  const dirArg = argv.includes("--dir") ? argv[argv.indexOf("--dir") + 1] : undefined;
  const root = findContentRepoRoot();
  const dirs = dirArg
    ? [resolve(dirArg)]
    : [...new Set(layerRootsIn(root).flatMap((inst) => directoriesForGraph(inst, "computation-witness")))];
  if (dirs.length === 0) {
    console.error(
      "witness:conformance: no directory declares the `computation-witness` graph typology here, so there is " +
        "nothing to check. Declare one in the instance's <instance>.json, or pass --dir.",
    );
    return 2;
  }
  const r = checkWitnesses(dirs, root);
  if (argv.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    const contract = r.witnesses - r.notStrictJson.length - r.malformed.length;
    console.log(`witness:conformance over ${r.directories.join(", ")}: ${r.witnesses} witness(es)`);
    console.log(`  not strict JSON (NaN/Infinity or similar): ${r.notStrictJson.length}`);
    for (const f of r.notStrictJson.slice(0, 10)) console.log(`    ${f}`);
    console.log(`  malformed against the envelope: ${r.malformed.length}`);
    for (const m of r.malformed.slice(0, 10)) console.log(`    ${m.file} — ${m.issue}`);
    console.log(`  meet the producer contract: ${r.conforming} of ${contract}`);
    if (r.findings.length) console.log("  contract findings, by the fields at fault (a finding against the producer):");
    for (const g of r.findings.slice(0, 20)) console.log(`    ${g.count}  [${g.fields}]  e.g. ${g.example}`);
    if (r.findings.length > 20) console.log(`    … ${r.findings.length - 20} more group(s); --json lists every one`);
  }
  return argv.includes("--strict") && (r.malformed.length || r.notStrictJson.length) ? 1 : 0;
}

if (import.meta.main) process.exit(main());
