/**
 * The adjudication contract.
 *
 * @module folio-assistant-core/schemas/adjudication.test
 * @graphNode none — a test
 *
 * Bean `5vo9`. **The load-bearing cases are the refusals**, and one of them is
 * a cross-layer invariant no single file can hold: `mechanical` must never
 * become an adjudicator kind. Core cannot import the harness's `ActorKind`
 * (core `needs` cat-harness, so the import would run the wrong way), which is
 * exactly why the pair has to be pinned by a test rather than by a shared
 * type.
 */
import { describe, expect, it } from "bun:test";

import {
  ADJUDICATION_SCHEMA_TAG,
  ADJUDICATOR_KINDS,
  AdjudicationAssetSchema,
  AdjudicationOutcomeSchema,
  AdjudicationRequestSchema,
  adjudicationDefects,
  type AdjudicationOutcome,
  type AdjudicationRequest,
} from "./adjudication.js";
import { ACTOR_KINDS } from "@litlfred/cat-harness-tools/schemas/process/role-graph.js";

const REQUEST: AdjudicationRequest = {
  $schema: ADJUDICATION_SCHEMA_TAG,
  id: "adj-1",
  assets: [{ ref: "library/x", state: "referenced" }],
  prompt: "Do the checker and the reviewer disagree about the same thing?",
  codes: [
    { code: "stands", means: "the finding stands" },
    { code: "scope", means: "the criterion does not apply here" },
    { code: "dispensation", means: "it applies, and this is a stated exception" },
  ],
};

const OUTCOME: AdjudicationOutcome = {
  $schema: ADJUDICATION_SCHEMA_TAG,
  request: "adj-1",
  code: "stands",
  codes: ["stands", "scope", "dispensation"],
  reasoning: "Both read the same revision; the finding is about the text, not the version.",
  by: { id: "untainted-adjudicator", kind: "agent", model: "claude-opus-5" },
  at: "2026-09-23",
};

describe("who may adjudicate", () => {
  it("excludesMechanicalKinds", () => {
    // The owner: "ONLY agentic human actor". `system` is this repository's
    // name for the mechanical kind. A judgement a script can perform is a
    // rule, and a rule belongs behind a `folio:decision` gateway.
    expect(ADJUDICATOR_KINDS as readonly string[]).not.toContain("system");
    expect(ADJUDICATOR_KINDS as readonly string[]).not.toContain("external");
  });

  it("usesHarnessActorKinds", () => {
    // Without this the test above is vacuous — it would pass just as well if
    // the names were invented and excluded nothing. It caught exactly that:
    // the first draft read ["human", "agentic"], a second spelling of a
    // concept `skill-package.ts` already names, which is the failure that
    // module's docstring records paying for once already.
    for (const k of ADJUDICATOR_KINDS) {
      expect(ACTOR_KINDS as readonly string[], `adjudicator kind \`${k}\` is unknown to the harness`).toContain(k);
    }
    for (const k of ["system", "external"]) {
      expect(ACTOR_KINDS as readonly string[], `\`${k}\` is not a harness kind, so excluding it is vacuous`).toContain(k);
    }
  });

  it("matchesBpmnAdjudicatorStep", () => {
    // `<folio:fulfilment kinds="person agent"/>` on A_Adjudicate. The contract and
    // the diagram must not disagree about who may adjudicate, and the diagram got
    // there first.
    expect([...ADJUDICATOR_KINDS].sort()).toEqual(["agent", "person"]);
  });

  it("agentAdjudicatorNamesModel", () => {
    const noModel = { ...OUTCOME, by: { id: "a", kind: "agent" as const } };
    expect(AdjudicationOutcomeSchema.safeParse(noModel).success).toBe(false);
    const person = { ...OUTCOME, by: { id: "litlfred", kind: "person" as const } };
    expect(AdjudicationOutcomeSchema.safeParse(person).success).toBe(true);
  });
});

describe("the request", () => {
  it("acceptsWorkedRequest", () => {
    expect(AdjudicationRequestSchema.safeParse(REQUEST).success).toBe(true);
  });

  it("refusesSinglePermittedAnswer", () => {
    const one = { ...REQUEST, codes: [REQUEST.codes[0]!] };
    expect(AdjudicationRequestSchema.safeParse(one).success).toBe(false);
  });

  it("refusesDuplicateCodeToken", () => {
    const dup = {
      ...REQUEST,
      codes: [...REQUEST.codes, { code: "stands", means: "again" }],
    };
    expect(AdjudicationRequestSchema.safeParse(dup).success).toBe(false);
  });

  it("allowsEmptyAssetsNotMissing", () => {
    // Empty and absent must not differ, which is why `assets` is required and
    // may be `[]` rather than optional.
    expect(AdjudicationRequestSchema.safeParse({ ...REQUEST, assets: [] }).success).toBe(true);
    const { assets: _drop, ...without } = REQUEST;
    expect(AdjudicationRequestSchema.safeParse(without).success).toBe(false);
  });

  it("refusesMisspelledKey", () => {
    expect(AdjudicationRequestSchema.safeParse({ ...REQUEST, prompts: "x" }).success).toBe(false);
  });
});

describe("an asset says where it is, when it is anywhere", () => {
  it("materializedNeedsLocator", () => {
    // Presence asserted without location is the one shape the state rules out.
    expect(AdjudicationAssetSchema.safeParse({ ref: "x", state: "materialized" }).success).toBe(false);
    expect(
      AdjudicationAssetSchema.safeParse({ ref: "x", state: "materialized", at: "library/x/" }).success,
    ).toBe(true);
  });

  it("unknownIsOwnState", () => {
    // Inherited from MATERIALIZATION_STATES on purpose: an adjudicator told "here is
    // the evidence" about bytes nobody can find has been misled.
    expect(AdjudicationAssetSchema.safeParse({ ref: "x", state: "unknown" }).success).toBe(true);
  });
});

describe("the outcome", () => {
  it("acceptsWorkedOutcome", () => {
    expect(AdjudicationOutcomeSchema.safeParse(OUTCOME).success).toBe(true);
    expect(adjudicationDefects(REQUEST, OUTCOME)).toEqual([]);
  });

  it("refusesEmptyReasoning", () => {
    expect(AdjudicationOutcomeSchema.safeParse({ ...OUTCOME, reasoning: "" }).success).toBe(false);
  });

  it("refusesCodeOutsideEnum", () => {
    expect(AdjudicationOutcomeSchema.safeParse({ ...OUTCOME, code: "invented" }).success).toBe(false);
  });

  it("reportsCodeNotPermitted", () => {
    const off = { ...OUTCOME, code: "other", codes: [...OUTCOME.codes, "other"] };
    const d = adjudicationDefects(REQUEST, off);
    expect(d.some((m) => m.includes("not a permitted answer"))).toBe(true);
  });

  it("reportsWrongRequest", () => {
    expect(adjudicationDefects(REQUEST, { ...OUTCOME, request: "adj-2" })[0]).toContain("adj-2");
  });
});

describe("enum drift — the reason an outcome records its own enum", () => {
  it("reportsEnumDrift", () => {
    // The cost the layer split accepts: the enum is written in a diagram and
    // in a record. This is what makes the divergence visible instead of
    // silent — an outcome carrying only its code could not be checked at all.
    const widened: AdjudicationRequest = {
      ...REQUEST,
      codes: [...REQUEST.codes, { code: "refer-up", means: "somebody senior decides" }],
    };
    const d = adjudicationDefects(widened, OUTCOME);
    expect(d.some((m) => m.includes("the enum drifted"))).toBe(true);
    // And it says the outcome is not thereby WRONG — a judgement made under
    // the older contract was legitimate when it was made.
    expect(d.find((m) => m.includes("drifted"))).toContain("not wrong");
  });

  it("reorderingIsNotDrift", () => {
    // Order is not part of the contract; treating it as one would cry wolf.
    const reordered = { ...OUTCOME, codes: ["dispensation", "stands", "scope"] };
    expect(adjudicationDefects(REQUEST, reordered)).toEqual([]);
  });

  it("reportsEveryDefect", () => {
    const bad = { ...OUTCOME, request: "nope", code: "other", codes: ["other", "x"] };
    expect(adjudicationDefects(REQUEST, bad).length).toBeGreaterThan(1);
  });
});

describe("it expresses the adjudication that already exists", () => {
  it("carriesBpmnThreeOutcomes", () => {
    // The test the bean set itself: the generalisation must express the
    // existing diagram unchanged. Flattening the three to bare tokens would
    // drop exactly what distinguishes them, which is why a code carries
    // `means`.
    expect(AdjudicationRequestSchema.safeParse(REQUEST).success).toBe(true);
    expect(REQUEST.codes.map((c) => c.code)).toEqual(["stands", "scope", "dispensation"]);
    for (const c of REQUEST.codes) expect(c.means.length).toBeGreaterThan(0);
  });

  it("canRestrictAdjudicatorView", () => {
    // A contract that always handed over everything would silently undo the
    // untainted-verification epic. The request names its own set, so the
    // artefact simply is not in it.
    const restricted: AdjudicationRequest = {
      ...REQUEST,
      assets: [{ ref: "checker-output", state: "materialized", at: "test/results/x.json" }],
    };
    expect(AdjudicationRequestSchema.safeParse(restricted).success).toBe(true);
    expect(restricted.assets.map((a) => a.ref)).not.toContain("the-artefact");
  });
});

describe("SWE-Debate multi-round debate protocol integration", () => {
  const DEBATE_OUTCOME: AdjudicationOutcome = {
    ...OUTCOME,
    debate: {
      protocol: "swe-debate-v1",
      rounds: [
        {
          round: 1,
          name: "objection-ranking",
          participants: ["L1-formalist", "L2-skeptic", "L3-structural"],
          summary: "L1 ranked highest due to direct theorem quantifier mismatch.",
          proposals: [
            {
              agent: "L1-formalist",
              stance: "da-false-claim",
              argument: "Theorem 2.1 fails under boundary condition x = 0.",
            },
            {
              agent: "L2-skeptic",
              stance: "da-overclaim",
              argument: "Asymptotic claim does not hold on finite samples.",
            },
          ],
        },
        {
          round: 2,
          name: "competitive-refinement",
          participants: ["L1-formalist", "L2-skeptic", "L3-structural"],
          summary: "L1 defended hypothesis against L2 critique; invariant cited.",
          proposals: [
            {
              agent: "L1-formalist",
              stance: "da-false-claim",
              argument: "Boundary condition x = 0 is within stated hypothesis H1.",
              critiques: [
                {
                  targetAgent: "L2-skeptic",
                  point: "L2 focuses on empirical sample size but misses the formal impossibility.",
                  severity: "major",
                },
              ],
            },
          ],
        },
        {
          round: 3,
          name: "discriminator-synthesis",
          participants: ["ADJ-adjudicator"],
          summary: "Adjudicator confirms L1 objection survives rebuttal; L2 objection pre-rebutted by Lemma 1.4.",
        },
      ],
      consensus_reached: true,
      resolved_conflicts: [
        "Resolved conflict between L1 and L2: L1 formal falsification is structural; L2 empirical concern is subsumed.",
      ],
    },
  };

  it("acceptsThreeRoundDebate", () => {
    expect(AdjudicationOutcomeSchema.safeParse(DEBATE_OUTCOME).success).toBe(true);
    expect(adjudicationDefects(REQUEST, DEBATE_OUTCOME)).toEqual([]);
  });

  it("detectsNonSequentialRounds", () => {
    const nonSeq = {
      ...DEBATE_OUTCOME,
      debate: {
        ...DEBATE_OUTCOME.debate!,
        rounds: [
          { ...DEBATE_OUTCOME.debate!.rounds[0]!, round: 1 },
          { ...DEBATE_OUTCOME.debate!.rounds[1]!, round: 3 },
        ],
      },
    };
    const defects = adjudicationDefects(REQUEST, nonSeq);
    expect(defects.some((d) => d.includes("debate rounds not sequential"))).toBe(true);
  });
});
