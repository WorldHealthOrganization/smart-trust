import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { drainSubprocess } from "@litlfred/cat-harness-tools/scripts/tests/helpers.js";
import { loadProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { complete, enabled, startInstance } from "@litlfred/cat-harness-tools/src/workflow/instance.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";

/**
 * This layer's root; diagrams are found by NAME through its declared `processes` graphs (bean `63wl`).
 * The test lives in folio-assistant-core because the diagram does (bean `ho66`).
 */
const HARNESS = resolve(import.meta.dir, "../..");

/**
 * The review phase of `content-change-review.bpmn`
 * (`content-change-review-committee.bpmn` since the 2026-10-31 split into
 * phases), run on a fixture. Bean
 * `en2d`: the owner ruled to extend this diagram rather than draw a separate
 * large-document one, and to give slicing and coverage their own lane, the
 * review coordinator, apart from the editor who decides.
 *
 * What is held here:
 * - the coverage gate is COMPUTED from two counts, and a hand-supplied
 *   answer is refused;
 * - "not covered" loops back to slicing, so review cannot reach sign-off
 *   while a changed block is unread or a defect is open;
 * - approve and merge are two steps, and merge is the last one.
 */

const model = () => loadProcessModel(workflowFile(HARNESS, "content-change-review-committee.bpmn"));
const top = () => loadProcessModel(workflowFile(HARNESS, "content-change-review.bpmn"));
const publish = () => loadProcessModel(workflowFile(HARNESS, "content-change-review-publish.bpmn"));
const at = (m: Awaited<ReturnType<typeof model>>, s: ReturnType<typeof startInstance>) =>
  enabled(m, s).map((e) => e.node);

// Every fact, as `review-coverage` emits them: the engine refuses a missing one.
const facts = (f: Record<string, unknown>) => ({
  uncoveredBlocks: 0, openDefects: 0, rendered: "known", unreviewedPages: 0, undeterminedInputs: 0, measured: "known", missedPages: 0, ...f,
});

/** From the reviewer's start to the coverage gate, with no withdrawal and no dispute. */
async function toCoverageGate() {
  const m = await model();
  const s = startInstance(m, { id: "ccr1", subject: "fixture", startNode: "Start_Reviewer" });
  complete(m, s, "Task_CompareBeforeAfter");
  complete(m, s, "Task_IngestComments");
  complete(m, s, "Task_SliceAndAssign");
  drainSubprocess(m, s, "Call_ReviewSlices");
  complete(m, s, "GW_Withdraw", { outcome: "No" });
  complete(m, s, "GW_Disputed", { outcome: "No" });
  expect(at(m, s)).toEqual(["GW_Covered"]);
  return { m, s };
}

describe("content-change-review: sliced review and the coverage gate", () => {
  test("coordinatorIngestsAndSlices", async () => {
    const m = await model();
    expect(m.nodes.get("Task_IngestComments")?.lane).toBe("Review Coordinator");
    expect(m.nodes.get("Task_SliceAndAssign")?.lane).toBe("Review Coordinator");
    expect(m.nodes.get("GW_Covered")?.lane).toBe("Review Coordinator");
    expect(m.nodes.get("Call_ReviewSlices")?.calledElement).toBe("Process_Review");
    expect(m.nodes.get("Call_Adjudication")?.calledElement).toBe("Process_Adjudication");
  });


  test("unreviewedBlockBackToSlicing", async () => {
    const { m, s } = await toCoverageGate();
    complete(m, s, "GW_Covered", { facts: facts({ uncoveredBlocks: 2 }) });
    expect(at(m, s)).toEqual(["Task_SliceAndAssign"]);
  });

  test("openDefectBackToSlicing", async () => {
    const { m, s } = await toCoverageGate();
    complete(m, s, "GW_Covered", { facts: facts({ openDefects: 1 }) });
    expect(at(m, s)).toEqual(["Task_SliceAndAssign"]);
  });

  test("unreviewedPageBackToSlicing", async () => {
    const { m, s } = await toCoverageGate();
    complete(m, s, "GW_Covered", { facts: facts({ unreviewedPages: 1 }) });
    expect(at(m, s)).toEqual(["Task_SliceAndAssign"]);
  });

  test("gateComputedNotAsserted", async () => {
    const { m, s } = await toCoverageGate();
    expect(() => complete(m, s, "GW_Covered", { outcome: "yes" })).toThrow();
  });

  test("coveredToSignOff", async () => {
    const { m, s } = await toCoverageGate();
    complete(m, s, "GW_Covered", { facts: facts({}) });
    // The editorial-dependency review arrived here from the harness's
    // `review-narrative` (placement PR3, bean `63wl`), ahead of the impact review.
    expect(at(m, s)).toEqual(["Task_ReviewUses"]);
    complete(m, s, "Task_ReviewUses");
    expect(at(m, s)).toEqual(["Task_ReviewImpact"]);
    complete(m, s, "Task_ReviewImpact");
    complete(m, s, "GW_Approved", { outcome: "Yes" });
    expect(at(m, s)).toEqual(["Task_Approve"]);
    complete(m, s, "Task_Approve");
    expect(at(m, s)).toEqual([]);
    expect(m.nodes.has("Task_Merge")).toBe(false);
  });

  test("publishOpensWithMerge", async () => {
    const m = await publish();
    const s = startInstance(m, { id: "ccr3", subject: "fixture", startNode: "Start_Publish" });
    expect(at(m, s)).toEqual(["Task_Merge"]);
  });

  test("withdrawalAndDisputeSteps", async () => {
    const m = await model();
    const s = startInstance(m, { id: "ccr2", subject: "fixture", startNode: "Start_Reviewer" });
    complete(m, s, "Task_CompareBeforeAfter");
    complete(m, s, "Task_IngestComments");
    complete(m, s, "Task_SliceAndAssign");
    drainSubprocess(m, s, "Call_ReviewSlices");
    complete(m, s, "GW_Withdraw", { outcome: "Yes" });
    expect(at(m, s)).toEqual(["Task_WithdrawComment"]);
    complete(m, s, "Task_WithdrawComment");
    complete(m, s, "GW_Disputed", { outcome: "Yes" });
    drainSubprocess(m, s, "Call_Adjudication");
    expect(at(m, s)).toEqual(["GW_Covered"]);
  });
});

describe("content-change-review: the top level shows phases, not steps", () => {
  test("phasesAreCallActivities", async () => {
    const m = await top();
    const calls = Object.fromEntries(
      [...m.nodes.values()].filter((n) => n.calledElement).map((n) => [n.id, n.calledElement]),
    );
    expect(calls).toMatchObject({
      Call_MakeChange: "Process_ContentChangeReviewMake",
      Call_StageChange: "Process_ContentChangeReviewStage",
      Call_CommitteeReview: "Process_ContentChangeReviewCommittee",
      Call_Publish: "Process_ContentChangeReviewPublish",
    });
  });

  test("requestedChangeRestaged", async () => {
    const m = await top();
    const s = startInstance(m, { id: "ccr4", subject: "fixture", startNode: "Start_Author" });
    complete(m, s, "Task_DescribeChange");
    drainSubprocess(m, s, "Call_BeanOpen");
    complete(m, s, "GW_BeanYours", { outcome: "claimed" });
    drainSubprocess(m, s, "Call_MakeChange");
    drainSubprocess(m, s, "Call_StageChange");
    complete(m, s, "Task_ReviewStaging");
    complete(m, s, "GW_AuthorSatisfied", { outcome: "Yes" });
    complete(m, s, "Task_SubmitForReview");
    // Drained by hand: the coverage gate inside the phase is computed, so it takes facts.
    const choose: Record<string, string> = { GW_Approved: "No", GW_Withdraw: "No", GW_Disputed: "No" };
    for (let guard = 0; s.tokens.includes("Call_CommitteeReview"); guard++) {
      if (guard > 100) throw new Error("the committee phase did not finish");
      const step = enabled(m, s)[0]!;
      if (step.node === "GW_Covered") complete(m, s, step.node, { facts: facts({}) });
      else if (step.kind === "decision") complete(m, s, step.node, { outcome: choose[step.node] ?? step.outcomes[0] });
      else complete(m, s, step.node);
    }
    complete(m, s, "GW_CommitteeApproved", { outcome: "changes requested" });
    expect(at(m, s)).toEqual(["Task_Iterate"]);
    complete(m, s, "Task_Iterate");
    expect(s.tokens).toContain("Call_StageChange");
  });
});
