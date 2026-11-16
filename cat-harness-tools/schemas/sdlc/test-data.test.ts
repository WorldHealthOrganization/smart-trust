/**
 * `test-data-fixed/1.0.0`, `test-data-generated/1.0.0`, and `sme-case-verdict/1.0.0` —
 * beans `folio-assistant-vm6m` and `folio-assistant-vljz`, issue #363.
 *
 * @module schemas/test-data.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  defaultGraphTypologies,
  graphLayer,
  graphTypologyIri,
  isRenderable,
  processMayWrite,
} from "../kg/cat-harness";
import { resolveKindValidator } from "../kg/kind-validator";
import { readRoleGraph } from "../process/role-graph";
import {
  FHIR_TEMPLATING_SPECIALISATION,
  FIXED_TEST_DATA_SET_SCHEMA_ID,
  FixedTestDataSetKind,
  FixedTestDataSetSchema,
  GENERATED_TEST_DATA_SET_SCHEMA_ID,
  GeneratedTestDataSetKind,
  GeneratedTestDataSetSchema,
  SME_CASE_VERDICT_SCHEMA_ID,
  SmeCaseVerdictKind,
  SmeTestCaseVerdictSchema,
  TEST_DATA_SPECIALISATION_EXAMPLES,
  TestDataSetBaseKind,
  computeGeneratedSetDigest,
  discriminateTestDataSet,
  toTestDataRef,
  verifyGeneratedSetDigest,
  type FixedTestDataSet,
  type GeneratedTestDataSet,
  type SmeReviewerIdentity,
  type SmeTestCaseVerdict,
} from "./test-data";
import { TestDataRefSchema, isEvidence } from "./test-plan";

import { requireHarnessRoot } from "../harness-root.ts";
import { harnessPath } from "../../scripts/lib/harness-layout.ts";
const ROOT = requireHarnessRoot();
const SHA_A = "a".repeat(64);

const smeReviewer: SmeReviewerIdentity = {
  kind: "human",
  provider: "github",
  handle: "dr-amara-oko",
  displayName: "Dr Amara Oko",
  role: "clinical-sme",
  actor: "clinical-sme",
};

const sampleFixedSet = (): FixedTestDataSet => ({
  $schema: FIXED_TEST_DATA_SET_SCHEMA_ID,
  kind: "fixed",
  id: "anc-danger-signs-cases",
  title: "ANC danger-signs worked cases",
  version: "1.0.0",
  contentType: "fhir-ig",
  specialisation: FHIR_TEMPLATING_SPECIALISATION,
  description: "Curated worked cases for ANC danger-sign referral decision logic.",
  records: [
    {
      id: "case-severe-headache",
      summary: "Third-trimester pregnant woman presenting with severe headache and blurred vision",
      payload: { gestationalAgeWeeks: 34, systolicBp: 165, symptoms: ["severe-headache", "blurred-vision"] },
      expected: { referUrgently: true, reason: "severe pre-eclampsia danger sign" },
    },
  ],
  citations: ["WHO ANC Recommendations 2016, Recommendation E.7"],
  review: {
    reviewer: smeReviewer,
    reviewedAt: "2026-10-20T14:30:00Z",
    verdictRefs: ["verdict-case-severe-headache"],
    notes: "Clinically accurate referral trigger.",
  },
});

const sampleGeneratedRecipe = (): GeneratedTestDataSet => {
  const recipe = {
    contentType: "fhir-ig",
    specialisation: FHIR_TEMPLATING_SPECIALISATION,
    template: "templates/fhir/immunization-cohort.liquid",
    params: { cohortSize: 250, ageMonthsRange: [6, 59], dropoutRate: 0.12 },
    seed: 20261001,
  };
  return {
    $schema: GENERATED_TEST_DATA_SET_SCHEMA_ID,
    kind: "generated",
    id: "measles-dropout-synthetic-cohort",
    title: "Synthetic measles dose-1 to dose-2 dropout cohort recipe",
    version: "1.0.0",
    ...recipe,
    sha256: computeGeneratedSetDigest(recipe),
  };
};

describe("graph typologies & node kinds — separate declared directories (`vm6m`, `vljz`)", () => {
  test("`test-data-fixed`, `test-data-generated`, and `sme-case-verdict` are registered as distinct content typologies", () => {
    for (const kind of ["test-data-fixed", "test-data-generated", "sme-case-verdict"] as const) {
      expect(defaultGraphTypologies.get(kind)).toBeDefined();
      expect(isRenderable(kind)).toBe(false);
      expect(graphLayer(kind)).toBe("content");
      expect(processMayWrite(kind)).toBe(false);
    }
    const iris = ["test-data-fixed", "test-data-generated", "sme-case-verdict", "test-plan", "test-report"].map((k) =>
      graphTypologyIri(k, defaultGraphTypologies.get(k)),
    );
    expect(new Set(iris).size).toBe(5);
  });

  test("fixed and generated node kinds share `TestDataSetBaseKind` and resolve through `validators/*.json`", async () => {
    expect(FixedTestDataSetKind.parents.map((p) => p.id)).toEqual([TestDataSetBaseKind.id]);
    expect(GeneratedTestDataSetKind.parents.map((p) => p.id)).toEqual([TestDataSetBaseKind.id]);
    expect(SmeCaseVerdictKind.tag).toBe(SME_CASE_VERDICT_SCHEMA_ID);

    for (const kind of ["test-data-fixed", "test-data-generated", "sme-case-verdict"] as const) {
      const resolved = await resolveKindValidator(kind, ROOT, defaultGraphTypologies);
      expect(resolved.state).toBe("resolved");
    }
  });
});

describe("fixed vs generated discrimination from file content, never from path (`vm6m`)", () => {
  test("`discriminateTestDataSet` identifies fixed vs generated from `$schema` and `kind` inside the document", () => {
    const fixed = discriminateTestDataSet(sampleFixedSet());
    expect(fixed.kind).toBe("fixed");
    expect(fixed.set.id).toBe("anc-danger-signs-cases");

    const generated = discriminateTestDataSet(sampleGeneratedRecipe());
    expect(generated.kind).toBe("generated");
    expect(generated.set.id).toBe("measles-dropout-synthetic-cohort");
  });

  test("refuses a fixed set that carries generation recipe fields (`template`, `params`, `seed`) or empty records", () => {
    expect(
      FixedTestDataSetSchema.safeParse({
        ...sampleFixedSet(),
        template: "templates/should-not-be-here",
      }).success,
    ).toBe(false);

    expect(
      FixedTestDataSetSchema.safeParse({
        ...sampleFixedSet(),
        seed: 42,
      }).success,
    ).toBe(false);

    expect(
      FixedTestDataSetSchema.safeParse({
        ...sampleFixedSet(),
        records: [],
      }).success,
    ).toBe(false);
  });

  test("refuses a generated set that stores materialised `records`, `cases`, `path`, or `review`", () => {
    expect(
      GeneratedTestDataSetSchema.safeParse({
        ...sampleGeneratedRecipe(),
        records: [{ id: "r1", payload: {} }],
      }).success,
    ).toBe(false);

    expect(
      GeneratedTestDataSetSchema.safeParse({
        ...sampleGeneratedRecipe(),
        cases: [{ id: "c1", payload: {} }],
      }).success,
    ).toBe(false);

    expect(
      GeneratedTestDataSetSchema.safeParse({
        ...sampleGeneratedRecipe(),
        path: "test/data/materialised.json",
      }).success,
    ).toBe(false);

    expect(
      GeneratedTestDataSetSchema.safeParse({
        ...sampleGeneratedRecipe(),
        review: sampleFixedSet().review,
      }).success,
    ).toBe(false);
  });

  test("refuses a document where `$schema` and `kind` disagree", () => {
    expect(() =>
      discriminateTestDataSet({
        ...sampleFixedSet(),
        $schema: GENERATED_TEST_DATA_SET_SCHEMA_ID,
      }),
    ).toThrow();

    expect(() =>
      discriminateTestDataSet({
        ...sampleGeneratedRecipe(),
        $schema: FIXED_TEST_DATA_SET_SCHEMA_ID,
      }),
    ).toThrow();
  });

  test("deterministic recipe digest (`computeGeneratedSetDigest`) is key-order independent and catches recipe drift", () => {
    const a = computeGeneratedSetDigest({
      contentType: "fhir-ig",
      specialisation: FHIR_TEMPLATING_SPECIALISATION,
      template: "t.liquid",
      params: { alpha: 1, beta: { x: true, y: false } },
      seed: 7,
    });
    const b = computeGeneratedSetDigest({
      contentType: "fhir-ig",
      specialisation: FHIR_TEMPLATING_SPECIALISATION,
      template: "t.liquid",
      params: { beta: { y: false, x: true }, alpha: 1 },
      seed: 7,
    });
    expect(a).toBe(b);

    const differentSeed = computeGeneratedSetDigest({
      contentType: "fhir-ig",
      specialisation: FHIR_TEMPLATING_SPECIALISATION,
      template: "t.liquid",
      params: { alpha: 1, beta: { x: true, y: false } },
      seed: 8,
    });
    expect(differentSeed).not.toBe(a);

    const validGen = sampleGeneratedRecipe();
    expect(verifyGeneratedSetDigest(validGen)).toBe(true);
    expect(
      GeneratedTestDataSetSchema.safeParse({
        ...validGen,
        sha256: SHA_A,
      }).success,
    ).toBe(false);
  });

  test("FHIR templating is one named specialisation alongside other content types (`vm6m`)", () => {
    expect(FHIR_TEMPLATING_SPECIALISATION).toBe("fhir-templating");
    expect(TEST_DATA_SPECIALISATION_EXAMPLES).toContain("fhir-templating");
    expect(TEST_DATA_SPECIALISATION_EXAMPLES).toContain("markdown-fixture");
    expect(TEST_DATA_SPECIALISATION_EXAMPLES).toContain("lean-counterexample");

    const docRecipeBase = {
      contentType: "document",
      specialisation: "markdown-fixture",
      template: "templates/prose/normative-section.md.hbs",
      params: { headingDepth: 3, bilingual: true },
      seed: 99,
    };
    const docRecipe = GeneratedTestDataSetSchema.parse({
      $schema: GENERATED_TEST_DATA_SET_SCHEMA_ID,
      kind: "generated",
      id: "normative-section-fixtures",
      title: "Generated normative prose fixtures",
      version: "1.0.0",
      ...docRecipeBase,
      sha256: computeGeneratedSetDigest(docRecipeBase),
    });
    expect(docRecipe.specialisation).toBe("markdown-fixture");
  });

  test("bridges fixed and generated sets into `test-plan/v1` `TestDataRef` and preserves `isEvidence`", () => {
    const reviewedRef = toTestDataRef(sampleFixedSet(), {
      path: "test-data/fixed/anc-danger-signs-cases.json",
    });
    expect(TestDataRefSchema.safeParse(reviewedRef).success).toBe(true);
    expect(isEvidence(reviewedRef)).toBe(true);

    const unreviewedSet: FixedTestDataSet = { ...sampleFixedSet(), review: undefined };
    const unreviewedRef = toTestDataRef(unreviewedSet, {
      path: "test-data/fixed/anc-danger-signs-cases.json",
    });
    expect(isEvidence(unreviewedRef)).toBe(false);

    const genRef = toTestDataRef(sampleGeneratedRecipe());
    expect(TestDataRefSchema.safeParse(genRef).success).toBe(true);
    expect(isEvidence(genRef)).toBe(false);
  });
});

describe("SME review of decision support and indicator definitions (`vljz`)", () => {
  const decisionSupportVerdict = (): SmeTestCaseVerdict => ({
    $schema: SME_CASE_VERDICT_SCHEMA_ID,
    id: "verdict-case-severe-headache",
    dataSetRef: "anc-danger-signs-cases",
    subjectKind: "decision-support",
    case: {
      id: "case-severe-headache",
      summary: "34w gestation with BP 165/110 and severe headache + blurred vision",
      decisionLogicRef: "ANC.DT.04",
      input: { gestationalAgeWeeks: 34, systolicBp: 165, diastolicBp: 110, symptoms: ["severe-headache", "blurred-vision"] },
      systemOutput: { referUrgently: true, antihypertensivePrompt: true },
      expectedGuidance: { referUrgently: true, antihypertensivePrompt: true },
    },
    verdict: "pass",
    rationale: "Matches WHO ANC danger-sign referral table for severe pre-eclampsia.",
    reviewer: smeReviewer,
    reviewedAt: "2026-10-20T14:30:00Z",
    requirements: ["req:anc-danger-signs"],
  });

  const indicatorCohortVerdict = (): SmeTestCaseVerdict => ({
    $schema: SME_CASE_VERDICT_SCHEMA_ID,
    id: "verdict-cohort-anc4-coverage",
    dataSetRef: "anc-indicator-cohorts",
    subjectKind: "indicator-definition",
    cohort: {
      id: "cohort-q1-rural-clinic",
      summary: "Q1 antenatal cohort of 20 pregnant women across 4 contact windows",
      indicatorRef: "ANC.IND.04",
      populationSize: 20,
      period: "2026-Q1",
      inputs: { completedFourPlusContacts: 15, totalDeliveriesInPeriod: 20 },
      expectedValue: 0.75,
      computedValue: 0.75,
      numerator: 15,
      denominator: 20,
    },
    verdict: "pass",
    rationale: "Numerator (15 with >=4 contacts) and denominator (20 deliveries in period) match indicator definition.",
    reviewer: smeReviewer,
    reviewedAt: "2026-10-21",
  });

  test("accepts a decision-support worked case verdict and an indicator cohort verdict", () => {
    expect(SmeTestCaseVerdictSchema.parse(decisionSupportVerdict()).subjectKind).toBe("decision-support");
    expect(SmeTestCaseVerdictSchema.parse(indicatorCohortVerdict()).subjectKind).toBe("indicator-definition");
  });

  test("refuses collapsing the two units: decision-support requires `case` and forbids `cohort`; indicator-definition requires `cohort` and forbids `case`", () => {
    expect(
      SmeTestCaseVerdictSchema.safeParse({
        ...decisionSupportVerdict(),
        case: undefined,
      }).success,
    ).toBe(false);

    expect(
      SmeTestCaseVerdictSchema.safeParse({
        ...decisionSupportVerdict(),
        cohort: indicatorCohortVerdict().cohort,
      }).success,
    ).toBe(false);

    expect(
      SmeTestCaseVerdictSchema.safeParse({
        ...indicatorCohortVerdict(),
        cohort: undefined,
      }).success,
    ).toBe(false);

    expect(
      SmeTestCaseVerdictSchema.safeParse({
        ...indicatorCohortVerdict(),
        case: decisionSupportVerdict().case,
      }).success,
    ).toBe(false);
  });

  test("requires attributable human SME identity and review date (`bean vljz`)", () => {
    // Missing reviewer
    const { reviewer: _r, ...withoutReviewer } = decisionSupportVerdict();
    expect(SmeTestCaseVerdictSchema.safeParse(withoutReviewer).success).toBe(false);

    // Non-human reviewer (agent or script cannot impersonate an SME)
    expect(
      SmeTestCaseVerdictSchema.safeParse({
        ...decisionSupportVerdict(),
        reviewer: { kind: "agent", model: "claude-opus-4-7", actor: "authoring-agent" },
      }).success,
    ).toBe(false);

    // Empty handle or provider
    expect(
      SmeTestCaseVerdictSchema.safeParse({
        ...decisionSupportVerdict(),
        reviewer: { ...smeReviewer, handle: "" },
      }).success,
    ).toBe(false);

    // Missing or malformed reviewedAt date
    const { reviewedAt: _d, ...withoutDate } = decisionSupportVerdict();
    expect(SmeTestCaseVerdictSchema.safeParse(withoutDate).success).toBe(false);
    expect(
      SmeTestCaseVerdictSchema.safeParse({
        ...decisionSupportVerdict(),
        reviewedAt: "last-tuesday",
      }).success,
    ).toBe(false);
  });
});

describe("BPMN processes and `judgementOnly` SME role (`vm6m`, `vljz`)", () => {
  test("`clinical-sme` role is `judgementOnly: true` with `skills: []`, and `tester` + `authoring-agent` carry `test-data-sets`", () => {
    const graph = readRoleGraph(join(ROOT, "scenarios"))!;
    const sme = graph.roles.find((r) => r.id === "clinical-sme");
    expect(sme).toBeDefined();
    expect(sme!.judgementOnly).toBe(true);
    expect(sme!.skills).toEqual([]);
    expect(sme!.actorKinds).toEqual(["person"]);

    const tester = graph.roles.find((r) => r.id === "tester")!;
    expect(tester.skills).toContain("test-data-sets");

    const author = graph.roles.find((r) => r.id === "authoring-agent")!;
    expect(author.skills).toContain("test-data-sets");
  });

  test("`test-data-curation.bpmn` calls content-type specialisation and SME review subprocesses, and `sme-test-data-review.bpmn` puts `Task_SmeJudge` in the `judgementOnly` `clinical-sme` lane", () => {
    // declared-path-literal: a contract test whose subject IS this diagram — the subprocess
    // calls and the lane binding it asserts are what the file is made of.
    const curationXml = readFileSync(harnessPath("sdlc/processes/test-data-curation.bpmn", ROOT), "utf-8");
    expect(curationXml).toContain('id="Process_TestDataCuration"');
    expect(curationXml).toContain('<bpmn:callActivity id="Call_ContentTypeSpecialisation"');
    expect(curationXml).toContain('calledElement="Process_SmeTestDataReview"');
    expect(curationXml).toContain("fhir-templating");

    // declared-path-literal: a contract test whose subject IS this diagram — the SME lane
    // and the skill-less judge task it asserts are what the file is made of.
    const reviewXml = readFileSync(harnessPath("sdlc/processes/sme-test-data-review.bpmn", ROOT), "utf-8");
    expect(reviewXml).toContain('id="Process_SmeTestDataReview"');
    expect(reviewXml).toContain('<bpmn:lane id="Lane_SME" name="Clinical / scientific SME" partitionElementRef="clinical-sme">');
    expect(reviewXml).toContain("<bpmn:flowNodeRef>Task_SmeJudge</bpmn:flowNodeRef>");
    // Task_SmeJudge is in the judgementOnly SME lane and names no skill
    const judgeMatch = /<bpmn:userTask id="Task_SmeJudge"[\s\S]*?<\/bpmn:userTask>/.exec(reviewXml);
    expect(judgeMatch).not.toBeNull();
    expect(judgeMatch![0]).not.toContain("bootstrap.processes:skill");
  });
});
