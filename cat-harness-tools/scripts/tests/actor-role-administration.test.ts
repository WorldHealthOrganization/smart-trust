/**
 * The administration diagram — the structural claims that make it worth
 * drawing at all.
 *
 * Bean `folio-assistant-hb2o`. Every step here ends as a reviewed edit to a
 * JSON file, so the question the diagram has to answer is what it adds over
 * `code-change-review`. These tests pin the answer:
 *
 *  - it CALLS that process rather than restating it;
 *  - the administrative lane is person-only, because a permission grant is a
 *    standing decision rather than a task;
 *  - the audit runs AFTER the change, not before;
 *  - retirement names `deletion-requires-confirmation`.
 *
 * A diagram that lost any of those would still be valid BPMN and would have
 * stopped being worth having.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "path";

import { loadProcessModel } from "../../src/workflow/process-model";
import { fulfilmentKindsForBpmnType, findRole } from "../../schemas/process/role-graph.ts";
import { roleGraphFor } from "../known-skills";
import { workflowFile } from "../known-skills.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** The harness root; diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const HARNESS = resolve(HARNESS_ROOT);

const ROOT = resolve(HARNESS_ROOT);
const model = () => loadProcessModel(workflowFile(HARNESS, "actor-role-administration.bpmn"));

describe("what it adds over code-change-review", () => {
  test("it NAMES that process rather than restating its steps", async () => {
    // Not a call: `code-change-review` is in the opt-in `sdlc` sub-graph, and
    // an always-on diagram may not call what a layer without it does not have
    // (owner card Q-OPTIN-CALLS A, 2026-11-12, cat-harness#1269). The step
    // names the process in its documentation instead, and calls nothing.
    const m = await model();
    const step = m.nodes.get("CallActivity_CodeChangeReview");
    expect(step?.calledElement).toBeUndefined();
    expect(step?.documentation).toContain("Process_CodeChangeReview");
  });

  test("the audit runs after the call, not before", async () => {
    // Every kg:audit criterion is a JOIN — role to lane, actor to role,
    // activity to skill — so what an administrative edit breaks is not in the
    // file it edited. Running it first would audit the old graph.
    const m = await model();
    const toAudit = [...m.flows.values()].find((f) => f.to === "Task_RunKgAudit");
    expect(toAudit?.from).toBe("CallActivity_CodeChangeReview");
  });

  test("retiring an actor names deletion-requires-confirmation", async () => {
    // An actor id is referenced from roles, diagrams, beans and commits.
    // Removing the file leaves all of them unable to tell retirement from
    // accident — the same reason a bean is scrapped rather than deleted.
    const m = await model();
    const skills = m.nodes.get("Task_RetireActor")?.skills ?? [];
    expect(skills).toContain("deletion-requires-confirmation");
  });
});

describe("the administrator lane", () => {
  test("every administrative activity is a userTask — none can be automated", async () => {
    // Not a style choice. `fulfilmentKindsForBpmnType` is what refuses a
    // system actor here, and a serviceTask would hand the closure-widening
    // step to a fixed program.
    const m = await model();
    for (const id of ["Task_AddActor", "Task_AssignRoles", "Task_GrantOrRevoke", "Task_RetireActor"]) {
      const node = m.nodes.get(id);
      expect(node, id).toBeDefined();
      expect(fulfilmentKindsForBpmnType(node!.type), id).not.toContain("system");
    }
  });

  test("the role it binds admits only people", async () => {
    const graph = roleGraphFor(ROOT);
    const role = findRole(graph!, "administrator");
    expect(role?.actorKinds).toEqual(["person"]);
  });

  test("the role carries every skill its lane's activities name", async () => {
    // `role-carries-activity-skill` audits this across the corpus; asserting
    // it here names the failure against THIS diagram, where it is fixable.
    const m = await model();
    const graph = roleGraphFor(ROOT);
    const role = findRole(graph!, "administrator");
    const lane = m.nodes.get("Task_GrantOrRevoke");
    expect(lane?.skills ?? []).toContain("role-model");
    expect(role?.skills).toContain("role-model");
    expect(role?.skills).toContain("deletion-requires-confirmation");
  });
});

describe("the process declares its own policy", () => {
  test("strict and logged, both stated rather than defaulted", async () => {
    // `process-model.ts` reads an absent policy as strict, so 16 of the
    // diagrams here are strict because nobody typed it (bean `30hn`). A
    // process that edits the permission closure should not be in that set.
    const m = await model();
    expect(m.enforcement).toBe("strict");
    expect(m.logCapture).toBe("on");
  });
});
