import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  DecisionError,
  unaryTest,
  UnsupportedDmn,
} from "../../src/workflow/decision-table";
import { loadProcessModel, UnsupportedBpmn } from "../../src/workflow/process-model";

/**
 * Four of the ten exclusive gateways across the BPMN diagrams are not judgement
 * calls at all — they are arithmetic over tool output. Two of those have tools
 * that exist today, and now have DMN tables: the agent reports numbers and the
 * table returns the branch.
 *
 * These tests are about the difference between computing and choosing. The
 * sharp one is that a computed gateway *refuses* a hand-supplied outcome: being
 * able to assert the answer would defeat the whole mechanism.
 *
 * The tests over SHIPPED tables and processes live with their owners (bean
 * `ho66`): `draft-qa-gate.dmn` in folio-assistant-core, `lean-build-gate.dmn`
 * and `authoring-a-paper.bpmn` in folio-assistant-sci, each in that
 * layer's `scripts/tests/decision-table.test.ts`. Standing alone,
 * cat-harness has none of them to read.
 */


describe("the FEEL subset", () => {
  test("reads the tests the tables actually use", () => {
    expect(unaryTest("-", 42)).toBe(true);
    expect(unaryTest("", "anything")).toBe(true);
    expect(unaryTest("0", 0)).toBe(true);
    expect(unaryTest("0", 1)).toBe(false);
    expect(unaryTest("> 0", 3)).toBe(true);
    expect(unaryTest("> 0", 0)).toBe(false);
    expect(unaryTest(">= 3", 3)).toBe(true);
    expect(unaryTest("< 10", 9)).toBe(true);
    expect(unaryTest("<= 2", 3)).toBe(false);
    expect(unaryTest("false", false)).toBe(true);
    expect(unaryTest("false", true)).toBe(false);
    expect(unaryTest('"green"', "green")).toBe(true);
    expect(unaryTest("1, 2, 3", 2)).toBe(true);
    expect(unaryTest("1, 2, 3", 4)).toBe(false);
    expect(unaryTest('"a", "b"', "b")).toBe(true);
  });

  test("a test it cannot read throws rather than quietly not matching", () => {
    // The failure mode this guards: an unimplemented expression evaluating to
    // `false` looks exactly like a rule that legitimately did not apply, and
    // the table then answers on the rules that are left.
    expect(() => unaryTest("[1..5]", 3)).toThrow(UnsupportedDmn);
    expect(() => unaryTest("date(x)", 3)).toThrow(UnsupportedDmn);
  });

  test("`not(...)` negates a unary-test list, because a shipped table uses it", () => {
    // `not(0)` was in the list above until 2026-10-04, and the throw was not
    // theoretical: `merge-priority.dmn` has used `not("green")` since it was
    // drawn, so the merge queue's priority table could not be evaluated by ANY
    // caller. The throw is what made that findable — an evaluator returning
    // false for what it cannot read would have handed the table a plausible
    // wrong answer instead. So the fix is to implement the construct, not to
    // soften the throw.
    expect(unaryTest('not("green")', "red")).toBe(true);
    expect(unaryTest('not("green")', "green")).toBe(false);
    expect(unaryTest("not(0)", 3)).toBe(true);
    expect(unaryTest("not(0)", 0)).toBe(false);

    // A list inside it, and the negation is of the WHOLE list.
    expect(unaryTest('not("red","green")', "amber")).toBe(true);
    expect(unaryTest('not("red","green")', "green")).toBe(false);

    // A comparison inside it.
    expect(unaryTest("not(> 5)", 3)).toBe(true);
    expect(unaryTest("not(> 5)", 9)).toBe(false);

    // Spacing is FEEL's, not ours.
    expect(unaryTest('not ("green")', "red")).toBe(true);

    // Still refused: an empty negation says nothing, so it is an error rather
    // than a vacuous true.
    expect(() => unaryTest("not()", 3)).toThrow(DecisionError);

    // And what is inside it is still held to the same subset.
    expect(() => unaryTest("not([1..5])", 3)).toThrow(UnsupportedDmn);
  });

  test("comparing a number test against a non-number is an error, not false", () => {
    expect(() => unaryTest("> 0", "lots")).toThrow(DecisionError);
  });
});

describe("a table must be able to route the gateway it backs", () => {
  test("an outcome with no matching branch fails at load, not at decision time", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dmn-route-"));
    writeFileSync(
      join(dir, "bad.dmn"),
      `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="D" name="D" namespace="urn:x">
  <decision id="Decision_Bad" name="Bad">
    <decisionTable id="T" hitPolicy="FIRST">
      <input id="i"><inputExpression id="e" typeRef="number"><text>n</text></inputExpression></input>
      <output id="o" name="outcome" typeRef="string" />
      <rule id="r1"><inputEntry id="ie1"><text>-</text></inputEntry><outputEntry id="oe1"><text>"passed"</text></outputEntry></rule>
    </decisionTable>
  </decision>
</definitions>
`,
    );
    writeFileSync(
      join(dir, "bad.bpmn"),
      `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  id="D" targetNamespace="urn:x">
  <bpmn:process id="Process_Bad" name="Bad" isExecutable="false">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:exclusiveGateway id="G" name="Gate?">
      <bpmn:extensionElements><cat-harness.processes:decision ref="bad.dmn#Decision_Bad" /></bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing><bpmn:outgoing>F3</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="E1"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="E2"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="G" />
    <bpmn:sequenceFlow id="F2" name="yes" sourceRef="G" targetRef="E1" />
    <bpmn:sequenceFlow id="F3" name="no" sourceRef="G" targetRef="E2" />
  </bpmn:process>
</bpmn:definitions>
`,
    );
    // "passed" is not `yes` or `no`. Discovering that when a decision is needed
    // would be the worst possible time.
    await expect(loadProcessModel(join(dir, "bad.bpmn"))).rejects.toThrow(UnsupportedBpmn);
    await expect(loadProcessModel(join(dir, "bad.bpmn"))).rejects.toThrow(/passed/);
    rmSync(dir, { recursive: true, force: true });
  });
});

