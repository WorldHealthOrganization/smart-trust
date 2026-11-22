/**
 * REMOTE MOUNTS — a harness, and its dependency closure, read from another
 * repository at a pinned commit and laid down as declared directories.
 *
 * @module schemas/remote-mount
 * @graphNode schema
 *
 * Bean `0mpw`, under the KG-subscriptions epic `fnx4` and the separation arc
 * `7x5n`. The owner's rulings, 2026-10-06:
 *
 * - **no git submodules, ever**, and **no `.deps/`** — a dot directory collides
 *   with GitHub's conventions and with this repository's own dot-prefix guard;
 * - a remote mount is a **declared directory with a remote source**, pinned to
 *   a full 40-character SHA (`SubgraphSource` → `kind: "remote"`);
 * - the **defaults live in the harness's own declaration** — which of its
 *   directories a downstream mounts, and where — so a downstream names only
 *   the harness and its pin ({@link MountDefaultsSchema});
 * - a downstream **may override** those defaults, matched on **id** (the
 *   layer's name, then a directory's id), never on path
 *   ({@link MountOverrideSchema});
 * - mounts are resolved **transitively** across the dependency closure;
 * - code arrives through the mounted code directories, so imports resolve
 *   through mounted paths.
 *
 * ## Tools: a chosen set, runnable (bean `mo75` G3)
 *
 * `overrides.<instance>.tools` names Tools by id, and the mount brings each
 * one RUNNABLE. The owner's rulings, 2026-10-24 (decision card,
 * https://github.com/litlfred/cat-harness-tools/issues/744):
 *
 * 1. **A Tool brings its definition AND its implementation**, each with its
 *    import closure: the definition is `<tools dir>/<id>/<id>.ts` in the
 *    layer that declares it (the folder convention, `tool-folders.ts`);
 *    the implementation is the module its `invoke` names — `inProcess.module`
 *    in the declarer or a layer that needs it (`resolveImplementingPath`'s
 *    rule), or the script a `bun run cat <key>` command resolves to through
 *    the layers' `checkoutScripts`.
 * 2. **One closure walker**: bootstrap-tools' `importClosure`
 *    (`scripts/check-closure.ts`), the walk `check:tools-closure` itself runs.
 * 3. **Directory granularity**: every DECLARED directory the closure touches
 *    is mounted whole — the most specific one, so a nested directory mounts
 *    alone. The lock is unchanged: it records directories, as it always has,
 *    and never a single file.
 *
 * With `tools` named anywhere in a mount entry, the entry's layers mount
 * what the closure touches plus the directories their override names, and
 * not their default list; a `whole` layer stays whole.
 *
 * ## Hydrated: metadata first (bean `mo75` G2)
 *
 * `hydrated: true` on a mount entry, or on `overrides.<instance>`, mounts each
 * chosen directory as ONE file: that subgraph's published
 * `index.hydrated.jsonld` at the pin (`SubgraphSource` → `kind: "hydrated"`),
 * so a downstream can read what `tools/` or `skills/` holds before it decides
 * which of it to materialise. No code arrives, so the layer is not laid
 * down as a layer: no `<name>.json` is written (discovery would otherwise
 * read every absent directory as empty — `dh4f`), the lock marks it
 * `hydrated`, and {@link mountedInstanceRoots} never offers it to the overlay
 * as somewhere to import from.
 *
 * The file is read from the pin's git tree when a commit carries it, and
 * otherwise from the pin's subgraph index PACKAGE (bean `mo75` G2b; owner,
 * 2026-10-24, option A: published per pin in a package, never committed and
 * never generated at mount). Such a directory's lock entry records the
 * package's URL and sha256 ({@link LockedDirectorySchema}`.package`).
 *
 * ## Why the default path is the harness's HOME path
 *
 * A mounted layer lands, by default, at the path it has in its own
 * repository (`livesAt.path`), relative to the DOWNSTREAM layer's root —
 * where its lock sits, and for a folio repository the checkout root. Two things then hold with no further machinery:
 * `layerRootsIn` — which scans a checkout one level deep — finds every
 * mounted sibling, so `needs` resolves exactly as it does in the monorepo; and
 * a relative import from one mounted layer into another
 * (`../../cat-harness/schemas/…`) finds the file it names, because the
 * layers keep their relative layout. Moving one layer by override is
 * allowed, and the lock records where it went, but it is the override that
 * takes responsibility for imports that climb out of it.
 *
 * ## What the lock is, and why it is not the declaration
 *
 * The declaration says WHAT is mounted (a harness and a pin). The lock
 * ({@link MountLockSchema}) says what the closure RESOLVED to at that pin —
 * every layer reached, the commit each was read at (a gitlink in the tree
 * pins a dependency in another repository), and each directory's tree digest.
 * The check compares the disk against the lock, and the lock's pins against the
 * declaration, so "mounted", "missing" and "could not determine" are three
 * answers and never one.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { z } from "zod";

import { INDEX_LOCK_FILENAME, LEGACY_MOUNT_LOCK_SUFFIX, lockFilesIn } from "./instance-roots.js";
import { MountTrustBasisSchema, MountTrustSchema } from "./mount-trust.js";
import { RepoFullNameSchema } from "./repo-full-name.js";
import { checkoutOwner, isSameOwnerName, resolveLockRepositories } from "./repo-owner.js";
import { ToolIdSchema } from "../tools/tool-id.js";

/** A layer name — the same rule `cat-harness.ts` applies to `needs` and subscriptions. */
const InstanceNameSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "an instance name: lowercase, digits and dashes");

/** A full commit SHA. A branch moves under the reader; an abbreviated SHA is ambiguous. */
export const CommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/, "a full 40-character commit SHA — pin, never follow a branch");

/**
 * A mount path in the downstream checkout: repository-relative, POSIX, no
 * dot-prefixed segment (the directory-conventions guard), no `..`, and never
 * the checkout root itself — a mount that landed at the root would mix
 * somebody else's read-only bytes with the downstream's own files.
 */
export const MountPathSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\/?$/, "a repository-relative directory with no dot-prefixed segment")
  .refine((p) => !p.split("/").includes(".."), "a mount path may not climb with `..`");

/**
 * HARNESS SIDE — what a downstream mounts of THIS layer unless it says
 * otherwise. Declared once, by the harness, on its own `<name>.json`.
 *
 * Both fields optional, and each absence has a stated meaning rather than a
 * hidden one: `path` absent is the layer's home path (`livesAt.path`, else
 * its directory in its own repository); `directories` absent is every declared
 * directory whose content is in the checkout (`source` absent or `directory`)
 * — a branch-kept or remote-kept subgraph is somebody's state, not part of
 * the harness a downstream reads.
 */
export const MountDefaultsSchema = z
  .object({
    path: MountPathSchema.optional(),
    /** Directory ids, in this layer's own declaration. */
    directories: z
      .array(z.string().min(1))
      .refine((xs) => new Set(xs).size === xs.length, { message: "mountDefaults.directories: an id appears twice" })
      .optional(),
    /**
     * Mount the WHOLE layer root — every tracked file at the pin, root
     * files included — instead of its declared directories. For a layer a
     * downstream reads as a checkout rather than as graphs: `bootstrap` (whose
     * `ns.jsonld` and README sit at its root) and `bootstrap-tools` (whose
     * `package.json` and `tsconfig.json` do), the two git submodules a remote
     * mount replaces (bean `nn8e`, #2462). Locked as one directory, id `*`.
     */
    whole: z.literal(true).optional(),
  })
  .strict();
export type MountDefaults = z.infer<typeof MountDefaultsSchema>;

/**
 * DOWNSTREAM SIDE — an override of ONE layer's defaults in the closure,
 * keyed (in {@link RemoteMountSchema}.overrides) by that layer's name.
 *
 * `directories` REPLACES the default list (an id the layer does not declare
 * is refused at plan time, not dropped). `skip: true` leaves the layer
 * unmounted — the downstream supplies it some other way, and the plan says so
 * rather than reporting it missing.
 */
export const MountOverrideSchema = z
  .object({
    path: MountPathSchema.optional(),
    directories: z
      .array(z.string().min(1))
      .refine((xs) => new Set(xs).size === xs.length, { message: "override directories: an id appears twice" })
      .optional(),
    skip: z.literal(true).optional(),
    /**
     * Tool ids THIS layer declares, each mounted runnable: its definition,
     * its implementation and their import closure, as the declared
     * directories that closure touches (module note, §"Tools"). An id the
     * layer does not declare at the pin is refused at plan time, never
     * dropped. Not with `hydrated` (metadata brings no code) or `skip`.
     */
    tools: z
      .array(ToolIdSchema)
      .min(1)
      .refine((xs) => new Set(xs).size === xs.length, { message: "override tools: an id appears twice" })
      .optional(),
    /** Overrides the harness's `mountDefaults.whole` either way; `directories` is then ignored. */
    whole: z.boolean().optional(),
    /**
     * Mount this layer's directories as their published
     * `index.hydrated.jsonld` only — metadata, no files (bean `mo75` G2).
     * Overrides the mount entry's own `hydrated` either way. `directories`
     * still chooses which subgraphs; `whole` and `hydrated` together are
     * refused at plan time, since one asks for every file and the other for none.
     */
    hydrated: z.boolean().optional(),
    /**
     * Consent for THIS layer at its own pin. Required for a layer
     * reached through a GITLINK: that is another repository at another
     * commit, and the parent mount's consent does not cover it (roast `1ygp`
     * L4.2). Ignored for the declared harness and same-tree layers, which
     * the mount's own `trust` covers.
     */
    trust: MountTrustSchema.optional(),
  })
  .strict();
export type MountOverride = z.infer<typeof MountOverrideSchema>;

/** A bare repository name: a same-owner name (`schemas/kg/repo-owner.ts`). */
export const SameOwnerNameSchema = z
  .string()
  .refine(isSameOwnerName, "a same-owner repository is a bare repository name")
  .describe("A repository name with no owner: the declaring checkout's owner is used");

const lockOwners = new Map<string, string | undefined>();
/**
 * The owner a lock's same-owner names resolve against: the owner of the
 * checkout holding `file` ({@link checkoutOwner}), once per directory and
 * environment.
 */
export function lockOwner(file: string): string | undefined {
  const dir = dirname(resolve(file));
  // input-site: env CAT_REPO_OWNER,GITHUB_REPOSITORY_OWNER #93790cf8 — a cache key over the variables checkoutOwner reads
  const key = `${dir}\0${process.env.CAT_REPO_OWNER ?? ""}\0${process.env.GITHUB_REPOSITORY_OWNER ?? ""}`;
  if (!lockOwners.has(key)) lockOwners.set(key, checkoutOwner(dir));
  return lockOwners.get(key);
}

/**
 * One remote mount a downstream declares: a harness, the repository it lives
 * in and the pin. Everything else — which directories, where, and which other
 * layers its closure brings — comes from the harness's own declaration at
 * that pin.
 */
export const RemoteMountSchema = z
  .object({
    /** The harness's layer name, as its own declaration states it. */
    harness: InstanceNameSchema,
    /**
     * `owner/name`, or a bare `name`: a SAME-OWNER name, resolved to the
     * owner of the checkout that declares it (`schemas/kg/repo-owner.ts`,
     * cat-harness-tools#2337). Readers ({@link readMountLock},
     * `readDeclaredMounts`) hand callers the resolved `owner/name` with
     * `sameOwner: true`; writers put the bare name back.
     */
    repository: z.union([RepoFullNameSchema, SameOwnerNameSchema]),
    /** In memory: `repository` was declared without an owner. Accepted on disk; written as a bare name. */
    sameOwner: z.literal(true).optional(),
    ref: CommitShaSchema,
    /** Per-instance overrides across the closure, keyed by layer name. */
    overrides: z.record(InstanceNameSchema, MountOverrideSchema).optional(),
    /**
     * Mount every layer this entry reaches as hydrated metadata
     * ({@link MountOverrideSchema}`.hydrated`), unless its override says
     * `hydrated: false`. Bean `mo75` G2.
     */
    hydrated: z.literal(true).optional(),
    note: z.string().min(1).optional(),
    /**
     * What makes this mount trusted: a person's consent for THIS pin, or a
     * signature in a declared trust network (`schemas/kg/mount-trust.ts`, bean
     * `ieum`, rule H8). Absent means unsigned and unconsented, and a non-staging
     * mount is then refused rather than fetched.
     */
    trust: MountTrustSchema.optional(),
  })
  .strict();
export type RemoteMount = z.infer<typeof RemoteMountSchema>;

export const RemoteMountsSchema = z
  .array(RemoteMountSchema)
  .refine((xs) => new Set(xs.map((x) => x.harness)).size === xs.length, { message: "remoteMounts: a harness appears twice" });

// ── The lock ─────────────────────────────────────────────────────────────────

export const MOUNT_LOCK_SCHEMA = "cat-harness-mount-lock/v1";

/**
 * The directory id a WHOLE-instance mount is locked under: one entry whose
 * `path` is the layer's mount path and whose `upstreamPath` is its root in
 * the upstream repository (`.` for that repository's root).
 */
export const WHOLE_INSTANCE_ID = "*";

/**
 * The lock's filename, beside the downstream's index: `index.lock.json` — the
 * generated companion to `index.config.json` (owner, 2026-10-07). It was
 * `<name>.mount-lock.json` until then; {@link legacyMountLockFilename} is that
 * name, READ during the transition and never written.
 *
 * The parameter stays so every existing call site reads as it did, and so a
 * caller still says WHOSE lock it means; the name no longer depends on it.
 */
export function mountLockFilename(_instance?: string): string {
  return INDEX_LOCK_FILENAME;
}

/** The retired per-instance lock name, `<name>.mount-lock.json`. */
export function legacyMountLockFilename(instance: string): string {
  return `${instance}${LEGACY_MOUNT_LOCK_SUFFIX}`;
}

/**
 * The lock a reader should open in `dir`: `index.lock.json`, else the
 * downstream's legacy `<name>.mount-lock.json`. Both present THROWS, naming
 * both — never a silent pick (see `lockFilesIn` in `instance-roots.ts`).
 * Returns the path to read even when it does not exist (the new name), so
 * "absent" is still `readMountLock`'s answer to give.
 */
export function mountLockPathFor(dir: string, instance: string): string {
  const { files, conflict } = lockFilesIn(dir);
  if (conflict !== undefined) throw new Error(conflict);
  if (files.includes(INDEX_LOCK_FILENAME)) return join(dir, INDEX_LOCK_FILENAME);
  const legacy = legacyMountLockFilename(instance);
  return files.includes(legacy) ? join(dir, legacy) : join(dir, INDEX_LOCK_FILENAME);
}

export const LockedDirectorySchema = z
  .object({
    id: z.string().min(1),
    /** Relative to the downstream layer's root, no trailing slash. */
    path: z.string().min(1),
    /** Where the bytes are in the upstream repository. */
    upstreamPath: z.string().min(1),
    /** SHA-256 over the sorted `<sha256>  <file>` listing — `treeDigest`. */
    treeDigest: z.string().regex(/^[0-9a-f]{64}$/),
    files: z.number().int().nonnegative(),
    /**
     * A whole-layer mount (`id: "*"`) only: the opt-in sub-graphs the
     * downstream has not switched on, relative to the layer root, no trailing
     * slash. Not checked out, not copied, not in the digest
     * (`switchedOffOptInPaths` in scripts/remote-mount.ts).
     */
    except: z.array(z.string().min(1).refine((p) => !p.split("/").includes("..") && !p.startsWith("/"), "an except path stays inside the layer")).optional(),
    /**
     * A hydrated directory whose `index.hydrated.jsonld` came from the pin's
     * subgraph index PACKAGE rather than its git tree (bean `mo75` G2b; the
     * contract is `subgraphIndexPackage` in `subgraph-manifest.ts`): the
     * tarball's URL and sha256, and the file's path inside the package, so a
     * replay fetches the same bytes and refuses any others.
     */
    package: z
      .object({
        url: z.string().url(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        member: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export const LockedInstanceSchema = z
  .object({
    instance: InstanceNameSchema,
    repository: z.string().min(1),
    sha: CommitShaSchema,
    /** The layer's root in the upstream repository; `""` is that repository's root. */
    upstreamRoot: z.string(),
    /** Where its root landed downstream. */
    path: z.string().min(1),
    /** The `remoteMounts` entry that brought it in. */
    via: InstanceNameSchema,
    /** How the pin was found: the declared ref, the same tree, or a gitlink in a parent's tree. */
    pinnedBy: z.enum(["declared", "same-tree", "gitlink"]),
    declaration: z.object({ file: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
    directories: z.array(LockedDirectorySchema),
    /**
     * The layer's DECLARED ASSETS (`assets[].src` — its README and
     * AGENTS.md), each a single file the declaration names and the mount lays
     * down beside the declaration. Bean `hupw`: a mount without them left
     * every declared asset of a mounted layer a dangling reference. Only
     * instance-scoped assets inside the layer are taken; a declared asset
     * the pinned tree lacks makes the layer `missing`.
     */
    assets: z
      .array(z.object({ src: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict())
      .optional(),
    /**
     * The basis the mount was allowed on — `staging` (the `--staging` flag)
     * or `consent` with who and when — so a reviewer reads it in the lock and
     * the check can re-judge it (roast `1ygp` L4.2). Optional only so a lock
     * written before it was recorded still parses; the check re-derives it
     * and says so.
     */
    trust: MountTrustBasisSchema.optional(),
    /**
     * Mounted as hydrated metadata (bean `mo75` G2): each directory holds one
     * `index.hydrated.jsonld`, read from the `upstreamPath` directory the
     * layer publishes it in, and the declaration is recorded (it fixed
     * those paths) but NOT laid down — so nothing discovers a code-less
     * layer there.
     */
    hydrated: z.literal(true).optional(),
  })
  .strict();
export type LockedInstance = z.infer<typeof LockedInstanceSchema>;

export const MountLockSchema = z
  .object({
    $schema: z.literal(MOUNT_LOCK_SCHEMA),
    /**
     * When `mount:remote` wrote this content, pins included (UTC, ISO 8601,
     * whole seconds): T, the time `lock:coherence:check` judges freshness
     * against. A commit's date is not T: a squash merge dates the commit
     * that carries the lock at the MERGE, so every layer main that moved
     * between the re-pin and the merge read as "moved before T" and the pin
     * as stale (merge-manager, 2026-11-17: three WHO syncs lost that race).
     * Kept when a mount rewrites the same content, so a re-run does not
     * churn the lock; written anew whenever anything else in it changes.
     * The check accepts it only when it is no later than the commit that
     * carries the lock and no earlier than any pin's own commit; optional
     * so a lock written before it was recorded still parses.
     */
    pinnedAt: z.string().datetime().optional(),
    /** The `remoteMounts` it was written for, so a changed pin reads as stale. */
    mounts: z.array(z.object({ harness: InstanceNameSchema, repository: z.string().min(1), ref: CommitShaSchema }).strict()),
    instances: z.array(LockedInstanceSchema),
    /**
     * What the closure reached and did NOT mount, with why — so the check,
     * which reads the lock and never the network, cannot report clean over a
     * layer the mount never laid down. `local` and `skipped` are recorded
     * too: they are answers, and a reader should see them as such.
     */
    unmounted: z
      .array(
        z
          .object({
            instance: InstanceNameSchema,
            /** `refused`: the trust check said no (H8). */
            state: z.enum(["local", "skipped", "missing", "refused", "could-not-determine"]),
            detail: z.string(),
            /**
             * A REFUSED layer's previous mount, still on disk because an
             * agent does not delete it (`deletion-requires-confirmation`). It
             * is recorded here, not in `instances`, so nothing presents it as
             * current: the check reports it, and the next mount knows this
             * mount put it there.
             */
            leftOnDisk: LockedInstanceSchema.optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();
export type MountLock = z.infer<typeof MountLockSchema>;

// ── Reading the lock (the overlay's half) ────────────────────────────────────

/**
 * Every mounted layer the locks in `scope` record, as `name → absolute root`.
 *
 * `scope` is the DOWNSTREAM layer's root: the lock sits beside its
 * declaration, and every mount path in it is relative to that root. The
 * overlay asks this rather than guessing a directory: `resolveDependencyPath`
 * used to fall back to `.deps/<name>/`, which the owner ruled out
 * (2026-10-06). A mount at its default (home) path is ALSO found by
 * `layerRootsIn`'s one-level scan; this is what finds one an override
 * moved deeper.
 *
 * A lock that cannot be parsed contributes nothing HERE — the overlay is not
 * where that is diagnosed — and `mount:remote:check` reports it as
 * could-not-determine, so it cannot pass unnoticed.
 */
export function mountedInstanceRoots(scope: string): Map<string, string> {
  const out = new Map<string, string>();
  const dir = resolve(scope);
  // `index.lock.json`, else the legacy `*.mount-lock.json`. Both present is
  // `mount:lock:check`'s finding to report; the overlay reads neither rather
  // than guess which one is true.
  const names = lockFilesIn(dir).files;
  for (const n of names) {
    const lock = readMountLockShared(join(dir, n));
    if (!lock.ok) continue;
    for (const inst of lock.lock.instances) {
      // Metadata only: nothing there to import from or resolve `needs` to.
      if (inst.hydrated) continue;
      const abs = join(dir, inst.path);
      if (!out.has(inst.instance) && existsSync(abs)) out.set(inst.instance, abs);
    }
  }
  return out;
}

/**
 * The scope a MOUNTED layer's siblings are found in: the nearest ancestor
 * holding a lock that put `instanceRoot` where it is. `undefined` for a
 * layer no mount placed. Bounded, and reads only lock files.
 */
export function mountScopeFor(instanceRoot: string): string | undefined {
  const abs = resolve(instanceRoot);
  let dir = dirname(abs);
  for (let i = 0; i < 8; i++) {
    for (const root of mountedInstanceRoots(dir).values()) if (root === abs) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return undefined;
}

/**
 * Whether the mount that placed {@link instanceRoot} CHOSE its declared
 * directory {@link absDir}.
 *
 * A downstream mounts a chosen subset of an upstream layer's directories,
 * and the declaration it lays down still names all of them. So a declared
 * directory that is not on disk is one of two different facts: the upstream
 * keeps it and this mount did not choose it (nothing here to examine), or it
 * was chosen and is gone (a corpus that should be here and is not). The lock
 * records which (`instances[].directories`); this asks it.
 *
 * - `undefined` — no lock placed the layer (the checkout's own, or a plain
 *   directory), or the lock cannot be read: no answer, and a caller must not
 *   treat that as "not chosen".
 * - `{ chosen: true }` — a whole-instance mount, or a locked directory equals,
 *   encloses or lies inside `absDir` (a partly chosen directory is chosen).
 * - `{ chosen: false, lock }` — the lock records the layer and none of its
 *   directories reaches `absDir`.
 */
export function mountChoiceOf(instanceRoot: string, absDir: string): { chosen: boolean; lock: string } | undefined {
  const inst = resolve(instanceRoot);
  const dir = resolve(absDir);
  const scope = mountScopeFor(inst);
  if (scope === undefined) return undefined;
  const within = (a: string, b: string): boolean => a === b || a.startsWith(`${b}/`);
  for (const name of lockFilesIn(scope).files) {
    const file = join(scope, name);
    const r = readMountLockShared(file);
    if (!r.ok) continue;
    const entry = r.lock.instances.find((i) => resolve(scope, i.path) === inst);
    if (entry === undefined) continue;
    const chosen = entry.directories.some((d) => {
      if (d.id === WHOLE_INSTANCE_ID) return !(d.except ?? []).some((e) => within(dir, resolve(scope, d.path, e)));
      const locked = resolve(scope, d.path);
      return within(dir, locked) || within(locked, dir);
    });
    return { chosen, lock: name };
  }
  return undefined;
}

/**
 * ABSENT BY CONSENT: `absDir` is not on disk, and the lock that placed the
 * layer at `instanceRoot` did not take it ({@link mountChoiceOf} answers
 * `chosen: false`) — a whole mount's `except` (an opt-in sub-graph the
 * downstream has switched off) or a partial mount that never chose it.
 *
 * A third state beside present and missing: nothing is here to judge, and
 * the upstream keeps it. `false` for a directory on disk, for one the mount
 * took, and for a layer no lock placed — each of those absences is still a
 * defect for the caller to report.
 */
export function leftOutByMount(instanceRoot: string, absDir: string): boolean {
  if (existsSync(absDir)) return false;
  return mountChoiceOf(instanceRoot, absDir)?.chosen === false;
}

/**
 * {@link readMountLock} for the two READERS above, which never change what
 * they are handed: one parse per lock file while its size and mtime stand.
 * `resolveDirectories` asks {@link mountChoiceOf} about every switched-on
 * opt-in sub-graph that is not on disk, and resolution runs thousands of
 * times a gate; a parse of the whole lock each time is the cost this avoids.
 * Never handed to a caller that edits a lock: that one calls `readMountLock`.
 */
const sharedLocks = new Map<string, { stamp: string; read: ReturnType<typeof readMountLock> }>();
function readMountLockShared(file: string): ReturnType<typeof readMountLock> {
  let stamp: string;
  try {
    const st = statSync(file);
    stamp = `${st.size}:${st.mtimeMs}`;
  } catch {
    return readMountLock(file);
  }
  const hit = sharedLocks.get(file);
  if (hit !== undefined && hit.stamp === stamp) return hit.read;
  const read = readMountLock(file);
  sharedLocks.set(file, { stamp, read });
  return read;
}

/** Parse a lock file: absent, unreadable and malformed are three different answers. */
export function readMountLock(file: string): { ok: true; lock: MountLock } | { ok: false; absent: boolean; why: string } {
  if (!existsSync(file)) return { ok: false, absent: true, why: `${file} does not exist` };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf-8"));
  } catch (e) {
    return { ok: false, absent: false, why: `${file} is not JSON: ${(e as Error).message}` };
  }
  const p = MountLockSchema.safeParse(raw);
  if (!p.success) return { ok: false, absent: false, why: `${file} is not a ${MOUNT_LOCK_SCHEMA} lock: ${p.error.issues[0]?.message ?? "invalid"}` };
  // Same-owner entries (a bare repository name) resolve against the owner of
  // the checkout that holds the lock (cat-harness-tools#2337).
  try {
    const bare = [...p.data.mounts, ...p.data.instances].some((e) => isSameOwnerName(e.repository));
    return { ok: true, lock: bare ? resolveLockRepositories(p.data, lockOwner(file)) : p.data };
  } catch (e) {
    return { ok: false, absent: false, why: `${file}: ${(e as Error).message}` };
  }
}

// ── Reserved names and collision checks (bean folio-assistant-t4xb) ─────────

/**
 * Reserved root directory and site route names — declared in one place (bean folio-assistant-t4xb).
 *
 * A remote mount whose effective path collides with any of these names (or whose root segment
 * collides with them) is rejected, and an opt-in visualiser alias that collides with any of these
 * names is refused.
 */
export const RESERVED_ROOT_AND_ROUTE_NAMES: readonly string[] = [
  "skills",
  "tools",
  "docs",
  "assets",
  "glossary",
  "api",
  "payload",
  "STAGING",
  "branches",
  "beans",
  "todos",
  "fsh-guts",
  "uploads",
  "test",
  // input-site: inert #16b14f5d — reserved root and route name literal; reads no build directory
  "build",
  // input-site: inert #742463a7 — reserved root and route name literal; reads no build directory
  "_site",
  "_docs",
  // input-site: inert #3e9fe40a — reserved root and route name literal; reads no build directory
  "_kg",
] as const;

export type ReservedRootAndRouteName = (typeof RESERVED_ROOT_AND_ROUTE_NAMES)[number];

export function isReservedRootOrRouteName(name: string): boolean {
  const norm = name.replace(/^\/+|\/+$/g, "");
  const segment = norm.split("/")[0] ?? norm;
  return RESERVED_ROOT_AND_ROUTE_NAMES.some(
    (r) => r.toLowerCase() === segment.toLowerCase(),
  );
}

export interface MountPathDescriptor {
  harness: string;
  path?: string;
  overrides?: Record<string, { path?: string }>;
}

/**
 * The effective mount path of a remote mount entry:
 * `m.path` or `m.overrides[harness].path` or default `<harness>/`.
 * Stripped of leading and trailing slashes.
 */
export function effectiveMountPathOf(m: MountPathDescriptor): string {
  const p = m.path ?? m.overrides?.[m.harness]?.path ?? m.harness;
  return p.replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
}

export interface MountCollisionFinding {
  harness: string;
  effectivePath: string;
  kind: "declared-directory" | "reserved-name" | "sibling-mount";
  collidesWith: string;
  message: string;
}

export interface CheckMountCollisionsOptions {
  declaredDirs?: readonly string[];
  reservedNames?: readonly string[];
}

/**
 * Check a list of remote mounts for path collisions:
 * 1. collides with a directory the downstream declares in its own configuration;
 * 2. collides with a reserved root or site route name;
 * 3. collides with another mount's path.
 *
 * When a collision occurs, the finding's message clearly says how to fix it: "set `path`".
 */
export function checkMountPathCollisions(
  mounts: readonly MountPathDescriptor[],
  opts: CheckMountCollisionsOptions = {},
): MountCollisionFinding[] {
  const findings: MountCollisionFinding[] = [];
  const declaredDirs = (opts.declaredDirs ?? []).map((d) => d.replace(/^\.\//, "").replace(/^\/+|\/+$/g, ""));
  const reserved = opts.reservedNames ?? RESERVED_ROOT_AND_ROUTE_NAMES;

  for (let i = 0; i < mounts.length; i++) {
    const m = mounts[i]!;
    const eff = effectiveMountPathOf(m);
    const rootSegment = eff.split("/")[0] ?? eff;

    // 1. Collides with a directory the downstream declares
    for (const d of declaredDirs) {
      if (eff === d || eff.startsWith(`${d}/`) || d.startsWith(`${eff}/`)) {
        findings.push({
          harness: m.harness,
          effectivePath: eff,
          kind: "declared-directory",
          collidesWith: d,
          message: `Mount "${m.harness}" effective path "${eff}" collides with downstream declared directory "${d}" — set \`path\` to avoid collision.`,
        });
        break;
      }
    }

    // 2. Collides with a reserved root or site route name
    const reservedMatch = reserved.find(
      (r) => r.toLowerCase() === rootSegment.toLowerCase() || r.toLowerCase() === eff.toLowerCase(),
    );
    if (reservedMatch) {
      findings.push({
        harness: m.harness,
        effectivePath: eff,
        kind: "reserved-name",
        collidesWith: reservedMatch,
        message: `Mount "${m.harness}" effective path "${eff}" collides with reserved root or site route name "${reservedMatch}" — set \`path\` to avoid collision.`,
      });
    }

    // 3. Collides with another mount's path
    for (let j = 0; j < mounts.length; j++) {
      if (i === j) continue;
      const other = mounts[j]!;
      const otherEff = effectiveMountPathOf(other);
      if (eff === otherEff || eff.startsWith(`${otherEff}/`) || otherEff.startsWith(`${eff}/`)) {
        findings.push({
          harness: m.harness,
          effectivePath: eff,
          kind: "sibling-mount",
          collidesWith: other.harness,
          message: `Mount "${m.harness}" effective path "${eff}" collides with mount "${other.harness}" (path: "${otherEff}") — set \`path\` to avoid collision.`,
        });
        break;
      }
    }
  }

  return findings;
}

// ── Route rules: Canonical and Alias ────────────────────────────────────────

/**
 * The canonical URL route for a visualiser: `<base>/<harness>/<visualizer>/`.
 * Always trailing-slash terminated.
 */
export function canonicalVisualizerRoute(harness: string, visualizer: string, base = ""): string {
  const b = base.replace(/\/+$/, "");
  const prefix = b ? `${b}/` : "";
  const h = harness.replace(/^\/+|\/+$/g, "");
  const v = visualizer.replace(/^\/+|\/+$/g, "");
  return `${prefix}${h}/${v}/`;
}

/**
 * The alias route for a visualiser when opt-in alias is declared.
 * Returns `undefined` if no alias is declared or alias is false.
 */
export function visualizerAliasRoute(visualizer: string, alias?: string | boolean): string | undefined {
  if (alias === undefined || alias === false) return undefined;
  if (typeof alias === "string") return alias.replace(/^\/+|\/+$/g, "");
  return visualizer.replace(/^\/+|\/+$/g, "");
}

/**
 * Determine the URL for a visualiser:
 * Uses alias `<base>/<alias>/` if opt-in alias is declared,
 * otherwise canonical form `<base>/<harness>/<visualizer>/`.
 */
export function visualizerUrl(
  harness: string,
  visualizer: string,
  opts?: { alias?: string | boolean; base?: string },
): string {
  const alias = visualizerAliasRoute(visualizer, opts?.alias);
  if (alias) {
    const b = opts?.base ? opts.base.replace(/\/+$/, "") + "/" : "";
    return `${b}${alias}/`;
  }
  return canonicalVisualizerRoute(harness, visualizer, opts?.base);
}

export interface VisualizerRouteClaim {
  harness: string;
  visualizer: string;
  alias?: string | boolean;
}

export interface RouteCollisionFinding {
  claimantA: string;
  claimantB: string;
  route: string;
  kind: "reserved-route" | "harness-route" | "alias-collision";
  message: string;
}

/**
 * Validate visualiser route aliases:
 * Rejects any alias that collides with:
 * 1. a reserved site route;
 * 2. a harness route;
 * 3. another visualiser's alias.
 * Refuses the collision and names both claimants.
 */
export function checkVisualizerRouteCollisions(
  visualizers: readonly VisualizerRouteClaim[],
  opts: {
    reservedRoutes?: readonly string[];
    harnessNames?: readonly string[];
  } = {},
): RouteCollisionFinding[] {
  const findings: RouteCollisionFinding[] = [];
  const reserved = opts.reservedRoutes ?? RESERVED_ROOT_AND_ROUTE_NAMES;
  const harnesses = opts.harnessNames ?? [];

  const seenAliases = new Map<string, string>();

  for (const v of visualizers) {
    const alias = visualizerAliasRoute(v.visualizer, v.alias);
    if (!alias) continue;

    const claimant = `${v.harness}/${v.visualizer}`;
    const aliasLower = alias.toLowerCase();

    // 1. Check collision with reserved site route
    const reservedMatch = reserved.find((r) => r.toLowerCase() === aliasLower);
    if (reservedMatch) {
      findings.push({
        claimantA: claimant,
        claimantB: `reserved-route:${reservedMatch}`,
        route: alias,
        kind: "reserved-route",
        message: `Visualiser alias "${alias}" from "${claimant}" collides with reserved site route "${reservedMatch}".`,
      });
    }

    // 2. Check collision with harness route
    const harnessMatch = harnesses.find((h) => h.toLowerCase() === aliasLower);
    if (harnessMatch) {
      findings.push({
        claimantA: claimant,
        claimantB: `harness:${harnessMatch}`,
        route: alias,
        kind: "harness-route",
        message: `Visualiser alias "${alias}" from "${claimant}" collides with harness route "${harnessMatch}" (claimant: harness:${harnessMatch}).`,
      });
    }

    // 3. Check collision with another visualiser's alias
    const existing = seenAliases.get(aliasLower);
    if (existing) {
      findings.push({
        claimantA: claimant,
        claimantB: existing,
        route: alias,
        kind: "alias-collision",
        message: `Visualiser alias "${alias}" collides between claimants "${claimant}" and "${existing}".`,
      });
    } else {
      seenAliases.set(aliasLower, claimant);
    }
  }

  return findings;
}

