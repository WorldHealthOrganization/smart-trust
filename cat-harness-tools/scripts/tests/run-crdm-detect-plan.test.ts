/**
 * Dogfood test plan #1, executed — bean `folio-assistant-ff09`.
 *
 * Held: no threshold (owner, 2026-10-11, option 4) means a mismatch is a
 * `warn` and never a failed case; the untainted checker compares only what it
 * sampled; and the process stops at the certifier's user task rather than
 * certifying on its own.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ownDirectoryById } from "../../schemas/kg/cat-harness.ts";
import { TestPlanSchema } from "../../schemas/sdlc/test-plan.ts";
import { TEST_REPORT_SCHEMA_ID, TestReportSchema, computeRollup } from "../../schemas/sdlc/test-report.ts";
import { detect } from "../../src/crdm/detect-signals.ts";
import { loadProcessModel } from "../../src/workflow/process-model.ts";
import { complete, enabled, startInstance } from "../../src/workflow/instance.ts";
import { completeExitCriteriaGateway, openTrackedBean } from "../test-plan-execution.ts";
import { SUT, TESTER, checkSample, exitFacts, measure, verdictsFor, type CorpusItem } from "../run-crdm-detect-plan.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";
import { harnessRel } from "../lib/harness-layout.ts";

const plan = TestPlanSchema.parse(JSON.parse(readFileSync(join(HARNESS_ROOT, "test", "plans", "crdm-detect-evaluation.test-plan.json"), "utf-8")));
const corpus = JSON.parse(readFileSync(join(TOOLS_ROOT, "scripts", "eval", "crdm-detect-corpus.json"), "utf-8")) as CorpusItem[];
const outputs = corpus.map((it) => detect(it.text));
const AT = "2026-10-11T08:00:00Z";
// The `sdlc` sub-graph's processes graph, by its declared id, as the runner asks it.
// Resolved on first use, not at module scope: a throw from a malformed
// declaration would otherwise abort the module and surface elsewhere
// (check:module-scope-resolution, bean `95s1`).
// declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
const sdlc = (): string => ownDirectoryById(HARNESS_ROOT, "sdlc-processes", harnessRel("sdlc/processes"));

const reportFor = (cases: ReturnType<typeof verdictsFor>) =>
  TestReportSchema.parse({
    $schema: TEST_REPORT_SCHEMA_ID,
    plan: { id: plan.id, version: plan.version },
    sut: SUT,
    run: { id: "r-test", data: "d", process: "p" },
    status: "completed",
    started_at: AT,
    completed_at: AT,
    cases,
    rollup: computeRollup(cases),
  });

describe("the plan and the corpus agree", () => {
  test("one case per issue, and every case is answered", () => {
    expect(plan.testCases.length).toBe(corpus.length);
    const cases = verdictsFor(plan, corpus, outputs, AT);
    expect(Object.keys(cases).sort()).toEqual(plan.testCases.map((c) => c.id).sort());
  });

  test("the measurement is the one the earlier eval recorded", () => {
    const m = measure(corpus, outputs);
    expect(m).toMatchObject({ population: 27, truePositives: 21, falsePositives: 1, trueNegatives: 4, falseNegatives: 1 });
  });
});

describe("no threshold — a mismatch is recorded, never a failure", () => {
  test("mismatches are `warn`, so nothing fails and the two numbers still count them", () => {
    const r = reportFor(verdictsFor(plan, corpus, outputs, AT));
    expect(r.rollup.fail).toBe(0);
    expect(r.rollup.warn).toBe(2);
    expect(r.rollup.pass).toBe(25);
  });

  test("FALSIFICATION: a detector that gives no classification FAILS the case — the required assertion", () => {
    const broken = outputs.map((o, i) => (i === 0 ? (undefined as unknown as typeof o) : o));
    const cases = verdictsFor(plan, corpus, broken, AT);
    expect(cases[`issue-${corpus[0]!.number}`]![0]!.result).toBe("fail");
  });

  test("the tester is never the system under test", () => {
    expect(TESTER.actor).not.toBe(SUT.actor);
    expect(TESTER.id).not.toBe(SUT.actor);
  });
});

describe("the untainted checker", () => {
  const report = reportFor(verdictsFor(plan, corpus, outputs, AT));

  test("agrees on a faithful re-execution, comparing only what it sampled", () => {
    const s = checkSample(plan, corpus, report);
    expect(s.checker).toBe("agree");
    expect(s.sampled.length).toBe(Math.ceil(corpus.length / 5));
  });

  test("FALSIFICATION: a re-execution that classifies differently disagrees", () => {
    const s = checkSample(plan, corpus, report, 5, (t) => ({ ...detect(t), fires: !detect(t).fires }));
    expect(s.checker).toBe("disagree");
    expect(s.disagreements.length).toBeGreaterThan(0);
  });

  test("an empty sample is `unknown`, never agreement", () => {
    expect(checkSample(plan, [], report).checker).toBe("unknown");
  });
});

describe("through test-plan-execution.bpmn", () => {
  test("the plan's own DMN routes to the CERTIFIER's user task — the process does not certify itself", async () => {
    const model = await loadProcessModel(join(sdlc(), "test-plan-execution.bpmn"));
    let s = startInstance(model, { id: "ff09-test", subject: plan.id });
    // The bean is opened first, in bean-open.bpmn (bean `m8gz`), as the runner opens `ff09`.
    s = openTrackedBean(model, s, { exists: true, actor: TESTER.actor });
    for (const step of ["A_Request", "A_ResolvePlan", "A_BindData", "A_Execute", "A_WriteRun", "A_ReExecuteSample"]) {
      s = complete(model, s, step, { actor: TESTER.actor });
    }
    const report = reportFor(verdictsFor(plan, corpus, outputs, AT));
    const run = { data: { hash: "d", inputs: ["x"] } } as unknown as Parameters<typeof exitFacts>[1];
    s = await completeExitCriteriaGateway(model, s, plan, exitFacts(plan, run, report, "agree"), [HARNESS_ROOT, sdlc()]);
    expect(enabled(model, s).map((e) => e.node)).toEqual(["A_RecordCertification"]);
  });

  test("FALSIFICATION: a checker that disagrees is undetermined, not certified", async () => {
    const model = await loadProcessModel(join(sdlc(), "test-plan-execution.bpmn"));
    let s = startInstance(model, { id: "ff09-test-2", subject: plan.id });
    // The bean is opened first, in bean-open.bpmn (bean `m8gz`), as the runner opens `ff09`.
    s = openTrackedBean(model, s, { exists: true, actor: TESTER.actor });
    for (const step of ["A_Request", "A_ResolvePlan", "A_BindData", "A_Execute", "A_WriteRun", "A_ReExecuteSample"]) {
      s = complete(model, s, step, { actor: TESTER.actor });
    }
    const report = reportFor(verdictsFor(plan, corpus, outputs, AT));
    const run = { data: { hash: "d", inputs: ["x"] } } as unknown as Parameters<typeof exitFacts>[1];
    s = await completeExitCriteriaGateway(model, s, plan, exitFacts(plan, run, report, "disagree"), [HARNESS_ROOT, sdlc()]);
    expect(enabled(model, s).map((e) => e.node)).toEqual(["A_RecordUndetermined"]);
  });
});
