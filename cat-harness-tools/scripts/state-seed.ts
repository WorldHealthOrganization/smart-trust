#!/usr/bin/env bun
/**
 * state-seed — REFRESH a seeded state branch from the ref it says it was
 * seeded from, and verify that it landed.
 *
 * @module scripts/state-seed
 * @covers beans
 * @covers todos
 *
 * ```sh
 * bun run cat state:seed --id beans              # refresh the seed, verify, report
 * bun run cat state:seed --id beans --dry-run    # what it would push, pushing nothing
 * bun run cat state:seed --id beans --authoritative   # the CUTOVER half: the branch becomes the store
 * bun run cat state:seed --init                  # INITIALIZATION: create this layer's missing declared state branches
 * bun run cat state:seed --init --id beans --dry-run   # one of them, reporting what it would create
 * bun run cat state:seed --retire <root> --into <host instance> --repository <url> \\
 *   --also <root>.config.json                  # SEPARATION: a whole instance, into the host's fsh-guts
 * ```
 *
 * This is the remedy `state-drift.ts` names ("Refresh the seed before any
 * cutover"). A cutover from a stale seed **resurrects** whatever the seed
 * still holds and **loses** whatever landed on the source ref since —
 * silently, because the branch is well-formed either way.
 *
 * ## Keyed by the SPECIAL-BRANCH row, not by the declared directory
 *
 * `branch-store mount --id` and `push --id` are keyed by DIRECTORY id; this is
 * keyed by the observed row id, the same key `state:drift` uses. Before a
 * cutover the directory's declaration still says
 * `source: { kind: "directory" }`, so `resolveTipLocation` refuses it, and a
 * refresh keyed off the declaration would be unavailable in exactly the
 * window it is for. The ids coincide for every state branch today (`beans`,
 * `todos`, `fsh-guts`).
 *
 * Which paths to copy is read from the branch's own `manifest.json`
 * (`graphs[].path`, or the older `subgraph`), and the source ref from its
 * `source.ref`. A seed that records another ref is refreshed from the ref it
 * claims, and a seed that records none is a refusal rather than a guess at
 * `main`.
 *
 * ## It refuses the two states where a refresh would destroy work
 *
 * - `authoritative: true` — the branch IS the store. Copying `main` over it
 *   would overwrite every edit made since the cutover.
 * - `status: "retired"` — a superseded seed (`cat/cat-harness/state`).
 *   Refreshing it would make a branch nothing should read look current.
 *
 * Both are `refused` (exit 5), never a silent no-op.
 *
 * ## `--authoritative` is the cutover's branch half, and it is one-way
 *
 * The cutover is one commit on `main` (the declaration, the `git rm`, the
 * `.gitignore`) and one push to the branch (the current content, plus
 * `authoritative: true`). This performs the second half. Afterwards this
 * command refuses the branch, by the rule above, so the flag is one-way.
 *
 * ## Why it does not go through {@link BranchStore.write}
 *
 * `write()` is blob-keyed and REFUSES `manifest.json`. A refresh must replace
 * a whole SUBTREE and rewrite the manifest, so it splices trees with the same
 * plumbing and discipline — `commit-tree -p tip`, push without `-f`, the
 * server's ref lock as the concurrency primitive.
 *
 * ## `--cutover` is the MAIN half, and it never pushes
 *
 * {@link cutoverMain} removes the directory from `main`. It REFUSES unless:
 *
 * - the branch's manifest says `authoritative: true` (the branch is the store);
 * - the directory is declared on that branch (`source` / `storage`, read
 *   through `tipLocations`) — the declaration comes first;
 * - the checkout has no uncommitted change under the path;
 * - `HEAD:<path>` and the branch's `<path>` are the SAME tree id — byte-
 *   identical, every file, mode and name, so nothing is removed from `main`
 *   that the branch does not hold;
 * - the directory's OWN layer declares a `fsh-guts` graph kept at a branch
 *   tip, and the snapshot DEPOSIT into it succeeds and re-reads verified
 *   (§"The deposit", below). No
 *   trashcan, or a deposit that did not land, is a refusal with main
 *   untouched.
 *
 * It is a DRY RUN unless `--commit` is passed: it reports the files and bytes
 * it would remove and the deposit it would make. With `--commit` it first
 * deposits, then stages `git rm -r <path>` and a
 * `/<path>/**` ignore line (a mount must never be committed) as ONE commit
 * naming the branch and the tree id. It never pushes — the caller reviews and
 * pushes. `deletion-requires-confirmation`: the dry run is the report,
 * `--commit` is the person saying go.
 *
 * ## Which repository — the cwd's
 *
 * Every default resolves through `defaultRepoRoot()`: the git toplevel of the
 * directory the command is run from. `--repo-root <dir>` overrides it.
 *
 * ## `--init` CREATES; everything else here refreshes
 *
 * A layer's declared state branches are created by its initialization, not
 * by hand: `--init` (and `state:mount`, which calls the same code) creates
 * each branch the root layer declares and its remote is missing, seeded with
 * the standard layout and an `authoritative: true` manifest — the branch is
 * the store from its first commit. Never a mounted dependency's, never over
 * an existing branch, never onto an empty remote. See `state-branch-init.ts`.
 * Its exit codes are that module's: 0 created or present · 1 denied (the
 * token cannot push) · 4 could not determine · 5 refused.
 *
 * Exit codes: 0 refreshed or already current (or cut over / would cut over)
 * · 1 pushed and still not verified · 4 could not determine · 5 refused.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { resolveDirectories, type ResolvedDirectory } from "../schemas/kg/cat-harness.ts";
import { FROZEN_SUBTREE_KIND, FSH_GUTS_KIND, FSH_GUTS_SCHEMA_ID } from "../schemas/kg/fsh-guts.ts";
import { findDeclarationFile, layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { instanceStateBranch } from "../schemas/kg/subgraph-source.ts";
import { BranchStore, gitBlobId, MANIFEST_FILE, MANIFEST_SCHEMA, tipLocations, type TreeEntry } from "./branch-store.ts";
import { candidatesOf, defaultRepoRoot, observedRows, type SpecialBranch } from "./state-drift.ts";
import { initDeclaredStateBranches, initExitCode, initReport } from "./state-branch-init.ts";

/** What the manifest says, as far as a refresh needs it. */
interface SeedManifest {
  $schema?: string;
  status?: string;
  authoritative?: boolean;
  subgraph?: string;
  source?: { ref?: string; sha?: string };
  graphs?: Array<{ path: string; tree?: string; files?: number }>;
  [k: string]: unknown;
}

export interface SeedOptions {
  repoRoot?: string;
  remote?: string;
  storeDir?: string;
  /** Mark the branch as the store (the cutover's branch half). */
  authoritative?: boolean;
  dryRun?: boolean;
  message?: string;
  log?: (l: string) => void;
}

export interface GraphRefresh {
  path: string;
  /** The subtree id on the source ref — what the branch should hold. */
  want: string;
  /** What the branch held before this run. */
  had: string | undefined;
  files: number;
}

export type SeedResult =
  | {
      state: "refreshed" | "current";
      branch: string;
      ref: string;
      sha: string;
      graphs: GraphRefresh[];
      commit?: string;
      /** Verified by RE-READING the pushed tip, not by trusting the push. */
      verified: boolean;
      reason: string;
    }
  | { state: "refused" | "unknown" | "failed"; branch: string; reason: string };

/**
 * The branch named by `id`: a declared directory id, a branch name, or a
 * branch's last segment (`beans` for `cat/cat-harness/beans`, the id the
 * retired table used). Rows come from what the remote OBSERVABLY holds and what
 * the declarations name (bean rva2); the old `special-branches.json` table is gone.
 */
export function rowFor(id: string, rows: SpecialBranch[] = observedRows() ?? []): SpecialBranch | undefined {
  return rows.find((r) => r.id === id) ?? rows.find((r) => r.name === id) ?? rows.find((r) => r.name.endsWith(`/${id}`));
}

/**
 * Refresh one seeded state branch.
 *
 * The source ref is fetched into the SAME private bare store as the branch, so
 * the two trees' object ids are directly comparable and the splice needs no
 * second repository — `state-drift.ts` compares them the same way, and a
 * refresh that computed equality differently from the gate that checks it
 * would be two answers to one question.
 */
export function refreshSeed(row: SpecialBranch, opts: SeedOptions = {}): SeedResult {
  const candidates = candidatesOf(row);
  if (!candidates) return { state: "refused", branch: row.name, reason: `${row.id} is a branch FAMILY (${row.name}), not a single branch; there is no seed to refresh` };
  const log = opts.log ?? ((l: string) => console.error(l));
  const open = (names: string[]): BranchStore =>
    BranchStore.open(names, { repoRoot: opts.repoRoot, remote: opts.remote, storeDir: opts.storeDir, log: () => {} });

  const store = open(candidates);
  const tip = store.fetchTip();
  if (tip.state !== "ok") {
    return { state: "unknown", branch: row.name, reason: `could not resolve ${row.name}: ${tip.state === "absent" ? "no such branch on the remote" : tip.reason}` };
  }
  const rootTree = store.must(["rev-parse", `${tip.tip}^{tree}`]).trim();

  // The manifest, through the plumbing: `readJson` asks "is this a valid state
  // store", which is a different question and would fold a branch that is not
  // a seed into `corrupt`.
  const entry = store.lookup(rootTree, MANIFEST_FILE);
  if (!entry || entry.type !== "blob") return { state: "refused", branch: tip.branch, reason: `${tip.branch} carries no ${MANIFEST_FILE} at its root, so it is not a seed of anything` };
  if (!store.ensureBlobs(rootTree, [entry.sha])) return { state: "unknown", branch: tip.branch, reason: `could not fetch ${MANIFEST_FILE} from ${tip.branch}` };
  let m: SeedManifest;
  try {
    m = JSON.parse(store.blobText(entry.sha)) as SeedManifest;
  } catch (e) {
    return { state: "unknown", branch: tip.branch, reason: `${MANIFEST_FILE} on ${tip.branch} does not parse: ${(e as Error).message}` };
  }
  if (m.$schema !== MANIFEST_SCHEMA) return { state: "refused", branch: tip.branch, reason: `root manifest is ${m.$schema ?? "untyped"}, not ${MANIFEST_SCHEMA}` };
  if (m.status === "retired") {
    return { state: "refused", branch: tip.branch, reason: `${tip.branch} is RETIRED (superseded); refreshing it would make a branch nothing should read look current` };
  }
  if (m.authoritative === true) {
    return {
      state: "refused",
      branch: tip.branch,
      reason:
        `${tip.branch} says it IS the store (\`authoritative: true\`). A refresh from ${m.source?.ref ?? "a source ref"} would overwrite ` +
        `every edit made since the cutover with a copy of a directory the source ref no longer tracks.`,
    };
  }
  const ref = m.source?.ref;
  if (!ref) return { state: "refused", branch: tip.branch, reason: `${MANIFEST_FILE} records no \`source.ref\`, so there is nothing to refresh FROM` };
  const paths = (m.graphs?.length ? m.graphs.map((g) => g.path) : m.subgraph ? [m.subgraph] : []).filter(Boolean);
  if (!paths.length) return { state: "refused", branch: tip.branch, reason: `${MANIFEST_FILE} names no graph path` };

  const src = open([ref]);
  const srcTip = src.fetchTip();
  if (srcTip.state !== "ok") {
    return { state: "unknown", branch: tip.branch, reason: `could not resolve ${ref}: ${srcTip.state === "absent" ? "no such branch on the remote" : srcTip.reason}` };
  }
  const srcTree = src.must(["rev-parse", `${srcTip.tip}^{tree}`]).trim();

  const graphs: GraphRefresh[] = [];
  let tree: string = rootTree;
  for (const path of paths) {
    const want = src.lookup(srcTree, path);
    if (!want) return { state: "refused", branch: tip.branch, reason: `${ref} has no ${path}; a seed of a path its source no longer carries cannot be refreshed — cut it over or retire the branch` };
    if (want.type !== "tree") return { state: "refused", branch: tip.branch, reason: `${path} on ${ref} is a ${want.type}, not a directory` };
    // Every blob under the subtree must be LOCAL before the push: the private
    // store is a partial clone (`--filter=blob:none`), and a push whose pack
    // needs an object it does not have fails after the commit is built.
    const left = src.hydrate(want.sha);
    if (left > 0) return { state: "unknown", branch: tip.branch, reason: `could not fetch ${left} object(s) under ${ref}:${path}; nothing pushed` };
    const files = src.must(["ls-tree", "-r", "--name-only", want.sha]).split("\n").filter(Boolean).length;
    const had = store.lookup(rootTree, path)?.sha;
    graphs.push({ path, want: want.sha, had, files });
    tree = store.setPath(tree, path.split("/").filter(Boolean), { mode: "040000", type: "tree", sha: want.sha, name: "" } as TreeEntry)!;
  }

  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const next: SeedManifest = {
    ...m,
    status: opts.authoritative ? "authoritative" : (m.status ?? "seed"),
    authoritative: opts.authoritative ? true : (m.authoritative ?? false),
    source: { ...m.source, ref, sha: srcTip.tip },
    refreshedAt: now,
    ...(opts.authoritative ? { authoritativeSince: now } : {}),
    graphs: graphs.map((g) => ({ path: g.path, tree: g.want, files: g.files })),
  };
  const blob = store.hashBlob(JSON.stringify(next, null, 2) + "\n");
  tree = store.setPath(tree, [MANIFEST_FILE], { mode: "100644", type: "blob", sha: blob, name: "" } as TreeEntry)!;

  const drifted = graphs.filter((g) => g.had !== g.want);
  // `current` is decided on the GRAPH SUBTREES, not on the spliced root tree.
  //
  // The manifest carries `refreshedAt` and `source.sha`, so the root tree
  // differs on every run even when not one file of the subgraph has moved —
  // which meant a second `state:seed` pushed a commit whose only content was
  // a new timestamp. Found by this module's own test asserting `current`, and
  // worth more than the commit it saves: the drift gate reads nothing but the
  // live trees, so those pushes buy no provenance anybody consults, while
  // `beans/README.md`'s count line is already this repository's most-cited
  // example (`y7b3`, 76 of 235 conflicted merges) of a generated line that
  // churned a branch for no reader.
  //
  // `--authoritative` is the exception and is NOT a refresh: it changes what
  // the branch IS, so it pushes even when every subtree already matches.
  if (drifted.length === 0 && !opts.authoritative) {
    return { state: "current", branch: tip.branch, ref, sha: srcTip.tip, graphs, verified: true, reason: `${tip.branch} already holds ${ref}@${srcTip.tip.slice(0, 12)}` };
  }
  if (opts.dryRun) {
    return {
      state: "refreshed",
      branch: tip.branch,
      ref,
      sha: srcTip.tip,
      graphs,
      verified: false,
      reason: `dry run: would push ${drifted.length} refreshed subtree(s) and the manifest; nothing was pushed`,
    };
  }

  const message =
    opts.message ??
    `state(${row.id}): refresh the seed from ${ref}@${srcTip.tip.slice(0, 12)}` +
      (opts.authoritative ? " and mark the branch AUTHORITATIVE (cutover)" : "");
  const commit = store.must(["commit-tree", "--no-gpg-sign", tree, "-p", tip.tip, "-m", message]).trim();
  // NO -f. A moved tip is a rejection, and the honest answer is to re-run over
  // what landed rather than to replace it: this command carries a whole
  // subtree, so a force push would discard a sibling's whole graph.
  const push = store.git(["-c", "pack.useSparse=false", "push", "-q", "origin", `${commit}:refs/heads/${tip.branch}`]);
  if (push.status !== 0) {
    return { state: "failed", branch: tip.branch, reason: `push to ${tip.branch} was rejected: ${push.stderr.split("\n").filter(Boolean).join(" | ")}` };
  }

  // VERIFY by re-reading the tip. A push that returned 0 is evidence that the
  // ref moved, not that it holds what was intended — and this command's whole
  // purpose is that a cutover is not taken on trust.
  const after = open(candidates);
  const back = after.fetchTip();
  let verified = false;
  if (back.state === "ok") {
    const t = after.must(["rev-parse", `${back.tip}^{tree}`]).trim();
    verified = graphs.every((g) => after.lookup(t, g.path)?.sha === g.want);
  }
  log(`state-seed: ${tip.branch} ← ${ref}@${srcTip.tip.slice(0, 12)} as ${commit.slice(0, 12)}${verified ? " (verified)" : ""}`);
  return {
    state: "refreshed",
    branch: tip.branch,
    ref,
    sha: srcTip.tip,
    graphs,
    commit,
    verified,
    reason: verified
      ? `${graphs.length} graph(s) now match ${ref}@${srcTip.tip.slice(0, 12)}, verified by re-reading the tip`
      : `pushed ${commit.slice(0, 12)}, but a re-read of ${tip.branch} does NOT match ${ref}@${srcTip.tip.slice(0, 12)} — do not cut over`,
  };
}

// ── The deposit: what a cutover removes goes to fsh-guts FIRST (owner, 2026-10-06) ──

/**
 * Owner, 2026-10-06: *"cutover dirs should go to fsh-guts"*.
 *
 * The cutover's main half removes a directory from `main`. Its content is not
 * lost — the authoritative branch holds it, byte-identical, which is the
 * refusal condition above — but the `main` copy as it stood at the moment of
 * removal stops being reachable from anything but history. `fsh-guts` is the
 * repository's answer to "removed, but kept": so the removal DEPOSITS a
 * snapshot there before it is made.
 *
 * ## The item is the existing `retired/` pair, not a new format
 *
 * `fsh-guts/retired/bootstrap-split.{md,tar.gz}` is the precedent: a packed
 * archive, so the scanners that read every file in the checkout do not take
 * the copies for live files (a loose copy of `beans/` would be a second bean
 * store to every reader that walks a directory), plus a same-basename `.md`
 * declaring itself `folio-fsh-guts/v1` with `movedFrom` / `movedOn`. This adds
 * the cutover's provenance as passthrough fields — the schema is
 * `.passthrough()` precisely so an open `kind` keeps what makes it distinct.
 *
 * ## The writer is `branch-store`, as for every other fsh-guts write
 *
 * The trashcan is itself a tip-keyed branch, so the deposit is one
 * {@link BranchStore.write}: spliced onto the tip, pushed without `-f`, and
 * `expect: null` on both paths, so an existing item of the same name is a
 * `conflict` rather than an overwrite.
 */
export interface Deposit {
  /** The fsh-guts directory id and the branch it is kept on. */
  id: string;
  branch: string;
  /** Branch-relative paths of the archive and its provenance record. */
  archive: string;
  record: string;
  /** Blob ids, as hashed locally and as re-read from the tip after the push. */
  archiveBlob: string;
  recordBlob: string;
  /** The fsh-guts commit that holds the deposit (absent on a dry run). */
  commit?: string;
}

/** The provenance fields a cutover deposit carries beyond the base node. */
export interface CutoverProvenance {
  instance: string;
  directory: string;
  path: string;
  sourceCommit: string;
  tree: string;
  authoritativeBranch: string;
  files: number;
  bytes: number;
  date: string;
}

/** Where the cut-over directory's OWN layer keeps its trashcan. */
type GutsTarget =
  | { state: "ok"; instance: string; directoryId: string; id: string; path: string; branch: string }
  | { state: "refused" | "unknown"; reason: string };

/**
 * The fsh-guts graph of the layer that declares `path` — never another
 * layer's. A folio linking the platform must not deposit into the
 * platform's trashcan (a branch its own remote does not carry), and the
 * submodule's declarations are not this checkout's layers anyway
 * (`layerRootsIn` excludes foreign checkouts).
 */
export function fshGutsTargetFor(repoRoot: string, path: string): GutsTarget {
  let roots: string[];
  try {
    roots = layerRootsIn(repoRoot);
  } catch (e) {
    return { state: "unknown", reason: `could not list the instances under ${repoRoot}: ${(e as Error).message}` };
  }
  for (const inst of roots) {
    const r = readInstance(repoRoot, inst);
    if (r.state !== "ok") return r;
    const owner = r.dirs.find((d) => r.rel(d) === path);
    if (!owner) continue;
    const t = gutsOf(repoRoot, r, `${path}/`);
    return t.state === "ok" ? { ...t, directoryId: owner.id } : t;
  }
  return { state: "refused", reason: `no instance under ${repoRoot} declares ${path}/, so there is no instance whose trashcan it belongs in` };
}

/** A layer root's own directories and its declared name. */
type ReadInstance =
  | { state: "ok"; root: string; instance: string; dirs: ResolvedDirectory[]; rel: (d: ResolvedDirectory) => string }
  | { state: "unknown"; reason: string };

function readInstance(repoRoot: string, inst: string): ReadInstance {
  let dirs: ResolvedDirectory[];
  try {
    dirs = resolveDirectories([{ name: "(local)", root: inst, own: true }]).filter((d) => d.own);
  } catch (e) {
    return { state: "unknown", reason: `could not read the declaration under ${inst}: ${(e as Error).message}` };
  }
  const rel = (d: ResolvedDirectory) => relative(repoRoot, d.absPath).split("\\").join("/").replace(/\/+$/, "");
  const declFile = findDeclarationFile(inst);
  let instance = "";
  try {
    // `findDeclarationFile` answers with the FILENAME, relative to `inst`.
    instance = String((JSON.parse(readFileSync(resolve(inst, declFile!), "utf-8")) as { name?: unknown }).name ?? "");
  } catch {
    // Named below as unknown: provenance without the layer is not provenance.
  }
  if (!instance) return { state: "unknown", reason: `could not read the instance name from ${declFile ?? inst}` };
  return { state: "ok", root: inst, instance, dirs, rel };
}

/** The one `fsh-guts` graph `r` declares, kept at a branch tip — or why there is none. */
function gutsOf(
  repoRoot: string,
  r: Extract<ReadInstance, { state: "ok" }>,
  what: string,
): { state: "ok"; instance: string; id: string; path: string; branch: string } | { state: "refused" | "unknown"; reason: string } {
  const { instance, dirs, rel } = r;
  const guts = dirs.filter((d) => (d.graphTypologies as readonly string[]).includes(FSH_GUTS_KIND));
  const fix =
    `Declare one in ${instance}.json — \`{ "id": "${FSH_GUTS_KIND}", "path": "${FSH_GUTS_KIND}/", "graphTypologies": ["${FSH_GUTS_KIND}"], ` +
    `"source": { "kind": "branch", "branch": "${instanceStateBranch(instance, FSH_GUTS_KIND)}", "keyedBy": "tip" } }\` — and seed that branch ` +
    `(the command \`folio_init\` prints for a new instance), then re-run.`;
  if (guts.length === 0) {
    return { state: "refused", reason: `${instance} declares no \`${FSH_GUTS_KIND}\` graph, so there is nowhere to deposit ${what} before removing it from main. ${fix}` };
  }
  if (guts.length > 1) return { state: "refused", reason: `${instance} declares \`${FSH_GUTS_KIND}\` ${guts.length} times, so there is no single trashcan to deposit into` };
  let tips: ReturnType<typeof tipLocations>;
  try {
    tips = tipLocations(repoRoot, "tip");
  } catch (e) {
    return { state: "unknown", reason: `could not resolve where ${guts[0]!.id} is kept: ${(e as Error).message}` };
  }
  const at = tips.find((t) => t.id === guts[0]!.id && t.path === rel(guts[0]!));
  if (!at) {
    return {
      state: "refused",
      reason: `${instance}'s \`${FSH_GUTS_KIND}\` graph (${rel(guts[0]!)}/) is not kept at a branch tip, and a deposit goes through branch-store. ${fix}`,
    };
  }
  return { state: "ok", instance, id: at.id, path: at.path, branch: at.branch };
}

/** `<fsh-guts>/retired/cutover-<instance>-<dir>-<tree12>`, without the extension. */
export function depositStem(gutsPath: string, p: Pick<CutoverProvenance, "instance" | "directory" | "tree">): string {
  return `${gutsPath}/retired/cutover-${p.instance}-${p.directory}-${p.tree.slice(0, 12)}`;
}

/** The provenance record: a `folio-fsh-guts/v1` node, the `retired/` precedent's shape. */
export function depositRecord(p: CutoverProvenance, archiveName: string): string {
  const q = (s: string) => JSON.stringify(s);
  return [
    "---",
    `$schema: ${FSH_GUTS_SCHEMA_ID}`,
    `title: ${q(`${p.path}/ of ${p.instance}, as removed from main by its cutover`)}`,
    "kind: cutover-snapshot",
    `movedOn: ${p.date}`,
    `movedFrom: ${q(`${p.path}/`)}`,
    "reason: cutover",
    `instance: ${q(p.instance)}`,
    `directory: ${q(p.directory)}`,
    `sourceCommit: ${p.sourceCommit}`,
    `tree: ${p.tree}`,
    `authoritativeBranch: ${q(p.authoritativeBranch)}`,
    `archive: ${q(archiveName)}`,
    `files: ${p.files}`,
    `bytes: ${p.bytes}`,
    "summary: >-",
    `  ${p.path}/ as main tracked it at ${p.sourceCommit.slice(0, 12)} (tree ${p.tree.slice(0, 12)}, ${p.files} file(s),`,
    `  ${p.bytes} bytes), packed beside this file as ${archiveName} by git archive. It was removed from`,
    `  main by state:seed --cutover after ${p.authoritativeBranch} was verified authoritative and`,
    "  byte-identical; that branch is the live store, and this is the copy main last held.",
    "---",
    "",
    `# ${p.path}/ of ${p.instance}, at its cutover`,
    "",
    `\`${archiveName}\` beside this file holds \`${p.path}/\` exactly as \`main\` tracked it at`,
    `\`${p.sourceCommit}\` — list it with \`tar -tzf ${archiveName}\`. Extracted and added to a`,
    `fresh index it writes tree \`${p.tree}\`, which is how the cutover verified it before`,
    "removing anything.",
    "",
    `The live content is on \`${p.authoritativeBranch}\`, mounted at \`${p.path}/\` by \`state:mount\`.`,
    "Do not unpack this back onto `main`: edit the branch.",
    "",
  ].join("\n");
}

/**
 * The tree id a `.tar.gz` extracts to — every file, mode and name — so an
 * archive is compared to the removed tree by the same identity the cutover's
 * byte-identical check uses, not by a file count.
 */
export function archiveTreeId(archive: Buffer, prefix: string): string | undefined {
  const dir = mkdtempSync(join(tmpdir(), "cutover-deposit-"));
  try {
    const git = (args: string[], input?: Buffer) =>
      spawnSync("git", ["-c", "core.autocrlf=false", "-c", "core.fileMode=true", "-c", "core.symlinks=true", ...args], {
        cwd: dir,
        input,
        encoding: "utf-8",
        maxBuffer: 256 * 1024 * 1024,
      });
    if (git(["init", "-q"]).status !== 0) return undefined;
    const tar = spawnSync("tar", ["-xzf", "-"], { cwd: dir, input: archive });
    if (tar.status !== 0) return undefined;
    // -f: a `.gitignore` INSIDE the snapshot must not hide a file it carries.
    if (git(["add", "-A", "-f", "--", prefix]).status !== 0) return undefined;
    const t = git(["rev-parse", `${git(["write-tree"]).stdout.trim()}:${prefix}`]);
    return t.status === 0 ? t.stdout.trim() : undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Pack `path` at `sourceCommit`, check the pack extracts to `tree`, splice the
 * pair onto the trashcan's tip, and RE-READ the tip to confirm both blobs
 * landed. Anything short of that is a refusal: the caller removes nothing.
 */
export function depositCutover(
  target: Extract<GutsTarget, { state: "ok" }>,
  p: CutoverProvenance,
  opts: { repoRoot: string; remote?: string; storeDir?: string; dryRun?: boolean },
): { state: "deposited" | "would-deposit"; deposit: Deposit } | { state: "refused" | "unknown"; reason: string } {
  const at = spawnSync("git", ["log", "-1", "--format=%ct", p.sourceCommit], { cwd: opts.repoRoot, encoding: "utf-8" });
  const archived = spawnSync(
    "git",
    ["archive", "--format=tar.gz", `--prefix=${p.path}/`, `--mtime=@${at.stdout.trim() || "0"}`, `${p.sourceCommit}:${p.path}`],
    { cwd: opts.repoRoot, maxBuffer: 1024 * 1024 * 1024 },
  );
  if (archived.status !== 0) return { state: "unknown", reason: `git archive of ${p.path}/ at ${p.sourceCommit.slice(0, 12)} failed: ${archived.stderr.toString().trim()}` };
  const archive = archived.stdout as Buffer;
  const packed = archiveTreeId(archive, p.path);
  if (packed !== p.tree) {
    return {
      state: "refused",
      reason: `the snapshot of ${p.path}/ extracts to tree ${packed ?? "(unreadable)"}, not ${p.tree} — a deposit that is not the removed tree is not a deposit, so nothing was removed`,
    };
  }
  const stem = depositStem(target.path, p);
  const archiveName = `${stem.split("/").pop()}.tar.gz`;
  return writeDeposit(
    target,
    { stem, archive, record: depositRecord(p, archiveName) },
    `fsh-guts: deposit ${p.path}/ of ${p.instance} before its cutover removes it from main\n\n` +
      `tree ${p.tree} at ${p.sourceCommit}; the live store is ${p.authoritativeBranch}.`,
    opts,
  );
}

/**
 * Splice `<stem>.tar.gz` and `<stem>.md` onto the trashcan's tip and RE-READ
 * the tip to confirm both blobs landed. The branch-store half of every
 * deposit — a cutover's and a separation's alike — so the never-overwrite and
 * verify-by-re-reading rules are written once.
 */
export function writeDeposit(
  target: { id: string; branch: string },
  item: { stem: string; archive: Buffer; record: string },
  message: string,
  opts: { repoRoot: string; remote?: string; storeDir?: string; dryRun?: boolean },
): { state: "deposited" | "would-deposit"; deposit: Deposit } | { state: "refused" | "unknown"; reason: string } {
  const { stem, archive, record } = item;
  const deposit: Deposit = {
    id: target.id,
    branch: target.branch,
    archive: `${stem}.tar.gz`,
    record: `${stem}.md`,
    archiveBlob: gitBlobId(archive),
    recordBlob: gitBlobId(Buffer.from(record, "utf-8")),
  };
  let store: BranchStore;
  try {
    store = BranchStore.open(target.branch, { repoRoot: opts.repoRoot, remote: opts.remote, storeDir: opts.storeDir, log: () => {} });
  } catch (e) {
    return { state: "refused", reason: `cannot open ${target.branch}: ${(e as Error).message}` };
  }
  const probe = store.listDir("");
  if (probe.state !== "hit") {
    return { state: probe.state === "unknown" ? "unknown" : "refused", reason: `${target.branch} cannot take a deposit: ${probe.reason}, so nothing was removed from main` };
  }
  // A re-run after a deposit landed and the removal did not (an interrupted
  // run, a refused commit) finds its own archive already there. Same archive
  // blob → the deposit is MADE, not a conflict; a different one → refused,
  // never overwritten.
  const had = store.readFile(deposit.archive);
  if (had.state === "hit") {
    const rec = store.readFile(deposit.record);
    if (had.blob === deposit.archiveBlob && rec.state === "hit") {
      return { state: opts.dryRun ? "would-deposit" : "deposited", deposit: { ...deposit, recordBlob: rec.blob, commit: had.tip } };
    }
    return { state: "refused", reason: `${target.branch} already holds ${deposit.archive} with different content; nothing was overwritten and nothing removed from main` };
  }
  if (had.state !== "miss") return { state: had.state === "unknown" ? "unknown" : "refused", reason: `could not read ${deposit.archive} on ${target.branch}: ${had.reason}` };
  // A dry run proves the trashcan is THERE and is a tip-keyed state branch,
  // so the person saying go is not told a deposit will happen that the real
  // run would refuse.
  if (opts.dryRun) return { state: "would-deposit", deposit };
  const w = store.write(
    [
      { path: deposit.archive, content: archive, expect: null },
      { path: deposit.record, content: record, expect: null },
    ],
    message,
  );
  if (w.state !== "pushed") {
    return { state: "refused", reason: `the deposit to ${target.branch} was not made (${w.state}: ${w.reason}), so nothing was removed from main` };
  }
  // VERIFY by re-reading the tip, as `refreshSeed` does: a push that returned
  // 0 says the ref moved, not that it holds what was intended.
  const back = BranchStore.open(target.branch, { repoRoot: opts.repoRoot, remote: opts.remote, storeDir: opts.storeDir, log: () => {} });
  const ra = back.readFile(deposit.archive);
  const rr = back.readFile(deposit.record);
  if (ra.state !== "hit" || ra.blob !== deposit.archiveBlob || rr.state !== "hit" || rr.blob !== deposit.recordBlob) {
    return { state: "unknown", reason: `pushed ${w.commit?.slice(0, 12)} to ${target.branch}, but a re-read of its tip does not hold the deposit — nothing was removed from main` };
  }
  return { state: "deposited", deposit: { ...deposit, commit: w.commit } };
}

export interface CutoverOptions {
  repoRoot?: string;
  remote?: string;
  storeDir?: string;
  /** Make the commit. Without it, a dry run. Never pushes either way. */
  commit?: boolean;
}

export type CutoverResult =
  | {
      state: "would-cut-over" | "cut-over";
      branch: string;
      paths: Array<{ path: string; tree: string; files: number; bytes: number }>;
      /**
       * Each removed path's snapshot in its layer's fsh-guts graph — made
       * and verified BEFORE the removal commit, or (dry run) checked possible.
       */
      deposits: Deposit[];
      /** The commit made, with `commit: true`. Not pushed. */
      commit?: string;
      reason: string;
    }
  | { state: "refused" | "unknown"; branch: string; reason: string };

/** The MAIN half of a cutover. See the module docblock, §"`--cutover`". */
export function cutoverMain(row: SpecialBranch, opts: CutoverOptions = {}): CutoverResult {
  const repoRoot = opts.repoRoot ?? defaultRepoRoot();
  const candidates = candidatesOf(row);
  if (!candidates) return { state: "refused", branch: row.name, reason: `${row.id} is a branch FAMILY, not a single branch` };
  const store = BranchStore.open(candidates, { repoRoot, remote: opts.remote, storeDir: opts.storeDir, log: () => {} });
  const tip = store.fetchTip();
  if (tip.state !== "ok") {
    return { state: "unknown", branch: row.name, reason: `could not resolve ${row.name}: ${tip.state === "absent" ? "no such branch on the remote" : tip.reason}` };
  }
  const rootTree = store.must(["rev-parse", `${tip.tip}^{tree}`]).trim();
  const entry = store.lookup(rootTree, MANIFEST_FILE);
  if (!entry || entry.type !== "blob" || !store.ensureBlobs(rootTree, [entry.sha])) {
    return { state: "refused", branch: tip.branch, reason: `${tip.branch} carries no readable ${MANIFEST_FILE}` };
  }
  let m: SeedManifest;
  try {
    m = JSON.parse(store.blobText(entry.sha)) as SeedManifest;
  } catch (e) {
    return { state: "unknown", branch: tip.branch, reason: `${MANIFEST_FILE} does not parse: ${(e as Error).message}` };
  }
  if (m.$schema !== MANIFEST_SCHEMA) return { state: "refused", branch: tip.branch, reason: `root manifest is ${m.$schema ?? "untyped"}, not ${MANIFEST_SCHEMA}` };
  if (m.authoritative !== true) {
    return {
      state: "refused",
      branch: tip.branch,
      reason: `${tip.branch} is not \`authoritative: true\` — main is still the store. Run \`state:seed --id ${row.id} --authoritative\` first.`,
    };
  }
  // `branch-store` reads a tip-keyed branch only if its manifest SAYS tip, so a
  // cutover onto one that does not would leave main empty and the mount
  // `corrupt` — measured end to end on a hand-made seed (bean hp54).
  if (m.keyedBy !== "tip") {
    return { state: "refused", branch: tip.branch, reason: `${tip.branch}'s manifest says keyedBy ${String(m.keyedBy)}, not tip, so state:mount would refuse it; fix the manifest before removing anything from main` };
  }
  const paths = (m.graphs?.length ? m.graphs.map((g) => g.path) : m.subgraph ? [m.subgraph] : []).filter(Boolean);
  if (!paths.length) return { state: "refused", branch: tip.branch, reason: `${MANIFEST_FILE} names no graph path` };

  const git = (args: string[]) => spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
  let declared: ReturnType<typeof tipLocations>;
  try {
    declared = tipLocations(repoRoot, "tip");
  } catch (e) {
    return { state: "unknown", branch: tip.branch, reason: `could not read the declarations under ${repoRoot}: ${(e as Error).message}` };
  }
  const out: Array<{ path: string; tree: string; files: number; bytes: number }> = [];
  for (const path of paths) {
    const clean = path.replace(/\/+$/, "");
    if (!declared.some((d) => d.path === clean && d.branch === tip.branch)) {
      return {
        state: "refused",
        branch: tip.branch,
        reason: `no declaration in ${repoRoot} keeps ${clean}/ on ${tip.branch} at its tip. Declare \`source: { kind: "branch", branch: "${tip.branch}", keyedBy: "tip" }\` first — the declaration and the removal are one change (bean 9ofm).`,
      };
    }
    const dirty = git(["status", "--porcelain", "--", clean]);
    if (dirty.status !== 0) return { state: "unknown", branch: tip.branch, reason: `git status failed in ${repoRoot}: ${dirty.stderr.trim()}` };
    if (dirty.stdout.trim()) return { state: "refused", branch: tip.branch, reason: `${clean}/ has uncommitted changes in ${repoRoot}; commit or push them to the branch first` };
    const local = git(["rev-parse", "--verify", "--quiet", `HEAD:${clean}`]);
    if (local.status !== 0 || !local.stdout.trim()) {
      return { state: "refused", branch: tip.branch, reason: `HEAD does not track ${clean}/ — already cut over, or never on main` };
    }
    const want = store.lookup(rootTree, clean);
    if (!want || want.sha !== local.stdout.trim()) {
      return {
        state: "refused",
        branch: tip.branch,
        reason:
          `${clean}/ on HEAD is tree ${local.stdout.trim().slice(0, 12)} and on ${tip.branch} is ${want ? `tree ${want.sha.slice(0, 12)}` : "absent"} — ` +
          `not byte-identical, so removing it from main could lose work. Refresh the branch (or push main's edits to it) first.`,
      };
    }
    const ls = git(["ls-tree", "-r", "-l", "HEAD", "--", clean]);
    const rows = ls.stdout.split("\n").filter(Boolean);
    const bytes = rows.reduce((n, l) => n + (Number(l.split(/\s+/)[3]) || 0), 0);
    out.push({ path: clean, tree: want.sha, files: rows.length, bytes });
  }

  const summary = out.map((p) => `${p.path}/ (${p.files} file(s), ${p.bytes} bytes, tree ${p.tree.slice(0, 12)})`).join(", ");

  // DEPOSIT FIRST (owner, 2026-10-06: "cutover dirs should go to fsh-guts").
  // Every path's snapshot lands in its layer's trashcan and is re-read from
  // the tip before a single `git rm` runs; any refusal here returns with main
  // untouched. A dry run checks the trashcan can take it and writes nothing.
  const head = git(["rev-parse", "HEAD"]).stdout.trim();
  const date = new Date().toISOString().slice(0, 10);
  const deposits: Deposit[] = [];
  for (const p of out) {
    const target = fshGutsTargetFor(repoRoot, p.path);
    if (target.state !== "ok") return { state: target.state, branch: tip.branch, reason: target.reason };
    const d = depositCutover(
      target,
      { instance: target.instance, directory: target.directoryId, path: p.path, sourceCommit: head, tree: p.tree, authoritativeBranch: tip.branch, files: p.files, bytes: p.bytes, date },
      { repoRoot, remote: opts.remote, storeDir: opts.storeDir, dryRun: opts.commit !== true },
    );
    // Narrowed on `"deposit" in d`: typescript7 declines to narrow this union by the state literals.
    if (!("deposit" in d)) return { state: d.state, branch: tip.branch, reason: d.reason };
    deposits.push(d.deposit);
  }
  const deposited = deposits.map((d) => `${d.archive} on ${d.branch}`).join(", ");

  if (opts.commit !== true) {
    return {
      state: "would-cut-over",
      branch: tip.branch,
      paths: out,
      deposits,
      reason: `dry run: would deposit ${deposited}, then remove ${summary} from main and ignore the mount path. Re-run with --commit to deposit, verify, and stage the removal as one commit (main is not pushed).`,
    };
  }

  for (const p of out) {
    const rm = git(["rm", "-r", "-q", "--", p.path]);
    if (rm.status !== 0) return { state: "unknown", branch: tip.branch, reason: `git rm -r ${p.path} failed: ${rm.stderr.trim()}` };
  }
  const ignorePath = join(repoRoot, ".gitignore");
  const existing = existsSync(ignorePath) ? readFileSync(ignorePath, "utf-8") : "";
  const lines = out.map((p) => `/${p.path}/**`).filter((l) => !existing.split("\n").includes(l));
  if (lines.length) {
    appendFileSync(
      ignorePath,
      `${existing && !existing.endsWith("\n") ? "\n" : ""}# Kept on ${tip.branch}; mounted here by state:mount, never committed to main\n${lines.join("\n")}\n`,
    );
  }
  const add = git(["add", "--", ".gitignore"]);
  if (add.status !== 0) return { state: "unknown", branch: tip.branch, reason: `git add .gitignore failed: ${add.stderr.trim()}` };
  const message =
    `state(${row.id}): cut ${out.map((p) => `${p.path}/`).join(", ")} over to ${tip.branch} — the main half\n\n` +
    out.map((p) => `${p.path}/ is tree ${p.tree} on ${tip.branch}@${tip.tip.slice(0, 12)}, byte-identical to HEAD:${p.path}; ${p.files} file(s), ${p.bytes} bytes removed from main.`).join("\n") +
    `\n\nDeposited first, and verified on the tip: ` +
    deposits.map((d) => `${d.archive} (+ .md provenance) on ${d.branch}@${(d.commit ?? "").slice(0, 12)}`).join(", ") +
    `.\n\nThe branch manifest says authoritative: true. Mount it with state:mount.`;
  const commit = git(["commit", "-q", "-m", message]);
  if (commit.status !== 0) return { state: "unknown", branch: tip.branch, reason: `git commit failed: ${commit.stderr.trim() || commit.stdout.trim()}` };
  const sha = git(["rev-parse", "HEAD"]).stdout.trim();
  return { state: "cut-over", branch: tip.branch, paths: out, deposits, commit: sha, reason: `deposited ${deposited}, then committed ${sha.slice(0, 12)} removing ${summary}; main NOT pushed — review it, then push` };
}

export function cutoverReport(r: CutoverResult): string {
  // Narrowed by naming the arm it KEEPS, as `report` below does: typescript7
  // declines to narrow this union by excluding the other arm's literals.
  if (r.state !== "would-cut-over" && r.state !== "cut-over") return `${r.state === "refused" ? "·" : "✗"} ${r.branch}: ${r.state} — ${r.reason}`;
  const L = [`${r.state === "cut-over" ? "✓" : "·"} ${r.branch}: ${r.state} — ${r.reason}`];
  for (const p of r.paths) L.push(`    - ${p.path}/: ${p.files} file(s), ${p.bytes} bytes, tree ${p.tree}`);
  for (const d of r.deposits) L.push(`    ${d.commit ? "✓" : "·"} fsh-guts: ${d.archive} + ${d.record.split("/").pop()} on ${d.branch}${d.commit ? `@${d.commit.slice(0, 12)}` : " (not yet written)"}`);
  return L.join("\n");
}

/**
 * ## `--retire <path> --into <instance>` — separating a whole layer
 *
 * A cutover moves one DIRECTORY of a layer onto that layer's own state
 * branch. Separation moves a whole LAYER ROOT out of the repository into
 * its own (stage 13 of `sub-kg-lifecycle`), so neither half of `--cutover`
 * fits: there is no tip-keyed branch the path is kept on — the live copy is
 * another repository — and the trashcan is not the layer's own, because
 * that layer is the thing leaving. It is the layer named by `--into`:
 * the host that keeps the frozen copy.
 *
 * It REFUSES unless `<path>` is a layer root (it carries a declaration),
 * `--into` names a different layer under the same checkout whose
 * `fsh-guts` graph is kept at a branch tip, `--repository` answers
 * `git ls-remote`, and nothing under the paths is uncommitted. The deposit is
 * one archive of every path at HEAD — the root and each `--also` file beside
 * it, such as its `.config.json` — checked to extract to exactly the tree
 * and blob ids HEAD holds, plus a `separated-instance` note carrying the four
 * stage-13 fields. Only once the deposit is re-read from the tip does
 * `--commit` stage the `git rm` as one commit. Never pushes, like `--cutover`.
 *
 * `matchesCommit` is the HOST commit the copy was taken at, the meaning the
 * first separation's notes gave it. The live repository's layout is its own
 * (the forks nest and rename), so the copy is NOT compared to it: the note
 * records the repository's tip at the time and says the comparison was not
 * made, rather than implying one.
 */
export interface RetireOptions {
  repoRoot?: string;
  remote?: string;
  storeDir?: string;
  /** The layer whose `fsh-guts` keeps the frozen copy. */
  into: string;
  /** Where the live graph is now — anything `git ls-remote` accepts. */
  repository: string;
  /** Files beside the root that leave with it (`<name>.config.json`). */
  also?: string[];
  /** The bean the separation is worked under, recorded on the note. */
  bean?: string;
  /** Make the commit. Without it, a dry run. Never pushes either way. */
  commit?: boolean;
}

export type RetireResult =
  | {
      state: "would-retire" | "retired";
      path: string;
      instance: string;
      into: string;
      paths: Array<{ path: string; id: string; files: number; bytes: number }>;
      repositoryTip: string;
      deposit: Deposit;
      commit?: string;
      reason: string;
    }
  | { state: "refused" | "unknown"; reason: string };

/** `<fsh-guts>/separated/<name>`, the stage-13 location, as an archive rather than a loose tree. */
export function separationStem(gutsPath: string, path: string): string {
  return `${gutsPath}/separated/${path.split("/").pop()}`;
}

/** The provenance note: a `separated-instance` node carrying the four stage-13 fields. */
export function separationRecord(p: {
  instance: string;
  into: string;
  path: string;
  paths: Array<{ path: string; id: string; files: number; bytes: number }>;
  repository: string;
  repositoryTip: string;
  matchesCommit: string;
  archive: string;
  date: string;
  bean?: string;
}): string {
  const q = (s: string) => JSON.stringify(s);
  const files = p.paths.reduce((n, x) => n + x.files, 0);
  const bytes = p.paths.reduce((n, x) => n + x.bytes, 0);
  return [
    "---",
    `$schema: ${FSH_GUTS_SCHEMA_ID}`,
    `title: ${q(`${p.path}/ (${p.instance}), as it left ${p.into} for ${p.repository}`)}`,
    `kind: ${FROZEN_SUBTREE_KIND}`,
    `movedOn: ${p.date}`,
    `movedFrom: ${q(`${p.path}/`)}`,
    "reason: separated",
    `repository: ${q(p.repository)}`,
    `matchesCommit: ${p.matchesCommit}`,
    `repositoryTip: ${p.repositoryTip}`,
    "repositoryCompared: false",
    `instance: ${q(p.instance)}`,
    `into: ${q(p.into)}`,
    ...(p.bean ? [`bean: ${p.bean}`] : []),
    `archive: ${q(p.archive)}`,
    "paths:",
    // Plain strings: the fsh-guts front-matter reader keeps scalars and lists of scalars.
    ...p.paths.map((x) => `  - ${q(`${x.path} = ${x.id} (${x.files} file(s), ${x.bytes} bytes)`)}`),
    `files: ${files}`,
    `bytes: ${bytes}`,
    "summary: >-",
    `  ${p.paths.map((x) => x.path).join(", ")} as ${p.into}'s main tracked them at ${p.matchesCommit.slice(0, 12)}`,
    `  (${files} file(s), ${bytes} bytes), packed beside this file as ${p.archive}. Frozen: never refreshed,`,
    `  never rendered. The live graph is ${p.repository}, whose tip was ${p.repositoryTip.slice(0, 12)} at`,
    "  the time; its layout was not compared to this copy.",
    "---",
    "",
    `# ${p.path}/ (${p.instance}), at its separation`,
    "",
    `\`${p.archive}\` beside this file holds ${p.paths.map((x) => `\`${x.path}\``).join(", ")} exactly as`,
    `\`${p.into}\`'s \`main\` tracked them at \`${p.matchesCommit}\` — list it with \`tar -tzf ${p.archive}\`.`,
    "Extracted and added to a fresh index, each path writes the id recorded above, which is how",
    "the separation verified the copy before removing anything.",
    "",
    `The live graph is \`${p.repository}\`. Change it there; do not unpack this back onto \`main\`.`,
    "",
  ].join("\n");
}

/** Each path's id (tree or blob) as the archive extracts it, by the identity HEAD uses. */
export function archiveIds(archive: Buffer, paths: readonly string[]): Map<string, string | undefined> | undefined {
  const dir = mkdtempSync(join(tmpdir(), "separation-deposit-"));
  try {
    const git = (args: string[]) =>
      spawnSync("git", ["-c", "core.autocrlf=false", "-c", "core.fileMode=true", "-c", "core.symlinks=true", ...args], {
        cwd: dir,
        encoding: "utf-8",
        maxBuffer: 256 * 1024 * 1024,
      });
    if (git(["init", "-q"]).status !== 0) return undefined;
    if (spawnSync("tar", ["-xzf", "-"], { cwd: dir, input: archive }).status !== 0) return undefined;
    // -f: a `.gitignore` INSIDE the snapshot must not hide a file it carries.
    if (git(["add", "-A", "-f", "--", ...paths]).status !== 0) return undefined;
    const tree = git(["write-tree"]).stdout.trim();
    const out = new Map<string, string | undefined>();
    for (const p of paths) {
      const t = git(["rev-parse", `${tree}:${p}`]);
      out.set(p, t.status === 0 ? t.stdout.trim() : undefined);
    }
    return out;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Separate the layer rooted at `path`. See §"`--retire`" above. */
export function retireInstance(path: string, opts: RetireOptions): RetireResult {
  const repoRoot = opts.repoRoot ?? defaultRepoRoot();
  const clean = path.replace(/\/+$/, "").replace(/^\.\//, "");
  const git = (args: string[]) => spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });

  let roots: string[];
  try {
    roots = layerRootsIn(repoRoot);
  } catch (e) {
    return { state: "unknown", reason: `could not list the instances under ${repoRoot}: ${(e as Error).message}` };
  }
  const relRoot = (r: string) => relative(repoRoot, r).split("\\").join("/");
  const leavingRoot = roots.find((r) => relRoot(r) === clean);
  if (!leavingRoot) {
    return { state: "refused", reason: `${clean}/ is not an instance root under ${repoRoot} — it carries no declaration, so it is a directory to cut over, not an instance to separate` };
  }
  const leaving = readInstance(repoRoot, leavingRoot);
  if (leaving.state !== "ok") return leaving;
  let host: Extract<ReadInstance, { state: "ok" }> | undefined;
  for (const r of roots) {
    if (r === leavingRoot) continue;
    const ri = readInstance(repoRoot, r);
    if (ri.state === "ok" && ri.instance === opts.into) host = ri;
  }
  if (!host) {
    return { state: "refused", reason: `no OTHER instance under ${repoRoot} is named ${opts.into}, so there is no host to keep the frozen copy of ${leaving.instance}` };
  }
  const target = gutsOf(repoRoot, host, `${clean}/`);
  if (target.state !== "ok") return target;
  if (target.path === clean || target.path.startsWith(`${clean}/`)) {
    return { state: "refused", reason: `${opts.into}'s fsh-guts (${target.path}/) is inside ${clean}/, the thing leaving` };
  }

  const ls = spawnSync("git", ["ls-remote", opts.repository, "HEAD"], { cwd: repoRoot, encoding: "utf-8" });
  const repositoryTip = ls.status === 0 ? (ls.stdout.split(/\s/)[0] ?? "") : "";
  if (!repositoryTip) {
    return { state: "unknown", reason: `${opts.repository} did not answer git ls-remote (${ls.stderr.trim() || "no HEAD"}), so there is no live copy to point the note at; nothing was removed` };
  }

  const all = [clean, ...(opts.also ?? []).map((a) => a.replace(/\/+$/, "").replace(/^\.\//, ""))];
  const paths: Array<{ path: string; id: string; files: number; bytes: number }> = [];
  for (const p of all) {
    const dirty = git(["status", "--porcelain", "--", p]);
    if (dirty.status !== 0) return { state: "unknown", reason: `git status failed in ${repoRoot}: ${dirty.stderr.trim()}` };
    if (dirty.stdout.trim()) return { state: "refused", reason: `${p} has uncommitted changes in ${repoRoot}; commit them first, so the copy is a commit` };
    const id = git(["rev-parse", "--verify", "--quiet", `HEAD:${p}`]).stdout.trim();
    if (!id) return { state: "refused", reason: `HEAD does not track ${p} — already separated, or never on main` };
    const rows = git(["ls-tree", "-r", "-l", "HEAD", "--", p]).stdout.split("\n").filter(Boolean);
    paths.push({ path: p, id, files: rows.length, bytes: rows.reduce((n, l) => n + (Number(l.split(/\s+/)[3]) || 0), 0) });
  }
  const head = git(["rev-parse", "HEAD"]).stdout.trim();
  const at = git(["log", "-1", "--format=%ct", head]).stdout.trim();
  // Archive a tree holding ONLY the leaving paths, not `head` itself: `git
  // archive` applies the archived tree's `.gitattributes`, and the root's
  // `eol=crlf` on `*.bat` rewrote every Windows wrapper, so the snapshot of
  // the formal-math layer's directory extracted to a tree HEAD never held. A temporary
  // index keeps the real one untouched.
  const index = join(mkdtempSync(join(tmpdir(), "separation-index-")), "index");
  const env = { ...process.env, GIT_INDEX_FILE: index };
  const gi = (args: string[]) => spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8", env });
  let only = "";
  try {
    if (gi(["read-tree", "--empty"]).status !== 0) return { state: "unknown", reason: "git read-tree --empty failed" };
    // `ls-tree -r` rows are `--index-info` input as they stand, for a file
    // (an `--also` path) and a directory alike.
    const rows = gi(["ls-tree", "-r", "-z", head, "--", ...all]);
    if (rows.status !== 0) return { state: "unknown", reason: `git ls-tree of ${all.join(", ")} failed: ${rows.stderr.trim()}` };
    const r = spawnSync("git", ["update-index", "-z", "--index-info"], { cwd: repoRoot, encoding: "utf-8", env, input: rows.stdout });
    if (r.status !== 0) return { state: "unknown", reason: `git update-index of ${all.join(", ")} failed: ${r.stderr.trim()}` };
    only = gi(["write-tree"]).stdout.trim();
  } finally {
    rmSync(dirname(index), { recursive: true, force: true });
  }
  if (!only) return { state: "unknown", reason: `could not write a tree of ${all.join(", ")}` };
  const archived = spawnSync("git", ["archive", "--format=tar.gz", `--mtime=@${at || "0"}`, only], {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (archived.status !== 0) return { state: "unknown", reason: `git archive of ${all.join(", ")} at ${head.slice(0, 12)} failed: ${archived.stderr.toString().trim()}` };
  const archive = archived.stdout as Buffer;
  const ids = archiveIds(archive, all);
  for (const p of paths) {
    const got = ids?.get(p.path);
    if (got !== p.id) {
      return { state: "refused", reason: `the snapshot's ${p.path} extracts to ${got ?? "(unreadable)"}, not ${p.id} — a deposit that is not what HEAD holds is not a deposit, so nothing was removed` };
    }
  }

  const stem = separationStem(target.path, clean);
  const archiveName = `${stem.split("/").pop()}.tar.gz`;
  const record = separationRecord({
    instance: leaving.instance,
    into: opts.into,
    path: clean,
    paths,
    repository: opts.repository,
    repositoryTip,
    matchesCommit: head,
    archive: archiveName,
    date: new Date().toISOString().slice(0, 10),
    bean: opts.bean,
  });
  const d = writeDeposit(
    target,
    { stem, archive, record },
    `fsh-guts: deposit ${clean}/ (${leaving.instance}) before its separation removes it from main\n\n` +
      `${all.join(", ")} at ${head}; the live graph is ${opts.repository}.`,
    { repoRoot, remote: opts.remote, storeDir: opts.storeDir, dryRun: opts.commit !== true },
  );
  // Narrowed on `"deposit" in d`: typescript7 declines to narrow this union by the state literals.
  if (!("deposit" in d)) return { state: d.state, reason: d.reason };
  const summary = paths.map((p) => `${p.path} (${p.files} file(s), ${p.bytes} bytes)`).join(", ");
  const base = { path: clean, instance: leaving.instance, into: opts.into, paths, repositoryTip, deposit: d.deposit };
  if (opts.commit !== true) {
    return {
      state: "would-retire",
      ...base,
      reason: `dry run: would deposit ${d.deposit.archive} on ${d.deposit.branch}, then remove ${summary} from main. Re-run with --commit to deposit, verify, and stage the removal as one commit (main is not pushed).`,
    };
  }
  for (const p of all) {
    const rm = git(["rm", "-r", "-q", "--", p]);
    if (rm.status !== 0) return { state: "unknown", reason: `git rm -r ${p} failed: ${rm.stderr.trim()}` };
  }
  const message =
    `separate ${clean}/ (${leaving.instance}) — the live graph is ${opts.repository}\n\n` +
    `Removed from main: ${summary}.\n` +
    `Deposited first, and verified on the tip: ${d.deposit.archive} (+ .md note) on ${d.deposit.branch}@${(d.deposit.commit ?? "").slice(0, 12)}; ` +
    `it extracts to exactly HEAD:${clean} at ${head.slice(0, 12)}.\n` +
    `${opts.repository} was at ${repositoryTip.slice(0, 12)}; its layout was not compared to the copy.` +
    (opts.bean ? `\n\nBean: ${opts.bean}` : "");
  const c = git(["commit", "-q", "-m", message]);
  if (c.status !== 0) return { state: "unknown", reason: `git commit failed: ${c.stderr.trim() || c.stdout.trim()}` };
  const sha = git(["rev-parse", "HEAD"]).stdout.trim();
  return { state: "retired", ...base, commit: sha, reason: `deposited ${d.deposit.archive} on ${d.deposit.branch}, then committed ${sha.slice(0, 12)} removing ${summary}; main NOT pushed — review it, then push` };
}

export function retireReport(r: RetireResult): string {
  if (r.state !== "would-retire" && r.state !== "retired") return `${r.state === "refused" ? "·" : "✗"} ${r.state} — ${r.reason}`;
  const L = [`${r.state === "retired" ? "✓" : "·"} ${r.path}/ (${r.instance}) into ${r.into}: ${r.state} — ${r.reason}`];
  for (const p of r.paths) L.push(`    - ${p.path}: ${p.files} file(s), ${p.bytes} bytes, ${p.id}`);
  const d = r.deposit;
  L.push(`    ${d.commit ? "✓" : "·"} fsh-guts: ${d.archive} + ${d.record.split("/").pop()} on ${d.branch}${d.commit ? `@${d.commit.slice(0, 12)}` : " (not yet written)"}`);
  return L.join("\n");
}

export function report(r: SeedResult): string {
  // Narrowed by naming the arm it KEEPS: `typescript7` declines to narrow this
  // union by excluding three of the other arm's literals.
  if (r.state !== "refreshed" && r.state !== "current") {
    return `${r.state === "refused" ? "·" : "✗"} ${r.branch}: ${r.state} — ${r.reason}`;
  }
  // A dry run has pushed nothing, so it is neither verified nor failed — the
  // third mark, for the same reason every other report here keeps three.
  const mark = r.state === "refreshed" && r.commit === undefined ? "·" : r.verified ? "✓" : "✗";
  const L = [`${mark} ${r.branch}: ${r.state} — ${r.reason}`];
  for (const g of r.graphs) {
    L.push(`    ${g.had === g.want ? "·" : "→"} ${g.path}: ${g.files} file(s), tree ${g.want.slice(0, 12)}${g.had && g.had !== g.want ? ` (was ${g.had.slice(0, 12)})` : ""}`);
  }
  return L.join("\n");
}

export function exitCode(r: SeedResult): number {
  switch (r.state) {
    case "current":
      return 0;
    case "refreshed":
      return r.verified || r.commit === undefined ? 0 : 1;
    case "refused":
      return 5;
    case "failed":
      return 1;
    case "unknown":
      return 4;
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const named = (f: string): string | undefined => {
    const i = argv.indexOf(f);
    return i === -1 ? undefined : argv[i + 1];
  };
  const repoRootArg = named("--repo-root") !== undefined ? resolve(named("--repo-root")!) : undefined;
  const retire = named("--retire");
  if (retire !== undefined) {
    const into = named("--into");
    const repository = named("--repository");
    if (!into || !repository) {
      console.error("usage: bun run cat state:seed --retire <instance root> --into <host instance> --repository <url> [--also <file>]... [--bean <id>] [--commit] [--repo-root <dir>] [--json]");
      process.exit(5);
    }
    const also = argv.flatMap((a, i) => (a === "--also" && argv[i + 1] ? [argv[i + 1]!] : []));
    const r = retireInstance(retire, { repoRoot: repoRootArg, into, repository, also, bean: named("--bean"), commit: argv.includes("--commit") });
    if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
    else console.log(retireReport(r));
    process.exit(r.state === "refused" ? 5 : r.state === "unknown" ? 4 : 0);
  }
  if (argv.includes("--init")) {
    const r = initDeclaredStateBranches({
      repoRoot: repoRootArg ?? defaultRepoRoot(),
      id: named("--id"),
      dryRun: argv.includes("--dry-run"),
    });
    if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
    else console.log(initReport(r));
    process.exit(initExitCode(r));
  }
  const id = named("--id");
  if (!id) {
    console.error(
      "usage: bun run cat state:seed --init [--id <directory id>] [--repo-root <dir>] [--dry-run] [--json]\n" +
        "       bun run cat state:seed --id <directory id or branch> [--repo-root <dir>] [--from-manifest] [--authoritative] [--dry-run] [--json]\n" +
        "       bun run cat state:seed --id <id> --cutover [--commit] [--repo-root <dir>] [--json]\n" +
        "       bun run cat state:seed --retire <instance root> --into <host instance> --repository <url> [--also <file>]... [--bean <id>] [--commit]",
    );
    process.exit(5);
  }
  // The repository the run is ABOUT: the cwd's git toplevel unless told
  // otherwise — never the platform's own checkout by default (bean hp54).
  const repoRoot = named("--repo-root") !== undefined ? resolve(named("--repo-root")!) : defaultRepoRoot();
  const rows = observedRows({ repoRoot }) ?? [];
  const row = rowFor(id, rows);
  if (!row) {
    console.error(`state-seed: no declared directory or remote branch in ${repoRoot} is named ${id}; the branches are ${rows.map((r) => r.name).join(", ")}`);
    process.exit(5);
  }
  if (argv.includes("--cutover")) {
    const c = cutoverMain(row, { repoRoot, commit: argv.includes("--commit") });
    if (argv.includes("--json")) console.log(JSON.stringify(c, null, 2));
    else console.log(cutoverReport(c));
    process.exit(c.state === "refused" ? 5 : c.state === "unknown" ? 4 : 0);
  }
  const r = refreshSeed(row, {
    repoRoot,
    authoritative: argv.includes("--authoritative"),
    dryRun: argv.includes("--dry-run"),
    message: named("--message"),
  });
  if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else console.log(report(r));
  process.exit(exitCode(r));
}
