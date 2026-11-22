#!/usr/bin/env bun
/**
 * Does this commit have a CI run at all?
 *
 * @module scripts/check-head-has-run
 *
 * **A pull request carrying ZERO checks renders identically to one whose
 * checks have not started yet** — both are an absence of status. An agent or
 * a person who merges on "nothing red" merges unverified.
 *
 * GitHub can drop the event: a `pull_request` run may never fire for a PR
 * opened right after a force-push, nor for a `synchronize` on an open PR,
 * even minutes after the previous push. Neither the first nor the later of
 * two rapid pushes is safe to assume.
 *
 * ## What this can and cannot do
 *
 * It cannot make GitHub deliver an event. It can say **"this commit has no
 * run"**:
 *
 * | state | means | exit |
 * |---|---|---|
 * | has the owed runs | every workflow OWED for the event ran | 0 |
 * | **missing a required run** | it has runs, but not the ones owed | 1 |
 * | **no run** | GitHub answered, and nothing names it | 1 |
 * | could not ask | no remote, no network, rate limited, HTTP error | 2 |
 *
 * **Could-not-ask is never reported as "has a run"**, and never as "no run"
 * either.
 *
 * ## The owed runs are derived
 *
 * "Any run" is the wrong question: a run of a different workflow, or a
 * `workflow_dispatch` run (which checks out `refs/heads/<branch>`, not the
 * merge ref), says nothing about the PR's gates. The owed workflows are
 * derived from `.github/workflows/` by {@link scanTriggers}, so a gate
 * workflow that is renamed or deleted is caught too; why a path-filtered
 * workflow is `conditional` rather than required is in
 * `src/core/workflow-events.ts`.
 *
 * ## "No run" is not one situation
 *
 * Exit 1 is the same either way, but the no-run branch asks
 * {@link mergeStateForHead} and says which of these it is:
 *
 * | why | what it means | what to do |
 * |---|---|---|
 * | **conflicted** | the forge publishes no `refs/pull/N/merge`, and a `pull_request` run checks that ref out | merge the base in. **Never dispatch** |
 * | mergeable | a run is owed and its absence is unexplained | dispatching is safe here |
 * | not a PR head | no open PR has this sha, so nothing was owed | open the PR, or ask about the right head |
 * | unknown | the probe itself failed | check by hand; assume nothing |
 *
 * On a conflicted PR a dispatch is a green signal for a tree that will never
 * exist (see `prepare-merge` §Guardrails step 0).
 *
 * A run for a DIFFERENT commit is not a run for this one; that distinction
 * is the whole check.
 *
 * ## Operator rules
 *
 * **Pushing to a PR's head branch does not re-run its `pull_request`
 * workflows**; only `push`-triggered ones fire, leaving the wrong subset of
 * checks. `workflow_dispatch` against the branch is the remedy, and only
 * while the PR is mergeable.
 *
 * **`mergeable_state` is not the way to check by hand**: it, `head.sha` and
 * `updated_at` can serve a stale view long after a merge. {@link mergeStateForHead}
 * asks `git ls-remote origin refs/pull/N/merge` instead. When a forge API and
 * git disagree about git, git is the subject and the API is a cache.
 *
 * ## Unknown commits
 *
 * A commit id GitHub has never heard of returns an empty run list, which
 * looks like a dropped event. So the id is resolved against the local
 * repository FIRST: unknown here is `cannot-ask`, not a finding. A commit
 * that exists locally but sits on no remote ref is reported with THAT as the
 * reason.
 *
 * Usage:  bun run cat check:head-has-run [<sha>]
 */
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { classifyResponse, withBackoff, type BackoffOptions } from "../src/core/retry.js";
import { scanTriggers, type TriggerScan, type WorkflowTrigger } from "../src/core/workflow-events.js";
import { detectRepoUrl, ownerRepo } from "../src/core/git-refs.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const REPO = repoRootFor(resolve(HARNESS_ROOT));

export interface RunRow {
  name: string;
  event: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}

export type HeadRunVerdict =
  | { state: "has-run"; runs: RunRow[] }
  | { state: "no-run" }
  | { state: "cannot-ask"; reason: string };

/**
 * Every workflow run naming `sha` as its head.
 *
 * `head_sha` is asked of the API directly rather than filtering a branch
 * listing. A branch listing answers "what ran on this branch recently", which
 * is the question that MISLED in both of the bean's cases — the newest run was
 * for the predecessor commit, so the branch looked busy while the head had
 * nothing.
 */
export async function runsForHead(
  slug: string | undefined,
  sha: string,
  fetchImpl: typeof fetch = fetch,
  /**
   * Backoff options, so a test can inject a fast clock.
   *
   * Passed in rather than hardcoded because a retry loop with real sleeps is
   * untestable in any suite with a sane timeout — the first draft of this made
   * `a thrown fetch is cannot-ask` take 15 seconds and fail at 5.
   */
  backoff: BackoffOptions = {},
): Promise<HeadRunVerdict> {
  if (!slug) return { state: "cannot-ask", reason: "no GitHub `origin` remote to ask about" };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const url =
    `https://api.github.com/repos/${slug}/actions/runs` +
    `?head_sha=${encodeURIComponent(sha)}&per_page=100`;
  // Owner's rule, 2026-09-20: a falling-off retry rate on every error. A
  // dropped socket or a 5xx says nothing about the question — but a 404 or a
  // permission 403 IS the answer, and `classifyResponse` keeps those final so
  // four waits are not spent re-reaching a conclusion already in hand.
  let res: Response;
  try {
    res = await withBackoff(
      async () => {
        const r = await fetchImpl(url, {
          headers: {
            accept: "application/vnd.github+json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          signal: AbortSignal.timeout(20_000),
        });
        return { value: r, transient: classifyResponse(r.status, r.headers) };
      },
      {
        onRetry: (n, ms, why) => console.error(`  … attempt ${n} failed (${why}); retrying in ${ms}ms`),
        ...backoff,
      },
    );
  } catch (e) {
    // Retries exhausted. The verdict is the SAME third state it would have
    // been without them — backoff makes could-not-determine rarer, it never
    // converts it into an answer.
    return { state: "cannot-ask", reason: e instanceof Error ? e.message : String(e) };
  }
  if (!res.ok) {
    // 404 on a private repo without a token reads as "no run" if you squint,
    // and it is not: it is not being allowed to look.
    const hint =
      res.status === 404
        ? " — a private repo needs GITHUB_TOKEN or GH_TOKEN"
        : res.status === 403
          ? " — rate limited; set GITHUB_TOKEN to raise the limit"
          : "";
    return { state: "cannot-ask", reason: `HTTP ${res.status}${hint}` };
  }
  const body = (await res.json()) as { workflow_runs?: RunRow[] };
  const runs = body.workflow_runs ?? [];
  return runs.length > 0 ? { state: "has-run", runs } : { state: "no-run" };
}

/** Resolve a commit-ish to a full sha here, or `undefined` if git does not know it. */
export function resolveCommit(repo: string, rev: string): string | undefined {
  try {
    return execFileSync("git", ["-C", repo, "rev-parse", "--verify", `${rev}^{commit}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Why a pushed commit might legitimately have no `pull_request` run.
 *
 * `not-a-pr-head` — no open PR has this sha as its head, so no `pull_request`
 * event was ever owed. `conflicted` — a PR has it, and the forge is publishing
 * no merge ref for that PR. `mergeable` — the merge ref is there, so a run is
 * owed and its absence is unexplained. `unknown` — the probe itself failed.
 */
export type MergeState = "not-a-pr-head" | "conflicted" | "mergeable" | "unknown";

/**
 * Which open PR has `sha` as its head, asked of the forge with plain git.
 *
 * `refs/pull/*` is served to anyone who can clone, so this needs **no token** —
 * which is the point. The runs query above needs `GITHUB_TOKEN` and degrades to
 * `cannot-ask` without one, and that is precisely the situation in which an
 * operator is left staring at an absence. This probe still answers there.
 */
export type GitRunner = (args: string[]) => string;

/** The real one. Injected in tests, for the reason `runsForHead` gives for `fetchImpl`. */
export const gitRunner =
  (repo: string): GitRunner =>
  (args) =>
    execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

export function prNumberForHead(
  repo: string,
  sha: string,
  git: GitRunner = gitRunner(repo),
): number | undefined {
  try {
    const out = git(["ls-remote", "origin", "refs/pull/*/head"]);
    for (const line of out.split("\n")) {
      const [got, ref] = line.split(/\s+/);
      if (got === sha) {
        const n = /refs\/pull\/(\d+)\/head/.exec(ref ?? "");
        if (n) return Number(n[1]);
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Is a `pull_request` run OWED for this head, or is the PR unmergeable?
 *
 * **The merge ref is the discriminator; the clock is not.** Measured on PR
 * #813, 2026-09-21, one PR with mergeability the only variable:
 *
 * | | conflicted | resolved |
 * |---|---|---|
 * | `refs/pull/N/merge` | absent for 433 s | present within 15 s |
 * | `pull_request` runs | zero for 8+ minutes | five, 7 s after the push |
 *
 * Three simultaneous controls make the absence a measurement rather than a
 * wait: a normal latency measured at 2 m 43 s on a sibling PR from the same
 * base, twelve open mergeable PRs holding merge refs at that instant, and two
 * PRs CREATED DURING the polling window receiving theirs. The forge was
 * minting merge refs throughout the seven minutes it declined to mint this one.
 *
 * Bean `yv4z` proposes a `--wait` flag for this script. That is the wrong
 * instrument: `pull_request` latency varied more than twenty-fold in one hour
 * under normal operation (7 s against 2 m 43 s), which is why that bean's flat
 * timing series across six observations predicted nothing. A clock cannot
 * separate "will never run" from "has not run yet". This can.
 */
export function mergeStateForHead(
  repo: string,
  sha: string,
  git: GitRunner = gitRunner(repo),
): MergeState {
  const n = prNumberForHead(repo, sha, git);
  if (n === undefined) return "not-a-pr-head";
  try {
    const out = git(["ls-remote", "origin", `refs/pull/${n}/merge`]);
    const merge = out.trim().split(/\s+/)[0];
    if (merge === undefined || merge === "") return "conflicted";
    // PRESENT IS NOT CURRENT. The forge does not delete a merge ref when a new
    // head conflicts — it leaves the one it built for an EARLIER head. Measured
    // 2026-09-30 on #1665: `refs/pull/1665/merge` was 8cdfbc1, built for head
    // 1b7b537, while the head was ec1d829 and REST said `dirty`. Reading
    // existence alone called that head `mergeable`, and `noRunAdvice` then
    // offered dispatch on a tree that will never exist (bean `52cz`).
    //
    // So the merge commit's second parent must BE this head. When it is not,
    // the answer is `unknown`, not `conflicted`: in the seconds after a push the
    // ref is stale for a mergeable head too (PR #813: rebuilt within 15 s), and
    // one read cannot tell the two apart.
    git(["fetch", "--quiet", "--no-tags", "--no-write-fetch-head", "origin", merge]);
    const builtFor = git(["rev-parse", `${merge}^2`]).trim();
    if (builtFor !== sha) return "unknown";
    return mergeStateAgainstCurrentBase(git, sha, git(["rev-parse", `${merge}^1`]).trim());
  } catch {
    // The head lookup succeeded and this one did not, so the difference is the
    // probe rather than the PR. Never `conflicted` on a failed read — that is
    // the confident wrong answer this file exists to prevent.
    return "unknown";
  }
}

/**
 * A merge ref built for THIS head is still only as current as its BASE.
 *
 * The check above compares the merge commit's SECOND parent with the head. Its
 * FIRST parent is the base tip the forge merged against, and the forge does not
 * rebuild the ref when the base moves on and the head now conflicts: it keeps
 * the last one that merged. Measured 2026-10-06 (bean `rwwl`):
 * `refs/pull/2197/merge` had `^1` = 9922966 (an old `main`) and `^2` = the head,
 * `main` was 1b17452, `git merge-tree` against it exited 1, and REST said
 * `dirty`. Reading `^2` alone called that `mergeable`, and `ci:watch --pr 2197`
 * printed PASS, exit 0, on a PR that could not merge. bean `52cz` closed
 * "new head, stale ref"; this is "same head, base moved".
 *
 * So the first parent must be the base's tip, or the merge is re-decided here
 * against the tip with `git merge-tree`. The base is established only for the
 * default branch, where `^1` is one of its ancestors. A stacked PR's base is
 * not derivable from git alone, so that case is `unknown` rather than a guess,
 * as is any failed read.
 */
function mergeStateAgainstCurrentBase(git: GitRunner, sha: string, builtOn: string): MergeState {
  const symref = git(["ls-remote", "--symref", "origin", "HEAD"]);
  const branch = /^ref:\s+refs\/heads\/(\S+)\s+HEAD/m.exec(symref)?.[1];
  const tip = symref.split("\n").find((l) => /\sHEAD$/.test(l) && !l.startsWith("ref:"))?.split(/\s+/)[0];
  if (branch === undefined || tip === undefined || tip === "") return "unknown";
  if (builtOn === tip) return "mergeable";
  git(["fetch", "--quiet", "--no-tags", "--no-write-fetch-head", "origin", tip]);
  try {
    git(["merge-base", "--is-ancestor", builtOn, tip]);
  } catch {
    // Not on the default branch (a stacked PR), or history too shallow to say.
    return "unknown";
  }
  try {
    git(["merge-tree", "--write-tree", "--name-only", tip, sha]);
    return "mergeable";
  } catch (e) {
    // `merge-tree --write-tree` exits 1 for a conflicted merge and >1 for an error.
    return (e as { status?: number }).status === 1 ? "conflicted" : "unknown";
  }
}

/** Is this commit on any remote-tracking ref — i.e. has it been pushed? */
/** Whether a commit is on a remote-tracking ref — with the third state kept. */
export type PushedState = "pushed" | "not-pushed" | "cannot-tell";

/**
 * Is this commit on a remote-tracking ref?
 *
 * ## Why this is not a boolean — bean `y0n2`
 *
 * It was, and it returned `false` from a bare `catch`, which conflated two
 * different facts: *git answered, and no remote-tracking branch contains this
 * commit* with *git did not answer*. The second is a could-not-determine, and
 * this repository states the rule everywhere — `ci-health`, `health`,
 * `audit-coverage` — as **could-not-determine is never rendered as clean**. Here
 * it was rendered as a VERDICT, and the wrong one.
 *
 * It also discarded stderr (`stdio: ["ignore", "pipe", "ignore"]`), so the reason
 * git failed was not merely unreported but UNAVAILABLE. That is what made the
 * measured failure undiagnosable: `head-has-run.test.ts`'s
 * `a commit on a remote-tracking ref reads as pushed` failed once inside a full
 * `bun test` at 22671 ms and passed when run directly, and no route existed to
 * the reason. A 523-file suite runs plenty of concurrent git, and `.git` lock
 * contention is exactly the transient the old `catch` ate.
 *
 * The consequence was not cosmetic. This value chooses what a person is TOLD:
 * `not-pushed` sends them to *"Push it, then ask again"*, which is the wrong
 * advice for somebody who has pushed — and bean `sddf` is the record of how much
 * care the OTHER branch of this decision already needed.
 *
 * `cannot-tell` follows the `cannot-ask` state this same script already has for
 * the run verdict, deliberately: one idiom, not two.
 */
export function pushedState(repo: string, sha: string): PushedState {
  const r = spawnSync("git", ["-C", repo, "branch", "-r", "--contains", sha], {
    encoding: "utf8",
  });
  // `spawnSync` rather than `execFileSync` so a non-zero exit is DATA instead of
  // an exception — the shape that made the old `catch` possible at all.
  if (r.error !== undefined || r.status !== 0) {
    const why = r.error?.message ?? (r.stderr ?? "").trim() ?? "";
    lastPushedFailure = `git branch -r --contains exited ${r.status ?? "null"}${why ? `: ${why}` : ""}`;
    return "cannot-tell";
  }
  return r.stdout.trim() !== "" ? "pushed" : "not-pushed";
}

/**
 * Why the last `cannot-tell` happened, for the message to quote.
 *
 * Module-level rather than returned alongside the state, because every caller
 * wants the state and only the failing one wants the reason — and a tuple would
 * put the reason in the way of the comparison that matters.
 */
let lastPushedFailure = "";

/** The reason behind the most recent `cannot-tell`, or `""`. */
export function lastPushedReason(): string {
  return lastPushedFailure;
}

/**
 * What to tell somebody whose pushed head has no run — as a STRING, so the
 * branch that used to give dangerous advice can be executed by a test.
 *
 * Extracted for the reason `reconcile()` was in `check-bean-front-matter`: a
 * message only reachable by running the whole script against a live forge in a
 * state you cannot conjure is a message nothing checks. The conflicted variant
 * is the one that matters and the one that was wrong, and no test could reach
 * it while it lived inline.
 */
export function noRunAdvice(merge: MergeState): string {
  if (merge === "conflicted") {
    // The one case with a KNOWN answer, and the one where the old advice was
    // actively harmful. Measured on PR #813: a conflicted PR gets no merge ref
    // and no `pull_request` run, and both return within seconds of resolution.
    return (
      "\n  Its pull request is UNMERGEABLE — the forge is publishing no\n" +
      "  `refs/pull/N/merge` for it. A `pull_request` run checks that ref out,\n" +
      "  so this head will NEVER get one until the conflict is resolved. This is\n" +
      "  not a dropped event, and waiting will not help.\n" +
      "\n  MERGE THE BASE BRANCH IN and push. Do NOT dispatch the workflow: a\n" +
      "  dispatch resolves `refs/heads/<branch>`, so it would test the branch\n" +
      "  rather than the merge result — a green signal for a tree that will never\n" +
      "  exist, which is worse than the absence it replaces.\n" +
      "  Beans `yv4z`, `sddf`; `prepare-merge` §Guardrails step 0."
    );
  }
  const head =
    "\n  Merging on \"nothing red\" here merges UNVERIFIED.\n" +
    "\n  WHY it has no run is NOT established. A pull request carrying zero\n" +
    "  checks looks exactly like one whose checks have not started, and this\n" +
    "  script cannot tell those apart — so it does not pick one.";
  if (merge === "mergeable") {
    return (
      head +
      "\n\n  What IS established: its PR is mergeable, so a `pull_request` run is\n" +
      "  owed and its absence is unexplained (bean `3pqn`). Latency is no guide —\n" +
      "  measured 7s and 2m43s within one hour on this repository, so elapsed\n" +
      "  time separates nothing. Re-pushing may not fix it either: on 2026-09-20\n" +
      "  two consecutive pushes were both dropped, 26s apart. Dispatching against\n" +
      "  this ref is safe HERE, because while the PR is mergeable the branch and\n" +
      "  the merge result agree."
    );
  }
  if (merge === "not-a-pr-head") {
    return (
      head +
      "\n\n  No open pull request has this sha as its head, so no `pull_request`\n" +
      "  event was ever owed for it. If you expected one, open the PR — or ask\n" +
      "  again about the head that IS the PR's."
    );
  }
  return (
    head +
    "\n\n  The mergeability probe itself failed, so even THAT is unknown here.\n" +
    "  Check by hand before dispatching anything — and ask GIT, not\n" +
    "  `mergeable_state`. Bean `fx5r`: that field kept serving a merged PR's\n" +
    "  pre-merge value 45 minutes after the merge, and `update-branch` called\n" +
    "  a CLOSED PR a conflict. Only `merged` goes stale-safe:\n" +
    "      gh pr view N --json merged          # merged? then nothing is owed\n" +
    "      git ls-remote origin refs/pull/N/merge   # the probe above, retried\n" +
    "  On a conflicted PR a dispatch tests a tree that will never exist."
  );
}

/**
 * Did the workflows that were OWED for this event actually run?
 *
 * Bean `9x9r`. {@link runsForHead} answers "is there a run", which is a
 * strictly weaker question than "did the gates fire" — and the gap is not
 * hypothetical here: `jsonld-gen-check` and `atomic-mass-gen-check` declare
 * both `push` and `pull_request`, so a push run satisfies the weaker question
 * on a commit whose `pull_request` event was dropped. PR #1309's head carried
 * two runs of `.jsonld siblings in sync with .ts manifests`, one per event.
 *
 * The required set is READ FROM `.github/workflows/`, never listed here, for
 * the reason `gates.ts` derives its list from `code-quality-gates.yml`: a list
 * maintained by hand is a list free to drift from what CI runs, and a gate
 * workflow that is renamed or deleted is exactly what option 2 of this bean
 * could not have caught.
 */
export interface WorkflowCoverage {
  /**
   * Owed unconditionally. A `false` `ran` here is the finding — and `state`
   * says WHICH finding, because `blocked` and `absent` need opposite advice.
   */
  required: { name: string; file: string; ran: boolean; state: RunState }[];
  /**
   * Declared behind `paths`/`types`/`branches`. **Not judged** — whether a run
   * was owed depends on the diff or the ref, and a sha carries neither. Printed
   * rather than dropped, because a silent omission reads as a pass.
   */
  conditional: { name: string; file: string; ran: boolean; state: RunState; filters: string[] }[];
  /** Workflow files that could not be read; while any exist, `required` is incomplete. */
  unreadable: TriggerScan["unreadable"];
}

/**
 * Conclusions that mean the run was CREATED and never EXECUTED.
 *
 * Bean `1acg`. `action_required` is GitHub\'s "this run needs approval before it
 * may start". The run object exists, carries the right name and the right
 * event, and reports `status: "completed"` — and not one job of it ran, so not
 * one gate was evaluated. Measured 2026-10-03 on #1819 and #1808: three
 * `pull_request` runs each, all `action_required`, zero jobs between them.
 *
 * `startup_failure` is the same class and is here for the same reason: the run
 * failed before any job started, so it is evidence about the workflow file
 * rather than about the tree. It is NOT a measured case here — it is included
 * because the alternative is to count it as a gate that fired, which is the
 * defect this set exists to stop.
 *
 * **Not the same question as {@link ../src/workflow/check-verdict}\'s `FAILED`.**
 * That module asks *what is the verdict on this tree*, and puts
 * `action_required` with the failures because it is not a pass. This asks the
 * prior question — *did the gate run at all* — and the answer is no. A module
 * that conflated the two would report a blocked run as a red tree, sending the
 * next reader to hunt for a defect in code that was never compiled.
 */
export const NOT_EXECUTED = new Set(["action_required", "startup_failure"]);

/** Did this run actually execute? A `null` conclusion is still in flight, which is not a no. */
export function executed(r: RunRow): boolean {
  return r.conclusion === null || !NOT_EXECUTED.has(r.conclusion);
}

/**
 * Three states for one workflow, and the middle one is bean `1acg`.
 *
 * `absent` and `blocked` are both "no gate was evaluated", and folding them
 * together would be the `9x9r` mistake in reverse: they call for OPPOSITE
 * actions. An absent run may be a dropped event worth dispatching; a blocked
 * one is explained, and dispatching it is what masked this for 28 pull
 * requests.
 */
export type RunState = "ran" | "blocked" | "absent";

/** Match on BOTH name and event: a `push` run of a workflow is not its `pull_request` run. */
function stateOf(runs: RunRow[], t: WorkflowTrigger, event: string): RunState {
  const mine = runs.filter((r) => r.name === t.name && r.event === event);
  if (mine.length === 0) return "absent";
  // ANY executed run settles it: a re-run that escaped the approval gate is a
  // gate that fired, and the blocked sibling it superseded says nothing further.
  return mine.some(executed) ? "ran" : "blocked";
}

export function coverageFor(runs: RunRow[], scan: TriggerScan, event: string): WorkflowCoverage {
  const row = (t: WorkflowTrigger) => {
    const state = stateOf(runs, t, event);
    // `ran` stays a boolean and stays TRUE only for "executed", so every
    // existing consumer that filters on `!ran` keeps a blocked run in its
    // missing set rather than silently passing it.
    return { name: t.name, file: t.file, state, ran: state === "ran" };
  };
  return {
    required: scan.triggers.filter((t) => t.requirement === "required").map(row),
    conditional: scan.triggers
      .filter((t) => t.requirement === "conditional")
      .map((t) => ({ ...row(t), filters: t.filters })),
    unreadable: scan.unreadable,
  };
}

/**
 * What to tell somebody whose head has runs but is MISSING a required one.
 *
 * A separate message from {@link noRunAdvice} on purpose: "nothing ran" and
 * "the gates did not run but other things did" put the operator in different
 * positions, and the second is the more dangerous of the two precisely because
 * it renders as activity.
 */
export function missingRequiredAdvice(missing: string[], merge: MergeState): string {
  const head =
    `\n  Its head has runs, but ${missing.length} workflow(s) owed for this event\n` +
    `  did NOT run: ${missing.join(", ")}.\n` +
    "\n  A run from a DIFFERENT workflow is not evidence about this one. Reading\n" +
    "  \"some checks exist\" as \"the gates passed\" is what bean `9x9r` measured:\n" +
    "  this script itself reported a ✓ in exactly this state.";
  if (merge === "conflicted") {
    return (
      head +
      "\n\n  Its pull request is UNMERGEABLE, so no `refs/pull/N/merge` exists and\n" +
      "  this head will never get a `pull_request` run until that is resolved.\n" +
      "  MERGE THE BASE BRANCH IN and push. Do NOT dispatch — a dispatch resolves\n" +
      "  `refs/heads/<branch>`, testing a tree that will never exist.\n" +
      "  Beans `yv4z`, `sddf`; `prepare-merge` §Guardrails step 0."
    );
  }
  if (merge === "mergeable") {
    return (
      head +
      "\n\n  Its PR is mergeable, so those runs were owed and their absence is\n" +
      "  unexplained (bean `3pqn`). Dispatching against this ref is safe HERE,\n" +
      "  because while the PR is mergeable the branch and the merge result agree."
    );
  }
  return (
    head +
    "\n\n  Mergeability is not established, so check by hand before dispatching\n" +
    "  anything — and ask GIT, not `mergeable_state`. Bean `fx5r` measured it\n" +
    "  still serving a merged PR's pre-merge value 45 minutes after the merge;\n" +
    "  only `merged` goes stale-safe:\n" +
    "      gh pr view N --json merged          # merged? then nothing is owed\n" +
    "      git ls-remote origin refs/pull/N/merge   # the probe above, retried\n" +
    "  On a conflicted PR a dispatch tests a tree that will never exist."
  );
}

/**
 * What to tell somebody whose required run EXISTS and never executed.
 *
 * Bean `1acg`, and a separate message from {@link missingRequiredAdvice} for
 * the reason that one is separate from {@link noRunAdvice}: this operator is in
 * a third position, and the advice the other two give is actively WRONG here.
 *
 * `missingRequiredAdvice`'s `mergeable` branch says the absence *"is
 * unexplained (bean `3pqn`)"* and that *"Dispatching against this ref is safe
 * HERE"*. For a blocked run the first is false — the cause is known and written
 * in `merge-main.yml` — and the second is the trap: a dispatch produces a green
 * that reads like the PR's own gates and is not. That is how #1819 and #1808
 * came to carry a `ready:` attestation over a tree whose gates had not judged
 * it, and on #1819 the dispatch it points at had actually FAILED.
 *
 * So this says what the state is and names the ONE change that fixes the class,
 * rather than offering a per-head workaround.
 */
export function blockedRequiredAdvice(blocked: string[]): string {
  return (
    `\n  Its head HAS a \`pull_request\` run of ${blocked.length} workflow(s) owed —\n` +
    `  ${blocked.join(", ")} — and NONE of them executed.\n` +
    "\n  They completed `action_required`: created, never started, no job run, no\n" +
    "  gate evaluated. `status: completed` on such a run is what makes this read\n" +
    "  as a finished check set, and the Actions API reports a conclusion for a\n" +
    "  run whose jobs never existed.\n" +
    "\n  THIS IS NOT A DROPPED EVENT. Waiting will not help and a re-push by the\n" +
    "  same actor reproduces it. Measured 2026-10-03 on #1819 and #1808: every\n" +
    "  such run's `actor` and `triggering_actor` is `github-actions[bot]`, and\n" +
    "  the head repo is NOT a fork — so it is the bot-actor gate that\n" +
    "  `merge-main.yml` documents at its `Have CI judge the merge commit` step,\n" +
    "  not an outside-contributor approval.\n" +
    "\n  Do NOT read a `workflow_dispatch` green on this head as the answer. It is\n" +
    "  a different run of a different ref resolution, and on #1819 the dispatched\n" +
    "  `Code-quality gates` FAILED while this script still printed a checkmark.\n" +
    "\n  The fix is a push credential whose pushes trigger the PR's own runs —\n" +
    "  issue #1829 D1, bean `0qjq`. `merge-main.yml` mints one from the harness\n" +
    "  GitHub App when it is installed (`vars.HARNESS_BOT_ID` +\n" +
    "  `secrets.HARNESS_BOT_PRIVATE_KEY`), else uses\n" +
    "  `secrets.PUSH_BRANCH_TRIGGERING_CI` (bean `8mlt`). So INSTALL THE HARNESS\n" +
    "  APP OR SET PUSH_BRANCH_TRIGGERING_CI: that is the whole change, and\n" +
    "  it is the repository owner's to make. Until then this head cannot be\n" +
    "  judged by its own gates, and that is a report, not something to work around."
  );
}

if (import.meta.main) {
  const asked = process.argv[2] ?? "HEAD";
  const sha = resolveCommit(REPO, asked);
  if (sha === undefined) {
    // NOT a finding. An id git cannot resolve is one nothing can be
    // established about, and reporting it as "no run" is the confident wrong
    // answer this whole file is against.
    console.error(`? ${asked} — COULD NOT ASK: this repository has no such commit.`);
    process.exit(2);
  }
  const verdict = await runsForHead(ownerRepo(detectRepoUrl(REPO) ?? ""), sha);

  if (verdict.state === "cannot-ask") {
    console.error(`? ${sha.slice(0, 10)} — COULD NOT ASK: ${verdict.reason}.`);
    console.error(
      "  That is not the same as having no run, and it must not be read as either\n" +
        "  answer. Nothing has been established about this commit.",
    );
    process.exit(2);
  }
  if (verdict.state === "no-run") {
    console.error(`✗ ${sha.slice(0, 10)} has NO workflow run of any kind.`);
    const pushed = pushedState(REPO, sha);
    if (pushed === "cannot-tell") {
      // Bean `y0n2`: this used to read as `not-pushed` and tell somebody who HAD
      // pushed to push again. Exits 2, matching `cannot-ask` above — the same
      // third state, one idiom.
      console.error(
        `\n  ? COULD NOT TELL whether it is pushed: ${lastPushedReason()}.\n` +
          "  That is not the same as being unpushed, and it must not be read as\n" +
          "  either answer. Nothing has been established about where this commit is.",
      );
      process.exit(2);
    }
    if (pushed === "not-pushed") {
      // The ordinary explanation, and it is not bean `3pqn`. Saying "GitHub
      // dropped your event" to somebody who has not pushed teaches them to
      // ignore the message.
      console.error(
        "\n  It is on no remote-tracking ref, so nothing has had the chance to run it.\n" +
          "  Push it, then ask again.",
      );
      process.exit(1);
    }
    // WHY is it not run? Asked rather than asserted, and the answer is a
    // pure function so a test can execute every branch — including the one
    // that used to say "the event was dropped" and tell you to dispatch.
    console.error(noRunAdvice(mergeStateForHead(REPO, sha)));
    process.exit(1);
  }
  console.log(`  ${sha.slice(0, 10)} — ${verdict.runs.length} run(s):`);
  for (const r of verdict.runs) {
    console.log(`    ${r.name.padEnd(36)} ${r.event.padEnd(16)} ${r.conclusion ?? r.status}`);
  }

  // Bean `9x9r`. Having runs is not having the RIGHT runs, and the old script
  // stopped here with a ✓. The event is only known when the sha is a PR head,
  // so that is the only case judged — which is also the only case `3pqn` is
  // about.
  const merge = mergeStateForHead(REPO, sha);
  if (merge === "not-a-pr-head") {
    console.log(
      "\n? No open pull request has this sha as its head, so no event is owed for it\n" +
        "  and WHICH workflows should have run cannot be determined. The runs above\n" +
        "  are reported; nothing about them has been judged.",
    );
    process.exit(0);
  }

  const event = "pull_request";
  const cov = coverageFor(verdict.runs, scanTriggers(REPO, event), event);

  if (cov.unreadable.length > 0) {
    console.error(`\n? ${cov.unreadable.length} workflow file(s) could not be read:`);
    for (const u of cov.unreadable) console.error(`    ${u.file}: ${u.problem}`);
    console.error(
      "  The required set is therefore INCOMPLETE, so this run cannot say the owed\n" +
        "  workflows ran. Could-not-ask is not a pass.",
    );
    process.exit(2);
  }
  if (cov.required.length === 0) {
    console.error(
      `\n? No workflow declares \`${event}\` without filters, so nothing is owed\n` +
        "  unconditionally and there was nothing to require. That is a finding about\n" +
        "  the workflows rather than about this commit — and it is NOT a pass.",
    );
    process.exit(2);
  }

  // A blocked run gets its OWN mark and its own word. Printing `✗ required`
  // over it would say "no run", which is the half-truth that made this
  // invisible: there IS a run, and that is exactly why it looked fine.
  const mark = (st: RunState) => (st === "ran" ? "✓" : st === "blocked" ? "!" : "✗");
  const word = (st: RunState) => (st === "blocked" ? "required — DID NOT EXECUTE" : "required");
  console.log(`\n  owed for \`${event}\`, read from .github/workflows/:`);
  for (const w of cov.required) console.log(`    ${mark(w.state)} ${w.name.padEnd(36)} ${word(w.state)}`);
  for (const w of cov.conditional) {
    const tail =
      w.state === "blocked"
        ? `conditional (${w.filters.join(", ")}) — a run exists and DID NOT EXECUTE`
        : `conditional (${w.filters.join(", ")}) — not judged`;
    console.log(`    ${w.state === "ran" ? "✓" : w.state === "blocked" ? "!" : "?"} ${w.name.padEnd(36)} ${tail}`);
  }
  if (cov.conditional.length > 0) {
    console.log(
      "\n  A conditional workflow that did not run is NOT a finding: its filters\n" +
        "  depend on the diff or the ref, and a commit id carries neither. It is not\n" +
        "  a pass either, which is why it is printed rather than dropped.",
    );
  }

  // Bean `1acg`. Reported FIRST and separately: a blocked run and an absent one
  // are both "no gate fired", and the advice for each contradicts the other, so
  // a head with one of each must hear both rather than whichever won a filter.
  const blocked = cov.required.filter((w) => w.state === "blocked").map((w) => w.name);
  const absent = cov.required.filter((w) => w.state === "absent").map((w) => w.name);
  if (blocked.length > 0) {
    console.error(`\n✗ ${sha.slice(0, 10)} — a required workflow run EXISTS but DID NOT EXECUTE.`);
    console.error(blockedRequiredAdvice(blocked));
  }
  if (absent.length > 0) {
    console.error(`\n✗ ${sha.slice(0, 10)} is MISSING a required workflow run.`);
    console.error(missingRequiredAdvice(absent, merge));
  }
  if (blocked.length > 0 || absent.length > 0) process.exit(1);

  console.log(`\n✓ ${sha.slice(0, 10)} — all ${cov.required.length} workflow(s) owed for \`${event}\` ran.`);
  process.exit(0);
}
