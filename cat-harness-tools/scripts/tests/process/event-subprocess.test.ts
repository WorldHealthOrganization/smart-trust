/**
 * An event subprocess (`triggeredByEvent`) loads: its steps are the process's
 * own, and they take the container's lane.
 *
 * Owner, 2026-10-31, on public-comment.bpmn: withdrawal can happen at any
 * open status, so it is drawn as an interrupting event subprocess rather
 * than a second top-level start with nothing linking it to the main path.
 * Before this, the interpreter refused any `bpmn:SubProcess`.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadProcessModel } from "../../../src/workflow/process-model";

const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
  <bpmn:process id="P" name="P" isExecutable="false">
    <bpmn:laneSet id="LS">
      <bpmn:lane id="L1" name="Commenter">
        <bpmn:flowNodeRef>S</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>T</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>E</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Sub</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="T" name="Main"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T"/>
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E"/>
    <bpmn:subProcess id="Sub" name="Withdrawal" triggeredByEvent="true">
      <bpmn:startEvent id="WS" isInterrupting="true"><bpmn:outgoing>W1</bpmn:outgoing><bpmn:messageEventDefinition id="M"/></bpmn:startEvent>
      <bpmn:task id="W" name="Record the withdrawal"><bpmn:incoming>W1</bpmn:incoming><bpmn:outgoing>W2</bpmn:outgoing></bpmn:task>
      <bpmn:endEvent id="WE"><bpmn:incoming>W2</bpmn:incoming></bpmn:endEvent>
      <bpmn:sequenceFlow id="W1" sourceRef="WS" targetRef="W"/>
      <bpmn:sequenceFlow id="W2" sourceRef="W" targetRef="WE"/>
    </bpmn:subProcess>
  </bpmn:process>
</bpmn:definitions>`;

describe("event subprocess", () => {
  test("its steps load as the process's own, in the container's lane", async () => {
    const dir = mkdtempSync(join(tmpdir(), "evsub-"));
    try {
      const f = join(dir, "p.bpmn");
      writeFileSync(f, BPMN);
      const m = await loadProcessModel(f);
      expect(m.nodes.get("W")?.name).toBe("Record the withdrawal");
      expect(m.nodes.get("W")?.lane).toBe("Commenter");
      expect(m.nodes.get("WS")?.kind).toBe("start");
      expect(m.nodes.has("Sub")).toBe(false);
      expect(m.nodes.get("T")?.lane).toBe("Commenter");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
