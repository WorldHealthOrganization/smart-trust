/**
 * A lane, its role, and that role's skills — bean `zw4a`.
 *
 * @module scripts/tests/lane-detail
 * @graphNode none — a test
 *
 * The viewer showed a lane NAME where the graph could already answer *"an
 * actor performs a task in a process as a role, using that role's skills"*.
 *
 * What these pin is mostly **that nothing about roles is decided in the
 * viewer**. Three times while building this, a hand-rolled resolution turned
 * out to be a worse copy of one that existed, and each time the corpus said so
 * rather than the types:
 *
 *  1. reading `RoleDef.skills` directly — documented "before inheritance", so
 *     it under-reports every inheriting role;
 *  2. matching only an explicit `<folio:role ref>` — 140 of 184 lanes read as
 *     unbound, because a role also binds lane NAMES;
 *  3. a bespoke four-state enum — missing `variable` and `contradictory`,
 *     which `laneBinding` already separates.
 *
 * So the assertions below are as much about provenance as behaviour.
 */
import { describe, expect, test } from "bun:test";

import { laneDetail } from "../../gen-processes-viz.js";
import type { RoleGraph } from "../../../schemas/process/role-graph.js";

const GRAPH: RoleGraph = {
  name: "test",
  roles: [
    {
      id: "reviewer",
      title: "Reviewer",
      description: "r",
      actorKinds: ["person", "agent"],
      skills: ["read-findings"],
    },
    {
      id: "adjudicator",
      title: "Adjudicator",
      description: "a",
      actorKinds: ["person", "agent"],
      skills: ["adjudication"],
      inherits: ["reviewer"],
    },
    {
      id: "corpus",
      title: "Corpus",
      description: "c",
      // A store: a role a machine plays (owner, 2026-10-16), whose skills
      // are its contract. None declared here, which the viewer shows as is.
      actorKinds: ["system"],
      skills: [],
    },
  ],
};

const ACTS = [
  { lane: "Adjudicator", skills: ["adjudication", "untainted-verification"] },
  { lane: "Reviewer", skills: ["content-feedback"] },
];

describe("the binding verdict is `laneBinding`'s, not this file's", () => {
  test("a lane bound by an explicit ref resolves", () => {
    const d = laneDetail({ id: "L", name: "Adjudicator", roleRef: "adjudicator" }, ACTS, GRAPH);
    expect(d.binding).toBe("bound");
    expect(d.roleId).toBe("adjudicator");
  });

  test("a lane with no `roleRef` is UNBOUND, whatever its name", () => {
    // Roles no longer list lane names (data-modelling step 8, #1168): the 140
    // lanes that bound by name were each given an explicit ref. A name that
    // happens to equal a role's title binds nothing, so a lane that lost its
    // ref is a finding rather than a silent match.
    const d = laneDetail({ id: "L", name: "Reviewer" }, ACTS, GRAPH);
    expect(d.binding).toBe("unbound");
  });

  test("a ref naming no declared role is `dangling`, not `unbound`", () => {
    // Different fixes: a typo to correct versus a binding to add.
    const d = laneDetail({ id: "L", name: "Nobody", roleRef: "ghost" }, ACTS, GRAPH);
    expect(d.binding).toBe("dangling");
    expect(d.roleSkills).toEqual([]);
  });

  test("`variable` is a lane whose performer varies BY DESIGN, never a defect", () => {
    // Bean `ug4r`. Reporting this as unbound would make a correct modelling
    // decision a permanent finding.
    const d = laneDetail({ id: "L", name: "Actor", performerVaries: true }, ACTS, GRAPH);
    expect(d.binding).toBe("variable");
  });

  test("declaring BOTH a ref and `variable` is `contradictory`", () => {
    // A state the hand-rolled enum did not have at all.
    const d = laneDetail(
      { id: "L", name: "Adjudicator", roleRef: "adjudicator", performerVaries: true },
      ACTS,
      GRAPH,
    );
    expect(d.binding).toBe("contradictory");
  });

  test("a lane matching nothing and declaring nothing is `unbound`", () => {
    expect(laneDetail({ id: "L", name: "Nowhere" }, ACTS, GRAPH).binding).toBe("unbound");
  });

  test("an unreadable role graph reports `ungraphed` — bean `7go7`, resolved", () => {
    // It used to report `dangling`, so ONE missing file rendered all 44
    // ref-bearing lanes in this corpus as broken references — the `dh4f`
    // shape, a sweep that could not look reporting findings.
    //
    // This test pinned that behaviour rather than guarding it, on the stated
    // ground that `laneBinding` is `kg:audit`'s resolver too and a viewer
    // disagreeing with the audit would be worse. **That ground was false**,
    // and checking it is what unblocked the fix: `kg-audit.ts` already
    // branches on `!graph` and overwrites these criteria with `unknown`, so
    // the audit never published `dangling` here — it computed it and threw it
    // away. The viewer was the one disagreeing.
    //
    // The owner ruled 2026-09-23 for a required parameter over a sixth kind,
    // so there is no verdict to take and the viewer says it could not look.
    const d = laneDetail({ id: "L", name: "Adjudicator", roleRef: "adjudicator" }, ACTS, undefined);
    expect(d.binding).toBe("ungraphed");
    expect(d.roleSkills).toEqual([]);
    expect(d.roleId, "no graph means no role, not a guessed one").toBeUndefined();
  });
});

describe("role skills are CLOSED over inheritance", () => {
  test("an inherited skill is included, and says which ancestor gave it", () => {
    // `RoleDef.skills` is documented "before inheritance". Reading it directly
    // would show one skill here instead of two.
    const d = laneDetail({ id: "L", name: "Adjudicator", roleRef: "adjudicator" }, ACTS, GRAPH);
    expect(d.roleSkills.map((s) => s.skill).sort()).toEqual(["adjudication", "read-findings"]);
    const inherited = d.roleSkills.find((s) => s.skill === "read-findings");
    expect(inherited!.via).toBe("reviewer");
    expect(inherited!.depth).toBeGreaterThan(0);
  });

  test("a role declaring no skills gives a DETERMINED zero, and still binds", () => {
    // Distinct from `unbound`: somebody declared this role and gave it none.
    const d = laneDetail({ id: "L", name: "Corpus", roleRef: "corpus" }, ACTS, GRAPH);
    expect(d.binding).toBe("bound");
    expect(d.roleSkills).toEqual([]);
  });
});

describe("role skills and activity skills are two lists", () => {
  test("they are not folded together, and neither contains the other", () => {
    // The bean's fourth done-when. The role carries `read-findings`, which no
    // activity here names; the activities name `untainted-verification`, which
    // the role does not carry. One list would assert an agreement nothing
    // checks — and WHICH they are is `kg:audit`'s question, not the viewer's.
    const d = laneDetail({ id: "L", name: "Adjudicator", roleRef: "adjudicator" }, ACTS, GRAPH);
    expect(d.roleSkills.map((s) => s.skill)).toContain("read-findings");
    expect(d.activitySkills).not.toContain("read-findings");
    expect(d.activitySkills).toContain("untainted-verification");
    expect(d.roleSkills.map((s) => s.skill)).not.toContain("untainted-verification");
  });

  test("activity skills are scoped to THIS lane", () => {
    const d = laneDetail({ id: "L", name: "Reviewer", roleRef: "reviewer" }, ACTS, GRAPH);
    expect(d.activitySkills).toEqual(["content-feedback"]);
  });

  test("a lane with no activities has an empty list rather than the union", () => {
    const d = laneDetail({ id: "L", name: "Corpus", roleRef: "corpus" }, ACTS, GRAPH);
    expect(d.activitySkills).toEqual([]);
  });
});

describe("the real corpus", () => {
  test("lanes resolve, and a bound one names the role it resolved to", async () => {
    // Non-vacuous: without the count check this would pass over an empty
    // sweep. Deliberately NOT asserting a corpus-wide zero for `dangling` —
    // that is `kg:audit`'s verdict, and an assertion here another branch can
    // invalidate is a tripwire rather than a guard.
    const { processRows } = await import("../../gen-processes-viz.js");
    const lanes = (await processRows()).flatMap((r) => r.laneDetails);
    expect(lanes.length).toBeGreaterThan(50);
    const bound = lanes.filter((l) => l.binding === "bound");
    expect(bound.length).toBeGreaterThan(0);
    for (const l of bound) expect(l.roleId, `${l.name} is bound but names no role`).toBeDefined();
    // A sweep of every diagram in the checkout: 5174 ms on CI on 2026-10-20
    // (folio-assistant#2611), over bun's 5 s default as the corpus grew.
  }, 30_000);

  test("at least one real lane carries an INHERITED skill", async () => {
    // Pins that the closure matters in practice rather than only in the
    // fixture above. Measured 2026-09-23: `adjudication.bpmn`'s `Adjudicator`
    // resolves 14 skills, `content-block-review` among them via `reviewer`.
    const { processRows } = await import("../../gen-processes-viz.js");
    const lanes = (await processRows()).flatMap((r) => r.laneDetails);
    expect(lanes.some((l) => l.roleSkills.some((s) => s.depth > 0))).toBe(true);
  }, 30_000);
});
