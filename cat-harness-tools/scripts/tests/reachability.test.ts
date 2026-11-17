/**
 * `node-reachable` and `node-has-exit` — the two structural questions.
 *
 * @module scripts/tests/reachability
 * @graphNode none — a test
 *
 * The case worth reading is §"a pre-start gate". Both criteria read **0** on
 * the corpus the day they were added, so the fixtures below are not
 * belt-and-braces — they are the only thing that ever executes either branch.
 * A green corpus run proves nothing here.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { loadProcessModel, processDiagrams } from "../../src/workflow/process-model.js";
import { reachability } from "../../src/workflow/reachability.js";
import { workflowFile, workflowFiles } from "../known-skills.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

// A real-corpus sweep: about five seconds on a loaded runner, past bun's 5s default.
const CORPUS_TIMEOUT = 60_000;

/** A one-process diagram from the body given. */
async function model(body: string) {
  const dir = mkdtempSync(join(tmpdir(), "reach-"));
  const p = join(dir, "p.bpmn");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_T" name="T" isExecutable="false">${body}</bpmn:process>
</bpmn:definitions>
`,
  );
  return loadProcessModel(p);
}

describe("unreachable — nothing can run it", () => {
  test("a node no flow arrives at is reported", async () => {
    const m = await model(`
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="A"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:task id="Stranded"/>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="A"/>
    <bpmn:sequenceFlow id="F2" sourceRef="A" targetRef="E"/>`);
    const r = reachability(m);
    expect(r.unreachable.map((f) => f.where)).toEqual(["Stranded"]);
    expect(r.preStart).toEqual([]);
  });

  test("a stranded LOOP is reported, and does not recurse forever", async () => {
    // The shape the cycle guard exists for: two nodes pointing at each other,
    // reachable from nothing. Without the guard `reachesAStart` never returns.
    const m = await model(`
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F1</bpmn:incoming></bpmn:endEvent>
    <bpmn:task id="X"><bpmn:incoming>FY</bpmn:incoming><bpmn:outgoing>FX</bpmn:outgoing></bpmn:task>
    <bpmn:task id="Y"><bpmn:incoming>FX</bpmn:incoming><bpmn:outgoing>FY</bpmn:outgoing></bpmn:task>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="E"/>
    <bpmn:sequenceFlow id="FX" sourceRef="X" targetRef="Y"/>
    <bpmn:sequenceFlow id="FY" sourceRef="Y" targetRef="X"/>`);
    expect(reachability(m).unreachable.map((f) => f.where).sort()).toEqual(["X", "Y"]);
  });

  test("everything on the happy path passes", async () => {
    const m = await model(`
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="A"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="A"/>
    <bpmn:sequenceFlow id="F2" sourceRef="A" targetRef="E"/>`);
    const r = reachability(m);
    expect(r.unreachable).toEqual([]);
    expect(r.noExit).toEqual([]);
  });
});

describe("a pre-start gate is NOT unreachable", () => {
  test("a node that flows INTO a start event gates it, and passes", async () => {
    // `feature-staging`'s H_Confirm, in miniature. Its lane: "It precedes
    // Start_Dispatch rather than following it, so the dispatch entry point
    // cannot fire at all until this lane has acted."
    //
    // The one real candidate the first measurement found, and it is correct.
    // Reporting it would make a deliberate modelling decision a permanent
    // finding — the `ug4r` shape.
    const m = await model(`
    <bpmn:task id="Gate"><bpmn:outgoing>FG</bpmn:outgoing></bpmn:task>
    <bpmn:startEvent id="S"><bpmn:incoming>FG</bpmn:incoming><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F1</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="FG" sourceRef="Gate" targetRef="S"/>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="E"/>`);
    const r = reachability(m);
    expect(r.unreachable, "a gate is not stranded").toEqual([]);
    expect(r.preStart.map((f) => f.where)).toEqual(["Gate"]);
  });

  test("a gate TWO steps before the start event still counts", async () => {
    // The walk is transitive, not one hop: a confirmation followed by a
    // preparation, then the entry point, is the same shape.
    const m = await model(`
    <bpmn:task id="Gate"><bpmn:outgoing>FG</bpmn:outgoing></bpmn:task>
    <bpmn:task id="Prep"><bpmn:incoming>FG</bpmn:incoming><bpmn:outgoing>FP</bpmn:outgoing></bpmn:task>
    <bpmn:startEvent id="S"><bpmn:incoming>FP</bpmn:incoming><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F1</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="FG" sourceRef="Gate" targetRef="Prep"/>
    <bpmn:sequenceFlow id="FP" sourceRef="Prep" targetRef="S"/>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="E"/>`);
    const r = reachability(m);
    expect(r.unreachable).toEqual([]);
    expect(r.preStart.map((f) => f.where).sort()).toEqual(["Gate", "Prep"]);
  });
});

describe("no exit — control arrives and stops", () => {
  test("a task with no outgoing flow is reported", async () => {
    const m = await model(`
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="A"><bpmn:incoming>F1</bpmn:incoming></bpmn:task>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="A"/>`);
    expect(reachability(m).noExit.map((f) => f.where)).toEqual(["A"]);
  });

  test("an END event with no outgoing flow is NOT reported — that is what it is", async () => {
    const m = await model(`
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F1</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="E"/>`);
    expect(reachability(m).noExit).toEqual([]);
  });

  test("a node can be BOTH unreachable and without an exit", async () => {
    const m = await model(`
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F1</bpmn:incoming></bpmn:endEvent>
    <bpmn:task id="Island"/>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="E"/>`);
    const r = reachability(m);
    expect(r.unreachable.map((f) => f.where)).toEqual(["Island"]);
    expect(r.noExit.map((f) => f.where)).toEqual(["Island"]);
  });
});

describe("the real corpus", () => {
  test("every diagram is clean, and feature-staging's gate is the reason the rule exists", async () => {
    // Non-vacuous: without the count check this would pass over an empty
    // sweep. Measured 2026-09-23 across the corpus — 0 unreachable, 0 no-exit,
    // and exactly one pre-start gate.
    const diagram = (n: string): string => workflowFile(join(HARNESS_ROOT), n);
    // A layer's global-tasks file holds no process (`processDiagrams`).
    const files = processDiagrams(workflowFiles(join(HARNESS_ROOT))).map((x) => basename(x));
    expect(files.length, "no diagrams found — this assertion would be vacuous").toBeGreaterThan(20);
    let gates = 0;
    for (const f of files) {
      const r = reachability(await loadProcessModel(diagram(f)));
      expect(r.unreachable.map((x) => x.where), `${f} has a stranded node`).toEqual([]);
      expect(r.noExit.map((x) => x.where), `${f} has a node with no exit`).toEqual([]);
      gates += r.preStart.length;
    }
    // Pinned so that removing the pre-start case fails here rather than
    // quietly turning a correct diagram into a permanent finding.
    expect(gates, "feature-staging's H_Confirm").toBeGreaterThan(0);
  }, CORPUS_TIMEOUT);
});
