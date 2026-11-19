#!/usr/bin/env bun
/**
 * Actor reach — is every declaration consistent with the site it runs in, and
 * does anything declare it at all?
 *
 * `reach` is what the signing gateway branches on, so two failure modes are
 * kept apart:
 *
 * 1. **A conflict** — an actor claiming more reach than its deployment
 *    declares. That is a declaration error and fails the check.
 * 2. **Nothing declared** — the third state. It does NOT fail: undeclared
 *    reach resolves to `unknown`, which routes to the human signer, a safe
 *    outcome. But it is REPORTED, since nothing declared means the human
 *    route every time.
 *
 * `--require-declaration` turns state 2 into a failure, for a deployment that
 * means to exercise the API route and wants to be told it never will.
 *
 * @module folio-assistant/scripts/check-actor-reach
 * @covers scenarios
 */

import {
  effectiveReach,
  reachConflict,
  type NetworkReach,
  type ReachConflict,
} from "../schemas/process/actor-reach.ts";
import { type LoadedActor } from "../schemas/process/role-graph.ts";
import { findInstanceRoot, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.ts";
import { actorsDir } from "../schemas/process/role-graph.ts";
import { checkoutActors } from "../schemas/process/scenario-overlay.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";

// THE REPOSITORY root, asked for rather than taken from the working directory.
// `.claude/` is agent-tool configuration at the top of the checkout, not a
// declared knowledge-graph directory, so there is no declaration to read it
// from — the same literal `kg-audit.ts` uses. It arrived from main as
// `process.cwd()`, which was a claim about where a gate happened to be invoked
// and was true only while the layer and the repository were one directory.
// Here it named `cat-harness/.claude/`, and `readActors` over a directory that
// is not there returns `[]` — so the check reported "EXAMINED NOTHING" over 27
// actors that were sitting one level up.
const root = repoRootFor(HARNESS_ROOT);
const ACTOR_DIR = actorsDir(root) ?? (() => { throw new Error("the platform declares no `scenarios` graph, so the actor registry (bean rqao) has no home to read"); })();

export interface ReachReport {
  actors: LoadedActor[];
  /** The site-level value, or undefined when the declaration is silent. */
  deployment: NetworkReach | undefined;
  declared: { id: string; reach: string; effective: string }[];
  undeclared: { id: string; effective: string }[];
  conflicts: ReachConflict[];
}

export function buildReport(actorDir: string, instanceRoot: string): ReachReport {
  const decl = readDeclaration(instanceRoot);
  const deployment = decl?.topology?.network;
  // The checkout's registry: the platform's actors plus a dependent's
  // extension or new actor (placement PR0b). Identical while none exists.
  // Overlaid on the layer that HOLDS the registry, which is the platform.
  const actors = checkoutActors(findInstanceRoot(actorDir) ?? instanceRoot, actorDir);
  const declared: ReachReport["declared"] = [];
  const undeclared: ReachReport["undeclared"] = [];
  const conflicts: ReachConflict[] = [];
  for (const a of actors) {
    const eff = effectiveReach(deployment, a.reach);
    if (a.reach) declared.push({ id: a.id, reach: a.reach, effective: eff });
    else undeclared.push({ id: a.id, effective: eff });
    const c = reachConflict(a.id, deployment, a.reach);
    if (c) conflicts.push(c);
  }
  return { actors, deployment, declared, undeclared, conflicts };
}

function main(): number {
  const requireDeclaration = process.argv.includes("--require-declaration");
  const r = buildReport(ACTOR_DIR, root);

  if (r.actors.length === 0) {
    // A check that examined nothing has not passed. Saying so is the whole
    // guard: the alternative prints a tick over an empty directory.
    console.log(`⚠ EXAMINED NOTHING — no actors found under ${ACTOR_DIR}`);
    return 1;
  }

  console.log(
    `deployment network: ${r.deployment ?? "(undeclared)"} · ` +
      `${r.actors.length} actor(s), ${r.declared.length} declaring reach`,
  );
  for (const d of r.declared) {
    const via = d.reach === d.effective ? "" : ` → ${d.effective} (bounded by the deployment)`;
    console.log(`  · ${d.id}: ${d.reach}${via}`);
  }

  if (r.conflicts.length > 0) {
    console.log(`\n✗ ${r.conflicts.length} actor(s) claim reach the deployment cannot grant:`);
    for (const c of r.conflicts) console.log(`  ✗ ${c.actorId}: ${c.reason}`);
    return 1;
  }

  if (r.declared.length === 0) {
    const msg =
      `no actor declares reach. Every one resolves to "unknown", so every ` +
      `reach-branching gateway takes its human route. That is SAFE and may ` +
      `be wrong: an API route that is never taken looks identical to one ` +
      `that works.`;
    if (requireDeclaration) {
      console.log(`\n✗ ${msg}`);
      return 1;
    }
    console.log(`\n⚠ ${msg}`);
    return 0;
  }

  console.log(`\n✓ no actor claims more reach than its deployment declares`);
  return 0;
}

if (import.meta.main) process.exit(main());
