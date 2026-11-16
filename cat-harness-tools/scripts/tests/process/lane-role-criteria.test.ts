/**
 * The three lane → Role → Skill report entries `kg:audit` writes
 * (implementation spec §5; declared `minor` in cat-harness `schemas/sdlc/kg-qa.ts`).
 *
 * @module scripts/tests/lane-role-criteria.test
 *
 * Owner, 2026-10-16: *"These are report entries, not gates."* Pinned: each
 * entry fires on the case it names and stays quiet on its neighbours — a
 * variable lane, an inherited skill, a tested contract, a standard binding —
 * because a report that fires on cases the model declared correct is one
 * somebody stops reading.
 */
import { describe, expect, test } from "bun:test";
import { KG_CRITERIA_BY_ID } from "../../../schemas/sdlc/kg-qa.ts";
import type { RoleGraph } from "../../../schemas/process/role-graph.ts";

import { legacyBindingFindings, mechanicalRoleUntested, skillsOutsideLaneRole } from "../../lib/lane-role-criteria.ts";
import { skillEdgesOf } from "../../lib/skill-edges.ts";

const graph: RoleGraph = {
  name: "fixture",
  roles: [
    { id: "build-pipeline", title: "Build pipeline", description: "", actorKinds: ["system"], skills: ["run-build"] },
    { id: "external-registry", title: "Registry", description: "", actorKinds: ["external"], skills: [] },
    { id: "store", title: "Store", description: "", actorKinds: ["system", "external"], skills: ["hold-records"] },
    { id: "reviewer", title: "Reviewer", description: "", actorKinds: ["person", "agent"], skills: ["review"] },
    { id: "lead", title: "Lead", description: "", actorKinds: ["person"], skills: ["sign-off"], inherits: ["reviewer"] },
  ],
};
const role = (id: string) => graph.roles.find((r) => r.id === id)!;
const act = (id: string, laneId: string, skills: string[]) => ({ id, name: id, kind: "activity" as const, laneId, skills });

describe("the criteria are declared, and none of them gates", () => {
  test("minor, which neither --check nor --strict fails on", () => {
    for (const id of ["lane-role-legacy-binding", "task-skill-outside-lane-role", "mechanical-role-untested"]) {
      expect(KG_CRITERIA_BY_ID[id]?.severity).toBe("minor");
    }
  });
});

describe("lane-role-legacy-binding", () => {
  test("every lane laneRoleRef warned about, with its warning, and no other", () => {
    expect(
      legacyBindingFindings([
        { id: "L1", roleBindingWarning: "deprecated ref" },
        { id: "L2" },
      ]),
    ).toEqual([{ where: "L1", detail: "deprecated ref" }]);
  });
});

describe("task-skill-outside-lane-role", () => {
  const lanes = [
    { id: "L_CI", name: "CI/CD Pipeline", roleRef: "build-pipeline" },
    { id: "L_Lead", name: "Lead", roleRef: "lead" },
    { id: "L_Any", name: "Actor", performerVaries: true },
    { id: "L_Ghost", name: "Ghost", roleRef: "undeclared" },
  ];
  test("inherited skills count, variable lanes and undeclared roles are skipped", () => {
    const f = skillsOutsideLaneRole(
      lanes,
      [
        act("T_Build", "L_CI", ["run-build", "publish-site"]),
        act("T_Review", "L_Lead", ["review", "sign-off"]),
        act("T_Log", "L_Any", ["log-message"]),
        act("T_Ghost", "L_Ghost", ["anything"]),
        { id: "G", name: "", kind: "exclusive", laneId: "L_CI", skills: [] },
      ],
      graph,
    );
    expect(f.map((e) => e.where)).toEqual(["T_Build"]);
    expect(f[0]!.detail).toContain('"publish-site"');
  });
});

describe("mechanical-role-untested", () => {
  test("n/a for a role a person or agent takes on", () => {
    expect(mechanicalRoleUntested(role("reviewer"), graph, new Map())).toBeUndefined();
  });
  test("fires on a contract with no test, and on a role with no contract at all", () => {
    expect(mechanicalRoleUntested(role("build-pipeline"), graph, new Map())!.length).toBe(1);
    expect(mechanicalRoleUntested(role("external-registry"), graph, new Map())![0]!.detail).toContain("lists no skill");
  });
  test("quiet once one skill names a test; an EMPTY tested-by is not a test", () => {
    const tested = new Map([["hold-records", skillEdgesOf("---\ntested-by:\n  - test/store.test.ts\n---\n")]]);
    expect(mechanicalRoleUntested(role("store"), graph, tested)).toEqual([]);
    const empty = new Map([["hold-records", skillEdgesOf("---\ntested-by: []\n---\n")]]);
    expect(mechanicalRoleUntested(role("store"), graph, empty)!.length).toBe(1);
  });
});

describe("skill-edges", () => {
  test("absent keys read as not said, not as empty", () => {
    expect(skillEdgesOf("---\nname: x\n---\nbody")).toEqual({});
    expect(skillEdgesOf("no front matter")).toEqual({});
  });
  test("a scalar is a one-item list; both keys as lists", () => {
    expect(skillEdgesOf("---\nuses-methodology: raci\n---\n")).toEqual({ usesMethodology: ["raci"] });
    expect(skillEdgesOf("---\nuses-methodology: [raci, grade]\ntested-by:\n  - a.test.ts\n---\n")).toEqual({
      usesMethodology: ["raci", "grade"],
      testedBy: ["a.test.ts"],
    });
  });
});
