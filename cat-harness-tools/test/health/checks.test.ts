/**
 * Every check is shown FIRING, not merely returning clean.
 *
 * **A checker that returns `[]` for everything passes a corpus test.** Run the
 * registry against a healthy repository and a function that does nothing is
 * indistinguishable from one that works, so "the live repo is green" proves
 * nothing about any of these. Each check therefore gets fixture evidence
 * chosen to breach each of its thresholds, and the assertion NAMES the finding
 * rather than counting them — a count passes when the wrong finding fires.
 *
 * The three states get the same treatment: a determined empty and a
 * could-not-determine are asserted separately, because collapsing them is the
 * defect the whole family exists to refuse.
 *
 * @module test/health/checks.test
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/feature-staging.yml`) live in
 * `test/health-checks-workflows.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { renderDecision } from "../../schemas/process/decision-request.ts";
import { HealthCheckResultSchema, HealthReportSchema, healthVerdict, type PagesServingObservation } from "../../schemas/sdlc/health-report.ts";
import type { QaTreeRead } from "../../scripts/qa-store.ts";
import { MAX_PREVIEW_BYTES } from "../../scripts/staging-rotate.ts";
import {
  BEAN_OPEN_LIMIT,
  BEAN_RESOLVED_INLINE_LIMIT,
  HEALTH_CHECKS,
  PAGES_OBSERVATION_HORIZON_DAYS,
  pagesPublishHealthCheck,
  remoteMountHealthCheck,
  lsiIndexHealthCheck,
  libraryKeywordsHealthCheck,
  ORPHAN_THRESHOLDS,
  RECENT_COMMIT_MINUTES,
  TRACKED_MAJOR_BYTES,
  TRACKED_WARN_BYTES,
  beanStoreCheck,
  sessionLogRootBeans,
  formatBytes,
  repositorySizeCheck,
  runHealthChecks,
  previewLiveness,
  stagingOrphanCheck,
  specialBranchSizeCheck,
  stagingSizeCheck,
  stagingSlug,
  todoStoreCheck,
  type BeanEvidence,
  type BranchEvidenceSet,
  type HealthContext,
  type SpecialBranchBudget,
  type SpecialBranchMeasure,
  type StagingPreview,
} from "./checks.ts";
import { declaredFamilyPrefix, hasRenderedDecision, membersFor, probeBeans, probeLibraryKeywords, probeLsiIndexes, probePagesServing, probeTodos, readSpecialBranches, type SpecialBranchDecl } from "./probes.ts";

const MB = 1024 * 1024;

/** A context in which every probe succeeded and every store is healthy. */
function healthyContext(over: Partial<HealthContext> = {}): HealthContext {
  return {
    now: new Date("2026-09-19T12:00:00Z"),
    subject: "litlfred/folio-assistant",
    staging: {
      state: "ok",
      value: { branch: "present", previews: [{ slug: "claude-a", bytes: 10 * MB, files: 5 }], command: "fixture" },
    },
    openPrHeads: { state: "ok", value: ["claude/a"] },
    branches: { state: "ok", value: { candidates: [], defaultBranch: "main", command: "fixture" } },
    repoSize: { state: "ok", value: { gitDirBytes: 20 * MB, trackedBytes: 10 * MB, packs: 1, packBytes: 18 * MB } },
    beans: {
      state: "ok",
      value: [{ id: "b1", title: "one", status: "todo" }],
    },
    todos: { state: "ok", value: [{ id: "t1", status: "open", createdAt: "2026-09-18" }] },
    specialBranches: { state: "ok", value: { rows: [], command: "fixture" } },
    pagesServing: {
      state: "ok",
      value: {
        key: "main/0000000000000000000000000000000000000000",
        observation: {
          $schema: "pages-serving/v1",
          observedAt: "2026-09-19T06:00:00Z",
          site: "https://example.github.io/fixture/",
          urls: [{ url: "https://example.github.io/fixture/", status: 200, bytes: 18000, expectedPage: true }],
        },
      },
    },
    ...over,
  };
}

describe("lsi-indexes (cat-harness#1144: the LSI page's health half)", () => {
  const ev = (results: ("pass" | "fail" | "n/a")[]): HealthContext["lsiIndexes"] => ({
    state: "ok",
    value: {
      from: "the checkout",
      graphs: results.map((result, i) => ({ graph: `inst/g${i}`, result, detail: `detail ${i}`, command: `bun run cat lsi index --instance inst --graph g${i}` })),
      indexes: [{ graph: "inst/g0", narrowDimensions: 2, nearDuplicates: 5, sidecar: "cat-harness/test/results/lsi/inst/g0.lsi.json" }],
    },
  });

  it("every needed index fresh is ok; another repository is not applicable; an unread store is unknown", () => {
    expect(lsiIndexHealthCheck(healthyContext({ lsiIndexes: ev(["pass", "n/a"]) })).state).toBe("ok");
    expect(lsiIndexHealthCheck(healthyContext()).reason).toContain("not applicable");
    expect(lsiIndexHealthCheck(healthyContext({ lsiIndexes: { state: "unknown", reason: "qa-reports miss" } })).state).toBe("unknown");
  });

  it("the probe reads nothing for a repository that is not the harness", () => {
    expect(probeLsiIndexes("/some/other/instance", "/the/harness").state).toBe("absent");
  });

  it("a needed index that is missing or stale is a minor finding naming the command that builds it", () => {
    const r = lsiIndexHealthCheck(healthyContext({ lsiIndexes: ev(["pass", "fail", "n/a"]) }));
    expect(r.state).toBe("finding");
    expect(r.findings.map((f) => f.severity)).toEqual(["minor"]);
    expect(r.findings[0]!.action).toContain("bun run cat lsi index --instance inst --graph g1");
    expect(r.measurements.find((m) => m.metric === "lsi-graphs-needing-index")!.value).toBe(2);
    expect(r.measurements.find((m) => m.metric === "lsi-near-duplicate-pairs:inst/g0")!.value).toBe(5);
    expect(HealthCheckResultSchema.safeParse(r).success).toBe(true);
  });
});

describe("library-keywords (cat-harness#1144)", () => {
  const ev = (rows: [number, boolean][]): HealthContext["libraryKeywords"] => ({
    state: "ok",
    value: rows.map(([keywords, legacy], i) => ({ entry: `lib/e${i}`, keywords, legacy })),
  });

  it("every entry with keywords and no legacy file is ok; no probe is not applicable; an error is unknown", () => {
    expect(libraryKeywordsHealthCheck(healthyContext({ libraryKeywords: ev([[12, false], [3, false]]) })).state).toBe("ok");
    expect(libraryKeywordsHealthCheck(healthyContext()).reason).toContain("not applicable");
    expect(libraryKeywordsHealthCheck(healthyContext({ libraryKeywords: { state: "unknown", reason: "x" } })).state).toBe("unknown");
  });

  it("an entry with no keywords and a committed keywords.json are separate minor findings naming the entries", () => {
    const r = libraryKeywordsHealthCheck(healthyContext({ libraryKeywords: ev([[12, false], [0, false], [5, true]]) }));
    expect(r.state).toBe("finding");
    expect(r.findings.map((f) => f.metric)).toEqual(["library-keywords-entries-without", "library-keywords-legacy-files"]);
    expect(r.findings.every((f) => f.severity === "minor")).toBe(true);
    expect(r.findings[0]!.summary).toContain("lib/e1");
    expect(r.findings[1]!.summary).toContain("lib/e2");
    expect(HealthCheckResultSchema.safeParse(r).success).toBe(true);
  });

  it("the probe: no library is absent, a throw is unknown", () => {
    expect(probeLibraryKeywords("/x", () => ({ libraries: 0, entries: [] })).state).toBe("absent");
    expect(probeLibraryKeywords("/x", () => { throw new Error("boom"); }).state).toBe("unknown");
  });
});

describe("remote-mounts (folio-assistant#2467, decision 3)", () => {
  const ev = (outcomes: { instance: string; state: string; detail?: string }[]): HealthContext["remoteMounts"] => ({
    state: "ok",
    value: { outcomes, command: "fixture" },
  });

  it("every declared instance mounted is ok; nothing declared is not applicable", () => {
    expect(remoteMountHealthCheck(healthyContext({ remoteMounts: ev([{ instance: "a", state: "mounted" }, { instance: "b", state: "local" }]) })).state).toBe("ok");
    expect(remoteMountHealthCheck(healthyContext({ remoteMounts: { state: "absent", reason: "no `remoteMounts` declared" } })).reason).toContain("not applicable");
    expect(remoteMountHealthCheck(healthyContext({ remoteMounts: { state: "unknown", reason: "x" } })).state).toBe("unknown");
  });

  it("one not mounted is a major finding whose action names what a person does", () => {
    const r = remoteMountHealthCheck(
      healthyContext({
        remoteMounts: ev([
          { instance: "a", state: "mounted" },
          { instance: "b", state: "missing", detail: "`b/` already exists, no lock says this mount put it there, and it is not the pinned bytes (differ: `b/x.ts`)" },
          { instance: "c", state: "missing", detail: "not mounted: no consent for this pin" },
        ]),
      }),
    );
    expect(r.state).toBe("finding");
    expect(r.findings.map((f) => f.severity)).toEqual(["major", "major"]);
    expect(r.findings[0]!.action).toContain("Move the edits upstream");
    expect(r.findings[1]!.action).toContain("consent");
    expect(r.measurements.find((m) => m.metric === "remote-mounts-not-mounted")!.value).toBe(2);
  });
});

function previews(n: number, each: number): StagingPreview[] {
  return Array.from({ length: n }, (_, i) => ({ slug: `claude-p${i}`, bytes: each, files: 700 }));
}

/** Findings named by the metric they breached — assert by naming, not counting. */
function metrics(r: { findings: { metric?: string }[] }): (string | undefined)[] {
  return r.findings.map((f) => f.metric);
}

describe("staging-preview-size", () => {
  it("fires at `major` over the owner's 3 GB budget — the rotation's own constant", () => {
    // NINE previews at 350 MiB, the size they had reached by 2026-10-04: 3.08 GB.
    // The budget was 500 MB until the owner replaced the #1868 count cap with a
    // size budget ("Cap by size, not count", "3gb"); this check now reads the
    // same constant the deploy rotation enforces.
    const r = stagingSizeCheck(healthyContext({
      staging: { state: "ok", value: { branch: "present", previews: previews(9, 350 * MB), command: "fixture" } },
    }));
    expect(r.state).toBe("finding");
    expect(metrics(r)).toEqual(["staging-total-bytes"]);
    expect(r.findings[0].severity).toBe("major");
    expect(r.findings[0].summary).toContain("3.08 GB");
    expect(r.findings[0].summary).toContain("3.00 GB");
    expect(r.thresholds.find((t) => t.metric === "staging-total-bytes")?.value).toBe(MAX_PREVIEW_BYTES);
    // The action never removes anything — it asks.
    expect(r.findings[0].action).toContain("staging:cleanup");
  });

  it("history: 500 MB of ~37 MB previews is no longer a finding", () => {
    // FOURTEEN previews at the size measured on gh-pages (36.7–37.6 MB each).
    //
    // It was three, against a 100 MB threshold. The owner raised it to 500 MB
    // on 2026-09-20 together with `folio-assistant-1feu`, which made a merged
    // pull request's preview go away automatically. That is what changed the
    // meaning: the total used to be MONOTONIC, so any threshold was breached
    // once and stayed breached; now the store drains and what remains is
    // bounded by concurrent reviews. 500 MB is about thirteen of them, so
    // fourteen is the first breach.
    // (The fourteen-preview case the 500 MB budget was calibrated on, kept to
    // pin that the old number is gone rather than merely raised in prose.)
    const r = stagingSizeCheck(healthyContext({
      staging: { state: "ok", value: { branch: "present", previews: previews(14, 37 * MB), command: "fixture" } },
    }));
    expect(r.state).toBe("ok");
  });

  it("just under the budget is not a finding", () => {
    // Eight at 350 MiB is 2.73 GB.
    const r = stagingSizeCheck(healthyContext({
      staging: { state: "ok", value: { branch: "present", previews: previews(8, 350 * MB), command: "fixture" } },
    }));
    expect(r.state).toBe("ok");
  });

  it("thirteen concurrent reviews is UNDER the threshold — the number means a concurrency", () => {
    // The point of the raise. Thirteen at ~37 MB is 481 MB: this repository's
    // realistic ceiling of simultaneous open reviews should not read as a
    // finding, or the signal is a permanent verdict again rather than news.
    const r = stagingSizeCheck(healthyContext({
      staging: { state: "ok", value: { branch: "present", previews: previews(13, 37 * MB), command: "fixture" } },
    }));
    expect(r.state).toBe("ok");
  });

  it("NEVER escalates past `major`, however far over — the split, bean `qj9a`", () => {
    // This test used to assert `critical` at 777 MB, over a second threshold at
    // three-quarters of GitHub's documented 1 GB. That threshold's whole
    // justification was a publish consequence nothing here can observe, so it
    // moved to `pages-publish-health` along with its argument. What is left is
    // the owner's 500 MB budget, and being over a budget is `major`.
    //
    // Asserted at an ABSURD size rather than just past the line: 21 previews is
    // ~777 MB, but 100 of them is 3.7 GB and still must not manufacture a
    // `critical`. A test at 777 MB alone would pass against a check that
    // escalated at some higher number nobody had noticed.
    for (const n of [9, 100]) {
      const r = stagingSizeCheck(healthyContext({
        staging: { state: "ok", value: { branch: "present", previews: previews(n, 350 * MB), command: "fixture" } },
      }));
      expect(r.state).toBe("finding");
      // ONE breach, not one per threshold: the count must track what is wrong,
      // not how many thresholds happen to be declared.
      expect(r.findings).toHaveLength(1);
      expect(r.findings[0].severity).toBe("major");
      // Asserted on the RESULT's thresholds rather than on the module constant:
      // that is what a consumer reads, and a constant could be exported while
      // the check served a different list.
      expect(r.thresholds.some((t) => t.severity === "critical")).toBe(false);
    }
  });

  it("the size finding does NOT predict a failed publish — bean `qj9a`", () => {
    // THE DEFECT THIS PINS, and it was live for two and a half days. The
    // threshold's basis read: "the next deploy is the one that fails to publish
    // — so something is about to be lost". That is a claim about GitHub's
    // ENFORCEMENT, and nothing in this repository can observe it: the served
    // site, `/repos/:o/:r/pages` and `/pages/builds` are all refused by egress
    // policy. Measured 2026-09-25 off `origin/gh-pages` itself — 2.67 GB served,
    // 2.7x the documented limit, crossed on 2026-09-23 — and nothing had been
    // lost.
    //
    // Asserted on the TEXT because that is where the claim lives. A severity is
    // a number and carries no argument; the basis is the argument, and this one
    // was wrong in a way no type or count could catch.
    const r = stagingSizeCheck(healthyContext({
      staging: {
        state: "ok",
        value: {
          branch: "present",
          previews: [{ slug: "a", bytes: 3500 * 1024 * 1024, files: 1 }],
          command: "fixture",
        },
      },
    }));
    const f = r.findings[0];
    expect(f.severity).toBe("major");
    // THE PREDICTION MUST NOT BE MADE where a reader acts — the summary and the
    // action. This first version of the test also banned the phrase from the
    // BASIS and failed, correctly: the basis QUOTES the old wording in order to
    // record what was wrong, which is this repository's convention and is worth
    // more than a clean grep. So the rule is about whether the claim is
    // asserted, not whether the words occur.
    const t = r.thresholds.find((x) => x.metric === "staging-total-bytes");
    for (const text of [f.action, f.summary]) {
      expect(text).not.toContain("about to be lost");
      expect(text).not.toContain("the next deploy is the one that fails");
    }
    // In the basis the phrase may appear ONLY as a superseded quotation. If a
    // later edit restores the prediction as the basis's own claim, the marker
    // will be gone and this fails — which is the regression worth catching.
    if ((t?.basis ?? "").includes("about to be lost")) {
      expect(t?.basis).toContain("USED TO PREDICT");
    }
    // ...and the finding must still SAY something rather than merely omit the
    // wrong thing: a check whose summary was empty would pass the bans above.
    // What it says now is the owner's budget, which is all this check owns after
    // the split — the serving language moved to `pages-publish-health`, and the
    // test for it lives with that check rather than here.
    expect(f.summary).toContain("budget the deploy rotation enforces");
    expect(f.action).toContain("staging:cleanup");
    expect(t?.basis).toBeDefined();
  });

  it("a branch that was read and carries no previews is a determined `ok`", () => {
    const r = stagingSizeCheck(healthyContext({
      staging: { state: "ok", value: { branch: "present", previews: [], command: "fixture" } },
    }));
    expect(r.state).toBe("ok");
    expect(r.measurements.find((m) => m.metric === "staging-total-bytes")?.value).toBe(0);
  });

  it("an unreadable publish branch is `unknown` — never 0 MB of previews", () => {
    const r = stagingSizeCheck(healthyContext({
      staging: { state: "unknown", reason: "git ls-remote origin gh-pages exited 128: could not read Username" },
    }));
    expect(r.state).toBe("unknown");
    expect(r.reason).toContain("ls-remote");
    // The distinction that matters: no measurement was invented to stand in.
    expect(r.measurements).toHaveLength(0);
    expect(r.findings).toHaveLength(0);
  });
});

describe("staging-preview-orphans", () => {
  it("names the preview whose PR is closed, and leaves the open one alone", () => {
    const r = stagingOrphanCheck(healthyContext({
      staging: {
        state: "ok",
        value: {
          branch: "present",
          previews: [
            { slug: "claude-live", bytes: 37 * MB, files: 700 },
            { slug: "claude-merged-last-week", bytes: 36 * MB, files: 690 },
          ],
          command: "fixture",
        },
      },
      openPrHeads: { state: "ok", value: ["claude/live"] },
    }));
    expect(r.state).toBe("finding");
    expect(r.findings.map((f) => f.summary)).toEqual([
      expect.stringContaining("branches/claude-merged-last-week"),
    ]);
    expect(r.findings[0].severity).toBe("minor");
    expect(r.findings[0].action).toContain("Ask the owner");
  });

  it("never judges `STAGING/_retired`, the retired-record store, as a preview", () => {
    // folio-assistant#860 named `_retired` an orphan: it has no branch and no
    // PR because it is not a preview at all.
    const r = stagingOrphanCheck(healthyContext({
      staging: {
        state: "ok",
        value: {
          branch: "present",
          previews: [
            { slug: "_retired", bytes: 319 * 1024, files: 367 },
            { slug: "claude-live", bytes: 37 * MB, files: 700 },
          ],
          command: "fixture",
        },
      },
      openPrHeads: { state: "ok", value: ["claude/live"] },
    }));
    expect(r.state).toBe("ok");
    expect(JSON.stringify(r.findings)).not.toContain("_retired");
    expect(r.measurements.find((m) => m.metric === "staging-orphan-count")?.value).toBe(0);
    expect(r.measurements.find((m) => m.metric === "staging-live-count")?.value).toBe(1);
  });

  it("is `unknown` when the PR list could not be fetched, rather than calling every preview an orphan", () => {
    const r = stagingOrphanCheck(healthyContext({
      staging: { state: "ok", value: { branch: "present", previews: previews(6, 37 * MB), command: "fixture" } },
      openPrHeads: { state: "unknown", reason: "GitHub API returned 403 for litlfred/folio-assistant/pulls" },
    }));
    expect(r.state).toBe("unknown");
    expect(r.findings).toHaveLength(0);
    expect(r.reason).toContain("403");
  });

  it("slugifies the branch the way feature-staging.yml does, and only forwards", () => {
    expect(stagingSlug("claude/health-checks")).toBe("claude-health-checks");
    expect(stagingSlug("feat/a//b")).toBe("feat-a-b");
    expect(stagingSlug("-lead-and-trail-")).toBe("lead-and-trail");
    // `claude/a-b` and `claude-a-b` collide, which is exactly why the check
    // never tries to recover a branch name from a directory name.
    expect(stagingSlug("claude/a-b")).toBe(stagingSlug("claude-a-b"));
  });
});

/**
 * The liveness signals, one at a time and then together.
 *
 * **Every test here names the preview it is about.** A count would pass while
 * the wrong preview was spared, and sparing the wrong one is how a live
 * collaborator's review artefact gets proposed for removal — which is the
 * failure bean `w2g5` reports and the only one this check must never produce.
 *
 * `NOW` and the fixture dates are chosen so each test turns on ONE difference
 * from the one before it.
 */
describe("staging-preview-orphans — liveness", () => {
  const NOW = new Date("2026-09-19T12:00:00Z");

  function branchSet(over: Partial<BranchEvidenceSet> = {}): BranchEvidenceSet {
    return { candidates: [], defaultBranch: "main", command: "fixture", ...over };
  }

  /** A context whose only preview is `slug`, with the branches and PRs given. */
  function withPreview(
    slug: string,
    openPrHeads: string[],
    branches: BranchEvidenceSet,
    extra: StagingPreview[] = [],
  ): HealthContext {
    return healthyContext({
      now: NOW,
      staging: {
        state: "ok",
        value: {
          branch: "present",
          previews: [{ slug, bytes: 37 * MB, files: 700 }, ...extra],
          command: "fixture",
        },
      },
      openPrHeads: { state: "ok", value: openPrHeads },
      branches: { state: "ok", value: branches },
    });
  }

  describe("each signal, firing on its own", () => {
    it("`open-pr` spares a preview whose branch is merged and long idle", () => {
      const l = previewLiveness(
        "claude-live",
        ["claude/live"],
        branchSet({
          candidates: [{ ref: "claude/live", mergedIntoDefault: true, headCommittedAt: "2026-08-01T00:00:00Z" }],
        }),
        NOW,
      );
      expect(l.slug).toBe("claude-live");
      expect(l.live).toEqual(["open-pr"]);
    });

    it("`unmerged-branch` spares a preview with no PR whose branch carries work not in `main`", () => {
      const l = previewLiveness(
        "claude-carries-work",
        [],
        branchSet({
          candidates: [
            // Three days idle: far outside the recency horizon, so this is the
            // unmerged signal alone and nothing else.
            { ref: "claude/carries-work", mergedIntoDefault: false, headCommittedAt: "2026-09-16T12:00:00Z" },
          ],
        }),
        NOW,
      );
      expect(l.live).toEqual(["unmerged-branch"]);
    });

    it("`recent-commit` spares a preview in the gap between one PR merging and the next — the window nothing else covers", () => {
      // The shape of the gap: the merge commit has put the branch back INSIDE
      // `main`, so `unmerged-branch` is silent, and the next PR does not exist
      // yet, so `open-pr` is silent too. Only recency is left.
      const l = previewLiveness(
        "claude-between-prs",
        [],
        branchSet({
          candidates: [
            { ref: "claude/between-prs", mergedIntoDefault: true, headCommittedAt: "2026-09-19T11:55:00Z" },
          ],
        }),
        NOW,
      );
      expect(l.live).toEqual(["recent-commit"]);
    });

    it("stops sparing on recency one minute past the horizon, and the horizon is the declared threshold", () => {
      const at = (minutesAgo: number): string => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
      const judge = (minutesAgo: number) =>
        previewLiveness(
          "claude-idle",
          [],
          branchSet({
            candidates: [{ ref: "claude/idle", mergedIntoDefault: true, headCommittedAt: at(minutesAgo) }],
          }),
          NOW,
        );
      expect(judge(RECENT_COMMIT_MINUTES - 1).live).toEqual(["recent-commit"]);
      expect(judge(RECENT_COMMIT_MINUTES).live).toEqual(["recent-commit"]);
      expect(judge(RECENT_COMMIT_MINUTES + 1).live).toEqual([]);
      // The number in the report is the number the code compares against.
      const t = ORPHAN_THRESHOLDS.find((x) => x.metric === "preview-branch-idle-minutes");
      expect(t?.value).toBe(RECENT_COMMIT_MINUTES);
      expect(t?.unit).toBe("minutes");
      expect(t?.basis).toContain("NO EXTERNAL STANDARD");
    });

    it("a tip dated in the future reads as recent, because clock skew must not convict", () => {
      const l = previewLiveness(
        "claude-skewed",
        [],
        branchSet({
          candidates: [{ ref: "claude/skewed", mergedIntoDefault: true, headCommittedAt: "2026-09-19T12:30:00Z" }],
        }),
        NOW,
      );
      expect(l.live).toEqual(["recent-commit"]);
    });
  });

  it("does NOT report the `claude-brave-hypatia-r820sf` shape — the regression this was rewritten for", () => {
    // Bean `w2g5`, measured 2026-09-19: no open pull request (all five of its
    // PRs closed), the branch present on the remote, NOT an ancestor of
    // `main`, and a 343-line commit two minutes before the sweep ran. The old
    // check named it an orphan and invited a person to remove a live
    // collaborator's review artefact.
    const ctx = withPreview(
      "claude-brave-hypatia-r820sf",
      [],
      branchSet({
        candidates: [
          {
            ref: "claude/brave-hypatia-r820sf",
            mergedIntoDefault: false,
            headCommittedAt: "2026-09-19T11:58:00Z",
          },
        ],
      }),
    );
    const r = stagingOrphanCheck(ctx);
    expect(r.state).toBe("ok");
    expect(r.findings).toEqual([]);
    // Named rather than counted: the slug must appear in nothing a reader is
    // invited to act on. (It appears in the threshold's `basis`, which is the
    // measurement this horizon was calibrated from, and that is the point.)
    expect(JSON.stringify(r.findings)).not.toContain("brave-hypatia");
    expect(r.measurements.find((m) => m.metric === "staging-orphan-count")?.value).toBe(0);
    expect(r.measurements.find((m) => m.metric === "staging-live-count")?.value).toBe(1);
    // The regression made visible rather than implied: the signal the OLD
    // check relied on is silent here — there is no open pull request — and
    // the preview is spared anyway, by the two signals that did not exist.
    const l = previewLiveness("claude-brave-hypatia-r820sf", [], ctx.branches.state === "ok" ? ctx.branches.value : branchSet(), NOW);
    expect(l.live).not.toContain("open-pr");
    expect(l.undetermined).toBeUndefined();
    // And both signals that spared it are visible, not just the verdict.
    expect(previewLiveness("claude-brave-hypatia-r820sf", [], ctx.branches.state === "ok" ? ctx.branches.value : branchSet(), NOW).live)
      .toEqual(["unmerged-branch", "recent-commit"]);
  });

  it("STILL reports a genuinely dead preview — merged, no PR, long idle", () => {
    const r = stagingOrphanCheck(
      withPreview(
        "claude-merged-last-week",
        [],
        branchSet({
          candidates: [
            { ref: "claude/merged-last-week", mergedIntoDefault: true, headCommittedAt: "2026-09-08T09:00:00Z" },
          ],
        }),
      ),
    );
    expect(r.state).toBe("finding");
    expect(r.findings.map((f) => f.summary)).toEqual([
      expect.stringContaining("branches/claude-merged-last-week"),
    ]);
    // The evidence travels with the name, so a reader can see WHICH signals were silent.
    expect(r.findings[0].summary).toContain("no open pull request");
    expect(r.findings[0].summary).toContain("already in `main`");
    expect(r.findings[0].summary).toContain("11 days");
    expect(r.measurements.find((m) => m.metric === "staging-orphan-count")?.value).toBe(1);
  });

  it("reports a preview no branch on the remote answers for — a determined empty is not a blind spot", () => {
    // The branch was deleted after its merge. The remote WAS listed and
    // nothing on it slugifies to this preview, which is an answer, not a
    // failure to look.
    const r = stagingOrphanCheck(withPreview("claude-branch-gone", [], branchSet({ candidates: [] })));
    expect(r.state).toBe("finding");
    expect(r.findings[0].summary).toContain("branches/claude-branch-gone");
    expect(r.findings[0].summary).toContain("no branch on the remote slugifies to it");
  });

  it("names the remedy a person can actually invoke, since the label alone cannot reach a closed PR", () => {
    const r = stagingOrphanCheck(withPreview("claude-branch-gone", [], branchSet()));
    const action = r.findings[0].action;
    expect(action).toContain("staging:cleanup");
    expect(action).toContain("cleanup_slug: claude-branch-gone");
    expect(action).toContain("cleanup_confirm: claude-branch-gone");
    expect(action).toContain("Leaving it is a valid answer");
    // Nothing in this check ever removes anything.
    expect(action).not.toMatch(/\brm -rf\b/);
  });

  describe("a signal that cannot be evaluated", () => {
    const blindBranch = {
      ref: "claude/unreadable",
      headCommittedAt: "2026-09-08T09:00:00Z",
      unevaluated: "git merge-base --is-ancestor exited 128: bad object",
    };

    it("sends that preview to `unknown`, never to the orphan list", () => {
      const r = stagingOrphanCheck(
        withPreview("claude-unreadable", [], branchSet({ candidates: [blindBranch] })),
      );
      expect(r.state).toBe("unknown");
      expect(r.findings).toEqual([]);
      expect(r.reason).toContain("branches/claude-unreadable");
      expect(r.reason).toContain("bad object");
    });

    it("takes the WHOLE check to `unknown`, and still names the orphan it had determined", () => {
      // `unknown` outranks `findings` at every level of this family —
      // `healthVerdict` one layer up, `probeStaging` one layer down. A blind
      // check must not hide behind a sighted one; the determined orphan is
      // named in the reason so the measurement is not lost either.
      const r = stagingOrphanCheck(
        withPreview("claude-unreadable", [], branchSet({ candidates: [blindBranch] }), [
          { slug: "claude-clearly-dead", bytes: 36 * MB, files: 690 },
        ]),
      );
      expect(r.state).toBe("unknown");
      expect(r.findings).toEqual([]);
      expect(r.reason).toContain("branches/claude-clearly-dead");
      expect(r.reason).toContain("Determined but NOT reported");
    });

    it("does not blind a preview another signal has already spared", () => {
      // Liveness is a disjunction: one true disjunct settles it, so an
      // unreadable ancestry cannot turn "leave it alone" into "I do not know".
      const l = previewLiveness("claude-unreadable", ["claude/unreadable"], branchSet({ candidates: [blindBranch] }), NOW);
      expect(l.live).toEqual(["open-pr"]);
      expect(l.undetermined).toBeUndefined();
    });

    it("is `unknown` when the branches could not be listed at all, rather than calling every preview an orphan", () => {
      const r = stagingOrphanCheck(
        healthyContext({
          staging: { state: "ok", value: { branch: "present", previews: previews(6, 37 * MB), command: "fixture" } },
          openPrHeads: { state: "ok", value: [] },
          branches: { state: "unknown", reason: "git ls-remote --heads origin exited 128: could not read Username" },
        }),
      );
      expect(r.state).toBe("unknown");
      expect(r.findings).toEqual([]);
      expect(r.reason).toContain("ls-remote");
      expect(r.reason).toContain("w2g5");
    });
  });
});

describe("repository-size", () => {
  it("fires `minor` past the 250 MB early-warning point", () => {
    const r = repositorySizeCheck(healthyContext({
      repoSize: {
        state: "ok",
        value: { gitDirBytes: 300 * MB, trackedBytes: TRACKED_WARN_BYTES + MB, packs: 1, packBytes: 290 * MB },
      },
    }));
    expect(metrics(r)).toEqual(["tracked-tree-bytes"]);
    expect(r.findings[0].severity).toBe("minor");
  });

  it("fires `major` past GitHub's documented 1 GB recommendation", () => {
    const r = repositorySizeCheck(healthyContext({
      repoSize: {
        state: "ok",
        value: { gitDirBytes: 2000 * MB, trackedBytes: TRACKED_MAJOR_BYTES + MB, packs: 1, packBytes: 1900 * MB },
      },
    }));
    expect(r.findings.find((f) => f.metric === "tracked-tree-bytes")?.severity).toBe("major");
  });

  it("fires on the history-to-tree ratio — this repository's own shape on 2026-09-19", () => {
    // 349 MB of .git against 29 MB of blobs at HEAD: 12.0x.
    const r = repositorySizeCheck(healthyContext({
      repoSize: { state: "ok", value: { gitDirBytes: 349 * MB, trackedBytes: 29 * MB, packs: 42, packBytes: 308 * MB } },
    }));
    expect(metrics(r)).toEqual(["git-dir-to-tree-ratio"]);
    expect(r.findings[0].summary).toContain("12.0x");
    // It sends the reader to `git gc` FIRST, because a high pack count is
    // local housekeeping and moves the number without history changing.
    expect(r.findings[0].action).toContain("git gc");
  });

  it("does not fire the ratio on a small clone, however lopsided", () => {
    const r = repositorySizeCheck(healthyContext({
      repoSize: { state: "ok", value: { gitDirBytes: 2 * MB, trackedBytes: 0.1 * MB, packs: 1, packBytes: 2 * MB } },
    }));
    expect(r.state).toBe("ok");
  });

  it("is `unknown` when git could not be asked", () => {
    const r = repositorySizeCheck(healthyContext({
      repoSize: { state: "unknown", reason: "git count-objects -v exited 128" },
    }));
    expect(r.state).toBe("unknown");
    expect(r.measurements).toHaveLength(0);
  });
});

describe("bean-rendered-decision-records", () => {
  // Bean `hajp`, 2026-09-21. `bean-decision-records` counts beans with an
  // `## Options` heading; the gating condition it was read against wanted
  // decisions put THROUGH `DecisionRequestSchema`. Measured on the live store:
  // 10 of the first, 0 of the second. A threshold over the wrong population
  // cannot be met meaningfully and would have been read as met.
  it("an `## Options` heading is NOT a rendered decision", () => {
    expect(hasRenderedDecision("## Options\n\n1. **A** — do a thing\n2. **B** — do another")).toBe(false);
  });

  it("all five rows are required — four is not a rendered decision", () => {
    const four = [
      "| **What it does** | x |",
      "| **Pro** | x |",
      "| **Con** | x |",
      "| **Downstream** | x |",
    ].join("\n");
    expect(hasRenderedDecision(four)).toBe(false);
  });

  it("the table `renderDecision` emits is recognised", () => {
    const table = renderDecision({
      decides: "whether x or y",
      glossary: {},
      options: [
        { label: "a", does: "x", pro: "x", con: "x", downstream: "x", reversibility: "x" },
        { label: "b", does: "y", pro: "y", con: "y", downstream: "y", reversibility: "y" },
      ],
      recommends: "a",
      because: "x",
      ifSilent: "a",
      question: "a or b?",
      othersPending: 0,
    });
    expect(hasRenderedDecision(table)).toBe(true);
  });
});

describe("bean-store", () => {
  const bean = (o: Partial<BeanEvidence> & { id: string }): BeanEvidence => ({
    title: `title ${o.id}`,
    status: "todo",
    ...o,
  });

  // ── Bean `8unf`: a session is a LOG, not a roadmap root ──────────────
  //
  // qou, 2026-10-04: 292 of 353 epics were "Session:" logs, because two
  // skills told every session to mint one. Report-only, OPEN beans only.
  describe("bean-session-log-roots", () => {
    const run = (value: BeanEvidence[]) => beanStoreCheck(healthyContext({ beans: { state: "ok", value } }));

    it("flags an open Session/Handoff epic or milestone", () => {
      const r = run([
        bean({ id: "s1", title: "Session: claude/foo — fix bar", type: "milestone", status: "in-progress" }),
        bean({ id: "s2", title: "SESSION 3 - lean sweep", type: "epic" }),
        bean({ id: "h1", title: "Handoff: lean build arc", type: "epic" }),
        bean({ id: "h2", title: "Handover — Q4", type: "milestone" }),
      ]);
      const f = r.findings.filter((x) => x.metric === "bean-session-log-roots");
      expect(f.map((x) => x.summary.slice(1, 3)).sort()).toEqual(["h1", "h2", "s1", "s2"]);
      expect(f.every((x) => x.severity === "minor")).toBe(true);
      expect(f[0].action).toContain("never `beans delete`");
      expect(r.measurements.find((m) => m.metric === "bean-session-log-roots")?.value).toBe(4);
    });

    it("does not flag a session-titled TASK, a closed log, a mid-title 'session', or an untyped bean", () => {
      const r = run([
        bean({ id: "t1", title: "Session: notes", type: "task" }),
        bean({ id: "c1", title: "Session: old", type: "epic", status: "completed" }),
        bean({ id: "c2", title: "Session: rejected", type: "milestone", status: "scrapped" }),
        bean({ id: "m1", title: "PROCESS: the session-start sweep", type: "epic" }),
        bean({ id: "u1", title: "Session: untyped" }),
      ]);
      expect(metrics(r)).not.toContain("bean-session-log-roots");
      expect(r.measurements.find((m) => m.metric === "bean-session-log-roots")?.value).toBe(0);
    });

    it("sessionLogRootBeans is the same answer the check gives", () => {
      const beans = [
        bean({ id: "s1", title: "Session: x", type: "epic" }),
        bean({ id: "e1", title: "QA: verdicts", type: "epic" }),
      ];
      expect(sessionLogRootBeans(beans).map((b) => b.id)).toEqual(["s1"]);
      const flagged = run(beans)
        .findings.filter((x) => x.metric === "bean-session-log-roots")
        .map((x) => /^`([^`]+)`/.exec(x.summary)?.[1]);
      expect(flagged).toEqual(sessionLogRootBeans(beans).map((b) => b.id));
    });
  });

  // ── Bean `thux`: a claim worked through its CHILDREN is not quiet ─────
  //
  // `bean-quiet-claims` reads one signal — `updated_at` on the bean's own
  // file — and for a task that is right. For a bean worked through its
  // children nothing touches the parent while they move, so it accrued quiet
  // hours for doing exactly what it is for, and the finding had no action:
  // refreshing it means editing a file for no reason, which is `o5qj`'s shape
  // one check over. Measured 2026-09-23: 39 quiet claims, 8 of them parenting
  // work that had moved inside the window.
  //
  // `QUIET` is 72 hours; the fixture clock is 2026-09-19T12:00:00Z.
  const longAgo = "2026-09-14T12:00:00Z"; // 120 h — quiet
  const justNow = "2026-09-19T06:00:00Z"; // 6 h  — moving

  it("a claim whose CHILD moved is not reported quiet", () => {
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "epic", status: "in-progress", updatedAt: longAgo }),
          bean({ id: "kid", status: "in-progress", updatedAt: justNow, parent: "epic" }),
        ],
      },
    }));
    expect(metrics(r)).not.toContain("bean-quiet-claims");
  });

  it("...but it is still COUNTED — `dh4f`", () => {
    // "No claim went quiet" and "the quiet ones were parents of moving work"
    // must not read the same. Nothing thresholds this.
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "epic", status: "in-progress", updatedAt: longAgo }),
          bean({ id: "kid", status: "in-progress", updatedAt: justNow, parent: "epic" }),
        ],
      },
    }));
    const m = r.measurements.find((x) => x.metric === "bean-quiet-claims-parenting-live-work");
    expect(m?.value).toBe(1);
    expect(r.measurements.find((x) => x.metric === "bean-quiet-claims")?.value).toBe(0);
  });

  it("a parent whose children are ALL quiet still fires — the discrimination", () => {
    // `bzyu` on the real store: 8 open children, none moving. Without this the
    // change would excuse every parent and the check would stop saying
    // anything about the beans it exists for.
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "epic", status: "in-progress", updatedAt: longAgo }),
          bean({ id: "kid", status: "in-progress", updatedAt: longAgo, parent: "epic" }),
        ],
      },
    }));
    expect(metrics(r)).toContain("bean-quiet-claims");
    // Both of them: the child is quiet on its own account too.
    expect(r.findings.filter((f) => f.metric === "bean-quiet-claims").length).toBe(2);
  });

  it("a CHILDLESS quiet claim is untouched by any of this", () => {
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [bean({ id: "lone", status: "in-progress", updatedAt: longAgo })],
      },
    }));
    expect(metrics(r)).toEqual(["bean-quiet-claims"]);
    expect(r.measurements.find((x) => x.metric === "bean-quiet-claims-parenting-live-work")?.value).toBe(0);
  });

  it("keyed on PARENTHOOD, not on `type: epic`", () => {
    // The relation carries the argument; `type` is a label a bean sets about
    // itself while `parent` is a fact another bean asserts about it. The
    // fixture's parent has no type at all and is still excused.
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "plain", status: "in-progress", updatedAt: longAgo }),
          bean({ id: "kid", status: "todo", updatedAt: justNow, parent: "plain" }),
        ],
      },
    }));
    expect(metrics(r)).not.toContain("bean-quiet-claims");
  });

  // ── Bean `7umv`: an action must name a mechanism that can reach its subject ──

  it("the ORPHAN action does not offer the label, because it cannot reach an orphan", () => {
    // `feature-staging.yml`'s `cleanup` reads labels from the
    // `pull_request_target: closed` payload, and a preview is only findable as
    // an orphan once that event has fired — so labelling afterwards fires
    // nothing (bean `w2g5`). The action used to name the label FIRST.
    // Measured cost: the owner applied it to both orphaned slugs and 201.2 MB
    // stayed exactly where it was.
    const r = stagingOrphanCheck(healthyContext({
      staging: {
        state: "ok",
        value: { branch: "present", previews: [{ slug: "gone-branch", bytes: 99 * MB, files: 10 }], command: "fixture" },
      },
      openPrHeads: { state: "ok", value: [] },
      branches: { state: "ok", value: { candidates: [], defaultBranch: "main", command: "fixture" } },
    }));
    expect(r.findings.length).toBeGreaterThan(0);
    const action = r.findings[0].action!;
    // The mechanism that WORKS is named, with the exact inputs.
    expect(action).toContain("workflow_dispatch");
    expect(action).toContain("cleanup_slug: gone-branch");
    expect(action).toContain("cleanup_confirm: gone-branch");
    // And the one that does not is named as not working, rather than omitted —
    // a reader who has already tried it needs to know why it did nothing.
    expect(action).toMatch(/DOES NOT WORK|does not work/);
    expect(action).toContain("w2g5");
    // Not offered: the label is named once, and that once is the sentence that
    // says it does not work — after the dispatch, never as a step to take.
    expect(action.split("staging:cleanup").length - 1).toBe(1);
    expect(action).toMatch(/`staging:cleanup` LABEL DOES NOT WORK/);
    expect(action.indexOf("workflow_dispatch")).toBeLessThan(action.indexOf("staging:cleanup"));
    expect(action).not.toMatch(/\b(apply|add)\b[^.]*\blabel\b/i);
  });

  it("fires `major` on a duplicate title — the 14,688-duplicate shape, at its leading edge", () => {
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "aaaa", title: "Drain the exposition swarm" }),
          bean({ id: "bbbb", title: "drain the exposition swarm" }),
          bean({ id: "cccc", title: "Something else" }),
        ],
      },
    }));
    expect(metrics(r)).toEqual(["bean-duplicate-title-groups"]);
    expect(r.findings[0].severity).toBe("major");
    expect(r.findings[0].summary).toContain("aaaa, bbbb");
    // The action is `scrapped`, and it says outright not to delete.
    expect(r.findings[0].action).toContain("scrapped");
    expect(r.findings[0].action).toContain("Never `beans delete`");
  });

  // ── Bean `o5qj`: the finding must be clearable BY ITS OWN ACTION ──────
  //
  // The action says to scrap the loser and never to delete it. Before `o5qj`
  // a scrapped bean stayed in its title group, so following the action left
  // the `major` finding exactly as it was — measured on the real store:
  // `qa1p` scrapped 2026-09-22T08:58:46Z naming `2yyh`, and the sweep 22 hours
  // later reported the pair unchanged. The only state that cleared it was
  // `beans delete`, which the action forbids.

  it("STOPS firing once the loser is `scrapped` — the action is the remedy", () => {
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "aaaa", title: "Drain the exposition swarm" }),
          bean({ id: "bbbb", title: "drain the exposition swarm", status: "scrapped" }),
        ],
      },
    }));
    expect(metrics(r)).toEqual([]);
  });

  it("but an adjudicated group is still COUNTED — `dh4f`", () => {
    // "No duplicate was ever created" and "every duplicate was resolved" must
    // not read the same. Nothing thresholds this; it exists to be legible.
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "aaaa", title: "Drain the exposition swarm" }),
          bean({ id: "bbbb", title: "drain the exposition swarm", status: "scrapped" }),
          bean({ id: "cccc", title: "Something else" }),
        ],
      },
    }));
    const m = r.measurements.find((x) => x.metric === "bean-duplicate-title-groups-adjudicated");
    expect(m?.value).toBe(1);
    expect(r.measurements.find((x) => x.metric === "bean-duplicate-title-groups")?.value).toBe(0);
  });

  it("`completed` is NOT adjudication — an open bean duplicating finished work still fires", () => {
    // The threshold's basis is accidental duplicates polluting the plan. Work
    // re-raised after it was done is exactly that, and `scrapped` is the one
    // status that records somebody having RULED on the duplication.
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "aaaa", title: "Drain the exposition swarm", status: "completed" }),
          bean({ id: "bbbb", title: "drain the exposition swarm" }),
        ],
      },
    }));
    expect(metrics(r)).toEqual(["bean-duplicate-title-groups"]);
  });

  it("a HALF-adjudicated group fires on what is left, and says the rest was settled", () => {
    // Three created, one scrapped: two still need a ruling. Naming the scrapped
    // one among them would send a reader to adjudicate a bean already
    // adjudicated; dropping it silently would lose the group's history.
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "aaaa", title: "Drain the exposition swarm" }),
          bean({ id: "bbbb", title: "drain the exposition swarm" }),
          bean({ id: "cccc", title: "DRAIN THE EXPOSITION SWARM", status: "scrapped" }),
        ],
      },
    }));
    expect(metrics(r)).toEqual(["bean-duplicate-title-groups"]);
    expect(r.findings[0].summary).toContain("aaaa, bbbb");
    expect(r.findings[0].summary).not.toContain("cccc");
    expect(r.findings[0].summary).toContain("1 more already `scrapped`");
  });

  it("fires on a decision record listing ONE option — MADR's refusal, made checkable", () => {
    // `madr.md`: "never fewer than two considered options — one option is not a
    // choice". THE FALSIFIER FOR THE WHOLE CRITERION: over the real store this
    // fires on nothing (2 records, both with 3 options), so without this the
    // detector could have been broken in either direction and still looked clean.
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "aaaa", title: "Pick a serialisation", consideredOptions: 1 }),
          bean({ id: "bbbb", title: "Ordinary work, no decision" }),
        ],
      },
    }));
    expect(metrics(r)).toEqual(["bean-thin-decision-records"]);
    expect(r.findings[0].severity).toBe("minor");
    expect(r.findings[0].summary).toContain("one option");
    // The action must offer the methodology's OWN escape — say why no
    // alternative existed — and must refuse the shortcut, or an agent reading it
    // will pad the list to two and the check will have made the record worse.
    expect(r.findings[0].action).toContain("WHY NO ALTERNATIVE EXISTED");
    expect(r.findings[0].action).toContain("Never invent a straw option");
  });

  it("an options section with NO items reads differently from one with a single option", () => {
    // Zero is not a smaller version of one. An empty section claims an analysis
    // that did not happen, and the remedy is the opposite — drop the section, or
    // fill it — so the two cannot share an action.
    const r = beanStoreCheck(healthyContext({
      beans: { state: "ok", value: [bean({ id: "aaaa", consideredOptions: 0 })] },
    }));
    expect(r.findings[0].summary).toContain("no options");
    expect(r.findings[0].action).toContain("or drop the section");
  });

  it("a bean with no options section is NOT a malformed decision record", () => {
    // The third state, and the one the check is likeliest to get wrong: most
    // beans record WORK, and `madr.md` says a work bean needs no such section.
    // Reading `undefined` as 0 would make all 172 of them findings.
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [bean({ id: "aaaa" }), bean({ id: "bbbb", consideredOptions: undefined })],
      },
    }));
    expect(metrics(r)).toEqual([]);
    const m = r.measurements.find((x) => x.metric === "bean-decision-records");
    expect(m?.value).toBe(0);
  });

  it("the SUBJECT COUNT is reported, so a detector that stops matching is not green", () => {
    // Nothing thresholds `bean-decision-records`, and it is emitted anyway. The
    // finding above can only fire on a bean this counts, so if the heading regex
    // is narrowed or a heading respelled, this drops to 0 rather than the check
    // passing over an empty walk — the trap `NoCheckScriptsFound` refuses one
    // layer along. Measured on the real store 2026-09-20: 2 subjects, 0 thin.
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "aaaa", consideredOptions: 3 }),
          bean({ id: "bbbb", consideredOptions: 2 }),
          bean({ id: "cccc" }),
        ],
      },
    }));
    expect(metrics(r)).toEqual([]);
    expect(r.measurements.find((x) => x.metric === "bean-decision-records")?.value).toBe(2);
    expect(r.measurements.find((x) => x.metric === "bean-thin-decision-records")?.value).toBe(0);
  });

  describe("a claim its own criteria say is finished — `fkjo`", () => {
    it("fires `minor` on an in-progress bean with every Done-when box ticked", () => {
      const r = beanStoreCheck(healthyContext({
        beans: {
          state: "ok",
          value: [
            bean({ id: "done", status: "in-progress", doneWhen: { kind: "all-ticked", total: 4 } }),
            bean({ id: "open", status: "in-progress", doneWhen: { kind: "open", ticked: 3, total: 4 } }),
          ],
        },
      }));
      expect(metrics(r)).toEqual(["bean-self-declared-done"]);
      expect(r.findings[0]!.severity).toBe("minor");
      expect(r.findings[0]!.summary).toContain("all 4 of its Done-when boxes ticked");
      // The action must not tell anybody to close it. `bean-coordination` closes
      // on evidence re-derived, never on the bean's own claim about itself, and
      // four of six such beans in the measurement had NOT all landed cleanly.
      expect(r.findings[0]!.action).toContain("RE-DERIVE");
    });

    // ── Bean `v9ah`: only a CLOSABLE bean is a finding ────────────────────
    // `bean-coordination` puts a mid-flight bean off limits; measured
    // 2026-09-25, every bean this finding named was mid-flight, so every
    // finding was one nobody could act on. Both excusals are REPORTED.
    const NOW_V9 = "2026-09-19T12:00:00Z"; // healthyContext's clock
    const hoursAgo = (h: number) => new Date(Date.parse(NOW_V9) - h * 3_600_000).toISOString();

    it("a ticked claim touched inside the window is mid-flight: counted, not a finding", () => {
      const r = beanStoreCheck(healthyContext({
        beans: {
          state: "ok",
          value: [
            bean({ id: "live", status: "in-progress", updatedAt: hoursAgo(10), doneWhen: { kind: "all-ticked", total: 3 } }),
          ],
        },
      }));
      expect(metrics(r)).toEqual([]);
      const m = (k: string) => r.measurements.find((x) => x.metric === k)?.value;
      expect(m("bean-self-declared-done")).toBe(0);
      expect(m("bean-self-declared-done-mid-flight")).toBe(1);
    });

    it("a ticked parent with an OPEN child is not done at any age — the `5a3l` case", () => {
      const r = beanStoreCheck(healthyContext({
        beans: {
          state: "ok",
          value: [
            bean({ id: "epic", status: "in-progress", updatedAt: hoursAgo(500), doneWhen: { kind: "all-ticked", total: 2 } }),
            bean({ id: "kid1", status: "todo", parent: "epic" }),
          ],
        },
      }));
      expect(metrics(r)).not.toContain("bean-self-declared-done");
      expect(r.measurements.find((x) => x.metric === "bean-self-declared-done-open-children")?.value).toBe(1);
    });

    it("the same parent with only CLOSED children, past the window, IS a finding — the discrimination", () => {
      const r = beanStoreCheck(healthyContext({
        beans: {
          state: "ok",
          value: [
            bean({ id: "epic", status: "in-progress", updatedAt: hoursAgo(500), doneWhen: { kind: "all-ticked", total: 2 } }),
            bean({ id: "kid1", status: "completed", parent: "epic" }),
          ],
        },
      }));
      expect(metrics(r)).toContain("bean-self-declared-done");
      const f = r.findings.find((x) => x.metric === "bean-self-declared-done")!;
      expect(f.summary).toContain("no open child");
      expect(f.action).toContain("you MAY act on it");
    });

    it("says nothing about a bean that is ticked but NOT claimed", () => {
      // A completed bean has every box ticked by construction. The finding is
      // about the disagreement between body and front matter, so with no claim
      // there is nothing to disagree with.
      const r = beanStoreCheck(healthyContext({
        beans: {
          state: "ok",
          value: [bean({ id: "shut", status: "completed", doneWhen: { kind: "all-ticked", total: 2 } })],
        },
      }));
      expect(metrics(r)).toEqual([]);
    });

    it("counts, and never reports, the two states it cannot judge", () => {
      // The `dh4f` rule: a clean run over a corpus the tool could not read is
      // worse than no run. `absent` and `unreadable` are measured so a person
      // can see how much of the store this check is blind to, and neither is
      // folded into the pass OR into the finding.
      const r = beanStoreCheck(healthyContext({
        beans: {
          state: "ok",
          value: [
            bean({ id: "none", status: "in-progress", doneWhen: { kind: "absent" } }),
            bean({ id: "prose", status: "in-progress", doneWhen: { kind: "unreadable" } }),
          ],
        },
      }));
      expect(metrics(r)).toEqual([]);
      const m = (k: string) => r.measurements.find((x) => x.metric === k)?.value;
      expect(m("bean-claimed-criteria-absent")).toBe(1);
      expect(m("bean-claimed-criteria-unreadable")).toBe(1);
      expect(m("bean-self-declared-done")).toBe(0);
    });

    it("reports the denominator, so a detector that stops matching is visible", () => {
      // A heading respelled or the regex narrowed makes every bean `undefined`
      // here. That must read as "this check saw nothing" rather than as a green
      // tick — which it can only do if the subject count is on the record.
      const r = beanStoreCheck(healthyContext({
        beans: {
          state: "ok",
          value: [
            bean({ id: "aaaa", status: "in-progress" }),
            bean({ id: "bbbb", status: "in-progress" }),
          ],
        },
      }));
      expect(metrics(r)).toEqual([]);
      expect(r.measurements.find((x) => x.metric === "bean-claimed-with-criteria")?.value).toBe(0);
      expect(r.measurements.find((x) => x.metric === "bean-claimed")?.value).toBe(2);
    });
  });

  it("fires `minor` on a claim nobody has honoured for a fortnight", () => {
    const r = beanStoreCheck(healthyContext({
      beans: {
        state: "ok",
        value: [
          bean({ id: "stale", status: "in-progress", updatedAt: "2026-08-01T00:00:00Z" }),
          bean({ id: "fresh", status: "in-progress", updatedAt: "2026-09-18T00:00:00Z" }),
        ],
      },
    }));
    expect(metrics(r)).toEqual(["bean-stale-in-progress"]);
    expect(r.findings[0].severity).toBe("minor");
    expect(r.findings[0].summary).toContain("`stale`");
    expect(r.findings[0].summary).toContain("49 days");
  });

  it("an `in-progress` bean with no timestamp is not reported as stale", () => {
    // A missing date is not an old one. Guessing here would report a fresh
    // claim as abandoned, which is a false accusation against a sibling.
    const r = beanStoreCheck(healthyContext({
      beans: { state: "ok", value: [bean({ id: "undated", status: "in-progress" })] },
    }));
    expect(r.state).toBe("ok");
  });

  it("fires on resolved beans still inline, and the action MOVES rather than deletes", () => {
    const value = Array.from({ length: BEAN_RESOLVED_INLINE_LIMIT + 1 }, (_, i) =>
      bean({ id: `c${i}`, title: `done ${i}`, status: "completed" }),
    );
    const r = beanStoreCheck(healthyContext({ beans: { state: "ok", value } }));
    expect(metrics(r)).toEqual(["bean-resolved-inline"]);
    expect(r.findings[0].action).toContain("beans archive");
    expect(r.findings[0].action).toContain("MOVES");
  });

  it("fires on an open backlog past the calibration point", () => {
    const value = Array.from({ length: BEAN_OPEN_LIMIT + 1 }, (_, i) => bean({ id: `o${i}`, title: `open ${i}` }));
    const r = beanStoreCheck(healthyContext({ beans: { state: "ok", value } }));
    expect(metrics(r)).toEqual(["bean-open"]);
  });

  it("is `unknown` when the store could not be read", () => {
    const r = beanStoreCheck(healthyContext({
      beans: { state: "unknown", reason: "beans/beans.json could not be read" },
    }));
    expect(r.state).toBe("unknown");
  });
});

describe("todo-store", () => {
  it("fires on a todo left open for a quarter", () => {
    const r = todoStoreCheck(healthyContext({
      todos: { state: "ok", value: [{ id: "old", status: "open", createdAt: "2026-01-01" }] },
    }));
    expect(metrics(r)).toEqual(["todo-stale-days"]);
    expect(r.findings[0].action).toContain("only they");
  });

  it("fires on too many open todos, and does not count the closed ones", () => {
    const open = Array.from({ length: 26 }, (_, i) => ({ id: `o${i}`, status: "open" }));
    const closed = Array.from({ length: 50 }, (_, i) => ({ id: `d${i}`, status: "done" }));
    const r = todoStoreCheck(healthyContext({ todos: { state: "ok", value: [...open, ...closed] } }));
    expect(metrics(r)).toEqual(["todo-open"]);
    expect(r.measurements.find((m) => m.metric === "todo-open")?.value).toBe(26);
  });

  it("an empty todo store is a determined `ok`, unlike an empty bean store", () => {
    const r = todoStoreCheck(healthyContext({ todos: { state: "ok", value: [] } }));
    expect(r.state).toBe("ok");

    // The contrast, through the probes: both stores declared and both empty.
    // The todo probe calls that a determined empty; the bean probe refuses to
    // report a clean work plan over an empty walk, so the bean check is not ok.
    const root = mkdtempSync(join(tmpdir(), "health-empty-stores-"));
    try {
      mkdirSync(join(root, "todos", "items"), { recursive: true });
      writeFileSync(
        join(root, "todos", "todos.json"),
        JSON.stringify({ name: "fixture", directories: [{ id: "items", path: "items", graphTypologies: ["todo-items"] }] }),
      );
      mkdirSync(join(root, "beans", "defs"), { recursive: true });
      writeFileSync(
        join(root, "beans", "beans.json"),
        JSON.stringify({ name: "fixture", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] }),
      );
      const todos = probeTodos(root);
      expect(todos).toMatchObject({ state: "ok", value: [] });
      expect(todoStoreCheck(healthyContext({ todos })).state).toBe("ok");
      const beans = probeBeans(root);
      expect(beans.state).toBe("unknown");
      expect(beanStoreCheck(healthyContext({ beans })).state).toBe("unknown");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the registry and the report", () => {
  it("every registered id has a check that answers to it", () => {
    const ran = runHealthChecks(healthyContext());
    expect(ran.map((r) => r.id).sort()).toEqual(HEALTH_CHECKS.map((c) => c.id).sort());
  });

  it("every threshold states its basis", () => {
    // The structural half is in the schema; this is the corpus half — no
    // shipped check may carry a bare number.
    const byBasis = new Map<string, string[]>();
    for (const r of runHealthChecks(healthyContext())) {
      for (const t of r.thresholds) {
        expect(t.basis.length).toBeGreaterThan(40);
        // A basis is prose, not a number dressed up: at least five words of
        // letters once every digit is taken away.
        const words = t.basis.replace(/[0-9.,%]+/g, " ").match(/[A-Za-z]{2,}/g) ?? [];
        expect(words.length).toBeGreaterThanOrEqual(5);
        const key = t.basis.trim();
        byBasis.set(key, [...(byBasis.get(key) ?? []), `${r.id}/${t.metric}`]);
      }
    }
    // And it is THIS threshold's basis: no text is pasted under two metrics.
    const shared = [...byBasis.values()].filter((names) => new Set(names.map((n) => n.split("/")[1])).size > 1);
    expect(shared).toEqual([]);
  });

  it("every finding names something a person does", () => {
    const ctx = healthyContext({
      staging: { state: "ok", value: { branch: "present", previews: previews(6, 37 * MB), command: "fixture" } },
      openPrHeads: { state: "ok", value: [] },
      repoSize: { state: "ok", value: { gitDirBytes: 349 * MB, trackedBytes: 29 * MB, packs: 42, packBytes: 308 * MB } },
    });
    const findings = runHealthChecks(ctx).flatMap((r) => r.findings);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(f.action.length).toBeGreaterThan(20);
  });

  it("one `unknown` takes the whole verdict to unknown, even beside findings", () => {
    // The precedence that matters: a sweep blind on one check has not cleared
    // the others, so `unknown` outranks `findings`.
    expect(healthVerdict([{ state: "ok" }, { state: "finding" }, { state: "unknown" }])).toBe("unknown");
    expect(healthVerdict([{ state: "ok" }, { state: "finding" }])).toBe("findings");
    expect(healthVerdict([{ state: "ok" }])).toBe("clean");
  });

  it("the schema refuses a report that claims ok while holding findings", () => {
    const base = {
      $schema: "health-report/v1",
      producer: { script: "test/health/run.ts", script_hash: "deadbeefcafe" },
      subject: { kind: "repository", id: "litlfred/folio-assistant" },
      updated_at: "2026-09-19T12:00:00Z",
      verdict: "clean",
      checks: [
        {
          id: "x",
          state: "ok",
          summary: "s",
          thresholds: [],
          measurements: [],
          findings: [{ summary: "a thing", severity: "minor", action: "do something about it" }],
        },
      ],
    };
    expect(() => HealthReportSchema.parse(base)).toThrow(/false pass/);
  });

  it("the schema refuses an `unknown` that does not say what it could not determine", () => {
    expect(() =>
      HealthReportSchema.parse({
        $schema: "health-report/v1",
        producer: { script: "test/health/run.ts", script_hash: "deadbeefcafe" },
        subject: { kind: "repository", id: "r" },
        updated_at: "2026-09-19T12:00:00Z",
        verdict: "unknown",
        checks: [{ id: "x", state: "unknown", summary: "s", thresholds: [], measurements: [], findings: [] }],
      }),
    ).toThrow(/gives no reason/);
  });

  it("the schema refuses a stored verdict that disagrees with its own checks", () => {
    expect(() =>
      HealthReportSchema.parse({
        $schema: "health-report/v1",
        producer: { script: "test/health/run.ts", script_hash: "deadbeefcafe" },
        subject: { kind: "repository", id: "r" },
        updated_at: "2026-09-19T12:00:00Z",
        verdict: "clean",
        checks: [
          {
            id: "x",
            state: "finding",
            summary: "s",
            thresholds: [],
            measurements: [],
            findings: [{ summary: "a thing", severity: "major", action: "do something about it" }],
          },
        ],
      }),
    ).toThrow(/disagrees with the checks/);
  });

  it("the schema refuses a sweep with no checks in it at all", () => {
    expect(() =>
      HealthReportSchema.parse({
        $schema: "health-report/v1",
        producer: { script: "test/health/run.ts", script_hash: "deadbeefcafe" },
        subject: { kind: "repository", id: "r" },
        updated_at: "2026-09-19T12:00:00Z",
        verdict: "clean",
        checks: [],
      }),
    ).toThrow();
  });

  it("formats bytes the way the report reads them", () => {
    expect(formatBytes(222 * MB)).toBe("222.0 MB");
    expect(formatBytes(2 * 1024 * MB)).toBe("2.00 GB");
  });
});

describe("pages-publish-health — reads the CI observation, bean `1dre`", () => {
  const obs = (over: Partial<PagesServingObservation> = {}): HealthContext["pagesServing"] => ({
    state: "ok",
    value: {
      key: "main/0000000000000000000000000000000000000000",
      observation: {
        $schema: "pages-serving/v1",
        observedAt: "2026-09-19T06:00:00Z",
        site: "https://example.github.io/fixture/",
        urls: [{ url: "https://example.github.io/fixture/", status: 200, bytes: 18000, expectedPage: true }],
        ...over,
      },
    },
  });

  it("a fresh observation of served pages is `ok`, and counts as the one instrument", () => {
    const r = pagesPublishHealthCheck(healthyContext({ pagesServing: obs() }));
    expect(r.state).toBe("ok");
    expect(r.measurements.find((m) => m.metric === "pages-serving-instruments")?.value).toBe(1);
    expect(r.measurements.find((m) => m.metric === "pages-serving-urls")?.value).toBe(1);
  });

  it("MISSING is `unknown`, with the store's reason — never zero, never clean (owner's option 1)", () => {
    const r = pagesPublishHealthCheck(
      healthyContext({ pagesServing: { state: "unknown", reason: "qa-reports:main/abc — miss: nothing under health" } }),
    );
    expect(r.state).toBe("unknown");
    expect(r.reason).toContain("miss: nothing under health");
  });

  it("OLD is `unknown`, and says its date — an observation past the horizon is not one", () => {
    const r = pagesPublishHealthCheck(healthyContext({ pagesServing: obs({ observedAt: "2026-09-01T06:00:00Z" }) }));
    expect(r.state).toBe("unknown");
    expect(r.reason).toContain("2026-09-01T06:00:00Z");
    expect(r.reason).toContain(`${PAGES_OBSERVATION_HORIZON_DAYS}-day horizon`);
  });

  it("the horizon is inclusive: exactly a week old still counts", () => {
    const r = pagesPublishHealthCheck(healthyContext({ pagesServing: obs({ observedAt: "2026-09-12T12:00:00Z" }) }));
    expect(r.state).toBe("ok");
  });

  it("FALSIFICATION: Pages' own 404 is a finding even when the status were 200", () => {
    const r = pagesPublishHealthCheck(
      healthyContext({
        pagesServing: obs({
          urls: [
            { url: "https://example.github.io/fixture/", status: 200, bytes: 18000, expectedPage: true },
            { url: "https://example.github.io/fixture/STAGING/x/", status: 200, bytes: 9000, expectedPage: false },
          ],
        }),
      }),
    );
    expect(r.state).toBe("finding");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].summary).toContain("Pages' own 404");
    expect(r.measurements.find((m) => m.metric === "pages-serving-failing")?.value).toBe(1);
  });

  it("FALSIFICATION: a non-200 is a finding, and the action names a person, not a deletion", () => {
    const r = pagesPublishHealthCheck(
      healthyContext({ pagesServing: obs({ urls: [{ url: "https://example.github.io/fixture/", status: 503, bytes: 0, expectedPage: true }] }) }),
    );
    expect(r.findings[0].severity).toBe("major");
    expect(r.findings[0].summary).toContain("HTTP 503");
    expect(r.findings[0].action).toContain("deletion-requires-confirmation");
  });

  it("its thresholds refuse `critical`, and the basis still says enforcement is unknown", () => {
    const r = pagesPublishHealthCheck(healthyContext({}));
    expect(r.thresholds.some((t) => t.severity === "critical")).toBe(false);
    expect(r.thresholds.find((m) => m.metric === "pages-serving-instruments")?.basis).toContain("REMAINS UNKNOWN");
  });

  it("is registered, so it actually runs", () => {
    expect(HEALTH_CHECKS.map((c) => c.id)).toContain("pages-publish-health");
  });
});

describe("probePagesServing — offline, through the qa-store reader", () => {
  const HEAD = "a".repeat(40);
  const body = JSON.stringify({
    $schema: "pages-serving/v1",
    observedAt: "2026-09-19T06:00:00Z",
    site: "https://example.github.io/fixture/",
    urls: [{ url: "https://example.github.io/fixture/", status: 200, bytes: 1, expectedPage: true }],
  });
  const hit = (files: Record<string, string>): QaTreeRead => ({
    state: "hit",
    key: `main/${HEAD}`,
    tip: "t",
    prefix: "health",
    files: new Map(Object.entries(files)),
  });

  it("asks for THIS commit's entry under health/", () => {
    let asked: string[] = [];
    probePagesServing({ repoRoot: "/x", head: HEAD, read: (ref, prefix) => ((asked = [ref, prefix]), hit({})) });
    expect(asked).toEqual([`main/${HEAD}`, "health"]);
  });

  it("reads a valid observation", () => {
    const p = probePagesServing({ repoRoot: "/x", head: HEAD, read: () => hit({ "health/pages-serving.json": body }) });
    expect(p.state).toBe("ok");
  });

  it("a store miss, an absent file, bad JSON and a wrong shape are each `unknown` with a reason", () => {
    const cases: QaTreeRead[] = [
      { state: "miss", reason: "nothing under health" },
      hit({ "health/other.json": "{}" }),
      hit({ "health/pages-serving.json": "{" }),
      hit({ "health/pages-serving.json": JSON.stringify({ $schema: "pages-serving/v1" }) }),
    ];
    for (const c of cases) {
      const p = probePagesServing({ repoRoot: "/x", head: HEAD, read: () => c });
      expect(p.state).toBe("unknown");
      if (p.state === "unknown") expect(p.reason.length).toBeGreaterThan(0);
    }
  });

  it("an unreadable HEAD is `unknown`, not a guessed key", () => {
    expect(probePagesServing({ repoRoot: "/x", head: "", read: () => hit({}) }).state).toBe("unknown");
  });
});

describe("special-branch-size", () => {
  const budget = (bytes: number, scope: "branch" | "family", stated: string): SpecialBranchBudget => ({ bytes, scope, stated, basis: "owner, fixture" });
  const ctxWith = (rows: SpecialBranchMeasure[]) =>
    healthyContext({ specialBranches: { state: "ok", value: { rows, command: "fixture" } } });

  it("fires per branch over a `branch` budget, naming the branch and the owner's number", () => {
    const r = specialBranchSizeCheck(ctxWith([
      { id: "beans", name: "cat/cat-harness/beans", shape: "branch", budget: budget(100 * MB, "branch", "100mb"), state: "measured", resolved: "cat/cat-harness/beans", branches: [{ ref: "cat/cat-harness/beans", bytes: 120 * MB, files: 9 }] },
      { id: "todos", name: "cat/cat-harness/todos", shape: "branch", budget: budget(100 * MB, "branch", "100mb"), state: "measured", resolved: "cat/cat-harness/todos", branches: [{ ref: "cat/cat-harness/todos", bytes: 1 * MB, files: 3 }] },
    ]));
    expect(r.state).toBe("finding");
    expect(metrics(r)).toEqual(["special-branch-bytes:beans"]);
    expect(r.findings[0].summary).toContain("120.0 MB");
    expect(r.findings[0].summary).toContain("100mb");
    expect(r.thresholds.map((t) => t.metric)).toEqual(["special-branch-bytes:beans", "special-branch-bytes:todos"]);
  });

  it("measures a `family` budget in TOTAL — no single cache branch is over, the family is", () => {
    const each = 1.5 * 1024 * MB;
    const r = specialBranchSizeCheck(ctxWith([
      { id: "build-cache", name: "cat/x/build-cache/", shape: "family", budget: budget(4 * 1024 * MB, "family", "4gb"), state: "measured", resolved: "cat/x/build-cache/", branches: [1, 2, 3].map((i) => ({ ref: `cat/x/build-cache/p${i}`, bytes: each, files: 1 })) },
    ]));
    expect(r.state).toBe("finding");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].summary).toContain("4.50 GB");
  });

  it("a family budgeted PER BRANCH fires on the branch that is over, not on the total", () => {
    const r = specialBranchSizeCheck(ctxWith([
      { id: "auto-docs", name: "cat/cat-harness/auto-docs/", shape: "family", budget: budget(1024 * MB, "branch", "1gb"), state: "measured", resolved: "cat/cat-harness/auto-docs/", branches: [{ ref: "cat/cat-harness/auto-docs/a", bytes: 900 * MB, files: 1 }, { ref: "cat/cat-harness/auto-docs/b", bytes: 1100 * MB, files: 1 }] },
    ]));
    expect(r.findings.map((f) => f.summary.split(" ")[0])).toEqual(["`cat/cat-harness/auto-docs/b`"]);
  });

  it("absent and unbudgeted are COUNTED and named, never read as within budget", () => {
    const r = specialBranchSizeCheck(ctxWith([
      { id: "auto-docs", name: "cat/cat-harness/auto-docs/", shape: "family", budget: budget(1024 * MB, "branch", "1gb"), state: "absent", branches: [] },
      { id: "fsh-guts", name: "cat/cat-harness/fsh-guts", shape: "branch", state: "unbudgeted", resolved: "cat/cat-harness/fsh-guts", branches: [] },
    ]));
    expect(r.state).toBe("ok");
    const m = Object.fromEntries(r.measurements.map((x) => [x.metric, x]));
    expect(m["special-branches-absent"].value).toBe(1);
    expect(m["special-branches-absent"].command).toContain("auto-docs");
    expect(m["special-branches-unbudgeted"].value).toBe(1);
    expect(m["special-branches-unbudgeted"].command).toContain("fsh-guts");
  });

  it("a probe that could not read the remote is `unknown`, never zero bytes", () => {
    const r = specialBranchSizeCheck(healthyContext({ specialBranches: { state: "unknown", reason: "ls-remote refused" } }));
    expect(r.state).toBe("unknown");
    expect(r.reason).toContain("ls-remote refused");
  });

  it("the committed budgets file budgets what the owner named, at the owner's numbers", () => {
    const rows = readSpecialBranches(resolve(import.meta.dir, "branch-budgets.json"));
    const b = Object.fromEntries(rows.filter((x) => x.budget).map((x) => [x.id, [x.budget!.bytes, x.budget!.scope]]));
    expect(b).toEqual({
      "qa-reports": [500 * MB, "branch"],
      "lake-cache": [4 * 1024 * MB, "family"],
      beans: [100 * MB, "branch"],
      todos: [100 * MB, "branch"],
      "auto-docs": [1024 * MB, "branch"],
    });
  });
});

describe("a budget row named by TYPOLOGY takes its family from the declaring directory", () => {
  /**
   * A repository whose own declaration gives a `build-cache/` directory a
   * family prefix — or none. Its kind is `auto-docs`, one every checkout
   * knows: a declaration naming a kind nobody registers does not parse.
   */
  function repo(prefix?: string): string {
    const root = mkdtempSync(join(tmpdir(), "health-typology-"));
    mkdirSync(join(root, "build-cache"));
    writeFileSync(
      join(root, "x.json"),
      JSON.stringify({
        $schema: "cat-harness-declaration/1.0.0",
        name: "x",
        directories: [
          { id: "cache", path: "build-cache/", graphTypologies: ["auto-docs"], ...(prefix ? { storage: { branchPrefix: prefix, keyedBy: "family", keyFrom: "<package>" } } : {}), description: "fixture" },
        ],
      }),
    );
    return root;
  }
  function budgets(row: object): string {
    const dir = mkdtempSync(join(tmpdir(), "health-budgets-"));
    writeFileSync(join(dir, "b.json"), JSON.stringify({ branches: [row] }));
    return join(dir, "b.json");
  }
  const row = { id: "build-cache", shape: "family", typology: "auto-docs", legacy: ["old-cache/"], budget: { bytes: 1, scope: "family", stated: "1b", basis: "fixture" } };

  it("the declared storage.branchPrefix is the name, the legacy names follow", () => {
    const root = repo("cat/x/build-cache/");
    try {
      expect(declaredFamilyPrefix(root, "auto-docs")).toBe("cat/x/build-cache/");
      const [r] = readSpecialBranches(budgets(row), root);
      expect(r).toMatchObject({ id: "build-cache", name: "cat/x/build-cache/", legacy: ["old-cache/"], typology: "auto-docs" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("with nothing declared, the legacy names are what is measured — never a name the file spells for a layer above", () => {
    const root = repo();
    try {
      expect(declaredFamilyPrefix(root, "auto-docs")).toBeUndefined();
      const [r] = readSpecialBranches(budgets(row), root);
      expect(r).toMatchObject({ name: "old-cache/", legacy: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("the committed lake-cache row names its typology, not a layer", () => {
    const [r] = readSpecialBranches(resolve(import.meta.dir, "branch-budgets.json")).filter((x) => x.id === "lake-cache");
    expect(r!.typology).toBe("lake-cache");
    // Read with no repository, only the legacy names remain, newest first.
    expect([r!.name, ...r!.legacy]).toEqual(["cat-lake-cache/", "lake-cache/"]);
  });
});

describe("membersFor — the table's resolution rule", () => {
  const row = (shape: "branch" | "family", name: string, legacy: string[] = []): SpecialBranchDecl => ({ id: "x", shape, name, legacy });
  it("prefers the new name, falls back to the first legacy name present", () => {
    expect(membersFor(row("branch", "cat/cat-harness/qa-reports", ["qa-reports"]), ["qa-reports", "cat/cat-harness/qa-reports"])).toEqual({ resolved: "cat/cat-harness/qa-reports", refs: ["cat/cat-harness/qa-reports"] });
    expect(membersFor(row("branch", "cat/cat-harness/qa-reports", ["qa-reports"]), ["qa-reports"])).toEqual({ resolved: "qa-reports", refs: ["qa-reports"] });
  });
  it("a family is every branch under its prefix, and the prefix itself is not a member", () => {
    expect(membersFor(row("family", "cat/x/lake-cache/"), ["cat/x/lake-cache/b", "cat/x/lake-cache/a", "cat/x/lake-cachey", "main"])).toEqual({ resolved: "cat/x/lake-cache/", refs: ["cat/x/lake-cache/a", "cat/x/lake-cache/b"] });
    // A head named exactly the prefix, with or without its slash, is not a member.
    expect(membersFor(row("family", "cat/x/lake-cache/"), ["cat/x/lake-cache/", "cat/x/lake-cache", "cat/x/lake-cache/a"])).toEqual({ resolved: "cat/x/lake-cache/", refs: ["cat/x/lake-cache/a"] });
    expect(membersFor(row("family", "cat/x/lake-cache/"), ["cat/x/lake-cache/", "cat/x/lake-cache"])).toEqual({ refs: [] });
  });
  it("nothing on the remote is a determined absence", () => {
    expect(membersFor(row("family", "cat/x/auto-docs/"), ["main"])).toEqual({ refs: [] });
  });
});
