/**
 * Where a large build artifact goes — and why it is never "a GitHub Release".
 *
 * @module cat-harness/schemas/artifact-store
 * @graphNode schema
 *
 * The pipeline step is **"publish a large artifact"**, and *how* is a property
 * of the layer, not of the step; a GitHub Release is one implementation, a
 * CDN such as Cloudflare another. As with `publication.host`, a layer that
 * has not said is `undefined`, and must never be read as `github-pages`.
 *
 * A store holds what is too large for the site tree (e.g. a search index for a
 * large catalogue), somewhere the site budget does not reach.
 *
 * ## Staging gets NO index
 *
 * A correctness rule: a release-built index on staging would return hits for
 * pages that have since changed — a wrong pass, believed. Absent is honest;
 * stale is not. So staging disables search and SAYS SO, since silence would
 * read as "no results".
 */
import { z } from "zod";

export const ARTIFACT_STORE_SCHEMA_TAG = "folio-artifact-store/v1";

/**
 * Where large artifacts go for this layer.
 *
 * `undefined` — no declaration — means the layer has **no** store, so the
 * publish step must REFUSE rather than fall back to a default. Falling back to
 * GitHub would silently publish somebody's data to a host they did not choose.
 */
export const ARTIFACT_STORE_KINDS = [
  /** A GitHub Release asset. Outside the Pages 1 GB budget; needs a token and a tag. */
  "github-release",
  /** Any object store reached over HTTPS — R2, S3, a university's own. */
  "object-store",
  /** A path inside the published site. Simple, and subject to the site's size budget. */
  "site-tree",
] as const;
export type ArtifactStoreKind = (typeof ARTIFACT_STORE_KINDS)[number];

export const ArtifactStoreSchema = z
  .object({
    $schema: z.literal(ARTIFACT_STORE_SCHEMA_TAG).optional(),
    kind: z.enum(ARTIFACT_STORE_KINDS),
    /**
     * The base the artifact will be READABLE at. Required, and it is the
     * "EXTREME care in URL handling" clause in schema form: a published URL is
     * a promise, and the address has to be decided before the upload rather
     * than discovered from whatever the host returned.
     */
    publicBaseUrl: z.string().url(),
    /**
     * Whether the store's URLs are immutable once published. `true` means a
     * re-publish MUST use a new path; `false` means readers may be served a
     * cached old copy for up to `cacheTtlSeconds`.
     */
    immutableUrls: z.boolean(),
    /** What a CDN in front of this store will hold onto. Absent means unstated, never zero. */
    cacheTtlSeconds: z.number().int().nonnegative().optional(),
    /** Largest single artifact, where the host states one. Absent means unstated, never unlimited. */
    maxArtifactBytes: z.number().int().positive().optional(),
    /** Why this store, in one sentence — it is a choice, and a choice with no reason cannot be revisited. */
    basis: z.string().min(1),
  })
  .strict();
export type ArtifactStore = z.infer<typeof ArtifactStoreSchema>;

/** Which pipeline stage is running. The index is built for exactly one of them. */
export const RENDER_STAGES = ["staging", "release"] as const;
export type RenderStage = (typeof RENDER_STAGES)[number];

/**
 * What the search index should be for a stage — never a boolean.
 *
 * Three outcomes, because "build it", "do not build it and say so" and "we
 * cannot publish it anywhere" are three different situations needing three
 * different messages to the reader.
 */
export type SearchIndexPlan =
  // input-site: inert #0d509b6c — type discriminant literal, not a directory path
  | { action: "build"; store: ArtifactStore; url: string }
  | { action: "omit"; reason: string }
  | { action: "refuse"; reason: string };

/**
 * Decide, for one stage.
 *
 * Deliberately takes the store as a possibly-`undefined` argument rather than
 * reading a default: a layer that has declared no store must reach
 * `refuse`, and a default would have published to somebody else's host.
 */
export function planSearchIndex(
  stage: RenderStage,
  store: ArtifactStore | undefined,
  estimatedBytes: number,
): SearchIndexPlan {
  if (stage === "staging") {
    return {
      action: "omit",
      reason:
        "staging builds no search index. A release-built index served on staging would return " +
        "hits for pages that have since changed — a wrong pass, believed. The page must SAY " +
        "search is unavailable here; silence reads as 'no results'.",
    };
  }
  if (!store) {
    return {
      action: "refuse",
      reason:
        "no artifact store is declared for this instance. Publishing to a default host would " +
        "put this data somewhere its owner did not choose — the same third-state rule " +
        "`publication.host` already follows.",
    };
  }
  if (store.maxArtifactBytes !== undefined && estimatedBytes > store.maxArtifactBytes) {
    return {
      action: "refuse",
      reason:
        `the index is an estimated ${estimatedBytes} bytes and this store states a limit of ` +
        `${store.maxArtifactBytes}. Shard it, or narrow what is indexed — publishing a truncated ` +
        `index would make an absent hit indistinguishable from an absent document.`,
    };
  }
  return {
    // input-site: inert #cd9e78f7 — action discriminant literal, not a directory path
    action: "build",
    store,
    url: `${store.publicBaseUrl.replace(/\/+$/, "")}/search-data.json`,
  };
}
