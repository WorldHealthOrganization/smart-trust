#!/usr/bin/env bun
/**
 * check-process-bindings.ts — a process binds only skills it can reach.
 *
 * A process may bind only skills (and, through them, Tools) from its own
 * layer or from a layer it `needs`. It is `check:import-direction`'s
 * rule applied to a SKILL a BPMN activity says implements a step. It uses the
 * same direction computation as `check:import-direction` and
 * `check:reference-direction` (`allowedFromNeeds` over `ancestorsOf`).
 * Existence checks (`skill-ref-resolves`, `check:workflow-refs`) answer
 * "exists somewhere", not "reachable from here".
 *
 * Each `<bootstrap.processes:skill ref>` on an activity, in every `.bpmn`
 * under a declared layer, is resolved against every layer's OWN skill
 * files (a skill belongs to the innermost layer root containing it):
 *
 * - **allowed**: some holder of the skill is the process's instance or one it
 *   `needs`, transitively;
 * - **wrong-direction**: the skill exists, but only in layers the process
 *   cannot reach. GRADED;
 * - **dangling**: no layer in this checkout holds it. That is
 *   `check:workflow-refs`' finding, so it is counted here and never graded;
 * - **undetermined**: the process's instance declares no `needs` (absent is
 *   not `[]`), printed as COULD NOT DETERMINE.
 *
 * A BPMN activity binds no Tool directly, so judging the skill judges the
 * Tool too.
 *
 * Ratchet: existing wrong-direction bindings are listed with reasons in
 * `process-bindings.baseline.ts`. A new one fails, and so does a cleared one
 * the baseline still allows; `--shrink` lowers the list and never raises it.
 *
 * ```sh
 * bun run cat check:process-bindings            # report + gate
 * bun run cat check:process-bindings --shrink   # lower the baseline after a fix
 * ```
 *
 * Tested with planted violations in `tests/process/check-process-bindings.test.ts`.
 *
 * @module scripts/check-process-bindings
 * @covers processes, skills
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { readInstances, ownerOf, type Instance } from "./check-import-direction.ts";
import { isSkillMd, skillMdDirs } from "./known-skills.ts";
import { directoriesForGraph } from "../schemas/kg/cat-harness.js";
import { ancestorsOf, flattenDependencies } from "../schemas/kg/dependency-order.js";
import { allowedFromNeeds } from "../schemas/kg/layer-direction.js";
import { ACTORS_DIRNAME, ROLE_GRAPH_FILENAME } from "../schemas/process/role-graph.js";
import { BASELINE, type BindingBaselineEntry } from "./process-bindings.baseline.ts";
import { TOOLS_ROOT } from "./lib/roots.ts";
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

export type BindingVerdict = "allowed" | "wrong-direction" | "dangling" | "undetermined";

/**
 * The five cross-layer KG reference joins from placement proposal §5 (`residual.py`, bean `f8wp`):
 *
 * - `activity-skill`: `<…:skill ref="…">` on a BPMN activity → skill holder;
 * - `call-activity`: `calledElement="…"` on a `<bpmn:callActivity>` → process / global-task holder;
 * - `lane-role`: `partitionElementRef` or `<…:role ref="…">` on a `<bpmn:lane>` → role holder;
 * - `role-skill`: `roles[].skills` and `extensions[].skills` in `scenarios/roles.json` → skill holder;
 * - `actor-role`: `roles[]` in `scenarios/actors/*.json` and `extensions[].role` in `scenarios/roles.json` → role holder.
 */
export type BindingKind = "activity-skill" | "call-activity" | "lane-role" | "role-skill" | "actor-role";

export interface Binding {
  /** Repo-relative BPMN or scenario file. */
  file: string;
  /** The activity, lane, role, or actor id. */
  node: string;
  /** The ref as written — `name` or `package/name`, process id, or role id. */
  ref: string;
  fromInstance: string;
  /** Layers that hold a target of that name. */
  holders: string[];
  verdict: BindingVerdict;
  kind?: BindingKind;
}

/** The skill name a ref denotes: `package/name` → `name`. */
export const skillName = (ref: string): string => ref.slice(ref.lastIndexOf("/") + 1);

/** The role id a lane ref denotes: `role:name` → `name`. */
export const roleName = (ref: string): string => ref.replace(/^role:/, "");

/**
 * Judge one binding. Pure, so the tests can plant violations without a
 * checkout. `allowed` is `allowedFromNeeds`' map: layer → itself plus
 * everything it needs, or absent when the layer declared no `needs`.
 */
export function judgeBinding(
  b: { file: string; node: string; ref: string; fromInstance: string; kind?: BindingKind },
  holders: readonly string[],
  allowed: ReadonlyMap<string, ReadonlySet<string>>,
): Binding {
  const base = { ...b, holders: [...holders].sort() };
  if (holders.length === 0) return { ...base, verdict: "dangling" };
  if (holders.includes(b.fromInstance)) return { ...base, verdict: "allowed" };
  const reach = allowed.get(b.fromInstance);
  if (reach === undefined) return { ...base, verdict: "undetermined" };
  return { ...base, verdict: holders.some((h) => reach.has(h)) ? "allowed" : "wrong-direction" };
}

/**
 * `<bootstrap.processes:skill ref>` per activity, read from the XML.
 *
 * A regex over elements rather than `loadProcessModel`: that loader follows
 * call activities and refuses a cycle, and this check must judge a diagram
 * whether or not it loads. A ref is attributed to the nearest enclosing
 * element carrying an `id`.
 */
export function activityRefs(xml: string): { node: string; ref: string }[] {
  const out: { node: string; ref: string }[] = [];
  const stack: string[] = [];
  const tag = /<(\/?)([\w.-]+:[\w-]+|[\w-]+)\b([^>]*?)(\/?)>/g;
  for (const m of xml.matchAll(tag)) {
    const [, closing, name, attrs, selfClosing] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    if (/:skill$/.test(name!)) {
      const ref = /\bref="([^"]+)"/.exec(attrs!)?.[1];
      const node = [...stack].reverse().find((id) => id !== "");
      if (ref && node) out.push({ node, ref });
    }
    if (!selfClosing) stack.push(/\bid="([^"]+)"/.exec(attrs!)?.[1] ?? "");
  }
  return out;
}

/** `calledElement` per `<bpmn:callActivity>`, read from the XML. */
export function callActivityRefs(xml: string): { node: string; ref: string }[] {
  const out: { node: string; ref: string }[] = [];
  for (const m of xml.matchAll(/<(?:\w+:)?callActivity\b([^>]*?)>/g)) {
    const attrs = m[1]!;
    const node = /\bid="([^"]+)"/.exec(attrs)?.[1];
    const ref = /\bcalledElement="([^"]+)"/.exec(attrs)?.[1];
    if (node && ref) out.push({ node, ref });
  }
  return out;
}

/** Role bindings on `<bpmn:lane>` (`partitionElementRef` or `<…:role ref="…">`), read from the XML. */
export function laneRoleRefs(xml: string): { node: string; ref: string }[] {
  const out: { node: string; ref: string }[] = [];
  const seen = new Set<string>();
  const add = (node: string, rawRef: string) => {
    const ref = roleName(rawRef);
    const key = `${node}\u0000${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ node, ref });
  };
  const stack: string[] = [];
  const tag = /<(\/?)([\w.-]+:[\w-]+|[\w-]+)\b([^>]*?)(\/?)>/g;
  for (const m of xml.matchAll(tag)) {
    const [, closing, name, attrs, selfClosing] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    const id = /\bid="([^"]+)"/.exec(attrs!)?.[1] ?? "";
    if (/^(?:\w+:)?lane$/.test(name!)) {
      const part = /\bpartitionElementRef="([^"]+)"/.exec(attrs!)?.[1];
      if (id && part) add(id, part);
    } else if (/:role$/.test(name!)) {
      const ref = /\bref="([^"]+)"/.exec(attrs!)?.[1];
      const node = [...stack].reverse().find((s) => s !== "");
      if (ref && node) add(node, ref);
    }
    if (!selfClosing) stack.push(id);
  }
  return out;
}

/** Callable `<bpmn:process>` and `<bpmn:global*Task>` ids declared in the XML. */
export function processIdsIn(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<(?:\w+:)?(?:process|global\w*Task)\b[^>]*\bid="([^"]+)"/g)) {
    out.push(m[1]!);
  }
  return out;
}

/** `role → skill` bindings from a `roles.json` document (`roles[].skills` and `extensions[].skills`). */
export function roleSkillRefs(doc: {
  roles?: readonly { id?: string; skills?: readonly string[] }[];
  extensions?: readonly { role?: string; skills?: readonly string[] }[];
}): { node: string; ref: string }[] {
  const out: { node: string; ref: string }[] = [];
  for (const r of doc.roles ?? []) {
    if (!r.id) continue;
    for (const s of r.skills ?? []) out.push({ node: r.id, ref: s });
  }
  for (const ext of doc.extensions ?? []) {
    if (!ext.role) continue;
    for (const s of ext.skills ?? []) out.push({ node: `ext:${ext.role}`, ref: s });
  }
  return out;
}

/** `actor → role` bindings from an actor JSON document (`roles[]`). */
export function actorRoleRefs(actor: { id?: string; roles?: readonly string[] }): { node: string; ref: string }[] {
  if (!actor.id) return [];
  return (actor.roles ?? []).map((ref) => ({ node: actor.id!, ref }));
}

/** skill name → the layers whose own skill files hold one of that name. */
function skillHolders(all: readonly Instance[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const inst of all) {
    for (const parts of skillMdDirs(inst.root, "instance")) {
      const dir = join(inst.root, ...parts);
      let names: string[];
      try {
        names = readdirSync(dir);
      } catch {
        continue;
      }
      for (const f of names) {
        const abs = join(dir, f);
        if (!f.endsWith(".md") || seen.has(abs) || !isSkillMd(abs)) continue;
        seen.add(abs);
        const owner = ownerOf(abs, all);
        if (!owner) continue;
        const set = out.get(f.slice(0, -3)) ?? new Set<string>();
        set.add(owner.name);
        out.set(f.slice(0, -3), set);
      }
    }
  }
  return out;
}

interface RoleDocEntry {
  inst: Instance;
  abs: string;
  doc: {
    roles?: readonly { id?: string; skills?: readonly string[] }[];
    extensions?: readonly { role?: string; skills?: readonly string[] }[];
  };
}

/** Read each layer's own `roles.json` and map role id → declaring layers. */
function readRoleDocs(all: readonly Instance[]): { docs: RoleDocEntry[]; holders: Map<string, Set<string>> } {
  const docs: RoleDocEntry[] = [];
  const holders = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const inst of all) {
    let scenarioDirs: string[];
    try {
      scenarioDirs = [...new Set(directoriesForGraph(inst.root, "scenarios"))];
    } catch {
      continue;
    }
    for (const dir of scenarioDirs) {
      const abs = join(dir, ROLE_GRAPH_FILENAME);
      if (seen.has(abs) || !existsSync(abs)) continue;
      const owner = ownerOf(abs, all);
      if (!owner || owner.name !== inst.name) continue;
      seen.add(abs);
      let doc: RoleDocEntry["doc"];
      try {
        doc = JSON.parse(readFileSync(abs, "utf-8")) as RoleDocEntry["doc"];
      } catch {
        continue;
      }
      docs.push({ inst, abs, doc });
      for (const r of doc.roles ?? []) {
        if (!r.id) continue;
        const set = holders.get(r.id) ?? new Set<string>();
        set.add(inst.name);
        holders.set(r.id, set);
      }
    }
  }
  return { docs, holders };
}

export function analyse(repoRoot = REPO_ROOT): Binding[] {
  const root = resolve(repoRoot);
  const all = readInstances(root);
  const byName = new Map(all.map((i) => [i.name, i]));
  const flat = flattenDependencies(
    all.map((i) => ({ id: i.name, needs: (i.needs ?? []).filter((n) => byName.has(n)), fatal: false })),
  );
  if (flat.problems.length > 0) {
    throw new Error(`check:process-bindings: the instance needs graph is broken — ${flat.problems.map((p) => p.detail).join("; ")}`);
  }
  const allowed = allowedFromNeeds(new Map(all.map((i) => [i.name, i.needs])), ancestorsOf(flat.order));
  const skills = skillHolders(all);
  const { docs: roleDocs, holders: roles } = readRoleDocs(all);

  // `gitCorpus`, not a bare `git ls-files`: in a composed checkout every
  // layer is a REMOTE MOUNT, laid down from `index.lock.json` and ignored
  // by the index repository's git, so `ls-files` at the root lists none of
  // their files. `gitCorpus` counts a mount's files as it counted a
  // submodule's, and is tracked-plus-untracked exactly as before elsewhere.
  const listed = gitCorpus(root, ["*.bpmn"]);
  if (listed === undefined) throw new Error(`check:process-bindings: git could not list the files in ${root}`);
  const bpmn = listed.map((f) => relative(root, f));
  const processes = new Map<string, Set<string>>();
  const loadedBpmn: { rel: string; from: Instance; xml: string }[] = [];
  for (const rel of bpmn) {
    const abs = join(root, rel);
    const from = ownerOf(abs, all);
    if (!from) continue;
    const xml = readFileSync(abs, "utf-8");
    loadedBpmn.push({ rel: relative(root, abs), from, xml });
    for (const id of processIdsIn(xml)) {
      const set = processes.get(id) ?? new Set<string>();
      set.add(from.name);
      processes.set(id, set);
    }
  }

  const out: Binding[] = [];
  for (const { rel, from, xml } of loadedBpmn) {
    for (const { node, ref } of activityRefs(xml)) {
      out.push(
        judgeBinding(
          { file: rel, node, ref, fromInstance: from.name, kind: "activity-skill" },
          [...(skills.get(skillName(ref)) ?? [])],
          allowed,
        ),
      );
    }
    for (const { node, ref } of callActivityRefs(xml)) {
      out.push(
        judgeBinding(
          { file: rel, node, ref, fromInstance: from.name, kind: "call-activity" },
          [...(processes.get(ref) ?? [])],
          allowed,
        ),
      );
    }
    for (const { node, ref } of laneRoleRefs(xml)) {
      out.push(
        judgeBinding(
          { file: rel, node, ref, fromInstance: from.name, kind: "lane-role" },
          [...(roles.get(ref) ?? [])],
          allowed,
        ),
      );
    }
  }

  for (const { inst, abs, doc } of roleDocs) {
    const rel = relative(root, abs);
    for (const { node, ref } of roleSkillRefs(doc)) {
      out.push(
        judgeBinding(
          { file: rel, node, ref, fromInstance: inst.name, kind: "role-skill" },
          [...(skills.get(skillName(ref)) ?? [])],
          allowed,
        ),
      );
    }
  }

  const seenActors = new Set<string>();
  for (const inst of all) {
    let scenarioDirs: string[];
    try {
      scenarioDirs = [...new Set(directoriesForGraph(inst.root, "scenarios"))];
    } catch {
      continue;
    }
    for (const dir of scenarioDirs) {
      const actorsPath = join(dir, ACTORS_DIRNAME);
      if (!existsSync(actorsPath)) continue;
      let files: string[];
      try {
        files = readdirSync(actorsPath).filter((f) => f.endsWith(".json")).sort();
      } catch {
        continue;
      }
      for (const f of files) {
        const abs = join(actorsPath, f);
        if (seenActors.has(abs)) continue;
        const owner = ownerOf(abs, all);
        if (!owner || owner.name !== inst.name) continue;
        seenActors.add(abs);
        let actor: { id?: string; roles?: readonly string[] };
        try {
          actor = JSON.parse(readFileSync(abs, "utf-8")) as { id?: string; roles?: readonly string[] };
        } catch {
          continue;
        }
        const rel = relative(root, abs);
        for (const { node, ref } of actorRoleRefs(actor)) {
          out.push(
            judgeBinding(
              { file: rel, node, ref, fromInstance: inst.name, kind: "actor-role" },
              [...(roles.get(ref) ?? [])],
              allowed,
            ),
          );
        }
      }
    }
  }

  return out;
}

const keyOf = (b: { file: string; node: string; ref: string }) => `${b.file}\u0000${b.node}\u0000${b.ref}`;

export function ratchet(found: readonly Binding[], baseline: readonly BindingBaselineEntry[]) {
  const wrong = found.filter((b) => b.verdict === "wrong-direction");
  const dangling = new Set(found.filter((b) => b.verdict === "dangling").map(keyOf));
  const base = new Set(baseline.map(keyOf));
  const now = new Set(wrong.map(keyOf));
  return {
    regressions: wrong.filter((b) => !base.has(keyOf(b))),
    stale: baseline.filter((b) => !now.has(keyOf(b)) && !dangling.has(keyOf(b))),
  };
}

if (import.meta.main) {
  const found = analyse();
  const count = (v: BindingVerdict) => found.filter((b) => b.verdict === v).length;
  const { regressions, stale } = ratchet(found, BASELINE);
  console.log(`process bindings — ${found.length} skill refs in ${new Set(found.map((b) => b.file)).size} diagrams`);
  console.log(`  allowed ${count("allowed")} · wrong-direction ${count("wrong-direction")} (baseline ${BASELINE.length})`);
  console.log(`  dangling ${count("dangling")} (check:workflow-refs' finding, not graded here)`);
  if (count("undetermined") > 0) {
    const from = [...new Set(found.filter((b) => b.verdict === "undetermined").map((b) => b.fromInstance))];
    console.log(`  COULD NOT DETERMINE ${count("undetermined")}: ${from.join(", ")} declare(s) no needs`);
  }
  if (process.argv.includes("--shrink")) {
    const path = join(TOOLS_ROOT, "scripts", "process-bindings.baseline.ts"); // stayed in cat-harness (70lx B2)
    const src = readFileSync(path, "utf-8");
    const kept = BASELINE.filter((b) => !stale.includes(b));
    writeFileSync(path, `${src.slice(0, src.indexOf("export const BASELINE"))}export const BASELINE: readonly BindingBaselineEntry[] = ${JSON.stringify(kept, null, 2)};\n`);
    console.log(`  baseline shrunk: ${stale.length} dropped`);
  } else {
    for (const s of stale) console.log(`  STALE BASELINE  ${s.file} ${s.node} → ${s.ref} — run with --shrink`);
  }
  for (const r of regressions) {
    console.log(`  NEW  ${r.file} ${r.node} binds "${r.ref}", held only by ${r.holders.join(", ")} — not reachable from ${r.fromInstance}`);
  }
  const failed = regressions.length > 0 || (!process.argv.includes("--shrink") && stale.length > 0);
  if (failed) {
    console.log("\nA process binds only skills from its own instance or one it needs. Move the process up to the");
    console.log("instance that holds the skill, or move the skill down if it is generic (owner, 2026-10-03).");
  } else console.log("  ✓ no wrong-direction binding above baseline, and the baseline is tight");
  process.exit(failed ? 1 : 0);
}
