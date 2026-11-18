/**
 * Decisions and their branches — the parsing behind `gateway-documented` and
 * `gateway-branches-named`.
 *
 * @module scripts/tests/gateway-documentation
 * @graphNode none — a test
 *
 * Bean `6hq4`, issue #1044. Both criteria read 0-or-more findings off
 * `isDecision` and `indistinctBranches`, so the load-bearing cases are the
 * boundaries: a merge and a parallel fork are NOT decisions (asking them for
 * documentation would open a backlog of symbols that already say everything),
 * and a repeated label counts as indistinct even though every branch has one —
 * `gateway-branches-named` read 0 on the day it was added, so a test that only
 * showed the corpus passing could not tell a working check from an absent one.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  branchesOf,
  indistinctBranches,
  isDecision,
  loadProcessModel,
} from "../../../src/workflow/process-model.js";

/** Start → decision G (three ways out, labels given) → merge M → fork P → end. */
function fixture(labels: [string, string, string], doc = ""): string {
  const dir = mkdtempSync(join(tmpdir(), "gateway-doc-"));
  const p = join(dir, "p.bpmn");
  const name = (l: string): string => (l ? ` name="${l}"` : "");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="urn:t">
  <bpmn:process id="Process_G" name="G" isExecutable="false">
    <bpmn:startEvent id="S" name="Start"/>
    <bpmn:exclusiveGateway id="G" name="Which?">${doc ? `<bpmn:documentation>${doc}</bpmn:documentation>` : ""}</bpmn:exclusiveGateway>
    <bpmn:task id="A" name="A"/>
    <bpmn:task id="B" name="B"/>
    <bpmn:task id="C" name="C"/>
    <bpmn:exclusiveGateway id="M"/>
    <bpmn:parallelGateway id="P"/>
    <bpmn:endEvent id="E1" name="Done one"/>
    <bpmn:endEvent id="E2" name="Done two"/>
    <bpmn:sequenceFlow id="f0" sourceRef="S" targetRef="G"/>
    <bpmn:sequenceFlow id="fa" sourceRef="G" targetRef="A"${name(labels[0])}/>
    <bpmn:sequenceFlow id="fb" sourceRef="G" targetRef="B"${name(labels[1])}/>
    <bpmn:sequenceFlow id="fc" sourceRef="G" targetRef="C"${name(labels[2])}/>
    <bpmn:sequenceFlow id="ma" sourceRef="A" targetRef="M"/>
    <bpmn:sequenceFlow id="mb" sourceRef="B" targetRef="M"/>
    <bpmn:sequenceFlow id="mc" sourceRef="C" targetRef="M"/>
    <bpmn:sequenceFlow id="mp" sourceRef="M" targetRef="P"/>
    <bpmn:sequenceFlow id="p1" sourceRef="P" targetRef="E1"/>
    <bpmn:sequenceFlow id="p2" sourceRef="P" targetRef="E2"/>
  </bpmn:process>
</bpmn:definitions>`,
  );
  return p;
}

describe("isDecision", () => {
  test("a diverging exclusive gateway is a decision; a merge and a parallel fork are not", async () => {
    const m = await loadProcessModel(fixture(["yes", "no", "maybe"]));
    expect(isDecision(m.nodes.get("G")!)).toBe(true);
    expect(isDecision(m.nodes.get("M")!)).toBe(false);
    expect(isDecision(m.nodes.get("P")!)).toBe(false);
    expect(isDecision(m.nodes.get("A")!)).toBe(false);
  });

  test("the decision's documentation is read", async () => {
    const m = await loadProcessModel(fixture(["yes", "no", "maybe"], "Asked of the reviewer."));
    expect(m.nodes.get("G")!.documentation).toBe("Asked of the reviewer.");
  });
});

describe("indistinctBranches", () => {
  test("distinct labels: nothing to report", async () => {
    const m = await loadProcessModel(fixture(["yes", "no", "maybe"]));
    expect(indistinctBranches(m, m.nodes.get("G")!)).toEqual([]);
    expect(branchesOf(m, m.nodes.get("G")!).map((b) => [b.label, b.to])).toEqual([
      ["yes", "A"],
      ["no", "B"],
      ["maybe", "C"],
    ]);
  });

  test("an unnamed branch is reported", async () => {
    const m = await loadProcessModel(fixture(["yes", "", "maybe"]));
    const out = indistinctBranches(m, m.nodes.get("G")!);
    expect(out.map((b) => [b.flowId, b.problem])).toEqual([["fb", "unnamed"]]);
  });

  test("a repeated label is reported on BOTH branches, ignoring case and spacing", async () => {
    const m = await loadProcessModel(fixture(["Yes", "no", " yes "]));
    const out = indistinctBranches(m, m.nodes.get("G")!);
    expect(out.map((b) => [b.flowId, b.problem])).toEqual([
      ["fa", "duplicate"],
      ["fc", "duplicate"],
    ]);
  });

  test("a parallel fork's unnamed branches are not a finding — nothing is chosen there", async () => {
    const m = await loadProcessModel(fixture(["yes", "no", "maybe"]));
    expect(indistinctBranches(m, m.nodes.get("P")!)).toEqual([]);
  });
});
