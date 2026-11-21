#!/usr/bin/env bun
/**
 * qa-verify-moved — is every QA file that is leaving `main` already on the
 * `qa-reports` branch, byte for byte? Moved files are removed from `main`
 * only once the branch holds a hash-verified copy; this is the hash
 * verification.
 *
 * ## What "moved" means — derived, never listed
 *
 * The moved set is every file under every directory a layer declares as a
 * `qa` graph — {@link resolveQaLocation}, the same answer `qa:publish` uses
 * for its roots, so the set verified is the set published by construction.
 * Nothing else is in it:
 *
 * - `test/attestations/` is the `attestations` kind and stays on `main`; it
 *   is not a `qa` directory, so it is never inventoried.
 * - `test/health/results/` is the `health` kind. `qa:publish` does not carry
 *   it, so it cannot be verified against an entry and is not in the set.
 *
 * ## The states, and a fetch miss is never green
 *
 * | exit | state | meaning |
 * |---|---|---|
 * | 0 | identical | every inventoried path is in the entry with the same blob id |
 * | 1 | differs | at least one path differs, or is missing from the entry |
 * | 2 | unknown | the entry could not be read (miss, corrupt, remote failure), or there was nothing to compare. **Never a pass.** |
 * | 3 | usage | malformed invocation |
 *
 * Paths the ENTRY holds and the checkout does not are reported as `extra` and
 * do not fail: removal needs the branch to hold everything `main` holds, not
 * the reverse.
 *
 * ## How it compares
 *
 * Blob ids, never contents. The entry's ids come from its trees
 * ({@link readQaBlobIds}: one trees-only fetch, no blob downloaded). The
 * working tree's come from `git hash-object --stdin-paths` in the checkout,
 * which applies the checkout's attributes exactly as `qa:publish`'s
 * `git add` does — so an identical file has an identical id.
 *
 * Usage:
 *   bun run cat qa:verify-moved --key main/<sha> | pr/<n>/<sha> [--json]
 *   bun run cat qa:verify-moved --inventory [--json]          # the moved set, counted; reads no branch
 *   ... --root <repo-relative dir> (repeatable)           # override the declared roots (tests)
 *   ... --remote URL --branch B --store DIR               # as qa-store
 *
 * @module scripts/qa-verify-moved
 * @covers qa
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { QaUsageError, parseQaRef, readQaBlobIds, resolveQaLocation, type QaStoreOptions } from "./qa-store.ts";
import { mountedInstancesCached, outputTwinOf } from "./lib/layer-output.ts";

export const VERIFY_EXIT = { identical: 0, differs: 1, unknown: 2, usage: 3 } as const;

export interface MovedFile {
  /** Repository-relative, as the layer lays it out: the `qa-reports` key. */
  path: string;
  bytes: number;
  /**
   * Repository-relative, where the bytes ARE when that is not {@link path}:
   * the layer output root (`build/layers/<instance>/…`) of a mounted layer
   * (bean `cat-tools-sm8r`, item 4). Absent, the file is at `path`.
   */
  at?: string;
}

/** Where a {@link MovedFile}'s bytes are, repository-relative. */
export function locationOf(f: MovedFile): string {
  return f.at ?? f.path;
}

export interface MovedDirectory {
  /** Repository-relative, no trailing slash. */
  path: string;
  files: MovedFile[];
}

export interface MovedInventory {
  directories: MovedDirectory[];
  files: number;
  bytes: number;
}

export type VerifyState = keyof typeof VERIFY_EXIT;

export interface VerifyResult {
  state: Exclude<VerifyState, "usage">;
  reason: string;
  key?: string;
  identical: string[];
  differs: string[];
  /** In the working tree, not in the entry. */
  missing: string[];
  /** In the entry under a moved root, not in the working tree. Reported, never a failure. */
  extra: string[];
}

function gitTopLevel(cwd = process.cwd()): string {
  // input-site: tree #128d75cd — rev-parse --show-toplevel: a fact about the checkout
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new QaUsageError(`not a git checkout: ${cwd}`);
  return r.stdout.trim();
}

function walk(abs: string, repoRoot: string, out: MovedFile[]): void {
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const p = join(abs, e.name);
    if (e.isDirectory()) walk(p, repoRoot, out);
    else if (e.isFile()) out.push({ path: relative(repoRoot, p).split("\\").join("/"), bytes: statSync(p).size });
  }
}

/** The checkout's mounted layers; none when its lock does not parse, so the inventory is the mounts alone, as before. */
function mountedForInventory(repoRoot: string): Map<string, string> {
  try {
    return mountedInstancesCached(repoRoot);
  } catch {
    return new Map();
  }
}

/** The declared `qa` roots, repository-relative — or `roots` when given. */
export function movedRoots(repoRoot: string, roots?: string[]): string[] {
  if (roots && roots.length) return roots.map((r) => r.replace(/^\.\//, "").replace(/\/+$/, ""));
  return resolveQaLocation(repoRoot).directories.map((d) => d.path);
}

/**
 * The moved set as the WORKING TREE holds it: every file on disk under each
 * root. An absent root contributes an empty directory entry — the caller
 * decides what nothing means; this function does not call it clean.
 */
export function movedInventory(repoRoot: string, roots?: string[]): MovedInventory {
  const directories: MovedDirectory[] = [];
  const mounted = mountedForInventory(repoRoot);
  for (const path of movedRoots(repoRoot, roots)) {
    const abs = join(repoRoot, path);
    const files: MovedFile[] = [];
    if (existsSync(abs) && statSync(abs).isDirectory()) walk(abs, repoRoot, files);
    // A mounted layer's computed results are under its output root, and its
    // pinned ones stay in the mount. The inventory is their union, keyed by
    // the layer's own path; the output root wins where both hold a file, as
    // `readPathAt` reads it.
    const twin = mounted.size ? outputTwinOf(repoRoot, abs, mounted) : undefined;
    if (twin !== undefined && existsSync(twin) && statSync(twin).isDirectory()) {
      const computed: MovedFile[] = [];
      walk(twin, repoRoot, computed);
      const twinRel = relative(repoRoot, twin).split("\\").join("/");
      const byPath = new Map(files.map((f) => [f.path, f]));
      for (const c of computed) {
        const logical = path + c.path.slice(twinRel.length);
        byPath.set(logical, { path: logical, bytes: c.bytes, at: c.path });
      }
      files.splice(0, files.length, ...byPath.values());
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    directories.push({ path, files });
  }
  const all = directories.flatMap((d) => d.files);
  return { directories, files: all.length, bytes: all.reduce((s, f) => s + f.bytes, 0) };
}

/** Blob ids of working-tree files, computed in the checkout so its attributes apply. */
export function hashWorkingFiles(repoRoot: string, paths: string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  // input-site: tree #b95bbdbf — hash-object of named working-tree files
  const r = spawnSync("git", ["hash-object", "--stdin-paths"], { cwd: repoRoot, input: paths.join("\n") + "\n", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`git hash-object failed: ${r.stderr?.toString().trim()}`);
  const ids = r.stdout.toString().trim().split("\n");
  if (ids.length !== paths.length) throw new Error(`git hash-object returned ${ids.length} ids for ${paths.length} paths`);
  paths.forEach((p, i) => out.set(p, ids[i]!));
  return out;
}

/** Compare the moved set in the working tree with the entry `ref` on the branch. */
export function verifyMoved(args: { ref: string; roots?: string[] }, opts: QaStoreOptions = {}): VerifyResult {
  const repoRoot = opts.repoRoot ?? gitTopLevel();
  parseQaRef(args.ref); // a malformed ref is a usage error, thrown before any fetch
  const empty = { identical: [], differs: [], missing: [], extra: [] };
  const inv = movedInventory(repoRoot, args.roots);
  if (inv.files === 0) {
    return { state: "unknown", reason: "the working tree holds no file under any moved root; there is nothing to verify", ...empty };
  }
  let read: ReturnType<typeof readQaBlobIds>;
  try {
    read = readQaBlobIds(args.ref, { ...opts, repoRoot });
  } catch (e) {
    if (e instanceof QaUsageError) throw e;
    return { state: "unknown", reason: `could not read ${args.ref}: ${(e as Error).message}`, ...empty };
  }
  if (read.state !== "hit") {
    return { state: "unknown", reason: `entry ${args.ref} is ${read.state.toUpperCase()}: ${read.reason} — an unread entry verifies nothing`, ...empty };
  }
  const files = inv.directories.flatMap((d) => d.files);
  const paths = files.map((f) => f.path);
  const hashed = hashWorkingFiles(repoRoot, files.map(locationOf));
  const local = new Map(files.map((f) => [f.path, hashed.get(locationOf(f))!]));
  const res: VerifyResult = { state: "identical", reason: "", key: read.key, identical: [], differs: [], missing: [], extra: [] };
  for (const p of paths) {
    const there = read.blobs.get(p);
    if (there === undefined) res.missing.push(p);
    else if (there === local.get(p)) res.identical.push(p);
    else res.differs.push(p);
  }
  const roots = inv.directories.map((d) => d.path);
  const localSet = new Set(paths);
  for (const p of read.blobs.keys()) {
    if (!localSet.has(p) && roots.some((r) => p.startsWith(r + "/"))) res.extra.push(p);
  }
  res.extra.sort();
  if (res.differs.length || res.missing.length) {
    res.state = "differs";
    res.reason = `${res.differs.length} differ, ${res.missing.length} missing from ${read.key}, ${res.identical.length} identical`;
  } else {
    res.reason = `all ${res.identical.length} file(s) identical in ${read.key}` + (res.extra.length ? `; ${res.extra.length} extra on the branch` : "");
  }
  return res;
}

function main(argv: string[]): number {
  const one = (n: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const many = (n: string): string[] => argv.flatMap((a, i) => (a === `--${n}` && argv[i + 1] ? [argv[i + 1]!] : []));
  const json = argv.includes("--json");
  const opts: QaStoreOptions = {
    ...(one("remote") ? { remote: one("remote") } : {}),
    ...(one("branch") ? { branch: one("branch") } : {}),
    ...(one("store") ? { storeDir: one("store") } : {}),
  };
  const roots = many("root");
  if (argv.includes("--inventory")) {
    const inv = movedInventory(gitTopLevel(), roots);
    if (json) console.log(JSON.stringify(inv, null, 2));
    else {
      console.log(`moved QA files: ${inv.files} file(s), ${inv.bytes} bytes`);
      for (const d of inv.directories) console.log(`  ${String(d.files.length).padStart(5)}  ${String(d.files.reduce((s, f) => s + f.bytes, 0)).padStart(10)}  ${d.path}`);
    }
    return 0;
  }
  const key = one("key");
  if (!key) throw new QaUsageError("needs --key main/<sha> | pr/<n>/<sha>, or --inventory");
  const r = verifyMoved({ ref: key, roots }, opts);
  if (json) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`qa:verify-moved ${r.state.toUpperCase()}: ${r.reason}${r.state === "unknown" ? " — this is NOT a pass" : ""}`);
    for (const p of r.differs.slice(0, 20)) console.log(`  differs  ${p}`);
    for (const p of r.missing.slice(0, 20)) console.log(`  missing  ${p}`);
    if (r.differs.length + r.missing.length > 40) console.log("  …");
  }
  return VERIFY_EXIT[r.state];
}

if (import.meta.main) {
  let code: number;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    if (e instanceof QaUsageError) {
      console.error(`qa-verify-moved: ${e.message}`);
      code = VERIFY_EXIT.usage;
    } else {
      console.error(`qa-verify-moved: could not determine — ${(e as Error).message}. This is NOT a pass.`);
      code = VERIFY_EXIT.unknown;
    }
  }
  process.exit(code);
}
