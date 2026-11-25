#!/usr/bin/env bun
/**
 * The CI cone. A pull request's CI skips a check whose inputs are unchanged
 * since main's last green run.
 *
 * @module scripts/ci-cone
 * @graphNode none — a CI helper behind `gate-shell.sh`, not a gate itself
 *
 * A check's inputs are DERIVED, never declared or inferred: its read set,
 * computed from the run itself and never stored as authored data. Every
 * check is a candidate, declared in `task-io` or not ({@link coneFingerprint}):
 *
 * 1. **Record (a push to main).** Every candidate check runs under
 *    `strace -f`. The files, directories and absent paths that run touched
 *    inside the checkout are its read set. They are recorded with the state of
 *    each one and the check's input fingerprint (script closure, audited
 *    environment, tool versions and `--against` baseline, but not the tree),
 *    in `build/ci-cone/records.json`. The workflow caches that file under
 *    main's sha.
 * 2. **Decide (a pull request).** The PR restores the record of its nearest
 *    main ancestor, re-computes the fingerprint and the state of every
 *    recorded path, and skips only on an exact match, saying
 *    `SKIPPED — inputs unchanged since <sha>`, never "passed".
 *
 * ## Wiring
 *
 * `gate-shell.sh` uses it once a gate job restores `build/ci-cone` (key
 * `ci-cone-v1-<job>-<base sha>`, restore-keys `ci-cone-v1-<job>-`), runs
 * `prepare`, and saves on a green push to main. `layer-pr-checks.yml` uses it
 * without `gate-shell.sh`: `.github/scripts/layer-pr-checks/run-gates.py`
 * asks {@link decideAll} once per shard (`decide-all`), records a cone skip
 * as SKIPPED with its sha (never an exit code), and on a push to the caller's
 * main runs each candidate that did not skip through `run`.
 *
 * ## Why an exact match is enough
 *
 * The verdict and its read set R come from the same run. A PR run with the
 * same code (the fingerprint hashes the import closure) and the same content
 * at every path in R starts in the same state; the input-site audit
 * (`input-sites.ts`) hashes or refuses every other input (environment, clock,
 * network, git history). So it reads the same R and gives the same answer.
 *
 * "The same code" is the static import closure, which the fingerprint hashes,
 * and every module the run loaded by a computed `import()` / `require()`,
 * which is in R: the run opened it. Which modules a computed load reaches is
 * decided by code and data the run read, so a module it did not load cannot
 * change its answer, and the fingerprint does not hash it (bean vgfp). The
 * audit still walks every module the declarations could name.
 *
 * A trace covers only the path that run took, so a run whose reads cannot be
 * enumerated is recorded as undetermined and always runs:
 * - a write inside the checkout;
 * - a relative path whose directory the trace does not name;
 * - a syscall this parser does not classify;
 * - more than {@link MAX_PATHS} paths;
 * - a `tree` site (git's view of the tree, refused for any input set
 *   narrower than `{tracked}`);
 * - a `traced` input site the run reached.
 *
 * ## Left out of a read set
 *
 * - **Paths outside the checkout** (system libraries, `/tmp`, the bun install
 *   cache): the environment, covered by the hashed versions and variables.
 * - **The top-level `node_modules/`**: pinned by `bun.lock`, which every
 *   fingerprint hashes, and CI installs with `--frozen-lockfile`. A NESTED
 *   `node_modules` is read like any other directory.
 * - **`.git/` read by a `git` process**: an audited input site (`head`,
 *   `refs`) or refused (`tree`). The script's own reads of `.git` are kept.
 * - **This module's own directory and the input-hash cache.**
 *
 * A directory the run only opened, stat'ed or resolved names inside, and never
 * listed (`getdents64`), has the state {@link OPENED_DIR}; only a directory
 * whose entries the run read keeps its sorted entry listing.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, lstatSync, statSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import {
  againstRefsOf,
  checkFingerprint,
  entryFiles,
  FileDigests,
  fingerprint,
  qaBaselineIdentity,
  RECIPE_VERSION,
  type BaselineResolver,
  type Fingerprint,
  type PairIO,
} from "./input-hash.ts";
import { inputSiteReached, openTrace } from "../schemas/sdlc/input-trace.ts";
import { isProjection, projectedState, type ProjectionName } from "../schemas/sdlc/read-projections.ts";
import { collectTaskIo } from "./task-io.ts";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { findReusable, putResult, STORE_DIR } from "./result-store.ts";
import { testFilesUnder, testPreloads } from "./affected-tests.ts";
import { auditClosure, scanSource, siteProblem, type SiteVerdict } from "./input-sites.ts";
import { auditPython } from "./input-sites-py.ts";

/** Bump when the parser or the read-set rules change. A record from another version is ignored, so every check runs. */
export const TRACER_VERSION = 4;

/** Where the records live, relative to the checkout. `build/` is git-ignored, and the workflow caches this directory. */
// input-site: inert #ff0c6593 — the cone's own records directory, which every read set leaves out
export const CONE_DIR = join("build", "ci-cone");
export const RECORD_FILE = join(CONE_DIR, "records.json");

/** A read set larger than this is not enumerated: the check is recorded as undetermined. */
export const MAX_PATHS = 20000;

/**
 * The same bound for a WRITER's record (`collect` mode). Site generators walk
 * whole trees: library:viz touched 35,554 paths and external-schemas:viz
 * 49,518 (writer-records run 41205872016). A record is kept beside the build,
 * not in every check's cone file, so it can carry more.
 */
export const MAX_WRITER_PATHS = 200000;

/**
 * A trace file larger than this is not parsed: the check is recorded as
 * undetermined. Measured 2026-10-07: `kg:audit:all:check` spawns a process
 * per layer, and parsing its whole trace in memory aborted the recorder
 * (exit 134) after the check itself had passed.
 */
export const MAX_TRACE_BYTES = 512 * 1024 * 1024;

/** What `strace` traces: every path-taking syscall, `getcwd`, directory listings, and process creation for the cwd of each child. */
export const STRACE_ARGS = ["-f", "-qq", "-y", "-s", "65536", "-e", "trace=%file,getcwd,getdents,getdents64,clone,clone3,fork,vfork", "-e", "signal=none"] as const;

/** One git command a traced run executed: where, and with what arguments (after `git`). */
export interface GitCall {
  /** Repo-relative directory it ran in (`""` for the root). */
  cwd: string;
  args: string[];
}

/**
 * `listed`: the read paths whose directory entries the run read (`getdents`).
 * A read directory NOT in it was only opened, so its state is {@link OPENED_DIR}.
 */
export type ReadSet =
  | {
      paths: string[];
      git: GitCall[];
      listed?: string[];
      writes?: string[];
      absentBefore?: string[];
      rewritten?: string[];
      /** How many times each path asked for in `countOpens` was opened for reading. */
      opened?: Record<string, number>;
      /** The programs a CHILD of the traced command exec'd (absolute paths, sorted); left out when none. */
      children?: string[];
      /** The code children ran from their command line (`python3 -c`, `bun -e`); `null` for a script read from stdin, which no trace shows. */
      inline?: { program: string; code: string | null }[];
      /** Files outside the checkout under a `site-packages` / `dist-packages` directory the run read: installed Python packages. */
      external?: string[];
    }
  | { undetermined: string };

/** The calls that open a path, whose count {@link parseTrace} gives for `countOpens`. */
const OPEN_CALLS = new Set(["open", "openat", "openat2"]);

/**
 * Git subcommands the cone may REPLAY on a PR to ask git's view of the tree
 * again (a `tree` site). Each only reads, and takes no input on stdin. Any
 * other git command a run executes makes its read set undetermined.
 */
const GIT_READ_ONLY = new Set([
  "ls-files", "ls-tree", "rev-parse", "cat-file", "show", "log", "rev-list", "merge-base", "for-each-ref",
  "show-ref", "describe", "name-rev", "diff", "diff-tree", "check-ignore", "config", "grep", "version",
  // Read-only only in the forms let through below: `remote get-url`, `hash-object` without -w.
  "remote", "hash-object",
]);

/**
 * The replayable form of a git command line, or why it is not one. Global
 * options are `-C <dir>` (folded into the cwd), `-c <k=v>`, `--no-pager` and
 * `--no-optional-locks`; anything else before the subcommand is refused.
 */
export function gitReplayable(
  cwd: string,
  argv: readonly string[],
  relOrRoots?: ((abs: string) => string | undefined) | readonly string[],
): GitCall | { undetermined: string } {
  const rel = typeof relOrRoots === "function" ? relOrRoots : Array.isArray(relOrRoots) ? (abs: string) => repoRelative(relOrRoots, abs) : undefined;
  let dir = cwd;
  let i = 0;
  const args: string[] = [];
  for (; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-C") {
      const next = argv[++i];
      if (next === undefined) return { undetermined: "git -C with no directory" };
      if (next.startsWith("/")) {
        // An absolute -C (src/core/git-refs.ts passes the root): repo-relative, or refused.
        const r = rel?.(normalize(next).replace(/(.)\/+$/, "$1"));
        if (r === undefined) return { undetermined: `git -C outside the checkout (${next})` };
        dir = r;
        continue;
      }
      dir = normalize(join(dir === "" ? "." : dir, next)).replace(/^\.$/, "");
      continue;
    }
    if (a === "-c") {
      const next = argv[++i];
      if (next === undefined) return { undetermined: "git -c with no value" };
      args.push(a, next);
      continue;
    }
    if (a === "--no-pager" || a === "--no-optional-locks") {
      args.push(a);
      continue;
    }
    if (a.startsWith("-")) return { undetermined: `git global option ${a}` };
    break;
  }
  const sub = argv[i];
  if (sub === undefined) return { undetermined: "git with no subcommand" };
  const rest = argv.slice(i + 1);
  if (!GIT_READ_ONLY.has(sub)) return { undetermined: `git ${sub} is not a read-only command the cone replays` };
  if (rest.some((a) => /^--(stdin|batch|output|ext-diff|textconv|edit)/.test(a))) return { undetermined: `git ${sub} ${rest.join(" ")} reads stdin, writes or runs a helper` };
  if (sub === "config" && !rest.some((a) => /^(--get|--get-all|--get-regexp|--list|-l)$/.test(a))) return { undetermined: "git config without a read flag" };
  if (sub === "remote" && rest[0] !== "get-url") return { undetermined: `git remote ${rest[0] ?? ""} is not a read-only command the cone replays` };
  if (sub === "hash-object" && rest.includes("-w")) return { undetermined: "git hash-object -w writes an object" };
  if (dir.startsWith("..") || dir.startsWith("/")) return { undetermined: `git -C outside the checkout (${dir})` };
  return { cwd: dir, args: [...args, sub, ...rest] };
}

// ── Parsing a trace ─────────────────────────────────────────────────────────

const WRITE_FLAGS = /\b(O_WRONLY|O_RDWR|O_CREAT|O_TRUNC|O_APPEND|O_TMPFILE)\b/;

/**
 * Where each syscall names a path: `[dirfdIndex | -1, pathIndex]` pairs, and
 * whether the syscall WRITES there. A `%file` syscall not in this table makes
 * the read set undetermined. An unknown syscall is never assumed harmless.
 */
const SYSCALLS: Readonly<Record<string, { paths: readonly (readonly [number, number])[]; write: boolean | "flags" }>> = {
  open: { paths: [[-1, 0]], write: "flags" },
  openat: { paths: [[0, 1]], write: "flags" },
  openat2: { paths: [[0, 1]], write: "flags" },
  creat: { paths: [[-1, 0]], write: true },
  stat: { paths: [[-1, 0]], write: false },
  lstat: { paths: [[-1, 0]], write: false },
  stat64: { paths: [[-1, 0]], write: false },
  lstat64: { paths: [[-1, 0]], write: false },
  newfstatat: { paths: [[0, 1]], write: false },
  fstatat64: { paths: [[0, 1]], write: false },
  statx: { paths: [[0, 1]], write: false },
  access: { paths: [[-1, 0]], write: false },
  faccessat: { paths: [[0, 1]], write: false },
  faccessat2: { paths: [[0, 1]], write: false },
  readlink: { paths: [[-1, 0]], write: false },
  readlinkat: { paths: [[0, 1]], write: false },
  statfs: { paths: [[-1, 0]], write: false },
  getxattr: { paths: [[-1, 0]], write: false },
  lgetxattr: { paths: [[-1, 0]], write: false },
  listxattr: { paths: [[-1, 0]], write: false },
  llistxattr: { paths: [[-1, 0]], write: false },
  inotify_add_watch: { paths: [[-1, 1]], write: false },
  execve: { paths: [[-1, 0]], write: false },
  execveat: { paths: [[0, 1]], write: false },
  chdir: { paths: [[-1, 0]], write: false },
  mkdir: { paths: [[-1, 0]], write: true },
  mkdirat: { paths: [[0, 1]], write: true },
  rmdir: { paths: [[-1, 0]], write: true },
  unlink: { paths: [[-1, 0]], write: true },
  unlinkat: { paths: [[0, 1]], write: true },
  rename: { paths: [[-1, 0], [-1, 1]], write: true },
  renameat: { paths: [[0, 1], [2, 3]], write: true },
  renameat2: { paths: [[0, 1], [2, 3]], write: true },
  link: { paths: [[-1, 0], [-1, 1]], write: true },
  linkat: { paths: [[0, 1], [2, 3]], write: true },
  symlink: { paths: [[-1, 1]], write: true },
  symlinkat: { paths: [[1, 2]], write: true },
  chmod: { paths: [[-1, 0]], write: true },
  fchmodat: { paths: [[0, 1]], write: true },
  fchmodat2: { paths: [[0, 1]], write: true },
  chown: { paths: [[-1, 0]], write: true },
  lchown: { paths: [[-1, 0]], write: true },
  fchownat: { paths: [[0, 1]], write: true },
  truncate: { paths: [[-1, 0]], write: true },
  utime: { paths: [[-1, 0]], write: true },
  utimes: { paths: [[-1, 0]], write: true },
  utimensat: { paths: [[0, 1]], write: true },
  futimesat: { paths: [[0, 1]], write: true },
  mknod: { paths: [[-1, 0]], write: true },
  mknodat: { paths: [[0, 1]], write: true },
  setxattr: { paths: [[-1, 0]], write: true },
  lsetxattr: { paths: [[-1, 0]], write: true },
  removexattr: { paths: [[-1, 0]], write: true },
  lremovexattr: { paths: [[-1, 0]], write: true },
};

/** Syscalls that are traced for the cwd bookkeeping only. */
const PROCESS_CALLS = new Set(["clone", "clone3", "fork", "vfork", "getcwd", "fchdir"]);
/** Directory listings: they take an fd, which `-y` prints with its path. */
const LIST_CALLS = new Set(["getdents", "getdents64"]);

/** Split a syscall's argument list at top-level commas, respecting quotes and brackets. */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      cur += c;
      if (c === "\\") {
        cur += s[++i] ?? "";
      } else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "(" || c === "[" || c === "{" || c === "<") depth++;
    else if (c === ")" || c === "]" || c === "}" || c === ">") depth--;
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim() !== "") out.push(cur.trim());
  return out;
}

/** The C-escaped string literal strace printed, decoded; `undefined` when the argument is not a string. */
export function unquote(arg: string): string | undefined {
  const m = /^"((?:[^"\\]|\\.)*)"(\.\.\.)?$/.exec(arg);
  if (m === null || m[2] !== undefined) return undefined; // `...` = truncated: not a whole path
  return m[1]!.replace(/\\(x[0-9a-fA-F]{2}|[0-7]{1,3}|.)/g, (_, e: string) => {
    if (e[0] === "x") return String.fromCharCode(parseInt(e.slice(1), 16));
    if (/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8));
    return ({ n: "\n", t: "\t", r: "\r", v: "\v", f: "\f" } as Record<string, string>)[e] ?? e;
  });
}

/** The path a `-y` fd decoration names: `AT_FDCWD</x>` or `5</x>` gives `/x`. */
function fdPath(arg: string): string | undefined {
  const m = /^(?:AT_FDCWD|-?\d+)<(.*)>$/.exec(arg);
  return m === null ? undefined : m[1];
}

interface Call {
  pid: number;
  name: string;
  args: string[];
  ret: string;
}

/** Join `<unfinished ...>` with its `<... resumed>`, in the order the calls STARTED. */
function calls(text: string): Call[] | { undetermined: string } {
  const pending = new Map<number, { index: number; head: string }>();
  const done: { index: number; line: string; pid: number }[] = [];
  let index = 0;
  let pos = 0;
  while (pos <= text.length) {
    const nl = text.indexOf("\n", pos);
    const raw = nl === -1 ? text.slice(pos) : text.slice(pos, nl);
    pos = nl === -1 ? text.length + 1 : nl + 1;
    const line = raw.trimEnd();
    if (line === "") continue;
    const m = /^(\d+)\s+(.*)$/.exec(line);
    if (m === null) continue;
    const pid = Number(m[1]);
    const body = m[2]!;
    if (body.startsWith("+++") || body.startsWith("---")) continue; // exit and signal notes
    // strace lost a thread mid-syscall as its process exited. When it could
    // not even read the syscall number (`???`), nothing it could name is left;
    // when it already printed the call's arguments, `<detached ...>` closes
    // them without a return value, the same as an `<unfinished ...>` at exit.
    if (body.startsWith("???(") || body.startsWith("<... ??? resumed>")) continue;
    const resumed = /^<\.\.\. (\w+) resumed>(.*)$/.exec(body);
    if (resumed !== null) {
      const p = pending.get(pid);
      if (p === undefined) {
        if (/\s*<detached \.\.\.>$/.test(resumed[2]!) || (!(resumed[1]! in SYSCALLS) && !PROCESS_CALLS.has(resumed[1]!) && !LIST_CALLS.has(resumed[1]!))) continue;
        return { undetermined: `pid ${pid}: a resumed ${resumed[1]} with no start` };
      }
      pending.delete(pid);
      const rest = resumed[2]!.replace(/\s*<detached \.\.\.>$/, ") = ?");
      done.push({ index: p.index, line: p.head + rest, pid });
      continue;
    }
    const unfinished = /^(.*?)\s*<unfinished \.\.\.>$/.exec(body);
    if (unfinished !== null) {
      pending.set(pid, { index: index++, head: unfinished[1]! });
      continue;
    }
    const detached = /^(.*?)\s*<detached \.\.\.>$/.exec(body);
    if (detached !== null) {
      const head = detached[1]!.trim();
      if (head !== "") done.push({ index: index++, line: /\)\s+=\s+/.test(head) ? head : `${head}) = ?`, pid });
      continue;
    }
    done.push({ index: index++, line: body, pid });
  }
  // A call left unfinished when its process died has no result, but its
  // arguments are known, and that is all a read set needs.
  for (const [pid, p] of pending) done.push({ index: p.index, line: `${p.head}) = ?`, pid });
  done.sort((a, b) => a.index - b.index);
  const out: Call[] = [];
  for (const d of done) {
    if (d.line.startsWith("???(")) continue;
    const m = /^(\w+)\((.*)\)\s+=\s+(.*)$/.exec(d.line);
    if (m === null) return { undetermined: `unparsed trace line: ${d.line.slice(0, 160)}` };
    out.push({ pid: d.pid, name: m[1]!, args: splitArgs(m[2]!), ret: m[3]! });
  }
  return out;
}

/**
 * The repo-relative paths a traced run touched, or why they cannot be
 * enumerated. `root` is the checkout; paths outside it are left out (see the
 * module comment for why, and for the other exclusions).
 */
export function parseTrace(
  text: string,
  root: string,
  opts: {
    writes?: "refuse" | "collect";
    /** `collect` mode: the writer's DECLARED outputs. Re-reading one before rewriting it (write-if-changed) is not an input. */
    ownOutput?: (rel: string) => boolean;
    /**
     * A path the writer read and then rewrote that no writer declares and no
     * earlier writer wrote: it is kept as an input, with its state AFTER the
     * run. A later run skips only when the path already holds what this run
     * left there, so a rewrite that changed it makes the next run rerun.
     */
    rewriteAsInput?: (rel: string) => boolean;
    /** Paths whose successful opens for reading are counted into `opened` (`read-projections.ts`). */
    countOpens?: ReadonlySet<string>;
    /**
     * `count`: a git command the cone cannot replay (`--git-dir=`, a write
     * subcommand) is counted in `git` as it was run, not refused. For what a
     * run TOUCHED only: its syscalls still name every path it wrote, and
     * `git` makes any neighbour's write a clash. A record never uses it.
     */
    gitUnreplayable?: "refuse" | "count";
  } = {},
): ReadSet {
  const parsed = calls(text);
  if ("undetermined" in parsed) return parsed;
  const roots = [...new Set([resolve(root), safeRealpath(root)])];
  /** Each process's cwd, shared by the tasks created with CLONE_FS (threads). */
  const cwd = new Map<number, { dir: string | undefined }>();
  /** The pids that exec'd `git`, whose reads of `.git` are git's answer, not the script's. */
  const gitPids = new Set<number>();
  /**
   * The directories outside the checkout this run created (a successful
   * `mkdir`, as `mkdtempSync` makes one). A git command run in one is the
   * run's own scratch repository: what it answers is what the run wrote
   * there, so it is neither replayed nor refused, and its reads inside the
   * checkout, `.git` included, are kept like any other process's.
   */
  const scratch = new Set<string>();
  const inScratch = (dir: string) => [...scratch].some((s) => dir === s || dir.startsWith(`${s}/`));
  const cell = (pid: number) => {
    let c = cwd.get(pid);
    if (c === undefined) {
      c = { dir: undefined };
      cwd.set(pid, c);
    }
    return c;
  };
  const paths = new Set<string>();
  /** Paths whose entries the run read. */
  const listed = new Set<string>();
  const git = new Map<string, GitCall>();
  const writes: string[] = [];
  /** `collect` mode: paths the run wrote, and the first access to each path ("read" / "absent" / "write"). */
  const wrote = new Set<string>();
  const first = new Map<string, "read" | "absent" | "write">();
  const opened = new Map<string, number>();
  /** The first process in the trace is the command itself; every other execve is a child's. */
  const top = parsed[0]?.pid;
  const children = new Set<string>();
  const inline = new Map<string, { program: string; code: string | null }>();
  const external = new Set<string>();
  for (const c of parsed) {
    const me = cell(c.pid);
    for (const a of c.args) {
      if (a.startsWith("AT_FDCWD<")) me.dir = fdPath(a);
    }
    if (c.name === "getcwd") {
      const p = c.args[0] === undefined ? undefined : unquote(c.args[0]);
      if (p !== undefined && /^\d+$/.test(c.ret)) me.dir = p;
      continue;
    }
    if (c.name === "fchdir") {
      if (/^0\b/.test(c.ret)) me.dir = fdPath(c.args[0] ?? "");
      continue;
    }
    if (c.name === "clone" || c.name === "clone3" || c.name === "fork" || c.name === "vfork") {
      const child = /^(\d+)/.exec(c.ret);
      if (child === null) continue;
      const shared = c.args.some((a) => /\bCLONE_FS\b/.test(a));
      cwd.set(Number(child[1]), shared ? me : { dir: me.dir });
      continue;
    }
    if (LIST_CALLS.has(c.name)) {
      const dir = fdPath(c.args[0] ?? "");
      if (dir === undefined) return { undetermined: `${c.name}: a directory fd strace did not name (${(c.args[0] ?? "").slice(0, 80)})` };
      const rel = repoRelative(roots, normalize(dir).replace(/(.)\/+$/, "$1"));
      if (rel === undefined || excluded(rel, gitPids.has(c.pid))) continue;
      listed.add(rel);
      paths.add(rel);
      if (opts.writes === "collect" && !first.has(rel)) first.set(rel, "read");
      continue;
    }
    const spec = SYSCALLS[c.name];
    if (spec === undefined) {
      if (PROCESS_CALLS.has(c.name)) continue;
      return { undetermined: `unclassified syscall ${c.name}` };
    }
    let write = spec.write === true || (spec.write === "flags" && c.args.some((a) => WRITE_FLAGS.test(a)));
    // A WRITER's write that failed changed nothing: `mkdir -p` meeting a
    // directory that exists (EEXIST) only learnt that it exists. It is a probe.
    if (write && opts.writes === "collect" && /^-1 [A-Z]/.test(c.ret)) write = false;
    for (const [fdIndex, pathIndex] of spec.paths) {
      const raw = c.args[pathIndex];
      if (raw === undefined || raw === "NULL") continue;
      const p = unquote(raw);
      if (p === undefined) return { undetermined: `${c.name}: a path strace did not print whole (${raw.slice(0, 80)})` };
      let abs: string;
      if (p === "") {
        continue; // AT_EMPTY_PATH: the fd itself, already recorded when it was opened
      } else if (p.startsWith("/")) {
        abs = normalize(p).replace(/(.)\/+$/, "$1");
      } else {
        const base = fdIndex >= 0 ? fdPath(c.args[fdIndex] ?? "") : me.dir;
        if (base === undefined) return { undetermined: `${c.name}("${p}") from pid ${c.pid}: relative to a directory the trace does not name` };
        abs = normalize(join(base, p)).replace(/(.)\/+$/, "$1");
      }
      if (c.name === "execve" && c.pid !== top && /^0\b/.test(c.ret)) {
        children.add(abs);
        const argv = arrayArg(c.args[1] ?? "");
        if (argv === undefined) return { undetermined: `a child's command line strace did not print whole (${(c.args[1] ?? "").slice(0, 80)})` };
        const code = inlineCodeOf(abs, argv);
        if (code !== undefined) inline.set(JSON.stringify([abs, code]), { program: abs, code });
      }
      if ((c.name === "mkdir" || c.name === "mkdirat") && /^0\b/.test(c.ret) && repoRelative(roots, abs) === undefined) scratch.add(abs);
      if (c.name === "execve" && /(^|\/)git$/.test(abs) && /^0\b/.test(c.ret)) {
        const argv = arrayArg(c.args[1] ?? "");
        if (argv === undefined) return { undetermined: `a git command line strace did not print whole (${(c.args[1] ?? "").slice(0, 80)})` };
        const where = me.dir === undefined ? undefined : repoRelative(roots, me.dir);
        // The run's own scratch repository: an ordinary process, its reads kept.
        if (where === undefined && me.dir !== undefined && inScratch(me.dir)) continue;
        gitPids.add(c.pid);
        if (where === undefined) return { undetermined: `git ${argv.slice(1).join(" ")} ran outside the checkout, or where the trace does not say` };
        const call = gitReplayable(where, argv.slice(1), (abs) => repoRelative(roots, abs));
        if ("undetermined" in call) {
          if (opts.gitUnreplayable !== "count") return call;
          const asRun: GitCall = { cwd: where, args: argv.slice(1) };
          git.set(JSON.stringify(asRun), asRun);
        } else git.set(JSON.stringify(call), call);
      }
      if (c.name === "chdir") {
        if (/^0\b/.test(c.ret)) me.dir = abs;
        write = false;
      }
      const rel = repoRelative(roots, abs);
      if (rel === undefined && !write && SITE_PACKAGES_RE.test(abs) && /^\d/.test(c.ret)) external.add(abs);
      if (rel === undefined || excluded(rel, gitPids.has(c.pid))) continue;
      if (write) writes.push(`${c.name} ${rel || "."}`);
      else paths.add(rel);
      if (!write && opts.countOpens?.has(rel) && OPEN_CALLS.has(c.name) && /^\d/.test(c.ret)) opened.set(rel, (opened.get(rel) ?? 0) + 1);
      // A watch learns of every entry that comes and goes: judge it as a listing.
      if (c.name === "inotify_add_watch") listed.add(rel);
      const effectiveWrite = write && !/^-1\b/.test(c.ret);
      if (opts.writes === "collect" && !first.has(rel)) {
        if (effectiveWrite) first.set(rel, "write");
        else if (!write) first.set(rel, /^-1 ENOENT\b/.test(c.ret) ? "absent" : "read");
      }
      if (opts.writes === "collect" && effectiveWrite) wrote.add(rel);
    }
  }
  if (opts.writes === "collect") {
    // A WRITER: what it wrote is its output, not its input. A path it first saw
    // absent and then created was absent before the run, which is a fact the
    // next run can check. A path it read while it existed and then rewrote is
    // an input nobody can replay (its prior content is gone), so it refuses.
    const absentBefore: string[] = [];
    for (const rel of wrote) {
      const f = first.get(rel);
      // Its own declared output, read back before it is rewritten: the run
      // compares with, or extends, what it last wrote. A skip puts exactly
      // that back, and the dry run checks every output after a full build.
      if (f === "read" && !opts.ownOutput?.(rel)) {
        if (opts.rewriteAsInput?.(rel)) continue;
        return { undetermined: `the writer reads ${rel || "."} and then rewrites it` };
      }
      paths.delete(rel);
      if (f === "absent") absentBefore.push(rel);
    }
    // What it reads inside its own declared outputs is what it last wrote, and
    // a skip restores exactly that: not an input.
    if (opts.ownOutput !== undefined) for (const p of [...paths]) if (opts.ownOutput(p)) paths.delete(p);
    if (paths.size > MAX_WRITER_PATHS) return { undetermined: `the run touched ${paths.size} paths, more than ${MAX_WRITER_PATHS}` };
    const rewritten = [...wrote].filter((rel) => first.get(rel) === "read" && !opts.ownOutput?.(rel));
    const kept = [...wrote].filter((rel) => !rewritten.includes(rel));
    return {
      paths: [...paths].sort(),
      git: [...git.values()],
      ...listedOf(listed, paths),
      writes: kept.sort(),
      absentBefore: absentBefore.sort(),
      ...(rewritten.length ? { rewritten: rewritten.sort() } : {}),
      ...(opts.countOpens ? { opened: Object.fromEntries([...opts.countOpens].map((p) => [p, opened.get(p) ?? 0])) } : {}),
    };
  }
  if (writes.length > 0) return { undetermined: `the check writes inside the checkout (${writes.slice(0, 3).join(", ")})` };
  if (paths.size > MAX_PATHS) return { undetermined: `the run touched ${paths.size} paths, more than ${MAX_PATHS}` };
  return {
    paths: [...paths].sort(),
    git: [...git.values()],
    ...listedOf(listed, paths),
    ...(children.size ? { children: [...children].sort() } : {}),
    ...(inline.size ? { inline: [...inline.keys()].sort().map((k) => inline.get(k)!) } : {}),
    ...(external.size ? { external: [...external].sort() } : {}),
  };
}

/** A directory Python installs packages in. A file read under one is an input the checkout does not hold. */
const SITE_PACKAGES_RE = /\/(?:site|dist)-packages\//;

/** A Python interpreter, by the name it was exec'd under. */
const PYTHON_RE = /(?:^|\/)python(?:3(?:\.\d+)?)?$/;

/**
 * The code a child ran from its command line, which no file in the read set
 * holds: `python3 -c <code>`, `bun` / `node` `-e` / `-p <code>`. `null` for a
 * Python script read from stdin (no script argument, or `-`), whose text no
 * trace shows. `undefined` when the child ran a file, or `-m` a module.
 */
export function inlineCodeOf(program: string, argv: readonly string[]): string | null | undefined {
  const args = argv.slice(1);
  if (PYTHON_RE.test(program)) {
    for (let i = 0; i < args.length; i++) {
      const a = args[i]!;
      if (a === "-c") return args[i + 1] ?? "";
      if (/^-[A-Za-z]*c/.test(a) && !a.startsWith("--")) return a.slice(a.indexOf("c") + 1) || (args[i + 1] ?? "");
      if (a === "-m") return undefined;
      if (a === "-W" || a === "-X") {
        i++;
        continue;
      }
      if (a.startsWith("-") && a !== "-") continue;
      return a === "-" ? null : undefined;
    }
    return null; // no script: it reads one from stdin
  }
  if (JS_RUNTIME_RE.test(program)) {
    const i = args.findIndex((a) => a === "-e" || a === "--eval" || a === "-p" || a === "--print");
    return i < 0 ? undefined : (args[i + 1] ?? "");
  }
  return undefined;
}

/** `{ listed }` for the read paths that were listed, left out when there are none. */
function listedOf(listed: ReadonlySet<string>, paths: ReadonlySet<string>): { listed?: string[] } {
  const l = [...listed].filter((p) => paths.has(p)).sort();
  return l.length ? { listed: l } : {};
}

/** An `execve` argv array as strace prints it, or `undefined` when any element was cut short. */
function arrayArg(arg: string): string[] | undefined {
  const m = /^\[(.*)\]$/.exec(arg);
  if (m === null) return undefined;
  const out: string[] = [];
  for (const a of splitArgs(m[1]!)) {
    const u = unquote(a);
    if (u === undefined) return undefined;
    out.push(u);
  }
  return out;
}

function safeRealpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

function repoRelative(roots: readonly string[], abs: string): string | undefined {
  for (const r of roots) {
    if (abs === r) return "";
    if (abs.startsWith(`${r}/`)) return abs.slice(r.length + 1);
  }
  return undefined;
}

/** The exclusions the module comment gives reasons for. */
export function excluded(rel: string, byGit: boolean): boolean {
  if (rel === "node_modules" || rel.startsWith("node_modules/")) return true;
  if (rel === CONE_DIR || rel.startsWith(`${CONE_DIR}/`)) return true;
  if (rel === STORE_DIR || rel.startsWith(`${STORE_DIR}/`)) return true;
  // input-site: inert #6e4de56e — the input-hash cache directory, which every read set leaves out
  const cacheDir = join("build", "regen-cache");
  if (rel === cacheDir || rel.startsWith(`${cacheDir}/`)) return true;
  if (byGit && /(^|\/)\.git(\/|$)/.test(rel)) return true;
  // Python's bytecode cache: a .pyc is used only while it matches its source,
  // which the read set holds, so it is neither an input nor an output.
  if (PYCACHE_RE.test(rel)) return true;
  return false;
}

/** A path inside a Python `__pycache__` directory, or the directory itself. */
const PYCACHE_RE = /(^|\/)__pycache__(\/|$)/;

// ── The state of a path ─────────────────────────────────────────────────────

/**
 * What a path holds now, as one string: `absent`, a directory's sorted entry
 * names, a symlink's target with what it resolves to, or a file's content
 * digest. A path the run only `stat`ed is hashed by content too, so a size or
 * type it read cannot change unnoticed.
 */
export function pathState(root: string, rel: string, digests: FileDigests, opts: { listed?: boolean } = {}): string {
  const abs = rel === "" ? root : join(root, rel);
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    return "absent";
  }
  if (st.isSymbolicLink()) {
    let target = "?";
    try {
      target = readlinkSync(abs);
    } catch {
      /* raced away */
    }
    let resolved = "dangling";
    try {
      resolved = statState(abs, rel, digests, opts.listed ?? true);
    } catch {
      /* dangling link */
    }
    return `link ${target} -> ${resolved}`;
  }
  return statState(abs, rel, digests, opts.listed ?? true);
}

/** The state of a directory the run opened and never listed: only that it is one. */
export const OPENED_DIR = "dir";

/** The state a read path is recorded with: a directory's listing only when the run read its entries. */
export function readState(root: string, rel: string, digests: FileDigests, listed: ReadonlySet<string> | undefined, projection?: ProjectionName): string {
  if (projection !== undefined) {
    const p = projectedFileState(root, rel, projection);
    if (p !== undefined) return p;
  }
  return pathState(root, rel, digests, { listed: listed === undefined || listed.has(rel) });
}

/** A regular file's {@link projectedState}, or `undefined` for anything else (which is then judged in full). */
function projectedFileState(root: string, rel: string, projection: ProjectionName): string | undefined {
  const abs = rel === "" ? root : join(root, rel);
  try {
    if (!lstatSync(abs).isFile()) return undefined;
    return projectedState(projection, readFileSync(abs, "utf-8"));
  } catch {
    return undefined;
  }
}

/**
 * The state of `rel` now, judged the way `recorded` was taken: a recorded
 * {@link OPENED_DIR} (or a link that resolved to one) is compared as "is it
 * still a directory", anything else in full.
 */
export function stateLike(root: string, rel: string, digests: FileDigests, recorded: string): string {
  if (recorded.startsWith("proj ")) {
    const name = recorded.split(" ")[1] ?? "";
    // A projection this version does not know cannot be recomputed: the full state never equals it, so the writer runs.
    if (isProjection(name)) return projectedFileState(root, rel, name) ?? pathState(root, rel, digests);
    return pathState(root, rel, digests);
  }
  const opened = recorded === OPENED_DIR || recorded.endsWith(` -> ${OPENED_DIR}`);
  return pathState(root, rel, digests, { listed: !opened });
}

function statState(abs: string, rel: string, digests: FileDigests, listed: boolean): string {
  if (rel === ".git" || rel.endsWith("/.git")) {
    try {
      if (statSync(abs).isDirectory()) return "dir";
    } catch {
      /* fall through */
    }
  }
  if (!listed) {
    try {
      if (statSync(abs).isDirectory()) return OPENED_DIR;
    } catch {
      /* fall through */
    }
  }
  let names: string[] | undefined;
  try {
    // A listing never shows `__pycache__`: Python creates it as it runs ({@link excluded}).
    names = readdirSync(abs).filter((n) => n !== "__pycache__").sort();
  } catch {
    names = undefined;
  }
  if (names !== undefined) return `dir ${createHash("sha256").update(names.join("\0")).digest("hex")}`;
  return `file ${digests.digest(rel)}`;
}

/** The key a git call is recorded under. */
export function gitKey(c: GitCall): string {
  return JSON.stringify([c.cwd, ...c.args]);
}

/** What a git command answers now: its exit status and the digests of what it printed. */
export function gitState(root: string, c: GitCall): string {
  // input-site: traced #a664a724 — replays a recorded git command to decide a skip; a run that reaches it records no hash
  inputSiteReached("ci-cone: gitState");
  const r = Bun.spawnSync(["git", ...c.args], { cwd: c.cwd === "" ? root : join(root, c.cwd), stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const h = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
  return `exit ${r.exitCode} out ${h(r.stdout)} err ${h(r.stderr)}`;
}

// ── Records ─────────────────────────────────────────────────────────────────

/** One check's verdict on main, with what it read. */
export interface ConeCheck {
  /** The main commit whose green run recorded it. */
  sha: string;
  /** The `f017` fingerprint without the tree: script closure, audited env, tools, baseline. */
  base: string;
  /** Every path the run touched inside the checkout, and its state after the run. */
  reads: Record<string, string>;
  /** Every git command it ran ({@link gitKey}), and what that command answered after the run. */
  git: Record<string, string>;
  /**
   * A test gate whose run started a `bun` child: every variable the modules it
   * read can read ({@link childInputsOf}), and its value then (`null`: unset).
   * Derived from the run, never declared; absent when it started none.
   */
  env?: Record<string, string | null>;
  /** A test gate whose run started children: each program outside the checkout it exec'd, and the sha-256 of its binary then ({@link childInputsOf}). */
  tools?: Record<string, string>;
  /** The installed Python package files it read, outside the checkout, and their state then. */
  external?: Record<string, string>;
}

export interface ConeRecords {
  version: number;
  recipe: number;
  /** The main commit whose run wrote this file. */
  sha: string;
  checks: Record<string, ConeCheck>;
}

/** The record file, or `undefined` when it is absent, corrupt or from another recipe — then every check runs. */
export function loadRecords(root: string): ConeRecords | undefined {
  try {
    const raw = JSON.parse(readFileSync(join(root, RECORD_FILE), "utf-8")) as ConeRecords;
    if (raw.version === TRACER_VERSION && raw.recipe === RECIPE_VERSION && typeof raw.checks === "object" && raw.checks !== null) return raw;
  } catch {
    /* absent or corrupt */
  }
  return undefined;
}

export function saveRecords(root: string, records: ConeRecords): void {
  const path = join(root, RECORD_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(records, null, 1)}\n`);
}

/**
 * The fingerprint a cone record is keyed on: `f017`'s, over the script, the
 * audited environment, the tools and the baseline, but with NO tree input,
 * because the read set stands in for the tree.
 *
 * EVERY check is a candidate, declared in `task-io` or not (owner, card,
 * 2026-11-13: "every gate"; the 4rbc rule, derived and not declared). Its
 * inputs are what its traced run read, as a test file's already are; a
 * `task-io` input declaration, `{tracked}` or narrower, is not consulted,
 * and its declared OUTPUTS, when it has any, are still hashed. Before, only a
 * check declared `{tracked}` was a candidate, and on main's last 9 push runs
 * (2026-11-13) about 50 gates a run were not traced for that reason alone.
 * Nothing else is relaxed: a write inside the checkout, an unannotated or
 * `traced` input site, more than {@link MAX_PATHS} paths, or a red run still
 * records nothing, so the check runs.
 */
export function coneFingerprint(
  root: string,
  scripts: Readonly<Record<string, string>>,
  script: string,
  io: PairIO | undefined,
  digests: FileDigests,
  baseline: BaselineResolver | undefined,
): Fingerprint {
  if (isTestGate(script)) {
    // A test file is a candidate like a `{tracked}` gate: its traced read set
    // stands in for the tree. Its fingerprint's code is the file's closure AND
    // the bunfig `[test] preload` modules `bun test` runs before it.
    const pre = preloadScripts(root);
    return fingerprint(root, { ...scripts, ...pre }, [script, ...Object.keys(pre)], { inputs: [], outputs: [] }, digests, baseline, { treeReplayed: true });
  }
  return checkFingerprint(root, scripts, script, { inputs: [], outputs: io?.outputs ?? [] }, digests, baseline, { treeReplayed: true });
}

// ── Test files as gates ──────────────────────────────────────────────────────

/**
 * A test file is asked about, recorded and reused like a gate, under the name
 * `test:<repo-relative path>` (owner, 2026-11-05: "Traced, like gates"). Its
 * command runs that one file: `bun test ./<path>`, the `./` so bun reads it as
 * a path and not a name filter. Its result is reused only when its derived
 * read set matches exactly, never on its import closure alone, which does not
 * see fixtures, directory walks or spawned scripts (the 4rbc rule).
 */
export const TEST_GATE_PREFIX = "test:";

export function isTestGate(name: string): boolean {
  return name.startsWith(TEST_GATE_PREFIX);
}

/** `test:<path>` → `bun test ./<path>`, for every test file `bun test` would collect under `root`. */
export function testGates(root: string, files: readonly string[] = testFilesUnder(root)): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of files) out[`${TEST_GATE_PREFIX}${f}`] = `bun test ./${f}`;
  return out;
}

/** The bunfig `[test] preload` modules, as pseudo-scripts whose entry is the module, so the fingerprint audits their closures too. */
export function preloadScripts(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of testPreloads(root)) out[`test-preload:${p}`] = `bun ./${p}`;
  return out;
}

export type ConeDecision = { skip: true; sha: string; why: string } | { skip: false; why: string };

/** The recipe a stored result is filed under: an entry from another tracer or fingerprint recipe is never offered. */
export const STORE_RECIPE = `cone-${TRACER_VERSION}/f017-${RECIPE_VERSION}`;

/**
 * Main's record first, then every stored green result of the same check
 * (`result-store.ts`). The store is what lets a PR on an older base, or a
 * merge-train run, reuse a result main's latest record no longer holds.
 */
export function decideWithStore(records: ConeRecords | undefined, script: string, fp: Fingerprint, root: string, digests: FileDigests): ConeDecision {
  const first = decideCone(records, script, fp, root, digests);
  if (first.skip || "undetermined" in fp) return first;
  const found = findReusable<ConeCheck>(root, script, STORE_RECIPE, (e) => matchCheck(e, fp, root, digests));
  return found.reuse ? { skip: true, sha: found.result.entry.sha, why: found.why } : { skip: false, why: `${first.why}; result store: ${found.why}` };
}

/** Whether a PR may skip `script`: its fingerprint and every recorded path match main's green run exactly. */
export function decideCone(records: ConeRecords | undefined, script: string, fp: Fingerprint, root: string, digests: FileDigests): ConeDecision {
  if (records === undefined) return { skip: false, why: "no record from a green main run" };
  const rec = records.checks[script];
  if (rec === undefined) return { skip: false, why: `main's run ${records.sha.slice(0, 12)} recorded nothing for this check` };
  return matchCheck(rec, fp, root, digests);
}

/**
 * Whether the inputs now are exactly those of one recorded green run: the same
 * fingerprint, the same state at every path it read, and the same answer from
 * every git command it ran. The one rule both `records.json` and the result
 * store (`result-store.ts`) decide by.
 */
export function matchCheck(rec: ConeCheck, fp: Fingerprint, root: string, digests: FileDigests): ConeDecision {
  if ("undetermined" in fp) return { skip: false, why: `inputs could not be determined: ${fp.undetermined}` };
  if (fp.hash !== rec.base) return { skip: false, why: "the script, its imports, the audited environment or the baseline changed" };
  for (const [p, state] of Object.entries(rec.reads)) {
    let now: string;
    try {
      now = stateLike(root, p, digests, state);
    } catch (e) {
      return { skip: false, why: `could not read ${p}: ${(e as Error).message}` };
    }
    if (now !== state) return { skip: false, why: `${p || "."} changed` };
  }
  if (typeof rec.git !== "object" || rec.git === null) return { skip: false, why: "the record has no git answers" };
  for (const [key, state] of Object.entries(rec.git)) {
    let call: GitCall;
    try {
      const [cwd, ...args] = JSON.parse(key) as string[];
      call = { cwd: cwd!, args };
    } catch {
      return { skip: false, why: `an unreadable git record ${key}` };
    }
    if (gitState(root, call) !== state) return { skip: false, why: `git ${call.args.join(" ")} answers differently` };
  }
  if (rec.env !== undefined) {
    // input-site: traced #c6583b74 — compares a test's children's recorded environment, on the decide path
    inputSiteReached("ci-cone: child env now");
    const env = process.env;
    for (const [n, v] of Object.entries(rec.env)) if ((env[n] ?? null) !== v) return { skip: false, why: `$${n}, which a child's source reads, changed` };
  }
  for (const [program, state] of Object.entries(rec.tools ?? {})) {
    if (externalState(program) !== state) return { skip: false, why: `the program ${program} changed` };
  }
  for (const [path, state] of Object.entries(rec.external ?? {})) {
    if (externalState(path) !== state) return { skip: false, why: `the installed package file ${path} changed` };
  }
  return { skip: true, sha: rec.sha, why: `inputs unchanged since ${rec.sha} (${Object.keys(rec.reads).length} paths)` };
}

/**
 * The record of one traced run, or why it records nothing. A record needs all
 * of these: the run passed, it reached no `traced` site, its trace can be
 * enumerated, and its fingerprint was the same before and after the run.
 */
export function coneRecordOf(args: {
  sha: string;
  passed: boolean;
  before: Fingerprint;
  after: Fingerprint;
  reads: ReadSet;
  reached: string | undefined;
  root: string;
  digests: FileDigests;
  /** The package scripts, for a `scripts` site a child's module carries. */
  scripts?: Readonly<Record<string, string>>;
  /** A test gate: its `bun` children's environment is derived ({@link childInputsOf}). */
  testGate?: boolean;
}): ConeCheck | { none: string } {
  if (!args.passed) return { none: "the check did not pass" };
  if ("undetermined" in args.before) return { none: args.before.undetermined };
  if ("undetermined" in args.after || args.after.hash !== args.before.hash) return { none: "its inputs moved while it ran" };
  if (args.reached !== undefined) return { none: `the run reached a traced input site (${args.reached})` };
  if ("undetermined" in args.reads) return { none: args.reads.undetermined };
  const reads: Record<string, string> = {};
  const listed = new Set(args.reads.listed ?? []);
  for (const p of args.reads.paths) reads[p] = readState(args.root, p, args.digests, listed);
  const git: Record<string, string> = {};
  for (const c of args.reads.git) git[gitKey(c)] = gitState(args.root, c);
  const child = args.testGate === true ? childInputsOf(args.root, args.reads, args.digests, args.scripts ?? {}) : { env: {}, tools: {}, external: {} };
  if ("none" in child) return { none: child.none };
  const deferred = deferredInputsOf(args.root, args.before.deferred ?? [], args.reads, args.digests, args.scripts ?? {});
  if ("none" in deferred) return { none: String(deferred.none) };
  Object.assign(child.env, deferred);
  const nonEmpty = (k: "env" | "tools" | "external") => (Object.keys(child[k]).length ? { [k]: child[k] } : {});
  return { sha: args.sha, base: args.before.hash, reads, git, ...nonEmpty("env"), ...nonEmpty("tools"), ...nonEmpty("external") };
}

/**
 * The variables that change how a Python interpreter runs any script,
 * whatever the script reads itself: recorded for every run that started one.
 */
export const PYTHON_RUNTIME_ENV = [
  "PYTHONPATH", "PYTHONHOME", "PYTHONHASHSEED", "PYTHONSAFEPATH", "PYTHONUTF8", "PYTHONIOENCODING",
  "PYTHONWARNINGS", "PYTHONOPTIMIZE", "PYTHONNOUSERSITE", "PYTHONUSERBASE", "PYTHONDONTWRITEBYTECODE", "PYTHONPYCACHEPREFIX", "VIRTUAL_ENV",
] as const;

/** The state of a file outside the checkout (an installed package file, a child's program): its sha-256, `dir`, or `absent`. */
export function externalState(path: string): string {
  try {
    const st = lstatSync(path);
    if (st.isDirectory()) return "dir";
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return "absent";
  }
}

/**
 * What the modules a computed load could reach, and the run did open, read
 * from the environment (owner, 2026-11-06: "Both", deriving the plugin and
 * validator modules from the trace). The traced fingerprint leaves them out
 * (`auditClosure`'s `deferComputed`): a module the run never opened cannot
 * have run, and one it opened is in the read set, so a change to it reruns
 * the check. Each opened one is audited here, with its own computed loads
 * deferred again and audited in turn when opened, and the variables they can
 * read are recorded with their values. Any site the audit cannot answer
 * records nothing. A module read only as text is audited too: that can only
 * make the check run more often.
 */
export function deferredInputsOf(
  root: string,
  deferred: readonly string[],
  reads: Extract<ReadSet, { paths: string[] }>,
  digests: FileDigests,
  scripts: Readonly<Record<string, string>>,
): Record<string, string | null> | { none: string } {
  const opened = new Set(reads.paths);
  const audited = new Set<string>();
  let next = deferred.filter((f) => opened.has(f));
  const env = new Set<string>();
  const envUnset = new Set<string>();
  while (next.length > 0) {
    next.forEach((f) => audited.add(f));
    const audit = auditClosure(
      root,
      next,
      digests.sites,
      undefined,
      (name) => entryFiles(root, scripts, name),
      (source) => digests.declared.resolve(source),
      true,
    );
    if ("undetermined" in audit) return { none: `a module the run loaded by a computed load: ${audit.undetermined}` };
    audit.env.forEach((n) => env.add(n));
    audit.envUnset.forEach((n) => envUnset.add(n));
    next = audit.deferred.filter((f) => opened.has(f) && !audited.has(f));
  }
  if (env.size === 0 && envUnset.size === 0) return {};
  const out: Record<string, string | null> = {};
  // input-site: traced #659ad351 — records what the loaded modules read from the environment, on the record path only
  inputSiteReached("ci-cone: deferred env");
  const now = process.env;
  for (const n of envUnset) {
    if ((now[n] ?? "") !== "") return { none: `$${n} is set, and a loaded module names it as outside the tree` };
    out[n] = null;
  }
  for (const n of env) out[n] = now[n] ?? null;
  return out;
}

/** A program that runs this tree's TypeScript: what a `spawned` site starts. */
export const JS_RUNTIME_RE = /(?:^|\/)(?:bun|bunx|node)$/;

/**
 * What a test's `bun` and `python3` children read beyond the checkout,
 * derived from its trace (owner, 2026-11-05: "Read them from the trace";
 * Python: "Build it anyway"). A child's modules are
 * in the read set, so a change to one reruns the test; its environment is
 * not, so every source module the run read is audited as an entry (its
 * `import.meta.main` block included, since a child runs it as one), and the
 * variables they can read are recorded with their values. A module read only
 * as text is audited too: that can only make the test run more often. Any
 * site the audit cannot answer records nothing. A run that started no bun
 * child records no variables.
 *
 * A Python child the same, by `input-sites-py.ts` over every `.py` file the
 * run read, plus {@link PYTHON_RUNTIME_ENV} and every installed package file
 * it read (outside the checkout, so in no read set). Every program a child
 * exec'd outside the checkout is recorded by the digest of its binary. Code a child ran from its command line (`-c`, `-e`) is audited from
 * the traced command line; a script read from stdin records nothing.
 */
export function childInputsOf(
  root: string,
  reads: Extract<ReadSet, { paths: string[] }>,
  digests: FileDigests,
  scripts: Readonly<Record<string, string>>,
): { env: Record<string, string | null>; tools: Record<string, string>; external: Record<string, string> } | { none: string } {
  const env: string[] = [];
  const envUnset: string[] = [];
  // Code a child ran from its command line is audited from that line, as a file would be.
  for (const { program, code } of reads.inline ?? []) {
    if (code === null) return { none: `${program} ran a script from stdin, which no trace shows` };
    const where = `${program} inline code`;
    const audit = PYTHON_RE.test(program) ? auditPython([{ file: where, text: code }]) : auditInlineScript(where, code);
    if ("undetermined" in audit) return { none: `inline code: ${audit.undetermined}` };
    env.push(...audit.env);
    envUnset.push(...audit.envUnset);
  }
  const tools: Record<string, string> = {};
  const external: Record<string, string> = {};
  const isFile = (p: string) => existsSync(join(root, p)) && statSync(join(root, p)).isFile();
  if ((reads.children ?? []).some((p) => JS_RUNTIME_RE.test(p))) {
    const js = jsChildEnv(root, reads, digests, scripts, isFile);
    if ("none" in js) return js;
    env.push(...js.env);
    envUnset.push(...js.envUnset);
  }
  const pythons = [...new Set((reads.children ?? []).filter((p) => PYTHON_RE.test(p)))];
  if (pythons.length > 0) {
    const py = auditPython(reads.paths.filter((p) => p.endsWith(".py") && isFile(p)).map((file) => ({ file, text: readFileSync(join(root, file), "utf-8") })));
    if ("undetermined" in py) return { none: `a python child's sources: ${py.undetermined}` };
    env.push(...py.env, ...PYTHON_RUNTIME_ENV);
    envUnset.push(...py.envUnset);
    if ((reads.external ?? []).length > MAX_PATHS) return { none: `the run read ${reads.external!.length} installed package files, more than ${MAX_PATHS}` };
    for (const p of reads.external ?? []) external[p] = externalState(p);
  }
  // Every program a child exec'd outside the checkout, by the bytes that ran:
  // `pandoc`, the interpreter, `git`. One in the checkout is in the read set.
  for (const p of reads.children ?? []) if (!p.startsWith(`${resolve(root)}/`)) tools[p] = externalState(p);
  const out: Record<string, string | null> = {};
  // input-site: traced #659ad351 — records a test's children's environment, on the record path only
  inputSiteReached("ci-cone: child env");
  const now = process.env;
  for (const n of envUnset) {
    if ((now[n] ?? "") !== "") return { none: `$${n} is set, and a child's source names it as outside the tree` };
    out[n] = null;
  }
  for (const n of env) out[n] = now[n] ?? null;
  return { env: out, tools, external };
}

/** What `bun -e <code>` can read from the environment: its sites, read as one TypeScript module's. */
function auditInlineScript(where: string, code: string): { env: string[]; envUnset: string[] } | { undetermined: string } {
  const env = new Set<string>();
  const envUnset = new Set<string>();
  for (const s of scanSource(`${where}.ts`, code)) {
    const problem = siteProblem(s);
    if (problem !== undefined) return { undetermined: problem };
    for (const v of s.verdicts as SiteVerdict[]) {
      if (v.kind === "env") v.names.forEach((n) => env.add(n));
      else if (v.kind === "env-unset") v.names.forEach((n) => envUnset.add(n));
      else if (v.kind !== "inert" && v.kind !== "tree" && v.kind !== "head" && v.kind !== "refs") return { undetermined: `${where}: a \`${v.kind}\` site, which inline code cannot carry` };
    }
  }
  return { env: [...env], envUnset: [...envUnset] };
}

/** What a test's `bun` children's modules can read from the environment: {@link childInputsOf}'s TypeScript half. */
function jsChildEnv(
  root: string,
  reads: Extract<ReadSet, { paths: string[] }>,
  digests: FileDigests,
  scripts: Readonly<Record<string, string>>,
  isFile: (p: string) => boolean,
): { env: string[]; envUnset: string[] } | { none: string } {
  const modules = reads.paths.filter((p) => /\.(m?[jt]sx?)$/.test(p) && isFile(p));
  const audit = auditClosure(
    root,
    modules,
    digests.sites,
    undefined,
    (name) => entryFiles(root, scripts, name),
    (source) => digests.declared.resolve(source),
    // Every module the run opened is an entry here; a computed load's target
    // the run never opened cannot have run (`deferredInputsOf`).
    true,
  );
  if ("undetermined" in audit) return { none: `a bun child's modules: ${audit.undetermined}` };
  return { env: audit.env, envUnset: audit.envUnset };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function summary(line: string): void {
  // input-site: inert #a4a61631 — the job summary is where the cone's report is shown, never an input of a check
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (path) appendFileSync(path, `${line}\n`);
}

function straceWorks(): boolean {
  if (Bun.which("strace") === null) return false;
  // input-site: traced #b2558986 — asks whether strace works, on the record path only
  inputSiteReached("ci-cone: straceWorks");
  const r = Bun.spawnSync(["strace", "-f", "-qq", "-o", "/dev/null", "true"], { stdout: "ignore", stderr: "ignore" });
  return r.exitCode === 0;
}

/** What {@link recordRun} and {@link decideRun} take; tests pass `io` and `baseline` directly. */
export interface ConeRunOpts {
  root: string;
  scripts: Readonly<Record<string, string>>;
  script: string;
  io: PairIO | undefined;
  baseline: BaselineResolver | undefined;
  /** The main commit this run is on (`GITHUB_SHA`). */
  sha: string;
  /** When the run finished, for ordering result-store entries; never part of a key. */
  recordedAt?: string;
  /** What names the run in a reuse report (`<sha> run <id>`); defaults to `sha`. */
  run?: string;
  /** `ignore` silences the check's own output (tests). */
  stdio?: "inherit" | "ignore";
  /** What runs a script by name: `bun run cat` (bean `ar1s` P4), which tests replace. */
  runner?: readonly string[];
}

/** How a gate step runs a script by name, since #2448: `bun run cat <name>`. */
export const RUNNER = ["bun", "run", "cat"] as const;

/**
 * Run `bun run <script>` under the tracer, and record (or forget) what it
 * read. The returned exit code is the check's own; recording never changes it.
 * A check that is not a candidate, or whose fingerprint is undetermined, runs
 * untraced and is not recorded.
 */
/**
 * Set by a runner that traces several checks at once (`run-gates.py`, owner
 * pick Q-ACT-1 A, 2026-11-10). `CI_CONE_TOUCHED_OUT` names a file this run
 * writes what it touched inside the checkout: `{reads, listed, writes, git}`,
 * or `{undetermined}` when that is not known (an untraced run, a trace that
 * could not be read). The runner drops the record of any check whose reads a
 * neighbour's writes met, and runs that check again alone.
 * `CI_CONE_RECORD_OUT` names a file this run writes its record to, instead of
 * the shared record file, which concurrent runs would overwrite; the runner
 * merges the records it keeps.
 */
export const TOUCHED_OUT_ENV = "CI_CONE_TOUCHED_OUT";
export const RECORD_OUT_ENV = "CI_CONE_RECORD_OUT";

/**
 * Keep the records concurrent runs wrote to {@link RECORD_OUT_ENV} files: each
 * goes into the record file and the result store, exactly as a lone run's
 * would. A file whose record is null removes the script's old record, as a
 * lone run that recorded nothing does. Returns one note per file.
 */
export function keepRecords(root: string, files: readonly string[]): string[] {
  const notes: string[] = [];
  let records: ConeRecords | undefined;
  for (const f of files) {
    const got = JSON.parse(readFileSync(f, "utf-8")) as { script: string; sha: string; run: string; recordedAt: string; record: ConeCheck | null };
    records ??= loadRecords(root) ?? { version: TRACER_VERSION, recipe: RECIPE_VERSION, sha: got.sha, checks: {} };
    if (got.record === null) {
      delete records.checks[got.script];
      notes.push(`${got.script}: not recorded`);
      continue;
    }
    records.checks[got.script] = got.record;
    const digest = putResult<ConeCheck>(root, { gate: got.script, recipe: STORE_RECIPE, recordedAt: got.recordedAt, run: got.run, entry: got.record });
    notes.push(`${got.script}: recorded (${Object.keys(got.record.reads).length} paths; result store ${digest.slice(0, 12)})`);
  }
  if (records !== undefined) saveRecords(root, records);
  return notes;
}

/** What a run touched, for {@link TOUCHED_OUT_ENV}: from its trace, or undetermined. */
export function touchedOf(text: string | undefined, root: string, why = "not traced"): Record<string, unknown> {
  if (text === undefined) return { undetermined: why };
  const t = parseTrace(text, root, { writes: "collect", rewriteAsInput: () => true, gitUnreplayable: "count" });
  if ("undetermined" in t) return { undetermined: t.undetermined };
  return {
    reads: t.paths,
    listed: t.listed ?? [],
    writes: [...new Set([...(t.writes ?? []), ...(t.rewritten ?? [])])].sort(),
    git: t.git.length,
  };
}

function writeTouched(root: string, text: string | undefined, why?: string): void {
  // input-site: traced #b81eb7f4 — where a concurrent runner wants the touched paths written, on the record path only
  inputSiteReached("ci-cone: touched out");
  const out = process.env[TOUCHED_OUT_ENV];
  if (!out) return;
  let body: Record<string, unknown>;
  try {
    body = touchedOf(text, root, why);
  } catch (e) {
    body = { undetermined: (e as Error).message };
  }
  writeFileSync(out, `${JSON.stringify(body)}\n`);
}

export function recordRun(o: ConeRunOpts): { code: number; note: string } {
  const stdio = o.stdio ?? "inherit";
  // When `runner` is omitted, run the resolved command directly via `sh -c`
  // (as `run-script.ts` does) instead of spawning `bun run cat <script>` under
  // `strace`: `run-script.ts` calls `scriptTable(REPO)` -> `layerRootsIn(REPO)`
  // to look up the script name `main()` already resolved in `o.scripts`, which
  // polluted every traced check's read set with every layer directory and
  // declaration in the checkout (cat-harness-tools#634).
  const scriptCmd = o.scripts[o.script];
  // A test file runs as `bun test ./<path>` itself, not under `sh`, so the
  // traced command is bun: under `sh -c` every test had a bun "child", and its
  // whole read set was audited as that child's sources (`childInputsOf`).
  const cmdArgs =
    o.runner !== undefined
      ? [...o.runner, o.script]
      : isTestGate(o.script) && scriptCmd === `bun test ./${o.script.slice(TEST_GATE_PREFIX.length)}`
        ? ["bun", "test", `./${o.script.slice(TEST_GATE_PREFIX.length)}`]
        : scriptCmd !== undefined
          ? ["sh", "-c", scriptCmd]
          : [...RUNNER, o.script];
  // A test file's own run never takes `BUN_OPTIONS`: CI's test shards set it
  // to `--shard=N/M --reporter=junit ...`, and inherited by `bun test ./<one
  // file>` it shards that one file away to nothing, so the run reads nothing
  // and a red file "passes" and is recorded (folio-assistant#2954, 2026-11-05;
  // `testEnv` in pre-push-gates.ts drops it for the same reason).
  const runEnv = (base: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
    if (!isTestGate(o.script) || base.BUN_OPTIONS === undefined) return base;
    const out = { ...base };
    delete out.BUN_OPTIONS;
    return out;
  };
  const cmdEnv = (base: NodeJS.ProcessEnv): NodeJS.ProcessEnv =>
    o.runner === undefined && scriptCmd !== undefined
      ? {
          ...runEnv(base),
          PATH: `${join(o.root, "node_modules", ".bin")}${base.PATH ? `:${base.PATH}` : ""}`,
          npm_lifecycle_event: o.script,
        }
      : runEnv(base);
  const plain = (why: string) => {
    // input-site: traced #3f7614a5 — runs the check itself, untraced, on the record path
    inputSiteReached("ci-cone: run plain");
    const r = Bun.spawnSync(cmdArgs, { cwd: o.root, stdin: stdio, stdout: stdio, stderr: stdio, env: cmdEnv(process.env) });
    writeTouched(o.root, undefined, `not traced — ${why}`);
    return { code: r.exitCode ?? 1, note: `not traced — ${why}` };
  };
  let before: Fingerprint;
  try {
    before = coneFingerprint(o.root, o.scripts, o.script, o.io, new FileDigests(o.root), o.baseline);
  } catch (e) {
    before = { undetermined: (e as Error).message };
  }
  if ("undetermined" in before) return plain(before.undetermined);
  const trace = openTrace(o.root);
  // input-site: traced #ce261302 — the trace file's name, on the record path
  inputSiteReached("ci-cone: trace log");
  const log = join(tmpdir(), `ci-cone-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.strace`);
  // input-site: traced #db7dd1a6 — runs the check under strace, on the record path
  inputSiteReached("ci-cone: run traced");
  const r = Bun.spawnSync(["strace", ...STRACE_ARGS, "-o", log, ...cmdArgs], {
    cwd: o.root,
    stdin: stdio,
    stdout: stdio,
    stderr: stdio,
    env: cmdEnv(trace.env),
  });
  let code = r.exitCode ?? 1;
  // input-site: traced #022c9b80 — whether a concurrent runner will ask a failed check again alone, on the record path only
  inputSiteReached("ci-cone: failed beside others");
  if (code !== 0 && process.env[TOUCHED_OUT_ENV]) {
    // Beside neighbours, a failed traced run is not asked again here: an
    // untraced run would write what nobody sees while they run. It reports
    // what its trace saw it touch, and the runner asks it again alone, where
    // the step below makes the verdict the check's own.
    const text = existsSync(log) && statSync(log).size <= MAX_TRACE_BYTES ? readFileSync(log, "utf-8") : undefined;
    rmSync(log, { force: true });
    writeTouched(o.root, text, "the trace is absent or too large");
    return { code, note: `not recorded — the traced run exited ${r.exitCode ?? r.signalCode} beside other gates; it runs again alone` };
  }
  if (code !== 0) {
    // The verdict must be the check's, never the tracer's. A traced run that
    // failed is asked again, untraced, and THAT exit status is the answer.
    // input-site: traced #d365c714 — re-runs a failed traced check untraced, on the record path
    inputSiteReached("ci-cone: run again");
    const again = Bun.spawnSync(cmdArgs, { cwd: o.root, stdin: stdio, stdout: stdio, stderr: stdio, env: cmdEnv(process.env) });
    code = again.exitCode ?? 1;
    rmSync(log, { force: true });
    writeTouched(o.root, undefined, "the check ran again untraced");
    return { code, note: `not recorded — the traced run exited ${r.exitCode ?? r.signalCode}; re-run untraced, which exited ${code}` };
  }
  let note: string;
  const text = existsSync(log) && statSync(log).size <= MAX_TRACE_BYTES ? readFileSync(log, "utf-8") : undefined;
  writeTouched(o.root, text, "the trace is absent or too large");
  try {
    const digests = new FileDigests(o.root);
    const rec = coneRecordOf({
      sha: o.sha,
      passed: code === 0,
      before,
      after: coneFingerprint(o.root, o.scripts, o.script, o.io, digests, o.baseline),
      reads: !existsSync(log)
        ? { undetermined: "no trace was written" }
        : statSync(log).size > MAX_TRACE_BYTES
          ? { undetermined: `the trace is ${statSync(log).size} bytes, more than ${MAX_TRACE_BYTES}` }
          : parseTrace(text ?? readFileSync(log, "utf-8"), o.root),
      reached: trace.reached(againstRefsOf(o.scripts, o.script)),
      root: o.root,
      digests,
      scripts: o.scripts,
      testGate: isTestGate(o.script),
    });
    // input-site: traced #1d9837ba — where a concurrent runner wants the record written, on the record path only
    inputSiteReached("ci-cone: record out");
    const recordOut = process.env[RECORD_OUT_ENV];
    if (recordOut) {
      // A concurrent run: its record goes to its own file. Nothing is stored
      // yet: the runner keeps it (`ci-cone.ts keep`) only when no neighbour's
      // writes met its reads.
      writeFileSync(
        recordOut,
        `${JSON.stringify({ script: o.script, sha: o.sha, run: o.run ?? o.sha, recordedAt: o.recordedAt ?? "", record: "none" in rec ? null : rec })}\n`,
      );
      return { code, note: "none" in rec ? `not recorded — ${rec.none}` : `traced (${Object.keys(rec.reads).length} paths; kept by the runner unless a neighbour's writes met its reads)` };
    }
    const records = loadRecords(o.root) ?? { version: TRACER_VERSION, recipe: RECIPE_VERSION, sha: o.sha, checks: {} };
    if ("none" in rec) {
      delete records.checks[o.script];
      note = `not recorded — ${rec.none}`;
    } else {
      records.checks[o.script] = rec;
      const digest = putResult<ConeCheck>(o.root, { gate: o.script, recipe: STORE_RECIPE, recordedAt: o.recordedAt ?? "", run: o.run ?? o.sha, entry: rec });
      note = `recorded (${Object.keys(rec.reads).length} paths; result store ${digest.slice(0, 12)})`;
    }
    saveRecords(o.root, records);
  } catch (e) {
    // Recording is never allowed to change the check's verdict.
    note = `not recorded — ${(e as Error).message}`;
  } finally {
    rmSync(log, { force: true });
  }
  return { code, note };
}

/** Whether a PR run may skip `script` against the restored records. Any error is "run". */
export function decideRun(o: Omit<ConeRunOpts, "sha" | "stdio" | "runner">): ConeDecision {
  try {
    const digests = new FileDigests(o.root);
    const fp = coneFingerprint(o.root, o.scripts, o.script, o.io, digests, o.baseline);
    return decideWithStore(loadRecords(o.root), o.script, fp, o.root, digests);
  } catch (e) {
    return { skip: false, why: `could not decide: ${(e as Error).message}` };
  }
}

/**
 * What {@link decideAll} says about one script: {@link ConeDecision}, and
 * whether the script is a cone candidate at all (its cone fingerprint is
 * determined). A candidate that does not skip is the one a recording run
 * traces; a non-candidate is never traced, because nothing could be recorded.
 */
export type BatchDecision = ConeDecision & { candidate: boolean };

/**
 * {@link decideRun} for many scripts in ONE process, sharing one
 * {@link FileDigests}, so a path several records name is hashed once
 * (cat-harness-tools#398). Measured 2026-10-07 (bean `4rbc`): `decide` cost
 * about 0.48 s a step as one process per check, 21.7 s for 45 checks; the
 * layer PR checks ask about every declared gate of the dependency harness,
 * about 150 candidates. Any error for one script is "run" for that script.
 */
export function decideAll(o: {
  root: string;
  scripts: Readonly<Record<string, string>>;
  names: readonly string[];
  ioOf: (script: string) => PairIO | undefined;
  baseline: BaselineResolver | undefined;
}): { records: string | null; decisions: Record<string, BatchDecision> } {
  const digests = new FileDigests(o.root);
  const records = loadRecords(o.root);
  const decisions: Record<string, BatchDecision> = {};
  for (const script of o.names) {
    try {
      const fp = coneFingerprint(o.root, o.scripts, script, o.ioOf(script), digests, o.baseline);
      decisions[script] = { ...decideWithStore(records, script, fp, o.root, digests), candidate: !("undetermined" in fp) };
    } catch (e) {
      decisions[script] = { skip: false, why: `could not decide: ${(e as Error).message}`, candidate: false };
    }
  }
  return { records: records?.sha ?? null, decisions };
}

/**
 * Does this run RECORD what each gate read? A run of `main` does: a push, and
 * equally a dispatch on `main`. A merge made with `GITHUB_TOKEN` (a merge or
 * re-pin train) starts no push run, so the gates are dispatched on `main`
 * instead (bean `hd58`); a push-only test left every such commit without a
 * record, and a PR based on it warm-started from an older one. Measured over
 * main's last 12 Code-quality gates runs on 2026-11-13: 3 were dispatches,
 * every one with the cone off. A dispatch on any other branch never records:
 * cached-step saves `main-only` entries from `main` alone.
 */
export function recordsOnMain(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.GITHUB_REF === "refs/heads/main" && (env.GITHUB_EVENT_NAME === "push" || env.GITHUB_EVENT_NAME === "workflow_dispatch");
}

function main(argv: readonly string[]): number {
  const [cmd, script] = argv;
  const root = process.cwd();
  // input-site: traced #c6583b74 — the cone CLI's environment; a check never runs this module's main()
  inputSiteReached("ci-cone: main");
  const env = process.env;
  // A `test:<path>` name is a test file (see TEST_GATE_PREFIX); only asked
  // for, so a run about package scripts never walks the tree for tests.
  const asked = cmd === "decide-all" ? argv.slice(2) : [script ?? ""];
  const scripts = asked.some(isTestGate) ? { ...scriptsOf(root), ...testGates(root) } : scriptsOf(root);
  if (cmd === "decide-all") {
    // `decide-all <out.json> <script>...` (cat-harness-tools#398): every
    // decision in one file, for `run-gates.py`. Exit 0 whenever the file was
    // written, whatever it says; the caller treats a missing file as "run all".
    const [, out, ...names] = argv;
    if (out === undefined) {
      console.error("usage: ci-cone.ts decide-all <out.json> <script>...");
      return 2;
    }
    let taskIo: Readonly<Record<string, PairIO>> = {};
    try {
      taskIo = collectTaskIo(root);
    } catch (e) {
      console.log(`ci-cone: task-io could not be read (${(e as Error).message}), so no script is a candidate`);
    }
    const got = decideAll({ root, scripts, names, ioOf: (s) => taskIo[s], baseline: qaBaselineIdentity({ repoRoot: root }) });
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, `${JSON.stringify(got, null, 1)}\n`);
    return 0;
  }
  if (cmd === "prepare") {
    // Which mode this job's gate steps run in, through $GITHUB_ENV.
    const out = env.GITHUB_ENV;
    let mode = "";
    if (recordsOnMain(env)) {
      if (straceWorks()) mode = "record";
      else console.log("ci-cone: strace does not run here, so this main run records nothing and no PR skips against it");
    } else if (env.GITHUB_EVENT_NAME === "pull_request") {
      const rec = loadRecords(root);
      if (rec === undefined) console.log("ci-cone: no usable record from a green main run, so every check runs");
      else {
        mode = "skip";
        console.log(`ci-cone: restored ${Object.keys(rec.checks).length} check record(s) from main ${rec.sha}`);
        summary(
          `### CI cone (bean \`4rbc\`)\n\nRecords restored from main \`${rec.sha}\`. A check listed below was NOT run: ` +
            "every path its green run on that commit read, and its script fingerprint, are unchanged here.\n",
        );
      }
    }
    if (out && mode !== "") appendFileSync(out, `CI_CONE_MODE=${mode}\n`);
    console.log(`ci-cone: mode ${mode || "off"}`);
    return 0;
  }
  if (cmd === "keep") {
    for (const n of keepRecords(root, argv.slice(1))) console.log(`ci-cone: ${n}`);
    return 0;
  }
  if (script === undefined || (cmd !== "decide" && cmd !== "run")) {
    console.error("usage: ci-cone.ts prepare | decide <script> | run <script> | decide-all <out.json> <script>... | keep <record-out.json>...");
    return 2;
  }
  let io: PairIO | undefined;
  try {
    io = collectTaskIo(root)[script];
  } catch (e) {
    console.log(`ci-cone: task-io could not be read (${(e as Error).message})`);
  }
  const opts = { root, scripts, script, io, baseline: qaBaselineIdentity({ repoRoot: root }) };
  if (cmd === "decide") {
    // Exit 0 means SKIP. Every other outcome means run.
    const d = decideRun(opts);
    if (!d.skip) {
      console.log(`ci-cone: runs — ${d.why}`);
      return 1;
    }
    console.log(`▸ bun run cat ${script}   SKIPPED — inputs unchanged since ${d.sha}`);
    summary(`- \`${script}\` SKIPPED — ${d.why}`);
    return 0;
  }
  const sha = env.GITHUB_SHA ?? "local";
  const run = env.GITHUB_RUN_ID ? `${sha.slice(0, 12)} run ${env.GITHUB_RUN_ID}` : sha.slice(0, 12);
  // input-site: inert #7dd167ca — when the run finished, which orders result-store entries and is never part of a key
  const recordedAt = new Date().toISOString();
  const { code, note } = recordRun({ ...opts, sha, run, recordedAt });
  console.log(`ci-cone: ${script} ${note}`);
  return code;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));

