/**
 * The three lane → Role → Skill report entries `kg:audit` writes, computed.
 *
 * @module scripts/lib/lane-role-criteria
 *
 * Owner, 2026-10-16 (thread "BPMN lane, role and skill modelling"; the
 * implementation spec's §5): *"These are report entries, not gates."* The
 * criteria are DECLARED in cat-harness `schemas/sdlc/kg-qa.ts` — ids, applies-to,
 * severity `minor`, which is below what `--check` and `--strict` fail on — and
 * computed here, beside the other criteria `kg-audit.ts` computes, as pure
 * functions so each case is testable without a checkout. The model they look
 * at:
 *
 *   lane ──names──▶ Role ──hasSkill──▶ Skill ◀──requires── task
 *
 * - **`lane-role-legacy-binding`** (process) — a lane still bound by the
 *   deprecated `<bootstrap.processes:role ref>`, or carrying one that
 *   disagrees with its `partitionElementRef`. The text is `laneRoleRef`'s own
 *   warning (cat-harness `schemas/process/role-graph.ts`), carried on the lane by
 *   `loadProcessModel`: one reader, one sentence.
 * - **`task-skill-outside-lane-role`** (process) — a task's skill that is not
 *   among the skills of the Role its lane names, closed over `inherits`.
 *   `variable="true"` lanes are skipped: their performer is whoever invoked
 *   the process, a declaration and not an omission. The same join as the
 *   graded `role-carries-activity-skill`, under the agreed name.
 * - **`mechanical-role-untested`** (role) — a Role whose `actorKinds` are
 *   only `system` and/or `external` (`isMechanicalRole`), none of whose
 *   skills, inherited ones included, carries a non-empty `tested-by:`. A
 *   mechanical role is a real role whose skills are its contract; a contract
 *   nothing tests is a promise nobody checks.
 */
import { findRole, isMechanicalRole, resolveRoleSkills, type RoleDef, type RoleGraph } from "../../schemas/process/role-graph.js";
import type { KgFinding } from "../../schemas/sdlc/kg-qa.js";
import type { LaneDef, ProcessNode } from "../../src/workflow/process-model.ts";
import type { SkillEdges } from "./skill-edges.ts";

/** `lane-role-legacy-binding`: every lane `laneRoleRef` warned about. */
export function legacyBindingFindings(lanes: readonly Pick<LaneDef, "id" | "roleBindingWarning">[]): KgFinding[] {
  return lanes.flatMap((l) => (l.roleBindingWarning ? [{ where: l.id, detail: l.roleBindingWarning }] : []));
}

/** `task-skill-outside-lane-role`, for one diagram. */
export function skillsOutsideLaneRole(
  lanes: readonly Pick<LaneDef, "id" | "name" | "roleRef" | "performerVaries">[],
  nodes: readonly Pick<ProcessNode, "id" | "name" | "kind" | "laneId" | "skills">[],
  graph: RoleGraph,
): KgFinding[] {
  const laneById = new Map(lanes.map((l) => [l.id, l]));
  const closure = new Map<string, Set<string>>();
  const out: KgFinding[] = [];
  for (const n of nodes) {
    if (n.kind !== "activity" || n.skills.length === 0 || n.laneId === undefined) continue;
    const lane = laneById.get(n.laneId);
    if (!lane || lane.performerVaries || !lane.roleRef) continue;
    // An undeclared role is `role-ref-resolves`' finding, not this one's.
    if (!findRole(graph, lane.roleRef)) continue;
    let has = closure.get(lane.roleRef);
    if (!has) closure.set(lane.roleRef, (has = new Set(resolveRoleSkills(graph, lane.roleRef).map((p) => p.skill))));
    for (const s of n.skills) {
      if (has.has(s)) continue;
      out.push({
        where: n.id,
        detail:
          `task "${n.name || n.id}" requires skill "${s}", which role "${lane.roleRef}" (named by lane ` +
          `"${lane.name ?? lane.id}") does not list, directly or through \`inherits\`.`,
      });
    }
  }
  return out;
}

/**
 * `mechanical-role-untested`, for one role: `undefined` when the role is not
 * mechanical (the criterion does not apply — `n/a`, not a pass), otherwise
 * the findings, empty when some skill names a test.
 */
export function mechanicalRoleUntested(
  role: RoleDef,
  graph: RoleGraph,
  skillEdges: ReadonlyMap<string, SkillEdges>,
): KgFinding[] | undefined {
  if (!isMechanicalRole(role)) return undefined;
  const skills = resolveRoleSkills(graph, role.id).map((s) => s.skill);
  if (skills.some((s) => (skillEdges.get(s)?.testedBy ?? []).length > 0)) return [];
  return [
    {
      where: role.id,
      detail:
        skills.length === 0
          ? `role "${role.id}" is played only by ${role.actorKinds.join("/")} actors and lists no skill — it has no ` +
            `contract to test. Give it the skills the diagrams need of it, each naming its tests in \`tested-by:\`.`
          : `role "${role.id}" is played only by ${role.actorKinds.join("/")} actors, and none of its ${skills.length} ` +
            `skill(s) (${skills.join(", ")}) names a test in \`tested-by:\`.`,
    },
  ];
}
