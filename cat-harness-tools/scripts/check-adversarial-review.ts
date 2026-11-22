#!/usr/bin/env bun
/**
 * Adversarial Review Merge Gate Checker
 *
 * ## What this gate checks
 *
 * 1. Provenance: Detects whether >= 1 agent touched the PR (branch, trailers, bot).
 *    Negative case: Human-only PRs are skipped ("human-only PR: no adversarial review required").
 * 2. SHA Binding: Review verdict must strictly bind to PR head SHA. If head moved -> 'stale'.
 * 3. Whole-diff Coverage: Truncated diffs (`coverage.truncated === true`) or unreviewed
 *    changed files report 'unknown' (never silent pass, never truncated pass).
 * 4. Reviewer Independence: Reviewer must not match author session (`reviewer.session !== author.session`),
 *    and reviewer session and model must be recorded.
 * 5. Findings: Evaluated using RED FLAG taxonomy (`schemas/sdlc/red-flag.ts`).
 *
 * ## Warn-only by default
 *
 * The gate WARNS and reports; it does not block the merge. Like
 * `dependency-advisories`, it exits 0 across all states while keeping them
 * distinct (`clean`, `would-have-blocked`, `unknown`, `stale`, `skipped`).
 * Under `--strict` or `--mode hard`, blocking findings and unknown/stale states exit 1.
 *
 * @covers merge-reviews, qa, attestations — the merge-review verdict it looks for: the `merge-reviews` state graph first, then the declared `qa` tree and `attestations` store
 * @module scripts/check-adversarial-review
 * @graphNode tool
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { detectAgentProvenance, type AgentProvenanceResult } from "./agent-provenance.ts";
import { graphReadPath } from "./graph-read.ts";
import {
  evaluateMergeReviewGateState,
  evaluateReviewGateState,
  getRedFlagDefinition,
  isRedFlagCategory,
  MERGE_REVIEW_SCHEMA,
  MergeReviewSchema,
  AdversarialReviewSchema,
  type AdversarialReview,
  type EnforcementMode,
  type MergeReview,
  type ReviewGateEvaluation,
} from "../schemas/sdlc/red-flag.ts";
import { kgQaHomeFor } from "../schemas/kg/cat-harness.js";
import { attestationsHomeFor } from "../schemas/sdlc/qa-attestations.js";

/** The declared state graph that holds one `merge-review/v1` verdict per PR head. */
export const MERGE_REVIEWS_GRAPH = "merge-reviews";

export type AdversarialGateState =
  | "clean"
  | "would-have-blocked"
  | "open"
  | "unknown"
  | "stale"
  | "skipped";

export interface AdversarialGateCheckInput {
  provenance: AgentProvenanceResult;
  verdict?: MergeReview | AdversarialReview | null;
  currentHeadSha: string;
  baseRef?: string;
  changedFiles?: string[];
  enforcementMode?: EnforcementMode;
}

export interface AdversarialGateCheckResult {
  state: AdversarialGateState;
  action: "pass" | "warn" | "block";
  blocksMerge: boolean;
  verdictFound: boolean;
  isHumanOnly: boolean;
  currentHeadSha: string;
  reviewedHeadSha?: string;
  message: string;
  details: string[];
  findingsToReport: Array<{
    id: string;
    category?: string;
    severity: string;
    weight: string;
    where: string;
    evidence: string;
    historicalBasis?: string;
    state: string;
  }>;
  evaluation?: ReviewGateEvaluation;
}

export interface CheckAdversarialReviewOptions {
  baseRef?: string;
  headRef?: string;
  branch?: string;
  prBody?: string;
  verdictPath?: string;
  verdictDir?: string;
  enforcementMode?: EnforcementMode;
  cwd?: string;
}

/**
 * Get current git HEAD SHA.
 */
export function getGitHeadSha(ref = "HEAD", cwd?: string): string {
  const res = spawnSync("git", ["rev-parse", ref], {
    cwd,
    encoding: "utf-8",
    timeout: 5_000,
  });
  if (res.status === 0 && res.stdout.trim()) {
    return res.stdout.trim();
  }
  return ref;
}

/**
 * Get changed files in git diff between baseRef and headRef.
 */
export function getGitChangedFiles(baseRef?: string, headRef = "HEAD", cwd?: string): string[] {
  if (!baseRef) return [];
  const res = spawnSync("git", ["diff", "--name-only", `${baseRef}...${headRef}`], {
    cwd,
    encoding: "utf-8",
    timeout: 10_000,
  });
  if (res.status !== 0 || !res.stdout) {
    // Fallback to two-dot diff
    const fallback = spawnSync("git", ["diff", "--name-only", `${baseRef}..${headRef}`], {
      cwd,
      encoding: "utf-8",
      timeout: 10_000,
    });
    if (fallback.status === 0 && fallback.stdout) {
      return fallback.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }
    return [];
  }
  return res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Load and validate a MergeReview or AdversarialReview from a file path.
 */
export function loadVerdictFromFile(filePath: string): MergeReview | AdversarialReview | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));

    // Try MergeReviewSchema first
    const mergeParse = MergeReviewSchema.safeParse(raw);
    if (mergeParse.success) {
      return mergeParse.data;
    }

    // Try AdversarialReviewSchema
    const advParse = AdversarialReviewSchema.safeParse(raw);
    if (advParse.success) {
      return advParse.data;
    }

    // If raw carries $schema: "merge-review/v1" but failed validation, return null
    return null;
  } catch {
    return null;
  }
}

/**
 * Find verdict file by searching default paths.
 */
export function findVerdictFile(headSha: string, verdictDir?: string, cwd?: string): string | null {
  const root = cwd ?? process.cwd();
  // The `merge-reviews` state graph first: where a verdict belongs, by the
  // owner's ruling of 2026-10-20 ("State branch", bean w8jq). A verdict
  // committed INTO the pull request moves the head it names, so it can only
  // ever be found stale. Resolved by its declared id, never spelled, and
  // skipped when this checkout does not declare or cannot reach it.
  const reviews = graphReadPath(MERGE_REVIEWS_GRAPH, root);
  const searchDirs = verdictDir
    ? [verdictDir]
    : [
        ...(reviews.state === "ok" ? [reviews.at] : []),
        // The declared `qa` tree and `attestations` store (`kgQaHomeFor`,
        // `attestationsHomeFor`), never spelled: a moved tree moves the search.
        join(kgQaHomeFor(root).root, "qa-review"),
        join(attestationsHomeFor(root).root, "qa-review"),
        kgQaHomeFor(root).root,
      ];

  const candidateNames = [
    `${headSha}.json`,
    `${headSha.slice(0, 8)}.json`,
    "merge-review.json",
    "pr-review.json",
    "adversarial-review.json",
  ];

  for (const dir of searchDirs) {
    for (const name of candidateNames) {
      const fullPath = join(dir, name);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

/**
 * Pure evaluation function for adversarial review gate.
 */
export function evaluateAdversarialGate(input: AdversarialGateCheckInput): AdversarialGateCheckResult {
  const mode = input.enforcementMode ?? "warn";
  const headSha = input.currentHeadSha;

  // 1. Negative case check: Human-only PR
  if (!input.provenance.hasAgentProvenance || input.provenance.isHumanOnly) {
    return {
      state: "skipped",
      action: "pass",
      blocksMerge: false,
      verdictFound: false,
      isHumanOnly: true,
      currentHeadSha: headSha,
      message: "human-only PR: no adversarial review required",
      details: ["No agent trailers, agent branch, or bot committers detected."],
      findingsToReport: [],
    };
  }

  // 2. Verdict presence check
  if (!input.verdict) {
    const isHard = mode === "hard";
    return {
      state: "unknown",
      action: isHard ? "block" : "warn",
      blocksMerge: isHard,
      verdictFound: false,
      isHumanOnly: false,
      currentHeadSha: headSha,
      message: `No adversarial review verdict found for head '${headSha}'. Missing verdict is unknown, never a silent pass.`,
      details: [
        "Agent provenance was detected on this change, requiring an adversarial code review.",
        "Under the 2026-10-03 owner ruling, 'unknown' is never rendered as clean and never a silent pass.",
      ],
      findingsToReport: [],
    };
  }

  // Normalize verdict into reviews array and head_sha
  let reviews: AdversarialReview[];
  let reviewedHeadSha: string | undefined;

  if ("$schema" in input.verdict && input.verdict.$schema === MERGE_REVIEW_SCHEMA) {
    reviews = input.verdict.reviews;
    reviewedHeadSha = input.verdict.head_sha;
  } else if ("reviewer" in input.verdict) {
    reviews = [input.verdict];
    const raw = input.verdict as unknown as { head_sha?: string };
    reviewedHeadSha = raw.head_sha;
  } else {
    reviews = [];
  }

  // 3. Head SHA binding check
  if (reviewedHeadSha && reviewedHeadSha !== headSha) {
    const isHard = mode === "hard";
    return {
      state: "stale",
      action: isHard ? "block" : "warn",
      blocksMerge: isHard,
      verdictFound: true,
      isHumanOnly: false,
      currentHeadSha: headSha,
      reviewedHeadSha,
      message: `Verdict is stale: reviewed head '${reviewedHeadSha}' does not match current PR head '${headSha}'.`,
      details: ["A push occurred after the review was committed. Review must re-run on current head SHA."],
      findingsToReport: [],
    };
  }

  if (reviews.length === 0) {
    const isHard = mode === "hard";
    return {
      state: "unknown",
      action: isHard ? "block" : "warn",
      blocksMerge: isHard,
      verdictFound: true,
      isHumanOnly: false,
      currentHeadSha: headSha,
      reviewedHeadSha,
      message: "No adversarial review records contained within verdict sidecar.",
      details: ["Verdict sidecar exists but contains 0 reviews."],
      findingsToReport: [],
    };
  }

  // 4. Whole-diff coverage & reviewer independence per review
  const allAuthorSessions = new Set<string>(input.provenance.authorSessions);

  for (const review of reviews) {
    // Check truncated coverage
    if (review.coverage?.truncated === true) {
      const isHard = mode === "hard";
      return {
        state: "unknown",
        action: isHard ? "block" : "warn",
        blocksMerge: isHard,
        verdictFound: true,
        isHumanOnly: false,
        currentHeadSha: headSha,
        reviewedHeadSha,
        message: "Review coverage was truncated. Silent truncation is forbidden; a truncated review is unknown.",
        details: [
          `Reviewer inspected ${review.coverage.files_reviewed}/${review.coverage.files_total} files but coverage was flagged as truncated.`,
          "A diff too large to review must be split or chunked; it cannot pass truncated.",
        ],
        findingsToReport: [],
      };
    }

    // Check changed files diff coverage if changedFiles list is available
    if (input.changedFiles && input.changedFiles.length > 0) {
      const skippedPaths = new Set((review.coverage?.skipped ?? []).map((s) => s.path));
      const totalCovered = (review.coverage?.files_reviewed ?? 0) + skippedPaths.size;
      if (totalCovered < input.changedFiles.length || (review.coverage?.files_total ?? 0) < input.changedFiles.length) {
        const isHard = mode === "hard";
        return {
          state: "unknown",
          action: isHard ? "block" : "warn",
          blocksMerge: isHard,
          verdictFound: true,
          isHumanOnly: false,
          currentHeadSha: headSha,
          reviewedHeadSha,
          message: `Incomplete diff coverage: ${input.changedFiles.length} files changed in diff, but only ${totalCovered} files covered in review.`,
          details: [
            `Total changed files: ${input.changedFiles.length}`,
            `Files reviewed: ${review.coverage?.files_reviewed ?? 0}`,
            `Files skipped: ${skippedPaths.size}`,
          ],
          findingsToReport: [],
        };
      }
    }

    // Check reviewer independence
    if (review.author_sessions) {
      for (const sess of review.author_sessions) {
        allAuthorSessions.add(sess);
      }
    }

    if (allAuthorSessions.has(review.reviewer.session)) {
      const isHard = mode === "hard";
      return {
        state: "unknown",
        action: isHard ? "block" : "warn",
        blocksMerge: isHard,
        verdictFound: true,
        isHumanOnly: false,
        currentHeadSha: headSha,
        reviewedHeadSha,
        message: `Reviewer independence violation: reviewer session '${review.reviewer.session}' matches author session.`,
        details: [
          "An adversarial review must be performed by an independent session, not the author session.",
        ],
        findingsToReport: [],
      };
    }

    if (review.reviewer.by === "agent" && (!review.reviewer.session || !review.reviewer.model)) {
      const isHard = mode === "hard";
      return {
        state: "unknown",
        action: isHard ? "block" : "warn",
        blocksMerge: isHard,
        verdictFound: true,
        isHumanOnly: false,
        currentHeadSha: headSha,
        reviewedHeadSha,
        message: "Reviewer record incomplete: agent reviewer must record session id and model.",
        details: ["Reviewer model and session id are required for auditability."],
        findingsToReport: [],
      };
    }
  }

  // 5. Evaluate findings and gate states using red-flag schema
  let gateEval: ReviewGateEvaluation;
  if ("$schema" in input.verdict && input.verdict.$schema === MERGE_REVIEW_SCHEMA) {
    gateEval = evaluateMergeReviewGateState(input.verdict, {
      enforcementMode: mode,
      currentHeadSha: headSha,
      authorSessions: Array.from(allAuthorSessions),
    });
  } else {
    gateEval = evaluateReviewGateState(reviews[0], {
      enforcementMode: mode,
      currentHeadSha: headSha,
      authorSessions: Array.from(allAuthorSessions),
    });
  }

  // Extract findings to report
  const findingsToReport = gateEval.evaluations.map((fe) => {
    // Find original finding from review
    const allFindings = reviews.flatMap((r) => r.flags ?? r.findings ?? []);
    const original = allFindings.find((f) => f.id === fe.findingId);
    let historicalBasis: string | undefined;
    if (fe.category && isRedFlagCategory(fe.category)) {
      historicalBasis = getRedFlagDefinition(fe.category)?.historicalExample;
    }

    return {
      id: fe.findingId,
      category: fe.category,
      severity: original?.severity ?? "major",
      weight: original?.weight ?? "blocking",
      where: original?.where ?? "unknown",
      evidence: original?.evidence ?? "",
      historicalBasis,
      state: fe.state,
    };
  });

  if (gateEval.state === "open") {
    return {
      state: "open",
      action: "block",
      blocksMerge: true,
      verdictFound: true,
      isHumanOnly: false,
      currentHeadSha: headSha,
      reviewedHeadSha,
      message: gateEval.message,
      details: ["Blocking RED FLAG(s) present under hard gate enforcement."],
      findingsToReport,
      evaluation: gateEval,
    };
  }

  if (gateEval.state === "would-have-blocked") {
    return {
      state: "would-have-blocked",
      action: "warn",
      blocksMerge: false,
      verdictFound: true,
      isHumanOnly: false,
      currentHeadSha: headSha,
      reviewedHeadSha,
      message: `Adversarial review identified ${findingsToReport.length} open RED FLAG(s) that would have blocked the merge.`,
      details: [
        "Under 2026-10-03 owner ruling (warn-only), open red flags are recorded for promotion calibration without holding merge.",
      ],
      findingsToReport,
      evaluation: gateEval,
    };
  }

  if (gateEval.state === "stale") {
    const isHard = mode === "hard";
    return {
      state: "stale",
      action: isHard ? "block" : "warn",
      blocksMerge: isHard,
      verdictFound: true,
      isHumanOnly: false,
      currentHeadSha: headSha,
      reviewedHeadSha,
      message: gateEval.message,
      details: [],
      findingsToReport,
      evaluation: gateEval,
    };
  }

  if (gateEval.state === "unknown") {
    const isHard = mode === "hard";
    return {
      state: "unknown",
      action: isHard ? "block" : "warn",
      blocksMerge: isHard,
      verdictFound: true,
      isHumanOnly: false,
      currentHeadSha: headSha,
      reviewedHeadSha,
      message: gateEval.message,
      details: [],
      findingsToReport,
      evaluation: gateEval,
    };
  }

  // Otherwise resolved or overridden (clean pass)
  return {
    state: "clean",
    action: "pass",
    blocksMerge: false,
    verdictFound: true,
    isHumanOnly: false,
    currentHeadSha: headSha,
    reviewedHeadSha,
    message: `Adversarial review passed cleanly for head '${headSha}'.`,
    details: [
      `Reviewed files: ${reviews.reduce((sum, r) => sum + r.coverage.files_reviewed, 0)}`,
      `Reviewers: ${reviews.map((r) => `${r.reviewer.by} (${r.reviewer.model ?? "unknown model"})`).join(", ")}`,
    ],
    findingsToReport,
    evaluation: gateEval,
  };
}

/**
 * Format adversarial review gate result for CLI output.
 */
export function renderAdversarialGateReport(result: AdversarialGateCheckResult): string[] {
  const out: string[] = [];
  const modeLabel = result.blocksMerge ? "(hard gate — blocks on red flags)" : "(warn-only — reports, never blocks)";

  out.push(`Adversarial review gate ${modeLabel}`);
  out.push("");

  switch (result.state) {
    case "skipped":
      out.push(`✓ ${result.message}`);
      break;

    case "clean":
      out.push(`✓ ${result.message}`);
      for (const d of result.details) {
        out.push(`  ${d}`);
      }
      break;

    case "would-have-blocked":
      out.push(`⚠️  ADVISORY (would have blocked): ${result.message}`);
      out.push("");
      for (const f of result.findingsToReport) {
        out.push(`  • [${f.category ?? "uncategorized"}] ${f.id} (${f.severity}/${f.weight})`);
        out.push(`    Where:    ${f.where}`);
        out.push(`    Evidence: ${f.evidence}`);
        if (f.historicalBasis) {
          out.push(`    Basis:    ${f.historicalBasis}`);
        }
        out.push("");
      }
      out.push("  Advisory by design (2026-10-03 owner ruling): records findings for");
      out.push("  promotion calibration without holding merge.");
      break;

    case "open":
      out.push(`✗ FAILED (blocking red flag): ${result.message}`);
      for (const f of result.findingsToReport) {
        out.push(`  • [${f.category}] ${f.id} at ${f.where}`);
        out.push(`    Evidence: ${f.evidence}`);
      }
      break;

    case "unknown":
      out.push(`⚠️  WARNING (unknown): ${result.message}`);
      for (const d of result.details) {
        out.push(`  ${d}`);
      }
      out.push("  'unknown' is never rendered as clean, and under the warn-only ruling it is never a pass.");
      break;

    case "stale":
      out.push(`⚠️  WARNING (stale): ${result.message}`);
      for (const d of result.details) {
        out.push(`  ${d}`);
      }
      break;
  }

  return out;
}

/**
 * Check adversarial review from CLI / options.
 */
export function checkAdversarialReview(options: CheckAdversarialReviewOptions = {}): AdversarialGateCheckResult {
  const cwd = options.cwd ?? process.cwd();
  const currentHeadSha = getGitHeadSha(options.headRef ?? "HEAD", cwd);
  const baseRef = options.baseRef ?? "origin/main";

  // Detect provenance
  const provenance = detectAgentProvenance({
    branch: options.branch,
    prBody: options.prBody,
    baseRef,
    headRef: options.headRef ?? "HEAD",
    cwd,
  });

  // If human-only, evaluate immediately
  if (!provenance.hasAgentProvenance || provenance.isHumanOnly) {
    return evaluateAdversarialGate({
      provenance,
      currentHeadSha,
      baseRef,
      enforcementMode: options.enforcementMode,
    });
  }

  // Load verdict
  let verdict: MergeReview | AdversarialReview | null = null;
  const verdictPath = options.verdictPath ?? findVerdictFile(currentHeadSha, options.verdictDir, cwd);
  if (verdictPath) {
    verdict = loadVerdictFromFile(verdictPath);
  }

  // Get changed files for diff coverage check
  const changedFiles = getGitChangedFiles(baseRef, options.headRef ?? "HEAD", cwd);

  return evaluateAdversarialGate({
    provenance,
    verdict,
    currentHeadSha,
    baseRef,
    changedFiles,
    enforcementMode: options.enforcementMode,
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let baseRef: string | undefined;
  let headRef: string | undefined = "HEAD";
  let branch: string | undefined;
  let verdictPath: string | undefined;
  let verdictDir: string | undefined;
  let prBody: string | undefined;
  let isStrict = false;
  let isJson = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base" && args[i + 1]) {
      baseRef = args[++i];
    } else if (args[i] === "--head" && args[i + 1]) {
      headRef = args[++i];
    } else if (args[i] === "--branch" && args[i + 1]) {
      branch = args[++i];
    } else if (args[i] === "--verdict" && args[i + 1]) {
      verdictPath = args[++i];
    } else if (args[i] === "--verdict-dir" && args[i + 1]) {
      verdictDir = args[++i];
    } else if (args[i] === "--pr-body" && args[i + 1]) {
      prBody = args[++i];
    } else if (args[i] === "--strict" || args[i] === "--mode" && args[i + 1] === "hard") {
      isStrict = true;
      if (args[i] === "--mode") i++;
    } else if (args[i] === "--json") {
      isJson = true;
    }
  }

  const result = checkAdversarialReview({
    baseRef,
    headRef,
    branch,
    verdictPath,
    verdictDir,
    prBody,
    enforcementMode: isStrict ? "hard" : "warn",
  });

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const line of renderAdversarialGateReport(result)) {
      console.log(line);
    }
  }

  if (isStrict && result.blocksMerge) {
    process.exit(1);
  }
  process.exit(0);
}
