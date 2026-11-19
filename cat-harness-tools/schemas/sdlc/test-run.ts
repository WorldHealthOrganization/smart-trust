/**
 * A TEST RUN — what was measured, with what, and whether it can be redone:
 * repeatable, hashable test data and processes.
 *
 * ## Two hashes
 *
 * A result is evidence only if a third party can establish **what was
 * tested** and **with what**:
 *
 * - the **data** hash — this exact data set produced this result;
 * - the **process** hash — this exact runner, scenario bank and
 *   configuration produced this result.
 *
 * One hash would let a change to the judge, or to the subject, go unseen.
 *
 * ## The two bases must be disjoint
 *
 * If a file feeds both hashes then changing it moves both, and the pair
 * carries no more information than one hash would. {@link buildTestRun}
 * refuses such a run.
 *
 * ## `unknown` is never equal to `unknown`
 *
 * Following `sourceHashOf` in `scripts/qa-results.ts`: an unreadable input
 * is reported as {@link UNKNOWN_HASH} rather than hashed as empty, because a
 * hash of nothing compares equal to every other hash of nothing.
 *
 * {@link hashesReproduce} therefore treats `unknown` as reproducing NOTHING,
 * including another `unknown`: two runs that both failed to read their inputs
 * have not been shown to agree.
 *
 * ## Whole-file hashing over-invalidates, which is the safe direction
 *
 * A runner's run-affecting parts cannot be separated from its comments
 * without parsing it, and a parser that got it wrong would under-invalidate.
 * So a basis hashes whole files: editing a comment in a runner moves the
 * process hash. Over-invalidation says "changed" when it may not have;
 * under-invalidation says "same" when it is not. Prefer a separate
 * configuration file over a constant in the runner where the distinction
 * matters.
 *
 * ## What this does NOT do
 *
 * **Signing.** It needs a key and an identity that differ per deployment (a
 * sovereign-cloud jurisdiction may require its own); the topology axes say
 * which, and signing is separate work.
 *
 * @module schemas/test-run
 * @graphNode schema
 */
import { z } from "zod";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SkillNameSchema } from "../tools/tool-types";

import { RequirementRefSchema } from "@litlfred/bootstrap-tools/schemas/requirement.ts";
import { ModelIdSchema } from "@litlfred/bootstrap-tools/schemas/model-registry.ts";
import { NETWORK_REACHES, REACH_UNKNOWN } from "../process/actor-reach";
import { SutKindSchema } from "./test-plan";
import { inputSiteReached } from "./input-trace.ts";

const RunContextRefFieldSchema = z
  .object({
    sha256: z.string().regex(/^[0-9a-f]{64}$/, "a sha256 digest is 64 lowercase hex characters"),
  })
  .strict();

/** The `$schema` tag every test run carries. */
export const TEST_RUN_SCHEMA_ID = "folio-test-run/v1";

/**
 * What a hash says when an input could not be read.
 *
 * A determined value and an absent one must not render identically, so this
 * is a distinct token rather than an empty-string hash.
 */
export const UNKNOWN_HASH = "unknown";

/**
 * A hash together with WHAT IT IS OVER.
 *
 * The inputs are carried, not just the digest. A bare hash cannot be
 * checked, cannot be re-derived by a third party, and cannot be shown
 * disjoint from another — which is the whole point of having two.
 */
export const HashBasisSchema = z.object({
  /** 12-char SHA-256 prefix over the inputs in listed order, or `unknown`. */
  hash: z.string().min(1),
  /** Repo-relative paths, sorted. Never empty: a hash over nothing is not a hash. */
  inputs: z.array(z.string().min(1)).min(1),
});
export type HashBasis = z.infer<typeof HashBasisSchema>;

/**
 * One case the run exercised: what went in and what came out, as the skill's
 * own contract names them.
 *
 * Recorded so the run can be checked AGAINST that contract (#1168, B4) — a
 * run whose cases do not fit the skill's input and output schemas measured
 * something other than the skill it claims to test.
 */
export const TestCaseSchema = z.object({
  input: z.unknown(),
  output: z.unknown(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

/**
 * WHICH PLAN a run executed, and which version of it (bean `ygzh`).
 *
 * The run points at the plan; the plan names no run. Plans are reused across
 * runs and systems, so a back-pointer would make every execution rewrite an
 * authored `test-plan/v1` node — content turned into live state. The version
 * is required because a plan's cases change, and a verdict on case `c3` of
 * plan v1 says nothing about `c3` of v2.
 */
export const TestPlanRefSchema = z.strictObject({
  /** The plan's `id` (`test-plan/v1`). */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a test-plan id is a lowercase slug"),
  /** The plan's `version` at execution time. */
  version: z.string().min(1),
});
export type TestPlanRef = z.infer<typeof TestPlanRefSchema>;

/**
 * The SYSTEM UNDER TEST — who was tested, at what version, with what reach.
 *
 * `actor` is an id under `cat-harness/scenarios/actors/` (or the best name
 * available; resolving it is `kg-audit`'s job, not the schema's). `reach` is
 * the actor's network reach in the ONE vocabulary `actor-reach.ts` reuses
 * from the deployment level, plus its third state: `unknown` is a value here
 * because a run must say it did not know, and an absent field would read the
 * same as "not relevant".
 */
const SutBase = {
  actor: z.string().min(1),
  version: z.string().min(1),
  reach: z.enum([...NETWORK_REACHES, REACH_UNKNOWN]),
};

/**
 * `kind` is the actor's own system-under-test kind (`SUT_KINDS` in
 * `test-plan.ts`), so a plan's scope, an actor's facet and a run are read in
 * ONE vocabulary. Owner, 2026-10-30, FR-002 card, option A ("Model only if it
 * is a model"): an `agent` is a model run in a configuration, so it names the
 * model (`ModelIdSchema`, as the runtime reports it) and the configuration
 * (`harness` with the harness's skills loaded, `bare` without, or another
 * named one), and a record that leaves either out is refused. Every other
 * kind runs deterministic code and names no model; a model on it is refused
 * too, because the field would claim something that did not run
 * (`req:model-benchmark#system-names-model`).
 */
export const SutRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("agent"),
    ...SutBase,
    model: ModelIdSchema,
    configuration: z.string().regex(/^[a-z][a-z0-9-]*$/, "a configuration name such as harness or bare"),
  }),
  z.strictObject({ kind: SutKindSchema.exclude(["agent"]), ...SutBase }),
]);
export type SutRef = z.infer<typeof SutRefSchema>;

export const TestRunSchema = z
  .object({
  $schema: z.literal(TEST_RUN_SCHEMA_ID),
  /**
   * The skill this run tests, by name.
   *
   * The run points at the skill; the skill names no test (#1168, B4,
   * data-modelling step 8). Tests come and go and a skill's contract does
   * not, so the pointer lives on the run. `kg-audit` resolves it
   * (`test-run-skill-resolves`) and checks each case against the skill's
   * contract (`test-run-conforms`).
   *
   * @ref SkillDefinitionSchema
   */
  skill: SkillNameSchema,
  /** What this run measured, for a reader who has only the file. */
  subject: z.string().min(1),
  /** WHAT was tested. */
  data: HashBasisSchema,
  /** WHAT TESTED IT — runner, configuration, scenario bank. */
  process: HashBasisSchema,
  /** The measurements themselves, in whatever shape the runner records. */
  outcome: z.record(z.string(), z.unknown()),
  /**
   * The cases, when the runner records them. Absent is a real state: a run
   * that only records aggregates cannot be checked against the contract, and
   * `test-run-conforms` says so rather than passing it.
   */
  cases: z.array(TestCaseSchema).optional(),
  /**
   * WHICH REQUIREMENTS THIS RUN CHECKS — owner, 2026-09-23 (issue #1164):
   * *"put requirements in Test schema as array"*, as REFERENCES
   * (`req:<slug>` or `req:<slug>#<statement-key>`), never copies: the
   * requirement's text lives in one place, and a copy in every run is a copy
   * free to disagree with it.
   *
   * The test points at the requirement, not the reverse — the same direction
   * as `skill` above. See `bootstrap/schemas/requirement.schema.json` (Zod
   * source: `bootstrap-tools/schemas/requirement.ts`). Optional so that a run
   * recorded before the field existed still parses; a new run should say what
   * it is evidence FOR.
   */
  requirements: z.array(RequirementRefSchema).optional(),
  /**
   * ISO-8601 UTC. Deliberately NOT part of either hash: when a run happened
   * is not what makes it reproducible, and including it would make every
   * run differ from every other by construction.
   */
  updated_at: z.string().min(1),
  /**
   * The plan this run executed (bean `ygzh`). Optional: a run recorded before
   * plans existed — `crdm-detect-eval` — tested a skill directly, and still
   * parses.
   */
  plan: TestPlanRefSchema.optional(),
  /** The system under test (bean `ygzh`). Required whenever `plan` is set. */
  sut: SutRefSchema.optional(),
  /**
   * Content-addressed reference to the `folio-run-context/v1` record of this
   * test run (`docs/proposals/tool-releases-2026-10-07.md`, owner C1 = a).
   */
  runContext: RunContextRefFieldSchema.optional(),
  })
  .superRefine((r, ctx) => {
    // A plan is executed AGAINST something. A run naming a plan and no system
    // under test is a certification-shaped record with its subject missing.
    if (r.plan !== undefined && r.sut === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sut"],
        message: `run executes plan \`${r.plan.id}\` but names no system under test — a plan is run AGAINST something, and the record must say what`,
      });
    }
  });
export type TestRun = z.infer<typeof TestRunSchema>;

/**
 * Hash a set of files, reporting `unknown` if any one cannot be read.
 *
 * All-or-nothing, deliberately. Hashing the readable subset would produce a
 * confident digest over a different input set than the one recorded in
 * `inputs`, which is worse than no answer: the file would claim a basis it
 * does not have.
 */
export function hashBasis(root: string, paths: string[]): HashBasis {
  const inputs = [...paths].sort();
  const h = createHash("sha256");
  for (const p of inputs) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(join(root, p));
    } catch {
      return { hash: UNKNOWN_HASH, inputs };
    }
    // The path goes in as well as the contents: two files swapping names is
    // a different input set, and content-only hashing would call it the same.
    h.update(p).update("\0").update(bytes).update("\0");
  }
  return { hash: h.digest("hex").slice(0, 12), inputs };
}

/** The paths feeding both bases — empty when the two are independent. */
export function basisOverlap(a: HashBasis, b: HashBasis): string[] {
  const inB = new Set(b.inputs);
  return a.inputs.filter((p) => inB.has(p));
}

/** Thrown when a run's two hashes are not independent. */
export class TestRunBasisError extends Error {
  constructor(readonly overlap: string[]) {
    super(
      `a test run's data and process hashes must be independent, but ` +
        `${overlap.length} input${overlap.length === 1 ? "" : "s"} feed both: ` +
        `${overlap.join(", ")}. A file in both bases moves both hashes ` +
        `together, so the pair carries no more than one hash would. Move it ` +
        `to whichever question it actually answers — what was tested, or ` +
        `what tested it.`,
    );
    this.name = "TestRunBasisError";
  }
}

/**
 * Assemble a run. Pure apart from reading the files it hashes.
 *
 * Refuses a run whose bases overlap — see the module note. The refusal is at
 * construction rather than in a later check because a recorded run with
 * dependent hashes is indistinguishable, afterwards, from one with
 * independent ones.
 */
export function buildTestRun(args: {
  root: string;
  skill: string;
  subject: string;
  dataInputs: string[];
  processInputs: string[];
  outcome: Record<string, unknown>;
  cases?: TestCase[];
  plan?: TestPlanRef;
  sut?: SutRef;
  now?: Date;
}): TestRun {
  const data = hashBasis(args.root, args.dataInputs);
  const process = hashBasis(args.root, args.processInputs);
  const overlap = basisOverlap(data, process);
  if (overlap.length) throw new TestRunBasisError(overlap);
  // input-site: traced #da3af1f9 — stamps a test-run record when the caller gives no time
  inputSiteReached("test-run: clock");
  const updatedAt = (args.now ?? new Date()).toISOString();
  return {
    $schema: TEST_RUN_SCHEMA_ID,
    skill: args.skill,
    subject: args.subject,
    data,
    process,
    outcome: args.outcome,
    ...(args.cases === undefined ? {} : { cases: args.cases }),
    updated_at: updatedAt,
    ...(args.plan === undefined ? {} : { plan: args.plan }),
    ...(args.sut === undefined ? {} : { sut: args.sut }),
  };
}

/** Which half of a pair of runs reproduced, for a reader and for a test. */
export interface Reproduction {
  data: boolean;
  process: boolean;
  /** Both halves reproduced. Never true when either hash is `unknown`. */
  both: boolean;
}

/**
 * Whether `current` was produced from the same data and the same process.
 *
 * `unknown` reproduces nothing, INCLUDING another `unknown`: two runs that
 * both failed to read their inputs have not been shown to agree. See the
 * module note.
 */
export function hashesReproduce(prior: TestRun, current: TestRun): Reproduction {
  const same = (a: string, b: string) => a !== UNKNOWN_HASH && a === b;
  const data = same(prior.data.hash, current.data.hash);
  const process = same(prior.process.hash, current.process.hash);
  return { data, process, both: data && process };
}
