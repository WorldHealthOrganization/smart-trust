import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { publishSite, sparsePatterns } from "./publish-site.ts";

const g = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf-8" }).trim();

/** A bare remote whose `gh-pages` holds one stale file. */
function remote(): string {
  const d = mkdtempSync(join(tmpdir(), "pubsite-"));
  g(d, "init", "-q", "--bare", "remote.git");
  const seed = join(d, "seed");
  g(d, "init", "-q", "-b", "gh-pages", "seed");
  writeFileSync(join(seed, "stale.html"), "old\n");
  g(seed, "add", "-A");
  g(seed, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "seed");
  g(seed, "push", "-q", join(d, "remote.git"), "gh-pages");
  return join(d, "remote.git");
}

function staged(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "pubsite-site-"));
  for (const [p, t] of Object.entries(files)) { mkdirSync(join(d, p, ".."), { recursive: true }); writeFileSync(join(d, p), t); }
  return d;
}

function read(remoteUrl: string, path: string): string | undefined {
  const d = mkdtempSync(join(tmpdir(), "pubsite-read-"));
  g(d, "clone", "-q", "--branch", "gh-pages", remoteUrl, "r");
  return existsSync(join(d, "r", path)) ? readFileSync(join(d, "r", path), "utf-8") : undefined;
}

describe("publish-site — any runner, any git remote (bootstrap-tools#7)", () => {
  test("fullReplaceRemovesStale", () => {
    const r = remote();
    const res = publishSite({ site: staged({ "index.html": "new\n", "subgraph/v0/context.jsonld": "{}\n" }), remote: r, backoff: 0 });
    expect(res.state).toBe("published");
    expect(read(r, "index.html")).toBe("new\n");
    expect(read(r, "subgraph/v0/context.jsonld")).toBe("{}\n");
    expect(read(r, "stale.html")).toBeUndefined();
  });

  test("republishIsCurrent", () => {
    const r = remote();
    const site = staged({ "index.html": "same\n" });
    expect(publishSite({ site, remote: r, backoff: 0 }).state).toBe("published");
    expect(publishSite({ site, remote: r, backoff: 0 }).state).toBe("current");
  });

  test("refusesEmptySite", () => {
    const r = remote();
    expect(publishSite({ site: staged({}), remote: r, backoff: 0 }).state).toBe("failed");
    expect(publishSite({ site: "/nonexistent-site-dir", remote: r, backoff: 0 }).state).toBe("failed");
    expect(read(r, "stale.html")).toBe("old\n");
  });

  test("unreachableRemoteFails", () => {
    const res = publishSite({ site: staged({ "a.html": "x\n" }), remote: "/nonexistent/remote.git", attempts: 1, backoff: 0 });
    expect(res.state).toBe("failed");
  });

  test("intoReplacesSubtreeOnly", () => {
    const r = remote();
    expect(publishSite({ site: staged({ "index.html": "a\n" }), remote: r, into: "STAGING/a", backoff: 0 }).state).toBe("published");
    expect(publishSite({ site: staged({ "index.html": "b\n" }), remote: r, into: "STAGING/b", backoff: 0 }).state).toBe("published");
    expect(publishSite({ site: staged({ "fresh.html": "a2\n" }), remote: r, into: "STAGING/a", backoff: 0 }).state).toBe("published");
    expect(read(r, "stale.html")).toBe("old\n");
    expect(read(r, "STAGING/b/index.html")).toBe("b\n");
    expect(read(r, "STAGING/a/fresh.html")).toBe("a2\n");
    expect(read(r, "STAGING/a/index.html")).toBeUndefined();
  });

  test("keepPreservesTopLevelPaths", () => {
    const r = remote();
    publishSite({ site: staged({ "index.html": "p\n" }), remote: r, into: "STAGING/p", backoff: 0 });
    const res = publishSite({ site: staged({ "index.html": "root\n", "STAGING/p/index.html": "clobber\n" }), remote: r, keep: ["STAGING"], backoff: 0 });
    expect(res.state).toBe("published");
    expect(read(r, "index.html")).toBe("root\n");
    expect(read(r, "stale.html")).toBeUndefined();
    expect(read(r, "STAGING/p/index.html")).toBe("p\n");
  });

  test("refusesBadIntoOrKeep", () => {
    const r = remote();
    const site = staged({ "a.html": "x\n" });
    for (const into of ["../x", "/abs", ".", "a/../../b", ".git"]) expect(publishSite({ site, remote: r, into, backoff: 0 }).state).toBe("failed");
    expect(publishSite({ site, remote: r, keep: ["a/b"], backoff: 0 }).state).toBe("failed");
    expect(publishSite({ site, remote: r, into: "S/x", keep: ["S"], backoff: 0 }).state).toBe("failed");
    expect(read(r, "stale.html")).toBe("old\n");
  });

  test("checksOutOnlyWrittenPaths", () => {
    expect(sparsePatterns({})).toBeUndefined();
    expect(sparsePatterns({ into: "STAGING/a/" })).toEqual(["/STAGING/a/"]);
    expect(sparsePatterns({ keep: ["STAGING", "branches"] })).toEqual(["/*", "!/STAGING/", "!/branches/"]);
  });
});
