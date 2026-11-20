/**
 * A document's footnotes and the marks in its text that call them, as
 * `library/<slug>/footnotes.json` beside the L1 entry.
 *
 * Owner, 2026-11-11 (who-iris): "add to L1 doc schema errata" and "also foot
 * notes/marks". Written by the `pdf-footnotes.py` arm of `bun run cat ingest`
 * from the page layout (span size, position, the superscript flag). The
 * section text is not changed: a block is still the source's words in the
 * order printed. This file says which foot-of-page text is a note, which mark
 * calls it, and where.
 *
 * Only a note that a mark in the text calls is a footnote. A small-font line
 * that opens with a number is just as often a table row, a diagram label or a
 * running footer (10665/311941: 159 such lines, none called), so those are kept
 * apart as `uncalled_notes`, with the marks that found no note as
 * `unlinked_marks`. Neither is dropped.
 *
 * @module schemas/document-footnotes
 * @graphNode schema
 */
import { z } from "zod";

import { nodeKind } from "../kg/node-kind.js";

/** The `$schema` tag every footnotes sidecar carries. */
export const DOCUMENT_FOOTNOTES_SCHEMA = "folio-document-footnotes/v1" as const;

/** The sidecar's file name inside a library entry. */
export const FOOTNOTES_FILE = "footnotes.json";

/** A place in the text that calls a note: the page, and the words just before the mark. */
export const FootnoteCallSchema = z
  .object({
    page: z.number().int().min(1),
    /** Up to 60 characters before the mark, so a reader can find it on the page. */
    context: z.string(),
  })
  .strict();

const NoteBase = {
  /** `fn-p<page>-<n>`: the n-th note at the foot of that physical page. */
  id: z.string().regex(/^fn-p\d{3,}-\d+$/),
  page: z.number().int().min(1),
  /** The mark as printed: `3`, `a`, `*`, `†`. */
  mark: z.string().min(1),
  /** The note's text, its continuation lines joined. */
  text: z.string().min(1),
  /** The prose block holding the page, when the entry has one. */
  block: z.string().min(1).optional(),
};

export const FootnoteSchema = z
  .object({ ...NoteBase, marks: z.array(FootnoteCallSchema).min(1) })
  .strict();
export type Footnote = z.infer<typeof FootnoteSchema>;

export const UncalledNoteSchema = z.object(NoteBase).strict();

/** The fields of a footnotes sidecar: the {@link DocumentFootnotesKind}'s own, and the schema's. */
const documentFootnotesFields = {
  $schema: z.literal(DOCUMENT_FOOTNOTES_SCHEMA),
  entry: z.string().min(1),
  /**
   * `undetermined` when every page was OCR'd: OCR text has no fonts, so no
   * mark or note can be told from the body. `determined` otherwise, with the
   * OCR'd pages that were not read in `pages_unread`.
   */
  status: z.enum(["determined", "undetermined"]),
  pages_unread: z.array(z.number().int().min(1)).optional(),
  /** The span size carrying the most characters: what "smaller than the body" is measured against. */
  body_size: z.number().min(0),
  footnotes: z.array(FootnoteSchema),
  uncalled_notes: z.array(UncalledNoteSchema),
  unlinked_marks: z.array(z.object({ page: z.number().int().min(1), mark: z.string().min(1), context: z.string() }).strict()),
};

/** Note ids are unique within an entry, across footnotes and uncalled notes. */
function noteIdsUnique(s: { footnotes: readonly { id: string }[]; uncalled_notes: readonly { id: string }[] }, ctx: z.RefinementCtx): void {
  if (new Set([...s.footnotes, ...s.uncalled_notes].map((n) => n.id)).size !== s.footnotes.length + s.uncalled_notes.length) {
    ctx.addIssue({ code: "custom", message: "note ids are unique within an entry", path: ["footnotes"] });
  }
}

export const DocumentFootnotesSchema = z.object(documentFootnotesFields).strict().superRefine(noteIdsUnique);
export type DocumentFootnotes = z.infer<typeof DocumentFootnotesSchema>;

/**
 * `folio-document-footnotes/v1` as a node kind, the validator of the library
 * kind's family of that name (`validators/library-document-footnotes.json`).
 * It judges a file exactly as {@link DocumentFootnotesSchema} does.
 */
export const DocumentFootnotesKind = nodeKind(DOCUMENT_FOOTNOTES_SCHEMA, [], documentFootnotesFields, {
  strict: true,
  refine: noteIdsUnique,
  term: "Document footnotes",
  summary: "The footnotes of one library entry's source, the marks in its text that call them, and the small-font notes and marks that matched nothing.",
});
