/**
 * Tests for scripts/check-draft-beans.ts.
 *
 * Verifies that:
 * 1. Draft decision beans on unmerged branches are caught.
 * 2. Landed or clean stores pass.
 * 3. Non-decision draft beans or non-draft beans are not flagged.
 * 4. Could-not-determine states are findings, never green (dh4f).
 * 5. Denominator is reported correctly.
 *
 * @module scripts/tests/check-draft-beans
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BeanNode } from "../beans.ts";
import {
  checkDraftBeans,
  declaredDefaultNames,
  formatReport,
  hasRecommendationOrDefaultSection,
  resolveDefaultRef,
} from "../check-draft-beans.ts";

const tempDirs: string[] = [];
afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

function createTempDir(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(d);
  return d;
}

function git(repo: string, ...args: string[]): string {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}

describe("hasRecommendationOrDefaultSection", () => {
  test("matches ## Recommendation heading", () => {
    expect(hasRecommendationOrDefaultSection("## Recommendation\n\nChoose option A.")).toBe(true);
    expect(hasRecommendationOrDefaultSection("## 6. Recommendation\n\nOption A.")).toBe(true);
    expect(hasRecommendationOrDefaultSection("### Recommendation\n\nTake action.")).toBe(true);
  });

  test("matches safe default phrase or heading", () => {
    expect(hasRecommendationOrDefaultSection("Some text stating the safe default is option D.")).toBe(true);
    expect(hasRecommendationOrDefaultSection("## Safe default\n\nIf no answer, do nothing.")).toBe(true);
    expect(hasRecommendationOrDefaultSection("### The safe default\n\nDo D.")).toBe(true);
  });

  test("matches options comparison with recommendation or if-silent", () => {
    expect(
      hasRecommendationOrDefaultSection("### The options, compared\n\n| A *(recommended)* | B |\n"),
    ).toBe(true);
    expect(
      hasRecommendationOrDefaultSection("## Options\n\nIf you say nothing, I will take option A."),
    ).toBe(true);
    expect(
      hasRecommendationOrDefaultSection("## Options\n\nIf silent, default to A."),
    ).toBe(true);
  });

  test("returns false for regular task or bug prose", () => {
    expect(hasRecommendationOrDefaultSection("Implement the feature according to specs.")).toBe(false);
    expect(hasRecommendationOrDefaultSection("Fix off-by-one error in parser loop.")).toBe(false);
    expect(hasRecommendationOrDefaultSection("## Done when\n\n- [ ] Task 1\n- [ ] Task 2")).toBe(false);
  });
});

describe("resolveDefaultRef", () => {
  test("respects customRef when valid", () => {
    const dir = createTempDir("git-ref-");
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "test@example.com");
    git(dir, "config", "user.name", "test");
    writeFileSync(join(dir, "f"), "initial\n");
    git(dir, "add", "f");
    git(dir, "commit", "-q", "-m", "initial");

    expect(resolveDefaultRef(dir, "main")).toBe("main");
  });

  test("resolves main when present", () => {
    const dir = createTempDir("git-ref-");
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "test@example.com");
    git(dir, "config", "user.name", "test");
    writeFileSync(join(dir, "f"), "initial\n");
    git(dir, "add", "f");
    git(dir, "commit", "-q", "-m", "initial");

    expect(resolveDefaultRef(dir)).toBe("main");
  });

  test("returns null when no candidate ref exists", () => {
    const dir = createTempDir("git-ref-");
    git(dir, "init", "-q", "-b", "some-feature");
    expect(resolveDefaultRef(dir, "non-existent-ref")).toBeNull();
  });
});

describe("checkDraftBeans detection logic with mocked beans & git", () => {
  // A fresh empty directory as the repository root, never `/tmp` itself: the
  // check resolves the bean store by scanning its root for instance
  // declarations, so a root of `/tmp` read every other test's leftovers. A
  // stray `<dir>/<dir>.json` there (folio-dir-deferred.test.ts writes one on
  // purpose) made it "cannot resolve the bean store" and turned seven tests
  // red depending on what had run before.
  let emptyRoot = "";
  beforeEach(() => {
    emptyRoot = createTempDir("draft-beans-root-");
  });

  const dummyBean = (overrides: Partial<BeanNode>): BeanNode => ({
    id: "folio-assistant-test",
    file: "beans/defs/folio-assistant-test.md",
    title: "Test bean",
    status: "todo",
    type: "task",
    priority: "normal",
    parent: "",
    blocking: [],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    body: "## Context\nSome content\n",
    ...overrides,
  });

  test("passes when no draft beans exist", () => {
    const beans = [
      dummyBean({ id: "b1", status: "todo" }),
      dummyBean({ id: "b2", status: "in-progress" }),
      dummyBean({ id: "b3", status: "completed" }),
    ];
    const report = checkDraftBeans(emptyRoot, {
      beans,
      defaultRef: "main",
      gitFn: (args) => {
        if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
          return { status: 0, stdout: `${emptyRoot}\n`, stderr: "" };
        }
        if (args[0] === "rev-parse" && args[args.length - 1] === "main") {
          return { status: 0, stdout: "deadbeef\n", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    });

    expect(report.findings).toEqual([]);
    expect(report.undetermined).toEqual([]);
    expect(report.draftCount).toBe(0);
    expect(report.decisionDraftCount).toBe(0);
    expect(report.total).toBe(3);
  });

  test("ignores draft beans that are not decision ruling requests", () => {
    const beans = [
      dummyBean({
        id: "b-draft-task",
        status: "draft",
        body: "## Work\nDrafting task description for ordinary task implementation.\n",
      }),
    ];
    const report = checkDraftBeans(emptyRoot, {
      beans,
      defaultRef: "main",
      gitFn: (args) => {
        if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
          return { status: 0, stdout: `${emptyRoot}\n`, stderr: "" };
        }
        if (args[0] === "rev-parse" && args[args.length - 1] === "main") {
          return { status: 0, stdout: "deadbeef\n", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    });

    expect(report.findings).toEqual([]);
    expect(report.undetermined).toEqual([]);
    expect(report.draftCount).toBe(1);
    expect(report.decisionDraftCount).toBe(0);
  });

  test("catches draft decision bean unmerged on branch", () => {
    const beans = [
      dummyBean({
        id: "folio-assistant-r0tm",
        title: "Ruling request on adapters closure",
        status: "draft",
        body: "## 6. Recommendation\nDo step 1 now.\n\nSafe default: do nothing.\n",
      }),
    ];
    const report = checkDraftBeans(emptyRoot, {
      beans,
      defaultRef: "main",
      gitFn: (args) => {
        if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
          return { status: 0, stdout: `${emptyRoot}\n`, stderr: "" };
        }
        if (args[0] === "rev-parse" && args[args.length - 1] === "main") {
          return { status: 0, stdout: "deadbeef\n", stderr: "" };
        }
        if (args[0] === "show") {
          // File does not exist on main
          return { status: 1, stdout: "", stderr: "does not exist in main" };
        }
        if (args[0] === "log" && args[4] === "HEAD") {
          return { status: 0, stdout: "branchcommit12345\n", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
      isAncestorFn: () => ({ known: true, ancestor: false }),
    });

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]!.id).toBe("folio-assistant-r0tm");
    expect(report.findings[0]!.reason).toContain("no ancestor of main");
    expect(report.decisionDraftCount).toBe(1);
    expect(report.draftCount).toBe(1);
  });

  test("passes when draft decision bean exists on default branch", () => {
    const beans = [
      dummyBean({
        id: "folio-assistant-landed",
        title: "Landed ruling request",
        status: "draft",
        body: "## Recommendation\nOption A\n\nSafe default: B\n",
      }),
    ];
    const report = checkDraftBeans(emptyRoot, {
      beans,
      defaultRef: "main",
      gitFn: (args) => {
        if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
          return { status: 0, stdout: `${emptyRoot}\n`, stderr: "" };
        }
        if (args[0] === "rev-parse" && args[args.length - 1] === "main") {
          return { status: 0, stdout: "deadbeef\n", stderr: "" };
        }
        if (args[0] === "show") {
          // File exists on main with status: draft and recommendation
          return {
            status: 0,
            stdout: "---\nstatus: draft\n---\n## Recommendation\nOption A\nSafe default: B\n",
            stderr: "",
          };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    });

    expect(report.findings).toEqual([]);
    expect(report.undetermined).toEqual([]);
    expect(report.decisionDraftCount).toBe(1);
  });

  test("reports uncommitted draft decision bean as finding", () => {
    const beans = [
      dummyBean({
        id: "folio-assistant-uncommitted",
        title: "Uncommitted ruling request",
        status: "draft",
        body: "## Recommendation\nOption A\nSafe default: B\n",
      }),
    ];
    const report = checkDraftBeans(emptyRoot, {
      beans,
      defaultRef: "main",
      gitFn: (args) => {
        if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
          return { status: 0, stdout: `${emptyRoot}\n`, stderr: "" };
        }
        if (args[0] === "rev-parse" && args[args.length - 1] === "main") {
          return { status: 0, stdout: "deadbeef\n", stderr: "" };
        }
        if (args[0] === "show") {
          return { status: 1, stdout: "", stderr: "does not exist in main" };
        }
        if (args[0] === "log" && args[4] === "HEAD") {
          // No commit on HEAD (uncommitted file)
          return { status: 0, stdout: "", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    });

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]!.reason).toContain("uncommitted and exists on no ancestor");
  });

  test("handles unreadable git ancestry as dh4f undetermined (never green)", () => {
    const beans = [
      dummyBean({
        id: "folio-assistant-shallow",
        title: "Shallow repo ruling request",
        status: "draft",
        body: "## Recommendation\nOption A\nSafe default: B\n",
      }),
    ];
    const report = checkDraftBeans(emptyRoot, {
      beans,
      defaultRef: "main",
      gitFn: (args) => {
        if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
          return { status: 0, stdout: `${emptyRoot}\n`, stderr: "" };
        }
        if (args[0] === "rev-parse" && args[args.length - 1] === "main") {
          return { status: 0, stdout: "deadbeef\n", stderr: "" };
        }
        if (args[0] === "show") {
          return { status: 1, stdout: "", stderr: "does not exist in main" };
        }
        if (args[0] === "log" && args[4] === "HEAD") {
          return { status: 0, stdout: "commit123456\n", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
      isAncestorFn: () => ({ known: false, reason: "shallow clone missing object" }),
    });

    expect(report.undetermined).toHaveLength(1);
    expect(report.undetermined[0]).toContain("shallow clone missing object");
    const formatted = formatReport(report);
    expect(formatted).toContain("could not determine");
    expect(formatted).toContain("dh4f: could not determine is a finding, never green");
  });

  test("handles missing default branch as undetermined", () => {
    const beans = [dummyBean({ id: "b1", status: "draft", body: "## Recommendation\nOption A.\n" })];
    const report = checkDraftBeans(emptyRoot, {
      beans,
      env: {},
      gitFn: (args) => {
        if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
          return { status: 0, stdout: `${emptyRoot}\n`, stderr: "" };
        }
        // All default branch checks fail
        return { status: 1, stdout: "", stderr: "not found" };
      },
    });

    expect(report.undetermined).toHaveLength(1);
    expect(report.undetermined[0]).toContain("could not determine default branch ref");
  });

  test("with no draft DECISION bean, an unnameable default branch is not undetermined (#2460)", () => {
    // dth-sc's CI checkout: beans in the store, none a draft decision, and no
    // ref git can name. There is nothing to place against the default branch.
    const beans = [dummyBean({ id: "b1", status: "draft" }), dummyBean({ id: "b2", status: "todo" })];
    const asked: string[][] = [];
    const report = checkDraftBeans(emptyRoot, {
      beans,
      env: {},
      gitFn: (args) => {
        asked.push(args);
        if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
          return { status: 0, stdout: `${emptyRoot}\n`, stderr: "" };
        }
        return { status: 1, stdout: "", stderr: "not found" };
      },
    });
    expect(report.undetermined).toEqual([]);
    expect(report.findings).toEqual([]);
    expect(report.draftCount).toBe(1);
    expect(report.decisionDraftCount).toBe(0);
    expect(asked.some((a) => a[0] === "symbolic-ref" || a[0] === "fetch")).toBe(false);
    expect(formatReport(report)).toContain("no branch-only draft decision beans");
  });
});

/**
 * A pull-request checkout as `actions/checkout` makes it: one commit, detached
 * HEAD, no `origin/HEAD`, no `origin/main` (cat-harness-tools#2460).
 */
function ciCheckout(defaultBranch = "main"): { origin: string; checkout: string } {
  const seed = createTempDir("draft-beans-seed-");
  git(seed, "init", "-q", "-b", defaultBranch);
  git(seed, "config", "user.email", "test@example.com");
  git(seed, "config", "user.name", "test");
  writeFileSync(join(seed, "f"), "initial\n");
  git(seed, "add", "f");
  git(seed, "commit", "-q", "-m", "initial");
  git(seed, "checkout", "-q", "-b", "feature");
  writeFileSync(join(seed, "g"), "pr\n");
  git(seed, "add", "g");
  git(seed, "commit", "-q", "-m", "pr change");
  const origin = createTempDir("draft-beans-origin-");
  git(origin, "clone", "-q", "--bare", seed, join(origin, "repo.git"));
  const bare = join(origin, "repo.git");
  git(bare, "symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`);
  const checkout = createTempDir("draft-beans-ci-");
  git(checkout, "init", "-q");
  git(checkout, "remote", "add", "origin", `file://${bare}`);
  git(checkout, "fetch", "-q", "--no-tags", "--depth=1", "origin", "+refs/heads/feature:refs/remotes/pull/merge");
  git(checkout, "checkout", "-q", "--detach", "refs/remotes/pull/merge");
  return { origin: bare, checkout };
}

describe("resolveDefaultRef in a CI checkout (shallow, detached, no origin/HEAD)", () => {
  test("the checkout really has none of the local candidates", () => {
    const { checkout } = ciCheckout();
    expect(spawnSync("git", ["-C", checkout, "rev-parse", "-q", "--verify", "origin/main"]).status).not.toBe(0);
    expect(spawnSync("git", ["-C", checkout, "symbolic-ref", "-q", "refs/remotes/origin/HEAD"]).status).not.toBe(0);
    expect(git(checkout, "rev-parse", "--is-shallow-repository")).toBe("true");
  });

  test("GITHUB_BASE_REF names the branch, and it is fetched", () => {
    const { checkout } = ciCheckout("trunk");
    expect(resolveDefaultRef(checkout, undefined, undefined, { GITHUB_BASE_REF: "trunk" })).toBe("origin/trunk");
    expect(spawnSync("git", ["-C", checkout, "rev-parse", "-q", "--verify", "origin/trunk"]).status).toBe(0);
  });

  test("the event payload's repository.default_branch names it when there is no base ref", () => {
    const { checkout } = ciCheckout("trunk");
    const event = join(createTempDir("draft-beans-event-"), "event.json");
    writeFileSync(event, JSON.stringify({ repository: { default_branch: "trunk" } }));
    expect(resolveDefaultRef(checkout, undefined, undefined, { GITHUB_EVENT_PATH: event })).toBe("origin/trunk");
  });

  test("with no CI variables, the remote's own HEAD names it", () => {
    const { checkout } = ciCheckout("trunk");
    expect(resolveDefaultRef(checkout, undefined, undefined, {})).toBe("origin/trunk");
  });

  test("an unreadable event payload declares nothing, and the remote still answers", () => {
    const { checkout } = ciCheckout("main");
    const event = join(createTempDir("draft-beans-event-"), "event.json");
    writeFileSync(event, "{not json");
    expect(declaredDefaultNames({ GITHUB_EVENT_PATH: event })).toEqual([]);
    expect(resolveDefaultRef(checkout, undefined, undefined, { GITHUB_EVENT_PATH: event })).toBe("origin/main");
  });

  test("declaredDefaultNames: base ref first, then the declared default, deduplicated", () => {
    const event = join(createTempDir("draft-beans-event-"), "event.json");
    writeFileSync(event, JSON.stringify({ repository: { default_branch: "main" } }));
    expect(declaredDefaultNames({ GITHUB_BASE_REF: "release", GITHUB_EVENT_PATH: event })).toEqual(["release", "main"]);
    expect(declaredDefaultNames({ GITHUB_BASE_REF: "main", GITHUB_EVENT_PATH: event })).toEqual(["main"]);
    expect(declaredDefaultNames({})).toEqual([]);
  });

  test("a draft decision bean in the CI checkout is judged against the fetched default branch", () => {
    const { checkout } = ciCheckout("main");
    const defsDir = join(checkout, "beans", "defs");
    mkdirSync(defsDir, { recursive: true });
    writeFileSync(
      join(defsDir, "folio-assistant-r0tm.md"),
      "---\n# folio-assistant-r0tm\ntitle: 'Decision request'\nstatus: draft\ntype: task\n---\n\n## Recommendation\nOption A.\n",
    );
    const report = checkDraftBeans(checkout, { env: { GITHUB_BASE_REF: "main" } });
    expect(report.defaultBranch).toBe("origin/main");
    expect(report.undetermined).toEqual([]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]!.reason).toContain("uncommitted");
  });
});

describe("real git repo workflow", () => {
  test("catches unmerged draft decision bean, then passes once merged to main", () => {
    const root = createTempDir("draft-beans-repo-");
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "test@example.com");
    git(root, "config", "user.name", "test");

    // Create initial commit on main with beans store structure
    const defsDir = join(root, "beans", "defs");
    mkdirSync(defsDir, { recursive: true });
    writeFileSync(
      join(defsDir, "folio-assistant-base.md"),
      "---\n# folio-assistant-base\ntitle: 'Base bean'\nstatus: completed\ntype: task\n---\n\nbody\n",
    );
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "init main");

    // Create feature branch
    git(root, "checkout", "-q", "-b", "feature/decision-request");
    writeFileSync(
      join(defsDir, "folio-assistant-r0tm.md"),
      "---\n# folio-assistant-r0tm\ntitle: 'Decision request'\nstatus: draft\ntype: task\n---\n\n## Recommendation\nOption A.\n\nSafe default: Option D.\n",
    );
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "add draft decision request r0tm");

    // Run check on feature branch against main
    const reportBranch = checkDraftBeans(root, { defaultRef: "main" });
    expect(reportBranch.findings).toHaveLength(1);
    expect(reportBranch.findings[0]!.id).toBe("folio-assistant-r0tm");
    expect(reportBranch.decisionDraftCount).toBe(1);
    expect(reportBranch.draftCount).toBe(1);
    expect(reportBranch.total).toBe(2);

    // Merge branch into main
    git(root, "checkout", "-q", "main");
    git(root, "merge", "-q", "--no-ff", "feature/decision-request", "-m", "merge decision request");

    // Run check on main
    const reportMerged = checkDraftBeans(root, { defaultRef: "main" });
    expect(reportMerged.findings).toEqual([]);
    expect(reportMerged.undetermined).toEqual([]);
    expect(reportMerged.decisionDraftCount).toBe(1);
    expect(reportMerged.draftCount).toBe(1);
    expect(reportMerged.total).toBe(2);

    const formatted = formatReport(reportMerged);
    expect(formatted).toContain("0 unmerged of 1 draft decisions (1 draft, 2 total)");
    expect(formatted).toContain("every draft decision bean exists on an ancestor of main");
  });
});
