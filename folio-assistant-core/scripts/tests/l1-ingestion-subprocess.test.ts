/**
 * Subprocess descent, walked over a real decomposed process —
 * `l1-document-ingestion.bpmn` and its four `ingest-*` phases.
 *
 * Before descent, a `callActivity` was an opaque box the caller completed in
 * one step, which meant a decomposed diagram was strictly WORSE than a flat
 * one: it read better and gated less. These tests pin the opposite property —
 * that decomposing a process moves its steps into a child rather than deleting
 * them.
 *
 * MOVED HERE from `cat-harness-tools/scripts/tests/workflow-subprocess.test.ts` in
 * placement PR6 (bean `apcg`), with the process it walks: the pipeline was
 * `document-ingestion.bpmn`'s body and is core's `l1-document-ingestion.bpmn`
 * now, while the harness diagram became the basic flow this one calls first.
 * The engine is still the harness's; importing it from here is a downward
 * edge. The fixture-only cases stayed in the harness file.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import {
  complete,
  enabled,
  positionOf,
  startInstance,
  WorkflowError,
  type InstanceState,
} from "@litlfred/cat-harness-tools/src/workflow/instance.js";
import { checkGate } from "@litlfred/cat-harness-tools/src/workflow/gate.js";
import {
  findInModel,
  loadProcessModel,
  type ProcessModel,
} from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";

/** This layer's root; diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const CORE = resolve(import.meta.dir, "../..");

const bpmn = (stem: string): string => workflowFile(CORE, `${stem}.bpmn`);

/**
 * Advance a fresh `l1-document-ingestion` instance to the point where the Extract
 * phase has been entered — which is what every test below is actually about.
 *
 * These tests ran `complete(…, "Task_Detect")` directly, because `Task_Detect`
 * was the first activity. It is not any more: `Task_Place` was inserted ahead
 * of it on 2026-09-30, so the engine correctly refused with *"Task_Detect is
 * not enabled … Enabled now: Task_Place"* and six tests went red at once.
 *
 * The prefix is walked rather than named, so the next step inserted ahead of
 * the phase moves these tests instead of breaking them. It is **bounded and it
 * refuses**: a diagram that never reaches `CallActivity_Extract`, or that puts
 * a decision in front of it, fails here with a message about the diagram
 * rather than looping or silently asserting less. Nothing is skipped — the
 * property each test pins is unchanged, and only the walk to the subject is.
 */
/**
 * The decisions the walk may take, each NAMED rather than taken as
 * outcomes[0]: the basic flow's "Materialized?" (a document whose text is
 * about to be read is held), and the bean opened at the start (bean `m8gz`:
 * Process_BeanOpen finds no bean and creates one, and the caller takes its
 * `claimed` branch). Any other decision is refused.
 */
const PREFIX_DECISIONS: Record<string, string> = {
  Gateway_Materialized: "materialized",
  Open_Exists: "no",
  GW_BeanYours: "claimed",
};

function toExtract(model: ProcessModel, state: InstanceState): void {
  for (let guard = 0; !state.tokens.includes("CallActivity_Extract"); guard++) {
    if (guard > 20) {
      throw new Error(
        "l1-document-ingestion did not reach CallActivity_Extract within 20 steps of its start " +
          `event; enabled now: ${enabled(model, state).map((e) => e.node).join(", ")}`,
      );
    }
    const step = enabled(model, state)[0];
    if (!step) throw new Error("l1-document-ingestion enabled nothing before CallActivity_Extract");
    if (step.kind === "decision") {
      const outcome = PREFIX_DECISIONS[step.node];
      if (outcome === undefined || !step.outcomes.includes(outcome)) {
        throw new Error(
          `${step.node} is a decision on the way to CallActivity_Extract; these tests walk a ` +
            "linear prefix and must not choose a branch on the diagram's behalf",
        );
      }
      complete(model, state, step.node, { outcome });
      continue;
    }
    complete(model, state, step.node);
  }
}

describe("a call activity resolves to the process it names", () => {
  test("callActivitiesResolve", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));
    const called = [...model.nodes.values()].filter((n) => n.calledElement).map((n) => n.id);
    expect(called.length).toBeGreaterThan(0);
    for (const id of called) {
      expect(model.children.get(id)?.id).toBe(model.nodes.get(id)!.calledElement!);
    }
  });

});

describe("entering a subprocess", () => {
  test("phaseOpensItself", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));
    const state = startInstance(model, { id: "ing-1", subject: "uploads/a.pdf" });
    toExtract(model, state);

    // The parent's token sits on the call activity …
    expect(state.tokens).toEqual(["CallActivity_Extract"]);
    // … and the child opened without being asked to.
    expect(state.children?.CallActivity_Extract?.status).toBe("running");

    const open = enabled(model, state);
    expect(open.map((e) => e.node)).not.toContain("CallActivity_Extract");
    expect(open.length).toBeGreaterThan(0);
    for (const e of open) {
      expect(e.phase?.[0]).toBe(model.nodes.get("CallActivity_Extract")!.name);
    }
  });

  test("completingCallRefused", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));
    const state = startInstance(model, { id: "ing-2", subject: "uploads/a.pdf" });
    toExtract(model, state);
    const inside = enabled(model, state).map((e) => e.node);

    expect(() => complete(model, state, "CallActivity_Extract")).toThrow(WorkflowError);
    try {
      complete(model, state, "CallActivity_Extract");
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toContain("is a subprocess, not a step");
      for (const node of inside) expect(message).toContain(node);
    }
  });

  test("parentAdvancesWhenChildFinishes", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));
    const state = startInstance(model, { id: "ing-3", subject: "uploads/a.pdf" });
    toExtract(model, state);

    for (let guard = 0; state.tokens.includes("CallActivity_Extract"); guard++) {
      if (guard > 50) throw new Error("the extract phase did not finish");
      const step = enabled(model, state)[0];
      complete(model, state, step.node, step.kind === "decision" ? { outcome: step.outcomes[0] } : {});
    }

    expect(state.children?.CallActivity_Extract?.status).toBe("completed");
    expect(state.tokens).not.toContain("CallActivity_Extract");
    // The parent records the phase as done, as it records any other step.
    expect(state.history.some((h) => h.node === "CallActivity_Extract")).toBe(true);
  });
});

describe("the step a caller names is the leaf", () => {
  test("leafCompletedFromParent", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));
    const state = startInstance(model, { id: "ing-4", subject: "uploads/a.pdf" });
    toExtract(model, state);

    const leaf = enabled(model, state)[0];
    // The leaf is not a node of the PARENT process at all.
    expect(model.nodes.has(leaf.node)).toBe(false);
    complete(model, state, leaf.node, leaf.kind === "decision" ? { outcome: leaf.outcomes[0] } : {});
    expect(
      state.children!.CallActivity_Extract.history.some((h) => h.node === leaf.node),
    ).toBe(true);
  });

  test("notEnabledStillRefused", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));
    const state = startInstance(model, { id: "ing-5", subject: "uploads/a.pdf" });
    expect(() => complete(model, state, "Task_Promote")).toThrow(/not enabled/);
    expect(() => complete(model, state, "No_Such_Node")).toThrow(/no such node/);
  });
});

describe("the gate answers for a step inside a phase", () => {
  test("gateAllowsEnabledPhaseStep", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));
    const state = startInstance(model, { id: "ing-6", subject: "uploads/a.pdf" });
    toExtract(model, state);
    const leaf = enabled(model, state)[0];

    const verdict = checkGate(model, state, leaf.node, []);
    expect(verdict.allowed).toBe(true);
    expect(verdict.reason).toContain(model.nodes.get("CallActivity_Extract")!.name);
  });

  test("laterPhaseStepRefused", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));
    const state = startInstance(model, { id: "ing-7", subject: "uploads/a.pdf" });
    toExtract(model, state);
    const later = [...model.children.get("CallActivity_Gate")!.nodes.values()].find(
      (n) => n.kind === "activity",
    )!;

    const verdict = checkGate(model, state, later.id, []);
    expect(verdict.allowed).toBe(false);
    // Not "is not a step in Process_L1DocumentIngestion" — it IS a step, just not now.
    expect(verdict.reason).not.toContain("is not a step in");
  });
});

describe("positionOf", () => {
  test("positionReportsLeaf", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));
    const state = startInstance(model, { id: "ing-8", subject: "uploads/a.pdf" });
    toExtract(model, state);

    const position = positionOf(state);
    expect(position.length).toBeGreaterThan(0);
    for (const p of position) {
      expect(p.startsWith("CallActivity_Extract ▸ ")).toBe(true);
      expect(p).not.toBe("CallActivity_Extract");
    }
  });
});

describe("a bean-marked step in a phase is still a work-plan write", () => {
  test("findInModelReachesMarked", async () => {
    const model = await loadProcessModel(bpmn("l1-document-ingestion"));

    // Every bean-marked step of this process lives in one of its phases; none
    // is a node of the parent. A lookup that only knew the parent would perform
    // no work-plan operation at all, silently.
    const marked = [...model.children.values()].flatMap((child) =>
      [...child.nodes.values()].filter((n) => n.workPlanOp).map((n) => n.id),
    );
    expect(marked.length).toBeGreaterThan(0);
    for (const id of marked) {
      expect(model.nodes.has(id)).toBe(false);
      expect(findInModel(model, id)?.model.nodes.get(id)?.workPlanOp).toBeDefined();
    }
  });
});
