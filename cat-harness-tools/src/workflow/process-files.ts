/**
 * The engine's process-file resolver: which `.bpmn` files `workflow_list`
 * prints and `workflow_start` resolves against.
 *
 * Lives in cat-harness (not cat-harness-tools) because a cat-harness script,
 * `audit-reachability`, must measure exactly this list, and cat-harness may
 * not import upward into cat-harness-tools. `cat-harness-tools/src/tools/
 * workflow.ts` re-exports both functions unchanged.
 *
 * @module src/workflow/process-files
 */
import { basename, resolve } from "node:path";

import { orderedDependencies } from "../../schemas/kg/harness-config.js";
import { workflowFiles } from "../../scripts/known-skills.js";
import { processDiagrams } from "./process-model.js";

/**
 * The layers whose diagrams these tools can run: every dependency in
 * overlay order, then the root — LAST, so the root wins a name collision,
 * the rule `resolveSkillDirs` states for skills.
 *
 * Bean `nf2z`. `workflowFiles(root)` alone is root-only, through
 * `kgDirectories`, and on purpose: the export and the renderers rely on it.
 * But since the split the root layer declares no diagram at all — every
 * one belongs to a dependency — so a server started at the repository root
 * listed "Processes: (none)" and could start nothing, which made the
 * recorded-instance rule (bean `vlhk`) uncompliable. Only THIS module's
 * resolver changes; the root-only function stays as it is.
 *
 * A dependency graph that cannot be resolved falls back to the root alone
 * rather than taking the tools down — the same posture as the role graph
 * below. `check:harness-deps` is where a broken graph is a finding.
 */
export function processRoots(repoRoot: string): string[] {
  let deps: string[] = [];
  try {
    deps = orderedDependencies(repoRoot).map((d) => resolve(d.rootPath));
  } catch {
    deps = [];
  }
  return [...new Set([...deps, resolve(repoRoot)])];
}

/** Every `.bpmn` across {@link processRoots}, root's copy first for a shared stem. */
export function processFiles(repoRoot: string): string[] {
  const seen = new Map<string, string>();
  // Root first, so its file claims the stem; a dependency's same-named
  // diagram is then shadowed rather than listed twice.
  for (const r of [...processRoots(repoRoot)].reverse()) {
    // A layer's shared global-tasks file holds no process to start.
    for (const f of processDiagrams(workflowFiles(r))) {
      const stem = basename(f, ".bpmn");
      if (!seen.has(stem)) seen.set(stem, f);
    }
  }
  return [...seen.values()].sort();
}
