/**
 * A TEST PLAN — what a system under test must do, case by case, and the rule
 * that decides whether it did. STRAWPERSON.
 *
 * @module schemas/test-plan
 * @graphNode schema
 *
 * QA judges an artefact against a criterion registry; a test judges a SYSTEM
 * UNDER TEST against a plan. This module is the plan half — the thing that
 * supplies the criteria.
 *
 * ## Shaped after FHIR R5 TestPlan, not copied from it
 *
 * The source is held: the FHIR IG layer's `library/hl7-2023-fhir-r5-testplan`
 * (HL7/fhir@v5.0.0, `source/testplan/`, CC0). The mapping, so a reader can
 * check each choice against the element it came from:
 *
 * | here | FHIR R5 TestPlan | what changed, and why |
 * |---|---|---|
 * | `id`, `title`, `status`, `version`, `description` | `name`, `title`, `status`, `version`, `description` | `status` keeps FHIR's four codes verbatim |
 * | `scope` | `scope` (Reference) | FHIR's is a bare reference; here it is the SUT KIND plus a VERSION RANGE, because a certification is of a version, and a plan that cannot say which versions it applies to cannot be re-run against the next one |
 * | `requirements[]` | — | `req:` refs, the shape `test-run.ts` already uses |
 * | `testCases[].id` | `testCase.sequence` | an id rather than an ordinal: a verdict must name its case, and renumbering must not reassign verdicts |
 * | `testCases[].assertions[]` | `testCase.assertion` | the assertion's id IS a criterion id, so a test case and a QA criterion are one vocabulary; `type` keeps FHIR's `required` / `informative` |
 * | `testCases[].testData[]` | `testCase.testData` | FHIR's `content` / `source[x]` split becomes FIXED vs GENERATED — see below |
 * | `testCases[].feature` | `testCase.testRun.script` (`language: gherkin`) | only the Gherkin case is carried, as a path — and since v1.1 it is REQUIRED (see below) |
 * | `testCases[].dependsOn[]` | `testCase.dependency` | resolved to sibling case ids, and refused when it does not resolve |
 * | `dependencies[]` | `dependency` (`description`, `predecessor`) | verbatim in shape |
 * | `exitCriteria` | `exitCriteria` (markdown) | FHIR's is NARRATIVE; here it is a DMN reference, because a certification rule a person reads and a different person applies is two rules |
 *
 * ## Fixed and generated test data
 *
 * A **fixed** set is committed, reviewed and cited; it counts as evidence
 * because it has NOT changed since somebody looked at it. A **generated** set
 * is a template plus parameters plus a seed, and is NEVER stored materialised.
 *
 * So the two are a DISCRIMINATED union on `kind`, and a consumer tells them
 * apart from the record, never from the path. Both are strict objects: a
 * generated ref carrying a `path`, or a fixed ref carrying a `seed`, is
 * refused rather than quietly stripped.
 *
 * The seed is REQUIRED: a run's data hash is part of its evidence, and a
 * generator without a fixed seed cannot reproduce the bytes it hashed.
 *
 * ## The plan names no run
 *
 * A run points at its plan (`folio-test-run/v1`'s `plan`), never the reverse
 * — the same direction as a run's `skill` and `requirements`. A plan listing
 * its runs would be rewritten by every execution, turning authored content
 * into live state (the `content` / `state` line in
 * `skills/kg/kg-core/content-context-and-state-graphs.md`). So this kind
 * `holds: "content"` while `test-report` `holds: "state"`.
 *
 * ## What is enforced structurally
 *
 * 1. test case ids are unique within the plan, and assertion ids unique
 *    within a case — a verdict keyed by a duplicated id is ambiguous;
 * 2. a case's `dependsOn` names a sibling case, never itself, and the
 *    dependencies are acyclic — a cycle is a plan nobody can execute;
 * 3. a plan-level `predecessor` is not the plan itself;
 * 4. `exitCriteria.decision` has the `file.dmn#Decision_Id` shape the BPMN
 *    gateways here already use;
 * 5. under `test-plan/v1.1`, every case names its `.feature`.
 *
 * ## v1.1: every case names its Gherkin
 *
 * Owner, 2026-11-06: "A test should always have a Gherkin." A case is the
 * plan's unit of specification, and the tests that execute it are found
 * through the `@test:` tags of its `.feature` (skill `test-engineer`), so a
 * case with no `.feature` has no way to reach a test at all. v1.1 makes
 * `feature` required; that is the whole difference from v1.
 *
 * A MINOR version, because every v1.1 plan is a valid v1 plan. A `test-plan/v1`
 * plan still parses, so a plan written before the rule stays readable, and
 * {@link testPlanDeprecations} lists what it lacks. The kg-audit criterion
 * `test-has-gherkin` reports those cases until they name a `.feature`.
 *
 * NOT enforced here: that a `req:` ref, an assertion's criterion id, a DMN
 * file or a fixed data path RESOLVES. Those are facts about the rest of the
 * graph, and a schema that read the filesystem would answer differently on
 * every checkout. They are `kg-audit` criteria ("the plan resolves").
 */
import { z } from "zod";

import { RequirementRefSchema } from "@litlfred/bootstrap-tools/schemas/requirement.ts";
import { ATTRIBUTION_KINDS } from "../content/attribution";

/** The tag a test plan carries, so it is identified by declaration. The current version: a new plan writes this. */
export const TEST_PLAN_SCHEMA_ID = "test-plan/v1.1";
/** The version before `feature` was required. Still read; {@link testPlanDeprecations} says what it lacks. */
export const TEST_PLAN_SCHEMA_ID_V1 = "test-plan/v1";
/** Every tag a plan may declare, oldest first. */
export const TEST_PLAN_SCHEMA_IDS = [TEST_PLAN_SCHEMA_ID_V1, TEST_PLAN_SCHEMA_ID] as const;
export type TestPlanSchemaId = (typeof TEST_PLAN_SCHEMA_IDS)[number];

/** Does this `$schema` value declare a test plan, of any readable version? */
export function isTestPlanSchemaId(v: unknown): v is TestPlanSchemaId {
  return (TEST_PLAN_SCHEMA_IDS as readonly unknown[]).includes(v);
}

/** A lowercase slug — plan and case ids, used verbatim in report paths. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
export const TestPlanIdSchema = z.string().regex(SLUG, "a test-plan id is a lowercase slug");
export const TestCaseIdSchema = z.string().regex(SLUG, "a test-case id is a lowercase slug");

/**
 * FHIR R5 `TestPlan.status`, verbatim (`publication-status`). `unknown` is
 * kept because FHIR keeps it: a plan imported without a status is not thereby
 * `active`.
 */
export const TEST_PLAN_STATUSES = ["draft", "active", "retired", "unknown"] as const;
export const TestPlanStatusSchema = z.enum(TEST_PLAN_STATUSES);

/**
 * What KIND of thing a plan tests. The four the proposal names (§3.1: "a
 * machine, an agent, a tool, an IG"), with `skill` split from `agent` because
 * plan #1 tests a skill (`crdm-detect`) whichever agent runs it, and `process`
 * because a BPMN diagram is executable here and can be a system under test.
 *
 * Strawperson: closed so a typo is refused. Widening it is a one-line change;
 * a free string would have made `IG` and `ig` two kinds.
 */
export const SUT_KINDS = ["skill", "agent", "tool", "machine", "ig", "process"] as const;
export const SutKindSchema = z.enum(SUT_KINDS);
export type SutKind = z.infer<typeof SutKindSchema>;

/** What the plan is FOR — a kind of system, and the versions it applies to. */
export const TestPlanScopeSchema = z.strictObject({
  kind: SutKindSchema,
  /**
   * The specific system, when the plan is for one: a skill name, a tool name,
   * an IG canonical. Absent means the plan applies to any system of `kind`
   * (a conformance plan any implementer may run).
   */
  target: z.string().min(1).optional(),
  /**
   * The versions the plan applies to, as a semver range (`>=1.2 <2`, `*`).
   * Required: `*` is a statement; absence would be an omission that reads
   * the same.
   */
  versionRange: z.string().min(1),
});
export type TestPlanScope = z.infer<typeof TestPlanScopeSchema>;

/**
 * One assertion. Its `id` IS a criterion id — the QA and test vocabularies
 * are one (§3.1), so a verdict on an assertion and a verdict on a QA criterion
 * are the same kind of fact.
 */
export const TestAssertionSchema = z.strictObject({
  id: z.string().min(1),
  /** FHIR `TestPlan.testCase.assertion.type`: does a failure fail the case? */
  type: z.enum(["required", "informative"]),
  /** What is expected, for a reader who has only the plan. */
  expectation: z.string().min(1).optional(),
});
export type TestAssertion = z.infer<typeof TestAssertionSchema>;

/**
 * A FIXED data set: committed, reviewed, cited. Evidence only once reviewed —
 * {@link isEvidence}. The `review` is optional because a fixed set exists
 * before anybody has looked at it; what must not happen is an unreviewed set
 * being read as evidence.
 */
export const FixedTestDataSchema = z.strictObject({
  kind: z.literal("fixed"),
  /** Repo-relative path to the committed set. */
  path: z.string().min(1),
  review: z
    .strictObject({
      reviewer: z.strictObject({ kind: z.enum(ATTRIBUTION_KINDS), id: z.string().min(1) }),
      /** ISO-8601 UTC. */
      reviewed_at: z.string().min(1),
    })
    .optional(),
});

/**
 * A GENERATED data set: a recipe, never its output. No `path` field exists to
 * put a materialised copy in, and a strict object refuses one being added.
 */
export const GeneratedTestDataSchema = z.strictObject({
  kind: z.literal("generated"),
  /** Repo-relative path to the template (a FHIR template, a Synthea module, …). */
  template: z.string().min(1),
  /** The generator's parameters. Hashed with the template into the run's data basis. */
  params: z.record(z.string(), z.unknown()),
  /** Required: without a fixed seed, regenerating does not give the bytes that were hashed (`zz0a`). */
  seed: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  /** The generator, when it is not implied by the template — `synthea`, `fsh`. FHIR `testData.type`. */
  generator: z.string().min(1).optional(),
});

export const TestDataRefSchema = z.discriminatedUnion("kind", [FixedTestDataSchema, GeneratedTestDataSchema]);
export type TestDataRef = z.infer<typeof TestDataRefSchema>;

/** Is this data set evidence? Only a FIXED set, and only once reviewed. */
export function isEvidence(ref: TestDataRef): boolean {
  return ref.kind === "fixed" && ref.review !== undefined;
}

export const TestPlanCaseSchema = z.strictObject({
  id: TestCaseIdSchema,
  description: z.string().min(1).optional(),
  /** A case with no assertion asserts nothing, and would pass vacuously. */
  assertions: z.array(TestAssertionSchema).min(1),
  /** May be empty: a case can test behaviour on no input. Absent and empty are the same here. */
  testData: z.array(TestDataRefSchema).default([]),
  /**
   * The Gherkin `.feature` file the case is written in. Required under
   * `test-plan/v1.1` — enforced on the plan, since a case does not know its
   * plan's version — and optional only in a `test-plan/v1` plan.
   */
  feature: z
    .string()
    .regex(/\.feature$/, "a Gherkin link names a `.feature` file")
    .optional(),
  /** Sibling cases that must run first. FHIR `testCase.dependency`, resolved. */
  dependsOn: z.array(TestCaseIdSchema).optional(),
});
export type TestPlanCase = z.infer<typeof TestPlanCaseSchema>;

/** FHIR `TestPlan.dependency`: a precondition, and optionally a plan that must pass first. */
export const TestPlanDependencySchema = z.strictObject({
  description: z.string().min(1),
  predecessor: TestPlanIdSchema.optional(),
});

/** `path/to/file.dmn#Decision_Id` — the spelling every BPMN gateway here uses. */
export const DmnRefSchema = z
  .string()
  .regex(/^[^#\s]+\.dmn#[A-Za-z_][A-Za-z0-9_.-]*$/, "a DMN reference is `file.dmn#Decision_Id`");

export const TestPlanExitCriteriaSchema = z.strictObject({
  /** The certification rule, executable. */
  decision: DmnRefSchema,
  /** A reader's summary of it. Never the rule itself — the DMN is. */
  description: z.string().min(1).optional(),
});

export const TestPlanSchema = z
  .strictObject({
    $schema: z.enum(TEST_PLAN_SCHEMA_IDS),
    id: TestPlanIdSchema,
    title: z.string().min(1),
    status: TestPlanStatusSchema,
    /** The PLAN's version — a run records which one it executed. */
    version: z.string().min(1),
    description: z.string().min(1).optional(),
    scope: TestPlanScopeSchema,
    /** What the plan is evidence FOR. At least one: a plan tied to no requirement certifies nothing. */
    requirements: z.array(RequirementRefSchema).min(1),
    testCases: z.array(TestPlanCaseSchema).min(1),
    dependencies: z.array(TestPlanDependencySchema).default([]),
    exitCriteria: TestPlanExitCriteriaSchema,
  })
  .superRefine((p, ctx) => {
    // 1. Unique case ids; unique assertion ids within a case.
    const ids = new Set<string>();
    p.testCases.forEach((c, i) => {
      if (ids.has(c.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["testCases", i, "id"],
          message: `test case \`${c.id}\` appears twice — a verdict keyed by it would be ambiguous`,
        });
      }
      ids.add(c.id);
      const seen = new Set<string>();
      c.assertions.forEach((a, j) => {
        if (seen.has(a.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["testCases", i, "assertions", j, "id"],
            message: `assertion \`${a.id}\` appears twice in case \`${c.id}\``,
          });
        }
        seen.add(a.id);
      });
    });

    // 2. dependsOn resolves to a sibling, never self, and is acyclic.
    const edges = new Map<string, string[]>();
    p.testCases.forEach((c, i) => {
      for (const d of c.dependsOn ?? []) {
        if (d === c.id) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["testCases", i, "dependsOn"], message: `case \`${c.id}\` depends on itself` });
        } else if (!ids.has(d)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["testCases", i, "dependsOn"],
            message: `case \`${c.id}\` depends on \`${d}\`, which is not a case in this plan`,
          });
        }
      }
      edges.set(c.id, (c.dependsOn ?? []).filter((d) => d !== c.id && ids.has(d)));
    });
    const cycle = findCycle(edges);
    if (cycle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["testCases"],
        message: `test cases depend on each other in a cycle (${cycle.join(" → ")}) — no order executes them`,
      });
    }

    // 5. Under v1.1, every case names its `.feature`.
    if (p.$schema === TEST_PLAN_SCHEMA_ID) {
      p.testCases.forEach((c, i) => {
        if (c.feature === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["testCases", i, "feature"],
            message: `case \`${c.id}\` names no \`.feature\` — under ${TEST_PLAN_SCHEMA_ID} every case is written in Gherkin`,
          });
        }
      });
    }

    // 3. A plan is not its own predecessor.
    p.dependencies.forEach((d, i) => {
      if (d.predecessor === p.id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dependencies", i, "predecessor"], message: `plan \`${p.id}\` names itself as its predecessor` });
      }
    });
  });
export type TestPlan = z.infer<typeof TestPlanSchema>;

/**
 * What a parsed plan still carries from an older version — empty for a
 * current plan. Today that is one thing: a `test-plan/v1` case with no
 * `.feature`. Warnings, not errors: the plan parsed.
 */
export function testPlanDeprecations(plan: TestPlan): string[] {
  if (plan.$schema === TEST_PLAN_SCHEMA_ID) return [];
  const missing = plan.testCases.filter((c) => c.feature === undefined).map((c) => c.id);
  return [
    `declares ${plan.$schema}, which is deprecated — write ${TEST_PLAN_SCHEMA_ID}`,
    ...(missing.length > 0 ? [`case(s) ${missing.map((m) => `\`${m}\``).join(", ")} name no \`.feature\` — required from ${TEST_PLAN_SCHEMA_ID}`] : []),
  ];
}

/** A cycle in `edges`, as the ids along it, or `undefined`. */
function findCycle(edges: Map<string, string[]>): string[] | undefined {
  const state = new Map<string, 1 | 2>(); // 1 on stack, 2 done
  const stack: string[] = [];
  const visit = (n: string): string[] | undefined => {
    state.set(n, 1);
    stack.push(n);
    for (const m of edges.get(n) ?? []) {
      if (state.get(m) === 1) return [...stack.slice(stack.indexOf(m)), m];
      if (!state.has(m)) {
        const c = visit(m);
        if (c) return c;
      }
    }
    stack.pop();
    state.set(n, 2);
    return undefined;
  };
  for (const n of edges.keys()) {
    if (!state.has(n)) {
      const c = visit(n);
      if (c) return c;
    }
  }
  return undefined;
}
