/**
 * The global-task report entry `kg:audit` writes, computed.
 *
 * @module scripts/lib/global-task-criteria
 *
 * Spec §7 of the lane / role / skill model: *"Global tasks … only for steps
 * that 2 or more processes reuse."* The owner's rulings of 2026-10-20 ("a1 b1
 * c1") put a layer's global tasks in one shared `.bpmn` that holds no process,
 * called by bare id from the layer's own processes. The criterion is DECLARED
 * in cat-harness `schemas/sdlc/kg-qa.ts` (`global-task-shared`, applies to the
 * graph, severity `minor`: a report entry, not a gate) and computed here as a
 * pure function, beside `lane-role-criteria.ts`.
 *
 * - **`global-task-shared`** (graph) — a global task called by fewer than two
 *   processes: one that a single process performs is a plain task of that
 *   process again, and one that nothing calls is dead.
 */
import { relative } from "node:path";
import type { KgFinding } from "../../schemas/sdlc/kg-qa.js";
import type { GlobalTaskDef, ProcessModel } from "../../src/workflow/process-model.ts";

/** `global-task-shared`: each global task in `defs` that fewer than two of `processes` call. */
export function globalTaskSharedFindings(
  defs: readonly (readonly GlobalTaskDef[])[],
  processes: readonly { model?: Pick<ProcessModel, "id" | "nodes"> }[],
  root: string,
): KgFinding[] {
  const findings: KgFinding[] = [];
  for (const g of defs.flat()) {
    const callers = [
      ...new Set(
        processes.flatMap((p) =>
          p.model && [...p.model.nodes.values()].some((n) => n.globalTask?.id === g.id && n.globalTask.source === g.source) ? [p.model.id] : [],
        ),
      ),
    ].sort();
    if (callers.length >= 2) continue;
    const where = `${relative(root, g.source)}#${g.id}`;
    findings.push({
      where: g.id,
      detail:
        callers.length === 0
          ? `global task "${g.name}" (${where}) is called by no process: call it, or delete it.`
          : `global task "${g.name}" (${where}) is called only by ${callers[0]}: a step one process performs is a plain task of that process, not a shared one (spec §7).`,
    });
  }
  return findings;
}
