import { describe, expect, it } from "bun:test";

import {
  detectAgentProvenance,
  extractTrailersFromMessage,
  type CommitInfo,
} from "../../agent-provenance.ts";
import { evaluateAdversarialGate, renderAdversarialGateReport } from "../../check-adversarial-review.ts";
import {
  MERGE_REVIEW_SCHEMA,
  type AdversarialReview,
  type MergeReview,
  type RedFlagCategory,
} from "../../../schemas/sdlc/red-flag.ts";

const BASE_SHA = "1111111111111111111111111111111111111111";
const HEAD_SHA = "2222222222222222222222222222222222222222";
const HEAD_SHA_MOVED = "3333333333333333333333333333333333333333";

function createValidAdversarialReview(overrides: Partial<AdversarialReview> = {}): AdversarialReview {
  return {
    reviewer: {
      by: "agent",
      session: "session_independent_reviewer_999",
      model: "claude-3-7-sonnet-20250219",
    },
    author_sessions: ["session_author_111"],
    skill_hash: "sha256:abc1234567890",
    at: "2026-10-09T15:00:00Z",
    coverage: {
      files_total: 2,
      files_reviewed: 2,
      skipped: [],
      truncated: false,
    },
    result: "pass",
    flags: [],
    ...overrides,
  };
}

function createValidMergeReview(
  reviews: AdversarialReview[] = [createValidAdversarialReview()],
  headSha = HEAD_SHA,
): MergeReview {
  return {
    $schema: MERGE_REVIEW_SCHEMA,
    pr: 42,
    base_sha: BASE_SHA,
    head_sha: headSha,
    tree: "tree_sha_xyz",
    reviews,
  };
}

describe("Agent Provenance Detection (detectAgentProvenance)", () => {
  it("negative case: human-only PR requires no adversarial review", () => {
    const humanCommits: CommitInfo[] = [
      {
        sha: "a1b2c3d4e5f6",
        authorName: "Alice Martin",
        authorEmail: "alice@example.org",
        committerName: "Bob Taylor",
        committerEmail: "bob@example.org",
        message: "feat: add human-authored documentation for chapter 3\n\nCloses #123.",
      },
      {
        sha: "f6e5d4c3b2a1",
        authorName: "Alice Martin",
        authorEmail: "alice@example.org",
        committerName: "Alice Martin",
        committerEmail: "alice@example.org",
        message: "fix: typo in introductory section",
      },
    ];

    const result = detectAgentProvenance({
      branch: "feature/human-docs",
      prBody: "This PR improves chapter 3 documentation.\nAuthored by Alice.",
      commits: humanCommits,
    });

    expect(result.hasAgentProvenance).toBe(false);
    expect(result.isHumanOnly).toBe(true);
    expect(result.signals).toHaveLength(0);
    expect(result.authorSessions).toHaveLength(0);
    expect(result.summary).toBe("human-only PR: no adversarial review required");
  });

  it("positive case: Co-Authored-By Claude trailer triggers provenance", () => {
    const commits: CommitInfo[] = [
      {
        sha: "c1",
        authorName: "Human Developer",
        authorEmail: "dev@example.org",
        message:
          "feat: add new schema\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
      },
    ];

    const result = detectAgentProvenance({
      branch: "main",
      commits,
    });

    expect(result.hasAgentProvenance).toBe(true);
    expect(result.isHumanOnly).toBe(false);
    expect(result.signals.some((s) => s.kind === "trailer")).toBe(true);
  });

  it("positive case: Claude-Session trailer triggers provenance and extracts session ID", () => {
    const commits: CommitInfo[] = [
      {
        sha: "c2",
        authorName: "Human Developer",
        authorEmail: "dev@example.org",
        message:
          "fix: correct edge case\n\nClaude-Session: session_claude_abc123\nCo-Authored-By: Claude Sonnet <noreply@anthropic.com>",
      },
    ];

    const result = detectAgentProvenance({
      branch: "main",
      commits,
    });

    expect(result.hasAgentProvenance).toBe(true);
    expect(result.authorSessions).toContain("session_claude_abc123");
    expect(result.signals.some((s) => s.detail.includes("session_claude_abc123"))).toBe(true);
  });

  it("positive case: agent branch prefix triggers provenance", () => {
    const resultClaude = detectAgentProvenance({ branch: "claude/w8jq-adversarial-review" });
    expect(resultClaude.hasAgentProvenance).toBe(true);
    expect(resultClaude.signals[0].kind).toBe("branch");

    const resultBot = detectAgentProvenance({ branch: "bot/dependency-update" });
    expect(resultBot.hasAgentProvenance).toBe(true);

    const resultAgent = detectAgentProvenance({ branch: "agent/subagent-task" });
    expect(resultAgent.hasAgentProvenance).toBe(true);
  });

  it("positive case: bot committer or author triggers provenance", () => {
    const commits: CommitInfo[] = [
      {
        sha: "c3",
        authorName: "github-actions[bot]",
        authorEmail: "41898282+github-actions[bot]@users.noreply.github.com",
        message: "chore: automated sync",
      },
    ];

    const result = detectAgentProvenance({
      branch: "main",
      commits,
    });

    expect(result.hasAgentProvenance).toBe(true);
    expect(result.signals.some((s) => s.kind === "bot")).toBe(true);
  });

  it("positive case: PR description markers trigger provenance", () => {
    const result = detectAgentProvenance({
      branch: "main",
      prBody: "Generated with Claude Code.\nClaude-Session: session_body_xyz",
    });

    expect(result.hasAgentProvenance).toBe(true);
    expect(result.authorSessions).toContain("session_body_xyz");
    expect(result.signals.some((s) => s.kind === "pr_body")).toBe(true);
  });

  it("extractTrailersFromMessage parses multiple trailers correctly", () => {
    const msg = [
      "feat: sample commit",
      "",
      "Some description.",
      "",
      "Signed-off-by: Human <human@example.com>",
      "Claude-Session: sess_123",
      "Co-Authored-By: Claude <noreply@anthropic.com>",
      "Co-Authored-By: Other <other@example.com>",
    ].join("\n");

    const { trailers, sessionIds } = extractTrailersFromMessage(msg);
    expect(sessionIds).toEqual(["sess_123"]);
    expect(trailers["Co-Authored-By"]).toHaveLength(2);
    expect(trailers["Claude-Session"]).toEqual(["sess_123"]);
  });
});

describe("Adversarial Review Gate Evaluation (evaluateAdversarialGate)", () => {
  it("skips human-only PR without requiring any verdict", () => {
    const humanProvenance = detectAgentProvenance({
      branch: "feature/human-improvement",
      commits: [
        {
          authorName: "Alice",
          authorEmail: "alice@example.org",
          message: "docs: add guide section",
        },
      ],
    });

    const result = evaluateAdversarialGate({
      provenance: humanProvenance,
      currentHeadSha: HEAD_SHA,
      verdict: null, // No verdict present!
    });

    expect(result.state).toBe("skipped");
    expect(result.action).toBe("pass");
    expect(result.blocksMerge).toBe(false);
    expect(result.isHumanOnly).toBe(true);
    expect(result.message).toBe("human-only PR: no adversarial review required");
  });

  it("reports 'unknown' when agent provenance exists but verdict is missing", () => {
    const agentProvenance = detectAgentProvenance({
      branch: "claude/feature",
    });

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict: null,
      enforcementMode: "warn",
    });

    expect(result.state).toBe("unknown");
    expect(result.action).toBe("warn"); // warn-only ruling: warns, does not block
    expect(result.blocksMerge).toBe(false);
    expect(result.message).toContain("No adversarial review verdict found");
  });

  it("in hard mode, missing verdict blocks merge with state 'unknown'", () => {
    const agentProvenance = detectAgentProvenance({
      branch: "claude/feature",
    });

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict: null,
      enforcementMode: "hard",
    });

    expect(result.state).toBe("unknown");
    expect(result.action).toBe("block");
    expect(result.blocksMerge).toBe(true);
  });

  it("checks SHA binding: reports 'stale' when head moved after review", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const verdict = createValidMergeReview([], HEAD_SHA); // Bound to HEAD_SHA

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA_MOVED, // Head moved!
      verdict,
      enforcementMode: "warn",
    });

    expect(result.state).toBe("stale");
    expect(result.action).toBe("warn");
    expect(result.message).toContain("stale");
    expect(result.reviewedHeadSha).toBe(HEAD_SHA);
    expect(result.currentHeadSha).toBe(HEAD_SHA_MOVED);
  });

  it("checks reviewer independence: rejects review authored by same session", () => {
    const authorSession = "session_common_author_777";
    const agentProvenance = detectAgentProvenance({
      branch: "claude/feature",
      commits: [
        {
          message: `feat: change\n\nClaude-Session: ${authorSession}`,
        },
      ],
    });

    const nonIndependentReview = createValidAdversarialReview({
      reviewer: {
        by: "agent",
        session: authorSession, // Same session as author!
        model: "claude-3-7-sonnet",
      },
      author_sessions: [authorSession],
    });
    const verdict = createValidMergeReview([nonIndependentReview], HEAD_SHA);

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict,
    });

    expect(result.state).toBe("unknown");
    expect(result.message).toContain("Reviewer independence violation");
  });

  it("rejects incomplete agent reviewer record (missing model)", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const incompleteReview = createValidAdversarialReview({
      reviewer: {
        by: "agent",
        session: "session_independent",
        model: null, // Model missing!
      },
    });
    const verdict = createValidMergeReview([incompleteReview], HEAD_SHA);

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict,
    });

    expect(result.state).toBe("unknown");
    expect(result.message).toContain("Reviewer record incomplete");
  });

  it("checks whole-diff coverage: truncated coverage reports 'unknown' (never silent pass)", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const truncatedReview = createValidAdversarialReview({
      coverage: {
        files_total: 10,
        files_reviewed: 3,
        skipped: [],
        truncated: true, // Truncated!
      },
      result: "pass",
    });
    const verdict = createValidMergeReview([truncatedReview], HEAD_SHA);

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict,
    });

    expect(result.state).toBe("unknown");
    expect(result.message).toContain("Review coverage was truncated");
  });

  it("checks unreviewed changed files against git diff: reports 'unknown'", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const partialReview = createValidAdversarialReview({
      coverage: {
        files_total: 1,
        files_reviewed: 1,
        skipped: [],
        truncated: false,
      },
      result: "pass",
    });
    const verdict = createValidMergeReview([partialReview], HEAD_SHA);

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      changedFiles: ["schemas/a.ts", "schemas/b.ts", "scripts/c.ts"], // 3 changed files in diff
      verdict,
    });

    expect(result.state).toBe("unknown");
    expect(result.message).toContain("Incomplete diff coverage");
  });

  it("clean review passes with state 'clean'", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const cleanReview = createValidAdversarialReview({
      flags: [
        {
          id: "sug-1",
          severity: "minor",
          weight: "suggestion",
          where: "schemas/test.ts:10",
          evidence: "Consider adding docstring.",
          status: "open",
        },
      ],
      result: "pass",
    });
    const verdict = createValidMergeReview([cleanReview], HEAD_SHA);

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict,
    });

    expect(result.state).toBe("clean");
    expect(result.action).toBe("pass");
    expect(result.blocksMerge).toBe(false);
  });

  it("under warn-only ruling (2026-10-03), open red flags report 'would-have-blocked'", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const redFlagReview = createValidAdversarialReview({
      flags: [
        {
          id: "flag-sec-1",
          category: "security" as RedFlagCategory,
          severity: "critical",
          weight: "blocking",
          where: "scripts/deploy.ts:45",
          evidence: "Unsanitized input passed to execSync.",
          status: "open",
        },
      ],
      result: "fail",
    });
    const verdict = createValidMergeReview([redFlagReview], HEAD_SHA);

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict,
      enforcementMode: "warn", // Default warn-only mode
    });

    expect(result.state).toBe("would-have-blocked");
    expect(result.action).toBe("warn");
    expect(result.blocksMerge).toBe(false); // Does NOT hold merge
    expect(result.findingsToReport).toHaveLength(1);
    expect(result.findingsToReport[0].category).toBe("security");
    expect(result.findingsToReport[0].historicalBasis).toBeDefined();
  });

  it("under hard mode, open red flags report 'open' and block merge", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const redFlagReview = createValidAdversarialReview({
      flags: [
        {
          id: "flag-sec-1",
          category: "security" as RedFlagCategory,
          severity: "critical",
          weight: "blocking",
          where: "scripts/deploy.ts:45",
          evidence: "Unsanitized input passed to execSync.",
          status: "open",
        },
      ],
      result: "fail",
    });
    const verdict = createValidMergeReview([redFlagReview], HEAD_SHA);

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict,
      enforcementMode: "hard", // Hard gate
    });

    expect(result.state).toBe("open");
    expect(result.action).toBe("block");
    expect(result.blocksMerge).toBe(true);
  });

  it("overridden red flags pass cleanly with state 'clean'", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const overriddenReview = createValidAdversarialReview({
      flags: [
        {
          id: "flag-sec-1",
          category: "security" as RedFlagCategory,
          severity: "critical",
          weight: "blocking",
          where: "scripts/deploy.ts:45",
          evidence: "Unsanitized input passed to execSync.",
          status: "overridden",
          resolution: {
            by: "lead-dev",
            at: "2026-10-09T16:00:00Z",
            decision: "override-123",
            reason: "Input is validated upstream in gateway.",
          },
        },
      ],
      result: "pass",
    });
    const verdict = createValidMergeReview([overriddenReview], HEAD_SHA);

    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict,
    });

    expect(result.state).toBe("clean");
    expect(result.action).toBe("pass");
    expect(result.blocksMerge).toBe(false);
  });
});

describe("Adversarial Gate Report Rendering (renderAdversarialGateReport)", () => {
  it("renders human-only skip notice cleanly", () => {
    const humanProvenance = detectAgentProvenance({ branch: "main" });
    const result = evaluateAdversarialGate({
      provenance: humanProvenance,
      currentHeadSha: HEAD_SHA,
    });
    const report = renderAdversarialGateReport(result);
    expect(report.some((l) => l.includes("✓ human-only PR: no adversarial review required"))).toBe(true);
  });

  it("renders would-have-blocked advisory with findings, category, and historical basis", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const review = createValidAdversarialReview({
      flags: [
        {
          id: "flag-1",
          category: "false-green" as RedFlagCategory,
          severity: "critical",
          weight: "blocking",
          where: "scripts/check.ts:12",
          evidence: "Test exits 0 when subject file is missing.",
          status: "open",
        },
      ],
    });
    const verdict = createValidMergeReview([review], HEAD_SHA);
    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict,
      enforcementMode: "warn",
    });

    const report = renderAdversarialGateReport(result);
    expect(report.some((l) => l.includes("ADVISORY (would have blocked)"))).toBe(true);
    expect(report.some((l) => l.includes("[false-green] flag-1"))).toBe(true);
    expect(report.some((l) => l.includes("Basis:"))).toBe(true);
  });

  it("never renders 'unknown' as clean pass (✓)", () => {
    const agentProvenance = detectAgentProvenance({ branch: "claude/feature" });
    const result = evaluateAdversarialGate({
      provenance: agentProvenance,
      currentHeadSha: HEAD_SHA,
      verdict: null,
    });
    const report = renderAdversarialGateReport(result);
    expect(report.some((l) => l.includes("✓"))).toBe(false);
    expect(report.some((l) => l.includes("WARNING (unknown)"))).toBe(true);
  });
});
