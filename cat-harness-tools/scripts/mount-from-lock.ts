#!/usr/bin/env bun
/**
 * Lay down every remote mount a committed lock records — from the LOCK alone,
 * with nothing but Node's own modules.
 *
 * `remote-mount.ts` PLANS a mount: it reads the harness's declaration at the
 * pin (through `schemas/kg/cat-harness.ts`, whose imports reach into
 * `bootstrap-tools/schemas/`), follows `needs` across the closure, checks
 * trust and writes the lock. It cannot load until `bootstrap-tools` is
 * mounted, so this script does the one part that needs no declaration:
 * REPLAYING a lock. Every decision — which layers, which repository, which
 * commit, which directories, where — is in the committed lock; what is left
 * is fetch, copy and verify. So it imports only `node:*`, runs on a fresh
 * clone, and is what CI and the session-start hook run first.
 * `mount:remote` stays the only writer of a lock.
 *
 * ## What it guarantees
 *
 * - **Pinned and verified.** Each layer is fetched at the lock's 40-char
 *   SHA, and each directory's bytes must hash to the lock's `treeDigest`
 *   (the same digest `kg-parts.ts` computes) — a mismatch is undone and
 *   reported, never kept. Trust was checked when the lock was written; the
 *   digest is what makes replaying it safe.
 * - **Never over somebody's work.** A path that holds tracked files, or holds
 *   bytes that no longer hash to the lock, is left untouched and reported —
 *   unless those bytes hash to what an EARLIER committed version of the same
 *   lock pinned at that path ({@link priorPins}). Those are a stale mount, not
 *   an edit (bean folio-assistant-jstq), and are replaced; the state mounts and
 *   `node_modules/` inside them are carried over.
 * - **Three states.** `mounted` / `current` exit 0, `missing` (refused or
 *   absent) exits 1, `could-not-determine` (fetch failed, lock unreadable)
 *   exits 2 — never folded into one another.
 *
 * Usage:
 *   bun run cat mount:lock                 # lay down / refresh every locked mount
 *   bun run cat mount:lock -- --check      # no network: is every locked mount on disk and intact?
 *   bun run cat mount:lock -- --root <dir> # the downstream layer root (default: cwd)
 *   bun run cat mount:lock -- --no-install # lay the bytes down, do not `bun install` in each mount
 *   bun run cat mount:lock -- --install-all # install devDependencies too (default: --omit dev)
 *   bun run cat mount:lock -- --no-layers-cache # skip the shared layers cache ref, fetch each repository
 *   bun run cat layers:publish             # (= --publish) build the overlay of the verified mounts, push refs/cat/layers/<key>
 *   bun run cat layers:publish -- --main --prune 20 [--keep <key>]… [--url <index remote>] [--no-push]
 *   bun run cat layers:check               # (= --check-layers) gate: refs/cat/layers/<key> for THIS lock exists at the index remote
 *   … --move-layers                        # runner: move claude/cat-layers/<key> (a sandbox's publish) to refs/cat/layers/<key>
 *   bun run cat layers:check -- --changed-from <base> # the same, only when index.lock.json differs from <base> (a re-pin)
 *
 * The FAST PATH: before fetching layer by layer, the replay tries ONE
 * shallow fetch of the index's layers cache ref (`refs/cat/layers/<key>`, then
 * `refs/cat/layers/main`) and verifies every byte it takes from it against the
 * lock; see "The shared layers cache ref" below.
 *
 * `CAT_MOUNT_URL_PREFIX` replaces `https://github.com` in fetch URLs (tests
 * serve local bare repositories this way); a repository that is already a URL
 * or an absolute path is used as it stands.
 *
 * @graphNode none — a command-line tool; the lock's shape is `schemas/kg/remote-mount.ts`
 * @covers none — replays a lock; `mount:remote:check` is the gate on the lock itself
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/**
 * `input-trace.ts`'s hook, restated here because this script imports only
 * `node:*` (above): CI and the session-start hook check out THIS FILE ALONE
 * from the pinned cat-harness-tools commit and run it, so a relative import
 * fails before anything is mounted. Keep it equal to `inputSiteReached` there:
 * append the site to the trace file `INPUT_HASH_TRACE` (`read-projections.ts`
 * `TRACE_ENV`) names, when a recording run named one.
 */
function inputSiteReached(what: string): void {
  // input-site: inert #2ac4c84b — names the trace file of the recording run; what is written there is never part of an answer
  const path = process.env.INPUT_HASH_TRACE;
  if (path) appendFileSync(path, `${what}\n`);
}

/** The lock's shape, read structurally — this file may not import the schema (see the header). */
export interface LockDir {
  id: string;
  path: string;
  upstreamPath: string;
  treeDigest: string;
  files: number;
  /**
   * A hydrated directory whose file came from the pin's subgraph index
   * PACKAGE, not its git tree (bean `mo75` G2b): the tarball, its sha256, and
   * the file's path inside it.
   */
  package?: { url: string; sha256: string; member: string };
  /**
   * A whole-layer mount (`id: "*"`) only: the opt-in sub-graphs the
   * downstream has not switched on, relative to the layer root. Not fetched,
   * so not copied and not in the digest.
   */
  except?: string[];
}
export interface LockAsset {
  src: string;
  sha256: string;
}
export interface LockInstance {
  instance: string;
  repository: string;
  sha: string;
  upstreamRoot: string;
  path: string;
  declaration: { file: string; sha256: string };
  directories: LockDir[];
  assets?: LockAsset[];
  /**
   * Hydrated metadata (bean `mo75` G2): each directory is one
   * `index.hydrated.jsonld` read from the `upstreamPath` directory, and the
   * declaration is recorded but never laid down.
   */
  hydrated?: true;
}

/** The one file a hydrated directory holds — `SUBGRAPH_HYDRATED_FILE`, spelled here because this file reads the lock structurally (see the header). */
const HYDRATED_FILE = "index.hydrated.jsonld";

export type State = "mounted" | "current" | "missing" | "could-not-determine";
export interface Outcome {
  instance: string;
  state: State;
  detail: string;
}

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;

// ── Digest — byte-identical to kg-parts.ts `treeEntries` + `treeDigest` ──────

export function treeFiles(dir: string): string[] {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push(relative(dir, p).split("\\").join("/"));
    }
  };
  if (existsSync(dir)) walk(dir);
  return files.sort();
}

const sha256 = (b: string | Buffer): string => createHash("sha256").update(b).digest("hex");

/**
 * The directories a STATE mount laid down in this worktree, absolute, read
 * from `state:mount`'s own markers (`<git-dir>/branch-mounts/<id>.json`,
 * `branch-mount/v1`, written by `branch-store.ts`).
 *
 * An instance-scoped state graph sits INSIDE its layer: cat-harness's
 * `health` is `cat-harness/test/health/results/`, and in an index that is
 * inside the remote mount of cat-harness. Its files come from the state
 * branch, not from the pinned tree, so hashing them against the lock reads
 * every state mount as an edit to the pinned layer ("no longer hash to the
 * lock") and refuses the remount. They are skipped here, and ONLY them: the
 * marker is the state store's own record of exactly what it put down, and the
 * store judges those bytes itself (`state:push` refuses a conflict).
 *
 * Restated rather than imported from `branch-store.ts` for the reason the
 * header gives: this file imports nothing but `node:*`.
 */
export function stateMountedDirs(root: string): string[] {
  // input-site: traced #aa4aaef6 — the state-mount markers inside .git, which no fingerprint sees: a run that reads them records no hash
  inputSiteReached("mount-from-lock: state-mount markers");
  const r = spawnSync("git", ["rev-parse", "--git-path", "branch-mounts"], { cwd: root, encoding: "utf-8" });
  if (r.status !== 0) return [];
  const dir = resolve(root, r.stdout.trim());
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    if (!n.endsWith(".json")) continue;
    try {
      // Only `$schema` and `into` are used: a recorded writer is keyed on where the mount lives, not on the marker's tip and blobs.
      reportLocationRead(join(dir, n));
      const m = JSON.parse(readFileSync(join(dir, n), "utf-8")) as { $schema?: unknown; into?: unknown };
      if (m.$schema === "branch-mount/v1" && typeof m.into === "string") {
        const abs = resolve(root, m.into);
        const rel = relative(resolve(root), abs);
        if (rel && !rel.startsWith("..") && !isAbsolute(rel)) out.push(abs);
      }
    } catch {
      // An unreadable marker skips nothing: the digest then judges those bytes.
    }
  }
  return out;
}

/**
 * `projectedRead(abs, "mount-location")` from `schemas/sdlc/read-projections.ts`,
 * restated for the reason the header gives (this file imports only `node:*`).
 * `read-projections.test.ts` holds the two to the same line.
 */
export function reportLocationRead(abs: string): void {
  // input-site: inert #7cd4c7ec — names the trace file of the recording run; what is written there is never part of an answer
  const trace = process.env["INPUT_HASH_TRACE"];
  if (trace) appendFileSync(trace, `projected mount-location ${abs}\n`);
}

/** `files` (relative to `dir`) minus any under one of `skip` (absolute directories). */
export function withoutStateMounts(dir: string, files: readonly string[], skip: readonly string[]): string[] {
  if (skip.length === 0) return [...files];
  const under = skip.map((s) => resolve(s) + "/");
  return files.filter((f) => !under.some((u) => (resolve(dir, f) + "/").startsWith(u)));
}

/**
 * The paths a mounted layer DECLARES it builds at publish (`builtAtPublish`
 * in its `<name>.json`; owner, 2026-10-14, "B1"), instance-relative. They are
 * excluded from the digest for the same reason as `node_modules/`: the pinned
 * commit cannot contain them (the layer ignores them, and its own test holds
 * that nothing declared is tracked), so a publish build that writes them into
 * the mount has written none of the PINNED bytes, and must not make the next
 * re-mount refuse the mount as "somebody's work". An old pin declares nothing,
 * so its digest is unchanged. Read with `node:fs` alone, as this file must.
 */
export function builtAtPublishOf(dir: string): string[] {
  // `dir` is the layer root, or one of the directories the lock pins of a
  // layer mounted as several (an IG pinned as `fhir-artifact-index`,
  // `document-kinds`, …). The entries are instance-relative, so they are
  // read from the layer's declaration and rebased onto `dir`: before
  // 2026-11-06 they were looked for in `dir` itself and compared as
  // `dir`-relative paths, so no entry of a several-directory layer ever
  // applied, and `ig-index:build` writing its declared index made the mount
  // read as "somebody's work" (bean `cat-tools-sm8r`).
  const home = instanceHomeOf(dir);
  if (home === undefined) return [];
  const rel = relative(home.root, resolve(dir)).split("\\").join("/");
  if (rel === "") return home.entries;
  const out: string[] = [];
  for (const p of home.entries) {
    // A declared directory holding all of `dir`: every file of it is built.
    if (p.endsWith("/") && `${rel}/`.startsWith(p)) out.push(ALL_OF_IT);
    else if (p.startsWith(`${rel}/`)) out.push(p.slice(rel.length + 1));
  }
  return out;
}

/** The rebased entry that excludes every file of the directory. */
const ALL_OF_IT = "./";

/**
 * The nearest of `dir` and its ancestors that holds a harness declaration,
 * with that declaration's `builtAtPublish` paths. The walk stops at a
 * checkout or index boundary (`.git`, `index.lock.json`), so a directory of a
 * layer that declares nothing never borrows another declaration's entries.
 */
function instanceHomeOf(dir: string): { root: string; entries: string[] } | undefined {
  let at = resolve(dir);
  for (;;) {
    const entries = declaredBuiltAtPublish(at);
    if (entries !== undefined) return { root: at, entries };
    if (existsSync(join(at, ".git")) || existsSync(join(at, "index.lock.json"))) return undefined;
    const up = dirname(at);
    if (up === at) return undefined;
    at = up;
  }
}

/** The `builtAtPublish` paths of the harness declaration(s) in `dir`, or undefined when it holds none. */
function declaredBuiltAtPublish(dir: string): string[] | undefined {
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    return undefined;
  }
  let found = false;
  const out: string[] = [];
  for (const n of names) {
    try {
      const d = JSON.parse(readFileSync(join(dir, n), "utf-8")) as { $schema?: unknown; name?: unknown; builtAtPublish?: unknown };
      // bootstrap's own layers declare `name` and `needs` with no `$schema`
      // (the rule `run-gates.py` `is_declaration` reads): a bare
      // `<name>.json` whose `name` is its file's. Read only by
      // the harness's `$schema` before cat-harness-tools#1701, so bootstrap's
      // declared `ns.context.v1.jsonld` (`jsonld:contexts`) was never left
      // out, and once derive:publish wrote it every mount check read
      // `bootstrap/ modified` (smart-ips-pilgrimage run 42455839636).
      const harness = typeof d.$schema === "string" && d.$schema.startsWith("cat-harness-declaration");
      const bare = d.$schema === undefined && typeof d.name === "string" && `${d.name}.json` === n;
      if (!harness && !bare) continue;
      found = true;
      if (!Array.isArray(d.builtAtPublish)) continue;
      for (const e of d.builtAtPublish) if (e && typeof e.path === "string") out.push(e.path);
    } catch {
      // Not a declaration, or not JSON: it excludes nothing, so the digest judges every byte.
    }
  }
  return found ? out : undefined;
}

/** `files` minus any declared built at publish (a directory entry ends in `/`; `./` is all of them). */
export function withoutBuiltAtPublish(files: readonly string[], declared: readonly string[]): string[] {
  if (declared.length === 0) return [...files];
  if (declared.includes(ALL_OF_IT)) return [];
  return files.filter((f) => !declared.some((p) => (p.endsWith("/") ? f.startsWith(p) : f === p)));
}

/**
 * A `.gitignore` whose only pattern is `*`: the directory holding it ignores
 * itself, the marker file included. A viewer that writes its route onto
 * ANOTHER layer's site (`builtOnHostSite`) puts one there (bean
 * folio-assistant-uldr, owner choice "A: derive + in-route ignore"), so the
 * host lists none of its routes under `builtAtPublish`.
 */
export function isSelfIgnore(text: string): boolean {
  const patterns = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#"));
  return patterns.length === 1 && patterns[0] === "*";
}

/**
 * `files` (relative to `dir`) minus everything in a directory below `dir` that
 * ignores itself ({@link isSelfIgnore}). The pinned commit cannot hold such a
 * directory's files, the marker included, since git ignores them all, so like a
 * declared `builtAtPublish` path none of them is a pinned byte. `dir`'s own
 * root `.gitignore` is never read as one: a root `*` would hide the layer.
 */
export function withoutSelfIgnored(dir: string, files: readonly string[]): string[] {
  const routes = files
    .filter((f) => f.endsWith("/.gitignore"))
    .filter((f) => {
      try {
        return isSelfIgnore(readFileSync(join(dir, f), "utf-8"));
      } catch {
        return false;
      }
    })
    .map((f) => f.slice(0, -".gitignore".length));
  if (routes.length === 0) return [...files];
  return files.filter((f) => !routes.some((r) => f.startsWith(r)));
}

/** The files under `dir` a mount digest hashes: no install artefacts, no state mounts, nothing built at publish. */
export function coveredFiles(dir: string, skip: readonly string[] = []): string[] {
  return withoutSelfIgnored(dir, withoutBuiltAtPublish(withoutInstallArtefacts(withoutStateMounts(dir, treeFiles(dir), skip)), builtAtPublishOf(dir)));
}

export function digestOf(dir: string, skip: readonly string[] = []): { treeDigest: string; files: number } {
  const files = coveredFiles(dir, skip);
  const listing = files.map((f) => `${sha256(readFileSync(join(dir, f)))}  ${f}\n`).join("");
  return { treeDigest: sha256(listing), files: files.length };
}

// ── Installing a mount's dependencies (task #10, gap b) ──────────────────────
//
// A mounted layer is CODE (`cat-harness`, `cat-harness-tools`, …), and code
// with no `node_modules` does not run: `Cannot find module
// '@litlfred/cat-harness/schemas/kg/mount-trust.js'`. Until 2026-10-12 the
// workaround was a hand `bun install` inside the mount, and that made the mount
// read MODIFIED: `--check` said "the pinned bytes are not on disk:
// cat-harness/ modified" and the next re-mount refused it.
//
// Two routes were on the table. (1) Resolve the workspace packages WITHOUT
// writing into the mount — a generated workspace manifest at the downstream
// root. Rejected: it edits the downstream's tracked `package.json`, and bun's
// default (isolated) linker writes a `node_modules/` into every workspace
// member anyway, i.e. into the mounts, so it does not even keep them pristine.
// (2) Install INTO the mount and define what fixity covers. Taken, because the
// question fixity answers is "are the PINNED bytes on disk", and an install
// writes none of them:
//
// - `node_modules/`, at any depth, is excluded from every mount digest — the
//   lock's writer (`remote-mount.ts`), its replayer (this file) and both
//   `--check`s, through this one function. At any depth because bun's isolated
//   linker also writes into the SIBLING mounts a manifest's `workspaces` names
//   (`../cat-harnes[s]`). Nothing upstream tracks a `node_modules/` (measured
//   2026-10-12 over cat-harness, cat-harness-tools, bootstrap, bootstrap-tools
//   and two content layers: 0 paths), and `remote-mount.ts` refuses
//   to lay down a tree that does, so the exclusion can never hide a pinned byte.
// - The lockfile is NOT excluded: it is a pinned byte. The install runs with
//   `--no-save`, so bun writes no lockfile and edits no manifest, and the
//   lockfile's bytes are compared before and after and put back if anything
//   moved them — a mount stays verifiable by the same digest it was locked at.
//
// Old locks keep verifying: a digest over a tree with no `node_modules/` is
// the same with or without the exclusion.

/** Directory names an install writes and a mount never pins. */
export const INSTALL_ARTEFACT_DIRS: readonly string[] = ["node_modules"];

/** Is this tree-relative path inside an install artefact? */
export function isInstallArtefact(rel: string): boolean {
  return rel.split("/").some((seg) => INSTALL_ARTEFACT_DIRS.includes(seg));
}

/** `files` without anything an install wrote — what every mount digest hashes. */
export function withoutInstallArtefacts(files: readonly string[]): string[] {
  return files.filter((f) => !isInstallArtefact(f));
}

/** Lockfiles the install must leave byte-identical: they are pinned bytes. */
const LOCKFILES = ["bun.lock", "bun.lockb", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"];

export type InstallMode = "production" | "all";
export interface InstallOutcome {
  state: "installed" | "none" | "failed";
  detail: string;
}

/**
 * `bun install` in `dir` when it holds a `package.json`; nothing otherwise.
 * `production` (the default) skips devDependencies (`--omit dev`) — the mount is there to RUN
 * tools, and a typechecker or a browser is a per-session choice (`all`).
 * Leaves every lockfile as it found it; see the section comment above.
 */
/**
 * The enclosing `package.json` whose `workspaces` names `dir`, or undefined.
 *
 * A mounted layer that is a WORKSPACE MEMBER of the checkout's root is
 * installed by the root's own `bun install`. Installing it again from inside
 * the member is not local: bun resolves the whole workspace and rewrites the
 * ROOT `node_modules/` — and with `--omit dev` it does so without the dev
 * graph, so a package two versions of which coexist is re-hoisted to the
 * production one. Measured on folio-assistant#2529 (2026-10-14): eslint
 * (dev) needs ajv@6, the MCP SDK (prod) needs ajv@8; `state:mount` hoisted
 * ajv@8 over the root, and `bun run cat lint` failed with "Cannot find
 * module 'ajv/lib/refs/json-schema-draft-04.json'" after a clean
 * `--frozen-lockfile` install had laid down ajv@6.
 *
 * Patterns are matched literally or as a trailing `/*`, the two forms the
 * manifests here use; a pattern this cannot read never matches, so the
 * fallback is the old behaviour (install), not a skipped install.
 */
export function enclosingWorkspaceRoot(dir: string): string | undefined {
  const abs = resolve(dir);
  for (let up = dirname(abs); ; up = dirname(up)) {
    const manifest = join(up, "package.json");
    if (existsSync(manifest)) {
      let ws: unknown;
      try {
        ws = JSON.parse(readFileSync(manifest, "utf-8")).workspaces;
      } catch {
        ws = undefined;
      }
      const patterns = Array.isArray(ws) ? ws : Array.isArray((ws as { packages?: unknown })?.packages) ? (ws as { packages: unknown[] }).packages : [];
      const rel = relative(up, abs).split("\\").join("/");
      for (const p of patterns) {
        if (typeof p !== "string") continue;
        const pat = p.replace(/^\.\//, "").replace(/\/+$/, "");
        if (pat === rel) return up;
        if (pat.endsWith("/*") && dirname(rel) === pat.slice(0, -2)) return up;
      }
    }
    if (dirname(up) === up) return undefined;
  }
}

export function installDependencies(dir: string, mode: InstallMode = "production"): InstallOutcome {
  if (!existsSync(join(dir, "package.json"))) return { state: "none", detail: "no package.json" };
  const ws = enclosingWorkspaceRoot(dir);
  if (ws !== undefined) {
    return { state: "none", detail: `a workspace member of ${ws}: the root's own \`bun install\` provides its dependencies, and installing from inside it would re-hoist the root's node_modules` };
  }
  const before = new Map(LOCKFILES.map((f) => [f, existsSync(join(dir, f)) ? readFileSync(join(dir, f)) : undefined]));
  const bun = /bun(\.exe)?$/i.test(process.execPath) ? process.execPath : "bun";
  // `--omit dev`, not `--production`: bun's `--production` implies
  // `--frozen-lockfile`, so a mount whose lockfile is behind its package.json
  // ("lockfile had changes, but lockfile is frozen", cat-harness@73ff183) or
  // that bun reads as frozen-incompatible ("Unknown lockfile version",
  // cat-harness-tools@57721f6) failed to install, and every repository pinning
  // this mounter lost its tools (smart-ra#48). The lockfile is put back
  // byte-for-byte below either way, so not freezing it costs nothing.
  const args = ["install", "--no-save", ...(mode === "production" ? ["--omit", "dev"] : [])];
  // input-site: traced #b13c07a8 — bun install from the registry into a mount: the network, and a write: a run that installs records no hash
  inputSiteReached("mount-from-lock: bun install");
  const r = spawnSync(bun, args, { cwd: dir, encoding: "utf-8", maxBuffer: 1 << 26 });
  for (const [f, bytes] of before) {
    const abs = join(dir, f);
    const now = existsSync(abs) ? readFileSync(abs) : undefined;
    if (bytes === undefined && now !== undefined) rmSync(abs, { force: true });
    else if (bytes !== undefined && (now === undefined || !bytes.equals(now))) writeFileSync(abs, bytes);
  }
  if (r.status !== 0) {
    const why = (r.error?.message ?? (r.stderr || r.stdout || "")).trim().split("\n").slice(-3).join(" | ");
    return { state: "failed", detail: `\`bun ${args.join(" ")}\` exited ${r.status ?? r.signal}: ${why}` };
  }
  return { state: "installed", detail: `dependencies installed (\`bun ${args.join(" ")}\`; node_modules/ is outside the fixity digest)` };
}

// ── Reading the lock ─────────────────────────────────────────────────────────

/** The lock's name since 2026-10-07: the generated companion to `index.config.json`. */
export const INDEX_LOCK = "index.lock.json";
/** The retired name, `<root-instance>.mount-lock.json` — still READ, so a downstream folio or an old branch replays. */
export const LEGACY_LOCK_SUFFIX = ".mount-lock.json";

/**
 * The lock file(s) beside `root`: `index.lock.json`, else every legacy
 * `*.mount-lock.json`. BOTH present is an error naming both, never a merge.
 *
 * RESTATED from `lockFilesIn` in `schemas/kg/instance-roots.ts` rather than
 * imported, because this file imports nothing but `node:*` (the header says
 * why); `mount-from-lock.test.ts` holds the two to the same answers.
 */
export function lockNames(root: string): { names: string[]; conflict?: string } {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return { names: [] };
  }
  const legacy = entries.filter((n) => n.endsWith(LEGACY_LOCK_SUFFIX)).sort();
  if (entries.includes(INDEX_LOCK)) {
    if (legacy.length > 0) {
      return {
        names: [],
        conflict: `${join(root, INDEX_LOCK)} and ${legacy.map((n) => join(root, n)).join(", ")} both exist — one lock per checkout; keep ${INDEX_LOCK} (\`git mv\` the legacy one over it, or remove the stale one) rather than have two replayed`,
      };
    }
    return { names: [INDEX_LOCK] };
  }
  return { names: legacy };
}

/** Every lock beside `root` ({@link lockNames}), parsed structurally. A malformed one — or two that conflict — is an answer, not a skip. */
export function readLocks(root: string): { file: string; instances?: LockInstance[]; error?: string }[] {
  const { names, conflict } = lockNames(root);
  if (conflict !== undefined) return [{ file: join(root, INDEX_LOCK), error: conflict }];
  return names.map((n) => {
    const file = join(root, n);
    try {
      const raw = JSON.parse(readFileSync(file, "utf-8")) as { $schema?: unknown; instances?: unknown };
      if (raw.$schema !== "cat-harness-mount-lock/v1") return { file, error: `not a cat-harness-mount-lock/v1 lock` };
      if (!Array.isArray(raw.instances)) return { file, error: "no `instances` array" };
      const bad = (raw.instances as LockInstance[]).find(
        (i) =>
          typeof i?.instance !== "string" ||
          typeof i.repository !== "string" ||
          !SHA.test(String(i.sha)) ||
          typeof i.path !== "string" ||
          !Array.isArray(i.directories) ||
          i.directories.some((d) => typeof d?.path !== "string" || typeof d.upstreamPath !== "string" || !DIGEST.test(String(d.treeDigest))) ||
          (i.assets !== undefined && (!Array.isArray(i.assets) || i.assets.some((a) => typeof a?.src !== "string" || !DIGEST.test(String(a?.sha256))))),
      );
      if (bad) return { file, error: `instance \`${String((bad as { instance?: unknown })?.instance)}\` is malformed` };
      // A same-owner entry (a bare repository name) is fetched from the
      // owner of the checkout holding the lock: so a fork replays from the
      // fork and the WHO repository from WHO (cat-harness-tools#2337; the
      // rule is schemas/kg/repo-owner.ts, inlined because this script
      // imports only node:*).
      const instances = raw.instances as LockInstance[];
      if (!instances.some((i) => SAME_OWNER_NAME.test(i.repository))) return { file, instances };
      const owner = lockOwner(dirname(file));
      if (!owner) return { file, error: "the lock names a same-owner repository and this checkout's owner is unknown (set CAT_REPO_OWNER, or give the checkout an origin)" };
      return { file, instances: instances.map((i) => (SAME_OWNER_NAME.test(i.repository) ? { ...i, repository: `${owner}/${i.repository}` } : i)) };
    } catch (e) {
      return { file, error: `not JSON: ${(e as Error).message}` };
    }
  });
}

/** A bare repository name, with no owner: a same-owner name (schemas/kg/repo-owner.ts). */
const SAME_OWNER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The owner of the checkout at `dir`: CAT_REPO_OWNER, else origin's, else GITHUB_REPOSITORY_OWNER (schemas/kg/repo-owner.ts `checkoutOwner`). */
export function lockOwner(dir: string): string | undefined {
  // input-site: env CAT_REPO_OWNER #73a2ec1d — the owner a same-owner lock entry resolves to, when the environment names it
  const explicit = process.env.CAT_REPO_OWNER?.trim();
  if (explicit) return explicit;
  // input-site: traced #712f6302 — origin's URL, from this clone's git config: no fingerprint names it, so a run that reaches it records no hash
  inputSiteReached("mount-from-lock: origin's URL");
  const r = spawnSync("git", ["-C", dir, "remote", "get-url", "origin"], { encoding: "utf-8" });
  const url = r.status === 0 ? r.stdout.trim().replace(/\/+$/, "").replace(/\.git$/, "") : "";
  const o = url.match(/[/:]([A-Za-z0-9][A-Za-z0-9._-]*)\/[A-Za-z0-9][A-Za-z0-9._-]*$/)?.[1];
  // input-site: env GITHUB_REPOSITORY_OWNER #77acd249 — CI's owner, when the checkout has no origin
  return o ?? (process.env.GITHUB_REPOSITORY_OWNER?.trim() || undefined);
}

/** A lock path may not climb out of the root or land on it. */
function safeRel(p: string): boolean {
  const parts = p.split("/");
  return p !== "" && !p.startsWith("/") && !parts.includes("..") && !parts.some((s) => s.startsWith("."));
}

// ── git ──────────────────────────────────────────────────────────────────────

function git(cwd: string, args: string[]): { status: number; stdout: string; stderr: string } {
  // input-site: traced #46b21c90 — git for the mounts: fetches and pushes over the network, .git paths and history: a run that reaches it records no hash
  inputSiteReached("mount-from-lock: git");
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", maxBuffer: 1 << 28 });
  return { status: r.status ?? 128, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

export function urlFor(repository: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(repository) || repository.startsWith("/")) return repository;
  // input-site: env CAT_MOUNT_URL_PREFIX #ef16af8d — the mirror a mount is fetched from
  const prefix = process.env.CAT_MOUNT_URL_PREFIX;
  return prefix ? `${prefix.replace(/\/+$/, "")}/${repository}` : `https://github.com/${repository}.git`;
}

function tracked(root: string, rel: string): boolean {
  const r = git(root, ["ls-files", "--", rel]);
  return r.status === 0 && r.stdout.trim() !== "";
}

function ensureIgnored(root: string, rel: string): void {
  if (git(root, ["rev-parse", "--git-dir"]).status !== 0) return;
  if (git(root, ["check-ignore", "-q", "--no-index", `${rel}/`]).status === 0) return;
  const prefix = git(root, ["rev-parse", "--show-prefix"]).stdout.trim();
  const file = resolve(root, git(root, ["rev-parse", "--git-path", "info/exclude"]).stdout.trim());
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `# remote mount (bean nn8e) — bun run cat mount:lock\n/${prefix}${rel}/\n`);
}

// ── packages (bean `mo75` G2b) ───────────────────────────────────────────────

/**
 * A release-asset URL as fetched: `CAT_MOUNT_URL_PREFIX` replaces
 * `https://github.com`, as it does for a repository (tests serve `file://`).
 */
export function packageFetchUrl(url: string): string {
  // input-site: env CAT_MOUNT_URL_PREFIX #ef16af8d — the mirror a package is fetched from
  const prefix = process.env.CAT_MOUNT_URL_PREFIX;
  return prefix && url.startsWith("https://github.com/") ? `${prefix.replace(/\/+$/, "")}/${url.slice("https://github.com/".length)}` : url;
}

/**
 * How long one download may take. Without a limit curl waits for ever on a
 * server that accepts and sends nothing, and the mount waits with it (the
 * hydrated-mount test flake, cat-harness-tools#1712). The connection must open
 * within `connectS`. A transfer slower than `minBytesPerS` for `stallS` seconds
 * is a stall and is dropped. No attempt runs past `maxS` (curl's `--retry`
 * makes up to three). Each case is a fetch that failed (curl exit 28), never
 * an absence.
 */
export interface DownloadLimits {
  connectS: number;
  stallS: number;
  minBytesPerS: number;
  maxS: number;
}
export const DOWNLOAD_LIMITS: DownloadLimits = { connectS: 15, stallS: 30, minBytesPerS: 1024, maxS: 600 };

/** The curl arguments {@link download} runs. */
export function downloadArgs(url: string, dest: string, limits: DownloadLimits = DOWNLOAD_LIMITS): string[] {
  return [
    "-fsSL",
    "--retry", "2",
    "--connect-timeout", String(limits.connectS),
    "--speed-limit", String(limits.minBytesPerS),
    "--speed-time", String(limits.stallS),
    "--max-time", String(limits.maxS),
    "-o", dest,
    url,
  ];
}

/**
 * Download `url` to `dest` with curl, following redirects (a release asset
 * redirects to its storage), within {@link DOWNLOAD_LIMITS}. `absent` is a 404
 * — or, for `file://`, no such file — which a caller may read as "not
 * published"; every other failure, a timeout included, is a fetch that failed,
 * never an absence.
 */
export function download(url: string, dest: string, limits: DownloadLimits = DOWNLOAD_LIMITS): { ok: true } | { ok: false; absent: boolean; error: string } {
  mkdirSync(dirname(dest), { recursive: true });
  // input-site: traced #8d8b4703 — a download over the network: a run that downloads records no hash
  inputSiteReached("mount-from-lock: download");
  const r = spawnSync("curl", downloadArgs(url, dest, limits), { encoding: "utf-8" });
  if (r.error) return { ok: false, absent: false, error: `curl could not run: ${r.error.message}` };
  if (r.status === 0) return { ok: true };
  rmSync(dest, { force: true });
  // 22: an HTTP error (curl -f) — a 404 for an unpublished asset; 37: a file:// that is not there.
  const absent = r.status === 37 || (r.status === 22 && /\b404\b/.test(r.stderr ?? ""));
  const timedOut = r.status === 28 ? ` (timed out: no answer within ${limits.connectS} s, a stall of ${limits.stallS} s, or over ${limits.maxS} s)` : "";
  return { ok: false, absent, error: ((r.stderr ?? "").trim().split("\n").pop() || `curl exited ${r.status}`) + timedOut };
}

/**
 * Fetch a package tarball, refuse it unless it hashes to `sha256`, and unpack
 * it. Returns the package root (npm's `package/`); the caller removes `dir`.
 */
export function fetchPackage(url: string, expectSha256: string): { ok: true; dir: string; root: string } | { ok: false; absent: boolean; refused: boolean; error: string } {
  // input-site: inert #65ff2faf — the scratch directory a fetched package is unpacked in
  const dir = mkdtempSync(join(tmpdir(), "mount-package-"));
  const tgz = join(dir, "package.tgz");
  const got = download(packageFetchUrl(url), tgz);
  if (!got.ok) {
    rmSync(dir, { recursive: true, force: true });
    return { ok: false, absent: got.absent, refused: false, error: got.error };
  }
  const digest = sha256(readFileSync(tgz));
  if (digest !== expectSha256) {
    rmSync(dir, { recursive: true, force: true });
    return { ok: false, absent: false, refused: true, error: `${url} hashes to ${digest.slice(0, 12)}, expected ${expectSha256.slice(0, 12)} — refused` };
  }
  const out = join(dir, "x");
  mkdirSync(out);
  // input-site: inert #3fba2e57 — unpacks the tarball the traced download fetched and its sha-256 checked, into that scratch directory
  const t = spawnSync("tar", ["-xzf", tgz, "-C", out], { encoding: "utf-8" });
  if (t.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    return { ok: false, absent: false, refused: true, error: `${url} is not a gzipped tarball: ${(t.stderr ?? "").trim()}` };
  }
  return { ok: true, dir, root: join(out, "package") };
}

/** Shallow, blobless fetch of one commit, then a sparse checkout of `paths`. Returns the work tree. */
function fetchAt(repository: string, sha: string, paths: string[]): string {
  // input-site: inert #bb194b68 — the scratch directory a fetched commit is checked out in
  const dir = mkdtempSync(join(tmpdir(), "mount-from-lock-"));
  const steps: string[][] = [
    ["init", "-q"],
    ["fetch", "-q", "--depth", "1", "--filter=blob:none", urlFor(repository), sha],
    ["sparse-checkout", "set", "--no-cone", ...paths],
    ["checkout", "-q", "FETCH_HEAD"],
  ];
  for (const s of steps) {
    const r = git(dir, s);
    if (r.status !== 0) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`git ${s[0]} failed: ${r.stderr.trim().split("\n").pop() ?? r.status}`);
    }
  }
  const head = git(dir, ["rev-parse", "FETCH_HEAD"]).stdout.trim();
  if (head !== sha) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`the remote served ${head} for ${sha}`);
  }
  return dir;
}

// ── Earlier pins (bean folio-assistant-jstq) ───────────────────────────────

/**
 * How many earlier commits of a lock are read to recognise a stale mount.
 * folio-assistant's lock had 112 commits on 2026-11-05; reading them all took
 * well under a second. A mount older than this is refused as before.
 */
export const PRIOR_LOCK_DEPTH = 500;

/** Every digest an earlier committed version of one lock recorded, keyed by the root-relative path it pinned. */
export interface PriorPins {
  /** Directory path → the `treeDigest`s pinned there. */
  trees: Map<string, Set<string>>;
  /** File path (a declaration or an asset) → the `sha256`s pinned there. */
  blobs: Map<string, Set<string>>;
}

/**
 * The digests every committed version of `lockFile` (newest {@link PRIOR_LOCK_DEPTH})
 * pinned, read from the checkout's own history with no network.
 *
 * A mount whose bytes hash to one of them is exactly a tree some earlier lock
 * of THIS checkout laid down, so nobody edited it: it is a stale mount.
 * Measured 2026-11-05 (bean folio-assistant-jstq): every fresh folio-assistant
 * container held 20 locked directories at an older pin, each matching one of
 * these digests, and the replay refused all 20 as "somebody's work", so the
 * checkout ran on tools and declarations days older than its lock.
 *
 * Not a git checkout, or no history: empty, and every drift is refused as before.
 */
export function priorPins(root: string, lockFile: string, depth = PRIOR_LOCK_DEPTH): PriorPins {
  const out: PriorPins = { trees: new Map(), blobs: new Map() };
  const add = (m: Map<string, Set<string>>, k: string, v: unknown) => {
    if (typeof v !== "string") return;
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(v);
  };
  const rel = relative(root, lockFile).split("\\").join("/");
  const log = git(root, ["log", "--format=%H", "-n", String(depth), "--", rel]);
  if (log.status !== 0) return out;
  for (const h of log.stdout.split("\n").filter((l) => SHA.test(l))) {
    const shown = git(root, ["show", `${h}:${rel}`]);
    if (shown.status !== 0) continue;
    try {
      const l = JSON.parse(shown.stdout) as { instances?: LockInstance[] };
      for (const i of Array.isArray(l.instances) ? l.instances : []) {
        if (typeof i?.path !== "string") continue;
        if (i.declaration && typeof i.declaration.file === "string") add(out.blobs, `${i.path}/${i.declaration.file}`, i.declaration.sha256);
        for (const d of Array.isArray(i.directories) ? i.directories : []) if (typeof d?.path === "string") add(out.trees, d.path, d.treeDigest);
        for (const a of Array.isArray(i.assets) ? i.assets : []) if (typeof a?.src === "string") add(out.blobs, `${i.path}/${a.src}`, a.sha256);
      }
    } catch {
      // A commit whose lock is not JSON recognises nothing.
    }
  }
  return out;
}

/** Is the drifted `path` of `inst` exactly what an earlier pin laid there? */
function isOlderPin(root: string, inst: LockInstance, path: string, pins: PriorPins, skip: readonly string[]): boolean {
  const abs = join(root, path);
  if (inst.directories.some((d) => d.path === path)) return pins.trees.get(path)?.has(digestOf(abs, skip).treeDigest) === true;
  return pins.blobs.get(path)?.has(sha256(readFileSync(abs))) === true;
}

/** Where stale mounts are set aside while their replacement lands: inside the git dir, so nothing of it is ever in the worktree. */
function asideRoot(root: string): string | undefined {
  const r = git(root, ["rev-parse", "--git-path", "mount-prior"]);
  if (r.status !== 0) return undefined;
  const dir = resolve(root, r.stdout.trim());
  mkdirSync(dir, { recursive: true });
  return mkdtempSync(join(dir, "set-aside-"));
}

/**
 * What of a set-aside mount is carried into its replacement: each state mount
 * under it (the state store's bytes, never the pin's: `state:push` judges
 * them) and its top-level `node_modules/` (an install artefact; remote-mount
 * keeps it on a re-mount for the reason its test 19c gives).
 */
function carryOver(from: string, to: string, stateDirs: readonly string[]): string[] {
  const kept: string[] = [];
  const under = stateDirs.filter((s) => s.startsWith(to + "/"));
  for (const rel of [...under.map((s) => relative(to, s)), "node_modules"]) {
    const src = join(from, rel);
    if (!existsSync(src)) continue;
    const dst = join(to, rel);
    rmSync(dst, { recursive: true, force: true });
    mkdirSync(dirname(dst), { recursive: true });
    renameSync(src, dst);
    kept.push(rel);
  }
  return kept;
}

// ── One layer ─────────────────────────────────────────────────────────────

/** Is every locked directory of `inst` on disk with the locked digest? Lists the ones that are not. */
function drift(root: string, inst: LockInstance): { absent: string[]; changed: string[] } {
  const absent: string[] = [];
  const changed: string[] = [];
  const decl = join(root, inst.path, inst.declaration.file);
  // A hydrated mount's declaration is recorded, never laid down: nothing to compare.
  if (!inst.hydrated && !existsSync(decl)) absent.push(`${inst.path}/${inst.declaration.file}`);
  else if (!inst.hydrated && sha256(readFileSync(decl)) !== inst.declaration.sha256) changed.push(`${inst.path}/${inst.declaration.file}`);
  const skip = stateMountedDirs(root);
  for (const d of inst.directories) {
    const abs = join(root, d.path);
    if (!existsSync(abs)) absent.push(d.path);
    else if (digestOf(abs, skip).treeDigest !== d.treeDigest) changed.push(d.path);
  }
  for (const a of inst.assets ?? []) {
    const abs = join(root, inst.path, a.src);
    if (!existsSync(abs)) absent.push(`${inst.path}/${a.src}`);
    else if (sha256(readFileSync(abs)) !== a.sha256) changed.push(`${inst.path}/${a.src}`);
  }
  return { absent, changed };
}

export function checkInstance(root: string, inst: LockInstance, prior?: () => PriorPins): Outcome {
  const { absent, changed } = drift(root, inst);
  if (changed.length) {
    const pins = prior?.();
    const skip = stateMountedDirs(root);
    const stale = pins !== undefined && changed.every((p) => isOlderPin(root, inst, p, pins, skip));
    const why = stale ? " (an earlier pin's bytes, not an edit: `bun run cat mount:lock` replaces them)" : "";
    return { instance: inst.instance, state: "missing", detail: `${changed.join(", ")} no longer hash to the lock${why}` };
  }
  if (absent.length) return { instance: inst.instance, state: "missing", detail: `not on disk: ${absent.join(", ")} — run \`bun run cat mount:lock\`` };
  return { instance: inst.instance, state: "current", detail: `${inst.directories.length} director${inst.directories.length === 1 ? "y" : "ies"} at ${inst.sha.slice(0, 12)}` };
}

/**
 * Optional content-addressed cache directory (`CAT_MOUNT_CACHE_DIR`,bean `cis1`).
 * Disabled when `CAT_MOUNT_URL_PREFIX` is set (unless `CAT_MOUNT_CACHE_FORCE=1`)
 * so fixture tests serving local bare repositories never cross-contaminate.
 * Every cached directory is keyed by its 64-hex `treeDigest` and re-verified by
 * `digestOf(dst).treeDigest === d.treeDigest` on restore; every declaration or
 * asset blob is keyed by its `sha256` and re-verified on restore.
 */
function mountCacheDir(): string | undefined {
  // input-site: env CAT_MOUNT_CACHE_DIR #23fa0fe5 — where fetched mounts are cached
  const dir = process.env.CAT_MOUNT_CACHE_DIR?.trim();
  if (!dir) return undefined;
  // input-site: env CAT_MOUNT_URL_PREFIX,CAT_MOUNT_CACHE_FORCE #dd8edd4b — whether the mount cache is used under a mirror
  if (process.env.CAT_MOUNT_URL_PREFIX && process.env.CAT_MOUNT_CACHE_FORCE !== "1") return undefined;
  return resolve(dir);
}

/**
 * Where a ready-made copy of a layer's locked bytes sits: a local
 * content-addressed cache, or the shared layers cache ref. Every path it
 * names is UNTRUSTED — {@link layDownFrom} verifies each against the lock.
 */
interface MountSource {
  label: string;
  decl(inst: LockInstance): string;
  dir(inst: LockInstance, d: LockDir): string;
  asset(inst: LockInstance, a: LockAsset): string;
  /** Told when a directory's copy did not hash to the lock (the local cache drops it). */
  onBadDir?(inst: LockInstance, d: LockDir): void;
}

/**
 * Lay the ABSENT parts of `inst` down from `src`, verifying every byte
 * against the lock exactly as the fetch route does: the declaration's and
 * each asset's sha256, each directory's `treeDigest`. Anything missing or
 * mismatched undoes what this wrote and answers `undefined`, so the caller
 * falls back to the per-repository fetch — a stale or tampered source costs
 * time, never correctness.
 */
function layDownFrom(root: string, inst: LockInstance, absent: readonly string[], src: MountSource): Outcome | undefined {
  const declSrc = src.decl(inst);
  if (!inst.hydrated && (!existsSync(declSrc) || sha256(readFileSync(declSrc)) !== inst.declaration.sha256)) return undefined;
  for (const d of inst.directories) if (absent.includes(d.path) && !existsSync(src.dir(inst, d))) return undefined;
  for (const a of inst.assets ?? []) {
    if (!absent.includes(`${inst.path}/${a.src}`)) continue;
    const blob = src.asset(inst, a);
    if (!existsSync(blob) || sha256(readFileSync(blob)) !== a.sha256) return undefined;
  }
  const written: string[] = [];
  const undo = (): undefined => {
    for (const w of written) rmSync(join(root, w), { recursive: true, force: true });
    return undefined;
  };
  for (const d of inst.directories) {
    if (!absent.includes(d.path)) continue;
    const dst = join(root, d.path);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src.dir(inst, d), dst, { recursive: true, verbatimSymlinks: true, force: true });
    written.push(d.path);
    if (digestOf(dst).treeDigest !== d.treeDigest) {
      src.onBadDir?.(inst, d);
      return undo();
    }
  }
  for (const a of inst.assets ?? []) {
    if (!absent.includes(`${inst.path}/${a.src}`)) continue;
    const dst = join(root, inst.path, a.src);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src.asset(inst, a), dst, { force: true });
    written.push(join(inst.path, a.src));
    if (sha256(readFileSync(dst)) !== a.sha256) return undo();
  }
  const declDst = join(root, inst.path, inst.declaration.file);
  if (!inst.hydrated && !existsSync(declDst)) {
    mkdirSync(dirname(declDst), { recursive: true });
    cpSync(declSrc, declDst);
  }
  ensureIgnored(root, inst.path);
  for (const d of inst.directories) ensureIgnored(root, d.path);
  const files = inst.directories.reduce((n, d) => n + d.files, 0) + (inst.assets?.length ?? 0);
  return { instance: inst.instance, state: "mounted", detail: `${written.length} director${written.length === 1 ? "y" : "ies"}, ${files} file(s) from ${inst.repository}@${inst.sha.slice(0, 12)} (${src.label})` };
}

function localCacheSource(cacheDir: string): MountSource {
  return {
    label: "local mount cache",
    decl: (inst) => join(cacheDir, "blobs", inst.declaration.sha256),
    dir: (_inst, d) => join(cacheDir, "trees", d.treeDigest),
    asset: (_inst, a) => join(cacheDir, "blobs", a.sha256),
    onBadDir: (_inst, d) => rmSync(join(cacheDir, "trees", d.treeDigest), { recursive: true, force: true }),
  };
}

function tryMountFromCache(root: string, inst: LockInstance, absent: readonly string[], cacheDir: string): Outcome | undefined {
  return layDownFrom(root, inst, absent, localCacheSource(cacheDir));
}

function saveToMountCache(cacheDir: string, inst: LockInstance, root: string): void {
  try {
    const blobsDir = join(cacheDir, "blobs");
    const treesDir = join(cacheDir, "trees");
    mkdirSync(blobsDir, { recursive: true });
    mkdirSync(treesDir, { recursive: true });
    const declDst = join(root, inst.path, inst.declaration.file);
    const declCache = join(blobsDir, inst.declaration.sha256);
    if (existsSync(declDst) && !existsSync(declCache)) cpSync(declDst, declCache);
    for (const d of inst.directories) {
      const dst = join(root, d.path);
      const treeCache = join(treesDir, d.treeDigest);
      if (existsSync(dst) && !existsSync(treeCache)) {
        cpSync(dst, treeCache, { recursive: true, verbatimSymlinks: true, force: true });
      }
    }
    for (const a of inst.assets ?? []) {
      const dst = join(root, inst.path, a.src);
      const blobCache = join(blobsDir, a.sha256);
      if (existsSync(dst) && !existsSync(blobCache)) cpSync(dst, blobCache);
    }
  } catch {
    // Cache population is best-effort and never alters mount outcome.
  }
}

export function mountInstance(root: string, inst: LockInstance, layers?: LayersCache, prior?: () => PriorPins): Outcome {
  const id = inst.instance;
  const bad = [inst.path, ...inst.directories.map((d) => d.path)].find((p) => !safeRel(p));
  if (bad !== undefined) return { instance: id, state: "could-not-determine", detail: `lock path \`${bad}\` climbs out of the checkout or is dot-prefixed` };
  const { absent, changed } = drift(root, inst);
  if (changed.length === 0) return absent.length === 0 ? checkInstance(root, inst) : layDown(root, inst, absent, layers);
  const refuse = (paths: readonly string[]): Outcome => ({
    instance: id,
    state: "missing",
    detail: `left untouched: ${paths.join(", ")} no longer hash to the lock — edits there are somebody's work; move them upstream or delete the directory, then re-mount`,
  });
  // A drift is replaced only when EVERY drifted path is an earlier pin's
  // exact bytes: one edited path keeps the whole layer as it stands.
  const pins = prior?.();
  const stateDirs = stateMountedDirs(root);
  const edited = pins === undefined ? changed : changed.filter((p) => !isOlderPin(root, inst, p, pins, stateDirs));
  if (edited.length) return refuse(edited);
  const trackedPath = changed.find((p) => tracked(root, p));
  if (trackedPath) return { instance: id, state: "missing", detail: `\`${trackedPath}\` holds tracked files — a mount never lands on tracked bytes` };
  const holder = asideRoot(root);
  if (holder === undefined) return refuse(changed);
  // Outermost first, so a declaration inside a set-aside directory moves with it.
  const outer = [...changed].sort((a, b) => a.length - b.length).filter((p, i, all) => !all.slice(0, i).some((q) => p.startsWith(q + "/")));
  const aside = outer.map((p, i) => ({ path: p, at: join(holder, String(i)) }));
  const restore = () => {
    for (const a of aside) {
      if (!existsSync(a.at)) continue;
      rmSync(join(root, a.path), { recursive: true, force: true });
      mkdirSync(dirname(join(root, a.path)), { recursive: true });
      renameSync(a.at, join(root, a.path));
    }
  };
  try {
    for (const a of aside) renameSync(join(root, a.path), a.at);
    const out = layDown(root, inst, [...new Set([...absent, ...changed])], layers);
    if (out.state !== "mounted") {
      restore();
      return { ...out, detail: `${out.detail}; the earlier pin's ${outer.join(", ")} restored as it was` };
    }
    const kept = aside.flatMap((a) => carryOver(a.at, join(root, a.path), stateDirs).map((k) => `${a.path}/${k}`));
    out.detail += `; replaced an earlier pin's ${outer.join(", ")}${kept.length ? `, keeping ${kept.join(", ")}` : ""}`;
    return out;
  } catch (e) {
    restore();
    return { instance: id, state: "could-not-determine", detail: `could not replace the earlier pin's ${outer.join(", ")}: ${(e as Error).message} — restored as it was` };
  } finally {
    rmSync(holder, { recursive: true, force: true });
  }
}

/** Fetch and lay down the `absent` paths of `inst`, verifying each against the lock. */
function layDown(root: string, inst: LockInstance, absent: readonly string[], layers?: LayersCache): Outcome {
  const id = inst.instance;
  const trackedPath = inst.directories.map((d) => d.path).find((p) => tracked(root, p));
  if (trackedPath) return { instance: id, state: "missing", detail: `\`${trackedPath}/\` holds tracked files — a mount never lands on tracked bytes` };

  // A hydrated mount is one small file per directory: re-fetched, never cached,
  // because the cache restores a declaration this mount must not lay down.
  const cacheDir = inst.hydrated ? undefined : mountCacheDir();
  if (cacheDir) {
    const cached = tryMountFromCache(root, inst, absent, cacheDir);
    if (cached) return cached;
  }
  const shared = layers?.source();
  if (shared) {
    const hit = layDownFrom(root, inst, absent, shared);
    if (hit) return hit;
    layers!.fellBack.push(inst.instance);
  }

  const upstreamDecl = inst.upstreamRoot ? `${inst.upstreamRoot.replace(/\/+$/, "")}/${inst.declaration.file}` : inst.declaration.file;
  const assetPaths = (inst.assets ?? []).map((a) => {
    const p = inst.upstreamRoot ? `${inst.upstreamRoot.replace(/\/+$/, "")}/${a.src}` : a.src;
    return `/${p}`;
  });
  const sparse = [
    `/${upstreamDecl}`,
    // A directory from the pin's package is not in its git tree (G2b).
    ...inst.directories.filter((d) => !d.package).map((d) =>
      inst.hydrated ? `/${d.upstreamPath.replace(/\/+$/, "")}/${HYDRATED_FILE}` : d.upstreamPath === "." ? "/*" : `/${d.upstreamPath.replace(/\/+$/, "")}/`,
    ),
    ...assetPaths,
    // A whole mount's switched-off opt-in sub-graphs: excluded after the `/*` that would bring them.
    ...inst.directories.flatMap((d) =>
      (d.except ?? []).filter((e) => !e.split("/").includes("..")).map((e) => (d.upstreamPath === "." ? `!/${e}/` : `!/${d.upstreamPath.replace(/\/+$/, "")}/${e}/`)),
    ),
  ];
  /** Unpacked packages, by URL: one fetch per tarball, removed below. */
  const packages = new Map<string, string>();
  let work: string;
  try {
    work = fetchAt(inst.repository, inst.sha, sparse);
  } catch (e) {
    return { instance: id, state: "could-not-determine", detail: `could not fetch ${inst.repository}@${inst.sha.slice(0, 12)}: ${(e as Error).message}` };
  }
  try {
    const written: string[] = [];
    const declSrc = join(work, upstreamDecl);
    if (!existsSync(declSrc) || sha256(readFileSync(declSrc)) !== inst.declaration.sha256) {
      return { instance: id, state: "could-not-determine", detail: `the declaration \`${upstreamDecl}\` at ${inst.sha.slice(0, 12)} is absent or does not hash to the lock` };
    }
    for (const d of inst.directories) {
      if (!absent.includes(d.path)) continue;
      let src = d.upstreamPath === "." ? work : join(work, d.upstreamPath, ...(inst.hydrated ? [HYDRATED_FILE] : []));
      if (d.package) {
        let pkgRoot = packages.get(d.package.url);
        if (!pkgRoot) {
          const got = fetchPackage(d.package.url, d.package.sha256);
          if (!got.ok) {
            for (const w of written) rmSync(join(root, w), { recursive: true, force: true });
            return { instance: id, state: got.absent ? "missing" : "could-not-determine", detail: `the subgraph index package for \`${d.path}\`: ${got.error}` };
          }
          packages.set(d.package.url, got.root);
          pkgRoot = got.root;
        }
        const member = d.package.member.split("/");
        if (member.some((seg) => seg === ".." || seg === "")) return { instance: id, state: "could-not-determine", detail: `lock package member \`${d.package.member}\` climbs or is empty` };
        src = join(pkgRoot, ...member);
      }
      if (!existsSync(src)) {
        for (const w of written) rmSync(join(root, w), { recursive: true, force: true });
        return { instance: id, state: "missing", detail: `\`${inst.hydrated ? `${d.upstreamPath}/${HYDRATED_FILE}` : d.upstreamPath}\` is not in ${inst.repository}@${inst.sha.slice(0, 12)}, though the lock records it` };
      }
      const dst = join(root, d.path);
      mkdirSync(inst.hydrated ? dst : dirname(dst), { recursive: true });
      if (inst.hydrated) cpSync(src, join(dst, HYDRATED_FILE), { force: true });
      else cpSync(src, dst, { recursive: true, verbatimSymlinks: true, force: true, filter: (from) => from !== join(work, ".git") });
      written.push(d.path);
      const got = digestOf(dst).treeDigest;
      if (got !== d.treeDigest) {
        for (const w of written) rmSync(join(root, w), { recursive: true, force: true });
        return { instance: id, state: "could-not-determine", detail: `\`${d.path}\` fetched at ${inst.sha.slice(0, 12)} hashes to ${got.slice(0, 12)}, the lock says ${d.treeDigest.slice(0, 12)} — removed, not kept` };
      }
    }
    for (const a of inst.assets ?? []) {
      if (!absent.includes(`${inst.path}/${a.src}`)) continue;
      const p = inst.upstreamRoot ? `${inst.upstreamRoot.replace(/\/+$/, "")}/${a.src}` : a.src;
      const src = join(work, p);
      if (!existsSync(src)) {
        for (const w of written) rmSync(join(root, w), { recursive: true, force: true });
        return { instance: id, state: "missing", detail: `asset \`${a.src}\` is not in ${inst.repository}@${inst.sha.slice(0, 12)}, though the lock records it` };
      }
      const dst = join(root, inst.path, a.src);
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(src, dst, { force: true });
      written.push(join(inst.path, a.src));
      const got = sha256(readFileSync(dst));
      if (got !== a.sha256) {
        for (const w of written) rmSync(join(root, w), { recursive: true, force: true });
        return { instance: id, state: "could-not-determine", detail: `asset \`${a.src}\` fetched at ${inst.sha.slice(0, 12)} hashes to ${got.slice(0, 12)}, the lock says ${a.sha256.slice(0, 12)} — removed, not kept` };
      }
    }
    const declDst = join(root, inst.path, inst.declaration.file);
    if (!inst.hydrated && !existsSync(declDst)) {
      mkdirSync(dirname(declDst), { recursive: true });
      cpSync(declSrc, declDst);
    }
    if (cacheDir) saveToMountCache(cacheDir, inst, root);
    ensureIgnored(root, inst.path);
    for (const d of inst.directories) ensureIgnored(root, d.path);
    const files = inst.directories.reduce((n, d) => n + d.files, 0) + (inst.assets?.length ?? 0);
    return { instance: id, state: "mounted", detail: `${written.length} director${written.length === 1 ? "y" : "ies"}, ${files} file(s) from ${inst.repository}@${inst.sha.slice(0, 12)}` };
  } finally {
    rmSync(work, { recursive: true, force: true });
    for (const r of packages.values()) rmSync(dirname(dirname(r)), { recursive: true, force: true });
  }
}

// ── The shared layers cache ref ──────────────────────────────────────────────
//
// Replaying a lock fetches every pinned layer from its own repository: one
// round trip, one negotiation, one sparse checkout per layer. The layers
// cache is ONE git commit in the INDEX repository whose tree is the composed
// overlay this file lays down — each locked directory at its mount path, each
// declaration and asset, nothing an install or a state mount wrote — so a
// fresh checkout mounts every layer with one shallow fetch.
//
// It is keyed by the lock: `refs/cat/layers/<sha256 of the lock's
// instances>`, plus a moving `refs/cat/layers/main` that the writer on main
// updates. The lock stays the SOLE authority. The cache is untrusted: every
// byte taken from it is verified by {@link layDownFrom} exactly as a fetched
// byte is, a layer whose copy does not verify falls back to its own
// repository, and a missing ref falls back for all of them. So a stale cache
// (`main` after a re-pin) still serves every layer that did not move, and a
// tampered one can cost time, never correctness. Trust was checked when the
// lock was written; nothing here changes that.
//
// Whoever writes the lock writes the ref: `bun run cat layers:publish`
// (this file's `--publish`) over a checkout whose mounts `--check` reads
// current. It refuses any other state, so it can only publish bytes that
// already hash to the lock.

/** The ref namespace, in the index repository. */
export const LAYERS_REF_PREFIX = "refs/cat/layers/";
/** The moving ref the writer on main updates. */
export const LAYERS_MAIN_REF = `${LAYERS_REF_PREFIX}main`;

/** The key of a lock: sha256 of its `instances`, as committed. */
export function layersKey(instances: readonly LockInstance[]): string {
  return sha256(JSON.stringify(instances));
}
export const layersRef = (key: string): string => `${LAYERS_REF_PREFIX}${key}`;

/**
 * Where a publisher that may push only `claude/` branches (an agent sandbox)
 * leaves a layers commit instead: `refs/heads/claude/cat-layers/<key>`. The
 * layers-move workflow (`layer-layers-move.yml`) moves it to
 * `refs/cat/layers/<key>` and deletes the branch; the runner only moves a
 * ref, it never builds one (owner, 2026-11-10, card "B. Branch + small mover").
 */
export const LAYERS_BRANCH_PREFIX = "refs/heads/claude/cat-layers/";
export const layersBranchOf = (ref: string): string => `${LAYERS_BRANCH_PREFIX}${ref.slice(LAYERS_REF_PREFIX.length)}`;

/**
 * Where the cache lives: `CAT_LAYERS_URL`, else the root's `origin`.
 * `CAT_LAYERS_CACHE=0` turns the fast path off.
 */
export function layersUrl(root: string): string | undefined {
  // input-site: env CAT_LAYERS_CACHE #7372dc86 — whether the layers cache is used
  if (process.env.CAT_LAYERS_CACHE === "0") return undefined;
  // input-site: env CAT_LAYERS_URL #fd0cb617 — the remote the layers cache is fetched from
  const env = process.env.CAT_LAYERS_URL?.trim();
  if (env) return env;
  const r = git(root, ["remote", "get-url", "origin"]);
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : undefined;
}

/** What `layers:check` found. */
export interface LayersCheck {
  ok: boolean;
  /** `skipped` when `--changed-from` was given and the lock did not change. */
  /** `pending` when the commit waits on its `claude/cat-layers/` branch for the mover. */
  state: "published" | "pending" | "missing" | "skipped" | "error";
  key?: string;
  detail: string;
}

/**
 * The gate behind "whoever re-pins publishes": the layers ref for THIS lock
 * (`refs/cat/layers/<key>`) must exist at the index remote. It only asks
 * (`git ls-remote`); it never builds or pushes, so it is cheap on a CI runner,
 * and the publish stays on the re-pinner's machine (`layers:publish`, which
 * `mount:remote` already runs after it changes the lock). With `changedFrom`,
 * a lock identical to that revision's is `skipped`: only a re-pin owes a ref.
 */
export function checkLayers(root: string, opts: { url?: string; changedFrom?: string } = {}): LayersCheck {
  const locks = readLocks(root);
  if (locks.length === 0) return { ok: true, state: "skipped", detail: `no ${INDEX_LOCK} in ${root}` };
  if (locks.length !== 1) return { ok: false, state: "error", detail: "more than one lock — check one index at a time" };
  const lock = locks[0]!;
  if (lock.error) return { ok: false, state: "error", detail: lock.error };
  if (opts.changedFrom) {
    const rel = relative(root, lock.file);
    const before = git(root, ["show", `${opts.changedFrom}:${rel}`]);
    if (before.status === 0 && before.stdout === readFileSync(lock.file, "utf-8")) {
      return { ok: true, state: "skipped", detail: `${rel} is unchanged from ${opts.changedFrom}; no re-pin, no ref owed` };
    }
  }
  const key = layersKey(lock.instances!);
  const ref = layersRef(key);
  // input-site: env CAT_LAYERS_URL #f9e8ffa9 — the remote the layers cache is fetched from
  const url = opts.url ?? process.env.CAT_LAYERS_URL?.trim() ?? layersUrl(root);
  if (!url) return { ok: false, state: "error", key, detail: "no index remote to ask (pass --url or set CAT_LAYERS_URL)" };
  const ls = git(root, ["ls-remote", url, ref]);
  if (ls.status !== 0) return { ok: false, state: "error", key, detail: `git ls-remote ${url} failed: ${ls.stderr.trim().split("\n").pop()}` };
  if (ls.stdout.trim()) return { ok: true, state: "published", key, detail: `${ref.slice(0, LAYERS_REF_PREFIX.length + 12)}… is at ${url}` };
  const branch = git(root, ["ls-remote", url, layersBranchOf(ref)]);
  if (branch.status === 0 && branch.stdout.trim()) {
    return { ok: false, state: "pending", key, detail: `${ref.slice(0, LAYERS_REF_PREFIX.length + 12)}… waits on ${layersBranchOf(ref).slice("refs/heads/".length, LAYERS_BRANCH_PREFIX.length + 12)}… at ${url} for the layers-move workflow` };
  }
  return {
    ok: false,
    state: "missing",
    key,
    detail: `${ref.slice(0, LAYERS_REF_PREFIX.length + 12)}… is not at ${url}. Whoever changed ${INDEX_LOCK} publishes it from their own checkout: \`bun run cat layers:publish\` (a fresh clone of the IG takes every layer from that one fetch)`,
  };
}

/** A lazily fetched layers cache: fetched the first time a layer needs it, at most once. */
export interface LayersCache {
  /** The ref that served, once fetched; `undefined` on a miss. */
  ref?: string;
  /** Layers whose cached copy did not verify and were fetched from their own repository. */
  fellBack: string[];
  /** Why there is no source, when there is none. */
  miss?: string;
  source(): MountSource | undefined;
  dispose(): void;
}

export function openLayersCache(url: string | undefined, key: string): LayersCache {
  let tried = false;
  let dir: string | undefined;
  let src: MountSource | undefined;
  const cache: LayersCache = {
    fellBack: [],
    source() {
      if (tried) return src;
      tried = true;
      if (!url) {
        cache.miss = "no index remote (set CAT_LAYERS_URL, or CAT_LAYERS_CACHE=0 to stop looking)";
        return undefined;
      }
      // input-site: inert #a4a83a8c — the scratch directory a cached layer set is fetched into
      dir = mkdtempSync(join(tmpdir(), "mount-layers-"));
      if (git(dir, ["init", "-q"]).status !== 0) return undefined;
      for (const ref of [layersRef(key), LAYERS_MAIN_REF]) {
        if (git(dir, ["fetch", "-q", "--depth", "1", url, ref]).status !== 0) continue;
        if (git(dir, ["checkout", "-q", "FETCH_HEAD"]).status !== 0) continue;
        cache.ref = ref;
        const at = dir;
        src = {
          label: `layers cache ${ref === LAYERS_MAIN_REF ? "main" : key.slice(0, 12)}`,
          decl: (inst) => join(at, inst.path, inst.declaration.file),
          dir: (_inst, d) => join(at, d.path),
          asset: (inst, a) => join(at, inst.path, a.src),
        };
        return src;
      }
      cache.miss = `neither ${layersRef(key).slice(0, LAYERS_REF_PREFIX.length + 12)}… nor ${LAYERS_MAIN_REF} at the index remote`;
      return undefined;
    },
    dispose() {
      if (dir) rmSync(dir, { recursive: true, force: true });
    },
  };
  return cache;
}

/** One entry of the overlay tree: a path, its git mode, and the file (or link target) it holds. */
interface OverlayEntry {
  path: string;
  mode: "100644" | "100755" | "120000";
  abs: string;
}

/** Symlinks under `dir` that are not install artefacts — laid down by the fetch route, so carried too. */
function treeLinks(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const rel = relative(dir, p).split("\\").join("/");
      if (isInstallArtefact(rel)) continue;
      if (e.isSymbolicLink()) out.push(rel);
      else if (e.isDirectory()) walk(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

/** The composed overlay of every locked layer, as `mount-from-lock` lays it down. */
export function overlayEntries(root: string, instances: readonly LockInstance[]): OverlayEntry[] {
  const skip = stateMountedDirs(root);
  const out = new Map<string, OverlayEntry>();
  const add = (path: string, abs: string, link = false): void => {
    const mode = link ? "120000" : lstatSync(abs).mode & 0o111 ? "100755" : "100644";
    out.set(path, { path, mode, abs });
  };
  for (const inst of instances) {
    if (!inst.hydrated) add(`${inst.path}/${inst.declaration.file}`, join(root, inst.path, inst.declaration.file));
    for (const d of inst.directories) {
      const abs = join(root, d.path);
      const base = d.path.replace(/\/+$/, "");
      for (const f of coveredFiles(abs, skip)) add(`${base}/${f}`, join(abs, f));
      for (const l of withoutStateMounts(abs, treeLinks(abs), skip)) add(`${base}/${l}`, join(abs, l), true);
    }
    for (const a of inst.assets ?? []) add(`${inst.path}/${a.src}`, join(root, inst.path, a.src));
  }
  return [...out.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export interface PublishResult {
  ok: boolean;
  detail: string;
  key?: string;
  commit?: string;
  refs?: string[];
  pruned?: string[];
  /** The commit was left on its `claude/cat-layers/` branch for the mover. */
  viaBranch?: boolean;
}

/**
 * The mover (runner side): for THIS lock's key, take the commit a sandbox left
 * on `claude/cat-layers/<key>`, check that it is a layers commit for that key,
 * push it to `refs/cat/layers/<key>` and delete the branch. It builds nothing.
 */
export function moveLayers(root: string, opts: { url?: string; changedFrom?: string } = {}): LayersCheck {
  const c = checkLayers(root, opts);
  if (c.state !== "pending") return c;
  const ref = layersRef(c.key!);
  const branch = layersBranchOf(ref);
  // input-site: env CAT_LAYERS_URL #e24189fa — the remote the layers cache is fetched from
  const url = opts.url ?? process.env.CAT_LAYERS_URL?.trim() ?? layersUrl(root)!;
  // input-site: inert #6f8126bd — the scratch repository a layers move is built in, removed in the finally below; its name never reaches an answer
  const scratch = mkdtempSync(join(tmpdir(), "layers-move-"));
  try {
    const run = (args: string[]) => git(scratch, args);
    if (run(["init", "-q"]).status !== 0) return { ok: false, state: "error", key: c.key, detail: "git init failed" };
    const f = run(["fetch", "-q", "--depth", "1", "--filter=blob:none", url, branch]);
    if (f.status !== 0) return { ok: false, state: "error", key: c.key, detail: `fetching ${branch} failed: ${f.stderr.trim().split("\n").pop()}` };
    const subject = run(["log", "-1", "--format=%s", "FETCH_HEAD"]).stdout.trim();
    if (subject !== `cat layers ${c.key}`) return { ok: false, state: "error", key: c.key, detail: `${branch} is not this lock's layers commit (its subject is "${subject}")` };
    const sha = run(["rev-parse", "FETCH_HEAD"]).stdout.trim();
    const p = run(["push", "-q", "--force", url, `${sha}:${ref}`, `:${branch}`]);
    if (p.status !== 0) return { ok: false, state: "error", key: c.key, detail: `moving ${sha.slice(0, 12)} to ${ref} failed: ${p.stderr.trim().split("\n").pop()}` };
    return { ok: true, state: "published", key: c.key, detail: `moved ${sha.slice(0, 12)} from ${branch.slice("refs/heads/".length)} to ${ref.slice(0, LAYERS_REF_PREFIX.length + 12)}…` };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const IDENTITY = { GIT_AUTHOR_NAME: "cat layers", GIT_AUTHOR_EMAIL: "cat-layers@users.noreply.github.com", GIT_COMMITTER_NAME: "cat layers", GIT_COMMITTER_EMAIL: "cat-layers@users.noreply.github.com" };

function gitEnv(cwd: string, args: string[], env: Record<string, string>, input?: string): { status: number; stdout: string; stderr: string } {
  // input-site: traced #ac10aa1b — git publishing or pruning the layers cache over the network: a run that reaches it records no hash
  inputSiteReached("mount-from-lock: git (layers)");
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", maxBuffer: 1 << 28, env: { ...process.env, ...env }, input });
  return { status: r.status ?? 128, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/**
 * Build the overlay commit for `root`'s lock and (unless `push: false`) push
 * it to `refs/cat/layers/<key>` — and, with `main`, to `refs/cat/layers/main`.
 * Refuses unless every locked layer reads `current`: only bytes that hash
 * to the lock are ever published.
 */
export function publishLayers(root: string, opts: { url?: string; main?: boolean; push?: boolean; prune?: number; keep?: string[] } = {}): PublishResult {
  const locks = readLocks(root);
  if (locks.length !== 1) return { ok: false, detail: locks.length === 0 ? `no ${INDEX_LOCK} in ${root}` : "more than one lock — publish one index at a time" };
  const lock = locks[0]!;
  if (lock.error) return { ok: false, detail: lock.error };
  const instances = lock.instances!;
  const notCurrent = instances.map((i) => checkInstance(root, i)).filter((o) => o.state !== "current");
  if (notCurrent.length) return { ok: false, detail: `refused — not every mount hashes to the lock (run \`bun run cat mount:lock\` first): ${notCurrent.map((o) => `${o.instance}: ${o.detail}`).join("; ")}` };
  const key = layersKey(instances);
  const url = opts.url ?? layersUrl(root);
  if (opts.push !== false && !url) return { ok: false, key, detail: "no index remote to push to (pass --url or set CAT_LAYERS_URL)" };
  const entries = overlayEntries(root, instances);
  // input-site: inert #b3e2b40b — the scratch index and object store a layers commit is built in
  const scratch = mkdtempSync(join(tmpdir(), "layers-publish-"));
  try {
    // Every object goes to a SCRATCH object directory (the root's own is only
    // read, as an alternate), so a publish leaves no loose objects behind in
    // the index checkout: ~32k for folio-assistant's lock, enough to trip gc.
    const ownObjects = resolve(root, git(root, ["rev-parse", "--git-path", "objects"]).stdout.trim());
    mkdirSync(join(scratch, "objects"), { recursive: true });
    const env = {
      ...IDENTITY,
      // input-site: env GIT_AUTHOR_NAME,GIT_AUTHOR_EMAIL,GIT_COMMITTER_NAME,GIT_COMMITTER_EMAIL #e467a25a — the identity a layers commit is made under
      ...pick(process.env, Object.keys(IDENTITY)),
      GIT_INDEX_FILE: join(scratch, "index"),
      GIT_OBJECT_DIRECTORY: join(scratch, "objects"),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: ownObjects,
    };
    // `--no-filters`: the bytes as they sit, which are the bytes the digest hashed — never the root's own clean filters.
    const files = entries.filter((e) => e.mode !== "120000");
    const hashed = gitEnv(root, ["hash-object", "-w", "--no-filters", "--stdin-paths"], env, files.map((e) => e.abs).join("\n") + "\n");
    if (hashed.status !== 0) return { ok: false, detail: `git hash-object failed: ${hashed.stderr.trim()}` };
    const shas = hashed.stdout.trim().split("\n");
    const blob = new Map(files.map((e, i) => [e.path, shas[i]!]));
    for (const e of entries.filter((x) => x.mode === "120000")) {
      const h = gitEnv(root, ["hash-object", "-w", "--stdin"], env, readlinkSync(e.abs));
      if (h.status !== 0) return { ok: false, detail: `git hash-object (link ${e.path}) failed: ${h.stderr.trim()}` };
      blob.set(e.path, h.stdout.trim());
    }
    const info = entries.map((e) => `${e.mode} ${blob.get(e.path)}\t${e.path}\0`).join("");
    const idx = gitEnv(root, ["update-index", "-z", "--index-info"], env, info);
    if (idx.status !== 0) return { ok: false, detail: `git update-index failed: ${idx.stderr.trim()}` };
    const tree = gitEnv(root, ["write-tree"], env);
    if (tree.status !== 0) return { ok: false, detail: `git write-tree failed: ${tree.stderr.trim()}` };
    const lockSha = sha256(readFileSync(lock.file));
    const msg = `cat layers ${key}\n\nThe composed overlay of ${instances.length} locked instance(s), ${entries.length} file(s).\nlock: ${relative(root, lock.file)} sha256 ${lockSha}\n${instances.map((i) => `${i.instance} ${i.repository}@${i.sha}`).join("\n")}\n`;
    const commit = gitEnv(root, ["commit-tree", tree.stdout.trim(), "-m", msg], env);
    if (commit.status !== 0) return { ok: false, detail: `git commit-tree failed: ${commit.stderr.trim()}` };
    const sha = commit.stdout.trim();
    const refs = [layersRef(key), ...(opts.main ? [LAYERS_MAIN_REF] : [])];
    if (opts.push === false) return { ok: true, key, commit: sha, refs: [], detail: `built ${sha.slice(0, 12)} for ${key.slice(0, 12)} (${entries.length} files); not pushed` };
    const push = gitEnv(root, ["push", "-q", "--force", url!, ...refs.map((r) => `${sha}:${r}`)], env);
    if (push.status !== 0) {
      // A sandbox that may push only `claude/` branches: leave the commit on its branch for the mover.
      const branches = refs.map(layersBranchOf);
      const viaBranch = gitEnv(root, ["push", "-q", "--force", url!, ...branches.map((b) => `${sha}:${b}`)], env);
      if (viaBranch.status !== 0) return { ok: false, key, commit: sha, detail: `git push failed: ${push.stderr.trim().split("\n").pop()}; to the claude/cat-layers/ branch too: ${viaBranch.stderr.trim().split("\n").pop()}` };
      return { ok: true, key, commit: sha, refs: branches, viaBranch: true, detail: `pushing ${refs.join(", ")} was refused, so ${sha.slice(0, 12)} (${entries.length} files) is on ${branches.map((b) => b.slice("refs/heads/".length)).join(", ")}; the layers-move workflow moves it to the ref when the PR's checks run` };
    }
    const pruned = opts.prune !== undefined ? pruneLayers(url!, opts.prune, [key, ...(opts.keep ?? [])]) : [];
    return { ok: true, key, commit: sha, refs, pruned, detail: `pushed ${sha.slice(0, 12)} (${entries.length} files) to ${refs.join(", ")}${pruned.length ? `; pruned ${pruned.length}` : ""}` };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function pick(env: NodeJS.ProcessEnv, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (env[k]) out[k] = env[k]!;
  return out;
}

/**
 * Delete all but the newest `keep` lock refs at `url` (by committer date),
 * never `main` nor a key in `keepKeys` (the one just published, and any an
 * open PR still pins). Reads only commits, no trees or blobs.
 */
export function pruneLayers(url: string, keep: number, keepKeys: readonly string[] = []): string[] {
  // input-site: inert #64bca8de — the scratch repository the layers refs are listed in
  const dir = mkdtempSync(join(tmpdir(), "layers-prune-"));
  try {
    git(dir, ["init", "-q"]);
    if (git(dir, ["fetch", "-q", "--depth", "1", "--filter=tree:0", url, `+${LAYERS_REF_PREFIX}*:refs/l/*`]).status !== 0) return [];
    const listed = git(dir, ["for-each-ref", "--sort=-committerdate", "--format=%(refname)", "refs/l/"]).stdout.trim().split("\n").filter(Boolean);
    const keys = listed.map((r) => r.slice("refs/l/".length)).filter((k) => k !== "main");
    const doomed = keys.slice(Math.max(0, keep)).filter((k) => !keepKeys.includes(k));
    if (doomed.length === 0) return [];
    const r = git(dir, ["push", "-q", url, ...doomed.map((k) => `:${layersRef(k)}`)]);
    return r.status === 0 ? doomed : [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── All of them ──────────────────────────────────────────────────────────────

export function exitCode(outcomes: Outcome[]): 0 | 1 | 2 {
  if (outcomes.some((o) => o.state === "could-not-determine")) return 2;
  if (outcomes.some((o) => o.state === "missing")) return 1;
  return 0;
}

export interface LayersReport {
  /** The lock's key. */
  key: string;
  ref?: string;
  miss?: string;
  fellBack: string[];
  /** Layers laid down from the cache. */
  served: string[];
  /** Layers fetched from their own repository. */
  fetched: string[];
}

/**
 * The cache's one hit/miss/why line, in `cached-step`'s format (cache-first CI,
 * rule 4), or `undefined` when no layer needed laying down (the cache was
 * never consulted). `hit`: every needed layer came from the lock's own ref;
 * `warm`: some did (from `main`, or with a layer that did not verify); `miss`:
 * none did.
 */
export function layersSummaryLine(r: LayersReport): string | undefined {
  if (r.served.length + r.fetched.length === 0) return undefined;
  const exact = r.ref === layersRef(r.key);
  const verdict = r.served.length === 0 ? "miss" : exact && r.fetched.length === 0 ? "hit" : "warm";
  const why =
    r.served.length === 0
      ? `${r.miss ?? "no layer verified from the cache"}; ${r.fetched.length} fetched per repository`
      : `${r.served.length} layer(s) from ${r.ref}, ${r.fetched.length} fetched${r.fellBack.length ? ` (${r.fellBack.join(", ")} did not verify)` : ""}`;
  return `**cached-step \`layers\`: ${verdict}** (exact) — ${why}. Key \`${r.key}\`.`;
}

export function run(
  root: string,
  check: boolean,
  opts: { install?: InstallMode | false; layers?: false; layersUrl?: string } = {},
): { outcomes: Outcome[]; locks: number; layers: LayersReport[] } {
  const outcomes: Outcome[] = [];
  const layersReport: LayersReport[] = [];
  const locks = readLocks(root);
  const laid: Array<{ inst: LockInstance; outcome: Outcome }> = [];
  for (const l of locks) {
    if (l.error) {
      outcomes.push({ instance: relative(root, l.file), state: "could-not-determine", detail: l.error });
      continue;
    }
    let pins: PriorPins | undefined;
    const prior = () => (pins ??= priorPins(root, l.file));
    const layers = check || opts.layers === false ? undefined : openLayersCache(opts.layersUrl ?? layersUrl(root), layersKey(l.instances!));
    try {
      for (const inst of l.instances!) {
        const outcome = check ? checkInstance(root, inst, prior) : mountInstance(root, inst, layers, prior);
        outcomes.push(outcome);
        if (outcome.state === "mounted" || outcome.state === "current") laid.push({ inst, outcome });
      }
    } finally {
      layers?.dispose();
    }
    if (layers) {
      const fresh = outcomes.filter((o) => o.state === "mounted" && l.instances!.some((i) => i.instance === o.instance));
      const served = fresh.filter((o) => o.detail.includes("(layers cache")).map((o) => o.instance);
      const fetched = fresh.filter((o) => !o.detail.includes("(layers cache") && !o.detail.includes("(local mount cache")).map((o) => o.instance);
      layersReport.push({ key: layersKey(l.instances!), ref: layers.ref, miss: layers.miss, fellBack: layers.fellBack, served, fetched });
    }
  }
  // AFTER every layer is down, so a manifest's `workspaces` reaching a
  // sibling mount finds it. A failed install is reported against the layer
  // (its tools will not run) but never touches what `--check` verifies.
  const mode = opts.install ?? "production";
  if (!check && mode !== false) {
    for (const { inst, outcome } of laid) {
      const r = installDependencies(join(root, inst.path), mode);
      if (r.state === "installed") outcome.detail += `; ${r.detail}`;
      if (r.state === "failed") {
        outcome.state = "missing";
        outcome.detail += `; the bytes are pinned but its dependencies are NOT installed, so its tools will not run: ${r.detail}`;
      }
    }
  }
  return { outcomes, locks: locks.length, layers: layersReport };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const at = argv.indexOf("--root");
  const root = resolve(at >= 0 && argv[at + 1] ? argv[at + 1]! : process.cwd());
  const val = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  if (argv.includes("--move-layers")) {
    const r = moveLayers(root, { url: val("--url"), changedFrom: val("--changed-from") });
    // Nothing to move (`missing`) is the layers-ref gate's to report, not the mover's.
    console.log(`layers:move: ${r.state === "error" ? "FAILED" : "OK"} (${r.state}) — ${r.detail}`);
    process.exit(r.state === "error" ? 1 : 0);
  }
  if (argv.includes("--check-layers")) {
    const r = checkLayers(root, { url: val("--url"), changedFrom: val("--changed-from") });
    console.log(`layers:check: ${r.ok ? "OK" : "FAILED"} (${r.state}) — ${r.detail}`);
    process.exit(r.ok ? 0 : 1);
  }
  if (argv.includes("--publish")) {
    const prune = val("--prune");
    const keep = argv.flatMap((a, i) => (a === "--keep" && argv[i + 1] ? [argv[i + 1]!] : []));
    const r = publishLayers(root, { url: val("--url"), main: argv.includes("--main"), push: !argv.includes("--no-push"), prune: prune === undefined ? undefined : Number(prune), keep });
    console.log(`layers:publish: ${r.ok ? "OK" : "REFUSED"} — ${r.detail}`);
    if (r.pruned?.length) for (const k of r.pruned) console.log(`  pruned ${layersRef(k)}`);
    process.exit(r.ok ? 0 : 1);
  }
  const { outcomes, locks, layers } = run(root, check, { install: argv.includes("--no-install") ? false : argv.includes("--install-all") ? "all" : "production", ...(argv.includes("--no-layers-cache") ? { layers: false as const } : {}) });
  if (locks === 0) {
    console.log(`mount:lock: not-enabled — no ${INDEX_LOCK} (or legacy *${LEGACY_LOCK_SUFFIX}) in ${root}`);
    process.exit(0);
  }
  for (const o of outcomes) console.log(`  ${o.state.padEnd(20)} ${o.instance.padEnd(22)} ${o.detail}`);
  for (const l of layers) {
    const line = layersSummaryLine(l);
    // input-site: inert #ab4c9ec1 — the job summary is where the result is shown, never an input
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (line && summary) {
      try {
        appendFileSync(summary, `${line}\n`);
      } catch {
        // The summary is a report: failing to write it changes no mount.
      }
    }
    if (l.ref) console.log(`  layers cache: ${l.ref}${l.fellBack.length ? ` — did not verify for ${l.fellBack.join(", ")}, fetched from their own repositories` : ""}`);
    else if (l.miss) console.log(`  layers cache: miss — ${l.miss}; fetched per repository`);
  }
  const code = exitCode(outcomes);
  console.log(`mount:lock${check ? " --check" : ""}: ${outcomes.length} instance(s) — ${code === 0 ? "OK" : code === 1 ? "MISSING" : "COULD NOT DETERMINE"}`);
  process.exit(code);
}
