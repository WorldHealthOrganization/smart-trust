/**
 * What happened when a Tool ran, and under whose authority.
 *
 * ## It reuses the review vocabulary
 *
 * `schemas/sdlc/qa-review.ts` already models "an act, by someone with the standing
 * to make it, with a rationale that cites its evidence" — `Decision`,
 * `AuditNote`, `ReviewerRef` — and `schemas/process/role-graph.ts` already models who
 * may act: skills belong to the **lane** (what the performer must know),
 * permissions travel with the **actor** (what the participant may do). An
 * invocation is the same shape one level down: something was *done*, by an
 * actor, in a role, at a step of a process, exercising a skill, through a
 * Tool.
 *
 * ## What an invocation record answers
 *
 * - **Which task?** A BPMN node id, so the run is locatable in a process.
 * - **In which process instance?** So a sequence of runs is one story.
 * - **Under which role?** The lane, which is what says the step was allowed.
 * - **By which actor?** The participant, which is what carries permissions.
 * - **Exercising which skill?** The capability, which the Tool `satisfies` —
 *   and which is the edge that makes "was this Tool appropriate here" decidable.
 * - **With what inputs?** Recorded as the parsed, type-checked values, never
 *   the raw request.
 *
 * ## Output is not recorded
 *
 * A Tool's stdout may be large, may contain credentials a caller passed to
 * it, and is already the caller's to handle. The record carries an outcome
 * and a digest; whoever needs the bytes keeps them.
 *
 * @module schemas/tool-invocation
 * @graphNode schema
 */
import { z } from "zod";
import { SkillNameSchema } from "./tool-types.js";
import { ProcessElementIdSchema } from "../process/process-element-id.js";

/** Whether the run was allowed, and if not, why not. */
export const InvocationOutcomeSchema = z.enum([
  "ran",
  /** The actor lacked a permission the Tool requires. */
  "refused-permission",
  /** An input failed its declared type — the injection defence firing. */
  "refused-input",
  /** `requires` unmet on this host: the Tool is not available here. */
  "unavailable",
  /** Ran and exited non-zero. */
  "failed",
]);
export type InvocationOutcome = z.infer<typeof InvocationOutcomeSchema>;

/**
 * Who acted, mirroring `ReviewerRef` in `qa-review.ts`.
 *
 * `actor` and `role` are separate because they answer different questions and
 * the role graph keeps them apart deliberately: an actor carries permissions
 * through every lane it enters, a role carries the skills the lane's performer
 * needs. An audit that records only one cannot answer "was this allowed".
 */
export const InvocationAuthoritySchema = z.object({
  /** Actor id from the role graph — the participant. */
  actor: z.string().min(1),
  /** Role id from the role graph — the lane acted in. */
  role: z.string().min(1),
  /** Model id or script revision, so a run is attributable to a version. */
  version: z.string().optional(),
});

/** Where in a process the run sits. Absent outside any process. */
export const InvocationContextSchema = z.object({
  /** `ProcessModel.id` — which diagram. */
  process: ProcessElementIdSchema,
  /** BPMN node id — which task. */
  task: z.string().min(1),
  /** The running instance under `beans/workflows/`, when there is one. */
  instance: z.string().optional(),
});

export const ToolInvocationSchema = z.object({
  id: z.string().min(1),
  /** `ToolDefinition.id`. */
  tool: z.string().min(1),
  /**
   * The skill this run was exercising — one the Tool `satisfies`.
   *
   * Recorded rather than derived, even though it is derivable from the Tool,
   * because a Tool may satisfy several skills and WHICH ONE was being exercised
   * is the thing an audit cannot reconstruct afterwards.
   */
  skill: SkillNameSchema,
  by: InvocationAuthoritySchema,
  context: InvocationContextSchema.optional(),
  /** Parsed, type-checked input values — never the raw request. */
  inputs: z.record(z.string(), z.unknown()),
  /** The exact argv handed to the process. Empty for a `manual` Tool. */
  argv: z.array(z.string()),
  outcome: InvocationOutcomeSchema,
  /** Why, when the outcome was a refusal. Required for every non-`ran` outcome. */
  reason: z.string().optional(),
  exitCode: z.number().int().optional(),
  started_at: z.string(),
  finished_at: z.string().optional(),
}).refine((i) => i.outcome === "ran" || (i.reason !== undefined && i.reason.length > 0), {
  message: "every outcome other than `ran` must carry a reason — a refusal with no reason is unauditable",
  path: ["reason"],
});

export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;
export type InvocationAuthority = z.infer<typeof InvocationAuthoritySchema>;
export type InvocationContext = z.infer<typeof InvocationContextSchema>;
