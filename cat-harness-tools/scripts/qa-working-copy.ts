#!/usr/bin/env bun
/**
 * Produce the QA working copy, and record WHICH TREE it was produced from —
 * so a reader can tell a current copy from a stale one.
 *
 * @module scripts/qa-working-copy
 * @graphNode none — a maintenance command over the working tree
 * @covers none — a build step: it writes the ignored QA tree and judges nothing
 *
 * The QA results tree (`*‍/test/results/`) is computed, not committed.
 * Generators read it from disk — `uml:overview`, `readme:subgraphs`, as
 * `bun run cat regen` runs them — and so does every gate that judges it, so a
 * partial or stale copy silently yields wrong output.
 *
 * ## The stamp
 *
 * After both steps exit 0, `build/regen-cache/qa-working-copy.json` records:
 *
 * - the TRACKED-TREE digest (`trackedTreeDigest`, the `{tracked}` input of
 *   `input-hash.ts`) — every tracked and untracked-not-ignored file, so the
 *   writers' own sources, the corpus they read and `bun.lock` are all in it;
 * - a digest of every file under the declared `qa` roots, so a copy edited,
 *   partly deleted or overwritten by another tool since is not current either.
 *
 * {@link workingCopyState} compares both with the tree as it stands, and
 * answers `current`, `stale` (with the reason) or `undetermined`. Only
 * `current` lets a caller skip the build: absent stamp, unreadable tree, a
 * submodule with its own changes — every way of not knowing — rebuilds. The
 * stamp is never committed (`build/` is ignored) and `--if-stale` is off under
 * `CI`, as the input-hash cache is, so CI always builds the copy.
 *
 * What it does NOT see: a moved `qa-reports` baseline, the environment, the
 * clock. Those are the same exclusions as `{tracked}` in `input-hash.ts`, and
 * they bear on a VERDICT read from the copy, which the gates that read it
 * resolve themselves (`--against`), not on what the writers wrote.
 *
 * Usage:
 *   bun run cat qa:working-copy              # build it (as CI does) and stamp it
 *   bun run cat qa:working-copy -- --if-stale  # build it only when the stamp is not current
 *   bun run cat qa:working-copy -- --status    # print the state, change nothing (exit 0 current, 1 stale, 2 undetermined)
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { CACHE_FILE, FileDigests, cacheEnabled, trackedTreeDigest } from "./input-hash.ts";
import { locationOf, movedInventory } from "./qa-verify-moved.ts";
import { INDEX_CONFIG_FILENAME } from "../schemas/kg/instance-roots.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { GATES_WORKFLOW } from "./lib/gates-workflow.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";

/** Where the stamp lives, beside the input-hash cache. `build/` is git-ignored. */
export const STAMP_PATH = join(dirname(CACHE_FILE), "qa-working-copy.json");

/**
 * The commands that ARE the working copy — the bootstrap export and `qa:refresh`
 * that CI runs, plus `glossary:page` so the glossary anchors `uml:overview`
 * reads exist on disk in a content root where `skill:register` is skipped as
 * `readsState` (bean `rn24`, `cat-harness-tools#281`).
 */
export const WORKING_COPY_STEPS: readonly (readonly string[])[] = [
  // input-site: inert #8d52aad6 — an OUTPUT path the working-copy build writes, never reads
  ["bun", "run", "cat-harness-tools/scripts/kg-export.ts", "--instance", "./bootstrap", "--out", "build/bootstrap-kg-export.jsonld"],
  ["bun", "run", "cat", "qa:refresh"],
  ["bun", "run", "cat", "glossary:page"],
];

export interface Stamp {
  tree: string;
  qa: string;
  at: string;
}

export type WorkingCopyState =
  | { state: "current" }
  | { state: "stale"; why: string }
  | { state: "undetermined"; why: string };

/** Content digest of every file under the declared `qa` roots, with paths. */
export function qaTreeDigest(repoRoot: string, roots?: string[]): { hash: string; files: Map<string, string> } {
  const files = new Map<string, string>();
  const h = createHash("sha256");
  for (const f of movedInventory(repoRoot, roots).directories.flatMap((d) => d.files)) {
    const d = createHash("sha256").update(readFileSync(join(repoRoot, locationOf(f)))).digest("hex");
    files.set(f.path, d);
    h.update(`${f.path} ${d}\n`);
  }
  return { hash: h.digest("hex"), files };
}

/** The paths whose content differs between two {@link qaTreeDigest} file maps. */
export function qaChanged(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): Set<string> {
  const out = new Set<string>();
  for (const [p, d] of before) if (after.get(p) !== d) out.add(p);
  for (const [p, d] of after) if (before.get(p) !== d) out.add(p);
  return out;
}

function readStamp(repoRoot: string): Stamp | undefined {
  const abs = join(repoRoot, STAMP_PATH);
  if (!existsSync(abs)) return undefined;
  try {
    const s = JSON.parse(readFileSync(abs, "utf-8")) as Partial<Stamp>;
    return typeof s.tree === "string" && typeof s.qa === "string" ? (s as Stamp) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the QA working copy on disk is the one the writers produce from the
 * tree as it stands. Pure over its inputs except for reading the disk.
 */
export function workingCopyState(repoRoot: string, roots?: string[]): WorkingCopyState {
  const stamp = readStamp(repoRoot);
  if (stamp === undefined) return { state: "stale", why: `no stamp at ${STAMP_PATH} — the copy was never built here by this command` };
  const tree = trackedTreeDigest(repoRoot, new FileDigests(repoRoot), { ignored: false });
  if ("undetermined" in tree) return { state: "undetermined", why: tree.undetermined };
  if (tree.hash !== stamp.tree) return { state: "stale", why: "the tree changed since the copy was built" };
  let qa: string;
  try {
    qa = qaTreeDigest(repoRoot, roots).hash;
  } catch (e) {
    return { state: "undetermined", why: `could not read the QA tree: ${(e as Error).message}` };
  }
  if (qa !== stamp.qa) return { state: "stale", why: "the QA tree changed since it was built (edited, deleted or overwritten)" };
  return { state: "current" };
}

/** The copy could not be built — a caller that needs it must stop, not read a partial tree. */
export class WorkingCopyFailed extends Error {}

/** What {@link ensureWorkingCopy} did. `changed` is every QA path whose content it altered. */
export type EnsureResult =
  | { ran: false; why: string }
  | { ran: true; ok: true; why: string; changed: Set<string> }
  | { ran: true; ok: false; why: string; exit: number | null; step: string };

export interface EnsureOptions {
  /** Build even when the stamp is current (CI, `--no-cache`, or the plain command). */
  force?: boolean;
  /** Override the steps — tests only. */
  steps?: readonly (readonly string[])[];
  /** Override the declared roots — tests only. */
  roots?: string[];
  stdio?: "inherit" | "pipe";
}

/**
 * Build the copy when it is not current, and stamp it. A failed step removes
 * the stamp: a half-built copy must never read as current.
 */
export function ensureWorkingCopy(repoRoot: string, opts: EnsureOptions = {}): EnsureResult {
  const st = opts.force ? { state: "stale" as const, why: "asked to build" } : workingCopyState(repoRoot, opts.roots);
  if (st.state === "current") return { ran: false, why: "the QA working copy is current for this tree (stamp matches)" };
  const before = qaTreeDigest(repoRoot, opts.roots).files;
  rmSync(join(repoRoot, STAMP_PATH), { force: true });
  for (const step of opts.steps ?? WORKING_COPY_STEPS) {
    // input-site: traced #0a259c3d — a build reads the qa-reports store and rewrites the ignored working copy
    inputSiteReached("qa-working-copy: builds the QA working copy");
    const r = spawnSync(step[0]!, step.slice(1), {
      cwd: repoRoot,
      stdio: opts.stdio ?? "inherit",
      // input-site: inert #5912f38a — hands the environment on to a build step, whose run is traced on the spawn above
      env: { ...process.env, [BUILDING_ENV]: "1" },
    });
    if (r.status !== 0) return { ran: true, ok: false, why: st.why, exit: r.status, step: step.join(" ") };
  }
  const tree = trackedTreeDigest(repoRoot, new FileDigests(repoRoot), { ignored: false });
  const after = qaTreeDigest(repoRoot, opts.roots);
  // Undetermined tree: built, but no stamp — the next ensure builds again.
  if (!("undetermined" in tree)) {
    const abs = join(repoRoot, STAMP_PATH);
    mkdirSync(dirname(abs), { recursive: true });
    // input-site: inert #7f1077da — the stamp's `at`, which workingCopyState never compares
    writeFileSync(abs, JSON.stringify({ tree: tree.hash, qa: after.hash, at: new Date().toISOString() } satisfies Stamp, null, 2) + "\n");
  }
  return { ran: true, ok: true, why: st.why, changed: qaChanged(before, after.files) };
}

/**
 * Set for the steps of a build. A generator that is ALSO one of the QA writers
 * (`readme:subgraphs`) runs inside the build it would otherwise ask for, and
 * reads the copy as the build has made it so far — as it always did.
 */
export const BUILDING_ENV = "QA_WORKING_COPY_BUILDING";

/**
 * Why `repoRoot` cannot build the QA working copy at all, or null when it can.
 *
 * Both the harness index (`GATES_WORKFLOW`) and a content index
 * (`INDEX_CONFIG_FILENAME`) declare a root gate set for `qa:refresh` to measure
 * against (`cat-harness-tools#281`, bean `rn24`). A standalone layer checkout
 * carries neither, so it has no root gate set to build the copy from.
 */
export function workingCopyUnbuildable(repoRoot: string): string | null {
  return existsSync(join(repoRoot, GATES_WORKFLOW)) || existsSync(join(repoRoot, INDEX_CONFIG_FILENAME))
    ? null
    : `neither ${GATES_WORKFLOW} nor ${INDEX_CONFIG_FILENAME} is at the root (a standalone layer checkout), so no root gate set is declared for qa:refresh to build the QA working copy against`;
}

/**
 * For a generator that reads the QA copy from disk (`uml:overview`,
 * `readme:subgraphs`): make the copy current before reading it, whoever ran
 * the generator. regen does this before every pass, but `skill:register`
 * runs `uml:overview` on its own, and so does a person — measured on this
 * branch 2026-10-06, `skill:register` in a worktree with no built copy
 * rewrote the QA-overview UML from the few tracked files under `test/results/`.
 * Exits 2 (could not determine) when the copy could be built and was not, and
 * 78 (not applicable, {@link workingCopyUnbuildable}) in a root that has
 * nothing to build it from.
 */
export function requireCurrentWorkingCopy(repoRoot: string, who: string): void {
  // input-site: env QA_WORKING_COPY_BUILDING #6496713b — set by the build for its own steps
  if (process.env[BUILDING_ENV] === "1") return;
  // Not applicable, rather than UNKNOWN: there is nothing here the copy could
  // be built from, so the generator has nothing to draw (exit 78, `lib/not-applicable.ts`).
  const unbuildable = workingCopyUnbuildable(repoRoot);
  if (unbuildable !== null) exitNotApplicable(who, unbuildable);
  const r = ensureWorkingCopy(repoRoot);
  if (!r.ran) return;
  if (!r.ok) {
    console.error(
      `${who}: UNKNOWN — the QA working copy it reads was not current (${r.why}) and building it failed ` +
        `(\`${r.step}\` exited ${r.exit ?? "on a signal"}). Nothing was written; this is NOT a pass.`,
    );
    process.exit(2);
  }
  console.log(`${who}: built the QA working copy first (${r.why})`);
}

function main(argv: string[]): number {
  // input-site: tree #6e4036ba — rev-parse --show-toplevel: a fact about the checkout
  const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).stdout.trim();
  if (argv.includes("--status")) {
    const s = workingCopyState(root);
    console.log(`qa-working-copy: ${s.state}${"why" in s ? ` — ${s.why}` : ""}`);
    return s.state === "current" ? 0 : s.state === "stale" ? 1 : 2;
  }
  // input-site: env CI #d4fda250 — cacheEnabled() reads CI to decide --if-stale
  const ifStale = argv.includes("--if-stale") && cacheEnabled(argv, process.env);
  const r = ensureWorkingCopy(root, { force: !ifStale });
  if (!r.ran) {
    console.log(`qa-working-copy: not rebuilt — ${r.why}`);
    return 0;
  }
  if (!r.ok) {
    console.error(`qa-working-copy: \`${r.step}\` exited ${r.exit ?? "on a signal"} — no stamp written, the copy is NOT current`);
    return r.exit ?? 1;
  }
  console.log(`qa-working-copy: built (${r.why}); ${r.changed.size} QA file(s) changed; stamped ${STAMP_PATH}`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
