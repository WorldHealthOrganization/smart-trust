/**
 * Statements extracted from library sources, as a list a page can be built from.
 *
 * @module folio-assistant-core/schemas/extracted-statement
 * @graphNode schema
 *
 * The input of the standard step `publish-extracted-statements`: every
 * statement an extraction captured from a library entry, verbatim, with the
 * source it came from. Each content type, or each folio, COLLECTS its own
 * extraction into this one shape (a guideline's recommendation rows, a DAK
 * layer's requirement candidates, a paper's quoted claims), and core does the
 * rest: resolves each source to its section, labels it, renders the page and
 * checks that the page is current.
 *
 * ## Why the source is a library reference plus an optional page
 *
 * `source` is a {@link LibraryRef} (layer, library id, section id) so a
 * statement from another layer's library resolves through that layer's
 * declaration, never through a relative path. Many extractions record the
 * PAGE a statement was read from rather than the section (a poster, a slide
 * deck, a table): `page` lets the generator find the section from the entry's
 * `structure.json` instead of every collector re-implementing that rule.
 */
import { z } from "zod";
import type { LibraryRef } from "./library-ref.ts";

export const EXTRACTED_STATEMENTS_SCHEMA_ID = "folio-extracted-statements/v1" as const;

export const StatementSourceSchema = z
  .object({
    /** The DECLARED NAME of the layer holding the library; absent means this layer. */
    instance: z.string().min(1).optional(),
    /** The library entry: `library/<libraryId>/`. */
    libraryId: z.string().min(1),
    /** The section the statement was read from, when the extraction knows it. */
    sectionId: z.string().min(1).optional(),
    /** The page (or slide) the statement was read from, in the source's own numbering. */
    page: z.number().int().positive().optional(),
  })
  .strict();
export type StatementSource = z.infer<typeof StatementSourceSchema>;

export const ExtractedStatementSchema = z
  .object({
    /** Stable within the list; the anchor the statement's row is published under. */
    id: z.string().min(1),
    /** The statement as captured, verbatim. Never paraphrased here. */
    statement: z.string().min(1),
    /** The kind the extraction gave it: recommendation, requirement, candidate, … */
    kind: z.string().min(1).optional(),
    /** Its review state, as the extraction records it: published as is. */
    status: z.string().min(1).optional(),
    /**
     * The id of the statement this one was derived from, when it was: a
     * scenario candidate written from a recommendation names that
     * recommendation, so a reviewer can check one against the other. Its
     * `source` is still the library source, never the other statement.
     */
    derivedFrom: z.string().min(1).optional(),
    source: StatementSourceSchema,
  })
  .strict();
export type ExtractedStatement = z.infer<typeof ExtractedStatementSchema>;

export const ExtractedStatementsSchema = z
  .object({
    _schema: z.literal(EXTRACTED_STATEMENTS_SCHEMA_ID),
    /** What the list is, in a reader's words: a heading for its part of the page. */
    title: z.string().min(1).optional(),
    statements: z.array(ExtractedStatementSchema),
  })
  .strict();
export type ExtractedStatements = z.infer<typeof ExtractedStatementsSchema>;

/** The library reference a statement's source names. */
export function libraryRefOf(s: StatementSource): LibraryRef {
  return {
    ...(s.instance !== undefined ? { instance: s.instance } : {}),
    libraryId: s.libraryId,
    ...(s.sectionId !== undefined ? { sectionId: s.sectionId } : {}),
  };
}

export const STATEMENT_PAGE_SCHEMA_ID = "folio-statement-page/v1" as const;

/**
 * One generated page, declared in a committed file rather than on a command
 * line: the page's words and URLs are free text, and free text is never a
 * command-line word (`check:tools`, `tool-args-shell-safe`).
 *
 * Paths are relative to the spec file's own directory, so the spec says the
 * same thing wherever it is run from.
 */
export const StatementPageSchema = z
  .object({
    _schema: z.literal(STATEMENT_PAGE_SCHEMA_ID),
    /** The statement lists, in the order their parts appear. */
    statements: z.array(z.string().min(1)).min(1),
    /** The page to write. */
    out: z.string().min(1),
    title: z.string().min(1),
    intro: z.string().min(1).optional(),
    /** URL prefix of the library viewer: an entry's link is `<entryBase>/<libraryId>/`. */
    entryBase: z.string().url(),
    /** URL prefix of the sources: a section's link is `<sectionBase>/<repo-relative section file>`. */
    sectionBase: z.string().url(),
    /** The content type's look, written after each table (for example a kramdown class). */
    tableAttr: z.string().min(1).optional(),
  })
  .strict();
export type StatementPage = z.infer<typeof StatementPageSchema>;
