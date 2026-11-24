/**
 * `library/<slug>/candidates.json` — Stage B's proposals for an entry,
 * written by `scripts/extract-candidates.py` (a class extractor, the
 * `--aspects-only` aspects, or by hand in the same shape) and turned into one
 * typed block each by `pipeline/gen-library-jsonld.ts`.
 *
 * Proposals only: nothing here is folio content. The whole-document fields
 * (`document_class`, `validated`, `disposition`) are optional: an aspect run
 * or a hand-written record says nothing about the whole document.
 *
 * Each candidate is open beyond the fields every reader relies on: an
 * extractor carries what its class knows (`grade_nearby`, `label_prefix`).
 *
 * @graphNode schema
 */
import { z } from "zod";

export const INGEST_CANDIDATES_SCHEMA_ID = "ingest-candidates/v1" as const;
/** The file an entry carries once Stage B has run. */
export const INGEST_CANDIDATES_FILE = "candidates.json";

export const IngestCandidateSchema = z
  .object({
    kind: z.string().min(1),
    statement: z.string().optional(),
    name: z.string().nullable().optional(),
    /** The source's OWN number for the item, or null. Never one an agent made up. */
    number: z.string().nullable().optional(),
    source_kind: z.string().nullable().optional(),
    /** The aspect that proposed it; absent for a class extractor's or a hand-written candidate. */
    aspect: z.string().optional(),
    section_file: z.string().regex(/^sections\/.+\.md$/),
    section_title: z.string().nullable().optional(),
    pages: z.string().nullable().optional(),
    strength: z.string().nullable().optional(),
    formalization_candidate: z.boolean().optional(),
    route_to: z.string().nullable().optional(),
  })
  .passthrough();

export const IngestCandidatesSchema = z
  .object({
    _schema: z.literal(INGEST_CANDIDATES_SCHEMA_ID),
    doc_id: z.string().nullable().optional(),
    document_class: z.string().nullable().optional(),
    validated: z.boolean().optional(),
    aspects: z.array(z.string()).optional(),
    source: z.object({ structure_sha256: z.string().nullable().optional(), file: z.string().nullable().optional() }).passthrough().optional(),
    provenance: z.record(z.string(), z.unknown()).optional(),
    disposition: z.string().optional(),
    summary: z
      .object({
        candidates: z.number().int().min(0),
        by_kind: z.record(z.string(), z.number().int().min(0)),
        formalization_candidates: z.number().int().min(0),
      })
      .optional(),
    candidates: z.array(IngestCandidateSchema),
  })
  .passthrough();

export type IngestCandidates = z.infer<typeof IngestCandidatesSchema>;
