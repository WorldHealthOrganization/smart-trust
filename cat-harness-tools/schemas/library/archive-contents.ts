/**
 * An archive's entry list, as data.
 *
 * A tar or zip in `uploads/` is opaque to every grep in the corpus.
 * `contents.jsonld` lists its entries, one shape whatever the container
 * format, so a consumer reads archives without knowing whether it was tar or
 * zip.
 *
 * ## An archive entry is described like a loose file
 *
 * `bytes`, `sha256`, `mtime`, `mimetype_sniffed`, `mimetype_source` are the
 * vocabulary `_tech_meta.py` defines for a file on disk, reused verbatim. The
 * mimetype is sniffed from the entry's OWN leading bytes and never from its
 * name, which is only a claim by whoever built the archive.
 *
 * ## Three entry states, not two
 *
 * A `directory` carries no size and no digest (a zero would be a measurement
 * nobody made). An entry that could not be read carries
 * `mimetype_source: "unreadable"`, which is NOT the same as an empty file,
 * and a `symlink` or `special` is listed with its kind rather than dropped.
 *
 * @module schemas/archive-contents
 * @graphNode schema
 */
import { z } from "zod";

import { ContentContextSchema } from "../kg/jsonld";

export const ARCHIVE_ENTRY_KINDS = ["file", "directory", "symlink", "special"] as const;
export type ArchiveEntryKind = (typeof ARCHIVE_ENTRY_KINDS)[number];

/** Where an entry's mimetype came from, or why there is none. */
export const ENTRY_MIMETYPE_SOURCES = ["magic-bytes", "unrecognised", "unreadable"] as const;

export const ArchiveEntrySchema = z.object({
  /** Path inside the archive, exactly as the container records it. */
  path: z.string().min(1),
  kind: z.enum(ARCHIVE_ENTRY_KINDS),
  bytes: z.number().int().nonnegative().optional(),
  mtime: z.string().optional(),
  /** Full 64-hex digest of the entry's bytes; `null` when it could not be read. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
  mimetype_sniffed: z.string().nullable().optional(),
  mimetype_source: z.enum(ENTRY_MIMETYPE_SOURCES).optional(),
});
export type ArchiveEntry = z.infer<typeof ArchiveEntrySchema>;

export const ARCHIVE_CONTENTS_SCHEMA_ID = "folio-archive-contents/v1";

export const ArchiveContentsSchema = z
  .object({
    /**
     * The published content context — bean `yh6u`. OPTIONAL because folio
     * repositories hold records written before the arm emitted it; when
     * present it must be that context (bare, or with `@base` beside it —
     * bean `bh4q`), since any other would bind these keys to terms nobody
     * declared.
     */
    "@context": ContentContextSchema.optional(),
    $schema: z.literal(ARCHIVE_CONTENTS_SCHEMA_ID),
    "@id": z.string().min(1),
    /** The archive file's own `_tech_meta` block. */
    archive: z.record(z.string(), z.unknown()),
    format: z.enum(["zip", "tar"]),
    entries: z.array(ArchiveEntrySchema),
    // Counts are RECORDED rather than left to be counted off the array. A
    // reader should not have to re-derive a number the producer already knew,
    // and a disagreement between the two is a defect worth being able to see.
    n_entries: z.number().int().nonnegative(),
    n_files: z.number().int().nonnegative(),
    n_directories: z.number().int().nonnegative(),
    uncompressed_bytes: z.number().int().nonnegative(),
  })
  .refine((d) => d.n_entries === d.entries.length, {
    message: "`n_entries` disagrees with `entries.length` — one of them is wrong",
    path: ["n_entries"],
  });

export type ArchiveContents = z.infer<typeof ArchiveContentsSchema>;

/**
 * Sniffed mimetypes that mean "this is an archive, list its contents".
 *
 * Shared with `scripts/ingest-document.ts`, which routes on it: the rung a
 * file takes and the requirement the gate applies to the result are two
 * readings of one fact, so they read the same constant.
 */
export const ARCHIVE_MIMETYPES = ["application/zip", "application/gzip", "application/x-tar"] as const;

export function isArchiveMimetype(m: unknown): boolean {
  return typeof m === "string" && (ARCHIVE_MIMETYPES as readonly string[]).includes(m);
}
