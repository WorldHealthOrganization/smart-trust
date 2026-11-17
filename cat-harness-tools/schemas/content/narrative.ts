/**
 * A generated narrative, and who stands behind it.
 *
 * An image description, a transcript, a dataset summary: **agent-drafted,
 * human-confirmed**, so the state is a state machine, not a boolean.
 *
 * ## Two attributions, because they are two acts
 *
 * `drafted_by` is who wrote the words; `confirmed_by` is who accepted them.
 * A reader of a narrative most wants to know whether a person has agreed to
 * it.
 *
 * ## An agent cannot confirm its own draft
 *
 * `confirmed_by.kind` must be `"human"`, structurally. Without it,
 * "confirmed" degrades into "an agent said so twice".
 *
 * ## `rejected` is a state, and it keeps its reasons
 *
 * A rejected draft is kept, with a reason, so it is neither silently
 * re-offered nor redrafted identically — the same demand
 * `schemas/sdlc/qa-review.ts`'s `Decision` makes.
 *
 * ## One narrative per language
 *
 * A narrative carries its language as a BCP 47 `lang`, and a slot holds one
 * narrative PER language, each with its own author, model version and review
 * state: a translation is drafted and confirmed like any other narrative, and
 * a missing language is visibly absent rather than silently the source text.
 *
 * `lang` is required on every WRITTEN narrative; the empty slot,
 * {@link NOT_AUTHORED}, claims no language. {@link NarrativeSlotSchema}
 * accepts the single form or a list with distinct languages, and readers go
 * through {@link narrativesOfSlot}. The `superseded` history of block
 * summaries requires `lang` too, and authored figures carry a slot
 * (`constraints.ts`).
 *
 * ## Not a second review model
 *
 * `Attribution` and its `script | agent | human` vocabulary come from
 * `schemas/content/attribution.ts`, which `block-qa.ts` also re-exports.
 *
 * @module schemas/narrative
 * @graphNode schema
 */
import { z } from "zod";

import { AttributionSchema } from "./attribution";

/**
 * Where a narrative is in its life.
 *
 * - `not-authored` — nobody has written one. The slot exists and is empty.
 * - `draft` — an agent (or a person) wrote one; nobody has accepted it.
 * - `confirmed` — a HUMAN accepted it. Only this state means the text is
 *   anybody's considered answer.
 * - `rejected` — a human turned it down, and said why.
 *
 * `not-authored` is deliberately first and is the default for a new record:
 * the failure this whole arm exists to prevent is a machine-made summary
 * arriving as though somebody had agreed to it.
 */
export const NARRATIVE_STATES = ["not-authored", "draft", "confirmed", "rejected"] as const;
export type NarrativeState = (typeof NARRATIVE_STATES)[number];

/** States in which `text` must be present. Derived, so adding a state forces the question. */
export const STATES_WITH_TEXT: readonly NarrativeState[] = NARRATIVE_STATES.filter(
  (s): s is NarrativeState => s !== "not-authored",
);

/**
 * A BCP 47 language tag, in the shape this repository uses (`en`, `fr`,
 * `zh-Hant`, `pt-BR`): a 2–3 letter primary subtag and optional subtags.
 * A shape check, not a registry lookup.
 */
export const LANGUAGE_TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export const NarrativeSchema = z
  .object({
    /** The narrative itself, or null when nobody has written one. */
    text: z.string().min(1).nullable(),
    /**
     * The language of `text`, as a BCP 47 tag. Required on every narrative
     * that has text; the empty `not-authored` slot claims no language (owner
     * ruling 2026-10-22, 1A).
     */
    lang: z.string().regex(LANGUAGE_TAG).optional(),
    state: z.enum(NARRATIVE_STATES),
    /** Who wrote the words. An `agent` must name its `model` — see `attribution.ts`. */
    drafted_by: AttributionSchema.optional(),
    drafted_at: z.string().optional(),
    /** Who ACCEPTED the words. Must be a human; see the module docstring. */
    confirmed_by: AttributionSchema.optional(),
    confirmed_at: z.string().optional(),
    rejected_by: AttributionSchema.optional(),
    rejected_at: z.string().optional(),
    /** Why it was turned down. Required when rejected, and never empty. */
    rejection_reason: z.string().min(1).optional(),
  })
  // Text and state cannot contradict each other. A `confirmed` record with no
  // text says a person agreed to nothing.
  .refine((n) => (n.text !== null) === STATES_WITH_TEXT.includes(n.state), {
    message: "`text` and `state` disagree: only `not-authored` has no text",
    path: ["text"],
  })
  // Anything written has a writer. Otherwise `confirmed` could mean a person
  // accepted words of unknown origin, which is the provenance gap `iqim`
  // closed for blocks, reappearing here.
  .refine((n) => n.state === "not-authored" || n.drafted_by !== undefined, {
    message: "a narrative that exists must record who drafted it",
    path: ["drafted_by"],
  })
  // THE load-bearing rule. Without it `confirmed` degrades into "an agent said
  // so twice" and carries no more information than `draft`.
  .refine((n) => n.state !== "confirmed" || n.confirmed_by?.kind === "human", {
    message: "only a human can confirm a narrative — an agent cannot accept its own draft",
    path: ["confirmed_by"],
  })
  .refine((n) => n.state !== "rejected" || n.rejected_by?.kind === "human", {
    message: "only a human can reject a narrative",
    path: ["rejected_by"],
  })
  // A rejection with no reason is indistinguishable from an abandoned draft,
  // and it lets the next agent redraft the identical thing.
  .refine((n) => n.state !== "rejected" || !!n.rejection_reason, {
    message: "a rejection must say why — otherwise the next draft repeats it",
    path: ["rejection_reason"],
  })
  // A record cannot be both accepted and turned down.
  .refine((n) => !(n.confirmed_by && n.rejected_by), {
    message: "a narrative cannot be both confirmed and rejected",
    path: ["state"],
  })
  // Words are in a language. Bean `cat-tools-e1lo`, stage 4: a reviewer asked
  // to confirm a translation must know which one, and a missing language must
  // be visibly absent rather than silently the source text.
  .refine((n) => n.state === "not-authored" || n.lang !== undefined, {
    message: "a written narrative must name its `lang`",
    path: ["lang"],
  });

export type Narrative = z.infer<typeof NarrativeSchema>;

/**
 * Where a record keeps its narrative: a list with one entry per language, or
 * the empty slot {@link NOT_AUTHORED} when nothing has been written.
 *
 * In a list every entry names its `lang`, and no language appears twice: two
 * `fr` narratives would leave a reviewer confirming one while the other is
 * shown, which is the state the review queue exists to prevent.
 *
 * The single form is the empty slot ONLY (stage 4, owner ruling 2026-10-22,
 * 1A). A written single narrative is refused: every one stored was migrated
 * to a one-entry list (`bun run cat narratives:migrate-lang`), and every
 * writer writes the list.
 */
export const NarrativeSlotSchema = z.union([
  NarrativeSchema.refine((n) => n.state === "not-authored", {
    message:
      "a written narrative goes in a list naming its language, `[{ …, lang }]`; " +
      "only the empty `not-authored` slot is a bare object",
  }),
  z
    .array(NarrativeSchema)
    .min(1)
    .refine((ns) => ns.every((n) => n.lang !== undefined), {
      message: "every narrative in a list must name its `lang`",
    })
    .refine((ns) => new Set(ns.map((n) => n.lang)).size === ns.length, {
      message: "a language may appear only once in a narrative list",
    }),
]);

export type NarrativeSlot = z.infer<typeof NarrativeSlotSchema>;

/**
 * Every narrative in a slot, in order: one for the single form, each entry for
 * a list. The one way to read a slot, so no reader has to know which form a
 * record is in.
 */
export function narrativesOfSlot(slot: NarrativeSlot): Narrative[] {
  return Array.isArray(slot) ? slot : [slot];
}

/**
 * The ONE narrative a single-text display shows from a slot: the entry in the
 * reader's language, else the first. Owner ruling 2026-10-20 (bean
 * `cat-tools-e1lo`, stage 3, "locale match, else first").
 *
 * Match order, so a regional locale still finds its language:
 * 1. an entry whose `lang` is exactly `lang` (case-insensitive, as BCP 47 is);
 * 2. an entry whose primary subtag matches (`fr-CA` finds `fr`, and `fr` finds `fr-CA`);
 * 3. the first entry.
 *
 * The empty slot has no choice to make and is returned as it is. A build with
 * no locale passes none and gets the first entry.
 */
export function narrativeFor(slot: NarrativeSlot, lang?: string): Narrative {
  const all = narrativesOfSlot(slot);
  if (lang === undefined || all.length === 1) return all[0]!;
  const want = lang.toLowerCase();
  const primary = (t: string) => t.toLowerCase().split("-")[0];
  return (
    all.find((n) => n.lang?.toLowerCase() === want) ??
    all.find((n) => n.lang !== undefined && primary(n.lang) === primary(want)) ??
    all[0]!
  );
}

/** The empty slot every record starts with. */
export const NOT_AUTHORED: Narrative = { text: null, state: "not-authored" };

/** True when a person has accepted this text — the only state that means that. */
export function isConfirmed(n: unknown): boolean {
  const r = NarrativeSchema.safeParse(n);
  return r.success && r.data.state === "confirmed";
}

/** True when this narrative is waiting on a person. */
export function awaitsConfirmation(n: unknown): boolean {
  const r = NarrativeSchema.safeParse(n);
  return r.success && r.data.state === "draft";
}

/**
 * Preset rejection reasons, chosen by NUMBER.
 *
 * The owner has very limited hand function, so a rejection that demands a
 * typed sentence is a rejection that will not happen — and an unusable review
 * step makes `confirmed` mean "nobody got round to objecting", which is worse
 * than not having the state at all. Free text stays available and is never
 * required.
 */
export const REJECTION_REASONS: readonly string[] = [
  "inaccurate — describes something the source does not contain",
  "too vague to be useful",
  "wrong emphasis — describes the incidental rather than the subject",
  "not in the register this corpus uses",
  "duplicates a description that already exists",
];
