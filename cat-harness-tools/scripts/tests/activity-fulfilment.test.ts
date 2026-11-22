/**
 * Which actor kinds may perform a step, and how the diagram says so.
 *
 * ## The question this answers, which nothing could answer before
 *
 * *"Tasks can be fulfilled by only certain actor types."* An actor is human,
 * agentic or mechanical (`schemas/kg/skill-package.ts`), and those are not
 * interchangeable: an agent exercises judgement and a mechanical system runs a
 * procedure. So a step that requires a judgement cannot be handed to a build
 * pipeline, and a step that is a fixed program does not need a reader.
 *
 * ## Why almost no diagram has to declare anything
 *
 * **BPMN already says it, per task type, and nothing was reading the answer.**
 * A `userTask` is performed "by a human being with the assistance of a software
 * application"; a `serviceTask` "uses some sort of service … a Web service or
 * an automated application", with no human in the loop. So the constraint is
 * DERIVED for 247 activities in this corpus without a line of new markup, and
 * `<cat-harness.processes:fulfilment/>` exists only for the step where the derived answer is
 * wrong.
 *
 * An abstract `bpmn:Task` and a call activity assert **nothing**, and that is
 * recorded as nothing rather than as "every kind allowed" or "no kind allowed".
 * Both of those would be claims the diagram did not make.
 *
 * ## Why the reason is required at LOAD time
 *
 * `<cat-harness.processes:fulfilment/>` can SILENCE a finding, and the cheapest way to make
 * `activity-fulfilment-kind` pass is to widen `kinds` until it does. Same rule
 * as `<cat-harness.processes:no-skill reason>`: a reasonless exemption does not parse, so the
 * whole diagram records `unknown` instead of quietly passing, and silencing the
 * criterion costs more than satisfying it.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { loadProcessModel } from "../../src/workflow/process-model";

/** A one-activity diagram, with whatever extension elements are under test. */
function diagram(taskType: string, ext: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  id="D" targetNamespace="urn:x">
  <bpmn:process id="Process_F" name="F" isExecutable="false">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:${taskType} id="T" name="Do the thing">
      <bpmn:extensionElements>${ext}</bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:${taskType}>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>
`;
}

async function load(taskType: string, ext: string) {
  const dir = mkdtempSync(join(tmpdir(), "fulfilment-"));
  const path = join(dir, "d.bpmn");
  writeFileSync(path, diagram(taskType, ext));
  try {
    return await loadProcessModel(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("<cat-harness.processes:fulfilment/>", () => {
  test("a declaration with kinds and a reason is read onto the node", async () => {
    const m = await load(
      "task",
      `<cat-harness.processes:fulfilment kinds="person agent" reason="a person or an agent drafts this; a pipeline cannot." />`,
    );
    expect(m.nodes.get("T")!.fulfilment).toEqual({
      kinds: ["person", "agent"],
      reason: "a person or an agent drafts this; a pipeline cannot.",
    });
  });

  test("one kind parses the same way as several", async () => {
    // The attribute is a string either way, so a one-element list must not be
    // a different shape from a two-element one — that asymmetry is where a
    // consumer starts special-casing.
    const m = await load("task", `<cat-harness.processes:fulfilment kinds="system" reason="a fixed program." />`);
    expect(m.nodes.get("T")!.fulfilment!.kinds).toEqual(["system"]);
  });

  test("no declaration leaves the node undefined — the derived answer applies", async () => {
    const m = await load("serviceTask", "");
    expect(m.nodes.get("T")!.fulfilment).toBeUndefined();
  });

  test("a reasonless exemption does not load", async () => {
    // The whole point. If this merely warned, it would be the cheap way to
    // green and nobody would ever read it.
    await expect(load("task", `<cat-harness.processes:fulfilment kinds="person" />`)).rejects.toThrow(/carries no reason/);
    await expect(load("task", `<cat-harness.processes:fulfilment kinds="person" reason="   " />`)).rejects.toThrow(
      /carries no reason/,
    );
  });

  test("an unknown actor kind does not load", async () => {
    // Accepted and ignored, it would silently widen the allowed set to nothing
    // in particular and the criterion would pass over a claim nobody made.
    await expect(load("task", `<cat-harness.processes:fulfilment kinds="robot" reason="why" />`)).rejects.toThrow(
      /unknown actor kind/,
    );
  });

  test("a declaration naming no kinds does not load", async () => {
    await expect(load("task", `<cat-harness.processes:fulfilment reason="why" />`)).rejects.toThrow(/names no kinds/);
  });
});

// `<cat-harness.processes:no-call reason>` (bean `ooq3`) follows the same load-time rule: it
// silences `activity-calls-skill-process`, so it must not arrive reasonless.
describe("<cat-harness.processes:no-call reason>", () => {
  test("a stated reason is carried on the node", async () => {
    const m = await load("task", `<cat-harness.processes:no-call reason="one check out of a larger review." />`);
    expect(m.nodes.get("T")!.noCallReason).toBe("one check out of a larger review.");
  });

  test("a reasonless declaration does not load", async () => {
    await expect(load("task", `<cat-harness.processes:no-call />`)).rejects.toThrow(/no-call\/> carries no reason/);
    await expect(load("task", `<cat-harness.processes:no-call reason="  " />`)).rejects.toThrow(/carries no reason/);
  });
});
