/**
 * Bean `m8gz` (owner, 2026-10-24, option A): claim, resolve and archive live
 * only in Process_BeanOpen and Process_BeanClose, and every process that works
 * a bean calls both.
 *
 * Two halves. The rule itself, on hand-built models, so each failure kind is
 * shown to fire and the note-taker exemption is shown to hold. Then the real
 * Process_BeanLifecycle walked through the engine, because the design rests on
 * an engine property nothing else asserted: a CLOSE called straight before the
 * caller's end lets `resolve` see "only archive left", and its `archive` runs
 * once the caller has completed.
 */
import { describe, expect, test } from "bun:test";

import { beanCallFindings, noteTakers, type DiagramFacts } from "../check-bean-lifecycle-calls.ts";
import { complete, enabled, startInstance } from "../../src/workflow/instance";
import { loadProcessModel, type ProcessNode } from "../../src/workflow/process-model";
import { onlyArchiveLeft } from "../../src/workflow/bean-link";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { workflowFile } from "../known-skills.ts";

function node(id: string, extra: Partial<ProcessNode> = {}): ProcessNode {
  return { id, name: id, kind: "activity", touchesWorkPlan: false, ...extra } as ProcessNode;
}

function diagram(id: string, nodes: ProcessNode[]): DiagramFacts {
  return { file: `${id}.bpmn`, model: { id, nodes: new Map(nodes.map((n) => [n.id, n])) } };
}

const open = node("Call_Open", { calledElement: "Process_BeanOpen" });
const close = node("Call_Close", { calledElement: "Process_BeanClose" });
const lifecycle = [
  diagram("Process_BeanOpen", [node("Task_Claim", { touchesWorkPlan: true, workPlanOp: "claim" })]),
  diagram("Process_BeanClose", [
    node("Task_Complete", { touchesWorkPlan: true, workPlanOp: "resolve" }),
    node("Task_Archive", { touchesWorkPlan: true, workPlanOp: "archive" }),
  ]),
];

describe("check:bean-calls", () => {
  test("a process that calls both, with notes in between, is clean", () => {
    const p = diagram("Process_Work", [open, node("Task_Do", { touchesWorkPlan: true, workPlanOp: "note" }), close]);
    expect(beanCallFindings([...lifecycle, p])).toEqual([]);
  });

  test("a claim, resolve or archive outside OPEN and CLOSE is refused — on a step or through a global task", () => {
    for (const op of ["claim", "resolve", "archive"] as const) {
      const p = diagram("Process_Copy", [open, node("Task_X", { touchesWorkPlan: true, workPlanOp: op }), close]);
      expect(beanCallFindings([...lifecycle, p]).map((f) => f.kind)).toEqual(["op-outside-lifecycle"]);
    }
    const viaGt = diagram("Process_Gt", [
      open,
      node("Task_Brief", { touchesWorkPlan: true, workPlanOp: "claim", globalTask: { id: "GT_X" } as ProcessNode["globalTask"] }),
      close,
    ]);
    expect(beanCallFindings([...lifecycle, viaGt])[0]!.detail).toContain("GT_X");
  });

  test("OPEN without CLOSE, and CLOSE without OPEN, are each refused", () => {
    const openOnly = diagram("Process_OpenOnly", [open]);
    const closeOnly = diagram("Process_CloseOnly", [close]);
    const kinds = beanCallFindings([...lifecycle, openOnly, closeOnly]).map((f) => `${f.process}:${f.kind}`);
    expect(kinds).toEqual(["Process_OpenOnly:unpaired-call", "Process_CloseOnly:unpaired-call"]);
  });

  test("an entry process naming a bean must call both; a called one runs on its caller's bean", () => {
    const naming = diagram("Process_Names", [node("Task_N", { touchesWorkPlan: true, beans: ["abcd"] })]);
    expect(beanCallFindings([...lifecycle, naming]).map((f) => f.kind)).toEqual(["names-bean-without-open-close"]);
    const caller = diagram("Process_Caller", [open, node("Call_Phase", { calledElement: "Process_Names" }), close]);
    expect(beanCallFindings([...lifecycle, naming, caller])).toEqual([]);
  });

  test("a note-only entry process is reported, not failed", () => {
    const notes = diagram("Process_Notes", [node("Task_Log", { touchesWorkPlan: true, workPlanOp: "note" })]);
    expect(beanCallFindings([...lifecycle, notes])).toEqual([]);
    expect(noteTakers([...lifecycle, notes]).map((d) => d.model.id)).toEqual(["Process_Notes"]);
  });
});

describe("Process_BeanLifecycle runs OPEN → work → CLOSE through the engine", () => {
  const path = workflowFile(HARNESS_ROOT, "bean-lifecycle.bpmn");

  test("claimed, worked and done: resolve sees only archive left, and the instance completes on archive", async () => {
    const model = await loadProcessModel(path);
    expect([...model.children.values()].map((c) => c.id).sort()).toEqual(["Process_BeanClose", "Process_BeanOpen"]);
    const state = startInstance(model, { id: "m8gz-done", subject: "x", bean: "abcd" });
    complete(model, state, "Open_CheckExists");
    complete(model, state, "Open_Exists", { outcome: "no" });
    complete(model, state, "Open_Create");
    complete(model, state, "Open_Claim");
    complete(model, state, "GW_Yours", { outcome: "claimed" });
    complete(model, state, "Task_Work");
    complete(model, state, "Close_Outcome", { outcome: "done" });
    complete(model, state, "Close_Complete");
    // The engine's `resolve` fires when only archive steps are left.
    expect(onlyArchiveLeft(model, state)).toBe(true);
    expect(enabled(model, state).map((e) => e.node)).toEqual(["Close_Archive"]);
    complete(model, state, "Close_Archive");
    expect(state.status).toBe("completed");
  });

  test("someone else's bean: OPEN ends not-yours and the caller stops without CLOSE", async () => {
    const model = await loadProcessModel(path);
    const state = startInstance(model, { id: "m8gz-not-yours", subject: "x", bean: "abcd" });
    complete(model, state, "Open_CheckExists");
    complete(model, state, "Open_Exists", { outcome: "yes" });
    complete(model, state, "Open_Owner", { outcome: "someone else's" });
    complete(model, state, "Open_LeaveAlone");
    complete(model, state, "GW_Yours", { outcome: "not yours" });
    expect(state.status).toBe("completed");
    expect(state.children?.Call_BeanClose).toBeUndefined();
  });
});
