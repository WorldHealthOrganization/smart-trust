#!/usr/bin/env bun
/**
 * Agentic pre-merge review and would-have-blocked counterfactual schemas.
 *
 * Re-exports the merge review, counterfactual record schemas, and promotion
 * criteria.
 *
 * @module cat-harness/schemas/merge-review
 * @graphNode schema
 */
export {
  AgenticPromotionCriteriaSchema,
  BeanIdSchema,
  DEFAULT_AGENTIC_PROMOTION_CRITERIA,
  EjectionSchema,
  FORBIDDEN_FACT_KEYS,
  HUMAN_VERDICTS,
  HoldSchema,
  HumanVerdictSchema,
  MERGE_QUEUE_ENTRY_TAG,
  MemberFactsSchema,
  MergeQueueEntrySchema,
  PRIORITY_CLASSES,
  PlacementSchema,
  PriorityClassSchema,
  QUEUE_STATUSES,
  QueueStatusSchema,
  READINESS,
  ReleaseAuthoritySchema,
  ReleaseSchema,
  TrainMemberEvidenceSchema,
  WOULD_HAVE_BLOCKED_TAG,
  WouldHaveBlockedFindingSchema,
  WouldHaveBlockedMetricsSchema,
  WouldHaveBlockedRecordSchema,
  calculateWouldHaveBlockedMetrics,
  evaluateAgenticPromotion,
  releaseCovers,
} from "./merge-queue.ts";
export type {
  AgenticPromotionCriteria,
  Ejection,
  Hold,
  HumanVerdict,
  MemberFacts,
  MergeQueueEntry,
  Placement,
  PriorityClass,
  PromotionEvaluationResult,
  QueueStatus,
  Readiness,
  Release,
  ReleaseAuthority,
  TrainMemberEvidence,
  WouldHaveBlockedFinding,
  WouldHaveBlockedMetrics,
  WouldHaveBlockedRecord,
} from "./merge-queue.ts";
