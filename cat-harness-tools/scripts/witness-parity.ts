#!/usr/bin/env bun
/**
 * Does a computation still reproduce its committed witness?
 *
 * Before a producer is declared as a Tool whose output is a witness node,
 * this is how anyone checks that running the Tool actually yields that node.
 *
 * @module cat-harness-tools/scripts/witness-parity
 *
 * Given a witness, it:
 *
 * 1. reads how to re-run its producer (`invocation.reproduce`, else
 *    `python3 <scriptFile>`) and the package versions it recorded
 *    (`environment`);
 * 2. compares those versions with what is installed, and stops at **unknown**
 *    when they differ: running it anyway would report version drift as a
 *    defect in the producer;
 *    `reproduce` is parsed into an argv and run without a shell, with a
 *    minimal environment ({@link producerEnv}); see {@link parseReproduce};
 * 3. checks the COMMITTED tree out into a scratch `git worktree`, sparse to the
 *    directories the run needs, and runs the producer there, so the folio's
 *    own checkout is untouched by construction;
 * 4. stops at **unknown** if the re-run's OWN `environment` differs from the
 *    committed one (a build fingerprint or an interpreter patch level is
 *    recorded by the producer, not discoverable beforehand);
 * 5. compares the rewritten witness with the committed one, both with
 *    {@link WITNESS_EPHEMERAL_FIELDS} masked at every depth.
 *
 * | verdict | means |
 * |---|---|
 * | `pass` | the producer ran cleanly and wrote the same witness |
 * | `fail` | it ran cleanly and wrote a DIFFERENT witness; the differing paths are listed |
 * | `unknown` | it could not be decided: environment mismatch before or after the run, a stale witness (its `scriptHash` is not the current script's), a `scriptFile` that resolves to no unique file, no reproduce command, a reproduce that is not a known producer form (refused, never run), a non-zero exit, a timeout, or no witness written |
 *
 * A non-zero exit is `unknown`, never `fail`, because folio producers refuse
 * by design (a precision floor not met, a guard raised) and explain it on
 * stdout; the reason is reported for a person to read.
 *
 * It tests the COMMITTED producer and witness at `HEAD`, so commit first.
 *
 *   bun run cat witness:parity <witness.json> [...]   # from the folio root
 *   bun run cat witness:parity --json <witness.json>
 *   options: --timeout <s> (300) · --dirs a,b (sparse dirs; default the
 *            producer's and witness's top-level dirs, plus `tools` and
 *            `scripts` where they exist) · --ignore f1,f2 (extra masked keys)
 *            · --force (run even on an environment mismatch; the verdict is
 *            then advisory and says so)
 *
 * Exit 1 when any verdict is `fail`; `unknown` alone exits 0.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { stripEphemeral } from "../schemas/computation-witness.ts";
import { findContentRepoRoot } from "../pipeline/repo-root.ts";

export type Verdict = "pass" | "fail" | "unknown";
export interface ParityResult {
  witness: string;
  verdict: Verdict;
  reason: string;
  /** Environment keys whose installed value differs from the recorded one. */
  envMismatch?: { key: string; recorded: string; installed: string | null }[];
  /** First differing JSON paths, on `fail`. */
  diff?: string[];
  forced?: true;
}

/** Keys of an `environment` block that are build fingerprints, not package versions. */
const NOT_A_PACKAGE = /_build$|^platform$|^os$|^machine$|^hostname$/;

/** Installed versions for `names`, via one python process; `python` is the interpreter's own version. */
export function installedVersions(names: string[], python = "python3"): Record<string, string | null> {
  const code = [
    "import json, sys, importlib.metadata as m",
    "out = {}",
    "for n in json.loads(sys.argv[1]):",
    "    if n == 'python': out[n] = '.'.join(map(str, sys.version_info[:3])); continue",
    "    v = None",
    "    for cand in (n, n.replace('_', '-'), n.replace('-', '_')):",
    "        try: v = m.version(cand); break",
    "        except Exception: pass",
    "    out[n] = v",
    "print(json.dumps(out))",
  ].join("\n");
  const r = spawnSync(python, ["-c", code, JSON.stringify(names)], { encoding: "utf8" });
  if (r.status !== 0) return Object.fromEntries(names.map((n) => [n, null]));
  return JSON.parse(r.stdout) as Record<string, string | null>;
}

/** Recorded-vs-installed mismatches for a witness's `environment` block. */
export function environmentMismatch(
  env: unknown,
  installed: (names: string[]) => Record<string, string | null> = installedVersions,
): { key: string; recorded: string; installed: string | null }[] {
  if (!env || typeof env !== "object") return [];
  const rec = Object.entries(env as Record<string, unknown>).filter(
    ([k, v]) => typeof v === "string" && !NOT_A_PACKAGE.test(k),
  ) as [string, string][];
  const have = installed(rec.map(([k]) => k));
  return rec.filter(([k, v]) => have[k] !== v).map(([k, v]) => ({ key: k, recorded: v, installed: have[k] ?? null }));
}

/** Up to `limit` JSON paths at which `a` and `b` differ (key order ignored). */
export function diffPaths(a: unknown, b: unknown, path = "$", out: string[] = [], limit = 20): string[] {
  if (out.length >= limit) return out;
  if (a === b) return out;
  const ta = Array.isArray(a) ? "array" : typeof a;
  const tb = Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb || a === null || b === null || ta !== "object" && ta !== "array") {
    out.push(path);
    return out;
  }
  if (ta === "array") {
    const x = a as unknown[], y = b as unknown[];
    if (x.length !== y.length) out.push(`${path} (length ${x.length} → ${y.length})`);
    for (let i = 0; i < Math.min(x.length, y.length); i++) diffPaths(x[i], y[i], `${path}[${i}]`, out, limit);
    return out;
  }
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (!(k in x) || !(k in y)) out.push(`${path}.${k} (${k in x ? "removed" : "added"})`);
    else diffPaths(x[k], y[k], `${path}.${k}`, out, limit);
    if (out.length >= limit) break;
  }
  return out;
}

function git(cwd: string, ...args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

/**
 * Where a witness's `scriptFile` lives at HEAD.
 *
 * Producers record it inconsistently: a repository-relative path, or a bare
 * filename for a script beside the witness or elsewhere in the tree. Measured
 * on litlfred/qou: 8 of a 13-witness sample recorded a bare name for a script
 * in a subdirectory (`computations/probes/…`), and joining it to the top-level
 * directory ran nothing. So: the path as written, else beside the witness,
 * else the ONE tracked file with that name. Two or more candidates is
 * ambiguous and resolves to nothing, rather than to a guess.
 */
export function resolveScript(root: string, witnessRel: string, scriptFile: string): string | undefined {
  const tracked = (p: string) => git(root, "cat-file", "-e", `HEAD:${p}`).status === 0;
  if (scriptFile.includes("/")) return tracked(scriptFile) ? scriptFile : undefined;
  const beside = join(dirname(witnessRel), scriptFile);
  if (tracked(beside)) return beside;
  const hits = git(root, "ls-files", "--", `*/${scriptFile}`, scriptFile)
    .stdout.split("\n")
    .filter((p) => p && basename(p) === scriptFile);
  return hits.length === 1 ? hits[0] : undefined;
}

/** A word a producer command may carry: no quoting, globbing, `$`, `;`, `|` or redirection. */
const PLAIN_WORD = /^[A-Za-z0-9_\-./:=@%+,]+$/;

/** Environment keys the producer inherits. Everything else, secrets included, is dropped. */
export const PRODUCER_ENV_KEYS = ["PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "TMPDIR", "VIRTUAL_ENV", "PYTHONPATH"] as const;

/** The minimal environment a producer runs with. */
export function producerEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = { PYTHONDONTWRITEBYTECODE: "1" };
  for (const k of PRODUCER_ENV_KEYS) if (typeof env[k] === "string") out[k] = env[k]!;
  return out;
}

/**
 * `invocation.reproduce` as an argv, or a reason it is refused.
 *
 * The witness is committed DATA, so its reproduce string is never handed to a
 * shell (security review 2026-10-31, bean `cat-tools-w7tx`). Only the two
 * producer forms in use are accepted, split on spaces, every word plain:
 *
 * - `python3 [-u] <tracked .py> [args…]`
 * - `bun run <script name or .ts file> [args…]`
 *
 * Anything else is refused, never rewritten into something that would run.
 */
export function parseReproduce(
  reproduce: string,
  isTracked: (path: string) => boolean,
): { argv: string[] } | { refused: string } {
  const words = reproduce.trim().split(/ +/);
  const bad = words.find((w) => !PLAIN_WORD.test(w));
  if (bad !== undefined) return { refused: `reproduce has a word that is not plain (\`${bad}\`); shell syntax is not run` };
  const [cmd, ...rest] = words;
  if (cmd === "python3" || cmd === "python") {
    const args = rest[0] === "-u" ? rest.slice(1) : rest;
    const script = args[0];
    if (!script || !script.endsWith(".py") || script.startsWith("-") || script.startsWith("/") || script.split("/").includes("..")) {
      return { refused: "reproduce must name a repository .py file after python3 [-u]" };
    }
    if (!isTracked(script)) return { refused: `reproduce names \`${script}\`, which is not tracked at HEAD` };
    return { argv: [cmd, ...rest] };
  }
  if (cmd === "bun" && rest[0] === "run" && rest[1] && !rest[1].startsWith("-")) {
    return { argv: [cmd, ...rest] };
  }
  return { refused: "reproduce is not a known producer form (python3 [-u] <script.py> …, bun run <script> …)" };
}

/** Run one witness's producer in a scratch worktree and compare. */
export function checkParity(
  root: string,
  witnessPath: string,
  opts: { timeoutS?: number; dirs?: string[]; ignore?: Set<string>; force?: boolean } = {},
): ParityResult {
  const rel = relative(root, resolve(root, witnessPath));
  const committed = git(root, "show", `HEAD:${rel}`);
  if (committed.status !== 0) return { witness: rel, verdict: "unknown", reason: "witness is not committed at HEAD" };
  let w: Record<string, unknown>;
  try {
    w = JSON.parse(committed.stdout) as Record<string, unknown>;
  } catch {
    return { witness: rel, verdict: "unknown", reason: "committed witness is not strict JSON" };
  }
  const inv = w.invocation as { reproduce?: unknown } | undefined;
  const scriptFile = typeof w.scriptFile === "string" ? w.scriptFile : undefined;
  const script = scriptFile ? resolveScript(root, rel, scriptFile) : undefined;
  if (scriptFile && !script && typeof inv?.reproduce !== "string") {
    return { witness: rel, verdict: "unknown", reason: `scriptFile \`${scriptFile}\` resolves to no unique file at HEAD` };
  }
  let producer: string[];
  if (typeof inv?.reproduce === "string") {
    const parsed = parseReproduce(inv.reproduce, (p) => git(root, "cat-file", "-e", `HEAD:${p}`).status === 0);
    if ("refused" in parsed) return { witness: rel, verdict: "unknown", reason: `refused: ${parsed.refused}` };
    producer = parsed.argv;
  } else if (script) {
    producer = ["python3", "-u", script];
  } else {
    return { witness: rel, verdict: "unknown", reason: "no invocation.reproduce and no scriptFile" };
  }

  const mismatch = environmentMismatch(w.environment);
  if (mismatch.length && !opts.force) {
    return {
      witness: rel,
      verdict: "unknown",
      reason: `environment differs from the recorded one in ${mismatch.length} package(s); re-run with --force for an advisory result`,
      envMismatch: mismatch,
    };
  }

  const top = (p: string) => p.split("/")[0]!;
  const dirs = new Set(opts.dirs ?? [top(rel), ...(scriptFile?.includes("/") ? [top(scriptFile)] : []), "tools", "scripts"]);
  const scratch = mkdtempSync(join(tmpdir(), "witness-parity-"));
  const wt = join(scratch, "tree");
  try {
    if (git(root, "worktree", "add", "--detach", "--no-checkout", wt, "HEAD").status !== 0) {
      return { witness: rel, verdict: "unknown", reason: "could not create a scratch worktree" };
    }
    const present = [...dirs].filter((d) => git(root, "cat-file", "-e", `HEAD:${d}`).status === 0);
    git(wt, "sparse-checkout", "set", "--cone", ...present);
    if (git(wt, "checkout", "-q").status !== 0) return { witness: rel, verdict: "unknown", reason: "scratch checkout failed" };

    const [cmd, ...args] = producer;
    const run = spawnSync(cmd!, args, {
      cwd: wt,
      encoding: "utf8",
      timeout: (opts.timeoutS ?? 300) * 1000,
      env: producerEnv(),
    });
    if (run.error && (run.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
      return { witness: rel, verdict: "unknown", reason: `producer did not finish within ${opts.timeoutS ?? 300}s` };
    }
    if (run.status !== 0) {
      const tail = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim().split("\n").slice(-3).join(" | ");
      return { witness: rel, verdict: "unknown", reason: `producer exited ${run.status}: ${tail}` };
    }
    const outPath = join(wt, rel);
    if (!existsSync(outPath)) return { witness: rel, verdict: "unknown", reason: "producer exited 0 but wrote no witness at this path" };
    let fresh: unknown;
    try {
      fresh = JSON.parse(readFileSync(outPath, "utf8"));
    } catch {
      return { witness: rel, verdict: "unknown", reason: "rewritten witness is not strict JSON" };
    }
    // The run's OWN record of its environment is the authority, not the
    // pre-run check: that check can only ask Python for package versions,
    // and a build fingerprint (`pyhecke_native_build`) or an interpreter
    // patch level is recorded by the producer itself. Calibration on
    // litlfred/qou found exactly this: same package versions, a different
    // native build, and values differing at the 60th digit. Different
    // environment, so not a reproduction test: unknown, with the keys.
    const envAfter = diffPaths(w.environment ?? {}, (fresh as Record<string, unknown>).environment ?? {}, "environment");
    if (envAfter.length && !opts.force) {
      return {
        witness: rel,
        verdict: "unknown",
        reason: `the re-run recorded a different environment (${envAfter.join(", ")}); re-run with --force for an advisory comparison`,
      };
    }
    // A witness written by a DIFFERENT version of its producer is stale, not
    // irreproducible: the committed record was never this script's output.
    // Measured on qou: `q-pinning-50-digit` recorded scriptHash 58f994b46a01
    // while the script now hashes to e6f6426e55c7, and was reported as `fail`.
    const before = typeof w.scriptHash === "string" ? w.scriptHash : undefined;
    const after = (fresh as Record<string, unknown>).scriptHash;
    if (before && typeof after === "string" && before !== after && !opts.force) {
      return {
        witness: rel,
        verdict: "unknown",
        reason: `the witness is stale: written by script ${before}, the script is now ${after}; re-run with --force for an advisory comparison`,
      };
    }
    const d = diffPaths(stripEphemeral(w, opts.ignore), stripEphemeral(fresh, opts.ignore));
    const forced = mismatch.length || envAfter.length ? ({ forced: true } as const) : {};
    if (git(wt, "diff", "--quiet", "--", rel).status === 0 || d.length === 0) {
      return { witness: rel, verdict: "pass", reason: "reproduced (run-specific fields masked)", ...forced };
    }
    return { witness: rel, verdict: "fail", reason: `differs at ${d.length}${d.length >= 20 ? "+" : ""} path(s)`, diff: d, ...forced };
  } finally {
    git(root, "worktree", "remove", "--force", wt);
    rmSync(scratch, { recursive: true, force: true });
  }
}

function main(): number {
  const argv = process.argv.slice(2);
  const val = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const flagsWithValue = new Set(["--timeout", "--dirs", "--ignore"]);
  const files = argv.filter((a, i) => !a.startsWith("--") && !flagsWithValue.has(argv[i - 1] ?? ""));
  if (!files.length) {
    console.error("usage: witness:parity [--json] [--timeout s] [--dirs a,b] [--ignore f,g] [--force] <witness.json> ...");
    return 2;
  }
  const root = findContentRepoRoot();
  const opts = {
    timeoutS: val("--timeout") ? Number(val("--timeout")) : undefined,
    dirs: val("--dirs")?.split(",").filter(Boolean),
    ignore: new Set(val("--ignore")?.split(",").filter(Boolean) ?? []),
    force: argv.includes("--force"),
  };
  const results = files.map((f) => checkParity(root, isAbsolute(f) ? relative(root, f) : f, opts));
  if (argv.includes("--json")) console.log(JSON.stringify(results, null, 2));
  else
    for (const r of results) {
      console.log(`${r.verdict.padEnd(7)} ${r.witness} — ${r.reason}${r.forced ? " [advisory: --force over an environment mismatch]" : ""}`);
      for (const m of r.envMismatch ?? []) console.log(`          ${m.key}: recorded ${m.recorded}, installed ${m.installed ?? "absent"}`);
      for (const p of r.diff ?? []) console.log(`          ${p}`);
    }
  return results.some((r) => r.verdict === "fail") ? 1 : 0;
}

if (import.meta.main) process.exit(main());
