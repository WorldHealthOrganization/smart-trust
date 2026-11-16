/**
 * QA review — findings, decisions, and the audit notes that justify them.
 *
 * Three entities, not one. Two vocabularies exist for what looks like a
 * single act:
 *
 * ```
 * content-review skill output:  decision: approve | request-changes | reject
 *                               severity: blocking | suggestion | praise
 * QA sidecar entry:             result:   pass | fail | warn | n/a
 *                               severity: critical | major | minor
 * ```
 *
 * ## A finding is an observation; a decision is an act about findings
 *
 * Neither determines the other. A `critical` mechanical finding can be
 * overruled by someone with the standing to overrule it, and an `approve` can
 * be issued over findings that are still open: a defect nobody is going to
 * fix, and an approval granted in spite of one, both need a record.
 *
 * ## The two severity vocabularies are two axes, not two spellings
 *
 * {@link FindingSeverity} (`critical | major | minor`) says **what kind of
 * breakage** this is: a broken reference, a missing join, a coverage gap. It
 * is a property of the defect and a machine can assign it.
 *
 * {@link FindingWeight} (`blocking | suggestion | praise`) says **what the
 * reviewer asks of the gate**. It is a stance, not a measurement; `praise`
 * has no equivalent on the machine axis.
 *
 * So a finding carries whichever axis its reviewer can speak on, and
 * {@link checkReview} requires the right one rather than defaulting a
 * mechanical finding into a stance nobody took.
 *
 * ## An overruled finding stays recorded
 *
 * Overruling is not deletion. The {@link Finding} is immutable once raised;
 * the {@link Decision} records the overrule, and every overrule of a
 * **mechanical** finding carries an {@link AuditNote} saying why.
 *
 * ## An audit note cites
 *
 * {@link AuditNote.cites} carries {@link Citation}s into the corpus — a
 * witness, another finding, a QA report, a block, a file range, a
 * bibliographic key, a workflow instance. Agents are expected to *propose*
 * those citations from corpus evidence ({@link AuditNote.proposed_by}); a
 * human confirming a proposed note is recorded as its author, because the
 * reasoning is theirs.
 *
 * ## Citation resolution has three outcomes, and one of them is not a pass
 *
 * {@link resolveCitations} returns `resolved`, `dangling` or `not-checked`.
 * `not-checked` is what you get when no corpus resolver was supplied, or when
 * the resolver itself could not answer — a shallow clone, an absent submodule.
 * It is never rendered as `resolved`. Same rule as `check-ci-health.ts`,
 * `readme-sections.ts` and `kg-qa.ts`.
 *
 * @module schemas/qa-review
 * @graphNode schema
 */

import { z } from "zod";

import { QA_REVIEWER_KINDS } from "./block-qa";

import type { QaReviewerKind } from "./block-qa";

/** Marker value carried by every QA review node. */
export const QA_REVIEW_SCHEMA = "qa-review/v1";

/**
 * The machine axis — what kind of breakage a finding reports.
 *
 * Same three values as `kg-qa.ts` and `block-qa.ts`, and deliberately the same
 * *meaning*: `critical` is a broken reference, `major` a missing join, `minor`
 * a coverage gap. A fourth vocabulary would have been a fourth thing to keep
 * in sync.
 */
export const FINDING_SEVERITIES = ["critical", "major", "minor"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

/**
 * The human axis — what the reviewer asks of the gate.
 *
 * `blocking` stops it, `suggestion` does not, and `praise` records that
 * something is right. Only a reviewer with judgement can speak here; a checker
 * cannot, which is exactly why this axis exists alongside the other.
 */
export const FINDING_WEIGHTS = ["blocking", "suggestion", "praise"] as const;
export type FindingWeight = (typeof FINDING_WEIGHTS)[number];

/** What an adjudicator decided about a set of findings. */
export const DECISION_OUTCOMES = ["approve", "request-changes", "reject"] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

/**
 * What an audit note can point at.
 *
 * Every kind here is a node something else in this repo already owns, so a
 * citation is resolvable rather than decorative: `witness` a test result under
 * `test/results/`, `finding` another finding in the same review, `qa-report` a
 * `.qa.json` / `.kg-qa.json` / `.script-qa.json` sidecar, `block` a content
 * label (`thm:foo`), `file` a repo-relative path with an optional line range,
 * `bib` a key in the folio's references, `workflow-instance` a running process
 * under `beans/workflows/`.
 */
export const CITATION_KINDS = [
  "witness",
  "finding",
  "qa-report",
  "block",
  "file",
  "bib",
  "workflow-instance",
] as const;
export type CitationKind = (typeof CITATION_KINDS)[number];

/** A pointer into the corpus, specific enough to follow without searching. */
export interface Citation {
  kind: CitationKind;
  /** The cited node — a path, a label, a finding id, a bib key. */
  ref: string;
  /** Narrows within the node: a line range, a criterion id, a page. */
  locator?: string;
  /** Verbatim text at that locator, so a stale citation is visible as stale. */
  quote?: string;
}

/** Who raised a finding or wrote a note. */
export interface ReviewerRef {
  kind: QaReviewerKind;
  /** Script path, agent name + skill, or GitHub login. */
  id: string;
  /** Script revision or model id. */
  version?: string;
}

/**
 * One observation about one subject. Immutable once raised.
 *
 * A finding is never edited to reflect a decision made about it later — see the
 * module doc. To disagree with a finding, overrule it in a {@link Decision}.
 */
export interface Finding {
  /** Unique within the review. */
  id: string;
  /** What it is about — a block label, a skill name, a repo-relative path. */
  subject: string;
  /** The criterion that produced it, where one did. */
  criterion?: string;
  reviewer: ReviewerRef;
  /** Machine axis. Required of a `script` reviewer. */
  severity?: FindingSeverity;
  /** Human axis. Required of a `human` reviewer. */
  weight?: FindingWeight;
  /** One sentence, naming both ends of what is wrong. */
  detail: string;
  /** Where to look. Empty is legitimate for `praise`. */
  evidence: Citation[];
  raised_at: string;
}

/**
 * Why a decision was made, or why a finding in it was not acted on.
 *
 * Required on every {@link Decision} and on every overrule of a mechanical
 * finding. The rationale is prose in the author's own voice; {@link cites} is
 * what makes it checkable.
 */
export interface AuditNote {
  id: string;
  /** Whoever is accountable for the reasoning — a human, when one overruled. */
  author: ReviewerRef;
  rationale: string;
  /** At least one. A rationale with no citation is an assertion. */
  cites: Citation[];
  /**
   * The agent that assembled the citations, when one did.
   *
   * Recorded separately from {@link author} on purpose: an agent searching the
   * corpus for supporting evidence is doing clerical work, and letting it
   * appear as the note's author would misattribute a judgement to a tool.
   */
  proposed_by?: string;
  written_at: string;
}

/** A finding the decision went against, and the note explaining that. */
export interface Overrule {
  /** {@link Finding.id}. */
  finding: string;
  /** {@link AuditNote.id}. */
  note: string;
}

/**
 * An act about a set of findings, by someone with the standing to make it.
 *
 * `role` names a swimlane in the role graph rather than a person: who may
 * approve is a property of the position, and the person filling it changes.
 */
export interface Decision {
  id: string;
  outcome: DecisionOutcome;
  /** Role id from `schemas/process/role-graph.ts` — the lane this was decided in. */
  role: string;
  by: ReviewerRef;
  /** Every finding weighed, overruled or not. {@link Finding.id}s. */
  considered: string[];
  overrules: Overrule[];
  /** At least one {@link AuditNote.id}: why this outcome, not another. */
  notes: string[];
  decided_at: string;
}

/** One review of one subject: what was observed, decided, and why. */
export interface QaReview {
  $schema: typeof QA_REVIEW_SCHEMA;
  subject: {
    /** `block`, `skill`, `process`, `translation`, `script`, … */
    kind: string;
    id: string;
    /** Repo-relative path, or `null` for a subject with no single file. */
    path: string | null;
  };
  findings: Finding[];
  notes: AuditNote[];
  decisions: Decision[];
  updated_at: string;
}

export const CitationSchema = z.object({
  kind: z.enum(CITATION_KINDS),
  ref: z.string().min(1),
  locator: z.string().optional(),
  quote: z.string().optional(),
});

export const ReviewerRefSchema = z.object({
  kind: z.enum(QA_REVIEWER_KINDS),
  id: z.string().min(1),
  version: z.string().optional(),
});

export const FindingSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  criterion: z.string().optional(),
  reviewer: ReviewerRefSchema,
  severity: z.enum(FINDING_SEVERITIES).optional(),
  weight: z.enum(FINDING_WEIGHTS).optional(),
  detail: z.string().min(1),
  evidence: z.array(CitationSchema).default([]),
  raised_at: z.string(),
});

export const AuditNoteSchema = z.object({
  id: z.string().min(1),
  author: ReviewerRefSchema,
  rationale: z.string().min(1),
  cites: z.array(CitationSchema).default([]),
  proposed_by: z.string().optional(),
  written_at: z.string(),
});

export const OverruleSchema = z.object({
  finding: z.string().min(1),
  note: z.string().min(1),
});

export const DecisionSchema = z.object({
  id: z.string().min(1),
  outcome: z.enum(DECISION_OUTCOMES),
  role: z.string().min(1),
  by: ReviewerRefSchema,
  considered: z.array(z.string()).default([]),
  overrules: z.array(OverruleSchema).default([]),
  notes: z.array(z.string()).default([]),
  decided_at: z.string(),
});

export const QaReviewSchema = z.object({
  $schema: z.literal(QA_REVIEW_SCHEMA),
  subject: z.object({
    kind: z.string().min(1),
    id: z.string().min(1),
    path: z.string().nullable(),
  }),
  findings: z.array(FindingSchema).default([]),
  notes: z.array(AuditNoteSchema).default([]),
  decisions: z.array(DecisionSchema).default([]),
  updated_at: z.string(),
});

/** One thing wrong with a review, named specifically enough to fix. */
export interface ReviewProblem {
  /** The offending node — a finding id, a decision id, `review`. */
  where: string;
  detail: string;
}

/** A finding a machine produced, and therefore one a human may overrule. */
export function isMechanical(finding: Finding): boolean {
  return finding.reviewer.kind === "script";
}

/**
 * The invariants that make a review auditable.
 *
 * Structural validity is {@link QaReviewSchema}'s job; this is the part Zod
 * cannot see, because every rule here is about one node agreeing with another.
 *
 * Returns problems rather than throwing: a review with three defects should
 * report three, and a caller that wants to fail loudly can check for a
 * non-empty array.
 */
export function checkReview(review: QaReview): ReviewProblem[] {
  const problems: ReviewProblem[] = [];
  const findings = new Map<string, Finding>();
  const notes = new Map<string, AuditNote>();

  for (const f of review.findings) {
    if (findings.has(f.id)) problems.push({ where: f.id, detail: `Duplicate finding id \`${f.id}\`.` });
    findings.set(f.id, f);

    if (f.reviewer.kind === "script" && !f.severity) {
      problems.push({
        where: f.id,
        detail: "A mechanical finding carries no severity — the machine axis is the only one a checker can speak on.",
      });
    }
    if (f.reviewer.kind === "human" && !f.weight) {
      problems.push({
        where: f.id,
        detail: "A human finding carries no weight — say whether it is blocking, a suggestion or praise.",
      });
    }
    if (f.weight === "praise" && f.severity) {
      problems.push({
        where: f.id,
        detail: `Praise carries severity \`${f.severity}\`; the machine axis has no good outcome to express.`,
      });
    }
    if (f.weight !== "praise" && f.evidence.length === 0) {
      problems.push({ where: f.id, detail: "A finding that is not praise cites nothing — say where to look." });
    }
  }

  for (const n of review.notes) {
    if (notes.has(n.id)) problems.push({ where: n.id, detail: `Duplicate audit-note id \`${n.id}\`.` });
    notes.set(n.id, n);
    if (n.cites.length === 0) {
      problems.push({ where: n.id, detail: "An audit note cites nothing — a rationale with no citation is an assertion." });
    }
  }

  const seenDecisions = new Set<string>();
  for (const d of review.decisions) {
    if (seenDecisions.has(d.id)) problems.push({ where: d.id, detail: `Duplicate decision id \`${d.id}\`.` });
    seenDecisions.add(d.id);

    if (d.notes.length === 0) {
      problems.push({
        where: d.id,
        detail: "A decision records no audit note — why it was made, or why a finding was left, is not on record.",
      });
    }
    for (const id of d.notes) {
      if (!notes.has(id)) problems.push({ where: d.id, detail: `Decision cites audit note \`${id}\`, which does not exist.` });
    }
    for (const id of d.considered) {
      if (!findings.has(id)) problems.push({ where: d.id, detail: `Decision considered finding \`${id}\`, which does not exist.` });
    }

    const overruled = new Set<string>();
    for (const o of d.overrules) {
      overruled.add(o.finding);
      const f = findings.get(o.finding);
      if (!f) {
        problems.push({ where: d.id, detail: `Decision overrules finding \`${o.finding}\`, which does not exist.` });
      } else if (isMechanical(f) && !notes.has(o.note)) {
        problems.push({
          where: d.id,
          detail: `Mechanical finding \`${o.finding}\` is overruled by audit note \`${o.note}\`, which does not exist.`,
        });
      } else if (!notes.has(o.note)) {
        problems.push({ where: d.id, detail: `Overrule of \`${o.finding}\` cites audit note \`${o.note}\`, which does not exist.` });
      }
      if (f && !d.considered.includes(o.finding)) {
        problems.push({ where: d.id, detail: `Finding \`${o.finding}\` is overruled but not listed as considered.` });
      }
    }

    if (d.outcome === "approve") {
      for (const id of d.considered) {
        const f = findings.get(id);
        if (!f || overruled.has(id)) continue;
        if (f.severity === "critical" || f.weight === "blocking") {
          problems.push({
            where: d.id,
            detail: `Approved over open finding \`${id}\` without overruling it — overrule it with a note, or do not approve.`,
          });
        }
      }
    }
  }

  return problems;
}

/** Whether a cited node was found. `undefined` means the resolver could not say. */
export type CitationResolver = (citation: Citation) => boolean | undefined;

export type CitationState = "resolved" | "dangling" | "not-checked";

export interface CitationCheck {
  citation: Citation;
  state: CitationState;
}

/**
 * Resolve citations against the corpus.
 *
 * With no resolver, every citation is `not-checked` — not `resolved`. A caller
 * with no corpus in hand has verified nothing, and reporting that as clean is
 * the failure `readme-sections.ts` and `check-ci-health.ts` were both written
 * to avoid. A resolver that returns `undefined` for a citation it cannot
 * evaluate lands in the same state, for the same reason.
 */
export function resolveCitations(citations: Citation[], resolve?: CitationResolver): CitationCheck[] {
  return citations.map((citation) => {
    if (!resolve) return { citation, state: "not-checked" as const };
    const answer = resolve(citation);
    if (answer === undefined) return { citation, state: "not-checked" as const };
    return { citation, state: answer ? ("resolved" as const) : ("dangling" as const) };
  });
}

/**
 * What a gate reads: the worst thing still open after every decision.
 *
 * Returns `undefined` when nothing is open. A finding is open unless some
 * decision overruled it — which is why overruling is a recorded act rather
 * than an edit to the finding.
 */
export function openFindings(review: QaReview): Finding[] {
  const overruled = new Set(review.decisions.flatMap((d) => d.overrules.map((o) => o.finding)));
  return review.findings.filter((f) => f.weight !== "praise" && !overruled.has(f.id));
}

export {
  MERGE_REVIEW_SCHEMA,
  RED_FLAG_CATEGORIES,
  RedFlagCategorySchema,
  RED_FLAG_DEFINITIONS,
  isRedFlagCategory,
  getRedFlagDefinition,
  FINDING_STATUSES,
  FindingResolutionSchema,
  AdversarialFindingSchema,
  ReviewCoverageSchema,
  REVIEW_RESULTS,
  AdversarialReviewSchema,
  getReviewFindings,
  MergeReviewSchema,
  OverrideDecisionSchema,
  getOverrideFindingId,
  applyRedFlagOverride,
  RED_FLAG_GATE_STATES,
  RedFlagGateStateSchema,
  evaluateFindingGateState,
  evaluateReviewGateState,
  evaluateMergeReviewGateState,
  type RedFlagCategory,
  type RedFlagCategoryDefinition,
  type FindingStatus,
  type FindingResolution,
  type AdversarialFinding,
  type ReviewCoverage,
  type ReviewResult,
  type AdversarialReview,
  type MergeReview,
  type RedFlagOverride,
  type RedFlagGateState,
  type GateAction,
  type EnforcementMode,
  type FindingGateEvaluation,
  type ReviewGateOptions,
  type ReviewGateEvaluation,
} from "./red-flag";


