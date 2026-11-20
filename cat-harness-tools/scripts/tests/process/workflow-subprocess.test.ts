/**
 * Subprocess descent — a call activity IS the process it names.
 *
 * Before this, a `callActivity` was an opaque box the caller completed in one
 * step, which meant a decomposed diagram was strictly WORSE than a flat one: it
 * read better and gated less.
 *
 * The cases here run on FIXTURE diagrams only. The cases that walk a real
 * decomposed process moved with that process to
 * `folio-assistant-core/scripts/tests/l1-ingestion-subprocess.test.ts` in
 * placement PR6 (bean `apcg`): `document-ingestion.bpmn` became the harness's
 * basic flow, which calls no subprocess, and the four-phase pipeline they walk
 * is core's `l1-document-ingestion.bpmn` now. A harness test loading a core
 * diagram would be an upward reference.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { complete, enabled, startInstance } from "../../../src/workflow/instance";
import { loadProcessModel, UnsupportedBpmn } from "../../../src/workflow/process-model";

describe("a call activity resolves to the process it names", () => {
  test("a call activity naming a process no file defines stays opaque", async () => {
    // Legitimate: a folio may call out to a process it does not host. The step
    // is then a single step again — which is what it was before descent.
    const dir = mkdtempSync(join(tmpdir(), "wf-opaque-"));
    try {
      writeFileSync(
        join(dir, "p.bpmn"),
        `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="urn:t">
  <bpmn:process id="Process_Opaque">
    <bpmn:startEvent id="S"/>
    <bpmn:callActivity id="Call_Away" name="Off to somewhere else" calledElement="Process_Elsewhere"/>
    <bpmn:endEvent id="E"/>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="Call_Away"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Call_Away" targetRef="E"/>
  </bpmn:process>
</bpmn:definitions>`,
      );
      const model = await loadProcessModel(join(dir, "p.bpmn"));
      expect(model.children.size).toBe(0);

      const state = startInstance(model, { id: "opaque", subject: "x" });
      expect(enabled(model, state).map((e) => e.node)).toEqual(["Call_Away"]);
      complete(model, state, "Call_Away");
      expect(state.status).toBe("completed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a call-activity cycle is refused at load, not discovered at run time", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-cycle-"));
    try {
      const proc = (id: string, calls: string): string =>
        `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D_${id}" targetNamespace="urn:t">
  <bpmn:process id="${id}">
    <bpmn:startEvent id="S_${id}"/>
    <bpmn:callActivity id="Call_${id}" name="on" calledElement="${calls}"/>
    <bpmn:endEvent id="E_${id}"/>
    <bpmn:sequenceFlow id="F1_${id}" sourceRef="S_${id}" targetRef="Call_${id}"/>
    <bpmn:sequenceFlow id="F2_${id}" sourceRef="Call_${id}" targetRef="E_${id}"/>
  </bpmn:process>
</bpmn:definitions>`;
      writeFileSync(join(dir, "a.bpmn"), proc("Process_A", "Process_B"));
      writeFileSync(join(dir, "b.bpmn"), proc("Process_B", "Process_A"));
      await expect(loadProcessModel(join(dir, "a.bpmn"))).rejects.toThrow(UnsupportedBpmn);
      await expect(loadProcessModel(join(dir, "a.bpmn"))).rejects.toThrow(/already[\s\S]*call path/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
