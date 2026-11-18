/**
 * The two documents the `discussion` process carries, as Zod.
 *
 * @module schemas/discussion
 * @graphNode schema
 *
 * ## These shapes describe `bootstrap`, and deliberately do not live in it
 *
 * `bootstrap/README.md` promises a Bootstrapping Agent that it needs **no harness,
 * no server, no tools and no work plan**, and that what it reads is "a file
 * you read, not something you run". Measured: that directory holds `.md`,
 * `.json` and `.bpmn` and **no executable code**. So its shapes cannot be Zod
 * *in it* — owner, 2026-09-20, *"bootstrap should not know zod at all"*. They
 * live in this sibling layer, `bootstrap-tools`: Zod is an AUTHORING TOOL
 * for the Knowledge Graph, *"different tools can/will be used, but the core KG
 * should be unchanged"*, and what bootstrap carries is only what it generates.
 *
 * `bootstrap/skills/discussion.*.schema.json` is GENERATED from here. The
 * `$id`s are unchanged and must stay so: they are a published contract, and
 * the filenames are cited from `discussion.bpmn`, a harness's tool registry,
 * the generated skill docs and `.pot` catalogues in five languages.
 *
 * ## What Zod cannot carry across, and why it is handled rather than accepted
 *
 * **`.refine()` exports nothing to JSON Schema.** Measured with
 * `zod-to-json-schema`: no `allOf`, no `if`/`then`, no trace of the rule. The
 * output document has two conditionals that a consumer relies on, so they are
 * re-applied by the generator (`JSON_SCHEMA_CONDITIONALS`) rather than left to
 * vanish. The refinements below are kept ANYWAY, because they are what makes
 * the Zod type honest for anything validating in-process; the generator's
 * table is what makes the published document honest. Two forms of one rule is
 * a thing to be uneasy about, which is exactly why
 * `discussion.test.ts` asserts the generated schema and the Zod schema agree
 * on the same corpus of documents.
 */

import { z } from "zod";

/**
 * A repository and the part it plays.
 *
 * Shared by both documents. It was duplicated between the two hand-written
 * JSON files, and the copies had already drifted — the input's carried
 * descriptions and the output's did not. One definition is the fix.
 */
export const RepositoryRefSchema = z.object({
  url: z
    .string()
    .describe(
      "Clone URL or path. Not required to be reachable — a Bootstrapping Agent may have been told about a repository it cannot yet fetch.",
    ),
  role: z
    .enum(["read-from", "written-to"])
    .describe(
      "Which part this repository plays. A flat list loses the distinction, and the distinction is the whole reason for determining them: it is where the new declaration lands.",
    ),
  note: z.string().optional(),
}).strict();
export type RepositoryRef = z.infer<typeof RepositoryRefSchema>;

/** Which unknowns the exchange is to settle. */
export const OPEN_QUESTIONS = ["harness", "repositories"] as const;

/**
 * Who is being asked, or who answered.
 *
 * The two participant kinds are symmetric — the same skill serves
 * human-to-agent and agent-to-agent — but the answer's weight differs, so the
 * kind is RECORDED rather than inferred.
 */
export const ParticipantSchema = z.object({
  kind: z.enum(["person", "agent"]),
  id: z
    .string()
    .optional()
    .describe("Session id, handle or name, where one is known. Absent is normal for a person."),
}).strict();
export type Participant = z.infer<typeof ParticipantSchema>;

/**
 * The occasion for asking: what the agent already knows, and which unknown is
 * still open.
 *
 * Deliberately small — a Bootstrapping Agent has read one README and can look nothing
 * up, so an input it cannot populate is an input that stops the process.
 */
export const DiscussionInputSchema = z.object({
  open: z
    .array(z.enum(OPEN_QUESTIONS))
    .min(1)
    .describe("Which unknowns this exchange is to settle. At least one, or there is nothing to ask."),
  askedOf: ParticipantSchema.describe(
    "Who is being asked. The two participant kinds are symmetric — the same skill serves human-to-agent and agent-to-agent — but the answer's weight differs, so the kind is recorded rather than inferred.",
  ),
  candidates: z
    .array(z.string())
    .optional()
    .describe(
      "Harnesses the agent has already narrowed to from context — a repository whose root already holds a declaration, `<name>.json`, is not a blank slate. Narrowing first is what keeps this to one question.",
    ),
  knownRepositories: z
    .array(RepositoryRefSchema)
    .optional()
    .describe(
      "Repositories already evident from the checkout, each with the part it is known to play. Offered so the participant confirms or corrects rather than recites.",
    ),
  context: z
    .string()
    .optional()
    .describe(
      "What the agent read to get this far, in one or two sentences. Lets the participant answer without re-establishing the situation.",
    ),
}).strict();
export type DiscussionInput = z.infer<typeof DiscussionInputSchema>;

/** One question put, and what came back. */
export const ExchangeEntrySchema = z.object({
  asked: z
    .string()
    .describe(
      "The question as put, with its candidates named. A question a reader must go and research is not ready.",
    ),
  answered: z
    .string()
    .optional()
    .describe(
      "The reply as received. Absent means the question was put and nothing came back, which is one route to `unsettled`.",
    ),
  at: z.string().datetime().optional(),
}).strict();
export type ExchangeEntry = z.infer<typeof ExchangeEntrySchema>;

/**
 * The output document's shape, before the two conditional rules.
 *
 * Written as a literal `z.object({...})` rather than as a shared shape
 * constant, and that is a READABILITY decision about the schema graph rather
 * than a style one. The reader is syntactic: a bare object literal assigned to
 * a const is not a Zod call, so it lands as `undetermined` and its fields are
 * invisible in the relationship diagram — which is what
 * `themePaletteShape` and `kgNodeLabelShape` already do. Since the whole
 * reason this layer exists is to make bootstrap's shapes visible, hiding
 * the biggest one behind a variable would defeat it.
 */
export const DiscussionOutputObjectSchema = z.object({
  outcome: z
    .enum(["settled", "unsettled"])
    .describe(
      "`unsettled` is a real outcome, not an error: a participant may decline, and the process has an end for it. What an `unsettled` result must never contain is a guess.",
    ),
  harness: z
    .string()
    .optional()
    .describe(
      "The harness this repository is to become — `bootstrap`, or any Harness built on it. Required when `outcome` is `settled` and `harness` was open.",
    ),
  repositories: z
    .array(RepositoryRefSchema)
    .optional()
    .describe(
      "The repositories involved, each with the part it plays. Recorded as pairs rather than a flat list: read-from and written-to may be one repository or two, and which is which is the answer.",
    ),
  determinedBy: z
    .enum(["asked", "assumed"])
    .optional()
    .describe(
      "`asked` means a participant said so. `assumed` is permitted only for a default the README itself states, and then `assumption` must say which. An agent that reaches for `assumed` because nobody answered has produced an `unsettled` result, not an assumed one.",
    ),
  assumption: z
    .string()
    .optional()
    .describe(
      "Required when `determinedBy` is `assumed`: the documented default relied on, and where it is stated.",
    ),
  answeredBy: ParticipantSchema.describe(
    "Who settled it. An answer from a sibling agent is evidence of a different weight from the person who wants the harness — both are admissible, neither is conflated with the other.",
  ),
  exchange: z
    .array(ExchangeEntrySchema)
    .min(1)
    .describe(
      "What was actually put and what came back, in order. One entry is the expected case — the skill's rule is to ask the fewest questions that settle it.",
    ),
  stillOpen: z
    .array(z.enum(OPEN_QUESTIONS))
    .optional()
    .describe(
      "Required in substance when `outcome` is `unsettled`: what remains undetermined, so the next actor resumes rather than restarts.",
    ),
}).strict();

/**
 * What the exchange determined: which harness, which repositories, on whose
 * word, and by what means.
 *
 * **This document existing and conforming is what finishes the task** — not
 * that a conversation took place.
 *
 * The two `.refine()` calls below are the same rules
 * `JSON_SCHEMA_CONDITIONALS` re-applies to the generated document. They are
 * duplicated ON PURPOSE and the duplication is tested: Zod cannot express them
 * in a form that survives export, and dropping either form would leave one of
 * the two consumers — in-process validation, or a third party following the
 * `$id` — enforcing less than the other.
 */
export const DiscussionOutputSchema = DiscussionOutputObjectSchema.refine((v) => v.determinedBy !== "assumed" || typeof v.assumption === "string", {
    message: "`determinedBy: assumed` requires `assumption` — which documented default, and where it is stated",
    path: ["assumption"],
  })
  .refine((v) => v.outcome !== "unsettled" || (v.stillOpen?.length ?? 0) > 0, {
    message: "`outcome: unsettled` requires `stillOpen` — so the next actor resumes rather than restarts",
    path: ["stillOpen"],
  });
export type DiscussionOutput = z.infer<typeof DiscussionOutputSchema>;

/**
 * The conditionals JSON Schema can express and Zod cannot export.
 *
 * Measured, not assumed: `zodToJsonSchema` over a `.refine()`d object emits no
 * `allOf`, no `if`/`then` and no trace of the message. Without this table the
 * published document would accept what the current one rejects, at an `$id`
 * consumers already follow.
 *
 * Kept as DATA rather than as string-concatenation inside the generator, so
 * the rules can be read next to the Zod refinements they mirror.
 */
export const JSON_SCHEMA_CONDITIONALS = [
  {
    if: { properties: { determinedBy: { const: "assumed" } }, required: ["determinedBy"] },
    then: { required: ["assumption"] },
  },
  {
    if: { properties: { outcome: { const: "unsettled" } }, required: ["outcome"] },
    then: { required: ["stillOpen"] },
  },
] as const;
