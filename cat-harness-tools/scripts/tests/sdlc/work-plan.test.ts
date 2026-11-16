/**
 * A work plan is an epic or milestone that names the process it instantiates
 * (work item folio-assistant-exrp; owner 2026-11-05, "Epic is the plan").
 */
import { describe, expect, test } from "bun:test";
import { workPlanFindings, workPlanOf } from "../../../schemas/sdlc/work-plan.ts";

describe("a work item's plan, read from its tags", () => {
  test("a process tag makes it a plan; a proposal tag says where it came from", () => {
    expect(workPlanOf(["vocabulary", "process:Process_ContentLifecycle", "proposal:docs/proposals/x.md"])).toEqual({
      processes: ["Process_ContentLifecycle"],
      proposal: "docs/proposals/x.md",
    });
  });

  test("no process tag, no plan — a proposal alone is not yet one", () => {
    expect(workPlanOf(["proposal:docs/proposals/x.md"])).toBeUndefined();
    expect(workPlanOf([])).toBeUndefined();
    expect(workPlanOf(undefined)).toBeUndefined();
  });

  test("several processes, in order, once each; an empty value is no value", () => {
    expect(workPlanOf(["process:A", "process: B ", "process:A", "process:"])?.processes).toEqual(["A", "B"]);
  });
});

describe("work-plan findings: reported, never fatal", () => {
  test("a plan filed as a feature, and a proposal with no process", () => {
    const f = workPlanFindings([
      { id: "a", type: "epic", tags: ["process:P"] },
      { id: "b", type: "milestone", tags: ["process:P"] },
      { id: "c", type: "feature", tags: ["process:P"] },
      { id: "d", type: "epic", tags: ["proposal:docs/proposals/x.md"] },
      { id: "e", type: "task", tags: ["vocabulary"] },
    ]);
    expect(f.map((x) => x.id)).toEqual(["c", "d"]);
  });
});

describe("an instance names its plan", () => {
  test("startInstance records `plan` when given, and writes no key when not", async () => {
    const { startInstance } = await import("../../../src/workflow/instance.ts");
    const { loadProcessModel } = await import("../../../src/workflow/process-model.ts");
    const { workflowFile } = await import("../../known-skills.ts");
    const { HARNESS_ROOT } = await import("../../lib/roots.ts");
    const model = await loadProcessModel(workflowFile(HARNESS_ROOT, "bean-drain.bpmn"));
    const withPlan = startInstance(model, { id: "plan-yes", subject: "x", bean: "abcd", plan: "epic1" });
    expect(withPlan.plan).toBe("epic1");
    const without = startInstance(model, { id: "plan-no", subject: "x", bean: "abcd" });
    expect("plan" in without).toBe(false);
  });
});

describe("a process declares whether it starts from a work plan (folio-assistant-rwhr)", () => {
  const diagramXml = (id: string, extBody: string, procAttr = "") => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  id="Defs_${id}" targetNamespace="urn:test">
  <bpmn:process id="${id}" name="${id}"${procAttr ? ` ${procAttr}` : ""}>
    ${extBody ? `<bpmn:extensionElements>${extBody}</bpmn:extensionElements>` : ""}
    <bpmn:startEvent id="Start_1" name="Start">
      <bpmn:outgoing>F1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_1" name="Step">
      <bpmn:incoming>F1</bpmn:incoming>
      <bpmn:outgoing>F2</bpmn:outgoing>
      <bpmn:extensionElements>
        <cat-harness.processes:no-skill reason="fixture"/>
      </bpmn:extensionElements>
    </bpmn:task>
    <bpmn:endEvent id="End_1" name="Done">
      <bpmn:incoming>F2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="Start_1" targetRef="Task_1"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task_1" targetRef="End_1"/>
  </bpmn:process>
</bpmn:definitions>
`;

  test("loadProcessModel reads startsFromWorkPlan when declared, leaves small processes unmarked, and refuses non-booleans", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { loadProcessModel } = await import("../../../src/workflow/process-model.ts");

    const dir = mkdtempSync(join(tmpdir(), "rwhr-model-"));
    try {
      const write = (name: string, xml: string) => {
        const p = join(dir, name);
        writeFileSync(p, xml);
        return p;
      };

      const bare = await loadProcessModel(
        write("bare.bpmn", diagramXml("Process_Bare", `<cat-harness.processes:work-plan/>`)),
      );
      expect(bare.startsFromWorkPlan).toBe(true);

      const explicitTrue = await loadProcessModel(
        write("true.bpmn", diagramXml("Process_True", `<cat-harness.processes:work-plan starts="true"/>`)),
      );
      expect(explicitTrue.startsFromWorkPlan).toBe(true);

      const explicitFalse = await loadProcessModel(
        write("false.bpmn", diagramXml("Process_False", `<cat-harness.processes:work-plan starts="false"/>`)),
      );
      expect(explicitFalse.startsFromWorkPlan).toBe(false);

      const policyAttr = await loadProcessModel(
        write(
          "policy.bpmn",
          diagramXml("Process_Policy", `<cat-harness.processes:policy enforcement="strict" workPlan="true"/>`),
        ),
      );
      expect(policyAttr.startsFromWorkPlan).toBe(true);

      const small = await loadProcessModel(write("small.bpmn", diagramXml("Process_Small", "")));
      expect(small.startsFromWorkPlan).toBeUndefined();
      expect("startsFromWorkPlan" in small).toBe(false);

      await expect(
        loadProcessModel(
          write("invalid.bpmn", diagramXml("Process_Invalid", `<cat-harness.processes:work-plan starts="maybe"/>`)),
        ),
      ).rejects.toThrow(/not a boolean/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("workflow_start reports without refusing when a work-plan process starts with no plan, and stays quiet otherwise", async () => {
    const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { workflowStartAnswer } = await import("../../../src/tools/workflow.ts");

    const root = mkdtempSync(join(tmpdir(), "rwhr-start-"));
    try {
      mkdirSync(join(root, "processes"), { recursive: true });
      writeFileSync(join(root, "fixture.json"), JSON.stringify({ name: "fixture" }));
      writeFileSync(
        join(root, "processes", "planned.bpmn"),
        diagramXml("Process_Planned", `<cat-harness.processes:work-plan/>`),
      );
      writeFileSync(join(root, "processes", "small.bpmn"), diagramXml("Process_Small", ""));

      const roles = () => ({ roles: new Map(), actors: new Map(), raw: { roles: [], actors: [] } }) as never;

      // 1. Work-plan process started with no plan and no bean -> starts (never refuses) and says so.
      const missing = await workflowStartAnswer(
        root,
        { process: "planned", subject: "no-plan-run" },
        { roles },
      );
      expect(missing.result.started).toBe(true);
      expect(missing.text).toContain("Started.");
      expect(missing.text).toContain("Work plan: `Process_Planned` declares that it starts from a work plan, and none was passed");

      // 2. Work-plan process started with `plan` -> starts, names the plan, and emits no missing-plan notice.
      const withPlan = await workflowStartAnswer(
        root,
        { process: "planned", subject: "with-plan-run", plan: "epic-42" },
        { roles },
      );
      expect(withPlan.result.started).toBe(true);
      expect(withPlan.text).toContain("Part of work plan `epic-42`.");
      expect(withPlan.text).not.toContain("none was passed");

      // 3. Work-plan process started with `bean` -> starts and emits no missing-plan notice.
      const withBean = await workflowStartAnswer(
        root,
        { process: "planned", subject: "with-bean-run", bean: "bean-99" },
        { roles },
      );
      expect(withBean.result.started).toBe(true);
      expect(withBean.text).not.toContain("none was passed");

      // 4. Small process with no work-plan declaration started with no plan -> starts and emits no missing-plan notice.
      const smallOut = await workflowStartAnswer(
        root,
        { process: "small", subject: "small-run" },
        { roles },
      );
      expect(smallOut.result.started).toBe(true);
      expect(smallOut.text).toContain("Started.");
      expect(smallOut.text).not.toContain("starts from a work plan");
      expect(smallOut.text).not.toContain("none was passed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
