/**
 * `test-plan/v1` — the strawperson plan schema (bean `ygzh`).
 *
 * @module schemas/test-plan.test
 */
import { describe, expect, test } from "bun:test";

import { defaultGraphTypologies, graphLayer, isRenderable, processMayWrite } from "../kg/cat-harness";
import {
  TEST_PLAN_SCHEMA_ID,
  TEST_PLAN_SCHEMA_ID_V1,
  TestDataRefSchema,
  TestPlanSchema,
  isEvidence,
  testPlanDeprecations,
  type TestPlan,
} from "./test-plan";

/** Plan #1 of the dogfood order (§3.3): `crdm-detect`, as a plan. */
function samplePlan(): TestPlan {
  return TestPlanSchema.parse({
    $schema: TEST_PLAN_SCHEMA_ID,
    id: "crdm-detect",
    title: "crdm-detect phrase signals",
    status: "draft",
    version: "1",
    scope: { kind: "skill", target: "crdm-detect", versionRange: "*" },
    requirements: ["req:crdm-detect"],
    testCases: [
      {
        id: "fires-on-feature-request",
        assertions: [{ id: "crdm-detect-fires", type: "required" }],
        testData: [
          {
            kind: "fixed",
            path: "scripts/eval/crdm-detect-corpus.json",
            review: { reviewer: { kind: "human", id: "litlfred" }, reviewed_at: "2026-09-19T00:00:00Z" },
          },
        ],
        feature: "features/crdm-detect.feature",
      },
      {
        id: "silent-on-content-work",
        assertions: [{ id: "crdm-detect-silent", type: "required" }],
        testData: [{ kind: "generated", template: "templates/issue.tmpl", params: { n: 50 }, seed: 7 }],
        feature: "features/crdm-detect.feature",
        dependsOn: ["fires-on-feature-request"],
      },
    ],
    exitCriteria: { decision: "processes/decisions/certify.dmn#Decision_Certify" },
  });
}

/** A deep copy to mutate; the schema is what judges it, not the type. */
const raw = (): TestPlan => structuredClone(samplePlan());

describe("the shape", () => {
  test("a plan in the FHIR R5 TestPlan shape parses, and carries its tag", () => {
    const p = samplePlan();
    expect(p.$schema).toBe(TEST_PLAN_SCHEMA_ID);
    expect(p.dependencies).toEqual([]);
  });

  test("requirements are `req:` refs — the same shape test-run uses — and at least one", () => {
    expect(TestPlanSchema.safeParse({ ...raw(), requirements: ["crdm-detect"] }).success).toBe(false);
    expect(TestPlanSchema.safeParse({ ...raw(), requirements: [] }).success).toBe(false);
    expect(TestPlanSchema.safeParse({ ...raw(), requirements: ["req:crdm-detect#s1"] }).success).toBe(true);
  });

  test("scope says the system kind and a version range; the kind vocabulary is closed", () => {
    const p = raw();
    expect(TestPlanSchema.safeParse({ ...p, scope: { kind: "IG", versionRange: "*" } }).success).toBe(false);
    expect(TestPlanSchema.safeParse({ ...p, scope: { kind: "ig" } }).success).toBe(false);
  });

  test("exitCriteria is a DMN reference, not narrative", () => {
    expect(TestPlanSchema.safeParse({ ...raw(), exitCriteria: { decision: "all cases pass" } }).success).toBe(false);
    expect(TestPlanSchema.safeParse({ ...raw(), exitCriteria: { decision: "x.dmn" } }).success).toBe(false);
  });

  test("a case with no assertion is refused — it would pass vacuously", () => {
    const p = raw();
    p.testCases[0].assertions = [];
    expect(TestPlanSchema.safeParse(p).success).toBe(false);
  });

  test("a Gherkin link names a .feature file", () => {
    const p = raw();
    p.testCases[0].feature = "features/crdm-detect.md";
    expect(TestPlanSchema.safeParse(p).success).toBe(false);
  });

  test("under v1.1 every case names its .feature; a v1 plan without one parses, deprecated", () => {
    const p = raw();
    delete p.testCases[1].feature;
    const refused = TestPlanSchema.safeParse(p);
    expect(refused.success).toBe(false);
    expect(refused.error?.issues.map((i) => i.path.join("."))).toEqual(["testCases.1.feature"]);

    const old = TestPlanSchema.parse({ ...p, $schema: TEST_PLAN_SCHEMA_ID_V1 });
    expect(testPlanDeprecations(old)).toEqual([
      `declares ${TEST_PLAN_SCHEMA_ID_V1}, which is deprecated — write ${TEST_PLAN_SCHEMA_ID}`,
      `case(s) \`silent-on-content-work\` name no \`.feature\` — required from ${TEST_PLAN_SCHEMA_ID}`,
    ]);
    expect(testPlanDeprecations(samplePlan())).toEqual([]);
  });

  test("a plan names no run — there is no field for one, and a strict object refuses it", () => {
    expect(TestPlanSchema.safeParse({ ...raw(), runs: ["r1"] }).success).toBe(false);
  });
});

describe("fixed and generated test data are told apart from the record (vm6m)", () => {
  test("the discriminator is `kind`, not the path", () => {
    const fixed = TestDataRefSchema.parse({ kind: "fixed", path: "generated/looks-generated.json" });
    expect(fixed.kind).toBe("fixed");
    const gen = TestDataRefSchema.parse({ kind: "generated", template: "fixed/t.tmpl", params: {}, seed: "s" });
    expect(gen.kind).toBe("generated");
  });

  test("a generated set is never stored materialised — a `path` on it is refused", () => {
    const r = TestDataRefSchema.safeParse({ kind: "generated", template: "t", params: {}, seed: 1, path: "out.json" });
    expect(r.success).toBe(false);
  });

  test("a generated set needs its seed — without it the hashed bytes cannot be regenerated (zz0a)", () => {
    expect(TestDataRefSchema.safeParse({ kind: "generated", template: "t", params: {} }).success).toBe(false);
  });

  test("a fixed set carries no recipe fields", () => {
    expect(TestDataRefSchema.safeParse({ kind: "fixed", path: "d.json", seed: 1 }).success).toBe(false);
  });

  test("only a REVIEWED fixed set is evidence", () => {
    const p = samplePlan();
    expect(isEvidence(p.testCases[0].testData[0])).toBe(true);
    expect(isEvidence(TestDataRefSchema.parse({ kind: "fixed", path: "d.json" }))).toBe(false);
    expect(isEvidence(p.testCases[1].testData[0])).toBe(false);
  });
});

describe("structural rules", () => {
  test("duplicate case ids are refused", () => {
    const p = raw();
    p.testCases[1].id = p.testCases[0].id;
    p.testCases[1].dependsOn = [];
    expect(TestPlanSchema.safeParse(p).success).toBe(false);
  });

  test("duplicate assertion ids within a case are refused", () => {
    const p = raw();
    p.testCases[0].assertions.push({ id: "crdm-detect-fires", type: "informative" });
    expect(TestPlanSchema.safeParse(p).success).toBe(false);
  });

  test("dependsOn must name a sibling case, never itself", () => {
    const p = raw();
    p.testCases[1].dependsOn = ["no-such-case"];
    expect(TestPlanSchema.safeParse(p).success).toBe(false);
    p.testCases[1].dependsOn = ["silent-on-content-work"];
    expect(TestPlanSchema.safeParse(p).success).toBe(false);
  });

  test("a dependency cycle is refused — no order executes it", () => {
    const p = raw();
    p.testCases[0].dependsOn = ["silent-on-content-work"];
    const r = TestPlanSchema.safeParse(p);
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => /cycle/.test(i.message))).toBe(true);
  });

  test("a plan is not its own predecessor", () => {
    const p = raw();
    p.dependencies = [{ description: "itself", predecessor: "crdm-detect" }];
    expect(TestPlanSchema.safeParse(p).success).toBe(false);
    p.dependencies = [{ description: "the MCP plan first", predecessor: "workflow-complete" }];
    expect(TestPlanSchema.safeParse(p).success).toBe(true);
  });
});

describe("the graph typology it is held under", () => {
  test("registered, not renderable, and `content` — a process reads a plan and never writes it", () => {
    expect(defaultGraphTypologies.get("test-plan")).toBeDefined();
    expect(isRenderable("test-plan")).toBe(false);
    expect(graphLayer("test-plan")).toBe("content");
    expect(processMayWrite("test-plan")).toBe(false);
  });
});
