/**
 * Non-interrupting boundary events: an OPTIONAL side path that starts while
 * its activity holds a token and never takes that token away (smart-base's
 * `act-on-decision-support.bpmn`: a health worker MAY note why, and the care
 * plan never waits). Interrupting ones are still refused at load.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadProcessModel, UnsupportedBpmn } from "../../../src/workflow/process-model";
import { complete, enabled, startInstance } from "../../../src/workflow/instance.js";
import { reachability } from "../../../src/workflow/reachability.js";
import { checklistFor } from "../../bpmn-checklist.ts";

function diagram(boundary: string, extraFlows = ""): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="t">
  <bpmn:process id="Process_B" name="B" isExecutable="false">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Review" name="Review"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    ${boundary}
    <bpmn:userTask id="Note" name="Note why"><bpmn:incoming>F3</bpmn:incoming><bpmn:outgoing>F4</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="Done"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="Noted"><bpmn:incoming>F4</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="Review" />
    <bpmn:sequenceFlow id="F2" sourceRef="Review" targetRef="Done" />
    <bpmn:sequenceFlow id="F3" sourceRef="OptIn" targetRef="Note" />
    <bpmn:sequenceFlow id="F4" sourceRef="Note" targetRef="Noted" />
    ${extraFlows}
  </bpmn:process>
</bpmn:definitions>
`;
}

const NON_INTERRUPTING = `<bpmn:boundaryEvent id="OptIn" name="Taps add a reason" attachedToRef="Review" cancelActivity="false">
      <bpmn:outgoing>F3</bpmn:outgoing>
      <bpmn:conditionalEventDefinition id="C"><bpmn:condition>opted in</bpmn:condition></bpmn:conditionalEventDefinition>
    </bpmn:boundaryEvent>`;

async function load(xml: string) {
  const dir = mkdtempSync(join(tmpdir(), "wf-boundary-"));
  const file = join(dir, "b.bpmn");
  await Bun.write(file, xml);
  try {
    return await loadProcessModel(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("a non-interrupting boundary event", () => {
  test("loads as a boundary node on its activity, and is reachable through it", async () => {
    const m = await load(diagram(NON_INTERRUPTING));
    const b = m.nodes.get("OptIn")!;
    expect(b.kind).toBe("boundary");
    expect(b.attachedTo).toBe("Review");
    const r = reachability(m);
    expect(r.unreachable.map((f) => f.where)).not.toContain("OptIn");
    expect(r.unreachable.map((f) => f.where)).not.toContain("Note");
  });

  test("is offered, marked optional, only while its activity holds a token", async () => {
    const m = await load(diagram(NON_INTERRUPTING));
    const s = startInstance(m, { id: "i", subject: "x" });
    const open = enabled(m, s);
    expect(open.map((e) => e.node)).toEqual(["Review", "OptIn"]);
    const opt = open.find((e) => e.node === "OptIn")!;
    expect(opt.kind === "activity" && opt.optionalOn).toBe("Review");
  });

  test("skipping it is the default: the main path finishes without it", async () => {
    const m = await load(diagram(NON_INTERRUPTING));
    const s = complete(m, startInstance(m, { id: "i", subject: "x" }), "Review");
    expect(s.tokens).toEqual([]);
    expect(s.status).toBe("completed");
  });

  test("taking it starts the side path and leaves the activity's token alone", async () => {
    const m = await load(diagram(NON_INTERRUPTING));
    let s = complete(m, startInstance(m, { id: "i", subject: "x" }), "OptIn");
    expect(s.tokens.sort()).toEqual(["Note", "Review"]);
    s = complete(m, s, "Review"); // the main path never waits for the note
    expect(s.tokens).toEqual(["Note"]);
    s = complete(m, s, "Note");
    expect(s.status).toBe("completed");
  });

  test("the checklist lists it right after its step, as optional", async () => {
    const md = checklistFor(await load(diagram(NON_INTERRUPTING)), "b.bpmn");
    const review = md.indexOf("### 1. `Review`");
    const opt = md.indexOf("### Optional, while");
    expect(review).toBeGreaterThan(-1);
    expect(opt).toBeGreaterThan(review);
    expect(md).toContain('node: "OptIn"');
    expect(md).toContain("skipping it is the default");
  });

  test("cannot be taken once its activity no longer holds a token", async () => {
    const m = await load(diagram(NON_INTERRUPTING));
    const s = complete(m, startInstance(m, { id: "i", subject: "x" }), "Review");
    expect(() => complete(m, s, "OptIn")).toThrow();
  });
});

describe("other boundary events are refused, not walked wrongly", () => {
  test("an interrupting one", async () => {
    const xml = diagram(NON_INTERRUPTING.replace(' cancelActivity="false"', ""));
    await expect(load(xml)).rejects.toThrow(UnsupportedBpmn);
    await expect(load(xml)).rejects.toThrow(/interrupting/);
  });

  test("one with an incoming flow", async () => {
    const xml = diagram(
      NON_INTERRUPTING.replace("<bpmn:outgoing>F3</bpmn:outgoing>", "<bpmn:incoming>F9</bpmn:incoming><bpmn:outgoing>F3</bpmn:outgoing>"),
      `<bpmn:sequenceFlow id="F9" sourceRef="S" targetRef="OptIn" />`,
    );
    await expect(load(xml)).rejects.toThrow(/incoming sequence flow/);
  });
});
