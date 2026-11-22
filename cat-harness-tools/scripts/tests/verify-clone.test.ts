/**
 * `sub-kg:verify-clone`: the three verdicts, against local repositories.
 *
 * Each fixture is a real git repository in a temp directory, cloned by path,
 * so the test needs no network. The case worth guarding is the third verdict:
 * an empty tree, a failed clone, or a repository with nothing to judge it by
 * must come back `unknown` and never `green`.
 *
 * @module cat-harness-tools/scripts/tests/verify-clone.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cloneSource, verdictOf, verifyClone } from "../verify-clone.ts";

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): void {
  const r = spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args], { cwd, stdio: "pipe" });
  if (r.status !== 0) throw new Error(r.stderr.toString());
}

/** A local repository holding `files`, committed. */
function repo(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "verify-clone-src-"));
  temps.push(d);
  git(d, "init", "-q", "-b", "main");
  for (const [p, c] of Object.entries(files)) writeFileSync(join(d, p), c);
  if (Object.keys(files).length > 0) {
    git(d, "add", "-A");
    git(d, "commit", "-q", "-m", "fixture");
  } else {
    git(d, "commit", "-q", "--allow-empty", "-m", "empty");
  }
  return d;
}

describe("verify-clone", () => {
  test("green when every gate passes", () => {
    const r = verifyClone({ repo: repo({ "README.md": "x\n" }), gates: ["test -f README.md"] });
    expect(r.verdict).toBe("green");
    expect(r.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(existsSync(r.work)).toBe(false); // scratch removed
  });

  test("red when a gate fails", () => {
    const r = verifyClone({ repo: repo({ "README.md": "x\n" }), gates: ["test -f missing.txt"] });
    expect(r.verdict).toBe("red");
  });

  test("unknown, never green: no gate to judge by", () => {
    const r = verifyClone({ repo: repo({ "README.md": "x\n" }) });
    expect(r.verdict).toBe("unknown");
  });

  test("unknown, never green: an empty tree", () => {
    const r = verifyClone({ repo: repo({}), gates: ["true"] });
    expect(r.verdict).toBe("unknown");
  });

  test("unknown, never green: the clone fails", () => {
    const r = verifyClone({ repo: join(tmpdir(), "no-such-repo-verify-clone"), gates: ["true"] });
    expect(r.verdict).toBe("unknown");
    expect(r.steps[0]!.status).toBe("could-not-run");
  });

  test("a work directory given is kept", () => {
    const work = mkdtempSync(join(tmpdir(), "verify-clone-work-"));
    temps.push(work);
    const r = verifyClone({ repo: repo({ "a.txt": "a" }), gates: ["true"], work });
    expect(r.verdict).toBe("green");
    expect(existsSync(work)).toBe(true);
  });

  test("owner/name becomes a GitHub URL; the verdict needs at least one step", () => {
    expect(cloneSource("owner/name-not-a-path")).toBe("https://github.com/owner/name-not-a-path.git");
    expect(verdictOf([])).toBe("unknown");
  });
});
