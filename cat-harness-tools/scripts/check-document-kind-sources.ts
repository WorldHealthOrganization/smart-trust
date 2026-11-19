#!/usr/bin/env bun
/**
 * check:document-kind-sources — a section's `computedFrom` names a graph its
 * layer can actually reach.
 *
 * `computedFrom` is how a document kind says *"this section is computable from
 * these assets"* (`schemas/content/document-kind.ts`). It names DECLARED
 * graph ids so a reader can ask whether the graph exists; this asks. A typo,
 * a renamed directory, or a graph never declared would otherwise read as a
 * computable claim.
 *
 * An id resolves when it is a directory id declared by the kind's own layer
 * or by a layer it `needs`, transitively — the same `allowedFromNeeds`
 * direction `check:import-direction` and `check:process-bindings` use, because
 * a layer inherits its dependencies' directories and nothing above it.
 *
 * Name what is not yet a graph rather than fake one: a section whose content
 * needs evidence nobody has ingested says so in its description and carries
 * NO `computedFrom`.
 *
 * @module cat-harness/scripts/check-document-kind-sources
 * @covers document-kinds
 */
import { resolve } from "node:path";

import { resolveDirectories } from "../schemas/kg/cat-harness.ts";
import { ancestorsOf, flattenDependencies } from "../schemas/kg/dependency-order.js";
import { allowedFromNeeds } from "../schemas/kg/layer-direction.js";
import { readInstances } from "./check-import-direction.ts";
import { readDocumentKinds } from "./gen-document-kinds-viz.ts";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

export interface SourceProblem {
  file: string;
  kind: string;
  section: string;
  id: string;
  /** The ids that would have resolved, so the message says what is reachable. */
  reachable: string[];
}

/** Every graph id each layer can name: its own declared ids plus those of everything it needs. */
export function reachableGraphIds(repoRoot = REPO_ROOT): Map<string, Set<string>> {
  const all = readInstances(repoRoot);
  const byName = new Map(all.map((i) => [i.name, i]));
  const flat = flattenDependencies(
    all.map((i) => ({ id: i.name, needs: (i.needs ?? []).filter((n) => byName.has(n)), fatal: false })),
  );
  if (flat.problems.length > 0) {
    throw new Error(`check:document-kind-sources: the instance needs graph is broken — ${flat.problems.map((p) => p.detail).join("; ")}`);
  }
  const allowed = allowedFromNeeds(new Map(all.map((i) => [i.name, i.needs ?? []])), ancestorsOf(flat.order));
  const own = new Map(
    all.map((i) => [i.name, new Set(resolveDirectories([{ name: i.name, root: i.root, own: true }]).filter((d) => d.own).map((d) => d.id))]),
  );
  const out = new Map<string, Set<string>>();
  for (const i of all) {
    const ids = new Set<string>();
    for (const layer of allowed.get(i.name) ?? [i.name]) for (const id of own.get(layer) ?? []) ids.add(id);
    out.set(i.name, ids);
  }
  return out;
}

/** Judge kinds against what each layer can reach; pure, so a planted violation can be tested. */
export function judge(
  kinds: readonly { instance: string; file: string; kind: { id: string; sections: readonly { id: string; computedFrom?: readonly string[] }[] } }[],
  reach: ReadonlyMap<string, ReadonlySet<string>>,
): { problems: SourceProblem[]; claims: number } {
  const problems: SourceProblem[] = [];
  let claims = 0;
  for (const { instance, file, kind } of kinds) {
    const ids = reach.get(instance) ?? new Set<string>();
    for (const s of kind.sections) {
      for (const id of s.computedFrom ?? []) {
        claims++;
        if (!ids.has(id)) problems.push({ file, kind: kind.id, section: s.id, id, reachable: [...ids].sort() });
      }
    }
  }
  return { problems, claims };
}

export function check(repoRoot = REPO_ROOT): { problems: SourceProblem[]; claims: number } {
  return judge(readDocumentKinds(repoRoot).kinds, reachableGraphIds(repoRoot));
}

if (import.meta.main) {
  const { problems, claims } = check();
  for (const p of problems) {
    console.log(`  ✗ ${p.file}: ${p.kind} § ${p.section} is computedFrom "${p.id}", which its instance does not declare or inherit`);
  }
  if (problems.length > 0) {
    console.log(`\n${problems.length} of ${claims} computedFrom claim(s) name no reachable graph.`);
    console.log("Name a declared graph id, or drop the claim and say in the description what the section waits on.");
    process.exit(1);
  }
  console.log(`✓ all ${claims} computedFrom claim(s) name a graph their instance declares or inherits`);
}
