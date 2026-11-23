/**
 * Where one criterion's checker lives — ONE answer, composed, never two.
 *
 * ## Why this is not a `??`
 *
 * `qa-checker-discovery.ts`'s own header records what went wrong the last time
 * two things answered this question: `qa-sweep` dispatched
 * `AUTOMATED_CHECKERS[id] ?? DAK_AUTOMATED_CHECKERS[id]`, and *"the dispatch
 * table was a second answer to a question the registry already answered, and
 * the two were free to disagree."*
 *
 * A contributed checker could easily be the same mistake wearing a registry's
 * clothes. It is not, because the two sources **partition**: core's
 * `QA_CRITERIA_REGISTRY` declares criteria whose checkers core owns, and a
 * dependency contributes checkers for criteria it owns. A criterion claimed by
 * both is not a fallback chain, it is a collision — so this **throws**, naming
 * both claimants, exactly as `ContributionRegistry.register` does for two
 * dependencies claiming one criterion. That is the difference between
 * composing two partitions and preferring one table over another.
 *
 * ## The trap on the other side
 *
 * `getCriterionSourceFile` ends in a **default** — an id it does not recognise
 * resolves to `qa-checkers-extended.ts`. That default is not harmless:
 * `script_hash` is computed over the resolved path, so a criterion pointed at
 * a file that does not contain its checker NEVER INVALIDATES; eleven criteria
 * were measured in that state on 2026-09-18.
 *
 * So a criterion whose checker moved OUT of core must not simply be dropped
 * from the cascade — it would land on that default. `QaCriterionDefinition`
 * carries {@link QaCriterionDefinition.checker_contributed} instead, and this
 * resolver refuses to answer from the cascade for such a criterion. An
 * unresolved one is reported as unresolved, which is a third state and not a
 * path.
 *
 * @module pipeline/criterion-source
 */

import type { ContributedChecker, ContributionRegistry } from "../schemas/content/contributions.ts";
import type { CheckerPaths, CheckerResult, QaCriterionDefinition } from "../schemas/sdlc/block-qa.ts";
import { implementingRootFor } from "../schemas/kg/harness-config.ts";
import { QA_CRITERIA_BY_ID, getCriterionSourceFile } from "./qa-criteria-registry";

/** A criterion's checker, located. */
export interface CriterionSource {
  /**
   * Absolute directory `sourceFile` is relative to: the layer that holds
   * the file, which for a core criterion is the declaring root or the one
   * layer implementing it (`implementingRootFor`).
   */
  root: string;
  /** The file defining the checker, relative to `root`. */
  sourceFile: string;
  /**
   * What a sidecar records as `source_file`. Equal to `sourceFile` for a
   * criterion core owns, and `<contributor>/<sourceFile>` for a contributed
   * one — portable across checkouts either way, and it says whose checker it
   * is without a second field to keep in step.
   */
  label: string;
  /** The checker itself, when a dependency supplied it. */
  contributed?: (paths: CheckerPaths) => CheckerResult;
}

/** Why a criterion's checker could not be located. */
export interface CriterionSourceMiss {
  criterion: string;
  reason: string;
}

export class CriterionSourceCollisionError extends Error {
  constructor(
    readonly criterion: string,
    readonly contributor: string,
  ) {
    super(
      `criterion "${criterion}" is claimed by BOTH core's registry (which declares ` +
        `a source_file for it) and the dependency "${contributor}". Two answers to ` +
        `"where is this checker" are two answers free to disagree; one of them has ` +
        `to stop claiming it.`,
    );
    this.name = "CriterionSourceCollisionError";
  }
}

/**
 * Locate one criterion's checker.
 *
 * `coreRoot` is where core's own repo-relative paths resolve. `registry` is
 * optional: a caller with no dependency tree loaded has one less place to
 * look, which is a different thing from there being nothing there — so a
 * criterion declared `checker_contributed` yields a miss that says so, rather
 * than falling through to a path.
 */
export function resolveCriterionSource(
  criterion: string,
  coreRoot: string,
  registry?: ContributionRegistry,
): CriterionSource | CriterionSourceMiss {
  const def: QaCriterionDefinition | undefined = QA_CRITERIA_BY_ID[criterion];
  const entry: ContributedChecker | undefined = registry?.qaCheckerEntry(criterion);

  if (entry && def?.source_file) {
    // Only a DECLARED source_file collides. The cascade's defaults are guesses
    // by construction, and a guess losing to a real contributor is resolution
    // rather than disagreement.
    throw new CriterionSourceCollisionError(criterion, labelContributor(entry.label));
  }

  if (entry) {
    return {
      root: entry.root,
      sourceFile: entry.sourceFile,
      label: entry.label,
      contributed: entry.check,
    };
  }

  if (def?.checker_contributed) {
    return {
      criterion,
      reason:
        `declared checker_contributed, so core does not own its checker — and no ` +
        `loaded dependency contributes one. Resolving it from the registry's ` +
        `default would point script_hash at a file that does not contain the ` +
        `checker, and a verdict that cannot go stale is worse than a missing one.`,
    };
  }

  // The recorded label stays the path as declared, and the BYTES are read from
  // the layer that implements it (owner ruling T7, 2026-10-01, bean `70lx`):
  // core's checkers move to the layer above while their sidecars stay here, and
  // a sidecar that had to name that layer would be the harness naming upward.
  // So `source_file` is unchanged and only the root it is read against moves.
  const sourceFile = getCriterionSourceFile(criterion);
  return { root: implementingRootFor(coreRoot, sourceFile), sourceFile, label: sourceFile };
}

/** `<contributor>/<path>` → `<contributor>`. */
function labelContributor(label: string): string {
  return label.slice(0, label.indexOf("/"));
}

/** Narrowing helper — a miss carries no `root`. */
export function isCriterionSourceMiss(
  r: CriterionSource | CriterionSourceMiss,
): r is CriterionSourceMiss {
  return "reason" in r;
}
