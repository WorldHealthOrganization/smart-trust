import { describe, expect, test } from "bun:test";

import {
  QA_REPORT_SCHEMA_TAG,
  QaReportSchema,
  isTerminal,
  qaReportVerdict,
  type QaReport,
} from "./qa-report";
import { defaultGraphTypologies, graphTypologyIri, graphLayer, isRenderable, processMayWrite } from "../kg/cat-harness";

/**
 * A report in the shape the upstream `QAReporter` writes, plus the wrapper
 * fields this module adds. Built by a helper rather than inlined per test, so
 * that a test asserting ONE rule cannot accidentally be passing because of a
 * second violation elsewhere in its fixture.
 */
function report(over: Partial<QaReport> = {}): unknown {
  const base = {
    $schema: QA_REPORT_SCHEMA_TAG,
    producer: "dak-script",
    source: { tool: "generate_valueset_schemas.py" },
    phase: "postprocessing",
    timestamp: "2026-09-22T18:00:00Z",
    status: "completed",
    summary: {
      total_successes: 1,
      total_warnings: 0,
      total_errors: 0,
      files_processed_count: 1,
      files_expected_count: 1,
      files_missing_count: 0,
      completion_timestamp: "2026-09-22T18:00:03Z",
    },
    details: {
      successes: [{ message: "Found ValueSet", timestamp: "2026-09-22T18:00:01Z" }],
      warnings: [],
      errors: [],
      files_processed: [
        { file: "schemas/a.schema.json", status: "success", timestamp: "2026-09-22T18:00:02Z" },
      ],
      files_expected: ["schemas/a.schema.json"],
      files_missing: [],
    },
  };
  return { ...base, ...over };
}

describe("a summary may not disagree with the details it summarises", () => {
  test("the matching case parses", () => {
    expect(QaReportSchema.safeParse(report()).success).toBe(true);
  });

  test("a count that does not match its list is REFUSED", () => {
    // The failure this rule exists for: the number is plausible, the list is
    // right there, and a reader sees only the number.
    const r = QaReportSchema.safeParse(
      report({
        summary: {
          total_successes: 7,
          total_warnings: 0,
          total_errors: 0,
          files_processed_count: 1,
          files_expected_count: 1,
          files_missing_count: 0,
          completion_timestamp: "2026-09-22T18:00:03Z",
        },
      } as Partial<QaReport>),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]!.path).toEqual(["summary", "total_successes"]);
      expect(r.error.issues[0]!.message).toContain("details holds 1");
    }
  });

  test("EVERY count is checked, not just the first", () => {
    const r = QaReportSchema.safeParse(
      report({
        summary: {
          total_successes: 9,
          total_warnings: 9,
          total_errors: 9,
          files_processed_count: 9,
          files_expected_count: 9,
          files_missing_count: 9,
          completion_timestamp: "2026-09-22T18:00:03Z",
        },
      } as Partial<QaReport>),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.length).toBeGreaterThanOrEqual(6);
  });
});

describe("a determined empty is not a not-found", () => {
  test("expected-and-missing is a legitimate report", () => {
    // The DMN directory was looked for and was not there. This must be
    // recordable, because it is the state most worth telling apart.
    const r = QaReportSchema.safeParse(
      report({
        summary: {
          total_successes: 1,
          total_warnings: 0,
          total_errors: 0,
          files_processed_count: 1,
          files_expected_count: 2,
          files_missing_count: 1,
          completion_timestamp: "2026-09-22T18:00:03Z",
        },
        details: {
          successes: [{ message: "Found ValueSet", timestamp: "t" }],
          warnings: [],
          errors: [],
          files_processed: [{ file: "schemas/a.schema.json", status: "success", timestamp: "t" }],
          files_expected: ["schemas/a.schema.json", "input/dmn/"],
          files_missing: ["input/dmn/"],
        },
      } as Partial<QaReport>),
    );
    expect(r.success).toBe(true);
  });

  test("missing-but-never-expected is REFUSED", () => {
    const r = QaReportSchema.safeParse(
      report({
        summary: {
          total_successes: 1,
          total_warnings: 0,
          total_errors: 0,
          files_processed_count: 1,
          files_expected_count: 1,
          files_missing_count: 1,
          completion_timestamp: "2026-09-22T18:00:03Z",
        },
        details: {
          successes: [{ message: "Found ValueSet", timestamp: "t" }],
          warnings: [],
          errors: [],
          files_processed: [{ file: "schemas/a.schema.json", status: "success", timestamp: "t" }],
          files_expected: ["schemas/a.schema.json"],
          files_missing: ["input/dmn/"],
        },
      } as Partial<QaReport>),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.message).toContain("never expected");
  });
});

describe("`running` is never a pass", () => {
  test("a run that died is representable, and carries no completion", () => {
    const r = QaReportSchema.safeParse(
      report({
        status: "running",
        summary: {
          total_successes: 0,
          total_warnings: 0,
          total_errors: 0,
          files_processed_count: 0,
          files_expected_count: 0,
          files_missing_count: 0,
        },
        details: {
          successes: [],
          warnings: [],
          errors: [],
          files_processed: [],
          files_expected: [],
          files_missing: [],
        },
      } as Partial<QaReport>),
    );
    expect(r.success).toBe(true);
  });

  test("...and its verdict is `unknown`, NOT `ok`", () => {
    // Zero errors and a clean-looking summary. A caller testing
    // `total_errors === 0` would call this a pass, which is the exact false
    // pass every three-state module here refuses.
    const parsed = QaReportSchema.parse(
      report({
        status: "running",
        summary: {
          total_successes: 0,
          total_warnings: 0,
          total_errors: 0,
          files_processed_count: 0,
          files_expected_count: 0,
          files_missing_count: 0,
        },
        details: {
          successes: [],
          warnings: [],
          errors: [],
          files_processed: [],
          files_expected: [],
          files_missing: [],
        },
      } as Partial<QaReport>),
    );
    expect(parsed.summary.total_errors).toBe(0);
    expect(qaReportVerdict(parsed)).toBe("unknown");
  });

  test("a terminal status with no completion_timestamp is REFUSED", () => {
    const r = QaReportSchema.safeParse(
      report({
        summary: {
          total_successes: 1,
          total_warnings: 0,
          total_errors: 0,
          files_processed_count: 1,
          files_expected_count: 1,
          files_missing_count: 0,
        },
      } as Partial<QaReport>),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["summary", "completion_timestamp"]);
  });

  test("a completion_timestamp with a non-terminal status is REFUSED", () => {
    const r = QaReportSchema.safeParse(report({ status: "running" } as Partial<QaReport>));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["status"]);
  });

  test("the three verdicts", () => {
    const ok = QaReportSchema.parse(report());
    expect(qaReportVerdict(ok)).toBe("ok");

    const failed = QaReportSchema.parse(
      report({
        status: "failed",
        summary: {
          total_successes: 0,
          total_warnings: 0,
          total_errors: 1,
          files_processed_count: 0,
          files_expected_count: 0,
          files_missing_count: 0,
          completion_timestamp: "2026-09-22T18:00:03Z",
        },
        details: {
          successes: [],
          warnings: [],
          errors: [{ message: "boom", timestamp: "t" }],
          files_processed: [],
          files_expected: [],
          files_missing: [],
        },
      } as Partial<QaReport>),
    );
    expect(qaReportVerdict(failed)).toBe("finding");

    const running = QaReportSchema.parse(
      report({
        status: "running",
        summary: {
          total_successes: 0,
          total_warnings: 0,
          total_errors: 0,
          files_processed_count: 0,
          files_expected_count: 0,
          files_missing_count: 0,
        },
        details: {
          successes: [],
          warnings: [],
          errors: [],
          files_processed: [],
          files_expected: [],
          files_missing: [],
        },
      } as Partial<QaReport>),
    );
    expect(qaReportVerdict(running)).toBe("unknown");
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("running")).toBe(false);
  });
});

describe("the file declares what it is", () => {
  test("a document with no `$schema` tag is REFUSED", () => {
    const { $schema: _drop, ...rest } = report() as Record<string, unknown>;
    expect(QaReportSchema.safeParse(rest).success).toBe(false);
  });

  test("an unknown producer is REFUSED — the discriminator is not cosmetic", () => {
    // A script's view of its own run and the build's view of a whole IG are
    // not interchangeable; aggregating them mixes 3 warnings with 3,000.
    expect(QaReportSchema.safeParse(report({ producer: "somebody-else" } as never)).success).toBe(
      false,
    );
  });

  test("an OPEN file status is accepted — upstream's set grows", () => {
    const r = QaReportSchema.safeParse(
      report({
        details: {
          successes: [{ message: "Found ValueSet", timestamp: "t" }],
          warnings: [],
          errors: [],
          files_processed: [
            { file: "schemas/a.schema.json", status: "skipped_existing", timestamp: "t" },
          ],
          files_expected: ["schemas/a.schema.json"],
          files_missing: [],
        },
      } as Partial<QaReport>),
    );
    expect(r.success).toBe(true);
  });
});

describe("the graph typology it is held under", () => {
  test("registered, not renderable, and `state`", () => {
    expect(defaultGraphTypologies.get("qa-report")).toBeDefined();
    expect(isRenderable("qa-report")).toBe(false);
    expect(graphLayer("qa-report")).toBe("state");
  });

  test("a process MAY write it — it is the one thing a run produces about itself", () => {
    expect(processMayWrite("qa-report")).toBe(true);
  });

  test("it is a DIFFERENT kind from `qa` and `health`, on purpose", () => {
    // Three subjects: an artefact, a repository, an execution. The test is
    // here so that a later tidy-up that folds them cannot pass silently.
    const kinds = ["qa", "health", "qa-report"].map((k) => (defaultGraphTypologies.has(k) ? graphTypologyIri(k, defaultGraphTypologies.get(k)) : undefined));
    expect(new Set(kinds).size).toBe(3);
  });
});
