/**
 * The `external-registry` role held to `registry-authority-contract`
 * (`skills/content/content-lifecycle-ext/registry-authority-contract.md`):
 * what a trusted registry is relied on for when a source's authority is
 * checked, and what this layer does when it does not answer.
 *
 * The registry is a party this layer does not run, on endpoints not yet
 * chosen (the diagram is a strawperson), so its own lines 1 and 2 are not
 * exercised. What is ours is tested against `evidence-retrieval.bpmn` as the
 * harness's workflow engine reads it: the lane names the role, the registry's
 * lane decides nothing of this layer's, and an unconfirmed answer becomes
 * a bean for the unverified citation rather than a verdict.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { complete, enabled, startInstance } from "@litlfred/cat-harness-tools/src/workflow/instance.js";
import { loadProcessModel, type ProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";

const CORE = resolve(import.meta.dir, "../..");
const load = (): Promise<ProcessModel> => loadProcessModel(workflowFile(CORE, "evidence-retrieval.bpmn"));

describe("the lane names the external registry, and its task names this contract", () => {
  test("trustedLaneNamesRegistry", async () => {
    const model = await load();
    for (const id of ["Task_VerifyAuthority", "Gateway_Authoritative"]) {
      expect(model.nodes.get(id)!.laneId).toBe("Lane_Trusted");
      expect(model.nodes.get(id)!.roleRef).toBe("external-registry");
    }
    expect(model.nodes.get("Task_VerifyAuthority")!.skills).toEqual(["registry-authority-contract"]);
  });

  test("laneHoldsOneActivity", async () => {
    const model = await load();
    const held = [...model.nodes.values()].filter((n) => n.laneId === "Lane_Trusted" && n.kind === "activity").map((n) => n.id);
    expect(held).toEqual(["Task_VerifyAuthority"]);
  });
});

describe("What happens when it does not answer: the work plan records it, and nothing invents a verdict", () => {
  test("gatewayTwoAnswers", async () => {
    const model = await load();
    const out = [...model.flows.values()].filter((f) => f.from === "Gateway_Authoritative");
    expect(Object.fromEntries(out.map((f) => [f.name, f.to]))).toEqual({ yes: "Task_AppraiseGrade", no: "Task_RecordUnverified" });
    const bean = model.nodes.get("Task_RecordUnverified")!;
    // The work plan is a data store, not a lane: the author's step writes it.
    expect(bean.laneId).toBe("Lane_Author");
    expect(bean.writes).toEqual(["work-plan"]);
  });

  test("noRecordsUnverified", async () => {
    const model = await load();
    const state = startInstance(model, { id: "authority-no", subject: "content/rec.md" });
    for (let guard = 0; ; guard++) {
      if (guard > 100) throw new Error("evidence-retrieval never reached Gateway_Authoritative");
      const open = enabled(model, state);
      const at = open.find((e) => e.node === "Gateway_Authoritative");
      if (at) {
        complete(model, state, at.node, { outcome: "no" });
        break;
      }
      const step = open[0];
      if (!step) throw new Error("evidence-retrieval enabled nothing before Gateway_Authoritative");
      complete(model, state, step.node, step.kind === "decision" ? { outcome: step.outcomes[0] } : {});
    }
    const next = enabled(model, state).map((e) => e.node);
    expect(next).toEqual(["Task_RecordUnverified"]);
  });
});
