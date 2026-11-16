/**
 * Tests for the RED FLAG taxonomy, adversarial review sidecar shape,
 * human override path, and gate state derivation.
 *
 * Child (c) of merge gate epic (bean `folio-assistant-abmq`, proposal
 * `cat-harness/docs/proposals/merge-gate-2026-10-02.md` §6).
 */
import { describe, expect, test } from "bun:test";

import {
  AdversarialFindingSchema,
  AdversarialReviewSchema,
  applyRedFlagOverride,
  evaluateFindingGateState,
  evaluateMergeReviewGateState,
  evaluateReviewGateState,
  getRedFlagDefinition,
  isRedFlagCategory,
  MergeReviewSchema,
  OverrideDecisionSchema,
  RED_FLAG_CATEGORIES,
  RED_FLAG_DEFINITIONS,
  RED_FLAG_GATE_STATES,
  RedFlagCategorySchema,
  type AdversarialFinding,
  type AdversarialReview,
  type MergeReview,
  type RedFlagOverride,
} from "../../schemas/sdlc/red-flag.ts";
import { KgQaReportSchema } from "../../schemas/sdlc/kg-qa.ts";

const NOW = "2026-10-09T12:00:00Z";
const HEAD_SHA = "a1b2c3d4e5f6789012345678901234567890abcd";
const BASE_SHA = "0123456789abcdef0123456789abcdef01234567";

function sampleBlockingFinding(over: Partial<AdversarialFinding> = {}): AdversarialFinding {
  return {
    id: "rf-1",
    category: "security",
    severity: "critical",
    weight: "blocking",
    where: "src/server.ts:42",
    evidence: "API key read directly in untrusted PR execution context without isolation.",
    detail: "Secret exposure risk in CI workflow.",
    status: "open",
    ...over,
  };
}

function sampleReview(over: Partial<AdversarialReview> = {}): AdversarialReview {
  return {
    reviewer: {
      by: "agent",
      session: "agent-session-xyz-123",
      model: "gemini-2.5-pro",
    },
    author_sessions: ["agent-session-author-456"],
    skill_hash: "hash:skill-adversarial-review:v1",
    at: NOW,
    coverage: {
      files_total: 10,
      files_reviewed: 10,
      skipped: [],
    },
    result: "pass",
    flags: [],
    ...over,
  };
}

function sampleMergeReview(over: Partial<MergeReview> = {}): MergeReview {
  return {
    $schema: "merge-review/v1",
    pr: 42,
    base_sha: BASE_SHA,
    head_sha: HEAD_SHA,
    tree: "tree-sha-789",
    reviews: [sampleReview()],
    ...over,
  };
}

// ── 1. Taxonomy Tests ───────────────────────────────────────────────────────

describe("RED FLAG taxonomy (closed enum and definitions)", () => {
  test("contains exactly the 8 specified categories", () => {
    const expectedCategories = [
      "security",
      "data-loss",
      "correctness",
      "false-green",
      "provenance",
      "scope-breach",
      "irreversible-action",
      "licence",
    ] as const;
    expect(RED_FLAG_CATEGORIES).toEqual(expectedCategories);
  });


  test("validates members with RedFlagCategorySchema and rejects foreign values", () => {
    for (const cat of RED_FLAG_CATEGORIES) {
      expect(RedFlagCategorySchema.safeParse(cat).success).toBe(true);
      expect(isRedFlagCategory(cat)).toBe(true);
    }

    expect(RedFlagCategorySchema.safeParse("arbitrary-issue").success).toBe(false);
    expect(RedFlagCategorySchema.safeParse("style").success).toBe(false);
    expect(RedFlagCategorySchema.safeParse("").success).toBe(false);
    expect(isRedFlagCategory("other")).toBe(false);
    expect(isRedFlagCategory(null)).toBe(false);
  });

  test("every category has a definition and a historical repository example", () => {
    for (const cat of RED_FLAG_CATEGORIES) {
      const def = RED_FLAG_DEFINITIONS[cat];
      expect(def).toBeDefined();
      expect(def.category).toBe(cat);
      expect(def.definition.trim().length).toBeGreaterThan(15);
      expect(def.historicalExample.trim().length).toBeGreaterThan(15);

      const retrieved = getRedFlagDefinition(cat);
      expect(retrieved).toBe(def);
    }

    // Verify concrete historical citations from this repository's past
    expect(RED_FLAG_DEFINITIONS["false-green"].historicalExample).toContain("lean-bare-import");
    expect(RED_FLAG_DEFINITIONS["false-green"].historicalExample).toContain("dh4f");
    expect(RED_FLAG_DEFINITIONS["irreversible-action"].historicalExample).toContain("plj1");
    expect(RED_FLAG_DEFINITIONS["data-loss"].historicalExample).toContain("de9k");
    expect(RED_FLAG_DEFINITIONS["correctness"].historicalExample).toContain("beans:claim");
    expect(RED_FLAG_DEFINITIONS["provenance"].historicalExample).toContain("w4tq");
    expect(RED_FLAG_DEFINITIONS["scope-breach"].historicalExample).toContain("7u3g");
    expect(RED_FLAG_DEFINITIONS["security"].historicalExample).toContain("agent-review.yml");
  });
});

// ── 2. Adversarial Finding Schema Tests ─────────────────────────────────────

describe("AdversarialFindingSchema validation", () => {
  test("parses a valid blocking finding with category and evidence", () => {
    const raw = sampleBlockingFinding();
    const result = AdversarialFindingSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  test("rejects a blocking finding with no category", () => {
    const raw = sampleBlockingFinding({ category: undefined });
    const result = AdversarialFindingSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("category"))).toBe(true);
    }
  });

  test("rejects a blocking finding with empty evidence", () => {
    const raw = sampleBlockingFinding({ evidence: "   " });
    const result = AdversarialFindingSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("evidence"))).toBe(true);
    }
  });

  test("allows non-blocking findings (suggestion) without category or evidence", () => {
    const suggestion: AdversarialFinding = {
      id: "sug-1",
      severity: "minor",
      weight: "suggestion",
      where: "docs/readme.md:12",
      evidence: "",
      status: "open",
    };
    const result = AdversarialFindingSchema.safeParse(suggestion);
    expect(result.success).toBe(true);
  });

  test("allows non-blocking findings (praise)", () => {
    const praise: AdversarialFinding = {
      id: "praise-1",
      severity: "minor",
      weight: "praise",
      where: "schemas/sdlc/red-flag.ts:1",
      evidence: "",
      detail: "Clean separation of finding weight and severity.",
      status: "open",
    };
    const result = AdversarialFindingSchema.safeParse(praise);
    expect(result.success).toBe(true);
  });
});

// ── 3. Adversarial Review & Sidecar Compatibility Tests ─────────────────────

describe("AdversarialReview and sidecar compatibility", () => {
  test("parses an adversarial review record", () => {
    const review = sampleReview({
      flags: [sampleBlockingFinding()],
    });
    const parsed = AdversarialReviewSchema.safeParse(review);
    expect(parsed.success).toBe(true);
  });

  test("parses a MergeReview record with bound commit SHAs", () => {
    const mergeReview = sampleMergeReview({
      reviews: [sampleReview({ flags: [sampleBlockingFinding()] })],
    });
    const parsed = MergeReviewSchema.safeParse(mergeReview);
    expect(parsed.success).toBe(true);
  });

  test("KgQaReportSchema accepts optional adversarial_reviews[] (compatible with kg-qa/v1)", () => {
    const sidecarWithReview = {
      $schema: "kg-qa/v1",
      subject: {
        kind: "tool",
        id: "tool-gates",
        path: "cat-harness-tools/src/index.ts",
      },
      source_hash: "hash123",
      criteria: {
        "tool-args-shell-safe": {
          result: "pass",
          findings: [],
        },
      },
      totals: {
        pass: 1,
        fail: 0,
        "n/a": 0,
        unknown: 0,
      },
      adversarial_reviews: [sampleReview()],
    };

    const parsed = KgQaReportSchema.safeParse(sidecarWithReview);
    expect(parsed.success).toBe(true);

    // Existing sidecar without adversarial_reviews remains completely valid
    const { adversarial_reviews: _adversarialReviews, ...existingSidecar } = sidecarWithReview;
    const parsedExisting = KgQaReportSchema.safeParse(existingSidecar);
    expect(parsedExisting.success).toBe(true);
  });
});

// ── 4. Human Override Path Tests ────────────────────────────────────────────

describe("Human override path (OverrideDecisionSchema & applyRedFlagOverride)", () => {
  const validOverride: RedFlagOverride = {
    id: "ovr-2026-10-09-01",
    finding_id: "rf-1",
    by: { kind: "human", id: "litlfred" },
    standing: "repository owner",
    reason: "API key is a mocked dummy value in test fixture, isolated from CI runtime secrets.",
    at: NOW,
    commit: HEAD_SHA,
  };

  test("valid human override parses successfully", () => {
    const parsed = OverrideDecisionSchema.safeParse(validOverride);
    expect(parsed.success).toBe(true);
  });

  test("accepts flag_id as alternative to finding_id", () => {
    const withFlagId = {
      id: "ovr-1",
      flag_id: "rf-1",
      by: { kind: "human", id: "litlfred" },
      standing: "maintainer",
      reason: "Audited and verified harmless.",
      at: NOW,
    };
    expect(OverrideDecisionSchema.safeParse(withFlagId).success).toBe(true);
  });

  test("refuses override from non-human reviewer (agents cannot override red flags)", () => {
    const agentOverride = {
      ...validOverride,
      by: { kind: "agent", id: "claude-code" },
    };
    const parsed = OverrideDecisionSchema.safeParse(agentOverride);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("human"))).toBe(true);
    }
  });

  test("refuses override missing finding_id or flag_id", () => {
    const { finding_id: _findingId, ...missingTarget } = validOverride;
    const parsed = OverrideDecisionSchema.safeParse(missingTarget);
    expect(parsed.success).toBe(false);
  });

  test("applyRedFlagOverride updates status to overridden without deleting finding", () => {
    const original = sampleBlockingFinding({ id: "rf-1", status: "open" });
    const overridden = applyRedFlagOverride(original, validOverride);

    // Finding is NOT deleted; attributes are preserved
    expect(overridden.id).toBe("rf-1");
    expect(overridden.category).toBe("security");
    expect(overridden.severity).toBe("critical");
    expect(overridden.weight).toBe("blocking");
    expect(overridden.where).toBe(original.where);
    expect(overridden.evidence).toBe(original.evidence);

    // Status is updated to overridden
    expect(overridden.status).toBe("overridden");
    expect(overridden.resolution).toEqual({
      by: "litlfred",
      at: NOW,
      decision: "ovr-2026-10-09-01",
      reason: "API key is a mocked dummy value in test fixture, isolated from CI runtime secrets.",
      commit: HEAD_SHA,
    });
  });

  test("applyRedFlagOverride throws if finding ID does not match override", () => {
    const mismatch = sampleBlockingFinding({ id: "rf-mismatch" });
    expect(() => applyRedFlagOverride(mismatch, validOverride)).toThrow("Finding IDs must match");
  });
});

// ── 5. Gate Behaviour and State Derivation Tests ─────────────────────────────

describe("Gate behaviour and state derivation across all 6 states", () => {
  test("all 6 expected gate states are defined in RED_FLAG_GATE_STATES", () => {
    expect(RED_FLAG_GATE_STATES).toEqual([
      "open",
      "resolved",
      "overridden",
      "would-have-blocked",
      "unknown",
      "stale",
    ]);
  });

  test("State 1: 'would-have-blocked' under warn-only ruling (2026-10-03 owner ruling)", () => {
    const openFinding = sampleBlockingFinding({ status: "open" });
    const evaluation = evaluateFindingGateState(openFinding, "warn");

    expect(evaluation.state).toBe("would-have-blocked");
    expect(evaluation.action).toBe("warn");
    expect(evaluation.blocksMerge).toBe(false);
    expect(evaluation.message).toContain("would have blocked the merge (warn-only ruling 2026-10-03)");
  });

  test("State 2: 'open' blocks merge under hard-gate enforcement", () => {
    const openFinding = sampleBlockingFinding({ status: "open" });
    const evaluation = evaluateFindingGateState(openFinding, "hard");

    expect(evaluation.state).toBe("open");
    expect(evaluation.action).toBe("block");
    expect(evaluation.blocksMerge).toBe(true);
    expect(evaluation.message).toContain("open blocking finding blocks merge");
  });

  test("State 3: 'resolved' passes the gate without blocking or warning", () => {
    const resolvedFinding = sampleBlockingFinding({
      status: "resolved",
      resolution: { by: "dev", at: NOW, reason: "Patched" },
    });
    const evaluation = evaluateFindingGateState(resolvedFinding, "warn");

    expect(evaluation.state).toBe("resolved");
    expect(evaluation.action).toBe("pass");
    expect(evaluation.blocksMerge).toBe(false);
  });

  test("State 4: 'overridden' passes the gate and stays on audit record", () => {
    const overriddenFinding = sampleBlockingFinding({
      status: "overridden",
      resolution: { by: "litlfred", at: NOW, reason: "Approved override", decision: "ovr-1" },
    });
    const evaluation = evaluateFindingGateState(overriddenFinding, "warn");

    expect(evaluation.state).toBe("overridden");
    expect(evaluation.action).toBe("pass");
    expect(evaluation.blocksMerge).toBe(false);
  });

  test("State 5: 'unknown' when review result is unknown or reviewer failed", () => {
    const unknownReview = sampleReview({ result: "unknown" });

    // In warn mode: warns loudly, does not block
    const warnEval = evaluateReviewGateState(unknownReview, { enforcementMode: "warn" });
    expect(warnEval.state).toBe("unknown");
    expect(warnEval.action).toBe("warn");
    expect(warnEval.blocksMerge).toBe(false);
    expect(warnEval.message).toContain("Review outcome is unknown");

    // In hard mode: blocks merge
    const hardEval = evaluateReviewGateState(unknownReview, { enforcementMode: "hard" });
    expect(hardEval.state).toBe("unknown");
    expect(hardEval.action).toBe("block");
    expect(hardEval.blocksMerge).toBe(true);
  });

  test("State 6: 'stale' when commit head moved after review", () => {
    const reviewHead = "1111111111111111111111111111111111111111";
    const newHead = "2222222222222222222222222222222222222222";

    const mergeReview = sampleMergeReview({
      head_sha: reviewHead,
      reviews: [sampleReview()],
    });

    const evalStale = evaluateMergeReviewGateState(mergeReview, {
      enforcementMode: "warn",
      currentHeadSha: newHead,
    });

    expect(evalStale.state).toBe("stale");
    expect(evalStale.action).toBe("warn");
    expect(evalStale.blocksMerge).toBe(false);
    expect(evalStale.message).toContain("Merge review is stale");

    const hardStale = evaluateMergeReviewGateState(mergeReview, {
      enforcementMode: "hard",
      currentHeadSha: newHead,
    });
    expect(hardStale.state).toBe("stale");
    expect(hardStale.action).toBe("block");
    expect(hardStale.blocksMerge).toBe(true);
  });

  test("evaluateReviewGateState aggregates findings correctly", () => {
    // Review with open red flag under warn-only mode
    const reviewWithFlag = sampleReview({
      flags: [sampleBlockingFinding({ status: "open" })],
    });
    const reviewEval = evaluateReviewGateState(reviewWithFlag, { enforcementMode: "warn" });
    expect(reviewEval.state).toBe("would-have-blocked");
    expect(reviewEval.action).toBe("warn");
    expect(reviewEval.blocksMerge).toBe(false);

    // Same review under hard mode
    const hardReviewEval = evaluateReviewGateState(reviewWithFlag, { enforcementMode: "hard" });
    expect(hardReviewEval.state).toBe("open");
    expect(hardReviewEval.action).toBe("block");
    expect(hardReviewEval.blocksMerge).toBe(true);

    // Review with overridden red flag
    const reviewWithOverride = sampleReview({
      flags: [
        sampleBlockingFinding({
          status: "overridden",
          resolution: { by: "litlfred", at: NOW, reason: "overridden" },
        }),
      ],
    });
    const overrideReviewEval = evaluateReviewGateState(reviewWithOverride, { enforcementMode: "warn" });
    expect(overrideReviewEval.state).toBe("overridden");
    expect(overrideReviewEval.action).toBe("pass");
    expect(overrideReviewEval.blocksMerge).toBe(false);
  });
});
