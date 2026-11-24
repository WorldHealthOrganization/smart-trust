/**
 * Repository health reports — what the daily sweep under `test/health/` wrote.
 *
 * Like the other committed QA artefacts (`*.qa.json`, `*.script-qa.json`,
 * `*.kg-qa.json`), **the file declares what it is** with a `$schema` tag,
 * rather than being typed by its extension or directory.
 *
 * ## Why it is not `qa-results/v1`
 *
 * `qa-results/v1` carries families of findings and a total. It cannot express
 * what a health check is about:
 *
 * - **A threshold, with the basis it was chosen on.** {@link HealthThreshold}
 *   requires `basis`, structurally, as `schemas/conduct/memory.ts` refuses a
 *   `baseline` with no `measured`.
 * - **Three states.** `ok`, `finding` and **`unknown`** are different answers,
 *   and the third is never rendered as the first: "could not read `gh-pages`"
 *   must not become "0 MB of previews". Same rule as `check-ci-health.ts`,
 *   `restore-staging.ts` and `kg-qa.ts`.
 *
 * Enforced here, so a check added later cannot opt out:
 *
 * - a result in state `unknown` **must** carry a `reason`;
 * - a result in state `finding` **must** carry at least one finding;
 * - a result in state `ok` **must** carry none.
 *
 * @module schemas/health-report
 * @graphNode schema
 */

import { join } from "node:path";

import { z } from "zod";
import { RunContextRefSchema } from "./run-context";

/** Marker value carried by every report this family writes. */
export const HEALTH_REPORT_SCHEMA = "health-report/v1";

/**
 * Where reports live, relative to the layer root.
 *
 * `test/health/results/`. It was `tests/health/results/` when this family
 * landed, at the owner's instruction (2026-09-19: "health checks under
 * tests/health with results tests/health/results"), and this repository then
 * had BOTH `test/` (the declared `qa` graph) and `tests/` (Playwright e2e
 * specs). The owner settled that on `test/` the same day — bean `auap`, see
 * `skills/kg/kg-core/directory-conventions.md` §"`test/` is the one test
 * tree".
 *
 * **This constant is the reason the move is safe, and it was nearly the
 * reason it was not.** The path is composed here from three `join` segments,
 * so a corpus-wide grep for the string `tests/health/results` does not find
 * it — a repoint driven by grep alone would have left this reading `tests`
 * while every consumer moved, and {@link healthReportPath} would then have
 * written and read a report under a directory no declaration names. That is
 * the `dh4f` failure exactly: nothing errors, the sweep reports a clean run,
 * and the declared directory holds nothing.
 */
export const HEALTH_RESULTS_DIR = join("test", "health", "results");

/** The one report this sweep writes, and the one every reader opens. */
export const HEALTH_REPORT_FILENAME = "repository.health-report.json";

/**
 * Where the report lives — the ONE answer, for writer and reader alike.
 *
 * A function rather than two path expressions, for the reason
 * {@link import("./kg-qa").kgQaSidecarPath} gives: two independently composed
 * paths agree only until one of them moves, and a reader looking in the wrong
 * place finds nothing and reports the subject as unchecked. That is a false
 * pass, not an error.
 */
export function healthReportPath(repoRoot: string): string {
  return join(repoRoot, HEALTH_RESULTS_DIR, HEALTH_REPORT_FILENAME);
}

/** Outcome of one check. `unknown` is never a pass, and never a failure. */
export const HEALTH_STATES = ["ok", "finding", "unknown"] as const;
export type HealthState = (typeof HEALTH_STATES)[number];

/**
 * How much a finding matters.
 *
 * The same three-level scale as `kg-qa.ts`, and deliberately so — an agent
 * that has learned one severity vocabulary should not need a second.
 *
 * - `critical` — something is being lost, or is about to be. Gates.
 * - `major` — a real problem somebody must act on, but nothing is being lost
 *   this minute. Gates under `--strict`.
 * - `minor` — worth knowing, with legitimate layers. Never gates.
 */
export const HEALTH_SEVERITIES = ["critical", "major", "minor"] as const;
export type HealthSeverity = (typeof HEALTH_SEVERITIES)[number];

/**
 * A threshold, with the reasoning that produced it.
 *
 * `basis` is REQUIRED. A health check is a number compared against another
 * number, and the second number is the whole argument: a reader who cannot
 * see why 100 MB rather than 500 MB cannot tell a measured limit from a round
 * one somebody liked the look of. Requiring it structurally means a check
 * added later cannot ship a bare constant.
 *
 * Where the basis is "no external standard exists, this is calibrated against
 * what this repository does today", the entry says exactly that. A stated
 * arbitrary threshold is honest; an unstated one implies a rigour it does not
 * have.
 */
export const HealthThresholdSchema = z.object({
  /** What is being compared, in the units below. */
  metric: z.string().min(1),
  /** The limit itself. */
  value: z.number(),
  /** `bytes`, `count`, `days`, `ratio` — free text, so a check can be honest. */
  unit: z.string().min(1),
  /** Why this number and not another. Required; see above. */
  basis: z.string().min(1),
  /** What a breach of THIS threshold is worth. */
  severity: z.enum(HEALTH_SEVERITIES),
});
export type HealthThreshold = z.infer<typeof HealthThresholdSchema>;

/** One thing a reader would act on. */
export const HealthFindingSchema = z.object({
  /** One line, naming the subject. Assert by naming, not by counting. */
  summary: z.string().min(1),
  /** Which threshold this breached, by `metric`. Absent for a finding with no threshold. */
  metric: z.string().optional(),
  severity: z.enum(HEALTH_SEVERITIES),
  /** What to do about it. A finding with no action is a statistic. */
  action: z.string().min(1),
});
export type HealthFinding = z.infer<typeof HealthFindingSchema>;

/** A measurement the check took, reported whether or not it breached anything. */
export const HealthMeasurementSchema = z.object({
  metric: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  /** How it was obtained — the command, so the number can be re-taken. */
  command: z.string().min(1),
});
export type HealthMeasurement = z.infer<typeof HealthMeasurementSchema>;

/**
 * What one check reported.
 *
 * The three structural rules in this module's header are enforced by the
 * refinement below, not by the checker that produced the value.
 */
export const HealthCheckResultSchema = z
  .object({
    id: z.string().min(1),
    state: z.enum(HEALTH_STATES),
    /** One line: what a FINDING from this check would mean. */
    summary: z.string().min(1),
    thresholds: z.array(HealthThresholdSchema),
    measurements: z.array(HealthMeasurementSchema),
    findings: z.array(HealthFindingSchema),
    /** Required when `state` is `unknown`: what could not be determined, and why. */
    reason: z.string().min(1).optional(),
  })
  .superRefine((r, ctx) => {
    if (r.state === "unknown" && r.reason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `check "${r.id}" is unknown but gives no reason — "could not determine" that does not say what it could not determine is indistinguishable from a crash.`,
      });
    }
    if (r.state === "finding" && r.findings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `check "${r.id}" reports a finding with nothing in it.`,
      });
    }
    if (r.state === "ok" && r.findings.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `check "${r.id}" reports ok while holding ${r.findings.length} finding(s) — a false pass.`,
      });
    }
  });
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

/**
 * The whole report.
 *
 * `verdict` is DERIVED and stored anyway, because the consumer that matters
 * most — a workflow step deciding whether to open, edit or leave a tracking
 * issue — should not have to re-implement the precedence. {@link healthVerdict}
 * is the one place that precedence lives, and {@link HealthReportSchema}
 * refuses a report whose stored verdict disagrees with it.
 */
export const HEALTH_VERDICTS = ["clean", "findings", "unknown"] as const;
export type HealthVerdict = (typeof HEALTH_VERDICTS)[number];

/**
 * `unknown` wins over `findings`, which wins over `clean`.
 *
 * The ordering is the point and it is the opposite of the intuitive one. A
 * sweep that could not evaluate one of its checks has not established that the
 * repository is healthy, whatever the other checks said — so a single
 * `unknown` takes the whole report to `unknown`, the tracking issue is left
 * untouched, and the job fails. Promoting `findings` over `unknown` instead
 * would let a blind check hide behind a sighted one.
 */
export function healthVerdict(results: readonly { state: HealthState }[]): HealthVerdict {
  if (results.some((r) => r.state === "unknown")) return "unknown";
  if (results.some((r) => r.state === "finding")) return "findings";
  return "clean";
}

export const HealthReportSchema = z
  .object({
    $schema: z.literal(HEALTH_REPORT_SCHEMA),
    producer: z.object({
      script: z.string().min(1),
      /** Short content hash of the checker, so a stale report is detectable. */
      script_hash: z.string().min(1),
    }),
    subject: z.object({
      kind: z.literal("repository"),
      /** `owner/repo` where it could be determined, else the layer name. */
      id: z.string().min(1),
    }),
    updated_at: z.string().min(1),
    verdict: z.enum(HEALTH_VERDICTS),
    checks: z.array(HealthCheckResultSchema).min(1),
    /**
     * Content-addressed reference to the `folio-run-context/v1` record of the
     * run that wrote this report (`docs/proposals/tool-releases-2026-10-07.md`,
     * owner C1 = a).
     */
    runContext: RunContextRefSchema.optional(),
  })
  .superRefine((r, ctx) => {
    const derived = healthVerdict(r.checks);
    if (derived !== r.verdict) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `stored verdict "${r.verdict}" disagrees with the checks, which say "${derived}".`,
      });
    }
  });
export type HealthReport = z.infer<typeof HealthReportSchema>;

/**
 * An empty sweep is not a clean one.
 *
 * `checks` has a minimum of one for the reason `check-schema-nodes.ts` refuses
 * an empty `schemas/`: a registry that has been emptied, or a walk that found
 * nothing, would otherwise render as a green report over no evidence at all —
 * the `dh4f` shape, one level up.
 */
export function parseHealthReport(value: unknown): HealthReport {
  return HealthReportSchema.parse(value);
}

// ── The pages-serving observation (bean `folio-assistant-1dre`) ─────────

/** Marker value carried by every pages-serving observation. */
export const PAGES_SERVING_SCHEMA = "pages-serving/v1";

/** The file the observation is published as, under the `health` prefix on `qa-reports`. */
export const PAGES_SERVING_FILENAME = "pages-serving.json";

/**
 * One published URL, as a CI job with ordinary egress saw it.
 *
 * `expectedPage` is separate from `status` because GitHub Pages answers a
 * missing page with its OWN 404 document, and a probe that read only the
 * status would still need to say whether the body is the page it asked for.
 */
export const PagesServingUrlSchema = z
  .object({
    url: z.string().url(),
    /** HTTP status of the final response. */
    status: z.number().int().min(100).max(599),
    /** Bytes in the response body. */
    bytes: z.number().int().nonnegative(),
    /** Whether the body is the page asked for, rather than Pages' own 404. */
    expectedPage: z.boolean(),
  })
  .strict();
export type PagesServingUrl = z.infer<typeof PagesServingUrlSchema>;

/**
 * What the published site served, recorded by the CI writer and read OFFLINE
 * by `pages-publish-health`.
 *
 * Owner, 2026-10-11 (bean `1dre`, option 1): the observation lives on
 * `qa-reports` under `main/<sha>/health/pages-serving.json`, published through
 * the qa-store, and the health check reads it with `qa:fetch`. A missing or
 * old observation reads as `unknown` with its date: a recorded observation is
 * a measurement with a date, and one past its horizon is not an observation.
 *
 * `observedAt` is required for that reason. At least one URL is required, for
 * the reason {@link parseHealthReport} refuses an empty sweep: an observation
 * of nothing would count as an instrument over no evidence.
 */
export const PagesServingObservationSchema = z
  .object({
    $schema: z.literal(PAGES_SERVING_SCHEMA),
    /** ISO 8601, when the CI job fetched the site. */
    observedAt: z.string().datetime({ offset: true }),
    /** The published site's root URL. */
    site: z.string().url(),
    /** The workflow run that made the observation, for a reader to open. */
    run: z.string().url().optional(),
    urls: z.array(PagesServingUrlSchema).min(1),
  })
  .strict();
export type PagesServingObservation = z.infer<typeof PagesServingObservationSchema>;
