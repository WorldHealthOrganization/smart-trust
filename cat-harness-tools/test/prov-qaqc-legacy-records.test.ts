/**
 * `prov-qaqc` on a workflow store holding records in the earlier shape
 * (`instanceId`, `bpmnPath`, history entries keyed by `elementId`). It used to
 * throw `undefined is not an object (evaluating 'a.id.localeCompare')` on the
 * first such file (dth-sc's `editing--fig-5` / `editing--fig-6`, WHO dth-sc#6),
 * so `check:prov-qaqc` failed before judging anything. Each such record is now
 * a `legacy-record` finding (advisory) and the report runs to a verdict.
 */
import { describe, expect, test } from "bun:test";

import type { InstanceState } from "../src/workflow/instance.js";
import { buildReport, instanceIdOf, isCurrentShape, renderPage, totals } from "../scripts/prov-qaqc.js";

/** The shape of `beans/workflows/editing--fig-5.json` on cat/dth-sc/beans, trimmed. */
const legacy = {
  $schema: "folio-workflow-instance/v1",
  instanceId: "editing--fig-5",
  processId: "Process_EditingValidation",
  bpmnPath: "cat-harness/processes/content/editing-hci-validation.bpmn",
  subject: "fig:5",
  status: "completed",
  currentActivity: "EndEvent_Accepted",
  history: [{ step: 1, elementId: "StartEvent_BlockChanged", actor: "agent", action: "completed" }],
} as unknown as InstanceState;

const nameless = { processId: "Process_X", subject: "x", history: [] } as unknown as InstanceState;

describe("prov-qaqc: records in the earlier shape", () => {
  test("the id is read from either shape", () => {
    expect(instanceIdOf(legacy)).toBe("editing--fig-5");
    expect(instanceIdOf({ id: "editing--fig-15" } as InstanceState)).toBe("editing--fig-15");
    expect(instanceIdOf(nameless)).toBe("");
  });

  test("only the current shape is walked", () => {
    expect(isCurrentShape(legacy)).toBe(false);
    expect(isCurrentShape(nameless)).toBe(false);
    expect(
      isCurrentShape({ id: "a", source: "x.bpmn", history: [{ at: "t", node: "Start" }] } as unknown as InstanceState),
    ).toBe(true);
  });

  test("a store of legacy records reports them instead of throwing", async () => {
    const r = await buildReport(undefined, { instances: [legacy, nameless], diagrams: [] });
    expect([...r.instances.keys()]).toEqual(["(unnamed instance 2)", "editing--fig-5"]);
    const parts = r.instances.get("editing--fig-5")!;
    expect(parts).toHaveLength(1);
    expect(parts[0]!.source).toBe("cat-harness/processes/content/editing-hci-validation.bpmn");
    expect(parts[0]!.findings.map((f) => f.kind)).toEqual(["legacy-record"]);
    expect(r.invalid).toEqual([]);
    expect(totals(r).byKind["legacy-record"]).toBe(2);
    expect(renderPage(r)).toContain("`legacy-record`");
  });

  test("a page with no legacy record does not gain the row", async () => {
    const r = await buildReport(undefined, { instances: [], diagrams: [] });
    expect(renderPage(r)).not.toContain("legacy-record");
  });
});
