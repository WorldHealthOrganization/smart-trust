/**
 * An EMPTY origin gets `main` before a feature branch
 * can become GitHub's default (dth-hrh, owner 2026-10-14). A remote with any
 * branch is never touched, and nothing is ever force-pushed.
 *
 * @module cat-harness-tools/scripts/tests/seed-main-if-remote-empty.test
 *
 * Real `git`, real bare remotes, as init-folio-seed.test.ts: the behaviour
 * under test is what git does.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatRemoteSeed, seedRemoteMainIfEmpty } from "../seed-main-if-remote-empty.ts";

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
  const d = mkdtempSync(join(tmpdir(), "mainfirst-"));
  made.push(d);
  return d;
}
function bare(): string {
  const d = tmp();
  git(d, "init", "--quiet", "--bare");
  return d;
}
/** A checkout on a feature branch, as a cloud session's is. */
function checkout(remote: string, branch = "claude/feature"): string {
  const d = tmp();
  git(d, "init", "--quiet", "-b", branch);
  git(d, "config", "user.name", "t");
  git(d, "config", "user.email", "t@example.org");
  git(d, "remote", "add", "origin", remote);
  return d;
}
const remoteBranches = (remote: string) => git(remote, "for-each-ref", "--format=%(refname:short)", "refs/heads");

describe("an empty origin gets main first", () => {
  test("commits on a feature branch: main is the branch's ROOT, so there is one root", () => {
    const remote = bare();
    const repo = checkout(remote);
    writeFileSync(join(repo, "a.md"), "a\n");
    git(repo, "add", "a.md");
    git(repo, "commit", "--quiet", "-m", "first");
    const root = git(repo, "rev-parse", "HEAD");
    git(repo, "commit", "--quiet", "--allow-empty", "-m", "second");
    const tip = git(repo, "rev-parse", "HEAD");

    const r = seedRemoteMainIfEmpty(repo);
    expect(r).toEqual({ kind: "seeded", from: "root-commit", sha: root });
    expect(remoteBranches(remote)).toBe("main");
    expect(git(remote, "rev-parse", "main")).toBe(root);
    // The feature branch descends from main: a PR shows "second" alone.
    expect(git(repo, "merge-base", "main", "HEAD")).toBe(root);
    expect(git(repo, "rev-parse", "HEAD")).toBe(tip);
    expect(git(repo, "symbolic-ref", "--short", "HEAD")).toBe("claude/feature");
    // Pushing the feature branch afterwards is an ordinary push.
    git(repo, "push", "--quiet", "origin", "claude/feature");
  });

  test("a branch that is its own root is seeded, and the empty PR is reported", () => {
    const remote = bare();
    const repo = checkout(remote);
    git(repo, "commit", "--quiet", "--allow-empty", "-m", "only");
    const r = seedRemoteMainIfEmpty(repo);
    expect(r.kind === "seeded" && r.from).toBe("root-commit");
    expect(r.kind === "seeded" && r.note).toContain("empty");
    expect(formatRemoteSeed(r)).toContain("pull request will be empty");
  });

  test("no commits yet: an empty seed, and the current branch starts from it", () => {
    const remote = bare();
    const repo = checkout(remote);
    writeFileSync(join(repo, "staged.md"), "s\n");
    git(repo, "add", "staged.md");

    const r = seedRemoteMainIfEmpty(repo);
    expect(r.kind === "seeded" && r.from).toBe("empty-seed");
    expect(remoteBranches(remote)).toBe("main");
    expect(git(remote, "ls-tree", "-r", "--name-only", "main")).toBe("");
    expect(git(repo, "rev-parse", "claude/feature")).toBe(git(repo, "rev-parse", "main"));
    // The session's index is untouched: its staged file is still staged.
    expect(git(repo, "diff", "--cached", "--name-only")).toBe("staged.md");
    git(repo, "commit", "--quiet", "-m", "work");
    expect(git(repo, "rev-list", "--max-parents=0", "HEAD")).toBe(git(repo, "rev-parse", "main"));
  });

  test("a local main is what is pushed", () => {
    const remote = bare();
    const repo = checkout(remote, "main");
    git(repo, "commit", "--quiet", "--allow-empty", "-m", "m");
    const m = git(repo, "rev-parse", "main");
    git(repo, "switch", "--quiet", "-c", "claude/feature");
    git(repo, "commit", "--quiet", "--allow-empty", "-m", "f");
    expect(seedRemoteMainIfEmpty(repo)).toEqual({ kind: "seeded", from: "local-main", sha: m });
    expect(git(remote, "rev-parse", "main")).toBe(m);
  });
});

describe("anything but an empty answer leaves the remote alone", () => {
  test("a remote with ANY branch is not touched, even one that is not main", () => {
    const remote = bare();
    const other = checkout(remote, "trunk");
    git(other, "commit", "--quiet", "--allow-empty", "-m", "upstream");
    git(other, "push", "--quiet", "origin", "trunk");

    const repo = checkout(remote);
    git(repo, "commit", "--quiet", "--allow-empty", "-m", "mine");
    expect(seedRemoteMainIfEmpty(repo)).toEqual({ kind: "remote-has-branches" });
    expect(remoteBranches(remote)).toBe("trunk");
    expect(formatRemoteSeed({ kind: "remote-has-branches" })).toBe("");
  });

  test("no origin: nothing", () => {
    const repo = tmp();
    git(repo, "init", "--quiet");
    expect(seedRemoteMainIfEmpty(repo)).toEqual({ kind: "no-origin" });
  });

  test("a remote that cannot be asked stops, and seeds nothing locally", () => {
    const repo = checkout(join(tmp(), "does-not-exist"));
    const r = seedRemoteMainIfEmpty(repo);
    expect(r.kind).toBe("stopped");
    expect(spawnSync("git", ["show-ref", "--verify", "--quiet", "refs/heads/main"], { cwd: repo }).status).not.toBe(0);
  });

  test("the entry point exits 0 whatever happens", () => {
    const repo = checkout(join(tmp(), "does-not-exist"));
    const r = spawnSync("bun", ["run", join(import.meta.dir, "..", "seed-main-if-remote-empty.ts"), repo], { stdio: "pipe", env: ENV });
    expect(r.status).toBe(0);
    expect(r.stdout.toString()).toContain("main was not seeded");
  });
});
