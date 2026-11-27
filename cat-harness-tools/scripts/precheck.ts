#!/usr/bin/env bun
/**
 * `bun run cat precheck` — the fast checks a push's own changes can break, run
 * before the push leaves the machine (owner, card 2026-11-18: every session
 * pushes as the owner's account, so every red CI run emails them).
 *
 * @module scripts/precheck
 * @covers none — a pre-push runner over checks that are gates elsewhere
 *
 * Only the checks whose inputs the push changed run, so a push that touches
 * none of them does nothing and goes at once. Target: 15–60 s.
 *
 * | the push changes | runs |
 * |---|---|
 * | `index.lock.json` or `index.config.json` | `lock:coherence:check` (agreement and freshness) and `mount:remote:check` |
 * | anything under `.github/workflows/` | `check:workflow-pins` |
 * | a `.ts` / `.tsx` / `.mts` / `.cts` file | `tsc --noEmit -p tsconfig.json`, with the checkout's own `tsc` |
 *
 * `mount:remote:check` asks whether the mounts follow the lock, which only a
 * change to the lock or the config can move, so it runs with the lock checks.
 * The full tier never runs here: CI runs it on a `release` / `ready-to-merge`
 * PR.
 *
 * ## Never in the way of a push it cannot judge
 *
 * Every one of these prints ONE line and lets the push through (exit 0); it
 * never installs anything:
 *   - no `cat` runner in the checkout's `package.json`, or no `node_modules`
 *     (a layer cloned on its own, or a checkout not set up);
 *   - no `tsc` in `node_modules/.bin` (the typecheck is skipped, not fetched);
 *   - the pushed commit is not `HEAD`, or tracked files differ from `HEAD`
 *     (the checks would judge a tree that is not being pushed);
 *   - a check exits 2 (could not determine, or the runner has no such script)
 *     or runs past its time (`CAT_PRECHECK_TIMEOUT` seconds, default 90).
 * Without bun, the hook itself (`scripts/git-hooks/pre-push`) says so and
 * lets the push through.
 *
 * A check that exits 1 is red: the push is refused, with the check's output.
 * `git push --no-verify` skips the hook; `CAT_PRECHECK=0` turns it off.
 *
 * ## Entry points
 *
 *   bun run cat precheck                 # what HEAD would push: against @{upstream}, else origin/main
 *   bun run cat precheck --dry-run       # print the plan, run nothing
 *   bun run cat precheck --git-hook <remote>   # git's pre-push hook; the pushed refs come on stdin
 *
 * The hook is installed by `scripts/git-hooks/install.sh` (layer init) and by
 * the session-start primer (`scripts/session-start-coord-sweep.sh`), which
 * agent containers run and which never ran `install.sh`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One check the push owes. */
export interface Check {
  /** What it is called in the output. */
  name: string;
  /** The command, run from the checkout root. */
  argv: string[];
  /** Why this push owes it. */
  why: string;
}

const ZERO = /^0+$/;
const TS = /\.(?:ts|tsx|mts|cts)$/;
const LOCK = /(?:^|\/)index\.(?:lock|config)\.json$/;
const WORKFLOWS = /^\.github\/workflows\//;

/** The checks a push changing `paths` owes, in order; none when it owes none. */
export function planFor(paths: readonly string[], opts: { tsc?: string } = {}): Check[] {
  const plan: Check[] = [];
  const lock = paths.filter((p) => LOCK.test(p));
  if (lock.length) {
    const why = `changes ${lock.slice(0, 3).join(", ")}${lock.length > 3 ? ", …" : ""}`;
    plan.push({ name: "lock:coherence:check", argv: ["bun", "run", "cat", "lock:coherence:check"], why });
    plan.push({ name: "mount:remote:check", argv: ["bun", "run", "cat", "mount:remote:check"], why });
  }
  const wf = paths.filter((p) => WORKFLOWS.test(p));
  if (wf.length) plan.push({ name: "check:workflow-pins", argv: ["bun", "run", "cat", "check:workflow-pins"], why: `changes ${wf.length} file(s) under .github/workflows` });
  const ts = paths.filter((p) => TS.test(p));
  if (ts.length && opts.tsc !== undefined) plan.push({ name: "typecheck", argv: [opts.tsc, "--noEmit", "-p", "tsconfig.json"], why: `changes ${ts.length} TypeScript file(s)` });
  return plan;
}

/** Whether `paths` holds a TypeScript change (the plan leaves the typecheck out without a `tsc`). */
export const touchesTs = (paths: readonly string[]): boolean => paths.some((p) => TS.test(p));

/** One line of git's pre-push stdin: `<local ref> <local sha> <remote ref> <remote sha>`. */
export interface PushedRef {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
}

export function parsePushStdin(text: string): PushedRef[] {
  return text
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .filter((f) => f.length === 4)
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({ localRef: localRef!, localSha: localSha!, remoteRef: remoteRef!, remoteSha: remoteSha! }));
}

function git(root: string, args: string[]): string | undefined {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

/** What `commit` is compared against: the remote's tip when it has one here, else @{upstream}, else the merge base with origin. */
export function baseFor(root: string, commit: string, remoteSha?: string): string | undefined {
  const known = (c: string | undefined) => (c && !ZERO.test(c) && git(root, ["cat-file", "-e", `${c}^{commit}`]) !== undefined ? c : undefined);
  return (
    known(remoteSha) ??
    known(git(root, ["rev-parse", "--verify", "--quiet", "@{upstream}"])) ??
    known(git(root, ["merge-base", commit, "refs/remotes/origin/HEAD"])) ??
    known(git(root, ["merge-base", commit, "refs/remotes/origin/main"]))
  );
}

export type Outcome = { check: Check; status: "pass" | "red" | "undetermined"; detail: string; seconds: number };

/** Map a check's exit to its outcome: 0 passes, 2 or a timeout is undetermined, any other is red. */
export function outcomeOf(check: Check, r: { status: number | null; error?: Error; signal?: string | null }, out: string, seconds: number, timeoutS: number): Outcome {
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT") return { check, status: "undetermined", detail: `ran past ${timeoutS}s`, seconds };
  if (r.error) return { check, status: "undetermined", detail: `could not start: ${r.error.message}`, seconds };
  if (r.status === 0) return { check, status: "pass", detail: "", seconds };
  if (r.status === 2 || r.status === null) return { check, status: "undetermined", detail: `exit ${r.status ?? r.signal} (could not determine)`, seconds };
  return { check, status: "red", detail: out.trim().split("\n").slice(-25).join("\n"), seconds };
}

const say = (line: string) => process.stderr.write(`precheck: ${line}\n`);

/** Run the precheck from `root`; the exit code for the hook. */
export function run(root: string, argv: readonly string[], stdin: string, env: NodeJS.ProcessEnv): number {
  if (env.CAT_PRECHECK === "0") return say("off (CAT_PRECHECK=0)"), 0;
  const timeoutS = Number(env.CAT_PRECHECK_TIMEOUT) > 0 ? Number(env.CAT_PRECHECK_TIMEOUT) : 90;
  const hook = argv.includes("--git-hook");
  const dry = argv.includes("--dry-run");

  let pkg: { scripts?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
  } catch {
    /* none */
  }
  if (typeof pkg.scripts?.cat !== "string" || !existsSync(join(root, "node_modules"))) {
    return say("this checkout is not set up (no `cat` runner or no node_modules), so no check ran; CI runs them"), 0;
  }

  const head = git(root, ["rev-parse", "HEAD"]);
  const refs = hook ? parsePushStdin(stdin).filter((r) => !ZERO.test(r.localSha)) : head ? [{ localRef: "HEAD", localSha: head, remoteRef: "", remoteSha: "" }] : [];
  if (refs.length === 0) return 0; // a delete, or nothing to push
  if (refs.some((r) => r.localSha !== head)) return say("the pushed commit is not HEAD, so the checks would judge another tree; none ran"), 0;
  if (git(root, ["diff", "--quiet", "HEAD", "--"]) === undefined) return say("tracked files differ from HEAD, so the checks would judge a tree that is not being pushed; none ran"), 0;

  const paths = new Set<string>();
  let unknownBase = false;
  for (const r of refs) {
    const base = baseFor(root, r.localSha, r.remoteSha);
    if (base === undefined) {
      unknownBase = true;
      continue;
    }
    for (const p of (git(root, ["diff", "--name-only", base, r.localSha]) ?? "").split("\n")) if (p) paths.add(p);
  }
  if (unknownBase) return say("no base to diff the push against (no upstream, no origin/main here), so no check ran; CI runs them"), 0;

  const tscPath = join(root, "node_modules", ".bin", "tsc");
  const tsc = existsSync(join(root, "tsconfig.json")) && existsSync(tscPath) ? tscPath : undefined;
  const plan = planFor([...paths], { tsc });
  if (touchesTs([...paths]) && tsc === undefined) say("TypeScript changed, but there is no tsconfig.json or node_modules/.bin/tsc here: the typecheck is left to CI");
  if (plan.length === 0) return 0; // nothing this push changed is checked here: silent, at once
  if (dry) {
    for (const c of plan) process.stdout.write(`${c.name}\t${c.why}\t${c.argv.join(" ")}\n`);
    return 0;
  }

  const outcomes: Outcome[] = [];
  for (const c of plan) {
    const t0 = Date.now();
    const r = spawnSync(c.argv[0]!, c.argv.slice(1), { cwd: root, encoding: "utf-8", timeout: timeoutS * 1000, env: { ...env, CAT_PRECHECK: "0" } });
    const o = outcomeOf(c, r, `${r.stdout ?? ""}${r.stderr ?? ""}`, Math.round((Date.now() - t0) / 1000), timeoutS);
    outcomes.push(o);
    say(`${o.status === "pass" ? "✓" : o.status === "red" ? "✗" : "?"} ${c.name} (${o.seconds}s; ${c.why})${o.status === "undetermined" ? ` — ${o.detail}; not a refusal` : ""}`);
  }
  const red = outcomes.filter((o) => o.status === "red");
  if (red.length === 0) return 0;
  for (const o of red) process.stderr.write(`\n── ${o.check.name} ──\n${o.detail}\n`);
  say(`refused: ${red.map((o) => o.check.name).join(", ")} red on what this push changes. Fix it, or push anyway with \`git push --no-verify\`.`);
  return 1;
}

if (import.meta.main) {
  const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]) ?? process.cwd();
  const stdin = process.argv.includes("--git-hook") ? readFileSync(0, "utf-8") : "";
  process.exit(run(root, process.argv.slice(2), stdin, process.env));
}
