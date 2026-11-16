#!/usr/bin/env bun
/**
 * qa-store — the ONE read/write API for QA results kept on the orphan
 * `qa-reports` branch.
 *
 * ## The layout it reads and writes
 *
 * ```
 * qa-reports  (orphan; never merged; author folio-qa-bot)
 * ├── index.json                       qa-reports-index/v1: newest entry per ref
 * ├── main/<commit-sha>/               one tree per main commit that published
 * │   ├── manifest.json                qa-reports-manifest/v1
 * │   └── <instance>/test/results/**   byte-identical to the checkout's layout
 * └── pr/<number>/<head-sha>/…         same shape
 * ```
 *
 * ## Four states, and a miss is never empty-clean
 *
 * Every read answers one of `hit` / `miss` / `corrupt` / `unknown`, and the CLI
 * maps them onto lake-cache's exit codes plus one:
 *
 * | state | exit | meaning |
 * |---|---|---|
 * | hit | 0 | the entry (and the path asked for) is there and verifies |
 * | miss | 1 | determined absent: no branch, no entry, or no such path in it |
 * | usage | 2 | the question was malformed (bad `--ref`, ambiguous sha prefix) |
 * | corrupt | 3 | present but unusable: no/foreign manifest, payload tree mismatch, unparseable JSON |
 * | unknown | 4 | could not determine: the remote or git failed. **Never a pass.** |
 *
 * The type does not let a miss carry a file list at all, so no reader can
 * render `miss` as "no findings".
 *
 * ## How it talks to git
 *
 * 1. **Read in one batch.** A snapshot fetches the tip with
 *    `--depth=1 --filter=blob:none` (trees only), then fetches every missing
 *    blob of the entry in ONE `fetch --stdin` round trip, not one per file.
 * 2. **Push with `-c pack.useSparse=false`**, so blobs already on the remote
 *    under another `main/<sha>/` are not resent.
 * 3. **Hash through a private `GIT_INDEX_FILE`** (`git add` + `write-tree`),
 *    far faster than per-file `hash-object`, same tree id.
 * 4. **Tolerate `push negotiation failed; proceeding anyway`** on stderr: the
 *    push's exit code is the verdict, never its stderr.
 * 5. **Never `-f`.** Fetch the tip, splice this entry in, `commit-tree -p tip`,
 *    push; on rejection back off ({@link waitFor}, the same numbers as
 *    `backoff-sleep.ts`) and rebuild on the new tip — 3 attempts, or up to
 *    {@link PUBLISH_RACE_ATTEMPTS} while every rejection is a lost race. The
 *    server's ref lock is the concurrency primitive, so a sibling's entry survives.
 *
 * ## Where its git objects live
 *
 * In a PRIVATE bare repository, `<git-common-dir>/qa-store.git`, never in the
 * checkout's own object store: a `--filter` fetch turns the repository it runs
 * in into a partial clone by rewriting its config, and a reader must not do
 * that to a contributor's checkout. CI's checkout token (`http.*.extraheader`)
 * is carried across in the ENVIRONMENT (`GIT_CONFIG_COUNT`), never in argv.
 *
 * Usage:
 *   bun run cat qa:fetch [--ref main|<sha>|main/<sha>|pr/<n>|pr/<n>/<sha>] [--into DIR] [--prefix P]
 *   bun run cat qa:publish --ref main/<sha>|pr/<n>/<sha> [--root DIR ...] [--gates-result R]
 *   bun run cat qa:publish --add --ref main/<sha>|pr/<n>/<sha> --root DIR ...   # into the EXISTING entry;
 *                                                       # only creates paths, or replaces earlier adds
 *   bun run cat qa:publish --github --completeness FILE [--gates-result R]   # CI: derive the key, skip forks,
 *                                                       # refuse an incomplete qa:refresh report
 *   bun run cat qa:prune [--apply] [--pr-states FILE]       # dry run unless --apply
 *   bun run cat-harness-tools/scripts/qa-store.ts read --ref R <path>
 *   bun run cat-harness-tools/scripts/qa-store.ts where
 *
 * @module scripts/qa-store
 * @covers qa
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { layerRootsIn, resolveDirectories } from "../schemas/kg/cat-harness.js";
// `readDeclaration` throws on the `folio` kind unless core has registered it —
// the same side-effect import `check-declared-dirs.ts` carries, same reason.
import "../schemas/kg/folio-graph-typology.js";
import { waitFor } from "../src/core/retry.js";
import { PUSH_BASE_MS, PUSH_CAP_MS } from "./backoff-sleep.js";
import { TreeStore } from "./branch-store.js";
import { inputSiteReached, qaRefLine, quietly } from "../schemas/sdlc/input-trace.ts";
import { mountedInstancesCached, outputTwinOf, overlayDirs, writePathOf } from "./lib/layer-output.ts";

// ── Constants ────────────────────────────────────────────────────────────

/**
 * The branch's name, and the names it had before, newest first. Owner
 * 2026-10-02: special branches are `cat/<harness>/<name>` (note on `fs43`,
 * bean `tlk2`), superseding the interim `cat-` prefix of bean `32f6`.
 *
 * The old names are RETIRED (bean `oycs`, 2026-10-24): `git ls-remote` shows
 * no `qa-reports` or `cat-qa-reports` head on any litlfred or WHO remote. They
 * are no longer read or written. A declaration that still spells one is
 * taken to mean {@link QA_BRANCH}.
 */
export const QA_BRANCH = "cat/cat-harness/qa-reports";
export const LEGACY_QA_BRANCHES: readonly string[] = ["cat-qa-reports", "qa-reports"];
/** The branch when no declaration names one (proposal §2.4). */
export const DEFAULT_QA_BRANCH = QA_BRANCH;
export const MANIFEST_FILE = "manifest.json";
export const MANIFEST_SCHEMA = "qa-reports-manifest/v1";
export const INDEX_FILE = "index.json";
export const INDEX_SCHEMA = "qa-reports-index/v1";
/** Write attempts, the first included, for a failure that is not a lost race. Proposal §2.2 and spike finding 4. */
export const PUBLISH_ATTEMPTS = 3;
/**
 * Write attempts, the first included, while every failure is a LOST RACE: the
 * push was rejected because a sibling landed first (`fetch first`,
 * `non-fast-forward`). That is progress on the branch, not a fault, so it
 * earns more tries than {@link PUBLISH_ATTEMPTS}. Stacked merges put a dozen
 * writers on the branch at once and three tries lost every race
 * (smart-ra#189, #194, #221, 2026-11-15).
 */
export const PUBLISH_RACE_ATTEMPTS = 12;
/** The longest wait between lost races: wider than {@link PUSH_CAP_MS}, so a herd spreads out. */
export const PUBLISH_RACE_CAP_MS = 60_000;

/** Was this push rejected only because the branch moved under it? */
export function lostRace(stderr: string): boolean {
  return /\[rejected\].*\((fetch first|non-fast-forward)\)|cannot lock ref|failed to update ref|stale info/i.test(stderr);
}
/** The committer the branch is written as. */
export const QA_BOT = { name: "folio-qa-bot", email: "folio-qa-bot@users.noreply.github.com" };

/** lake-cache's exit codes, plus `unknown`, which lake-cache has no word for. */
export const QA_EXIT = { hit: 0, miss: 1, usage: 2, corrupt: 3, unknown: 4 } as const;

// ── Types ────────────────────────────────────────────────────────────────

export type QaState = "hit" | "miss" | "corrupt" | "unknown";

/** Not a hit. A miss carries no data on purpose: there is nothing to read as clean. */
export type QaNotHit = { state: "miss" | "corrupt" | "unknown"; reason: string };

/** A store key: where ONE run's results live on the branch. */
export type QaKey = { kind: "main"; sha: string } | { kind: "pr"; pr: number; sha: string };

/** What a reader may ask for — a key, or "the newest" of a ref. */
export type QaRefSpec =
  | { kind: "main-latest" }
  | { kind: "main"; sha: string }
  | { kind: "pr-latest"; pr: number }
  | { kind: "pr"; pr: number; sha: string };

export interface QaReadHit {
  state: "hit";
  /** The resolved key path, e.g. `main/<sha>`. */
  key: string;
  /** The branch commit it was read from. */
  tip: string;
}

export type QaFileRead = (QaReadHit & { path: string; text: string }) | QaNotHit;
export type QaTreeRead =
  | (QaReadHit & { prefix: string; files: Map<string, string> })
  | (QaNotHit & { bad?: string[] });

export interface QaManifest {
  $schema: typeof MANIFEST_SCHEMA;
  key: string;
  /** The commit the results describe (a PR's HEAD sha for `pr/…`). */
  source: string;
  /** The commit actually checked out when it differs (a PR's merge commit). */
  checkout?: string;
  pr?: number;
  /** Repository-relative roots that were published. */
  roots: string[];
  /** The tree of the payload WITHOUT this manifest — what a reader verifies. */
  payloadTree: string;
  files: number;
  bytes: number;
  written_at: string;
  producer?: { run?: string; gates?: string };
  /**
   * Content-addressed reference to the `folio-run-context/v1` record under
   * which this QA store entry was produced (owner C1 = (a), bean `3sbm`).
   */
  runContext?: { sha256: string };
  /**
   * What `qa:refresh` said of the working copy this entry was built from (bean
   * `3hk4`): `tracked` (the commit's own committed copy) or `computed` (the
   * declared writers ran into an empty tree), and the files per writer. Absent
   * on an entry published without a report, which `--github` refuses.
   */
  completeness?: { mode: string; files: number; families: Record<string, number> };
  /**
   * Files a later `qa:publish --add` put into this entry, by path (bean
   * `1dre`). The entry's first write stands for every path NOT listed here: an
   * add may only create a path, or replace one an earlier add created.
   */
  added?: Record<string, { written_at: string; bytes: number; run?: string }>;
}

export interface QaIndex {
  $schema: typeof INDEX_SCHEMA;
  main?: { sha: string; written_at: string };
  pr?: Record<string, { sha: string; written_at: string }>;
  skipped?: Record<string, string>;
}

export interface QaStoreOptions {
  /** The checkout root. Default: `git rev-parse --show-toplevel` from cwd. */
  repoRoot?: string;
  /** The remote URL or path. Default: env `QA_STORE_REMOTE`, else the checkout's `origin`. */
  remote?: string;
  /** Default: the declared `storage.branch`, else {@link DEFAULT_QA_BRANCH}. */
  branch?: string;
  /** The private bare repository. Default: env `QA_STORE_DIR`, else `<git-common-dir>/qa-store.git`. */
  storeDir?: string;
  /** Injected for tests; default sleeps the backoff synchronously. */
  sleep?: (ms: number) => void;
  /** Called after the tree is built and before each push — tests widen the race window with it. */
  beforePush?: (attempt: number) => void;
  /** Progress lines; default stderr. */
  log?: (line: string) => void;
}

/** A malformed question — exit 2, never folded into miss. */
export class QaUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QaUsageError";
  }
}

// ── Keys and refs ────────────────────────────────────────────────────────

const FULL_SHA = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const SHA_PREFIX = /^[0-9a-f]{7,64}$/;

/** `main/<sha>` or `pr/<n>/<sha>`. */
export function keyPath(key: QaKey): string {
  return key.kind === "main" ? `main/${key.sha}` : `pr/${key.pr}/${key.sha}`;
}

/** Parse a WRITE key. A full sha is required: a key is an identity, not a search. */
export function parseQaKey(s: string): QaKey {
  const m = /^main\/([0-9a-f]+)$/.exec(s);
  if (m && FULL_SHA.test(m[1]!)) return { kind: "main", sha: m[1]! };
  const p = /^pr\/([1-9][0-9]*)\/([0-9a-f]+)$/.exec(s);
  if (p && FULL_SHA.test(p[2]!)) return { kind: "pr", pr: Number(p[1]), sha: p[2]! };
  throw new QaUsageError(`not a store key: "${s}" — expected main/<full-sha> or pr/<n>/<full-sha>`);
}

/** Parse a READ ref: `main`, `<sha>`, `main/<sha>`, `pr/<n>`, `pr/<n>/<sha>`. */
export function parseQaRef(s: string): QaRefSpec {
  if (s === "main") return { kind: "main-latest" };
  if (SHA_PREFIX.test(s)) return { kind: "main", sha: s };
  const m = /^main\/([0-9a-f]{7,64})$/.exec(s);
  if (m) return { kind: "main", sha: m[1]! };
  const p = /^pr\/([1-9][0-9]*)(?:\/([0-9a-f]{7,64}))?$/.exec(s);
  if (p) return p[2] ? { kind: "pr", pr: Number(p[1]), sha: p[2] } : { kind: "pr-latest", pr: Number(p[1]) };
  throw new QaUsageError(`not a qa ref: "${s}" — expected main | <sha> | main/<sha> | pr/<n> | pr/<n>/<sha>`);
}

// ── Location (the declaration) ───────────────────────────────────────────

export interface QaDirectory {
  /** The declaring layer's root, absolute. */
  instance: string;
  id: string;
  /** Repository-relative, no trailing slash — the path on the branch too. */
  path: string;
  absPath: string;
  present: boolean;
  storage?: import("../schemas/kg/cat-harness.js").DirectoryStorage;
}

export interface QaLocation {
  /** The branch every storage-backed `qa` directory names, or the default. */
  branch: string;
  keyedBy: "commit";
  /** True when at least one `qa` directory declares `storage`. */
  declared: boolean;
  directories: QaDirectory[];
}

/**
 * Where QA results live: every declared `qa` directory across the checkout's
 * layers, and the branch their `storage` names.
 *
 * Two directories naming DIFFERENT branches is refused rather than resolved by
 * order: one store per checkout is the design, and picking one would hand half
 * the readers a branch their writer never wrote.
 */
export function resolveQaLocation(repoRoot: string = gitTopLevel()): QaLocation {
  const directories: QaDirectory[] = [];
  const seen = new Set<string>();
  for (const inst of layerRootsIn(repoRoot)) {
    try {
      for (const d of resolveDirectories([{ name: "(local)", root: inst, own: true }])) {
        if (!d.graphTypologies.includes("qa" as never) || seen.has(d.absPath)) continue;
        seen.add(d.absPath);
        const storage = d.storage;
        directories.push({
          instance: inst,
          id: d.id,
          path: relative(repoRoot, d.absPath).split("\\").join("/").replace(/\/+$/, ""),
          absPath: d.absPath,
          // In the checkout, or under its layer output root when its layer is mounted (bean `cat-tools-sm8r`, item 4).
          present: overlayDirs(d.absPath).some((p) => statSync(p).isDirectory()),
          ...(storage ? { storage } : {}),
        });
      }
    } catch {
      // A layer in the checkout might declare typologies from unimported packages (e.g. an IG layer needing the IG pipeline layer's typologies)
      continue;
    }
  }
  directories.sort((a, b) => a.path.localeCompare(b.path));
  // A qa directory is keyed by commit, so its storage is one branch; the resolver refuses a family.
  const branches = [...new Set(directories.flatMap((d) => (d.storage && "branch" in d.storage ? [d.storage.branch] : [])))];
  if (branches.length > 1) {
    throw new QaUsageError(`qa directories declare ${branches.length} storage branches (${branches.join(", ")}); one store per checkout`);
  }
  return { branch: branches[0] ?? DEFAULT_QA_BRANCH, keyedBy: "commit", declared: branches.length === 1, directories };
}

// ── Which name the branch has ────────────────────────────────────────────

/**
 * The names to look for, in order. A declaration naming the QA branch, in its
 * current or a retired spelling, gets the current name only (bean `oycs`), so
 * a folio whose declaration predates the rename still finds the renamed
 * remote. Any other name is taken as given.
 */
export function qaBranchCandidates(declared: string): string[] {
  return declared === QA_BRANCH || LEGACY_QA_BRANCHES.includes(declared) ? [QA_BRANCH] : [declared];
}

/**
 * The rule, for readers AND writers: the first candidate that exists on the
 * remote, else the first candidate. Writers follow it too, so nothing creates
 * the new name beside a live legacy one and blocks the rename — GitHub's
 * branch rename refuses a target that exists, and keeps no redirect for git.
 */
export function pickQaBranch(candidates: readonly string[], present: ReadonlySet<string>): string {
  return candidates.find((c) => present.has(c)) ?? candidates[0]!;
}

// ── Git plumbing ─────────────────────────────────────────────────────────
//
// The plumbing itself is `branch-store.ts`'s `TreeStore` (bean `2h76`); what
// is left here is only what locates the checkout it runs in.

function gitTopLevel(cwd = process.cwd()): string {
  // input-site: store #128d75cd — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new QaUsageError(`not inside a git checkout: ${cwd}`);
  return r.stdout.trim();
}

/**
 * The store: a private bare repository plus how to reach the remote.
 *
 * Built once per (storeDir, remote, branch) and reused for the process, so a
 * reader asking for 487 files fetches the tip once and the blobs once.
 */
/**
 * The commit-keyed store: {@link TreeStore}'s plumbing, nothing added.
 *
 * Bean `2h76` part 1. This class was 200 lines of git plumbing that
 * `branch-store.ts` had a second copy of — `mktree` and `setPath` were
 * byte-identical but for a `private`, `must` identical outright. The copy that
 * survives is {@link TreeStore}, and the three axes the two actually differed
 * on are its constructor arguments.
 *
 * It takes the CANDIDATE names ({@link qaBranchCandidates}: the new
 * `cat/cat-harness/qa-reports` first, then the legacy spellings), which
 * TreeStore already carries; `fetchTip` reports which one answered.
 */
class Store extends TreeStore {
  constructor(
    dir: string,
    remote: string,
    candidates: readonly string[],
    authEnv: Record<string, string>,
    log?: (line: string) => void,
  ) {
    // TreeStore (bean `2h76` part 1) carries the candidate list and settles
    // `branch` on every fetchTip by the same rule as pickQaBranch: the first
    // name the remote has, else the first (#1801 merged onto #1982).
    super(dir, remote, candidates, authEnv, { identity: QA_BOT, refNamespace: "qa-store", log });
  }
}

/** The checkout's own `http.*.extraheader` lines, carried in env (never argv). */
function authEnvFrom(repoRoot: string): Record<string, string> {
  // input-site: store #d6d10161 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  const r = spawnSync("git", ["config", "--get-regexp", "^http\\..*extraheader$"], { cwd: repoRoot, encoding: "utf-8" });
  if (r.status !== 0 || !r.stdout.trim()) return {};
  const env: Record<string, string> = {};
  const lines = r.stdout.trim().split("\n");
  // input-site: store #d641fe25 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  const base = Number(process.env.GIT_CONFIG_COUNT ?? 0) || 0;
  lines.forEach((line, i) => {
    const sp = line.indexOf(" ");
    env[`GIT_CONFIG_KEY_${base + i}`] = line.slice(0, sp);
    env[`GIT_CONFIG_VALUE_${base + i}`] = line.slice(sp + 1);
  });
  env.GIT_CONFIG_COUNT = String(base + lines.length);
  return env;
}

const stores = new Map<string, Store>();

function openStore(opts: QaStoreOptions = {}): { store: Store; repoRoot: string } {
  const repoRoot = opts.repoRoot ?? gitTopLevel();
  // input-site: store #82ec2164 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  let remote = opts.remote ?? process.env.QA_STORE_REMOTE;
  if (!remote) {
    // input-site: store #68c082a4 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
    const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd: repoRoot, encoding: "utf-8" });
    if (r.status !== 0) throw new QaUsageError(`no remote: ${repoRoot} has no \`origin\`; pass --remote or QA_STORE_REMOTE`);
    remote = r.stdout.trim();
  }
  let branch = opts.branch;
  if (!branch) {
    try {
      branch = resolveQaLocation(repoRoot).branch;
    } catch (e) {
      if (e instanceof QaUsageError) throw e;
      branch = DEFAULT_QA_BRANCH;
    }
  }
  // input-site: store #ed418525 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  let storeDir = opts.storeDir ?? process.env.QA_STORE_DIR;
  if (!storeDir) {
    // input-site: store #f48bd6b7 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
    const c = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repoRoot, encoding: "utf-8" });
    if (c.status !== 0) throw new QaUsageError(`cannot find the git directory of ${repoRoot}`);
    storeDir = join(c.stdout.trim(), "qa-store.git");
  }
  const candidates = qaBranchCandidates(branch);
  const id = `${resolve(storeDir)}|${remote}|${candidates.join(",")}`;
  let store = stores.get(id);
  if (!store) {
    store = new Store(resolve(storeDir), remote, candidates, authEnvFrom(repoRoot), opts.log);
    stores.set(id, store);
  }
  return { store, repoRoot };
}

// ── Reading ──────────────────────────────────────────────────────────────

/** One resolved entry, its blobs made local on first content read. */
interface Snapshot {
  key: string;
  tip: string;
  entry: string;
  manifest: QaManifest;
  /** path (relative to the entry, i.e. repository-relative) → blob sha, payload only. */
  blobs?: Map<string, string>;
  contents?: Map<string, Buffer>;
}

type SnapshotResult = { state: "hit"; snap: Snapshot } | QaNotHit;

const snapshots = new Map<string, SnapshotResult>();

/** Forget every memoised tip and entry — a test, or a long-lived process, re-reading the branch. */
export function clearQaCache(): void {
  snapshots.clear();
  stores.clear();
}

function readIndex(store: Store, rootTree: string): { state: "ok"; index?: QaIndex } | QaNotHit {
  const e = store.lookup(rootTree, INDEX_FILE);
  if (!e) return { state: "ok" };
  if (!store.ensureBlobs(rootTree, [e.sha])) return { state: "unknown", reason: `could not fetch ${INDEX_FILE}` };
  try {
    const idx = JSON.parse(store.blobText(e.sha)) as QaIndex;
    if (idx.$schema !== INDEX_SCHEMA) return { state: "corrupt", reason: `${INDEX_FILE} is not ${INDEX_SCHEMA}` };
    return { state: "ok", index: idx };
  } catch (err) {
    return { state: "corrupt", reason: `${INDEX_FILE} does not parse: ${(err as Error).message}` };
  }
}

/**
 * The entry key a `skipped` target names. A full key is kept as it is: a PR
 * skipped onto main's entry maps to `main/<sha>`, and prefixing that with the
 * PR's own parent would name `pr/<n>/main/<sha>`, which never exists. A bare
 * sha is under `parent`.
 */
function skippedKey(parent: string, target: string): string {
  return /^(main|pr\/\d+)\//.test(target) ? target : `${parent}/${target}`;
}

/**
 * Find a fallback entry on `rootTree` when `sha` was skipped or not recorded.
 * Checks `index.json`'s `skipped` mapping first, then falls back to git history
 * via `repoRoot` to find the most recent recorded commit on that branch.
 */
function findSkippedTarget(
  store: Store,
  rootTree: string,
  parent: string,
  sha: string,
  repoRoot?: string,
): string | undefined {
  const idx = readIndex(store, rootTree);
  if (idx.state === "ok" && idx.index?.skipped) {
    const key = `${parent}/${sha}`;
    const target = idx.index.skipped[key] ?? idx.index.skipped[sha];
    if (target) {
      const targetKey = skippedKey(parent, target);
      if (store.lookup(rootTree, targetKey)) return targetKey;
    }
  }

  if (repoRoot && existsSync(repoRoot)) {
    try {
      // input-site: store #68a3002b — resolves which qa-reports entry a skipped sha reads (its nearest recorded ancestor); the identity hashed for an `--against` baseline is the entry this resolves to
      const r = spawnSync("git", ["rev-list", "-n", "50", sha], { cwd: repoRoot, encoding: "utf-8" });
      if (r.status === 0 && r.stdout.trim()) {
        const commits = r.stdout.trim().split("\n").map((c) => c.trim()).filter(Boolean);
        for (let i = 1; i < commits.length; i++) {
          const ancestor = commits[i]!;
          const targetKey = `${parent}/${ancestor}`;
          if (store.lookup(rootTree, targetKey)) return targetKey;
          if (idx.state === "ok" && idx.index?.skipped) {
            const mapped = idx.index.skipped[targetKey] ?? idx.index.skipped[ancestor];
            if (mapped) {
              const mappedKey = skippedKey(parent, mapped);
              if (store.lookup(rootTree, mappedKey)) return mappedKey;
            }
          }
        }
      }
    } catch {
      // ignore git rev-list failure
    }
  }

  return undefined;
}

function findSkippedTargetForPrefix(
  store: Store,
  rootTree: string,
  parent: string,
  prefix: string,
  repoRoot?: string,
): string | undefined {
  const idx = readIndex(store, rootTree);
  if (idx.state === "ok" && idx.index?.skipped) {
    const matches: string[] = [];
    for (const [k, v] of Object.entries(idx.index.skipped)) {
      const kSha = k.startsWith(`${parent}/`) ? k.slice(parent.length + 1) : k;
      if (kSha.startsWith(prefix)) {
        const targetKey = skippedKey(parent, v);
        if (store.lookup(rootTree, targetKey) && !matches.includes(targetKey)) {
          matches.push(targetKey);
        }
      }
    }
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new QaUsageError(`ambiguous sha prefix ${prefix}: ${matches.length} skipped entries match`);
    }
  }

  if (repoRoot && existsSync(repoRoot)) {
    try {
      // input-site: store #e0941588 — resolves a sha prefix to the qa-reports entry it reads; the identity hashed for an `--against` baseline is the entry this resolves to
      const r = spawnSync("git", ["rev-parse", "--verify", `${prefix}^{commit}`], { cwd: repoRoot, encoding: "utf-8" });
      if (r.status === 0 && r.stdout.trim()) {
        const fullSha = r.stdout.trim();
        return findSkippedTarget(store, rootTree, parent, fullSha, repoRoot);
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}

/** Resolve a spec to a key path on `rootTree`. */
function resolveSpec(store: Store, rootTree: string, spec: QaRefSpec, repoRoot?: string): { state: "ok"; key: string } | QaNotHit {
  if (spec.kind === "main" || spec.kind === "pr") {
    const parent = spec.kind === "main" ? "main" : `pr/${spec.pr}`;
    if (FULL_SHA.test(spec.sha)) {
      const key = `${parent}/${spec.sha}`;
      if (store.lookup(rootTree, key)) return { state: "ok", key };
      const fallback = findSkippedTarget(store, rootTree, parent, spec.sha, repoRoot);
      if (fallback) return { state: "ok", key: fallback };
      return { state: "miss", reason: `no entry ${key}` };
    }
    const dir = store.lookup(rootTree, parent);
    const names = dir?.type === "tree" ? store.lsTree(dir.sha).map((e) => e.name).filter((n) => n.startsWith(spec.sha)) : [];
    if (names.length === 1) return { state: "ok", key: `${parent}/${names[0]}` };
    if (names.length > 1) throw new QaUsageError(`ambiguous sha prefix ${spec.sha}: ${names.length} entries under ${parent}/`);
    const fallback = findSkippedTargetForPrefix(store, rootTree, parent, spec.sha, repoRoot);
    if (fallback) return { state: "ok", key: fallback };
    return { state: "miss", reason: `no entry ${parent}/${spec.sha}…` };
  }
  const idx = readIndex(store, rootTree);
  if (idx.state !== "ok") return idx;
  const parent = spec.kind === "main-latest" ? "main" : `pr/${spec.pr}`;
  const hasAny = Boolean(store.lookup(rootTree, parent));
  const latest = spec.kind === "main-latest" ? idx.index?.main : idx.index?.pr?.[String(spec.pr)];
  if (!latest) {
    return hasAny
      ? { state: "corrupt", reason: `entries exist under ${parent}/ but ${INDEX_FILE} names none of them` }
      : { state: "miss", reason: `no entry under ${parent}/` };
  }
  const key = `${parent}/${latest.sha}`;
  if (store.lookup(rootTree, key)) return { state: "ok", key };
  const fallback = findSkippedTarget(store, rootTree, parent, latest.sha, repoRoot);
  if (fallback) return { state: "ok", key: fallback };
  return { state: "corrupt", reason: `${INDEX_FILE} names ${key}, which is not on the branch` };
}

/** Verify an entry: a manifest of our schema whose `payloadTree` is the entry minus itself. */
function verifyEntry(store: Store, entry: string, key: string): { state: "ok"; manifest: QaManifest } | QaNotHit {
  const entries = store.lsTree(entry);
  const m = entries.find((e) => e.name === MANIFEST_FILE && e.type === "blob");
  if (!m) return { state: "corrupt", reason: `${key} has no ${MANIFEST_FILE}` };
  if (!store.ensureBlobs(entry, [m.sha])) return { state: "unknown", reason: `could not fetch ${key}/${MANIFEST_FILE}` };
  let manifest: QaManifest;
  try {
    manifest = JSON.parse(store.blobText(m.sha)) as QaManifest;
  } catch (err) {
    return { state: "corrupt", reason: `${key}/${MANIFEST_FILE} does not parse: ${(err as Error).message}` };
  }
  if (manifest.$schema !== MANIFEST_SCHEMA) return { state: "corrupt", reason: `${key}/${MANIFEST_FILE} is not ${MANIFEST_SCHEMA}` };
  if (typeof manifest.payloadTree !== "string") return { state: "corrupt", reason: `${key}/${MANIFEST_FILE} carries no payloadTree to verify against` };
  const payload = entries.filter((e) => e.name !== MANIFEST_FILE);
  const actual = payload.length ? store.mktree(payload) : "";
  if (actual !== manifest.payloadTree) {
    return { state: "corrupt", reason: `${key}: payload tree ${actual || "(empty)"} ≠ manifest's ${manifest.payloadTree}` };
  }
  return { state: "ok", manifest };
}

/**
 * Every by-ref read of the store comes through here, so it is where a read is
 * reported to the input-hash trace (`input-trace.ts`, bean `f017`): as the REF,
 * which a recording run tolerates exactly when its fingerprint hashed that
 * ref's baseline (`--against`). The store's own git calls are silenced inside
 * it — the ref says more than "the store was read".
 */
function snapshot(ref: string, opts: QaStoreOptions): SnapshotResult {
  inputSiteReached(qaRefLine(ref));
  return quietly(() => snapshotUntraced(ref, opts));
}

function snapshotUntraced(ref: string, opts: QaStoreOptions): SnapshotResult {
  const spec = parseQaRef(ref);
  const { store, repoRoot } = openStore(opts);
  const memo = `${store.dir}|${store.remote}|${store.candidates.join(",")}|${ref}`;
  const hit = snapshots.get(memo);
  if (hit) return hit;
  let result: SnapshotResult;
  try {
    result = buildSnapshot(store, spec, repoRoot);
  } catch (e) {
    if (e instanceof QaUsageError) throw e;
    result = { state: "unknown", reason: (e as Error).message };
  }
  // Only a determined answer is memoised: an `unknown` may be a blip.
  if (result.state !== "unknown") snapshots.set(memo, result);
  return result;
}

function buildSnapshot(store: Store, spec: QaRefSpec, repoRoot?: string): SnapshotResult {
  const t = store.fetchTip();
  if (t.state === "absent") return { state: "miss", reason: `branch ${store.branch} does not exist on the remote` };
  if (t.state === "unknown") return t;
  const rootTree = store.must(["rev-parse", `${t.tip}^{tree}`]).trim();
  const r = resolveSpec(store, rootTree, spec, repoRoot);
  if (r.state !== "ok") return r;
  const entry = store.lookup(rootTree, r.key)!;
  if (entry.type !== "tree") return { state: "corrupt", reason: `${r.key} is a ${entry.type}, not a tree` };
  const v = verifyEntry(store, entry.sha, r.key);
  if (v.state !== "ok") return v;
  return { state: "hit", snap: { key: r.key, tip: t.tip, entry: entry.sha, manifest: v.manifest } };
}

/** Every payload blob of the entry, fetched in one batch the first time anything is read. */
function contentsOf(snap: Snapshot, store: Store): QaNotHit | undefined {
  if (snap.contents) return undefined;
  const left = store.hydrate(snap.entry);
  if (left > 0) return { state: "unknown", reason: `${left} blob(s) of ${snap.key} could not be fetched` };
  const out = store.must(["ls-tree", "-r", "-z", snap.entry]);
  const blobs = new Map<string, string>();
  for (const l of out.split("\0").filter(Boolean)) {
    const tab = l.indexOf("\t");
    const [, type, sha] = l.slice(0, tab).split(" ");
    const path = l.slice(tab + 1);
    if (type === "blob" && path !== MANIFEST_FILE) blobs.set(path, sha!);
  }
  const bytes = store.catBlobs([...new Set(blobs.values())]);
  snap.blobs = blobs;
  snap.contents = new Map([...blobs].map(([p, s]) => [p, bytes.get(s)!]));
  return undefined;
}

function toRepoPath(path: string, repoRoot: string): string {
  const rel = isAbsolute(path) ? relative(repoRoot, path) : path;
  const norm = rel.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (norm.startsWith("../") || norm === "..") throw new QaUsageError(`path outside the checkout: ${path}`);
  return norm;
}

/**
 * Read ONE file from the store. `path` is repository-relative (or absolute
 * inside the checkout) — the same path the file has in the working copy.
 *
 * The first read of an entry hydrates the whole entry in one batch, so a
 * caller looping over many files pays one round trip, not one per file.
 * A `.json` file that does not parse is `corrupt`, not a hit with bad text.
 */
export function readQa(ref: string, path: string, opts: QaStoreOptions = {}): QaFileRead {
  // The path is checked BEFORE the snapshot: a path outside the checkout is a
  // usage error whatever the store holds, and the snapshot can fetch.
  const { store, repoRoot } = openStore(opts);
  const rel = toRepoPath(path, repoRoot);
  const s = snapshot(ref, opts);
  if (s.state !== "hit") return s;
  const fail = contentsOf(s.snap, store);
  if (fail) return fail;
  const buf = s.snap.contents!.get(rel);
  if (!buf) return { state: "miss", reason: `${s.snap.key} has no ${rel}` };
  const text = buf.toString("utf-8");
  if (rel.endsWith(".json")) {
    try {
      JSON.parse(text);
    } catch (e) {
      return { state: "corrupt", reason: `${s.snap.key}/${rel} does not parse: ${(e as Error).message}` };
    }
  }
  return { state: "hit", key: s.snap.key, tip: s.snap.tip, path: rel, text };
}

/**
 * Read every file under `prefix` (repository-relative directory). A prefix the
 * entry does not hold is a `miss` — never an empty map, because git stores no
 * empty directory and an empty map would read as "examined, nothing found".
 */
export function readQaTree(ref: string, prefix: string, opts: QaStoreOptions = {}): QaTreeRead {
  const { store, repoRoot } = openStore(opts);
  const rel = toRepoPath(prefix, repoRoot);
  const s = snapshot(ref, opts);
  if (s.state !== "hit") return s;
  const fail = contentsOf(s.snap, store);
  if (fail) return fail;
  const files = new Map<string, string>();
  const bad: string[] = [];
  for (const [p, buf] of s.snap.contents!) {
    if (rel !== "" && p !== rel && !p.startsWith(rel + "/")) continue;
    const text = buf.toString("utf-8");
    if (p.endsWith(".json")) {
      try {
        JSON.parse(text);
      } catch {
        bad.push(p);
      }
    }
    files.set(p, text);
  }
  if (bad.length) return { state: "corrupt", reason: `${bad.length} file(s) under ${rel || "/"} do not parse`, bad };
  if (files.size === 0) return { state: "miss", reason: `${s.snap.key} has nothing under ${rel || "/"}` };
  return { state: "hit", key: s.snap.key, tip: s.snap.tip, prefix: rel, files };
}

/**
 * The entry a COMMIT published, wherever it was published from: `main/<sha>`
 * when the commit was pushed to main, else the one `pr/<n>/<sha>` that holds
 * it. Bean `7mwa` (owner, 2026-11-03, "each layer publishes"): an index reads a
 * mounted layer's QA at the commit its lock pins, and a re-pin train may pin a
 * pull request's head, whose results the layer published under `pr/<n>/`.
 *
 * Two PR entries holding one commit is `corrupt`, never a guess.
 */
export function readQaTreeAtCommit(sha: string, prefix: string, opts: QaStoreOptions = {}): QaTreeRead {
  if (!FULL_SHA.test(sha)) throw new QaUsageError(`not a full commit sha: "${sha}"`);
  const main = readQaTree(`main/${sha}`, prefix, opts);
  if (main.state !== "miss" || !main.reason.startsWith("no entry")) return main;
  const { store } = openStore(opts);
  let keys: string[];
  try {
    const t = store.fetchTip();
    if (t.state !== "ok") return t.state === "absent" ? main : { state: "unknown", reason: t.reason };
    const rootTree = store.must(["rev-parse", `${t.tip}^{tree}`]).trim();
    const pr = store.lookup(rootTree, "pr");
    const numbers = pr?.type === "tree" ? store.lsTree(pr.sha).filter((e) => e.type === "tree").map((e) => e.name) : [];
    keys = numbers.filter((n) => store.lookup(rootTree, `pr/${n}/${sha}`)).map((n) => `pr/${n}/${sha}`);
  } catch (e) {
    if (e instanceof QaUsageError) throw e;
    return { state: "unknown", reason: (e as Error).message };
  }
  if (keys.length === 0) return { state: "miss", reason: `no entry main/${sha} or pr/<n>/${sha}` };
  if (keys.length > 1) return { state: "corrupt", reason: `${sha} is published under ${keys.length} pull requests: ${keys.join(", ")}` };
  return readQaTree(keys[0]!, prefix, opts);
}

/** The verified manifest of an entry. */
export function readQaManifest(ref: string, opts: QaStoreOptions = {}): (QaReadHit & { manifest: QaManifest }) | QaNotHit {
  const s = snapshot(ref, opts);
  if (s.state !== "hit") return s;
  return { state: "hit", key: s.snap.key, tip: s.snap.tip, manifest: s.snap.manifest };
}

/**
 * Every payload path of an entry with its BLOB ID, read from trees alone — no
 * blob is fetched, so comparing a whole checkout against an entry costs one
 * trees-only fetch. Bean `5hox`: removal is gated on the entry holding a
 * hash-identical copy, and a hash is exactly what a tree already records.
 * Paths are repository-relative, as in the checkout; the manifest is excluded.
 */
export function readQaBlobIds(ref: string, opts: QaStoreOptions = {}): (QaReadHit & { blobs: Map<string, string> }) | QaNotHit {
  const s = snapshot(ref, opts);
  if (s.state !== "hit") return s;
  const { store } = openStore(opts);
  const r = store.git(["ls-tree", "-r", "-z", s.snap.entry], { env: { GIT_NO_LAZY_FETCH: "1" } });
  if (r.status !== 0) return { state: "unknown", reason: `ls-tree of ${s.snap.key} failed: ${r.stderr.trim()}` };
  const blobs = new Map<string, string>();
  for (const l of r.stdout.toString().split("\0").filter(Boolean)) {
    const tab = l.indexOf("\t");
    const [, type, sha] = l.slice(0, tab).split(" ");
    const path = l.slice(tab + 1);
    if (type === "blob" && path !== MANIFEST_FILE) blobs.set(path, sha!);
  }
  return { state: "hit", key: s.snap.key, tip: s.snap.tip, blobs };
}

export interface QaFetchResult {
  state: QaState;
  reason?: string;
  key?: string;
  written?: number;
  /** Files under the published roots that exist locally and are NOT in the entry. Reported, never deleted. */
  extra?: string[];
}

/**
 * Materialise an entry into the working `test/results/` paths, in one batch.
 *
 * It WRITES and never deletes. A local file the entry does not hold is listed
 * in `extra`, because silently removing it would be a deletion nobody decided
 * (`deletion-requires-confirmation`) and silently keeping it unreported would
 * let a stale verdict pass as fetched.
 */
export function fetchQa(args: { ref: string; into?: string; prefix?: string }, opts: QaStoreOptions = {}): QaFetchResult {
  const t = readQaTree(args.ref, args.prefix ?? "", opts);
  if (t.state !== "hit") return { state: t.state, reason: t.reason };
  const { repoRoot } = openStore(opts);
  const into = resolve(args.into ?? repoRoot);
  for (const [p, text] of t.files) {
    // Never into a mount: a mounted layer's results are materialised under its
    // layer output root (bean `cat-tools-sm8r`, item 4), where every reader looks.
    const dest = writePathOf(join(into, p));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text);
  }
  const m = readQaManifest(args.ref, opts);
  const extra: string[] = [];
  if (m.state === "hit") {
    for (const root of m.manifest.roots) {
      const logical = join(into, root);
      // The union of the root and its layer output root, each file named by its logical path.
      for (const abs of overlayDirs(logical)) {
        for (const f of readdirSync(abs, { recursive: true, withFileTypes: true })) {
          if (!f.isFile()) continue;
          const parent = (f as { parentPath?: string; path?: string }).parentPath ?? (f as { path?: string }).path ?? abs;
          const rel = relative(into, join(logical, relative(abs, join(parent, f.name)))).split("\\").join("/");
          if (!t.files.has(rel) && (!args.prefix || rel.startsWith(args.prefix)) && !extra.includes(rel)) extra.push(rel);
        }
      }
    }
  }
  return { state: "hit", key: t.key, written: t.files.size, extra: extra.sort() };
}

// ── Writing ──────────────────────────────────────────────────────────────

export type QaPublishState = "published" | "present" | "skipped" | "empty" | "incomplete" | "failed";

export interface QaPublishResult {
  state: QaPublishState;
  key: string;
  reason: string;
  commit?: string;
  attempts: number;
  /** The entry tree written, or that would have been. */
  entry?: string;
}

function defaultSleep(ms: number): void {
  Bun.sleepSync(ms);
}

/**
 * The files under each root's layer output root, as `{ path, at }`: `path`
 * the layer's own (the entry key), `at` where the bytes are, both relative to
 * `repoRoot`. Empty when nothing is mounted, or no writer wrote there.
 */
export function overlayEntries(repoRoot: string, roots: readonly string[]): { path: string; at: string }[] {
  let mounted: Map<string, string>;
  try {
    mounted = mountedInstancesCached(repoRoot);
  } catch {
    return [];
  }
  if (mounted.size === 0) return [];
  const out: { path: string; at: string }[] = [];
  for (const root of roots) {
    const twin = outputTwinOf(repoRoot, join(repoRoot, root), mounted);
    if (twin === undefined || !existsSync(twin) || !statSync(twin).isDirectory()) continue;
    for (const f of readdirSync(twin, { recursive: true, withFileTypes: true })) {
      if (!f.isFile()) continue;
      const parent = (f as { parentPath?: string; path?: string }).parentPath ?? (f as { path?: string }).path ?? twin;
      const abs = join(parent, f.name);
      const rel = relative(twin, abs).split("\\").join("/");
      out.push({ path: `${root.replace(/\/+$/, "")}/${rel}`, at: relative(repoRoot, abs).split("\\").join("/") });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Stage `roots` into the private index `env` names: the files the checkout
 * holds at each root (`git add -f`), then each mounted layer's computed
 * results from its layer output root (`build/layers/<instance>/`, bean
 * `cat-tools-sm8r` item 4) at the layer's own path, over whatever the mount
 * pins there. So an entry is keyed exactly as before the move, wherever the
 * writers wrote. Returns whether anything was staged.
 */
function stageRoots(store: Store, env: Record<string, string>, repoRoot: string, roots: readonly string[]): boolean {
  const inTree = roots.filter((r) => existsSync(join(repoRoot, r)));
  if (inTree.length) store.must([`--work-tree=${repoRoot}`, "add", "-f", "--", ...inTree], { env, cwd: repoRoot });
  const overlay = overlayEntries(repoRoot, roots);
  if (overlay.length) {
    const ids = store
      .must(["hash-object", "-w", "--stdin-paths"], { input: overlay.map((o) => o.at).join("\n") + "\n", cwd: repoRoot })
      .trim()
      .split("\n");
    if (ids.length !== overlay.length) throw new Error(`git hash-object returned ${ids.length} ids for ${overlay.length} overlay paths`);
    const info = overlay.map((o, i) => `100644 ${ids[i]}\t${o.path}`).join("\n") + "\n";
    store.must(["update-index", "--add", "--index-info"], { env, input: info });
  }
  return inTree.length > 0 || overlay.length > 0;
}

/**
 * Build the entry tree for `roots` through a private index (spike finding 3).
 * Never touches the checkout's index or object store.
 */
function buildEntry(
  store: Store,
  repoRoot: string,
  key: QaKey,
  roots: string[],
  extra: Partial<QaManifest>,
): { entry: string; manifest: QaManifest } | undefined {
  // input-site: store #66be449e — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  const tmp = mkdtempSync(join(tmpdir(), "qa-store-index-"));
  try {
    const env = { GIT_INDEX_FILE: join(tmp, "index") };
    // -f: once `test/results/` is .gitignored (when `storage` is set) the
    // working copy is ignored by design, and it is still what gets published.
    stageRoots(store, env, repoRoot, roots);
    const payload = store.must(["write-tree"], { env }).trim();
    const listing = store.must(["ls-tree", "-r", "-l", "-z", payload]);
    let files = 0;
    let bytes = 0;
    for (const l of listing.split("\0").filter(Boolean)) {
      files++;
      bytes += Number(l.slice(0, l.indexOf("\t")).trim().split(/\s+/)[3]) || 0;
    }
    if (files === 0) return undefined;
    if (store.lsTree(payload).some((e) => e.name === MANIFEST_FILE)) {
      throw new QaUsageError(`a root publishes a top-level ${MANIFEST_FILE}, which would shadow the entry's own`);
    }
    const manifest: QaManifest = {
      $schema: MANIFEST_SCHEMA,
      key: keyPath(key),
      source: key.sha,
      ...(key.kind === "pr" ? { pr: key.pr } : {}),
      ...extra,
      roots,
      payloadTree: payload,
      files,
      bytes,
      // input-site: store #18c2fdfe — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
      written_at: extra.written_at ?? new Date().toISOString(),
    };
    const mblob = store.hashBlob(JSON.stringify(manifest, null, 2) + "\n");
    const entry = store.mktree([...store.lsTree(payload), { mode: "100644", type: "blob", sha: mblob, name: MANIFEST_FILE }]);
    return { entry, manifest };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** The index with `key` recorded as its ref's newest entry. A corrupt index is rebuilt from this entry. */
function nextIndex(store: Store, base: string | undefined, key: QaKey, writtenAt: string): string {
  let idx: QaIndex = { $schema: INDEX_SCHEMA };
  if (base) {
    const r = readIndex(store, base);
    if (r.state === "ok" && r.index) idx = r.index;
    else if (r.state !== "ok") store.log(`qa-store: ${r.reason}; rewriting ${INDEX_FILE} from this entry`);
  }
  const rec = { sha: key.sha, written_at: writtenAt };
  if (key.kind === "main") idx.main = rec;
  else idx.pr = { ...(idx.pr ?? {}), [String(key.pr)]: rec };
  return store.hashBlob(JSON.stringify(idx, null, 2) + "\n");
}

/**
 * The write loop every change to the branch goes through: fetch the tip,
 * `build(tip)` a new root tree on it, `commit-tree -p tip`, push WITHOUT `-f`,
 * and on rejection back off and rebuild on the new tip.
 *
 * `build` returns `done` to stop without pushing (already present, nothing to
 * prune). This is the helper `check:workflows`' `qa-reports-unretried`
 * requires every push to go through.
 */
function stripVolatile(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripVolatile);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "updated_at" || k === "written_at" || k === "timestamp" || k === "date") continue;
    out[k] = stripVolatile(v);
  }
  return out;
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj as Record<string, unknown>).sort()) {
    out[k] = sortKeys((obj as Record<string, unknown>)[k]);
  }
  return out;
}

function canonicalJson(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

/** Compare two QA result file texts for semantic equivalence, ignoring volatile timestamps. */
export function isQaFileEquivalent(aText: string, bText: string): boolean {
  if (aText === bText) return true;
  try {
    const a = JSON.parse(aText);
    const b = JSON.parse(bText);
    return canonicalJson(stripVolatile(a)) === canonicalJson(stripVolatile(b));
  } catch {
    return aText === bText;
  }
}

function getPayloadTreeSha(store: Store, entryTreeSha: string): string | undefined {
  const entries = store.lsTree(entryTreeSha);
  const payloadEntries = entries.filter((e) => e.name !== MANIFEST_FILE);
  return payloadEntries.length > 0 ? store.mktree(payloadEntries) : undefined;
}

/** Check if candidate payload is identical or semantically equivalent to prior entry's payload. */
function isSnapshotUnchanged(
  store: Store,
  rootTree: string,
  candidatePayloadSha: string,
  priorEntrySha: string,
): boolean {
  const priorPayloadSha = getPayloadTreeSha(store, priorEntrySha);
  if (!priorPayloadSha) return false;
  if (candidatePayloadSha === priorPayloadSha) return true;

  const candidateListing = store.must(["ls-tree", "-r", "-z", candidatePayloadSha]);
  const priorListing = store.must(["ls-tree", "-r", "-z", priorPayloadSha]);

  const candidateFiles = new Map<string, string>();
  for (const l of candidateListing.split("\0").filter(Boolean)) {
    const tab = l.indexOf("\t");
    const [, type, sha] = l.slice(0, tab).split(" ");
    const path = l.slice(tab + 1);
    if (type === "blob") candidateFiles.set(path, sha!);
  }

  const priorFiles = new Map<string, string>();
  for (const l of priorListing.split("\0").filter(Boolean)) {
    const tab = l.indexOf("\t");
    const [, type, sha] = l.slice(0, tab).split(" ");
    const path = l.slice(tab + 1);
    if (type === "blob") priorFiles.set(path, sha!);
  }

  if (candidateFiles.size !== priorFiles.size) return false;
  for (const [path, cSha] of candidateFiles) {
    const pSha = priorFiles.get(path);
    if (!pSha) return false;
    if (cSha === pSha) continue;
    store.ensureBlobs(rootTree, [pSha]);
    const cText = store.blobText(cSha);
    const pText = store.blobText(pSha);
    if (!isQaFileEquivalent(cText, pText)) return false;
  }

  return true;
}

/**
 * The write loop every change to the branch goes through: fetch the tip,
 * `build(tip)` a new root tree on it, `commit-tree -p tip`, push WITHOUT `-f`,
 * and on rejection back off and rebuild on the new tip.
 *
 * `build` returns `done` to stop without pushing (already present, nothing to
 * prune). This is the helper `check:workflows`' `qa-reports-unretried`
 * requires every push to go through.
 */
function writeLoop(
  store: Store,
  opts: QaStoreOptions,
  message: string,
  build: (tip: string | undefined, base: string | undefined) => { tree: string; skipped?: boolean; priorKp?: string } | { done: string },
): { state: "pushed" | "done" | "failed"; reason: string; commit?: string; attempts: number; skipped?: boolean; priorKp?: string } {
  const sleep = opts.sleep ?? defaultSleep;
  let lastReason = "";
  // Every failure so far lost a race: the budget is the race budget until
  // something else goes wrong, then the ordinary one.
  let onlyRaces = true;
  const budget = () => (onlyRaces ? PUBLISH_RACE_ATTEMPTS : PUBLISH_ATTEMPTS);
  let attempt = 1;
  for (; attempt <= budget(); attempt++) {
    const t = store.fetchTip();
    if (t.state === "unknown") {
      lastReason = t.reason;
      onlyRaces = false;
    } else {
      const tip = t.state === "ok" ? t.tip : undefined;
      const base = tip ? store.must(["rev-parse", `${tip}^{tree}`]).trim() : undefined;
      const b = build(tip, base);
      if ("done" in b) return { state: "done", reason: b.done, attempts: attempt };
      const skipped = "skipped" in b && Boolean(b.skipped);
      const priorKp = "priorKp" in b ? b.priorKp : undefined;
      const commitMsg = skipped
        ? `qa-reports: ${priorKp ? `(skipped: unchanged from ${priorKp})` : "skipped"}`
        : message;
      // --no-gpg-sign: the branch is written as folio-qa-bot, and a contributor's
      // `commit.gpgSign` must not put their key on the bot's commit.
      const parent = tip ? ["-p", tip] : [];
      const commit = store.must(["commit-tree", "--no-gpg-sign", b.tree, ...parent, "-m", commitMsg]).trim();
      opts.beforePush?.(attempt);
      // NO -f (spike finding 4): a non-fast-forward is rejected by the
      // server's ref lock and we rebuild on what landed. The exit code is the
      // verdict; `push negotiation failed; proceeding anyway` on stderr is a
      // proxy artefact and is not (spike finding 5).
      const push = store.git(["-c", "pack.useSparse=false", "push", "-q", "origin", `${commit}:refs/heads/${store.branch}`]);
      if (push.status === 0) {
        return {
          state: "pushed",
          reason: skipped ? `skipped on attempt ${attempt}: unchanged from ${priorKp}` : `pushed on attempt ${attempt}`,
          commit,
          attempts: attempt,
          skipped,
          priorKp,
        };
      }
      lastReason = push.stderr
        .split("\n")
        .filter((l) => l.trim() && !/push negotiation failed|expected 'acknowledgments'/.test(l))
        .join(" | ");
      if (!lostRace(push.stderr)) onlyRaces = false;
    }
    if (attempt < budget()) {
      const ms = waitFor(attempt, PUSH_BASE_MS, onlyRaces ? PUBLISH_RACE_CAP_MS : PUSH_CAP_MS);
      store.log(`qa-store: attempt ${attempt} did not land (${lastReason}); retrying in ${ms} ms`);
      sleep(ms);
    }
  }
  const tried = attempt - 1;
  return { state: "failed", reason: `gave up after ${tried} attempts: ${lastReason}`, attempts: tried };
}

/**
 * Publish `roots` (repository-relative directories) as the entry `ref`.
 *
 * - An entry already at `ref` is never overwritten: `present`, exit 0 — a CI
 *   re-run of the same commit is a no-op, and the first write stands.
 * - Roots that do not exist are skipped and named; none existing is `empty`.
 * - Every other entry on the branch is carried across untouched.
 */
export function publishQa(
  args: {
    ref: string;
    roots: string[];
    checkout?: string;
    producer?: QaManifest["producer"];
    writtenAt?: string;
    /**
     * The refresh report's account of the tree (bean `3hk4`). When given, the
     * entry must hold exactly `completeness.files` files, or nothing is
     * written (`incomplete`): a tree that changed between the account and the
     * publish is not the tree that was judged complete.
     */
    completeness?: QaManifest["completeness"];
    force?: boolean;
    skipUnchanged?: boolean;
  },
  opts: QaStoreOptions = {},
): QaPublishResult {
  const key = parseQaKey(args.ref);
  const kp = keyPath(key);
  const { store, repoRoot } = openStore(opts);
  const roots: string[] = [];
  const skipped: string[] = [];
  for (const r of args.roots) {
    const rel = toRepoPath(r, repoRoot);
    if (rel === "") throw new QaUsageError("refusing to publish the whole checkout; name its test/results roots");
    if (existsSync(join(repoRoot, rel))) roots.push(rel);
    else skipped.push(rel);
  }
  if (skipped.length) store.log(`qa-store: not in the checkout, skipped: ${skipped.join(", ")}`);
  // input-site: store #0a597796 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  const writtenAt = args.writtenAt ?? new Date().toISOString();
  const built = roots.length
    ? buildEntry(store, repoRoot, key, roots, {
        written_at: writtenAt,
        ...(args.checkout && args.checkout !== key.sha ? { checkout: args.checkout } : {}),
        ...(args.producer ? { producer: args.producer } : {}),
        ...(args.completeness ? { completeness: args.completeness } : {}),
      })
    : undefined;
  if (!built) return { state: "empty", key: kp, reason: "no files under any root; nothing to publish", attempts: 0 };
  if (args.completeness && built.manifest.files !== args.completeness.files) {
    return {
      state: "incomplete",
      key: kp,
      reason:
        `the tree holds ${built.manifest.files} file(s) and the refresh report accounted for ${args.completeness.files}; ` +
        "something wrote or removed files between the two, so this is not the tree that was judged complete — nothing published",
      attempts: 0,
    };
  }

  const r = writeLoop(store, opts, `qa-reports: ${kp} (${built.manifest.files} files, ${built.manifest.bytes} bytes)`, (_tip, base) => {
    const existing = base ? store.lookup(base, kp) : undefined;
    if (existing) {
      // Same PAYLOAD is "identical": the manifest differs by its timestamp on
      // every run, so comparing entry trees would call every re-run different.
      const payload = existing.type === "tree" ? store.lsTree(existing.sha).filter((e) => e.name !== MANIFEST_FILE) : [];
      const same = payload.length > 0 && store.mktree(payload) === built.manifest.payloadTree;
      return {
        done:
          same
            ? `${kp} is already on ${store.branch}, identical`
            : `${kp} is already on ${store.branch} with different content (${existing.sha}); the first write stands`,
      };
    }

    const idxResult = base ? readIndex(store, base) : undefined;
    const currentIndex = idxResult?.state === "ok" ? idxResult.index : undefined;
    if (currentIndex?.skipped?.[key.sha] || currentIndex?.skipped?.[kp]) {
      const prior = currentIndex.skipped[key.sha] ?? currentIndex.skipped[kp];
      return { done: `${kp} was already skipped; unchanged from ${prior}` };
    }

    // Check if candidate entry is unchanged from newest recorded entry
    if (!args.force && (args.skipUnchanged ?? true) && base && currentIndex) {
      const priorSha = key.kind === "main"
        ? currentIndex.main?.sha
        : (currentIndex.pr?.[String(key.pr)]?.sha ?? currentIndex.main?.sha);
      if (priorSha && priorSha !== key.sha) {
        const priorKp = (key.kind === "pr" && currentIndex.pr?.[String(key.pr)]?.sha)
          ? `pr/${key.pr}/${priorSha}`
          : `main/${priorSha}`;
        const priorLookup = store.lookup(base, priorKp);
        if (priorLookup && priorLookup.type === "tree") {
          const isUnchanged = isSnapshotUnchanged(store, base, built.manifest.payloadTree, priorLookup.sha);
          if (isUnchanged) {
            const nextIdx: QaIndex = {
              ...currentIndex,
              $schema: INDEX_SCHEMA,
              ...(key.kind === "main"
                ? { main: { sha: key.sha, written_at: writtenAt } }
                : { pr: { ...(currentIndex.pr ?? {}), [String(key.pr)]: { sha: key.sha, written_at: writtenAt } } }),
              skipped: {
                ...(currentIndex.skipped ?? {}),
                [key.sha]: priorSha,
                [kp]: priorKp,
              },
            };
            const idxBlob = store.hashBlob(JSON.stringify(nextIdx, null, 2) + "\n");
            const newTree = store.setPath(base, [INDEX_FILE], { mode: "100644", type: "blob", sha: idxBlob, name: "" })!;
            return { tree: newTree, skipped: true, priorKp };
          }
        }
      }
    }

    const withEntry = store.setPath(base, kp.split("/"), { mode: "040000", type: "tree", sha: built.entry, name: "" })!;
    const idx = nextIndex(store, base, key, writtenAt);
    return { tree: store.setPath(withEntry, [INDEX_FILE], { mode: "100644", type: "blob", sha: idx, name: "" })! };
  });
  clearSnapshotsFor(store);
  if (r.state === "pushed") {
    if (r.skipped) {
      return {
        state: "skipped",
        key: kp,
        reason: `unchanged from ${r.priorKp}; skipped duplicate entry`,
        commit: r.commit,
        attempts: r.attempts,
        entry: built.entry,
      };
    }
    return { state: "published", key: kp, reason: r.reason, commit: r.commit, attempts: r.attempts, entry: built.entry };
  }
  if (r.state === "done") return { state: "present", key: kp, reason: r.reason, attempts: r.attempts, entry: built.entry };
  return { state: "failed", key: kp, reason: r.reason, attempts: r.attempts, entry: built.entry };
}

export type QaAddState = "added" | "present" | "no-entry" | "conflict" | "empty" | "failed";

export interface QaAddResult {
  state: QaAddState;
  /** The entry written to — the ref's own, or the prior entry a skipped ref resolves to. */
  key: string;
  reason: string;
  commit?: string;
  attempts: number;
}

type Entry = ReturnType<Store["lsTree"]>[number];

/**
 * Add `roots` to the entry ALREADY at `ref` (bean `1dre`, owner 2026-10-11:
 * "add-only publish").
 *
 * {@link publishQa} writes an entry once and never again, which is right for a
 * commit's QA record and wrong for an observation a later job makes about the
 * same commit — the pages-serving check runs daily on `main`'s HEAD, whose
 * entry the gates job wrote long before. So this writes INTO that entry, under
 * one rule: a path the entry's first write created is never changed. A path
 * may be created, or replaced if an earlier add created it (it is listed in
 * the manifest's `added`), so a daily observation of an unchanged HEAD
 * refreshes instead of freezing.
 *
 * - No entry at `ref` and no skip that resolves it: `no-entry`, nothing
 *   written. Creating one here would make it the commit's first write, and the
 *   gates' publish of that commit would then be the one refused.
 * - A ref skipped as unchanged resolves to the entry it was skipped onto, the
 *   same entry a reader of that ref is given. So does a ref with no entry yet
 *   whose nearest recorded ancestor has one (the checkout's history decides,
 *   exactly as for a reader).
 * - The entry must verify; a corrupt one is `failed`, never extended.
 */
export function addQa(
  args: { ref: string; roots: string[]; writtenAt?: string; run?: string },
  opts: QaStoreOptions = {},
): QaAddResult {
  const key = parseQaKey(args.ref);
  const kp = keyPath(key);
  const { store, repoRoot } = openStore(opts);
  const roots = args.roots.map((r) => toRepoPath(r, repoRoot));
  if (roots.some((r) => r === "")) throw new QaUsageError("refusing to add the whole checkout; name the directories to add");
  // A root is present in the checkout or under its layer output root (bean `cat-tools-sm8r`, item 4).
  const present = roots.filter((r) => overlayDirs(join(repoRoot, r)).length > 0);
  // input-site: store #0a597796 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  const writtenAt = args.writtenAt ?? new Date().toISOString();

  // The added files' tree, built through a private index exactly as an entry is.
  // input-site: store #dabbd4a3 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  const tmp = mkdtempSync(join(tmpdir(), "qa-store-add-"));
  let addTree: string | undefined;
  const sizes = new Map<string, number>();
  try {
    if (present.length) {
      const env = { GIT_INDEX_FILE: join(tmp, "index") };
      stageRoots(store, env, repoRoot, present);
      addTree = store.must(["write-tree"], { env }).trim();
      for (const l of store.must(["ls-tree", "-r", "-l", "-z", addTree]).split("\0").filter(Boolean)) {
        const tab = l.indexOf("\t");
        sizes.set(l.slice(tab + 1), Number(l.slice(0, tab).trim().split(/\s+/)[3]) || 0);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (!addTree || sizes.size === 0) return { state: "empty", key: kp, reason: "no files under any root; nothing to add", attempts: 0 };
  if (store.lsTree(addTree).some((e) => e.name === MANIFEST_FILE)) {
    throw new QaUsageError(`a root adds a top-level ${MANIFEST_FILE}, which would shadow the entry's own`);
  }

  let target = kp;
  let outcome: Exclude<QaAddState, "added" | "failed" | "empty"> | undefined;
  const r = writeLoop(store, opts, `qa-reports: add ${sizes.size} file(s) to ${kp}`, (_tip, base) => {
    target = kp;
    let existing = base ? store.lookup(base, kp) : undefined;
    if (!existing && base) {
      const parent = kp.slice(0, kp.lastIndexOf("/"));
      // repoRoot, as every reader passes it: a commit whose gates have not
      // published yet reads its nearest recorded ancestor, so the add must
      // land there too, or the daily pages-serving observation is dropped and
      // `pages-publish-health` reads unknown (folio-assistant health sweep,
      // 2026-11-02/03/06/08).
      const resolved = findSkippedTarget(store, base, parent, key.sha, repoRoot);
      if (resolved) {
        target = resolved;
        existing = store.lookup(base, resolved);
      }
    }
    if (!existing || existing.type !== "tree") {
      outcome = "no-entry";
      return { done: `${kp} has no entry to add to (nothing published for it, and no skip resolves it); nothing written` };
    }
    const v = verifyEntry(store, existing.sha, target);
    if (v.state !== "ok") throw new Error(`${target} cannot be extended: ${v.state}: ${v.reason}`);
    const manifest = v.manifest;
    const added = { ...(manifest.added ?? {}) };

    const conflicts: string[] = [];
    let changed = 0;
    let files = manifest.files;
    let bytes = manifest.bytes;
    // Merge the added tree into the entry's payload, one level at a time; no blob is read.
    const merge = (baseTree: string | undefined, addT: string, prefix: string): string => {
      const into = new Map<string, Entry>((baseTree ? store.lsTree(baseTree) : []).map((e) => [e.name, e]));
      for (const e of store.lsTree(addT)) {
        const path = prefix + e.name;
        const cur = into.get(e.name);
        if (e.type === "tree") {
          if (cur && cur.type !== "tree") { conflicts.push(path); continue; }
          into.set(e.name, { ...e, sha: merge(cur?.sha, e.sha, `${path}/`) });
          continue;
        }
        if (cur && cur.type === "tree") { conflicts.push(path); continue; }
        if (cur && cur.sha === e.sha) continue;
        if (cur && !added[path]) { conflicts.push(path); continue; }
        const size = sizes.get(path) ?? 0;
        if (cur) bytes -= added[path]!.bytes;
        else files++;
        bytes += size;
        added[path] = { written_at: writtenAt, bytes: size, ...(args.run ? { run: args.run } : {}) };
        into.set(e.name, e);
        changed++;
      }
      return store.mktree([...into.values()]);
    };
    const payload = merge(manifest.payloadTree, addTree!, "");
    if (conflicts.length) {
      outcome = "conflict";
      return { done: `${target}: ${conflicts.length} path(s) belong to the entry's first write and are never changed: ${conflicts.slice(0, 5).join(", ")}; nothing written` };
    }
    if (changed === 0) {
      outcome = "present";
      return { done: `${target} already holds these files, identical` };
    }
    const next: QaManifest = { ...manifest, payloadTree: payload, files, bytes, added };
    const mblob = store.hashBlob(JSON.stringify(next, null, 2) + "\n");
    const entry = store.mktree([...store.lsTree(payload), { mode: "100644", type: "blob", sha: mblob, name: MANIFEST_FILE }]);
    return { tree: store.setPath(base, target.split("/"), { mode: "040000", type: "tree", sha: entry, name: "" })! };
  });
  clearSnapshotsFor(store);
  if (r.state === "pushed") return { state: "added", key: target, reason: r.reason, commit: r.commit, attempts: r.attempts };
  if (r.state === "done") return { state: outcome ?? "present", key: target, reason: r.reason, attempts: r.attempts };
  return { state: "failed", key: target, reason: r.reason, attempts: r.attempts };
}

function clearSnapshotsFor(store: Store): void {
  for (const k of snapshots.keys()) if (k.startsWith(`${store.dir}|`)) snapshots.delete(k);
}

// ── Completeness: what `qa:refresh` said of the tree (bean `3hk4`) ───────

/** The `$schema` of `qa-refresh.ts`'s report. Here, because the publish reads it. */
export const REFRESH_SCHEMA = "qa-refresh/v1";

/**
 * Is a `qa:refresh` report well-formed and COMPLETE? The publish's one
 * question of it. Anything else — absent, foreign, incomplete — is a refusal
 * with its reason, never a publish of a partial tree as if it were whole.
 */
export function refreshReportComplete(
  r: unknown,
): { ok: true; completeness: NonNullable<QaManifest["completeness"]> } | { ok: false; reason: string } {
  const x = r as { $schema?: unknown; files?: unknown; reasons?: unknown; complete?: unknown; mode?: unknown; families?: unknown } | undefined;
  if (!x || x.$schema !== REFRESH_SCHEMA) return { ok: false, reason: `not a ${REFRESH_SCHEMA} report` };
  if (typeof x.files !== "number" || !Array.isArray(x.reasons)) return { ok: false, reason: "the report carries no file count or reasons" };
  if (x.complete !== true) {
    return { ok: false, reason: `the refresh was INCOMPLETE: ${(x.reasons as string[]).join("; ") || "no reason given"}` };
  }
  return {
    ok: true,
    completeness: { mode: String(x.mode), files: x.files, families: (x.families ?? {}) as Record<string, number> },
  };
}

// ── CI: what to publish, and when not to ────────────────────────────────

export type PublishDecision = { publish: true; ref: string; checkout: string } | { publish: false; reason: string };

/**
 * Derive the key from a GitHub Actions run — or say why there is none.
 *
 * A FORK PR's `GITHUB_TOKEN` is read-only (spike `3ds9`), so its push would
 * fail; the decision is to skip with that reason stated, never to attempt and
 * fail, and never to skip silently.
 */
export function githubPublishDecision(env: Record<string, string | undefined>, event: unknown): PublishDecision {
  const name = env.GITHUB_EVENT_NAME;
  const sha = env.GITHUB_SHA ?? "";
  if (name === "push") {
    if (env.GITHUB_REF !== "refs/heads/main") return { publish: false, reason: `a push to ${env.GITHUB_REF ?? "?"} is not main; only main/<sha> is keyed for pushes` };
    if (!FULL_SHA.test(sha)) return { publish: false, reason: "GITHUB_SHA is missing or not a full sha" };
    return { publish: true, ref: `main/${sha}`, checkout: sha };
  }
  if (name === "pull_request") {
    const pr = (event as { pull_request?: { number?: number; head?: { sha?: string; repo?: { full_name?: string } | null } } })?.pull_request;
    if (!pr?.number || !pr.head?.sha) return { publish: false, reason: "the event payload carries no pull_request number or head sha" };
    const head = pr.head.repo?.full_name;
    if (!head || head !== env.GITHUB_REPOSITORY) {
      return {
        publish: false,
        reason: `fork PR (${head ?? "deleted repository"} → ${env.GITHUB_REPOSITORY}): its GITHUB_TOKEN is read-only, so pr/${pr.number}/<sha> cannot be written from this run`,
      };
    }
    return { publish: true, ref: `pr/${pr.number}/${pr.head.sha}`, checkout: sha };
  }
  return { publish: false, reason: `event \`${name ?? "(none)"}\` is not keyed: the store holds main/<sha> and pr/<n>/<sha> only` };
}

// ── Prune ────────────────────────────────────────────────────────────────

export type PrState = { state: "open" } | { state: "closed"; closedAt: string } | { state: "unknown" };

export interface PrunePlan {
  remove: string[];
  keep: number;
  /** Why each kept PR with a determined-unknown state was kept. */
  notes: string[];
}

const DAY = 86_400_000;
/** Days every `main/<sha>` is kept whole before thinning to one per UTC day. */
export const QA_KEEP_DAYS = 14;

/**
 * The retention rule, pure (proposal §2.2, window shortened to 14 days):
 * every `main/<sha>` for `keepDays`; after that, one per UTC day (the newest written that day); the
 * newest `main` entry always. `pr/<n>` goes `prDays` after the PR closed. A PR
 * whose state could not be determined is KEPT and named — could-not-determine
 * never deletes.
 */
export function planPrune(
  main: Array<{ sha: string; writtenAt: string }>,
  prs: Array<{ pr: number; entries: number }>,
  prState: (pr: number) => PrState,
  now: Date,
  opts: { keepDays?: number; prDays?: number; newestMain?: string } = {},
): PrunePlan {
  // 14, not the proposal's 90: at ~25 merges a day, 90 days of every sha
  // is ~500 entries and 8 GB summed, against the branch's 500 MB budget.
  // Owner, 2026-11-01 (Q-FAD-3 A, folio-assistant#860).
  const keepDays = opts.keepDays ?? QA_KEEP_DAYS;
  const prDays = opts.prDays ?? 7;
  const remove: string[] = [];
  const notes: string[] = [];
  let keep = 0;
  const byDay = new Map<string, Array<{ sha: string; t: number }>>();
  for (const m of main) {
    const t = Date.parse(m.writtenAt);
    if (Number.isNaN(t)) {
      keep++;
      notes.push(`main/${m.sha}: no readable written_at; kept`);
      continue;
    }
    if (now.getTime() - t <= keepDays * DAY || m.sha === opts.newestMain) {
      keep++;
      continue;
    }
    const day = new Date(t).toISOString().slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), { sha: m.sha, t }]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => b.t - a.t || a.sha.localeCompare(b.sha));
    keep++;
    for (const x of list.slice(1)) remove.push(`main/${x.sha}`);
  }
  for (const { pr, entries } of prs) {
    const s = prState(pr);
    if (s.state === "closed" && now.getTime() - Date.parse(s.closedAt) > prDays * DAY) {
      remove.push(`pr/${pr}`);
    } else {
      keep += entries;
      if (s.state === "unknown") notes.push(`pr/${pr}: state unknown; kept`);
    }
  }
  return { remove: remove.sort(), keep, notes };
}

export interface PruneResult {
  state: "pruned" | "nothing" | "dry-run" | "failed" | "absent";
  plan?: PrunePlan;
  reason: string;
  commit?: string;
}

/**
 * Apply {@link planPrune} as a NEW commit on the tip (`commit-tree -p`): the
 * history is never rewritten, only the tip's tree loses entries. Through the
 * same retry loop as a publish, re-planned on every attempt so a sibling's
 * fresh entry is never judged against a stale tip. Dry run unless `apply`.
 */
export function pruneQa(
  args: { now?: Date; apply?: boolean; prState?: (pr: number) => PrState; keepDays?: number; prDays?: number },
  opts: QaStoreOptions = {},
): PruneResult {
  const { store } = openStore(opts);
  // input-site: store #2f3d53ee — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
  const now = args.now ?? new Date();
  const prState = args.prState ?? (() => ({ state: "unknown" }) as PrState);
  let lastPlan: PrunePlan | undefined;

  const planFor = (base: string): PrunePlan => {
    const mainDir = store.lookup(base, "main");
    const entries = (mainDir?.type === "tree" ? store.lsTree(mainDir.sha) : []).map((e) => ({
      sha: e.name,
      manifest: store.lsTree(e.sha).find((x) => x.name === MANIFEST_FILE)?.sha,
    }));
    // Every manifest in ONE round trip; a manifest that cannot be fetched or
    // read leaves its entry with no date, and an undated entry is kept.
    store.ensureBlobs(base, entries.flatMap((e) => (e.manifest ? [e.manifest] : [])));
    const main: Array<{ sha: string; writtenAt: string }> = [];
    for (const e of entries) {
      let writtenAt = "";
      try {
        writtenAt = e.manifest ? (JSON.parse(store.blobText(e.manifest)) as QaManifest).written_at : "";
      } catch {
        writtenAt = "";
      }
      main.push({ sha: e.sha, writtenAt });
    }
    const prDir = store.lookup(base, "pr");
    const prs = (prDir?.type === "tree" ? store.lsTree(prDir.sha) : []).map((e) => ({ pr: Number(e.name), entries: store.lsTree(e.sha).length }));
    const idx = readIndex(store, base);
    return planPrune(main, prs, prState, now, {
      keepDays: args.keepDays,
      prDays: args.prDays,
      newestMain: idx.state === "ok" ? idx.index?.main?.sha : undefined,
    });
  };

  if (!args.apply) {
    const t = store.fetchTip();
    if (t.state === "absent") return { state: "absent", reason: `branch ${store.branch} does not exist` };
    if (t.state === "unknown") return { state: "failed", reason: t.reason };
    const plan = planFor(store.must(["rev-parse", `${t.tip}^{tree}`]).trim());
    return { state: "dry-run", plan, reason: `would remove ${plan.remove.length} entr(ies); kept ${plan.keep}` };
  }

  const r = writeLoop(store, opts, "qa-reports: prune", (tip, base) => {
    if (!base) return { done: `branch ${store.branch} does not exist` };
    const plan = (lastPlan = planFor(base));
    if (plan.remove.length === 0) return { done: "nothing to prune" };
    let tree: string | undefined = base;
    for (const p of plan.remove) tree = store.setPath(tree, p.split("/"), undefined);
    const idx = readIndex(store, base);
    if (idx.state === "ok") {
      let changed = false;
      const pr = idx.index?.pr ? { ...idx.index.pr } : undefined;
      const skipped = idx.index?.skipped ? { ...idx.index.skipped } : undefined;
      if (pr) {
        for (const p of plan.remove) {
          if (p.startsWith("pr/")) {
            delete pr[p.slice(3)];
            changed = true;
          }
        }
      }
      if (skipped) {
        for (const p of plan.remove) {
          const removedSha = p.split("/").pop();
          for (const [k, v] of Object.entries(skipped)) {
            if (k === p || k === removedSha || v === p || v === removedSha || (p.startsWith("pr/") && k.startsWith(p))) {
              delete skipped[k];
              changed = true;
            }
          }
        }
      }
      if (changed) {
        const blob = store.hashBlob(JSON.stringify({ ...idx.index, ...(pr ? { pr } : {}), ...(skipped ? { skipped } : {}) }, null, 2) + "\n");
        tree = store.setPath(tree, [INDEX_FILE], { mode: "100644", type: "blob", sha: blob, name: "" });
      }
    }
    return { tree: tree ?? store.mktree([]) };
  });
  clearSnapshotsFor(store);
  if (r.state === "pushed") return { state: "pruned", plan: lastPlan, reason: r.reason, commit: r.commit };
  if (r.state === "done") return { state: r.reason.includes("does not exist") ? "absent" : "nothing", plan: lastPlan, reason: r.reason };
  return { state: "failed", plan: lastPlan, reason: r.reason };
}

// ── CLI ──────────────────────────────────────────────────────────────────

function flags(argv: string[]): { pos: string[]; one: (n: string) => string | undefined; many: (n: string) => string[]; has: (n: string) => boolean } {
  const pos: string[] = [];
  const vals = new Map<string, string[]>();
  const bools = new Set<string>();
  const VALUED = new Set(["ref", "into", "prefix", "root", "remote", "branch", "store", "gates-result", "pr-states", "now", "completeness"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) {
      pos.push(a);
      continue;
    }
    const [k, inline] = a.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];
    if (VALUED.has(k)) {
      const v = inline ?? argv[++i];
      if (v === undefined) throw new QaUsageError(`--${k} needs a value`);
      vals.set(k, [...(vals.get(k) ?? []), v]);
    } else bools.add(k);
  }
  return { pos, one: (n) => vals.get(n)?.at(-1), many: (n) => vals.get(n) ?? [], has: (n) => bools.has(n) };
}

function exitFor(state: QaState): number {
  return QA_EXIT[state];
}

function readPrStates(file: string): (pr: number) => PrState {
  const rows = JSON.parse(readFileSync(file, "utf-8")) as Array<{ number: number; state: string; closedAt?: string | null }>;
  const map = new Map<number, PrState>();
  for (const r of rows) {
    if (r.state === "OPEN") map.set(r.number, { state: "open" });
    else if (r.closedAt) map.set(r.number, { state: "closed", closedAt: r.closedAt });
  }
  return (pr) => map.get(pr) ?? { state: "unknown" };
}

export function main(argv: string[]): number {
  const f = flags(argv);
  const [cmd, ...rest] = f.pos;
  const opts: QaStoreOptions = {
    ...(f.one("remote") ? { remote: f.one("remote") } : {}),
    ...(f.one("branch") ? { branch: f.one("branch") } : {}),
    ...(f.one("store") ? { storeDir: f.one("store") } : {}),
  };
  const json = f.has("json");
  const say = (o: unknown, line: string) => console.log(json ? JSON.stringify(o, null, 2) : line);

  switch (cmd) {
    case "where": {
      const loc = resolveQaLocation(opts.repoRoot);
      say(loc, [
        `qa store: branch ${loc.branch} (${loc.declared ? "declared" : "default — no qa directory declares storage yet"}), keyed by ${loc.keyedBy}`,
        ...loc.directories.map((d) => `  ${d.present ? "present" : "absent "} ${d.path}${d.storage && "branch" in d.storage ? `  → ${d.storage.branch}` : ""}`),
      ].join("\n"));
      return 0;
    }
    case "fetch": {
      const r = fetchQa({ ref: f.one("ref") ?? "main", into: f.one("into"), prefix: f.one("prefix") }, opts);
      say(r, r.state === "hit"
        ? `qa:fetch HIT ${r.key}: wrote ${r.written} file(s)` + (r.extra?.length ? `; ${r.extra.length} local file(s) not in the entry (left in place): ${r.extra.slice(0, 5).join(", ")}${r.extra.length > 5 ? ", …" : ""}` : "")
        : `qa:fetch ${r.state.toUpperCase()}: ${r.reason}${r.state === "miss" ? " — a miss is not a clean result" : ""}`);
      return exitFor(r.state);
    }
    case "read": {
      const path = rest[0];
      if (!path) throw new QaUsageError("read needs a path");
      const r = readQa(f.one("ref") ?? "main", path, opts);
      if (r.state === "hit") process.stdout.write(r.text);
      else console.error(`qa read ${r.state.toUpperCase()}: ${r.reason}`);
      return exitFor(r.state);
    }
    case "publish": {
      const repoRoot = gitTopLevel();
      let ref = f.one("ref");
      let checkout: string | undefined;
      if (f.has("github")) {
        let event: unknown;
        try {
          // input-site: store #d7f91bed — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
          event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf-8")) : undefined;
        } catch {
          event = undefined;
        }
        // input-site: store #9cc42cff — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
        const d = githubPublishDecision(process.env, event);
        if (!d.publish) {
          // A notice in the run summary, and exit 0: a skipped publish is a
          // stated decision, not a failure — and not silence either.
          console.log(`::notice title=qa:publish skipped::${d.reason}`);
          return 0;
        }
        ref = d.ref;
        checkout = d.checkout;
      }
      if (!ref) throw new QaUsageError("publish needs --ref main/<sha> | pr/<n>/<sha>, or --github in CI");
      if (f.has("add")) {
        // Bean `1dre`: an observation made after the commit's own publish,
        // added into that entry (see addQa). Roots are required: an add of
        // "whatever qa directories exist" would be the whole record again.
        if (!f.many("root").length) throw new QaUsageError("publish --add needs at least one --root");
        // input-site: store #f79bad10 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
        const run = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;
        const a = addQa({ ref, roots: f.many("root"), ...(run ? { run } : {}) }, { ...opts, repoRoot });
        say(a, `qa:publish --add ${a.state.toUpperCase()} ${a.key}: ${a.reason}${a.commit ? ` (${a.commit})` : ""}`);
        return a.state === "added" || a.state === "present" ? 0 : a.state === "no-entry" || a.state === "empty" ? QA_EXIT.miss : QA_EXIT.unknown;
      }
      // Bean `3hk4`: a CI publish states what produced its tree. Without a
      // complete `qa:refresh` report, a fresh checkout after `5hox` would be
      // stored as a one-file entry that reads as the record of the commit.
      let completeness: QaManifest["completeness"];
      const reportFile = f.one("completeness");
      if (reportFile !== undefined || f.has("github")) {
        if (reportFile === undefined) {
          console.error("qa:publish INCOMPLETE: --github needs --completeness <qa:refresh report>; nothing published");
          return QA_EXIT.unknown;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(readFileSync(reportFile, "utf-8"));
        } catch (e) {
          console.error(`qa:publish INCOMPLETE: the refresh report ${reportFile} could not be read (${(e as Error).message}); nothing published`);
          return QA_EXIT.unknown;
        }
        const c = refreshReportComplete(parsed);
        if (!c.ok) {
          console.error(`qa:publish INCOMPLETE: ${c.reason}; nothing published`);
          return QA_EXIT.unknown;
        }
        completeness = c.completeness;
      }
      const roots = f.many("root").length ? f.many("root") : resolveQaLocation(repoRoot).directories.filter((d) => d.present).map((d) => d.path);
      // input-site: store #f79bad10 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
      const run = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;
      const gates = f.one("gates-result");
      const force = f.has("force");
      const skipUnchanged = !force;
      const r = publishQa(
        {
          ref,
          roots,
          checkout,
          force,
          skipUnchanged,
          ...(run || gates ? { producer: { ...(run ? { run } : {}), ...(gates ? { gates } : {}) } } : {}),
          ...(completeness ? { completeness } : {}),
        },
        { ...opts, repoRoot },
      );
      say(r, `qa:publish ${r.state.toUpperCase()} ${r.key}: ${r.reason}${r.commit ? ` (${r.commit})` : ""}`);
      return r.state === "published" || r.state === "present" || r.state === "skipped" ? 0 : r.state === "empty" ? QA_EXIT.miss : QA_EXIT.unknown;
    }
    case "prune": {
      // input-site: store #ec29a4c5 — configures or performs a qa-reports store read; every by-ref read is reported by snapshot(), every other git call by TreeStore.git()
      const now = f.one("now") ? new Date(f.one("now")!) : new Date();
      if (Number.isNaN(now.getTime())) throw new QaUsageError(`--now is not a date: ${f.one("now")}`);
      const prState = f.one("pr-states") ? readPrStates(f.one("pr-states")!) : undefined;
      if (!prState) console.error("qa:prune: no --pr-states; every pr/<n> is of unknown state and is KEPT");
      const r = pruneQa({ now, apply: f.has("apply"), prState }, opts);
      say(r, [
        `qa:prune ${r.state.toUpperCase()}: ${r.reason}${r.commit ? ` (${r.commit})` : ""}`,
        ...(r.plan?.remove ?? []).map((p) => `  - ${p}`),
        ...(r.plan?.notes ?? []).map((n) => `  · ${n}`),
      ].join("\n"));
      return r.state === "failed" ? QA_EXIT.unknown : 0;
    }
    default:
      throw new QaUsageError(`unknown command "${cmd ?? ""}" — fetch | read | publish | prune | where`);
  }
}

if (import.meta.main) {
  let code: number;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    if (e instanceof QaUsageError) {
      console.error(`qa-store: ${e.message}`);
      code = QA_EXIT.usage;
    } else {
      console.error(`qa-store: could not determine — ${(e as Error).message}. This is NOT a pass.`);
      code = QA_EXIT.unknown;
    }
  }
  process.exit(code);
}
