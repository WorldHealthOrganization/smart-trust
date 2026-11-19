/**
 * The `corpus` role held to `corpus-commit-contract`
 * (`skills/content/content-lifecycle-ext/corpus-commit-contract.md`): what the
 * versioned store is relied on for when an accepted edit is committed.
 *
 * The contract is read off the one step of `editing-hci-validation.bpmn` that
 * writes the corpus data store, so it is tested against that diagram as the harness's workflow engine reads it. Line
 * 1 (the write arrives only on the editor's `accept`) is tested both ways: as
 * a property of the graph, and by running the process to the editor's
 * decision. Line 3's policy is checked on the task. Line 2 (the change arrives
 * with its QA sidecars) is not exercised: no code in this layer performs the
 * commit.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { complete, enabled, startInstance } from "@litlfred/cat-harness-tools/src/workflow/instance.js";
import { loadProcessModel, type ProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";

const CORE = resolve(import.meta.dir, "../..");
const load = (): Promise<ProcessModel> => loadProcessModel(workflowFile(CORE, "editing-hci-validation.bpmn"));

/** Nodes reachable from the start events, optionally without one flow. */
function reachable(model: ProcessModel, without?: string): Set<string> {
  const seen = new Set<string>();
  const todo = [...model.nodes.values()].filter((n) => n.kind === "start").map((n) => n.id);
  while (todo.length) {
    const id = todo.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const f of model.flows.values()) if (f.from === id && f.id !== without) todo.push(f.to);
  }
  return seen;
}

describe("the corpus is a data store, and the one step that writes it names this contract", () => {
  test("onlyCommitWritesCorpus", async () => {
    const model = await load();
    const commit = model.nodes.get("Task_Commit")!;
    expect(commit.writes).toEqual(["corpus"]);
    expect(commit.skills).toEqual(["corpus-commit-contract"]);
    const writers = [...model.nodes.values()].filter((n) => n.writes?.includes("corpus")).map((n) => n.id);
    expect(writers).toEqual(["Task_Commit"]);
  });
});

describe("1. receive the write only after the editor accepts", () => {
  test("oneFlowFromAccept", async () => {
    const model = await load();
    const into = [...model.flows.values()].filter((f) => f.to === "Task_Commit");
    expect(into).toHaveLength(1);
    expect(into[0]!.from).toBe("Gateway_EditorDecision");
    expect(into[0]!.name).toBe("accept");
  });

  test("withoutAcceptNothingReaches", async () => {
    const model = await load();
    expect(reachable(model).has("Task_Commit")).toBe(true);
    const accept = [...model.flows.values()].find((f) => f.to === "Task_Commit")!;
    const rest = reachable(model, accept.id);
    expect(rest.has("Task_Commit")).toBe(false);
    // The bean is closed once for every ending, so EndEvent_InCorpus is drawn
    // after GW_BeanClosedHow, which reads how the bean ended; the run test
    // below shows a discard never takes that branch.
    const intoEnd = [...model.flows.values()].filter((f) => f.to === "EndEvent_InCorpus");
    expect(intoEnd.map((f) => f.from)).toEqual(["GW_BeanClosedHow"]);
  });

  test("onlyAcceptEnablesCommit", async () => {
    const model = await load();
    const outcomes = [...model.flows.values()].filter((f) => f.from === "Gateway_EditorDecision").map((f) => f.name!);
    expect(outcomes).toContain("accept");
    for (const answer of outcomes) {
      const state = startInstance(model, { id: `commit-${answer}`, subject: "content/x.md" });
      // Walk to the editor's decision, taking the first outcome at any earlier decision.
      for (let guard = 0; ; guard++) {
        if (guard > 200) throw new Error("editing-hci-validation never reached Gateway_EditorDecision");
        const open = enabled(model, state);
        const at = open.find((e) => e.node === "Gateway_EditorDecision");
        if (at) {
          complete(model, state, at.node, { outcome: answer });
          break;
        }
        const step = open[0];
        if (!step) throw new Error("editing-hci-validation enabled nothing before Gateway_EditorDecision");
        expect(step.node).not.toBe("Task_Commit");
        complete(model, state, step.node, step.kind === "decision" ? { outcome: step.outcomes[0] } : {});
      }
      const next = enabled(model, state).map((e) => e.node);
      if (answer === "accept") expect(next).toContain("Task_Commit");
      else expect(next).not.toContain("Task_Commit");
    }
  });
});

describe("3. the commit-hygiene requirement holds, and may not be relaxed", () => {
  test("commitNotRelaxable", async () => {
    const model = await load();
    expect(model.nodes.get("Task_Commit")!.relaxable).toBe(false);
  });
});
