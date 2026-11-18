/**
 * The readability criteria in `src/workflow/diagram-quality.ts`.
 *
 * @module scripts/tests/diagram-quality
 * @graphNode none — a test
 *
 * Several criteria read 0 or near 0 on the corpus, so these fixtures are what
 * executes each branch; a green corpus run proves little here.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadProcessModel } from "../../src/workflow/process-model.js";
import { diagramQuality, readLayout } from "../../src/workflow/diagram-quality.js";

/** A one-process diagram from the body given, with optional DI shapes and edges. */
async function check(body: string, di = "") {
  const dir = mkdtempSync(join(tmpdir(), "dq-"));
  const p = join(dir, "p.bpmn");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_T" name="T" isExecutable="false">${body}</bpmn:process>
  <bpmndi:BPMNDiagram id="D"><bpmndi:BPMNPlane id="P" bpmnElement="Process_T">${di}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>
`,
  );
  const m = await loadProcessModel(p);
  return diagramQuality(m, readLayout(readFileSync(p, "utf-8")));
}

const shape = (id: string, x: number, y: number, w = 100, h = 80) =>
  `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"><dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}"/></bpmndi:BPMNShape>`;
const edge = (id: string, ...pts: [number, number][]) =>
  `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">${pts.map(([x, y]) => `<di:waypoint x="${x}" y="${y}"/>`).join("")}</bpmndi:BPMNEdge>`;

describe("structure", () => {
  test("a task with two ways out and no gateway is an implicit split", async () => {
    const q = await check(`
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="A" name="Review the draft"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing><bpmn:outgoing>F3</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="E1" name="Accepted"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="E2" name="Rejected"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="A"/>
    <bpmn:sequenceFlow id="F2" sourceRef="A" targetRef="E1"/>
    <bpmn:sequenceFlow id="F3" sourceRef="A" targetRef="E2"/>`);
    expect(q["activity-implicit-split"]!.map((f) => f.where)).toEqual(["A"]);
    // Two named end events are allowed: only start events are counted.
    expect(q["process-single-start"]).toEqual([]);
  });

  test("a loop-back INTO a task is not reported; a gateway that joins and splits is", async () => {
    const q = await check(`
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="A" name="Draft the block"><bpmn:incoming>F1</bpmn:incoming><bpmn:incoming>F4</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:task>
    <bpmn:exclusiveGateway id="G" name="Approved"><bpmn:incoming>F2</bpmn:incoming><bpmn:incoming>F5</bpmn:incoming><bpmn:outgoing>F3</bpmn:outgoing><bpmn:outgoing>F4</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:startEvent id="S2"><bpmn:outgoing>F5</bpmn:outgoing></bpmn:startEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="A"/>
    <bpmn:sequenceFlow id="F2" sourceRef="A" targetRef="G"/>
    <bpmn:sequenceFlow id="F3" name="yes" sourceRef="G" targetRef="E"/>
    <bpmn:sequenceFlow id="F4" name="no" sourceRef="G" targetRef="A"/>
    <bpmn:sequenceFlow id="F5" sourceRef="S2" targetRef="G"/>`);
    expect(q["activity-implicit-split"]).toEqual([]);
    expect(q["gateway-mixed"]!.map((f) => f.where)).toEqual(["G"]);
    expect(q["decision-label-question"]!.map((f) => f.where)).toEqual(["G"]);
    expect(q["process-single-start"]!.map((f) => f.where)).toEqual(["Process_T"]);
  });

  test("labels: a nominalised first word is reported, a verb ending like a noun is not", async () => {
    const q = await check(`
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="A" name="Signature verification"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:task>
    <bpmn:task id="B" name="Document the decision"><bpmn:incoming>F2</bpmn:incoming><bpmn:outgoing>F3</bpmn:outgoing></bpmn:task>
    <bpmn:task id="C" name="Reviewing"><bpmn:incoming>F3</bpmn:incoming><bpmn:outgoing>F4</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="E"><bpmn:incoming>F4</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="A"/>
    <bpmn:sequenceFlow id="F2" sourceRef="A" targetRef="B"/>
    <bpmn:sequenceFlow id="F3" sourceRef="B" targetRef="C"/>
    <bpmn:sequenceFlow id="F4" sourceRef="C" targetRef="E"/>`);
    // "Signature" is not caught (no noun ending): a heuristic, and it says so.
    expect(q["activity-label-verb-first"]!.map((f) => f.where)).toEqual(["C"]);
  });

  test("size: past 20 nodes is reported, past 50 is the 7PMG threshold", async () => {
    const n = 22;
    let body = `<bpmn:startEvent id="S"><bpmn:outgoing>F0</bpmn:outgoing></bpmn:startEvent>`;
    for (let i = 0; i < n; i++) {
      body += `<bpmn:task id="T${i}" name="Run step ${i}"><bpmn:incoming>F${i}</bpmn:incoming><bpmn:outgoing>F${i + 1}</bpmn:outgoing></bpmn:task>`;
      body += `<bpmn:sequenceFlow id="F${i}" sourceRef="${i === 0 ? "S" : `T${i - 1}`}" targetRef="T${i}"/>`;
    }
    body += `<bpmn:endEvent id="E"><bpmn:incoming>F${n}</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="F${n}" sourceRef="T${n - 1}" targetRef="E"/>`;
    const q = await check(body);
    expect(q["process-size"]!.length).toBe(1);
    expect(q["process-decompose"]).toEqual([]);
  });
});

describe("drawing — the geometry shared with archimate-crossings", () => {
  const body = `
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="A" name="Draft the block"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:task>
    <bpmn:task id="B" name="Review the block"><bpmn:incoming>F2</bpmn:incoming><bpmn:outgoing>F3</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="E"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="A"/>
    <bpmn:sequenceFlow id="F2" sourceRef="A" targetRef="B"/>
    <bpmn:sequenceFlow id="F3" sourceRef="B" targetRef="E"/>`;

  test("a clean row reads 0 on all three", async () => {
    const q = await check(
      body,
      shape("S", 0, 22, 36, 36) + shape("A", 100, 0) + shape("B", 300, 0) + shape("E", 500, 22, 36, 36) +
        edge("F1", [36, 40], [100, 40]) + edge("F2", [200, 40], [300, 40]) + edge("F3", [400, 40], [500, 40]),
    );
    expect([q["edge-rectilinear"], q["edge-crossing"], q["edge-through-node"]]).toEqual([[], [], []]);
  });

  test("a diagonal, a crossing, and a line over a task are each reported", async () => {
    const q = await check(
      body,
      shape("S", 0, 22, 36, 36) + shape("A", 100, 0) + shape("B", 300, 0) + shape("E", 500, 22, 36, 36) +
        // F1 runs straight through B to reach A from the far side.
        edge("F1", [36, 40], [36, 120], [450, 120], [450, 40], [200, 40]) +
        // F2 is diagonal and crosses F1's lower leg.
        edge("F2", [150, 80], [350, 160]) +
        edge("F3", [400, 40], [500, 40]),
    );
    expect(q["edge-rectilinear"]!.map((f) => f.where)).toEqual(["F2"]);
    expect(q["edge-crossing"]!.map((f) => f.where)).toEqual(["F1×F2"]);
    expect(q["edge-through-node"]!.map((f) => f.where)).toEqual(["F1"]);
  });
});
