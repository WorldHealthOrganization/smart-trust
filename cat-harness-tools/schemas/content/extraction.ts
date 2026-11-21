/**
 * What an EXTRACTION produced, and when — provenance for assets pulled out of
 * a container.
 *
 * ## Three timestamps, three meanings
 *
 * | | says |
 * |---|---|
 * | `dc.date.issued` | when the PUBLISHER published the work |
 * | `materializedAt` | when WE brought the bytes local (core's `materialization.ts`) |
 * | `extractedAt` here | when a TOOL produced this file out of something else |
 *
 * **An extraction timestamp is never a publication date.** A captured file's
 * dates are when it was saved, not when the work was published, and its
 * producer string (e.g. a browser's print-to-PDF) is often the only evidence
 * that the artefact is second-hand.
 *
 * ## Metadata, not contents
 *
 * The default product of reading a container is this record — a list of what
 * is inside, with sizes, types and digests — and NOT the files. Contents are
 * extracted only on explicit request. An {@link ExtractedAsset} describes an
 * entry; `localPath` is present only where that entry was asked for, and its
 * absence is the normal state.
 *
 * It is the contract behind the harness's `asset-extraction` skill, written
 * by `scripts/extract-assets.ts`.
 *
 * @graphNode schema
 * @module schemas/extraction
 */
import { z } from "zod";

/** The tag every extraction record declares, per the `$schema` convention. */
export const EXTRACTION_SCHEMA_TAG = "folio-extraction/v1";

/**
 * How the assets were got out.
 *
 * Named for the CONTAINER rather than the tool, because the container is what
 * a later reader has in hand. Which unzip implementation ran is `producer`.
 */
export const EXTRACTION_METHODS = ["zip", "pdf", "saved-webpage", "tarball"] as const;
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

/**
 * One entry inside a container.
 *
 * `bytes` and `mediaType` are read from the container's own index where it has
 * one — a zip central directory carries both without decompressing anything,
 * which is what makes a metadata-only pass possible at all.
 */
export const ExtractedAssetSchema = z
  .object({
    /** Path INSIDE the container, exactly as the container spells it. */
    path: z.string().min(1),
    /** Uncompressed size in bytes, from the container's index. */
    bytes: z.number().int().nonnegative(),
    /**
     * Media type.
     *
     * `unknown` is a real answer and is not defaulted to
     * `application/octet-stream`: "nobody looked" and "we looked and could not
     * tell" are different findings, and only the second is actionable.
     */
    mediaType: z.string().min(1).optional(),
    /**
     * The entry's own timestamp, as the container records it.
     *
     * For a saved webpage every entry carries the SAVE time rather than the
     * asset's own — measured on the IRIS capture, where all 40-odd entries
     * read `2026-09-20 07:42`. Recorded anyway, because "they are all the
     * same and they are all the capture" is itself the evidence that the
     * container is a capture.
     */
    modifiedAt: z.string().min(1).optional(),
    /** sha256 of the entry's bytes, when it was read rather than indexed. */
    sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    /**
     * Where the entry was written, IF it was written.
     *
     * Absent is the normal state. Contents are extracted only on an explicit
     * ask; see the module docs.
     */
    localPath: z.string().min(1).optional(),
    /** Why this one entry was extracted, when one was. */
    extractedBecause: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.localPath !== undefined && a.extractedBecause === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["extractedBecause"],
        message:
          "an entry written to disk states WHY: contents are extracted only on an explicit ask, " +
          "and an unexplained local copy cannot be told from one nobody authorised",
      });
    }
  });
export type ExtractedAsset = z.infer<typeof ExtractedAssetSchema>;

export const ExtractionSchema = z
  .object({
    $schema: z.literal(EXTRACTION_SCHEMA_TAG),
    /** The container this describes, repo-relative. */
    container: z.string().min(1),
    method: z.enum(EXTRACTION_METHODS),
    /**
     * When the CONTAINER'S CONTENTS were produced — the capture moment.
     *
     * NOT when we read it, and NOT when the work was published. For a saved
     * webpage this is the save; for a printed PDF, its `CreationDate`.
     */
    capturedAt: z.string().min(1).optional(),
    /**
     * The tool that produced the container, verbatim.
     *
     * `Skia/PDF m152` is Chrome's print-to-PDF, and reading that string is the
     * only way to tell a publisher's PDF from a printed web page. Recorded as
     * written, never normalised to "Chrome": the version is part of the
     * evidence.
     */
    producer: z.string().min(1).optional(),
    /** When THIS record was written — a fact about the reading, not the file. */
    readAt: z.string().min(1),
    /** Every entry the container indexes. */
    assets: z.array(ExtractedAssetSchema),
    /**
     * Entries deliberately not listed, and why.
     *
     * A zip written on macOS carries a `__MACOSX/` shadow for every entry.
     * Dropping them silently would make the asset count disagree with the
     * container's own, so the reason is recorded instead.
     */
    omitted: z
      .array(z.object({ pattern: z.string().min(1), reason: z.string().min(1), count: z.number().int().nonnegative() }).strict())
      .optional(),
  })
  .strict();
export type Extraction = z.infer<typeof ExtractionSchema>;

/**
 * Do every entry's timestamps agree, to the minute?
 *
 * When they do, the container is a CAPTURE — one act wrote all of it — and no
 * entry's date says anything about that asset's own history. When they do not,
 * the container preserved real per-file dates and they can be read as such.
 *
 * This is the question that stops an extraction timestamp being mistaken for a
 * publication date, so it is computed rather than asserted in prose.
 */
export function isSingleCapture(x: Extraction): boolean | undefined {
  const stamps = x.assets.map((a) => a.modifiedAt).filter((s): s is string => s !== undefined);
  if (stamps.length < 2) return undefined;
  const minute = (s: string): string => s.slice(0, 16);
  return new Set(stamps.map(minute)).size === 1;
}

/** Total indexed size, so a reader need not trust a number written in prose. */
export function totalBytes(x: Extraction): number {
  return x.assets.reduce((n, a) => n + a.bytes, 0);
}

/** The entries whose contents were actually written out. */
export function extractedAssets(x: Extraction): ExtractedAsset[] {
  return x.assets.filter((a) => a.localPath !== undefined);
}
