/**
 * **Network reach is a property of an ACTOR**, and how it composes with the
 * deployment's. An air-gapped actor cannot use an API, so a process such as
 * signing needs a route through a human actor.
 *
 * ## One vocabulary, two levels
 *
 * {@link NetworkReach} is the deployment's scale ({@link Topology.network} in
 * `cat-harness.ts`); this module reuses it for actors rather than minting a
 * second one. The two levels mean different things:
 *
 * | level | what the value asserts |
 * |---|---|
 * | deployment | an **aggregate** over the machine actors in it |
 * | actor | what **this** participant can reach |
 *
 * This matches `topologyConflicts`: *"At deployment level `mixed` MEANS THE
 * ACTORS DIFFER FROM EACH OTHER."*
 *
 * ## The composition is ASYMMETRIC
 *
 * - **air-gapped deployment ⟹ every actor air-gapped.** Nothing inside can
 *   reach out; the bound is total.
 * - **internet deployment ⇏ every actor connected.** A connected site may
 *   still hold an isolated signing host.
 * - **egress-restricted deployment ⇏ anything about a given actor.** It says
 *   *some* egress is restricted, not which participant's.
 *
 * So an undeclared actor under a non-air-gapped deployment is
 * {@link REACH_UNKNOWN} — **not** the deployment's value.
 *
 * ## `unknown` is the third state, and it is never "reachable"
 *
 * Every consumer must route `unknown` the way it routes `air-gapped`: to the
 * path that needs no network; otherwise a signing gateway could produce an
 * unsigned report that looks signed ("could not check is never green").
 *
 * ## What this module does NOT do
 *
 * It does not choose a route. The branch is computed by
 * `sdlc/processes/decisions/signing-route.dmn` and executed by the gateway
 * in `qa-report-signing.bpmn`; this module supplies the **fact** the table
 * reads.
 *
 * @graphNode schema
 * @module folio-assistant/schemas/actor-reach
 */

import { z } from "zod";
import { NETWORK_REACHES, type NetworkReach } from "../kg/cat-harness.js";

export { NETWORK_REACHES, type NetworkReach };

/**
 * The value meaning **nothing is declared**, distinct from every reach.
 *
 * A string rather than `undefined` because it crosses into a DMN table as an
 * input fact, and a table cannot match on absence. It is spelled out so a
 * rule for it must be written deliberately: see `signing-route.dmn`, where
 * the unknown row exists and routes to the human lane.
 */
export const REACH_UNKNOWN = "unknown" as const;
export type ReachUnknown = typeof REACH_UNKNOWN;

/** A reach fact as a consumer receives it — declared, or admittedly not. */
export type EffectiveReach = NetworkReach | ReachUnknown;

export const ActorReachSchema = z.enum(NETWORK_REACHES);

/**
 * How much the wire allows, most to least. Used for the bound check only —
 * it is an ordering of *permissiveness*, not of preference.
 */
const PERMISSIVENESS: Record<NetworkReach, number> = {
  internet: 2,
  "egress-restricted": 1,
  "air-gapped": 0,
};

/** Whether a reach admits any call off the machine at all. */
export function canReachOut(reach: EffectiveReach): boolean {
  return reach === "internet" || reach === "egress-restricted";
}

/**
 * The reach a consumer should act on, from what the two levels declare.
 *
 * See §"The composition is ASYMMETRIC" above for why the deployment value is
 * inherited downward in exactly one case.
 */
export function effectiveReach(
  deployment: NetworkReach | undefined,
  actor: NetworkReach | undefined,
): EffectiveReach {
  if (actor && deployment) {
    return PERMISSIVENESS[actor] <= PERMISSIVENESS[deployment] ? actor : deployment;
  }
  if (actor) return actor;
  // An aggregate determines a member only when it admits one value.
  if (deployment === "air-gapped") return "air-gapped";
  return REACH_UNKNOWN;
}

/** An actor claiming reach its deployment cannot grant. */
export interface ReachConflict {
  actorId: string;
  actor: NetworkReach;
  deployment: NetworkReach;
  reason: string;
}

/**
 * Whether an actor's declared reach exceeds what its deployment declares.
 *
 * Only this direction is a conflict. An air-gapped actor inside a connected
 * deployment is the normal case — it is the case the owner raised — and
 * reporting it would make the finding list useless on the day it matters.
 */
export function reachConflict(
  actorId: string,
  deployment: NetworkReach | undefined,
  actor: NetworkReach | undefined,
): ReachConflict | undefined {
  if (!deployment || !actor) return undefined;
  if (PERMISSIVENESS[actor] <= PERMISSIVENESS[deployment]) return undefined;
  return {
    actorId,
    actor,
    deployment,
    reason:
      `actor declares reach "${actor}" inside a deployment declaring ` +
      `"${deployment}". The deployment BOUNDS what any participant can do; ` +
      `an actor cannot reach further than the site it runs in.`,
  };
}
