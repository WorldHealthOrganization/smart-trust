/**
 * The verdict for ONE commit's check runs — in THREE states, not two.
 *
 * ## Why this is not `ci-health`
 *
 * `check:ci-health` asks whether the **workflows** are passing on the default
 * branch, across recent history. This asks a narrower question about a single
 * commit: *given this SHA's check runs, may I merge, must I fix, or do I not
 * yet know?* The two come apart — a workflow can be healthy in general while
 * one commit's run was cancelled, and a commit can be green while a workflow
 * has been red for a month on a path this commit did not touch.
 *
 * ## The defect this exists to stop
 *
 * Measured 2026-09-30. An agent watching `main` after a merge folded
 * `cancelled` into the failure set and reported **main red** on a commit whose
 * every hard gate had passed — `Repository gates`, `TypeScript`, `End-to-end`,
 * `Skill-registration`, all green. The one cancelled run was `build-and-deploy`
 * from `docs-site.yml`, superseded by the next push.
 *
 * Reporting that as a failure sends the next reader hunting for a defect that
 * does not exist. Reporting it as a pass is worse. It is neither, and the
 * `ci-health` skill already says so:
 *
 * > `cancelled` as a **third state**, and saying **whose** contention a
 * > cancellation was.
 *
 * ## `stale` belongs with `cancelled`, not with failure
 *
 * GitHub marks a check run `stale` when a **newer run supersedes it**. That is
 * the same concurrency fact as a cancellation, not a verdict about the code —
 * so it is `undetermined` here. Classifying it as a failure was the first
 * draft's second bug, found while falsifying the first.
 *
 * ## Precedence, and why each step is in this order
 *
 * 1. **failure wins over everything.** A run that failed is a fact about the
 *    tree; a cancellation alongside it does not soften that.
 * 2. **pending beats cancelled.** While anything is still running, nothing is
 *    concluded — a cancelled run plus an in-flight one is `pending`, because
 *    the in-flight one may yet fail.
 * 3. **cancelled/stale, with nothing failed, is `undetermined`** — never a pass.
 * 4. Only then, `pass`.
 *
 * An **empty** run list and an **unreadable** response are BOTH `undetermined`
 * rather than `pass`. A check set that is vacuously satisfied is the `dh4f`
 * shape: a consumer that looked at nothing and reported a clean run.
 *
 * @module src/workflow/check-verdict
 */

/** GitHub's `conclusion` values that are a verdict about the tree. */
const FAILED = new Set(["failure", "timed_out", "action_required"]);

/**
 * Conclusions that mean "a newer run took over", not "this is wrong".
 * See the module docblock for why `stale` is here and not in {@link FAILED}.
 */
const SUPERSEDED = new Set(["cancelled", "stale"]);

/**
 * Jobs that carry no verdict about the tree. A staging workflow's teardown
 * steps report `skipped` on every ordinary run; counting them would make the
 * "no judgeable runs" case unreachable.
 */
const NOT_A_VERDICT = new Set(["cleanup", "cleanup-dispatch"]);

export interface CheckRun {
  readonly name: string;
  /** `queued` | `in_progress` | `completed` */
  readonly status: string;
  readonly conclusion?: string | null;
}

export type VerdictState = "pass" | "fail" | "pending" | "undetermined";

export interface Verdict {
  readonly state: VerdictState;
  /** The check names that decided it — empty for `pass`. */
  readonly names: readonly string[];
  /** Why, in one line, for a reader who sees only this. */
  readonly because: string;
}

/**
 * Classify a commit's check runs.
 *
 * `runs` is `undefined` when the response could not be read at all — which is
 * `undetermined`, never `pass`.
 */
export function verdictOf(runs: readonly CheckRun[] | undefined): Verdict {
  if (runs === undefined) {
    return {
      state: "undetermined",
      names: [],
      because: "the check-run response could not be read — NOT a pass",
    };
  }
  const judgeable = runs.filter((r) => !NOT_A_VERDICT.has(r.name));
  if (judgeable.length === 0) {
    return {
      state: "undetermined",
      names: [],
      because:
        runs.length === 0
          ? "no check runs on this commit — NOT a pass, a check set nobody ran is not a green one"
          : "every run is a teardown job carrying no verdict — NOT a pass",
    };
  }
  const failed = judgeable.filter((r) => FAILED.has(r.conclusion ?? "")).map((r) => r.name);
  if (failed.length > 0) {
    return { state: "fail", names: failed, because: "a check failed" };
  }
  const pending = judgeable.filter((r) => r.status !== "completed").map((r) => r.name);
  if (pending.length > 0) {
    // Deliberately ABOVE the superseded case: an in-flight run may yet fail,
    // so a cancellation beside it concludes nothing.
    return { state: "pending", names: pending, because: `${pending.length} still running` };
  }
  const superseded = judgeable.filter((r) => SUPERSEDED.has(r.conclusion ?? "")).map((r) => r.name);
  if (superseded.length > 0) {
    return {
      state: "undetermined",
      names: superseded,
      because: "cancelled or superseded by a newer run — neither a pass nor a failure",
    };
  }
  return { state: "pass", names: [], because: `${judgeable.length} check(s) completed clean` };
}

/**
 * WHOSE contention was it? The check run cannot say; the branch can.
 *
 * `newerCommits` is what `git log <sha>..origin/<branch>` returned — so an
 * empty list means the branch has NOT moved past this commit, and the
 * cancellation is therefore unexplained rather than explained by concurrency.
 * Saying "probably concurrency" there would be the guess this whole module
 * exists to refuse.
 */
export function explainSuperseded(newerCommits: readonly string[]): string {
  if (newerCommits.length === 0) {
    return (
      "cancelled, and the branch has NOT moved past this commit. Nothing here " +
      "explains it — say could-not-determine and look, rather than assuming concurrency."
    );
  }
  const head = newerCommits[newerCommits.length - 1]!;
  return (
    `cancelled, and the branch HAS moved past this commit — superseded by: ${head}. ` +
    "That is concurrency, not a failure. Judge the newer commit instead."
  );
}

/** The process exit code for a state. `undetermined` is its own, never 0. */
export function exitCodeFor(state: VerdictState): 0 | 1 | 2 {
  return state === "pass" ? 0 : state === "fail" ? 1 : 2;
}

// ───────────────────────────────────────────────────────────────────────────
// IS THIS THE WHOLE CHECK SET? — issue #1646, bean `6lre`
//
// Everything above classifies the runs it is HANDED. It cannot ask the prior
// question, and #1624 did not: **are these all the runs?**
//
// Measured twice on 2026-09-30:
//
//     16:13:58  29b10a68923  PASS — 1 check(s) completed clean
//     17:25:41  0d714756f3d  PASS — 1 check(s) completed clean
//
// exit 0 both times against `total_count: 1`, while thirteen checks ran on
// neighbouring commits of the same branch. `judgeable.length === 0` guards the
// EMPTY list; with one clean run a PARTIAL list falls straight through to
// `pass` — carrying a plausible number, which is what makes it convincing. The
// second was the dangerous one: the owner had authorised merging #1637 on a
// verified green, so the tool would have merged an unverified tree.
//
// ## NOTHING HERE RECONCILES ANYTHING — and that is the point
//
// Two earlier designs for this were wrong, differently, and both were caught
// before any code shipped:
//
//  1. A rule over `GET /commits/{sha}/check-suites`. **Did not work**: run
//     against the failing commit it also said `pass`, because the
//     `Code-quality gates` suite did not exist at all. A live probe showed
//     that; fixtures would not have. It also showed that `github-pages` and
//     `claude` hold suites at `queued` with zero runs PERMANENTLY, so "any
//     queued suite means pending" never reaches a verdict.
//  2. Workflow-run reconciliation, written fresh. **Worked, and duplicated
//     `check:head-has-run`** (bean `3pqn`), whose states already include
//     *"missing a required run — it has runs, but not the ones owed"*. The
//     owner had ruled that design on 2026-09-24: *"derive the owed workflows
//     from `.github/workflows/`"*. A second answer to one question, free to
//     disagree with the first, is the defect this repository names most often.
//
// And one design was REJECTED, and must not be rediscovered as an improvement:
//
//  3. Comparing against the check names the BASE BRANCH's tip carries. It
//     reads like (2) and is not. The base's names are a fact about a
//     DIFFERENT tree: a PR that adds, renames or path-filters a workflow owes
//     a different set, and a base whose own run was cancelled or never
//     dispatched owes nothing it could report. The owed set comes from
//     `.github/workflows/*.yml` IN THE TREE BEING JUDGED — `code-quality-gates.yml`
//     declares `on: pull_request` in plain sight at that commit — which is a
//     fact rather than a guess. Reconciliation is adopted; base comparison is
//     not, and the two are different designs.
//
// So this function takes the answers as INPUTS. `coverageFor`, `scanTriggers`
// and `mergeStateForHead` compute them, and the caller wires them in. If you
// are about to add a scan or a fetch here, you are rebuilding (2).
// ───────────────────────────────────────────────────────────────────────────

/** What the owed-workflow reconciliation established, reduced to what precedence needs. */
export interface OwedSummary {
  /** Required workflows with no run for this event. Non-empty is the finding. */
  readonly missing: readonly string[];
  /**
   * Workflow files that could not be read. While any exist the required set is
   * NOT established, so a satisfied `missing` proves nothing — `TriggerScan`
   * says so in its own docblock and this carries the count rather than
   * discarding it.
   */
  readonly unreadable: number;
}

/** `mergeStateForHead`'s answer, re-declared so this module imports no script. */
export type HeadMergeState = "not-a-pr-head" | "conflicted" | "mergeable" | "unknown";

/** The one story for a conflicted head, however many runs it has registered. */
function conflictedVerdict(lead: string): Verdict {
  return {
    state: "undetermined",
    names: [],
    because:
      `${lead}, but the head is CONFLICTED with its base, so it cannot merge, and no ` +
      "`pull_request` run is published for it until it can (bean `52cz`). Runs it does carry " +
      "were made against an older base (bean `rwwl`). Merge the base in. NOT a pass",
  };
}

/**
 * The runs verdict, re-asked against whether the set was COMPLETE.
 *
 * Only a would-be `pass` is re-examined. `fail` is a fact about the tree and
 * outranks everything; `pending` and `undetermined` are already not-a-pass, so
 * re-deciding them would change settled #1624 behaviour for no gain.
 *
 * `owed` is `undefined` when the tree could not be scanned and `merge` is
 * `undefined` when the probe was not run. Either way the answer is
 * `undetermined`, never `pass`: every registered run being clean says nothing
 * about the runs that never registered, and calling that green is the `dh4f`
 * defect — a consumer that looked at nothing and reported a clean sweep.
 */
export function verdictForCommit(
  runs: Verdict,
  owed: OwedSummary | undefined,
  merge: HeadMergeState | undefined,
): Verdict {
  // ONE non-pass is re-told, never re-decided: NO runs at all on a CONFLICTED
  // head. It is `undetermined` either way, but "nobody ran a check" and "no
  // check will EVER run until the base is merged in" are different
  // instructions. Measured 2026-09-30: `ci:watch --pr 1677` printed the generic
  // "no check runs" for a PR that REST called `dirty`. The state is unchanged,
  // so `fail` and `pending` are still never touched.
  if (runs.state === "undetermined" && runs.names.length === 0 && merge === "conflicted") {
    return conflictedVerdict("no check has run on this head");
  }
  if (runs.state !== "pass") return runs;

  // `conflicted` is checked before `missing` even though it implies it. A
  // conflicted head has no `pull_request` runs at all, so `missing` would fire
  // anyway — but with the wrong story. Bean `52cz`: the forge publishes no
  // `refs/pull/N/merge`, and a `pull_request` run checks that ref out, so the
  // absent checks are not slow, they are NEVER GOING TO RUN. That is a
  // different instruction to the reader, and the more actionable one.
  if (merge === "conflicted") return conflictedVerdict("every registered run is clean");
  if (merge === undefined) {
    return {
      state: "undetermined",
      names: [],
      because:
        "every registered run is clean, but the head's merge state was not probed, so a " +
        "conflicted head cannot be told from a complete one — NOT a pass",
    };
  }
  if (owed === undefined) {
    return {
      state: "undetermined",
      names: [],
      because:
        "every registered run is clean, but the tree's own workflows were not scanned, so a " +
        "missing required run cannot be detected — NOT a pass",
    };
  }
  if (owed.unreadable > 0) {
    return {
      state: "undetermined",
      names: [],
      because:
        `every registered run is clean, but ${owed.unreadable} workflow file(s) could not be ` +
        "read, so the required set is not established — NOT a pass",
    };
  }
  if (owed.missing.length > 0) {
    return {
      state: "undetermined",
      names: [...owed.missing],
      because:
        `every registered run is clean, but ${owed.missing.length} workflow(s) OWED for this ` +
        "event have no run — a partial check set, not a green one",
    };
  }
  return {
    state: "pass",
    names: [],
    because: `${runs.because}, and every workflow owed for this event ran`,
  };
}
