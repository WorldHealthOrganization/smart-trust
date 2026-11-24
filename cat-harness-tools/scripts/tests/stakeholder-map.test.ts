/**
 * The stakeholder map reports what it can derive, and says what it cannot.
 *
 * The proposed version of this tool read "affected roles from
 * `harness.config.json` and CODEOWNERS" — neither of which exists in this
 * repository, so it would have reported no stakeholders for every change
 * while looking like it worked. These tests pin the two properties that
 * failure mode would have violated: something is actually derived, and the
 * undetermined part is stated rather than rendered as emptiness.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { stakeholderMap, formatStakeholderMap } from "../../src/impact/stakeholder-map.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { roleGraphFor } from "../known-skills.ts";
import { harnessRel } from "../lib/harness-layout.ts";

const ROOT = join(HARNESS_ROOT);
// declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
const TODO_MANAGER = harnessRel("work-plan/skills/work-plan/todo-manager.md");

/**
 * The map for one changed skill, built ONCE at module scope and read by every
 * test below that asks about that skill.
 *
 * Bean `sff8`. `stakeholderMap` loads every diagram in the corpus, and six
 * tests each asked it the same question, so this file paid six corpus passes
 * for one answer and each of them was charged to its own 5000 ms budget. The
 * answer is a plain value nothing mutates; the README case asks a different
 * question and keeps its own call.
 */
const TODO_MAP = await stakeholderMap(ROOT, [TODO_MANAGER]);

describe("stakeholder map", () => {
  test("a changed skill resolves to its name and path", () => {
    const map = TODO_MAP;
    expect(map.skills.map((s) => s.name)).toEqual(["todo-manager"]);
    expect(map.skills[0].path).toContain("todo-manager.md");
    expect(map.untraced).toEqual([]);
  });

  test("roles come from the LANES reached, and every one resolves in the registry", () => {
    // Until 2026-09-20 this read each skill's own `roles:` front matter, and
    // "Roles reached: collaborator, owner" named two things that were in no
    // registry — 260 of 325 annotations resolved against nothing, and the
    // report gave no way to tell those from a real role. Bean `qif9`.
    const map = TODO_MAP;
    expect(map.roles.length).toBeGreaterThan(0);
    // The registry the map itself resolves against: this layer's roles,
    // with its dependents' overlaid when it runs inside an index checkout
    // (placement PR0b). The lanes reached include theirs, so must the roles.
    const declared = new Set((roleGraphFor(ROOT)?.roles ?? []).map((r) => r.id));
    expect(declared.size).toBeGreaterThan(0);
    for (const r of map.roles) expect(`${r}: ${declared.has(r)}`).toBe(`${r}: true`);
    // And the retired vocabulary cannot come back through this door.
    for (const gone of ["reader", "collaborator", "owner"]) {
      expect(map.roles).not.toContain(gone);
    }
  });

  test("a lane binding no declared role is UNDETERMINED, not silently roleless", () => {
    const map = TODO_MAP;
    // A lane binds by its own `<folio:role ref>` (#1168); one with no ref, or a
    // ref to no declared role, binds nothing.
    const declared = new Set((roleGraphFor(ROOT)?.roles ?? []).map((r) => r.id));
    const unbound = map.lanes.filter((l) => l.roleRef === undefined || !declared.has(l.roleRef));
    // Conditional on the corpus having one, and the assertion says which
    // case ran — a test that quietly passes on an empty filter is the
    // vacuity this repository keeps paying for.
    const said = map.notDetermined.join(" ");
    expect(`${unbound.length > 0 ? "unbound lanes exist" : "every lane binds"}: reported=${
      unbound.length > 0 ? said.includes("binding no declared role") : true
    }`).toBe(`${unbound.length > 0 ? "unbound lanes exist" : "every lane binds"}: reported=true`);
  });

  test("a changed skill reaches the process lanes accountable for using it", () => {
    const map = TODO_MAP;
    // The work-plan lane appears in several processes; the point is that the
    // mapping produces LANES, which is the half CODEOWNERS could never give.
    expect(map.lanes.length).toBeGreaterThan(0);
    for (const lane of map.lanes) {
      expect(lane.viaSkills).toContain("todo-manager");
      expect(lane.activities.length).toBeGreaterThan(0);
    }
  });

  test("a path that is not a skill is untraced, not silently dropped", async () => {
    const map = await stakeholderMap(ROOT, ["README.md"]);
    expect(map.untraced).toEqual(["README.md"]);
    expect(map.skills).toEqual([]);
    // "Unknown impact" must not read as "no impact".
    expect(map.notDetermined.join(" ")).toContain("unknown impact");
  });

  test("the undetermined part is always reported, even on a clean mapping", () => {
    const map = TODO_MAP;
    expect(map.notDetermined.length).toBeGreaterThan(0);
    // The people half is never answered mechanically.
    expect(map.notDetermined[0]).toContain("does not guess");
  });

  test("the report names the lanes and the undetermined section", () => {
    const text = formatStakeholderMap(TODO_MAP);
    expect(text).toContain("Process lanes reached");
    expect(text).toContain("NOT DETERMINED");
  });
});
