/**
 * stage-local: the parts that decide what is built and where it goes. The
 * build and the push are the workflow's own scripts, tested where they live.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { agentRunLine, agentRunOf, ARTIFACT_MAX_FILES, artifactBundle, builtSomething, inPlatform, ownerRepoOf, platformAssetRefs, previewBase, readStagingInputs, slugOf } from "../stage-local.ts";

describe("stage-local", () => {
  test("reads the staging workflow's inputs from the folio's own file, with the workflow's defaults", () => {
    const yaml = `jobs:
  staging:
    uses: litlfred/folio-assistant/.github/workflows/folio-staging.yml@main
    with:
      build_command: 'bun run folio-assistant/a.ts --out _site && bun run folio-assistant/b.ts --out _site'
      site_dir: _site
      folio_dir: folio
      platform_dir: folio-assistant
`;
    expect(readStagingInputs(yaml)).toEqual({
      build_command: "bun run folio-assistant/a.ts --out _site && bun run folio-assistant/b.ts --out _site",
      site_dir: "_site",
      folio_dir: "folio",
      platform_dir: "folio-assistant",
      publish_branch: "gh-pages",
    });
    expect(readStagingInputs("with:\n  site_dir: _site\n")).toBeUndefined();
    expect(readStagingInputs("with:\n  build_command: 'it''s'\n")?.build_command).toBe("it's");
  });

  test("the slug follows the workflow's rule and refuses one that names no single path segment", () => {
    expect(slugOf("claude/exciting-ptolemy-se2d2a")).toBe("claude-exciting-ptolemy-se2d2a");
    expect(slugOf("feat//a b")).toBe("feat-a-b");
    expect(slugOf("..")).toBeUndefined();
    expect(slugOf("/")).toBeUndefined();
    expect(slugOf("")).toBeUndefined();
  });

  test("a build that wrote only data files is no site (bean oisv)", () => {
    const d = mkdtempSync(join(tmpdir(), "stage-local-"));
    expect(builtSomething(join(d, "missing"))).toBe(false);
    writeFileSync(join(d, "changeset.json"), "{}");
    mkdirSync(join(d, "visual"));
    expect(builtSomething(d)).toBe(false);
    writeFileSync(join(d, "index.html"), "<p>");
    expect(builtSomething(d)).toBe(true);
  });

  test("owner/repo from a GitHub remote, including a proxied one", () => {
    expect(ownerRepoOf("https://github.com/litlfred/smart-ra.git")).toBe("litlfred/smart-ra");
    expect(ownerRepoOf("git@github.com:litlfred/smart-ra")).toBe("litlfred/smart-ra");
    expect(ownerRepoOf("https://github.com/o/my.site.git")).toBe("o/my.site");
    expect(ownerRepoOf("http://local_proxy@127.0.0.1:1234/git/litlfred/smart-ra")).toBeUndefined();
  });

  test("a content layer's tool is found in whichever platform instance carries it, never named", () => {
    const p = mkdtempSync(join(tmpdir(), "stage-local-platform-"));
    mkdirSync(join(p, "a-harness", "scripts"), { recursive: true });
    mkdirSync(join(p, "b-content", "schemas"), { recursive: true });
    writeFileSync(join(p, "b-content", "schemas", "changeset.ts"), "");
    // declared-path-literal: test input — a fixed path the test passes in, not one read from a declaration
    expect(inPlatform(p, "schemas/changeset.ts")).toBe(join(p, "b-content", "schemas", "changeset.ts"));
    expect(inPlatform(p, "scripts/nothing.ts")).toBeUndefined();
    expect(inPlatform(join(p, "missing"), "x")).toBeUndefined();
  });

  test("an Artifact bundle keeps the whole site when it fits, and otherwise drops the busiest top-level directories first", () => {
    const small = new Map([["index.html", 10], ["doc/index.html", 20], ["doc/media/a.png", 30]]);
    expect(artifactBundle(small)).toEqual({ page: "index.html", files: ["doc/index.html", "doc/media/a.png"], bytes: 60, dropped: [] });

    const big = new Map<string, number>([["index.html", 1], ["doc/index.html", 1], ["lib/x/index.html", 1]]);
    for (let i = 0; i < 3000; i++) big.set(`en/kind-${i}.html`, 1);
    const b = artifactBundle(big);
    expect(b.dropped).toEqual([{ dir: "en", files: 3000, bytes: 3000 }]);
    expect(b.files).toEqual(["doc/index.html", "lib/x/index.html"]);
    expect(b.files.length).toBeLessThanOrEqual(ARTIFACT_MAX_FILES);

    expect(() => artifactBundle(new Map([["doc/index.html", 1]]))).toThrow(/no index.html/);
  });

  test("the platform assets a page loads from the platform's published site are found, and its page links are not", () => {
    const page = `<script type="application/json" id="fa-rail" data-fa-root="https://o.github.io/p" data-fa-to-root=".."></script>
<link rel="stylesheet" href="https://o.github.io/p/assets/css/navbar.css"><script src="https://o.github.io/p/assets/js/navbar.js" defer></script>
<a href="https://o.github.io/p/tools/">Tools</a><script src="https://cdn.example/x.js"></script>`;
    expect(platformAssetRefs(new Map([["index.html", page]]))).toEqual({ roots: ["https://o.github.io/p"], assets: ["css/navbar.css", "js/navbar.js"] });
    expect(platformAssetRefs(new Map([["a.html", "<p>no rail</p>"]]))).toEqual({ roots: [], assets: [] });
  });
});

describe("stage-local: agent-run is what the repository declares (owner, 2026-10-14, Q7)", () => {
  const repoWith = (index?: unknown): string => {
    const d = mkdtempSync(join(tmpdir(), "stage-local-agentrun-"));
    if (index !== undefined) writeFileSync(join(d, "index.config.json"), typeof index === "string" ? index : JSON.stringify(index));
    return d;
  };
  const idx = (site?: object) => ({ $schema: "folio-index-config/v1", instances: [{ name: "a" }], ...(site ? { site } : {}) });

  test("declared: site.agentRun true in the repository's own index.config.json", () => {
    const a = agentRunOf(repoWith(idx({ agentRun: true })));
    expect(a.agentRun).toBe(true);
    expect(agentRunLine(a)).toContain("yes, declared in index.config.json");
    expect(agentRunLine(a)).toContain("never dispatch");
  });

  test("not declared: no index, no flag, or false, each said as what it is", () => {
    expect(agentRunOf(repoWith())).toMatchObject({ agentRun: false, why: "absent" });
    expect(agentRunOf(repoWith(idx()))).toMatchObject({ agentRun: false, why: "not-declared" });
    expect(agentRunOf(repoWith(idx({ agentRun: false })))).toMatchObject({ agentRun: false, why: "declared-false" });
    expect(agentRunLine(agentRunOf(repoWith()))).toContain("no index.config.json");
  });

  test("an index that cannot be read is UNKNOWN, never 'not agent-run'", () => {
    const a = agentRunOf(repoWith("{ not json"));
    expect(a.agentRun).toBe("unreadable");
    expect(agentRunLine(a)).toContain("unknown");
  });
});

describe("previewBase", () => {
  test("a PR stacked on another branch is reviewed against that branch, not main", () => {
    expect(previewBase({ prBase: "claude/dth-pc-scaffold", defaultBranch: "main" })).toBe("claude/dth-pc-scaffold");
  });
  test("--base wins over the PR's base", () => {
    expect(previewBase({ base: "release", prBase: "claude/x", defaultBranch: "main" })).toBe("release");
  });
  test("no PR: the default branch, then main", () => {
    expect(previewBase({ defaultBranch: "trunk" })).toBe("trunk");
    expect(previewBase({ prBase: "" })).toBe("main");
  });
});
