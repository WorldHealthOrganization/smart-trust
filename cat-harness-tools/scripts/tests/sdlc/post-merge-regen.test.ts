/**
 * Tests for post-merge regeneration check and reviewable repair PR automation.
 *
 * Bean `folio-assistant-ey1c`.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildPrBody,
  builtAtPublishIn,
  checkPostMergeRegen,
  FIXITY_CHECKS,
  inTargetScope,
  JUDGED_AFTER_PUBLISH,
  missingPrerequisiteWriters,
  postMergePairs,
  publishTimeDeclarations,
  resolveRepoRoot,
  treeMoveTracker,
  type GhExecutor,
  type GitExecutor,
  type PublishTimeDeclaration,
} from "../../post-merge-regen.ts";
import type { Runner } from "../../regen-after-merge.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

// declared-path-literal: a mocked changed-file name — never read.
const CHANGED_FILE_VECTOR = "uploads/README.md";

const ROOT = join(HARNESS_ROOT);
const REPO = resolveRepoRoot(ROOT);

describe("post-merge-regen pipeline (bean folio-assistant-ey1c)", () => {
  describe("NEGATIVE CONTROL: clean main tree triggers 0 repairs", () => {
    test("when all verify/write pairs pass, report is clean with 0 repairs and no PR opened", async () => {
      // Mock runner: all checks pass (current)
      const mockRunner: Runner = () => true;

      let gitBranchCreated = false;
      let gitCommitted = false;
      let gitPushed = false;
      let prCreated = false;

      const mockGit: GitExecutor = {
        getCurrentSha: () => "5187a4df36100000000000000000000000000000",
        getChangedFiles: () => [],
        createBranch: () => {
          gitBranchCreated = true;
        },
        commitAll: () => {
          gitCommitted = true;
        },
        pushBranch: () => {
          gitPushed = true;
        },
      };

      const mockGh: GhExecutor = {
        findExistingPr: () => undefined,
        createPr: () => {
          prCreated = true;
          return { url: "https://github.com/litlfred/cat-harness/pull/9999", number: 9999 };
        },
      };

      const report = await checkPostMergeRegen({
        repoRoot: REPO,
        runner: mockRunner,
        git: mockGit,
        gh: mockGh,
        createPr: true,
      });

      expect(report.status).toBe("clean");
      expect(report.staleChecks).toEqual([]);
      expect(report.repairedChecks).toEqual([]);
      expect(report.unrepairedChecks).toEqual([]);
      expect(report.noWriterChecks).toEqual([]);
      expect(report.changedFiles).toEqual([]);
      expect(report.prOpened).toBe(false);
      expect(report.exitCode).toBe(0);
      expect(report.summary).toContain("Clean (negative control)");

      // Verify negative control: git and gh were never touched
      expect(gitBranchCreated).toBe(false);
      expect(gitCommitted).toBe(false);
      expect(gitPushed).toBe(false);
      expect(prCreated).toBe(false);
    });

    test("when writers run but leave no changed files, report is clean with no PR opened", async () => {
      // Check fails initially, then passes after writer runs, but git status shows no files changed
      let checkCallCount = 0;
      const mockRunner: Runner = (script: string) => {
        if (script === "readme:subgraphs:check") {
          checkCallCount++;
          return checkCallCount > 1; // fails in dryRun audit, passes in fixpoint
        }
        return true;
      };

      let prCreated = false;
      const mockGit: GitExecutor = {
        getCurrentSha: () => "5187a4df36100000000000000000000000000000",
        getChangedFiles: () => [], // 0 files changed
        createBranch: () => {},
        commitAll: () => {},
        pushBranch: () => {},
      };

      const mockGh: GhExecutor = {
        findExistingPr: () => undefined,
        createPr: () => {
          prCreated = true;
          return { url: "url", number: 1 };
        },
      };

      const report = await checkPostMergeRegen({
        repoRoot: REPO,
        runner: mockRunner,
        git: mockGit,
        gh: mockGh,
        createPr: true,
      });

      expect(report.status).toBe("clean");
      expect(report.prOpened).toBe(false);
      expect(report.exitCode).toBe(0);
      expect(report.summary).toContain("0 changed files");
      expect(prCreated).toBe(false);
    });
  });

  describe("POSITIVE DETECTION: stale derived artefact identifies exact repair diff and targets repair PR", () => {
    test("stale derived check triggers writer, detects changed file, and creates repair PR", async () => {
      let repaired = false;
      const mockRunner: Runner = (script: string) => {
        if (script === "readme:subgraphs:check") {
          return repaired;
        }
        if (script === "readme:subgraphs") {
          repaired = true;
          return true;
        }
        return true;
      };

      const gitCalls: string[] = [];
      const mockGit: GitExecutor = {
        getCurrentSha: () => "8688288494a11111111111111111111111111111",
        getChangedFiles: () => [CHANGED_FILE_VECTOR],
        createBranch: (branch: string) => {
          gitCalls.push(`createBranch:${branch}`);
        },
        commitAll: (msg: string) => {
          gitCalls.push(`commitAll:${msg}`);
        },
        pushBranch: (branch: string) => {
          gitCalls.push(`pushBranch:${branch}`);
        },
      };

      let prPayloadPassed: { title: string; body: string; head: string; base: string } | undefined;
      const mockGh: GhExecutor = {
        findExistingPr: () => undefined,
        createPr: (opts) => {
          prPayloadPassed = opts;
          return { url: "https://github.com/litlfred/cat-harness/pull/1946", number: 1946 };
        },
      };

      const report = await checkPostMergeRegen({
        repoRoot: REPO,
        runner: mockRunner,
        git: mockGit,
        gh: mockGh,
        createPr: true,
      });

      expect(report.status).toBe("repaired");
      expect(report.staleChecks).toContain("readme:subgraphs:check");
      expect(report.repairedChecks).toContain("readme:subgraphs:check");
      expect(report.unrepairedChecks).toEqual([]);
      expect(report.changedFiles).toEqual([CHANGED_FILE_VECTOR]);
      expect(report.repairBranch).toBe("automation/post-merge-regen-8688288494");
      expect(report.prOpened).toBe(true);
      expect(report.prUrl).toBe("https://github.com/litlfred/cat-harness/pull/1946");
      expect(report.prNumber).toBe(1946);
      expect(report.exitCode).toBe(0);

      // Verify git execution sequence
      expect(gitCalls).toEqual([
        "createBranch:automation/post-merge-regen-8688288494",
        "commitAll:fix(derived): regenerate post-merge derived artefacts (readme:subgraphs:check)",
        "pushBranch:automation/post-merge-regen-8688288494",
      ]);

      // Verify PR payload
      expect(prPayloadPassed).toBeDefined();
      expect(prPayloadPassed?.head).toBe("automation/post-merge-regen-8688288494");
      expect(prPayloadPassed?.base).toBe("main");
      expect(prPayloadPassed?.title).toContain("readme:subgraphs:check");
      expect(prPayloadPassed?.body).toContain("folio-assistant-ey1c");
      expect(prPayloadPassed?.body).toContain(CHANGED_FILE_VECTOR);
    });

    test("does not open duplicate PR if PR already exists for the branch", async () => {
      let repaired = false;
      const mockRunner: Runner = (script: string) => {
        if (script === "readme:subgraphs:check") return repaired;
        if (script === "readme:subgraphs") {
          repaired = true;
          return true;
        }
        return true;
      };

      let createPrCalled = false;
      const mockGit: GitExecutor = {
        getCurrentSha: () => "8688288494a11111111111111111111111111111",
        getChangedFiles: () => [CHANGED_FILE_VECTOR],
        createBranch: () => {},
        commitAll: () => {},
        pushBranch: () => {},
      };

      const mockGh: GhExecutor = {
        findExistingPr: () => 1946, // existing PR #1946 found
        createPr: () => {
          createPrCalled = true;
          return { url: "url", number: 1946 };
        },
      };

      const report = await checkPostMergeRegen({
        repoRoot: REPO,
        runner: mockRunner,
        git: mockGit,
        gh: mockGh,
        createPr: true,
      });

      expect(report.status).toBe("repaired");
      expect(report.prNumber).toBe(1946);
      expect(report.prOpened).toBe(false);
      expect(createPrCalled).toBe(false);
      expect(report.summary).toContain("PR #1946 already open");
    });
  });

  describe("dry-run and check-only semantics", () => {
    test("--dry-run reports stale checks and generated payload without modifying git or creating PR", async () => {
      const mockRunner: Runner = (script: string) => script !== "readme:subgraphs:check";

      let gitTouched = false;
      let prCreated = false;

      const mockGit: GitExecutor = {
        getCurrentSha: () => "8688288494a",
        getChangedFiles: () => [],
        createBranch: () => {
          gitTouched = true;
        },
        commitAll: () => {
          gitTouched = true;
        },
        pushBranch: () => {
          gitTouched = true;
        },
      };

      const mockGh: GhExecutor = {
        findExistingPr: () => undefined,
        createPr: () => {
          prCreated = true;
          return { url: "", number: 0 };
        },
      };

      const report = await checkPostMergeRegen({
        repoRoot: REPO,
        runner: mockRunner,
        git: mockGit,
        gh: mockGh,
        dryRun: true,
        createPr: true,
      });

      expect(report.status).toBe("stale");
      expect(report.staleChecks).toContain("readme:subgraphs:check");
      expect(report.prPayload).toBeDefined();
      expect(report.prPayload?.title).toContain("readme:subgraphs:check");
      expect(report.prOpened).toBe(false);
      expect(report.exitCode).toBe(0);
      expect(gitTouched).toBe(false);
      expect(prCreated).toBe(false);
    });

    test("--check-only exits 1 when stale derived checks are found", async () => {
      const mockRunner: Runner = (script: string) => script !== "readme:subgraphs:check";

      const report = await checkPostMergeRegen({
        repoRoot: REPO,
        runner: mockRunner,
        checkOnly: true,
      });

      expect(report.status).toBe("stale");
      expect(report.exitCode).toBe(1);
      expect(report.staleChecks).toContain("readme:subgraphs:check");
      expect(report.summary).toContain("Check-only: detected 1 stale check(s)");
    });

    test("--check-only exits 0 when all derived checks are clean", async () => {
      const mockRunner: Runner = () => true;

      const report = await checkPostMergeRegen({
        repoRoot: REPO,
        runner: mockRunner,
        checkOnly: true,
      });

      expect(report.status).toBe("clean");
      expect(report.exitCode).toBe(0);
      expect(report.staleChecks).toEqual([]);
    });
  });

  describe("honest reporting on defects and unrepaired checks", () => {
    test("check failing when its writer does NOT fix it is reported unrepaired (exit 1)", async () => {
      // Writer runs but check still fails
      const mockRunner: Runner = (script: string) => {
        if (script === "readme:subgraphs:check") return false;
        if (script === "readme:subgraphs") return true;
        return true;
      };

      const mockGit: GitExecutor = {
        getCurrentSha: () => "8688288494a",
        getChangedFiles: () => [],
        createBranch: () => {},
        commitAll: () => {},
        pushBranch: () => {},
      };

      const report = await checkPostMergeRegen({
        repoRoot: REPO,
        runner: mockRunner,
        git: mockGit,
        createPr: true,
      });

      expect(report.status).toBe("unrepaired");
      expect(report.unrepairedChecks).toContain("readme:subgraphs:check");
      expect(report.prOpened).toBe(false);
      expect(report.exitCode).toBe(1);
      expect(report.summary).toContain("Repair failed: 1 check(s) could not be repaired");
    });
  });

  describe("fixity gates are not asked", () => {
    test("the mount checks are left out, and every other pair is kept in order", () => {
      const pairs = [
        { check: "library:viz:check", writer: "library:viz" },
        { check: "mount:remote:check", writer: "mount:remote" },
        { check: "readme:subgraphs:check", writer: "readme:subgraphs" },
        { check: "mount:lock:check", writer: "mount:lock" },
      ];
      expect(postMergePairs(pairs).map((p) => p.check)).toEqual(["library:viz:check", "readme:subgraphs:check"]);
    });

    test("each excluded gate says why", () => {
      expect(Object.keys(FIXITY_CHECKS).sort()).toEqual(["mount:lock:check", "mount:remote:check"]);
      for (const reason of Object.values(FIXITY_CHECKS)) expect(reason.length).toBeGreaterThan(20);
    });
  });

  describe("buildPrBody", () => {
    test("generates structured markdown referencing ey1c and reviewable PR rationale", () => {
      const body = buildPrBody({
        staleChecks: ["readme:subgraphs:check", "check:prov-qaqc"],
        commitSha: "8688288494a11111111111111111111111111111",
        branch: "automation/post-merge-regen-8688288494",
        base: "main",
      });

      expect(body).toContain("folio-assistant-ey1c");
      expect(body).toContain("8688288494");
      expect(body).toContain("- `readme:subgraphs:check`");
      expect(body).toContain("- `check:prov-qaqc`");
      expect(body).toContain("reviewable PR rather than direct push");
      expect(body).toContain("accidental-repair hazard");
    });
  });
});

/**
 * Bean `folio-assistant-p7mb`: an output a layer declares `builtAtPublish`
 * is gitignored and never committed, so post-merge regen must not report it
 * stale. Measured on cat-harness run 39786173033 (2026-10-22): `library:viz`,
 * `uploads:viz`, `voices:viz`, `document-kinds:viz` and `slice:sqlite` were
 * listed stale and "repaired" only because their publish-time pages were absent.
 */
describe("builtAtPublish outputs are never stale (bean folio-assistant-p7mb)", () => {
  // A scratch composed tree: one layer `inst` declaring one directory and one file built at publish.
  const PUBLISH_DIR = "out/pages/";
  const PUBLISH_FILE = "out/index.json";
  const COMMITTED = "notes.txt";

  const scratch = (): { repo: string; decls: PublishTimeDeclaration[]; done: () => void } => {
    const repo = mkdtempSync(join(tmpdir(), "post-merge-regen-p7mb-"));
    mkdirSync(join(repo, "inst"), { recursive: true });
    writeFileSync(join(repo, "inst", COMMITTED), "committed\n");
    const decls = [{ root: join(repo, "inst"), builtAtPublish: [{ path: PUBLISH_DIR }, { path: PUBLISH_FILE }] }];
    return { repo, decls, done: () => rmSync(repo, { recursive: true, force: true }) };
  };

  const quietGit = (changed: string[] = []): GitExecutor => ({
    getCurrentSha: () => "39786173033000000000000000000000000000ab",
    getChangedFiles: () => changed,
    createBranch: () => {},
    commitAll: () => {},
    pushBranch: () => {},
  });
  const noPr: GhExecutor = {
    findExistingPr: () => undefined,
    createPr: () => {
      throw new Error("no repair PR may be opened for a builtAtPublish output");
    },
  };

  test("builtAtPublishIn asks isBuiltAtPublish of the owning instance, with the instance-relative path", () => {
    const decls: PublishTimeDeclaration[] = [
      { root: "/r/inst", builtAtPublish: [{ path: PUBLISH_DIR }, { path: PUBLISH_FILE }] },
      { root: "/r/inst/nested", builtAtPublish: [] },
    ];
    expect(builtAtPublishIn("inst/out/pages/a/index.html", decls, "/r")).toBe(true);
    expect(builtAtPublishIn("inst/out/index.json", decls, "/r")).toBe(true);
    expect(builtAtPublishIn("inst/notes.txt", decls, "/r")).toBe(false);
    // Another layer's tree, and the deepest layer declaring nothing, are not this one's declaration.
    expect(builtAtPublishIn("other/out/pages/a.html", decls, "/r")).toBe(false);
    expect(builtAtPublishIn("inst/nested/out/pages/a.html", decls, "/r")).toBe(false);
  });

  test("the tracker tells a builtAtPublish write from a committed one, and a same-bytes rewrite moves nothing", () => {
    const { repo, decls, done } = scratch();
    try {
      const t = treeMoveTracker(repo, decls);
      expect(t.take()).toEqual({ builtAtPublish: [], committed: [] }); // the baseline
      mkdirSync(join(repo, "inst/out/pages"), { recursive: true });
      writeFileSync(join(repo, "inst/out/pages/index.html"), "<p>built</p>");
      writeFileSync(join(repo, "inst", COMMITTED), "committed\n"); // same bytes
      expect(t.take()).toEqual({ builtAtPublish: ["inst/out/pages/index.html"], committed: [] });
      writeFileSync(join(repo, "inst", COMMITTED), "changed\n");
      expect(t.take()).toEqual({ builtAtPublish: [], committed: ["inst/notes.txt"] });
    } finally {
      done();
    }
  });

  test("a check red only because its builtAtPublish outputs are absent is NOT reported stale, and opens no PR", async () => {
    const { repo, decls, done } = scratch();
    try {
      let built = false;
      const runner: Runner = (script) => {
        if (script === "library:viz:check") return built;
        if (script === "library:viz") {
          mkdirSync(join(repo, "inst/out/pages"), { recursive: true });
          writeFileSync(join(repo, "inst/out/pages/index.html"), "<p>built</p>");
          writeFileSync(join(repo, "inst", PUBLISH_FILE), "{}");
          built = true;
          return true;
        }
        return true;
      };
      const report = await checkPostMergeRegen({
        repoRoot: repo,
        pairs: [{ check: "library:viz:check", writer: "library:viz" }],
        runner,
        tracker: treeMoveTracker(repo, decls),
        git: quietGit(),
        gh: noPr,
        createPr: true,
      });
      expect(report.status).toBe("clean");
      expect(report.staleChecks).toEqual([]);
      expect(report.repairedChecks).toEqual([]);
      expect(report.builtAtPublishChecks).toEqual(["library:viz:check"]);
      expect(report.prOpened).toBe(false);
      expect(report.exitCode).toBe(0);
      expect(report.summary).toContain("builtAtPublish");
    } finally {
      done();
    }
  });

  test("control: a writer that also moves a COMMITTED file is still a stale check, repaired", async () => {
    const { repo, decls, done } = scratch();
    try {
      let built = false;
      const runner: Runner = (script) => {
        if (script === "render:bpmn:check") return built;
        if (script === "render:bpmn") {
          mkdirSync(join(repo, "inst/out/pages"), { recursive: true });
          writeFileSync(join(repo, "inst/out/pages/other.svg"), "<svg/>");
          writeFileSync(join(repo, "inst", COMMITTED), "redrawn\n");
          built = true;
          return true;
        }
        return true;
      };
      const report = await checkPostMergeRegen({
        repoRoot: repo,
        pairs: [{ check: "render:bpmn:check", writer: "render:bpmn" }],
        runner,
        tracker: treeMoveTracker(repo, decls),
        git: quietGit(["inst/notes.txt"]),
        gh: noPr,
      });
      expect(report.status).toBe("repaired");
      expect(report.staleChecks).toEqual(["render:bpmn:check"]);
      expect(report.repairedChecks).toEqual(["render:bpmn:check"]);
      expect(report.builtAtPublishChecks).toEqual([]);
    } finally {
      done();
    }
  });

  test("publish-check style checks and checks waiting on another writer's builtAtPublish output are classified as builtAtPublishChecks", async () => {
    const { repo, decls, done } = scratch();
    try {
      let themesBuilt = false;
      let pagesBuilt = false;
      const runner: Runner = (script) => {
        // `node-kind:pages:check` runs `publish-check.ts node-kind:pages`, writing on the first check call
        if (script === "node-kind:pages:check") {
          mkdirSync(join(repo, "inst/out/pages"), { recursive: true });
          writeFileSync(join(repo, "inst/out/pages/index.html"), "<p>built</p>");
          const wasBuilt = pagesBuilt;
          pagesBuilt = true;
          return wasBuilt;
        }
        if (script === "themes:css:check") return themesBuilt;
        if (script === "themes:css") {
          writeFileSync(join(repo, "inst", PUBLISH_FILE), "{}");
          themesBuilt = true;
          return true;
        }
        // `check:navbar-consistency:check` reads `PUBLISH_FILE` built by `themes:css`
        if (script === "check:navbar-consistency:check") return themesBuilt;
        return true;
      };
      const report = await checkPostMergeRegen({
        repoRoot: repo,
        pairs: [
          { check: "node-kind:pages:check", writer: "node-kind:pages" },
          { check: "themes:css:check", writer: "themes:css" },
          { check: "check:navbar-consistency:check", writer: "check:navbar-consistency" },
        ],
        runner,
        tracker: treeMoveTracker(repo, decls),
        git: quietGit(),
        gh: noPr,
        createPr: true,
      });
      expect(report.status).toBe("clean");
      expect(report.staleChecks).toEqual([]);
      expect(report.repairedChecks).toEqual([]);
      expect(report.builtAtPublishChecks).toEqual([
        "node-kind:pages:check",
        "themes:css:check",
        "check:navbar-consistency:check",
      ]);
      expect(report.exitCode).toBe(0);
    } finally {
      done();
    }
  });

  test("instance scoping: another layer's committed move in the composed index is not reported stale for the caller instance", async () => {
    const { repo, decls, done } = scratch();
    try {
      mkdirSync(join(repo, "other"), { recursive: true });
      writeFileSync(join(repo, "other", COMMITTED), "other-before\n");
      let built = false;
      const runner: Runner = (script) => {
        if (script === "glossary:pot:check") return built;
        if (script === "glossary:pot") {
          writeFileSync(join(repo, "other", COMMITTED), "other-after\n");
          built = true;
          return true;
        }
        return true;
      };
      const report = await checkPostMergeRegen({
        repoRoot: repo,
        instance: "inst",
        pairs: [{ check: "glossary:pot:check", writer: "glossary:pot" }],
        runner,
        tracker: treeMoveTracker(repo, decls, "inst"),
        git: quietGit(["other/notes.txt"]),
        gh: noPr,
        createPr: true,
      });
      expect(report.status).toBe("clean");
      expect(report.staleChecks).toEqual([]);
      expect(report.repairedChecks).toEqual([]);
      expect(report.builtAtPublishChecks).toEqual(["glossary:pot:check"]);
      expect(report.exitCode).toBe(0);
    } finally {
      done();
    }
  });

  test("clean checks from the audit pass are not re-run during builtAtPublish convergence across passes", async () => {
    const { repo, decls, done } = scratch();
    try {
      let libraryBuilt = false;
      let sqliteBuilt = false;
      const calls = new Map<string, number>();
      const runner: Runner = (script) => {
        calls.set(script, (calls.get(script) ?? 0) + 1);
        // `slice:sqlite` comes BEFORE `library:viz` and needs `PUBLISH_FILE` written by `library:viz`
        if (script === "slice:sqlite:check") return sqliteBuilt;
        if (script === "slice:sqlite") {
          if (!libraryBuilt) return false;
          mkdirSync(join(repo, "inst/out/pages"), { recursive: true });
          writeFileSync(join(repo, "inst/out/pages/slice.sqlite"), "sqlite");
          sqliteBuilt = true;
          return true;
        }
        if (script === "library:viz:check") return libraryBuilt;
        if (script === "library:viz") {
          mkdirSync(join(repo, "inst/out"), { recursive: true });
          writeFileSync(join(repo, "inst", PUBLISH_FILE), "{}");
          libraryBuilt = true;
          return true;
        }
        // `translation:block-qa:check` is clean in the audit pass and must NOT be re-run in Pass 1 or Pass 2
        if (script === "translation:block-qa:check") return true;
        return true;
      };
      const report = await checkPostMergeRegen({
        repoRoot: repo,
        pairs: [
          { check: "translation:block-qa:check", writer: "translation:block-qa" },
          { check: "slice:sqlite:check", writer: "slice:sqlite" },
          { check: "library:viz:check", writer: "library:viz" },
        ],
        runner,
        tracker: treeMoveTracker(repo, decls),
        git: quietGit(),
        gh: noPr,
        createPr: true,
      });
      expect(report.status).toBe("clean");
      expect(report.staleChecks).toEqual([]);
      expect(report.repairedChecks).toEqual([]);
      expect(report.builtAtPublishChecks).toEqual(["slice:sqlite:check", "library:viz:check"]);
      // Clean check from audit pass ran ONCE (in the audit pass), never re-asked in fixpoint passes
      expect(calls.get("translation:block-qa:check")).toBe(1);
    } finally {
      done();
    }
  });

  test("a gate judged after publish is reported with builtAtPublishChecks, an unlisted red one stays unrepaired", async () => {
    const { repo, decls, done } = scratch();
    try {
      // `check:nav-names:check` has no writer and exits non-zero outside a publish
      // (no railed page in the checkout); `slice:sqlite:check` stays red after its
      // writer because it reads the payload tree only derive:publish builds.
      const runner: Runner = (script) => {
        if (script === "check:nav-names:check") return false;
        if (script === "slice:sqlite:check") return false;
        if (script === "slice:sqlite") return true;
        return true;
      };
      const listed = await checkPostMergeRegen({
        repoRoot: repo,
        pairs: [
          { check: "check:nav-names:check", writer: undefined },
          { check: "slice:sqlite:check", writer: "slice:sqlite" },
        ],
        runner,
        tracker: treeMoveTracker(repo, decls),
        git: quietGit(),
        gh: noPr,
        createPr: true,
      });
      expect(JUDGED_AFTER_PUBLISH["check:nav-names:check"]).toBeDefined();
      expect(listed.unrepairedChecks).toEqual([]);
      expect(listed.staleChecks).toEqual([]);
      expect([...listed.builtAtPublishChecks].sort()).toEqual(["check:nav-names:check", "slice:sqlite:check"]);
      expect(listed.status).toBe("clean");
      expect(listed.exitCode).toBe(0);

      // The falsifier: the same red, under a name NOT in the list, is still unrepaired.
      const unlisted = await checkPostMergeRegen({
        repoRoot: repo,
        pairs: [{ check: "other:gate:check", writer: "other:gate" }],
        runner: (script) => script !== "other:gate:check",
        tracker: treeMoveTracker(repo, decls),
        git: quietGit(),
        gh: noPr,
        createPr: true,
      });
      expect(unlisted.unrepairedChecks).toEqual(["other:gate:check"]);
      expect(unlisted.builtAtPublishChecks).toEqual([]);
      expect(unlisted.exitCode).toBe(1);
    } finally {
      done();
    }
  });

  test("a committed file move in pass 1 re-asks only checks whose declared inputs match", async () => {
    const { repo, decls, done } = scratch();
    try {
      mkdirSync(join(repo, "inst/data"), { recursive: true });
      mkdirSync(join(repo, "inst/other"), { recursive: true });
      writeFileSync(join(repo, "inst/data/source.json"), "v1\n");
      writeFileSync(join(repo, "inst/data/derived.json"), "v1\n");
      writeFileSync(join(repo, "inst/other/untouched.json"), "ok\n");
      let sourceFixed = false;
      let derivedStale = false;
      const calls = new Map<string, number>();
      const runner: Runner = (script) => {
        calls.set(script, (calls.get(script) ?? 0) + 1);
        if (script === "source:check") return sourceFixed;
        if (script === "source:write") {
          writeFileSync(join(repo, "inst/data/source.json"), "v2\n");
          sourceFixed = true;
          derivedStale = true;
          return true;
        }
        if (script === "derived:check") return !derivedStale;
        if (script === "derived:write") {
          writeFileSync(join(repo, "inst/data/derived.json"), "v2\n");
          derivedStale = false;
          return true;
        }
        if (script === "unrelated:check") return true;
        return true;
      };
      const report = await checkPostMergeRegen({
        repoRoot: repo,
        pairs: [
          { check: "derived:check", writer: "derived:write", io: { inputs: ["data/source.json"], outputs: ["data/derived.json"] } },
          { check: "source:check", writer: "source:write", io: { inputs: ["data/source.json"], outputs: ["data/source.json"] } },
          { check: "unrelated:check", writer: "unrelated:write", io: { inputs: ["other/**"], outputs: [] } },
        ],
        runner,
        tracker: treeMoveTracker(repo, decls),
        git: quietGit(["inst/data/source.json", "inst/data/derived.json"]),
        gh: noPr,
      });
      expect(report.status).toBe("repaired");
      expect(report.repairedChecks).toEqual(["derived:check", "source:check"]);
      // `unrelated:check` passed in audit and its `other/**` input never moved, so it ran only once
      expect(calls.get("unrelated:check")).toBe(1);
    } finally {
      done();
    }
  });

  test("barren pass: a writer that neither repairs its check nor moves any file settles after 1 repair pass", async () => {
    const { repo, decls, done } = scratch();
    try {
      let writerCalls = 0;
      const runner: Runner = (script) => {
        if (script === "broken:check") return false;
        if (script === "broken:write") {
          writerCalls++;
          return true;
        }
        return true;
      };
      const report = await checkPostMergeRegen({
        repoRoot: repo,
        pairs: [{ check: "broken:check", writer: "broken:write" }],
        runner,
        tracker: treeMoveTracker(repo, decls),
        git: quietGit(),
        gh: noPr,
        maxPasses: 6,
      });
      expect(report.status).toBe("unrepaired");
      expect(report.unrepairedChecks).toEqual(["broken:check"]);
      expect(writerCalls).toBe(1);
    } finally {
      done();
    }
  });
  test("publishTimeDeclarations includes off-checkout storage directories (e.g. test/results/ on qa-reports)", () => {
    const decls = publishTimeDeclarations(REPO);
    expect(builtAtPublishIn("cat-harness/test/results/check.qa-results.json", decls, REPO)).toBe(true);
    expect(builtAtPublishIn("cat-harness/site/index.html", decls, REPO)).toBe(true);
    expect(builtAtPublishIn("cat-harness/README.md", decls, REPO)).toBe(false);
  });

  test("index scoping (bean ksek): in an index checkout with remote mounts, writers that only touch remote mounts are classified as builtAtPublishChecks and open no PR", async () => {
    const { repo, decls, done } = scratch();
    try {
      mkdirSync(join(repo, "mounted-layer"), { recursive: true });
      writeFileSync(join(repo, "mounted-layer/layer.txt"), "before\n");
      writeFileSync(join(repo, "README.md"), "index-readme\n");
      writeFileSync(
        join(repo, "index.lock.json"),
        JSON.stringify({
          $schema: "cat-harness-mount-lock/v1",
          mounts: [
            {
              harness: "mounted-layer",
              repository: "litlfred/mounted-layer",
              ref: "0000000000000000000000000000000000000001",
            },
          ],
          instances: [
            {
              instance: "mounted-layer",
              repository: "litlfred/mounted-layer",
              sha: "0000000000000000000000000000000000000001",
              upstreamRoot: "",
              path: "mounted-layer",
              via: "mounted-layer",
              pinnedBy: "declared",
              declaration: {
                file: "mounted-layer.json",
                sha256: "0000000000000000000000000000000000000000000000000000000000000001",
              },
              directories: [
                {
                  id: "*",
                  path: "mounted-layer",
                  upstreamPath: ".",
                  treeDigest: "0000000000000000000000000000000000000000000000000000000000000002",
                  files: 1,
                },
              ],
            },
          ],
        }),
      );

      const scope = inTargetScope(repo);
      expect(scope("mounted-layer/layer.txt")).toBe(false);
      expect(scope("README.md")).toBe(true);

      let layerRepaired = false;
      const runner: Runner = (script) => {
        if (script === "kind:register:check") return layerRepaired;
        if (script === "kind:register") {
          writeFileSync(join(repo, "mounted-layer/layer.txt"), "after\n");
          layerRepaired = true;
          return true;
        }
        return true;
      };

      const report = await checkPostMergeRegen({
        repoRoot: repo,
        pairs: [{ check: "kind:register:check", writer: "kind:register" }],
        runner,
        tracker: treeMoveTracker(repo, decls),
        git: quietGit([]),
        gh: noPr,
        createPr: true,
      });

      expect(report.status).toBe("clean");
      expect(report.staleChecks).toEqual([]);
      expect(report.repairedChecks).toEqual([]);
      expect(report.builtAtPublishChecks).toEqual(["kind:register:check"]);
      expect(report.changedFiles).toEqual([]);
      expect(report.prOpened).toBe(false);
      expect(report.exitCode).toBe(0);
    } finally {
      done();
    }
  });
});

describe("prerequisite writers come from the declarations, not from instance names", () => {
  test("a writer runs only when an instance declares it and its output is absent", () => {
    const root = mkdtempSync(join(tmpdir(), "prereq-writers-"));
    try {
      mkdirSync(join(root, "ig", "fhir-artifact-index"), { recursive: true });
      const decl = (writer: string[], path: string): PublishTimeDeclaration => ({ root: join(root, "ig"), builtAtPublish: [{ path, writer }] });
      expect(missingPrerequisiteWriters([decl(["ig-index:build"], "fhir-artifact-index/index.json")])).toEqual(["ig-index:build"]);
      writeFileSync(join(root, "ig", "fhir-artifact-index", "index.json"), "{}");
      expect(missingPrerequisiteWriters([decl(["ig-index:build"], "fhir-artifact-index/index.json")])).toEqual([]);
      expect(missingPrerequisiteWriters([decl(["render:bpmn"], "missing.svg")])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
