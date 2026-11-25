/**
 * Is the site's landing a layer this checkout MOUNTS rather than owns?
 *
 * @module scripts/lib/mounted-landing
 * @graphNode none — one predicate shared by the landing writers' `--check`
 *
 * cat-harness-tools#1701. smart-ips-pilgrimage's `index.config.json` names
 * `site.landing` as a lock-mounted base layer, so `landing:data:check`
 * compared that layer's `docs/_data/stickies.json` — inside a mount, in a
 * directory (its built pages) that is BUILT, not committed —
 * and called it stale. The root cannot commit into a mount, so that file is
 * not this checkout's to judge.
 *
 * Determined only when all hold: the checkout root declares an instance of
 * its own, the landing is a different instance, and `index.lock.json` mounts
 * it. The platform index's root declares nothing, so there every landing is
 * still checked; so is a root whose landing is itself.
 */
import { gateOwnInstances } from "./gate-own.ts";
import { mountedInstances } from "./layer-output.ts";
import { declaredInstanceName } from "./roots.ts";

/** Why `landing` is not this checkout's to check, or `undefined` when it is. */
export function landingMountedNotOwned(checkout: string, landing: string | undefined): string | undefined {
  if (landing === undefined) return undefined;
  const self = declaredInstanceName(checkout);
  if (self === undefined || self === landing) return undefined;
  let mounts: Map<string, string>;
  try {
    mounts = mountedInstances(checkout);
  } catch {
    // An unreadable lock determines nothing: judge as before.
    return undefined;
  }
  const at = mounts.get(landing);
  if (at === undefined) return undefined;
  return `the site's landing is \`${landing}\`, mounted at \`${at}/\` from index.lock.json, and this root (\`${self}\`) does not own or commit that layer's files`;
}

/**
 * Why `landing` is not this GATE RUN's to check, or `undefined` when it is:
 * the run names its caller's own layers (`CAT_GATE_OWN_INSTANCES`,
 * `gate-own.ts`) and the landing is not among them.
 *
 * A FHIR IG judged with no base (2026-11-19). In layer mode the PR checks
 * compose the platform index, whose `site.landing` is one of its own layers,
 * and mount the caller inside it. The gate then compared that layer's
 * committed `stickies.json` with what this tools pin generates and failed
 * every PR of the caller, though the caller declares no sticky and commits
 * nothing there. A layer's committed files are judged by its own CI (owner
 * ruling 2026-11-05, "Move the checks"). Unset (a local run, the index's own gates), judged as before.
 */
export function landingNotTheCallers(
  landing: string | undefined,
  // input-site: env CAT_GATE_OWN_INSTANCES #949cc29c — passed to gateOwnInstances; the value is the whole of what it contributes
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  if (landing === undefined) return undefined;
  const own = gateOwnInstances(env);
  if (own === undefined || own.has(landing)) return undefined;
  return `the site's landing is \`${landing}\`, and this run judges only ${[...own].join(", ")} (CAT_GATE_OWN_INSTANCES): that layer's committed stickies.json is judged by its own CI`;
}
