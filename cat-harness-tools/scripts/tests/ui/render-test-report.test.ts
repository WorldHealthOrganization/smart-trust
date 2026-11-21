/**
 * The test report page and its badge — bean `folio-assistant-ff09`,
 * Done-when 2: "the report renders, and its badge links to the run".
 */
import { describe, expect, test } from "bun:test";

import { TEST_REPORT_SCHEMA_ID, TestReportSchema, computeRollup, type TestCaseVerdict } from "../../../schemas/sdlc/test-report.ts";
import { renderTestReport, testReportBadge } from "../../render-test-report.ts";

const reviewer = { kind: "script" as const, id: "runner.ts", actor: "ci-pipeline" };
const v = (result: TestCaseVerdict["result"], evidence?: string): TestCaseVerdict[] => [{ result, reviewer, reviewed_at: "2026-10-11T08:00:00Z", ...(evidence ? { evidence } : {}) }];
const report = (cases: Record<string, TestCaseVerdict[]>, status: "completed" | "running" = "completed") =>
  TestReportSchema.parse({
    $schema: TEST_REPORT_SCHEMA_ID,
    plan: { id: "demo-plan", version: "1" },
    sut: { kind: "tool" as const, actor: "demo-sut", version: "1", reach: "air-gapped" },
    run: { id: "r-abc-def", data: "abc", process: "def" },
    status,
    started_at: "2026-10-11T08:00:00Z",
    ...(status === "completed" ? { completed_at: "2026-10-11T08:01:00Z" } : {}),
    cases,
    rollup: computeRollup(cases),
  });

describe("the badge", () => {
  test("reads the schema's verdict: passed, findings, could not determine", () => {
    expect(testReportBadge(report({ a: v("pass") }))).toContain("passed");
    expect(testReportBadge(report({ a: v("pass"), b: v("fail") }))).toContain("findings");
    expect(testReportBadge(report({ a: v("pass") }, "running"))).toContain("could not determine");
  });

  test("FALSIFICATION: a running report is never shown as passed", () => {
    expect(testReportBadge(report({ a: v("pass") }, "running"))).not.toContain(">passed<");
  });

  test("is well-formed SVG with the run in its title", () => {
    const svg = testReportBadge(report({ a: v("pass") }));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("r-abc-def");
  });
});

describe("the page", () => {
  const page = renderTestReport(report({ a: v("pass"), b: v("warn", "fires=true; label=not a feature") }), {
    outcome: { precision: 0.9545, recall: 0.9545 },
  } as never, { exitDecision: "x.dmn#D" });

  test("the badge links to the run", () => {
    expect(page).toContain("[![passed](badge.svg)](test-run.json)");
  });

  test("shows the recorded measurements as recorded, not graded", () => {
    expect(page).toContain("| precision | 0.9545 |");
    expect(page).toContain("not graded here");
  });

  test("lists the cases that did not simply pass, with their evidence", () => {
    expect(page).toContain("| `b` | warn | fires=true; label=not a feature |");
  });

  test("never claims a total across plans", () => {
    expect(page).toContain("there is no total across plans");
    expect(page).not.toMatch(/total: \d/i);
  });
});
