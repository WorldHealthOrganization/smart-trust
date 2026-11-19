/**
 * Typed results of the workflow engine's tools.
 *
 * `workflow_list`, `workflow_start`, `workflow_next`, `workflow_gate` and
 * `workflow_complete` keep their text and also return the same answer as
 * data (MCP `structuredContent`). These schemas are that data, published as
 * Tool I/O types so a BPMN gateway or program can read what a step returned
 * instead of parsing text. `scripts/tests/workflow-tool-results.test.ts` holds
 * each schema equal to the engine's own TypeScript type, so the two cannot
 * drift apart.
 *
 * @graphNode schema
 * @module cat-harness-tools/schemas/tools/workflow-tool-results
 */
import { z } from "zod";

import { CONVENTION_SCOPES } from "../process/convention.js";

const ConventionSchema = z.object({ ref: z.string(), scope: z.enum(CONVENTION_SCOPES) });

const TaskContextSchema = z.object({
  role: z.string().optional(),
  roleStack: z.array(z.string()),
  effectiveSkills: z.array(z.string()),
  skills: z.array(z.string()),
  conventions: z.array(ConventionSchema),
  carriedBeans: z.array(z.string()),
});

const EnabledActivitySchema = z.object({
  kind: z.literal("activity"),
  node: z.string(),
  name: z.string(),
  lane: z.string().optional(),
  role: z.string().optional(),
  roleSkills: z.array(z.string()).optional(),
  skills: z.array(z.string()),
  conventions: z.array(ConventionSchema),
  touchesWorkPlan: z.boolean(),
  documentation: z.string().optional(),
  calledElement: z.string().optional(),
  globalTask: z.string().optional(),
  inputs: z.record(z.string(), z.string()).optional(),
  phase: z.array(z.string()).optional(),
  context: TaskContextSchema,
});

const EnabledDecisionSchema = z.object({
  kind: z.literal("decision"),
  node: z.string(),
  name: z.string(),
  lane: z.string().optional(),
  role: z.string().optional(),
  outcomes: z.array(z.string()),
  computed: z.object({ decision: z.string(), facts: z.array(z.string()) }).optional(),
  phase: z.array(z.string()).optional(),
  context: TaskContextSchema.optional(),
});

export const EnabledStepSchema = z.discriminatedUnion("kind", [EnabledActivitySchema, EnabledDecisionSchema]);

/** Where an instance is (`position()` in src/workflow/instance.ts). */
export const WorkflowPositionSchema = z
  .object({
    instance: z.string(),
    process: z.string(),
    processName: z.string(),
    subject: z.string(),
    bean: z.string().optional(),
    status: z.enum(["running", "completed"]),
    enabled: z.array(EnabledStepSchema),
    done: z.array(z.object({ node: z.string(), name: z.string(), outcome: z.string().optional() })),
  })
  .describe("A process instance: its subject, status, the steps enabled now with who performs them, and what is done.");

const DecisionSchema = z.enum(["permit", "deny", "unknown"]);

/** `TaskAuthVerdict` (src/workflow/authorize.ts). */
const TaskAuthVerdictSchema = z.object({
  allowed: z.boolean(),
  mode: z.enum(["advisory", "strict"]),
  authenticatedBy: z.enum(["github", "http-gateway", "asserted", "none"]),
  actor: z.string().nullable(),
  account: z.string().optional(),
  role: z.string().optional(),
  assignment: z.enum(["eligible", "unconstrained", "not-eligible", "no-role", "unknown-actor"]),
  authorized: DecisionSchema,
  access: DecisionSchema.optional(),
  findings: z.array(z.string()),
});

/** `workflow_list`. */
export const WorkflowListingSchema = z
  .object({
    processes: z.array(
      z.object({
        file: z.string(),
        name: z.string().optional(),
        id: z.string().optional(),
        activities: z.number().int().optional(),
        error: z.string().optional(),
      }),
    ),
    instances: z.array(
      z.object({ id: z.string(), subject: z.string(), status: z.enum(["running", "completed"]), updatedAt: z.string() }),
    ),
  })
  .describe("The processes a folio defines (or why one cannot be read), and its open instances.");

/** `workflow_start`. */
export const WorkflowStartedSchema = z
  .object({ started: z.boolean(), position: WorkflowPositionSchema })
  .describe("Whether a new instance began (false: an open one was continued), and where it now is.");

/** `workflow_gate`. */
export const WorkflowGateAnswerSchema = z
  .object({
    allowed: z.boolean(),
    gate: z.object({
      allowed: z.boolean(),
      reason: z.string(),
      relaxedBy: z
        .object({
          process: z.string(),
          activity: z.string(),
          reason: z.string(),
          scope: z.string().optional(),
          package: z.string(),
        })
        .optional(),
    }),
    authorization: TaskAuthVerdictSchema,
    namedActor: z.string().optional(),
  })
  .describe("May a step run now: the process gate and the task authorization, either of which refuses.");

/** `workflow_complete`. */
export const WorkflowCompletionSchema = z
  .object({
    position: WorkflowPositionSchema,
    authorization: TaskAuthVerdictSchema.optional(),
    workPlan: z.string().optional(),
  })
  .describe("The instance after a step was recorded, the authorization it was recorded under, and any work-plan change.");
