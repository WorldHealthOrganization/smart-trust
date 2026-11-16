/**
 * Check that every declared workflow relaxation is legal.
 *
 * The base processes are strict: `editing-hci-validation`, `draft-to-publication`
 * and `content-lifecycle` refuse a step that is not enabled. A content package
 * may relax a step by naming it in `skills/<package>/workflow-policy.json` with
 * a reason — but not a step the BPMN marks `relaxable="false"`, and not one
 * that does not exist.
 *
 * Runs over the whole repo, so a relaxation that stopped applying (renamed
 * activity, step made non-relaxable) fails the build.
 *
 * Usage:  bun run cat check:workflow-policy
 *
 * @covers none — .github/workflows/ is not a declared graph typology
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { existsSync } from "node:fs";
import { workflowFiles, corpusScopeFor, declaredKgDirectories } from "./known-skills.js";
import { loadProcessModel, processDiagrams } from "../src/workflow/process-model.js";
import { inactiveRelaxations, loadRelaxations, validateRelaxations, PolicyError } from "../src/workflow/gate.js";

const root = HARNESS_ROOT;
const scope = corpusScopeFor(root);
// Every declared knowledge-graph directory, opt-in sub-graphs INCLUDED,
// switched on or not. A relaxation is a declaration about a process, and
// whether this root switches that process's group on does not make the
// declaration right or wrong: judged against the enabled set only, a correct
// relaxation of a process in a switched-off group read as "not a process
// here". A process this script cannot see is one whose relaxations go
// unchecked, so it reads every group that is on disk.
const diagrams = processDiagrams(workflowFiles(root, scope, { enabledSubgraphs: "all" }));
const models = await Promise.all(diagrams.map((f) => loadProcessModel(f)));
// The processes this root switches ON. A relaxation of a process only a
// switched-off group holds is judged above like any other, and then reported
// INACTIVE, not as an error (owner, 2026-11-13): it relaxes nothing here
// until a root switches that group on.
const switchedOn = new Set(processDiagrams(workflowFiles(root, scope)));
const active = new Set(models.filter((_, i) => switchedOn.has(diagrams[i]!)).map((m) => m.id));
// Opt-in groups declared but not on disk: the mount leaves a switched-off
// group out, so a process in one cannot be read here at all.
const unseen = declaredKgDirectories(root, scope, { enabledSubgraphs: "all" })
  .filter((d) => d.optInSubgraph !== undefined && !existsSync(d.absPath))
  .map((d) => `${d.optInSubgraph} (${d.path})`);

console.log("Processes");
for (const m of models) {
  const locked = [...m.nodes.values()].filter((n) => !n.relaxable);
  console.log(
    `  ${m.enforcement === "strict" ? "🔒" : "  "} ${m.id.padEnd(24)} ${m.enforcement}` +
      (locked.length ? `   non-relaxable: ${locked.map((n) => n.id).join(", ")}` : ""),
  );
}

let relaxations;
let undetermined: Awaited<ReturnType<typeof loadRelaxations>> = [];
let inactive: Awaited<ReturnType<typeof loadRelaxations>> = [];
try {
  relaxations = loadRelaxations(root);
  undetermined = validateRelaxations(relaxations, models, { unseen });
  inactive = inactiveRelaxations(relaxations, active, undetermined);
} catch (e) {
  console.error(`\n✗ ${e instanceof PolicyError ? e.message : String(e)}\n`);
  process.exit(1);
}

console.log("\nDeclared relaxations");
if (relaxations.length === 0) {
  console.log("  (none — every package takes the base processes as they stand)");
}
for (const r of relaxations) {
  console.log(`  ${r.package} → ${r.process}/${r.activity}${inactive.includes(r) ? "   (inactive here)" : ""}\n      ${r.reason}`);
  if (r.scope) console.log(`      scope: ${r.scope}`);
}
if (undetermined.length > 0) {
  console.log(`\nUndetermined: ${undetermined.length} relaxation(s) name a process in no group on disk, and these groups are declared but not mounted here:`);
  for (const u of unseen) console.log(`  ${u}`);
  for (const r of undetermined) console.log(`  ? ${r.package} → ${r.process}/${r.activity}`);
  console.log(`  Judged where those groups are mounted; not counted as legal here.`);
}
if (inactive.length > 0) {
  console.log(`\nInactive: ${inactive.length} legal relaxation(s) name a process only a switched-off opt-in group holds; each relaxes nothing here until a root switches its group on:`);
  for (const r of inactive) console.log(`  · ${r.package} → ${r.process}/${r.activity}`);
}
const legal = relaxations.length - undetermined.length;
console.log(
  `\n✓ ${legal} relaxation(s) legal${undetermined.length ? `, ${undetermined.length} undetermined` : ", all legal"}` +
    `${inactive.length ? ` (${inactive.length} inactive here)` : ""}.\n`,
);
