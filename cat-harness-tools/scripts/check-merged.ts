#!/usr/bin/env bun
/**
 * Run the gates on the COMBINED state — this branch merged with the current
 * base — before a merge.
 *
 * A PR's CI tests the branch merged with the base as it was when pushed; a
 * clean TEXT merge is not a clean STATE (e.g. a generated measurement stale
 * after both sides changed). This builds the merge in a throwaway worktree and
 * runs the full `bun run cat gates` there. The merge queue (`merge_group:`)
 * is the structural fix; this is the half an agent can run itself.
 *
 * - exit 0 — the merged tree passes every gate;
 * - exit 1 — the merge conflicts (files listed), or a gate fails on the
 *   merged tree: this branch needs the base merged in and regenerated;
 * - exit 2 — COULD NOT DETERMINE (the base could not be fetched, the worktree
 *   could not be built, or the worktree's corpus is distorted — see the
 *   `node_modules` guard below). Never reported as clean.
 *
 * The working copy is never touched: the temporary worktree is removed on
 * every path out, including failure.
 *
 * Usage:
 *   bun run cat check:merged              # base = main
 *   bun run cat check:merged -- --base <branch>
 *   bun run cat check:merged -- --against <commit>   # a FIXED base, no fetch,
 *     for replaying a past pair
 *
 * @module scripts/check-merged
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { diffReadings, readTree, type TreeReading } from "./gate-tree-guard.ts";
import {
  GatesReportSchema,
  MERGED_GATES_REPORT_SCHEMA,
  MergedGatesReportSchema,
  type GatesReport,
  type MergedGatesReport,
} from "../schemas/sdlc/gates-report.ts";
import { reportPathFrom } from "./gates.ts";

const REPO = resolve(import.meta.dir, "..", "..");

function git(args: string[], cwd = REPO): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

/**
 * Did a gate write to the tree while it was being judged?
 *
 * Three inputs, two answers, and the third input is why this is a function
 * rather than an inline `&&`: if EITHER reading could not be taken, the honest
 * answer is `false` — "no mutation was observed" — and NOT "no mutation
 * happened". The caller then falls through to the ordinary failure message,
 * which is the safe direction: it tells a reader to look at their own branch
 * rather than blaming a writing gate this script never actually saw.
 *
 * Reporting an unobserved mutation as observed would be the worse error. It
 * would send somebody hunting a writer that may not exist, and `ymsu` is hard
 * enough to see without false sightings of it.
 */
export function mutatedDuring(before: TreeReading, after: TreeReading): boolean {
  if (!before.ok || !after.ok) return false;
  return diffReadings(before.entries, after.entries).length > 0;
}

/** The base branch: `--base <name>`, else `main`. */
export function baseFrom(argv: readonly string[]): string {
  const i = argv.indexOf("--base");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : "main";
}

/** `--against <ref>`: a fixed base commit, used as-is and never fetched. */
export function againstFrom(argv: readonly string[]): string | undefined {
  const i = argv.indexOf("--against");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : undefined;
}

/** What `--report` writes; `main` fills it on every path out (#1259, Q-DS-14 A). */
type Draft = Omit<MergedGatesReport, "$schema" | "exitCode">;

/** The report for a run that ended with `code`, from what `main` recorded on the way. */
export function finishMergedReport(draft: Draft, code: number): MergedGatesReport {
  const exitCode: 0 | 1 | 2 = code === 0 ? 0 : code === 1 ? 1 : 2;
  return MergedGatesReportSchema.parse({ $schema: MERGED_GATES_REPORT_SCHEMA, ...draft, exitCode });
}

/** The inner `gates --report`, if it was written and reads as one. A missing or bad file is no report, never a pass. */
export function readInnerReport(path: string): GatesReport | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const r = GatesReportSchema.safeParse(JSON.parse(readFileSync(path, "utf-8")));
    return r.success ? r.data : undefined;
  } catch {
    return undefined;
  }
}

function main(draft: Draft = { outcome: "undetermined" }): number {
  const done = (code: number, d: Partial<Draft>): number => {
    Object.assign(draft, d);
    return code;
  };
  const against = againstFrom(process.argv);
  const base = baseFrom(process.argv);
  let target: string;
  if (against) {
    const r = git(["rev-parse", "--verify", `${against}^{commit}`]);
    if (!r.ok) {
      console.error(`::error::check:merged: --against ${against} is not a commit here — COULD NOT DETERMINE.`);
      return done(2, { outcome: "undetermined", why: `--against ${against} is not a commit here` });
    }
    target = r.out;
  } else {
    const fetched = git(["fetch", "-q", "origin", base]);
    if (!fetched.ok) {
      console.error(`::error::check:merged: could not fetch origin/${base} — COULD NOT DETERMINE, not clean.\n${fetched.out}`);
      return done(2, { outcome: "undetermined", why: `could not fetch origin/${base}` });
    }
    target = `origin/${base}`;
  }

  const head = git(["rev-parse", "HEAD"]).out;
  const baseSha = git(["rev-parse", target]).out;
  const behind = git(["rev-list", "--count", `HEAD..${baseSha}`]).out;
  Object.assign(draft, { head, base: baseSha, ...(/^\d+$/.test(behind) ? { behind: Number(behind) } : {}) });
  console.log(`check:merged — HEAD ${head.slice(0, 8)} with ${against ? "fixed base" : `origin/${base}`} ${baseSha.slice(0, 8)} (${behind} commit(s) not yet in this branch)`);

  // The worktree is named after THIS checkout's directory. Some tests assert
  // the repository directory's name (`folio-root.test.ts`: it must end in
  // `folio-assistant`), which CI satisfies because the runner clones into
  // `…/folio-assistant/folio-assistant`. A worktree called anything else fails
  // them on a clean tree — found by this script's own falsification run, where
  // two such failures stood beside the one real one. A false red is worse than
  // no check: it teaches everyone to ignore it.
  const dir = mkdtempSync(join(tmpdir(), "check-merged-"));
  const wt = join(dir, basename(REPO));
  try {
    const added = git(["worktree", "add", "-q", "--detach", wt, head]);
    if (!added.ok) {
      console.error(`::error::check:merged: could not build a worktree — COULD NOT DETERMINE.\n${added.out}`);
      return done(2, { outcome: "undetermined", why: "could not build a worktree" });
    }

    const merged = git(["merge", "-q", "--no-edit", "--no-verify", baseSha], wt);
    if (!merged.ok) {
      const conflicts = git(["diff", "--name-only", "--diff-filter=U"], wt).out;
      if (conflicts) {
        console.error(`\n✗ the merge CONFLICTS in:\n${conflicts.split("\n").map((f) => `  · ${f}`).join("\n")}`);
        console.error(`\nMerge the base into this branch, regenerate generated files with the repo's tooling, and re-run.`);
        return done(1, { outcome: "conflict", conflicts: conflicts.split("\n"), why: "the merge conflicts" });
      }
      console.error(`::error::check:merged: the merge failed without a conflict — COULD NOT DETERMINE.\n${merged.out}`);
      return done(2, { outcome: "undetermined", why: "the merge failed without a conflict" });
    }

    // Dependencies: reuse the checkout's when the merge leaves the lockfile
    // alone; install from the lockfile when it does not, because a stale
    // `node_modules` is the kind of green this script exists to refuse.
    const lockChanged = !git(["diff", "--quiet", head, "HEAD", "--", "bun.lock"], wt).ok;
    if (lockChanged || !existsSync(join(REPO, "node_modules"))) {
      console.log("  dependencies: the merge changes bun.lock — installing from it");
      const inst = spawnSync("bun", ["install", "--frozen-lockfile"], { cwd: wt, stdio: "inherit" });
      if (inst.status !== 0) {
        console.error("::error::check:merged: bun install failed on the merged tree");
        return done(1, { outcome: "fail", why: "bun install failed on the merged tree" });
      }
    } else {
      symlinkSync(join(REPO, "node_modules"), join(wt, "node_modules"), "dir");
      // The symlink must be INVISIBLE to git, and for five days it was not.
      //
      // Bean `qook`. `.gitignore` read `node_modules/`, and git's trailing
      // slash means DIRECTORY ONLY. A symlink is not a directory, so
      // `git ls-files --others --exclude-standard` returned it and
      // `gitCorpus` handed every consumer one phantom entry. On commit
      // `0d3c49c8` that was 13667 paths here against 13666 in a real
      // checkout — and `kg:detangle:check` went from "29 pinned current" to
      // five files STALE. This script then reported two unrelated branches'
      // merged trees defective when no real checkout of either was.
      //
      // So the environment is verified before the sweep, not assumed. A
      // distorted corpus is COULD NOT DETERMINE (exit 2), never a red: a
      // false refusal from a tool whose job is to refuse teaches everyone to
      // stop running it, and then it is not there for the merge it exists for.
      const ignored = git(["check-ignore", "-q", "node_modules"], wt);
      if (!ignored.ok) {
        console.error(
          "::error::check:merged: the `node_modules` symlink is NOT ignored in the worktree, " +
            "so every corpus-derived gate would measure one phantom entry — COULD NOT DETERMINE.\n" +
            "Bean `qook`: `.gitignore` must ignore `node_modules` with NO trailing slash, or git " +
            "treats the pattern as directory-only and the symlink leaks into `git ls-files --others`.",
        );
        return done(2, { outcome: "undetermined", why: "the node_modules symlink is not ignored in the worktree" });
      }
    }

    console.log("  running `bun run cat gates` on the merged tree…\n");
    // The merge worktree is freshly built and therefore clean. Reading it
    // before and after is what lets the two non-zero cases below be told
    // apart, and it is a question only THIS script can answer cheaply: it
    // owns the worktree, so it needs no parsing of the runner's output.
    const before = readTree(wt);
    const innerReport = join(dir, "gates-report.json");
    const gates = spawnSync("bun", ["run", "cat", "gates", "--report", innerReport], { cwd: wt, stdio: "inherit" });
    const inner = readInnerReport(innerReport);
    if (inner) draft.gates = inner;
    if (gates.status !== 0) {
      // `gates` exits 1 for two different things, and the advice differs. The
      // exit code is NOT the discriminator and must not be made one: #1363
      // made the mutation case FATAL ON PURPOSE, to force `ymsu` clause 1
      // rather than let a gate go on writing to the tree it is judged on.
      // Softening it to exit 2 would defeat the guard where it is working.
      if (mutatedDuring(before, readTree(wt))) {
        console.error(`\n✗ a gate CHANGED the merged tree while the gates were judging it — bean \`ymsu\`.`);
        console.error(`This is NOT a stale artefact on your branch, and there is nothing here to regenerate:`);
        console.error(`every gate may well have passed. The verdicts after the write describe a tree that`);
        console.error(`was repaired mid-run, so the run cannot say whether the COMMITTED state is good.`);
        console.error(`The defect is the writing gate, not this branch. See \`ymsu\` clause 1.`);
        return done(1, { outcome: "not-clean", why: "a gate changed the merged tree while it was being judged" });
      }
      console.error(`\n✗ the MERGED tree fails the gates, though this branch may pass alone.`);
      console.error(`Merge the base into the branch, regenerate what the failing gates name, run \`bun run cat gates\`, push.`);
      return done(1, { outcome: "fail", why: "the merged tree fails the gates" });
    }
    console.log(`\n✓ this branch merged with ${baseSha.slice(0, 8)} passes every gate`);
    return done(0, { outcome: "pass" });
  } finally {
    git(["worktree", "remove", "--force", wt]);
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const reportPath = reportPathFrom(process.argv);
  const draft: Draft = { outcome: "undetermined" };
  const code = main(draft);
  if (reportPath) writeFileSync(reportPath, JSON.stringify(finishMergedReport(draft, code), null, 2) + "\n");
  process.exit(code);
}
