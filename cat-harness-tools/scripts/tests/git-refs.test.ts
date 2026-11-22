/**
 * The publish targets have ONE reader, and the README config builds on it.
 *
 * @module scripts/tests/git-refs
 *
 * Bean `cp3l`. `publishTargets` was extracted so a harness-level link check
 * could resolve a Pages URL without importing core. The risk that creates is
 * the obvious one: two readers of the same `readme` block, free to disagree,
 * and a disagreement here is silent — a harness check would resolve
 * `github.io` links against one ref while the README audit used another, and
 * both would report a clean run.
 *
 * So the agreement is asserted rather than described. `loadReadmeConfig`
 * spreads `publishTargets` and the same file's own block, in that order.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { TRACE_ENV, openTrace } from "../../schemas/sdlc/input-trace.ts";
import { DEFAULT_PUBLISH_REF, detectRepoUrl, ownerRepo, publishTargets, publishedPaths, withoutCredentials } from "../../src/core/git-refs.js";
import { loadReadmeConfig } from "../../pipeline/readme-toc.js";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { writeInstanceConfig } from "../../test/support/instance-fixture.js";
import { gitFixtureRepo } from "../../test/support/git-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const REPO = repoRootFor(resolve(HARNESS_ROOT));

const withConfig = (readme: Record<string, unknown>): string => {
  const root = mkdtempSync(join(tmpdir(), "targets-"));
  writeInstanceConfig(root, JSON.stringify({ readme }));
  return root;
};

describe("one reader, so the two cannot drift", () => {
  test("the three publish targets agree between the two entry points", () => {
    const root = withConfig({ publishRef: "site", pagesBaseUrl: "https://x.example/y" });
    const t = publishTargets(root);
    const cfg = loadReadmeConfig(root);
    expect([cfg.publishRef, cfg.pagesBaseUrl, cfg.repoUrl]).toEqual([
      t.publishRef,
      t.pagesBaseUrl,
      t.repoUrl,
    ]);
  });

  test("...and on THIS repository, where the config is real", () => {
    const t = publishTargets(REPO);
    const cfg = loadReadmeConfig(REPO);
    expect([cfg.publishRef, cfg.pagesBaseUrl]).toEqual([t.publishRef, t.pagesBaseUrl]);
  });

  test("the README-shaped fields are still the README's own", () => {
    // The layering must not have flattened them away: `publishTargets` knows
    // nothing about link style, markers or PDF path patterns.
    const cfg = loadReadmeConfig(withConfig({ linkStyle: "pages", marker: "custom" }));
    expect([cfg.linkStyle, cfg.marker]).toEqual(["pages", "custom"]);
    expect(cfg.pdfPathPatterns.length).toBeGreaterThan(0);
  });

  test("an absent config still yields a usable publish ref", () => {
    expect(publishTargets(mkdtempSync(join(tmpdir(), "bare-"))).publishRef).toBe(DEFAULT_PUBLISH_REF);
  });

  test("a config that will not parse falls back rather than throwing", () => {
    const root = mkdtempSync(join(tmpdir(), "bad-"));
    writeInstanceConfig(root, "{ not json");
    expect(publishTargets(root).publishRef).toBe(DEFAULT_PUBLISH_REF);
  });
});

describe("the git facts", () => {
  test("`ownerRepo` takes the last two segments, trailing slash or not", () => {
    expect(ownerRepo("https://github.com/litlfred/folio-assistant")).toBe("litlfred/folio-assistant");
    expect(ownerRepo("https://github.com/litlfred/folio-assistant/")).toBe("litlfred/folio-assistant");
  });

  test("an UNREADABLE ref is `undefined`, not an empty set", () => {
    // The distinction the module header turns on: a shallow clone that never
    // fetched the publish ref must not read as "published nothing", or every
    // link into it comes back dead.
    const root = mkdtempSync(join(tmpdir(), "noref-"));
    mkdirSync(join(root, "sub"));
    expect(publishedPaths(root, "definitely-not-a-ref")).toBeUndefined();
  });

  test("a ref the repository CAN read comes back as a set of paths", () => {
    // Over a throwaway repository whose one commit holds `AGENTS.md`, not over
    // this checkout: standing alone, cat-harness's parent is not a repository,
    // and reading a ref is logic over whatever repository it is handed.
    const fx = gitFixtureRepo({ files: { "AGENTS.md": "# fixture\n" } });
    try {
      const paths = publishedPaths(fx.root, "HEAD");
      expect(paths).toBeDefined();
      expect(paths!.has("AGENTS.md")).toBe(true);
    } finally {
      fx.cleanup();
    }
  });
});

describe("withoutCredentials — no token reaches a page (smart-ra, 2026-10-14)", () => {
  test("strips an insteadOf token, and leaves clean URLs byte-identical", () => {
    expect(withoutCredentials("https://x-access-token:ghs_abc@github.com/litlfred/smart-ra")).toBe("https://github.com/litlfred/smart-ra");
    expect(withoutCredentials("https://user@github.com/o/r.git")).toBe("https://github.com/o/r.git");
    expect(withoutCredentials("https://github.com/o/r")).toBe("https://github.com/o/r");
    expect(withoutCredentials("git@github.com:o/r.git")).toBe("git@github.com:o/r.git");
  });

  test("detectRepoUrl never returns the token git's insteadOf puts in the remote", () => {
    const repo = mkdtempSync(join(tmpdir(), "creds-"));
    try {
      const run = (...a: string[]) => execFileSync("git", ["-C", repo, ...a], { stdio: "pipe" });
      run("init", "-q");
      run("remote", "add", "origin", "https://github.com/o/r.git");
      run("config", "url.https://x-access-token:SECRET@github.com/.insteadOf", "https://github.com/");
      expect(detectRepoUrl(repo)).toBe("https://github.com/o/r");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("detectRepoUrl is a replayable tree read, not a traced input site", () => {
    const fx = gitFixtureRepo({ files: { "AGENTS.md": "# fixture\n" } });
    const prev = process.env[TRACE_ENV];
    try {
      const trace1 = openTrace(fx.root);
      process.env[TRACE_ENV] = trace1.env[TRACE_ENV];
      expect(detectRepoUrl(fx.root)).toBeDefined();
      expect(trace1.reached()).toBeUndefined();
      const trace2 = openTrace(fx.root);
      process.env[TRACE_ENV] = trace2.env[TRACE_ENV];
      expect(publishedPaths(fx.root, "HEAD")?.has("AGENTS.md")).toBe(true);
      expect(trace2.reached()).toBe("git-refs: git");
    } finally {
      if (prev === undefined) delete process.env[TRACE_ENV];
      else process.env[TRACE_ENV] = prev;
      fx.cleanup();
    }
  });
});
