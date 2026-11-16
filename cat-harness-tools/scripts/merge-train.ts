#!/usr/bin/env bun
/**
 * Build a merge TRAIN: a branch from a base SHA with each member merged in,
 * regenerated once, checked, and brought up to `origin/main`.
 *
 * @module scripts/merge-train
 * @graphNode none — a maintenance command over a working tree
 * @covers none — a merge step: it builds a branch and judges no declared graph
 *
 * ## The steps
 *
 * 1. Check out a new branch at `--base`.
 * 2. Each member: `merge-base.ts --no-regen`. A member whose conflicts a
 *    declared pattern does not cover is REFUSED: `merge-base.ts` aborts its
 *    merge and restores the tree, and this records why and on which paths.
 *    Nothing is resolved by hand. A member already contained is recorded so.
 * 3. One `bun run cat regen` over the whole train, then the checks regen does not
 *    repair: `check:l1-complete --write`; every task a layer
 *    declares `afterMerge` under `taskIo`, its declared writer run when the
 *    check is red; and `kg:audit:all:check` (its writer runs
 *    once when it is stale). What they wrote is committed as one commit.
 * 4. Merge `origin/main` with `merge-base.ts` (full form): conflicts that are
 *    only declared generated paths take main's side and regenerate once more;
 *    anything else is refused and the train stays at step 3. The step-3
 *    checks run again after a merge that changed something.
 * 5. A JSON report (`merge-train-report/v1`) on stdout, and in `--out`.
 *
 * ## What it never does
 *
 * Push, open a PR or merge one. Pushing stays with the steward, who reads the
 * report first.
 *
 * ## `--dry-run`
 *
 * Changes no ref and no file. Each member is merged with `git merge-tree`
 * onto the SIMULATED train (the previous members that would merge), and its
 * conflicts are classified exactly as `merge-base.ts` classifies them. The
 * simulated merge commits are unreferenced objects; no check runs.
 *
 * Usage:
 *   bun run cat merge:train -- --base <sha> 1871 1874:<sha> origin/claude/x
 *   bun run cat merge:train -- --base <sha> --branch train/2026-10-02a 1871 1874 --out train.json
 *   bun run cat merge:train -- --root <worktree> --base <sha> 1871 1874 --dry-run
 *   bun run cat merge:train -- --base <sha> 1871 --no-main     # skip step 4
 *
 * Exit 0 built, every member merged and every check passed · 1 built, but
 * something needs a person (a refused member, a failed check, main refused) ·
 * 2 could not start, or a refused merge left the tree unrestored.
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.ts";
import { plan } from "./merge-base.ts";
import { git, parseMemberSpec, resolveMember, type GitResult } from "./merge-pipeline-git.ts";
import { TASK_IO, type ScriptIO } from "./task-io.ts";
import { TOOLS_ROOT } from "./lib/roots.ts";

export type MemberStatus = "merged" | "already-contained" | "refused" | "would-merge" | "would-refuse";

export interface ConflictedPath {
  path: string;
  /** The `merge-conflict-patterns` id; absent when no pattern names the path. */
  pattern?: string;
  strategy: string;
}

export interface TrainMember {
  spec: string;
  label: string;
  sha: string | null;
  status: MemberStatus;
  reason?: string;
  /** Paths `merge-base.ts` refused (✗), when refused. */
  refused_paths?: string[];
  /** Every conflicted path with its classification (dry run, or parsed from the merge log). */
  conflicted?: ConflictedPath[];
  /** The train's HEAD after this member, when merged. */
  head_after?: string;
}

export type CheckStatus = "passed" | "repaired" | "findings" | "failed" | "skipped";

export interface TrainCheck {
  name: string;
  command: string;
  status: CheckStatus;
  exit: number | null;
  detail?: string;
}

export interface TrainReport {
  $schema: "merge-train-report/v1";
  dry_run: boolean;
  root: string;
  base: string;
  branch: string | null;
  members: TrainMember[];
  checks: TrainCheck[];
  main: { ref: string; sha: string | null; status: MemberStatus | "skipped"; reason?: string; refused_paths?: string[]; conflicted?: ConflictedPath[] };
  head: string | null;
  pushed: false;
  verdict: "built" | "needs-a-person" | "could-not-start";
}

/** The paths `merge-base.ts` printed as refused: `  ✗ <path>  [<pattern|no declared pattern>]…`. */
export function parseRefusedPaths(log: string): string[] {
  const out: string[] = [];
  for (const line of log.split("\n")) {
    const m = /^\s*✗\s+(\S+)\s+\[/.exec(line);
    if (m) out.push(m[1]!);
  }
  return out;
}

/** Every classified conflicted path in a `merge-base.ts` log (✓ resolvable, ✗ refused). */
export function parseConflicted(log: string): ConflictedPath[] {
  const out: ConflictedPath[] = [];
  for (const line of log.split("\n")) {
    const m = /^\s*[✓✗]\s+(\S+)\s+\[([^\]]+)\]/.exec(line);
    if (!m) continue;
    const tag = m[2]!;
    if (tag === "no declared pattern") out.push({ path: m[1]!, strategy: "refuse" });
    else {
      const [pattern, strategy] = tag.split(":").map((s) => s.trim());
      out.push({ path: m[1]!, pattern: pattern!, strategy: strategy ?? "" });
    }
  }
  return out;
}

/** The ABORTED line's reason from a `merge-base.ts` log, or its last non-empty line. */
export function parseAbortReason(log: string): string {
  const m = /ABORTED[^—]*—\s*(.+)$/m.exec(log);
  if (m) return m[1]!.trim();
  const lines = log.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? "merge-base exited non-zero with no output";
}

/** The checks a train re-asks after merging, with their writers: every declared `afterMerge` task (bean `0r7u`). */
export function afterMergeRepairs(io: Readonly<Record<string, ScriptIO>> = TASK_IO): Array<{ check: string; writer: string }> {
  return Object.entries(io)
    .filter(([, t]) => t.afterMerge === true && t.writer !== undefined)
    .map(([check, t]) => ({ check, writer: t.writer! }))
    .sort((a, b) => (a.check < b.check ? -1 : 1));
}

/** Classify `git merge-tree --write-tree --name-only` output: the tree, and conflicted paths when it exited 1. */
export function parseMergeTree(r: Pick<GitResult, "code" | "out">): { tree: string; conflicted: string[] } | undefined {
  if (r.code !== 0 && r.code !== 1) return undefined;
  const lines = r.out.split("\n").filter(Boolean);
  const tree = lines[0];
  if (!tree || !/^[0-9a-f]{40,64}$/.test(tree)) return undefined;
  return { tree, conflicted: r.code === 1 ? [...new Set(lines.slice(1))] : [] };
}

/** Classify conflicted paths with the patterns `merge-base.ts` acts on. */
export function classifyConflicts(paths: readonly string[]): { conflicted: ConflictedPath[]; refused: string[] } {
  const p = plan([...paths]);
  const conflicted = [...p.resolvable, ...p.refused].map((c) => (c.pattern ? { path: c.path, pattern: c.pattern.id, strategy: c.strategy } : { path: c.path, strategy: c.strategy }));
  return { conflicted, refused: p.refused.map((c) => c.path) };
}

/** The report's overall verdict. */
export function verdictOf(r: Pick<TrainReport, "members" | "checks" | "main">): TrainReport["verdict"] {
  const refused = r.members.some((m) => m.status === "refused" || m.status === "would-refuse");
  const failed = r.checks.some((c) => c.status === "failed" || c.status === "findings");
  const mainBad = r.main.status === "refused" || r.main.status === "would-refuse";
  return refused || failed || mainBad ? "needs-a-person" : "built";
}

/**
 * Simulate the train with `git merge-tree`: no ref, file or index changes.
 * A member that would merge advances the simulated head by an unreferenced
 * commit, so the next member is tested against the train as it would be.
 */
export function simulate(root: string, base: string, members: readonly { label: string; spec: string; sha: string }[], main?: { ref: string; sha: string }): Pick<TrainReport, "members" | "main"> {
  let cur = base;
  const out: TrainMember[] = [];
  const step = (sha: string): { status: MemberStatus; conflicted: ConflictedPath[]; refused: string[]; reason?: string } => {
    if (git(root, ["merge-base", "--is-ancestor", sha, cur]).ok) return { status: "already-contained", conflicted: [], refused: [] };
    const r = git(root, ["merge-tree", "--write-tree", "--name-only", "--no-messages", cur, sha]);
    const parsed = parseMergeTree(r);
    if (!parsed) return { status: "would-refuse", conflicted: [], refused: [], reason: `git merge-tree failed: ${r.err || `exit ${r.code}`}` };
    const c = classifyConflicts(parsed.conflicted);
    if (c.refused.length) return { status: "would-refuse", ...c, reason: `${c.refused.length} conflict(s) no declared pattern resolves` };
    const commit = git(root, ["commit-tree", parsed.tree, "-p", cur, "-p", sha, "-m", "merge-train dry run"],
      { env: { GIT_AUTHOR_NAME: "merge-train", GIT_AUTHOR_EMAIL: "merge-train@invalid", GIT_COMMITTER_NAME: "merge-train", GIT_COMMITTER_EMAIL: "merge-train@invalid" } });
    if (!commit.ok) return { status: "would-refuse", ...c, reason: `git commit-tree failed: ${commit.err}` };
    cur = commit.out;
    return { status: "would-merge", ...c };
  };
  for (const m of members) {
    const s = step(m.sha);
    const rec: TrainMember = { spec: m.spec, label: m.label, sha: m.sha, status: s.status };
    if (s.reason) rec.reason = s.reason;
    if (s.conflicted.length) rec.conflicted = s.conflicted;
    if (s.refused.length) rec.refused_paths = s.refused;
    out.push(rec);
  }
  let mainRec: TrainReport["main"] = { ref: main?.ref ?? "origin/main", sha: main?.sha ?? null, status: "skipped" };
  if (main) {
    const s = step(main.sha);
    mainRec = { ref: main.ref, sha: main.sha, status: s.status };
    if (s.reason) mainRec.reason = s.reason;
    if (s.conflicted.length) mainRec.conflicted = s.conflicted;
    if (s.refused.length) mainRec.refused_paths = s.refused;
  }
  return { members: out, main: mainRec };
}

// ─── the real run ───────────────────────────────────────────────────────────

interface Ran { code: number; out: string }

/** Run a command in `root`, streaming to stderr (stdout carries the report); capture when asked. */
function run(root: string, cmd: string, args: string[], capture = false): Ran {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf-8", stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", 2, 2], maxBuffer: 256 * 1024 * 1024 });
  const out = capture ? `${r.stdout ?? ""}${r.stderr ?? ""}` : "";
  if (capture && out) process.stderr.write(out);
  return { code: r.status ?? -1, out };
}

function treeRestored(root: string): boolean {
  const merging = git(root, ["rev-parse", "-q", "--verify", "MERGE_HEAD"]).ok;
  return !merging && git(root, ["status", "--porcelain"]).out === "";
}

/** Steps 3's checks; returns what each did. */
function postChecks(root: string, label: string, regen: boolean): TrainCheck[] {
  const checks: TrainCheck[] = [];
  const record = (name: string, command: string, code: number, ok: CheckStatus, bad: CheckStatus, detail?: string): void => {
    const c: TrainCheck = { name: `${name}${label}`, command, status: code === 0 ? ok : bad, exit: code };
    if (detail) c.detail = detail;
    checks.push(c);
  };
  if (regen) {
    git(root, ["submodule", "update", "--init", "--recursive"]);
    record("regen", "bun run cat regen", run(root, "bun", ["run", "cat", "regen"]).code, "passed", "failed");
  }
  const l1 = run(root, "bun", ["run", "cat", "check:l1-complete", "--", "--write"]).code;
  record("l1-complete", "bun run cat check:l1-complete -- --write", l1, "passed", l1 === 1 ? "findings" : "failed",
    l1 === 1 ? "a library entry has an unmet L1 requirement (the verdict is written)" : l1 === 2 ? "could not check" : undefined);

  // Each check a layer declares `afterMerge` under `taskIo`, with its
  // writer run when red (bean `0r7u`). It named one layer's gate and
  // extractor until 2026-10-06 — a layer above this one, so the train broke
  // standalone; that layer now declares the pair itself.
  for (const { check, writer } of afterMergeRepairs()) {
    const first = run(root, "bun", ["run", "cat", check], true).code;
    if (first === 0) {
      record(check, `bun run cat ${check}`, 0, "passed", "failed");
      continue;
    }
    const wrote = run(root, "bun", ["run", "cat", writer]).code;
    record(check, `bun run cat ${writer}, then ${check}`, run(root, "bun", ["run", "cat", check], true).code, "repaired", "failed",
      wrote === 0 ? undefined : `its writer \`${writer}\` exited ${wrote}`);
  }

  const audit = run(root, "bun", ["run", "cat", "kg:audit:all:check"]).code;
  if (audit === 0) record("kg-audit-all", "bun run cat kg:audit:all:check", 0, "passed", "failed");
  else {
    run(root, "bun", ["run", "cat", "kg:audit:all"]);
    record("kg-audit-all", "bun run cat kg:audit:all, then kg:audit:all:check", run(root, "bun", ["run", "cat", "kg:audit:all:check"]).code, "repaired", "failed");
  }
  return checks;
}

/**
 * Keep tracked-but-ignored files under test/results that were present in base.
 *
 * If a path tracked in base was deleted from the index or marked D (e.g. by a
 * merge conflict or tool step) but is still on disk, `git add -A` ignores it
 * because it matches `.gitignore` (bean `u4up`, issue #2113). Restage with `-f`.
 */
export function keepTrackedIgnored(root: string, base: string): string[] {
  const kept: string[] = [];
  const checkPaths = new Set<string>();

  // Any path under */test/results/* deleted in the index relative to base:
  const dropped = git(root, ["diff", "--name-only", "--diff-filter=D", base, "--", "*/test/results/*"]).out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of dropped) checkPaths.add(p);

  // Also any cached deletion:
  const cachedDropped = git(root, ["diff", "--cached", "--name-only", "--diff-filter=D", "--", "*/test/results/*"]).out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of cachedDropped) checkPaths.add(p);

  for (const p of checkPaths) {
    if (existsSync(join(root, p))) {
      git(root, ["add", "-f", "--", p]);
      kept.push(p);
    }
  }
  return kept;
}

/** Check that the train dropped no tracked test/results path that was present in base. */
export function checkTestResultsDrops(root: string, base: string, label: string = ""): TrainCheck {
  const cmd = `git diff --diff-filter=D ${base.slice(0, 10)} HEAD -- '*/test/results/*'`;
  const diff = git(root, ["diff", "--diff-filter=D", "--name-only", base, "HEAD", "--", "*/test/results/*"]);
  const drops = diff.out.split("\n").map((s) => s.trim()).filter(Boolean);
  if (drops.length > 0) {
    return {
      name: `no-test-results-drops${label}`,
      command: cmd,
      status: "failed",
      exit: 1,
      detail: `${drops.length} tracked test/results path(s) dropped by the train: ${drops.join(", ")}`,
    };
  }
  return {
    name: `no-test-results-drops${label}`,
    command: cmd,
    status: "passed",
    exit: 0,
  };
}

function commitIfChanged(root: string, message: string, base?: string): void {
  if (base) keepTrackedIgnored(root, base);
  if (git(root, ["status", "--porcelain"]).out === "") return;
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", message]);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const valued = new Set(["--base", "--root", "--remote", "--branch", "--out", "--main"]);
  const specs = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1] ?? ""));
  const dryRun = args.includes("--dry-run");
  const fetch = !args.includes("--no-fetch");
  const withMain = !args.includes("--no-main");
  const remote = opt("--remote") ?? "origin";
  const mainRef = opt("--main") ?? `${remote}/main`;
  const root = opt("--root") ?? repoRootFor(join(import.meta.dir, ".."));
  const outFile = opt("--out");
  const baseArg = opt("--base");
  const mergeBase = join(TOOLS_ROOT, "scripts", "merge-base.ts"); // stayed in cat-harness (70lx B2)

  const report: TrainReport = {
    $schema: "merge-train-report/v1", dry_run: dryRun, root, base: baseArg ?? "", branch: null, members: [], checks: [],
    main: { ref: mainRef, sha: null, status: "skipped" }, head: null, pushed: false, verdict: "could-not-start",
  };
  const finish = (code: number): never => {
    const json = JSON.stringify(report, null, 2);
    console.log(json);
    if (outFile) writeFileSync(outFile, `${json}\n`);
    const n = (s: MemberStatus): number => report.members.filter((m) => m.status === s).length;
    console.error(`\nmerge-train: ${report.dry_run ? "DRY RUN, would be " : ""}${report.verdict.toUpperCase()} — ${n("merged") + n("would-merge")} merged, ${n("refused") + n("would-refuse")} refused, ` +
      `${n("already-contained")} already contained; main ${report.main.status}${report.head ? `; head ${report.head.slice(0, 10)}` : ""}. Not pushed.`);
    process.exit(code);
  };

  if (!baseArg || specs.length === 0) {
    console.error("usage: merge-train.ts --base <sha> <member>... [--branch <name>] [--root <checkout>] [--dry-run] [--no-main] [--no-fetch] [--out <file>]");
    finish(2);
  }
  if (!dryRun && git(root, ["status", "--porcelain"]).out !== "") {
    console.error("merge-train: the working tree is not clean; commit, stash or remove the changes first.");
    finish(2);
  }
  if (fetch) git(root, ["fetch", "-q", remote, baseArg!]);
  const base = git(root, ["rev-parse", "--verify", "-q", `${baseArg}^{commit}`]);
  if (!base.ok) { console.error(`merge-train: no such base ${baseArg}`); finish(2); }
  report.base = base.out;

  const resolved = specs.map((s) => resolveMember(root, parseMemberSpec(s), { remote, fetch }));
  const ok: { label: string; spec: string; sha: string }[] = [];
  for (const r of resolved) {
    if ("error" in r) report.members.push({ spec: r.spec.spec, label: r.label, sha: null, status: dryRun ? "would-refuse" : "refused", reason: r.error });
    else ok.push({ label: r.label, spec: r.spec.spec, sha: r.sha });
  }
  let main: { ref: string; sha: string } | undefined;
  if (withMain) {
    if (fetch && mainRef.startsWith(`${remote}/`)) git(root, ["fetch", "-q", remote, mainRef.slice(remote.length + 1)]);
    const m = git(root, ["rev-parse", "--verify", "-q", `${mainRef}^{commit}`]);
    if (m.ok) main = { ref: mainRef, sha: m.out };
    else report.main = { ref: mainRef, sha: null, status: dryRun ? "would-refuse" : "refused", reason: `no such ref ${mainRef}` };
  }

  if (dryRun) {
    const sim = simulate(root, base.out, ok, main);
    report.members.push(...sim.members);
    if (main) report.main = sim.main;
    report.checks = [{ name: "post-merge checks", command: "regen, check:l1-complete --write, declared afterMerge checks, kg:audit:all:check", status: "skipped", exit: null, detail: "--dry-run runs no check" }];
    report.verdict = verdictOf(report);
    finish(report.verdict === "built" ? 0 : 1);
  }

  // 1. The branch.
  const branch = opt("--branch") ?? `merge-train/${base.out.slice(0, 10)}-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 13)}`;
  const co = git(root, ["checkout", "-q", "-b", branch, base.out]);
  if (!co.ok) { console.error(`merge-train: could not create ${branch}: ${co.err}`); finish(2); }
  report.branch = branch;
  git(root, ["submodule", "update", "--init", "--recursive"]);

  // 2. Members.
  for (const m of ok) {
    const rec: TrainMember = { spec: m.spec, label: m.label, sha: m.sha, status: "merged" };
    report.members.push(rec);
    if (git(root, ["merge-base", "--is-ancestor", m.sha, "HEAD"]).ok) { rec.status = "already-contained"; continue; }
    console.error(`\n=== ${m.label} ${m.sha.slice(0, 10)}`);
    const r = run(root, "bun", ["run", mergeBase, "--root", root, "--base", m.sha, "--no-regen"], true);
    const conflicted = parseConflicted(r.out);
    if (conflicted.length) rec.conflicted = conflicted;
    if (r.code === 0) { rec.head_after = git(root, ["rev-parse", "HEAD"]).out; continue; }
    rec.status = "refused";
    rec.reason = r.code === 2 ? `merge-base could not start: ${parseAbortReason(r.out)}` : parseAbortReason(r.out);
    const refused = parseRefusedPaths(r.out);
    if (refused.length) rec.refused_paths = refused;
    if (!treeRestored(root)) git(root, ["merge", "--abort"]);
    if (!treeRestored(root)) {
      rec.reason += " — and the tree was NOT restored; the train stops here (nothing was reset)";
      report.head = git(root, ["rev-parse", "HEAD"]).out;
      report.verdict = "could-not-start";
      finish(2);
    }
  }

  // 3. One regen, the checks it misses, one commit.
  const merged = report.members.filter((m) => m.status === "merged").length;
  if (merged) {
    if (git(root, ["diff", "--quiet", base.out, "HEAD", "--", "bun.lock", "package.json"]).code !== 0) {
      run(root, "bun", ["install", "--frozen-lockfile"]);
    }
    report.checks.push(...postChecks(root, "", true));
    commitIfChanged(root, `merge-train: regenerate after ${merged} member(s)`, base.out);
    report.checks.push(checkTestResultsDrops(root, base.out));
  } else {
    report.checks.push({ name: "post-merge checks", command: "regen, …", status: "skipped", exit: null, detail: "no member merged" });
  }

  // 4. Main.
  if (main) {
    report.main = { ref: main.ref, sha: main.sha, status: "merged" };
    if (git(root, ["merge-base", "--is-ancestor", main.sha, "HEAD"]).ok) report.main.status = "already-contained";
    else {
      console.error(`\n=== ${main.ref} ${main.sha.slice(0, 10)}`);
      const r = run(root, "bun", ["run", mergeBase, "--root", root, "--base", main.sha], true);
      const conflicted = parseConflicted(r.out);
      if (conflicted.length) report.main.conflicted = conflicted;
      if (r.code === 0) {
        report.checks.push(...postChecks(root, " (after main)", false));
        commitIfChanged(root, `merge-train: checks after merging ${main.ref}`, base.out);
        report.checks.push(checkTestResultsDrops(root, base.out, " (after main)"));
      } else {
        report.main.status = "refused";
        report.main.reason = parseAbortReason(r.out);
        const refused = parseRefusedPaths(r.out);
        if (refused.length) report.main.refused_paths = refused;
        if (!treeRestored(root)) git(root, ["merge", "--abort"]);
        if (!treeRestored(root)) report.main.reason += " — and the tree was NOT restored (nothing was reset)";
      }
    }
  }

  report.head = git(root, ["rev-parse", "HEAD"]).out;
  report.verdict = verdictOf(report);
  finish(report.verdict === "built" ? 0 : 1);
}

