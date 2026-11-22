/**
 * The pre-execution gate has a consumer, and this test goes red when it stops.
 *
 * @module scripts/tests/precondition-consumer.test
 *
 * ## What this is for
 *
 * `<bootstrap.processes:precondition>` (bean `lv3j`) was parsed, three-valued and tested
 * from the day it landed, and had **zero non-test callers** until #853
 * requirement 3. `precondition.test.ts` covers the evaluator; nothing covered
 * whether anything ASKED it. That is `a58y`'s defect exactly — a declaration
 * that reads as a control and enforces nothing — and a second evaluator test
 * would not have caught it, because the evaluator was never the broken part.
 *
 * So this test drives the **registered `workflow_start` handler**, through the
 * same `server.tool` call the real server makes. Delete the `preflight` call
 * from `cat-harness/src/tools/workflow.ts` and the refusal case below fails.
 * That is the property the Done-when asked for, and it is why this could not
 * be written against `preflight()` directly: a unit test of the gate stays
 * green in exactly the world the gate is not consulted.
 *
 * ## Falsified before it was trusted
 *
 * | break | result |
 * |---|---|
 * | `preflight` call removed from `workflow_start` | refusal test **fails** |
 * | `preflightRefusal` returns `undefined` always | refusal test **fails** |
 * | `could-not-determine` folded into `unsatisfied` | `starts anyway` test **fails** |
 * | restored | all pass |
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { registerWorkflowTools } from "../../src/tools/workflow.ts";
import {
  describePreflight,
  preflight,
  preflightRefusal,
} from "../../src/workflow/preflight.ts";

const ROOT = mkdtempSync(join(tmpdir(), "preflight-"));

/**
 * A process with one `checkable` precondition and one `stated` one.
 *
 * Both kinds on purpose: the `stated` one is what proves the gate does not
 * block on an unobservable claim, and a fixture carrying only the checkable
 * one would pass whether or not that distinction survived.
 */
function writeProcess(dir: string, requiredFile: string): void {
  mkdirSync(dir, { recursive: true });
  // The layer that owns the diagram. A `file-exists` ref resolves against
  // it, so without one the diagram is refused at parse — and a refusal test
  // would then pass on the parse error rather than on the gate.
  writeFileSync(join(dir, "..", "fixture.json"), JSON.stringify({ name: "fixture" }));
  writeFileSync(
    join(dir, "gated.bpmn"),
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  id="Defs_Gated" targetNamespace="urn:test">
  <bpmn:process id="Process_Gated" name="Gated">
    <bpmn:extensionElements>
      <bootstrap.processes:precondition id="needs-the-file" kind="checkable" check="file-exists" ref="${requiredFile}"
        text="The file this process needs is present in this checkout."/>
      <bootstrap.processes:precondition id="knows-what-it-is-doing" kind="stated"
        text="The actor understands the task it is about to begin."/>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Start_G" name="Start">
      <bpmn:outgoing>F1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_G" name="Do the thing">
      <bpmn:incoming>F1</bpmn:incoming>
      <bpmn:outgoing>F2</bpmn:outgoing>
      <bpmn:extensionElements>
        <cat-harness.processes:no-skill reason="fixture"/>
      </bpmn:extensionElements>
    </bpmn:task>
    <bpmn:endEvent id="End_G" name="Done">
      <bpmn:incoming>F2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="Start_G" targetRef="Task_G"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task_G" targetRef="End_G"/>
  </bpmn:process>
</bpmn:definitions>
`,
  );
}

/**
 * The registered handlers, captured from a stub server.
 *
 * `registerWorkflowTools` takes an `McpServer` only to call `.tool()` on it,
 * so the stub is the whole interface it uses. Going through the real
 * registration rather than importing a handler is the point: it is the wiring
 * that was untested.
 */
type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;

function handlers(root: string): Map<string, Handler> {
  const captured = new Map<string, Handler>();
  const stub = {
    tool(name: string, _d: string, _s: unknown, fn: Handler) {
      captured.set(name, fn);
    },
  };
  registerWorkflowTools(stub as never, root);
  return captured;
}

const startFor = (root: string) => {
  const h = handlers(root).get("workflow_start");
  if (!h) throw new Error("workflow_start was not registered");
  return h;
};

beforeAll(() => {
  mkdirSync(join(ROOT, "processes"), { recursive: true });
});
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("workflow_start consults the preconditions", () => {
  test("an UNSATISFIED precondition refuses the start, and names it", async () => {
    const root = mkdtempSync(join(tmpdir(), "preflight-block-"));
    writeProcess(join(root, "processes"), "definitely-absent.txt");

    // The assertion that fails the moment `workflow_start` stops asking.
    //
    // Matching the REFUSAL's own wording, not just the id: a malformed fixture
    // throws a parse error that also quotes the id, and an earlier draft of
    // this test passed on exactly that — green because the diagram would not
    // load, which is the opposite of the property being asserted.
    await expect(
      startFor(root)({ process: "gated", subject: "s1" }),
    ).rejects.toThrow(/Refusing to start[\s\S]*needs-the-file/);

    rmSync(root, { recursive: true, force: true });
  });

  test("a COULD-NOT-DETERMINE precondition starts anyway, and is named in the output", async () => {
    const root = mkdtempSync(join(tmpdir(), "preflight-pass-"));
    writeProcess(join(root, "processes"), "present.txt");
    writeFileSync(join(root, "present.txt"), "here");

    const out = await startFor(root)({ process: "gated", subject: "s2" });
    const body = out.content.map((c) => c.text).join("\n");

    expect(body).toContain("Started.");
    // Reported, not silently passed over: the unobservable claim is the
    // caller's to carry, and it cannot carry what it was not told.
    expect(body).toContain("knows-what-it-is-doing");
    expect(body).toContain("could not be determined");

    rmSync(root, { recursive: true, force: true });
  });
});

describe("the gate's own three states", () => {
  const model = (preconditions: unknown[]) => ({ preconditions }) as never;

  test("only `unsatisfied` produces a refusal", () => {
    const stated = { id: "a", text: "unobservable", kind: "stated" as const };
    const report = preflight(model([stated]));

    expect(report.undetermined).toHaveLength(1);
    expect(report.unsatisfied).toHaveLength(0);
    // The whole argument of the module: three of four real preconditions are
    // `stated`, so refusing on could-not-determine is an outage, not a gate.
    expect(preflightRefusal(report)).toBeUndefined();
  });

  test("a process declaring none says so rather than saying nothing", () => {
    const report = preflight(model([]));
    expect(describePreflight(report)).toBe("Preconditions: none declared by this process.");
    expect(preflightRefusal(report)).toBeUndefined();
  });

  test("the description never renders an undetermined claim as clean", () => {
    const report = preflight(
      model([{ id: "unobservable-one", text: "cannot tell", kind: "stated" as const }]),
    );
    const d = describePreflight(report);
    expect(d).toContain("1 could not be determined");
    expect(d).toContain("unobservable-one");
    expect(d).not.toContain("1 satisfied,\n");
  });
});
