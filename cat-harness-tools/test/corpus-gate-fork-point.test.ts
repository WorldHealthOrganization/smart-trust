/**
 * The change-set route through the corpus gate survives main being merged
 * into the PR (WorldHealthOrganization/dth-cs#3, CS-003).
 *
 * The gate ties a stored change-set instance to the PR by its `startedAt`
 * being after the PR's base. That base was `git merge-base <since> HEAD`,
 * which becomes main's tip once main is merged in, so an instance started on
 * the branch before the merge stopped covering its blocks. The base is now
 * the PR's fork point (`prBaseTime`), which a main-merge does not move; an
 * instance started before the fork point still covers nothing.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CHANGE_REVIEW_PROCESS, MAKE_PHASE, changeSetCover, startedSince } from "../src/workflow/change-set-coverage.ts";
import { prBaseTime, type GitLines } from "../src/workflow/corpus-gate.ts";
import type { InstanceState } from "../src/workflow/instance.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function cs(id: string, startedAt: string): InstanceState {
  return {
    id,
    processId: CHANGE_REVIEW_PROCESS,
    status: "running",
    startedAt,
    updatedAt: startedAt,
    history: [{ node: MAKE_PHASE, at: startedAt }],
    scope: { changeSet: id.toUpperCase(), blocks: ["fig-1"] },
  } as unknown as InstanceState;
}

/** A repository whose commits carry the times given, so the order of events is fixed. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "corpus-gate-fork-"));
  made.push(root);
  const run = (args: string[], at?: string): string =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(at ? { GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at } : {}) },
    });
  const git: GitLines = (args) => run(args).split("\n").map((l) => l.trim()).filter(Boolean);
  run(["init", "-q", "-b", "main"]);
  run(["config", "user.email", "t@t"]);
  run(["config", "user.name", "t"]);
  run(["config", "commit.gpgsign", "false"]);
  const commit = (file: string, at: string): void => {
    writeFileSync(join(root, file), at);
    run(["add", file]);
    run(["commit", "-q", "-m", file], at);
  };
  return { root, run, git, commit };
}

describe("prBaseTime", () => {
  // main: m1 (05:00) ── m2 (09:23, dth-cs#4)
  // PR:    └ b1 (07:00) ── merge of main (09:30)
  // The change set's instance started at 06:49, after the fork and before the merge.
  const FORK = "2026-11-18T05:00:00Z";
  const STARTED = "2026-11-18T06:49:00Z";

  function scene() {
    const f = fixture();
    f.commit("m1", FORK);
    f.run(["checkout", "-q", "-b", "pr"]);
    f.commit("b1", "2026-11-18T07:00:00Z");
    f.run(["checkout", "-q", "main"]);
    f.commit("m2", "2026-11-18T09:23:00Z");
    f.run(["checkout", "-q", "pr"]);
    f.run(["merge", "-q", "--no-edit", "main"], "2026-11-18T09:30:00Z");
    return f;
  }

  test("an instance started before main was merged in still covers the change set's blocks", () => {
    const { git } = scene();
    const base = prBaseTime(git, "main");
    expect(Date.parse(base!)).toBe(Date.parse(FORK));
    expect(changeSetCover(startedSince([cs("cs-003", STARTED)], base!), "fig-1")).toEqual({
      instance: "cs-003",
      changeSet: "CS-003",
    });
    // The merge base is main's tip: the old base, which refused it.
    const mergeBase = git(["show", "-s", "--format=%cI", git(["merge-base", "main", "HEAD"])[0]!])[0]!;
    expect(startedSince([cs("cs-003", STARTED)], mergeBase)).toEqual([]);
  });

  test("the same under the merge commit CI checks out (HEAD^1 main, HEAD^2 the PR head)", () => {
    const { git, run } = scene();
    run(["checkout", "-q", "--detach", "main"]);
    run(["merge", "-q", "--no-ff", "--no-edit", "pr"], "2026-11-18T10:00:00Z");
    const since = git(["rev-parse", "HEAD^1"])[0]!;
    expect(Date.parse(prBaseTime(git, since)!)).toBe(Date.parse(FORK));
  });

  test("an unrelated instance started before the fork point still covers nothing", () => {
    const { git } = scene();
    const base = prBaseTime(git, "main")!;
    expect(startedSince([cs("cs-old", "2026-11-18T04:00:00Z")], base)).toEqual([]);
  });

  test("a merged-in side branch's older base does not widen the window", () => {
    const f = fixture();
    f.commit("m0", "2026-11-18T01:00:00Z");
    f.run(["checkout", "-q", "-b", "side"]);
    f.commit("s1", "2026-11-18T02:00:00Z");
    f.run(["checkout", "-q", "main"]);
    f.commit("m1", FORK);
    f.run(["checkout", "-q", "-b", "pr"]);
    f.commit("b1", "2026-11-18T07:00:00Z");
    f.run(["merge", "-q", "--no-edit", "side"], "2026-11-18T07:30:00Z");
    expect(Date.parse(prBaseTime(f.git, "main")!)).toBe(Date.parse(FORK));
  });

  test("with no commits of its own the base is the merge base, as before", () => {
    const f = fixture();
    f.commit("m1", FORK);
    expect(Date.parse(prBaseTime(f.git, "main")!)).toBe(Date.parse(FORK));
  });
});
