/**
 * A main publish whose commit a newer push replaced is SUPERSEDED, not failed:
 * the newer push publishes the site. A local
 * commit nobody pushed is still an error.
 *
 * @module scripts/tests/stage-local-superseded.test
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { notTipError, SupersededError } from "../stage-local.ts";

function repoWithTwoCommits(): { dir: string; first: string; second: string } {
  const dir = mkdtempSync(join(tmpdir(), "stage-superseded-"));
  const git = (...a: string[]) => execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.org", ...a], { encoding: "utf-8" }).trim();
  git("init", "-q");
  writeFileSync(join(dir, "a"), "1");
  git("add", "a");
  git("commit", "-q", "-m", "one");
  const first = git("rev-parse", "HEAD");
  writeFileSync(join(dir, "a"), "2");
  git("commit", "-q", "-am", "two");
  const second = git("rev-parse", "HEAD");
  return { dir, first, second };
}

describe("notTipError", () => {
  test("HEAD behind the tip is superseded", () => {
    const { dir, first, second } = repoWithTwoCommits();
    const e = notTipError(dir, first, second, "main");
    expect(e).toBeInstanceOf(SupersededError);
    expect(e.message).toContain("is not origin/main's tip");
  });

  test("HEAD ahead of the tip (a commit nobody pushed) stays an error", () => {
    const { dir, first, second } = repoWithTwoCommits();
    const e = notTipError(dir, second, first, "main");
    expect(e).not.toBeInstanceOf(SupersededError);
    expect(e.message).toContain("is not origin/main's tip");
  });
});
