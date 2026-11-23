/**
 * The context an agent provides when asking "which decision methodology fits?"
 *
 * Complements {@link MethodologyFrontMatterSchema} — that schema declares what a
 * methodology IS; this one declares what a decision NEEDS. The selector skill
 * matches a `DecisionContext` against each methodology's `applies-when` and the
 * method-family criteria tables.
 *
 * You pick a method with this schema, then use it to produce a decision
 * request (`decision-request.ts`).
 *
 * Every dimension is optional: an agent provides what it knows, and the
 * problem is often half-formed. A context with only `questionType` still
 * routes via methodology-adoption's four-question protocol; more dimensions
 * narrow the ranking.
 *
 * @graphNode schema
 * @module folio-assistant/schemas/decision-methodology-context
 */

import { z } from "zod";

/**
 * The four lanes from `methodology-adoption` §"Choosing which applies".
 * The first yes decides.
 */
export const QuestionTypeSchema = z.enum([
  /** Do the criteria recur, with the same inputs producing the same answer? */
  "computable",
  /** Is the question the certainty of a body of evidence? */
  "evidence-grading",
  /** Is the context a bean recording a decision? */
  "decision-record",
  /** A one-off choice among candidate options. */
  "decision-analysis",
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const TimeConstraintSchema = z.enum(["minutes", "hours", "days", "weeks"]);
export const ReversibilitySchema = z.enum(["reversible", "costly", "irreversible"]);
export const UncertaintySchema = z.enum(["low", "moderate", "high", "deep"]);
export const DataTypeSchema = z.enum(["quantitative", "qualitative", "mixed"]);

/**
 * The context dimensions for methodology selection.
 *
 * Every field is optional. The selector scores each methodology against
 * whatever dimensions are provided; omitted dimensions produce no penalty
 * and no bonus — they are genuinely unknown, not defaulted.
 */
export const DecisionContextSchema = z.object({
  /**
   * Free-text summary of what is being decided.
   * Not matched algorithmically — carried for the rationale narrative.
   */
  summary: z.string().min(1).optional(),

  /** The methodology-adoption lane. When provided, only methods in this lane are candidates. */
  questionType: QuestionTypeSchema.optional(),

  /** How many alternatives are being compared. */
  alternativeCount: z.number().int().min(2).optional(),

  /** How many criteria the alternatives are scored against. */
  criteriaCount: z.number().int().min(1).optional(),

  /** Whether criteria weights are known a priori or must be derived. */
  criteriaWeightsKnown: z.boolean().optional(),

  /** Kind of data available for the criteria values. */
  dataType: DataTypeSchema.optional(),

  /** Number of people involved in the decision. */
  stakeholderCount: z.number().int().min(1).optional(),

  /** How much time is available for the analysis. */
  timeConstraint: TimeConstraintSchema.optional(),

  /** Can the decision be undone, and at what cost? */
  reversibility: ReversibilitySchema.optional(),

  /** How much is unknown about the problem. */
  uncertainty: UncertaintySchema.optional(),

  /** True when decisions recur or adapt over time (sequential/bandit setting). */
  sequential: z.boolean().optional(),
});
export type DecisionContext = z.infer<typeof DecisionContextSchema>;

/**
 * One recommendation from the selector.
 */
export const MethodologyRecommendationSchema = z.object({
  /** The methodology's `name` from its front matter (kebab-case id). */
  methodologyId: z.string().min(1),

  /** The methodology's human-readable title. */
  title: z.string().min(1),

  /** Which method family: mcdm-aggregation, probabilistic, social, classical, hybrid-mcdm. */
  family: z.string().min(1),

  /** Why this methodology fits the given context. Matched against `applies-when`. */
  rationale: z.string().min(1),

  /** Under what conditions this method should NOT be used. Matched against context. */
  avoidWhen: z.string().min(1),

  /** Low / Medium / High. */
  complexity: z.enum(["low", "medium", "high"]),

  /** What data the method requires. */
  dataRequirements: z.string().min(1),

  /** Bibliographic source: paper title, authors, arxiv id or standard. */
  source: z.string().min(1),

  /**
   * How well this method fits the context. A tier, not a score — the platform
   * refuses pseudo-measurement (methodology-adoption: "never quantify a
   * judgement to make it look measured; where a method scores and sums, take
   * structure and refuse arithmetic").
   *
   * - `primary`: directly matches `applies-when` without triggering refusals
   * - `secondary`: partially applicable, with explicit caveats stated in rationale
   * - `excluded`: triggers a methodology's `not-for` clause
   */
  matchTier: z.enum(["primary", "secondary", "excluded"]),
});
export type MethodologyRecommendation = z.infer<typeof MethodologyRecommendationSchema>;

/**
 * The full output of the selector: ranked recommendations.
 */
export const MethodologySelectionResultSchema = z.object({
  /** The context that was provided. */
  context: DecisionContextSchema,

  /** Ranked recommendations, best fit first. */
  recommendations: z.array(MethodologyRecommendationSchema),

  /**
   * If no methodology fits, this explains why.
   * Per methodology-adoption: "If none fits, that is a finding, not a licence."
   */
  noMatchReason: z.string().optional(),
});
export type MethodologySelectionResult = z.infer<typeof MethodologySelectionResultSchema>;
