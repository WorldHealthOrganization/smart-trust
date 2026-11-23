/**
 * A shallow checkout must not be allowed to invent file provenance.
 *
 * `gitFileCommitSha` backs `script_commit_sha` in every QA script sidecar.
 * In a truncated history `git log -1 -- <file>` reports the GRAFT BOUNDARY
 * for any file untouched inside the fetched window — the commit where
 * history stops and every file looks newly added — and that is
 * indistinguishable from a real answer.
 *
 * Measured 2026-09-18 in a 102-commit shallow checkout: a sweep rewrote 77
 * of 78 sidecars to the single boundary sha, collapsing provenance that
 * carried NINE distinct commits. The corruption is silent and reads as a
 * tidy-up.
 *
 * THESE TESTS BUILD THEIR OWN REPOSITORIES. The first version read the
 * ambient checkout, which passed locally (102 commits, some files committed
 * inside the window) and failed in CI, where `actions/checkout` fetches
 * depth 1 — there EVERY file resolves to the single commit, so no fixture
 * satisfying "committed inside the window" exists at all. A test of
 * shallow-clone behaviour must not itself depend on how deep the ambient
 * clone happens to be.
 */
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitFileCommitSha, GIT_SHA_UNKNOWN } from "../../pipeline/qa-utils.ts";

let full = "";
let shallow = "";
let firstSha = "";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  })
    .toString()
    .trim();
}

beforeAll(() => {
  full = mkdtempSync(join(tmpdir(), "prov-full-"));
  git(full, ["init", "-q", "-b", "main"]);

  // Commit 1 touches early.txt and nothing after does, so in a depth-1 clone
  // early.txt attributes to the boundary — the exact case being guarded.
  writeFileSync(join(full, "early.txt"), "one\n");
  git(full, ["add", "early.txt"]);
  git(full, ["commit", "-q", "-m", "first"]);
  firstSha = git(full, ["rev-parse", "HEAD"]);

  writeFileSync(join(full, "later.txt"), "two\n");
  git(full, ["add", "later.txt"]);
  git(full, ["commit", "-q", "-m", "second"]);

  shallow = mkdtempSync(join(tmpdir(), "prov-shallow-"));
  rmSync(shallow, { recursive: true, force: true });
  execFileSync("git", ["clone", "-q", "--depth", "1", `file://${full}`, shallow], {
    stdio: ["ignore", "pipe", "ignore"],
  });
});

afterAll(() => {
  for (const d of [full, shallow]) if (d) rmSync(d, { recursive: true, force: true });
});

describe("git provenance", () => {
  test("a full clone answers with the real commit", () => {
    // The control. Without it the suite is satisfiable by a function that
    // always says "unknown" — useless rather than safe.
    expect(git(full, ["rev-parse", "--is-shallow-repository"])).toBe("false");
    expect(gitFileCommitSha("early.txt", full)).toBe(firstSha);
  });

  test("a shallow clone declines rather than reporting the boundary", () => {
    expect(git(shallow, ["rev-parse", "--is-shallow-repository"])).toBe("true");

    // What raw git says here IS the boundary, and looks like an answer.
    const raw = git(shallow, ["log", "-n", "1", "--format=%H", "--", "early.txt"]);
    const boundary = new Set(git(shallow, ["rev-list", "--max-parents=0", "HEAD"]).split("\n"));
    expect(boundary.has(raw)).toBe(true);
    expect(raw).not.toBe(firstSha); // and it is the WRONG commit

    expect(gitFileCommitSha("early.txt", shallow)).toBe(GIT_SHA_UNKNOWN);
  });

  test("a file absent from the repository is unknown, not invented", () => {
    expect(gitFileCommitSha("no-such-file.txt", full)).toBe(GIT_SHA_UNKNOWN);
  });
});
