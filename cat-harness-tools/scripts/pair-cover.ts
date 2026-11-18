/**
 * Checks whose answer `regen` already has from other pairs.
 *
 * @module scripts/pair-cover
 * @graphNode none — a declaration table read by `regen-after-merge.ts`
 *
 * ## What is covered
 *
 * - **`skill:register:check`** is a declaration audit plus `bun run` of the
 *   checks in {@link CHECKS} (`skill-register.ts`). Every one of them is ALSO
 *   a gate, so regen asks each of them as a pair of its own, spelt
 *   identically.
 * - **`kg:audit:check`** is `kg-audit.ts --check --against main` for the
 *   `cat-harness` layer. `kg:audit:all:check` spawns exactly that
 *   for every declared layer, `cat-harness` included, and
 *   `--instance ./cat-harness` resolves to the auditor's own root, so the run
 *   is the same program on the same root with the same flags. The coverer's
 *   exit is non-zero whenever any spawned audit's is (`kg-audit-all.ts`).
 *
 * ## The rule, and why it cannot produce a false green
 *
 * A covered check's verdict is DERIVED, never assumed:
 *
 *     verdict(covered) = verdict(residual) AND verdict(each coverer)
 *
 * where the residual is what the covered check judges that no coverer does
 * (`skill:register:check`'s declarations), or nothing. Both sides are read in
 * the SAME pass, from the same tree, so the conjunction is what the covered
 * check would have answered had it been run then.
 *
 * A covered check is folded only when EVERY coverer is among the pairs being
 * asked in that pass. A run that asks a subset — `--fast`, or a `--changed` run
 * that selected the covered pair and not its coverer — asks it in full. And a
 * coverer that did not come back clean passes its outcome on: a covered check
 * is never `current` beside a red coverer.
 *
 * ## What it does not change
 *
 * `gates` runs `skill:register:check` and `kg:audit:check` whole;
 * this table is read only by `regen`. The layer PR checks fold
 * `skill:register:check` the same way on their own
 * (`.github/scripts/layer-pr-checks/run-gates.py`, `fold_skill_register`).
 */
import { CHECKS as SKILL_REGISTER_CHECKS } from "./skill-register.ts";

/** What answers a covered check, besides its residual. */
export interface Cover {
  /** The checks whose verdicts, together with {@link residual}'s, ARE this check's. */
  readonly covers: readonly string[];
  /**
   * The npm script that judges what no coverer does. Absent: nothing — the
   * coverers are the whole answer.
   */
  readonly residual?: string;
  /** Why the conjunction equals the check, for a reader re-deriving it. */
  readonly why: string;
}

export const COVERED: Readonly<Record<string, Cover>> = {
  "skill:register:check": {
    // Derived from the chain itself, so a step added there is covered here
    // without an edit — and is asked by regen only if it is also a pair (the
    // fold below refuses otherwise).
    covers: SKILL_REGISTER_CHECKS,
    residual: "skill:register:declarations:check",
    why:
      "`skill-register.ts --check` = the declaration audit (its `--declarations-only` residual) " +
      "AND `bun run` of each CHECKS entry; regen asks each of those as its own pair",
  },
  "kg:audit:check": {
    covers: ["kg:audit:all:check"],
    why:
      "`kg-audit-all.ts --check --against main` spawns `kg-audit.ts --instance ./cat-harness --check " +
      "--against main`, the same run as `kg:audit:check`, and exits non-zero whenever it does",
  },
};

/** The fold for one pass: covered check → its cover, for the pairs that may be folded. */
export function foldable(
  checks: readonly string[],
  table: Readonly<Record<string, Cover>> = COVERED,
): Map<string, Cover> {
  const present = new Set(checks);
  const out = new Map<string, Cover>();
  for (const check of checks) {
    const c = table[check];
    if (c === undefined || c.covers.length === 0) continue;
    if (c.covers.some((x) => x === check || !present.has(x))) continue;
    out.set(check, c);
  }
  // A cycle would make two derived verdicts wait on each other; drop every
  // fold on one, so each is asked in full.
  const onCycle = (start: string): boolean => {
    const seen = new Set<string>();
    const walk = (c: string): boolean => {
      const cover = out.get(c);
      if (cover === undefined) return false;
      for (const x of cover.covers) {
        if (x === start) return true;
        if (seen.has(x)) continue;
        seen.add(x);
        if (walk(x)) return true;
      }
      return false;
    };
    return walk(start);
  };
  // Decided over the whole fold BEFORE any is dropped: dropping one first
  // would break the cycle and leave its partner folded on a verdict that waits.
  for (const c of [...out.keys()].filter(onCycle)) out.delete(c);
  return out;
}

/**
 * The outcomes that are a pass — the same three `regen-after-merge.ts`
 * counts clean (`CLEAN_OUTCOMES`). `judged` is a judge check's pass (bean
 * `loxz`); leaving it out made a judged covered check skip its coverers and
 * stay green over a red one.
 */
type Clean = "current" | "regenerated" | "judged";

/** The minimal shape of a regen result this needs. */
export interface CoverResult {
  check: string;
  outcome: string;
  coveredBy?: string;
}

/**
 * Replace each folded check's result with the derived verdict.
 *
 * `own` is the residual's result (or `current` when there is none). The
 * derived outcome is, in order: the residual's when that is not clean; else
 * the first coverer's that is not clean (named in `coveredBy`); else
 * `regenerated` if the residual or any coverer was stale this pass; else
 * `current`.
 */
export function settleCovered<R extends CoverResult>(results: readonly R[], folds: ReadonlyMap<string, Cover>): R[] {
  const byCheck = new Map(results.map((r) => [r.check, r]));
  const settled = new Map<string, R>();
  const resolve = (check: string): R | undefined => {
    const done = settled.get(check);
    if (done !== undefined) return done;
    const own = byCheck.get(check);
    const cover = folds.get(check);
    if (own === undefined || cover === undefined) return own;
    let out: R = own;
    if (isClean(own.outcome)) {
      const coverers = cover.covers.map((c) => resolve(c));
      const red = coverers.find((r) => r === undefined || !isClean(r.outcome));
      if (red !== undefined) {
        // An absent coverer cannot happen after `foldable`; if it ever does,
        // it is not a pass.
        out = { ...own, outcome: red?.outcome ?? "no-writer", coveredBy: red?.check ?? cover.covers.join(", ") };
      } else if (own.outcome === "regenerated" || coverers.some((r) => r!.outcome === "regenerated")) {
        const stale = coverers.find((r) => r!.outcome === "regenerated");
        out = { ...own, outcome: "regenerated" as Clean, ...(stale ? { coveredBy: stale.check } : {}) };
      }
    }
    settled.set(check, out);
    return out;
  };
  return results.map((r) => resolve(r.check) ?? r);
}

function isClean(o: string): o is Clean {
  return o === "current" || o === "regenerated" || o === "judged";
}
