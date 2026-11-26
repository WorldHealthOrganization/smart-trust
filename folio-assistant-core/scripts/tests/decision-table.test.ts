/**
 * DMN-backed gateways against folio-assistant-core's own diagrams — moved
 * here from `cat-harness-tools/scripts/tests/decision-table.test.ts` (bean `ho66`).
 * The decision-table engine is cat-harness code and its fixture tests stay
 * there; `draft-qa-gate.dmn` and `editing-hci-validation.bpmn` are this
 * layer's, so standing alone cat-harness has neither to read.
 *
 * These tests are about the difference between computing and choosing.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { drainSubprocess } from "@litlfred/cat-harness-tools/scripts/tests/helpers.js";
import { DecisionError, evaluate, loadDecisionTable } from "@litlfred/cat-harness-tools/src/workflow/decision-table.js";
import { loadProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { complete, enabled, startInstance } from "@litlfred/cat-harness-tools/src/workflow/instance.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";

/** This layer's root; its diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const HERE = resolve(import.meta.dir, "../..");

describe("the shipped tables", () => {
  test("draftQaGateBlocks", async () => {
    const t = await loadDecisionTable(workflowFile(HERE, "draft-qa-gate.dmn"), "Decision_DraftQaGate");
    expect(evaluate(t, { failCritical: 1, failMajor: 0 }).rule).toBe("Rule_Critical");
    expect(evaluate(t, { failCritical: 0, failMajor: 2 }).rule).toBe("Rule_Major");
    expect(evaluate(t, { failCritical: 0, failMajor: 0 }).outcome).toBe("yes");
  });

  test("missingFactIsError", async () => {
    const t = await loadDecisionTable(workflowFile(HERE, "draft-qa-gate.dmn"), "Decision_DraftQaGate");
    // A gate that answers on data it never received is the failure the whole
    // mechanism exists to remove.
    expect(() => evaluate(t, { failCritical: 0 })).toThrow(DecisionError);
    expect(() => evaluate(t, { failCritical: 0 })).toThrow(/failMajor/);
  });
});

describe("computed gateways in a running process", () => {
  test("gatewayWithoutTableChosen", async () => {
    const model = await loadProcessModel(workflowFile(HERE, "editing-hci-validation.bpmn"));
    const state = startInstance(model, { id: "d2", subject: "def:x" });
    complete(model, state, "Task_DescribeChange");
    // Process_BeanOpen (bean `m8gz`), then its `claimed` branch.
    drainSubprocess(model, state, "Task_ClaimBean");
    complete(model, state, "GW_BeanYours", { outcome: "claimed" });
    drainSubprocess(model, state, "CallActivity_Evidence");
    complete(model, state, "Task_DraftEdit");
    const judgement = enabled(model, state).find((e) => e.node === "Gateway_ReviewerKind");
    expect(judgement?.kind === "decision" && judgement.computed).toBeUndefined();
    complete(model, state, "Gateway_ReviewerKind", { outcome: "yes" });
    expect(enabled(model, state).some((e) => e.node === "Task_SmeReview")).toBe(true);
  });
});
