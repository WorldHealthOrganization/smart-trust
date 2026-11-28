/**
 * The adjudication contract — what a judgement is ASKED and what it ANSWERS.
 *
 * Bean `5vo9`. The owner's specification, 2026-09-23:
 *
 * > input = {set of content assets, question/prompt (markdown), list of
 * > judgement codes}, make a judgement, output = {decision-code (dependent on
 * > context), reasoning = markdown}. IO is materialized or by reference. ONLY
 * > agentic/human actor. indicated non-deterministic task/subprocess.
 *
 * ## Why this is in core and the machinery is not
 *
 * The owner's placement ruling, same day: *"contract in core, machinery in
 * cat-harness"*. That is the only split the layers permit, and the reason is
 * declared rather than stylistic: **`folio-assistant-core.json` says
 * `"needs": ["cat-harness"]`** — *"bootstrap, cat harness, fa-core, f-a, from
 * bottom to top"* — so core sits ABOVE the harness. cat-harness cannot import
 * this module; doing so would invert a declared dependency.
 *
 * So the two layers **meet at the data, not at the code**. This module says
 * what a request and an outcome ARE, as documents. The harness reads
 * `<cat-harness.processes:adjudication/>` off a diagram and validates the code against what
 * that diagram declares, the same way `INVOLVEMENT_VOCABULARIES` handles RACI
 * versus RASCI — a vocabulary read from a declaration, never imported from a
 * layer above.
 *
 * The cost that split accepts, stated because it is real: the code enum is
 * written twice, once in a diagram and once in a recorded outcome. The
 * mitigation is {@link AdjudicationOutcomeSchema.codes} — an outcome carries
 * the enum it was adjudicated against, so a consumer COMPARES the two rather than
 * assuming they agree. An outcome that carried only its code would make the
 * divergence undetectable, which is the failure this whole file is shaped
 * against.
 *
 * ## Debate before the verdict (SWE-Debate, arXiv:2507.23348v1)
 *
 * An outcome MAY carry {@link AdjudicationDebateSchema}: the rounds a
 * competitive multi-agent debate ran before the adjudicator decided — ranked
 * candidate proposals (round 1), cross-agent critique (round 2), discriminator
 * synthesis (round 3). It records how the judgement was reached; it does not
 * replace the reason. Bean `o57z`; it first landed on the harness's copy of
 * this module and moved here when that duplicate was removed (2026-10-10).
 *
 * ## What it does NOT do
 *
 * It does not decide anything, and it cannot. Adjudication is the step entered
 * precisely because no mechanism could settle the question — `adjudication.bpmn`
 * says it of its own adjudicator step: *"the one step nothing here can check: if a
 * mechanism could decide it, the process would not have been entered."* What is
 * checkable is everything AROUND the judgement: that the judge was shown a
 * declared set, that the answer is one of the declared codes, that a reason
 * exists, and that the actor was permitted to adjudicate at all.
 *
 * @module folio-assistant-core/schemas/adjudication
 * @graphNode schema
 */
import { z } from "zod";

import { MATERIALIZATION_STATES } from "./materialization.js";
import { ModelIdSchema } from "@litlfred/bootstrap-tools/schemas/model-registry.ts";

export const ADJUDICATION_SCHEMA_TAG = "folio-adjudication/v1";

/**
 * Who may adjudicate — **the harness's spelling, not a second one.**
 *
 * The owner: *"ONLY agentic human actor."* In this repository's vocabulary
 * that is `person` and `agent`; `system` is the mechanical kind and `external`
 * a participant outside the instance. Both are excluded, and
 * `adjudication.bpmn`'s adjudicator step already says so in the same words —
 * `<cat-harness.processes:fulfilment kinds="person agent"/>`, whose reason reads *"a
 * mechanical system may NOT take this step, which is the whole reason the
 * process exists."*
 *
 * **These values are copied deliberately rather than renamed**, and the first
 * draft of this file got it wrong: it read `["human", "agentic"]`, which is a
 * SECOND SPELLING of a concept the harness already names. `skill-package.ts`
 * records what that costs — *"It is one vocabulary because it was two, and
 * that is what broke"* — where an LLM agent and a CI runner both recorded
 * `system` and no consumer could tell judgement from a program. The test
 * below caught the repeat, which is why it asserts against the harness's enum
 * instead of restating it.
 *
 * It is a copy rather than an import for the layering reason in the module
 * docstring: core `needs` cat-harness, so importing downward is the one
 * direction available and this is the wrong way round. The test closes the
 * gap a copy leaves.
 */
export const ADJUDICATOR_KINDS = ["person", "agent"] as const;
export type AdjudicatorKind = (typeof ADJUDICATOR_KINDS)[number];

/**
 * One thing the adjudicator is shown.
 *
 * `state` is {@link MATERIALIZATION_STATES}, reused rather than restated —
 * the owner's *"IO is materialized or by reference"*, in the vocabulary core
 * already owns. The third state, `unknown`, comes along with it and is not an
 * accident: an asset nobody has located is not a referenced one, and an adjudicator
 * told "here is the evidence" about bytes nobody can find has been misled.
 */
export const AdjudicationAssetSchema = z
  .object({
    /** Stable identifier — a bib-slug, a block id, a path. */
    ref: z.string().min(1),
    state: z.enum(MATERIALIZATION_STATES),
    /**
     * Where the bytes are, when they are anywhere. Required when
     * `materialized`: a materialized asset with no locator is a claim that
     * something is here without saying where, which is the one shape the
     * state exists to rule out.
     */
    at: z.string().min(1).optional(),
    /** What it is, in a few words, so a reader of the record can follow it. */
    note: z.string().min(1).optional(),
  })
  .strict()
  .refine((a) => a.state !== "materialized" || a.at !== undefined, {
    message: "a `materialized` asset must say where — otherwise it asserts presence without location",
    path: ["at"],
  });
export type AdjudicationAsset = z.infer<typeof AdjudicationAssetSchema>;

/**
 * One answer the adjudicator is allowed to give.
 *
 * A code carries its own meaning because an enum of bare tokens is a set of
 * strings somebody will interpret differently later —
 * `adjudication.bpmn`'s three outcomes are each a paragraph of documentation
 * today, and flattening them to `stands | scope | dispensation` would drop
 * exactly the part that makes them distinguishable.
 */
export const JudgementCodeSchema = z
  .object({
    code: z.string().min(1),
    /** What choosing this code means. Required — see the type docstring. */
    means: z.string().min(1),
  })
  .strict();
export type JudgementCode = z.infer<typeof JudgementCodeSchema>;

/**
 * What an adjudicator is given.
 *
 * Note what is NOT here: any hint of the expected answer. The request names
 * the question and the permitted answers, and says nothing about which is
 * likely — a request that did would be composing the outcome it claims to be
 * asking for.
 */
export const AdjudicationRequestSchema = z
  .object({
    $schema: z.literal(ADJUDICATION_SCHEMA_TAG),
    /** Stable id, so an outcome can point back at the exact question asked. */
    id: z.string().min(1),
    /**
     * Everything the adjudicator is shown, and **nothing else is**.
     *
     * The restriction is the feature, not a limitation of the type.
     * `adjudication.bpmn`'s `A_Dispatch` exists to compose this set —
     * *"Dispatch with `adjudicator_sees` — never the artefact"* — and
     * `untaintedPartitionDefects` reports `overlap` when a party can read
     * what it is grading. A contract that always handed over everything
     * would silently undo the untainted-verification epic it has to express.
     *
     * MAY be empty, and that is a real case rather than an oversight: a
     * judgement about a process or a policy has no assets. Empty and absent
     * must not differ, so it is required and may be `[]`.
     */
    assets: z.array(AdjudicationAssetSchema),
    /** The question, as markdown. */
    prompt: z.string().min(1),
    /**
     * The permitted answers — the owner's *"list of judgement codes"*.
     *
     * At least two. A one-code enum is not a judgement: it is a step that
     * records assent, and calling it adjudication would let a rubber stamp
     * inherit the authority of a decision nobody could have made otherwise.
     */
    codes: z.array(JudgementCodeSchema).min(2, "a single permitted answer is assent, not a judgement"),
  })
  .strict()
  .refine((r) => new Set(r.codes.map((c) => c.code)).size === r.codes.length, {
    message: "two permitted answers share a code — the outcome could not say which was chosen",
    path: ["codes"],
  });
export type AdjudicationRequest = z.infer<typeof AdjudicationRequestSchema>;

/**
 * A structured critique raised by one agent against another's proposal during a debate round.
 * Formalized from SWE-Debate (arXiv:2507.23348v1 §3.3).
 */
export const DebateCritiqueSchema = z
  .object({
    targetAgent: z.string().min(1),
    point: z.string().min(1),
    severity: z.enum(["critical", "major", "minor"]).optional(),
  })
  .strict();
export type DebateCritique = z.infer<typeof DebateCritiqueSchema>;

/**
 * A participant's stance and argument within a debate round.
 */
export const DebateProposalSchema = z
  .object({
    agent: z.string().min(1),
    stance: z.string().min(1),
    argument: z.string().min(1),
    critiques: z.array(DebateCritiqueSchema).optional(),
  })
  .strict();
export type DebateProposal = z.infer<typeof DebateProposalSchema>;

/**
 * One structured round in a multi-agent debate before referee adjudication.
 * Following SWE-Debate:
 *   - Round 1: candidate proposal & ranking (hypothesis selection);
 *   - Round 2: competitive strategy refinement & cross-agent critique;
 *   - Round 3: discriminator synthesis.
 */
export const DebateRoundSchema = z
  .object({
    round: z.number().int().positive(),
    name: z.string().min(1),
    participants: z.array(z.string().min(1)).min(1),
    summary: z.string().min(1),
    proposals: z.array(DebateProposalSchema).optional(),
  })
  .strict();
export type DebateRound = z.infer<typeof DebateRoundSchema>;

/**
 * The structured multi-agent debate record formalizing debate rounds
 * before an adjudicator reaches a final verdict (SWE-Debate, arXiv:2507.23348v1).
 */
export const AdjudicationDebateSchema = z
  .object({
    protocol: z.literal("swe-debate-v1").or(z.string().min(1)),
    rounds: z.array(DebateRoundSchema).min(1),
    consensus_reached: z.boolean().optional(),
    resolved_conflicts: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type AdjudicationDebate = z.infer<typeof AdjudicationDebateSchema>;

/**
 * What an adjudicator answers.
 *
 * Carries `codes` as well as `code` — see the module docstring. That is the
 * mitigation for the enum living in two layers, and without it a diagram
 * quietly changing its outcomes would leave old records unfalsifiable.
 */
export const AdjudicationOutcomeSchema = z
  .object({
    $schema: z.literal(ADJUDICATION_SCHEMA_TAG),
    /** The request this answers. */
    request: z.string().min(1),
    /** The chosen code. Must be one of `codes`. */
    code: z.string().min(1),
    /** The enum in force when this was adjudicated. */
    codes: z.array(z.string().min(1)).min(2),
    /**
     * Why, as markdown. REQUIRED, and never empty.
     *
     * The same rule `adjudication.bpmn` states for a dispensation — *"A
     * dispensation with no `notes` is not a dispensation. It is an override
     * somebody applied to get to green, and nobody can review it
     * afterwards"* — generalised to every outcome, because it is true of
     * every outcome. What makes a judgement legitimate is not which branch it
     * took but that its reason was recorded.
     */
    reasoning: z.string().min(1),
    /**
     * Who adjudicated, and of which kind. An outcome with no adjudicator is
     * indistinguishable from a default.
     */
    by: z
      .object({
        id: z.string().min(1),
        kind: z.enum(ADJUDICATOR_KINDS),
        /** An `agent` adjudicator must name its model, so a verdict can be re-examined. */
        model: ModelIdSchema.optional(),
      })
      .strict()
      .refine((b) => b.kind !== "agent" || b.model !== undefined, {
        message: "an `agent` adjudicator must name its model",
        path: ["model"],
      }),
    at: z.string().min(1),
    /**
     * Optional structured debate record formalizing debate rounds
     * conducted prior to the adjudicator's verdict (SWE-Debate / 2507.23348v1).
     */
    debate: AdjudicationDebateSchema.optional(),
  })
  .strict()
  .refine((o) => o.codes.includes(o.code), {
    message: "the chosen code is not in the enum it was adjudicated against",
    path: ["code"],
  });
export type AdjudicationOutcome = z.infer<typeof AdjudicationOutcomeSchema>;

/**
 * Why an outcome does not answer its request. Empty means it does.
 *
 * Returned rather than thrown, and reported per defect rather than
 * first-only, because a caller showing an adjudicator their errors should show all of
 * them.
 */
export function adjudicationDefects(
  request: AdjudicationRequest,
  outcome: AdjudicationOutcome,
): string[] {
  const out: string[] = [];
  if (outcome.request !== request.id) {
    out.push(`outcome answers \`${outcome.request}\` but the request is \`${request.id}\``);
  }
  const permitted = request.codes.map((c) => c.code);
  if (!permitted.includes(outcome.code)) {
    out.push(`\`${outcome.code}\` is not a permitted answer (${permitted.join(", ")})`);
  }
  // The drift check the two-layer split exists to make possible. Compared as
  // SETS: the order an enum is written in is not part of the contract, and
  // treating it as one would report a reordering as a divergence.
  const a = [...new Set(permitted)].sort();
  const b = [...new Set(outcome.codes)].sort();
  if (a.join("\u0000") !== b.join("\u0000")) {
    out.push(
      `the enum drifted: adjudicated against (${b.join(", ")}), the request now permits (${a.join(", ")}). ` +
        `The outcome is not wrong — it was adjudicated under a different contract, and that is why it records one.`,
    );
  }
  if (outcome.debate) {
    const rounds = outcome.debate.rounds;
    for (let i = 0; i < rounds.length; i++) {
      if (rounds[i]!.round !== i + 1) {
        out.push(`debate rounds not sequential: expected round ${i + 1}, found ${rounds[i]!.round}`);
      }
    }
  }
  return out;
}
