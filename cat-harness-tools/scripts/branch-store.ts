#!/usr/bin/env bun
/**
 * branch-store — a generic store for a directory whose contents live at a
 * BRANCH TIP rather than on `main`. Two keyings reach it, and they differ in
 * exactly one thing, the write:
 *
 * - `storage.keyedBy: "tip"` — ONE live copy whose tip IS the current state.
 *   Beans, todos, fsh-guts. A write carries `expect`, so two sessions editing
 *   one file is a `conflict` the caller settles.
 * - `storage.keyedBy: "route"` — one entry per published SITE ROUTE, each
 *   replaced wholesale by the single generator that owns it. Regenerable
 *   rendered pages. A write may NOT carry `expect` and is refused if it does:
 *   nobody authored either side, so the newer generation wins.
 *
 * The keying is PASSED to {@link BranchStore.open}, not read off the branch,
 * and a manifest that disagrees is `corrupt`: the caller states what it came
 * for.
 *
 * Only STATE subgraphs get a branch of their own; skills, schemas and
 * processes stay on `main`.
 *
 * ## The layout it reads and writes
 *
 * ```
 * cat/cat-harness/beans   (orphan; never merged)
 * ├── README.md
 * ├── manifest.json        state-manifest/v1, keyedBy: "tip"
 * └── beans/**             paths mirror the checkout
 * ```
 *
 * The root `manifest.json` is what makes a branch a state branch. A read of a
 * branch without one — or with a foreign `$schema`, or `keyedBy` other than
 * `tip` — is `corrupt`, never a hit: a reader must not take a stray branch's
 * files for the work plan.
 *
 * ## Four read states, and a miss is never empty-clean
 *
 * | state | meaning |
 * |---|---|
 * | hit | the branch verifies and the path is there |
 * | miss | determined absent: no branch, or no such path at the tip |
 * | corrupt | present but unusable: no/foreign manifest, a tree where a file was asked for, unparseable JSON |
 * | unknown | could not determine: the remote or git failed. **Never a pass.** |
 *
 * ## The write path
 *
 * Fetch the tip, SPLICE the changed paths into its tree (every other file is
 * carried across by id), `commit-tree -p tip`, push WITHOUT `-f`. On
 * rejection, back off (`waitFor`, the `backoff-sleep.ts` numbers) and rebuild
 * on the new tip — {@link WRITE_ATTEMPTS} attempts. The server's ref lock is
 * the concurrency primitive, so a sibling's write to another file survives.
 *
 * Two writers editing the SAME file is the case a splice alone cannot settle.
 * A change may therefore carry `expect` — the blob id its author read (or
 * `null`, "must not exist") — and when the tip disagrees the write stops as
 * `conflict` and pushes nothing. The caller re-reads and decides; the store
 * never merges content.
 *
 * `qa-store.ts` has the same loop for commit-keyed entries; it is modelled
 * on, not shared with, this module.
 *
 * ## Where its git objects live
 *
 * In a PRIVATE bare repository, `<git-common-dir>/branch-store.git` (or
 * `BRANCH_STORE_DIR`), never in the checkout's object store: a `--filter`
 * fetch turns the repository it runs in into a partial clone, and a reader
 * must not do that to a contributor's checkout. The checkout's
 * `http.*.extraheader` (CI's token) is carried in the ENVIRONMENT, once and in place
 * of any global copy (`GIT_CONFIG_COUNT`, `lib/git-auth-env.ts`), never in argv.
 *
 * {@link resolveTipLocation} maps a declared directory to its branch and path.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/branch-store.ts read --branch B <path>
 *   bun run cat-harness-tools/scripts/branch-store.ts ls   --branch B [<dir>]
 *   bun run cat-harness-tools/scripts/branch-store.ts where --id <directory-id>
 *   bun run cat-harness-tools/scripts/branch-store.ts mount --id <directory-id> [--into <path>]
 *   bun run cat-harness-tools/scripts/branch-store.ts push  --id <directory-id> [--message <m>]
 *
 * @module scripts/branch-store
 * @covers beans
 * @covers todos
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";

import { layerRootsIn, resolveDirectories, type ResolvedDirectory } from "../schemas/kg/cat-harness.js";
import { lockFilesIn } from "../schemas/kg/instance-roots.js";
import { mountScopeFor, readMountLock } from "../schemas/kg/remote-mount.js";
import { subgraphSourceOverrides } from "../schemas/kg/harness-config.js";
import { resolveSubgraphSource, type SubgraphSourceOverrides } from "../schemas/kg/subgraph-source.js";
// `readDeclaration` throws on the `folio` kind unless core has registered it —
// the same side-effect import `qa-store.ts` carries, same reason.
import "../schemas/kg/folio-graph-typology.js";
import { waitFor } from "../src/core/retry.js";
import { PUSH_BASE_MS, PUSH_CAP_MS } from "./backoff-sleep.js";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { projectedRead } from "../schemas/sdlc/read-projections.ts";
import { githubUrlFor, type UrlFor } from "./remote-tree.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";
import { authEnvFrom } from "./lib/git-auth-env.ts";

// ── Constants ────────────────────────────────────────────────────────────

export const MANIFEST_FILE = "manifest.json";
export const MANIFEST_SCHEMA = "state-manifest/v1";
/** Root files a write may not touch: they describe the branch, not the subgraph. */
export const RESERVED = new Set([MANIFEST_FILE, "README.md"]);
export const WRITE_ATTEMPTS = 3;
/** The identity the seed branches were written as. */
export const STATE_BOT = { name: "folio-state-bot", email: "folio-state-bot@users.noreply.github.com" };

// ── Types ────────────────────────────────────────────────────────────────

export type NotHit = { state: "miss" | "corrupt" | "unknown"; reason: string };

export interface Hit {
  state: "hit";
  /** The branch actually read — the first candidate the remote has. */
  branch: string;
  tip: string;
}

export type FileRead = (Hit & { path: string; blob: string; text: string }) | NotHit;
export type JsonRead<T = unknown> = (Hit & { path: string; blob: string; value: T }) | NotHit;
export type DirRead = (Hit & { path: string; entries: Array<{ name: string; type: "blob" | "tree"; sha: string }> }) | NotHit;
export type TreeRead = (Hit & { prefix: string; files: Map<string, string> }) | NotHit;
export type TreeEntriesRead = (Hit & { prefix: string; files: Map<string, { blob: string; mode: string; bytes: Buffer }> }) | NotHit;

/**
 * One change to splice onto the tip. `content: null` removes the path.
 * `expect`, when given, is the blob id the author read (`null`: the path must
 * not exist); a tip that disagrees stops the write as `conflict`.
 */
export interface Change {
  path: string;
  /** Text or BYTES: a tip store may hold binary files (fsh-guts keeps archived PDFs). */
  content: string | Buffer | null;
  expect?: string | null;
  /** `100755` keeps an executable executable, `120000` a symlink (content = its target); default `100644`. */
  mode?: "100644" | "100755" | "120000";
}

export type WriteState = "pushed" | "unchanged" | "conflict" | "absent" | "failed";
export interface WriteResult {
  state: WriteState;
  reason: string;
  branch: string;
  commit?: string;
  attempts: number;
  /** For `conflict`: each path whose tip blob differed from `expect`. */
  conflicts?: Array<{ path: string; expected: string | null; actual: string | null }>;
}

/**
 * The keyings {@link BranchStore} implements — the subset of
 * `DirectoryStorage.keyedBy` that lives on a branch tip rather than under a
 * per-commit prefix. `commit` is `qa-store.ts`'s and is deliberately absent.
 */
export const BRANCH_KEYINGS = ["tip", "route", "route-family"] as const;
export type BranchKeying = (typeof BRANCH_KEYINGS)[number];

export interface BranchStoreOptions {
  /** The checkout root. Default: `git rev-parse --show-toplevel` from cwd. */
  repoRoot?: string;
  /** The remote URL or path. Default: env `BRANCH_STORE_REMOTE`, else the checkout's `origin`. */
  remote?: string;
  /**
   * How a location's `repository` (`owner/repo`, from the index lock) becomes a
   * fetch URL — the same injection `remote-mount.ts` takes, so a test serves a
   * local bare repository per layer. Only consulted for a location kept in
   * ANOTHER repository (see {@link TipLocation.repository}); default GitHub.
   */
  urlFor?: UrlFor;
  /** The private bare repository. Default: env `BRANCH_STORE_DIR`, else `<git-common-dir>/branch-store.git`. */
  storeDir?: string;
  /** Injected for tests; default sleeps the backoff synchronously. */
  sleep?: (ms: number) => void;
  /** Called after the tree is built and before each push — tests widen the race window with it. */
  beforePush?: (attempt: number) => void;
  /** Progress lines; default stderr. */
  log?: (line: string) => void;
  /**
   * Which keying this store is opened for — the value the branch's root
   * manifest must agree with, and what decides whether a write may carry
   * `expect`. Default `"tip"`, the only keying before bean `1j3q`.
   *
   * It is passed rather than sniffed from the manifest on purpose: a reader
   * that adopted whatever keying the branch claimed would read a route-keyed
   * branch as state the moment somebody pushed the wrong manifest. The caller
   * states what it came for and a disagreement is `corrupt`.
   */
  keyedBy?: BranchKeying;
}

/** A malformed question — never folded into miss. */
export class BranchStoreUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BranchStoreUsageError";
  }
}

// ── Location (the declaration) ───────────────────────────────────────────

export interface TipLocation {
  id: string;
  /** Repository-relative, no trailing slash — where the files go in THIS checkout. */
  path: string;
  branch: string;
  /** The declared keying this location was resolved for. */
  keyedBy: BranchKeying;
  /**
   * The key its mount marker is filed under, when that is not `id`.
   *
   * An index composes layers that each declare their own state graph, and
   * nothing stops two of them choosing the same id: on 2026-10-11 four
   * layers declared `health`. Keyed by id alone, `tipLocations` kept the
   * first and the other three were never mounted — silently, so
   * `audit:coverage` read them as undetermined. An id that more than one
   * location declares is therefore keyed `<instance>.<id>`, every one of them
   * (not "all but the first", which would make a marker's name depend on the
   * order layers are scanned). Absent for an id only one location declares,
   * so a checkout without a collision keeps the `<id>.json` markers it has.
   */
  key?: string;
  /** The layer the declaration belongs to, when the location is keyed by it. */
  instance?: string;
  /**
   * The repository whose branch keeps this graph (`owner/repo`), when it is not
   * this checkout's `origin`: a directory declared INSIDE a remote-mounted
   * layer of an index is that layer's state, and its branch lives in the
   * layer's own repository with instance-relative paths. Read from the
   * index lock. Absent for the checkout's own graphs.
   */
  repository?: string;
  /** The directory's path ON THE BRANCH, when it differs from {@link path} (instance-relative in its own repository). */
  branchPath?: string;
  /**
   * Set when the location is a `scope: "repository"` graph that a mounted
   * layer declares and the checkout's root does not: the layer that
   * declared it. Such a graph is the checkout's own (its work plan, its issue
   * marks), so it is read from the checkout's `origin`, but no declaration at
   * the root asked for it. If that origin does not carry its branch, the
   * graph MAY be absent from this checkout rather than a failed mount (owner,
   * 2026-10-14, smart-ra#59: "Report as absent"): it is, when that remote
   * carries no branch of the graph's namespace at all ({@link namespaceCarried};
   * "Tighten it", cat-harness-tools#249). A root that wants the graph declares
   * it at the same path, and then this is not set.
   */
  unownedBy?: string;
}

/** The marker key of a location: its {@link TipLocation.key}, else its id. */
export function locationKey(loc: Pick<TipLocation, "id" | "key">): string {
  return loc.key ?? loc.id;
}

/** Where a location's files are on its branch. */
export function branchPathOf(loc: Pick<TipLocation, "path" | "branchPath">): string {
  return loc.branchPath ?? loc.path;
}

/**
 * Where one declared directory's content is kept, read from its RESOLVED
 * source (bean `doy3`): a config override, then `source`, then the legacy
 * `storage`. Until 2026-10-03 these functions read `storage` alone, so a
 * subgraph declared the current way — `source: { kind: "branch" }` — was
 * invisible to the `branch-store` CLI, to `StateStore` and to the state mount.
 *
 * `route` and `route-family` are the keyings still read straight off
 * `storage`: the source union has no member for either yet, so the resolver
 * would refuse them.
 */
function keptAt(
  inst: string,
  repoRoot: string,
  d: ResolvedDirectory,
  overrides: () => SubgraphSourceOverrides = () => subgraphSourceOverrides(inst, repoRoot),
): { branch: string; keyedBy: string } | undefined {
  if (d.storage?.keyedBy === "route" || d.storage?.keyedBy === "route-family") {
    // Non-null by DirectoryStorageSchema's refine: every keying but `family` requires `branch`.
    return { branch: d.storage.branch!, keyedBy: d.storage.keyedBy };
  }
  const src = resolveSubgraphSource(d, overrides());
  switch (src.kind) {
    case "directory":
      return undefined;
    case "branch":
      return { branch: src.branch, keyedBy: src.keyedBy };
    // A FAMILY (bean `lehh`) has no single tip: every caller below either skips
    // a keying it is not (`tipLocations`), refuses it (`resolveTipLocation`), or
    // reports it as on a branch and not mounted (`contentAt`). It is returned as
    // the prefix so each of them can name it, and never opened as a branch.
    case "family":
      return { branch: src.branchPrefix, keyedBy: "family" };
    // A REMOTE mount (bean `0mpw`) is another repository's tree at a pin: no
    // branch of THIS repository keeps it, so this store has nothing to mount
    // or push. `remote-mount.ts` puts it on disk and checks it against its lock.
    case "remote":
      return undefined;
    // An NPM package (source kind `npm`, kg-retrieve-npm) is likewise another
    // tree at a pinned version — retrieved by its Tool, kept on no branch here.
    case "npm":
      return undefined;
    // HYDRATED metadata (bean `mo75` G2) is another layer's published
    // `index.hydrated.jsonld` at a pin: `remote-mount` lays it down and locks
    // it, and no branch here keeps it.
    case "hydrated":
      return undefined;
    default: {
      const unknown: never = src;
      throw new BranchStoreUsageError(`directory ${d.id} has a source kind this store does not know: ${JSON.stringify(unknown)}`);
    }
  }
}

function repoRelative(repoRoot: string, abs: string): string {
  return relative(repoRoot, abs).split("\\").join("/").replace(/\/+$/, "");
}

/**
 * Every declared directory that is kept at a branch tip, across the layers
 * in this checkout.
 *
 * The companion to {@link resolveTipLocation}: that answers "which branch for
 * THIS id", this answers "is anything kept on a branch at all". The
 * session-start mount needs the second question, because the honest answer
 * today is "nothing is" — and a mount that treated that as a failure would
 * fail every session over a branch that nothing reads.
 *
 * Returns them sorted by id so a caller's output is stable.
 */
export function tipLocations(repoRoot: string = gitTopLevel(), keyedBy: BranchKeying | "any" = "tip"): TipLocation[] {
  // Keys are assigned over EVERY branch keying before the filter, so a
  // location's key does not depend on which keying the caller asked for.
  return allBranchLocations(repoRoot).filter((l) => keyedBy === "any" || l.keyedBy === keyedBy);
}

/**
 * Every branch-kept location (`tip`, `route`, `route-family`), one per declared
 * PATH, keyed uniquely. Sorted by id, then path, so output is stable.
 *
 * Until 2026-10-11 this kept the first location per id, which in an index
 * mounted cat-harness's `health` and silently dropped cat-harness-tools',
 * and two content layers'. One per path is the real identity: two
 * declarations of one path are one directory, two paths are two graphs.
 */
function allBranchLocations(repoRoot: string, wantId: (id: string) => boolean = () => true): TipLocation[] {
  const found: Array<TipLocation & { instRoot: string }> = [];
  const remotes = new Map<string, RemoteInstance | undefined>();
  for (const inst of layerRootsIn(repoRoot)) {
    // The layer's overrides, read ONCE for all its directories and only
    // when one needs them. Read per directory, they were ~4.5 s of a ~9 s
    // `gen-docs-pages` run (2026-10-30, #871): `subgraphSourceOverrides` re-reads
    // the layer's and the checkout's config each time.
    let overrides: SubgraphSourceOverrides | undefined;
    const overridesOf = (): SubgraphSourceOverrides => (overrides ??= subgraphSourceOverrides(inst, repoRoot));
    for (const d of resolveDirectories([{ name: "(local)", root: inst, own: true }])) {
      // Filtered BEFORE `keptAt`, which reads the layer's config: resolving
      // every directory of an index costs ~27 s, one id ~0.2 s (measured
      // 2026-10-11), and `resolveTipLocation` asks about one id.
      if (!wantId(d.id)) continue;
      const at = keptAt(inst, repoRoot, d, overridesOf);
      const k = at?.keyedBy;
      if (k !== "tip" && k !== "route" && k !== "route-family") continue;
      const path = repoRelative(repoRoot, d.absPath);
      if (found.some((o) => o.path === path)) continue;
      const loc: TipLocation & { instRoot: string } = { id: d.id, path, branch: at!.branch, keyedBy: k, instRoot: inst };
      // A checkout-level graph some mounted layer declares for whatever
      // checkout it sits in, with no declaration of the root's own claiming
      // the path (that one would have been found first and won above).
      if (k === "tip" && d.scope === "repository" && resolve(inst) !== resolve(repoRoot)) loc.unownedBy = d.declaredBy ?? relative(repoRoot, inst);
      // A TIP graph declared inside a remote-mounted layer is read from that
      // layer's repository. Route stores are published by the checkout's own
      // generators and stay on its origin.
      if (k === "tip") {
        if (!remotes.has(inst)) remotes.set(inst, remoteInstanceOf(inst, repoRoot));
        const ri = remotes.get(inst);
        const within = relative(inst, d.absPath).split(sep).join("/").replace(/\/+$/, "");
        if (ri && within !== "" && !within.startsWith("..") && !isAbsolute(within)) {
          loc.repository = ri.repository;
          loc.instance = ri.instance;
          const onBranch = ri.upstreamRoot ? posix.join(ri.upstreamRoot, within) : within;
          if (onBranch !== path) loc.branchPath = onBranch;
        }
      }
      found.push(loc);
    }
  }
  const perId = new Map<string, number>();
  for (const l of found) perId.set(l.id, (perId.get(l.id) ?? 0) + 1);
  const out: TipLocation[] = found.map(({ instRoot, ...l }) => {
    if ((perId.get(l.id) ?? 0) < 2) return l;
    const instance = l.instance ?? (repoRelative(repoRoot, instRoot).split("/").join(".") || "root");
    return { ...l, instance, key: `${instance}.${l.id}` };
  });
  return out.sort((a, b) => a.id.localeCompare(b.id) || a.path.localeCompare(b.path));
}

/** A remote-mounted layer as the index lock records it. */
export interface RemoteInstance {
  instance: string;
  /** `owner/repo`. */
  repository: string;
  /** The layer's root inside that repository; `""` is its root. */
  upstreamRoot: string;
}

/**
 * The lock entry that put `instRoot` where it is, or undefined for a layer
 * no remote mount placed (the checkout's own, or a plain directory). Reads only
 * lock files: `mountScopeFor` finds the scope, and the lock there names the
 * repository. A lock that does not parse contributes nothing — `mount:remote:check`
 * is where that is reported — and the graph then falls back to `origin`.
 */
export function remoteInstanceOf(instRoot: string, repoRoot: string): RemoteInstance | undefined {
  const abs = resolve(instRoot);
  if (abs === resolve(repoRoot)) return undefined;
  const scope = mountScopeFor(abs);
  if (!scope) return undefined;
  for (const name of lockFilesIn(scope).files) {
    const r = readMountLock(join(scope, name));
    if (!r.ok) continue;
    for (const i of r.lock.instances) {
      if (resolve(scope, i.path) === abs) return { instance: i.instance, repository: i.repository, upstreamRoot: i.upstreamRoot.replace(/^\/+|\/+$/g, "") };
    }
  }
  return undefined;
}

/**
 * The declared directory `id`, kept at a branch tip, across the checkout's
 * layers. Refuses a directory that is undeclared, kept in the checkout, or
 * commit-keyed, rather than guessing a branch: the default for "no
 * declaration" is `main`, which is not this store.
 */
export function resolveTipLocation(
  id: string,
  repoRoot: string = gitTopLevel(),
  keyedBy: BranchKeying | "any" = "any",
): TipLocation {
  // A location KEY (`<instance>.health`) names one graph exactly; an id more
  // than one location declares names several, and guessing among them is how
  // the wrong layer's state gets read or pushed.
  // Only directories that could answer: the id itself, or the `<id>` a key
  // `<instance>.<id>` ends in. Keys are assigned per id, so a narrowed scan
  // keys them exactly as the full one does.
  const all = allBranchLocations(repoRoot, (d) => d === id || id.endsWith(`.${d}`));
  const byKey = all.find((l) => l.key === id);
  const pick = byKey ? [byKey] : all.filter((l) => l.id === id);
  if (pick.length > 1) {
    throw new BranchStoreUsageError(
      `${pick.length} declared directories have id ${id} (${pick.map((l) => `${l.path} → ${locationKey(l)}`).join(", ")}); name one by its key`,
    );
  }
  if (pick.length === 1) {
    const l = pick[0]!;
    if (keyedBy !== "any" && l.keyedBy !== keyedBy) throw new BranchStoreUsageError(`directory ${id} is keyed by ${l.keyedBy}, not ${keyedBy}`);
    return l;
  }
  for (const inst of layerRootsIn(repoRoot)) {
    for (const d of resolveDirectories([{ name: "(local)", root: inst, own: true }])) {
      if (d.id !== id) continue;
      const at = keptAt(inst, repoRoot, d);
      if (!at) throw new BranchStoreUsageError(`directory ${id} is kept in the checkout, not on a branch; it lives on main`);
      const k = at.keyedBy;
      // `commit` is qa-store's layout, not a branch tip at all; `tip`,
      // `route` and `route-family` are all tips but differ in how a write
      // settles, so a caller that came for one is refused the others rather
      // than served them. A family additionally needs a MEMBER, which a
      // caller holding only an id does not have — hence the refusal here is
      // the same shape, not a looser one.
      if (k !== "tip" && k !== "route" && k !== "route-family") {
        throw new BranchStoreUsageError(`directory ${id} is keyed by ${k}, which this store does not implement`);
      }
      if (keyedBy !== "any" && k !== keyedBy) throw new BranchStoreUsageError(`directory ${id} is keyed by ${k}, not ${keyedBy}`);
      return { id, path: repoRelative(repoRoot, d.absPath), branch: at.branch, keyedBy: k };
    }
  }
  throw new BranchStoreUsageError(`no declared directory has id ${id}`);
}

// ── Git plumbing ─────────────────────────────────────────────────────────

export interface GitResult {
  status: number;
  stdout: Buffer;
  stderr: string;
}
export interface GitOpts {
  input?: string | Buffer;
  env?: Record<string, string>;
  /** `qa-store`'s plumbing passes this; kept here so one {@link TreeStore} serves both. */
  cwd?: string;
}
export interface TreeEntry {
  mode: string;
  type: string;
  sha: string;
  name: string;
}

function gitTopLevel(cwd = process.cwd()): string {
  // input-site: store #128d75cd — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new BranchStoreUsageError(`not inside a git checkout: ${cwd}`);
  return r.stdout.trim();
}

/** Split and check a branch-relative path. Absolute, `..`, and empty segments are usage errors. */
function segments(path: string): string[] {
  const segs = path.split("/").filter((s) => s !== "" && s !== ".");
  if (path.startsWith("/") || segs.some((s) => s === "..")) throw new BranchStoreUsageError(`not a branch-relative path: ${path}`);
  return segs;
}

/** The tip of the first candidate branch the remote has. */
export type Tip = { state: "ok"; branch: string; tip: string } | { state: "absent"; branch: string } | { state: "unknown"; branch: string; reason: string };

/**
 * A tip-keyed branch store: a private bare repository, a remote, and the
 * branch names to look under (the first is canonical; later ones are earlier
 * names the remote may still carry).
 */
/**
 * The git-plumbing half of a branch store, shared by every keying.
 *
 * ## Why this is one class and not two
 *
 * `qa-store.ts` (arc `3fva`, commit-keyed) and {@link BranchStore} (tip-keyed)
 * both reach a branch the same way: fetch its tip trees-only, walk and splice
 * trees by id, hydrate blobs in ONE round trip, `commit-tree`, push without
 * `-f`. Bean `2h76` part 1 is to have one copy of that, and this is it.
 *
 * Measured before extracting, method by method: `mktree` and `setPath` were
 * byte-identical across the two files but for a `private` modifier, and `must`
 * was identical outright. The rest differed only in three axes, which are
 * therefore the constructor's parameters rather than forks of the code:
 *
 *   identity      which bot authors the commit (`QA_BOT` / `STATE_BOT`)
 *   refNamespace  `refs/<ns>/…`, so concurrent readers never contend for a lock
 *   branches      ONE branch, or ordered CANDIDATES for a rename in flight
 *
 * The candidate list is the one real behavioural difference and it is a
 * superset: a single-branch caller passes `[branch]` and
 * {@link TreeStore.fetchTip} resolves it to itself. That is why the unified
 * `Tip` carries `branch` — a commit-keyed caller ignores it, a migrating one
 * needs to know which name answered.
 *
 * Plumbing is PUBLIC here, where `BranchStore` had kept its copy private. A
 * private method is right for one consumer; this module now has three —
 * `qa-store`, `BranchStore`, and `9c7h`'s `fsh-guts` — and a store they cannot
 * call is one they would each re-copy, which is the duplication this removes.
 */
export class TreeStore {
  readonly env: NodeJS.ProcessEnv;
  readonly log: (line: string) => void;
  /** Ordered names to try; the tip resolves to the first that EXISTS. */
  readonly candidates: readonly string[];
  /** The name writes land on — whichever answered the last {@link fetchTip}, else the first candidate. */
  branch: string;
  private seq = 0;
  private readonly refNamespace: string;

  constructor(
    readonly dir: string,
    readonly remote: string,
    branches: readonly string[],
    authEnv: Record<string, string>,
    opts: { identity: { name: string; email: string }; refNamespace: string; log?: (line: string) => void },
  ) {
    if (branches.length === 0) throw new Error("TreeStore needs at least one branch name");
    this.candidates = [...branches];
    this.branch = this.candidates[0]!;
    this.refNamespace = opts.refNamespace;
    this.log = opts.log ?? ((l) => console.error(l));
    this.env = {
      // input-site: store #b3c0797f — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
      ...process.env,
      ...authEnv,
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_NAME: opts.identity.name,
      GIT_AUTHOR_EMAIL: opts.identity.email,
      GIT_COMMITTER_NAME: opts.identity.name,
      GIT_COMMITTER_EMAIL: opts.identity.email,
    };
    // A bare store of our own: the caller's GIT_* must not reach it.
    delete this.env.GIT_DIR;
    delete this.env.GIT_WORK_TREE;
    delete this.env.GIT_INDEX_FILE;
    if (!existsSync(join(dir, "HEAD"))) {
      // input-site: store #8d3dda23 — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
      const init = spawnSync("git", ["init", "-q", "--bare", dir], { env: this.env });
      if (init.status !== 0) throw new Error(`git init --bare ${dir} failed: ${init.stderr?.toString()}`);
    }
    const cur = this.git(["config", "--get", "remote.origin.url"]);
    if (cur.status !== 0) this.must(["remote", "add", "origin", remote]);
    else if (cur.stdout.toString().trim() !== remote) this.must(["remote", "set-url", "origin", remote]);
  }

  git(args: string[], opts: GitOpts = {}): GitResult {
    // input-site: traced #4d97ae37 — every git call on a store: its remote, its bare repository, its auth
    inputSiteReached(`branch-store ${this.dir}`);
    const r = spawnSync("git", [`--git-dir=${this.dir}`, ...args], {
      cwd: opts.cwd,
      env: { ...this.env, ...opts.env },
      input: opts.input,
      maxBuffer: 1 << 30,
    });
    return {
      status: r.status ?? (r.error ? 128 : 0),
      stdout: (r.stdout as Buffer | null) ?? Buffer.alloc(0),
      stderr: (r.stderr as Buffer | null)?.toString() ?? String(r.error ?? ""),
    };
  }

  must(args: string[], opts: GitOpts = {}): string {
    const r = this.git(args, opts);
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}: ${r.stderr.trim()}`);
    return r.stdout.toString();
  }

  /** A ref name unique to this process and call, so concurrent readers never contend for one lock. */
  privateRef(kind: string): string {
    return `refs/${this.refNamespace}/${kind}/${process.pid}-${++this.seq}`;
  }

  /**
   * The resolved tip, trees only. `absent` is a DETERMINED absence (ls-remote
   * answered, and named none of the candidates); a failed ls-remote is `unknown`.
   * Sets {@link branch} to whichever candidate answered.
   */
  fetchTip(): Tip {
    const ls = this.git(["ls-remote", "--heads", "origin", ...this.candidates.map((c) => `refs/heads/${c}`)]);
    if (ls.status !== 0) return { state: "unknown", branch: this.branch, reason: `ls-remote failed: ${ls.stderr.trim()}` };
    const present = new Set(
      ls.stdout
        .toString()
        .split("\n")
        .map((l) => l.split("\t")[1]?.trim().replace(/^refs\/heads\//, ""))
        .filter((b): b is string => Boolean(b)),
    );
    const found = this.candidates.find((c) => present.has(c));
    this.branch = found ?? this.candidates[0]!;
    if (!found) return { state: "absent", branch: this.branch };
    const ref = this.privateRef("tip");
    const f = this.git(["fetch", "-q", "--no-tags", "--depth=1", "--filter=blob:none", "origin", `+refs/heads/${found}:${ref}`]);
    if (f.status !== 0) return { state: "unknown", branch: found, reason: `fetch of ${found} failed: ${f.stderr.trim()}` };
    const tip = this.must(["rev-parse", ref]).trim();
    this.git(["update-ref", "-d", ref]);
    return { state: "ok", branch: found, tip };
  }

  /** `ls-tree -z` of one tree, parsed. */
  lsTree(tree: string): TreeEntry[] {
    const out = this.must(["ls-tree", "-z", tree]);
    return out
      .split("\0")
      .filter(Boolean)
      .map((l) => {
        const tab = l.indexOf("\t");
        const [mode, type, sha] = l.slice(0, tab).split(" ");
        return { mode: mode!, type: type!, sha: sha!, name: l.slice(tab + 1) };
      });
  }

  /**
   * The object at `path` under `tree`, or undefined. Takes a slash-separated
   * string or pre-split segments — the two callers had one each.
   */
  lookup(tree: string, path: string | readonly string[]): TreeEntry | undefined {
    const segs = typeof path === "string" ? path.split("/").filter(Boolean) : path;
    let cur: TreeEntry | undefined = { mode: "040000", type: "tree", sha: tree, name: "" };
    for (const seg of segs) {
      if (cur.type !== "tree") return undefined;
      cur = this.lsTree(cur.sha).find((e) => e.name === seg);
      if (!cur) return undefined;
    }
    return cur;
  }

  mktree(entries: TreeEntry[]): string {
    const input = entries.map((e) => `${e.mode} ${e.type} ${e.sha}\t${e.name}\0`).join("");
    return this.must(["mktree", "-z", "--missing"], { input }).trim();
  }

  /**
   * `tree` with `path` set to `entry`, or removed when `entry` is undefined.
   * A directory emptied by a removal is removed too: git has no empty tree
   * entry, and writing one would be a determined-empty that means nothing.
   * Returns undefined when the whole tree became empty.
   */
  setPath(tree: string | undefined, path: string[], entry: TreeEntry | undefined): string | undefined {
    const [head, ...rest] = path;
    const entries = tree ? this.lsTree(tree) : [];
    const others = entries.filter((e) => e.name !== head);
    let replacement: TreeEntry | undefined;
    if (rest.length === 0) {
      replacement = entry ? { ...entry, name: head! } : undefined;
    } else {
      const child = entries.find((e) => e.name === head && e.type === "tree");
      const sub = this.setPath(child?.sha, rest, entry);
      replacement = sub ? { mode: "040000", type: "tree", sha: sub, name: head! } : undefined;
    }
    const next = replacement ? [...others, replacement] : others;
    return next.length ? this.mktree(next) : undefined;
  }

  /** Blobs reachable from `tree` that are not in the store yet — without fetching them lazily. */
  missingObjects(tree: string): string[] {
    const r = this.git(["rev-list", "--objects", "--missing=print", "--no-object-names", tree]);
    if (r.status !== 0) throw new Error(`rev-list over ${tree} failed: ${r.stderr.trim()}`);
    return r.stdout
      .toString()
      .split("\n")
      .filter((l) => l.startsWith("?"))
      .map((l) => l.slice(1));
  }

  /**
   * Make every blob under `tree` local, in ONE round trip (spike finding 1).
   * Falls back to an unfiltered depth-1 fetch of the branch when the server
   * refuses a want by object id. Returns how many are still missing.
   */
  hydrate(tree: string): number {
    let missing = this.missingObjects(tree);
    if (missing.length === 0) return 0;
    const batch = this.git(
      ["-c", "fetch.negotiationAlgorithm=noop", "fetch", "-q", "--stdin", "--no-tags", "--no-write-fetch-head", "--filter=blob:none", "origin"],
      { input: missing.join("\n") + "\n" },
    );
    missing = this.missingObjects(tree);
    if (missing.length && batch.status !== 0) {
      const ref = this.privateRef("full");
      this.git(["fetch", "-q", "--no-tags", "--depth=1", "origin", `+refs/heads/${this.branch}:${ref}`]);
      this.git(["update-ref", "-d", ref]);
      missing = this.missingObjects(tree);
    }
    return missing.length;
  }

  /**
   * Make `shas` (blobs somewhere under `tree`) local, in one round trip, without
   * hydrating the rest of `tree`. Presence is asked of `rev-list --missing=print`
   * because every presence probe git 2.43 offers fetches lazily, one object at a time.
   */
  ensureBlobs(tree: string, shas: string[]): boolean {
    const want = new Set(shas);
    const missing = this.missingObjects(tree).filter((s) => want.has(s));
    if (missing.length === 0) return true;
    this.git(
      ["-c", "fetch.negotiationAlgorithm=noop", "fetch", "-q", "--stdin", "--no-tags", "--no-write-fetch-head", "--filter=blob:none", "origin"],
      { input: missing.join("\n") + "\n" },
    );
    return !this.missingObjects(tree).some((s) => want.has(s));
  }

  /** Contents of many blobs in one `cat-file --batch` process. */
  catBlobs(shas: string[]): Map<string, Buffer> {
    const out = new Map<string, Buffer>();
    if (shas.length === 0) return out;
    const r = this.git(["cat-file", "--batch"], { input: shas.join("\n") + "\n", env: { GIT_NO_LAZY_FETCH: "1" } });
    if (r.status !== 0) throw new Error(`cat-file --batch failed: ${r.stderr.trim()}`);
    const buf = r.stdout;
    let i = 0;
    for (const sha of shas) {
      const nl = buf.indexOf(10, i);
      const header = buf.subarray(i, nl).toString();
      const parts = header.split(" ");
      if (parts[1] === "missing") throw new Error(`blob ${sha} is missing from the store`);
      const size = Number(parts[2]);
      out.set(sha, buf.subarray(nl + 1, nl + 1 + size));
      i = nl + 1 + size + 1;
    }
    return out;
  }

  blobText(sha: string): string {
    return this.catBlobs([sha]).get(sha)!.toString("utf-8");
  }

  hashBlob(content: string): string {
    return this.must(["hash-object", "-w", "--stdin"], { input: content }).trim();
  }
}

export class BranchStore extends TreeStore {
  private readonly sleep: (ms: number) => void;
  private readonly beforePush?: (attempt: number) => void;
  /** The keying this store was opened for; the manifest must agree. */
  readonly keyedBy: BranchKeying;

  private constructor(
    dir: string,
    remote: string,
    branches: string[],
    authEnv: Record<string, string>,
    opts: BranchStoreOptions,
  ) {
    if (branches.length === 0) throw new BranchStoreUsageError("no branch named");
    super(dir, remote, branches, authEnv, { identity: STATE_BOT, refNamespace: "branch-store", log: opts.log });
    this.sleep = opts.sleep ?? ((ms) => Bun.sleepSync(ms));
    this.beforePush = opts.beforePush;
    this.keyedBy = opts.keyedBy ?? "tip";
  }

  /**
   * Open the store for `branch` (or several candidate names, canonical
   * first). Pass a {@link TipLocation}'s `branch` once a declaration exists.
   */
  static open(branch: string | string[], opts: BranchStoreOptions = {}): BranchStore {
    const branches = Array.isArray(branch) ? branch : [branch];
    for (const b of branches) {
      if (!/^(?!-)(?!refs\/)[A-Za-z0-9._/-]+$/.test(b) || b.includes("..")) throw new BranchStoreUsageError(`not a plain branch name: ${b}`);
    }
    const repoRoot = opts.repoRoot ?? gitTopLevel();
    // input-site: store #9d6d96d2 — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
    let remote = opts.remote ?? process.env.BRANCH_STORE_REMOTE;
    if (!remote) {
      // input-site: store #68c082a4 — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
      const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd: repoRoot, encoding: "utf-8" });
      if (r.status !== 0) throw new BranchStoreUsageError(`no remote: ${repoRoot} has no \`origin\`; pass remote or BRANCH_STORE_REMOTE`);
      remote = r.stdout.trim();
    }
    // input-site: store #bfcdb69a — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
    let storeDir = opts.storeDir ?? process.env.BRANCH_STORE_DIR;
    if (!storeDir) {
      // input-site: store #f48bd6b7 — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
      const c = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repoRoot, encoding: "utf-8" });
      if (c.status !== 0) throw new BranchStoreUsageError(`cannot find the git directory of ${repoRoot}`);
      storeDir = join(c.stdout.trim(), "branch-store.git");
    }
    return new BranchStore(resolve(storeDir), remote, branches, authEnvFrom(repoRoot), opts);
  }









  /** {@link TreeStore.missingObjects} as a set — this class probes membership. */
  private missing(tree: string): Set<string> {
    return new Set(this.missingObjects(tree));
  }



  // ── Reading ────────────────────────────────────────────────────────────

  /**
   * The tip, verified as a branch store: a root manifest, `state-manifest/v1`,
   * whose `keyedBy` is the one this store was OPENED for.
   *
   * The `$schema` string stays `state-manifest/v1` for a route-keyed branch
   * too, and that is a choice rather than an oversight. The two seeded
   * branches (`cat/cat-harness/beans`, `cat/cat-harness/todos`) already carry
   * it, so a second value would turn them `corrupt`; the format is identical
   * in every field; and `keyedBy` INSIDE the manifest is already the
   * discriminator, which is this repository's own rule that the file declares
   * what it is. The name is historical and the bean (`1j3q`) records it as
   * such.
   */
  private verifiedTip(): (Hit & { tree: string }) | NotHit {
    let t: Tip;
    try {
      t = this.fetchTip();
    } catch (e) {
      return { state: "unknown", reason: String(e) };
    }
    if (t.state === "absent") return { state: "miss", reason: `branch ${this.candidates.join(" / ")} does not exist on the remote` };
    if (t.state === "unknown") return { state: "unknown", reason: t.reason };
    try {
      const tree = this.must(["rev-parse", `${t.tip}^{tree}`]).trim();
      const m = this.lookup(tree, [MANIFEST_FILE]);
      if (!m || m.type !== "blob") return { state: "corrupt", reason: `${t.branch} has no root ${MANIFEST_FILE}; not a state branch` };
      if (!this.ensureBlobs(tree, [m.sha])) return { state: "unknown", reason: `could not fetch ${MANIFEST_FILE} of ${t.branch}` };
      let manifest: { $schema?: unknown; keyedBy?: unknown };
      try {
        manifest = JSON.parse(this.catBlobs([m.sha]).get(m.sha)!.toString("utf-8"));
      } catch (e) {
        return { state: "corrupt", reason: `${t.branch}:${MANIFEST_FILE} does not parse: ${(e as Error).message}` };
      }
      if (manifest?.$schema !== MANIFEST_SCHEMA) return { state: "corrupt", reason: `${t.branch}:${MANIFEST_FILE} is ${String(manifest?.$schema)}, not ${MANIFEST_SCHEMA}` };
      if (manifest.keyedBy !== this.keyedBy) {
        return { state: "corrupt", reason: `${t.branch} is keyed by ${String(manifest.keyedBy)}, not ${this.keyedBy}` };
      }
      return { state: "hit", branch: t.branch, tip: t.tip, tree };
    } catch (e) {
      return { state: "unknown", reason: String(e) };
    }
  }

  /** One file at the tip. A directory where a file was asked for is `corrupt`. */
  readFile(path: string): FileRead {
    const segs = segments(path);
    const v = this.verifiedTip();
    if (v.state !== "hit") return v;
    const e = this.lookup(v.tree, segs);
    if (!e) return { state: "miss", reason: `${path} is not on ${v.branch} at ${v.tip.slice(0, 12)}` };
    if (e.type !== "blob") return { state: "corrupt", reason: `${path} on ${v.branch} is a ${e.type}, not a file` };
    if (!this.ensureBlobs(v.tree, [e.sha])) return { state: "unknown", reason: `could not fetch ${path} from ${v.branch}` };
    return { state: "hit", branch: v.branch, tip: v.tip, path: segs.join("/"), blob: e.sha, text: this.catBlobs([e.sha]).get(e.sha)!.toString("utf-8") };
  }

  /**
   * A file at the tip WITHOUT verifying the branch is a state branch. Bean
   * `esz4`: a branch README describes every special branch, including the
   * commit-keyed `qa-reports`, which carries no `manifest.json` and so is
   * `corrupt` to {@link readFile}. Only the README generator calls this, and it
   * reads only the two root files that describe a branch.
   */
  readUnverified(path: string): FileRead {
    const segs = segments(path);
    const v = this.unverifiedTip();
    if (v.state !== "hit") return v;
    const e = this.lookup(v.tree, segs);
    if (!e) return { state: "miss", reason: `${path} is not on ${v.branch} at ${v.tip.slice(0, 12)}` };
    if (e.type !== "blob") return { state: "corrupt", reason: `${path} on ${v.branch} is a ${e.type}, not a file` };
    if (!this.ensureBlobs(v.tree, [e.sha])) return { state: "unknown", reason: `could not fetch ${path} from ${v.branch}` };
    return { state: "hit", branch: v.branch, tip: v.tip, path: segs.join("/"), blob: e.sha, text: this.catBlobs([e.sha]).get(e.sha)!.toString("utf-8") };
  }

  /** The tip and its tree, with no manifest check — {@link readUnverified} and a describing write only. */
  private unverifiedTip(): (Hit & { tree: string }) | NotHit {
    const t = this.fetchTip();
    if (t.state === "unknown") return { state: "unknown", reason: t.reason };
    if (t.state === "absent") return { state: "miss", reason: `${t.branch} does not exist` };
    return { state: "hit", branch: t.branch, tip: t.tip, tree: this.must(["rev-parse", `${t.tip}^{tree}`]).trim() };
  }

  /** {@link readFile}, parsed. Unparseable JSON is `corrupt`, never `miss`. */
  readJson<T = unknown>(path: string): JsonRead<T> {
    const r = this.readFile(path);
    if (r.state !== "hit") return r;
    try {
      const { text: _text, ...rest } = r;
      return { ...rest, value: JSON.parse(r.text) as T };
    } catch (e) {
      return { state: "corrupt", reason: `${path} on ${r.branch} does not parse: ${(e as Error).message}` };
    }
  }

  /** The entries of one directory at the tip (`""` is the root). A file where a directory was asked for is `corrupt`. */
  listDir(path: string): DirRead {
    const segs = segments(path);
    const v = this.verifiedTip();
    if (v.state !== "hit") return v;
    const e = segs.length ? this.lookup(v.tree, segs) : { mode: "040000", type: "tree", sha: v.tree, name: "" };
    if (!e) return { state: "miss", reason: `${path} is not on ${v.branch} at ${v.tip.slice(0, 12)}` };
    if (e.type !== "tree") return { state: "corrupt", reason: `${path} on ${v.branch} is a ${e.type}, not a directory` };
    const entries = this.lsTree(e.sha)
      .filter((x) => x.type === "blob" || x.type === "tree")
      .map((x) => ({ name: x.name, type: x.type as "blob" | "tree", sha: x.sha }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { state: "hit", branch: v.branch, tip: v.tip, path: segs.join("/"), entries };
  }

  /** Every file under `prefix` at the tip, fetched in one batch. Paths are branch-relative. Text only; see {@link readTreeEntries} for bytes. */
  readTree(prefix: string): TreeRead {
    const r = this.readTreeEntries(prefix);
    if (r.state !== "hit") return r;
    const files = new Map([...r.files].map(([p, f]) => [p, f.bytes.toString("utf-8")]));
    return { state: "hit", branch: r.branch, tip: r.tip, prefix: r.prefix, files };
  }

  /**
   * Every file under `prefix` at the tip as BYTES, with its blob id and mode.
   * What a mount needs: a binary file must arrive unchanged, and its blob id
   * is the `expect` a later push compares against.
   */
  readTreeEntries(prefix: string): TreeEntriesRead {
    const segs = segments(prefix);
    const v = this.verifiedTip();
    if (v.state !== "hit") return v;
    const e = segs.length ? this.lookup(v.tree, segs) : { mode: "040000", type: "tree", sha: v.tree, name: "" };
    if (!e) return { state: "miss", reason: `${prefix} is not on ${v.branch} at ${v.tip.slice(0, 12)}` };
    if (e.type !== "tree") return { state: "corrupt", reason: `${prefix} on ${v.branch} is a ${e.type}, not a directory` };
    const blobs = new Map<string, { sha: string; mode: string }>();
    for (const l of this.must(["ls-tree", "-r", "-z", e.sha]).split("\0").filter(Boolean)) {
      const tab = l.indexOf("\t");
      const [mode, type, sha] = l.slice(0, tab).split(" ");
      if (type === "blob") blobs.set([...segs, l.slice(tab + 1)].join("/"), { sha: sha!, mode: mode! });
    }
    const shas = [...new Set([...blobs.values()].map((b) => b.sha))];
    if (!this.ensureBlobs(e.sha, shas)) return { state: "unknown", reason: `some blobs under ${prefix} could not be fetched` };
    const bytes = this.catBlobs(shas);
    const files = new Map([...blobs].map(([p, b]) => [p, { blob: b.sha, mode: b.mode, bytes: bytes.get(b.sha)! }]));
    return { state: "hit", branch: v.branch, tip: v.tip, prefix: segs.join("/"), files };
  }

  // ── Writing ────────────────────────────────────────────────────────────

  /**
   * Splice `changes` onto the tip and push without `-f`, retried on a moved
   * tip. Every path not named is carried across untouched.
   *
   * - `absent` — the branch does not exist. Seeding one is a steward act
   *   (it carries the manifest), so this store never creates it.
   * - `unchanged` — the tip already holds exactly this content; nothing pushed.
   * - `conflict` — an `expect` disagreed with the tip; nothing pushed. A
   *   route-keyed store never returns this, because it refuses `expect`.
   * - `failed` — gave up after {@link WRITE_ATTEMPTS}, or the tip is not a state branch.
   *
   * ## A route-keyed write may not carry `expect` (bean `1j3q`)
   *
   * `expect` exists so that two authors editing one file is a `conflict` the
   * caller settles. A route-keyed entry has no author: it is a rendering of
   * the source tree, its one declared generator replaces it wholesale, and the
   * newer generation is simply right. Honouring an `expect` here would turn a
   * stale read into a blocked push over content nobody disagrees about.
   *
   * So it is REFUSED rather than ignored. Ignoring it would let a caller
   * believe it had the tip-keyed guarantee while getting last-write-wins,
   * which is the vacuous-pass shape — and an `expect` arriving here means the
   * caller thinks the page has two writers, i.e. the premise of route-keying
   * failing, which is worth a loud stop rather than a silent one.
   */
  write(changes: Change[], message: string, opts: { describe?: boolean } = {}): WriteResult {
    if (changes.length === 0) throw new BranchStoreUsageError("no changes to write");
    // BOTH route keyings refuse `expect`, and a family must not be forgotten
    // here: a member is a rendering exactly as a route is, so the premise that
    // makes `expect` meaningless is identical. Written as a set rather than as
    // `=== "route"` twice, so a fifth keying has to decide rather than default
    // to accepting an `expect` nobody meant.
    if (this.keyedBy === "route" || this.keyedBy === "route-family") {
      const withExpect = changes.filter((c) => c.expect !== undefined).map((c) => c.path);
      if (withExpect.length > 0) {
        throw new BranchStoreUsageError(
          `a ${this.keyedBy}-keyed write may not carry \`expect\` (${withExpect.join(", ")}): a rendered page has one writer and the newer generation wins. ` +
            `An \`expect\` here means the page has two writers — fix that rather than resolving a conflict.`,
        );
      }
    }
    const parsed = changes.map((c) => {
      const segs = segments(c.path);
      if (segs.length === 0) throw new BranchStoreUsageError("cannot write the branch root");
      // `describe` (bean `esz4`) lets the README generator replace README.md,
      // and nothing else: the manifest stays a steward's act, and a describing
      // write that touched content would be a content write under another name.
      const describesBranch = opts.describe === true && segs.length === 1 && segs[0] === "README.md";
      if (opts.describe === true && !describesBranch) throw new BranchStoreUsageError(`a describing write may touch README.md only, not ${segs.join("/")}`);
      if (segs.length === 1 && RESERVED.has(segs[0]!) && !describesBranch) throw new BranchStoreUsageError(`${segs[0]} describes the branch; a write may not touch it`);
      return { ...c, segs };
    });
    const seen = new Set<string>();
    for (const c of parsed) {
      const k = c.segs.join("/");
      if (seen.has(k)) throw new BranchStoreUsageError(`${k} is named twice in one write`);
      seen.add(k);
    }
    // Hash once: the blob ids do not depend on the tip.
    const blobs = parsed.map((c) => (c.content === null ? undefined : this.must(["hash-object", "-w", "--stdin"], { input: c.content }).trim()));

    let lastReason = "";
    for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt++) {
      // A describing write reads the tip unverified: the commit-keyed QA
      // branch carries no manifest, and it is owed a README too (bean `esz4`).
      const v = opts.describe === true ? this.unverifiedTip() : this.verifiedTip();
      if (v.state === "miss") return { state: "absent", reason: v.reason, branch: this.branch, attempts: attempt };
      if (v.state === "corrupt") return { state: "failed", reason: v.reason, branch: this.branch, attempts: attempt };
      if (v.state !== "hit") {
        lastReason = v.reason;
      } else {
        const conflicts: NonNullable<WriteResult["conflicts"]> = [];
        let tree: string = v.tree;
        parsed.forEach((c, i) => {
          const cur = this.lookup(v.tree, c.segs);
          const actual = cur ? cur.sha : null;
          if (c.expect !== undefined && c.expect !== actual) conflicts.push({ path: c.segs.join("/"), expected: c.expect, actual });
          const blob = blobs[i];
          tree = this.setPath(tree, c.segs, blob ? { mode: c.mode ?? "100644", type: "blob", sha: blob, name: "" } : undefined) ?? this.mktree([]);
        });
        if (conflicts.length) {
          return { state: "conflict", reason: `${conflicts.length} path(s) changed on ${v.branch} since they were read`, branch: v.branch, attempts: attempt, conflicts };
        }
        if (tree === v.tree) return { state: "unchanged", reason: `${v.branch} already holds this content`, branch: v.branch, attempts: attempt };
        // --no-gpg-sign: the branch is written as the bot; a contributor's
        // `commit.gpgSign` must not put their key on the bot's commit.
        const commit = this.must(["commit-tree", "--no-gpg-sign", tree, "-p", v.tip, "-m", message]).trim();
        this.beforePush?.(attempt);
        // NO -f: a non-fast-forward is rejected by the server's ref lock and
        // we rebuild on what landed. The exit code is the verdict.
        const push = this.git(["-c", "pack.useSparse=false", "push", "-q", "origin", `${commit}:refs/heads/${v.branch}`]);
        if (push.status === 0) return { state: "pushed", reason: `pushed on attempt ${attempt}`, branch: v.branch, commit, attempts: attempt };
        lastReason = push.stderr
          .split("\n")
          .filter((l) => l.trim() && !/push negotiation failed|expected 'acknowledgments'/.test(l))
          .join(" | ");
      }
      if (attempt < WRITE_ATTEMPTS) {
        const ms = waitFor(attempt, PUSH_BASE_MS, PUSH_CAP_MS);
        this.log(`branch-store: attempt ${attempt} on ${this.branch} did not land (${lastReason}); retrying in ${ms} ms`);
        this.sleep(ms);
      }
    }
    return { state: "failed", reason: `gave up after ${WRITE_ATTEMPTS} attempts: ${lastReason}`, branch: this.branch, attempts: WRITE_ATTEMPTS };
  }
}

// ── Mounts: one live copy at a local path, and the push back ─────────────
//
// Owner ruling 2026-10-03 (bean 2h76, relayed for 9c7h): ONE generic pair,
// keyed by directory id, for beans, todos and fsh-guts alike. A mount puts the
// tip's files where readers look, so a reader that walks a directory keeps
// working unchanged; a push splices the local edits back with `expect` taken
// from the mounted tip, so a sibling's edit to the same file is a `conflict`
// and never an overwrite. This replaces 2h76's single `state/` mount.
//
// The marker lives in the GIT directory, not the mount: a reader that walks
// the mount (gen-fsh-guts-viz walks every file) must not find it.

export const MOUNT_MARKER_SCHEMA = "branch-mount/v1";

/**
 * The blob id git gives `bytes`: SHA-1 of `"blob <len>\0" + bytes`. Computed
 * in-process, because a beans mount is ~1,240 files and one `git hash-object`
 * per file is that many process spawns per push (review on #1957). A
 * SHA-256 object-format repository is not supported here, which is also true
 * of every other tool in this harness.
 */
export function gitBlobId(bytes: Buffer): string {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

export interface MountMarker {
  $schema: typeof MOUNT_MARKER_SCHEMA;
  id: string;
  /** The file this marker is kept in, when it is not `<id>.json` — see {@link TipLocation.key}. */
  key?: string;
  branch: string;
  /** The declared, repository-relative path of the directory in this checkout. */
  path: string;
  /** The directory's path ON THE BRANCH, when it differs from `path` (see {@link TipLocation.branchPath}). */
  branchPath?: string;
  /** The repository the branch was read from, when it is not this checkout's `origin` (see {@link TipLocation.repository}). */
  repository?: string;
  /** The checkout-relative local mount path (legacy markers may hold an in-repo absolute path until next mount). */
  into: string;
  /**
   * The tip the files on disk were read at. A push does NOT move it: a push
   * that retried over a moved tip lands on top of siblings' changes to other
   * files, which this mount has not read. A re-mount is how to catch up.
   */
  tip: string;
  /** The commit the last successful push created, for the record. */
  lastPush?: string;
  /** Mount-relative path → the blob id and mode it had at `tip`. */
  files: Record<string, { blob: string; mode: string }>;
}

export interface MountOptions {
  /** The checkout root. Default: `git rev-parse --show-toplevel`. */
  repoRoot?: string;
  /** Where to mount. Default: the declared path, so readers find it where the directory used to be. */
  into?: string;
  /** Passed to {@link BranchStore.open}. */
  store?: BranchStoreOptions;
}

export type MountResult =
  | { state: "mounted"; into: string; tip: string; branch: string; files: number }
  | { state: "refused"; reason: string }
  | NotHit;

export type PushResult = WriteResult | { state: "refused"; reason: string };

/**
 * Resolve a marker's `into` against `repoRoot`, refusing any path that resolves
 * outside `repoRoot` (or to `repoRoot` itself). Bean `1ple`: a copied checkout
 * carrying an old absolute marker must never follow `into` back into the
 * original checkout.
 */
export function resolveMarkerInto(
  repoRoot: string,
  m: Pick<MountMarker, "id" | "key" | "into">,
): { ok: true; abs: string; rel: string } | { ok: false; reason: string } {
  const root = resolve(repoRoot);
  const abs = resolve(root, m.into);
  const rel = relative(root, abs).split(sep).join("/");
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    return {
      ok: false,
      reason: `marker for ${m.key ?? m.id} points at ${m.into}, outside this checkout (${root})`,
    };
  }
  return { ok: true, abs, rel };
}

/**
 * The PER-WORKTREE git directory. Not `--git-common-dir`: that one is shared
 * by every linked worktree of a checkout, so two worktrees mounting the same
 * id would overwrite each other's marker, and one could push the other's
 * edits (review on #1957). Agents here work in worktrees all the time.
 */
function worktreeGitDir(repoRoot: string): string {
  // input-site: store #b6ada2f5 — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
  const c = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-dir"], { cwd: repoRoot, encoding: "utf-8" });
  if (c.status !== 0) throw new BranchStoreUsageError(`cannot find the git directory of ${repoRoot}`);
  return c.stdout.trim();
}

/**
 * When `repoRoot` is a copied linked worktree whose `.git` file still points at
 * another existing checkout's git directory, return that other checkout's root.
 */
function sharedGitDirOwner(repoRoot: string): string | undefined {
  const dotGit = join(repoRoot, ".git");
  if (!existsSync(dotGit) || !lstatSync(dotGit).isFile()) return undefined;
  const raw = readFileSync(dotGit, "utf-8").trim();
  if (!raw.startsWith("gitdir:")) return undefined;
  const gitDir = resolve(repoRoot, raw.replace(/^gitdir:\s*/, ""));
  const gitdirFile = join(gitDir, "gitdir");
  let owner: string | undefined;
  if (existsSync(gitdirFile)) {
    owner = dirname(resolve(gitDir, readFileSync(gitdirFile, "utf-8").trim()));
  } else if (gitDir.endsWith(`${sep}.git`)) {
    owner = dirname(gitDir);
  }
  if (owner && existsSync(owner) && realpathSync(owner) !== realpathSync(repoRoot)) return owner;
  return undefined;
}

/**
 * Where the marker filed under `key` lives: `<this worktree's git-dir>/branch-mounts/<key>.json`.
 * The key is a directory id, or `<instance>.<id>` for an id several layers
 * declare ({@link TipLocation.key}).
 */
export function markerPath(repoRoot: string, key: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(key)) throw new BranchStoreUsageError(`not a directory id: ${key}`);
  return join(worktreeGitDir(repoRoot), "branch-mounts", `${key}.json`);
}

/**
 * Why a marker is read: `location` when the caller uses only where the mount
 * lives ({@link MountMarker}'s `$schema`, `id`, `key`, `path` and `into`), which
 * a recorded writer is then keyed on instead of the whole marker
 * (`read-projections.ts`: the marker lists a blob per file, so it moves with
 * every edit to the mount).
 */
export type MarkerUse = "location";

function readMarkerFile(p: string, use?: MarkerUse): MountMarker {
  if (use === "location") projectedRead(p, "mount-location");
  const m = JSON.parse(readFileSync(p, "utf-8")) as MountMarker;
  if (m.$schema !== MOUNT_MARKER_SCHEMA) throw new BranchStoreUsageError(`${p} is not a ${MOUNT_MARKER_SCHEMA} marker`);
  return m;
}

/**
 * The marker filed under `key` — a directory id, or a location key. When no
 * file has that name and `key` is a bare id, the one marker whose `id` it is
 * answers (a graph whose id is shared is filed under `<instance>.<id>`, and a
 * caller holding only the id still finds it while it is the only one mounted).
 * Several is ambiguous and refused, never resolved by picking one.
 */
export function readMarker(repoRoot: string, key: string, use?: MarkerUse): MountMarker | undefined {
  const p = markerPath(repoRoot, key);
  if (existsSync(p)) return readMarkerFile(p, use);
  const same = allMarkers(repoRoot, use).filter(({ marker }) => marker.id === key);
  if (same.length > 1) {
    throw new BranchStoreUsageError(`${same.length} mounts have id ${key} (${same.map(({ file }) => file).join(", ")}); name one by its key`);
  }
  return same[0]?.marker;
}

/** Every readable marker in this worktree, with the key it is filed under. Unreadable ones are skipped. */
function allMarkers(repoRoot: string, use?: MarkerUse): Array<{ file: string; marker: MountMarker }> {
  const dir = dirname(markerPath(repoRoot, "x"));
  if (!existsSync(dir)) return [];
  const out: Array<{ file: string; marker: MountMarker }> = [];
  for (const n of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    try {
      out.push({ file: n.slice(0, -".json".length), marker: readMarkerFile(join(dir, n), use) });
    } catch {
      // Not ours to judge here: `readMarker` by its name reports it.
    }
  }
  return out;
}

/**
 * The marker of one LOCATION: the file its key names, else a marker for the
 * same declared path under any other name.
 *
 * The second half is what keeps a marker written before {@link TipLocation.key}
 * existed from stranding its edits: in an index, cat-harness's `health` was
 * mounted as `health.json`, and the location is now keyed
 * `cat-harness.health`. Matching on the PATH, never on the id, is what keeps
 * another layer's `health` from adopting cat-harness's marker.
 */
export function markerFor(repoRoot: string, loc: Pick<TipLocation, "id" | "key" | "path">): MountMarker | undefined {
  const key = locationKey(loc);
  const p = markerPath(repoRoot, key);
  if (existsSync(p)) return readMarkerFile(p);
  return markerAtPath(repoRoot, loc.path);
}

/** The marker of whatever is mounted for the declared, repository-relative `path`, under any key. */
export function markerAtPath(repoRoot: string, path: string, use?: MarkerUse): MountMarker | undefined {
  const want = path.replace(/^\/+|\/+$/g, "");
  return allMarkers(repoRoot, use).find(({ marker }) => marker.path === want)?.marker;
}

/**
 * A graph `state-mount` determined ABSENT from this checkout (bean `x5e0`).
 *
 * `absent` (owner, 2026-10-14: "Report as absent") is decided only at mount
 * time, by asking the remote whether it carries the graph's namespace; a
 * reader runs offline and cannot ask again. Without a record it sees the same
 * empty path as a graph nobody mounted, and reports "could not determine" for
 * a graph that is, determinably, not this checkout's. The record is that
 * answer, kept beside the mount markers in this worktree's git-dir and never
 * committed. It is named `<key>.absent`, not `.json`, so `mountedIds` and
 * `allMarkers` never read it as a mount.
 */
export interface AbsenceRecord {
  $schema: typeof ABSENCE_RECORD_SCHEMA;
  id: string;
  key: string;
  /** The declared, repository-relative path. */
  path: string;
  /** The mounted layer that declared the graph. */
  declaredBy: string;
  /** The remote it was judged absent against; a different origin is a different question. */
  origin: string;
  reason: string;
}

export const ABSENCE_RECORD_SCHEMA = "cat-harness/branch-absence/v1";

function absencePath(repoRoot: string, key: string): string {
  return markerPath(repoRoot, key).replace(/\.json$/, ".absent");
}

/**
 * The checkout's `origin` as configured, normalised, or `""` when it has
 * none. One remote has several spellings: CI's state-mount step rewrites
 * `origin` to its `.git` form for the mount and puts it back after, so a
 * record made during the mount must still match the reader's origin. A
 * trailing `.git` and `/` are not part of which repository it is.
 */
export function originUrl(repoRoot: string): string {
  // The CONFIGURED url, not `git remote get-url`: that applies `insteadOf`,
  // and CI's mount runs under a rewrite of GitHub to local mirrors
  // (layer-pr-checks' state-pin.sh), so the record would name a mirror path
  // no reader outside that step ever sees.
  // input-site: store #84832698 — configures a branch-store read: which absence records answer for this checkout's origin; the read itself goes through TreeStore.git(), which is traced
  const r = spawnSync("git", ["config", "--get", "remote.origin.url"], { cwd: repoRoot, encoding: "utf-8" });
  return r.status === 0 ? normaliseOrigin(r.stdout) : "";
}

/** `https://host/o/r.git/` and `https://host/o/r` are one remote. */
export function normaliseOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/\.git$/, "");
}

/** Record `loc` as determined absent from this checkout. */
export function recordAbsence(repoRoot: string, loc: Pick<TipLocation, "id" | "key" | "path">, declaredBy: string, reason: string): void {
  const key = locationKey(loc);
  const rec: AbsenceRecord = { $schema: ABSENCE_RECORD_SCHEMA, id: loc.id, key, path: loc.path.replace(/^\/+|\/+$/g, ""), declaredBy, origin: originUrl(repoRoot), reason };
  const p = absencePath(repoRoot, key);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(rec, null, 2) + "\n");
}

/** Forget any absence recorded for `loc`: every mount attempt asks the question afresh. */
export function clearAbsence(repoRoot: string, loc: Pick<TipLocation, "id" | "key">): void {
  rmSync(absencePath(repoRoot, locationKey(loc)), { force: true });
}

/**
 * The absence recorded for the declared `path` (or, failing that, a bare `id`),
 * when it was judged against THIS checkout's current origin. A record made
 * against another origin answers nothing: the question was about that remote.
 */
export function absenceAt(repoRoot: string, path: string, id?: string): AbsenceRecord | undefined {
  // No git directory (a standalone rehearsal's copy) means no mount has run
  // here, so nothing was recorded: the reader's own not-mounted answer stands.
  let dir: string;
  try {
    dir = dirname(markerPath(repoRoot, "x"));
  } catch {
    return undefined;
  }
  if (!existsSync(dir)) return undefined;
  const want = path.replace(/^\/+|\/+$/g, "");
  const origin = originUrl(repoRoot);
  let byId: AbsenceRecord | undefined;
  for (const n of readdirSync(dir).filter((f) => f.endsWith(".absent")).sort()) {
    let rec: AbsenceRecord;
    try {
      rec = JSON.parse(readFileSync(join(dir, n), "utf-8")) as AbsenceRecord;
    } catch {
      continue;
    }
    if (rec.$schema !== ABSENCE_RECORD_SCHEMA || normaliseOrigin(rec.origin) !== origin) continue;
    if (rec.path === want) return rec;
    if (id !== undefined && rec.id === id) byId ??= rec;
  }
  return byId;
}

/** The keys mounted in THIS worktree, one marker each — what `state:push` sends, declared or not. */
export function mountedIds(repoRoot: string = gitTopLevel()): string[] {
  const dir = dirname(markerPath(repoRoot, "x"));
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -".json".length)).sort();
}

function writeMarker(repoRoot: string, m: MountMarker): void {
  const resolved = resolveMarkerInto(repoRoot, m);
  if (!resolved.ok) throw new BranchStoreUsageError(resolved.reason);
  const p = markerPath(repoRoot, m.key ?? m.id);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...m, into: resolved.rel }, null, 2) + "\n");
}

/**
 * Migrate an in-repo absolute `into` on `m` to checkout-relative on disk (bean `1ple`).
 * Returns `m` with its checkout-relative `into`.
 */
export function migrateMarkerInto(repoRoot: string, m: MountMarker): MountMarker {
  if (!isAbsolute(m.into) || sharedGitDirOwner(repoRoot) !== undefined) return m;
  const resolved = resolveMarkerInto(repoRoot, m);
  if (!resolved.ok) return m;
  const next = { ...m, into: resolved.rel };
  writeMarker(repoRoot, next);
  return next;
}

/**
 * The options that open the store a location is kept in. A location kept in
 * ANOTHER repository ({@link TipLocation.repository}) is fetched from that
 * repository — unless the caller named a remote outright (`remote`, or
 * `BRANCH_STORE_REMOTE`), which still means "this remote, for everything".
 * Its objects go in a bare store of their own, so two repositories' branches
 * of the same name never share one private store's `origin`.
 */
export function storeOptionsFor(
  loc: { repository?: string },
  repoRoot: string,
  base: BranchStoreOptions = {},
): BranchStoreOptions {
  // input-site: store #d45e3da7 — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
  if (!loc.repository || base.remote || process.env.BRANCH_STORE_REMOTE) return base;
  const remote = (base.urlFor ?? githubUrlFor)(loc.repository);
  // input-site: store #60dfed75 — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
  let storeDir = base.storeDir ?? process.env.BRANCH_STORE_DIR;
  if (!storeDir) {
    // input-site: store #f48bd6b7 — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
    const c = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repoRoot, encoding: "utf-8" });
    if (c.status !== 0) throw new BranchStoreUsageError(`cannot find the git directory of ${repoRoot}`);
    storeDir = join(c.stdout.trim(), "branch-store", `${loc.repository.replace(/[^A-Za-z0-9._-]+/g, "__")}.git`);
  }
  return { ...base, remote, storeDir };
}

/**
 * Whether the remote a location is read from carries ANY branch in that
 * location's branch namespace (`cat/cat-harness/` for
 * `cat/cat-harness/issue-marks`), the location's own branch included.
 *
 * The signal behind an unowned graph's `absent` ({@link TipLocation.unownedBy};
 * owner, 2026-10-14, cat-harness-tools#249: "Tighten it"). A checkout whose
 * remote keeps a declaring layer's state branches has adopted that
 * layer's namespace for its own state (folio-assistant carries
 * `cat/cat-harness/{beans,todos,issue-marks,fsh-guts,...}`), so one of them
 * going missing there is a failure. A checkout whose remote has no branch in
 * the namespace (smart-ra) never carried it, and the graph is absent. Whether
 * the DECLARING repository has the branch cannot tell those two apart:
 * litlfred/cat-harness carries it in both cases.
 *
 * A PUBLICATION branch is not adoption ({@link publicationBranches}). CI
 * writes `cat/cat-harness/qa-reports` (commit-keyed) on every root that runs
 * the gates, a FHIR IG site included, so counting it made every unowned graph
 * of the namespace a failed mount there instead of absent, and every bean gate
 * exited 2 rather than 78 (a FHIR IG judged with no base, 2026-11-19). Only a branch kept
 * at a tip, the way adopted state is, says the checkout keeps the namespace.
 *
 * `unknown` when ls-remote could not answer: never read as "not carried".
 */
export function namespaceCarried(
  loc: Pick<TipLocation, "branch" | "repository">,
  repoRoot: string,
  store?: BranchStoreOptions,
  publications?: ReadonlySet<string>,
): { state: "carried"; branches: string[] } | { state: "not-carried"; namespace: string } | { state: "unknown"; reason: string } {
  const slash = loc.branch.lastIndexOf("/");
  const namespace = slash > 0 ? loc.branch.slice(0, slash + 1) : loc.branch;
  const s = BranchStore.open(loc.branch, { repoRoot, ...storeOptionsFor(loc, repoRoot, store) });
  const pattern = slash > 0 ? `refs/heads/${namespace}*` : `refs/heads/${loc.branch}`;
  const ls = s.git(["ls-remote", "--heads", "origin", pattern]);
  if (ls.status !== 0) return { state: "unknown", reason: `ls-remote failed: ${ls.stderr.trim()}` };
  let branches = ls.stdout
    .toString()
    .split("\n")
    .map((l) => l.split("\t")[1]?.trim().replace(/^refs\/heads\//, ""))
    .filter((b): b is string => Boolean(b));
  // Asked only when the remote HAS branches here: a checkout with none (smart-ra)
  // pays nothing for resolving every declaration.
  if (branches.length > 0) {
    const pub = publications ?? publicationBranches(repoRoot);
    branches = branches.filter((b) => !pub.has(b));
  }
  return branches.length ? { state: "carried", branches } : { state: "not-carried", namespace };
}

const publicationCache = new Map<string, ReadonlySet<string>>();

/**
 * The branches a declaration keeps PUBLISHED output on rather than state: every
 * declared directory whose branch is keyed by anything but `tip` (`commit`, as
 * `qa` on `cat/cat-harness/qa-reports`; `route` and `route-family`, as a site).
 * CI writes them wherever it runs, so their presence on a remote says nothing
 * about which state namespaces that checkout adopted ({@link namespaceCarried}).
 * Read from the declarations, never a list of names, and cached per root:
 * resolving every directory of an index is not free.
 */
export function publicationBranches(repoRoot: string): ReadonlySet<string> {
  const key = resolve(repoRoot);
  const hit = publicationCache.get(key);
  if (hit) return hit;
  const out = new Set<string>();
  for (const inst of layerRootsIn(repoRoot)) {
    let overrides: SubgraphSourceOverrides | undefined;
    const overridesOf = (): SubgraphSourceOverrides => (overrides ??= subgraphSourceOverrides(inst, repoRoot));
    for (const d of resolveDirectories([{ name: "(local)", root: inst, own: true }])) {
      let at: ReturnType<typeof keptAt>;
      try {
        at = keptAt(inst, repoRoot, d, overridesOf);
      } catch {
        continue; // a source the resolver refuses is reported where it is mounted, not here
      }
      if (at && at.keyedBy !== "tip" && at.keyedBy !== "family") out.add(at.branch);
    }
  }
  publicationCache.set(key, out);
  return out;
}

/**
 * Every file AND symlink under `dir`, mount-relative with `/` separators.
 * Symlinks are leaves, never followed (`lstat`): a link to a directory is
 * not walked twice or outside the mount, and it round-trips as a link.
 */
function walkFiles(dir: string, base = dir, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = lstatSync(abs);
    if (st.isSymbolicLink() || st.isFile()) out.push(relative(base, abs).split(sep).join("/"));
    else if (st.isDirectory()) walkFiles(abs, base, out);
  }
  return out.sort();
}

/** A local file's git content and mode: a symlink is its target, mode 120000. */
function localEntry(abs: string): { bytes: Buffer; mode: "100644" | "100755" | "120000" } {
  const st = lstatSync(abs);
  if (st.isSymbolicLink()) return { bytes: Buffer.from(readlinkSync(abs)), mode: "120000" };
  return { bytes: readFileSync(abs), mode: (st.mode & 0o111) !== 0 ? "100755" : "100644" };
}

/** The local edits since the mount: what a push would send. */
function localChanges(m: MountMarker, repoRoot: string): Change[] {
  const resolved = resolveMarkerInto(repoRoot, m);
  if (!resolved.ok) throw new BranchStoreUsageError(resolved.reason);
  const into = resolved.abs;
  const onBranch = m.branchPath ?? m.path;
  const local = new Set(walkFiles(into));
  const changes: Change[] = [];
  const fresh = [...local].filter((r) => !m.files[r]);
  const ignored = ignoredByCheckout(repoRoot, into, fresh);
  for (const rel of local) {
    if (!m.files[rel] && ignored.has(rel)) continue;
    const { bytes, mode } = localEntry(join(into, rel));
    const prev = m.files[rel];
    if (prev && prev.blob === gitBlobId(bytes) && prev.mode === mode) continue;
    changes.push({ path: `${onBranch}/${rel}`, content: bytes, expect: prev ? prev.blob : null, mode });
  }
  for (const [rel, prev] of Object.entries(m.files)) {
    if (!local.has(rel)) changes.push({ path: `${onBranch}/${rel}`, content: null, expect: prev.blob });
  }
  return changes;
}

/**
 * Mount-relative paths among `rels` that the CHECKOUT ignores by a rule
 * other than one ignoring the mount root itself. A mount honours the
 * checkout's ignore rules for its contents (fsh-guts/logs/ is local scratch
 * and must never be pushed), while the rule that hides the whole mount from
 * `main` after the cutover does not make every file in it unpushable.
 */
function ignoredByCheckout(repoRoot: string, into: string, rels: string[]): Set<string> {
  const out = new Set<string>();
  const root = relative(repoRoot, into).split(sep).join("/");
  if (!rels.length || root.startsWith("..")) return out;
  const input = rels.map((r) => `${root}/${r}`).join("\n") + "\n";
  // input-site: store #24f29a9a — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
  const r = spawnSync("git", ["check-ignore", "-v", "--no-index", "--stdin"], { cwd: repoRoot, input, encoding: "utf-8" });
  for (const line of (r.stdout ?? "").split("\n").filter(Boolean)) {
    const tab = line.indexOf("\t");
    const pattern = line.slice(0, tab).split(":").slice(2).join(":").replace(/^\/+|\/+$/g, "");
    const path = line.slice(tab + 1);
    if (pattern === root || pattern === `${root}/*` || pattern === `${root}/**`) continue;
    out.add(path.slice(root.length + 1));
  }
  return out;
}

/**
 * Put the tip's copy of `loc` at a local path. Refuses rather than clobbers:
 * a directory `main` still tracks (the cutover has not happened), a non-empty
 * directory that is not a mount, and a mount with unpushed edits. A miss is
 * reported as a miss, never as an empty mount.
 */
export function mountTip(loc: TipLocation, opts: MountOptions = {}): MountResult {
  if (loc.keyedBy !== "tip") {
    return { state: "refused", reason: `directory ${loc.id} is keyed by ${loc.keyedBy}, not tip; mounting is a tip operation` };
  }
  const repoRoot = opts.repoRoot ?? gitTopLevel();
  const into = resolve(repoRoot, opts.into ?? loc.path);
  const relInto = relative(resolve(repoRoot), into).split(sep).join("/");
  if (relInto === "" || relInto.startsWith("..") || isAbsolute(relInto)) {
    return { state: "refused", reason: `mount path ${opts.into ?? loc.path} resolves to ${into}, outside repository root ${repoRoot}` };
  }
  {
    // input-site: store #6bf16bae — configures a branch-store read; the read itself goes through TreeStore.git(), which is traced
    const tracked = spawnSync("git", ["ls-files", "--", relInto || "."], { cwd: repoRoot, encoding: "utf-8" });
    if (tracked.status === 0 && tracked.stdout.trim()) {
      return { state: "refused", reason: `${relInto} is still tracked on this checkout's branch, so ${loc.id} has not been cut over to ${loc.branch}; mount it elsewhere with --into` };
    }
  }
  const store = BranchStore.open(loc.branch, { repoRoot, ...storeOptionsFor(loc, repoRoot, opts.store) });
  const prior = markerFor(repoRoot, loc);
  // A marker lives in the per-worktree git directory, but a COPY of a linked
  // worktree shares that directory: its `.git` file names the same one.
  const sharedOwner = prior ? sharedGitDirOwner(repoRoot) : undefined;
  if (prior && sharedOwner !== undefined && existsSync(resolve(sharedOwner, prior.into))) {
    return {
      state: "refused",
      reason:
        `this worktree's marker for ${loc.id} records its mount in ${sharedOwner}, not ${into}: another checkout shares this git directory ` +
        `(a copied linked worktree). Mounting here would delete that checkout's files; mount from there, or make this checkout its own worktree (\`git worktree add\`)`,
    };
  }
  let priorAbsInto: string | undefined;
  if (prior) {
    const resolvedPrior = resolveMarkerInto(repoRoot, prior);
    if (!resolvedPrior.ok) {
      return { state: "refused", reason: resolvedPrior.reason };
    }
    priorAbsInto = resolvedPrior.abs;
    if (priorAbsInto !== into && existsSync(priorAbsInto)) {
      return {
        state: "refused",
        reason:
          `this worktree's marker for ${loc.id} records its mount at ${prior.into}, not ${relInto}: another mount path is still on disk. ` +
          `Mounting here would delete those files`,
      };
    }
    const pending = localChanges(prior, repoRoot);
    // A mount that is GONE — every file deleted, nothing written — holds no
    // edit to lose: re-mounting it is the remedy `emptyingReason` names, so it
    // is not refused as "unpushed changes".
    if (pending.length && !emptyingReason(prior, pending, repoRoot)) {
      migrateMarkerInto(repoRoot, prior);
      return { state: "refused", reason: `${prior.into} has ${pending.length} unpushed change(s); push or discard them before re-mounting` };
    }
  } else if (existsSync(into)) {
    // Files the checkout itself ignores are local scratch, not a competing
    // copy: `fsh-guts/logs/` is written by the log writer whether or not the
    // trashcan is mounted, and a first mount must not be refused over them
    // (bean `9c7h`). They are left exactly where they are.
    const present = walkFiles(into);
    const ignored = ignoredByCheckout(repoRoot, into, present);
    const competing = present.filter((rel) => !ignored.has(rel));
    if (competing.length) return { state: "refused", reason: `${into} holds ${competing.length} file(s) and is not a mount of ${loc.id}` };
  }
  const onBranch = branchPathOf(loc);
  const r = store.readTreeEntries(onBranch);
  if (r.state !== "hit") return r;
  if (prior && priorAbsInto) for (const rel of Object.keys(prior.files)) rmSync(join(priorAbsInto, rel), { force: true });
  const unsupported = [...r.files].filter(([, f]) => !["100644", "100755", "120000"].includes(f.mode));
  if (unsupported.length) return { state: "corrupt", reason: `${unsupported[0]![0]} has mode ${unsupported[0]![1].mode}, which a mount cannot hold` };
  const files: MountMarker["files"] = {};
  for (const [p, f] of r.files) {
    const rel = p.slice(onBranch.length + 1);
    const abs = join(into, rel);
    mkdirSync(dirname(abs), { recursive: true });
    if (f.mode === "120000") {
      symlinkSync(f.bytes.toString("utf-8"), abs);
    } else {
      writeFileSync(abs, f.bytes);
      chmodSync(abs, f.mode === "100755" ? 0o755 : 0o644);
    }
    files[rel] = { blob: f.blob, mode: f.mode };
  }
  const key = locationKey(loc);
  writeMarker(repoRoot, {
    $schema: MOUNT_MARKER_SCHEMA,
    id: loc.id,
    ...(key !== loc.id ? { key } : {}),
    branch: r.branch,
    path: loc.path,
    ...(onBranch !== loc.path ? { branchPath: onBranch } : {}),
    // Recorded only when the store was really opened on it (no remote override), so a push goes back where the read came from.
    // input-site: store #db8f72f8 — records which remote the branch-store read used; the read itself goes through TreeStore.git(), which is traced
    ...(loc.repository && !opts.store?.remote && !process.env.BRANCH_STORE_REMOTE ? { repository: loc.repository } : {}),
    into: relInto,
    tip: r.tip,
    files,
  });
  // A marker read under another name (written before the location was keyed)
  // is replaced by the one just written, never left beside it: two markers for
  // one mount would push its edits twice.
  if (prior && (prior.key ?? prior.id) !== key) rmSync(markerPath(repoRoot, prior.key ?? prior.id), { force: true });
  return { state: "mounted", into, tip: r.tip, branch: r.branch, files: r.files.size };
}

/**
 * What a push of `id` would send, without sending it — {@link localChanges}
 * for a mounted directory, or `undefined` when `id` is not mounted here.
 *
 * Exported for the `--dry-run` of a caller that fans out over several
 * mounts (`state-push.ts`): the alternative is each such caller re-deriving
 * the diff from the marker, and a second implementation of "what changed"
 * is how a dry run comes to disagree with the push it is previewing.
 */
export function pendingMountChanges(id: string | TipLocation, opts: MountOptions = {}): Change[] | undefined {
  const repoRoot = opts.repoRoot ?? gitTopLevel();
  const m = typeof id === "string" ? readMarker(repoRoot, id) : markerFor(repoRoot, id);
  return m ? localChanges(m, repoRoot) : undefined;
}

/**
 * Why `changes` must not be sent for the mount `m`: they delete EVERY file the
 * mount was read with and write nothing, or `undefined` when they do not.
 *
 * A push like that leaves the declared path absent on the branch, which
 * {@link mountTip} reports as a `miss` — so every later `state:mount`, and the
 * publish builds that run it, fails. It is also what a mount that is GONE
 * looks like: {@link walkFiles} finds nothing under an absent directory, so a
 * mount deleted from under its marker (a layer re-laid over it, a cleaned
 * worktree) reads as "the editor deleted every file". On 2026-10-15 one bare
 * `state:push` from such a checkout emptied five graphs on four repositories
 * at once (cat-harness-tools `2fba7961c0cb`, cat-harness `294128d08c45`, …),
 * and the docs site stopped publishing.
 *
 * A miss is never an empty mount on the way in; an empty mount is never a
 * deletion of the graph on the way out. Retiring a graph is a steward act on
 * its branch, not an edit.
 */
export function emptyingReason(m: MountMarker, changes: readonly Change[], repoRoot?: string): string | undefined {
  const recorded = Object.keys(m.files).length;
  if (recorded === 0 || changes.some((c) => c.content !== null)) return undefined;
  if (changes.length < recorded) return undefined;
  const absInto = repoRoot ? resolve(repoRoot, m.into) : m.into;
  const why = existsSync(absInto) ? `${m.into} holds no files` : `${m.into} does not exist`;
  return (
    `${why}, so this push would delete all ${recorded} file(s) of ${m.key ?? m.id} on ${m.branch} and leave ` +
    `${m.branchPath ?? m.path} absent there, which every later \`state:mount\` reports as a miss. Nothing was sent. ` +
    `If the mount was removed from under its marker, re-mount it (\`bun run cat state:mount\`); retiring a graph is a steward act on its branch, not a push`
  );
}

/**
 * {@link emptyingReason} for a mounted location, or `undefined` when it is
 * not mounted or its pending changes do not empty it. For a `--dry-run` that
 * must refuse what the push would refuse.
 */
export function mountEmptyingReason(id: string | TipLocation, opts: MountOptions = {}): string | undefined {
  const repoRoot = opts.repoRoot ?? gitTopLevel();
  const m = typeof id === "string" ? readMarker(repoRoot, id) : markerFor(repoRoot, id);
  return m ? emptyingReason(m, localChanges(m, repoRoot), repoRoot) : undefined;
}

/**
 * Why `changes` look like a damaged mount rather than an ordinary edit: more
 * than half of the mounted tip's files are deleted (bean `1ple`).
 */
export function massDeletionReason(m: MountMarker, changes: readonly Change[]): string | undefined {
  const recorded = Object.keys(m.files).length;
  if (recorded < 2) return undefined;
  const deleted = changes.filter((c) => c.content === null).length;
  const written = changes.filter((c) => c.content !== null).length;
  if (deleted * 2 <= recorded || (deleted - written) * 2 <= recorded) return undefined;
  return (
    `${deleted} of ${recorded} file(s) (>50% of the tip) under ${m.into} are deleted locally; ` +
    `if the mount is damaged, re-mount it (\`rm -rf ${m.path} && bun run cat state:mount\`), ` +
    `or pass \`--allow-mass-delete\` to \`state:push\` if deleting ${deleted} file(s) is meant`
  );
}

/** {@link massDeletionReason} for a mounted location, or `undefined`. */
export function mountMassDeletionReason(id: string | TipLocation, opts: MountOptions = {}): string | undefined {
  const repoRoot = opts.repoRoot ?? gitTopLevel();
  const m = typeof id === "string" ? readMarker(repoRoot, id) : markerFor(repoRoot, id);
  return m ? massDeletionReason(m, localChanges(m, repoRoot)) : undefined;
}

/**
 * Where a declared directory's content can be READ right now (bean `9c7h`).
 *
 * The declared path alone does not answer that once a directory lives on a
 * branch: until it is mounted, the path is empty or absent, and a reader that
 * walked it would report a clean, empty corpus — the third state collapsing
 * into zero. So a reader asks here and refuses `not-mounted`.
 */
export type ContentAt =
  | { state: "present"; dir: string; via: "checkout" | "mount" }
  | { state: "not-mounted"; dir: string; branch: string; reason: string }
  /** Determined not this checkout's at mount time ({@link absenceAt}), unlike `not-mounted`, which no mount has answered. */
  | { state: "absent"; dir: string; branch: string; reason: string }
  | { state: "undeclared"; reason: string };

export function contentAt(id: string, repoRoot: string = gitTopLevel()): ContentAt {
  for (const inst of layerRootsIn(repoRoot)) {
    for (const d of resolveDirectories([{ name: "(local)", root: inst, own: true }])) {
      if (d.id !== id) continue;
      const dir = d.absPath.replace(/[/\\]+$/, "");
      const at = keptAt(inst, repoRoot, d);
      if (!at) return { state: "present", dir, via: "checkout" };
      // By PATH first: an id several layers declare is filed under
      // `<instance>.<id>`, and only the path says which of them this is.
      // Only where the mount lives is used: `resolveMarkerInto` reads `id`, `key` and `into`.
      const m = markerAtPath(repoRoot, repoRelative(repoRoot, d.absPath), "location") ?? readMarker(repoRoot, id, "location");
      if (m) {
        const resolved = resolveMarkerInto(repoRoot, m);
        if (resolved.ok) return { state: "present", dir: resolved.abs, via: "mount" };
      }
      const absent = absenceAt(repoRoot, repoRelative(repoRoot, d.absPath), id);
      if (absent) return { state: "absent", dir, branch: at.branch, reason: `${id} is absent from this checkout: ${absent.reason}` };
      return {
        state: "not-mounted",
        dir,
        branch: at.branch,
        reason: `${id} is kept on ${at.branch} and is not mounted in this worktree; run \`bun run cat state:mount\` first`,
      };
    }
  }
  return { state: "undeclared", reason: `no declared directory has id ${id}` };
}

/**
 * For a CLI that reads `id`'s content: exit 2 ("could not determine") with
 * the reason when the content is kept on a branch and not mounted here; exit
 * not applicable (`lib/not-applicable.ts`) when a mount determined it absent
 * from this checkout.
 * A command-line entry point only — a library caller asks {@link contentAt}.
 */
export function exitUnlessMounted(id: string, tool: string, repoRoot: string = gitTopLevel()): void {
  const at = contentAt(id, repoRoot);
  // Not applicable, and said so (bean `x5e0`): the graph is determinably not
  // this checkout's, so there is nothing to read or write. The convention's
  // exit lets `derive:publish` excuse this writer's artefacts and go on.
  if (at.state === "absent") exitNotApplicable(tool, at.reason);
  if (at.state !== "not-mounted") return;
  console.error(`::error::${tool}: could not determine — ${at.reason}. Reading ${at.dir} as it stands would report an empty ${id} as a clean one.`);
  process.exit(2);
}

/**
 * Splice the mount's local edits onto the tip. Every change carries `expect`
 * from the mounted tip, so an edit a sibling made to the same file since is a
 * `conflict` and nothing is pushed. On `pushed`, the marker moves to the new
 * tip, so the next push compares against what landed.
 */
export interface PushMountOptions extends MountOptions {
  /**
   * Send a change set that deletes EVERY file of the mount ({@link emptyingReason}).
   * Off by default, and never inferred: only an explicit request to delete the
   * whole graph sets it (`state:push --allow-empty`, bean `sp0e`). Without it,
   * an emptied or gone mount is refused, as above.
   */
  allowEmpty?: boolean;
}

export function pushMount(id: string | TipLocation, message: string, opts: PushMountOptions = {}): PushResult {
  const repoRoot = opts.repoRoot ?? gitTopLevel();
  const m = typeof id === "string" ? readMarker(repoRoot, id) : markerFor(repoRoot, id);
  const name = typeof id === "string" ? id : locationKey(id);
  if (!m) return { state: "refused", reason: `${name} is not mounted in ${repoRoot}` };
  const resolved = resolveMarkerInto(repoRoot, m);
  if (!resolved.ok) return { state: "refused", reason: resolved.reason };
  // The MARKER says where the mount came from, not the declaration: a mount
  // pushes back to the repository it was read from.
  const changes = localChanges(m, repoRoot);
  if (!changes.length) return { state: "unchanged", reason: `no local edits under ${m.into}`, branch: m.branch, attempts: 0 };
  const emptying = opts.allowEmpty ? undefined : emptyingReason(m, changes, repoRoot);
  if (emptying) return { state: "refused", reason: emptying };
  const store = BranchStore.open(m.branch, { repoRoot, ...storeOptionsFor(m, repoRoot, opts.store) });
  const w = store.write(changes, message);
  if (w.state === "pushed" && w.commit) {
    const onBranch = m.branchPath ?? m.path;
    for (const c of changes) {
      const rel = c.path.slice(onBranch.length + 1);
      if (c.content === null) delete m.files[rel];
      else m.files[rel] = { blob: gitBlobId(Buffer.from(c.content)), mode: c.mode ?? "100644" };
    }
    // `tip` stays the MOUNTED tip: see MountMarker.tip.
    writeMarker(repoRoot, { ...m, into: resolved.rel, lastPush: w.commit });
  }
  return w;
}

// ── CLI ──────────────────────────────────────────────────────────────────

/** hit 0, miss 1, usage 2, corrupt 3, unknown 4 — qa-store's and lake-cache's numbers. */
/** What a route publish did, beyond the push itself. */
export interface PublishCounts {
  /** Files written because their bytes differ from the tip, or are new. */
  written: number;
  /** Files REMOVED because the generator no longer produces them. */
  deleted: number;
  /** Files already byte-identical at the tip, so not in the push at all. */
  unchanged: number;
}
export type PublishResult = (WriteResult & { counts: PublishCounts }) | { state: "refused"; reason: string };

/**
 * Replace a ROUTE-keyed directory on its branch with what the checkout holds —
 * the writer a route-keyed store needs, and had none of (bean `xsrv`).
 *
 * ## Why `mount` + `push` could not serve this
 *
 * Measured against the real `cat/cat-harness/uml-overview`: `mountTip` returns
 * **`corrupt`** — *"is keyed by route, not tip"* — because it opens the store
 * with no `keyedBy` and defaults to `tip`. That is `verifiedTip` doing its job
 * rather than a bug to route around, and the pair is tip-shaped all the way
 * down: a marker, an `expect` taken from the mounted tip, and a refusal while
 * *"the path is still tracked on this checkout's branch"*.
 *
 * Every one of those is wrong here, and the last is exactly backwards:
 * **publish requires the checkout to hold the files.** A route is published
 * FROM the working tree, by the one generator that owns it, during the whole
 * period before the files come off `main` — and that period ends with a
 * deletion only a person may authorise. Owner's choice, 2026-10-04, of three
 * shapes put to them.
 *
 * ## Wholesale, which `write` on its own is not
 *
 * `write` is a SPLICE: *"every path not named is carried across untouched."*
 * Right for a tip store, wrong for a route, whose contract is *"one entry per
 * published site route, each replaced wholesale by the single generator that
 * owns it"*. A generator that stops emitting a page must stop publishing it, so
 * this computes `content: null` for every path on the tip that the checkout no
 * longer holds. Omit that half and an orphaned page is served forever, which is
 * the one defect nobody would see — the page still renders.
 *
 * Unchanged files are left out of the push entirely, so `unchanged` is a
 * reachable state rather than a push of identical bytes every run.
 *
 * ## What it refuses, and never papers over
 *
 * - a directory that is not `route`-keyed — by keying, naming both
 * - a branch that does not exist: seeding carries the manifest and is a steward
 *   act, so no writer creates one
 * - a tip it cannot read, or whose manifest disagrees — `corrupt` and `unknown`
 *   are returned as themselves, never folded into "nothing to publish"
 *
 * `expect` is never sent. {@link BranchStore.write} would refuse it, and the
 * reason is the point: an `expect` here would mean the caller thinks the page
 * has two writers.
 */
export function publishRoute(id: string, message: string, opts: MountOptions = {}): PublishResult {
  const repoRoot = opts.repoRoot ?? gitTopLevel();
  let loc: TipLocation;
  try {
    loc = resolveTipLocation(id, repoRoot, "route");
  } catch (e) {
    return { state: "refused", reason: String(e instanceof Error ? e.message : e) };
  }
  const store = BranchStore.open(loc.branch, { repoRoot, ...opts.store, keyedBy: "route" });

  const abs = join(repoRoot, loc.path);
  if (!existsSync(abs)) {
    return {
      state: "refused",
      reason:
        `${loc.path} is not in this checkout, so there is nothing to publish. A route is published FROM the ` +
        `working tree by the generator that owns it; run that generator first.`,
    };
  }

  // The tip's current contents under the route. A `miss` is the first publish of
  // this prefix and is not an error; everything else is returned as itself.
  const at = store.readTreeEntries(loc.path);
  if (at.state !== "hit" && at.state !== "miss") return { state: "refused", reason: `${loc.branch}: ${at.state}: ${at.reason}` };
  const onTip = at.state === "hit" ? at.files : new Map<string, { blob: string; mode: string; bytes: Buffer }>();

  // `walkFiles` yields names relative to the directory it was given, and
  // `ignoredByCheckout` wants them in the same frame, so both stay ROUTE-relative
  // until the change is composed. Getting that wrong is not subtle: the first
  // version joined them onto `repoRoot` and opened `<repo>/a.md`, which the tests
  // caught as ENOENT on five of seven.
  const names = walkFiles(abs);
  // The checkout's own ignore rules, as `pushMount` honours them: generated
  // scratch under a published route is still scratch.
  const ignored = ignoredByCheckout(repoRoot, abs, names);

  const changes: Change[] = [];
  const counts: PublishCounts = { written: 0, deleted: 0, unchanged: 0 };
  const seen = new Set<string>();
  for (const name of names) {
    if (ignored.has(name)) continue;
    const rel = `${loc.path}/${name}`;
    seen.add(rel);
    // `localEntry`, not `readFileSync`: a symlink is its target at mode 120000 and
    // an executable stays executable, which a byte read would silently flatten.
    const { bytes, mode } = localEntry(join(abs, name));
    const tip = onTip.get(rel);
    if (tip && tip.bytes.equals(bytes) && tip.mode === mode) {
      counts.unchanged += 1;
      continue;
    }
    changes.push({ path: rel, content: bytes, mode });
    counts.written += 1;
  }
  for (const rel of onTip.keys()) {
    if (seen.has(rel)) continue;
    // The wholesale half. Without it a page the generator stopped emitting is
    // served for ever, and renders perfectly while doing it.
    changes.push({ path: rel, content: null });
    counts.deleted += 1;
  }

  if (changes.length === 0) {
    return { state: "unchanged", reason: `${loc.path} on ${loc.branch} already holds exactly this`, branch: loc.branch, attempts: 0, counts };
  }
  return { ...store.write(changes, message), counts };
}

export const EXIT = { hit: 0, miss: 1, usage: 2, corrupt: 3, unknown: 4 } as const;
/** `mount`: the read codes above, plus `refused` (it would clobber, or the directory is not cut over). */
export const MOUNT_EXIT = { refused: 5 } as const;
/** `push`: success is 0 either way; `conflict` and `refused` never read as success. */
export const PUSH_EXIT = { pushed: 0, unchanged: 0, absent: 1, conflict: 5, refused: 5, failed: 6 } as const;

export function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  const pos: string[] = [];
  const named = new Map<string, string>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith("--")) named.set(a.slice(2), rest[++i] ?? "");
    else pos.push(a);
  }
  try {
    if (cmd === "where") {
      const id = named.get("id");
      if (!id) throw new BranchStoreUsageError("where needs --id <directory-id>");
      console.log(JSON.stringify(resolveTipLocation(id), null, 2));
      return 0;
    }
    if (cmd === "mount") {
      const id = named.get("id");
      if (!id) throw new BranchStoreUsageError("mount needs --id <directory-id>");
      const r = mountTip(resolveTipLocation(id), { into: named.get("into") });
      if (r.state === "mounted") {
        console.log(`branch-store: mounted ${id} (${r.files} file(s)) from ${r.branch}@${r.tip.slice(0, 12)} at ${r.into}`);
        return 0;
      }
      console.error(`branch-store: mount ${id}: ${r.state}: ${r.reason}`);
      return r.state === "refused" ? MOUNT_EXIT.refused : EXIT[r.state];
    }
    if (cmd === "push") {
      const id = named.get("id");
      if (!id) throw new BranchStoreUsageError("push needs --id <directory-id>");
      const r = pushMount(id, named.get("message") ?? `${id}: push the local mount`);
      const line = `branch-store: push ${id}: ${r.state}: ${r.reason}`;
      if (r.state === "pushed" || r.state === "unchanged") console.log(line);
      else console.error(line);
      if ("conflicts" in r && r.conflicts) for (const c of r.conflicts) console.error(`  ${c.path}: mounted ${c.expected ?? "(absent)"}, tip ${c.actual ?? "(absent)"}`);
      return PUSH_EXIT[r.state];
    }
    if (cmd === "publish") {
      const id = named.get("id");
      if (!id) throw new BranchStoreUsageError("publish needs --id <directory-id>");
      const r = publishRoute(id, named.get("message") ?? `${id}: publish the route from the checkout`);
      if (r.state === "refused") {
        console.error(`branch-store: publish ${id}: refused: ${r.reason}`);
        return MOUNT_EXIT.refused;
      }
      const c = r.counts;
      const line =
        `branch-store: publish ${id}: ${r.state}: ${r.reason} ` +
        `(${c.written} written, ${c.deleted} removed, ${c.unchanged} unchanged)`;
      if (r.state === "pushed" || r.state === "unchanged") console.log(line);
      else console.error(line);
      return PUSH_EXIT[r.state];
    }
    const branch = named.get("branch");
    if (!branch) throw new BranchStoreUsageError(`${cmd ?? "(none)"} needs --branch B`);
    const store = BranchStore.open(branch.split(","));
    if (cmd === "read") {
      const r = store.readFile(pos[0] ?? "");
      if (r.state === "hit") process.stdout.write(r.text);
      else console.error(`branch-store: ${r.state}: ${r.reason}`);
      return EXIT[r.state];
    }
    if (cmd === "ls") {
      const r = store.listDir(pos[0] ?? "");
      if (r.state === "hit") for (const e of r.entries) console.log(`${e.type === "tree" ? "d" : "f"} ${e.name}`);
      else console.error(`branch-store: ${r.state}: ${r.reason}`);
      return EXIT[r.state];
    }
    throw new BranchStoreUsageError(`unknown command ${cmd ?? "(none)"}; expected read | ls | where | mount | push`);
  } catch (e) {
    if (e instanceof BranchStoreUsageError) {
      console.error(`branch-store: ${e.message}`);
      return EXIT.usage;
    }
    throw e;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
