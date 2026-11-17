/**
 * An unknown attribute on `<cat-harness.processes:bean>` is refused, not ignored.
 *
 * @module scripts/tests/bean-attr-refused.test
 *
 * ## The defect, and why nothing could have caught it
 *
 * `readWorkPlanOp` already refused an unknown op VALUE. It silently ignored an
 * unknown ATTRIBUTE, and the two are different checks.
 *
 * `sdlc/processes/bean-lifecycle.bpmn` records the cost in its own comment: a
 * diagram carried `<cat-harness.processes:bean action="create"/>`, the engine reads `op`, and
 * "the step silently did nothing for weeks".
 *
 * What made it invisible is that an absent `op` is **documented as
 * meaningful** — `ProcessNode.workPlanOp` says it means the step "touches the
 * plan in some way the tools do not perform automatically". So a typo and a
 * deliberate abstention produced the identical parse, and abstention is the
 * reading a reader reaches for. Bean `m8gz`.
 *
 * ## What this must NOT break
 *
 * A bare `<cat-harness.processes:bean/>` is legal and means abstention. A guard that refused
 * it would remove the documented reading instead of the ambiguity, which is
 * why that case is asserted here rather than left implied.
 *
 * ## Falsified before it was trusted
 *
 * | break | result |
 * |---|---|
 * | the attribute guard removed | the `action="create"` test **fails** |
 * | the guard also refusing a bare `<cat-harness.processes:bean/>` | the abstention test **fails** |
 * | restored | all pass |
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadProcessModel, processDiagrams } from "../../src/workflow/process-model.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** A one-task diagram whose task carries exactly the given `folio:bean` markup. */
function diagram(beanMarkup: string): string {
  const root = mkdtempSync(join(tmpdir(), "bean-attr-"));
  made.push(root);
  mkdirSync(root, { recursive: true });
  const file = join(root, "d.bpmn");
  writeFileSync(
    file,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  id="Defs_B" targetNamespace="urn:test">
  <bpmn:process id="Process_B" name="Bean attr">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="Task_B" name="Touches the plan">
      <bpmn:incoming>F1</bpmn:incoming>
      <bpmn:outgoing>F2</bpmn:outgoing>
      <bpmn:extensionElements>
        <cat-harness.processes:no-skill reason="fixture"/>
        ${beanMarkup}
      </bpmn:extensionElements>
    </bpmn:task>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="Task_B"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task_B" targetRef="E"/>
  </bpmn:process>
</bpmn:definitions>
`,
  );
  return file;
}

describe("an unknown attribute is refused", () => {
  test("`action=\"create\"` — the exact attribute that did nothing for weeks", async () => {
    await expect(loadProcessModel(diagram('<cat-harness.processes:bean action="create"/>'))).rejects.toThrow(
      /cat-harness\.processes:bean carries "action"/,
    );
  });

  test("the message says what to write instead, both ways", async () => {
    // A refusal that does not name the alternative sends the author guessing,
    // and one of the two legal answers here is to write NOTHING — which is the
    // answer nobody guesses.
    await expect(loadProcessModel(diagram('<cat-harness.processes:bean actoin="claim"/>'))).rejects.toThrow(
      /drop the attribute entirely if abstention is what you meant/,
    );
  });

  test("it is refused even alongside a VALID op", async () => {
    // The dangerous case: the step works, so nothing looks wrong, and the
    // stray attribute survives to be copied into the next diagram.
    await expect(
      loadProcessModel(diagram('<cat-harness.processes:bean op="claim" action="create"/>')),
    ).rejects.toThrow(/cat-harness\.processes:bean carries "action"/);
  });
});

describe("what the guard must not break", () => {
  test("a bare `<cat-harness.processes:bean/>` still loads, and still means abstention", async () => {
    // Legal and documented: "touches the plan in some way the tools do not
    // perform automatically". Refusing it would remove the reading rather than
    // the ambiguity.
    const m = await loadProcessModel(diagram("<cat-harness.processes:bean/>"));
    const node = m.nodes.get("Task_B")!;
    expect(node.touchesWorkPlan).toBe(true);
    expect(node.workPlanOp).toBeUndefined();
  });

  test("a valid op still loads", async () => {
    const m = await loadProcessModel(diagram('<cat-harness.processes:bean op="claim"/>'));
    expect(m.nodes.get("Task_B")!.workPlanOp).toBe("claim");
  });

  test("an unknown op VALUE is still refused by its own check", async () => {
    // The pre-existing check, asserted here so a future edit cannot collapse
    // the two into one and lose the more specific message.
    await expect(loadProcessModel(diagram('<cat-harness.processes:bean op="reopen"/>'))).rejects.toThrow(
      /op="reopen" is not implemented/,
    );
  });
});

describe("the real corpus", () => {
  test("every diagram in this repository still loads", async () => {
    const { workflowFiles } = await import("../known-skills.ts");
    // A layer's shared global-tasks file holds no process and is read through
    // the call activities that call it, so it is not loaded as one.
    const files = processDiagrams(workflowFiles(join(HARNESS_ROOT)));
    // Vacuity guard: an empty corpus would pass this trivially.
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      await loadProcessModel(f);
    }
  });
});
