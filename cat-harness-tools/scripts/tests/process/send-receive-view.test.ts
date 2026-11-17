/**
 * Send and receive tasks are steps; a boundary timer is read past only by a
 * VIEW load.
 *
 * Owner, 2026-11-01 (Q-SUBG-2 B), on smart-trust's GDHCN onboarding diagrams:
 * a DAK's business processes send and receive letters and wait on timers.
 * `bpmn:SendTask` and `bpmn:ReceiveTask` walk exactly as a `bpmn:Task`, so the
 * interpreter runs them. A boundary event it does not run: a run load still
 * refuses the file, and a view load (the processes viewer) lists it on
 * `notRun` instead, with the flows that touch it, so the page names it.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadProcessModel } from "../../../src/workflow/process-model";

const bpmn = (withTimer: boolean): string => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
  <bpmn:process id="P" name="P" isExecutable="false">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sendTask id="Send" name="Send the letter"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:sendTask>
    <bpmn:receiveTask id="Recv" name="Receive the reply"><bpmn:incoming>F2</bpmn:incoming><bpmn:outgoing>F3</bpmn:outgoing></bpmn:receiveTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="Send"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Send" targetRef="Recv"/>
    <bpmn:sequenceFlow id="F3" sourceRef="Recv" targetRef="E"/>
    ${
      withTimer
        ? `<bpmn:boundaryEvent id="B" name="7 days passed" attachedToRef="Recv"><bpmn:outgoing>F4</bpmn:outgoing><bpmn:timerEventDefinition id="TD"/></bpmn:boundaryEvent>
    <bpmn:endEvent id="E2"><bpmn:incoming>F4</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F4" sourceRef="B" targetRef="E2"/>`
        : ""
    }
  </bpmn:process>
</bpmn:definitions>`;

async function withFile<T>(xml: string, f: (path: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "sendrecv-"));
  try {
    const p = join(dir, "p.bpmn");
    writeFileSync(p, xml);
    return await f(p);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("send and receive tasks", () => {
  test("load as activities in a run load", async () => {
    const m = await withFile(bpmn(false), (p) => loadProcessModel(p));
    expect(m.nodes.get("Send")?.kind).toBe("activity");
    expect(m.nodes.get("Recv")?.kind).toBe("activity");
    expect(m.notRun).toBeUndefined();
  });
});

describe("a boundary timer", () => {
  test("is still refused by a run load", async () => {
    await expect(withFile(bpmn(true), (p) => loadProcessModel(p))).rejects.toThrow(/bpmn:BoundaryEvent/);
  });

  test("is listed, not refused, by a view load", async () => {
    const m = await withFile(bpmn(true), (p) => loadProcessModel(p, [], new Map(), { view: true }));
    expect(m.notRun).toEqual([{ id: "B", type: "bpmn:BoundaryEvent", name: "7 days passed", attachedTo: "Recv" }]);
    expect(m.flows.has("F4")).toBe(false);
    expect(m.nodes.has("E2")).toBe(true);
    expect(m.nodes.get("Recv")?.outgoing).toEqual(["F3"]);
  });
});
