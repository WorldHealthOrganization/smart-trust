/**
 * `referenced.json`: a library entry that RECORDS a source and holds none of
 * its text, written by `scripts/referenced-source.py`.
 *
 * For a source whose licence forbids posting copies (the OMG BPMN and DMN
 * specifications). The entry identifies the exact bytes (`source.sha256`), its
 * clause outline so a citation can name a clause and a page, and why the text
 * is withheld. `materialization` is a `folio-materialization/v1` record in
 * state `referenced` — the vocabulary `materialization-state.ts` defines; the
 * rest of the record (gates, purpose) is core's `materialization.ts`, restated
 * here only as far as this harness module may (harness does not depend on
 * core).
 *
 * @module schemas/referenced-source
 * @graphNode schema
 */
import { z } from "zod";

export const REFERENCED_SOURCE_SCHEMA_ID = "folio-referenced-source/v1" as const;

/**
 * A source that IS one file — the OMG specifications. `_tech_meta`'s block,
 * so `sha256` identifies the exact bytes that were read once to take the record.
 */
export const FileSourceSchema = z
  .object({
    file: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: z.number().int().min(0),
    mtime: z.string().nullable(),
    mimetype_sniffed: z.string().nullable(),
    mimetype_source: z.string().min(1),
  })
  .strict();

/**
 * A source that is a PUBLICATION rather than a file — a FHIR implementation
 * guide, which is a website of hundreds of pages plus a package, not one PDF.
 * Owner, 2026-10-02, paraphrased: add a trust IG to a content layer's library
 * as an external reference.
 *
 * There are NO bytes here to hash, and the variant says so by having no
 * `sha256` rather than by carrying a made-up one: the identity is the
 * publisher's own — `canonical` plus `version`, the pair a FHIR IG is cited
 * by — and `read_from` / `read_at` say which local record those were taken
 * from, so the claim can be re-derived rather than trusted.
 */
export const PublishedSourceSchema = z
  .object({
    kind: z.literal("published"),
    /** Where a reader goes to read it — the publisher's own address. */
    url: z.string().url(),
    canonical: z.string().url(),
    package_id: z.string().min(1),
    version: z.string().min(1),
    /** The repo-relative file the identity above was read from. */
    read_from: z.string().min(1),
    read_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

/**
 * Where else a reader can go for this source — the publisher's page, or a
 * page of THIS site that holds something about it (an artefact index).
 *
 * `site_path` is site-root-relative with no leading slash and no base, so the
 * viewer composes it against wherever the site is served — the bare site,
 * the project base, or a staging prefix — exactly as it composes an avatar.
 */
export const ReferencedLinkSchema = z.union([
  z.object({ label: z.string().min(1), url: z.string().url() }).strict(),
  z.object({ label: z.string().min(1), site_path: z.string().regex(/^[a-z0-9][a-z0-9._/-]*$/) }).strict(),
]);
export type ReferencedLink = z.infer<typeof ReferencedLinkSchema>;

export const ReferencedSourceSchema = z
  .object({
    $schema: z.literal(REFERENCED_SOURCE_SCHEMA_ID),
    identity: z
      .object({
        title: z.string().min(1),
        version: z.string().min(1),
        document_number: z.string().min(1),
        date: z.string().min(1),
        publisher: z.string().min(1),
      })
      .strict(),
    source: z.union([FileSourceSchema, PublishedSourceSchema]),
    outline: z.array(z.object({ level: z.number().int().min(1), title: z.string(), page: z.number().int().min(1).nullable() }).strict()),
    outline_source: z.enum(["embedded", "none"]),
    materialization: z
      .object({
        $schema: z.literal("folio-materialization/v1"),
        state: z.literal("referenced"),
        provenance: z.object({ upstream: z.object({ url: z.string().url() }).strict() }).strict(),
        note: z.string().min(1),
      })
      .strict(),
    withheld: z.object({ what: z.string().min(1), why: z.string().min(1) }).strict(),
    links: z.array(ReferencedLinkSchema).optional(),
  })
  .strict();
export type ReferencedSource = z.infer<typeof ReferencedSourceSchema>;
