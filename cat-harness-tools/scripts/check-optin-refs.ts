#!/usr/bin/env bun
/**
 * No always-on Tool or workflow names a skill that lives only in an opt-in
 * sub-graph.
 *
 * @module scripts/check-optin-refs
 * @covers tools, processes, skills — every layer in the checkout
 *
 * The same defect as `check:optin-links`, for references that are not
 * Markdown links: a Tool's `satisfies` and a BPMN `<…:skill ref="…"/>`. An
 * opt-in sub-graph (`opt-in-subgraphs.ts`) is left out of every downstream
 * that has not switched it on, and the layer that declares it switches it on
 * for itself, so the reference resolves upstream and dangles in each
 * consumer: `check:tools` and `check:workflow-refs` find it there, in a
 * repository that cannot fix it (smart-ra#242).
 *
 * The owner, 2026-11-11 (card "Fix links into switched-off groups how?",
 * option B): such a reference is a defect, fixed by hand — move the Tool or
 * diagram into the group, or the skill out of it. This reports it where it is
 * written, and never rewrites.
 *
 * ## The rule
 *
 * A reference is a finding when the skill it names exists in the checkout
 * ONLY inside opt-in sub-graphs, and none of them is the one the referring
 * file sits in or one that sub-graph `requires` (transitively: a
 * requirement is implied, so it is on wherever the referring file is;
 * owner, 2026-11-13). A skill also held outside every opt-in sub-graph, and a name
 * no layer holds (`check:tools` / `check:workflow-refs` report that), are
 * not findings here.
 *
 * Read: the Tools of every layer's always-on `tools` graph, and every
 * workflow file each layer resolves. Not read: a Tool inside an opt-in
 * sub-graph (it is switched off with the group it names).
 *
 * GATED: composed into `check:declaration-resolution` as its `optInRefs`
 * field, which CI runs (owner, 2026-11-12, card Q-OPTINREFS-CI B: wire it
 * now and fix every finding at its source), as `check:optin-links` is.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-optin-refs.ts [--json]
 *
 * Exit 0 no such reference · 1 at least one · 2 no layer found.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { layerRootsIn } from "../schemas/kg/cat-harness.js";
import { groupOf, optInRootsOf, type OptInRoot } from "../schemas/kg/opt-in-roots.js";
import { declaredOptInRequires, requiredBy, type OptInRequires } from "../schemas/kg/opt-in-subgraphs.js";
import { discoverTools } from "../tools/discover.js";
import { isSkillMd, skillMdDirs, workflowFiles } from "./known-skills.js";

export interface OptInRefFinding {
  /** `tool:<id>`, or the checkout-relative path of the workflow file. */
  from: string;
  kind: "satisfies" | "workflow";
  /** The skill reference as written. */
  ref: string;
  /** The opt-in sub-graphs holding the skill, qualified. */
  groups: string[];
}

/** Where each skill name is held: inside which opt-in sub-graphs, and whether anywhere outside one. */
export type SkillHomes = Map<string, { groups: Set<string>; alwaysOn: boolean }>;

/** Every skill file of `layers`, by name, placed against `roots`. */
export function skillHomes(layers: readonly string[], roots: readonly OptInRoot[]): SkillHomes {
  const out: SkillHomes = new Map();
  for (const layer of layers) {
    let dirs: string[][];
    try {
      dirs = skillMdDirs(layer);
    } catch {
      continue; // an unreadable declaration is `check:harness-dirs`' finding
    }
    for (const parts of dirs) {
      const dir = join(layer, ...parts);
      let names: string[];
      try {
        names = readdirSync(dir);
      } catch {
        continue;
      }
      for (const f of names) {
        const abs = join(dir, f);
        if (!f.endsWith(".md") || !isSkillMd(abs)) continue;
        const home = out.get(f.slice(0, -3)) ?? { groups: new Set<string>(), alwaysOn: false };
        const g = groupOf(abs, roots);
        if (g === undefined) home.alwaysOn = true;
        else home.groups.add(g.id);
        out.set(f.slice(0, -3), home);
      }
    }
  }
  return out;
}

/**
 * The opt-in sub-graphs `ref` resolves into from a file in `own`; empty when
 * it is not a finding. A skill held in `own`, or in a sub-graph `own`
 * requires, is on wherever `own` is.
 */
export function optInOnly(ref: string, homes: SkillHomes, own: string | undefined, requires: OptInRequires = new Map()): string[] {
  const name = ref.includes("/") ? ref.slice(ref.indexOf("/") + 1) : ref;
  const home = homes.get(name);
  if (home === undefined || home.alwaysOn || home.groups.size === 0) return [];
  if (own !== undefined) {
    const on = requiredBy(own, requires).add(own);
    if ([...home.groups].some((g) => on.has(g))) return [];
  }
  return [...home.groups].sort();
}

const SKILL_REF = /<[\w.-]*:?skill\b[^>]*?\bref="([^"]+)"/g;

/** The skill refs a workflow file's text names. */
export function workflowSkillRefs(text: string): string[] {
  return [...text.matchAll(SKILL_REF)].map((m) => m[1]!);
}

export function checkOptInRefs(checkout: string): { layers: number; tools: number; workflows: number; findings: OptInRefFinding[] } {
  const layers = layerRootsIn(checkout);
  const roots = layers.flatMap(optInRootsOf);
  const homes = skillHomes(layers, roots);
  const requires = declaredOptInRequires(checkout);
  const findings: OptInRefFinding[] = [];

  // Always-on Tools only: with nothing switched on, a `tools` graph inside an
  // opt-in sub-graph is not loaded.
  const discovered = discoverTools(checkout, undefined, undefined, { enabledSubgraphs: new Set() });
  for (const t of discovered.tools) {
    for (const ref of t.satisfies) {
      const groups = optInOnly(ref, homes, undefined);
      if (groups.length) findings.push({ from: `tool:${t.id}`, kind: "satisfies", ref, groups });
    }
  }

  const files = [...new Set(layers.flatMap((l) => {
    try {
      return workflowFiles(l);
    } catch {
      return [];
    }
  }))].sort();
  for (const abs of files) {
    const own = groupOf(abs, roots)?.id;
    for (const ref of new Set(workflowSkillRefs(readFileSync(abs, "utf-8")))) {
      const groups = optInOnly(ref, homes, own, requires);
      if (groups.length) findings.push({ from: relative(checkout, abs).split(sep).join("/"), kind: "workflow", ref, groups });
    }
  }
  return { layers: layers.length, tools: discovered.tools.length, workflows: files.length, findings };
}

function main(argv: readonly string[]): number {
  const r = checkOptInRefs(process.cwd());
  if (argv.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    for (const f of r.findings) console.log(`  ✗ ${f.from} → ${f.ref} (${f.kind}; only in opt-in ${f.groups.join(", ")})`);
    console.log(
      r.layers === 0
        ? "? no layer declaration in this checkout — not a pass"
        : r.findings.length === 0
          ? `✓ no always-on Tool or workflow names an opt-in-only skill (${r.tools} Tool(s), ${r.workflows} workflow file(s), ${r.layers} layer(s))`
          : `✗ ${r.findings.length} reference(s) to a skill only an opt-in sub-graph holds, dangling wherever it is switched off — fix each by hand (owner, 2026-11-11)`,
    );
  }
  return r.layers === 0 ? 2 : r.findings.length > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
