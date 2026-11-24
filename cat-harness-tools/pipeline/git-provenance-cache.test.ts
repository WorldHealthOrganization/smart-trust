/**
 * `sff8` — `gitFileCommitSha` is memoised, and the memo is keyed on HEAD.
 *
 * The assertion that matters is the INVALIDATION one. A cache that never expired
 * would pass a test that only checked "the second call is faster", and it would
 * record a verdict stamped with a superseded commit — the failure `sfjo` and `rmcf`
 * are both about, arriving through a performance fix.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GIT_SHA_UNKNOWN, gitFileCommitSha, gitHeadSha } from "./qa-utils.ts";

/** A throwaway repo with one commit, and a handle to add more. */
function repo(): { root: string; commit: (file: string, body: string) => string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "sff8-git-"));
  const git = (...args: string[]): string =>
    execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  git("init", "-q");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "T");
  git("config", "commit.gpgsign", "false");
  const commit = (file: string, body: string): string => {
    writeFileSync(join(root, file), body);
    git("add", file);
    git("commit", "-q", "-m", `touch ${file}`);
    return git("rev-parse", "HEAD");
  };
  commit("a.txt", "one\n");
  return { root, commit, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("gitFileCommitSha — memoised, keyed on HEAD", () => {
  test("returns the commit that last touched the path", () => {
    const { root, cleanup } = repo();
    try {
      expect(gitFileCommitSha("a.txt", root)).toBe(gitHeadSha(root));
    } finally {
      cleanup();
    }
  });

  test("a repeated call agrees with itself — the memo does not change the answer", () => {
    const { root, cleanup } = repo();
    try {
      const first = gitFileCommitSha("a.txt", root);
      expect(gitFileCommitSha("a.txt", root)).toBe(first);
      expect(gitFileCommitSha("a.txt", root)).toBe(first);
    } finally {
      cleanup();
    }
  });

  // THE INVALIDATION. Without it the memo is a staleness bug wearing a speedup's
  // clothes: a verdict written after this commit would carry the sha from before it.
  test("a NEW COMMIT touching the path changes the answer — the memo expires on HEAD", () => {
    const { root, commit, cleanup } = repo();
    try {
      const before = gitFileCommitSha("a.txt", root);
      const head2 = commit("a.txt", "two\n");
      const after = gitFileCommitSha("a.txt", root);
      expect(after).not.toBe(before);
      expect(after).toBe(head2);
    } finally {
      cleanup();
    }
  });

  // The other direction, and it is the one a lifetime cache gets right by accident:
  // HEAD moved but this path did not, so the answer must NOT change.
  test("a commit touching ANOTHER path leaves this path's answer alone", () => {
    const { root, commit, cleanup } = repo();
    try {
      const before = gitFileCommitSha("a.txt", root);
      commit("b.txt", "other\n");
      expect(gitFileCommitSha("a.txt", root)).toBe(before);
    } finally {
      cleanup();
    }
  });

  test("two paths in one repo do not share an entry", () => {
    const { root, commit, cleanup } = repo();
    try {
      const b = commit("b.txt", "other\n");
      expect(gitFileCommitSha("b.txt", root)).toBe(b);
      expect(gitFileCommitSha("a.txt", root)).not.toBe(b);
    } finally {
      cleanup();
    }
  });

  test("a path git knows nothing about is unknown, and stays unknown", () => {
    const { root, cleanup } = repo();
    try {
      expect(gitFileCommitSha("absent.txt", root)).toBe(GIT_SHA_UNKNOWN);
      expect(gitFileCommitSha("absent.txt", root)).toBe(GIT_SHA_UNKNOWN);
    } finally {
      cleanup();
    }
  });

  test("a directory that is not a repo at all is unknown, not a throw", () => {
    const root = mkdtempSync(join(tmpdir(), "sff8-norepo-"));
    try {
      writeFileSync(join(root, "a.txt"), "one\n");
      expect(gitFileCommitSha("a.txt", root)).toBe(GIT_SHA_UNKNOWN);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // The key is (repoRoot, relPath), so the same relative path in two repos must not
  // collide. The two repos are given DIFFERENT content deliberately: a git commit sha
  // is a hash of content plus author plus timestamp, so two fixtures built in the same
  // second from identical bytes produce the SAME sha — an earlier version of this test
  // asserted the shas differed and failed for exactly that reason, testing git's
  // determinism rather than this cache's keying.
  test("two repos do not share an entry for the same relative path", () => {
    const one = repo();
    const two = repo();
    try {
      const distinct = two.commit("a.txt", "different content entirely\n");
      const a = gitFileCommitSha("a.txt", one.root);
      const b = gitFileCommitSha("a.txt", two.root);
      expect(b).toBe(distinct);
      expect(a).not.toBe(b);
      // And the first repo's entry survives the second's lookup.
      expect(gitFileCommitSha("a.txt", one.root)).toBe(a);
    } finally {
      one.cleanup();
      two.cleanup();
    }
  });
});
