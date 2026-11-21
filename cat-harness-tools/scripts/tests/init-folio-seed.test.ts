/**
 * Bean `izqr` — an EMPTY repository gets `main` seeded before the bootstrap
 * lands on a branch off it; a repository with history is never seeded over.
 *
 * @module cat-harness/scripts/tests/init-folio-seed.test
 *
 * Real `git`, real bare remotes, in temp directories — the behaviour under
 * test is what git does, so a mock would test the mock.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initFolio, seedMainIfEmpty } from "../init-folio.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" };
function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, stdio: "pipe", env: ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.toString().trim();
}
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "izqr-"));
  made.push(d);
  return d;
}
/** A fresh `git init` with its identity set, as a contributor's would be. */
function freshRepo(): string {
  const d = tmp();
  git(d, "init", "--quiet", "-b", "trunk");
  git(d, "config", "user.name", "t");
  git(d, "config", "user.email", "t@example.org");
  return d;
}

describe("an empty repository is seeded, then bootstrapped on a branch", () => {
  test("with a bare remote: main exists on the remote BEFORE the bootstrap branch", () => {
    const remote = tmp();
    git(remote, "init", "--quiet", "--bare");
    const repo = freshRepo();
    git(repo, "remote", "add", "origin", remote);

    const r = seedMainIfEmpty(repo, "demo");
    expect(r).toEqual({ kind: "seeded", branch: "bootstrap/demo", pushed: true });
    expect(git(remote, "branch", "--list", "main")).toContain("main");
    expect(git(repo, "symbolic-ref", "--short", "HEAD")).toBe("bootstrap/demo");
    expect(git(repo, "merge-base", "main", "bootstrap/demo")).toBe(git(repo, "rev-parse", "main"));
    // The seed is EMPTY: nothing a bootstrap would then have to overwrite.
    expect(git(repo, "ls-tree", "-r", "--name-only", "main")).toBe("");
  });

  test("with no remote: seeded locally, not pushed", () => {
    const repo = freshRepo();
    const r = seedMainIfEmpty(repo, "demo");
    expect(r).toEqual({ kind: "seeded", branch: "bootstrap/demo", pushed: false });
    expect(git(repo, "rev-list", "--count", "main")).toBe("1");
  });
});

describe("history is never seeded over", () => {
  test("commits but no main is REPORTED, not seeded", () => {
    const repo = freshRepo();
    git(repo, "commit", "--quiet", "--allow-empty", "-m", "existing");
    const before = git(repo, "rev-parse", "HEAD");
    expect(seedMainIfEmpty(repo, "demo")).toEqual({ kind: "no-main", current: "trunk" });
    expect(git(repo, "rev-parse", "HEAD")).toBe(before);
    expect(spawnSync("git", ["show-ref", "--verify", "--quiet", "refs/heads/main"], { cwd: repo }).status).not.toBe(0);
  });

  test("an ordinary repository with main is left alone", () => {
    const repo = freshRepo();
    git(repo, "switch", "--quiet", "-c", "main");
    git(repo, "commit", "--quiet", "--allow-empty", "-m", "existing");
    expect(seedMainIfEmpty(repo, "demo")).toEqual({ kind: "has-main" });
  });

  test("an empty checkout whose REMOTE has branches stops — it is empty only because nothing was fetched", () => {
    const remote = tmp();
    git(remote, "init", "--quiet", "--bare");
    const other = freshRepo();
    git(other, "remote", "add", "origin", remote);
    git(other, "commit", "--quiet", "--allow-empty", "-m", "upstream");
    git(other, "push", "--quiet", "origin", "HEAD:main");

    const repo = freshRepo();
    git(repo, "remote", "add", "origin", remote);
    const r = seedMainIfEmpty(repo, "demo");
    expect(r.kind).toBe("stopped");
    expect(spawnSync("git", ["rev-parse", "--verify", "--quiet", "HEAD"], { cwd: repo }).status).not.toBe(0);
  });

  test("a remote that cannot be asked is could-not-determine, and stops", () => {
    const repo = freshRepo();
    git(repo, "remote", "add", "origin", join(tmp(), "does-not-exist"));
    const r = seedMainIfEmpty(repo, "demo");
    expect(r.kind).toBe("stopped");
    expect(r.kind === "stopped" && r.reason).toContain("could not ask the remote");
  });
});

describe("--skip-vcs still puts main on an empty remote (dth-hrh, 2026-10-14)", () => {
  test("a cloud checkout on an unborn feature branch: main reaches the remote, the branch is kept", () => {
    const remote = tmp();
    git(remote, "init", "--quiet", "--bare");
    const repo = tmp();
    git(repo, "init", "--quiet", "-b", "claude/feature");
    git(repo, "config", "user.name", "t");
    git(repo, "config", "user.email", "t@example.org");
    git(repo, "remote", "add", "origin", remote);

    initFolio({ targetDir: repo, contentType: "document", slug: "doc", title: "Doc", authors: ["A"], link: "sibling", assistantPath: "../platform", skipVcs: true });

    expect(git(remote, "branch", "--list", "main")).toContain("main");
    expect(git(repo, "symbolic-ref", "--short", "HEAD")).toBe("claude/feature");
    // The branch starts from main, so its first commit and its PR sit on top of it.
    expect(git(repo, "rev-parse", "claude/feature")).toBe(git(remote, "rev-parse", "main"));
  });

  test("a remote with branches is not touched", () => {
    const remote = tmp();
    git(remote, "init", "--quiet", "--bare");
    const seeder = freshRepo();
    git(seeder, "commit", "--quiet", "--allow-empty", "-m", "x");
    git(seeder, "push", "--quiet", remote, "HEAD:refs/heads/trunk");
    const repo = freshRepo();
    git(repo, "remote", "add", "origin", remote);

    initFolio({ targetDir: repo, contentType: "document", slug: "doc", title: "Doc", authors: ["A"], link: "sibling", assistantPath: "../platform", skipVcs: true });

    expect(git(remote, "branch", "--list", "main")).toBe("");
  });
});
