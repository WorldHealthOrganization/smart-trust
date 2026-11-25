import { describe, expect, test } from "bun:test";
import { checkGate } from "../../src/workflow/gate.ts";
import type { InstanceState } from "../../src/workflow/instance.ts";
import type { ProcessModel } from "../../src/workflow/process-model.ts";

// dth-sc's beans/workflows/ holds `folio-workflow-instance/v1` records, which
// carry `history` and `currentActivity` but no `tokens`. The corpus gate must
// refuse such a record, not crash on it.
describe("checkGate on a legacy instance with no tokens", () => {
  const model = {
    id: "Process_EditingValidation",
    enforcement: "strict",
    nodes: new Map([["Task_Commit", { id: "Task_Commit", name: "Commit", relaxable: true }]]),
  } as unknown as ProcessModel;
  const state = {
    id: "editing--fig-5",
    history: [{ step: 1, elementId: "StartEvent_BlockChanged" }],
  } as unknown as InstanceState;

  test("refuses with a reason instead of throwing", () => {
    const verdict = checkGate(model, state, "Task_Commit", []);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("is not enabled");
  });
});
