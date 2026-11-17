/**
 * The typed reports of `bun run cat gates` and `bun run cat check:merged`.
 *
 * Both tools keep their text and their three exit codes. With
 * `--report <path>` they also write one of these, so a program or BPMN
 * gateway reads which gates failed, which were skipped and why, instead of
 * parsing the text. The exit code stays the verdict; `outcome` names it,
 * and tells apart the two different exit-1 cases (a gate failed, or every
 * gate passed but one changed the tree).
 *
 * @module cat-harness-tools/schemas/sdlc/gates-report
 * @graphNode schema
 */
import { z } from "zod";

export const GATES_REPORT_SCHEMA = "folio-gates-report/v1";
export const MERGED_GATES_REPORT_SCHEMA = "folio-merged-gates-report/v1";

/**
 * - `pass`: every gate asked passed and nothing changed the tree (exit 0);
 * - `fail`: a gate failed (exit 1);
 * - `not-clean`: every gate passed, but a gate changed the tree, so the
 *   verdicts after it describe a tree nobody committed (exit 1);
 * - `undetermined`: the gate set or the environment could not be read (exit 2),
 *   or the run stopped before any verdict (an uncaught error, exit 1).
 */
export const GATE_OUTCOMES = ["pass", "fail", "not-clean", "undetermined"] as const;
export type GateOutcome = (typeof GATE_OUTCOMES)[number];

const GateRefSchema = z.object({ command: z.string(), job: z.string(), step: z.string() });

export const GatesReportSchema = z
  .object({
    $schema: z.literal(GATES_REPORT_SCHEMA),
    outcome: z.enum(GATE_OUTCOMES),
    exitCode: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    /** `fast` (no browser jobs) or `whole` (`--all`). */
    set: z.enum(["fast", "whole"]),
    /** How many gates the set holds, and how many declared writers ran after them. */
    gates: z.number().int().nonnegative(),
    writers: z.number().int().nonnegative(),
    /**
     * Every gate command in the set, in workflow order — what the run was asked
     * to judge, so a record of it (`scripts/gate-record.ts`) names what it
     * covers rather than only how many. Absent from reports written before it.
     */
    commands: z.array(z.string()).optional(),
    /**
     * Gates of the set this run was told not to run (`--except`), so a record
     * of it never claims them. CI runs them. Absent when none was held out.
     */
    heldOut: z.array(z.string()).optional(),
    failed: z.array(GateRefSchema.extend({ why: z.array(z.string()) })),
    /** Not asked: inputs unchanged since each last passed. Never counted as a pass. */
    skipped: z.array(z.object({ command: z.string(), why: z.string() })),
    /** Gates that changed the tree while it was being judged. */
    mutatedBy: z.array(z.string()),
    /** Lines saying what could not be read, when anything could not. */
    undetermined: z.array(z.string()),
    /** Steps CI runs that the local set does not. */
    unclassified: z.array(z.object({ file: z.string(), command: z.string() })),
    /** Check scripts no workflow runs. */
    unrun: z.array(z.string()),
  })
  .strict();
export type GatesReport = z.infer<typeof GatesReportSchema>;

/** `check:merged` adds one outcome of its own: the merge itself conflicts (exit 1). */
export const MERGED_OUTCOMES = ["pass", "conflict", "fail", "not-clean", "undetermined"] as const;
export type MergedOutcome = (typeof MERGED_OUTCOMES)[number];

export const MergedGatesReportSchema = z
  .object({
    $schema: z.literal(MERGED_GATES_REPORT_SCHEMA),
    outcome: z.enum(MERGED_OUTCOMES),
    exitCode: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    head: z.string().optional(),
    base: z.string().optional(),
    /** Base commits not yet in this branch. */
    behind: z.number().int().nonnegative().optional(),
    conflicts: z.array(z.string()).optional(),
    /** The gate run on the merged tree, when it ran and wrote its report. */
    gates: GatesReportSchema.optional(),
    /** One line on why, for every outcome but `pass`. */
    why: z.string().optional(),
  })
  .strict();
export type MergedGatesReport = z.infer<typeof MergedGatesReportSchema>;

/** Tool I/O types. */
export const GatesReportTypeSchema = GatesReportSchema.describe(
  "One gate run: outcome and exit code, the failed gates with their salient lines, the skipped ones and why, and what changed the tree.",
);
export const MergedGatesReportTypeSchema = MergedGatesReportSchema.describe(
  "Gates on this branch merged with its base: pass, conflict (with the files), fail, not-clean or undetermined, and the inner gate run.",
);
