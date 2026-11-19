/**
 * `<library>/<slug>/extraction.json` — which extractors ran over an entry, and
 * what each found.
 *
 * ## Why a record and not the artefacts
 *
 * An artefact's ABSENCE says nothing. An entry with no `tabular.csvw.json` is
 * either a document that prints no table or one whose table step never ran,
 * and a viewer showing "no tables" over the second is telling the reader
 * something nobody checked (owner, 2026-11-14: "not sure all have biblio,
 * glossary, table, figure, keyword, TOC, section, summaries etc fully
 * extracted"). So each step that runs says so here, per KIND:
 *
 * | state | means |
 * |---|---|
 * | `found` | the step ran and found `count` (> 0) |
 * | `partial` | the step ran and found some, but not all it could stand behind — the `note` says what is missing (a contents tree refused below the trust floor, vector renders not yet inspected) |
 * | `none` | the step ran over the source and found nothing |
 * | `not-extracted` | no step for this kind ran, or it ran and could not look — the `note` says which |
 *
 * A kind this record does not name is `not-extracted`, never `none`: "nobody
 * looked" and "somebody looked and found nothing" are different facts, and a
 * default would collapse them.
 *
 * The shape is the one the library viewer reads (`entryCoverage` in
 * `scripts/lib/library-document.ts`), so the two cannot drift: kinds
 * `contents`, `sections`, `figures`, `tables`, `references`, `glossary`,
 * `footnotes`, `summaries`. `tool`, `version`, `at` and `doc_id` are
 * provenance the viewer ignores.
 *
 * Written by `cat ingest` (`scripts/entry-extraction.ts`); another layer's
 * step — a reference-list or glossary reader — records its own kind through
 * `recordExtraction` in the same module. ADVISORY: `check-l1-complete.ts`
 * reports it per entry and gates nothing on it.
 *
 * @graphNode schema
 * @module schemas/library/entry-extraction
 */
import { z } from "zod";

import { nodeKind } from "../kg/node-kind.js";

export const ENTRY_EXTRACTION_SCHEMA_ID = "folio-library-extraction/v1" as const;

/** The file each library entry carries, beside `structure.json`. */
export const ENTRY_EXTRACTION_FILE = "extraction.json";

/** What was extracted, in report order. */
export const EXTRACTION_KINDS = [
  "contents",
  "sections",
  "figures",
  "tables",
  "references",
  "glossary",
  "footnotes",
  "summaries",
] as const;
export type ExtractionKind = (typeof EXTRACTION_KINDS)[number];

export const EXTRACTION_STATES = ["found", "partial", "none", "not-extracted"] as const;
export type ExtractionState = (typeof EXTRACTION_STATES)[number];

export const ExtractionStepSchema = z
  .object({
    state: z.enum(EXTRACTION_STATES),
    /** How many were found. Required above 0 for `found`; 0 or absent for `none`; absent for `not-extracted`. */
    count: z.number().int().nonnegative().optional(),
    /** Why, for `partial` and `not-extracted`; a note otherwise. */
    note: z.string().min(1).optional(),
    /** The step that ran, as its script or tool name. */
    tool: z.string().min(1).optional(),
    /** The tool's version — for a script, the first 12 hex of its sha256. */
    version: z.string().min(1).optional(),
    /** When it ran, ISO date or date-time. */
    at: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    const issue = (message: string, path: string[] = ["count"]) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (s.state === "found" && !(typeof s.count === "number" && s.count > 0)) issue("`found` needs a count above 0");
    if (s.state === "none" && s.count !== undefined && s.count !== 0) issue("`none` is a count of 0 — the step looked and found nothing");
    if (s.state === "not-extracted" && s.count !== undefined) issue("`not-extracted` carries no count: nothing was counted");
    if ((s.state === "partial" || s.state === "not-extracted") && !s.note) issue(`\`${s.state}\` must say why`, ["note"]);
  });
export type ExtractionStep = z.infer<typeof ExtractionStepSchema>;

export const EntryExtractionSchema = z
  .object({
    $schema: z.literal(ENTRY_EXTRACTION_SCHEMA_ID),
    doc_id: z.string().min(1).optional(),
    kinds: z.record(z.string().min(1), ExtractionStepSchema),
  })
  .strict();
export type EntryExtraction = z.infer<typeof EntryExtractionSchema>;

/**
 * `folio-library-extraction/v1` as a node kind, the validator of the library
 * kind's family of that name (`validators/library-extraction.json`). Strict, as
 * {@link EntryExtractionSchema} is, so the validator judges a file exactly as
 * the writer's own schema does.
 */
export const EntryExtractionKind = nodeKind(ENTRY_EXTRACTION_SCHEMA_ID, [], EntryExtractionSchema.shape, {
  strict: true,
  term: "Library extraction record",
  summary: "Which extractor read a library entry and, per kind (contents, sections, figures, tables, references, glossary, footnotes, summaries), whether it found some, part, none, or was not run.",
});
