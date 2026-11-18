#!/usr/bin/env bun
/**
 * Run the fast gates on the tree being pushed, before it leaves the machine,
 * and refuse the push when one is red.
 *
 * The CI fast set runs on every push to a PR. The same gates, under the same
 * pinned Bun, run in a committer's own container in the time it takes to push,
 * and a red one costs the committer a minute instead of a CI round. So this is
 * the pre-push half of `bun run cat gates`, with two entry points:
 *
 * - `--git-hook <remote>`: git's `pre-push` hook (`scripts/git-hooks/pre-push`,
 *   installed by `scripts/git-hooks/install.sh`). The pushed refs come on stdin.
 * - `--claude-hook`: a Claude Code `PreToolUse` hook on `Bash`. The tool call
 *   comes on stdin as JSON; anything that is not a `git push` passes at once.
 *   Exit 2 blocks the call and hands the reason to the agent. Agent containers
 *   are cloned fresh and never run `install.sh`, so this is the hook they get.
 *   The recipe is in bean `cat-tools-pp9g`.
 *
 * ## Off by default (2026-11-05)
 *
 * Measured on a 4-CPU agent container, the gates below took 70 minutes for a
 * typical push, so neither hook runs them unless the checkout opts in
 * ({@link gatesEnabled}: `CAT_PREPUSH_GATES=1`, or `git config
 * cat.gates.prePush true`). Off, a push goes at once, with one line saying so
 * and an `off` entry in the push log.
 *
 * ## The time budget (owner, 2026-11-05: "gates under about 60 s")
 *
 * On, the run holds out every read-only gate measured over 60 s on this
 * machine (`scripts/gate-durations.ts`): named in the report and the record
 * as `heldOut`, like the whole suite, and run by CI. Seven gates were 2324 of
 * the pool's 3241 CPU-seconds. `git config cat.gates.budgetSeconds <s>`
 * changes the budget, and `0` runs every gate.
 *
 * ## Which gates, and which tests (owner, 2026-11-05: "Affected tests only")
 *
 * The fast set, derived from the workflow by `scripts/gates.ts`, never listed
 * here, MINUS the whole-suite `bun test` (`gates --except "bun test"`). It
 * took 31 of the 55 minutes of a fast-set run on a 4-CPU agent container,
 * and CI runs it, sharded. In its place run the test files whose relative
 * import closure holds a file the push changed (`scripts/affected-tests.ts`).
 * A change to what every test runs under (lockfile, manifest, bunfig,
 * tsconfig, a test preload), or a push with no base to diff against, selects
 * them all, and those are left to CI. The record names `bun test` as held
 * out, so it never claims the suite.
 *
 * Gates whose inputs are unchanged since they last passed are SKIPPED by the
 * input-hash cache (bean `f017`). A record for the tree skips the whole run
 * when the same tree is pushed again, which is the case the two hooks create.
 *
 * An affected test that fails is this push's only when it passes with the
 * pushed files put back as at the base, in this same environment: the
 * failing files are re-run with the changed paths swapped to the base in the
 * working tree (never the index), then put back to HEAD.
 *
 * ## Verdicts
 *
 * - gates exit 0: write the tree's record, allow the push;
 * - gates exit 1 with a gate that was GREEN on the push's base in this same
 *   environment and is red now: refuse, quoting those gates. That is CI's own
 *   "no new failures" rule. The base is what the remote branch holds (the
 *   previous push, whose outcomes this hook recorded), else the merge base
 *   with `origin`'s default branch;
 * - gates exit 1 where every red gate was red on the base too, or the base has
 *   no recorded outcomes here: allow, say which gates were red, log it. A
 *   fresh agent container is not CI: measured 2026-11-05 (folio-assistant
 *   #2946), it reddened 11 `bun test` cases that pass in CI on the same tree,
 *   for want of the publish-time pages and a faster machine. A red that may be
 *   the environment's is could-not-determine here, never a refusal;
 * - a gate that changed the tree (not-clean), gates exit 2, or no `cat` runner
 *   in this checkout (a layer cloned on its own): allow, say so, log it.
 *
 * In every allow but the first, no record is written, so CI runs everything,
 * exactly as it would without the hook. Each run's per-gate outcomes ARE
 * written (`<git dir>/cat-gates/results/<tree>.json`), so the next push of the
 * branch has a base to compare against; `--baseline` records them for HEAD
 * without pushing, e.g. on `main` right after a container's cold start.
 *
 * Not judged at all (allowed, said, logged): tracked files that differ from
 * HEAD, because the gates would judge a tree that is not being pushed and the
 * tooling itself dirties it (`state:mount` and folio-assistant's
 * `.gitignore`); and a pushed commit that is not HEAD, which CI judges: the
 * branch store pushes `<commit>:refs/heads/cat/...` from this same
 * repository on every `beans:claim` and `state:push`.
 *
 * ## The bypass is explicit and logged
 *
 * `CAT_GATES_BYPASS='<reason>' git push ...` skips the gates and appends the
 * reason, the refs and the time to `<git dir>/cat-gates/push.log`. `git push
 * --no-verify` also skips git's hook, and git gives the hook no chance to log
 * that; the Claude hook therefore refuses a `--no-verify` push that names no
 * `CAT_GATES_BYPASS` reason.
 *
 * @module scripts/pre-push-gates
 * @graphNode none — a git and Claude Code hook, not a gate itself
 */
import { appendFileSync, createWriteStream, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { affectedTests } from "./affected-tests.ts";
import { budgetSeconds, durationsFromLog, mergeDurations, overBudget, readDurations, readSeed, writeDurations } from "./gate-durations.ts";
import {
  buildRecord,
  covers,
  git,
  logPush,
  newFailures,
  outcomesOf,
  readRecord,
  readResults,
  stateDir,
  toolVersions,
  treeOf,
  writeRecord,
  writeResults,
  LOCAL_GATE_RESULTS_SCHEMA,
  type GatesReportLike,
} from "./gate-record.ts";

const ZERO = /^0+$/;

/** One line of git's pre-push stdin. */
export interface PushedRef {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
}

export function parsePushStdin(text: string): PushedRef[] {
  const out: PushedRef[] = [];
  for (const line of text.split("\n")) {
    const f = line.trim().split(/\s+/);
    if (f.length !== 4) continue;
    out.push({ localRef: f[0]!, localSha: f[1]!, remoteRef: f[2]!, remoteSha: f[3]! });
  }
  return out;
}

/** What a Bash command line says about a push, for the Claude hook. */
export interface PushCommand {
  /** The revisions named as refspec sources; `HEAD` when none is. Deletes are left out. */
  sources: string[];
  noVerify: boolean;
  dryRun: boolean;
  /** The `CAT_GATES_BYPASS=` reason written on the command line, if any. */
  bypass?: string;
}

/**
 * The first `git ... push ...` in a shell command line, or undefined when it
 * holds none. A reading of a command line, not a shell: a push it cannot read
 * (one built by `eval`, say) still meets git's own hook if that is installed.
 */
export function parsePushCommand(command: string): PushCommand | undefined {
  // Split on shell separators; each piece is one simple command.
  for (const piece of command.split(/&&|\|\||[;|\n]/)) {
    const words = piece.trim().match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    let i = 0;
    let bypass: string | undefined;
    // Leading assignments: `CAT_GATES_BYPASS='why' git push`, `env X=1 git push`.
    while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]!) || words[i] === "env")) {
      const m = /^CAT_GATES_BYPASS=(.*)$/.exec(words[i]!);
      if (m) bypass = unquote(m[1]!);
      i++;
    }
    if (words[i] !== "git") continue;
    i++;
    // git's own options before the subcommand: `-C dir`, `-c k=v`, `--no-pager`.
    while (i < words.length && words[i]!.startsWith("-")) i += words[i] === "-C" || words[i] === "-c" ? 2 : 1;
    if (words[i] !== "push") continue;
    const args = words.slice(i + 1).map(unquote);
    const positional = args.filter((a) => !a.startsWith("-"));
    const refspecs = positional.slice(1);
    const sources: string[] = [];
    for (const spec of refspecs) {
      const src = spec.replace(/^\+/, "").split(":")[0]!;
      if (src !== "") sources.push(src);
    }
    if (refspecs.length === 0) sources.push("HEAD");
    return {
      sources,
      noVerify: args.includes("--no-verify"),
      dryRun: args.includes("-n") || args.includes("--dry-run"),
      ...(bypass !== undefined && bypass !== "" ? { bypass } : {}),
    };
  }
  return undefined;
}

function unquote(s: string): string {
  return s.replace(/^'(.*)'$/s, "$1").replace(/^"(.*)"$/s, "$1");
}

export type Verdict =
  | { kind: "allow"; why: string }
  | { kind: "refuse"; why: string[] }
  | { kind: "undetermined"; why: string };

/** Whether the checkout has the `cat` runner `bun run cat gates` needs. */
export function hasCatRunner(root: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as { scripts?: Record<string, string> };
    return typeof pkg.scripts?.cat === "string";
  } catch {
    return false;
  }
}

const BYPASS_HINT =
  "  To push anyway, say why — it is logged:  CAT_GATES_BYPASS='<reason>' git push ...";

/**
 * Decide a push of `commits`, running the gates when no record covers them.
 * `stream` receives the gate run's output as it goes (git's hook shows it;
 * the Claude hook keeps it in the log and quotes only the failures).
 */
export async function judge(
  root: string,
  commits: readonly string[],
  stream?: NodeJS.WritableStream,
  bases: readonly (string | undefined)[] = [],
): Promise<Verdict> {
  const now = toolVersions(root);
  const uncovered: { commit: string; tree: string }[] = [];
  for (const c of new Set(commits)) {
    const tree = treeOf(root, c);
    if (tree === undefined) return { kind: "undetermined", why: `could not read the tree of ${c}` };
    if (!covers(readRecord(root, tree), tree, now).covered) uncovered.push({ commit: c, tree });
  }
  if (uncovered.length === 0) return { kind: "allow", why: "a passing gate record already covers every tree pushed" };

  // First: where no gate can run, the tree on disk does not matter.
  if (!hasCatRunner(root)) {
    return { kind: "undetermined", why: "this checkout has no `cat` runner (a layer cloned on its own), so no gate can run here" };
  }

  // Only the checked-out tree can be judged: the gates read the files on disk.
  // A push of another commit is left to CI, never refused: the branch store
  // (`beans:claim`, `state:push`) pushes `<commit>:refs/heads/cat/...` from
  // this same repository, and refusing it would break every claim.
  const headTree = treeOf(root, "HEAD");
  const elsewhere = uncovered.filter((u) => u.tree !== headTree);
  if (elsewhere.length === uncovered.length) {
    return { kind: "allow", why: `not judged here: ${elsewhere.map((u) => u.commit.slice(0, 12)).join(", ")} is not the checked-out commit, so CI judges it` };
  }
  uncovered.splice(0, uncovered.length, ...uncovered.filter((u) => u.tree === headTree));
  // Tracked files differing from HEAD: the gates would judge a tree that is
  // not being pushed, so nothing is decided here; never a refusal, because
  // the tooling itself dirties the tree (measured 2026-11-05: `state:mount`
  // rewrites folio-assistant's `.gitignore` block whenever main's lags a
  // mounted graph, which would have refused every agent push there).
  const dirty = (git(root, ["diff", "--name-only", "HEAD", "--"]) ?? "").split("\n").filter(Boolean);
  if (dirty.length > 0) {
    return {
      kind: "undetermined",
      why: `tracked files differ from HEAD (${dirty.slice(0, 3).join(", ")}${dirty.length > 3 ? `, +${dirty.length - 3}` : ""}), so the gates would judge a tree that is not being pushed; commit or stash them to have the push judged`,
    };
  }

  const dir = stateDir(root);
  mkdirSync(dir, { recursive: true });
  const reportPath = join(dir, "last-report.json");
  const logPath = join(dir, "last-run.log");
  // ── The time budget (owner, 2026-11-05): read-only gates measured over it are held out ──
  let budget: number | undefined;
  try {
    budget = budgetSeconds(root);
  } catch (e) {
    return { kind: "undetermined", why: (e as Error).message };
  }
  const slow = overBudget(readDurations(root)?.seconds ?? {}, readSeed(), budget);
  if (slow.length > 0) {
    const shown = slow.map((g) => `${g.command.replace(/^bun run cat /, "")} ${Math.round(g.seconds)}s${g.source === "seed" ? "*" : ""}`);
    stream?.write(
      `pre-push: ${slow.length} gate(s) over the ${budget}s budget held out, CI runs them: ${shown.join(", ")}` +
        `${slow.some((g) => g.source === "seed") ? " (* not yet timed here; the committed estimate)" : ""}. ` +
        "Every gate: `git config cat.gates.budgetSeconds 0`.\n",
    );
  }
  const startedAt = new Date().toISOString();
  const code = await runGates(root, reportPath, logPath, stream, slow.map((g) => g.command));
  try {
    writeDurations(root, mergeDurations(readDurations(root), durationsFromLog(readFileSync(logPath, "utf-8")), now, new Date().toISOString()));
  } catch {
    // a missing log teaches nothing; the next run measures again
  }

  let report: GatesReportLike | undefined;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf-8")) as GatesReportLike;
  } catch {
    report = undefined;
  }
  const { commit, tree } = uncovered[0]!;
  const outcomes = report !== undefined ? outcomesOf(report) : undefined;
  if (outcomes !== undefined) writeResults(root, { $schema: LOCAL_GATE_RESULTS_SCHEMA, tree, tools: now, at: new Date().toISOString(), outcomes });

  // ── The gates' verdict: refusing reds, or why nothing was decided ──────
  const refuse: string[] = [];
  const unsure: string[] = [];
  if (code === 1 && report !== undefined && report.outcome === "not-clean") {
    unsure.push(`every gate passed but one changed the tree (${report.mutatedBy?.join(", ") ?? "see the log"})`);
  } else if (code === 1 && report !== undefined) {
    const failedNow = report.failed.map((f) => f.command);
    const baseTree = baseTreeFor(root, commit, bases);
    const fresh = newFailures(failedNow, baseTree === undefined ? undefined : readResults(root, baseTree), now);
    if (fresh.length > 0) {
      refuse.push(`${fresh.length} gate(s) were green on the base in this environment and are red on the tree being pushed:`);
      for (const f of report.failed.filter((x) => fresh.includes(x.command))) {
        refuse.push(`  · ${f.command}   (${f.job} / ${f.step})`);
        for (const w of f.why.slice(0, 5)) refuse.push(`      ${w}`);
      }
    }
    const old = failedNow.filter((c) => !fresh.includes(c));
    if (old.length > 0) {
      unsure.push(`${old.length} gate(s) red here and not known green on the base ${baseTree?.slice(0, 12) ?? "(none found)"} in this environment (${old.join(", ")})`);
    }
  } else if (code !== 0) {
    unsure.push(`\`bun run cat gates\` exited ${code}, which is could-not-determine, not a pass`);
  }

  // ── The affected tests, in place of the held-out whole suite ───────────
  const tests = await judgeAffectedTests(root, commit, bases, dir, logPath, stream);
  if (tests.kind === "fresh") refuse.push(...tests.lines);
  else if (tests.kind === "unsure") unsure.push(tests.why);
  const finishedAt = new Date().toISOString();

  if (refuse.length > 0) return { kind: "refuse", why: [...refuse, `  Full output: ${logPath}`] };
  if (unsure.length > 0 || (tests.kind !== "pass" && tests.kind !== "all")) return { kind: "undetermined", why: `${unsure.join("; ")} (output: ${logPath})` };
  const rec = report !== undefined ? buildRecord(report, { tree, commit, tools: now, runBy: process.env.CLAUDECODE ? "agent" : "human", startedAt, finishedAt }) : undefined;
  if (rec === undefined) return { kind: "undetermined", why: `the gates exited 0 but the report (${reportPath}) names no gate set to record` };
  rec.affectedTests = tests.kind === "all" ? { all: tests.why } : { files: tests.files, passed: true };
  writeRecord(root, rec);
  const testNote = tests.kind === "all" ? `; tests left to CI (${tests.why})` : `; ${tests.files} affected test file(s) passed`;
  const heldNote = slow.length > 0 ? `; ${slow.length} over the ${budget}s budget left to CI` : "";
  return { kind: "allow", why: `${rec.gates.length - rec.skipped.length} gate(s) passed, ${rec.skipped.length} skipped on unchanged inputs${heldNote}${testNote}` };
}

/** The whole-suite gate the hook holds out of `gates` and replaces with the affected tests. */
export const WHOLE_SUITE = "bun test";

type TestVerdict =
  | { kind: "pass"; files: number }
  | { kind: "all"; why: string }
  | { kind: "fresh"; lines: string[] }
  | { kind: "unsure"; why: string };

/** Each failing test in a bun JUnit report, as `file > group > name`. */
export function failedTests(junit: string): Set<string> {
  const out = new Set<string>();
  const unxml = (v: string) => v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#10;/g, "\n").replace(/&amp;/g, "&");
  for (const m of junit.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const body = m[2] ?? "";
    if (!/<(failure|error)\b/.test(body)) continue;
    const attr = (k: string) => unxml(new RegExp(`\\b${k}="([^"]*)"`).exec(m[1]!)?.[1] ?? "");
    out.add([attr("file"), attr("classname"), attr("name")].filter(Boolean).join(" > "));
  }
  return out;
}

/**
 * The commit to compare the affected tests against: what the remote holds now
 * (the previous push), else the merge base with `origin`'s default branch.
 */
export function baseCommitFor(root: string, commit: string, bases: readonly (string | undefined)[]): string | undefined {
  const candidates = [
    ...bases.filter((b): b is string => b !== undefined && !ZERO.test(b)),
    git(root, ["rev-parse", "--verify", "--quiet", "@{upstream}"]),
    git(root, ["merge-base", commit, "refs/remotes/origin/HEAD"]),
    git(root, ["merge-base", commit, "refs/remotes/origin/main"]),
  ];
  for (const c of candidates) {
    if (c === undefined || c === commit) continue;
    if (git(root, ["cat-file", "-e", `${c}^{commit}`]) !== undefined) return c;
  }
  return undefined;
}

/**
 * Run the tests the push's changed files can affect (`affected-tests.ts`).
 * A failure is this push's only when the same test passes with the pushed
 * files put back as they are at the base, in this same environment: CI's
 * "no new failures" rule, asked of the failing files only. The working tree
 * is restored to HEAD afterwards, whatever happens.
 */
async function judgeAffectedTests(
  root: string,
  commit: string,
  bases: readonly (string | undefined)[],
  dir: string,
  logPath: string,
  stream?: NodeJS.WritableStream,
): Promise<TestVerdict> {
  const base = baseCommitFor(root, commit, bases);
  // No base to diff against: nothing can be selected, so the tests are CI's, as with a runtime change.
  if (base === undefined) return { kind: "all", why: "no base commit on disk to diff the push against" };
  const changed = (git(root, ["diff", "--name-only", "--no-renames", base, commit]) ?? "").split("\n").filter(Boolean);
  const sel = affectedTests(root, changed);
  if (sel.kind === "all") return { kind: "all", why: sel.why };
  if (sel.files.length === 0) return { kind: "pass", files: 0 };
  appendFileSync(logPath, `\n── ${sel.files.length} affected test file(s) ──\n${sel.files.map((f) => `  ${f}   (${sel.why[f]})`).join("\n")}\n`);
  stream?.write(`pre-push: ${sel.files.length} affected test file(s), in place of the whole suite (CI runs it)\n`);
  const head = await runTests(root, sel.files, join(dir, "affected-junit.xml"), logPath, stream);
  if (head.code === 0) return { kind: "pass", files: sel.files.length };
  if (head.failed === undefined || head.failed.size === 0) {
    return { kind: "unsure", why: `the affected tests exited ${head.code} and no failing test could be read from their report` };
  }
  // Ask the failing files again at the base: only a test that passes there is this push's.
  const failingFiles = [...new Set([...head.failed].map((t) => t.split(" > ")[0]!))].filter((f) => sel.files.includes(f));
  const atBase = failingFiles.filter((f) => git(root, ["cat-file", "-e", `${base}:${f}`]) !== undefined);
  let baseFailed = new Set<string>();
  if (atBase.length > 0) {
    const restore = swapToBase(root, base, changed);
    try {
      const b = await runTests(root, atBase, join(dir, "affected-junit-base.xml"), logPath, undefined);
      if (b.failed === undefined && b.code !== 0) return { kind: "unsure", why: `the failing tests could not be re-run at the base ${base.slice(0, 12)}` };
      baseFailed = b.failed ?? new Set();
    } finally {
      restore();
    }
  }
  // A test the base does not have (a new file, or a new case) fails only here, so it is this push's.
  const fresh = [...head.failed].filter((t) => !baseFailed.has(t));
  if (fresh.length === 0) {
    return { kind: "unsure", why: `${head.failed.size} affected test(s) red here and red at the base ${base.slice(0, 12)} too, so not this push's` };
  }
  return {
    kind: "fresh",
    lines: [`${fresh.length} affected test(s) pass at the base ${base.slice(0, 12)} in this environment and fail on the tree being pushed:`, ...fresh.slice(0, 20).map((t) => `  · ${t}`)],
  };
}

function runTests(root: string, files: readonly string[], junit: string, logPath: string, stream?: NodeJS.WritableStream): Promise<{ code: number; failed?: Set<string> }> {
  rmSync(junit, { force: true });
  return new Promise((done) => {
    const log = createWriteStream(logPath, { flags: "a" });
    const child = spawn("bun", ["test", "--reporter=junit", `--reporter-outfile=${junit}`, ...files.map((f) => `./${f}`)], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: testEnv(process.env),
    });
    const tee = (b: Buffer) => {
      log.write(b);
      stream?.write(b);
    };
    child.stdout.on("data", tee);
    child.stderr.on("data", tee);
    child.on("error", () => log.end(() => done({ code: 2 })));
    child.on("close", (c) =>
      log.end(() => {
        let failed: Set<string> | undefined;
        try {
          failed = failedTests(readFileSync(junit, "utf-8"));
        } catch {
          failed = undefined;
        }
        done({ code: c ?? 2, failed });
      }),
    );
  });
}

/**
 * Put `paths` in the working tree as they are at `base` (a path the base does
 * not have is removed), and return what puts them back as at HEAD. The index
 * is never touched, and the caller verified the tree was clean first, so the
 * restore is exact; it says so loudly if it is not.
 */
/**
 * The environment the affected tests run under: this one, minus
 * `BUN_OPTIONS`. bun reads extra CLI flags from it, and a CI test shard sets
 * it to `--shard=N/M --reporter=junit --reporter-outfile=<its report>`
 * (folio-assistant#2954, 2026-11-05). Inherited, the selection was sharded
 * away to nothing (could-not-determine where a refusal was due), and its
 * JUnit report overwrote the shard's own. The selection names its files and
 * its report itself.
 */
export function testEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...env };
  delete out.BUN_OPTIONS;
  return out;
}

export function swapToBase(root: string, base: string, paths: readonly string[]): () => void {
  const atBase = (p: string) => git(root, ["cat-file", "-e", `${base}:${p}`]) !== undefined;
  const atHead = (p: string) => git(root, ["cat-file", "-e", `HEAD:${p}`]) !== undefined;
  const present = paths.filter(atBase);
  for (const p of paths.filter((x) => !atBase(x))) rmSync(join(root, p), { force: true });
  for (let i = 0; i < present.length; i += 200) git(root, ["restore", `--source=${base}`, "--worktree", "--", ...present.slice(i, i + 200)]);
  return () => {
    const back = paths.filter(atHead);
    for (const p of paths.filter((x) => !atHead(x))) rmSync(join(root, p), { force: true });
    for (let i = 0; i < back.length; i += 200) git(root, ["restore", "--source=HEAD", "--worktree", "--", ...back.slice(i, i + 200)]);
    if (git(root, ["diff", "--quiet", "HEAD", "--"]) === undefined) {
      process.stderr.write(`pre-push: ⚠ the working tree did not return to HEAD after the base re-run; \`git restore --source=HEAD --worktree -- .\` puts it back\n`);
    }
  };
}

/**
 * The tree to compare a push against: what the remote holds now (the last
 * push of this branch, whose results this hook recorded), else the merge
 * base with the remote's default branch. Undefined when neither is on disk.
 */
export function baseTreeFor(root: string, commit: string, bases: readonly (string | undefined)[]): string | undefined {
  const candidates = [
    ...bases.filter((b): b is string => b !== undefined && !ZERO.test(b)),
    git(root, ["rev-parse", "--verify", "--quiet", "@{upstream}"]),
    git(root, ["merge-base", commit, "refs/remotes/origin/HEAD"]),
    git(root, ["merge-base", commit, "refs/remotes/origin/main"]),
  ];
  for (const c of candidates) {
    if (c === undefined || c === commit) continue;
    const t = treeOf(root, c);
    if (t !== undefined && readResults(root, t) !== undefined) return t;
  }
  return undefined;
}

function runGates(root: string, reportPath: string, logPath: string, stream?: NodeJS.WritableStream, holdOut: readonly string[] = []): Promise<number> {
  return new Promise((done) => {
    const log = createWriteStream(logPath);
    const except = [WHOLE_SUITE, ...holdOut].flatMap((c) => ["--except", c]);
    const child = spawn("bun", ["run", "cat", "gates", "--report", reportPath, ...except], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    const tee = (b: Buffer) => {
      log.write(b);
      stream?.write(b);
    };
    child.stdout.on("data", tee);
    child.stderr.on("data", tee);
    child.on("error", (e) => {
      log.end(`\nspawn failed: ${e.message}\n`);
      done(2);
    });
    child.on("close", (c) => log.end(() => done(c ?? 2)));
  });
}

function say(lines: readonly string[]): void {
  for (const l of lines) process.stderr.write(`${l}\n`);
}

/**
 * Whether the gates run before a push at all. OFF unless asked for: measured
 * 2026-11-05 on a 4-CPU agent container, the fast set minus the whole suite
 * took 70 minutes per push (`skill:register:check` 18 min and
 * `uml:overview:check` 11 min alone), far past what a push can wait on. The
 * time budget cuts that, but a cold run is still minutes, not seconds, so a
 * checkout opts in with `CAT_PREPUSH_GATES=1` or
 * `git config cat.gates.prePush true`.
 */
export function gatesEnabled(root: string, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const v = env.CAT_PREPUSH_GATES;
  if (v !== undefined && v !== "") return v === "1" || v.toLowerCase() === "true";
  return git(root, ["config", "--bool", "cat.gates.prePush"]) === "true";
}

const OFF_NOTE = "pre-push: gates not run (off by default: the fast set takes ~70 min on an agent container); opt in with CAT_PREPUSH_GATES=1 or `git config cat.gates.prePush true`";

async function gitHook(root: string, remote: string): Promise<number> {
  const refs = parsePushStdin(await Bun.stdin.text()).filter((r) => !ZERO.test(r.localSha));
  if (refs.length === 0) return 0;
  if (!gatesEnabled(root)) {
    logPush(root, { event: "off", via: "git-hook", remote, refs });
    say([OFF_NOTE]);
    return 0;
  }
  const bypass = process.env.CAT_GATES_BYPASS;
  if (bypass !== undefined && bypass !== "") {
    const p = logPush(root, { event: "bypass", via: "git-hook", reason: bypass, remote, refs });
    say([`pre-push: gates BYPASSED — "${bypass}" (logged to ${p})`]);
    return 0;
  }
  say([`pre-push: running the fast gates on ${refs.map((r) => r.localRef).join(", ")} (bypass: CAT_GATES_BYPASS='<reason>')`]);
  const v = await judge(root, refs.map((r) => r.localSha), process.stderr, refs.map((r) => r.remoteSha));
  return finish(root, v, { via: "git-hook", remote, refs }, 1);
}

async function claudeHook(): Promise<number> {
  let input: { tool_name?: string; tool_input?: { command?: string }; cwd?: string };
  try {
    input = JSON.parse(await Bun.stdin.text());
  } catch {
    return 0;
  }
  if (input.tool_name !== "Bash" || typeof input.tool_input?.command !== "string") return 0;
  const push = parsePushCommand(input.tool_input.command);
  if (push === undefined || push.dryRun) return 0;
  const root = git(input.cwd ?? process.cwd(), ["rev-parse", "--show-toplevel"]);
  if (root === undefined) return 0;
  if (!gatesEnabled(root)) {
    logPush(root, { event: "off", via: "claude-hook", command: input.tool_input.command });
    say([OFF_NOTE]);
    return 0;
  }
  const bypass = push.bypass ?? process.env.CAT_GATES_BYPASS;
  if (bypass !== undefined && bypass !== "") {
    const p = logPush(root, { event: "bypass", via: "claude-hook", reason: bypass, command: input.tool_input.command });
    say([`pre-push: gates BYPASSED — "${bypass}" (logged to ${p})`]);
    return 0;
  }
  if (push.noVerify) {
    logPush(root, { event: "refused", via: "claude-hook", why: "--no-verify without a reason", command: input.tool_input.command });
    say([
      "`git push --no-verify` skips the gates and leaves no record of why.",
      "Run the push without it, or name the reason, which is logged:",
      "  CAT_GATES_BYPASS='<reason>' git push --no-verify ...",
    ]);
    return 2;
  }
  const commits: string[] = [];
  for (const s of push.sources) {
    const sha = git(root, ["rev-parse", "--verify", "--quiet", `${s}^{commit}`]);
    // A source this cannot resolve (a pattern, say) is left to git's own hook.
    if (sha !== undefined) commits.push(sha);
  }
  if (commits.length === 0) return 0;
  const v = await judge(root, commits);
  return finish(root, v, { via: "claude-hook", command: input.tool_input.command }, 2);
}

function finish(root: string, v: Verdict, ctx: Record<string, unknown>, refuseCode: number): number {
  if (v.kind === "allow") {
    say([`pre-push: ✓ ${v.why}`]);
    return 0;
  }
  if (v.kind === "undetermined") {
    const p = logPush(root, { event: "undetermined", why: v.why, ...ctx });
    say([`pre-push: ? gates not judged — ${v.why}. Pushing; CI runs them. (logged to ${p})`]);
    return 0;
  }
  const p = logPush(root, { event: "refused", why: v.why[0], ...ctx });
  say([...v.why, BYPASS_HINT, `  (logged to ${p})`]);
  return refuseCode;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv[0] === "--git-hook") {
    const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]) ?? process.cwd();
    process.exit(await gitHook(root, argv[1] ?? "origin"));
  } else if (argv[0] === "--baseline") {
    // Record this environment's per-gate outcomes for HEAD, pushing nothing.
    const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]) ?? process.cwd();
    const v = await judge(root, [git(root, ["rev-parse", "HEAD"]) ?? "HEAD"], process.stderr);
    say([`baseline: ${v.kind} — ${v.kind === "refuse" ? v.why.join("\n") : v.why}`]);
    process.exit(0);
  } else if (argv[0] === "--claude-hook") {
    process.exit(await claudeHook());
  } else {
    console.error("usage: pre-push-gates.ts --git-hook <remote> < refs | --claude-hook < tool-call.json | --baseline");
    process.exit(2);
  }
}
