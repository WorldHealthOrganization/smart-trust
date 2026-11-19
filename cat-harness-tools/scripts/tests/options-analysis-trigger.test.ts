/**
 * `Process_OptionsAnalysis` has a way to STOP — bean `u4hs`.
 *
 * `A_Frame`'s documentation has always ended with the trigger question:
 *
 * > *"is this irreversible, or would the answer surprise someone? If neither,
 * > say so and stop; the calling step decides without this subprocess. Stopping
 * > here is a correct outcome, not a skipped step."*
 *
 * And until `GW_Trigger` was added, **the diagram gave it no way to stop.**
 * `A_Frame`'s only outgoing edge went to `A_Select`, so the prose promised a
 * branch the model did not have, and a wired caller had to run all four
 * activities for every decision — the ceremony this process's own documentation
 * refuses: *"a subprocess fired on every decision becomes ceremony, and ceremony
 * is how a gate stops being read."*
 *
 * ## Why it was invisible until the second caller
 *
 * With one caller the straight line looked correct. Wiring
 * `editing-hci-validation` made its corpus-gate tests fail with
 * `Task_RecordDecision is not enabled. Enabled now: A_Frame.` — every write in
 * that process now required a full options analysis, including a spelling fix.
 * **The defect was in the subprocess, and the second caller is what surfaced it.**
 *
 * That is the general shape worth keeping: a subprocess with one caller is a
 * subprocess whose contract has been tested once, by the diagram that happened to
 * fit it.
 *
 * @module scripts/tests/options-analysis-trigger.test
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { loadProcessModel } from "../../src/workflow/process-model";
import { complete, enabled, startInstance } from "../../src/workflow/instance";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { harnessPath } from "../lib/harness-layout.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
// declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
const DIAGRAM = harnessPath("processes/process/options-analysis.bpmn", INSTANCE_ROOT);

const names = (ids: string[]): string[] => [...ids].sort();

async function start(label: string) {
  const model = await loadProcessModel(DIAGRAM);
  const state = startInstance(model, { id: `oa-${label}`, subject: label });
  return { model, state };
}

describe("the trigger gateway", () => {
  test("A_Frame leads to the GATEWAY, not straight to A_Select", async () => {
    // The defect, stated as the assertion that would have caught it. Before
    // `GW_Trigger`, completing `A_Frame` enabled `A_Select` and there was no
    // choice to make.
    const { model, state } = await start("shape");
    complete(model, state, "A_Frame");
    expect(names(enabled(model, state).map((e) => e.node))).toEqual(["GW_Trigger"]);
  });

  test("`no` reaches a DISTINCT end event and never touches A_Select", async () => {
    // The early exit. Asserted as an absence too: a reversible choice must not
    // leave a token anywhere in the analysis, or "stopping here is a correct
    // outcome" is untrue of the model however the prose reads.
    const { model, state } = await start("reversible");
    complete(model, state, "A_Frame");
    complete(model, state, "GW_Trigger", { outcome: "no" });
    expect(state.tokens).not.toContain("A_Select");
    expect(state.tokens).not.toContain("A_Record");
    expect(enabled(model, state)).toEqual([]);
  });

  test("`yes` still runs the whole analysis, in order", async () => {
    // The control. Without it the test above could be passing because the
    // gateway routes everything to the exit, which would be the opposite defect
    // and just as quiet.
    const { model, state } = await start("irreversible");
    complete(model, state, "A_Frame");
    complete(model, state, "GW_Trigger", { outcome: "yes" });
    // `A_CheckEvidence` joined the sequence on 2026-09-22: selecting a
    // methodology now checks that the source it cites resolves, because
    // six methodologies cited an origin and none had one in any library.
    for (const step of ["A_Select", "A_CheckEvidence", "A_Apply", "A_Record"]) {
      expect(names(enabled(model, state).map((e) => e.node))).toEqual([step]);
      complete(model, state, step);
    }
    expect(enabled(model, state)).toEqual([]);
  });

  test("the two outcomes are DIFFERENT end events", async () => {
    // Not a short-circuit into one end. A caller must be able to tell "no
    // analysis was needed" from "the analysis recommends X" — the same reason a
    // could-not-determine is never reported as a pass. One end event for both
    // would make a considered skip indistinguishable from a finished comparison.
    const { model } = await start("ends");
    const ends = [...model.nodes.values()].filter((n) => /EndEvent/i.test(n.type)).map((n) => n.id);
    expect(names(ends)).toEqual(["End_Process_OptionsAnalysis", "End_TriggerNotMet"]);
  });

  test("the gateway is NOT dmn-backed, because the question is judged", async () => {
    // `dmn` says to claim computability only where the criteria recur with the
    // same inputs having to produce the same answer. "Would this surprise
    // someone" does not, so the outcome is supplied at the step. A decision node
    // that refused a supplied outcome would make the early exit unreachable.
    const { model, state } = await start("judged");
    complete(model, state, "A_Frame");
    const gw = enabled(model, state).find((e) => e.node === "GW_Trigger");
    expect(gw?.kind).toBe("decision");
    expect(names((gw as { outcomes: string[] }).outcomes)).toEqual(["no", "yes"]);
  });
});
