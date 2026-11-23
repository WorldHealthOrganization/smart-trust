#!/usr/bin/env bun
/**
 * check:instance-graph — every layer's dependency graph resolves: no
 * missing dependency, no cycle.
 *
 * At runtime a missing dependency WARNS and the overlay continues without
 * that layer, because an uncloned git-URL dependency in a partial checkout
 * looks exactly like one. This is where it fails: in CI the checkout is
 * whole, so a dependency missing here is misspelled or gone.
 *
 * A cycle already throws at runtime (`orderedDependencies`); it is reported
 * here as well, so one run names every broken layer rather than the first.
 *
 * ## Declared, and identified
 *
 * - **Every layer DECLARES `needs`.** Absent is undetermined, and at
 *   runtime it stays a legal third state (`resolution-across-needs.test.ts`
 *   proves what it reports), but in this repository it is a finding. `[]`
 *   declares the floor and is fine.
 * - **Every layer has an absolute harness IRI, and no two share one.** The
 *   IRI is `kg-export`'s own `exportIdentity(...).canonicalIri`, called rather
 *   than re-derived, so this gate and the published `@id` cannot disagree.
 *
 * @covers cat-harness
 */
import { relative, resolve } from "node:path";

import { layerRootsIn, readDeclaration } from "../schemas/kg/cat-harness.js";
import {
  orderedDependencies,
  repositoryMirrors,
  resolveInstanceGraph,
  type InstanceGraphProblem,
} from "../schemas/kg/harness-config.js";

/** The declaration-level findings this gate adds to the graph's own (#1548). */
export type DeclarationProblem =
  | { kind: "undeclared-needs"; detail: string }
  | { kind: "no-iri"; detail: string }
  | { kind: "duplicate-iri"; detail: string }
  /**
   * The checkout's root layer does not reach a layer the checkout
   * stages (placement PR0a, cmsl option A: "the checkout aggregates"). A
   * corpus-wide tool resolves over the root's overlay, so an unreached
   * layer is invisible to every one of them — the `dh4f` shape at the
   * scale of a whole layer.
   */
  | { kind: "unstaged"; detail: string }
  /**
   * A NON-root layer declaring a `scope: "repository"` entry — a mirror of
   * another layer's directory or of checkout-level state. Retired by the
   * same ruling: only the layer whose root IS the checkout declares at the
   * checkout's scope, so the platform never names a dependent again.
   */
  | { kind: "repository-mirror"; detail: string };

export interface InstanceGraphReport {
  instances: number;
  problems: Array<{ instance: string; problem: InstanceGraphProblem | DeclarationProblem }>;
  /** Each layer's harness IRI, when one could be derived. */
  iris: Record<string, string>;
}

/** Resolves a layer root to its canonical harness IRI, or `undefined`. */
export type IriOf = (root: string) => string | undefined;

/** The exporter's own answer, loaded lazily: `kg-export` is a large module. */
async function exporterIri(): Promise<IriOf> {
  const { exportIdentity } = await import("./kg-export.js");
  return (root) => exportIdentity({ instanceRoot: root }).canonicalIri;
}

export function collect(repoRoot: string, iriOf?: IriOf): InstanceGraphReport {
  const roots = layerRootsIn(repoRoot);
  const seen = new Set<string>();
  const problems: InstanceGraphReport["problems"] = [];
  const iris: Record<string, string> = {};
  const byIri = new Map<string, string>();
  for (const root of roots) {
    const name = relative(repoRoot, root) || ".";
    let needs: string[] | undefined;
    try {
      needs = readDeclaration(root)?.needs;
    } catch {
      needs = undefined; // an unreadable declaration has declared nothing
    }
    if (needs === undefined) {
      problems.push({
        instance: name,
        problem: { kind: "undeclared-needs", detail: `${name} declares no \`needs\`; write the layers it is built on, or [] for the floor` },
      });
    }
    if (!iriOf) continue;
    const iri = iriOf(root);
    if (!iri || !/^https?:\/\//.test(iri)) {
      problems.push({
        instance: name,
        problem: { kind: "no-iri", detail: `${name} has no absolute harness IRI (${iri ?? "none"}): declare a canonicalUrl, or publish it from an instance that does` },
      });
      continue;
    }
    iris[name] = iri;
    const other = byIri.get(iri);
    if (other) {
      problems.push({ instance: name, problem: { kind: "duplicate-iri", detail: `${name} and ${other} share the IRI ${iri}` } });
    } else byIri.set(iri, name);
  }
  // THE CHECKOUT AGGREGATES. Only where the repository root is itself a
  // layer: a checkout of a lone layer has no aggregator to hold to it.
  const checkout = resolve(repoRoot);
  if (roots.some((r) => resolve(r) === checkout)) {
    let reached = new Set<string>();
    try {
      reached = new Set(orderedDependencies(checkout).map((d) => resolve(d.rootPath)));
    } catch {
      // a cycle is reported below by `resolveInstanceGraph`
    }
    for (const root of roots) {
      const abs = resolve(root);
      if (abs === checkout || reached.has(abs)) continue;
      const name = relative(repoRoot, root);
      problems.push({
        instance: ".",
        problem: {
          kind: "unstaged",
          detail: `the checkout's root instance does not reach ${name}: add it to the root declaration's \`needs\`, or every corpus-wide tool resolves without it`,
        },
      });
    }
  }
  for (const mirror of repositoryMirrors(repoRoot)) {
    problems.push({
      instance: mirror.split("#")[0]!,
      problem: {
        kind: "repository-mirror",
        detail: `${mirror} is declared with \`scope: "repository"\` by an instance that is not the checkout's root. Its owner declares it (from within, if it is nested); checkout-level state is declared by the root instance; corpus-wide tools read \`corpusDirectoriesForGraph\`.`,
      },
    });
  }
  for (const root of roots) {
    for (const problem of resolveInstanceGraph(root).problems) {
      // A layer's broken edge is reached again from every dependent; say it once.
      const key = `${problem.kind}:${problem.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push({ instance: relative(repoRoot, root) || ".", problem });
    }
  }
  return { instances: roots.length, problems, iris };
}

export function isClean(r: InstanceGraphReport): boolean {
  return r.instances > 0 && r.problems.length === 0;
}

export function formatReport(r: InstanceGraphReport): string {
  if (r.instances === 0) return "NOTHING WAS EXAMINED — no instance declaration was read. That is not a pass.";
  if (r.problems.length === 0) {
    const named = Object.keys(r.iris).length;
    return `✓ ${r.instances} instance(s): every one declares \`needs\`, every dependency resolves, no cycle` +
      (named ? `; ${named} distinct harness IRI(s)` : "");
  }
  return [
    `✗ ${r.problems.length} dependency problem(s) across ${r.instances} instance(s):`,
    ...r.problems.map((p) => `    ${p.problem.kind}  (from ${p.instance})  ${p.problem.detail}`),
  ].join("\n");
}

if (import.meta.main) {
  const report = collect(process.cwd(), await exporterIri());
  (isClean(report) ? console.log : console.error)(formatReport(report));
  process.exit(isClean(report) ? 0 : 1);
}
