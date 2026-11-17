/**
 * The callers of the shared adjudication half — moved here from
 * `cat-harness-tools/scripts/tests/adjudication-marker.test.ts` (bean `ho66`). Two
 * of the four callers (`ingest-l1-completeness-gate`, `content-change-review-committee`)
 * are this layer's diagrams, so standing alone cat-harness cannot read
 * them; the other two are cat-harness's own, reached here through the corpus
 * cat-harness serves, which includes this layer.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { loadProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";

describe("the split — bean `bvuk`, the owner's shape", () => {
  const diagram = (n: string): string => workflowFile(join(import.meta.dir, "../../../cat-harness"), n);

  test("callersDeclareOwnAnswers", async () => {
    // The defect this closes, asserted as reachability rather than as a name:
    // before the split every one of these ran A_ScopeCriterion's gateway. And
    // each now names the answers ITS question admits (owner, 2026-09-23; the
    // three multi-answer sets are the owner's own design, #1156), so
    // no caller runs an adjudication whose answers nobody stated.
    for (const [f, id, codes] of [
      // Back beside its callee since bean `j7ql` (2026-10-01), after a spell
      // in large-datasets (bean `cjvs`) calling down into cat-harness.
      ["refresh-materialized.bpmn", "Task_Adjudicate", ["defer", "local", "merge", "remote"]],
      ["translation-workflow.bpmn", "Task_Adjudicate", ["accept", "edit", "retranslate"]],
      ["ingest-l1-completeness-gate.bpmn", "Task_FlagDrift", ["real", "source-wrong", "spurious"]],
      // In the committee phase since content-change-review was split (2026-10-31).
      ["content-change-review-committee.bpmn", "Call_Adjudication", ["stands", "withdrawn"]],
    ] as const) {
      const m = await loadProcessModel(diagram(f));
      expect(m.nodes.get(id)!.calledElement, f).toBe("Process_Adjudication");
      expect(m.nodes.get(id)!.adjudication!.codes.slice().sort(), f).toEqual([...codes]);
      const child = m.children.get(id)!;
      expect([...child.nodes.keys()], f).not.toContain("A_ScopeCriterion");
      expect([...child.nodes.keys()], f).not.toContain("A_Dispensation");
    }
  });
});
