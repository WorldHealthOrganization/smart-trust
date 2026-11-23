/**
 * A symlinked `node_modules` must not enter the corpus. Bean `qook`.
 *
 * ## The defect, measured 2026-09-26
 *
 * `check:merged` builds a throwaway worktree of the merged tree and SYMLINKS
 * the checkout's `node_modules` into it, to avoid a second install. `.gitignore`
 * line 1 read `node_modules/` — and git's trailing slash means **directory
 * only**. A symlink is not a directory, so in that worktree the path was not
 * ignored, `git ls-files --others --exclude-standard` returned it, and
 * {@link gitCorpus} handed every consumer **one phantom entry**.
 *
 * What that cost, on the same commit `0d3c49c8`:
 *
 * | | corpus | `kg:detangle:check` |
 * |---|---|---|
 * | real checkout (`node_modules` a directory) | 13666 | ✓ 29 pinned current |
 * | worktree (`node_modules` a symlink) | 13667 | ✗ 5 STALE |
 *
 * The lists differed by exactly one entry, `node_modules`, and removing the
 * trailing slash took the corpus back to 13666 and the stale set from five
 * files to one. So `check:merged` reported a merged tree defective when no
 * real checkout of it was — twice in one hour, on two unrelated branches
 * (#1392 and #1395), which is how the bean was opened.
 *
 * ## Why the test is at the CORPUS level rather than on the pattern
 *
 * Asserting `.gitignore` contains a particular string pins the spelling, not
 * the behaviour, and git decides directory-ness from the filesystem rather
 * than from the text. So this builds the actual shape — a repository whose
 * `node_modules` is a symlink — and asks {@link gitCorpus} what it sees.
 * That is the question every consumer asks, and the one that was answered
 * wrongly.
 *
 * It is a scratch repository rather than this one on purpose: this repo's
 * `node_modules` is a real directory, so the defect is INVISIBLE here. A test
 * that could only run where the bug cannot occur is not a test.
 *
 * Moved here from `cat-harness/scripts/tests/` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: every test in it reads the aggregate
 * repository's own root — the `.gitignore` — which a standalone cat-harness
 * layer does not have, and `check:cat-harness-standalone` collects every test
 * in that layer.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, expect, test } from "bun:test";

import { gitCorpus } from "../../schemas/sdlc/git-corpus.ts";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = resolve(ORIGIN_DIR, "..", "..", "..");
const scratches: string[] = [];

afterAll(() => {
  for (const d of scratches) rmSync(d, { recursive: true, force: true });
});

/** This repository's own ignore rule for dependencies, whatever it now says. */
function dependencyIgnoreLines(): string[] {
  return readFileSync(join(ROOT, ".gitignore"), "utf8")
    .split("\n")
    .filter((l) => l.trim().replace(/\/$/, "") === "node_modules");
}

/** A scratch repo carrying this repo's real ignore rule, with `node_modules` as `kind`. */
function scratchRepo(kind: "symlink" | "directory"): string {
  const dir = mkdtempSync(join(tmpdir(), "corpus-deps-"));
  scratches.push(dir);
  const repo = join(dir, "repo");
  mkdirSync(repo);
  spawnSync("git", ["init", "-q"], { cwd: repo });
  writeFileSync(join(repo, ".gitignore"), `${dependencyIgnoreLines().join("\n")}\n`);
  writeFileSync(join(repo, "tracked.md"), "# tracked\n");

  const deps = join(dir, "real-node-modules");
  mkdirSync(deps);
  writeFileSync(join(deps, "package.json"), "{}\n");
  if (kind === "symlink") symlinkSync(deps, join(repo, "node_modules"), "dir");
  else {
    mkdirSync(join(repo, "node_modules"));
    writeFileSync(join(repo, "node_modules", "package.json"), "{}\n");
  }
  return repo;
}

test("this repository still has a dependency ignore rule at all", () => {
  // Guards the guard: if the line is renamed or dropped, the two tests below
  // would build scratch repos with an EMPTY .gitignore, both would see
  // `node_modules`, and the symlink test would fail for the wrong reason —
  // or, worse, someone would 'fix' it by weakening the assertion.
  expect(
    dependencyIgnoreLines().length,
    "no `node_modules` line in .gitignore — the tests below would be testing nothing",
  ).toBeGreaterThan(0);
});

test("a symlinked node_modules is NOT in the corpus", () => {
  const repo = scratchRepo("symlink");
  const corpus = gitCorpus(repo);
  expect(corpus, "git could not answer — that is `could not determine`, not clean").toBeDefined();
  expect(
    corpus!.filter((p) => p.endsWith("/node_modules")),
    "A symlinked `node_modules` entered the corpus. `.gitignore` is matching " +
      "`node_modules/` with a trailing slash, which git reads as DIRECTORY ONLY. " +
      "Every worktree that symlinks dependencies — `check:merged` does — then " +
      "measures a corpus one entry larger than any real checkout, and the " +
      "corpus-derived gates (detangle, the UML overview) report a clean tree " +
      "STALE. Measured on 0d3c49c8: 13667 vs 13666, five files falsely stale.",
  ).toEqual([]);
});

test("...and neither is a real node_modules directory — the control", () => {
  // The anti-vacuity half. Without it, a `gitCorpus` that returned nothing at
  // all, or a scratch repo git refused to read, would pass the test above.
  const repo = scratchRepo("directory");
  const corpus = gitCorpus(repo);
  expect(corpus).toBeDefined();
  expect(corpus!.filter((p) => p.endsWith("/node_modules"))).toEqual([]);
  expect(
    corpus!.some((p) => p.endsWith("/tracked.md")),
    "the scratch repo's own tracked file is missing, so this sweep saw nothing " +
      "and the assertion above cleared nothing",
  ).toBe(true);
});
