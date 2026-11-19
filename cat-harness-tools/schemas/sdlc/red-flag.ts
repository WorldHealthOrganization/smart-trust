/**
 * RED FLAG taxonomy, adversarial review sidecar schema, and recorded override path.
 *
 * ## What is a RED FLAG?
 *
 * A RED FLAG is a finding the reviewer asserts **would block the merge**. It
 * reuses the two existing axes in `schemas/sdlc/qa-review.ts`:
 * - `FindingSeverity` (critical | major | minor: what kind of breakage)
 * - `FindingWeight` (blocking | suggestion | praise: what the reviewer asks of the gate)
 *
 * A RED FLAG is `weight: "blocking"` with a category from a closed taxonomy:
 * `security`, `data-loss`, `correctness`, `false-green`, `provenance`,
 * `scope-breach`, `irreversible-action`, `licence`.
 *
 * Evidence is strictly REQUIRED for any `blocking` finding: a finding without
 * reproducible observation cannot be blocking (it is demoted to `suggestion`).
 *
 * ## Warn-only review
 *
 * The review warns; it does not block. An open red flag is evaluated by the
 * gate as `would-have-blocked` rather than holding the merge, which keeps the
 * taxonomy and the `blocking` weight and records the data needed to decide on
 * promoting it to a gate later.
 *
 * ## The human override path
 *
 * A red flag is NEVER deleted. An override is a recorded decision by a human
 * with standing (who, when, why, and finding ID). The finding's status becomes
 * `overridden` with a full resolution record; the gate passes on `resolved` or
 * `overridden` and warns/blocks on `open` / `would-have-blocked`.
 *
 * @module schemas/red-flag
 * @graphNode schema
 */

import { z } from "zod";

import { QA_REVIEWER_KINDS, type QaReviewerKind } from "./block-qa";

export const FINDING_SEVERITIES = ["critical", "major", "minor"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_WEIGHTS = ["blocking", "suggestion", "praise"] as const;
export type FindingWeight = (typeof FINDING_WEIGHTS)[number];

export interface ReviewerRef {
  kind: QaReviewerKind;
  id: string;
  version?: string;
}

export const ReviewerRefSchema = z.object({
  kind: z.enum(QA_REVIEWER_KINDS),
  id: z.string().min(1),
  version: z.string().optional(),
});


/** Marker for merge review verdicts. */
export const MERGE_REVIEW_SCHEMA = "merge-review/v1" as const;

// ── 1. The RED FLAG Taxonomy ────────────────────────────────────────────────

/**
 * The closed vocabulary of RED FLAG categories.
 *
 * Every finding with `weight: "blocking"` MUST select exactly one category
 * from this closed taxonomy.
 */
export const RED_FLAG_CATEGORIES = [
  "security",
  "data-loss",
  "correctness",
  "false-green",
  "provenance",
  "scope-breach",
  "irreversible-action",
  "licence",
] as const;

export type RedFlagCategory = (typeof RED_FLAG_CATEGORIES)[number];

export const RedFlagCategorySchema = z.enum(RED_FLAG_CATEGORIES);

/** Definition and historical repository example for each category. */
export interface RedFlagCategoryDefinition {
  category: RedFlagCategory;
  /** What this category means and what kind of defect it covers. */
  definition: string;
  /** Concrete historical example drawn from this repository's history. */
  historicalExample: string;
}

export const RED_FLAG_DEFINITIONS: Readonly<Record<RedFlagCategory, RedFlagCategoryDefinition>> = {
  security: {
    category: "security",
    definition:
      "Secret exposure, injection (command, SQL, HTML), escalated workflow permissions, or untrusted input reaching execution contexts.",
    historicalExample:
      "An `agent-review.yml`-style job holding API keys on pull request code, exposing secrets to untrusted branch code.",
  },
  "data-loss": {
    category: "data-loss",
    definition:
      "Unchecked overwrite, truncation, or unintended erasure of stored data, durable history, or uncommitted work.",
    historicalExample:
      "Defects `de9k` and `c1` where git merge conflict markers or blind overwrites corrupted attestation stores and uncommitted edits.",
  },
  correctness: {
    category: "correctness",
    definition:
      "A concrete input produces an incorrect result, violates logical invariants, or crashes on valid inputs.",
    historicalExample:
      "Command `beans <id> --status in-progress` exiting 1 with `unknown command` (measured 2026-09-25) and `beans:claim` answering 'go ahead' for unheld claims (`c3d7`).",
  },
  "false-green": {
    category: "false-green",
    definition:
      "A check, test, or gate can report pass without actually evaluating its subject (vacuous pass or third-state collapse).",
    historicalExample:
      "`lean-bare-import` printing OK over zero files; `dh4f` where a declared-but-absent directory was scanned as clean; `0qjq` vacuous pass.",
  },
  provenance: {
    category: "provenance",
    definition:
      "A claim in a PR, bean, commit, or skill that is contradicted or unsupported by corpus evidence or attestation.",
    historicalExample:
      "`w4tq` where re-running numeric claims revealed one was wrong; unverified agent session attribution.",
  },
  "scope-breach": {
    category: "scope-breach",
    definition:
      "Changes outside the authorized bean, issue, or declared module boundary, or hand-editing generated/managed directories.",
    historicalExample:
      "Path escape `..` in `kgQaSidecarPath` escaping the instance boundary (bean `7u3g`); modifying files outside a declared task scope.",
  },
  "irreversible-action": {
    category: "irreversible-action",
    definition:
      "Deletes or permanently overwrites a durable artifact or branch without explicit human confirmation.",
    historicalExample:
      "Defect `plj1` where a workflow silently deleted every open PR's staging preview without confirmation; violating `deletion-requires-confirmation`.",
  },
  licence: {
    category: "licence",
    definition:
      "Importing, incorporating, or copying content or code whose licence or terms forbid its use or omit required attribution/notices.",
    historicalExample:
      "Importing third-party code without compatible licensing or required SPDX headers into the platform.",
  },
};

/** Whether an unknown string is a recognized RedFlagCategory. */
export function isRedFlagCategory(value: unknown): value is RedFlagCategory {
  return typeof value === "string" && (RED_FLAG_CATEGORIES as readonly string[]).includes(value);
}

/** Retrieve the definition and historical example for a category. */
export function getRedFlagDefinition(category: RedFlagCategory): RedFlagCategoryDefinition {
  return RED_FLAG_DEFINITIONS[category];
}

// ── 2. Adversarial Review Finding and Sidecar Schemas ───────────────────────

/** Finding status within an adversarial review. */
export const FINDING_STATUSES = ["open", "resolved", "overridden"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/** Resolution record attached when a finding is resolved or overridden. */
export const FindingResolutionSchema = z.object({
  by: z.string().min(1),
  at: z.string().min(1),
  commit: z.string().optional(),
  decision: z.string().optional(), // qa-review decision id or override id
  reason: z.string().min(1),
});
export type FindingResolution = z.infer<typeof FindingResolutionSchema>;

/**
 * An individual finding produced during an adversarial review.
 *
 * Invariants enforced by schema:
 * - When `weight === "blocking"`, `category` MUST be a valid `RedFlagCategory`.
 * - When `weight === "blocking"`, non-empty `evidence` MUST be provided.
 */
export const AdversarialFindingSchema = z
  .object({
    id: z.string().min(1),
    category: RedFlagCategorySchema.optional(),
    severity: z.enum(FINDING_SEVERITIES),
    weight: z.enum(FINDING_WEIGHTS),
    where: z.string().min(1),
    evidence: z.string().default(""),
    detail: z.string().optional(),
    status: z.enum(FINDING_STATUSES).default("open"),
    resolution: FindingResolutionSchema.optional(),
  })
  .superRefine((finding, ctx) => {
    if (finding.weight === "blocking") {
      if (!finding.category) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A blocking finding (RED FLAG) must carry a RedFlagCategory from the closed taxonomy.",
          path: ["category"],
        });
      }
      if (!finding.evidence || finding.evidence.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A blocking finding (RED FLAG) must carry non-empty evidence citing line, file, or test result.",
          path: ["evidence"],
        });
      }
    }
  });

export type AdversarialFinding = z.infer<typeof AdversarialFindingSchema>;

/** Coverage stats for an adversarial review. */
export const ReviewCoverageSchema = z.object({
  files_total: z.number().int().nonnegative(),
  files_reviewed: z.number().int().nonnegative(),
  skipped: z
    .array(
      z.object({
        path: z.string().min(1),
        why: z.string().min(1),
      }),
    )
    .default([]),
  truncated: z.boolean().optional(),
});
export type ReviewCoverage = z.infer<typeof ReviewCoverageSchema>;

/** Outcome of an adversarial review. */
export const REVIEW_RESULTS = ["pass", "fail", "unknown"] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

/**
 * An adversarial review record, compatible with `kg-qa/v1` sidecars and PR merge reviews.
 */
export const AdversarialReviewSchema = z.object({
  reviewer: z.object({
    by: z.enum(["agent", "human"]),
    session: z.string().min(1),
    model: z.string().nullable().default(null),
  }),
  author_sessions: z.array(z.string()).default([]),
  skill_hash: z.string().min(1),
  at: z.string().min(1),
  coverage: ReviewCoverageSchema,
  result: z.enum(REVIEW_RESULTS),
  flags: z.array(AdversarialFindingSchema).default([]),
  findings: z.array(AdversarialFindingSchema).optional(),
});

export type AdversarialReview = z.infer<typeof AdversarialReviewSchema>;

/** Retrieve all findings/flags from an adversarial review. */
export function getReviewFindings(review: AdversarialReview): AdversarialFinding[] {
  if (review.flags && review.flags.length > 0) return review.flags;
  if (review.findings && review.findings.length > 0) return review.findings;
  return [];
}

/** PR-level merge review containing adversarial reviews bound to commit SHAs. */
export const MergeReviewSchema = z.object({
  $schema: z.literal(MERGE_REVIEW_SCHEMA),
  pr: z.number().int().positive().optional(),
  /**
   * The repository `pr` is in, `owner/repo`. Optional, as `pr` is: the gate
   * looks a verdict up by its head sha, but a reader of the store cannot link
   * a pull request number without it. A reader links only an `owner/repo`
   * spelling, so a malformed one costs the link, never the verdict.
   */
  repository: z.string().min(1).optional(),
  base_sha: z.string().min(1),
  head_sha: z.string().min(1),
  tree: z.string().optional(),
  reviews: z.array(AdversarialReviewSchema).default([]),
  updated_at: z.string().optional(),
});

export type MergeReview = z.infer<typeof MergeReviewSchema>;

// ── 3. The Human Override Path ──────────────────────────────────────────────

/**
 * A recorded human override decision.
 *
 * Rules:
 * - Must be made by a human reviewer (`by.kind === "human"`).
 * - Must record `standing` (role, e.g. "owner", "maintainer", "lead").
 * - Must specify `finding_id` (or `flag_id`) identifying the red flag.
 * - Must provide a non-empty `reason` (why).
 * - Must record timestamp `at`.
 * - Never deletes the finding; instead transitions it to `status: "overridden"`.
 */
export const OverrideDecisionSchema = z
  .object({
    id: z.string().min(1),
    finding_id: z.string().min(1).optional(),
    flag_id: z.string().min(1).optional(),
    by: ReviewerRefSchema.refine((r) => r.kind === "human", {
      message: "An override decision must be made by a human reviewer (by.kind === 'human').",
    }),
    standing: z.string().min(1),
    reason: z.string().min(1),
    at: z.string().min(1),
    audit_note_id: z.string().optional(),
    commit: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.finding_id && !data.flag_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An override decision must specify either finding_id or flag_id.",
        path: ["finding_id"],
      });
    }
  });

export type RedFlagOverride = z.infer<typeof OverrideDecisionSchema>;

/** Get the targeted finding ID from an override decision. */
export function getOverrideFindingId(override: RedFlagOverride): string {
  return (override.finding_id ?? override.flag_id)!;
}

/**
 * Apply a human override to a finding.
 *
 * The finding is updated with `status: "overridden"` and a resolution record
 * containing the override decision details. The finding is NEVER deleted.
 */
export function applyRedFlagOverride(
  finding: AdversarialFinding,
  override: RedFlagOverride,
): AdversarialFinding {
  const targetId = getOverrideFindingId(override);
  if (finding.id !== targetId) {
    throw new Error(
      `Cannot apply override for finding '${targetId}' to finding '${finding.id}'. Finding IDs must match.`,
    );
  }
  return {
    ...finding,
    status: "overridden",
    resolution: {
      by: override.by.id,
      at: override.at,
      decision: override.id,
      reason: override.reason,
      commit: override.commit,
    },
  };
}

// ── 4. Gate Behaviour and State Derivation ───────────────────────────────────

/**
 * The six gate evaluation states:
 * - `open`: Active blocking finding under hard-gate mode. Blocks merge.
 * - `resolved`: Finding was fixed/addressed. Passes gate.
 * - `overridden`: Finding was overridden by human with standing. Passes gate.
 * - `would-have-blocked`: Active blocking finding under warn-only mode (2026-10-03 ruling). Warns, exits 0.
 * - `unknown`: Review failed, timed out, or had incomplete coverage. Warns/blocks loudly; never silent pass.
 * - `stale`: Review head SHA does not match current commit head. Needs re-review.
 */
export const RED_FLAG_GATE_STATES = [
  "open",
  "resolved",
  "overridden",
  "would-have-blocked",
  "unknown",
  "stale",
] as const;

export type RedFlagGateState = (typeof RED_FLAG_GATE_STATES)[number];
export const RedFlagGateStateSchema = z.enum(RED_FLAG_GATE_STATES);

/** Action the gate takes based on state. */
export type GateAction = "pass" | "warn" | "block";

/** Enforcement mode: 'warn' is the 2026-10-03 owner ruling; 'hard' is strict blocking. */
export type EnforcementMode = "warn" | "hard";

/** Result of evaluating a finding against the merge gate. */
export interface FindingGateEvaluation {
  state: RedFlagGateState;
  action: GateAction;
  blocksMerge: boolean;
  message: string;
  findingId: string;
  category?: RedFlagCategory;
}

/** Result of evaluating an entire review against the merge gate. */
export interface ReviewGateEvaluation {
  state: RedFlagGateState;
  action: GateAction;
  blocksMerge: boolean;
  message: string;
  evaluations: FindingGateEvaluation[];
}

/**
 * Evaluate the gate behaviour for a single finding.
 *
 * @param finding         The adversarial finding to evaluate.
 * @param enforcementMode "warn" (default, owner ruling) or "hard".
 */
export function evaluateFindingGateState(
  finding: AdversarialFinding,
  enforcementMode: EnforcementMode = "warn",
): FindingGateEvaluation {
  // Non-blocking findings (suggestions, praise) never hold the merge.
  if (finding.weight !== "blocking") {
    const st: RedFlagGateState =
      finding.status === "overridden"
        ? "overridden"
        : finding.status === "resolved"
          ? "resolved"
          : "resolved";
    return {
      state: st,
      action: "pass",
      blocksMerge: false,
      message: `Non-blocking finding '${finding.id}' (${finding.weight}) does not hold merge.`,
      findingId: finding.id,
      category: finding.category,
    };
  }

  // Blocking finding (RED FLAG)
  if (finding.status === "resolved") {
    return {
      state: "resolved",
      action: "pass",
      blocksMerge: false,
      message: `Red flag '${finding.id}' [${finding.category}] is resolved.`,
      findingId: finding.id,
      category: finding.category,
    };
  }

  if (finding.status === "overridden") {
    return {
      state: "overridden",
      action: "pass",
      blocksMerge: false,
      message: `Red flag '${finding.id}' [${finding.category}] is overridden by authorized decision.`,
      findingId: finding.id,
      category: finding.category,
    };
  }

  // Finding is open
  if (enforcementMode === "warn") {
    return {
      state: "would-have-blocked",
      action: "warn",
      blocksMerge: false,
      message: `Red flag '${finding.id}' [${finding.category}]: would have blocked the merge (warn-only ruling 2026-10-03).`,
      findingId: finding.id,
      category: finding.category,
    };
  } else {
    return {
      state: "open",
      action: "block",
      blocksMerge: true,
      message: `Red flag '${finding.id}' [${finding.category}]: open blocking finding blocks merge.`,
      findingId: finding.id,
      category: finding.category,
    };
  }
}

/** Options for review gate evaluation. */
export interface ReviewGateOptions {
  enforcementMode?: EnforcementMode;
  currentHeadSha?: string;
  expectedHeadSha?: string;
  authorSessions?: string[];
}

/**
 * Evaluate the gate behaviour for an adversarial review.
 *
 * @param review  The review to evaluate.
 * @param options Options including enforcement mode, head SHA comparison, and author sessions.
 */
export function evaluateReviewGateState(
  review: AdversarialReview,
  options: ReviewGateOptions = {},
): ReviewGateEvaluation {
  const mode = options.enforcementMode ?? "warn";
  const currentHead = options.currentHeadSha ?? options.expectedHeadSha;

  // 1. Check staleness if head SHA is available on review
  const revWithHead = review as unknown as { head_sha?: string };
  if (currentHead && revWithHead.head_sha && revWithHead.head_sha !== currentHead) {
    return {
      state: "stale",
      action: mode === "hard" ? "block" : "warn",
      blocksMerge: mode === "hard",
      message: `Review is stale: reviewed head '${revWithHead.head_sha}' does not match current head '${currentHead}'.`,
      evaluations: [],
    };
  }

  // 2. Check unknown outcome or truncated coverage
  if (review.result === "unknown" || review.coverage?.truncated === true) {
    return {
      state: "unknown",
      action: mode === "hard" ? "block" : "warn",
      blocksMerge: mode === "hard",
      message: review.coverage?.truncated
        ? "Review coverage was truncated. Silent truncation is forbidden; a truncated review is unknown."
        : "Review outcome is unknown: reviewer failed or coverage was incomplete. Never a silent pass.",
      evaluations: [],
    };
  }

  // 3. Check reviewer independence and complete record
  const authors = [...(review.author_sessions ?? []), ...(options.authorSessions ?? [])];
  if (authors.includes(review.reviewer.session)) {
    return {
      state: "unknown",
      action: mode === "hard" ? "block" : "warn",
      blocksMerge: mode === "hard",
      message: `Reviewer independence violation: reviewer session '${review.reviewer.session}' matches author session.`,
      evaluations: [],
    };
  }
  if (review.reviewer.by === "agent" && (!review.reviewer.session || !review.reviewer.model)) {
    return {
      state: "unknown",
      action: mode === "hard" ? "block" : "warn",
      blocksMerge: mode === "hard",
      message: "Reviewer record incomplete: agent reviewer must record session id and model.",
      evaluations: [],
    };
  }

  // 4. Evaluate each finding
  const findings = getReviewFindings(review);
  const evaluations = findings.map((f) => evaluateFindingGateState(f, mode));

  // Determine aggregate review state by precedence
  const openEval = evaluations.find((e) => e.state === "open");
  if (openEval) {
    return {
      state: "open",
      action: "block",
      blocksMerge: true,
      message: openEval.message,
      evaluations,
    };
  }

  const wouldBlockEval = evaluations.find((e) => e.state === "would-have-blocked");
  if (wouldBlockEval) {
    return {
      state: "would-have-blocked",
      action: "warn",
      blocksMerge: false,
      message: wouldBlockEval.message,
      evaluations,
    };
  }

  const overriddenEval = evaluations.find((e) => e.state === "overridden");
  if (overriddenEval && evaluations.every((e) => e.action === "pass")) {
    return {
      state: "overridden",
      action: "pass",
      blocksMerge: false,
      message: "All blocking findings were overridden by authorized decisions.",
      evaluations,
    };
  }

  return {
    state: "resolved",
    action: "pass",
    blocksMerge: false,
    message: "Clean review: no open red flags.",
    evaluations,
  };
}

/**
 * Evaluate the gate behaviour for a PR MergeReview.
 *
 * @param mergeReview The PR merge review record.
 * @param options     Options including enforcement mode and current head SHA.
 */
export function evaluateMergeReviewGateState(
  mergeReview: MergeReview,
  options: ReviewGateOptions = {},
): ReviewGateEvaluation {
  const mode = options.enforcementMode ?? "warn";
  const currentHead = options.currentHeadSha ?? options.expectedHeadSha;

  // 1. Check staleness against PR head
  if (currentHead && mergeReview.head_sha !== currentHead) {
    return {
      state: "stale",
      action: mode === "hard" ? "block" : "warn",
      blocksMerge: mode === "hard",
      message: `Merge review is stale: reviewed head '${mergeReview.head_sha}' does not match PR head '${currentHead}'.`,
      evaluations: [],
    };
  }

  // 2. Check presence of reviews
  if (!mergeReview.reviews || mergeReview.reviews.length === 0) {
    return {
      state: "unknown",
      action: mode === "hard" ? "block" : "warn",
      blocksMerge: mode === "hard",
      message: "No adversarial reviews recorded on this merge review.",
      evaluations: [],
    };
  }

  // 3. Evaluate each review
  const reviewEvals = mergeReview.reviews.map((r) =>
    evaluateReviewGateState(r, {
      ...options,
      currentHeadSha: mergeReview.head_sha,
    }),
  );

  const stale = reviewEvals.find((r) => r.state === "stale");
  if (stale) return stale;

  const unknown = reviewEvals.find((r) => r.state === "unknown");
  if (unknown) return unknown;

  const open = reviewEvals.find((r) => r.state === "open");
  if (open) return open;

  const wouldBlock = reviewEvals.find((r) => r.state === "would-have-blocked");
  if (wouldBlock) return wouldBlock;

  const overridden = reviewEvals.find((r) => r.state === "overridden");
  if (overridden) return overridden;

  return {
    state: "resolved",
    action: "pass",
    blocksMerge: false,
    message: "Merge review clean: all adversarial reviews passed.",
    evaluations: reviewEvals.flatMap((r) => r.evaluations),
  };
}
