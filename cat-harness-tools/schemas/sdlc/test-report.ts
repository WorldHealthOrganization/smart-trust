/**
 * A TEST REPORT — the verdicts one run of one plan reached against one system
 * under test. STRAWPERSON.
 *
 * @module schemas/test-report
 * @graphNode schema
 *
 * Per-case verdicts plus a per-plan rollup, written to `qa-reports` under
 * `tests/<plan-id>/<sut>/<run-id>/`. A RECORD of what was found, never the
 * decision taken on it: certification is a separate, signed node — a Decision
 * by an accountable role, applying the DMN the plan's `exitCriteria` names.
 *
 * ## Per-case verdicts are the block-qa entry shape
 *
 * `{result, reviewer{kind,id,…}, reviewed_at}` — the shape `block-qa/v1` uses
 * for a criterion, with the same `result` spellings (`pass | fail | warn |
 * n/a`); no new spelling of not-applicable. It adds ONE value, `skipped`:
 * `n/a` says the case does not apply to this system, `skipped` says it
 * applies and was not executed. Every case must be executed or explicitly
 * skipped, so a `skipped` entry must carry its `reason`.
 *
 * Several entries per case are allowed, as in block-qa (a script verdict, then
 * a human override). The CURRENT verdict is the last entry.
 *
 * ## A rollup per plan, never a total across plans
 *
 * A plan is the test-side family: a pass on `crdm-detect` case 4 is not the
 * same kind of fact as a pass on a FHIR IG's profile check. So:
 *
 * - a report names exactly ONE plan, and there is no field to name a second;
 * - the top level and the rollup are STRICT, so a `total` or `plans` key is
 *   refused rather than silently dropped;
 * - {@link rollupPanels}, the one aggregation offered, returns one panel per
 *   report grouped by plan and computes nothing that spans plans. Its test
 *   asserts the ABSENCE of a total, the discipline `QaGraphIndex` uses.
 *
 * ## Three things enforced structurally, mirroring `qa-report.ts`
 *
 * 1. **The rollup may not disagree with the cases it counts.**
 * 2. **`running` is never a pass.** `completed_at` is present exactly when the
 *    status is terminal, and {@link testReportVerdict} returns `unknown` for a
 *    running report even when every case so far passed.
 * 3. **The system under test never wrote its own verdict.** A reviewer whose
 *    `actor` or `id` is the SUT's actor is refused here.
 *
 * What needs the PLAN as well as the report — that every plan case has a
 * verdict, and no verdict names a case the plan lacks — is
 * {@link checkAgainstPlan}, since a schema cannot read another file.
 */
import { z } from "zod";

import { ATTRIBUTION_KINDS } from "../content/attribution";
import { RunContextRefSchema } from "./run-context";
import type { TestPlan } from "./test-plan";
import { SutRefSchema, TestPlanRefSchema } from "./test-run";

/** The tag a test report carries, so it is identified by declaration. */
export const TEST_REPORT_SCHEMA_ID = "test-report/v1";

/** block-qa's four results, verbatim, plus `skipped` — see the module note. */
export const TEST_CASE_RESULTS = ["pass", "fail", "warn", "n/a", "skipped"] as const;
export type TestCaseResult = (typeof TEST_CASE_RESULTS)[number];

/** `running` is kept because a run can be found in that state when it died. */
export const TEST_REPORT_TERMINAL_STATUSES = ["completed", "aborted"] as const;
export const TestReportStatusSchema = z.enum(["running", ...TEST_REPORT_TERMINAL_STATUSES]);
export type TestReportStatus = z.infer<typeof TestReportStatusSchema>;

export function isTerminal(status: TestReportStatus): boolean {
  return (TEST_REPORT_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Who reached a verdict — block-qa's `QaReviewer`, the identity half. */
export const TestReviewerSchema = z.object({
  kind: z.enum(ATTRIBUTION_KINDS),
  /** What ran: a script path, an agent name, a GitHub login. */
  id: z.string().min(1),
  version: z.string().optional(),
  /** On whose authority — an id under `scenarios/actors/`. Absent is unresolved, not permitted. */
  actor: z.string().min(1).optional(),
});

export const TestCaseVerdictSchema = z
  .object({
    result: z.enum(TEST_CASE_RESULTS),
    reviewer: TestReviewerSchema,
    /** ISO-8601 UTC. */
    reviewed_at: z.string().min(1),
    /** Per-assertion results, keyed by the assertion's criterion id. */
    assertions: z.record(z.string().min(1), z.enum(["pass", "fail", "warn", "n/a"])).optional(),
    evidence: z.union([z.string(), z.array(z.object({ line: z.number().optional(), text: z.string().optional() }))]).optional(),
    /** Why the case was skipped. Required when `result` is `skipped`. */
    reason: z.string().min(1).optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.result !== "skipped" || v.reason !== undefined, {
    message: "a `skipped` case must say why — an unexplained skip cannot be told from a case nobody ran",
    path: ["reason"],
  });
export type TestCaseVerdict = z.infer<typeof TestCaseVerdictSchema>;

/** Counts of CURRENT verdicts, one bucket per result. Strict: no `total` key. */
export const TestReportRollupSchema = z.strictObject({
  pass: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  warn: z.number().int().nonnegative(),
  "n/a": z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export type TestReportRollup = z.infer<typeof TestReportRollupSchema>;

/** The run the verdicts came from, with the two hashes that make it repeatable (`zz0a`). */
export const TestReportRunRefSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "a run id is path-safe"),
  data: z.string().min(1),
  process: z.string().min(1),
});

export const TestReportSchema = z
  .strictObject({
    $schema: z.literal(TEST_REPORT_SCHEMA_ID),
    /** ONE plan. There is no field for a second — see the module note. */
    plan: TestPlanRefSchema,
    sut: SutRefSchema,
    run: TestReportRunRefSchema,
    status: TestReportStatusSchema,
    started_at: z.string().min(1),
    completed_at: z.string().min(1).optional(),
    /** Case id → reviewer entries, oldest first. The last is current. */
    cases: z.record(z.string().min(1), z.array(TestCaseVerdictSchema).min(1)),
    rollup: TestReportRollupSchema,
    /**
     * Content-addressed reference to the `folio-run-context/v1` record of the
     * run that produced this report (`docs/proposals/tool-releases-2026-10-07.md`,
     * owner C1 = a).
     */
    runContext: RunContextRefSchema.optional(),
  })
  .superRefine((r, ctx) => {
    // 1. The rollup may not disagree with the cases it counts.
    const actual = computeRollup(r.cases);
    for (const k of TEST_CASE_RESULTS) {
      if (r.rollup[k] !== actual[k]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rollup", k],
          message: `rollup.${k} is ${r.rollup[k]} but the cases hold ${actual[k]} — a count authored apart from the list it counts can lie about itself, invisibly`,
        });
      }
    }

    // 2. `running` is never a pass: completed_at exactly when terminal.
    const done = r.completed_at !== undefined;
    if (isTerminal(r.status) && !done) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completed_at"],
        message: `status \`${r.status}\` is terminal but no completed_at — a report that cannot say it finished must not read as one that did`,
      });
    }
    if (!isTerminal(r.status) && done) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "completed_at is present but status is `running` — one of the two is wrong, and guessing which is how a half-run becomes a clean run",
      });
    }

    // 3. The system under test never wrote its own verdict.
    for (const [id, entries] of Object.entries(r.cases)) {
      entries.forEach((e, i) => {
        if (e.reviewer.actor === r.sut.actor || e.reviewer.id === r.sut.actor) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cases", id, i, "reviewer"],
            message: `case \`${id}\` was judged by the system under test (\`${r.sut.actor}\`) — a verdict a system writes about itself is not evidence`,
          });
        }
      });
    }
  });
export type TestReport = z.infer<typeof TestReportSchema>;

/** The current verdict of each case — the last entry. */
export function currentVerdicts(cases: Record<string, TestCaseVerdict[]>): Record<string, TestCaseVerdict> {
  const out: Record<string, TestCaseVerdict> = {};
  for (const [id, entries] of Object.entries(cases)) {
    const last = entries.at(-1);
    if (last) out[id] = last;
  }
  return out;
}

/** The rollup the cases imply. Writers should call this rather than count by hand. */
export function computeRollup(cases: Record<string, TestCaseVerdict[]>): TestReportRollup {
  const r: TestReportRollup = { pass: 0, fail: 0, warn: 0, "n/a": 0, skipped: 0 };
  for (const v of Object.values(currentVerdicts(cases))) r[v.result] += 1;
  return r;
}

/**
 * Did this run of this plan come out clean? Three states.
 *
 * - `unknown` for a running report, however good it looks so far;
 * - `finding` when any current verdict is `fail`, in a terminal report;
 * - `unknown` for an aborted report with no failure — it stopped before
 *   answering, which is not an answer;
 * - `unknown` for a completed report in which nothing PASSED — every case
 *   skipped or not applicable has demonstrated nothing;
 * - otherwise `ok`. `warn` does not block, as in block-qa.
 *
 * This is NOT certification. The certifier applies the plan's DMN.
 */
export function testReportVerdict(r: TestReport): "ok" | "finding" | "unknown" {
  if (!isTerminal(r.status)) return "unknown";
  if (r.rollup.fail > 0) return "finding";
  if (r.status === "aborted") return "unknown";
  if (r.rollup.pass === 0) return "unknown";
  return "ok";
}

/** One panel: one report's rollup, in its plan's own terms. */
export interface TestReportPanel {
  sut: TestReport["sut"];
  run: TestReport["run"];
  planVersion: string;
  rollup: TestReportRollup;
  verdict: "ok" | "finding" | "unknown";
}

/**
 * Group reports into panels, PER PLAN. The only aggregation this module
 * offers, and it computes nothing across plans — the returned map has one key
 * per plan id and no total anywhere, by the owner's `py74` ruling.
 *
 * It does not sum WITHIN a plan either: two systems under test are two
 * panels, because adding one system's passes to another's certifies neither.
 */
export function rollupPanels(reports: readonly TestReport[]): Map<string, TestReportPanel[]> {
  const out = new Map<string, TestReportPanel[]>();
  for (const r of reports) {
    const list = out.get(r.plan.id) ?? [];
    list.push({ sut: r.sut, run: r.run, planVersion: r.plan.version, rollup: r.rollup, verdict: testReportVerdict(r) });
    out.set(r.plan.id, list);
  }
  return out;
}

/** A disagreement between a report and the plan it claims to have executed. */
export interface PlanMismatch {
  kind: "plan-id" | "plan-version" | "unknown-case" | "unexecuted-case";
  message: string;
}

/**
 * Check a report against its plan — the half a schema cannot do alone.
 *
 * An unexecuted case is a mismatch only once the report is terminal: a
 * running report has simply not got there yet.
 */
export function checkAgainstPlan(report: TestReport, plan: TestPlan): PlanMismatch[] {
  const out: PlanMismatch[] = [];
  if (report.plan.id !== plan.id) {
    out.push({ kind: "plan-id", message: `report is for plan \`${report.plan.id}\`, not \`${plan.id}\`` });
    return out;
  }
  if (report.plan.version !== plan.version) {
    out.push({ kind: "plan-version", message: `report executed v${report.plan.version}; the plan is v${plan.version}` });
  }
  const planCases = new Set(plan.testCases.map((c) => c.id));
  for (const id of Object.keys(report.cases)) {
    if (!planCases.has(id)) out.push({ kind: "unknown-case", message: `verdict for \`${id}\`, which plan \`${plan.id}\` does not contain` });
  }
  if (isTerminal(report.status)) {
    for (const id of planCases) {
      if (!(id in report.cases)) {
        out.push({ kind: "unexecuted-case", message: `case \`${id}\` has no verdict — every case is executed or explicitly skipped with a reason` });
      }
    }
  }
  return out;
}

const PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Where a report is written on the `qa-reports` branch:
 * `tests/<plan-id>/<sut-actor>/<run-id>/test-report.json` (proposal §3.2).
 * Throws on a segment that is not path-safe rather than composing a path that
 * escapes its directory.
 */
export function testReportPath(r: Pick<TestReport, "plan" | "sut" | "run">): string {
  for (const seg of [r.plan.id, r.sut.actor, r.run.id]) {
    if (!PATH_SEGMENT.test(seg) || seg === "." || seg === "..") {
      throw new Error(`\`${seg}\` is not a path-safe segment for a test-report path`);
    }
  }
  return `tests/${r.plan.id}/${r.sut.actor}/${r.run.id}/test-report.json`;
}
