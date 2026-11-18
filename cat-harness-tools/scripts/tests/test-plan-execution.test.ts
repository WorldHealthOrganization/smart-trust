/**
 * The test process, end to end — bean `3o5b`, arc `3fva`, proposal §3.2.
 *
 * Four things are held here:
 *
 * 1. `test-plan-execution.bpmn` RUNS: the bean is opened through
 *    `bean-open.bpmn`, a tiny fixture plan is executed against
 *    a fixture system under test, its run and report are built with the real
 *    schemas, the certification gateway is fed facts READ OFF those records,
 *    the call into `qa-report-signing.bpmn` is driven through its own DMN
 *    gateway, the bean is closed through `bean-close.bpmn`, and the instance
 *    completes — with the role each step reports
 *    being the lane's declared role. The same calls the `workflow_start` /
 *    `workflow_next` / `workflow_complete` MCP tools make, minus the GitHub
 *    authentication that wraps them.
 * 2. The certification DMN's three outcomes, and that `undetermined` is
 *    reached by every could-not-determine fact and never by a failure alone.
 * 3. The system-under-test actor facet.
 * 4. The four kg-audit criteria in `scripts/test-plan-audit.ts`.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { loadProcessModel, type ProcessModel } from "../../src/workflow/process-model";
import { complete, enabled, startInstance, type InstanceState } from "../../src/workflow/instance";
import { evaluate, loadDecisionTable } from "../../src/workflow/decision-table";
import { readRoleGraph, readActors } from "../../schemas/process/role-graph.ts";
import { ActorDefinitionSchema, sutRefFor } from "../../schemas/kg/skill-package.ts";
import { TestPlanSchema, type TestPlan } from "../../schemas/sdlc/test-plan.ts";
import { buildTestRun, UNKNOWN_HASH, type TestRun } from "../../schemas/sdlc/test-run.ts";
import {
  TEST_REPORT_SCHEMA_ID,
  TestReportSchema,
  checkAgainstPlan,
  computeRollup,
  type TestCaseVerdict,
  type TestReport,
} from "../../schemas/sdlc/test-report.ts";
import { auditTestPlans, dmnRefResolves, type SutActor } from "../test-plan-audit";
import { openTrackedBean } from "../test-plan-execution";
import { KG_CRITERIA_BY_ID } from "../../schemas/sdlc/kg-qa.ts";
import { ownDirectoryById } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { drainSubprocess } from "./helpers.ts";
import { harnessLayoutText, harnessRel } from "../lib/harness-layout.ts";

const ROOT = resolve(HARNESS_ROOT);
// The `sdlc` sub-graph's processes graph, by its declared id (cat-harness#991 step 23.2).
// declared-path-literal: the fallback only — the directory is read by its declared id `sdlc-processes`.
const WF = ownDirectoryById(ROOT, "sdlc-processes", harnessRel("sdlc/processes"));
const DMN = join(WF, "decisions/test-certification.dmn");
// The fixture names its exit DMN in the sub-graph layout; respelled for the
// harness this checkout has (transitional, cat-harness#991 step 23).
const FIXTURE = join(mkdtempSync(join(tmpdir(), "tiny-plan-")), "tiny.test-plan.json");
writeFileSync(FIXTURE, harnessLayoutText(readFileSync(join(import.meta.dir, "fixtures/test-plan-execution/tiny.test-plan.json"), "utf-8"), ROOT));

const plan: TestPlan = TestPlanSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf-8")));

/** The fixture system under test: a machine, declared testable as a `tool`. */
const sutActor = ActorDefinitionSchema.parse({
  id: "fixture-workflow-tool",
  title: "Fixture: the workflow_complete tool",
  kind: "system",
  description: "A fixture actor for this test only.",
  capabilities: [],
  reach: "air-gapped",
  systemUnderTest: { kind: "tool", version: "0.1.0" },
});
const actors: SutActor[] = [sutActor];

const tester = { kind: "script" as const, id: "scripts/tests/test-plan-execution.test.ts", actor: "ci-pipeline" };
const verdict = (result: TestCaseVerdict["result"], extra: Partial<TestCaseVerdict> = {}): TestCaseVerdict => ({
  result,
  reviewer: tester,
  reviewed_at: "2026-10-01T00:00:00Z",
  ...extra,
});

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "test-plan-execution-"));
  writeFileSync(join(dir, "data.json"), JSON.stringify({ steps: 1 }));
  writeFileSync(join(dir, "runner.ts"), "// the runner — the process half of the run\n");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Execute the fixture plan: a run with both hashes and a report over every case. */
function executePlan(cases: Record<string, TestCaseVerdict[]>): { run: TestRun; report: TestReport } {
  const sut = sutRefFor(sutActor)!;
  const run = buildTestRun({
    root: dir,
    skill: "test-plan-execution",
    subject: `plan ${plan.id} v${plan.version} against ${sut.actor}`,
    dataInputs: ["data.json"],
    processInputs: ["runner.ts"],
    outcome: {},
    plan: { id: plan.id, version: plan.version },
    sut,
    now: new Date("2026-10-01T00:00:00Z"),
  });
  const report = TestReportSchema.parse({
    $schema: TEST_REPORT_SCHEMA_ID,
    plan: run.plan,
    sut: run.sut,
    run: { id: "r1", data: run.data.hash, process: run.process.hash },
    status: "completed",
    started_at: "2026-10-01T00:00:00Z",
    completed_at: "2026-10-01T00:01:00Z",
    cases,
    rollup: computeRollup(cases),
  });
  return { run, report };
}

/** The six facts the certification table reads, each read off a record. */
function factsFrom(run: TestRun, report: TestReport, checker: "agree" | "disagree" | "unknown") {
  return {
    reportStatus: report.status,
    dataHashKnown: run.data.hash !== UNKNOWN_HASH,
    unexecutedCases: checkAgainstPlan(report, plan).filter((m) => m.kind === "unexecuted-case").length,
    checker,
    failedCases: report.rollup.fail,
    passedCases: report.rollup.pass,
  };
}

const allPass = () => ({ "refuses-unenabled-step": [verdict("pass")], "advances-enabled-step": [verdict("pass")] });

describe("test-plan-execution.bpmn runs end to end on a fixture plan", () => {
  let model: ProcessModel;
  beforeAll(async () => {
    model = await loadProcessModel(join(WF, "test-plan-execution.bpmn"));
  });
  const at = (s: InstanceState) => enabled(model, s).map((e) => e.node);

  /** workflow_start → workflow_next/complete up to the certification gateway. */
  function toGateway(id: string): InstanceState {
    const s = startInstance(model, { id, subject: `${plan.id}@${plan.version}`, bean: "folio-assistant-3o5b" });
    // The bean is opened first, in bean-open.bpmn: the claim is drawn there and nowhere else (bean `m8gz`).
    expect(at(s)).toEqual(["Open_CheckExists"]);
    openTrackedBean(model, s, { exists: true, actor: "fixture" });
    for (const step of ["A_Request", "A_ResolvePlan", "A_BindData", "A_Execute", "A_WriteRun", "A_ReExecuteSample"]) {
      expect(at(s)).toEqual([step]);
      complete(model, s, step, { actor: "fixture" });
    }
    expect(at(s)).toEqual(["GW_ExitCriteria"]);
    return s;
  }

  test("every lane binds its declared role, and each step reports it (workflow_next)", () => {
    const roles = readRoleGraph(join(ROOT, "scenarios"))!;
    const s = startInstance(model, { id: "roles", subject: "fixture" });
    openTrackedBean(model, s, { exists: false });
    const seen: Record<string, string | undefined> = {};
    for (const step of ["A_Request", "A_ResolvePlan", "A_BindData", "A_Execute", "A_WriteRun", "A_ReExecuteSample"]) {
      const e = enabled(model, s, roles)[0]!;
      seen[e.node] = e.role;
      complete(model, s, step);
    }
    expect(seen).toEqual({
      A_Request: "test-requester",
      A_ResolvePlan: "tester",
      A_BindData: "tester",
      A_Execute: "tester",
      A_WriteRun: "tester",
      A_ReExecuteSample: "untainted-checker",
    });
    expect(enabled(model, s, roles)[0]?.role).toBe("certifier");
  });

  test("every activity names a skill and a bean op; the gateway is computed", () => {
    const beanCalls = ["Process_BeanOpen", "Process_BeanClose"];
    for (const n of model.nodes.values()) {
      if (n.kind !== "activity") continue;
      expect(n.skills.length).toBeGreaterThan(0);
      // The bean's claim, resolve and archive are drawn once, inside
      // bean-open.bpmn and bean-close.bpmn (bean `m8gz`); a call into either
      // IS that op and carries none of its own.
      if (beanCalls.includes(n.calledElement ?? "")) continue;
      expect(n.workPlanOp).toBeDefined();
    }
    // Opened first, and closed once: every outcome runs the one bean-close
    // call, and "How did it end?" after it routes to that outcome's own end.
    expect(model.nodes.get("Call_BeanOpen")?.calledElement).toBe("Process_BeanOpen");
    expect(model.nodes.get("Call_BeanClose")?.calledElement).toBe("Process_BeanClose");
    const into = (id: string) => model.nodes.get(id)!.incoming.map((f) => model.flows.get(f)!.from);
    expect(into("GW_BeanClosedHow")).toEqual(["Call_BeanClose"]);
    for (const end of ["End_Certified", "End_Refused", "End_Undetermined"]) {
      expect([end, into(end)]).toEqual([end, ["GW_BeanClosedHow"]]);
    }
    expect(model.decisions.get("GW_ExitCriteria")?.id).toBe("Decision_TestCertification");
    expect(model.nodes.get("Call_Sign")?.calledElement).toBe("Process_QaReportSigning");
  });

  test("certified: the run's facts certify, the signing subprocess runs, the instance completes", () => {
    const { run, report } = executePlan(allPass());
    const s = toGateway("certified");
    complete(model, s, "GW_ExitCriteria", { facts: factsFrom(run, report, "agree") });
    expect(at(s)).toEqual(["A_RecordCertification"]);
    complete(model, s, "A_RecordCertification");

    // Inside qa-report-signing.bpmn: the SUT is air-gapped, but the SIGNER's
    // reach is what routes. Here the signer is unknown → the human route.
    expect(at(s)).toEqual(["Task_BuildRun"]);
    complete(model, s, "Task_BuildRun");
    complete(model, s, "Task_ResolveReach");
    complete(model, s, "Gateway_SigningRoute", { facts: { reach: "unknown", signingApiConfigured: true } });
    expect(at(s)).toEqual(["Task_HumanSign"]);
    complete(model, s, "Task_HumanSign");
    complete(model, s, "Task_RecordAttestation");
    // d6bw: the signed report is stored on the qa-reports branch before the
    // subprocess returns.
    expect(at(s)).toEqual(["Task_StoreSigned"]);
    complete(model, s, "Task_StoreSigned");

    expect(at(s)).toEqual(["A_FileCertification"]);
    complete(model, s, "A_FileCertification");
    // bean-close.bpmn: an end named for success closes the bean as `done`.
    expect(at(s)).toEqual(["Close_Outcome"]);
    drainSubprocess(model, s, "Call_BeanClose", { Close_Outcome: "done" });
    complete(model, s, "GW_BeanClosedHow", { outcome: "certified" });
    expect(s.status).toBe("completed");
    expect(s.history.map((h) => h.node)).toContain("End_Certified");
  });

  test("refused: a failed case ends at the refusal and signs nothing", () => {
    const { run, report } = executePlan({ ...allPass(), "advances-enabled-step": [verdict("fail")] });
    const s = toGateway("refused");
    complete(model, s, "GW_ExitCriteria", { facts: factsFrom(run, report, "agree") });
    expect(at(s)).toEqual(["A_RecordRefusal"]);
    complete(model, s, "A_RecordRefusal");
    // bean-close.bpmn: an end named for a refusal closes the bean as `not wanted`.
    drainSubprocess(model, s, "Call_BeanClose", { Close_Outcome: "not wanted" });
    complete(model, s, "GW_BeanClosedHow", { outcome: "refused" });
    expect(s.status).toBe("completed");
    expect(s.history.map((h) => h.node)).not.toContain("Call_Sign");
  });

  test("undetermined: a checker that disagrees decides nothing, even on an all-pass report", () => {
    const { run, report } = executePlan(allPass());
    const s = toGateway("undetermined");
    complete(model, s, "GW_ExitCriteria", { facts: factsFrom(run, report, "disagree") });
    expect(at(s)).toEqual(["A_RecordUndetermined"]);
    complete(model, s, "A_RecordUndetermined");
    // bean-close.bpmn: an undetermined end hands the bean back as `blocked`.
    drainSubprocess(model, s, "Call_BeanClose", { Close_Outcome: "blocked" });
    complete(model, s, "GW_BeanClosedHow", { outcome: "undetermined" });
    expect(s.status).toBe("completed");
    expect(s.children?.Call_BeanClose?.history.map((h) => h.node)).toContain("Close_RecordBlocker");
  });

  test("the gateway is computed: asserting the branch is refused", () => {
    const s = toGateway("asserted");
    expect(() => complete(model, s, "GW_ExitCriteria", { outcome: "certified" })).toThrow();
  });

  test("a bean someone else holds stops the run before the request (bean-open.bpmn)", () => {
    const s = startInstance(model, { id: "not-yours", subject: "fixture" });
    drainSubprocess(model, s, "Call_BeanOpen", { Open_Exists: "yes", Open_Owner: "someone else's" });
    complete(model, s, "GW_BeanYours", { outcome: "not yours" });
    expect(s.status).toBe("completed");
    const opened = s.children?.Call_BeanOpen?.history.map((h) => h.node);
    expect(opened).toContain("Open_LeaveAlone");
    expect(opened).not.toContain("Open_Claim");
    expect(s.history.map((h) => h.node)).toEqual(["Start_Request", "Call_BeanOpen", "GW_BeanYours", "End_BeanNotYours"]);
  });

  test("a step out of order is refused (what workflow_complete enforces)", () => {
    const s = startInstance(model, { id: "order", subject: "fixture" });
    expect(() => complete(model, s, "A_Execute")).toThrow();
  });
});

describe("test-certification.dmn — three outcomes, and the third is reached honestly", () => {
  const base = {
    reportStatus: "completed",
    dataHashKnown: true,
    unexecutedCases: 0,
    checker: "agree",
    failedCases: 0,
    passedCases: 2,
  };
  const outcome = async (over: Partial<typeof base>) =>
    evaluate(await loadDecisionTable(DMN, "Decision_TestCertification"), { ...base, ...over }).outputs.outcome;

  test("complete, hashed, agreed, nothing failed, something passed → certified", async () => {
    expect(await outcome({})).toBe("certified");
  });
  test("a failure in a trusted run → refused", async () => {
    expect(await outcome({ failedCases: 1 })).toBe("refused");
  });
  test.each([
    ["running", { reportStatus: "running" }],
    ["aborted", { reportStatus: "aborted" }],
    ["data hash unknown", { dataHashKnown: false }],
    ["an unexecuted case", { unexecutedCases: 1 }],
    ["checker disagrees", { checker: "disagree" }],
    ["checker could not run", { checker: "unknown" }],
    ["nothing passed", { passedCases: 0 }],
  ] as const)("%s → undetermined", async (why, over) => {
    expect(await outcome(over)).toBe("undetermined");
  });
  test("could-not-determine outranks a failure: a failure in an untrusted run is not yet a refusal", async () => {
    expect(await outcome({ failedCases: 3, dataHashKnown: false })).toBe("undetermined");
    expect(await outcome({ failedCases: 3, checker: "disagree" })).toBe("undetermined");
  });
});

describe("the system-under-test actor facet", () => {
  test("sutRefFor reads reach from the actor, and absent reach is unknown", () => {
    expect(sutRefFor(sutActor)).toEqual({ kind: "tool", actor: "fixture-workflow-tool", version: "0.1.0", reach: "air-gapped" });
    // FR-002: an agent's ref carries the model and configuration the run used, and no other kind's does.
    const agent = { id: "a", systemUnderTest: { kind: "agent" as const, version: "1" } };
    expect(sutRefFor(agent, undefined, { model: "claude-opus-5", configuration: "bare" })).toMatchObject({ kind: "agent", model: "claude-opus-5", configuration: "bare" });
    expect(sutRefFor(sutActor, undefined, { model: "claude-opus-5", configuration: "bare" })).not.toHaveProperty("model");
    expect(sutRefFor({ id: "x", systemUnderTest: { kind: "agent", version: "1" } }, undefined, { model: "m", configuration: "bare" })?.reach).toBe("unknown");
    expect(() => sutRefFor({ id: "x", systemUnderTest: { kind: "agent", version: "1" } })).toThrow(/FR-002/);
    expect(sutRefFor({ id: "y" })).toBeUndefined();
  });
  test("the kind is the closed SUT list", () => {
    const r = ActorDefinitionSchema.safeParse({ ...sutActor, systemUnderTest: { kind: "website", version: "1" } });
    expect(r.success).toBe(false);
  });
  test("a person cannot be a system under test", () => {
    const r = ActorDefinitionSchema.safeParse({ ...sutActor, kind: "person" });
    expect(r.success).toBe(false);
  });
  test("reach is not restated on the facet", () => {
    const r = ActorDefinitionSchema.safeParse({ ...sutActor, systemUnderTest: { kind: "tool", version: "1", reach: "internet" } });
    expect(r.success).toBe(false);
  });
  test("the actor registry reads the facet, and refuses it on a person", () => {
    const d = join(dir, "actors");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "a.json"), JSON.stringify({ id: "a", title: "A", kind: "agent", capabilities: [], systemUnderTest: { kind: "skill", version: "2" } }));
    expect(readActors(d).find((x) => x.id === "a")?.systemUnderTest).toEqual({ kind: "skill", version: "2" });
    writeFileSync(join(d, "b.json"), JSON.stringify({ id: "b", title: "B", kind: "person", capabilities: [], systemUnderTest: { kind: "skill", version: "2" } }));
    expect(() => readActors(d)).toThrow(/cannot carry systemUnderTest/);
    rmSync(d, { recursive: true, force: true });
  });
  test("the roles exist with the kinds the process needs", () => {
    const g = readRoleGraph(join(ROOT, "scenarios"))!;
    const role = (id: string) => g.roles.find((r) => r.id === id)!;
    expect(role("certifier").inherits).toEqual(["stakeholder"]);
    expect(role("certifier").judgementOnly).toBeUndefined();
    expect(role("tester").actorKinds).toContain("system");
    expect(role("untainted-checker").skills).toContain("untainted-verification");
  });
});

describe("kg-audit: the four test-plan criteria", () => {
  let fx: string;
  beforeAll(() => {
    fx = mkdtempSync(join(tmpdir(), "test-plan-audit-"));
  });
  afterAll(() => rmSync(fx, { recursive: true, force: true }));

  const write = (name: string, value: unknown): string => {
    const p = join(fx, name);
    writeFileSync(p, JSON.stringify(value));
    return p;
  };
  const audit = (files: { plans?: string[]; runs?: string[]; reports?: string[] }, as: SutActor[] = actors) =>
    auditTestPlans({ root: ROOT, plans: files.plans ?? [], runs: files.runs ?? [], reports: files.reports ?? [], actors: as });

  test("every criterion is registered", () => {
    for (const id of ["test-plan-resolves", "test-case-executed-or-skipped", "test-data-hash-present", "test-sut-not-self-judged"]) {
      expect(KG_CRITERIA_BY_ID[id]).toBeDefined();
    }
  });

  test("nothing to judge is n/a, never a pass over nothing", () => {
    const r = audit({});
    for (const e of Object.values(r)) expect(e.result).toBe("n/a");
  });

  test("a clean plan, run and report pass all four", () => {
    const { run, report } = executePlan(allPass());
    const r = audit({ plans: [FIXTURE], runs: [write("ok.test-run.json", run)], reports: [write("ok.report.json", report)] });
    for (const [id, e] of Object.entries(r)) expect([id, e.result]).toEqual([id, "pass"]);
  });

  test("the plan's exit DMN resolves from the instance root", () => {
    expect(dmnRefResolves(plan.exitCriteria.decision, [ROOT])).toBe(true);
    // declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
    expect(dmnRefResolves(`${harnessRel("sdlc/processes/decisions/test-certification.dmn")}#Decision_Nope`, [ROOT])).toBe(false);
  });

  test("test-plan-resolves: a dangling plan, an undeclared SUT, and a kind mismatch", () => {
    const { run } = executePlan(allPass());
    const dangling = write("dangling.test-run.json", { ...run, plan: { id: "no-such-plan", version: "1" } });
    expect(audit({ plans: [FIXTURE], runs: [dangling] })["test-plan-resolves"].result).toBe("fail");
    const ok = write("ok2.test-run.json", run);
    expect(audit({ plans: [FIXTURE], runs: [ok] }, [])["test-plan-resolves"].findings[0]?.detail).toMatch(/not a declared actor/);
    const agent: SutActor = { id: sutActor.id, systemUnderTest: { kind: "agent", version: "1" } };
    expect(audit({ plans: [FIXTURE], runs: [ok] }, [agent])["test-plan-resolves"].findings[0]?.detail).toMatch(/scopes a `tool`/);
    const noFacet: SutActor = { id: sutActor.id };
    expect(audit({ plans: [FIXTURE], runs: [ok] }, [noFacet])["test-plan-resolves"].findings[0]?.detail).toMatch(/no `systemUnderTest` facet/);
    const badDmn = write("bad-dmn.test-plan.json", { ...JSON.parse(readFileSync(FIXTURE, "utf-8")), exitCriteria: { decision: "nowhere.dmn#D" } });
    expect(audit({ plans: [badDmn] })["test-plan-resolves"].findings[0]?.detail).toMatch(/does not resolve to a decision/);
  });

  test("test-case-executed-or-skipped: a missing case fails; a skip with a reason passes", () => {
    const missing = executePlan({ "refuses-unenabled-step": [verdict("pass")] }).report;
    expect(audit({ plans: [FIXTURE], reports: [write("missing.json", missing)] })["test-case-executed-or-skipped"].result).toBe("fail");
    const skipped = executePlan({ ...allPass(), "advances-enabled-step": [verdict("skipped", { reason: "depends on a live server" })] }).report;
    expect(audit({ plans: [FIXTURE], reports: [write("skipped.json", skipped)] })["test-case-executed-or-skipped"].result).toBe("pass");
    // A report whose plan cannot be followed was not checked: unknown, not pass.
    expect(audit({ reports: [write("orphan.json", skipped)] })["test-case-executed-or-skipped"].result).toBe("unknown");
  });

  test("test-data-hash-present: an unknown data hash fails, on the run and on the report", () => {
    const { run, report } = executePlan(allPass());
    const r = audit({
      plans: [FIXTURE],
      runs: [write("nohash.test-run.json", { ...run, data: { ...run.data, hash: UNKNOWN_HASH } })],
      reports: [write("nohash.json", { ...report, run: { ...report.run, data: UNKNOWN_HASH } })],
    });
    expect(r["test-data-hash-present"].result).toBe("fail");
    expect(r["test-data-hash-present"].findings).toHaveLength(2);
  });

  test("test-sut-not-self-judged: a verdict by the system under test is found by name", () => {
    const { report } = executePlan(allPass());
    const self = {
      ...report,
      cases: { ...report.cases, "advances-enabled-step": [verdict("pass", { reviewer: { kind: "script", id: "x", actor: sutActor.id } })] },
    };
    const r = audit({ plans: [FIXTURE], reports: [write("self.json", self)] });
    expect(r["test-sut-not-self-judged"].result).toBe("fail");
    expect(r["test-sut-not-self-judged"].findings[0]?.where).toMatch(/advances-enabled-step/);
    // ...and the schema's own refusal is not reported a second time as an anonymous parse failure.
    expect(r["test-plan-resolves"].result).toBe("pass");
  });
});
