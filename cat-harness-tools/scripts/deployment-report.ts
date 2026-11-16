#!/usr/bin/env bun
/**
 * Deployment report: for each deployment description, which process tasks
 * no placement can run.
 *
 * The rule is cat-harness's `schemas/deployment-resolver.ts`; this script only
 * reads the corpus into it:
 *
 * - the descriptions in `scenarios/deployments/`;
 * - the checkout's actors (`checkoutActors`, so a dependent's actors count);
 * - every activity of every process, with its lane role, the actor kinds that
 *   may fulfil it, and the skills it names;
 * - every Tool, with `satisfies` and `requires`;
 * - the role graph's IS-A closure (`inherits`).
 *
 * **It reports and never fails**: it exits 0 whatever it finds, and 1 only
 * when it could not read its inputs.
 *
 * Usage: `bun run cat deployments:report [--repo <dir>] [--deployment <id>] [--all] [--json]`
 *
 * @module folio-assistant/scripts/deployment-report
 * @covers scenarios
 */

import { dirname, join, relative, resolve } from "node:path";

import { repoRootFor, findInstanceRoot } from "../schemas/kg/cat-harness.ts";
import {
  DEPLOYMENTS_DIRNAME,
  deploymentProblems,
  readDeployments,
} from "../schemas/process/deployment-description.ts";
import {
  resolveDeployment,
  type DeploymentReport,
  type ResolverTask,
  type ResolverTool,
} from "../schemas/process/deployment-resolver.ts";
import {
  actorsDir,
  fulfilmentKindsForBpmnType,
  readRoleGraph,
} from "../schemas/process/role-graph.ts";
import { checkoutActors } from "../schemas/process/scenario-overlay.js";

import { tools } from "../tools/discover.js";
import { processFiles } from "../src/workflow/process-files.js";
import { isActivity, loadProcessModel } from "../src/workflow/process-model.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { isAFrom } from "./lib/role-isa.ts";

export { isAFrom };

/** Every activity of every process the checkout can run, as resolver tasks. */
export async function readTasks(root: string): Promise<{ tasks: ResolverTask[]; unreadable: string[] }> {
  const tasks: ResolverTask[] = [];
  const unreadable: string[] = [];
  for (const f of processFiles(root)) {
    try {
      const m = await loadProcessModel(f);
      for (const n of m.nodes.values()) {
        if (!isActivity(n)) continue;
        tasks.push({
          process: m.id,
          task: n.id,
          role: n.roleRef,
          kinds: n.fulfilment?.kinds ?? fulfilmentKindsForBpmnType(n.type),
          skills: n.skills,
        });
      }
    } catch (e) {
      // Reported, not dropped: a smaller task list reads as fewer findings.
      unreadable.push(`${relative(root, f)}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    }
  }
  return { tasks, unreadable };
}

function main(argv: string[]): Promise<number> | number {
  const root = argv.includes("--repo") ? resolve(argv[argv.indexOf("--repo") + 1]) : repoRootFor(HARNESS_ROOT);
  const actorDir = actorsDir(root);
  if (actorDir === undefined) {
    console.error("✗ the platform declares no `scenarios` graph, so there are no actors or deployments to read");
    return 1;
  }
  const scenarios = dirname(actorDir);
  const only = argv.includes("--deployment") ? argv[argv.indexOf("--deployment") + 1] : undefined;
  const all = argv.includes("--all");
  const json = argv.includes("--json");

  return (async () => {
    const deployments = readDeployments(join(scenarios, DEPLOYMENTS_DIRNAME)).filter((d) => !only || d.id === only);
    if (deployments.length === 0) {
      console.error(`✗ no deployment descriptions${only ? ` with id "${only}"` : ""} under ${join(scenarios, DEPLOYMENTS_DIRNAME)}`);
      return 1;
    }
    const actors = checkoutActors(findInstanceRoot(actorDir) ?? root, actorDir);
    const isA = isAFrom(readRoleGraph(scenarios));
    const { tasks, unreadable } = await readTasks(root);
    if (tasks.length === 0) {
      // A report over no tasks would say every deployment can run everything.
      console.error(`✗ EXAMINED NOTHING: no process activities found from ${root}`);
      return 1;
    }
    const toolList: ResolverTool[] = tools().map((t) => ({ id: t.id, satisfies: t.satisfies, requires: t.requires }));
    const problems = deploymentProblems(deployments, actors);
    const reports: DeploymentReport[] = deployments.map((d) => resolveDeployment(d, actors, tasks, toolList, isA));

    if (json) {
      console.log(JSON.stringify({ problems, unreadable, reports }, null, 2));
      return 0;
    }

    console.log(`${tasks.length} task(s) in ${new Set(tasks.map((t) => t.process)).size} process(es), ${actors.length} actor(s), ${toolList.length} Tool(s)`);
    for (const u of unreadable) console.log(`  ⚠ could not load ${u}; its tasks are missing from this report`);
    for (const p of problems) console.log(`  ⚠ ${p.deployment}: ${p.message}`);
    for (const r of reports) {
      const runnable = r.tasks.length - r.unrunnable.length - r.undetermined.length;
      console.log(`\n${r.deployment}: ${runnable} runnable, ${r.unrunnable.length} no placement can run, ${r.undetermined.length} could not determine`);
      for (const u of all ? r.unrunnable : r.unrunnable.slice(0, 10)) console.log(`  · ${u.process} / ${u.task}: ${u.why}`);
      if (!all && r.unrunnable.length > 10) console.log(`  … ${r.unrunnable.length - 10} more (--all)`);
    }
    // Report only: the owner's ruling is that this never fails a build.
    return 0;
  })();
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
