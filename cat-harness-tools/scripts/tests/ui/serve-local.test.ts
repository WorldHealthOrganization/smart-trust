/**
 * serve-local (#1179): fetch a repo's gh-pages into a sparse cache, leaving
 * branches/ out unless a preview is named, and update it on the next run.
 *
 * The "remote" is a local git repository, so the test needs no network.
 *
 * @module scripts/tests/ui/serve-local.test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultCacheDir, fetchSite, pagesBelow, pagesOwner, parseRepos, remoteUrl, sparsePatterns } from "../../serve-local.js";

let remote: string;
let cache: string;

function git(cwd: string, ...args: string[]): void {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

function put(root: string, rel: string, body: string): void {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), body);
}

beforeAll(() => {
  remote = mkdtempSync(join(tmpdir(), "serve-local-remote-"));
  cache = mkdtempSync(join(tmpdir(), "serve-local-cache-"));
  git(remote, "init", "--quiet", "-b", "gh-pages");
  put(remote, "index.html", "v1");
  put(remote, "STAGING/claude-a/index.html", "preview a");
  put(remote, "STAGING/claude-b/index.html", "preview b");
  git(remote, "add", "-A");
  git(remote, "commit", "--quiet", "-m", "v1");
  // Partial clone from a local path needs the server side to allow filters.
  git(remote, "config", "uploadpack.allowFilter", "true");
});

afterAll(() => {
  rmSync(remote, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
});

describe("fetching a site", () => {
  test("the first fetch checks out the site without STAGING", () => {
    const dir = fetchSite({ url: `file://${remote}`, dir: join(cache, "site") });
    expect(readFileSync(join(dir, "index.html"), "utf-8")).toBe("v1");
    expect(existsSync(join(dir, "STAGING"))).toBe(false);
  });

  test("a named preview is added, the others stay out", () => {
    const dir = fetchSite({ url: `file://${remote}`, dir: join(cache, "site"), staging: ["claude-a"] });
    expect(readFileSync(join(dir, "STAGING", "claude-a", "index.html"), "utf-8")).toBe("preview a");
    expect(existsSync(join(dir, "STAGING", "claude-b"))).toBe(false);
  });

  test("the next run picks up a new publish", () => {
    put(remote, "index.html", "v2");
    git(remote, "commit", "--quiet", "-am", "v2");
    const dir = fetchSite({ url: `file://${remote}`, dir: join(cache, "site") });
    expect(readFileSync(join(dir, "index.html"), "utf-8")).toBe("v2");
  });
});

describe("inputs", () => {
  test("a served folder with no index.html points at the subfolders that have one", () => {
    const dir = mkdtempSync(join(tmpdir(), "serve-local-pages-"));
    for (const d of ["site", "docs", "scripts", ".git"]) mkdirSync(join(dir, d));
    for (const d of ["site", "docs", ".git"]) writeFileSync(join(dir, d, "index.html"), "<p>x</p>");
    expect(pagesBelow(dir)).toEqual(["docs", "site"]);
    writeFileSync(join(dir, "index.html"), "<p>root</p>");
    expect(pagesBelow(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  test("the owner comes from <owner>.github.io", () => {
    expect(pagesOwner("https://litlfred.github.io")).toBe("litlfred");
    expect(pagesOwner("https://example.org")).toBeUndefined();
    expect(pagesOwner(undefined)).toBeUndefined();
  });

  test("the remote template fills owner and repo", () => {
    expect(remoteUrl("https://github.com/{owner}/{repo}.git", "litlfred", "dth-pc")).toBe("https://github.com/litlfred/dth-pc.git");
  });

  test("repo names are single segments", () => {
    expect(parseRepos(" folio-assistant, dth-pc ,")).toEqual(["folio-assistant", "dth-pc"]);
    expect(() => parseRepos("a/../b")).toThrow();
  });

  test("STAGING is excluded and named previews added back", () => {
    expect(sparsePatterns(["claude-x"])).toEqual(["/*", "!/branches/", "!/STAGING/", "/branches/claude-x/", "/STAGING/claude-x/"]);
    expect(() => sparsePatterns(["../x"])).toThrow();
  });

  test("the cache follows XDG_CACHE_HOME", () => {
    expect(defaultCacheDir({ XDG_CACHE_HOME: "/c" })).toBe("/c/cat-harness/serve-local");
  });
});
