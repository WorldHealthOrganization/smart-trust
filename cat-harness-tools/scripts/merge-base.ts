#!/usr/bin/env bun
/**
 * Merge the base branch in, resolving ONLY the conflicts a declared pattern
 * covers, and prove the result with the gate set.
 *
 * @module scripts/merge-base
 * @graphNode none — a maintenance command over the working tree
 * @covers none — a merge step: it changes the tree and judges no declared graph
 *
 * The executable form of `sdlc/processes/merge-base.bpmn`, which `Task_PrepareMerge`
 * in `code-change-review.bpmn` calls. The patterns, their strategies and why
 * each is safe are in `merge-conflict-patterns.ts` and the skill of that name.
 *
 * ## All or nothing
 *
 * Every conflicted path is classified BEFORE anything is changed. If one is
 * refused — authored, or named by no pattern — the merge is ABORTED and the
 * tree is left exactly as it was, with the refused paths listed.
 *
 * ## Proved, not assumed
 *
 * After resolving, `bun run cat regen` asks every check the CI workflow runs and
 * runs each stale one's writer until the tree settles. A non-zero exit
 * (`unrepaired`, or a check with no writer) aborts the merge too. It runs as
 * `regen --changed <fork point>`, asking only the pairs either side touched;
 * see {@link regenArgs} for why that is sound, and `--full-regen` to ask
 * every pair.
 *
 * Usage:
 *   bun run cat merge:main                 # merge origin/main, resolve, regenerate, commit
 *   bun run cat merge:main -- --full-regen # ...asking every pair, not only those the merge touched
 *   bun run cat merge:main -- --dry-run    # classify the conflicts, change nothing
 *   bun run cat-harness-tools/scripts/merge-base.ts --base origin/<branch>
 *   bun run cat-harness-tools/scripts/merge-base.ts --root <worktree> --base <sha> --dry-run
 *   bun run cat-harness-tools/scripts/merge-base.ts --root <worktree> --base <sha> --no-regen  # a train member
 *
 * Exit 0 merged (or already up to date) · 1 refused or unproven, tree restored ·
 * 2 could not start (dirty tree, no such base).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { classify, resolveGeneratedRegions, type Classified } from "./merge-conflict-patterns.js";
import { relate } from "./git-ancestry.js";
import { REGEN_VERDICT_TAG, regenExitMeaning } from "./regen-after-merge.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

export interface Plan {
  resolvable: Classified[];
  refused: Classified[];
}

/**
 * The arguments `merge:main` gives `regen` — bean `94zs`.
 *
 * `--changed <fork point>`, where the fork point is `git merge-base HEAD
 * <base>` taken before the merge. regen runs before the merge is committed,
 * so `HEAD` is still the branch tip, and the change it sees is the union of
 * what the branch did since the fork point (`<fork>...HEAD`) and what the
 * merge brought in (the working tree against `HEAD`).
 *
 * **Why this base.** A pair that union does not touch has identical inputs
 * in the merged tree, at the branch tip, at the fork point and at `<base>`'s
 * tip, because a three-way merge of a path neither side changed is that
 * path. Its answer here is its answer at every one of them, so it is
 * current if ANY of them was. The other two candidates need more:
 *
 * - the branch tip alone (`--changed HEAD`) skips a pair that only `<base>`
 *   left alone — sound only if the BRANCH was regen-clean;
 * - `<base>` alone skips a pair only the branch left alone — sound only if
 *   `<base>` was green, which CI on `main` does not guarantee.
 *
 * And it still sees the case regen exists for (bean `lxpq`): when both sides
 * touch one generated file, that file is in the union.
 *
 * What it does not do: repair a pair that was ALREADY stale at all three and
 * that the merge did not touch. That staleness is not the merge's, and the
 * branch's own CI reports it. `--full-regen`, or no fork point (a shallow
 * clone), runs the full set as before.
 */
export function regenArgs(forkPoint: string | undefined): string[] {
  // `--no-mount`: this command has just run `state:mount` against the merged
  // declarations (above the regen call), so regen's own mount would repeat it.
  return forkPoint === undefined ? ["--no-mount"] : ["--no-mount", "--changed", forkPoint];
}

/** Split conflicted paths into what a pattern resolves and what it refuses. */
export function plan(paths: string[]): Plan {
  const all = paths.map((p) => classify(p));
  return {
    resolvable: all.filter((c) => c.strategy !== "refuse"),
    refused: all.filter((c) => c.strategy === "refuse"),
  };
}

// `maxBuffer` well above Node's 1 MB default: `ls-tree -r` / `ls-files` of this
// repository are over 2 MB, and the lost-file guard (bean `vsv7`) reads both
// parents' full lists. At the default it threw ENOBUFS on its first live run,
// 2026-10-04, after regen had finished — the merge was left uncommitted.
const GIT_MAX_BUFFER = 256 * 1024 * 1024;

function git(root: string, ...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: GIT_MAX_BUFFER }).trim();
}

/** Check each submodule out at the commit the index pins. */
function syncSubmodules(root: string): void {
  spawnSync("git", ["-C", root, "submodule", "update", "--init", "--recursive"], { stdio: "inherit" });
}

/**
 * What a take-base resolution does with one conflicted path, from the stages
 * git holds for it (`ls-files -u`: 1 base, 2 ours, 3 theirs).
 *
 * Measured 2026-10-02 on #1805: main DELETED generated files (auto-docs pages
 * under a folded layer) that the branch had modified. There is no stage 3,
 * so `checkout --theirs` threw "does not have their version" and the run ended
 * in "Error". Taking the base's side of a deletion IS the deletion: generated
 * output the base removed stays removed, and regen recreates anything still
 * produced. The other direction (deleted on the branch, changed on the base)
 * has stage 3 and takes it, as before.
 */
export function takeBaseAction(stages: ReadonlySet<number>): "theirs" | "delete" | "resolved" {
  // No stages at all is NOT a deletion: the path was already resolved by an
  // earlier step (`qa:resolve-conflicts` did, until bean `7mwa` retired it;
  // any step that stages what it resolves still can). Reading "no stage 3" there as "the base deleted it" `git rm`ed
  // two generated kg-export sidecars on #1955, 2026-10-03, while the run still
  // reported proved (bean `vsv7`).
  if (stages.size === 0) return "resolved";
  return stages.has(3) ? "theirs" : "delete";
}

/** The stages git holds for an unmerged path. */
export function unmergedStages(root: string, path: string): Set<number> {
  const out = new Set<number>();
  for (const line of git(root, "ls-files", "-u", "--", path).split("\n")) {
    const stage = Number(line.split(/\s+/)[2]);
    if (stage) out.add(stage);
  }
  return out;
}

/**
 * Stage a path that was CONFLICTED. `-f` because git checks an unmerged path
 * against `.gitignore` as if it were new: measured 2026-10-03 on #1801, which
 * ignores `cat-harness/test/results/` while the files there stay tracked on
 * both sides, and `git add` refused every conflicted sidecar under it ("The
 * following paths are ignored"), crashing merge-main on each push to main.
 * Only ever called with a path git itself listed as unmerged, so it was
 * tracked on at least one side and `-f` cannot sweep in an untracked file.
 */
export function stageConflicted(root: string, path: string): void {
  git(root, "add", "-f", "--", path);
}

/** Take the base's side of `path`, deletion included; stages the result. */
export function takeBase(root: string, path: string): void {
  const action = takeBaseAction(unmergedStages(root, path));
  if (action === "resolved") return;
  if (action === "delete") {
    git(root, "rm", "-q", "--", path);
  } else {
    git(root, "checkout", "--theirs", "--", path);
    stageConflicted(root, path);
  }
}

/**
 * What an `owned-tree` resolution does with one conflicted path (#2176). It
 * reads which PARENT COMMITS hold the path, never the conflict stages.
 *
 * Measured 2026-10-05: when both sides change one node's content-addressed
 * payload, git reports a rename/rename. The old name has stage 1 only, the
 * branch's new name stage 2 only, and the base's new name stage 3 only. Both
 * new stages hold git's three-way merge of the bodies WITH conflict markers.
 * `takeBase` reads stage 2 alone as "the base deleted it" and `git rm`s a path
 * the branch ADDED, which `droppedInMerge` refuses at the `resolved`
 * checkpoint. It also writes stage 3's marked bytes under a name that is the
 * hash of other bytes.
 *
 * So: the base's committed copy when the base has the path, the branch's
 * committed copy when only the branch has it, and a removal only when NEITHER
 * parent has it, which is a deletion both sides made. Nothing a parent holds
 * is dropped here. The pattern's `prunedBy` writer later deletes whatever is
 * orphaned in the merged tree, and the `staged` checkpoint allows a writer to
 * delete what it owns.
 */
export function ownedTreeAction(inBase: boolean, inBranch: boolean): "theirs" | "ours" | "delete" {
  return inBase ? "theirs" : inBranch ? "ours" : "delete";
}

/** Whether `ref` (a commit) tracks `path`. */
function tracks(root: string, ref: string, path: string): boolean {
  return spawnSync("git", ["-C", root, "cat-file", "-e", `${ref}:${path}`], { stdio: "ignore" }).status === 0;
}

/** Resolve one `owned-tree` path from the parents' committed blobs; stages the result. */
export function takeOwnedTree(root: string, path: string): void {
  if (unmergedStages(root, path).size === 0) return; // resolved by an earlier step (bean vsv7)
  const action = ownedTreeAction(tracks(root, "MERGE_HEAD", path), tracks(root, "HEAD", path));
  if (action === "delete") {
    git(root, "rm", "-q", "-f", "--", path);
    return;
  }
  // `checkout <commit> -- <path>` writes that commit's blob to the index and
  // the disk, resolving the unmerged entry. The blob is the one the side
  // COMMITTED, not git's marked three-way merge of the bodies.
  git(root, "checkout", action === "theirs" ? "MERGE_HEAD" : "HEAD", "--", path);
  stageConflicted(root, path);
}

/** The resolution of one conflicted submodule GITLINK — bean `wczm` item 2. */
export type GitlinkResolution =
  | { take: "ours" | "theirs"; pin: string; why: string }
  | { refuse: string };

/**
 * A conflicted gitlink (mode 160000) is resolved by ANCESTRY, never by side.
 *
 * Train 1 (#1869): #1764's pins fast-forwarded main's, and taking main's side
 * silently reverted them. Which side is "newer" is not a property of the
 * branch or of main; it is whether one pin descends from the other, and only
 * the submodule's own history can say. So: the descendant wins when one pin
 * fast-forwards the other; DIVERGED pins are refused, since picking either
 * drops the other's commits; and a pin the submodule does not have locally
 * (a shallow checkout) is refused as could-not-determine, never guessed.
 *
 * Ours is the branch being updated (stage 2), theirs is the base merged in
 * (stage 3) — the sides `takeBase` uses.
 */
export function resolveGitlink(root: string, path: string): GitlinkResolution | undefined {
  const pins = new Map<number, string>();
  for (const line of git(root, "ls-files", "-u", "-s", "--", path).split("\n").filter(Boolean)) {
    const [mode, oid, stage] = line.split(/\s+/);
    if (mode !== "160000") return undefined;
    pins.set(Number(stage), oid!);
  }
  const ours = pins.get(2);
  const theirs = pins.get(3);
  if (!ours || !theirs) return pins.size ? { refuse: "one side removed the submodule" } : undefined;
  const sub = join(root, path);
  // The ancestry question — including the deepen-before-answering and the
  // could-not-determine that this resolver has always needed — now lives in
  // `git-ancestry`, so there is ONE implementation of it. It was a set of
  // closures here, which meant four other call sites asked the bare question
  // and read a missing object as "not an ancestor" (measured 2026-10-04: a
  // `--depth 1` clone exits **128**, and `.ok` / `try`/`catch` callers all
  // turn that into a negative). `relate` is this logic, lifted and named.
  const rel = relate(sub, ours, theirs);
  switch (rel.rel) {
    // `ours` descends from `theirs`: the branch moved the pin forward.
    case "a-descends":
      return { take: "ours", pin: ours, why: "the branch's pin fast-forwards the base's" };
    case "b-descends":
      return { take: "theirs", pin: theirs, why: "the base's pin fast-forwards the branch's" };
    // Identical pins do not conflict, so this is unreachable through the index;
    // handled rather than defaulted, because an unhandled case here would fall
    // through to "diverged" and send a non-conflict to a person.
    case "same":
      return { take: "ours", pin: ours, why: "both sides pin the same commit" };
    case "unknown":
      return { refuse: `could not determine: ${rel.reason}` };
    case "diverged":
      return {
        refuse: `the pins diverged (${ours.slice(0, 9)} vs ${theirs.slice(0, 9)}); either side drops the other's commits`,
      };
  }
}

/** Stage a resolved gitlink pin. */
export function stageGitlink(root: string, path: string, pin: string): void {
  git(root, "update-index", "--cacheinfo", `160000,${pin},${path}`);
}

/** One path a merge would drop, and which parents track it. */
export interface DroppedPath {
  path: string;
  heldBy: "both" | "ours" | "theirs";
}

/**
 * Paths a parent tracks that the merged result does not, where NEITHER side
 * deleted the path since the merge base (beans `vsv7` and `8j9e`).
 *
 * A merge may drop a path only by taking a DELETION: the path was in the merge
 * base and one side removed it. A path both parents hold, or one a side ADDED
 * since the base, must survive. The first version (`vsv7`, after #1955 lost
 * two kg-export sidecars to a resolver mis-step) asked only whether both
 * parents held the path, so a file one side added and the merge lost passed as
 * "a deletion the merge took", although nobody deleted it.
 *
 * Why this has to be checked: once a path leaves the index, nothing puts it
 * back if it is gitignored. `cat-harness/test/results/` is ignored while main
 * tracks files under it. Regen rewrites such a file on disk, every local check
 * reads the disk and passes, and `git add -A` does not stage the file because
 * it is now untracked and ignored. Only a fresh checkout shows the loss.
 * Measured on #2000 (`a16089d07`, two LSI sidecars) and on #1898
 * (`edf52fcf6`, three detangle sidecars, red on `kg:detangle:check`).
 * Pure over four path lists.
 */
export function droppedPaths(
  base: readonly string[],
  ours: readonly string[],
  theirs: readonly string[],
  result: readonly string[],
): DroppedPath[] {
  const kept = new Set(result);
  const inBase = new Set(base);
  const o = new Set(ours);
  const t = new Set(theirs);
  const out: DroppedPath[] = [];
  for (const path of new Set([...ours, ...theirs])) {
    if (kept.has(path)) continue;
    const both = o.has(path) && t.has(path);
    // One side lacks a path the base had, so that side deleted it. Taking the
    // deletion is a legitimate merge outcome.
    if (!both && inBase.has(path)) continue;
    out.push({ path, heldBy: both ? "both" : o.has(path) ? "ours" : "theirs" });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * The refusal line for one dropped path. It has the `  ✗ <path>  [...]` shape
 * that merge-main.yml and merge-main-comment.ts read.
 */
export function droppedLine(d: DroppedPath, onDisk: boolean): string {
  const held = d.heldBy === "both" ? "tracked by both parents" : `added on ${d.heldBy === "ours" ? "the branch" : "the base"} since the merge base`;
  const disk = onDisk ? "; still on disk, so local checks pass while a fresh checkout lacks it" : "";
  return `  ✗ ${d.path}  [dropped: ${held}, deleted by neither side${disk}]`;
}

/**
 * `droppedPaths` for the merge in progress at `root`. It reads the INDEX
 * (`ls-files`) and never the working tree, because the working tree is exactly
 * where a dropped ignored file hides.
 */
export function droppedInMerge(root: string): DroppedPath[] {
  const list = (ref: string) => git(root, "ls-tree", "-r", "--name-only", ref).split("\n").filter(Boolean);
  // With no merge base (unrelated histories) `base` is empty. That only makes
  // the guard stricter: every dropped path is then refused.
  const mb = spawnSync("git", ["-C", root, "merge-base", "HEAD", "MERGE_HEAD"], { encoding: "utf-8" });
  const base = mb.status === 0 ? list(mb.stdout.trim()) : [];
  return droppedPaths(base, list("HEAD"), list("MERGE_HEAD"), git(root, "ls-files").split("\n").filter(Boolean));
}

/**
 * Which dropped paths to refuse, at one of the two points the guard runs.
 *
 * - `resolved`: after the conflict resolution and before anything is staged
 *   with `add -A`. Only the resolvers have touched the index at this point,
 *   and a resolver never has a reason to drop a path neither side deleted, so
 *   EVERY dropped path is refused. This is where #1898's `git rm` would have
 *   been caught.
 * - `staged`: after the writers have run and `add -A` has staged their
 *   output. A writer may delete what it owns: a content-addressed payload is
 *   superseded when the merge changes its node, and the writer's own `:check`
 *   proves the result. That was measured on this guard's first merge of main,
 *   where `subgraph:jsonld` replaced a payload main had added. So only drops
 *   still ON DISK are refused here. That is the 8j9e signature: the index lost
 *   the path while the disk keeps it, and an ignored path is never restaged.
 */
export function refusable(dropped: readonly DroppedPath[], when: "resolved" | "staged", onDisk: (path: string) => boolean): DroppedPath[] {
  return when === "resolved" ? [...dropped] : dropped.filter((d) => onDisk(d.path));
}

/** Abort, restoring the tree, when the merge drops a path that neither side deleted (see `refusable`). */
function refuseDroppedFiles(root: string, abort: (why: string) => never, when: "resolved" | "staged"): void {
  const onDisk = (p: string) => existsSync(join(root, p));
  const dropped = refusable(droppedInMerge(root), when, onDisk);
  if (dropped.length) {
    for (const d of dropped) console.log(droppedLine(d, onDisk(d.path)));
    abort(`${dropped.length} tracked path(s) would be dropped by this merge, and neither side deleted them (beans vsv7, 8j9e)`);
  }
}

/**
 * The refusal line for a path whose declared resolution FAILED. It has the
 * shape of a planned refusal (`  ✗ <path>  [<pattern>: …]`), which is what
 * merge-main.yml and merge-main-comment.ts read: the job stays green and the
 * bot's comment names the path and why, instead of a red job with
 * "exited 1 without a refusal". The error's first line is kept verbatim.
 */
export function resolutionFailure(path: string, patternId: string, err: unknown): string {
  const first = String((err as { stderr?: unknown })?.stderr || (err as Error)?.message || err).split("\n").find((l) => l.trim()) ?? "unknown error";
  return `  ✗ ${path}  [${patternId}: could not resolve] — ${first.trim()}`;
}

function describe(c: Classified): string {
  return c.pattern ? `${c.path}  [${c.pattern.id}: ${c.strategy}]` : `${c.path}  [no declared pattern]`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const dryRun = args.includes("--dry-run");
  // `--no-regen` is for a merge TRAIN: several branches merged one after
  // another, then ONE `bun run cat regen` over the result. Regenerating after each
  // member cost 5-13 min apiece (measured 2026-10-02), and every member's
  // generated files are rewritten by the final regen anyway. Each member's
  // merge commit is NOT proved on its own; the train is proved at its end.
  const noRegen = args.includes("--no-regen");
  // `--full-regen` asks every pair, as regen did before bean `94zs`.
  const fullRegen = args.includes("--full-regen");
  const base = opt("--base") ?? "origin/main";
  // `--root` lets the command run against another checkout (a worktree at an
  // old commit, for a replay of a historical merge) without copying itself in.
  const root = opt("--root") ?? repoRootFor(join(HARNESS_ROOT));

  // Untracked files too: the final `git add -A` must stage only what the merge
  // and its regeneration wrote, never somebody's scratch file.
  if (git(root, "status", "--porcelain") !== "") {
    console.error("merge-base: the working tree is not clean (changes or untracked files); commit, stash or remove them first.");
    process.exit(2);
  }
  const remote = base.includes("/") ? base.split("/")[0]! : undefined;
  if (remote) spawnSync("git", ["-C", root, "fetch", "-q", remote, base.slice(remote.length + 1)], { stdio: "inherit" });
  try {
    git(root, "rev-parse", "--verify", `${base}^{commit}`);
  } catch {
    console.error(`merge-base: no such base ${base}`);
    process.exit(2);
  }

  // The fork point, taken BEFORE merging (bean `94zs`): regen is told to ask
  // only the pairs whose inputs changed on EITHER side since it. See
  // `regenArgs` for why this base and not the branch tip or `base`.
  const forkPoint = fullRegen
    ? undefined
    : spawnSync("git", ["-C", root, "merge-base", "HEAD", base], { encoding: "utf-8" }).stdout?.trim() || undefined;

  const merged = spawnSync("git", ["-C", root, "merge", "--no-ff", "--no-commit", base], { encoding: "utf-8" });
  const conflicted = git(root, "diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
  if (merged.status === 0 && conflicted.length === 0) {
    const pending = git(root, "status", "--porcelain", "--untracked-files=no") !== "";
    if (!pending) {
      console.log(`merge-base: already up to date with ${base}`);
      process.exit(0);
    }
  }

  // Submodule pins first, by ancestry (bean `wczm` item 2). A resolved pin is
  // staged and leaves the list; a refused one stays, so `plan` refuses it.
  const gitlinks: string[] = [];
  const gitlinkRefused = new Map<string, string>();
  for (const path of conflicted) {
    const r = resolveGitlink(root, path);
    if (r === undefined) continue;
    if ("refuse" in r) { gitlinkRefused.set(path, r.refuse); continue; }
    stageGitlink(root, path, r.pin);
    gitlinks.push(`  ✓ ${path}  [gitlink: ${r.take}] — ${r.why}`);
  }
  const resolvedLinks = new Set(gitlinks.map((l) => l.trim().slice(2).split("  ")[0]!));
  const p = plan(conflicted.filter((c) => !resolvedLinks.has(c)));
  console.log(`merge-base: ${conflicted.length} conflicted path(s) merging ${base}`);
  for (const l of gitlinks) console.log(l);
  for (const [path, why] of gitlinkRefused) console.log(`    (gitlink ${path}: ${why})`);
  for (const c of p.resolvable) console.log(`  ✓ ${describe(c)}`);
  for (const c of p.refused) console.log(`  ✗ ${describe(c)}${c.pattern ? ` — ${c.pattern.why}` : ""}`);

  // `git merge --abort` refuses once regen has written unstaged changes
  // ("not uptodate. Cannot merge"), and this used to print "tree restored"
  // over a half-merged tree regardless. The restore is now CHECKED; when it
  // did not happen the person is told, and nothing destructive runs unasked.
  //
  // Staging first is what makes the abort succeed: `merge --abort` is
  // `reset --merge`, which keeps (and so refuses over) index/worktree
  // differences, and resets everything that is staged. The run started from
  // a clean tree with no untracked files (checked above), so every change
  // present is this run's own and staging it loses nothing. Measured
  // 2026-10-01 on #1754: unstaged regen output left the merge in progress;
  // `add -A` then `merge --abort` restored the tree to 0 changes.
  const abort: (why: string) => never = (why) => {
    spawnSync("git", ["-C", root, "add", "-A"], { stdio: "inherit" });
    spawnSync("git", ["-C", root, "merge", "--abort"], { stdio: "inherit" });
    syncSubmodules(root); // back to the branch's pins, or the tree reads as dirty
    const merging = spawnSync("git", ["-C", root, "rev-parse", "-q", "--verify", "MERGE_HEAD"]).status === 0;
    const restored = !merging && !git(root, "status", "--porcelain");
    console.error(restored
      ? `\nmerge-base: ABORTED, tree restored — ${why}`
      : `\nmerge-base: ABORTED, but the merge is still in progress and the tree is NOT restored — ${why}\n` +
        "  Everything changed since the clean start is this run's own: either finish the merge by hand,\n" +
        "  or discard it yourself with `git reset --merge` (check `git status` first).");
    process.exit(1);
  };

  if (dryRun) {
    if (conflicted.length || merged.status !== 0 || git(root, "status", "--porcelain", "--untracked-files=no")) {
      spawnSync("git", ["-C", root, "merge", "--abort"], { stdio: "ignore" });
    }
    console.log(p.refused.length ? "\n--dry-run: would REFUSE (see ✗ above); nothing changed." : "\n--dry-run: would resolve all of them; nothing changed.");
    process.exit(p.refused.length ? 1 : 0);
  }
  if (p.refused.length) abort(`${p.refused.length} conflict(s) need a person (✗ above)`);

  for (const c of p.resolvable) {
    // A README one side deleted has no hunks to resolve: it is a take-base
    // case whichever pattern named it.
    const oneSided = c.strategy === "generated-regions" && unmergedStages(root, c.path).size < 3;
    let resolved: string | undefined;
    try {
      if (c.strategy === "owned-tree") {
        takeOwnedTree(root, c.path);
        continue;
      } else if (c.strategy === "take-base" || oneSided) {
        takeBase(root, c.path);
        continue;
      } else if (c.strategy === "generated-regions") {
        resolved = resolveGeneratedRegions(readFileSync(join(root, c.path), "utf-8"));
        if (resolved !== undefined) {
          writeFileSync(join(root, c.path), resolved);
          stageConflicted(root, c.path);
        }
      }
    } catch (err) {
      console.log(resolutionFailure(c.path, c.pattern?.id ?? c.strategy, err));
      abort(`${c.path}: its declared resolution failed (✗ above)`);
    }
    if (c.strategy === "generated-regions" && !oneSided && resolved === undefined) {
      console.log(`  ✗ ${c.path}  [${c.pattern?.id ?? c.strategy}: could not resolve] — a hunk lies outside a generated region`);
      abort(`${c.path}: a hunk lies outside a generated region (authored text conflicts)`);
    }
  }
  // Every resolver has now staged what it resolved, and nothing else has been
  // staged yet: the index is the resolution alone. Beans vsv7, 8j9e.
  refuseDroppedFiles(root, abort, "resolved");

  if (noRegen) {
    // Sync the submodule checkouts to the merged gitlinks BEFORE staging.
    // `add -A` stages a gitlink from the submodule's checked-out HEAD, so
    // without this the merge commit silently reverts the base's
    // `bootstrap`/`bootstrap-tools` pins — the trap `merge-queue` names, and
    // what broke `readme:subgraphs` on an unblocker's merge of #2062
    // (2026-10-04).
    syncSubmodules(root);
    git(root, "add", "-A");
    refuseDroppedFiles(root, abort, "staged");
    git(root, "commit", "-q", "--no-edit");
    console.log(`\nmerge-base: merged ${base}; ${p.resolvable.length} conflict(s) resolved by declared pattern. NOT regenerated (--no-regen): run \`bun run cat regen\` once over the train.`);
    process.exit(0);
  }

  // The merge moves the submodule GITLINKS but not their checkouts, so without
  // this regen judges the merged tree against the branch's old submodule
  // content. Measured 2026-10-01 on #1754: main had bumped `bootstrap` and
  // `bootstrap-tools`, and `kg:audit:all:check` and
  // `translate-bpmn:bootstrap:check` came back "unrepaired" — a defect in the
  // tool's view, not in the merge.
  syncSubmodules(root);
  // Likewise the dependencies: when the base changed `bun.lock`, regen must
  // run against the merged lockfile, not the branch's — otherwise a writer
  // that needs a dependency the base added reads as "unrepaired". Measured as
  // a risk when this command started running on old branches in CI
  // (`merge-main.yml`, 2026-10-02). `node_modules/` is ignored, so the tree
  // stays clean for the final `add -A`.
  if (spawnSync("git", ["-C", root, "diff", "--cached", "--quiet", "HEAD", "--", "bun.lock", "package.json"]).status !== 0) {
    const inst = spawnSync("bun", ["install", "--frozen-lockfile"], { cwd: root, stdio: "inherit" });
    if (inst.status !== 0) abort("bun install against the merged lockfile failed");
  }
  // And the branch-kept graphs (bean 9c7h). The merge can bring in a
  // declaration the branch did not have — fsh-guts kept on
  // `cat/cat-harness/fsh-guts` — so a mount made BEFORE the merge mounted
  // nothing, and regen then reads the graph as unmounted: `fsh-guts:viz` exits
  // 2 and `audit:coverage:strict` fails. Measured 2026-10-04 on merge-main run
  // 37193546694: #2059, #2043 and #1829, every head predating 88da63c2d6, all
  // refused the same way. Mount against the MERGED declarations. Idempotent,
  // and the mounted paths are ignored, so the final `add -A` stays clean.
  const mount = spawnSync("bun", ["run", "cat", "state:mount"], { cwd: root, stdio: "inherit" });
  if (mount.status !== 0) abort("state:mount against the merged declarations failed");
  console.log("\nmerge-base: regenerating, and asking every gate the CI workflow runs …");
  const regen = spawnSync("bun", ["run", "cat", "regen", ...regenArgs(forkPoint)], { cwd: root, stdio: "inherit" });
  // NOT one message for every non-zero exit. `regen`'s `exitCodeFor` returns
  // three distinct verdicts and this line used to assert "regen reported
  // unrepaired checks" for all of them — false for exit 2 (which reports no
  // unrepaired check at all, only that it could not settle), false for a
  // `no-browser`-only exit 1 (which regen itself calls could-not-determine),
  // and false for a crash (where nothing was measured). The ABORT is right in
  // every case: none of them may push. Only the recorded reason was wrong, and
  // the abort line is the one place the reason is written down — it is what
  // the PR comment's signature is built from and what a person reads in the
  // log. `regenExitMeaning` is the inverse of `exitCodeFor` and carries the
  // evidence.
  if (regen.status !== 0) {
    const m = regenExitMeaning(regen.status);
    abort(
      `the gate set did not prove the resolution — ${REGEN_VERDICT_TAG} ${m.verdict}\n` +
        `  ${m.why}`,
    );
  }
  git(root, "add", "-A");
  refuseDroppedFiles(root, abort, "staged");
  git(root, "commit", "-q", "--no-edit");
  console.log(`\nmerge-base: merged ${base}; ${p.resolvable.length} conflict(s) resolved by declared pattern, regenerated and proved.`);
}
