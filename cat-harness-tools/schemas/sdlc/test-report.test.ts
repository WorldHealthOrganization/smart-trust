/**
 * `test-report/v1` — per-case verdicts, a per-plan rollup, never a total
 * across plans (bean `ygzh`, owner's `py74` ruling).
 *
 * @module schemas/test-report.test
 */
import { describe, expect, test } from "bun:test";

import { defaultGraphTypologies, graphTypologyIri, graphLayer, isRenderable, processMayWrite } from "../kg/cat-harness";
import { TEST_PLAN_SCHEMA_ID, TestPlanSchema } from "./test-plan";
import {
  TEST_REPORT_SCHEMA_ID,
  type TestCaseVerdict,
  type TestReport,
  TestReportSchema,
  checkAgainstPlan,
  computeRollup,
  rollupPanels,
  testReportPath,
  testReportVerdict,
} from "./test-report";

const tester = { kind: "script" as const, id: "scripts/eval-crdm-detect.ts", actor: "ci-pipeline" };
const v = (result: TestCaseVerdict["result"], extra: Partial<TestCaseVerdict> = {}): TestCaseVerdict => ({
  result,
  reviewer: tester,
  reviewed_at: "2026-10-01T00:00:00Z",
  ...extra,
});

/** A completed report; `cases` drives the rollup unless one is given. */
function report(over: Partial<TestReport> = {}): TestReport {
  const cases = over.cases ?? { a: [v("pass")], b: [v("pass")] };
  return {
    $schema: TEST_REPORT_SCHEMA_ID,
    plan: { id: "crdm-detect", version: "1" },
    sut: { kind: "agent" as const, model: "claude-opus-5", configuration: "harness", actor: "claude-code", version: "2.1.0", reach: "internet" },
    run: { id: "r1", data: "2e3ab7fa317f", process: "cac2af445036" },
    status: "completed",
    started_at: "2026-10-01T00:00:00Z",
    completed_at: "2026-10-01T00:01:00Z",
    rollup: computeRollup(cases),
    ...over,
    cases,
  };
}

describe("a summary may not disagree with its details", () => {
  test("a rollup computed from the cases parses", () => {
    expect(TestReportSchema.safeParse(report()).success).toBe(true);
  });

  test("a rollup that over-counts passes is refused, naming the bucket", () => {
    const r = TestReportSchema.safeParse({ ...report(), rollup: { pass: 3, fail: 0, warn: 0, "n/a": 0, skipped: 0 } });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["rollup", "pass"]);
  });

  test("the rollup counts the CURRENT verdict — a later human fail overrides an earlier script pass", () => {
    const cases = { a: [v("pass"), v("fail", { reviewer: { kind: "human", id: "litlfred" } })], b: [v("pass")] };
    const ok = TestReportSchema.parse(report({ cases }));
    expect(ok.rollup).toEqual({ pass: 1, fail: 1, warn: 0, "n/a": 0, skipped: 0 });
    // Counting every entry instead of the current one is the lie this refuses.
    const counted = { pass: 2, fail: 1, warn: 0, "n/a": 0, skipped: 0 };
    expect(TestReportSchema.safeParse({ ...report({ cases }), rollup: counted }).success).toBe(false);
  });

  test("not-applicable is spelled `n/a`, block-qa's spelling — never py74's `na`", () => {
    expect(TestReportSchema.safeParse(report({ cases: { a: [v("n/a")], b: [v("pass")] } })).success).toBe(true);
    const na = report();
    na.cases.a = [{ ...v("pass"), result: "na" } as unknown as TestCaseVerdict];
    expect(TestReportSchema.safeParse(na).success).toBe(false);
  });

  test("a skip must say why — an unexplained skip cannot be told from a case nobody ran", () => {
    expect(TestReportSchema.safeParse(report({ cases: { a: [v("skipped")], b: [v("pass")] } })).success).toBe(false);
    expect(TestReportSchema.safeParse(report({ cases: { a: [v("skipped", { reason: "needs network" })], b: [v("pass")] } })).success).toBe(true);
  });
});

describe("a rollup per plan, never a total across plans (py74)", () => {
  test("a report names ONE plan; a second plan or a total is refused, not stripped", () => {
    expect(TestReportSchema.safeParse({ ...report(), plans: [{ id: "other", version: "1" }] }).success).toBe(false);
    expect(TestReportSchema.safeParse({ ...report(), total: 2 }).success).toBe(false);
    expect(TestReportSchema.safeParse({ ...report(), rollup: { ...report().rollup, total: 2 } }).success).toBe(false);
  });

  test("rollupPanels gives one panel per report, keyed by plan, and NO total anywhere", () => {
    const a = TestReportSchema.parse(report());
    const b = TestReportSchema.parse({ ...report(), plan: { id: "workflow-complete", version: "3" } });
    const c = TestReportSchema.parse({ ...report(), sut: { kind: "agent", model: "gemini-2.5-pro", configuration: "bare", actor: "gemini-cli", version: "1", reach: "unknown" } });
    const panels = rollupPanels([a, b, c]);
    expect([...panels.keys()].sort()).toEqual(["crdm-detect", "workflow-complete"]);
    // Two systems under the same plan are two panels — summing them certifies neither.
    expect(panels.get("crdm-detect")).toHaveLength(2);
    // The absence is asserted, not trusted (the QaGraphIndex discipline).
    const json = JSON.stringify(Object.fromEntries(panels));
    expect(json).not.toMatch(/"total"/);
    for (const list of panels.values()) for (const p of list) expect(Object.keys(p.rollup).sort()).toEqual(["fail", "n/a", "pass", "skipped", "warn"]);
  });
});

describe("`running` is never a pass", () => {
  const running = () => {
    const r = report({ status: "running" });
    delete r.completed_at;
    return r;
  };

  test("a running report with every case passing so far is `unknown`, not `ok`", () => {
    const r = TestReportSchema.parse(running());
    expect(r.rollup.fail).toBe(0);
    expect(testReportVerdict(r)).toBe("unknown");
  });

  test("a terminal status needs completed_at, and running must not carry one", () => {
    const noEnd = report();
    delete noEnd.completed_at;
    expect(TestReportSchema.safeParse(noEnd).success).toBe(false);
    expect(TestReportSchema.safeParse({ ...running(), completed_at: "2026-10-01T00:01:00Z" }).success).toBe(false);
  });

  test("aborted without a failure is `unknown`; with one it is a `finding`", () => {
    expect(testReportVerdict(TestReportSchema.parse(report({ status: "aborted" })))).toBe("unknown");
    const failed = report({ status: "aborted", cases: { a: [v("fail")], b: [v("pass")] } });
    expect(testReportVerdict(TestReportSchema.parse(failed))).toBe("finding");
  });

  test("a completed report in which nothing passed has shown nothing — `unknown`", () => {
    const r = report({ cases: { a: [v("n/a")], b: [v("skipped", { reason: "offline" })] } });
    expect(testReportVerdict(TestReportSchema.parse(r))).toBe("unknown");
  });

  test("completed, something passed, nothing failed — `ok`; warn does not block", () => {
    expect(testReportVerdict(TestReportSchema.parse(report({ cases: { a: [v("pass")], b: [v("warn")] } })))).toBe("ok");
  });
});

describe("the system under test never writes its own verdict", () => {
  test("a verdict whose reviewer actor is the SUT is refused", () => {
    const r = report({ cases: { a: [v("pass", { reviewer: { kind: "agent", id: "x", actor: "claude-code" } })], b: [v("pass")] } });
    expect(TestReportSchema.safeParse(r).success).toBe(false);
  });

  test("…and so is one whose reviewer id is the SUT", () => {
    const r = report({ cases: { a: [v("pass", { reviewer: { kind: "agent", id: "claude-code" } })], b: [v("pass")] } });
    expect(TestReportSchema.safeParse(r).success).toBe(false);
  });
});

describe("checked against the plan it claims to execute", () => {
  const plan = TestPlanSchema.parse({
    $schema: TEST_PLAN_SCHEMA_ID,
    id: "crdm-detect",
    title: "t",
    status: "active",
    version: "1",
    scope: { kind: "skill", versionRange: "*" },
    requirements: ["req:crdm-detect"],
    testCases: ["a", "b", "c"].map((id) => ({ id, assertions: [{ id: `crit-${id}`, type: "required" }], feature: `${id}.feature` })),
    exitCriteria: { decision: "certify.dmn#Decision_Certify" },
  });

  test("a terminal report that never reached case `c` is a mismatch", () => {
    const m = checkAgainstPlan(TestReportSchema.parse(report()), plan);
    expect(m.map((x) => x.kind)).toEqual(["unexecuted-case"]);
  });

  test("a running report is not yet short of anything", () => {
    const r = report({ status: "running" });
    delete r.completed_at;
    expect(checkAgainstPlan(TestReportSchema.parse(r), plan)).toEqual([]);
  });

  test("a verdict for a case the plan lacks, and a version drift, are both reported", () => {
    const r = report({ plan: { id: "crdm-detect", version: "2" }, cases: { a: [v("pass")], b: [v("pass")], c: [v("pass")], z: [v("pass")] } });
    expect(checkAgainstPlan(TestReportSchema.parse(r), plan).map((x) => x.kind).sort()).toEqual(["plan-version", "unknown-case"]);
  });
});

describe("where it is written", () => {
  test("tests/<plan-id>/<sut>/<run-id>/ on the qa-reports branch", () => {
    expect(testReportPath(TestReportSchema.parse(report()))).toBe("tests/crdm-detect/claude-code/r1/test-report.json");
  });

  test("a segment that could escape its directory is refused", () => {
    const r = TestReportSchema.parse(report());
    expect(() => testReportPath({ ...r, sut: { ...r.sut, actor: "../main" } })).toThrow();
  });
});

describe("the graph typology it is held under", () => {
  test("registered, not renderable, and `state` — a run writes it", () => {
    expect(defaultGraphTypologies.get("test-report")).toBeDefined();
    expect(isRenderable("test-report")).toBe(false);
    expect(graphLayer("test-report")).toBe("state");
    expect(processMayWrite("test-report")).toBe(true);
  });

  test("a different kind from `qa-report` and `test-plan`, on purpose", () => {
    const kinds = ["qa-report", "test-plan", "test-report"].map((k) => graphTypologyIri(k, defaultGraphTypologies.get(k)));
    expect(new Set(kinds).size).toBe(3);
  });
});
