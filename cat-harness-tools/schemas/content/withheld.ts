/**
 * `folio-withheld/v1` — what a mounted directory must NOT publish.
 *
 * @module schemas/withheld
 * @graphNode schema
 *
 * The site mount (`scripts/mount-instance-docs.ts`) copies a layer's
 * directory wholesale, so a publication whose licence refuses redistribution
 * would stay reachable BY URL. The platform cannot know a layer's licence
 * rules; the layer's own generator writes this list from its own data, and
 * the mount honours it for every layer alike.
 *
 * Each entry names a path relative to the directory the file sits in — a
 * trailing `/` for a directory, which is withheld with its whole subtree — and
 * the reason, so a reader of the built site can tell "withheld" from "missing".
 */
import { z } from "zod";

/** One publication gate that did not permit publication, and its verdict (e.g. `refused`). */
export const WithheldGateSchema = z
  .object({
    gate: z.string().min(1),
    verdict: z.string().min(1),
  })
  .strict();

export const WithheldEntrySchema = z
  .object({
    /** Relative to the directory holding the file; a directory takes its whole subtree. */
    path: z.string().min(1),
    /** Why — which gate, which verdict. A withholding with no reason cannot be re-checked. */
    reason: z.string().min(1),
    /**
     * The gates that refused, STRUCTURED — issue #1794. Optional because a
     * generator may know only the sentence; when present, a reader shows
     * "copyright not granted" from the gate itself rather than parsing
     * {@link reason}, which is prose and free to change shape.
     */
    gates: z.array(WithheldGateSchema).min(1).optional(),
    /**
     * Where a reader can see what the work IS without being shown the work —
     * the catalogue record. `page` is a SITE-ROOT path (leading `/`) to a
     * published record page; `uri` is the upstream identifier (a Handle IRI,
     * say). Either may be absent; a viewer links `page` first, `uri` second,
     * and nothing at all rather than a guess.
     */
    record: z
      .object({
        id: z.string().min(1).optional(),
        page: z.string().regex(/^\//, "a site-root path, beginning with /").optional(),
        uri: z.string().url().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const WithheldSchema = z
  .object({
    $schema: z.literal("folio-withheld/v1"),
    _comment: z.string().optional(),
    paths: z.array(WithheldEntrySchema),
  })
  .strict();
export type Withheld = z.infer<typeof WithheldSchema>;
