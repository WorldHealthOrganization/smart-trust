/**
 * QA reports — what a pipeline TOOL recorded about its own run.
 *
 * @module schemas/qa-report
 * @graphNode schema
 *
 * Like the other committed QA artefacts (`*.qa.json`, `*.script-qa.json`,
 * `*.kg-qa.json`, `health-report/v1`), **the file declares what it is** with a
 * `$schema` tag, not by its extension or directory.
 *
 * The shape already exists upstream: every DAK pre- and post-processing script
 * in WHO's SMART Base repository instantiates a `QAReporter` and writes a phase
 * report — successes, warnings, errors, the files it processed, the files it
 * EXPECTED, and the files that were missing — and the IG Publisher writes
 * `qa.json`, uploaded as a workflow artifact. This kind gives it somewhere to
 * live.
 *
 * ## Not the `qa` kind
 *
 * - a **`qa` witness** judges an ARTEFACT this repository produced, against
 *   criteria that artefact is supposed to meet;
 * - a **`health` report** judges the REPOSITORY itself;
 * - a **`qa-report`** records what a TOOL did on one run. Its subject is an
 *   execution, not an artefact and not a repository.
 *
 * ## The field names are UPSTREAM's
 *
 * `total_successes`, `files_expected`, `completion_timestamp` — snake_case,
 * against this repository's own convention, so an upstream report validates
 * here **byte for byte** and a change upstream fails validation instead of
 * being quietly re-mapped. The wrapper fields this module ADDS — `$schema`,
 * `producer`, `source`, `toolchain` — are ours, camelCase where compound.
 *
 * ## Three things enforced structurally
 *
 * 1. **A summary cannot disagree with its own details.** `total_errors` must
 *    equal `details.errors.length`, and so on.
 * 2. **`files_missing` must be a subset of `files_expected`.** A file cannot
 *    be missing if nobody expected it. This keeps "the DMN directory held no
 *    decisions" distinguishable from "the DMN directory was not found".
 * 3. **`running` is never a pass.** A report that never finalised carries no
 *    `completion_timestamp`, and a consumer must not read its zero errors as a
 *    clean run. Same rule as `check-ci-health.ts`, `restore-staging.ts`,
 *    `kg-qa.ts` and `health-report.ts`: **could-not-determine is never
 *    rendered as clean.** Enforced by requiring `completion_timestamp` exactly
 *    when `status` is terminal.
 */
import { z } from "zod";
import { RunContextRefSchema } from "./run-context";

/** The tag a `qa-report` document carries, so it is identified by declaration. */
export const QA_REPORT_SCHEMA_TAG = "qa-report/v1";

/**
 * Which tool produced the report.
 *
 * Two today, and the discriminator is not cosmetic: a `dak-script` report is
 * one script's view of its own run, while `ig-publisher` is the build's view
 * of an entire IG. A consumer that treats them as interchangeable will
 * aggregate one script's 3 warnings with a whole validation pass's 3,000.
 */
export const QaReportProducerSchema = z.enum(["dak-script", "ig-publisher"]);
export type QaReportProducer = z.infer<typeof QaReportProducerSchema>;

/**
 * Terminal statuses, and the one that is not.
 *
 * `running` is retained BECAUSE the upstream reporter writes it as its initial
 * value — a report can be found in that state when a script died mid-run, and
 * that is exactly the case worth being able to represent. Dropping it would
 * force such a report to be recorded as something it is not.
 */
export const QA_REPORT_TERMINAL_STATUSES = ["completed", "failed"] as const;
export const QaReportStatusSchema = z.enum(["running", ...QA_REPORT_TERMINAL_STATUSES]);
export type QaReportStatus = z.infer<typeof QaReportStatusSchema>;

/** Is this status one from which no further writing is expected? */
export function isTerminal(status: QaReportStatus): boolean {
  return (QA_REPORT_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** One narrative entry — a success, a warning or an error. */
export const QaReportEntrySchema = z.object({
  message: z.string().min(1),
  timestamp: z.string().min(1),
  /** Free-form, because upstream's is. Carried through rather than parsed. */
  details: z.unknown().optional(),
});
export type QaReportEntry = z.infer<typeof QaReportEntrySchema>;

/** One file the tool touched, with what happened to it. */
export const QaReportFileSchema = z.object({
  file: z.string().min(1),
  /** Upstream uses `success`, `error`, `skipped_existing`, `updated`, … — an OPEN set, so a string. Narrowing it here would reject a real report the day upstream adds a case. */
  status: z.string().min(1),
  timestamp: z.string().min(1),
  details: z.unknown().optional(),
});
export type QaReportFile = z.infer<typeof QaReportFileSchema>;

/** Where the report came from. OURS, not upstream's — upstream records no provenance. */
export const QaReportSourceSchema = z.object({
  /** The script or binary, as invoked. `generate_valueset_schemas.py`, `publisher.jar`. */
  tool: z.string().min(1),
  /** The repository the run happened in, if known. */
  repository: z.string().optional(),
  /** The commit under test, if known. */
  commit: z.string().optional(),
  /**
   * A URL for the run, if one exists.
   *
   * Optional, and absent is a real answer: a local run has none, and inventing
   * a plausible one is the `blv9` shape — a link-shaped value resolving to
   * nothing.
   */
  runUrl: z.string().url().optional(),
});

/**
 * What produced the result, version by version.
 *
 * Separate from `source` because they answer different questions — `source` is
 * WHERE, this is WITH WHAT. It matters more here than it looks: the WHO build
 * re-downloads `publisher.jar` from the LATEST release on every run, so two
 * reports over an unchanged commit can differ and nothing else in the document
 * would say why.
 */
export const QaReportToolchainSchema = z.object({
  publisher: z.string().optional(),
  sushi: z.string().optional(),
  fhirVersion: z.string().optional(),
});

const SummaryShape = z.object({
  total_successes: z.number().int().nonnegative(),
  total_warnings: z.number().int().nonnegative(),
  total_errors: z.number().int().nonnegative(),
  files_processed_count: z.number().int().nonnegative(),
  files_expected_count: z.number().int().nonnegative(),
  files_missing_count: z.number().int().nonnegative(),
  completion_timestamp: z.string().min(1).optional(),
});

const DetailsShape = z.object({
  successes: z.array(QaReportEntrySchema),
  warnings: z.array(QaReportEntrySchema),
  errors: z.array(QaReportEntrySchema),
  files_processed: z.array(QaReportFileSchema),
  files_expected: z.array(z.string().min(1)),
  files_missing: z.array(z.string().min(1)),
});

/** A QA report, as a `qa-report/v1` document. */
export const QaReportSchema = z
  .object({
    $schema: z.literal(QA_REPORT_SCHEMA_TAG),
    producer: QaReportProducerSchema,
    source: QaReportSourceSchema,
    toolchain: QaReportToolchainSchema.optional(),
    /** Upstream's own field: `preprocessing`, `postprocessing`, or a build phase. */
    phase: z.string().min(1),
    timestamp: z.string().min(1),
    status: QaReportStatusSchema,
    summary: SummaryShape,
    details: DetailsShape,
    /**
     * Content-addressed reference to the `folio-run-context/v1` record of the
     * run that produced this report (`docs/proposals/tool-releases-2026-10-07.md`,
     * owner C1 = a). When present, `toolchain` is a projection of it via
     * `toolchainFromRunContext`.
     */
    runContext: RunContextRefSchema.optional(),
  })
  .superRefine((r, ctx) => {
    // 1. A summary may not disagree with the details it summarises.
    const pairs: Array<[keyof z.infer<typeof SummaryShape>, number]> = [
      ["total_successes", r.details.successes.length],
      ["total_warnings", r.details.warnings.length],
      ["total_errors", r.details.errors.length],
      ["files_processed_count", r.details.files_processed.length],
      ["files_expected_count", r.details.files_expected.length],
      ["files_missing_count", r.details.files_missing.length],
    ];
    for (const [field, actual] of pairs) {
      if (r.summary[field] !== actual) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["summary", field],
          message: `summary.${String(field)} is ${String(r.summary[field])} but details holds ${actual} — a report whose counts are authored apart from the list they count can lie about itself, invisibly`,
        });
      }
    }

    // 2. A file cannot be missing if nobody expected it. This is what keeps a
    //    determined empty distinguishable from a not-found.
    const expected = new Set(r.details.files_expected);
    for (const m of r.details.files_missing) {
      if (!expected.has(m)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["details", "files_missing"],
          message: `\`${m}\` is reported missing but was never expected — "nobody looked for it" and "it was looked for and absent" are different results`,
        });
      }
    }

    // 3. `running` is never a pass, and a terminal status must say when it ended.
    const done = r.summary.completion_timestamp !== undefined;
    if (isTerminal(r.status) && !done) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["summary", "completion_timestamp"],
        message: `status \`${r.status}\` is terminal but no completion_timestamp — a report that cannot say it finished must not read as one that did`,
      });
    }
    if (!isTerminal(r.status) && done) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "a completion_timestamp is present but status is `running` — one of the two is wrong, and guessing which is how a half-run becomes a clean run",
      });
    }
  });

export type QaReport = z.infer<typeof QaReportSchema>;

/**
 * Did this run produce a clean result?
 *
 * **Three states, and the third is the reason this function exists.** A caller
 * writing `report.summary.total_errors === 0` gets `true` for a script that
 * died before writing anything, which is the false pass every three-state
 * module here is written to refuse.
 */
export function qaReportVerdict(r: QaReport): "ok" | "finding" | "unknown" {
  if (!isTerminal(r.status)) return "unknown";
  if (r.summary.total_errors > 0) return "finding";
  return "ok";
}
