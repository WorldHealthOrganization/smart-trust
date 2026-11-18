/**
 * Who is affected by a proposed change — the mechanically determinable part.
 *
 * CRDM phase 1 asks the agent to identify stakeholders, and the CRDM page
 * proposed a `stakeholder_map` tool reading "affected roles from
 * `harness.config.json` and CODEOWNERS".
 *
 * NEITHER SOURCE EXISTS. This repository has no CODEOWNERS file, and
 * `schemas/kg/harness-config.ts` declares no role, owner, maintainer or contact
 * field. A tool built on those two would have reported "no stakeholders" for
 * every change, forever, and looked like it worked.
 *
 * What does exist, and what this reads instead:
 *
 *   1. BPMN LANES name the actor accountable for each activity, and an
 *      activity names the skill that implements it (`<bootstrap.processes:skill ref>`). So
 *      a changed skill reaches a set of lanes across the process corpus —
 *      "editors and authoring agents", "publication manager", "clinical SMEs".
 *   2. Each reached lane RESOLVES to a declared role, through
 *      `roleForLane` against `scenarios/roles.json` — the lane's own
 *      `partitionElementRef` (owner, 2026-10-16: a lane names a Role), or the
 *      legacy `<bootstrap.processes:role ref>` when that is absent.
 *
 * ## The source this used to read, and why it went
 *
 * It read `roles:` from each skill's own front matter — *"reader,
 * collaborator, owner, auditor"*. That field was **removed on 2026-09-20**
 * (bean `folio-assistant-qif9`): across 114 skill files it carried 288
 * annotations of which **260 — 90 % — resolved against no declared
 * vocabulary**, and `reader`/`collaborator`/`owner` had never existed as
 * actors in any commit. So "Roles reached: collaborator, owner" was not a
 * thin answer, it was a confident wrong one — and the report gave no way to
 * tell it from a real role, since the two vocabularies shared the field.
 *
 * The identically-named key in a `folio-memory/v1` entry is a DIFFERENT
 * field with a real reader (`memoryForRoles`) and was kept. This module
 * never read those files, so nothing here turns on it — it is noted because
 * "`roles:` was removed" is the kind of sentence a later reader acts on.
 *
 * The local reader was worse than the corpus. `rolesOf` matched only the
 * inline `roles: [a, b]` form, so the 28 files using a block list were read
 * as declaring nothing at all.
 *
 * Lanes were always the better source and were already being computed here.
 * They resolve, they are what the role model actually defines, and a lane
 * that does not resolve is now REPORTED rather than passed through as if it
 * were a role.
 *
 * ON DELIBERATELY NOT GUESSING PEOPLE. `crdm-requirements.bpmn` documents its
 * own stakeholder step as "The agent asks the BA who is affected by this
 * change. The BA knows the domain — the agent does not guess." That is a
 * design decision, not an oversight, and this module respects it: it
 * enumerates roles, lanes and processes, and it NEVER outputs a list of
 * humans as "the stakeholders". The named-people half stays the BA's answer;
 * this exists so the BA is asked a sharper question than "who cares?".
 */
import { existsSync, readdirSync } from "node:fs";
import { isSkillMd, kgRoots, skillMdDirs, workflowFiles, corpusScopeFor, roleGraphFor } from "../../scripts/known-skills.js";
import { join, relative } from "node:path";
import { loadProcessModel, isActivity, processDiagrams } from "../workflow/process-model.js";
import { readRoleGraph, roleForLane, type RoleGraph } from "../../schemas/process/role-graph.js";

export interface SkillImpact { name: string; path: string }
export interface LaneImpact {
  process: string;
  lane: string;
  /** The Role the lane names: its `partitionElementRef`, else the legacy `<bootstrap.processes:role ref>` (#1168; owner, 2026-10-16). */
  roleRef?: string;
  activities: string[];
  viaSkills: string[];
}
export interface StakeholderMap {
  changed: string[];
  skills: SkillImpact[];
  lanes: LaneImpact[];
  roles: string[];
  untraced: string[];
  /** The boundary of the mechanical part — always populated, never an error. */
  notDetermined: string[];
}

/**
 * Every skill `.md`, by name, from the directories the layer DECLARES.
 *
 * ## The list this replaces was already wrong
 *
 * It was five literals — four under `skills/`, plus `src/skills` — and
 * `skillMdDirs()` finds **six** `skills/` packages, so `authoring-math` (3
 * skills) and `authoring-who-smart-guidelines` (9) were invisible to the
 * stakeholder map. Changing one of those twelve files reported no impact:
 * no roles, no lanes, no processes. Exactly the failure `known-skills.ts`'s
 * own header describes for the copy it was extracted to remove — *"a list
 * somebody has to remember to extend is not a single answer; it is a copy
 * that happens to match today"* — and here the copy had already stopped
 * matching.
 *
 * Found by `check:declared-paths` on its first run, which is the argument
 * for that gate: nobody was looking at this file.
 *
 * ## Keyed by PATH, because the name is not unique
 *
 * It was `name → path`, which was safe only while the list omitted
 * `.claude/skills/local/`. Reading the declaration admits it, and
 * `todo-manager.md` exists **three** times — `work-plan/skills/work-plan/`,
 * `.claude/skills/local/` and the generated mirror, a divergence `AGENTS.md`
 * documents at length. Under `name → path` the last one scanned wins and a
 * change to either of the others reports NO impact: no roles, no lanes,
 * nobody accountable. Indistinguishable from a change that affects nobody,
 * which is the one wrong answer this analysis must not give.
 *
 * `path → name` collides on nothing. Several paths mapping to one skill name
 * is the corpus stating a fact about itself, not a conflict to resolve.
 */
function skillIndex(root: string): Map<string, string> {
  const index = new Map<string, string>();
  for (const parts of skillMdDirs(root, corpusScopeFor(root))) {
    const dir = parts.join("/");
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      // Per FILE, not per directory: a declared directory holds skills, never
      // only skills — the 25 agent-memory nodes then in `skills/memory/` were `.md` in
      // one, and a role's `roles:` front matter is not theirs to carry.
      if (f.endsWith(".md") && isSkillMd(join(abs, f))) index.set(`${dir}/${f}`, f.slice(0, -3));
    }
  }
  return index;
}

/** Map changed repo-relative paths to the roles, processes and lanes they reach. */
export async function stakeholderMap(root: string, changed: string[]): Promise<StakeholderMap> {
  const byPath = skillIndex(root);

  const skills: SkillImpact[] = [];
  const untraced: string[] = [];
  for (const raw of changed) {
    const path = raw.replace(/^\.\//, "");
    const name = byPath.get(path);
    if (name) skills.push({ name, path });
    else untraced.push(path);
  }

  const changedSkills = new Set(skills.map((s) => s.name));
  const lanes: LaneImpact[] = [];
  // Every declared knowledge-graph directory, not the literal
  // `processes/`. An impact report that misses a diagram reports NO
  // lane affected, which is indistinguishable from a change that affects
  // nobody — the one wrong answer this analysis must not give.
  const diagrams = processDiagrams(workflowFiles(root, corpusScopeFor(root)));

  if (diagrams.length > 0 && changedSkills.size > 0) {
    for (const file of diagrams) {
      const model = await loadProcessModel(file);
      const hits = new Map<string, { activities: string[]; viaSkills: Set<string> }>();
      for (const node of [...model.nodes.values()].filter(isActivity)) {
        const matched = (node.skills ?? []).filter((s) => changedSkills.has(s));
        if (matched.length === 0) continue;
        const lane = node.lane ?? "(no lane — nobody is accountable for this step)";
        const entry = hits.get(lane) ?? { activities: [], viaSkills: new Set<string>() };
        entry.activities.push(node.id);
        for (const s of matched) entry.viaSkills.add(s);
        hits.set(lane, entry);
      }
      for (const [lane, entry] of hits) {
        // REPO-RELATIVE, not the absolute path `workflowFiles` returns and
        // not the bare basename this used to be. Absolute leaks the
        // machine into a report; bare hides WHICH declared directory the
        // diagram came from, which is the thing a topical layout makes
        // worth knowing.
        lanes.push({
          process: relative(root, file),
          lane,
          roleRef: model.lanes.find((l) => (l.name ?? l.id) === lane)?.roleRef,
          activities: entry.activities,
          viaSkills: [...entry.viaSkills].sort(),
        });
      }
    }
  }

  // Roles come from the LANES this change reached, resolved against the
  // declared registry — not from anything a skill says about itself.
  //
  // Every declared knowledge-graph root, not `kgRoots(root)[0]`. Taking the
  // first is the `dh4f` defect arriving through the helper written to
  // prevent it: a topical layout would resolve nothing from the roots this
  // never visited and report it as "no role reached", which is the one wrong
  // answer this analysis must not give.
  const graph: RoleGraph = { name: "stakeholder-map overlay", roles: [] };
  const seenRole = new Set<string>();
  // The checkout's view on the platform's own run (placement PR0b).
  const viaCheckout = corpusScopeFor(root) === "checkout";
  for (const kgRoot of viaCheckout ? [root] : kgRoots(root)) {
    const g = viaCheckout ? roleGraphFor(root, "checkout") : readRoleGraph(kgRoot);
    for (const r of g?.roles ?? []) {
      if (seenRole.has(r.id)) continue;
      seenRole.add(r.id);
      graph.roles.push(r);
    }
  }
  const reached = new Set<string>();
  const unresolvedLanes = new Set<string>();
  for (const l of lanes) {
    const role = roleForLane(graph, l.lane, l.roleRef);
    if (role) reached.add(role.id);
    else unresolvedLanes.add(`${l.lane} (${l.process})`);
  }
  const roles = [...reached].sort();

  const notDetermined = [
    "The PEOPLE. `crdm-requirements.bpmn` documents its stakeholder step as " +
      '"the agent does not guess" — naming humans is the BA\'s answer. This ' +
      "sharpens the question rather than answering it.",
  ];
  if (untraced.length) {
    notDetermined.push(
      `${untraced.length} changed path(s) match no skill, so no lane or role is ` +
        `derivable from them. That is unknown impact, not absent impact.`,
    );
  }
  if (unresolvedLanes.size > 0) {
    // A lane that binds no declared role is UNDETERMINED, not roleless. It
    // used to be neither: the lane simply contributed nothing and the report
    // read as though the change reached no one there.
    notDetermined.push(
      `Lane(s) binding no declared role: ${[...unresolvedLanes].sort().join(", ")}. ` +
        `Somebody is accountable for those activities; \`roles.json\` does not yet ` +
        `say who, so this is unknown impact rather than absent impact.`,
    );
  }
  if (graph.roles.length === 0) {
    // The vacuity case. With no registry every lane is "unresolved", and a
    // report that then said "roles reached: none" would be describing a
    // missing file as a finding about the change.
    notDetermined.push(
      `No role registry was readable under ${kgRoots(root).length} declared graph root(s), ` +
        `so NO lane could be resolved to a role. The role section below is blank because ` +
        `nothing could be determined, not because nobody is affected.`,
    );
  }

  return { changed, skills, lanes, roles, untraced, notDetermined };
}

/** Human-readable report, shared by the CLI and the MCP tool. */
export function formatStakeholderMap(map: StakeholderMap): string {
  const out: string[] = [`Stakeholder map — ${map.changed.length} changed path(s)\n`];

  if (map.skills.length) {
    out.push("Skills changed");
    for (const s of map.skills) out.push(`  ${s.name.padEnd(30)} ${s.path}`);
  } else {
    out.push("No changed path is a skill, so nothing maps to a role this way.");
  }

  // Silent when empty, because `notDetermined` already carries WHY — either
  // no lane was reached or none resolved. A bare "Roles reached: none" would
  // read as a determined empty.
  if (map.roles.length) out.push(`\nRoles reached: ${map.roles.join(", ")}`);

  if (map.lanes.length) {
    out.push("\nProcess lanes reached — who is accountable for a step a changed skill implements");
    for (const l of map.lanes) {
      out.push(`  ${l.process}`);
      out.push(`    ${l.lane}`);
      out.push(`      via ${l.viaSkills.join(", ")} at ${l.activities.join(", ")}`);
    }
  } else if (map.skills.length) {
    out.push("\nNo process lane references these skills, so no diagram says who owns work using them.");
  }

  out.push("\nNOT DETERMINED");
  for (const n of map.notDetermined) out.push(`  · ${n}`);
  return out.join("\n");
}
