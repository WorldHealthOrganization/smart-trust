/**
 * One harness's state as `harness:state` publishes it (`folio-harness-state/v1`).
 *
 * A schema module, not part of `scripts/harness-state.ts`, so the Tool I/O
 * vocabulary (`tool-types.ts`) can name it as the `HarnessStates` result type
 * without importing a script.
 *
 * @graphNode schema
 * @module cat-harness-tools/schemas/sdlc/harness-state
 */
import { z } from "zod";

export const HARNESS_STATE_SCHEMA = "folio-harness-state/v1";
export const HARNESS_STATE_INDEX_SCHEMA = "folio-harness-state-index/v1";

/** The states an initialization step can be in (bootstrap-tools `StepState`). */
export const HARNESS_STEP_STATES = ["done", "not-done", "could-not-determine", "stated"] as const;
export type HarnessStepState = (typeof HARNESS_STEP_STATES)[number];
export const HARNESS_BADGE_STATES = ["ok", "finding", "unknown"] as const;

export const HarnessStepSchema = z
  .object({
    id: z.string().min(1),
    namedBy: z.string().min(1),
    what: z.string(),
    state: z.enum(HARNESS_STEP_STATES),
    detail: z.string(),
    action: z.string().optional(),
  })
  .strict();

export const HarnessBadgeSchema = z
  .object({
    id: z.enum(["initialization", "repository"]),
    state: z.enum(HARNESS_BADGE_STATES),
    label: z.string().min(1),
  })
  .strict();
export type HarnessBadge = z.infer<typeof HarnessBadgeSchema>;

/** One harness's state, as the deploy publishes it. */
export const HarnessStateSchema = z
  .object({
    $schema: z.literal(HARNESS_STATE_SCHEMA),
    harness: z.string().min(1),
    initialization: z
      .object({
        position: z.string().min(1),
        next: z.object({ step: z.string().min(1), action: z.string() }).strict().nullable(),
        counts: z
          .object(
            Object.fromEntries(HARNESS_STEP_STATES.map((s) => [s, z.number().int().nonnegative()])) as Record<
              HarnessStepState,
              z.ZodNumber
            >,
          )
          .strict(),
        steps: z.array(HarnessStepSchema),
      })
      .strict(),
    health: z.object({ badges: z.array(HarnessBadgeSchema) }).strict(),
  })
  .strict();
export type HarnessState = z.infer<typeof HarnessStateSchema>;

/** `harness:state --json`: every harness's state, in name order. */
export const HarnessStatesSchema = z
  .array(HarnessStateSchema)
  .describe("Every harness's initialization position, next step and health badges, in name order.");

/** The list of harnesses in `--out`, for a page that shows them all. */
export const HarnessStateIndexSchema = z
  .object({
    $schema: z.literal(HARNESS_STATE_INDEX_SCHEMA),
    harnesses: z.array(z.object({ harness: z.string().min(1), file: z.string().min(1), position: z.string().min(1) }).strict()),
  })
  .strict();
