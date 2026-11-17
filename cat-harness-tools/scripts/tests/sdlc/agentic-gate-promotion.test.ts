/**
 * Test suite for agentic gate promotion criteria and would-have-blocked counterfactual records.
 *
 * Bean folio-assistant-h1uq: WARN -> BLOCK NEEDS A NUMBER.
 *
 * Validates:
 * 1. WouldHaveBlockedRecordSchema parsing, constraints, and validation refusals.
 * 2. Strict third-state handling for "unknown" in FPR calculation (never folded into TP or FP).
 * 3. Threshold evaluation against pre-registered promotion criteria:
 *    - Passing promotion when window >= 50, coverage >= 80%, FPR <= 5%.
 *    - Failing promotion (holding at warn) when window < 50, coverage < 80%, or FPR > 5%.
 *    - Literature baseline: CodeAgent's 48.6% unconfirmed rate prevents promotion.
 *
 * @module scripts/tests/agentic-gate-promotion
 */
import { describe, expect, test } from "bun:test";

import {
  WouldHaveBlockedRecordSchema,
  WouldHaveBlockedFindingSchema,
  AgenticPromotionCriteriaSchema,
  DEFAULT_AGENTIC_PROMOTION_CRITERIA,
  calculateWouldHaveBlockedMetrics,
  evaluateAgenticPromotion,
  WOULD_HAVE_BLOCKED_TAG,
  type WouldHaveBlockedRecord,
  type WouldHaveBlockedFinding,
} from "../../../schemas/sdlc/merge-queue.ts";

import {
  WouldHaveBlockedRecordSchema as ReexportedRecordSchema,
  evaluateAgenticPromotion as reexportedEvaluate,
} from "../../../schemas/sdlc/merge-review.ts";

const VALID_HEAD_SHA = "0123456789abcdef0123456789abcdef01234567";

function makeFinding(
  id: string,
  verdict?: "true_positive" | "false_positive" | "unknown",
): WouldHaveBlockedFinding {
  return {
    id,
    rule: "RedFlag_IrreversibleAction",
    severity: "blocking",
    explanation: `Simulated finding ${id}`,
    ...(verdict ? { humanVerdict: verdict } : {}),
  };
}

function makeRecord(
  prNumber: number,
  findings: WouldHaveBlockedFinding[],
  evaluatedAt = "2026-10-09T18:00:00Z",
): WouldHaveBlockedRecord {
  const metrics = calculateWouldHaveBlockedMetrics(findings);
  return {
    $schema: WOULD_HAVE_BLOCKED_TAG,
    headSha: VALID_HEAD_SHA,
    prNumber,
    evaluatedAt,
    findings,
    metrics,
  };
}

describe("WouldHaveBlockedRecordSchema validation", () => {
  test("accepts a valid would-have-blocked record", () => {
    const findings: WouldHaveBlockedFinding[] = [
      makeFinding("f1", "true_positive"),
      makeFinding("f2", "false_positive"),
      makeFinding("f3", "unknown"),
    ];
    const record = makeRecord(101, findings);

    const parsed = WouldHaveBlockedRecordSchema.parse(record);
    expect(parsed.prNumber).toBe(101);
    expect(parsed.headSha).toBe(VALID_HEAD_SHA);
    expect(parsed.findings.length).toBe(3);
    expect(parsed.metrics.warnedFindings).toBe(3);
    expect(parsed.metrics.confirmedTruePositives).toBe(1);
    expect(parsed.metrics.confirmedFalsePositives).toBe(1);
    expect(parsed.metrics.unknownCount).toBe(1);
    expect(parsed.metrics.empiricalFpr).toBeCloseTo(0.5, 4);
  });

  test("schemas/sdlc/merge-review.ts re-exports the identical schema", () => {
    expect(ReexportedRecordSchema).toBe(WouldHaveBlockedRecordSchema);
    expect(reexportedEvaluate).toBe(evaluateAgenticPromotion);
  });

  test("refuses an invalid headSha (non-hex, wrong length)", () => {
    const findings = [makeFinding("f1", "true_positive")];
    const base = makeRecord(1, findings);

    expect(() =>
      WouldHaveBlockedRecordSchema.parse({
        ...base,
        headSha: "too-short",
      }),
    ).toThrow();

    expect(() =>
      WouldHaveBlockedRecordSchema.parse({
        ...base,
        headSha: "g".repeat(40), // 'g' is not hex
      }),
    ).toThrow();
  });

  test("refuses invalid prNumber (zero or negative)", () => {
    const base = makeRecord(1, [makeFinding("f1")]);

    expect(() =>
      WouldHaveBlockedRecordSchema.parse({
        ...base,
        prNumber: 0,
      }),
    ).toThrow();

    expect(() =>
      WouldHaveBlockedRecordSchema.parse({
        ...base,
        prNumber: -5,
      }),
    ).toThrow();
  });

  test("refuses non-blocking severity in finding", () => {
    expect(() =>
      WouldHaveBlockedFindingSchema.parse({
        id: "f1",
        rule: "SomeRule",
        severity: "suggestion", // must be "blocking"
        explanation: "not blocking",
      }),
    ).toThrow();
  });

  test("refuses invalid humanVerdict", () => {
    expect(() =>
      WouldHaveBlockedFindingSchema.parse({
        id: "f1",
        rule: "SomeRule",
        severity: "blocking",
        explanation: "blocking",
        humanVerdict: "approved", // not in enum
      }),
    ).toThrow();
  });

  test("refuses invalid evaluatedAt date string", () => {
    const base = makeRecord(1, []);
    expect(() =>
      WouldHaveBlockedRecordSchema.parse({
        ...base,
        evaluatedAt: "not-a-valid-date",
      }),
    ).toThrow();
  });

  test("AgenticPromotionCriteriaSchema validates criteria boundaries", () => {
    const valid = AgenticPromotionCriteriaSchema.parse({
      minimumPrWindow: 50,
      maximumFalsePositiveRate: 0.05,
      minimumReviewCoverage: 0.8,
    });
    expect(valid.minimumPrWindow).toBe(50);
    expect(valid.maximumFalsePositiveRate).toBe(0.05);

    // Negative window rejected
    expect(() =>
      AgenticPromotionCriteriaSchema.parse({
        minimumPrWindow: -1,
        maximumFalsePositiveRate: 0.05,
        minimumReviewCoverage: 0.8,
      }),
    ).toThrow();

    // FPR > 1 rejected
    expect(() =>
      AgenticPromotionCriteriaSchema.parse({
        minimumPrWindow: 50,
        maximumFalsePositiveRate: 1.5,
        minimumReviewCoverage: 0.8,
      }),
    ).toThrow();
  });
});

describe("FPR calculation and strict third-state rule", () => {
  test("computes zero FPR when all findings are confirmed true positives", () => {
    const findings: WouldHaveBlockedFinding[] = [
      makeFinding("f1", "true_positive"),
      makeFinding("f2", "true_positive"),
    ];
    const metrics = calculateWouldHaveBlockedMetrics(findings);
    expect(metrics.warnedFindings).toBe(2);
    expect(metrics.confirmedTruePositives).toBe(2);
    expect(metrics.confirmedFalsePositives).toBe(0);
    expect(metrics.unknownCount).toBe(0);
    expect(metrics.empiricalFpr).toBe(0.0);
  });

  test("computes expected FPR on adjudicated findings", () => {
    const findings: WouldHaveBlockedFinding[] = [
      ...Array.from({ length: 9 }, (_, i) => makeFinding(`tp-${i}`, "true_positive")),
      makeFinding("fp-1", "false_positive"),
    ];
    const metrics = calculateWouldHaveBlockedMetrics(findings);
    expect(metrics.warnedFindings).toBe(10);
    expect(metrics.confirmedTruePositives).toBe(9);
    expect(metrics.confirmedFalsePositives).toBe(1);
    expect(metrics.unknownCount).toBe(0);
    expect(metrics.empiricalFpr).toBeCloseTo(0.1, 4); // 1 / (9 + 1) = 10%
  });

  test("STRICT THIRD STATE: unknown is never folded into TP or FP", () => {
    // 8 True Positives, 1 False Positive, 10 Unknown, 1 unadjudicated (undefined)
    const findings: WouldHaveBlockedFinding[] = [
      ...Array.from({ length: 8 }, (_, i) => makeFinding(`tp-${i}`, "true_positive")),
      makeFinding("fp-1", "false_positive"),
      ...Array.from({ length: 10 }, (_, i) => makeFinding(`unk-${i}`, "unknown")),
      makeFinding("unadjudicated-1"),
    ];

    const metrics = calculateWouldHaveBlockedMetrics(findings);

    expect(metrics.warnedFindings).toBe(20);
    expect(metrics.confirmedTruePositives).toBe(8);
    expect(metrics.confirmedFalsePositives).toBe(1);
    expect(metrics.unknownCount).toBe(11); // 10 unknown + 1 undefined

    // Total adjudicated = 8 + 1 = 9
    // Strict empirical FPR = 1 / 9 = ~0.1111 (11.11%)
    expect(metrics.empiricalFpr).toBeCloseTo(1 / 9, 4);

    // Verify it was NOT folded into TP (which would falsely deflate FPR to 1 / 20 = 5.0%):
    expect(metrics.empiricalFpr).not.toBeCloseTo(1 / 20, 3);

    // Verify it was NOT folded into FP (which would falsely inflate FPR to 12 / 20 = 60.0%):
    expect(metrics.empiricalFpr).not.toBeCloseTo(12 / 20, 3);
  });

  test("empiricalFpr is undefined when no findings are adjudicated", () => {
    const findings: WouldHaveBlockedFinding[] = [
      makeFinding("unk-1", "unknown"),
      makeFinding("unk-2", "unknown"),
      makeFinding("unadj-1"),
    ];
    const metrics = calculateWouldHaveBlockedMetrics(findings);
    expect(metrics.warnedFindings).toBe(3);
    expect(metrics.confirmedTruePositives).toBe(0);
    expect(metrics.confirmedFalsePositives).toBe(0);
    expect(metrics.unknownCount).toBe(3);
    expect(metrics.empiricalFpr).toBeUndefined();
  });

  test("handles empty findings list gracefully", () => {
    const metrics = calculateWouldHaveBlockedMetrics([]);
    expect(metrics.warnedFindings).toBe(0);
    expect(metrics.confirmedTruePositives).toBe(0);
    expect(metrics.confirmedFalsePositives).toBe(0);
    expect(metrics.unknownCount).toBe(0);
    expect(metrics.empiricalFpr).toBeUndefined();
  });
});

describe("Threshold evaluation against promotion criteria", () => {
  test("fails promotion when evaluation window is unmet (< 50 PRs)", () => {
    // 25 PRs with 100% clean record (0% FPR, 100% coverage)
    const records: WouldHaveBlockedRecord[] = Array.from({ length: 25 }, (_, i) =>
      makeRecord(i + 1, [makeFinding(`tp-${i}`, "true_positive")]),
    );

    const result = evaluateAgenticPromotion(records, DEFAULT_AGENTIC_PROMOTION_CRITERIA);

    expect(result.promoted).toBe(false);
    expect(result.decision).toBe("remain_warn_only");
    expect(result.checks.prWindowMet).toBe(false);
    expect(result.checks.reviewCoverageMet).toBe(true);
    expect(result.checks.falsePositiveRateMet).toBe(true);
    expect(result.reasons.some((r) => r.includes("PR window not met"))).toBe(true);
  });

  test("fails promotion when review coverage is below threshold (< 80%)", () => {
    // 50 PRs, each with 1 TP and 4 unknown findings -> coverage = 50 / 250 = 20%
    const records: WouldHaveBlockedRecord[] = Array.from({ length: 50 }, (_, i) =>
      makeRecord(i + 1, [
        makeFinding(`tp-${i}`, "true_positive"),
        ...Array.from({ length: 4 }, (_, j) => makeFinding(`unk-${i}-${j}`, "unknown")),
      ]),
    );

    const result = evaluateAgenticPromotion(records, DEFAULT_AGENTIC_PROMOTION_CRITERIA);

    expect(result.promoted).toBe(false);
    expect(result.decision).toBe("remain_warn_only");
    expect(result.checks.prWindowMet).toBe(true);
    expect(result.checks.reviewCoverageMet).toBe(false);
    expect(result.metrics.reviewCoverage).toBeCloseTo(0.2, 2);
    expect(result.reasons.some((r) => r.includes("Review coverage not met"))).toBe(true);
  });

  test("fails promotion when empirical FPR exceeds threshold (> 5%)", () => {
    // 50 PRs: 90 true positives and 10 false positives across the corpus -> FPR = 10%
    const records: WouldHaveBlockedRecord[] = Array.from({ length: 50 }, (_, i) => {
      const isFp = i < 5; // 5 PRs have 2 FPs each = 10 FPs; 45 PRs have 2 TPs = 90 TPs
      const findings = isFp
        ? [makeFinding(`fp-${i}-1`, "false_positive"), makeFinding(`fp-${i}-2`, "false_positive")]
        : [makeFinding(`tp-${i}-1`, "true_positive"), makeFinding(`tp-${i}-2`, "true_positive")];
      return makeRecord(i + 1, findings);
    });

    const result = evaluateAgenticPromotion(records, DEFAULT_AGENTIC_PROMOTION_CRITERIA);

    expect(result.promoted).toBe(false);
    expect(result.decision).toBe("remain_warn_only");
    expect(result.checks.prWindowMet).toBe(true);
    expect(result.checks.reviewCoverageMet).toBe(true);
    expect(result.checks.falsePositiveRateMet).toBe(false);
    expect(result.metrics.empiricalFpr).toBeCloseTo(0.1, 4);
    expect(result.reasons.some((r) => r.includes("Empirical false-positive rate not met"))).toBe(true);
  });

  test("fails promotion under CodeAgent literature baseline (48.6% unconfirmed rate)", () => {
    // 50 PRs of 10 adjudicated findings each, 243 of the 500 false positives:
    // FPR = 243/500 = 48.6%, the literature's rate, with window and coverage met
    // so that the rate alone holds the gate at warn.
    const records: WouldHaveBlockedRecord[] = Array.from({ length: 50 }, (_, i) =>
      makeRecord(
        i + 1,
        Array.from({ length: 10 }, (_, j) => {
          const k = i * 10 + j;
          return makeFinding(`f-${k}`, k < 243 ? "false_positive" : "true_positive");
        }),
      ),
    );

    const result = evaluateAgenticPromotion(records);
    expect(result.promoted).toBe(false);
    expect(result.decision).toBe("remain_warn_only");
    expect(result.metrics.empiricalFpr).toBeCloseTo(0.486, 4);
    expect(result.checks.prWindowMet).toBe(true);
    expect(result.checks.reviewCoverageMet).toBe(true);
    expect(result.checks.falsePositiveRateMet).toBe(false);
  });

  test("SUCCEEDS promotion when all criteria are met (window >= 50, coverage >= 80%, FPR <= 5%)", () => {
    // 50 PRs: 98 confirmed true positives, 2 false positives, 5 unknown
    // Total findings = 105
    // Adjudicated = 100 -> coverage = 100/105 = 95.2% (>= 80%)
    // FPR = 2/100 = 2.0% (<= 5.0%)
    // Window = 50 (>= 50)
    // PRs 0 and 1: one true positive and one false positive; the other 48:
    // two true positives (2 + 96 = 98). PRs 0-4 each add one unknown.
    const records: WouldHaveBlockedRecord[] = Array.from({ length: 50 }, (_, i) => {
      const findings: WouldHaveBlockedFinding[] =
        i === 0 || i === 1
          ? [makeFinding(`tp-${i}-a`, "true_positive"), makeFinding(`fp-${i}`, "false_positive")]
          : [makeFinding(`tp-${i}-a`, "true_positive"), makeFinding(`tp-${i}-b`, "true_positive")];
      if (i < 5) {
        findings.push(makeFinding(`unk-${i}`, "unknown"));
      }
      return makeRecord(i + 1, findings);
    });

    const result = evaluateAgenticPromotion(records, DEFAULT_AGENTIC_PROMOTION_CRITERIA);

    expect(result.promoted).toBe(true);
    expect(result.decision).toBe("promote_to_block");
    expect(result.checks.prWindowMet).toBe(true);
    expect(result.checks.reviewCoverageMet).toBe(true);
    expect(result.checks.falsePositiveRateMet).toBe(true);
    expect(result.metrics.empiricalFpr).toBeCloseTo(2 / 100, 4);
    expect(result.metrics.reviewCoverage).toBeCloseTo(100 / 105, 4);
    expect(result.reasons.some((r) => r.includes("All criteria met"))).toBe(true);
  });
});
