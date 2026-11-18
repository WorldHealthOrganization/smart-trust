/**
 * Stores are drawn as data stores, not lanes (owner, 2026-11-01, Q-BR-3 A and
 * Q-DS-3 A).
 *
 * @module scripts/tests/process/data-stores
 * @graphNode none — a test
 *
 * The interpreter used to refuse any `dataStoreReference`, so no diagram could
 * draw the work plan as a store. These cases hold what it does now: a store
 * and a data object load without becoming steps, a step's reads and writes
 * name the store by its Role id whether or not the file declares it, and a
 * reference or association that names nothing is still refused.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { UnsupportedBpmn, isGlobalTasksFile, loadProcessModel } from "../../../src/workflow/process-model.js";

const HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/"
                  targetNamespace="urn:t">`;

function fixture(body: string, declared = ""): string {
  const dir = mkdtempSync(join(tmpdir(), "data-stores-"));
  const p = join(dir, "p.bpmn");
  writeFileSync(
    p,
    `${HEAD}
  ${declared}
  <bpmn:process id="Process_T" name="T" isExecutable="false">
    <bpmn:laneSet id="LaneSet_T">
      <bpmn:lane id="Lane_T" name="Agent">
        <bpmn:extensionElements><bootstrap.processes:role ref="authoring-agent"/></bpmn:extensionElements>
        <bpmn:flowNodeRef>Start_T</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>A_Open</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>A_Read</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_T</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_T" name="Start"/>
    ${body}
    <bpmn:endEvent id="End_T" name="Done"/>
    <bpmn:sequenceFlow id="F1" sourceRef="Start_T" targetRef="A_Open"/>
    <bpmn:sequenceFlow id="F2" sourceRef="A_Open" targetRef="A_Read"/>
    <bpmn:sequenceFlow id="F3" sourceRef="A_Read" targetRef="End_T"/>
  </bpmn:process>
</bpmn:definitions>
`,
  );
  return p;
}

const STEPS = `
    <bpmn:dataStoreReference id="DSR_Plan" name="Work plan (beans)" dataStoreRef="work-plan"/>
    <bpmn:dataObjectReference id="DOR_Draft" name="Draft" dataObjectRef="DO_Draft"/>
    <bpmn:dataObject id="DO_Draft"/>
    <bpmn:task id="A_Open" name="Open the bean">
      <bpmn:dataOutputAssociation id="W1"><bpmn:targetRef>DSR_Plan</bpmn:targetRef></bpmn:dataOutputAssociation>
    </bpmn:task>
    <bpmn:task id="A_Read" name="Read the plan">
      <bpmn:property id="P_Read" name="__targetRef_placeholder"/>
      <bpmn:dataInputAssociation id="R1"><bpmn:sourceRef>DSR_Plan</bpmn:sourceRef><bpmn:targetRef>P_Read</bpmn:targetRef></bpmn:dataInputAssociation>
      <bpmn:dataOutputAssociation id="W2"><bpmn:targetRef>DOR_Draft</bpmn:targetRef></bpmn:dataOutputAssociation>
    </bpmn:task>`;

describe("a store is drawn, not walked", () => {
  test("a store declared elsewhere loads, and is not a step", async () => {
    const m = await loadProcessModel(fixture(STEPS));
    expect([...m.nodes.keys()].sort()).toEqual(["A_Open", "A_Read", "End_T", "Start_T"]);
    expect(m.dataStores).toEqual([
      { id: "DSR_Plan", type: "bpmn:DataStoreReference", name: "Work plan (beans)", store: "work-plan", storeDeclared: false },
      { id: "DOR_Draft", type: "bpmn:DataObjectReference", name: "Draft" },
    ]);
  });

  test("a store declared in the file resolves the same way", async () => {
    const m = await loadProcessModel(fixture(STEPS, `<bpmn:dataStore id="work-plan" name="Work plan (beans)"/>`));
    expect(m.dataStores[0]).toMatchObject({ store: "work-plan", storeDeclared: true });
  });

  test("each step names what it reads and writes, a store by its Role id", async () => {
    const m = await loadProcessModel(fixture(STEPS));
    expect(m.nodes.get("A_Open")).toMatchObject({ reads: [], writes: ["work-plan"] });
    expect(m.nodes.get("A_Read")).toMatchObject({ reads: ["work-plan"], writes: ["DOR_Draft"] });
    expect(m.nodes.get("Start_T")).toMatchObject({ reads: [], writes: [] });
  });
});

describe("what is still refused", () => {
  test("a store reference that names no store", async () => {
    const p = fixture(STEPS.replace(' dataStoreRef="work-plan"', ""));
    await expect(loadProcessModel(p)).rejects.toThrow(UnsupportedBpmn);
    await expect(loadProcessModel(p)).rejects.toThrow(/name no store/);
  });

  test("a write to something that is not a drawn store or data object", async () => {
    const p = fixture(STEPS.replace("<bpmn:targetRef>DSR_Plan</bpmn:targetRef>", "<bpmn:targetRef>A_Read</bpmn:targetRef>"));
    await expect(loadProcessModel(p)).rejects.toThrow(/not a data store or data object/);
  });
});

describe("a file of shared stores is passed by like a global-tasks file", () => {
  test("no process and a bpmn:dataStore", () => {
    expect(isGlobalTasksFile(`${HEAD}<bpmn:dataStore id="work-plan" name="Work plan (beans)"/></bpmn:definitions>`)).toBe(true);
  });
  test("a process file with a store is still a process", () => {
    expect(isGlobalTasksFile(`${HEAD}<bpmn:dataStore id="work-plan"/><bpmn:process id="P"/></bpmn:definitions>`)).toBe(false);
  });
});
