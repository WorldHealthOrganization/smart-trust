/**
 * Test data sets (fixed and generated) and SME review case/verdict pairs.
 *
 * @module schemas/test-data
 * @graphNode schema
 *
 * ## Fixed and generated sets are separate node kinds
 *
 * A test plan (`test-plan/v1`, `schemas/sdlc/test-plan.ts`) binds each case to test
 * data of one of two kinds, and the two do NOT have the same audit standing:
 *
 * - **Fixed (`test-data-fixed/1.0.0`)** — small, curated or hand-authored
 *   records committed to the repository, cited to a source or guideline where
 *   applicable, and reviewed by an SME when they exercise domain logic. Once
 *   reviewed (`review` present, or backed by `sme-case-verdict/1.0.0` pairs),
 *   a fixed set is usable as certification evidence (`isEvidence` in
 *   `schemas/sdlc/test-plan.ts`).
 * - **Generated (`test-data-generated/1.0.0`)** — a deterministic recipe
 *   (`contentType`, `specialisation`, `template`, `params`, `seed`, and the
 *   canonical `sha256` digest of that recipe). It is **never stored
 *   materialised**: a test run synthesises the records from the recipe at
 *   execution time and records the recipe's digest on `folio-test-run/v1`,
 *   so no generated file can be hand-patched away from its generator.
 *
 * The two kinds live in separately declared graph directories
 * (`test-data-fixed` vs `test-data-generated`), AND each file carries both its
 * versioned `$schema` tag and an explicit `kind: "fixed" | "generated"`
 * discriminator. A consumer (`discriminateTestDataSet`) tells which it is
 * reading from the **file content**, never from the directory path.
 *
 * ## Per-content-type specialisation
 *
 * How a recipe synthesises records or how a fixed set's payload is structured
 * depends on the folio's `contentType`. The general curation workflow
 * (`sdlc/processes/test-data-curation.bpmn`) delegates the content-type step
 * to a called subprocess (`specialisation`):
 *
 * - `"fhir-templating"` (`FHIR_TEMPLATING_SPECIALISATION`) is **one named
 *   specialisation** for FHIR IG / DAK content (MeasureReport cohorts, bundle
 *   templates, questionnaire responses).
 * - Other content types supply their own specialisations (e.g.
 *   `"markdown-fixture"` for document folios, `"lean-counterexample"` for
 *   formal-proof folios, `"tabular-cohort"` for epidemiological tables).
 *
 * Nothing in this schema hardcodes FHIR resources or DAK fields at the platform
 * layer.
 *
 * ## SME review of decision support and indicator definitions
 *
 * For domain logic — clinical or scientific decision-support rules and
 * indicator definitions — "passing" means a subject-matter expert agrees the
 * output on a realistic case or cohort is right. That requires two distinct
 * units of review under one `sme-case-verdict/1.0.0` node kind, discriminated
 * by `subjectKind`:
 *
 * - **`"decision-support"`** — the unit of review is a **worked case**
 *   (`case`: input state, `decisionLogicRef`, `systemOutput`, optional
 *   `expectedGuidance`).
 * - **`"indicator-definition"`** — the unit of review is a **cohort plus an
 *   expected value** (`cohort`: `indicatorRef`, `populationSize`, `inputs`,
 *   `expectedValue`, `computedValue`, optional `period`, `numerator`,
 *   `denominator`).
 *
 * Every `sme-case-verdict/1.0.0` node records the **SME's attributable human
 * identity** (`reviewer`: `kind: "human"`, `provider`, `handle`, `role`) and
 * the **review date** (`reviewedAt`), because a review without them is not
 * audited. The review is governed by `sdlc/processes/sme-test-data-review.bpmn`,
 * where the SME sits in a lane whose role (`clinical-sme`) is
 * `judgementOnly: true` — no procedure yields the answer.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

import { nodeKind } from "../kg/node-kind";
import type { TestDataRef } from "./test-plan";

// ── Schema tags & common identifiers ────────────────────────────────────────

export const FIXED_TEST_DATA_SET_SCHEMA_ID = "test-data-fixed/1.0.0" as const;
export const GENERATED_TEST_DATA_SET_SCHEMA_ID = "test-data-generated/1.0.0" as const;
export const SME_CASE_VERDICT_SCHEMA_ID = "sme-case-verdict/1.0.0" as const;

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const ISO_DATE_OR_DATETIME = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/;

export const TestDataSetIdSchema = z.string().regex(SLUG, "a test data set id is a lowercase slug");
export type TestDataSetId = z.infer<typeof TestDataSetIdSchema>;

export const TestDataContentTypeSchema = z.string().regex(SLUG, "contentType is a lowercase slug");
export type TestDataContentType = z.infer<typeof TestDataContentTypeSchema>;

/**
 * Named content-type specialisation identifier.
 *
 * `FHIR_TEMPLATING_SPECIALISATION` (`"fhir-templating"`) is one specialisation
 * for FHIR IG / DAK content, named as such rather than baked in as the design.
 */
export const FHIR_TEMPLATING_SPECIALISATION = "fhir-templating" as const;
export const TEST_DATA_SPECIALISATION_EXAMPLES = [
  FHIR_TEMPLATING_SPECIALISATION,
  "markdown-fixture",
  "lean-counterexample",
  "tabular-cohort",
] as const;

export const TestDataSpecialisationSchema = z
  .string()
  .regex(SLUG, "specialisation is a lowercase slug naming the content-type subprocess");
export type TestDataSpecialisation = z.infer<typeof TestDataSpecialisationSchema>;

export const ReviewedAtSchema = z
  .string()
  .regex(ISO_DATE_OR_DATETIME, "reviewedAt must be an ISO-8601 date (YYYY-MM-DD) or timestamp");

// ── SME identity & case/verdict pair (`folio-assistant-vljz`) ───────────────

/**
 * Attributable human SME identity (`bean vljz`).
 *
 * Restricted to `kind: "human"`: an SME review of decision support or an
 * indicator definition is a subject-matter judgement that no script or agent
 * can supply.
 */
export const SmeReviewerIdentitySchema = z
  .object({
    kind: z.literal("human"),
    /** Identity authority, e.g. `"github"`, `"orcid"`, `"institutional-sso"`. */
    provider: z.string().min(1),
    /** Attributable account handle or identifier at `provider`. */
    handle: z.string().min(1),
    /** Optional human-readable display name. */
    displayName: z.string().min(1).optional(),
    /** Role under which the SME reviewed the case/cohort (e.g. `"clinical-sme"`). */
    role: z.string().regex(SLUG, "role is a lowercase role id"),
    /** Optional declared actor id from `scenarios/actors/`. */
    actor: z.string().regex(SLUG, "actor is a lowercase actor id").optional(),
  })
  .strict();
export type SmeReviewerIdentity = z.infer<typeof SmeReviewerIdentitySchema>;

export const SME_VERDICT_OUTCOMES = ["pass", "fail", "needs-revision"] as const;
export const SmeVerdictOutcomeSchema = z.enum(SME_VERDICT_OUTCOMES);
export type SmeVerdictOutcome = z.infer<typeof SmeVerdictOutcomeSchema>;

export const SME_SUBJECT_KINDS = ["decision-support", "indicator-definition"] as const;
export const SmeSubjectKindSchema = z.enum(SME_SUBJECT_KINDS);
export type SmeSubjectKind = z.infer<typeof SmeSubjectKindSchema>;

/**
 * Unit of SME review for decision support: a **worked case** (`bean vljz`).
 */
export const DecisionSupportWorkedCaseSchema = z
  .object({
    /** Case id within the fixed test data set. */
    id: z.string().regex(SLUG, "case id is a lowercase slug"),
    /** Domain narrative summary of the worked scenario. */
    summary: z.string().min(1),
    /** Decision table, rule, or logic under review. */
    decisionLogicRef: z.string().min(1),
    /** Structured case input (subject state, observations, context). */
    input: z.record(z.string(), z.unknown()),
    /** Output produced by the decision logic under review. */
    systemOutput: z.unknown(),
    /** Expected domain guidance or action as stated by the SME or source guideline. */
    expectedGuidance: z.unknown().optional(),
  })
  .strict();
export type DecisionSupportWorkedCase = z.infer<typeof DecisionSupportWorkedCaseSchema>;

/**
 * Unit of SME review for indicator definitions: a **cohort plus an expected
 * value** (`bean vljz`).
 */
export const IndicatorCohortCaseSchema = z
  .object({
    /** Cohort id within the fixed test data set. */
    id: z.string().regex(SLUG, "cohort id is a lowercase slug"),
    /** Domain summary of the cohort and measurement window. */
    summary: z.string().min(1),
    /** Indicator definition under review. */
    indicatorRef: z.string().min(1),
    /** Number of subjects / records in the cohort (`>= 1`). */
    populationSize: z.number().int().min(1),
    /** Optional reporting period (e.g. `"2026-Q1"` or ISO interval). */
    period: z.string().min(1).optional(),
    /** Cohort member records or stratified aggregate inputs. */
    inputs: z.union([z.array(z.unknown()).min(1), z.record(z.string(), z.unknown())]),
    /** Expected indicator value determined by SME domain judgement. */
    expectedValue: z.unknown(),
    /** Indicator value computed by the definition under review. */
    computedValue: z.unknown(),
    /** Optional expected/observed numerator for ratio or proportion indicators. */
    numerator: z.number().optional(),
    /** Optional expected/observed denominator for ratio or proportion indicators. */
    denominator: z.number().optional(),
  })
  .strict();
export type IndicatorCohortCase = z.infer<typeof IndicatorCohortCaseSchema>;

/**
 * Node kind for an SME review case/verdict pair (`sme-case-verdict/1.0.0`,
 * `bean vljz`).
 *
 * Enforces that:
 * 1. `"decision-support"` carries a worked `case` and no `cohort`.
 * 2. `"indicator-definition"` carries a `cohort` (with `expectedValue` and
 *    `computedValue`) and no `case`.
 * 3. `reviewer` (attributable human SME) and `reviewedAt` (ISO date/timestamp)
 *    are always present.
 */
export const SmeCaseVerdictKind = nodeKind(
  SME_CASE_VERDICT_SCHEMA_ID,
  [],
  {
    id: z.string().regex(SLUG, "verdict id is a lowercase slug"),
    /** The fixed test data set (`test-data-fixed/1.0.0`) this case or cohort belongs to. */
    dataSetRef: TestDataSetIdSchema,
    /** Whether this review judges a decision-support worked case or an indicator cohort. */
    subjectKind: SmeSubjectKindSchema,
    /** Present when `subjectKind === "decision-support"`. */
    case: DecisionSupportWorkedCaseSchema.optional(),
    /** Present when `subjectKind === "indicator-definition"`. */
    cohort: IndicatorCohortCaseSchema.optional(),
    /** The SME's judgement on the worked case or cohort. */
    verdict: SmeVerdictOutcomeSchema,
    /** Domain rationale explaining why the output is clinically/scientifically right or wrong. */
    rationale: z.string().min(1),
    /** Attributable human SME identity (`bean vljz`). */
    reviewer: SmeReviewerIdentitySchema,
    /** Date or timestamp when the SME recorded this review (`bean vljz`). */
    reviewedAt: ReviewedAtSchema,
    /** Optional `req:<id>` requirement references this case/verdict pair is evidence for. */
    requirements: z.array(z.string().regex(/^req:[a-z0-9][a-z0-9-]*$/)).optional(),
  },
  {
    strict: true,
    refine: (val, ctx) => {
      if (val.subjectKind === "decision-support") {
        if (val.case === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["case"],
            message: 'subjectKind "decision-support" requires a worked `case`',
          });
        }
        if (val.cohort !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cohort"],
            message: 'subjectKind "decision-support"is reviewed per worked `case`, not `cohort`',
          });
        }
      } else if (val.subjectKind === "indicator-definition") {
        if (val.cohort === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cohort"],
            message: 'subjectKind "indicator-definition" requires a `cohort` plus expected value',
          });
        }
        if (val.case !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["case"],
            message: 'subjectKind "indicator-definition" is reviewed per `cohort`, not worked `case`',
          });
        }
      }
    },
  },
);

export const SmeTestCaseVerdictSchema = SmeCaseVerdictKind.schema;
export type SmeTestCaseVerdict = z.infer<typeof SmeTestCaseVerdictSchema>;

// ── Fixed & generated test data sets (`folio-assistant-vm6m`) ───────────────

/**
 * Shared base mixin for test data sets (`test-data-fixed` and
 * `test-data-generated`).
 */
export const TestDataSetBaseKind = nodeKind("test-data-set", [], {
  id: TestDataSetIdSchema,
  title: z.string().min(1),
  version: z.string().min(1),
  contentType: TestDataContentTypeSchema,
  specialisation: TestDataSpecialisationSchema.optional(),
  description: z.string().min(1).optional(),
});

export const FixedTestDataRecordSchema = z
  .object({
    id: z.string().regex(SLUG, "record id is a lowercase slug"),
    summary: z.string().min(1).optional(),
    payload: z.unknown(),
    expected: z.unknown().optional(),
  })
  .strict();
export type FixedTestDataRecord = z.infer<typeof FixedTestDataRecordSchema>;

export const FixedSetReviewMetadataSchema = z
  .object({
    reviewer: SmeReviewerIdentitySchema,
    reviewedAt: ReviewedAtSchema,
    verdictRefs: z.array(z.string().regex(SLUG)).optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();
export type FixedSetReviewMetadata = z.infer<typeof FixedSetReviewMetadataSchema>;

/**
 * Fixed test data set node kind (`test-data-fixed/1.0.0`, `bean vm6m`).
 *
 * Lives in a declared `test-data-fixed` graph directory and self-identifies
 * via `$schema: "test-data-fixed/1.0.0"` and `kind: "fixed"`. Strict: recipe
 * fields (`template`, `params`, `seed`, `sha256`) are refused.
 */
export const FixedTestDataSetKind = nodeKind(
  FIXED_TEST_DATA_SET_SCHEMA_ID,
  [TestDataSetBaseKind],
  {
    kind: z.literal("fixed"),
    /** Committed, curated records (`>= 1`). */
    records: z.array(FixedTestDataRecordSchema).min(1),
    /** Optional source or guideline citations for the curated records. */
    citations: z.array(z.string().min(1)).optional(),
    /** Optional SME review sign-off metadata making this set usable as audit evidence. */
    review: FixedSetReviewMetadataSchema.optional(),
  },
  { strict: true },
);

export const FixedTestDataSetSchema = FixedTestDataSetKind.schema;
export type FixedTestDataSet = z.infer<typeof FixedTestDataSetSchema>;

/**
 * Generated test data set node kind (`test-data-generated/1.0.0`, `bean vm6m`).
 *
 * Lives in a declared `test-data-generated` graph directory and self-identifies
 * via `$schema: "test-data-generated/1.0.0"` and `kind: "generated"`.
 *
 * Records the generation recipe (`specialisation`, `template`, `params`,
 * `seed`, and canonical `sha256` digest) and **never** stores materialised
 * records (`records`, `cases`, `path`, `review` are refused by `.strict()`).
 */
export const GeneratedTestDataSetKind = nodeKind(
  GENERATED_TEST_DATA_SET_SCHEMA_ID,
  [TestDataSetBaseKind],
  {
    kind: z.literal("generated"),
    /**
     * Required on a generated set: names the content-type specialisation
     * subprocess (e.g. `"fhir-templating"` as one named specialisation, not
     * the platform design).
     */
    specialisation: TestDataSpecialisationSchema,
    /** Template path or identifier used to synthesise the data set at run time. */
    template: z.string().min(1),
    /** Parameter map fed to the template/generator. */
    params: z.record(z.string(), z.unknown()),
    /** Deterministic PRNG seed so a run can regenerate the exact set without storing it. */
    seed: z.number().int().nonnegative(),
    /**
     * Canonical SHA-256 hex digest of `{ contentType, specialisation, template, params, seed }`.
     */
    sha256: z.string().regex(SHA256_HEX, "sha256 is 64 lowercase hex chars"),
  },
  {
    overrides: ["specialisation"],
    strict: true,
    refine: (val, ctx) => {
      const expected = computeGeneratedSetDigest({
        contentType: val.contentType,
        specialisation: val.specialisation,
        template: val.template,
        params: val.params,
        seed: val.seed,
      });
      if (val.sha256 !== expected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sha256"],
          message: `sha256 "${val.sha256}" does not match canonical recipe digest "${expected}"`,
        });
      }
    },
  },
);

export const GeneratedTestDataSetSchema = GeneratedTestDataSetKind.schema;
export type GeneratedTestDataSet = z.infer<typeof GeneratedTestDataSetSchema>;

export const TestDataSetSchema = z.union([FixedTestDataSetSchema, GeneratedTestDataSetSchema]);
export type TestDataSet = z.infer<typeof TestDataSetSchema>;

// ── Deterministic recipe hashing & content-based discrimination ─────────────

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, canonicalizeValue(v)]));
  }
  return value;
}

/**
 * Compute the deterministic 64-hex SHA-256 digest of a generated data set's
 * recipe (`contentType`, `specialisation`, `template`, `params`, `seed`).
 *
 * Key order inside `params` is canonicalized so two equivalent parameter maps
 * produce the identical digest.
 */
export function computeGeneratedSetDigest(recipe: {
  contentType: string;
  specialisation: string;
  template: string;
  params: Record<string, unknown>;
  seed: number;
}): string {
  const canonical = JSON.stringify(
    canonicalizeValue({
      contentType: recipe.contentType,
      specialisation: recipe.specialisation,
      template: recipe.template,
      params: recipe.params,
      seed: recipe.seed,
    }),
  );
  return createHash("sha256").update(canonical, "utf-8").digest("hex");
}

/**
 * Verify that a generated data set's `sha256` matches its canonical recipe digest.
 */
export function verifyGeneratedSetDigest(set: GeneratedTestDataSet): boolean {
  return set.sha256 === computeGeneratedSetDigest(set);
}

/**
 * Discriminate a test data set from its **file content** (`$schema` and `kind`),
 * never from its directory path (`bean vm6m`).
 *
 * Throws a descriptive error if the document is not a valid fixed or generated
 * test data set, or if `$schema` and `kind` disagree.
 */
export function discriminateTestDataSet(
  doc: unknown,
): { kind: "fixed"; set: FixedTestDataSet } | { kind: "generated"; set: GeneratedTestDataSet } {
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("test data set must be a JSON object carrying `$schema` and `kind`");
  }
  const raw = doc as Record<string, unknown>;
  if (raw.kind === "fixed") {
    const set = FixedTestDataSetSchema.parse(doc);
    return { kind: "fixed", set };
  }
  if (raw.kind === "generated") {
    const set = GeneratedTestDataSetSchema.parse(doc);
    return { kind: "generated", set };
  }
  throw new Error(
    `cannot discriminate test data set from file content: expected kind "fixed" (${FIXED_TEST_DATA_SET_SCHEMA_ID}) ` +
      `or "generated" (${GENERATED_TEST_DATA_SET_SCHEMA_ID}), got ${JSON.stringify(raw.kind)}`,
  );
}

/**
 * Bridge a `FixedTestDataSet` or `GeneratedTestDataSet` node to the
 * `TestDataRef` shape embedded in a `test-plan/v1` test case (`schemas/sdlc/test-plan.ts`).
 */
export function toTestDataRef(
  set: FixedTestDataSet | GeneratedTestDataSet,
  fixedOpts?: { path: string },
): TestDataRef {
  if (set.kind === "generated") {
    return {
      kind: "generated",
      template: set.template,
      params: set.params,
      seed: set.seed,
      generator: set.specialisation,
    };
  }
  if (!fixedOpts?.path) {
    throw new Error("converting a fixed test data set to a TestDataRef requires its repo-relative path");
  }
  return {
    kind: "fixed",
    path: fixedOpts.path,
    ...(set.review
      ? {
          review: {
            reviewer: {
              kind: "human" as const,
              id: `${set.review.reviewer.provider}:${set.review.reviewer.handle}`,
            },
            reviewed_at: set.review.reviewedAt,
          },
        }
      : {}),
  };
}
