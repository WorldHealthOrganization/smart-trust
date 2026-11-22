/**
 * Watch ONE commit's checks to a verdict, in three states.
 *
 * ```sh
 * bun run cat ci:watch <sha>                    # poll until decided
 * bun run cat ci:watch <sha> --branch main      # which branch explains a cancellation
 * bun run cat ci:watch <sha> --once             # one look, no polling
 * bun run cat ci:watch --pr <n>                 # follow a PR's head, re-read every poll
 * ```
 *
 * Exit codes carry the third state, because a caller that reads "not 1" as
 * success rebuilds the collapse this exists to stop:
 *
 * ```
 * 0  pass          every judgeable check completed clean
 * 1  fail          a check failed, timed out, or needs action
 * 2  undetermined  cancelled/superseded, still pending, no runs, or unreadable
 * ```
 *
 * ## Why this is not `check:ci-health`
 *
 * That asks whether the **workflows** are passing on the default branch across
 * recent history. This asks about **one commit**: may I merge, must I fix, or
 * do I not yet know? A workflow can be healthy while one commit's run was
 * cancelled, and a commit can be green while a workflow has been red for a
 * month on a path it never touched.
 *
 * A `cancelled` run (e.g. a deploy superseded by the next push) is
 * undetermined, never a failure. See {@link ../src/workflow/check-verdict}
 * for the precedence rules, which are pure and tested there.
 *
 * `GITHUB_TOKEN` or `GH_TOKEN` is used when present. Without one the call
 * still works for a public repository; for a private one it fails, and this
 * reports `undetermined` rather than a pass.
 *
 * @module scripts/watch-ci
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import {
  exitCodeFor,
  explainSuperseded,
  verdictForCommit,
  verdictOf,
  type CheckRun,
  type HeadMergeState,
  type OwedSummary,
} from "../src/workflow/check-verdict.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
// The owed-workflow reconciliation and the merge probe are IMPORTED, never
// reimplemented — see `verdictForCommit`'s docblock for the two designs that
// duplicated them before this landed (#1646). `check:head-has-run` owns these.
import { coverageFor, mergeStateForHead, resolveCommit, runsForHead } from "./check-head-has-run.js";
import { scanTriggers } from "../src/core/workflow-events.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const USAGE =
  "Usage: cat-harness/scripts/watch-ci.ts <sha> | --pr <n>  [--branch <name>] [--once] [--interval <s>] [--max <n>]";

/** `owner/repo` from the checkout's origin, so this is not hardcoded to one repository. */
function slugOf(root: string): string | undefined {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf-8" }).trim();
    return /github\.com[:/]([^/]+\/[^/.]+)/.exec(url)?.[1];
  } catch {
    return undefined;
  }
}

async function fetchRuns(slug: string, sha: string): Promise<readonly CheckRun[] | undefined> {
  const token = process.env["GITHUB_TOKEN"] ?? process.env["GH_TOKEN"];
  try {
    const r = await fetch(`https://api.github.com/repos/${slug}/commits/${sha}/check-runs`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
    });
    if (!r.ok) return undefined;
    const body = (await r.json()) as { check_runs?: CheckRun[] };
    // An absent `check_runs` key is NOT an empty list: one is "the response
    // did not carry the field", the other is "this commit has no checks", and
    // only the second is a fact about the commit.
    return Array.isArray(body.check_runs) ? body.check_runs : undefined;
  } catch {
    return undefined;
  }
}

/** `git log <sha>..origin/<branch>`, oldest first — empty when the branch has not moved. */
function commitsAfter(root: string, sha: string, branch: string): string[] {
  try {
    execFileSync("git", ["fetch", "origin", branch], { cwd: root, stdio: "ignore" });
    return execFileSync("git", ["log", "--oneline", `${sha}..origin/${branch}`], {
      cwd: root,
      encoding: "utf-8",
    })
      .split("\n")
      .filter((l) => l.length > 0)
      .reverse();
  } catch {
    return [];
  }
}


/**
 * Was the check set COMPLETE? — asked of the existing machinery, not rebuilt.
 *
 * The event matters and is derived rather than assumed: a `pull_request`
 * workflow is not owed on a commit that no open PR heads, so judging a `main`
 * commit against `pull_request` triggers would report every gate missing.
 * `mergeStateForHead` answers that in the same call that detects a conflict.
 *
 * Returns `undefined` for either half it could not establish, because
 * `verdictForCommit` turns that into `undetermined` rather than into a pass.
 */
async function completeness(
  root: string,
  slug: string,
  sha: string,
): Promise<{ owed?: OwedSummary; merge?: HeadMergeState }> {
  // THE SHA MUST BE FULL, and this cost a falsification to find. `ci:watch`
  // takes whatever revision the caller typed, and `prNumberForHead` compares it
  // by EQUALITY against `git ls-remote origin refs/pull/*/head`, which lists
  // 40-character object names. An abbreviated `32779147214` therefore matched
  // nothing and the probe answered `not-a-pr-head` — so the owed event became
  // `push`, the one push-triggered workflow had run, and the guard reported
  // PASS on a fresh PR head whose `Code-quality gates` had not started.
  //
  // Measured 2026-09-30 18:47 against this script's own PR (#1664), where
  // `refs/pull/1664/head` existed and `refs/pull/1664/merge` did not.
  // Unreachable by reading: every layer was individually correct.
  const full = resolveCommit(root, sha);
  if (full === undefined) return {};
  let merge: HeadMergeState | undefined;
  try {
    merge = mergeStateForHead(root, full);
  } catch {
    merge = undefined;
  }
  if (merge === undefined) return {};
  const event = merge === "not-a-pr-head" ? "push" : "pull_request";
  try {
    const head = await runsForHead(slug, full);
    const scan = scanTriggers(root, event);
    const cov = coverageFor(head.state === "has-run" ? head.runs : [], scan, event);
    return {
      merge,
      owed: {
        missing: cov.required.filter((r) => !r.ran).map((r) => r.name),
        unreadable: cov.unreadable.length,
      },
    };
  } catch {
    // The scan or the run query failed. `owed` stays absent, which is
    // could-not-determine — never a satisfied required set.
    return { merge };
  }
}

/**
 * A pull request's head commit, read from `refs/pull/<n>/head` — the same ref
 * family `mergeStateForHead` reads, so `--pr` and the conflict probe cannot
 * disagree about which commit is the head. `undefined` when the ref is absent
 * or unreadable, which the caller reports as could-not-determine.
 *
 * Re-read on every poll, because merging the base in moves the head (bean
 * `52cz`). Deliberately NOT `mergeable_state` from the REST API: GitHub computes
 * it lazily (`unknown` on a first read) and can serve it stale — a pre-merge
 * value 45 minutes after the merge (bean `fx5r`) — while the merge ref is the
 * forge's own answer.
 */
function prHead(root: string, n: string): string | undefined {
  if (!/^\d+$/.test(n)) return undefined;
  try {
    const out = execFileSync("git", ["ls-remote", "origin", `refs/pull/${n}/head`], {
      cwd: root,
      encoding: "utf-8",
    }).trim();
    const sha = out.split(/\s+/)[0];
    return sha !== undefined && /^[0-9a-f]{40}$/.test(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  // The ARGUMENT is tested before it is used, the order bean `1oqu` fixed
  // elsewhere: a missing SHA is "you did not tell me what to watch", which is
  // exit 2, not a crash.
  const pr = flag("pr");
  const given = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1]?.startsWith("--") !== true);
  if (given === undefined && pr === undefined) {
    console.error(`${USAGE}\n  no commit given — nothing to watch`);
    process.exit(2);
  }
  // `repoRootFor` takes a LAYER root and is `join(x, "..")` — it is not a
  // cwd finder. Passing `process.cwd()` gave the repository's PARENT and the
  // git call failed with "not a git repository", which this reported as
  // `undetermined` rather than as a pass. Correct by construction instead:
  // this file lives in <instance>/scripts/, so the layer root is one up.
  const root = repoRootFor(resolve(HARNESS_ROOT));
  const slug = slugOf(root);
  if (slug === undefined) {
    console.error(`${USAGE}\n  could not read owner/repo from git remote 'origin' — NOT a pass`);
    process.exit(2);
  }
  const branch = flag("branch") ?? "main";
  const once = argv.includes("--once");
  const interval = Number(flag("interval") ?? 45) * 1000;
  const max = Number(flag("max") ?? 40);

  for (let i = 0; i < max; i++) {
    const sha = pr === undefined ? given : prHead(root, pr);
    if (sha === undefined) {
      console.error(`  could not read the head of PR #${pr} from refs/pull/${pr}/head — NOT a pass`);
      process.exit(2);
    }
    if (pr !== undefined) console.log(`  PR #${pr} head ${sha.slice(0, 11)}`);
    const { owed, merge } = await completeness(root, slug, sha);
    const v = verdictForCommit(verdictOf(await fetchRuns(slug, sha)), owed, merge);
    const when = new Date().toISOString().slice(11, 19);
    const named = v.names.length > 0 ? `  ${v.names.slice(0, 4).join(", ")}` : "";
    console.log(`${when}  ${sha.slice(0, 11)}  ${v.state.toUpperCase()} — ${v.because}${named}`);

    if (v.state === "undetermined" && v.names.length > 0) {
      // WHOSE contention? Only the branch can say, so ask it rather than
      // assuming concurrency — an unexplained cancellation is a thing to look at.
      console.log(`  ${explainSuperseded(commitsAfter(root, sha, branch))}`);
    }
    if (v.state !== "pending" || once) process.exit(exitCodeFor(v.state));
    await Bun.sleep(interval);
  }
  console.error(`  still pending after ${max} poll(s) — could not determine, which is NOT a pass`);
  process.exit(2);
}
