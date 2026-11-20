/**
 * The work-plan operations folio-assistant-core's editing process declares —
 * moved here from `cat-harness-tools/scripts/tests/bean-link.test.ts` (bean
 * `ho66`). The bean link is cat-harness code and its tests stay there;
 * `editing-hci-validation.bpmn` is this layer's.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";
import { loadProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";

describe("the diagrams declare which operation each step performs", () => {
  test("editingOpensNotesCloses", async () => {
    const model = await loadProcessModel(
      workflowFile(resolve(import.meta.dir, "../.."), "editing-hci-validation.bpmn"),
    );
    // Bean `m8gz`: claim lives in Process_BeanOpen and resolve in
    // Process_BeanClose; the diagram calls them and keeps its own `note`.
    expect(model.nodes.get("Task_ClaimBean")!.calledElement).toBe("Process_BeanOpen");
    expect(model.children.get("Task_ClaimBean")!.nodes.get("Open_Claim")!.workPlanOp).toBe("claim");
    expect(model.nodes.get("Task_LogFindings")!.workPlanOp).toBe("note");
    expect(model.nodes.get("Task_ResolveBean")!.calledElement).toBe("Process_BeanClose");
    expect(model.children.get("Task_ResolveBean")!.nodes.get("Close_Complete")!.workPlanOp).toBe("resolve");
  });
});
