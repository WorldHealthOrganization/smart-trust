/**
 * Which verify/write pairs a set of CHANGED PATHS can have affected.
 *
 * @module scripts/changed-paths
 * @graphNode none — a selection helper for `regen-after-merge.ts`
 *
 * ## What it answers
 *
 * *"Did anything this pair reads change?"* Two callers ask it:
 *
 * - `regen --changed <base>` asks it once, before the first pass, of the paths
 *   that differ between `<base>` and the merged tree. A pair none of whose
 *   inputs changed reads exactly what it read at `<base>`, so its answer there
 *   is its answer here.
 * - the fixpoint asks it before every later pass, of the paths the previous
 *   pass ACTUALLY changed — measured from the working tree before and after
 *   ({@link snapshotTree}), never taken from what a writer declares it writes.
 *
 * ## What a pair's footprint is
 *
 * The same set {@link fingerprint} hashes, so the two mechanisms cannot
 * disagree about what a pair reads:
 *
 * - its declared `inputs` and `outputs` globs (`task-io.ts`), matched against
 *   each changed path directly — so a file the change DELETED or CREATED is
 *   seen, which expanding the globs over the current tree alone would miss;
 * - the files those globs expand to now, and every directory above them — so a
 *   changed submodule gitlink (which `git diff` reports as one path) touches
 *   every declared file inside it;
 * - the script sources the pair runs, with their relative-import closure;
 * - `bun.lock`, and the `package.json` command line of every script the pair
 *   runs, following `bun run X` into X.
 *
 * ## Never skipped
 *
 * A pair is ALWAYS affected when it declares no inputs, when it declares
 * `{tracked}` and anything at all changed, when any script it runs passes
 * `--against <ref>` (a qa-reports baseline moves with no path changing — see
 * {@link hasAgainstRef}), or when its footprint cannot be
 * computed (a glob over nothing, a command that is not a script, a
 * non-literal dynamic import). Not knowing is never a reason to skip. And a
 * change set that could not be measured is `undefined`, which asks every pair.
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { TRACKED, entryFiles, expandGlobs, sourceClosure, type PairIO } from "./input-hash.ts";
import { CHECKOUT_SCRIPTS_KEY, scriptTable } from "../schemas/sdlc/script-table.ts";

/** What a pair can read, or why that cannot be said. */
export type Footprint =
  | { always: string }
  | { wholeTree: true }
  | {
      /** Declared globs and plain paths, matched against changed paths as patterns. */
      patterns: readonly string[];
      /** Every file the patterns expand to now, plus the script closure. */
      files: ReadonlySet<string>;
      /** Every directory above a file in `files` — a changed gitlink or directory hits these. */
      dirs: ReadonlySet<string>;
      /** Every npm script the pair runs, `bun run` followed. */
      scriptNames: readonly string[];
    };

/** The footprint of one pair: its declaration plus the scripts `scriptNames` run. */
export function footprintOf(
  root: string,
  scripts: Readonly<Record<string, string>>,
  scriptNames: readonly string[],
  io: PairIO | undefined,
): Footprint {
  if (io?.inputs === undefined) return { always: "no input declaration in task-io.ts" };
  if (io.inputs.includes(TRACKED)) return { wholeTree: true };
  const patterns = [...io.inputs, ...(io.outputs ?? [])];
  const declared = expandGlobs(root, patterns);
  if ("undetermined" in declared) return { always: `inputs could not be determined: ${declared.undetermined}` };
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const s of scriptNames) {
    const e = entryFiles(root, scripts, s, seen);
    if (e === undefined) return { always: `\`${s}\` does not resolve to script files` };
    entries.push(...e);
  }
  // `seen` now holds every script the pair runs, `bun run` followed.
  const against = [...seen].filter((s) => hasAgainstRef(scripts[s]));
  if (against.length > 0) {
    return { always: `judges against a qa-reports baseline, which is not a path (\`${against.join("`, `")}\` passes --against)` };
  }
  const closure = sourceClosure(root, entries);
  if ("undetermined" in closure) return { always: `inputs could not be determined: ${closure.undetermined}` };
  const files = new Set([...declared.files, ...closure.files]);
  const dirs = new Set<string>();
  for (const f of files) {
    for (let i = f.indexOf("/"); i > 0; i = f.indexOf("/", i + 1)) dirs.add(f.slice(0, i));
  }
  return { patterns, files, dirs, scriptNames: [...seen] };
}

/**
 * Whether a command passes `--against <ref>` (or `--against=<ref>`).
 *
 * Such a check judges against the `qa-reports` entry for that ref, which moves
 * whenever the ref publishes while no path in this repository changes. A
 * change set made of paths cannot see it, so the pair is always asked. The
 * input-hash cache answers the same hazard differently, by hashing the
 * baseline's identity (`againstRefsOf` in `input-hash.ts`, #2157); this is the
 * same token scan, kept here so neither change depends on the other. Callers
 * apply it to every script the pair runs, so `bun run` nesting is covered.
 */
export function hasAgainstRef(command: string | undefined): boolean {
  if (command === undefined) return false;
  return command
    .split(/\s+/)
    .map((t) => t.replace(/^["']|["']$/g, ""))
    .some((t) => t === "--against" || t.startsWith("--against="));
}

/** Whether a declared pattern names `path` — a glob match, the file itself, or a path under a plain directory. */
export function patternHits(pattern: string, path: string): boolean {
  if (/[*?[{]/.test(pattern)) return new Bun.Glob(pattern).match(path);
  const p = pattern.replace(/\/$/, "");
  return path === p || path.startsWith(`${p}/`) || p.startsWith(`${path}/`);
}

/** The verdict for one pair, with the reason `--explain` prints. */
export type Affected = { affected: boolean; why: string };

/** What a change set needs beyond its paths, to judge a `package.json` change. */
export interface ChangeContext {
  /**
   * Whether any of these npm scripts has a different command line than before
   * the change. Absent: a `package.json` change affects every declared pair.
   */
  scriptsChanged?: (names: readonly string[]) => boolean;
}

/**
 * Whether `changed` can have changed this pair's answer.
 *
 * `changed === undefined` means the change set could not be measured, and
 * every pair is affected — could-not-determine is never a skip.
 */
export function affects(fp: Footprint, changed: ReadonlySet<string> | undefined, ctx: ChangeContext = {}): Affected {
  if ("always" in fp) return { affected: true, why: fp.always };
  if (changed === undefined) return { affected: true, why: "the change set could not be measured" };
  if ("wholeTree" in fp) {
    return changed.size > 0
      ? { affected: true, why: `declares {tracked}, and ${changed.size} path(s) changed` }
      : { affected: false, why: "declares {tracked}, and no path changed" };
  }
  if (changed.has("bun.lock")) return { affected: true, why: "bun.lock changed" };
  // A script now lives in the manifest of the layer that runs it (bean `ar1s`
  // phase 4), so ANY `package.json` may carry the command a pair runs.
  const manifestChanged = [...changed].some((c) => c === "package.json" || c.endsWith("/package.json"));
  if (manifestChanged && (ctx.scriptsChanged?.(fp.scriptNames) ?? true)) {
    return { affected: true, why: "package.json changed a command this pair runs (or could not be compared)" };
  }
  for (const c of changed) {
    if (fp.files.has(c)) return { affected: true, why: `${c} changed` };
    if (fp.dirs.has(c)) return { affected: true, why: `${c} changed, and declared files lie under it` };
    const hit = fp.patterns.find((p) => patternHits(p, c));
    if (hit !== undefined) return { affected: true, why: `${c} changed, matching ${hit}` };
  }
  return {
    affected: false,
    why: `none of ${changed.size} changed path(s) is among its ${fp.files.size} declared and script files`,
  };
}

function git(root: string, args: readonly string[]): string | undefined {
  const r = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  return r.exitCode === 0 ? r.stdout.toString() : undefined;
}

const split = (s: string): string[] => s.split("\0").filter(Boolean);

/**
 * The paths that differ between `base` and the working tree as it stands:
 * `git diff <base>...HEAD`, the working tree and index against `HEAD`, and
 * untracked files. Renames are listed as both paths.
 *
 * `base...HEAD` is the change since the MERGE BASE of the two, so for a
 * `base` that is an ancestor of `HEAD` it is simply `base..HEAD`. During an
 * uncommitted merge (`merge-base.ts` runs regen before committing) the
 * incoming side is in the working-tree half.
 */
export function changedSince(
  root: string,
  base: string,
): { paths: Set<string>; baseSha: string } | { undetermined: string } {
  const sha = git(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`])?.trim();
  if (sha === undefined || sha === "") return { undetermined: `no such commit ${base}` };
  const committed = git(root, ["diff", "--name-only", "-z", "--no-renames", `${sha}...HEAD`]);
  if (committed === undefined) return { undetermined: `git diff ${base}...HEAD failed (no merge base? a shallow clone?)` };
  const working = git(root, ["diff", "--name-only", "-z", "--no-renames", "HEAD"]);
  const untracked = git(root, ["ls-files", "-o", "--exclude-standard", "-z"]);
  if (working === undefined || untracked === undefined) return { undetermined: "could not list the working tree" };
  return { paths: new Set([...split(committed), ...split(working), ...split(untracked)]), baseSha: sha };
}

/**
 * The scripts whose `package.json` command differs between `base` and the
 * working tree — for {@link ChangeContext.scriptsChanged}. `undefined` when the
 * old `package.json` cannot be read, which makes a `package.json` change
 * affect every declared pair.
 */
export function scriptsChangedSince(
  root: string,
  base: string,
  now: Readonly<Record<string, string>>,
): ((names: readonly string[]) => boolean) | undefined {
  // Every manifest the table reads now, read as it was at `base`: the root's
  // `scripts` and each layer's `checkoutScripts`. A manifest that did not exist
  // at `base` contributes nothing, which makes its scripts read as changed.
  const before: Record<string, string> = {};
  let manifests: string[];
  try {
    manifests = [...new Set([...scriptTable(root).values()].map((e) => e.manifest))];
  } catch {
    return undefined;
  }
  if (!manifests.includes("package.json")) manifests.push("package.json");
  for (const manifest of manifests) {
    const text = git(root, ["show", `${base}:${manifest}`]);
    if (text === undefined) {
      if (manifest === "package.json") return undefined;
      continue;
    }
    try {
      const m = JSON.parse(text) as Record<string, unknown>;
      const block = (manifest === "package.json" ? m.scripts : m[CHECKOUT_SCRIPTS_KEY]) as Record<string, string> | undefined;
      Object.assign(before, block ?? {});
      // The root's scripts BEFORE the move are the whole table at that base.
      if (manifest === "package.json") Object.assign(before, (m.scripts as Record<string, string> | undefined) ?? {});
    } catch {
      return undefined;
    }
  }
  return (names) => names.some((n) => before[n] !== now[n]);
}

/** Path → content digest of every path that differs from `HEAD`, plus untracked files. */
export type TreeSnapshot = ReadonlyMap<string, string>;

/**
 * A snapshot of the working tree's departure from `HEAD`, so two of them say
 * which paths changed between — measured, not declared.
 *
 * A path that is clean in both snapshots did not change between them (it
 * equals `HEAD` both times). A path dirty in either is compared by content.
 * A directory (a submodule) is compared by its checked-out commit and its own
 * status. Ignored files are invisible here, which is why a pair may not
 * declare `inputs` over one (`task-io.ts`).
 */
export function snapshotTree(root: string): TreeSnapshot | undefined {
  const working = git(root, ["diff", "--name-only", "-z", "--no-renames", "HEAD"]);
  const untracked = git(root, ["ls-files", "-o", "--exclude-standard", "-z"]);
  if (working === undefined || untracked === undefined) return undefined;
  const out = new Map<string, string>();
  for (const p of new Set([...split(working), ...split(untracked)])) {
    const abs = join(root, p);
    let st;
    try {
      st = statSync(abs);
    } catch {
      out.set(p, "absent");
      continue;
    }
    if (st.isDirectory()) {
      const head = git(abs, ["rev-parse", "HEAD"]) ?? "?";
      const status = git(abs, ["status", "--porcelain"]) ?? "?";
      out.set(p, `dir ${head.trim()} ${createHash("sha256").update(status).digest("hex")}`);
    } else {
      out.set(p, createHash("sha256").update(readFileSync(abs)).digest("hex"));
    }
  }
  return out;
}

/** The paths whose state differs between two snapshots. */
export function diffSnapshots(before: TreeSnapshot, after: TreeSnapshot): Set<string> {
  const changed = new Set<string>();
  for (const [p, d] of before) if (after.get(p) !== d) changed.add(p);
  for (const [p, d] of after) if (before.get(p) !== d) changed.add(p);
  return changed;
}

/** `--changed <base>` / `--changed=<base>`, or undefined. */
export function changedBaseFromArgv(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--changed") {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Error("--changed needs a base commit, e.g. --changed origin/main");
      return v;
    }
    if (a.startsWith("--changed=")) return a.slice("--changed=".length);
  }
  return undefined;
}
