/**
 * depends-on.ts — `instance-versioning.md` §3.4's record, and the gaps it
 * cannot fill.
 *
 * `kg-export` emits, per publishable layer, `{packageId, version, uri}`
 * per dependency — the fields FHIR's `ImplementationGuide.dependsOn` carries,
 * so an external consumer reads this layer's dependency set as it reads a
 * FHIR IG's.
 *
 * ## A dependency that cannot be expressed is REPORTED, never dropped
 *
 * Most layers are not publishable (§3.1), so many edges point at something
 * with no `id` and no `version`. Emitting `dependsOn: []` would say the
 * layer depends on nothing; a partial record with an empty `version` would
 * fail a consumer. So each such edge becomes a {@link DependsOnGap} carrying
 * WHICH reason applies — `undecided` (nobody said) and `internal` (somebody
 * said no) are different gaps with different remedies.
 *
 * @graphNode schema
 * @module schemas/depends-on
 */

import { resolve } from "node:path";

import { layerRootsIn, readDeclaration, siblingScopeFor } from "./cat-harness";
import { dependenciesFromNeeds } from "./harness-config";

/**
 * One `ImplementationGuide.dependsOn` entry.
 *
 * Every field is required and none may be empty. A record exists only when all
 * three are known; anything less is a {@link DependsOnGap}.
 */
export interface DependsOnRecord {
  /** The dependency's `id` — reverse-DNS, the identity a consumer resolves. */
  packageId: string;
  /** Its exact `version`. Never a range, never a SHA (§3.3). */
  version: string;
  /** Its `canonicalUrl`, which plays FHIR's `uri` role (§3.2). */
  uri: string;
}

/**
 * Why an edge could not become a record.
 *
 * The four reasons are not interchangeable and the remedy differs for each,
 * which is the whole reason this is an enum rather than a boolean:
 *
 * | reason | what happened | remedy |
 * |---|---|---|
 * | `no-uri` | it has an id and a version but no `canonicalUrl`, so FHIR's `uri` role cannot be filled | declare a `canonicalUrl` |
 * | `unresolved` | the name matches no layer in this checkout | it is external, or the name is misspelled |
 * | `unreadable` | its declaration did not parse | fix the declaration |
 */
export type DependsOnGapReason = "no-uri" | "unresolved" | "unreadable";

export interface DependsOnGap {
  /** The dependency's declared name, which is all an unresolved edge has. */
  name: string;
  reason: DependsOnGapReason;
  detail: string;
}

export interface DependsOnExport {
  /** Emitted only when the exporting layer is itself publishable. */
  records: DependsOnRecord[];
  gaps: DependsOnGap[];
  /**
   * Why there are no records, when the answer is not "it has no dependencies".
   *
   * Present exactly when `records` is empty for a reason other than an empty
   * dependency set — the same contract `sourceCommitUnavailable` already has
   * in the export, and for the same reason: a consumer never has to infer why
   * a field is missing.
   */
  unavailable?: string;
}

const GAP_DETAIL: Record<DependsOnGapReason, string> = {
  "no-uri":
    "has an id and a version, but no `canonicalUrl` — §3.4's record is `{packageId, version, uri}` and `canonicalUrl` is what plays `uri`, so the record cannot be expressed. Not a publishability question any more: every instance carries an id and a version (`skills/kg/kg-core/instance-publication.md`)",
  unresolved:
    "matches no instance in this checkout — it is external to it, or the name is misspelled, and those are not the same",
  unreadable: "its declaration did not parse, so nothing about it is known — which is not the same as it having no record",
};

/**
 * Every dependency edge out of `instanceRoot`, by name.
 *
 * Read from `needs` via {@link dependenciesFromNeeds}, which is where the
 * stack is stated — *"`needs` states the stack, the config states what a name
 * cannot carry"*. A name it could not resolve comes back in `unresolved` and
 * becomes a gap here rather than vanishing.
 */
function edgesOf(instanceRoot: string): { names: string[]; unresolved: string[] } {
  const { dependencies, unresolved } = dependenciesFromNeeds(instanceRoot);
  return { names: dependencies.map((d) => d.name), unresolved };
}

/**
 * Build §3.4's record set for one layer.
 *
 * Returns `unavailable` rather than an empty `records` whenever the emptiness
 * means something other than "this instance depends on nothing".
 */
export function dependsOnFor(instanceRoot: string): DependsOnExport {
  const abs = resolve(instanceRoot);

  let self;
  try {
    self = readDeclaration(abs);
  } catch (error) {
    return { records: [], gaps: [], unavailable: `this instance's own declaration did not parse: ${String(error).slice(0, 160)}` };
  }
  if (self === undefined) {
    return { records: [], gaps: [], unavailable: "no declaration found at this instance root" };
  }

  // §3.4 USED TO BE withheld from any layer that had not declared
  // `publishable: true`. That gate is gone: the owner's ruling of 2026-09-23
  // gives every layer an id and a version, and puts them all in `draft`
  // (`skills/kg/kg-core/instance-publication.md`).
  //
  // What remains is a DIFFERENT obligation, and it is the one §3.4 actually
  // has: the record is `{packageId, version, uri}`, and `canonicalUrl` plays
  // `uri`. A layer without one cannot be EXPRESSED as a dependency, no
  // matter what state it is in. So the block is still withheld sometimes, and
  // the reason is now a fact about the record rather than about permission.
  if (self.canonicalUrl === undefined) {
    return {
      records: [],
      gaps: [],
      unavailable:
        "this instance declares no `canonicalUrl`, and §3.4's record is `{packageId, version, uri}` — " +
        "`canonicalUrl` is what plays `uri`, so the record cannot be expressed rather than being withheld on purpose",
    };
  }

  const { names, unresolved } = edgesOf(abs);
  const records: DependsOnRecord[] = [];
  const gaps: DependsOnGap[] = unresolved.map((name) => ({
    name,
    reason: "unresolved" as const,
    detail: GAP_DETAIL.unresolved,
  }));

  const byName = new Map<string, string>();
  // `siblingScopeFor`, not `repoRootFor` — see its docblock. This is a lookup
  // of siblings by name, and for the layer declared at the repository root
  // `dirname` looks outside the checkout and finds none of them.
  for (const root of layerRootsIn(siblingScopeFor(abs))) {
    try {
      const n = readDeclaration(root)?.name;
      if (n !== undefined) byName.set(n, root);
    } catch {
      // Unreadable siblings are caught below, per edge, where the name that
      // wanted them is known and can be named in the gap.
    }
  }

  for (const name of names) {
    const root = byName.get(name);
    if (root === undefined) {
      gaps.push({ name, reason: "unresolved", detail: GAP_DETAIL.unresolved });
      continue;
    }
    let dep;
    try {
      dep = readDeclaration(root);
    } catch {
      gaps.push({ name, reason: "unreadable", detail: GAP_DETAIL.unreadable });
      continue;
    }
    if (dep === undefined) {
      gaps.push({ name, reason: "unreadable", detail: GAP_DETAIL.unreadable });
      continue;
    }
    if (dep.canonicalUrl === undefined) {
      gaps.push({ name, reason: "no-uri", detail: GAP_DETAIL["no-uri"] });
      continue;
    }
    // The schema refuses `publishable: true` without all three, so reaching
    // here with one missing means the declaration bypassed it. Treated as a
    // gap rather than trusted into a record with an empty field: a consumer
    // resolving `""` fails at a distance from the cause.
    if (dep.id === undefined || dep.version === undefined || dep.canonicalUrl === undefined) {
      gaps.push({
        name,
        reason: "unreadable",
        detail:
          "declares `publishable: true` but is missing id, version or canonicalUrl — the schema refuses this, so the declaration was not validated",
      });
      continue;
    }
    records.push({ packageId: dep.id, version: dep.version, uri: dep.canonicalUrl });
  }

  if (records.length === 0) {
    return {
      records,
      gaps,
      unavailable:
        gaps.length === 0
          ? undefined // genuinely depends on nothing — a determined empty
          : `${gaps.length} dependency edge(s), none expressible as a record — see gaps`,
    };
  }
  return { records, gaps };
}
