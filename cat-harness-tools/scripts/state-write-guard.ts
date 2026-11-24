#!/usr/bin/env bun
/**
 * state-write-guard — refuse a commit or a push that would wipe a branch's
 * tree, above all a state branch's.
 *
 * @module scripts/state-write-guard
 * @graphNode none — a git and Claude Code hook, not a gate itself
 *
 * ## Why it exists
 *
 * On 2026-11-15 folio-assistant's `cat/cat-harness/beans` was wiped twice, by
 * 631aace4 (fa#3142) and e7d7e42 (fa#3144). Each was meant to edit one bean,
 * `php1`. Each was committed from a `git clone --no-checkout` of the branch
 * (the second also with a sparse-checkout cone) whose index held only that
 * one file, so `git commit` built a tree of that one file onto the full tip:
 * 1,872 files deleted, `manifest.json` among them, and `state:mount` failed
 * on every shard after the PR merged. `state:push` would not have done it (it
 * splices onto the tip's tree), but a sandbox that may push only `claude/`
 * branches writes the state branch through a pull request, by hand.
 *
 * A commit is built from the INDEX. A `--no-checkout` clone has none, and a
 * sparse checkout set up after it has none either; `git status` then reports
 * every file deleted, and `git commit` agrees.
 *
 * ## What it refuses
 *
 * A commit (the index against `HEAD`) or a pushed commit (against its first
 * parent) that:
 *
 * - deletes a root `manifest.json` — the file that makes a branch a state
 *   branch (`branch-store.ts`, `state-manifest/v1`);
 * - on a tree with a root `manifest.json`, deletes more than
 *   {@link DELETE_THRESHOLD} files;
 * - on any tree, deletes more than {@link DELETE_THRESHOLD} files AND at
 *   least half of the files there were.
 *
 * A file moved is not deleted: a path that is gone counts only when neither
 * its blob nor its file name turns up at a path that is new (an archive move
 * keeps the name).
 *
 * ## Where it runs
 *
 * - `--claude-hook`: the Claude Code `PreToolUse` hook on Bash
 *   (`git-hooks/claude-pre-push.sh`). It reads `git commit` and `git push` in
 *   the command line, follows `cd <dir>` and `git -C <dir>` to the repository
 *   they act in, and exits 2 to block the call. A scratch clone under `/tmp`
 *   has no hooks of its own, so this is the guard it meets.
 * - `--git-hook pre-commit` and `--git-hook pre-push <remote>`: git's own
 *   hooks, installed by `git-hooks/install.sh`.
 *
 * Unlike the pre-push gates it is never off: it reads trees only, so it costs
 * a few `ls-tree` calls.
 *
 * ## The bypass is explicit and logged
 *
 * `CAT_ALLOW_MASS_DELETE='<reason>' git commit ...` (or `git push`) lets it
 * through and appends the reason to `<git dir>/cat-gates/push.log`, as
 * `CAT_GATES_BYPASS` does for the gates.
 *
 * A guard that cannot read what it needs (no `HEAD`, an index `write-tree`
 * refuses, a source it cannot resolve) lets the call through: it refuses only
 * what it has determined.
 */
import { spawnSync } from "node:child_process";
import { basename, isAbsolute, resolve } from "node:path";

import { logPush } from "./gate-record.ts";

/** More deleted files than this, on a state branch, is a wipe until said otherwise. */
export const DELETE_THRESHOLD = 20;
/** The environment variable whose value is the reason a mass deletion is meant. */
export const BYPASS_ENV = "CAT_ALLOW_MASS_DELETE";
/** The root file that makes a branch a state branch (`branch-store.ts` `MANIFEST_FILE`). */
export const STATE_MANIFEST = "manifest.json";

const ZERO = /^0+$/;
/** How far back a push is walked for commits the remote may not hold. */
const MAX_PUSHED = 50;

interface Run {
  ok: boolean;
  out: string;
  err: string;
}

function git(dir: string, args: readonly string[], env?: NodeJS.ProcessEnv): Run {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf-8", maxBuffer: 1 << 28, env: env ?? process.env });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

/** Every file under `tree`, path → object id. Trees only: a blobless clone fetches nothing. */
export function filesOf(dir: string, tree: string): Map<string, string> | undefined {
  const r = git(dir, ["ls-tree", "-r", "-z", "--full-tree", tree]);
  if (!r.ok) return undefined;
  const out = new Map<string, string>();
  for (const l of r.out.split("\0")) {
    const tab = l.indexOf("\t");
    if (tab < 0) continue;
    out.set(l.slice(tab + 1), l.slice(0, tab).split(" ")[2]!);
  }
  return out;
}

/**
 * Paths of `before` that `after` does not hold and that were not moved: a
 * path counts as moved when its object, or its file name, is at a path new
 * in `after`.
 */
export function deletions(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): string[] {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const [p, id] of after) {
    if (before.has(p)) continue;
    ids.add(id);
    names.add(basename(p));
  }
  const out: string[] = [];
  for (const [p, id] of before) if (!after.has(p) && !ids.has(id) && !names.has(basename(p))) out.push(p);
  return out;
}

/** Why going from `before` to `after` is a wipe, or `[]` when it is not. */
export function wipeReasons(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>, threshold = DELETE_THRESHOLD): string[] {
  const gone = deletions(before, after);
  const state = before.has(STATE_MANIFEST);
  const reasons: string[] = [];
  if (state && !after.has(STATE_MANIFEST)) {
    reasons.push(`it deletes ${STATE_MANIFEST}, the file that makes this a state branch (\`state:mount\` refuses a branch without it)`);
  }
  const sample = gone.slice(0, 3).join(", ") + (gone.length > 3 ? ", ..." : "");
  if (state && gone.length > threshold) {
    reasons.push(`it deletes ${gone.length} of the ${before.size} files on a state branch, more than ${threshold} (${sample})`);
  } else if (!state && gone.length > threshold && gone.length * 2 >= before.size) {
    reasons.push(`it deletes ${gone.length} of the ${before.size} files in the tree, at least half of them (${sample})`);
  }
  return reasons;
}

/** What is unusual about the checkout at `dir`, for the refusal: sparse, partial, an index short of HEAD. */
export function checkoutShape(dir: string, env?: NodeJS.ProcessEnv): string[] {
  const out: string[] = [];
  if (git(dir, ["config", "--bool", "core.sparseCheckout"], env).out.trim() === "true") out.push("a sparse checkout (core.sparseCheckout)");
  const promisor = git(dir, ["config", "--get-regexp", "^(remote\\..*\\.partialclonefilter|extensions\\.partialclone)$"], env).out.trim();
  if (promisor !== "") out.push("a partial clone");
  const indexed = git(dir, ["ls-files"], env);
  const head = git(dir, ["ls-tree", "-r", "--name-only", "HEAD"], env);
  if (indexed.ok && head.ok) {
    const n = indexed.out.split("\n").filter(Boolean).length;
    const m = head.out.split("\n").filter(Boolean).length;
    if (n < m) out.push(`an index holding ${n} of HEAD's ${m} files${n === 0 ? " (a \`--no-checkout\` clone has no index)" : ""}`);
  }
  return out;
}

const REMEDY = [
  "A commit is built from the index, not from the files you touched. To change a few files on a state branch:",
  "  - use the branch store: `bun run cat state:push` (it splices onto the tip's tree), or",
  "  - commit from a full checkout of the branch, or `git read-tree HEAD` first in a `--no-checkout` clone, or",
  "  - commit the paths by name, `git commit -m ... -- <path>...`, which builds on HEAD's tree.",
  `If the deletion is meant, say why (it is logged): ${BYPASS_ENV}='<reason>' git ...`,
];

/**
 * The verdict on committing `dir`'s index onto `HEAD`: the refusal's lines,
 * or `undefined` to let it through. `all` is `git commit -a`, which also
 * stages the removal of tracked files missing from the working tree.
 */
export function judgeCommit(dir: string, opts: { all?: boolean; env?: NodeJS.ProcessEnv; threshold?: number } = {}): string[] | undefined {
  const head = git(dir, ["rev-parse", "--verify", "--quiet", "HEAD^{tree}"], opts.env);
  if (!head.ok) return undefined;
  const index = git(dir, ["write-tree"], opts.env);
  if (!index.ok) return undefined;
  const before = filesOf(dir, head.out.trim());
  const after = filesOf(dir, index.out.trim());
  if (before === undefined || after === undefined) return undefined;
  if (opts.all) {
    const missing = git(dir, ["ls-files", "--deleted", "-z"], opts.env);
    if (missing.ok) for (const p of missing.out.split("\0")) if (p) after.delete(p);
  }
  const reasons = wipeReasons(before, after, opts.threshold);
  if (reasons.length === 0) return undefined;
  const shape = checkoutShape(dir, opts.env);
  return [
    `🛑 This commit would wipe the branch: ${reasons.join("; and ")}.`,
    ...(shape.length ? [`The checkout is ${shape.join(", ")}.`] : []),
    ...REMEDY,
  ];
}

/** The commits `source` would push that the remote is not known to hold, newest first. */
export function pushedCommits(dir: string, source: string, remoteSha?: string): string[] {
  const have = remoteSha && !ZERO.test(remoteSha) && git(dir, ["cat-file", "-e", `${remoteSha}^{commit}`]).ok ? [`^${remoteSha}`] : ["--not", "--remotes"];
  const r = git(dir, ["rev-list", `--max-count=${MAX_PUSHED}`, source, ...have]);
  return r.ok ? r.out.split("\n").filter(Boolean) : [];
}

/** The verdict on pushing `sources`: the refusal's lines, or `undefined` to let it through. */
export function judgePush(dir: string, sources: ReadonlyArray<{ source: string; remoteSha?: string }>, threshold?: number): string[] | undefined {
  const found: string[] = [];
  for (const s of sources) {
    for (const c of pushedCommits(dir, s.source, s.remoteSha)) {
      const parent = git(dir, ["rev-parse", "--verify", "--quiet", `${c}^1^{tree}`]);
      if (!parent.ok) continue;
      const before = filesOf(dir, parent.out.trim());
      const after = filesOf(dir, `${c}^{tree}`);
      if (before === undefined || after === undefined) continue;
      const reasons = wipeReasons(before, after, threshold);
      if (reasons.length) {
        const subject = git(dir, ["log", "-1", "--format=%s", c]).out.trim();
        found.push(`  - ${c.slice(0, 12)} "${subject}": ${reasons.join("; and ")}`);
      }
    }
  }
  if (found.length === 0) return undefined;
  return [`🛑 This push carries a commit that would wipe the branch it lands on:`, ...found, ...REMEDY];
}

/** One `git commit` or `git push` in a shell command line, with the directory it runs in. */
export interface GitCall {
  dir: string;
  sub: "commit" | "push";
  args: string[];
  /** The `CAT_ALLOW_MASS_DELETE=` reason written on the command line, if any. */
  bypass?: string;
}

function unquote(s: string): string {
  return s.replace(/^'(.*)'$/s, "$1").replace(/^"(.*)"$/s, "$1");
}

/**
 * Every `git commit` and `git push` in `command`, each with the directory it
 * acts in: `cd <dir>` earlier in the line and `git -C <dir>` are followed,
 * from `cwd`. A reading of a command line, not a shell: what it cannot read
 * still meets git's own hooks where they are installed.
 */
export function gitCalls(command: string, cwd: string): GitCall[] {
  const calls: GitCall[] = [];
  let dir = cwd;
  for (const raw of command.split(/&&|\|\||[;|\n]/)) {
    const words = (raw.trim().replace(/^[({]\s*/, "").match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []).map((w) => w.replace(/[)}]+$/, ""));
    let i = 0;
    let bypass: string | undefined;
    while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]!) || words[i] === "env")) {
      const m = new RegExp(`^${BYPASS_ENV}=(.*)$`).exec(words[i]!);
      if (m) bypass = unquote(m[1]!);
      i++;
    }
    if ((words[i] === "cd" || words[i] === "pushd") && words[i + 1] !== undefined) {
      const to = unquote(words[i + 1]!).replace(/^~(?=\/|$)/, process.env.HOME ?? "~");
      dir = isAbsolute(to) ? to : resolve(dir, to);
      continue;
    }
    if (words[i] !== "git") continue;
    i++;
    let at = dir;
    while (i < words.length && words[i]!.startsWith("-")) {
      if (words[i] === "-C" && words[i + 1] !== undefined) {
        const to = unquote(words[i + 1]!);
        at = isAbsolute(to) ? to : resolve(at, to);
      }
      i += words[i] === "-C" || words[i] === "-c" ? 2 : 1;
    }
    const sub = words[i];
    if (sub !== "commit" && sub !== "push") continue;
    calls.push({ dir: at, sub, args: words.slice(i + 1).map(unquote), ...(bypass ? { bypass } : {}) });
  }
  return calls;
}

/** `git commit` options that take the next word as their value. */
const COMMIT_VALUED = new Set(["-m", "--message", "-F", "--file", "-C", "--reuse-message", "-c", "--reedit-message", "-t", "--template", "--author", "--date", "--fixup", "--squash", "--cleanup", "--trailer", "--pathspec-from-file"]);

/** Whether a `git commit` names paths (`--only`, git's default with paths), so is built on HEAD's tree. */
export function commitNamesPaths(args: readonly string[]): boolean {
  if (args.includes("-i") || args.includes("--include") || args.some((a) => a.startsWith("--pathspec-from-file"))) return false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k]!;
    if (a === "--") return k + 1 < args.length;
    // `-m msg`, and short flags run together ending in one that takes a value (`-am msg`).
    if (COMMIT_VALUED.has(a) || /^-[a-zA-Z]*[mFCct]$/.test(a)) {
      k++;
      continue;
    }
    if (!a.startsWith("-")) return true;
  }
  return false;
}

/** The refspec sources of a `git push`'s arguments; `HEAD` when it names none. */
export function pushSources(args: readonly string[]): string[] | undefined {
  if (args.some((a) => a === "--all" || a === "--mirror" || a === "--tags" || a === "-n" || a === "--dry-run" || a === "--delete" || a === "-d")) return undefined;
  const positional = args.filter((a) => !a.startsWith("-"));
  const refspecs = positional.slice(1);
  if (refspecs.length === 0) return ["HEAD"];
  return refspecs.map((s) => s.replace(/^\+/, "").split(":")[0]!).filter((s) => s !== "");
}

/** Judge one call; the refusal's lines, or `undefined`. */
export function judgeCall(call: GitCall, threshold?: number): string[] | undefined {
  if (!git(call.dir, ["rev-parse", "--git-dir"]).ok) return undefined;
  if (call.sub === "commit") {
    if (commitNamesPaths(call.args)) return undefined;
    return judgeCommit(call.dir, { all: call.args.includes("-a") || call.args.includes("--all") || call.args.some((a) => /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a) && !a.startsWith("--")), threshold });
  }
  const sources = pushSources(call.args);
  if (sources === undefined) return undefined;
  const resolved: Array<{ source: string }> = [];
  for (const s of sources) {
    const sha = git(call.dir, ["rev-parse", "--verify", "--quiet", `${s}^{commit}`]);
    if (sha.ok) resolved.push({ source: sha.out.trim() });
  }
  return resolved.length ? judgePush(call.dir, resolved, threshold) : undefined;
}

function say(lines: readonly string[]): void {
  process.stderr.write(lines.join("\n") + "\n");
}

/** A refusal let through on a stated reason, logged; the exit code to return. */
function bypassed(dir: string, reason: string, why: string[], ctx: Record<string, unknown>): number {
  let where = "(not logged: no git directory)";
  try {
    where = logPush(dir, { event: "bypass", via: "state-write-guard", reason, why: why[0], ...ctx });
  } catch {
    // The reason was stated; a log that cannot be written does not block it.
  }
  say([`state-write-guard: mass deletion let through — "${reason}" (logged to ${where})`, ...why.slice(0, 1)]);
  return 0;
}

export function claudeHook(text: string, env: NodeJS.ProcessEnv = process.env): number {
  let input: { tool_name?: string; tool_input?: { command?: string }; cwd?: string };
  try {
    input = JSON.parse(text);
  } catch {
    return 0;
  }
  const command = input.tool_input?.command;
  if (input.tool_name !== "Bash" || typeof command !== "string") return 0;
  for (const call of gitCalls(command, input.cwd ?? process.cwd())) {
    const why = judgeCall(call);
    if (why === undefined) continue;
    const reason = call.bypass ?? env[BYPASS_ENV];
    if (reason !== undefined && reason.trim() !== "") {
      bypassed(call.dir, reason, why, { via: "state-write-guard claude-hook", command });
      continue;
    }
    try {
      logPush(call.dir, { event: "refused", via: "state-write-guard claude-hook", why: why[0], command });
    } catch {
      // Refused either way.
    }
    say(why);
    return 2;
  }
  return 0;
}

function gitHook(kind: string, remote: string | undefined, stdin: string): number {
  const dir = process.cwd();
  let why: string[] | undefined;
  if (kind === "pre-commit") {
    why = judgeCommit(dir);
  } else if (kind === "pre-push") {
    const refs = stdin
      .split("\n")
      .map((l) => l.trim().split(/\s+/))
      .filter((f) => f.length === 4 && !ZERO.test(f[1]!))
      .map((f) => ({ source: f[1]!, remoteSha: f[3]! }));
    why = refs.length ? judgePush(dir, refs) : undefined;
  }
  if (why === undefined) return 0;
  const reason = process.env[BYPASS_ENV];
  if (reason !== undefined && reason.trim() !== "") return bypassed(dir, reason, why, { via: `state-write-guard ${kind}`, remote });
  say(why);
  return 1;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  let code = 0;
  try {
    if (argv[0] === "--claude-hook") code = claudeHook(await Bun.stdin.text());
    else if (argv[0] === "--git-hook" && (argv[1] === "pre-commit" || argv[1] === "pre-push")) code = gitHook(argv[1], argv[2], argv[1] === "pre-push" ? await Bun.stdin.text() : "");
    else {
      console.error("usage: state-write-guard.ts --claude-hook < tool-call.json | --git-hook pre-commit | --git-hook pre-push <remote> < refs");
      code = 2;
    }
  } catch (e) {
    // A guard that breaks must not block every commit: say so, let it through.
    console.error(`state-write-guard: could not judge (${(e as Error).message}); letting the call through`);
    code = 0;
  }
  process.exit(code);
}
