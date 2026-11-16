/**
 * The published-site viewer groups a branch's tree by route, and never draws a
 * count it did not read (bean `folio-assistant-6gme`).
 *
 * Calibrated: counting every file as a page fails "only .html files are pages";
 * drawing the route table for a `could-not-read` section fails the three-state test.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { pageHtml, readSiteBranch, summariseTree, type SiteSection } from "../../gen-site-viz.ts";

const TREE = [".nojekyll", "index.html", "en/a/index.html", "en/a/x.css", "en/b/index.html", "assets/app.js", "STAGING/pr-1/index.html", "STAGING/pr-1/en/index.html", "STAGING/README.md"];

describe("summariseTree", () => {
  const s = summariseTree(TREE);
  it("groups by top-level route, staging previews by slug, and counts root files apart", () => {
    // a file directly under branches/ belongs to no preview, so it is counted as a route of its own
    expect(s.routes.map((r) => r.route)).toEqual(["assets", "en", "STAGING"]);
    expect(s.previews).toEqual([{ route: "STAGING/pr-1", pages: 2, files: 2, index: true }]);
    expect(s.rootFiles).toBe(2);
  });
  it("only .html files are pages", () => {
    expect(s.routes.find((r) => r.route === "en")).toEqual({ route: "en", pages: 2, files: 3, index: false });
    expect(s.routes.find((r) => r.route === "assets")).toEqual({ route: "assets", pages: 0, files: 1, index: false });
  });
});

const section = (read: SiteSection["read"]): SiteSection => ({ instance: "h", id: "site", branch: "gh-pages", remote: "r", read });

describe("three states, never zeros for could-not-read", () => {
  it("present: a row per route, linked back to the site root", () => {
    const html = pageHtml([section({ state: "present", tip: "a".repeat(40), ...summariseTree(TREE) })], "en/h/site");
    // `en/` holds no index.html of its own, so it is named, not linked; the preview is linked.
    expect(html).not.toContain('href="../../../en/"');
    expect(html).toContain("<code>en/</code>");
    expect(html).toContain('href="../../../STAGING/pr-1/"');
    expect(html).toContain("Staging previews");
  });
  it("empty says so", () => {
    const html = pageHtml([section({ state: "empty", reason: "the remote has no branch `gh-pages`" })], "en/h/site");
    expect(html).toContain("Empty:");
    expect(html).not.toContain("<table>");
  });
  it("could-not-read says so and draws no table", () => {
    const html = pageHtml([section({ state: "could-not-read", reason: "ls-remote failed" })], "en/h/site");
    expect(html).toContain("Could not read the branch");
    expect(html).not.toContain("<table>");
  });
});

describe("readSiteBranch against a local remote", () => {
  // input-site: tree #922e2944 — git in the test's own scratch repository, with the environment handed whole plus a fixed identity: git's answer, which the cone replays or records
  const git = (cwd: string, ...a: string[]) => spawnSync("git", a, { cwd, encoding: "utf-8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  it("reads present, absent and unreachable as present, empty and could-not-read", () => {
    const d = mkdtempSync(join(tmpdir(), "site-viz-"));
    // input-site: inert #3014726d — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const saved = { remote: process.env.BRANCH_STORE_REMOTE, dir: process.env.BRANCH_STORE_DIR };
    try {
      const work = join(d, "work");
      const bare = join(d, "remote.git");
      git(d, "init", "-q", "--bare", bare);
      git(d, "init", "-q", work);
      git(work, "checkout", "-q", "--orphan", "gh-pages");
      mkdirSync(join(work, "en"));
      writeFileSync(join(work, "en", "index.html"), "x");
      git(work, "add", "-A");
      git(work, "commit", "-q", "-m", "p");
      git(work, "push", "-q", bare, "gh-pages");
      process.env.BRANCH_STORE_REMOTE = bare;
      process.env.BRANCH_STORE_DIR = join(d, "store.git");
      const ok = readSiteBranch(work, "gh-pages").read;
      expect(ok.state).toBe("present");
      if (ok.state === "present") expect(ok.routes).toEqual([{ route: "en", pages: 1, files: 1, index: true }]);
      expect(readSiteBranch(work, "no-such-branch").read.state).toBe("empty");
      process.env.BRANCH_STORE_REMOTE = join(d, "missing.git");
      expect(readSiteBranch(work, "gh-pages").read.state).toBe("could-not-read");
    } finally {
      for (const [k, v] of [["BRANCH_STORE_REMOTE", saved.remote], ["BRANCH_STORE_DIR", saved.dir]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      rmSync(d, { recursive: true, force: true });
    }
  });
});
