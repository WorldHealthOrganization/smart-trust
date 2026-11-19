/**
 * The workflow gate against folio-assistant-core's own processes — moved here
 * from `cat-harness-tools/scripts/tests/workflow-gate.test.ts` (bean `ho66`). The
 * gate is cat-harness code and its fixture-only tests stay there; these pin
 * what `editing-hci-validation`, `draft-to-publication` and
 * `content-lifecycle` declare, and those diagrams are this layer's, so
 * standing alone cat-harness has nothing for them to read.
 *
 * The decision in bean `bcnl`: **strict at the base, relaxable by content
 * packages that say so.** A relaxation needs a stated reason, it must name
 * something real, and it cannot name the gate itself.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { drainSubprocess } from "@litlfred/cat-harness-tools/scripts/tests/helpers.js";
import { loadProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { complete, startInstance } from "@litlfred/cat-harness-tools/src/workflow/instance.js";
import {
  checkGate,
  PolicyError,
  validateRelaxations,
  type Relaxation,
} from "@litlfred/cat-harness-tools/src/workflow/gate.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";

/** This layer's root; its diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const CORE = resolve(import.meta.dir, "../..");
const editing = () => loadProcessModel(workflowFile(CORE, "editing-hci-validation.bpmn"));

const relax = (over: Partial<Relaxation> = {}): Relaxation => ({
  process: "Process_Editing",
  activity: "Task_SmeReview",
  reason: "test",
  package: "authoring-math",
  ...over,
});

describe("the base is strict and the content-type processes are not", () => {
  test("baseProcessesStrict", async () => {
    for (const f of ["editing-hci-validation", "draft-to-publication", "content-lifecycle"]) {
      expect((await loadProcessModel(workflowFile(CORE, `${f}.bpmn`))).enforcement).toBe("strict");
    }
  });
});

describe("a strict process refuses a step it has not reached", () => {
  test("commitBeforeGateRefused", async () => {
    const model = await editing();
    const state = startInstance(model, { id: "g1", subject: "def:x" });
    const v = checkGate(model, state, "Task_Commit", []);
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("not enabled");
    // The refusal names the escape hatch and then closes it for this step.
    expect(v.reason).toContain("workflow-policy.json");
    expect(v.reason).toContain('cannot be');
  });

  test("enabledStepAllowed", async () => {
    const model = await editing();
    const state = startInstance(model, { id: "g2", subject: "def:x" });
    expect(checkGate(model, state, "Task_DescribeChange", []).allowed).toBe(true);
  });
});

describe("a declared relaxation permits a step, and is attributed", () => {
  test("declaredRelaxationAttributed", async () => {
    const model = await editing();
    const state = startInstance(model, { id: "g3", subject: "def:x" });
    complete(model, state, "Task_DescribeChange");
    // Process_BeanOpen (bean `m8gz`), then its `claimed` branch.
    drainSubprocess(model, state, "Task_ClaimBean");
    complete(model, state, "GW_BeanYours", { outcome: "claimed" });
    drainSubprocess(model, state, "CallActivity_Evidence");
    complete(model, state, "Task_DraftEdit");
    complete(model, state, "Gateway_ReviewerKind", { outcome: "no" });

    // Task_SmeReview was never reached: the routing went to the agent branch.
    expect(checkGate(model, state, "Task_SmeReview", []).allowed).toBe(false);

    const v = checkGate(model, state, "Task_SmeReview", [relax({ reason: "no clinical SME here" })]);
    expect(v.allowed).toBe(true);
    expect(v.relaxedBy?.package).toBe("authoring-math");
    expect(v.reason).toContain("no clinical SME here");
  });

  test("otherProcessRelaxationIgnored", async () => {
    const model = await editing();
    const state = startInstance(model, { id: "g4", subject: "def:x" });
    const other = relax({ process: "Process_Publication", activity: "Task_SmeReview" });
    expect(checkGate(model, state, "Task_SmeReview", [other]).allowed).toBe(false);
  });
});

describe("what a package may NOT relax", () => {
  test("gateStepsNotRelaxable", async () => {
    const model = await editing();
    // If these were negotiable the base would not be strict, it would be a
    // suggestion: the editor seeing the findings, the decision, and the write.
    for (const activity of ["Task_ReviewFindings", "Gateway_EditorDecision", "Task_Commit"]) {
      expect(() => validateRelaxations([relax({ activity })], [model])).toThrow(PolicyError);
      expect(() => validateRelaxations([relax({ activity })], [model])).toThrow(/relaxable="false"/);
    }
  });

  test("releaseNotRelaxable", async () => {
    const model = await loadProcessModel(workflowFile(CORE, "draft-to-publication.bpmn"));
    const r = relax({ process: "Process_Publication", activity: "Task_AuthorizeRelease" });
    expect(() => validateRelaxations([r], [model])).toThrow(/relaxable="false"/);
  });

  test("unknownProcessOrActivityFails", async () => {
    const model = await editing();
    // Otherwise it sits in the file looking like policy while permitting
    // nothing, and nobody finds out until the day it matters.
    expect(() => validateRelaxations([relax({ process: "Process_Nope" })], [model])).toThrow(
      /not a process here/,
    );
    expect(() => validateRelaxations([relax({ activity: "Task_Nope" })], [model])).toThrow(
      /no such node/,
    );
  });
});
