/**
 * The capability registry `actor-capabilities-resolve` judges an actor's
 * `capabilities` against, read over the SAME layers the actors were.
 *
 * @module scripts/lib/actor-capabilities
 *
 * `kg-audit` reads its actors three ways: on the platform's own run the
 * checkout overlay (`checkoutActors` — every layer above adds actors), on an
 * `--instance` run the platform's registry plus every layer it needs and its
 * own (`neededActors`), and otherwise the platform's registry alone. The
 * capabilities were read from the platform's `scenarios/capabilities/` alone in
 * every case. So an actor a higher layer declares, claiming a capability
 * that same layer declares beside it, was judged against a registry that
 * could not hold the capability: the science layer's `lean-mcp` claims
 * `lean-toolchain`, which that layer's own `scenarios/capabilities/`
 * declares, and the platform's run reported it CRITICAL. The rule is the one
 * the actors already follow: resolution reads the layers the subject came from.
 */
import { join, relative, resolve } from "node:path";

import { CAPABILITIES_DIRNAME } from "../../schemas/process/role-graph.js";
import {
  checkoutCapabilities,
  overlayCapabilities,
  scenarioLayersBelow,
} from "../../schemas/process/scenario-overlay.js";
import type { KgFinding } from "../../schemas/sdlc/kg-qa.js";

/** Which layers the actors were read over, as `kg-audit` chose for them. */
export type ActorScope = "checkout" | "needed" | "own";

/**
 * The capability ids an actor read over `scope` may claim.
 *
 * - `checkout` — the platform's registry overlaid by every layer above
 *   `root` (`checkoutCapabilities`), as `checkoutActors`.
 * - `needed` — the platform's registry overlaid by every layer `root` needs
 *   and its own, the platform's own layer not read twice, as `neededActors`.
 * - `own` — `capabilityDir` alone.
 *
 * `capabilityDir` is the platform's `scenarios/capabilities/`, or `""` when
 * there is no declared home; an absent directory contributes nothing.
 */
export function declaredCapabilityIds(root: string, capabilityDir: string, scope: ActorScope): Set<string> {
  const records =
    scope === "checkout"
      ? checkoutCapabilities(root, capabilityDir)
      : scope === "needed"
        ? overlayCapabilities(
            capabilityDir,
            scenarioLayersBelow(root)
              .filter((l) => !capabilityDir || l.dir !== resolve(capabilityDir, ".."))
              .map((l) => ({ instance: l.instance, dir: join(l.dir, CAPABILITIES_DIRNAME) })),
          )
        : overlayCapabilities(capabilityDir, []);
  return new Set(records.map((c) => c.id));
}

/** `actor-capabilities-resolve`: every claimed capability the registry does not declare. */
export function unresolvedActorCapabilities(
  root: string,
  actors: ReadonlyArray<{ id: string; path: string; capabilities?: readonly string[] }>,
  capabilities: ReadonlySet<string>,
): KgFinding[] {
  return actors.flatMap((a) =>
    (a.capabilities ?? [])
      .filter((c) => !capabilities.has(c))
      .map((c) => ({
        where: a.id,
        detail: `${relative(root, a.path)} claims capability "${c}", which the registry does not declare.`,
      })),
  );
}
