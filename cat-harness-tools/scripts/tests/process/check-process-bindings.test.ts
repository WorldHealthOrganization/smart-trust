/**
 * check:process-bindings, seen failing on planted violations — a boundary
 * check never seen failing checks nothing (`4j3h`, `q2wn`, `p11x`).
 *
 * Calibrated 2026-10-03: emptying `BASELINE` makes the real run exit 1 with
 * 33 NEW bindings; restoring it exits 0.
 */
import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  activityRefs,
  actorRoleRefs,
  analyse,
  callActivityRefs,
  judgeBinding,
  laneRoleRefs,
  processIdsIn,
  ratchet,
  roleName,
  roleSkillRefs,
  skillName,
  type Binding,
} from "../../check-process-bindings.ts";
import { BASELINE } from "../../process-bindings.baseline.ts";

// core needs harness; smart needs core (so, transitively, harness); floor declares no needs.
const allowed = new Map([
  ["harness", new Set(["harness"])],
  ["core", new Set(["core", "harness"])],
  ["smart", new Set(["smart", "core", "harness"])],
]);
const b = (fromInstance: string, ref = "s") => ({ file: "p.bpmn", node: "Task_A", ref, fromInstance });

describe("judgeBinding", () => {
  it("a skill in the process's own instance is allowed", () => {
    expect(judgeBinding(b("core"), ["core"], allowed).verdict).toBe("allowed");
  });
  it("a skill in an instance it needs, transitively, is allowed", () => {
    expect(judgeBinding(b("smart"), ["harness"], allowed).verdict).toBe("allowed");
  });
  it("a skill only in an instance ABOVE it is wrong-direction — the l3-fhir-pipeline case", () => {
    expect(judgeBinding(b("harness"), ["core"], allowed).verdict).toBe("wrong-direction");
    expect(judgeBinding(b("core"), ["smart"], allowed).verdict).toBe("wrong-direction");
  });
  it("one reachable holder is enough when a name is held in several instances", () => {
    expect(judgeBinding(b("core"), ["smart", "harness"], allowed).verdict).toBe("allowed");
  });
  it("a skill nobody holds is dangling, not wrong-direction", () => {
    expect(judgeBinding(b("core"), [], allowed).verdict).toBe("dangling");
  });
  it("an instance with no declared needs is undetermined, never folded into allowed", () => {
    expect(judgeBinding(b("floor"), ["harness"], allowed).verdict).toBe("undetermined");
  });
});

describe("activityRefs", () => {
  it("attributes each skill ref to the activity that carries it", () => {
    const xml = `<bpmn:process id="P"><bpmn:task id="Task_A"><bpmn:extensionElements>
      <bootstrap.processes:skill ref="one" /></bpmn:extensionElements></bpmn:task>
      <bpmn:userTask id="Task_B"><bpmn:extensionElements><bootstrap.processes:skill ref="pkg/two"/>
      </bpmn:extensionElements></bpmn:userTask></bpmn:process>`;
    expect(activityRefs(xml)).toEqual([
      { node: "Task_A", ref: "one" },
      { node: "Task_B", ref: "pkg/two" },
    ]);
  });
  it("a qualified ref denotes the bare skill name", () => {
    expect(skillName("pkg/two")).toBe("two");
    expect(skillName("two")).toBe("two");
  });
});

describe("residual.py's other four joins (f8wp)", () => {
  it("callActivityRefs extracts calledElement per callActivity, and processIdsIn finds processes and globalTasks", () => {
    const xml = `<bpmn:definitions>
      <bpmn:globalTask id="GT_Shared" />
      <bpmn:process id="Proc_Main">
        <bpmn:callActivity id="Call_Sub" calledElement="Proc_Higher" />
        <bpmn:callActivity id="Call_Global" calledElement="GT_Shared" />
      </bpmn:process>
    </bpmn:definitions>`;
    expect(processIdsIn(xml)).toEqual(["GT_Shared", "Proc_Main"]);
    expect(callActivityRefs(xml)).toEqual([
      { node: "Call_Sub", ref: "Proc_Higher" },
      { node: "Call_Global", ref: "GT_Shared" },
    ]);
  });

  it("laneRoleRefs extracts partitionElementRef and extension role refs without double-counting", () => {
    const xml = `<bpmn:process id="P"><bpmn:laneSet id="LS">
      <bpmn:lane id="Lane_1" partitionElementRef="role:reviewer">
        <bpmn:extensionElements><bootstrap.processes:role ref="role:reviewer"/></bpmn:extensionElements>
      </bpmn:lane>
      <bpmn:lane id="Lane_2">
        <bpmn:extensionElements><bootstrap.processes:role ref="clinical-sme"/></bpmn:extensionElements>
      </bpmn:lane>
    </bpmn:laneSet></bpmn:process>`;
    expect(roleName("role:reviewer")).toBe("reviewer");
    expect(laneRoleRefs(xml)).toEqual([
      { node: "Lane_1", ref: "reviewer" },
      { node: "Lane_2", ref: "clinical-sme" },
    ]);
  });

  it("roleSkillRefs and actorRoleRefs extract role→skill and actor→role edges", () => {
    expect(
      roleSkillRefs({
        roles: [{ id: "qc-reviewer", skills: ["content-publish", "ig-ast-delta"] }],
        extensions: [{ role: "build-pipeline", skills: ["fhir-validation"] }],
      }),
    ).toEqual([
      { node: "qc-reviewer", ref: "content-publish" },
      { node: "qc-reviewer", ref: "ig-ast-delta" },
      { node: "ext:build-pipeline", ref: "fhir-validation" },
    ]);
    expect(actorRoleRefs({ id: "authoring-agent", roles: ["author", "clinical-sme"] })).toEqual([
      { node: "authoring-agent", ref: "author" },
      { node: "authoring-agent", ref: "clinical-sme" },
    ]);
  });

  it("analyse catches planted upward references across all five joins in a two-instance fixture", () => {
    const root = mkdtempSync(join(tmpdir(), "process-bindings-5joins-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: root });
      const lower = join(root, "lower");
      const upper = join(root, "upper");
      mkdirSync(join(lower, "skills", "pkg"), { recursive: true });
      mkdirSync(join(lower, "processes"), { recursive: true });
      mkdirSync(join(lower, "scenarios", "actors"), { recursive: true });
      mkdirSync(join(upper, "skills", "pkg"), { recursive: true });
      mkdirSync(join(upper, "processes"), { recursive: true });
      mkdirSync(join(upper, "scenarios", "actors"), { recursive: true });

      writeFileSync(join(lower, "lower.json"), JSON.stringify({ name: "lower", needs: [] }));
      writeFileSync(join(upper, "upper.json"), JSON.stringify({ name: "upper", needs: ["lower"] }));
      writeFileSync(join(lower, "skills", "pkg", "lower-skill.md"), "# lower-skill\n");
      writeFileSync(join(upper, "skills", "pkg", "upper-skill.md"), "# upper-skill\n");

      writeFileSync(
        join(lower, "scenarios", "roles.json"),
        JSON.stringify({
          name: "lower",
          roles: [{ id: "lower-role", title: "Lower Role", skills: ["lower-skill", "upper-skill"] }],
        }),
      );
      writeFileSync(
        join(upper, "scenarios", "roles.json"),
        JSON.stringify({
          name: "upper",
          roles: [{ id: "upper-role", title: "Upper Role", skills: ["lower-skill", "upper-skill"] }],
        }),
      );
      writeFileSync(
        join(lower, "scenarios", "actors", "lower-actor.json"),
        JSON.stringify({ id: "lower-actor", roles: ["lower-role", "upper-role"] }),
      );
      writeFileSync(
        join(upper, "processes", "upper.bpmn"),
        `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
          <bpmn:process id="Proc_Upper" />
        </bpmn:definitions>`,
      );
      writeFileSync(
        join(lower, "processes", "lower.bpmn"),
        `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bp="http://example.com/bp">
          <bpmn:process id="Proc_Lower">
            <bpmn:laneSet id="LS">
              <bpmn:lane id="Lane_Up" partitionElementRef="role:upper-role" />
            </bpmn:laneSet>
            <bpmn:task id="Task_Up">
              <bpmn:extensionElements><bp:skill ref="upper-skill" /></bpmn:extensionElements>
            </bpmn:task>
            <bpmn:callActivity id="Call_Up" calledElement="Proc_Upper" />
          </bpmn:process>
        </bpmn:definitions>`,
      );

      const findings = analyse(root);
      const wrong = findings.filter((f) => f.verdict === "wrong-direction");
      expect(wrong.map((f) => `${f.kind}:${f.node}->${f.ref}`).sort()).toEqual([
        "activity-skill:Task_Up->upper-skill",
        "actor-role:lower-actor->upper-role",
        "call-activity:Call_Up->Proc_Upper",
        "lane-role:Lane_Up->upper-role",
        "role-skill:lower-role->upper-skill",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the ratchet", () => {
  const wrong: Binding = { ...b("harness"), holders: ["core"], verdict: "wrong-direction" };
  const entry = { file: wrong.file, node: wrong.node, ref: wrong.ref, reason: "r", bean: "folio-assistant-xxxx" };
  it("a wrong-direction binding with no baseline entry is a regression", () => {
    expect(ratchet([wrong], []).regressions).toHaveLength(1);
  });
  it("a baselined one passes", () => {
    expect(ratchet([wrong], [entry])).toEqual({ regressions: [], stale: [] });
  });
  it("a cleared one leaves the baseline STALE, so the head-room cannot be reused", () => {
    expect(ratchet([], [entry]).stale).toHaveLength(1);
  });
  it("allowed and dangling bindings are never regressions", () => {
    expect(ratchet([{ ...wrong, verdict: "allowed" }, { ...wrong, verdict: "dangling" }], []).regressions).toEqual([]);
  });
  it("every baseline entry carries a reason and a bean", () => {
    for (const e of BASELINE) {
      expect(e.reason.length).toBeGreaterThan(20);
      expect(e.bean).toMatch(/^folio-assistant-[a-z0-9]{4}$/);
    }
  });
});
