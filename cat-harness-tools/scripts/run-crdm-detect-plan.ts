#!/usr/bin/env bun
/**
 * Execute the `crdm-detect-evaluation` test plan through
 * `test-plan-execution.bpmn`, up to the step no program may take.
 *
 * The plan (cat-harness `test/plans/`) has one case per issue of the
 * adjudicated 27-issue corpus: a REQUIRED assertion that the detector
 * classifies the issue and an INFORMATIVE one that it matches the label. No
 * threshold applies, so a mismatch is a `warn` — recorded, counted into
 * precision and recall, and never a failed case.
 *
 * What this does, in the diagram's order:
 *
 * | step | here |
 * |---|---|
 * | `Call_BeanOpen`, `GW_BeanYours` | {@link openTrackedBean}: claim the plan's existing tracking bean |
 * | `A_Request` … `A_BindData` | load and parse the plan; bind the fixed corpus |
 * | `A_Execute` | run `detect` on every issue; a verdict per case |
 * | `A_WriteRun` | `folio-test-run/v1` (data and process hashed apart) + `test-report/v1` |
 * | `A_ReExecuteSample` | {@link checkSample}: re-run a sample blind to the tester's verdicts |
 * | `GW_ExitCriteria` | the plan's own DMN, fed facts READ OFF the two records |
 *
 * and stops at **`A_RecordCertification`**, a user task the certifier fills
 * under their own name. The instance is saved where `workflow_next` finds it,
 * so the certifier resumes it rather than re-running anything.
 *
 * Usage: `bun run cat-harness-tools/scripts/run-crdm-detect-plan.ts [--no-save]`
 *
 * @module scripts/run-crdm-detect-plan
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { ownDirectoryById } from "../schemas/kg/cat-harness.ts";
import { TestPlanSchema, type TestPlan } from "../schemas/sdlc/test-plan.ts";
import { buildTestRun, UNKNOWN_HASH, type SutRef, type TestRun } from "../schemas/sdlc/test-run.ts";
import {
  TEST_REPORT_SCHEMA_ID,
  TestReportSchema,
  checkAgainstPlan,
  computeRollup,
  testReportPath,
  type TestCaseVerdict,
  type TestReport,
} from "../schemas/sdlc/test-report.ts";
import { detect, type Verdict } from "../src/crdm/detect-signals.ts";
import { loadProcessModel } from "../src/workflow/process-model.ts";
import { complete, enabled, startInstance, type InstanceState } from "../src/workflow/instance.ts";
import { saveInstance } from "../src/workflow/store.ts";
import { completeExitCriteriaGateway, openTrackedBean } from "./test-plan-execution.ts";
import { renderTestReport, testReportBadge } from "./render-test-report.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { harnessRel } from "./lib/harness-layout.ts";

export interface CorpusItem { number: number; title: string; isFeature: boolean; why: string; text: string }

/** The system under test — `cat-harness/scenarios/actors/crdm-detect-signals.json`. */
export const SUT: SutRef = { kind: "skill", actor: "crdm-detect-signals", version: "1", reach: "air-gapped" };

/** The tester: this script, on the CI pipeline's authority — never the system under test. */
export const TESTER = { kind: "script" as const, id: "cat-harness-tools/scripts/run-crdm-detect-plan.ts", actor: "ci-pipeline" };

/** The confusion counts and the three ratios, rounded as the earlier eval recorded them. */
export function measure(corpus: readonly CorpusItem[], outputs: readonly Verdict[]): Record<string, number> {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  corpus.forEach((it, i) => {
    const fires = outputs[i]!.fires;
    if (it.isFeature && fires) tp++;
    else if (it.isFeature) fn++;
    else if (fires) fp++;
    else tn++;
  });
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const r = (n: number) => Number(n.toFixed(4));
  return { population: corpus.length, truePositives: tp, falsePositives: fp, trueNegatives: tn, falseNegatives: fn, precision: r(precision), recall: r(recall), f1: r(f1) };
}

/**
 * One verdict per plan case. `pass` when the classification matches the label,
 * `warn` when it does not (the informative assertion failed, the required one
 * held), and `fail` only when the detector produced no classification at all.
 */
export function verdictsFor(
  plan: TestPlan,
  corpus: readonly CorpusItem[],
  outputs: readonly Verdict[],
  at: string,
): Record<string, TestCaseVerdict[]> {
  const byCase = new Map(corpus.map((it, i) => [`issue-${it.number}`, { it, out: outputs[i] }]));
  const cases: Record<string, TestCaseVerdict[]> = {};
  for (const c of plan.testCases) {
    const hit = byCase.get(c.id);
    if (!hit) {
      cases[c.id] = [{ result: "skipped", reviewer: TESTER, reviewed_at: at, reason: "no corpus item carries this case's issue number" }];
      continue;
    }
    const classifies = hit.out !== undefined && typeof hit.out.fires === "boolean";
    const matches = classifies && hit.out!.fires === hit.it.isFeature;
    cases[c.id] = [{
      result: !classifies ? "fail" : matches ? "pass" : "warn",
      reviewer: TESTER,
      reviewed_at: at,
      assertions: { "crdm-detect-classifies": classifies ? "pass" : "fail", "crdm-detect-matches-label": !classifies ? "n/a" : matches ? "pass" : "warn" },
      evidence: classifies
        ? `fires=${hit.out!.fires} categories=${hit.out!.categories.join("+") || "(none)"} excluded=${hit.out!.excluded}; label=${hit.it.isFeature ? "feature" : "not a feature"}`
        : "no classification",
    }];
  }
  return cases;
}

/**
 * The untainted checker (`A_ReExecuteSample`): re-run every `stride`-th case
 * from the corpus alone — it is handed the inputs and the plan, never the
 * tester's verdicts — and compare its result with the report's. A sample with
 * nothing in it is `unknown`, not agreement.
 */
export function checkSample(
  plan: TestPlan,
  corpus: readonly CorpusItem[],
  report: TestReport,
  stride = 5,
  run: (text: string) => Verdict = detect,
): { checker: "agree" | "disagree" | "unknown"; sampled: string[]; disagreements: string[] } {
  const sampled = corpus.filter((_, i) => i % stride === 0);
  if (sampled.length === 0) return { checker: "unknown", sampled: [], disagreements: [] };
  const ids = new Set(sampled.map((s) => `issue-${s.number}`));
  // Only the sampled cases: `verdictsFor` answers every plan case, and the
  // unsampled ones come back `skipped`, which is not the checker disagreeing.
  const fresh = Object.entries(verdictsFor(plan, sampled, sampled.map((s) => run(s.text)), report.started_at)).filter(([id]) => ids.has(id));
  if (fresh.length === 0) return { checker: "unknown", sampled: [], disagreements: [] };
  const disagreements = fresh
    .filter(([id, v]) => report.cases[id]?.at(-1)?.result !== v[0]!.result)
    .map(([id]) => id);
  return { checker: disagreements.length === 0 ? "agree" : "disagree", sampled: fresh.map(([id]) => id), disagreements };
}

/** The six facts the certification table reads, each read off a record. */
export function exitFacts(plan: TestPlan, run: TestRun, report: TestReport, checker: "agree" | "disagree" | "unknown") {
  return {
    reportStatus: report.status,
    dataHashKnown: run.data.hash !== UNKNOWN_HASH,
    unexecutedCases: checkAgainstPlan(report, plan).filter((m) => m.kind === "unexecuted-case").length,
    checker,
    failedCases: report.rollup.fail,
    passedCases: report.rollup.pass,
  };
}

const PLAN_PATH = join(HARNESS_ROOT, "test", "plans", "crdm-detect-evaluation.test-plan.json");
const CORPUS_REL = "cat-harness-tools/scripts/eval/crdm-detect-corpus.json";

if (import.meta.main) {
  const save = !process.argv.includes("--no-save");
  const checkout = dirname(resolve(HARNESS_ROOT));
  const plan = TestPlanSchema.parse(JSON.parse(readFileSync(PLAN_PATH, "utf-8")));
  const corpus = JSON.parse(readFileSync(join(checkout, CORPUS_REL), "utf-8")) as CorpusItem[];
  const started = new Date();
  const outputs = corpus.map((it) => detect(it.text));

  const run = buildTestRun({
    root: checkout,
    skill: "crdm-detect",
    subject: `plan ${plan.id} v${plan.version} against ${SUT.actor}`,
    dataInputs: [CORPUS_REL],
    processInputs: [
      "cat-harness-tools/scripts/run-crdm-detect-plan.ts",
      "cat-harness-tools/src/crdm/detect-signals.ts",
      // declared-path-literal: provenance records written into the run as repo-relative names; read through the plan path above, not here.
      `cat-harness/${harnessRel("skills/process/crdm/crdm-detect.md")}`,
      "cat-harness/test/plans/crdm-detect-evaluation.test-plan.json",
    ],
    outcome: measure(corpus, outputs),
    cases: corpus.map((it, i) => ({ input: { text: it.text }, output: outputs[i] })),
    plan: { id: plan.id, version: plan.version },
    sut: SUT,
    now: started,
  });
  const cases = verdictsFor(plan, corpus, outputs, started.toISOString());
  const runId = `r-${run.data.hash}-${run.process.hash}`;
  const report = TestReportSchema.parse({
    $schema: TEST_REPORT_SCHEMA_ID,
    plan: run.plan,
    sut: SUT,
    run: { id: runId, data: run.data.hash, process: run.process.hash },
    status: "completed",
    started_at: started.toISOString(),
    completed_at: new Date().toISOString(),
    cases,
    rollup: computeRollup(cases),
  });
  const sample = checkSample(plan, corpus, report);
  const facts = exitFacts(plan, run, report, sample.checker);

  // The working copy, under the harness's declared `qa` tree — recorded on
  // the `qa-reports` branch by `qa:publish`, never committed to main.
  const outDir = join(HARNESS_ROOT, "test", "results", dirname(testReportPath(report)));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "test-run.json"), `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(join(outDir, "test-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  // The page and its badge, beside the records they render: the badge links to
  // the run (ff09 Done-when 2), and the relative links survive `qa:publish`.
  writeFileSync(join(outDir, "badge.svg"), testReportBadge(report));
  writeFileSync(join(outDir, "test-report.md"), renderTestReport(report, run, { exitDecision: plan.exitCriteria.decision }));

  // The process instance, driven as `workflow_complete` would drive it.
  // The diagram from the harness's DECLARED processes graph, never a spelled path.
  // The `sdlc` sub-graph's processes graph, by its declared id (cat-harness#991 step 23.2).
  // declared-path-literal: the fallback only — the directory is read by its declared id `sdlc-processes`; the literal is the convention when the `sdlc` sub-graph is not declared, at the call site so the choice is visible.
  const sdlc = ownDirectoryById(HARNESS_ROOT, "sdlc-processes", harnessRel("sdlc/processes"));
  const model = await loadProcessModel(join(sdlc, "test-plan-execution.bpmn"));
  let state: InstanceState = startInstance(model, { id: `${plan.id}-${runId}`, subject: `${plan.id}@${plan.version} vs ${SUT.actor}`, bean: "folio-assistant-ff09" });
  // The bean is opened first, in bean-open.bpmn (bean `m8gz`); `ff09` exists and is this runner's.
  state = openTrackedBean(model, state, { exists: true, actor: TESTER.actor });
  const notes: Record<string, string> = {
    A_Request: `certify ${SUT.actor} against ${plan.id} v${plan.version}`,
    A_ResolvePlan: `cat-harness/test/plans/crdm-detect-evaluation.test-plan.json parses; ${plan.testCases.length} cases`,
    A_BindData: `fixed: ${CORPUS_REL} (data ${run.data.hash})`,
    A_Execute: `${Object.keys(cases).length} cases: ${JSON.stringify(report.rollup)}`,
    A_WriteRun: `run ${runId} → ${join("test/results", dirname(testReportPath(report)))}`,
    A_ReExecuteSample: `checker ${sample.checker} on ${sample.sampled.length} sampled case(s)${sample.disagreements.length ? `; disagrees on ${sample.disagreements.join(", ")}` : ""}`,
  };
  for (const step of Object.keys(notes)) {
    const at = enabled(model, state).map((e) => e.node);
    if (!at.includes(step)) throw new Error(`expected ${step} to be enabled, found ${at.join(", ") || "nothing"}`);
    state = complete(model, state, step, { actor: TESTER.actor, note: notes[step] });
  }
  state = await completeExitCriteriaGateway(model, state, plan, facts, [HARNESS_ROOT, sdlc], { actor: TESTER.actor });
  const next = enabled(model, state).map((e) => e.node);

  const o = run.outcome as Record<string, number>;
  console.log(`plan ${plan.id} v${plan.version} vs ${SUT.actor} — run ${runId}`);
  console.log(`  cases ${JSON.stringify(report.rollup)}`);
  console.log(`  precision ${o.precision}  recall ${o.recall}  F1 ${o.f1}  (TP ${o.truePositives} FP ${o.falsePositives} TN ${o.trueNegatives} FN ${o.falseNegatives}) — recorded, no threshold`);
  console.log(`  checker ${sample.checker} on ${sample.sampled.length} sampled case(s)`);
  console.log(`  exit facts ${JSON.stringify(facts)}`);
  console.log(`  now enabled: ${next.join(", ") || "nothing"}`);
  console.log(`  run + report → ${outDir}`);
  // The diagram is the harness's, a sibling of this layer, so `saveInstance`
  // would keep its absolute path (it relativises only inside the repository).
  // Recorded relative to this layer instead: no machine's path is committed.
  if (save) console.log(`  instance → ${saveInstance(TOOLS_ROOT, { ...state, source: relative(TOOLS_ROOT, state.source) })}`);
  if (next.includes("A_RecordCertification")) {
    console.log("\nA_RecordCertification is a USER TASK: the certifier records the decision under their own name.");
  }
}
