/**
 * Binary releases — what was published, under what version, with what digest.
 * **Never the bytes.**
 *
 * @module schemas/binary-release
 * @graphNode schema
 *
 * One node per release. It records a release's id, its version, each asset's
 * digest and size, and where each asset is fetched from. It holds no content,
 * and the schema is `.strict()` throughout so a field carrying a payload
 * cannot be added by accident.
 *
 * ## Not a `materialization`
 *
 * Every `MATERIALIZATION_PURPOSES` value (`working | archival | both |
 * compiled`) is about a **copy this instance holds**. A release is about a
 * **publication upstream**, true whether or not a byte was ever fetched and
 * after every local copy is deleted. The two compose: a release node says
 * *v1.8.0 published `package.tgz`, 41 MB, sha256 …, at this URL*; a
 * materialization record says *and a copy of it is here, taken for this
 * purpose*.
 *
 * ## `state`, and `recordsWork: false`
 *
 * The release pipeline appends a node when it publishes, so it is `state`. It
 * is not `derived`: re-running a release pipeline produces a **different
 * release** (unlike {@link module:schemas/ig-metadata-index | `ig-metadata-index`},
 * where re-harvesting an unchanged IG gives the same file back).
 * `recordsWork: false`: a published release is a completed fact, nothing an
 * arriving agent can pick up. `check:graph-typology-work` refuses a `state`
 * kind that has not decided.
 *
 * ## The case the kind exists for: the deploy purge
 *
 * Files larger than 100 MB are deleted from the deployed tree before
 * deployment, after which nothing else records that they existed. A release
 * node is the only place that fact can live, which is why
 * {@link ASSET_DISPOSITIONS} has a value for it and why an asset in that state
 * must still say where it is fetched from.
 *
 * ## Three things enforced structurally
 *
 * 1. **Never the bytes.** Every object is `.strict()`, so a `content` or
 *    `data` key fails validation rather than being carried, and `fetchedFrom`
 *    is required on every asset — including a purged one.
 * 2. **A deletion must say why.** `deleted-before-deploy` requires
 *    `dispositionReason`, so a decision can be told from an accident.
 * 3. **Could-not-determine is never clean.** `verifiedAt` lives INSIDE
 *    {@link ReleaseDigestSchema}, so a verification time with no digest is
 *    unrepresentable. And {@link binaryReleaseVerdict} returns `unknown`,
 *    never `ok`, for a release with any undigested asset or any disposition
 *    nobody has established.
 */
import { z } from "zod";

/** The tag a `binary-release` document carries, so it is identified by declaration. */
export const BINARY_RELEASE_SCHEMA_TAG = "folio-binary-release/v1";

/**
 * Where a release was published.
 *
 * Open enough to cover what this repository actually publishes to and no
 * wider. A `workflow-artifact` is included because it is where `qa.json` and
 * the Publisher's outputs land, and it expires — which is a fact about a
 * release worth being able to state.
 */
export const RELEASE_ORIGINS = ["github-release", "package-registry", "workflow-artifact", "pages-site"] as const;
export const ReleaseOriginSchema = z.enum(RELEASE_ORIGINS);
export type ReleaseOrigin = z.infer<typeof ReleaseOriginSchema>;

/**
 * What became of one asset after it was published.
 *
 * - **`published`** — it is where the release put it, and still is.
 * - **`deleted-before-deploy`** — the WHO deploy phase's >100 MB purge, or any
 *   equivalent. Published, then removed from the deployed tree. The case this
 *   kind exists for: after the purge, this node is the only record the file
 *   ever existed.
 * - **`superseded`** — a later release replaced it under the same name.
 * - **`expired`** — a workflow artifact's retention window closed. Distinct
 *   from `deleted-before-deploy` because nobody decided it, which is exactly
 *   the distinction rule 2 in the module doc exists to keep.
 * - **`unknown`** — nobody has looked since. Never read as `published`.
 */
export const ASSET_DISPOSITIONS = ["unknown", "published", "deleted-before-deploy", "superseded", "expired"] as const;
export const AssetDispositionSchema = z.enum(ASSET_DISPOSITIONS);
export type AssetDisposition = z.infer<typeof AssetDispositionSchema>;

/** The dispositions that are a DECISION rather than a fact, and so must say why. */
export const DECIDED_DISPOSITIONS = ["deleted-before-deploy", "superseded"] as const;

/**
 * A digest over an asset's bytes.
 *
 * The same shape as `FixitySchema`, restated rather than imported. It was a
 * deliberate duplicate while `FixitySchema` lived in core's `materialization.ts`:
 * nothing under `cat-harness/` imports from the content core. Since bean
 * `tlat` (2026-10-02) `FixitySchema` lives in this layer, in
 * `materialization-state.ts`, so the two CAN now be unified without an upward
 * import; that is left as its own change, because this one's `verifiedAt`
 * semantics are a release's, and unifying is a decision about whether they are
 * the same claim, not only the same shape.
 *
 * `verifiedAt` records when the digest was last RE-COMPUTED against the bytes,
 * not when it was written down. An unverified digest ages.
 */
export const ReleaseDigestSchema = z
  .object({
    algorithm: z.literal("sha256"),
    digest: z.string().regex(/^[0-9a-f]{64}$/, "a sha256 digest is 64 lowercase hex characters"),
    verifiedAt: z.string().min(1).optional(),
  })
  .strict();
export type ReleaseDigest = z.infer<typeof ReleaseDigestSchema>;

/**
 * One published file.
 *
 * `bytes` is required and `digest` is not: a size is always knowable from a
 * listing, while a digest sometimes is not, and pretending otherwise would
 * force a fabricated hash. What is NOT permitted is a claim of verification
 * without one — see the refinement below.
 */
export const ReleaseAssetSchema = z
  .object({
    /** The file's published name, e.g. `package.tgz`. */
    name: z.string().min(1),
    /** Size in bytes. Required — this is half of what the node is for. */
    bytes: z.number().int().nonnegative(),
    digest: ReleaseDigestSchema.optional(),
    /**
     * Where the bytes are fetched from. **Required, even for a purged asset**
     * — a record of a file it cannot get back is a size and a hash with no
     * referent.
     */
    fetchedFrom: z.string().min(1),
    /** Media type, where the publisher declares one. */
    contentType: z.string().min(1).optional(),
    disposition: AssetDispositionSchema,
    /** Why, for a disposition somebody DECIDED. Required for those; refused for the rest. */
    dispositionReason: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    const decided = (DECIDED_DISPOSITIONS as readonly string[]).includes(a.disposition);
    if (decided && a.dispositionReason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dispositionReason"],
        message: `\`${a.disposition}\` is a decision, and a decision with no recorded reason cannot be told from an accident — say why the file went`,
      });
    }
    if (!decided && a.dispositionReason !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dispositionReason"],
        message: `\`${a.disposition}\` is not a decision anybody made, so a reason here would attribute one — drop it, or record the disposition that was actually decided`,
      });
    }
  });
export type ReleaseAsset = z.infer<typeof ReleaseAssetSchema>;

/** The publication EVENT itself. */
export const ReleaseIdentitySchema = z
  .object({
    /** The release's own id in its origin — a GitHub release id, a registry key. */
    id: z.string().min(1),
    /** The version released. Required: an id alone collides across re-publications. */
    version: z.string().min(1),
    /** The git tag, where the origin uses one. */
    tag: z.string().min(1).optional(),
    /** When it was published. */
    publishedAt: z.string().min(1).optional(),
    /** The human-facing page for the release, if there is one. */
    url: z.string().url().optional(),
  })
  .strict();
export type ReleaseIdentity = z.infer<typeof ReleaseIdentitySchema>;

/** Who published it, and where. */
export const ReleaseOriginRefSchema = z
  .object({
    kind: ReleaseOriginSchema,
    /** The repository or registry, e.g. `<owner>/<ig-repository>`. */
    repository: z.string().min(1),
  })
  .strict();

/** A binary release, as a `folio-binary-release/v1` document. */
export const BinaryReleaseSchema = z
  .object({
    $schema: z.literal(BINARY_RELEASE_SCHEMA_TAG),
    release: ReleaseIdentitySchema,
    origin: ReleaseOriginRefSchema,
    assets: z.array(ReleaseAssetSchema),
  })
  .strict()
  .superRefine((r, ctx) => {
    // One name, one asset. Two records under one name in one release is two
    // answers to "what is `package.tgz`", and a consumer picking either is
    // picking by accident.
    const seen = new Map<string, number>();
    r.assets.forEach((a, i) => {
      const first = seen.get(a.name);
      if (first !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assets", i, "name"],
          message: `\`${a.name}\` already appears at assets[${first}] — one release cannot hold two answers to what a file is`,
        });
      } else {
        seen.set(a.name, i);
      }
    });
  });
export type BinaryRelease = z.infer<typeof BinaryReleaseSchema>;

/** Total published size, over every asset the release records. */
export function releaseBytes(r: BinaryRelease): number {
  return r.assets.reduce((n, a) => n + a.bytes, 0);
}

/**
 * The assets a deploy phase removed, with the reason each gives.
 *
 * The question this kind was registered to make answerable: after the purge,
 * what was there?
 */
export function purgedAssets(r: BinaryRelease): ReleaseAsset[] {
  return r.assets.filter((a) => a.disposition === "deleted-before-deploy");
}

/**
 * Can this release be shown to be what it says it is?
 *
 * **Three states, and the third is the reason this function exists.** A caller
 * writing `assets.every(a => a.disposition === "published")` gets `true` for a
 * release nobody has checked since it was written down.
 *
 * - `unknown` — some asset carries no digest, or some disposition is
 *   `unknown`. Nothing was established; it is not a pass.
 * - `finding` — every asset is established and at least one is gone
 *   (`deleted-before-deploy`, `superseded` or `expired`). A determined result,
 *   not an error: it is what the node exists to record.
 * - `ok` — every asset is digested and still published.
 */
export function binaryReleaseVerdict(r: BinaryRelease): "ok" | "finding" | "unknown" {
  if (r.assets.some((a) => a.digest === undefined || a.disposition === "unknown")) return "unknown";
  if (r.assets.some((a) => a.disposition !== "published")) return "finding";
  return "ok";
}
