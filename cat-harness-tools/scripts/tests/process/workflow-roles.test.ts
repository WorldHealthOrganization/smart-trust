/**
 * The interpreter reports what an agent is acting AS, not only which box the
 * step was drawn in.
 *
 * `enabled()` took `(model, state)` and returned the lane's free-text name.
 * That is not an answer to "who performs this" — sixty lane strings spell two
 * dozen positions — so an agent handed a step could not find out what skills
 * its performer carries. These pin the join, and the fallback that keeps an
 * unmigrated layer working.
 */
import { describe, expect, test } from "bun:test";
import { join, basename } from "node:path";

import { loadProcessModel, processDiagrams } from "../../../src/workflow/process-model.js";
import { enabled, startInstance, describe as renderInstance } from "../../../src/workflow/instance.js";
import { readRoleGraph, resolveRoleSkills } from "../../../schemas/process/role-graph.js";
import { checkoutRoleGraph } from "../../../schemas/process/scenario-overlay.js";
import { workflowFile, workflowFiles } from "../../known-skills.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

// A real-corpus sweep: about five seconds on a loaded runner, past bun's 5s default.
const CORPUS_TIMEOUT = 60_000;

const ROOT = join(HARNESS_ROOT);
const graph = readRoleGraph(join(ROOT, "scenarios"));

// The pins below run on `crdm-requirements.bpmn`, a diagram cat-harness owns,
// so the interpreter is tested where it lives. They read `getting-started` and
// `editing-hci-validation` until 2026-10-06, both folio-assistant-core's, so
// standing alone the harness had nothing to run them on (bean `ho66`). Any
// diagram whose first steps bind a role serves; the assertions are unchanged.

describe("enabled() joins a lane to its declared role", () => {
  test("reports the role, not only the lane's spelling", async () => {
    const model = await loadProcessModel(workflowFile(ROOT, "crdm-requirements.bpmn"));
    const state = startInstance(model, { id: "test-instance", subject: "test-subject" });
    const open = enabled(model, state, graph);
    expect(open.length).toBeGreaterThan(0);
    for (const e of open) {
      if (!e.lane) continue;
      expect(e.role, `lane "${e.lane}" bound no role`).toBeDefined();
    }
  });

  test("an activity's roleSkills is the role's closure, not the activity's own refs", async () => {
    const model = await loadProcessModel(workflowFile(ROOT, "crdm-requirements.bpmn"));
    const state = startInstance(model, { id: "test-instance", subject: "test-subject" });
    for (const e of enabled(model, state, graph)) {
      if (e.kind !== "activity" || !e.role) continue;
      expect(e.roleSkills).toEqual(resolveRoleSkills(graph!, e.role).map((s) => s.skill));
    }
  });

  test("without a role graph the interpreter still works — unmigrated is not broken", async () => {
    const model = await loadProcessModel(workflowFile(ROOT, "crdm-requirements.bpmn"));
    const state = startInstance(model, { id: "test-instance", subject: "test-subject" });
    const open = enabled(model, state);
    expect(open.length).toBeGreaterThan(0);
    for (const e of open) {
      expect(e.role).toBeUndefined();
      if (e.kind === "activity") expect(e.roleSkills).toBeUndefined();
    }
  });

  test("describe() and enabled() cannot disagree about who performs a step", async () => {
    const model = await loadProcessModel(workflowFile(ROOT, "crdm-requirements.bpmn"));
    const state = startInstance(model, { id: "test-instance", subject: "test-subject" });
    const rendered = renderInstance(model, state, graph);
    for (const e of enabled(model, state, graph)) {
      if (e.role) expect(rendered).toContain(e.role);
    }
  });
});

describe("every activity in every diagram is performed by a declared role", () => {
  test("no enabled step in any process would report an unbound lane", async () => {
    // The diagrams are the checkout's, so the roles are too: a dependent that
    // owns a lane may own the role it binds, declared in its own scenarios/.
    const roles = checkoutRoleGraph(ROOT, graph)?.graph ?? graph;
    const unbound: string[] = [];
    for (const f of processDiagrams(workflowFiles(ROOT)).map((p) => basename(p))) {
      const model = await loadProcessModel(workflowFile(ROOT, f));
      for (const lane of model.lanes) {
        const role = roles!.roles.find(
          (r) => lane.roleRef !== undefined && r.id === lane.roleRef,
        );
        if (!role) unbound.push(`${f}: ${lane.name ?? lane.id}`);
      }
    }
    expect(unbound).toEqual([]);
  }, CORPUS_TIMEOUT);
});
