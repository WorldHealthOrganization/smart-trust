/**
 * Typed results of the tools that read and write the harness's data stores —
 * the work plan, the activity log and the session record.
 *
 * Each tool keeps its human-readable report and ALSO declares a `result`
 * output of one of these types, printed when the tool's `json` flag is set,
 * so a caller, a BPMN gateway or an MCP client can check it. Each schema here
 * is held to its script's interface in both directions by
 * `scripts/tests/store-tool-results.test.ts`.
 *
 * @module schemas/tools/store-tool-results
 * @graphNode schema
 */
import { z } from "zod";

/** A commit on a bean's file (`Commit` in `scripts/lib/bean-drain.ts`). */
export const BeanCommitSchema = z
  .object({
    author: z.string(),
    at: z.string(),
    subject: z.string(),
    session: z.string().optional(),
  })
  .describe("A commit on a bean's file, with the Claude-Session trailer when it has one.");

/** One place open work was found (`LookupHit`). */
export const OpenWorkHitSchema = z.object({
  repo: z.string(),
  where: z.enum(["default-branch", "open-pr"]),
  pr: z.number().int().optional(),
  head: z.string().optional(),
  author: z.string().optional(),
  createdAt: z.string().optional(),
  match: z.enum(["file", "title", "body", "branch"]),
  paths: z.array(z.string()).optional(),
});

/** `open-work-lookup --json` (`Lookup`). `unread` lists what could not be read, so empty hits are never absence. */
export const OpenWorkLookupSchema = z
  .object({
    query: z.object({ kind: z.enum(["path", "prefix", "bean"]), value: z.string() }),
    checkedAt: z.string(),
    hits: z.array(OpenWorkHitSchema),
    unread: z.array(z.string()),
  })
  .describe("Where a path, prefix or bean id exists on main or an open PR head; `unread` names what could not be read.");

export const CLAIM_STATES = ["claimed", "would-claim", "skip-recent-commit", "skip-claim-note", "skip-open-pr", "skip-closed", "unknown"] as const;

/** `bean-claim-check --json` (`ClaimCheck`). */
export const BeanClaimCheckSchema = z
  .object({
    bean: z.string(),
    state: z.enum(CLAIM_STATES),
    copies: z.array(
      z.object({
        repo: z.string(),
        ref: z.string(),
        recent: z.array(BeanCommitSchema.extend({ agent: z.string() })),
        status: z.string().optional(),
        claimCommit: z.string().optional(),
        pushAttempts: z.number().int().optional(),
      }),
    ),
    openWork: OpenWorkLookupSchema,
    reason: z.string(),
  })
  .describe("Whether a bean was claimed, or why it was skipped, with what each copy of the work plan showed.");

export const EXCLUSIONS = ["goal", "epic", "blocked", "completed", "scrapped", "draft", "owner-held"] as const;

const QueueEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  type: z.string(),
  priority: z.string(),
  lastTouch: z.object({ author: z.string(), at: z.string(), agent: z.string() }).optional(),
  skip: z.string().optional(),
});

/** `drain-queue --json` (`Queue`). */
export const DrainQueueSchema = z
  .object({
    refreshedAt: z.string(),
    sources: z.array(z.object({ repo: z.string(), ref: z.string(), sha: z.string() })),
    byOwner: z.array(z.object({ owner: z.string(), beans: z.array(QueueEntrySchema) })),
    spare: z.array(QueueEntrySchema),
    excluded: z.array(z.object({ id: z.string(), reason: z.enum(EXCLUSIONS), detail: z.string().optional() })),
    disagreements: z.array(z.object({ id: z.string(), byCopy: z.record(z.string(), z.string()), used: z.string() })),
  })
  .describe("The beans that can be drained, by owner, with what was excluded and why.");

/** `sibling-sessions --json` (`SessionSweep`). */
export const SessionSweepSchema = z
  .object({
    since: z.string(),
    commitsScanned: z.number().int(),
    sessions: z.array(
      z.object({
        session: z.string(),
        commits: z.number().int(),
        first: z.string(),
        last: z.string(),
        branches: z.array(z.string()),
        latestSubject: z.string(),
      }),
    ),
    untrailered: z.number().int(),
  })
  .describe("The sessions that committed in a window, read from Claude-Session trailers.");

/** `bean_query` with `format: json` (`QueryResultRow[]`): one object per SPARQL solution, bean IRIs shortened to ids. */
export const BeanQueryRowsSchema = z
  .array(z.record(z.string(), z.string()))
  .describe("The rows a bean SPARQL query returned, each variable to its value; bean IRIs are shortened to bean ids.");
