#!/usr/bin/env bun
/**
 * Post-merge regeneration check and automated repair PR pipeline.
 *
 * @module scripts/post-merge-regen
 * @graphNode none — SDLC maintenance and repair automation
 *
 * `.github/workflows/merge-main.yml` runs `bun run cat merge:main` on an opted-in
 * PR branch when `main` moves, but nothing regenerates `main` after a PR
 * merges into it, so a merge that changes an enumerated or counted directory
 * can leave `main` red (e.g. `readme:subgraphs:check` counting files in
 * `uploads/`). This detects that and opens a repair.
 *
 * ## Principles
 *
 * 1. Detected and ACTED on: main going stale on a derived artefact is detected
 *    and an automated repair action is generated.
 * 2. Reviewable PR, never direct push to main, so the repair cannot bypass CI
 *    gates.
 * 3. NEGATIVE CONTROL: a merge that changes nothing counted triggers 0 repairs
 *    and opens NO repair PR.
 * 4. Honest reporting: if a check has no writer or its writer fails, it is
 *    reported as unrepaired/defect (exit 1), not claimed as a repair.
 * 5. A `builtAtPublish` output is never stale:
 *    a check whose writer moved only paths a layer declares it builds at
 *    publish is reported in `builtAtPublishChecks`, not as stale or repaired.
 *    Those paths are gitignored, so no repair of them could ever land.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { patternHits } from "./changed-paths.ts";
import { loadGates } from "./gates.ts";
import { TRACKED } from "./input-hash.ts";
import { COVERED, foldable, settleCovered } from "./pair-cover.ts";
import { BUILDING_ENV } from "./qa-working-copy.ts";
import {
  DEFAULT_MAX_PASSES,
  UNGATED_INPUTS,
  regenPass,
  regenToFixpoint,
  repairableGates,
  type Pair,
  type Runner,
} from "./regen-after-merge.ts";
import { isBuiltAtPublish, type BuiltAtPublish } from "../schemas/kg/built-at-publish.ts";
import { readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.ts";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { mountedInstanceRoots } from "../schemas/kg/remote-mount.ts";
import { scriptsOf as scriptTableOf } from "../schemas/sdlc/script-table.ts";
import { tipLocations } from "./branch-store.ts";
import { pairIO } from "./task-io.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = join(HARNESS_ROOT);

/**
 * Gates that judge FIXITY, not staleness, so post-merge regen never asks them.
 *
 * Each says whether a mounted layer still holds exactly the bytes its lock
 * names. Here that cannot hold, and no writer can make it hold:
 *
 * - in a LAYER's run (`layer-post-merge-regen.yml`) the caller's own checkout
 *   is copied over its locked mount before the first pass, so both fail in the
 *   audit pass, before any writer runs;
 * - in the INDEX's run, every writer that regenerates a layer's artefact
 *   writes into that layer's mount, which breaks its digest.
 *
 * Their writers re-lay a mount and leave edited bytes untouched, so asking them
 * could only end in `unrepaired` and a red run. Measured on cat-harness's run
 * 39786173033 (2026-10-22): both listed unrepaired, beside two real repairs
 * that the red run then hid. A layer's own bytes are that layer's to repair,
 * through its own run.
 */
export const FIXITY_CHECKS: Readonly<Record<string, string>> = {
  "mount:remote:check": "judges a mount against its lock; this run edits mounts by design",
  "mount:lock:check": "judges a mount against its lock; this run edits mounts by design",
};

/** The pairs post-merge regen asks: every repairable pair but the {@link FIXITY_CHECKS}. */
export function postMergePairs<P extends { check: string }>(pairs: readonly P[]): P[] {
  return pairs.filter((p) => FIXITY_CHECKS[p.check] === undefined);
}

/** One layer's root and what it declares it builds at publish. */
export interface PublishTimeDeclaration {
  /** Absolute. */
  root: string;
  builtAtPublish: readonly (Pick<BuiltAtPublish, "path"> & Partial<Pick<BuiltAtPublish, "writer">>)[];
}

/**
 * Every layer under `repoRoot` that declares `builtAtPublish` or an
 * off-checkout `storage` directory such as `test/results/` on `qa-reports`
 * (beans `p7mb`, `ksek`).
 */
export function publishTimeDeclarations(repoRoot: string): PublishTimeDeclaration[] {
  return layerRootsIn(repoRoot).flatMap((root) => {
    let list: (Pick<BuiltAtPublish, "path"> & Partial<Pick<BuiltAtPublish, "writer">>)[] = [];
    try {
      const decl = readDeclaration(root);
      const built = decl?.builtAtPublish ?? [];
      const stored = (decl?.directories ?? [])
        .filter((d) => d.storage !== undefined)
        .map((d) => ({ path: d.path.replace(/^\/+/, "").replace(/\/?$/, "/") }));
      list = [...built, ...stored];
    } catch {
      // An unreadable declaration declares nothing here: its paths then count
      // as committed, which can keep a check stale, never hide a stale one.
    }
    return list.length > 0 ? [{ root: resolve(root), builtAtPublish: list }] : [];
  });
}

/** Writers whose outputs other checks read, so they run before the repair pass. */
export const PREREQUISITE_WRITERS: readonly string[] = ["ig-index:build"];

/**
 * The prerequisite writers that some declaring layer needs run: one of
 * its `builtAtPublish` entries names the writer and its path is absent.
 */
export function missingPrerequisiteWriters(decls: readonly PublishTimeDeclaration[]): string[] {
  const out = new Set<string>();
  for (const d of decls)
    for (const e of d.builtAtPublish)
      for (const w of e.writer ?? [])
        if (PREREQUISITE_WRITERS.includes(w) && !existsSync(join(d.root, e.path))) out.add(w);
  return [...out];
}

/**
 * Whether `rel` (repo-relative) belongs to the repository that will commit the
 * post-merge repair (beans `p7mb`, `ksek`):
 * - never inside a branch-mounted state directory (`tipLocations`: `beans/`,
 *   `fsh-guts/`, `todos/`, `cat-harness/subscribed-harnesses/`, …), which is
 *   gitignored and kept on its state branch;
 * - in a layer run (`instance` set, e.g. `"cat-harness"`), inside that layer's
 *   tree only;
 * - in an index run (`instance` unset or `"."`), outside every remote mount
 *   (`mountedInstanceRoots`), which is gitignored in the index and repaired by
 *   its own layer run.
 */
export function inTargetScope(repoRoot: string, instance?: string): (rel: string) => boolean {
  const cleanInstance = instance?.replace(/^\/+|\/+$/g, "");
  let stateDirs: string[] = [];
  try {
    stateDirs = tipLocations(repoRoot)
      .map((l) => l.path.replace(/^\/+|\/+$/g, ""))
      .filter((p) => p.length > 0);
  } catch {
    stateDirs = [];
  }
  const inDirList = (rel: string, dirs: readonly string[]): boolean =>
    dirs.some((d) => rel === d || rel.startsWith(`${d}/`));
  if (cleanInstance !== undefined && cleanInstance !== "" && cleanInstance !== ".") {
    return (rel: string): boolean =>
      (rel === cleanInstance || rel.startsWith(`${cleanInstance}/`)) && !inDirList(rel, stateDirs);
  }
  let remoteDirs: string[] = [];
  try {
    remoteDirs = [...mountedInstanceRoots(repoRoot).values()]
      .map((abs) => relative(repoRoot, abs).split(sep).join("/").replace(/^\/+|\/+$/g, ""))
      .filter((p) => p.length > 0 && !p.startsWith(".."));
  } catch {
    remoteDirs = [];
  }
  return (rel: string): boolean => !inDirList(rel, remoteDirs) && !inDirList(rel, stateDirs);
}

/**
 * Whether `rel` (repo-relative) is declared `builtAtPublish` by the layer
 * that holds it: the deepest layer root containing it, asked through
 * {@link isBuiltAtPublish} with the path relative to that root.
 */
export function builtAtPublishIn(rel: string, decls: readonly PublishTimeDeclaration[], repoRoot: string): boolean {
  const abs = resolve(repoRoot, rel);
  let owner: PublishTimeDeclaration | undefined;
  for (const d of decls) {
    if ((abs === d.root || abs.startsWith(d.root + sep)) && (owner === undefined || d.root.length > owner.root.length)) owner = d;
  }
  if (owner === undefined) return false;
  return isBuiltAtPublish(owner.builtAtPublish, relative(owner.root, abs).split(sep).join("/"));
}

/** What a writer moved: paths declared `builtAtPublish`, and every other path. */
export interface WriterMoves {
  builtAtPublish: string[];
  committed: string[];
}

/**
 * Watches the tree around each writer, so a check that was red ONLY because
 * its `builtAtPublish` outputs were absent is not reported stale (bean `p7mb`).
 *
 * Why it is needed: CI judges a publish-time writer's `:check` after
 * `derive:publish` has built those outputs (folio-assistant's `publish-pages`
 * job). Post-merge regen runs no `derive:publish`, so in its tree the outputs
 * are absent, the check is red, the writer "repairs" it, and the run listed it
 * stale and repaired — files that are gitignored and can never be committed
 * (cat-harness run 39786173033: `library:viz`, `uploads:viz`, `voices:viz`,
 * `document-kinds:viz`, `slice:sqlite`, …).
 *
 * `take()` returns what moved since the previous `take()`. The first call
 * only lays the baseline. A path under a declaration is judged by its stat
 * (added, removed or rewritten); any other path by its bytes, so a writer that
 * rewrites a committed file with the same bytes moved nothing. A file whose
 * stat did not change is taken as unchanged, so nothing is rehashed for it.
 */
export interface MoveTracker {
  take: () => WriterMoves;
}

/** Never content: install artefacts, git, and the scratch a build writes (as `publish-check.ts`). */
const UNWATCHED_DIRS = new Set(["node_modules", ".git", "_site", "build"]);

export function treeMoveTracker(
  repoRoot: string,
  decls: readonly PublishTimeDeclaration[] = publishTimeDeclarations(repoRoot),
  instance?: string,
): MoveTracker {
  const inScope = inTargetScope(repoRoot, instance);
  type Seen = { stat: string; publishTime: boolean; hash?: string };
  let last: Map<string, Seen> | undefined;
  const walk = (prev: Map<string, Seen> | undefined): Map<string, Seen> => {
    const out = new Map<string, Seen>();
    const visit = (dir: string): void => {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (UNWATCHED_DIRS.has(e.name)) continue;
        const abs = join(dir, e.name);
        if (e.isDirectory()) visit(abs);
        else if (e.isFile()) {
          const rel = relative(repoRoot, abs).split(sep).join("/");
          const st = statSync(abs);
          const stat = `${st.size}:${st.mtimeMs}:${st.ctimeMs}`;
          const before = prev?.get(rel);
          const publishTime = before?.publishTime ?? (!inScope(rel) || builtAtPublishIn(rel, decls, repoRoot));
          if (publishTime) out.set(rel, { stat, publishTime });
          else if (before !== undefined && before.stat === stat) out.set(rel, before);
          else out.set(rel, { stat, publishTime, hash: createHash("sha256").update(readFileSync(abs)).digest("hex") });
        }
      }
    };
    visit(repoRoot);
    return out;
  };
  return {
    take: () => {
      const now = walk(last);
      const prev = last;
      last = now;
      const moves: WriterMoves = { builtAtPublish: [], committed: [] };
      if (prev === undefined) return moves;
      for (const p of new Set([...prev.keys(), ...now.keys()])) {
        const a = prev.get(p);
        const b = now.get(p);
        const publishTime = (a ?? b)!.publishTime;
        const moved = publishTime ? a?.stat !== b?.stat : a?.hash !== b?.hash;
        if (moved) (publishTime ? moves.builtAtPublish : moves.committed).push(p);
      }
      moves.builtAtPublish.sort();
      moves.committed.sort();
      return moves;
    },
  };
}

/**
 * Wrap `runner` so every run of a pair's WRITER (or of a check routed through
 * `publish-check.ts <writer>`, which invokes `<writer>` inside the check) is
 * watched by `tracker`, and what it moved is added up per writer in `moves`
 * (all passes together).
 */
export function watchWriters(
  runner: Runner,
  writers: ReadonlySet<string> | ReadonlyMap<string, string>,
  tracker: MoveTracker,
  moves: Map<string, WriterMoves>,
): Runner {
  const writerFor = (script: string): string | undefined =>
    writers instanceof Map ? writers.get(script) : (writers as ReadonlySet<string>).has(script) ? script : undefined;
  return async (script: string): Promise<boolean> => {
    const key = writerFor(script);
    if (key === undefined) return runner(script);
    tracker.take(); // what moved before it is not this writer's
    const ok = await runner(script);
    const m = tracker.take();
    const sum = moves.get(key) ?? { builtAtPublish: [], committed: [] };
    moves.set(key, { builtAtPublish: [...sum.builtAtPublish, ...m.builtAtPublish], committed: [...sum.committed, ...m.committed] });
    return ok;
  };
}

/**
 * A check whose writer, in every run, moved at least one `builtAtPublish` path
 * and nothing else: it was red only because its publish-time outputs were not
 * built, which is not staleness of anything a commit holds.
 */
export function onlyBuiltAtPublish(writer: string | undefined, moves: ReadonlyMap<string, WriterMoves>): boolean {
  const m = writer === undefined ? undefined : moves.get(writer);
  return m !== undefined && m.builtAtPublish.length > 0 && m.committed.length === 0;
}

/**
 * Gates whose INPUTS only `derive:publish` builds, so post-merge regen cannot
 * judge them (bean `p7mb`, epic `1xhc`). `onlyBuiltAtPublish` covers a check
 * whose own writer's outputs are publish-time; these read OTHER writers'
 * publish-time output, so no writer regen runs can turn them green:
 *
 * - `slice:sqlite:check` audits the kg slice against the payload tree, which
 *   `derive:publish` builds ("points at payload …, which the published tree
 *   does not hold").
 * - `check:nav-names:check` reads the railed viewer pages and the navbar
 *   include. No railed page is in the checkout any more, so outside a publish
 *   it exits 2, "nothing was compared".
 *
 * Measured 2026-11-01 on fa main 0ed9b2b and cat-harness c523aef, and again on
 * train fa#2893 (tools f92092e): both were the only `unrepairedChecks`, every
 * post-merge regen run red. Neither goes unjudged: `code-quality-gates.yml`
 * runs both after restoring the publish-time pages (its B1 steps). So regen
 * reports them with `builtAtPublishChecks`, never as a pass and never as stale.
 */
export const JUDGED_AFTER_PUBLISH: Readonly<Record<string, string>> = {
  "slice:sqlite:check": "audits the kg slice against the payload tree derive:publish builds",
  "check:nav-names:check": "reads the railed viewer pages and navbar include derive:publish builds",
};

/**
 * Resolve the repository root containing the gating workflows and scripts.
 * Walks up if inside a submodule or isolated worktree.
 */
export function resolveRepoRoot(instanceRoot: string): string {
  let cur = resolve(instanceRoot);
  while (cur !== "/" && !existsSync(join(cur, ".github/workflows/code-quality-gates.yml"))) {
    const parent = join(cur, "..");
    if (parent === cur) break;
    cur = parent;
  }
  if (existsSync(join(cur, ".github/workflows/code-quality-gates.yml"))) {
    return cur;
  }
  return repoRootFor(instanceRoot);
}

/** Git operations interface to allow clean testing and mocking. */
export interface GitExecutor {
  getCurrentSha: () => string | Promise<string>;
  getChangedFiles: () => string[] | Promise<string[]>;
  createBranch: (branch: string) => void | Promise<void>;
  commitAll: (message: string) => void | Promise<void>;
  pushBranch: (branch: string) => void | Promise<void>;
}

/** GitHub CLI operations interface to allow clean testing and mocking. */
export interface GhExecutor {
  findExistingPr: (opts: { head: string; base: string }) => number | undefined | Promise<number | undefined>;
  createPr: (opts: { title: string; body: string; head: string; base: string }) => { url: string; number?: number } | Promise<{ url: string; number?: number }>;
}

/** Options for post-merge regen check. */
export interface PostMergeRegenOptions {
  repoRoot?: string;
  /**
   * In a layer run (`layer-post-merge-regen.yml`), the caller layer's mount
   * path in the composed index (e.g. `"cat-harness"`). Only files inside this
   * layer's tree are committed to the caller repository; another layer's
   * changes are that layer's to repair.
   */
  instance?: string;
  dryRun?: boolean;
  checkOnly?: boolean;
  createPr?: boolean;
  branchName?: string;
  baseBranch?: string;
  fast?: boolean;
  maxPasses?: number;
  pairs?: readonly Pair[];
  explain?: boolean;
  runner?: Runner;
  /**
   * Watches the tree around each writer ({@link treeMoveTracker}). Defaults to
   * one over `repoRoot` when the runner is the real one; an injected runner
   * runs no real writer, so there is nothing on disk to watch unless a tracker
   * is injected with it.
   */
  tracker?: MoveTracker;
  git?: GitExecutor;
  gh?: GhExecutor;
}

/** Structured report of a post-merge check and repair action. */
export interface PostMergeRegenReport {
  status: "clean" | "stale" | "repaired" | "unrepaired" | "error";
  staleChecks: string[];
  repairedChecks: string[];
  unrepairedChecks: string[];
  noWriterChecks: string[];
  /**
   * Checks that were red only because their `builtAtPublish` outputs were not
   * built: their writer moved declared publish-time paths and nothing else
   * (bean `p7mb`). Not stale, not repaired, and never in a repair PR.
   */
  builtAtPublishChecks: string[];
  changedFiles: string[];
  prOpened: boolean;
  prUrl?: string;
  prNumber?: number;
  repairBranch?: string;
  prPayload?: {
    title: string;
    body: string;
    branch: string;
    base: string;
  };
  summary: string;
  exitCode: number;
}

export function defaultGit(repoRoot: string): GitExecutor {
  return {
    getCurrentSha: () => {
      const r = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf-8" });
      return (r.stdout ?? "").trim();
    },
    getChangedFiles: () => {
      const r = spawnSync("git", ["-C", repoRoot, "status", "--porcelain"], { encoding: "utf-8" });
      const lines = (r.stdout ?? "").split("\n").filter(Boolean);
      return lines.map((l) => l.slice(3).trim());
    },
    createBranch: (branch: string) => {
      const r = spawnSync("git", ["-C", repoRoot, "checkout", "-B", branch], { encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`git checkout -B ${branch} failed: ${r.stderr || r.stdout}`);
    },
    commitAll: (message: string) => {
      const a = spawnSync("git", ["-C", repoRoot, "add", "-A"], { encoding: "utf-8" });
      if (a.status !== 0) throw new Error(`git add -A failed: ${a.stderr || a.stdout}`);
      const r = spawnSync("git", ["-C", repoRoot, "commit", "-m", message], { encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`git commit failed: ${r.stderr || r.stdout}`);
    },
    pushBranch: (branch: string) => {
      const r = spawnSync("git", ["-C", repoRoot, "push", "-u", "origin", branch], { encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`git push failed: ${r.stderr || r.stdout}`);
    },
  };
}

export function defaultGh(repoRoot: string): GhExecutor {
  return {
    findExistingPr: (opts) => {
      const r = spawnSync(
        "gh",
        ["pr", "list", "--head", opts.head, "--base", opts.base, "--json", "number", "--jq", ".[0].number"],
        { cwd: repoRoot, encoding: "utf-8" },
      );
      if (r.status === 0 && r.stdout?.trim()) {
        const num = Number(r.stdout.trim());
        if (Number.isInteger(num)) return num;
      }
      return undefined;
    },
    createPr: (opts) => {
      const r = spawnSync(
        "gh",
        ["pr", "create", "--title", opts.title, "--body", opts.body, "--head", opts.head, "--base", opts.base],
        { cwd: repoRoot, encoding: "utf-8" },
      );
      if (r.status !== 0) throw new Error(`gh pr create failed: ${r.stderr || r.stdout}`);
      const url = (r.stdout ?? "").trim();
      const m = /\/pull\/(\d+)/.exec(url);
      return { url, number: m ? Number(m[1]) : undefined };
    },
  };
}

/** Build the PR description body for an automated post-merge repair. */
export function buildPrBody(params: {
  staleChecks: readonly string[];
  commitSha: string;
  branch: string;
  base: string;
  changedFiles?: readonly string[];
}): string {
  const checkLines = params.staleChecks.map((c) => `- \`${c}\``).join("\n");
  const fileSection =
    params.changedFiles && params.changedFiles.length > 0
      ? `\n\n### Regenerated files\n\n${params.changedFiles.map((f) => `- \`${f}\``).join("\n")}`
      : "";
  return (
    `## Summary\n\n` +
    `Automated post-merge regeneration pipeline (bean \`folio-assistant-ey1c\`) detected stale ` +
    `derived artefacts on \`${params.base}\` following merge into commit \`${params.commitSha.slice(0, 10)}\`.\n\n` +
    `### Stale gate checks\n\n` +
    `${checkLines}` +
    fileSection +
    `\n\n### Why a reviewable PR rather than direct push\n\n` +
    `Following the SDLC merge-pipeline rules:\n` +
    `1. A post-merge repair is opened as a PR targeting \`${params.base}\` so it is reviewable and cannot bypass CI gates.\n` +
    `2. It eliminates the accidental-repair hazard where unrelated PRs incidentally repair \`main\` and corrupt gate history.\n` +
    `3. CI on this PR will verify that all derived gates are green before merging.`
  );
}

/**
 * Execute the post-merge regeneration check and generate/open repair PRs as needed.
 */
export async function checkPostMergeRegen(opts: PostMergeRegenOptions = {}): Promise<PostMergeRegenReport> {
  const repoRoot = opts.repoRoot ?? resolveRepoRoot(ROOT);
  const git = opts.git ?? defaultGit(repoRoot);
  const gh = opts.gh ?? defaultGh(repoRoot);
  const baseBranch = opts.baseBranch ?? "main";
  const fast = opts.fast ?? false;
  const maxPasses = opts.maxPasses ?? DEFAULT_MAX_PASSES;

  let pairs: Pair[];
  if (opts.pairs !== undefined) {
    pairs = [...opts.pairs];
  } else {
    const scripts = scriptTableOf(repoRoot);
    const gates = loadGates(repoRoot, { all: !fast });
    const gated = repairableGates(gates, scripts);
    const extra = UNGATED_INPUTS.filter((p) => !gated.some((g) => g.check === p.check));
    pairs = postMergePairs([
      ...extra.map((p) => ({ ...p, io: { inputs: pairIO(p.check)?.inputs } })),
      ...gated.map((p) => ({ ...p, io: pairIO(p.check) })),
    ]);
  }

  // Bean `p7mb`: `post-merge:regen` already checks and repairs every QA writer
  // (`kg:audit:all`, `kg:detangle`, `translation:block-qa`, `skill:register`,
  // `readme:subgraphs`, etc.) as its own pair over the mounted layers'
  // committed QA working copy (`test/results/`). Setting `BUILDING_ENV = "1"`
  // prevents `uml:overview:check` (`publish-check.ts uml:overview` ->
  // `gen-uml-overview.ts` -> `requireCurrentWorkingCopy`) from recursively
  // spawning a 25-minute `qa:refresh` rebuild inside the check call on every
  // pass (measured on cat-harness runs 40897480812 and 40900325607, where
  // recursive `qa:refresh` runs exhausted the 2-hour job timeout).
  const baseRunner: Runner =
    opts.runner ??
    (async (script: string): Promise<boolean> => {
      const r = spawnSync("bun", ["run", "cat", script], {
        cwd: repoRoot,
        encoding: "utf-8",
        env: { ...process.env, [BUILDING_ENV]: "1" },
      });
      return r.status === 0;
    });
  // Bean `p7mb`: what each writer moves, so a check red only for want of its
  // publish-time outputs is told apart from a stale one after the repair pass.
  // Watch both `p.writer` and `p.check`: checks routed through `publish-check.ts <writer>`
  // execute `<writer>` on disk inside the check call itself.
  const decls = opts.tracker === undefined && opts.runner === undefined ? publishTimeDeclarations(repoRoot) : [];
  // An IG's artefact index is read by the checks below, and it is built at
  // publish rather than committed. Build it first when a layer that
  // declares it lacks it. Which layers those are is read from their
  // declarations, so this layer names none of them (it sits below them).
  if (opts.runner === undefined) {
    for (const w of missingPrerequisiteWriters(decls.length > 0 ? decls : publishTimeDeclarations(repoRoot))) {
      spawnSync("bun", ["run", "cat", w], {
        cwd: repoRoot,
        encoding: "utf-8",
        env: { ...process.env, [BUILDING_ENV]: "1" },
      });
    }
  }
  const tracker = opts.tracker ?? (opts.runner === undefined ? treeMoveTracker(repoRoot, decls, opts.instance) : undefined);
  const moves = new Map<string, WriterMoves>();
  const scriptToWriter = new Map<string, string>();
  for (const p of pairs) {
    if (p.writer !== undefined) {
      scriptToWriter.set(p.writer, p.writer);
      scriptToWriter.set(p.check, p.writer);
    }
  }
  const lastOk = new Map<string, boolean>();
  const watchedRunner: Runner = tracker === undefined ? baseRunner : watchWriters(baseRunner, scriptToWriter, tracker, moves);
  const runner: Runner = async (script: string): Promise<boolean> => {
    const ok = await watchedRunner(script);
    lastOk.set(script, ok);
    return ok;
  };

  // Step 1: Audit pass with dryRun: true to inspect current state of derived artefacts
  const { results: auditResults } = await regenPass(pairs, runner, { dryRun: true });

  const stale = auditResults.filter((r) => r.outcome === "regenerated");
  const noWriter = auditResults.filter((r) => r.outcome === "no-writer");
  let staleCheckNames = stale.map((s) => s.check);
  const noWriterCheckNames = noWriter.map((n) => n.check);

  // Negative control check: If no files are stale and no checks failed without a writer, clean!
  if (stale.length === 0 && noWriter.length === 0) {
    return {
      status: "clean",
      staleChecks: [],
      repairedChecks: [],
      unrepairedChecks: [],
      noWriterChecks: [],
      builtAtPublishChecks: [],
      changedFiles: [],
      prOpened: false,
      summary: `Clean (negative control): all ${pairs.length} verify/write pair(s) are current. No repair needed, 0 PRs opened.`,
      exitCode: 0,
    };
  }

  // If there are failures with no writer counterpart, this is a real defect
  if (noWriter.length > 0 && stale.length === 0) {
    return {
      status: "error",
      staleChecks: [],
      repairedChecks: [],
      unrepairedChecks: [],
      noWriterChecks: noWriterCheckNames,
      builtAtPublishChecks: [],
      changedFiles: [],
      prOpened: false,
      summary: `Defect: ${noWriter.length} check(s) failed with no writer counterpart: ${noWriterCheckNames.join(", ")}`,
      exitCode: 1,
    };
  }

  // Stale derived artefacts detected!
  let currentSha = "";
  try {
    currentSha = await git.getCurrentSha();
  } catch {
    currentSha = "unknown";
  }
  const shortSha = currentSha && currentSha !== "unknown" ? currentSha.slice(0, 10) : Date.now().toString(36);
  const branch = opts.branchName ?? `automation/post-merge-regen-${shortSha}`;
  const payloadFor = (checks: readonly string[]) => ({
    title: `fix(derived): regenerate post-merge derived artefacts (${checks.join(", ")})`,
    body: buildPrBody({ staleChecks: checks, commitSha: currentSha, branch, base: baseBranch }),
    branch,
    base: baseBranch,
  });
  let prPayload = payloadFor(staleCheckNames);

  // If in dry-run mode or check-only mode:
  if (opts.dryRun) {
    return {
      status: "stale",
      staleChecks: staleCheckNames,
      repairedChecks: [],
      unrepairedChecks: [],
      noWriterChecks: noWriterCheckNames,
      builtAtPublishChecks: [],
      changedFiles: [],
      prOpened: false,
      repairBranch: branch,
      prPayload,
      summary: `Dry-run: detected ${stale.length} stale check(s) (${staleCheckNames.join(", ")}). Repair PR prepared for branch "${branch}".`,
      exitCode: 0,
    };
  }

  if (opts.checkOnly) {
    return {
      status: "stale",
      staleChecks: staleCheckNames,
      repairedChecks: [],
      unrepairedChecks: [],
      noWriterChecks: noWriterCheckNames,
      builtAtPublishChecks: [],
      changedFiles: [],
      prOpened: false,
      repairBranch: branch,
      prPayload,
      summary: `Check-only: detected ${stale.length} stale check(s): ${staleCheckNames.join(", ")}`,
      exitCode: 1,
    };
  }

  // Execute repair: run regenToFixpoint to apply writers and verify convergence.
  // Bean `p7mb`:
  // - Pass 1 skips pairs whose own check (or residual, if folded) already passed
  //   in the audit pass above, avoiding re-running ~65 clean checks (including
  //   multi-minute `translation:block-qa:check` and `kg:audit:all:check`) when
  //   only `builtAtPublish` checks failed in the audit pass.
  // - Pass 2+ skips pairs that already passed unless a COMMITTED file moved in
  //   the previous pass that touches the pair's declared inputs; pairs still
  //   failing re-run whenever any file (`committed` or `builtAtPublish`) moved
  //   in the previous pass (in case an out-of-order writer built their input).
  // - `narrow.begin` measures per-pass file moves so `regenToFixpoint` stops
  //   immediately on a barren pass instead of looping through `maxPasses`.
  const folds = foldable(pairs.map((p) => p.check));
  const ownPassed = (pair: Pair): boolean => {
    const fold = folds.get(pair.check);
    const ask = fold === undefined ? pair.check : fold.residual;
    return ask === undefined || lastOk.get(ask) === true;
  };
  const committedHitsPair = (pair: Pair, committed: ReadonlySet<string>): boolean => {
    const inputs = pair.io?.inputs;
    if (inputs === undefined || inputs.length === 0 || inputs.includes(TRACKED)) return true;
    const patterns = [...inputs, ...(pair.io?.outputs ?? [])];
    for (const p of committed) {
      const slash = p.indexOf("/");
      const candidates = slash > 0 ? [p, p.slice(slash + 1)] : [p];
      if (patterns.some((pat) => candidates.some((c) => patternHits(pat, c)))) return true;
    }
    return false;
  };
  let passIndex = 0;
  let lastCommittedMoves = new Set<string>();
  let lastPublishMoves = new Set<string>();
  const fixpoint = await regenToFixpoint(pairs, runner, maxPasses, {
    narrow: {
      begin: () => {
        passIndex++;
        const before = new Map<string, { b: number; c: number }>();
        for (const [k, m] of moves) {
          before.set(k, { b: m.builtAtPublish.length, c: m.committed.length });
        }
        return () => {
          const committed = new Set<string>();
          const publish = new Set<string>();
          for (const [k, m] of moves) {
            const prev = before.get(k) ?? { b: 0, c: 0 };
            for (let i = prev.c; i < m.committed.length; i++) committed.add(m.committed[i]!);
            for (let i = prev.b; i < m.builtAtPublish.length; i++) publish.add(m.builtAtPublish[i]!);
          }
          lastCommittedMoves = committed;
          lastPublishMoves = publish;
          return new Set([...committed, ...publish]);
        };
      },
      affects: () => ({ affected: true, why: "narrowed by skip so foldable keeps full pair set" }),
    },
    skip: (pair: Pair) => {
      if (passIndex <= 1) {
        return ownPassed(pair) ? { skip: true, why: "passed in audit pass" } : { skip: false, why: "not yet passed in audit pass" };
      }
      if (!ownPassed(pair)) {
        return lastCommittedMoves.size > 0 || lastPublishMoves.size > 0
          ? { skip: false, why: "files moved in previous pass" }
          : { skip: true, why: "no files moved in previous pass" };
      }
      if (lastCommittedMoves.size === 0) {
        return { skip: true, why: "already current and no committed files moved" };
      }
      return committedHitsPair(pair, lastCommittedMoves)
        ? { skip: false, why: "a declared input moved in previous pass" }
        : { skip: true, why: "no declared input moved in previous pass" };
    },
  });
  const settledResults = settleCovered(fixpoint.results, folds);
  const unrepaired = settledResults.filter(
    (r) =>
      JUDGED_AFTER_PUBLISH[r.check] === undefined &&
      (r.outcome === "unrepaired" || r.outcome === "writer-failed" || r.outcome === "no-writer"),
  );
  // A repair whose writer moved only `builtAtPublish` paths (or, when a check
  // failed in the audit pass before another writer built its `builtAtPublish`
  // inputs or after `publish-check.ts <writer>` built its `builtAtPublish`
  // outputs in the audit pass, moved 0 committed paths) built what the publish
  // builds; nothing a commit holds was stale (bean `p7mb`).
  const staleSet = new Set(staleCheckNames);
  const noCommittedMove = (writer: string | undefined): boolean =>
    tracker !== undefined && writer !== undefined && (moves.get(writer)?.committed.length ?? 0) === 0;
  const hasCommittedMove = (writer: string | undefined): boolean =>
    tracker !== undefined && writer !== undefined && (moves.get(writer)?.committed.length ?? 0) > 0;
  const directPublishTime = new Set(
    settledResults
      .filter(
        (r) =>
          COVERED[r.check] === undefined &&
          ((r.outcome === "regenerated" && onlyBuiltAtPublish(r.writer, moves)) ||
            (staleSet.has(r.check) && (r.outcome === "regenerated" || r.outcome === "current") && noCommittedMove(r.writer))),
      )
      .map((r) => r.check),
  );
  const builtAtPublishCheckNames = settledResults
    .filter((r) => {
      if (directPublishTime.has(r.check)) return true;
      // Red here, judged by code-quality-gates after publish-pages: see JUDGED_AFTER_PUBLISH.
      if (JUDGED_AFTER_PUBLISH[r.check] !== undefined && (staleSet.has(r.check) || r.outcome !== "current")) return true;
      const cov = COVERED[r.check];
      if (cov === undefined) return false;
      return (
        staleSet.has(r.check) &&
        (r.outcome === "regenerated" || r.outcome === "current") &&
        noCommittedMove(r.writer) &&
        cov.covers.every((c) => !staleSet.has(c) || directPublishTime.has(c))
      );
    })
    .map((r) => r.check);
  const publishTime = new Set(builtAtPublishCheckNames);
  const repaired = settledResults.filter(
    (r) =>
      !publishTime.has(r.check) &&
      (r.outcome === "regenerated" || (staleSet.has(r.check) && r.outcome === "current" && hasCommittedMove(r.writer))),
  );
  const repairedCheckNames = repaired.map((r) => r.check);
  const unrepairedCheckNames = unrepaired.map((u) => u.check);
  staleCheckNames = staleCheckNames.filter((c) => !publishTime.has(c));
  const publishNote =
    builtAtPublishCheckNames.length > 0
      ? ` ${builtAtPublishCheckNames.length} check(s) were red only for want of their builtAtPublish outputs, not stale: ${builtAtPublishCheckNames.join(", ")}.`
      : "";

  if (unrepaired.length === 0 && repaired.length === 0 && staleCheckNames.length === 0) {
    return {
      status: "clean",
      staleChecks: [],
      repairedChecks: [],
      unrepairedChecks: [],
      noWriterChecks: noWriterCheckNames,
      builtAtPublishChecks: builtAtPublishCheckNames,
      changedFiles: [],
      prOpened: false,
      summary: `Clean: nothing a commit holds is stale.${publishNote} No repair PR.`,
      exitCode: 0,
    };
  }
  prPayload = payloadFor(staleCheckNames);
  const prTitle = prPayload.title;

  if (unrepaired.length > 0) {
    return {
      status: "unrepaired",
      staleChecks: staleCheckNames,
      repairedChecks: repairedCheckNames,
      unrepairedChecks: unrepairedCheckNames,
      noWriterChecks: noWriterCheckNames,
      builtAtPublishChecks: builtAtPublishCheckNames,
      changedFiles: [],
      prOpened: false,
      repairBranch: branch,
      prPayload,
      summary: `Repair failed: ${unrepaired.length} check(s) could not be repaired by generators: ${unrepairedCheckNames.join(", ")}`,
      exitCode: 1,
    };
  }

  const inInstance = inTargetScope(repoRoot, opts.instance);
  const gitChanged = (await git.getChangedFiles()).filter(inInstance);
  const committedMoves = [...new Set([...moves.values()].flatMap((m) => m.committed))].sort();
  const changedFiles = gitChanged.length > 0 ? gitChanged : opts.git !== undefined ? committedMoves : [];

  if (changedFiles.length === 0) {
    return {
      status: "clean",
      staleChecks: staleCheckNames,
      repairedChecks: repairedCheckNames,
      unrepairedChecks: [],
      noWriterChecks: noWriterCheckNames,
      builtAtPublishChecks: builtAtPublishCheckNames,
      changedFiles: [],
      prOpened: false,
      summary: `Writers ran but left 0 changed files in working copy. Negative control: no repair PR needed.${publishNote}`,
      exitCode: 0,
    };
  }

  let prOpened = false;
  let prUrl: string | undefined;
  let prNumber: number | undefined;

  if (opts.createPr) {
    const existingPr = await gh.findExistingPr({ head: branch, base: baseBranch });
    if (existingPr !== undefined) {
      prNumber = existingPr;
      return {
        status: "repaired",
        staleChecks: staleCheckNames,
        repairedChecks: repairedCheckNames,
        unrepairedChecks: [],
        noWriterChecks: noWriterCheckNames,
        builtAtPublishChecks: builtAtPublishCheckNames,
        changedFiles,
        prOpened: false,
        prNumber,
        repairBranch: branch,
        prPayload,
        summary: `Repaired ${repairedCheckNames.length} check(s). PR #${existingPr} already open for branch "${branch}".`,
        exitCode: 0,
      };
    }

    await git.createBranch(branch);
    await git.commitAll(prTitle);
    await git.pushBranch(branch);
    const prBodyWithFiles = buildPrBody({
      staleChecks: staleCheckNames,
      commitSha: currentSha,
      branch,
      base: baseBranch,
      changedFiles,
    });
    const created = await gh.createPr({
      title: prTitle,
      body: prBodyWithFiles,
      head: branch,
      base: baseBranch,
    });
    prOpened = true;
    prUrl = created.url;
    prNumber = created.number;
  }

  return {
    status: "repaired",
    staleChecks: staleCheckNames,
    repairedChecks: repairedCheckNames,
    unrepairedChecks: [],
    noWriterChecks: noWriterCheckNames,
    builtAtPublishChecks: builtAtPublishCheckNames,
    changedFiles,
    prOpened,
    prUrl,
    prNumber,
    repairBranch: branch,
    prPayload,
    summary: prOpened
      ? `Repaired ${repairedCheckNames.length} check(s). Opened repair PR #${prNumber ?? prUrl} on branch "${branch}".`
      : `Repaired ${repairedCheckNames.length} check(s) across ${changedFiles.length} file(s). PR creation not requested (--create-pr).${publishNote}`,
    exitCode: 0,
  };
}

// CLI entry point
if (import.meta.main) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const checkOnly = argv.includes("--check") || argv.includes("--check-only");
  const createPr = argv.includes("--create-pr");
  const json = argv.includes("--json");
  const fast = argv.includes("--fast");
  const explain = argv.includes("--explain");

  let branchName: string | undefined;
  // `layer-post-merge-regen.yml` exports `INSTANCE` at workflow scope.
  let instance: string | undefined = process.env.INSTANCE?.trim() || undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--branch" && argv[i + 1]) {
      branchName = argv[i + 1];
    }
    if (argv[i] === "--instance" && argv[i + 1]) {
      instance = argv[i + 1];
    }
  }

  const report = await checkPostMergeRegen({
    instance,
    dryRun,
    checkOnly,
    createPr,
    branchName,
    fast,
    explain,
  });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(report.summary);
    if (report.staleChecks.length > 0) {
      console.log(`Stale check(s): ${report.staleChecks.join(", ")}`);
    }
    if (report.builtAtPublishChecks.length > 0) {
      console.log(`Red only for want of builtAtPublish outputs, not stale: ${report.builtAtPublishChecks.join(", ")}`);
    }
    if (report.changedFiles.length > 0) {
      console.log(`Changed file(s) (${report.changedFiles.length}):\n${report.changedFiles.map((f) => `  ${f}`).join("\n")}`);
    }
    if (report.prOpened && report.prUrl) {
      console.log(`Repair PR: ${report.prUrl}`);
    }
  }

  process.exit(report.exitCode);
}
