/**
 * Errata of a library document: places where the SOURCE's own text is wrong,
 * recorded beside the L1 entry without changing that text.
 *
 * Owner, 2026-11-11 (who-iris, card Q-ODD-1 = A, and "add to L1 doc schema
 * errata"). Reading every derived block of the IRIS pilot turned up errors
 * that are in the publications themselves, not in the extraction: a workshop
 * report whose title says June 2006 and whose introduction says June 2005
 * (10665/205022), a Spanish edition that announces "nueve recomendaciones"
 * where the English and French list ten (10665/354399), a confidence interval
 * "48.7 to 48.7" (10665/381036). The blocks are the source's own words
 * (`provenance: "ingested"`) and stay exactly as printed. An erratum says what
 * is wrong, where, and what the evidence is.
 *
 * ## A sidecar, like the block summaries
 *
 * `library/<slug>/errata.json`, one file per entry, beside `summaries.json`
 * ({@link ../content/block-summary.ts}). It is AUTHORED, never written by an
 * ingest rung, so a re-ingest keeps it. Each erratum's explanation is a
 * {@link NarrativeSlotSchema}: an agent's note is a `draft` that names its
 * model, a person confirms or rejects it with `bun run cat narratives`, and it
 * can be given in several languages.
 *
 * ## What an erratum is NOT
 *
 * - An extraction defect (a garbled OCR line, a block cut in the wrong place).
 *   Those are fixed by re-deriving the entry, not recorded here.
 * - A correction of the text. `reading` is the reading the evidence supports,
 *   offered beside the source; nothing replaces the printed words.
 * - A place for content the owner has not asked to be flagged (personal data
 *   in a participant list, a "do not distribute" notice). Those are decisions
 *   about the document, not errors in it.
 *
 * @module schemas/document-errata
 * @graphNode schema
 */
import { z } from "zod";

import { nodeKind } from "../kg/node-kind.js";

import { NarrativeSlotSchema, narrativesOfSlot } from "./narrative.ts";

/** The `$schema` tag every errata sidecar carries. */
export const DOCUMENT_ERRATA_SCHEMA = "folio-document-errata/v1" as const;

/** The sidecar's file name inside a library entry. */
export const ERRATA_FILE = "errata.json";

/**
 * What kind of error the source makes.
 *
 * - `error` — a statement that is wrong on the source's own evidence (a number
 *   that contradicts the table it summarises, a drug named in the wrong
 *   section, a misspelling on a cover).
 * - `inconsistency` — two places in the source, or two of its official
 *   language editions, disagree, and the source does not say which is right.
 * - `residue` — drafting left in the published file: a placeholder ("Click or
 *   tap here to enter text."), an editor's comment, contents page numbers
 *   "xx", another document's cover.
 * - `translation` — an official translation says something its original does
 *   not (an expansion of an acronym that names a different vaccine).
 */
export const ERRATUM_KINDS = ["error", "inconsistency", "residue", "translation"] as const;

export const ErratumSchema = z
  .object({
    /** Stable within the entry: `e1`, `e2`, ... Never reused for another erratum. */
    id: z.string().regex(/^e\d+$/, "an erratum id is `e` and a number"),
    kind: z.enum(ERRATUM_KINDS),
    /** The block that prints it, e.g. `library/<slug>/blocks/prose-sec-003`, when one does. */
    block: z.string().min(1).optional(),
    /** The physical PDF page (1-based) it is printed on, when known. */
    page: z.number().int().min(1).optional(),
    /** The words as printed, verbatim, so the place can be found and checked. */
    quote: z.string().min(1),
    /** The reading the evidence supports, when there is one. Never substituted for `quote`. */
    reading: z.string().min(1).optional(),
    /**
     * What shows it is an error, in a form a person can check: the other page,
     * table or edition that disagrees, quoted or cited.
     */
    evidence: z.string().min(1),
    /** The explanation a reader is shown, with its state and author. */
    narrative: NarrativeSlotSchema,
  })
  .strict()
  .refine((e) => e.block !== undefined || e.page !== undefined, {
    message: "an erratum names the block or the page it is on",
    path: ["block"],
  })
  .refine((e) => narrativesOfSlot(e.narrative).every((n) => n.state !== "not-authored"), {
    message: "an erratum carries its explanation",
    path: ["narrative", "state"],
  });
export type Erratum = z.infer<typeof ErratumSchema>;

/** The fields of an errata sidecar: the {@link DocumentErrataKind}'s own, and the schema's. */
const documentErrataFields = {
  $schema: z.literal(DOCUMENT_ERRATA_SCHEMA),
  /** The library entry's slug, the directory this file sits in. */
  entry: z.string().min(1),
  errata: z.array(ErratumSchema).min(1),
};

/** Erratum ids are unique within an entry. */
function errataIdsUnique(s: { errata: readonly { id: string }[] }, ctx: z.RefinementCtx): void {
  if (new Set(s.errata.map((e) => e.id)).size !== s.errata.length) {
    ctx.addIssue({ code: "custom", message: "erratum ids are unique within an entry", path: ["errata"] });
  }
}

export const DocumentErrataSchema = z.object(documentErrataFields).strict().superRefine(errataIdsUnique);
export type DocumentErrata = z.infer<typeof DocumentErrataSchema>;

/**
 * `folio-document-errata/v1` as a node kind, the validator of the library
 * kind's family of that name (`validators/library-document-errata.json`). It
 * judges a file exactly as {@link DocumentErrataSchema} does.
 */
export const DocumentErrataKind = nodeKind(DOCUMENT_ERRATA_SCHEMA, [], documentErrataFields, {
  strict: true,
  refine: errataIdsUnique,
  term: "Document errata",
  summary: "The errors recorded against one library entry's own source, each placed at a block or a page.",
});
