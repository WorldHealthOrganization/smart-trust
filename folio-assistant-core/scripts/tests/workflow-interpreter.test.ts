/**
 * The workflow interpreter against folio-assistant-core's own diagrams —
 * moved here from `cat-harness-tools/scripts/tests/workflow-interpreter.test.ts`
 * (bean `ho66`). The interpreter is cat-harness code, and its tests over
 * synthetic diagrams and over every shipped diagram stay there; these pin
 * what `editing-hci-validation` and `content-lifecycle` declare, and those
 * diagrams are this layer's.
 *
 * The workflow diagrams are the normative picture of how a change reaches the
 * corpus. These tests are about the claim that reading them at runtime buys
 * something an agent's good intentions do not: that `Commit into the corpus`
 * *cannot* be reported done before the editor has seen the validation findings,
 * because there is no token on it until then.
 *
 * They run against the real `.bpmn` files, not fixtures. A test that passes on
 * a synthetic process while the shipped one has drifted is the failure this
 * repo keeps finding.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { drainSubprocess } from "@litlfred/cat-harness-tools/scripts/tests/helpers.js";
import { loadProcessModel, type ProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { complete, enabled, startInstance, WorkflowError } from "@litlfred/cat-harness-tools/src/workflow/instance.js";
import { instanceId, loadInstance, saveInstance } from "@litlfred/cat-harness-tools/src/workflow/store.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";

/** This layer's root; its diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const CORE = resolve(import.meta.dir, "../..");

const bpmn = (stem: string): string => workflowFile(CORE, `${stem}.bpmn`);

const names = (model: ProcessModel, ids: string[]): string[] =>
  ids.map((id) => model.nodes.get(id)!.name).sort();

/** Walk Process_BeanOpen (bean `m8gz`) and take its `claimed` branch. */
function openBean(model: Awaited<ReturnType<typeof loadProcessModel>>, state: Parameters<typeof complete>[1]): void {
  drainSubprocess(model, state, "Task_ClaimBean");
  complete(model, state, "GW_BeanYours", { outcome: "claimed" });
}

describe("the model carries what the diagram already knew", () => {
  test("modelCarriesExtensions", async () => {
    const model = await loadProcessModel(bpmn("editing-hci-validation"));
    const draft = model.nodes.get("Task_DraftEdit")!;
    expect(draft.skills).toEqual(["content-author", "before-after-preview"]);
    expect(draft.lane).toContain("Authoring agent");
    // The `[skill]` line is for the SVG reader; the model takes it from the
    // extension and trims the name back to the activity.
    expect(draft.name).toBe("Draft the block edit");

    // The claim is Process_BeanOpen's now (bean `m8gz`); the step that drew it
    // is a call into it, and the `note` ops stay on the work.
    expect(model.nodes.get("Task_ClaimBean")!.calledElement).toBe("Process_BeanOpen");
    expect(model.nodes.get("Task_LogFindings")!.touchesWorkPlan).toBe(true);
  });

  test("callActivityReportsProcess", async () => {
    const model = await loadProcessModel(bpmn("content-lifecycle"));
    expect(model.nodes.get("CallActivity_Editing")!.calledElement).toBe("Process_Editing");
  });
});

describe("the HCI validation gate holds", () => {
  const editing = async () => loadProcessModel(bpmn("editing-hci-validation"));

  test("freshInstanceFirstStep", async () => {
    const model = await editing();
    const state = startInstance(model, { id: "t1", subject: "def:x" });
    expect(names(model, enabled(model, state).map((e) => e.node))).toEqual([
      "Describe the intended change",
    ]);
  });

  test("commitBeforeDecisionRefused", async () => {
    const model = await editing();
    const state = startInstance(model, { id: "t2", subject: "def:x" });
    // The whole point. Nothing has been drafted, let alone validated.
    expect(() => complete(model, state, "Task_Commit")).toThrow(WorkflowError);
    expect(() => complete(model, state, "Task_Commit")).toThrow(/not enabled/);
  });

  test("noRecommendationSkipsEvidence", async () => {
    // Gateway_RecommendationInPlay (folio-assistant-core#505): a figure redrawn
    // from its own source carries no recommendation, so there is no PICO to
    // frame. The `no` branch ends the subprocess at its own event; drafting is
    // enabled next, and nothing of the search ran.
    const model = await editing();
    const state = startInstance(model, { id: "t-norec", subject: "fig:15" });
    complete(model, state, "Task_DescribeChange");
    openBean(model, state);
    drainSubprocess(model, state, "CallActivity_Evidence", { Gateway_RecommendationInPlay: "no" });
    expect(enabled(model, state).map((e) => e.node)).toEqual(["Task_DraftEdit"]);
    const walked = JSON.stringify(state);
    expect(walked).toContain("Gateway_RecommendationInPlay");
    expect(walked).not.toContain("Task_FramePico");
  });

  test("bothBranchesBeforeCollation", async () => {
    const model = await editing();
    const state = startInstance(model, { id: "t3", subject: "def:x" });
    const step = (n: string, outcome?: string) => complete(model, state, n, { outcome });

    step("Task_DescribeChange");
    openBean(model, state);
    drainSubprocess(model, state, "CallActivity_Evidence");
    step("Task_DraftEdit");

    // The parallel fork put a token on each mechanical check AND on the
    // non-mechanical decision.
    const open = enabled(model, state);
    expect(open.filter((e) => e.kind === "decision").map((e) => e.name)).toEqual([
      "Judgement call?",
    ]);
    expect(names(model, open.filter((e) => e.kind === "activity").map((e) => e.node))).toEqual([
      "Build and QA gates",
      "Schema and constraint checks",
      "Syntax, spelling and links",
    ]);

    step("Task_SchemaValidate");
    step("Task_SyntaxSpell");
    step("Task_BuildGates");
    // Mechanical is done, but the join has not fired: the review branch is out.
    expect(names(model, enabled(model, state).map((e) => e.node))).toEqual(["Judgement call?"]);

    step("Gateway_ReviewerKind", "no");
    step("Task_AgentReview");
    // Now the join fires and the findings reach the editor.
    expect(names(model, enabled(model, state).map((e) => e.node))).toEqual([
      "Collate findings into a report",
    ]);
  });

  test("acceptReachesCorpus", async () => {
    const run = async (decision: string) => {
      const model = await editing();
      const state = startInstance(model, { id: `t-${decision}`, subject: "def:x" });
      const step = (n: string, outcome?: string) => complete(model, state, n, { outcome });
      step("Task_DescribeChange");
      openBean(model, state);
      drainSubprocess(model, state, "CallActivity_Evidence");
      step("Task_DraftEdit");
      step("Task_SchemaValidate");
      step("Task_SyntaxSpell");
      step("Task_BuildGates");
      step("Gateway_ReviewerKind", "yes");
      step("Task_SmeReview");
      step("Task_CollateFindings");
      step("Task_LogFindings");
      step("Task_ReviewFindings");
      // `u4hs`: the options analysis is interposed here. Ordinary edits take
      // `GW_Trigger`'s "no", the early exit the subprocess documents.
      drainSubprocess(model, state, "Call_OptionsAnalysis", { GW_Trigger: "no" });
      step("Task_RecordDecision");
      step("Gateway_EditorDecision", decision);
      return { model, state };
    };

    const accepted = await run("accept");
    expect(names(accepted.model, enabled(accepted.model, accepted.state).map((e) => e.node))).toEqual(
      ["Commit into the corpus"],
    );

    const discarded = await run("discard");
    // A discard still closes the bean (Process_BeanClose) before its end.
    drainSubprocess(discarded.model, discarded.state, "Task_ResolveBean", { Close_Outcome: "not wanted" });
    complete(discarded.model, discarded.state, "GW_BeanClosedHow", { outcome: "discarded" });
    // The end event consumed the only token: nothing left, and no commit.
    expect(enabled(discarded.model, discarded.state)).toEqual([]);
    expect(discarded.state.status).toBe("completed");
    expect(discarded.state.history.some((h) => h.node === "Task_Commit")).toBe(false);
  });

  test("reviseLoopsBack", async () => {
    const model = await editing();
    const state = startInstance(model, { id: "t5", subject: "def:x" });
    const step = (n: string, outcome?: string) => complete(model, state, n, { outcome });
    step("Task_DescribeChange");
    openBean(model, state);
    drainSubprocess(model, state, "CallActivity_Evidence");
    step("Task_DraftEdit");
    step("Task_SchemaValidate");
    step("Task_SyntaxSpell");
    step("Task_BuildGates");
    step("Gateway_ReviewerKind", "no");
    step("Task_AgentReview");
    step("Task_CollateFindings");
    step("Task_LogFindings");
    step("Task_ReviewFindings");
    // `u4hs`: the options analysis is interposed here. Ordinary edits take
    // `GW_Trigger`'s "no", the early exit the subprocess documents.
    drainSubprocess(model, state, "Call_OptionsAnalysis", { GW_Trigger: "no" });
    step("Task_RecordDecision");
    step("Gateway_EditorDecision", "revise");

    expect(names(model, enabled(model, state).map((e) => e.node))).toEqual([
      "Revise the proposed change",
    ]);
    step("Task_ReviseEdit");
    // Round two: the mechanical checks are enabled again, not skipped because
    // they passed the first time.
    expect(
      names(model, enabled(model, state).filter((e) => e.kind === "activity").map((e) => e.node)),
    ).toEqual(["Build and QA gates", "Schema and constraint checks", "Syntax, spelling and links"]);
  });
});

describe("decisions are asked for, not guessed", () => {
  test("gatewayNeedsOutcome", async () => {
    const model = await loadProcessModel(bpmn("editing-hci-validation"));
    const state = startInstance(model, { id: "t6", subject: "def:x" });
    complete(model, state, "Task_DescribeChange");
    openBean(model, state);
    drainSubprocess(model, state, "CallActivity_Evidence");
    complete(model, state, "Task_DraftEdit");

    expect(() => complete(model, state, "Gateway_ReviewerKind")).toThrow(/is a decision/);
    expect(() => complete(model, state, "Gateway_ReviewerKind", { outcome: "maybe" })).toThrow(
      /Valid: no, yes/,
    );
  });
});

describe("instance state survives the process it was made in", () => {
  test("instanceRoundTrips", async () => {
    const repo = mkdtempSync(join(tmpdir(), "wf-store-"));
    const model = await loadProcessModel(bpmn("editing-hci-validation"));
    const id = instanceId(model.id, "def:carbon-valence");
    // Derived, not random — re-running a step for the same block must find the
    // instance that exists rather than mint a second.
    expect(id).toBe("editing--def-carbon-valence");
    expect(instanceId(model.id, "def:carbon-valence")).toBe(id);

    const state = startInstance(model, { id, subject: "def:carbon-valence", bean: "fq0b" });
    complete(model, state, "Task_DescribeChange");
    saveInstance(repo, state);

    const back = loadInstance(repo, id)!;
    expect(back.bean).toBe("fq0b");
    expect(back.tokens).toEqual(state.tokens);
    // Inside Process_BeanOpen, whose first step is what is enabled.
    expect(enabled(model, back).map((e) => e.node)).toEqual(["Open_CheckExists"]);
    rmSync(repo, { recursive: true, force: true });
  });
});
