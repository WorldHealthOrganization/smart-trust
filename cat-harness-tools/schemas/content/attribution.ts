/**
 * Who wrote a piece of derived content.
 *
 * Text lifted verbatim out of a PDF has no author: `provenance: "ingested"`
 * says so. A *narrative* — an image description, a transcript, a translation,
 * a dataset summary — is somebody's account of the thing, and a reader needs
 * to know whether a human curator or a model (and which version) wrote it.
 * Recording it also lets everything a superseded model wrote be re-generated
 * or re-reviewed as a set.
 *
 * ## The vocabulary is the QA reviewer's
 *
 * `script | agent | human` is the participant vocabulary of
 * `schemas/sdlc/block-qa.ts`. The constant lives here and is re-exported
 * there, so there is ONE spelling. `QaReviewer` itself is not reused: its
 * hash fields concern criterion staleness, not authorship.
 *
 * ## `agent` requires a model, structurally
 *
 * An agent attribution with no model is refused by a schema refinement: it
 * would record that a machine wrote the text while losing the part that lets
 * anyone act on it later.
 *
 * @module schemas/attribution
 * @graphNode schema
 */
import { z } from "zod";
import { SkillRefSchema } from "../tools/tool-types.js";
import { ModelIdSchema } from "@litlfred/bootstrap-tools/schemas/model-registry.ts";

/**
 * The three sorts of participant that can author content.
 *
 * - `script` — deterministic code. `id` is the script path.
 * - `agent` — an LLM-driven agent. `id` names the agent, `model` the version.
 * - `human` — a person. `id` is a GitHub login or equivalent.
 *
 * `script` is a distinct kind rather than a flavour of `agent` for the reason
 * the QA vocabulary already separates them: a script's output is reproducible
 * from its source, and its `version` is a revision anyone can check out.
 *
 * The ORDER matches what `block-qa.ts` has always exported, because that file
 * now re-exports this constant: a re-spelling that also silently reorders is
 * the kind of change that shows up somewhere nobody was looking.
 */
export const ATTRIBUTION_KINDS = ["script", "agent", "human"] as const;
export type AttributionKind = (typeof ATTRIBUTION_KINDS)[number];

/** Who authored a piece of derived content. */
export interface Attribution {
  kind: AttributionKind;
  /** Stable identifier — GitHub login, agent name, or script path. */
  id: string;
  /** Version pin: a script revision, or a human's role at the time. */
  version?: string;
  /** LLM model identifier, e.g. `claude-opus-5`. REQUIRED when kind is `agent`. */
  model?: string;
  /** Session identifier, where the authoring run had one. */
  session?: string;
  /** ISO-8601 date the content was authored. */
  date?: string;
  /** The skill or tool that dispatched the authoring, e.g. `library-core/library-ingestion`. */
  skill?: string;
}

/**
 * The literal that says "nobody authored this — it is the source's own text".
 *
 * A bare string rather than `{kind: "source"}` because it is not an
 * attribution: there is no participant to name. Extracted text belongs to the
 * document it came out of, which `source{}` on `structure.json` already
 * records (bean `nso8`).
 */
export const INGESTED = "ingested" as const;

/**
 * How a piece of content came to exist: extracted, or authored by someone.
 *
 * A **closed** union, which is the load-bearing part. While `provenance` was an
 * open string, `"ingested"` was the only value anything wrote and nothing could
 * tell a description a model had written from text lifted off a page. Closing
 * it does not stop an arm asserting something false, but it does make the
 * *omission* impossible: a new arm has to choose, and choosing `"ingested"` for
 * a generated narrative is a false statement rather than a missing field.
 */
export type Provenance = typeof INGESTED | Attribution;

export const AttributionSchema = z
  .object({
    kind: z.enum(ATTRIBUTION_KINDS),
    id: z.string().min(1),
    version: z.string().optional(),
    model: ModelIdSchema.optional(),
    session: z.string().optional(),
    date: z.string().optional(),
    /** The skill being exercised: `name` or `package/name` (#1168 B8). */
    skill: SkillRefSchema.optional(),
  })
  .refine((a) => a.kind !== "agent" || (a.model !== undefined && a.model !== ""), {
    message: "an `agent` attribution must name its `model` — see the module docstring",
    path: ["model"],
  })
  .refine((a) => a.model !== MODEL_NOT_DISCLOSED || (a.session !== undefined && a.session !== ""), {
    message: "a `not-disclosed` model must name the `session` it can be recovered from",
    path: ["session"],
  });

/**
 * The DECLARED value for an agent that is not permitted to write its model
 * identifier into the repository (owner, 2026-09-30, options B+C).
 *
 * `model` stays REQUIRED for an agent — the omission this module exists to
 * prevent is still impossible — and this is the one sanctioned answer that is
 * not an identifier. It is a true statement, never a guess: an agent that
 * cannot name its model says so rather than writing a plausible one.
 *
 * It is only half an answer, which is why it demands a `session`: the model
 * is recoverable from the session record, so the per-model re-review this
 * field exists for is one lookup away rather than lost. Used before it was
 * declared: 28 figure descriptions in `arxiv-2312.07755v1/images.json`
 * (2026-09-23), each with its session.
 */
export const MODEL_NOT_DISCLOSED = "not-disclosed" as const;

/** False for {@link MODEL_NOT_DISCLOSED} (and for no model): whether the attribution names a real model. */
export function modelDisclosed(a: Pick<Attribution, "model">): boolean {
  return a.model !== undefined && a.model !== "" && a.model !== MODEL_NOT_DISCLOSED;
}

export const ProvenanceSchema = z.union([z.literal(INGESTED), AttributionSchema]);

/** True when the content is the source document's own text, with no author. */
export function isIngested(p: unknown): p is typeof INGESTED {
  return p === INGESTED;
}

/** The attribution, or `null` for extracted text. Throws on nothing. */
export function attributionOf(p: unknown): Attribution | null {
  if (isIngested(p)) return null;
  const parsed = AttributionSchema.safeParse(p);
  return parsed.success ? parsed.data : null;
}

/**
 * How a library block's text came to be, per block kind.
 *
 * **Total by test, not by hope.** `scripts/tests/attribution.test.ts` asserts
 * that every `kind` occurring anywhere in `library/` has an entry here, so a
 * narrative arm cannot land a new kind without classifying it — and the moment
 * a kind is classified `authored`, the L1 gate requires an attribution on every
 * block carrying it.
 *
 * The corpus holds two kinds, both extracted. That is a determined
 * classification of everything present, NOT an empty registry: an empty one
 * would let the gate pass having checked nothing, which is the "unknown
 * rendered as a pass" failure this repository keeps paying for. No count is
 * given here on purpose — the previous version said "424 blocks" and was stale
 * the moment `figure` arrived, and a count in prose is a claim rather than
 * evidence. `scripts/tests/attribution.test.ts` counts.
 */
export const LIBRARY_BLOCK_ORIGIN: Record<string, "extracted" | "authored"> = {
  // Verbatim text off the page. `pdf-structure.py` and `pdf-pages.py` both
  // emit this and nothing else, so `"ingested"` is the honest value for it.
  prose: "extracted",
  // Bean `d5f1`. The BLOCK is extracted: its content is an image lifted off
  // the page, as verbatim as prose is. Its `narrative` is authored — but a
  // narrative carries its OWN attribution and its own state machine
  // (`schemas/content/narrative.ts`), where only a human may confirm a draft, so it is
  // not this registry's business. Classifying the block `authored` on account
  // of a description it may not even have would demand an attribution for the
  // pixels, which nobody wrote.
  figure: "extracted",
  // A tabular source's sheet (bean `uyp8`: the first one, CODATA 2022). Its
  // headers and values are the source table's own, lifted verbatim, so it is
  // extracted exactly as prose is; a dataset narrative, when one is written,
  // carries its own attribution, as a figure's does.
  table: "extracted",
  // A recording's transcript, one block per language (bean
  // `folio-assistant-1r0p`). Authored: a recogniser's output is its account
  // of the speech, and a translation is a translator's, so each block names
  // who drafted it. Its text and review state are in `transcript/<lang>.json`
  // (`schemas/library/recording.ts`).
  transcript: "authored",
  // Stage B requirement candidates (cat-harness-tools#1356, owner 2026-11-01:
  // requirement extraction is a standard L1 step for DAK and DTH). Each is the
  // source's sentence, table row or indicator lifted verbatim, with the
  // source's own number or none, so it is extracted exactly as prose is.
  // Measured on an L1 library's indicator and registry-guide ingests:
  // without these, `narrative-provenance` reported every one "not classified".
  recommendation: "extracted",
  "functional-requirement": "extracted",
  "non-functional-requirement": "extracted",
  indicator: "extracted",
};

/** True when blocks of this kind are somebody's account rather than the source's text. */
export function isNarrativeKind(kind: string): boolean {
  return LIBRARY_BLOCK_ORIGIN[kind] === "authored";
}
