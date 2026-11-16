/**
 * An intake record — what one capture put into `uploads/<doc>/`, and where it
 * came from. `folio-intake/v1`, built only from schemas this repository
 * already has:
 *
 * | part | reused from | not repeated here |
 * |---|---|---|
 * | what the item IS (title, identifiers, handle, type, subject) | the Dublin Core record, `folio-dublin-core/v1` | `title` only when nothing else describes it |
 * | the item itself, its materialization and gates | the catalogue node, `folio-catalogue-node/v1` | the intake points at it (`item`) |
 * | where the capture came from | `SourceProvenanceSchema` (`upstream` / `local`) | `system` / `instance`: the upstream URL's host says it |
 * | when and by whom | `capturedAt` as `folio-extraction/v1` means it — the capture moment | |
 * | each file's bytes | `ArchiveEntrySchema`'s `path` / `bytes` / `sha256` / `mimetype_sniffed` | |
 *
 * @graphNode schema
 * @module schemas/intake
 */
import { z } from "zod";
import { SourceLicenceSchema } from "./source-licence.ts";

import { SourceProvenanceSchema } from "./source-provenance.ts";
import { ArchiveEntrySchema } from "./archive-contents.js";

export const INTAKE_SCHEMA_TAG = "folio-intake/v1";

/**
 * ISO 8601 date-time, the offset optional. A capture tool that recorded local
 * time with no zone is kept unzoned: adding `Z` would assert UTC nobody knows.
 */
const DateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/, "an ISO 8601 date-time");

/** Where the capture came from, and when. */
export const IntakeSourceSchema = SourceProvenanceSchema.extend({
  /** The capture moment — not when this record was written. */
  capturedAt: DateTime,
  /** Who or what captured it. */
  capturedBy: z.string().min(1).optional(),
}).strict();

/** One file the capture delivered. */
export const IntakeFileSchema = ArchiveEntrySchema.pick({
  path: true,
  bytes: true,
  sha256: true,
  mimetype_sniffed: true,
})
  .extend({
    /** What the file is: `publication`, `full-item-record`, `item-page`, `upload`… */
    type: z.string().min(1),
    /** What it is FOR here: `original-bitstream`, `metadata-source`, `webpage-theme-source`, `none`. */
    role: z.string().min(1),
    note: z.string().min(1).optional(),
  })
  .strict();

/**
 * Where a classification came from, in order of precedence (bean `mffs`):
 * a person **declared** it; the process that acquired the item **decided** it
 * from its context (a DAK's library step fetching a source Component 1 cites);
 * a rule **inferred** it from the item's metadata. A consumer takes the
 * highest-precedence one and reports any that disagree, never silently
 * picking one.
 */
export const CLASSIFICATION_SOURCES = ["declared", "context", "inferred"] as const;

/**
 * One judgement that the captured item is, or is not, a member of a class in
 * a named scheme — for example the SMART Guidelines knowledge-graph layer an
 * item belongs to (scheme `https://smart.who.int/kg/layer`, code `l1`).
 *
 * The platform owns only the record's shape; the content type owns the scheme,
 * its codes, and the rule that infers one. `member: false` is a finding, not
 * an absence: "this is not L1" stops the next ingest re-asking.
 */
export const IntakeClassificationSchema = z
  .object({
    scheme: z.string().min(1),
    code: z.string().min(1),
    member: z.boolean(),
    /** Qualifiers the scheme defines, e.g. `{ publicationType: "implementation-guidance" }`. */
    properties: z.record(z.string(), z.string()).optional(),
    source: z.enum(CLASSIFICATION_SOURCES),
    /** Why — the rule, the person's words, or the process step. Required: an unexplained classification is a guess. */
    basis: z.string().min(1),
    by: z.string().min(1).optional(),
    at: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "an ISO 8601 date").optional(),
  })
  .strict();
export type IntakeClassification = z.infer<typeof IntakeClassificationSchema>;

export const IntakeSchema = z
  .object({
    $schema: z.literal(INTAKE_SCHEMA_TAG),
    /** The upload directory's name. */
    doc_id: z.string().min(1),
    /** The catalogue node this capture is of, by its `id` (`item/<uuid>`). */
    item: z.string().min(1).optional(),
    /** The Dublin Core record describing it, relative to this file. */
    record: z.string().min(1).optional(),
    /** A title — only for a capture nothing else describes. */
    title: z.string().min(1).optional(),
    /** Authored context for a person reading the file. */
    _comment: z.string().min(1).optional(),
    source: IntakeSourceSchema,
    files: z.array(IntakeFileSchema),
    /**
     * The licence the uploader established, as the SAME record a library
     * manifest carries as `licenceRecord` (`schemas/library/source-licence.ts`, bean
     * `7bg9`). Read by the EARLY licence step of document ingestion, before
     * any derivation. Absent means nobody recorded one — reported as
     * undetermined, never as cleared.
     */
    licence: SourceLicenceSchema.optional(),
    /** Classifications of the captured item ({@link IntakeClassificationSchema}). */
    classifications: z.array(IntakeClassificationSchema).optional(),
  })
  .strict()
  .refine((i) => i.item !== undefined || i.record !== undefined || i.title !== undefined, {
    message: "an intake names what it is a capture OF: a catalogue `item`, a Dublin Core `record`, or — only when neither exists — a `title`",
  });
export type Intake = z.infer<typeof IntakeSchema>;
