#!/usr/bin/env bun
/**
 * Every seeded state branch still matches the ref it was seeded from.
 *
 * @module scripts/state-drift
 * @covers cat-harness
 *
 * `cat/cat-harness/beans`, `cat/cat-harness/todos` and
 * `cat/cat-harness/fsh-guts` are **seeds**: each says so in its own
 * `manifest.json` (`status: "seed"`, `authoritative: false`), and each is a
 * copy of one subgraph of `main` taken at a recorded `source.sha`. `main`
 * stays the store until the cutover moves every reader onto the branch.
 *
 * A cutover from a stale seed does not fail: it silently resurrects whatever
 * the seed still holds and loses whatever landed on `main` since, with no
 * diff to read afterwards.
 *
 * ## It compares TREES, not commits
 *
 * `source.sha` going stale is expected: a merge that touched nothing under
 * the subgraph leaves the seed current. So the two trees are compared, and
 * the differing file list is reported, because "refresh the seed" and
 * "somebody wrote to the branch directly" are different problems with the
 * same tree mismatch.
 *
 * ## It needs the network, so it is not a CI gate
 *
 * `check:declared-dirs` and `audit:coverage` are local and offline by
 * construction, and a gate that goes red because a fetch failed teaches
 * contributors to re-run gates until they pass. This is a command the cutover
 * must run and quote. "Could not reach the branch" is never reported as
 * "in sync".
 *
 * Exit codes: 0 every seed current · 1 drift · 4 could not determine.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { layerRootsIn, nestedDirectories, readDeclaration } from "../schemas/kg/cat-harness.ts";

import { BranchStore, MANIFEST_FILE, MANIFEST_SCHEMA } from "./branch-store.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { dirname } from "node:path";

const REPO_ROOT = resolve(dirname(HARNESS_ROOT));

/**
 * The repository a CLI run is about: the git toplevel of the current
 * directory, falling back to the platform checkout only outside any git tree.
 *
 * It was `REPO_ROOT` — the PLATFORM's root — unconditionally. Run from a
 * folio that links the platform as a submodule or sibling, every default
 * therefore read the platform's declarations (`cat/cat-harness/beans`)
 * instead of the folio's own (`cat/<instance>/beans`), and `state:seed --id
 * beans` refreshed the wrong branch's row — measured 2026-10-06 cutting a
 * folio over, where the workaround was calling `observedRows({ repoRoot })`
 * by hand (bean `hp54`). Inside the platform checkout the toplevel IS
 * `REPO_ROOT`, so its own runs see no change.
 */
export function defaultRepoRoot(cwd: string = process.cwd()): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf-8" });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : REPO_ROOT;
}

export interface SpecialBranch {
  id: string;
  shape: string;
  name: string;
  legacy: string[];
}

/** The manifest a seeded state branch carries at its root. */
export interface SeedManifest {
  $schema?: string;
  status?: string;
  /** Why, when `status` is `retired` — reported verbatim so the reason travels with the branch. */
  retiredReason?: string;
  authoritative?: boolean;
  subgraph?: string;
  source?: { ref?: string; sha?: string };
  graphs?: Array<{ path: string; tree?: string; files?: number }>;
  /** A ROUTE-keyed seed (`keyedBy: "route"`) lists its directories here instead of `graphs`. */
  keyedBy?: string;
  directories?: Array<{ id?: string; path: string }>;
  /** Repo-relative globs (`*` within one segment) the seed deliberately does not carry. */
  excluded?: string[];
}

/** `*` matches within one path segment; nothing else is special. */
export function globToRegExp(glob: string): RegExp {
  return new RegExp(`^${glob.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`);
}

/**
 * The ref a seed is current WITH. A tip seed records it (`source.ref`). A
 * ROUTE seed's source is the default branch by construction, not by guess: a
 * route has ONE writer, the generator that regenerates it from `main` after
 * every merge (bean `1j3q`). The two route seeds (uml-overview, ig-docs)
 * record only `seededFrom`, so without this they were never measured.
 */
export function sourceRefOf(m: Pick<SeedManifest, "source" | "keyedBy">): string | undefined {
  return m.source?.ref ?? (m.keyedBy === "route" ? "main" : undefined);
}

export interface DriftRow {
  id: string;
  branch: string;
  path: string;
  /**
   * - `in-sync` — the branch's tree at `path` is byte-identical to the source
   *   ref's.
   * - `drift` — they differ; `files` names how.
   * - `authoritative` — the manifest says the branch IS the store, so there is
   *   no source ref to be current with. The inverse invariant (the checkout
   *   must no longer track the path) is `check:declared-dirs`'s `not-cut-over`.
   * - `not-a-seed` — no `state-manifest/v1` at the root. `gh-pages` and the
   *   commit-keyed `qa-reports` are not seeds of anything.
   * - `retired` — `status: "retired"`. A SUPERSEDED seed, which is worse than
   *   a stale one: it still carries a valid manifest over real graphs, so a
   *   cutover tool that found it would use it. `cat/cat-harness/state` is the
   *   case (owner, 2026-10-03, D4 option (b)): per-graph branches replaced it,
   *   and the beans graph's branch is `cat/cat-harness/beans`. Reporting its
   *   drift would be crying wolf over a branch nothing should read; reporting
   *   it as a seed would be worse. So it is named, and not compared.
   * - `unknown` — could not be determined. **Never folded into `in-sync`.**
   */
  state: "in-sync" | "drift" | "authoritative" | "not-a-seed" | "retired" | "unknown";
  detail?: string;
  /** On `drift`, `git diff-tree --name-status` between the two trees. */
  files?: string[];
  /** The branch is on the remote and no directory declares it (the health finding, bean rva2). */
  undeclared?: true;
}

/** A commit's root tree. The reads below are tree-addressed, `fetchTip` is not. */
function treeOf(store: BranchStore, commit: string): string {
  return store.must(["rev-parse", `${commit}^{tree}`]).trim();
}

/**
 * Candidate names for a special branch, canonical first — the resolution rule
 * retired `special-branches.json` stated: the new name if it exists on the remote,
 * else the first `legacy` that does. {@link BranchStore.open} implements
 * exactly that over an ordered candidate list, so the rule has one
 * implementation rather than a second one here.
 *
 * `shape: "family"` entries (the Lean and FHIR caches) are a branch PREFIX,
 * not a branch, and are not seeds of a subgraph of this repository.
 */
export function candidatesOf(b: SpecialBranch): string[] | undefined {
  if (b.shape !== "branch") return undefined;
  return [b.name, ...(b.legacy ?? [])];
}

/**
 * The special branches OBSERVED on the remote (bean rva2, owner 2026-10-04:
 * *"retire special-branches.json from being in infrastructure. it can be in
 * health checks"*): every `cat/**` head, and `gh-pages`. Asked of the remote
 * rather than read from a list, so a branch nobody declared (measured that day:
 * `cat/cat-harness/merge-queue`) is SEEN rather than missing from a table.
 * `undefined` when the remote cannot be listed: never an empty set.
 */
export function observedBranches(opts: { repoRoot?: string; remote?: string } = {}): string[] | undefined {
  const cwd = opts.repoRoot ?? defaultRepoRoot();
  const remote = opts.remote ?? process.env.BRANCH_STORE_REMOTE ?? "origin";
  const r = spawnSync("git", ["ls-remote", "--heads", remote, "refs/heads/cat/*", "refs/heads/gh-pages"], { cwd, encoding: "utf-8", timeout: 60_000 });
  if (r.status !== 0) return undefined;
  return r.stdout
    .split("\n")
    .map((l) => l.split("\t")[1]?.replace(/^refs\/heads\//, ""))
    .filter((n): n is string => Boolean(n))
    .sort();
}

/**
 * Which declared directory each branch backs: a single-branch \`storage\` or
 * \`source\`, read from every layer's declaration. A FAMILY declares a
 * prefix, so its members match by prefix. The declarations are the only source
 * of a branch's NAME; this map is how an observed branch is told apart from an
 * undeclared one.
 */
export function declaredBranches(repoRoot: string = defaultRepoRoot()): { exact: Map<string, string>; prefixes: Map<string, string> } {
  const exact = new Map<string, string>();
  const prefixes = new Map<string, string>();
  for (const root of layerRootsIn(repoRoot)) {
    let decl;
    try {
      decl = readDeclaration(root);
    } catch {
      continue; // an unreadable declaration is check:declared-dirs' finding
    }
    // Nested entries too (`beans/beans.json`'s `queue`): a store declared on
    // the node that labels it is as declared as one in the layer file.
    const entries = decl ? [...(decl.directories ?? []), ...nestedDirectories(root, decl)] : [];
    for (const d of entries) {
      const st = d.storage as { branch?: string; branchPrefix?: string } | undefined;
      const src = d.source as { kind?: string; branch?: string; branchPrefix?: string } | undefined;
      const branch = st?.branch ?? (src?.kind === "branch" ? src.branch : undefined);
      const prefix = st?.branchPrefix ?? (src?.kind === "family" ? src.branchPrefix : undefined);
      if (branch && !exact.has(branch)) exact.set(branch, d.id);
      if (prefix && !prefixes.has(prefix)) prefixes.set(prefix, d.id);
    }
  }
  return { exact, prefixes };
}

/**
 * A table of special branches, read ONLY when a caller names one (the fixture
 * tests). There is no default: `special-branches.json` is gone (owner,
 * 2026-10-05: "dont use /get rid of"), and every branch's name is its
 * declaring directory's `storage`.
 */
export function specialBranches(file: string): SpecialBranch[] {
  return (JSON.parse(readFileSync(file, "utf-8")) as { branches: SpecialBranch[] }).branches;
}

/**
 * One special branch's rows — one per `graphs[]` entry in its manifest.
 *
 * `source.ref` is read from the manifest rather than assumed to be `main`: a
 * seed that recorded a different ref is compared against the ref it actually
 * claims, and a seed that records none is `unknown` rather than compared
 * against a guess.
 */
export interface DriftOptions {
  repoRoot?: string;
  /** Passed to {@link BranchStore.open}; a test points both at a local bare repository so the gate is exercised against real git and no network. */
  remote?: string;
  storeDir?: string;
  log?: (l: string) => void;
}

export function driftOf(b: SpecialBranch, opts: DriftOptions = {}): DriftRow[] {
  const candidates = candidatesOf(b);
  if (!candidates) return [];
  const row = (r: Partial<DriftRow>): DriftRow => ({ id: b.id, branch: b.name, path: "", state: "unknown", ...r });

  const open = (names: string[]): BranchStore =>
    BranchStore.open(names, { repoRoot: opts.repoRoot, remote: opts.remote, storeDir: opts.storeDir, log: opts.log ?? (() => {}) });
  const store = open(candidates);
  const here = store.fetchTip();
  if (here.state !== "ok") {
    return [row({ state: "unknown", detail: `could not resolve ${b.name}: ${here.state === "absent" ? "no such branch on the remote" : here.reason}` })];
  }
  const hereTree = treeOf(store, here.tip);

  // Read the manifest through the PLUMBING rather than `readJson`, which goes
  // via `verifiedTip` and so answers "is this a valid state store" — the
  // wrong question here. `gh-pages` and the commit-keyed `qa-reports` are
  // perfectly healthy branches that are not seeds of anything, and this gate
  // must say `not-a-seed` for them rather than `unknown`: an unknown is a
  // finding, and three of those on every run is how a report stops being read.
  const entry = store.lookup(hereTree, MANIFEST_FILE);
  if (!entry) return [row({ branch: here.branch, state: "not-a-seed", detail: `no ${MANIFEST_FILE} at the root of ${here.branch}` })];
  if (entry.type !== "blob") return [row({ branch: here.branch, state: "unknown", detail: `${MANIFEST_FILE} on ${here.branch} is a ${entry.type}` })];
  if (!store.ensureBlobs(hereTree, [entry.sha])) {
    return [row({ branch: here.branch, state: "unknown", detail: `could not fetch ${MANIFEST_FILE} from ${here.branch}` })];
  }
  let m: SeedManifest;
  try {
    m = JSON.parse(store.blobText(entry.sha)) as SeedManifest;
  } catch (e) {
    return [row({ branch: here.branch, state: "unknown", detail: `${MANIFEST_FILE} on ${here.branch} does not parse: ${(e as Error).message}` })];
  }
  if (m.$schema !== MANIFEST_SCHEMA) return [row({ branch: here.branch, state: "not-a-seed", detail: `root manifest is ${m.$schema ?? "untyped"}, not ${MANIFEST_SCHEMA}` })];
  if (m.status === "retired") {
    return [row({ branch: here.branch, state: "retired", detail: m.retiredReason ?? "the manifest says this branch is retired; nothing should read it" })];
  }
  if (m.authoritative === true) return [row({ branch: here.branch, state: "authoritative", detail: "the manifest says this branch IS the store" })];

  const ref = sourceRefOf(m);
  if (!ref) return [row({ state: "unknown", detail: `${MANIFEST_FILE} records no \`source.ref\`, so there is nothing to be current with` })];
  const graphs = m.graphs?.length
    ? m.graphs
    : m.directories?.length
      ? m.directories.map((d) => ({ path: d.path.replace(/\/$/, "") }))
      : m.subgraph
        ? [{ path: m.subgraph }]
        : [];
  const excluded = (m.excluded ?? []).map(globToRegExp);
  if (!graphs.length) return [row({ state: "unknown", detail: `${MANIFEST_FILE} names no graph path` })];

  // The SOURCE ref, fetched into the same bare store, so the two trees' object
  // ids are directly comparable and `diff-tree` needs no second repository.
  const src = open([ref]);
  const srcTip = src.fetchTip();
  if (srcTip.state !== "ok") {
    return [row({ branch: here.branch, state: "unknown", detail: `could not resolve ${ref}: ${srcTip.state === "absent" ? "no such branch on the remote" : srcTip.reason}` })];
  }
  const srcTree = treeOf(src, srcTip.tip);

  const out: DriftRow[] = [];
  for (const g of graphs) {
    const mine = store.lookup(hereTree, g.path);
    const theirs = src.lookup(srcTree, g.path);
    const base = { branch: here.branch, path: g.path, detail: `${here.branch}@${here.tip.slice(0, 12)} vs ${ref}@${srcTip.tip.slice(0, 12)}` };
    if (!mine || !theirs) {
      out.push(
        row({
          ...base,
          state: "unknown",
          detail: `${!mine ? `${g.path} is not on ${here.branch}` : `${g.path} is not on ${ref}`} — ${base.detail}`,
        }),
      );
      continue;
    }
    if (mine.sha === theirs.sha) {
      out.push(row({ ...base, state: "in-sync" }));
      continue;
    }
    // `diff-tree -r --name-status` compares the blob ids the trees carry and
    // never opens a blob, so a partial clone answers it once the TREES are
    // present — which is what `hydrate` ensures.
    store.hydrate(mine.sha);
    src.hydrate(theirs.sha);
    const d = store.git(["diff-tree", "-r", "--name-status", mine.sha, theirs.sha]);
    // `diff-tree` paths are relative to the subtree; `excluded` globs are repo-relative.
    const files = (d.status === 0 ? d.stdout.toString("utf-8").split("\n").filter(Boolean) : []).filter(
      (l) => !excluded.some((r) => r.test(`${g.path}/${l.split("\t").pop()}`)),
    );
    if (d.status === 0 && files.length === 0) {
      out.push(row({ ...base, state: "in-sync", detail: `${base.detail} (differing only in what the manifest excludes)` }));
      continue;
    }
    out.push(
      row({
        ...base,
        state: "drift",
        files,
        detail: `${files.length || "?"} file(s) differ — ${base.detail}`,
      }),
    );
  }
  return out;
}

/**
 * The special branches as rows, from OBSERVATION and DECLARATION, never from a
 * table: every branch the remote holds under `cat/**` (and `gh-pages`), named
 * by the directory that declares it when one does. `undefined` when the remote
 * cannot be listed.
 */
export function observedRows(opts: { repoRoot?: string; remote?: string } = {}): (SpecialBranch & { declared: boolean })[] | undefined {
  const names = observedBranches(opts);
  if (names === undefined) return undefined;
  const { exact, prefixes } = declaredBranches(opts.repoRoot ?? defaultRepoRoot());
  return names.map((name) => {
    const prefix = [...prefixes.keys()].find((p) => name.startsWith(p));
    const id = exact.get(name) ?? (prefix ? prefixes.get(prefix)! : name);
    return { id, shape: "branch", name, legacy: [], declared: exact.has(name) || prefix !== undefined };
  });
}

export function driftRows(opts: DriftOptions & { file?: string } = {}): DriftRow[] {
  if (opts.file !== undefined) return specialBranches(opts.file).flatMap((b) => driftOf(b, opts));
  const rows = observedRows({ repoRoot: opts.repoRoot, remote: opts.remote });
  if (rows === undefined) {
    return [{ id: "(remote)", branch: "", path: "", state: "unknown", detail: "could not list the remote's branches (git ls-remote failed)" }];
  }
  return rows.flatMap((b) => driftOf(b, opts).map((r) => (b.declared ? r : { ...r, undeclared: true as const })));
}

export function exitCodeFor(rows: readonly DriftRow[]): number {
  if (rows.some((r) => r.state === "drift")) return 1;
  if (rows.some((r) => r.state === "unknown")) return 4;
  return 0;
}

export const MARK = { "in-sync": "✓", drift: "✗", unknown: "?", authoritative: "·", "not-a-seed": "·", retired: "·" } as const;

/**
 * The session-start form: the finding and nothing else.
 *
 * The full report prints every differing path, and the superseded
 * `cat/cat-harness/state` alone carried **159** of them — which in a sweep
 * whose job is to be read would bury the rest of the sweep. So `--brief`
 * prints one line per drifted graph with its COUNT, and says where the list
 * is. Silent when every seed is current, because a sweep that prints a clean
 * section every time trains people to skip the section.
 */
export function brief(rows: readonly DriftRow[]): string {
  const drifted = rows.filter((r) => r.state === "drift");
  const unknown = rows.filter((r) => r.state === "unknown");
  if (!drifted.length && !unknown.length) return "";
  const lines = ["## Seeded state branches"];
  for (const r of drifted) lines.push(`  ✗ ${r.id}:${r.path} — ${r.files?.length ?? "?"} file(s) behind ${r.detail?.replace(/^.*vs /, "") ?? "its source ref"}`);
  for (const r of unknown) lines.push(`  ? ${r.id}${r.path ? `:${r.path}` : ""} — could not determine: ${r.detail ?? ""}`);
  lines.push(
    "",
    "These are SEEDS: `main` is still the store, so drift here breaks nothing today.",
    "It breaks the cutover: a cutover from a stale seed resurrects what the seed holds",
    "and loses what landed since, in one subtree replacement with no diff to read.",
    "Full list: `bun run cat state:drift`. Refresh one: `bun run cat state:seed --id <graph>`.",
  );
  return lines.join("\n");
}

if (import.meta.main) {
  const json = process.argv.includes("--json");
  const rr = process.argv.indexOf("--repo-root");
  const repoRoot = rr === -1 ? undefined : resolve(process.argv[rr + 1] ?? ".");
  const rows = driftRows({ repoRoot, log: (l) => process.argv.includes("--verbose") && console.error(l) });
  if (json) {
    console.log(JSON.stringify(rows, null, 2));
  } else if (process.argv.includes("--brief")) {
    const b = brief(rows);
    if (b) console.log(b);
  } else {
    const mark = MARK;
    for (const r of rows) {
      console.log(`  ${mark[r.state]} ${r.id}${r.path ? `:${r.path}` : ""} — ${r.state}${r.detail ? `: ${r.detail}` : ""}`);
      for (const f of r.files ?? []) console.log(`      ${f}`);
    }
    // THE HEALTH FINDING (bean rva2): on the remote, declared by no directory.
    // A seed whose cutover has not landed is expected to be undeclared; any
    // other undeclared branch is a branch nobody owns in the KG.
    // One line per BRANCH: a seed carrying three graphs is still one undeclared branch.
    const undeclared = rows.filter((r, i) => r.undeclared && rows.findIndex((x) => x.undeclared && x.branch === r.branch) === i);
    for (const r of undeclared) {
      // A seed (pre-cutover) or a retired branch is EXPECTED to be undeclared.
      const seed = r.state === "in-sync" || r.state === "drift" || r.state === "retired";
      const why = r.state === "retired" ? " (retired: nothing reads it)" : seed ? " (a seed: its cutover has not declared it yet)" : "";
      console.log(`  ${seed ? "·" : "✗"} ${r.branch || r.id} — on the remote, declared by no directory${why}`);
    }
    const seeds = rows.filter((r) => r.state === "in-sync" || r.state === "drift" || r.state === "unknown");
    const drifted = rows.filter((r) => r.state === "drift");
    const unknown = rows.filter((r) => r.state === "unknown");
    console.log(
      `\n${seeds.length} seeded graph(s) across ${rows.length} branch(es) observed on the remote; ` +
        `${undeclared.length} undeclared; ` +
        `${drifted.length} drifted; ${unknown.length} could not be determined`,
    );
    if (drifted.length) {
      console.log(
        `\n✗ Refresh the seed before any cutover — \`bun run cat state:seed --id <graph>\`, one per drifted\n` +
          `  row above. A cutover from a stale seed does NOT fail: it resurrects what the seed still\n` +
          `  holds and loses what landed on the source ref since, and the cutover commit replaces the\n` +
          `  whole subtree at once so there is no diff to read.`,
      );
    }
    if (unknown.length) console.log(`\n? Not a pass. "Could not reach the branch" and "in sync" are different answers.`);
  }
  process.exit(exitCodeFor(rows));
}
