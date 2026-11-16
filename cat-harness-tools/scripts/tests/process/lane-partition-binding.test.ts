/**
 * A lane NAMES its Role through standard BPMN `partitionElementRef`, and the
 * legacy `<bootstrap.processes:role ref>` is still read — as a fallback.
 *
 * @module scripts/tests/lane-partition-binding.test
 *
 * Owner, 2026-10-16 (thread "BPMN lane, role and skill modelling"): *"Lane
 * names Role, not Actor"*. The implementation spec makes `partitionElementRef`
 * on `<bpmn:lane>` the binding, pointing at a top-level `<bpmn:resource>` whose
 * id is the Role's id verbatim, and keeps the legacy element readable for one
 * release as a warning. The precedence is cat-harness's `laneRoleRef`; these
 * tests pin that the engine's model asks it, and the two moddle warnings that
 * the new markup would otherwise turn into a refused load.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadProcessModel, partitionTolerated } from "../../../src/workflow/process-model.ts";

const NS = "https://litlfred.github.io/bootstrap/v0/processes/ns/";

/** A one-task diagram whose head and lane markup the test chooses. */
function diagram(opts: { head?: string; lane: string; laneExt?: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bootstrap.processes="${NS}" id="D" targetNamespace="https://example.test/wf">
  ${opts.head ?? ""}
  <bpmn:process id="P" isExecutable="false">
    <bpmn:laneSet id="LS">
      <bpmn:lane id="Lane_CI" name="CI/CD Pipeline"${opts.lane}>
        ${opts.laneExt ? `<bpmn:extensionElements>${opts.laneExt}</bpmn:extensionElements>` : ""}
        <bpmn:flowNodeRef>S</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>T</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>E</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="S"/>
    <bpmn:serviceTask id="T" name="Build">
      <bpmn:extensionElements><bootstrap.processes:skill ref="run-build"/></bpmn:extensionElements>
    </bpmn:serviceTask>
    <bpmn:endEvent id="E"/>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T"/>
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E"/>
  </bpmn:process>
</bpmn:definitions>`;
}

async function modelOf(xml: string) {
  const dir = mkdtempSync(join(tmpdir(), "lane-partition-"));
  const file = join(dir, "p.bpmn");
  writeFileSync(file, xml);
  try {
    return await loadProcessModel(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const IMPORT = `<bpmn:import namespace="${NS}" location="https://litlfred.github.io/bootstrap/v0/processes/ns.jsonld" importType="http://www.w3.org/ns/json-ld"/>`;
const RESOURCE = `<bpmn:resource id="build-pipeline" name="Build pipeline"/>`;
const LEGACY = (ref: string) => `<bootstrap.processes:role ref="${ref}"/>`;

describe("loadProcessModel reads both spellings", () => {
  test("partitionElementRef → a declared <bpmn:resource>, with the <bpmn:import> head", async () => {
    const m = await modelOf(diagram({ head: `${IMPORT}\n${RESOURCE}`, lane: ` partitionElementRef="build-pipeline"` }));
    const lane = m.lanes[0]!;
    expect(lane.roleRef).toBe("build-pipeline");
    expect(lane.roleBinding).toBe("partitionElementRef");
    expect(lane.roleResourceDeclared).toBeUndefined();
    expect(lane.roleBindingWarning).toBeUndefined();
    // The node carries the lane's Role too — what `performedBy` and the engine read.
    expect(m.nodes.get("T")!.roleRef).toBe("build-pipeline");
    expect(m.nodes.get("T")!.skills).toEqual(["run-build"]);
  });

  test("the legacy ref alone still binds, marked legacy", async () => {
    const m = await modelOf(diagram({ lane: "", laneExt: LEGACY("build-pipeline") }));
    expect(m.lanes[0]!.roleRef).toBe("build-pipeline");
    expect(m.lanes[0]!.roleBinding).toBe("legacy-role-ref");
    // Accepted AS A WARNING, carried to whoever reports it.
    expect(m.lanes[0]!.roleBindingWarning).toContain("deprecated");
  });

  test("both, disagreeing: partitionElementRef wins, with a warning", async () => {
    const m = await modelOf(diagram({ head: RESOURCE, lane: ` partitionElementRef="build-pipeline"`, laneExt: LEGACY("reviewer") }));
    expect(m.lanes[0]!.roleRef).toBe("build-pipeline");
    expect(m.lanes[0]!.roleBinding).toBe("partitionElementRef");
    expect(m.lanes[0]!.roleBindingWarning).toContain("reviewer");
  });

  test("variable=\"true\" is a declaration, not a binding", async () => {
    const m = await modelOf(diagram({ lane: "", laneExt: `<bootstrap.processes:role variable="true"/>` }));
    expect(m.lanes[0]!.performerVaries).toBe(true);
    expect(m.lanes[0]!.roleRef).toBeUndefined();
    expect(m.lanes[0]!.roleBinding).toBeUndefined();
  });

  test("a partitionElementRef with no declared resource loads, and says so", async () => {
    const m = await modelOf(diagram({ lane: ` partitionElementRef="build-pipeline"` }));
    expect(m.lanes[0]!.roleRef).toBe("build-pipeline");
    expect(m.lanes[0]!.roleResourceDeclared).toBe(false);
  });

  test("the first draft's <bpmn:extension definition> does not refuse the load", async () => {
    const head = `<bpmn:extension definition="bootstrap.processes:skill" mustUnderstand="false"/>\n${RESOURCE}`;
    const m = await modelOf(diagram({ head, lane: ` partitionElementRef="build-pipeline"` }));
    expect(m.lanes[0]!.roleRef).toBe("build-pipeline");
  });

  test("any OTHER parse warning still refuses the load", () => {
    const other = { message: "unparsable content <x> detected", element: { $type: "bpmn:Task" } };
    expect(partitionTolerated([other]).warnings).toEqual([other]);
  });
});
