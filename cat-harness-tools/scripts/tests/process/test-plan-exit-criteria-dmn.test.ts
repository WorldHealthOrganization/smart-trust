/**
 * Test suite for PER-PLAN exit criteria DMN resolution (bean `folio-assistant-4iey`).
 *
 * Requirements:
 * 1. A fixture plan with its own custom DMN table routes by that table's rules.
 * 2. An unresolvable DMN table yields undetermined/could-not-determine (state: "unknown")
 *    and NEVER silently falls back to the default table.
 * 3. The `test-plan-exit-criteria-resolves` audit criterion in `schemas/sdlc/kg-qa.ts` is
 *    registered (scope: instance, applies: ["graph"], severity: "major"), vacuity-guarded
 *    (unknown if 0 plans checked), and flags unresolvable DMN tables as major findings.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { loadProcessModel, type ProcessModel } from "../../../src/workflow/process-model.js";
import { complete, enabled, startInstance, type InstanceState } from "../../../src/workflow/instance.js";
import { TestPlanSchema, type TestPlan } from "../../../schemas/sdlc/test-plan.js";
import { KG_CRITERIA_BY_ID } from "../../../schemas/sdlc/kg-qa.js";
import {
  auditTestPlanExitCriteria,
} from "../../test-plan-audit.js";
import {
  resolvePlanExitCriteriaDmn,
  evaluatePlanExitCriteria,
  completeExitCriteriaGateway,
  openTrackedBean,
} from "../../test-plan-execution.js";
import { ownDirectoryById } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { harnessLayoutText, harnessRel } from "../../lib/harness-layout.ts";

const ROOT = resolve(HARNESS_ROOT);
// The `sdlc` sub-graph's processes graph, by its declared id (cat-harness#991 step 23.2).
// declared-path-literal: the fallback only — the directory is read by its declared id `sdlc-processes`.
const WF = ownDirectoryById(ROOT, "sdlc-processes", harnessRel("sdlc/processes"));
const FIXTURE_TINY = join(import.meta.dir, "../fixtures/test-plan-execution/tiny.test-plan.json");

const CUSTOM_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             id="Definitions_CustomCertification"
             name="Custom test certification"
             namespace="https://litlfred.github.io/folio-assistant/decisions">
  <decision id="Decision_CustomCertification" name="Custom exit criteria">
    <decisionTable id="Table_CustomCertification" hitPolicy="FIRST">
      <input id="In_Status" label="test report status">
        <inputExpression id="Expr_Status" typeRef="string"><text>reportStatus</text></inputExpression>
      </input>
      <input id="In_DataHash" label="data hash known">
        <inputExpression id="Expr_DataHash" typeRef="boolean"><text>dataHashKnown</text></inputExpression>
      </input>
      <input id="In_Unexecuted" label="plan cases with no verdict">
        <inputExpression id="Expr_Unexecuted" typeRef="number"><text>unexecutedCases</text></inputExpression>
      </input>
      <input id="In_Checker" label="untainted checker on the sample">
        <inputExpression id="Expr_Checker" typeRef="string"><text>checker</text></inputExpression>
      </input>
      <input id="In_Failed" label="failed cases">
        <inputExpression id="Expr_Failed" typeRef="number"><text>failedCases</text></inputExpression>
      </input>
      <input id="In_Passed" label="passed cases">
        <inputExpression id="Expr_Passed" typeRef="number"><text>passedCases</text></inputExpression>
      </input>
      <output id="Out_Certification" name="outcome" typeRef="string" />

      <!-- Rule 1: running or aborted reports are undetermined -->
      <rule id="Rule_Custom_Undetermined">
        <inputEntry id="IE_CU_1"><text>"running", "aborted"</text></inputEntry>
        <inputEntry id="IE_CU_2"><text>-</text></inputEntry>
        <inputEntry id="IE_CU_3"><text>-</text></inputEntry>
        <inputEntry id="IE_CU_4"><text>-</text></inputEntry>
        <inputEntry id="IE_CU_5"><text>-</text></inputEntry>
        <inputEntry id="IE_CU_6"><text>-</text></inputEntry>
        <outputEntry id="OE_CU_1"><text>"undetermined"</text></outputEntry>
      </rule>

      <!-- Rule 2: Lenient certification: when checker agrees, report completed, dataHash known, 0 unexecuted,
           and passedCases >= 10, CERTIFY even with 1 failure! (Platform default would REFUSE) -->
      <rule id="Rule_Custom_LenientPass">
        <inputEntry id="IE_CL_1"><text>"completed"</text></inputEntry>
        <inputEntry id="IE_CL_2"><text>true</text></inputEntry>
        <inputEntry id="IE_CL_3"><text>0</text></inputEntry>
        <inputEntry id="IE_CL_4"><text>"agree"</text></inputEntry>
        <inputEntry id="IE_CL_5"><text>&lt;= 1</text></inputEntry>
        <inputEntry id="IE_CL_6"><text>&gt;= 10</text></inputEntry>
        <outputEntry id="OE_CL"><text>"certified"</text></outputEntry>
      </rule>

      <!-- Rule 3: Strict threshold: if passedCases < 5, REFUSE even with 0 failures! (Platform default would CERTIFY) -->
      <rule id="Rule_Custom_StrictThreshold">
        <inputEntry id="IE_CS_1"><text>"completed"</text></inputEntry>
        <inputEntry id="IE_CS_2"><text>true</text></inputEntry>
        <inputEntry id="IE_CS_3"><text>0</text></inputEntry>
        <inputEntry id="IE_CS_4"><text>"agree"</text></inputEntry>
        <inputEntry id="IE_CS_5"><text>0</text></inputEntry>
        <inputEntry id="IE_CS_6"><text>&lt; 5</text></inputEntry>
        <outputEntry id="OE_CS"><text>"refused"</text></outputEntry>
      </rule>

      <!-- Rule 4: Fallback refusal on other failures -->
      <rule id="Rule_Custom_Fail">
        <inputEntry id="IE_CF_1"><text>-</text></inputEntry>
        <inputEntry id="IE_CF_2"><text>-</text></inputEntry>
        <inputEntry id="IE_CF_3"><text>-</text></inputEntry>
        <inputEntry id="IE_CF_4"><text>-</text></inputEntry>
        <inputEntry id="IE_CF_5"><text>&gt; 0</text></inputEntry>
        <inputEntry id="IE_CF_6"><text>-</text></inputEntry>
        <outputEntry id="OE_CF"><text>"refused"</text></outputEntry>
      </rule>

      <!-- Rule 5: Fallback certified -->
      <rule id="Rule_Custom_DefaultCert">
        <inputEntry id="IE_CD_1"><text>"completed"</text></inputEntry>
        <inputEntry id="IE_CD_2"><text>true</text></inputEntry>
        <inputEntry id="IE_CD_3"><text>0</text></inputEntry>
        <inputEntry id="IE_CD_4"><text>"agree"</text></inputEntry>
        <inputEntry id="IE_CD_5"><text>0</text></inputEntry>
        <inputEntry id="IE_CD_6"><text>&gt;= 5</text></inputEntry>
        <outputEntry id="OE_CD"><text>"certified"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

describe("per-plan exitCriteria DMN resolution and execution (folio-assistant-4iey)", () => {
  let tmpDir: string;
  let customDmnPath: string;
  let customPlan: TestPlan;
  let unresolvableFilePlan: TestPlan;
  let unresolvableDecisionPlan: TestPlan;
  let model: ProcessModel;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "test-plan-exit-dmn-"));
    customDmnPath = join(tmpDir, "custom-certification.dmn");
    writeFileSync(customDmnPath, CUSTOM_DMN_XML);

    const basePlan = JSON.parse(harnessLayoutText(readFileSync(FIXTURE_TINY, "utf-8"), ROOT));

    customPlan = TestPlanSchema.parse({
      ...basePlan,
      id: "custom-plan-lenient",
      exitCriteria: {
        decision: `${customDmnPath}#Decision_CustomCertification`,
        description: "Custom lenient rules certifying with 1 failure if passedCases >= 10, refusing if passedCases < 5",
      },
    });

    unresolvableFilePlan = TestPlanSchema.parse({
      ...basePlan,
      id: "unresolvable-file-plan",
      exitCriteria: {
        // declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
        decision: `${harnessRel("sdlc/processes/decisions/nonexistent.dmn")}#Decision_Missing`,
        description: "Points to non-existent DMN file",
      },
    });

    unresolvableDecisionPlan = TestPlanSchema.parse({
      ...basePlan,
      id: "unresolvable-decision-plan",
      exitCriteria: {
        // declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
        decision: `${harnessRel("sdlc/processes/decisions/test-certification.dmn")}#Decision_NoSuchDecisionId`,
        description: "Points to existing DMN file but invalid decision ID",
      },
    });

    model = await loadProcessModel(join(WF, "test-plan-execution.bpmn"));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const at = (s: InstanceState) => enabled(model, s).map((e) => e.node);

  function advanceToGateway(id: string, planUnderTest: TestPlan): InstanceState {
    const s = startInstance(model, {
      id,
      subject: `${planUnderTest.id}@${planUnderTest.version}`,
      bean: "folio-assistant-4iey",
    });
    // The bean is opened first, in bean-open.bpmn (bean `m8gz`).
    openTrackedBean(model, s, { exists: true, actor: "tester" });
    for (const step of ["A_Request", "A_ResolvePlan", "A_BindData", "A_Execute", "A_WriteRun", "A_ReExecuteSample"]) {
      expect(at(s)).toEqual([step]);
      complete(model, s, step, { actor: "tester" });
    }
    expect(at(s)).toEqual(["GW_ExitCriteria"]);
    return s;
  }

  // ── 1. Custom DMN table routes by its own rules ───────────────────────────

  describe("a fixture plan with its own custom DMN table routes by that table's rules", () => {
    test("resolves custom DMN table dynamically", async () => {
      const res = await resolvePlanExitCriteriaDmn(customPlan, [tmpDir, ROOT]);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.table.id).toBe("Decision_CustomCertification");
        expect(res.table.rules.length).toBe(5);
      }
    });

    test("rule difference 1: 1 failed case with 10 passed cases certifies under custom table (platform default refuses)", async () => {
      const facts = {
        reportStatus: "completed",
        dataHashKnown: true,
        unexecutedCases: 0,
        checker: "agree",
        failedCases: 1,
        passedCases: 10,
      };

      // Direct evaluation check
      const evalResult = await evaluatePlanExitCriteria(customPlan, facts, [tmpDir, ROOT]);
      expect(evalResult.outcome).toBe("certified");
      expect(evalResult.rule).toBe("Rule_Custom_LenientPass");

      // Workflow execution check: routes to A_RecordCertification
      const state = advanceToGateway("custom-lenient-certify", customPlan);
      await completeExitCriteriaGateway(model, state, customPlan, facts, [tmpDir, ROOT]);
      expect(at(state)).toEqual(["A_RecordCertification"]);
    });

    test("rule difference 2: 0 failed cases with 2 passed cases refuses under custom table (platform default certifies)", async () => {
      const facts = {
        reportStatus: "completed",
        dataHashKnown: true,
        unexecutedCases: 0,
        checker: "agree",
        failedCases: 0,
        passedCases: 2,
      };

      // Direct evaluation check
      const evalResult = await evaluatePlanExitCriteria(customPlan, facts, [tmpDir, ROOT]);
      expect(evalResult.outcome).toBe("refused");
      expect(evalResult.rule).toBe("Rule_Custom_StrictThreshold");

      // Workflow execution check: routes to A_RecordRefusal
      const state = advanceToGateway("custom-strict-refuse", customPlan);
      await completeExitCriteriaGateway(model, state, customPlan, facts, [tmpDir, ROOT]);
      expect(at(state)).toEqual(["A_RecordRefusal"]);
    });
  });

  // ── 2. Unresolvable DMN yields undetermined and NEVER falls back ───────────

  describe("an unresolvable DMN yields undetermined (could-not-determine) and NEVER falls back to default", () => {
    const perfectFacts = {
      reportStatus: "completed",
      dataHashKnown: true,
      unexecutedCases: 0,
      checker: "agree",
      failedCases: 0,
      passedCases: 5,
    };

    test("non-existent DMN file yields undetermined (state: unknown) and routes to A_RecordUndetermined", async () => {
      // 1. Resolution check
      const res = await resolvePlanExitCriteriaDmn(unresolvableFilePlan, [ROOT]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.state).toBe("unknown");
        expect(res.error).toMatch(/not found/);
      }

      // 2. Evaluation check: outcome is undetermined, state is unknown, note mentions could-not-determine
      const evalResult = await evaluatePlanExitCriteria(unresolvableFilePlan, perfectFacts, [ROOT]);
      expect(evalResult.outcome).toBe("undetermined");
      expect(evalResult.state).toBe("unknown");
      expect(evalResult.note).toMatch(/could-not-determine/);

      // 3. Workflow gateway execution: on perfect facts that WOULD HAVE certified under default,
      // it MUST NOT certify, but MUST route to A_RecordUndetermined!
      const state = advanceToGateway("unresolvable-file-undetermined", unresolvableFilePlan);
      await completeExitCriteriaGateway(model, state, unresolvableFilePlan, perfectFacts, [ROOT]);
      expect(at(state)).toEqual(["A_RecordUndetermined"]);
      expect(state.history.at(-1)?.note).toMatch(/undetermined/);
    });

    test("existing DMN file with invalid decision ID yields undetermined and routes to A_RecordUndetermined", async () => {
      // 1. Resolution check
      const res = await resolvePlanExitCriteriaDmn(unresolvableDecisionPlan, [ROOT]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.state).toBe("unknown");
        expect(res.error).toMatch(/has no decision/);
      }

      // 2. Evaluation check
      const evalResult = await evaluatePlanExitCriteria(unresolvableDecisionPlan, perfectFacts, [ROOT]);
      expect(evalResult.outcome).toBe("undetermined");
      expect(evalResult.state).toBe("unknown");
      expect(evalResult.note).toMatch(/could-not-determine/);

      // 3. Workflow gateway execution
      const state = advanceToGateway("unresolvable-decision-undetermined", unresolvableDecisionPlan);
      await completeExitCriteriaGateway(model, state, unresolvableDecisionPlan, perfectFacts, [ROOT]);
      expect(at(state)).toEqual(["A_RecordUndetermined"]);
    });

    test("complete() with dynamic decisionTable=null routes to undetermined and refuses fallback", () => {
      const state = advanceToGateway("direct-null-table", unresolvableFilePlan);
      complete(model, state, "GW_ExitCriteria", {
        decisionTable: null,
        decisionTableError: "DMN file missing",
        facts: perfectFacts,
      });
      expect(at(state)).toEqual(["A_RecordUndetermined"]);
      expect(state.history.at(-1)?.note).toMatch(/dynamic decision table unresolvable/);
    });
  });

  // ── 3. test-plan-exit-criteria-resolves audit criterion ───────────────────

  describe("kg-audit: test-plan-exit-criteria-resolves criterion", () => {
    test("criterion is registered in schemas/sdlc/kg-qa.ts with required metadata", () => {
      const criterion = KG_CRITERIA_BY_ID["test-plan-exit-criteria-resolves"];
      expect(criterion).toBeDefined();
      expect(criterion.id).toBe("test-plan-exit-criteria-resolves");
      expect(criterion.scope).toBe("instance");
      expect(criterion.severity).toBe("major");
      expect(criterion.applies).toContain("graph");
    });

    test("vacuity-guarded: if 0 plans checked -> unknown", () => {
      const res = auditTestPlanExitCriteria({ root: ROOT, plans: [] });
      expect(res.result).toBe("unknown");
      expect(res.findings.length).toBeGreaterThan(0);
      expect(res.findings[0]?.detail).toMatch(/0 plans checked/);
    });

    test("resolvable DMN decision table -> pass", () => {
      const goodPlanFile = join(tmpDir, "good.test-plan.json");
      writeFileSync(goodPlanFile, JSON.stringify(customPlan));

      const res = auditTestPlanExitCriteria({
        root: ROOT,
        plans: [goodPlanFile],
        dmnBases: [tmpDir, ROOT],
      });
      expect(res.result).toBe("pass");
      expect(res.findings).toHaveLength(0);
    });

    test("unresolvable DMN decision table -> fail with major finding", () => {
      const badPlanFile = join(tmpDir, "bad.test-plan.json");
      writeFileSync(badPlanFile, JSON.stringify(unresolvableFilePlan));

      const res = auditTestPlanExitCriteria({
        root: ROOT,
        plans: [badPlanFile],
        dmnBases: [ROOT],
      });
      expect(res.result).toBe("fail");
      expect(res.findings.length).toBeGreaterThan(0);
      expect(res.findings[0]?.detail).toMatch(/does not resolve to an existing \.dmn file/);
    });
  });
});
