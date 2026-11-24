import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, cpSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

/**
 * `git fetch origin <branch>` writes FETCH_HEAD and refreshes
 * `refs/remotes/origin/<branch>` only *opportunistically* — when the clone's
 * configured `remote.origin.fetch` covers that branch. When it doesn't, the
 * fetch still exits 0 and every later comparison against `origin/<branch>`
 * answers from a ref that has not moved.
 *
 * That is not hypothetical. The `qou` clone in the container this was found in
 * had its refspec narrowed to a single sibling branch, so the sweep reported
 * "origin/main ahead by: 0" while main was six days and 1374 commits ahead.
 *
 * These tests run the REAL sweep script against a local fixture remote, so what
 * is pinned is the number it prints — not the presence of a refspec string in
 * the source, which a later rewrite could satisfy while still being wrong.
 */

const SWEEP = resolve(import.meta.dir, "..", "session-start-coord-sweep.sh");

let root = "";
let upstream = "";

/** Narrow the refspec exactly as the qou clone had it: one branch, by name. */
const NARROW = "+refs/heads/some-sibling:refs/remotes/origin/some-sibling";
const WIDE = "+refs/heads/*:refs/remotes/origin/*";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

/**
 * A clone of the fixture upstream with `refspec` configured and the sweep
 * script installed at the path the script expects to find itself at (it
 * resolves its repo root as `dirname($BASH_SOURCE)/..`, so the copy — not the
 * cwd — is what selects the repo it reports on).
 */
function makeClone(name: string, refspec: string): string {
  const dir = join(root, name);
  git(root, "clone", "--quiet", upstream, dir);
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "config", "--replace-all", "remote.origin.fetch", refspec);
  mkdirSync(join(dir, "scripts"), { recursive: true });
  cpSync(SWEEP, join(dir, "scripts", "session-start-coord-sweep.sh"));
  return dir;
}

function runSweep(dir: string): string {
  const r = spawnSync("bash", [join(dir, "scripts", "session-start-coord-sweep.sh")], {
    cwd: dir,
    encoding: "utf-8",
    timeout: 60_000,
  });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`;
}

/** The "ahead by: N" the sweep reports, or null if it never printed one. */
function aheadBy(out: string): number | null {
  const m = out.match(/ahead by:\*\*\s+(\d+)\s+commit/);
  return m ? Number(m[1]) : null;
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "fetch-tracking-ref-"));
  upstream = join(root, "upstream.git");

  git(root, "init", "--quiet", "--bare", "-b", "main", upstream);

  const seed = join(root, "seed");
  git(root, "clone", "--quiet", upstream, seed);
  git(seed, "config", "user.email", "t@example.com");
  git(seed, "config", "user.name", "T");
  execFileSync("bash", ["-c", "echo one > f"], { cwd: seed });
  git(seed, "add", "f");
  git(seed, "commit", "--quiet", "-m", "c1");
  git(seed, "push", "--quiet", "-u", "origin", "main");
  // A sibling agent branch, so §3 has something real to find.
  git(seed, "push", "--quiet", "origin", "main:refs/heads/claude/sibling-work");
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

/** Advance upstream main by `n` commits after the clones were taken. */
function advanceUpstream(n: number): void {
  const seed = join(root, "seed");
  for (let i = 0; i < n; i++) {
    execFileSync("bash", ["-c", `echo ${i} > f`], { cwd: seed });
    git(seed, "commit", "--quiet", "-am", `advance-${i}`);
  }
  git(seed, "push", "--quiet", "origin", "main");
}

describe("session-start sweep: origin/<default> must be refreshed, not assumed", () => {
  test("reports the true distance when the clone's refspec is narrowed", () => {
    const clone = makeClone("narrow", NARROW);
    advanceUpstream(3);

    const out = runSweep(clone);

    // The regression: a bare `git fetch origin main` leaves origin/main at the
    // clone point here, and the sweep reported 0 — indistinguishable from a
    // branch that is genuinely current.
    expect(aheadBy(out)).toBe(3);
  });

  test("reports the true distance under a normal refspec too", () => {
    // Each clone is taken at the current upstream tip, so the distance is
    // exactly what this test pushes afterwards — not a running total.
    const clone = makeClone("wide", WIDE);
    advanceUpstream(2);

    const out = runSweep(clone);

    expect(aheadBy(out)).toBe(2);
  });

  test("a narrowed refspec is named as blind, not reported as no siblings", () => {
    // §3 reads refs/remotes/origin/claude/* directly, so no per-branch fetch
    // repairs it. An empty list and an unfetched tree look identical, and the
    // sweep's job is to say which one it is.
    const out = runSweep(makeClone("narrow-siblings", NARROW));

    expect(out).toContain("Sibling branches: not visible from this clone");
    expect(out).toContain("remote.origin.fetch");
  });

  test("with a normal refspec the sibling branch is listed and no warning fires", () => {
    const out = runSweep(makeClone("wide-siblings", WIDE));

    expect(out).toContain("claude/sibling-work");
    expect(out).not.toContain("not visible from this clone");
  });
});
