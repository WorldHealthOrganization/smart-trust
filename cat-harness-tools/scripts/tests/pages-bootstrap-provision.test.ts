/**
 * `pages-bootstrap` and the `gh-pages` branch — issue #2417, SC-1 and SC-2.
 *
 * Owner, 2026-10-01: *"need to create gh-pages branch before can turn on"*;
 * 2026-10-07: *"need to create gh-pages before can deploy"*. The script checks
 * the branch BEFORE anything else, reports its absence as a fourth state,
 * `unprovisioned`, and creates it only when `--provision` is passed.
 *
 * The remote is a local bare repository, so every fact is set here and no test
 * reaches the network. The derived Pages URL is therefore absent (a filesystem
 * path is not a GitHub remote) — which is the point of SC-1's second half: with
 * the branch present the outcome is NOT `unprovisioned`, whatever else it is.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  BRANCH_SOURCE,
  ACTIONS_SOURCE,
  ghPagesBranchState,
  pagesBootstrap,
  pagesSourceFor,
  provisionGhPages,
} from "../pages-bootstrap.js";
import { gitFixtureRepo, type GitFixture } from "../../test/support/git-fixture.js";

const SCRIPT = resolve(import.meta.dir, "..", "pages-bootstrap.ts");

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

/** A work tree whose `origin` is a fresh bare repository with no `gh-pages`. */
function withBareRemote(files?: Record<string, string>): { fx: GitFixture; bare: string } {
  const bare = mkdtempSync(join(tmpdir(), "pages-remote-"));
  execFileSync("git", ["init", "-q", "--bare", bare]);
  const fx = gitFixtureRepo({ remote: bare, files });
  fx.git("push", "-q", "origin", "main");
  cleanups.push(() => {
    fx.cleanup();
    rmSync(bare, { recursive: true, force: true });
  });
  return { fx, bare };
}

const bareGit = (bare: string, ...args: string[]) =>
  execFileSync("git", ["-C", bare, ...args], { encoding: "utf-8" }).trim();

function runCli(root: string, ...args: string[]) {
  const r = spawnSync(process.execPath, ["run", SCRIPT, root, ...args], {
    encoding: "utf-8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return { status: r.status, out: r.stdout + r.stderr };
}

describe("SC-1 — no gh-pages is `unprovisioned`, and exits non-zero", () => {
  test("a remote with no gh-pages reports unprovisioned, the exact command, and exits 3", () => {
    const { fx } = withBareRemote();
    const r = runCli(fx.root);
    expect(r.status).toBe(3);
    expect(r.out).toContain("UNPROVISIONED");
    expect(r.out).toContain("pages-bootstrap.ts --provision");
    expect(r.out).toContain("git push origin gh-pages");
    expect(r.out).toContain(`Pages source expected: ${BRANCH_SOURCE}`);
  });

  test("without --provision nothing is pushed", () => {
    const { fx, bare } = withBareRemote();
    runCli(fx.root);
    expect(spawnSync("git", ["-C", bare, "rev-parse", "--verify", "-q", "refs/heads/gh-pages"]).status).not.toBe(0);
  });

  test("a remote that has gh-pages does not report unprovisioned", async () => {
    const { fx } = withBareRemote();
    expect(provisionGhPages(fx.root).state).toBe("created");
    const report = await pagesBootstrap({ root: fx.root });
    expect(report.ghPagesBranch).toBe("present");
    expect(report.outcome).not.toBe("unprovisioned");
    const r = runCli(fx.root);
    expect(r.out).not.toContain("UNPROVISIONED");
    expect(r.status).not.toBe(3);
  });

  test("a remote ls-remote cannot reach is `unknown`, never `absent`", () => {
    const fx = gitFixtureRepo({ remote: join(tmpdir(), "no-such-remote-for-pages-bootstrap") });
    cleanups.push(fx.cleanup);
    expect(ghPagesBranchState(fx.root).state).toBe("unknown");
  });
});

describe("SC-2 — --provision creates an orphan gh-pages, idempotently", () => {
  test("exactly index.html and .nojekyll, no parent, working tree untouched", () => {
    const { fx, bare } = withBareRemote();
    const headBefore = fx.git("rev-parse", "HEAD");

    const r = runCli(fx.root, "--provision");
    expect(r.out).toContain("Provision gh-pages: CREATED");
    expect(r.out).not.toContain("UNPROVISIONED");

    expect(bareGit(bare, "ls-tree", "--name-only", "gh-pages").split("\n").sort()).toEqual([".nojekyll", "index.html"]);
    expect(bareGit(bare, "rev-list", "--count", "gh-pages")).toBe("1");
    expect(bareGit(bare, "rev-list", "--parents", "-n1", "gh-pages").split(" ")).toHaveLength(1);

    // Plumbing only: the author's branch, HEAD and work tree are as they were.
    expect(fx.git("rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
    expect(fx.git("rev-parse", "HEAD")).toBe(headBefore);
    expect(fx.git("status", "--porcelain")).toBe("");
  });

  test("run twice, the second run changes nothing", () => {
    const { fx, bare } = withBareRemote();
    const first = provisionGhPages(fx.root);
    expect(first.state).toBe("created");
    const sha = bareGit(bare, "rev-parse", "gh-pages");
    expect(sha).toBe(first.sha!);

    const second = provisionGhPages(fx.root);
    expect(second.state).toBe("already-present");
    expect(bareGit(bare, "rev-parse", "gh-pages")).toBe(sha);

    const r = runCli(fx.root, "--provision");
    expect(r.out).toContain("ALREADY-PRESENT");
    expect(bareGit(bare, "rev-parse", "gh-pages")).toBe(sha);
  });
});

describe("FR-2 — the Pages source it expects", () => {
  test("a workflow that pushes gh-pages needs the branch source, never Actions", () => {
    const fx = gitFixtureRepo({
      files: {
        ".github/workflows/pages.yml":
          "on: push\njobs:\n  d:\n    steps:\n      - uses: actions/upload-pages-artifact@v3\n      - run: git push origin HEAD:gh-pages\n",
      },
    });
    cleanups.push(fx.cleanup);
    expect(pagesSourceFor(fx.root)).toBe("branch");
  });

  test("only an artifact-only deploy expects GitHub Actions, and then no branch is required", async () => {
    const fx = gitFixtureRepo({
      remote: null,
      files: {
        ".github/workflows/pages.yml": "on: push\njobs:\n  d:\n    steps:\n      - uses: actions/deploy-pages@v4\n",
      },
    });
    cleanups.push(fx.cleanup);
    expect(pagesSourceFor(fx.root)).toBe("actions");
    const report = await pagesBootstrap({ root: fx.root });
    expect(report.expectedSource).toBe(ACTIONS_SOURCE);
    expect(report.ghPagesBranch).toBe("not-required");
  });
});
