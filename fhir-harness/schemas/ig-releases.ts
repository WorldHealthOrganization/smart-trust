/**
 * ig-releases.ts — an IG's GitHub releases, recorded as POINTERS to their
 * binary assets (bean `b8ip`).
 *
 * Owner, 2026-10-02: *"previews dont get binary, only releaes. KG should point
 * to release binaries so people can materialze if they want. also so can list
 * on ig justthedocs pages somewhere"*.
 *
 * So this file holds no bytes. Each asset is a name, a size, the digest GitHub
 * computed on upload, and the URL to fetch it from. Whoever wants the bytes
 * fetches them and can check them against the digest. The IG's just-the-docs
 * site lists them on a generated `releases` page (`build-ig-site.ts`).
 *
 * WHO-free: a release is any IG repository's, and the asset names are
 * whatever that release carries. `ig-binary-artefacts` says which the
 * Publisher writes.
 *
 * @graphNode schema
 */
import { z } from "zod";

export const IG_RELEASES_TAG = "ig-releases/v1" as const;

export const ReleaseAssetSchema = z
  .object({
    name: z.string().min(1),
    /** Where to fetch the bytes: GitHub's `browser_download_url`. */
    url: z.string().url(),
    bytes: z.number().int().nonnegative(),
    /** `sha256:<hex>` as GitHub reports it; absent on assets uploaded before GitHub computed digests. */
    digest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
    contentType: z.string().min(1).optional(),
  })
  .strict();
export type ReleaseAsset = z.infer<typeof ReleaseAssetSchema>;

export const IgReleaseSchema = z
  .object({
    tag: z.string().min(1),
    name: z.string().optional(),
    /** The release's page on GitHub. */
    url: z.string().url(),
    publishedAt: z.string().min(1),
    prerelease: z.boolean(),
    /** The commit the tag points at, where GitHub reports it. */
    commitish: z.string().optional(),
    assets: z.array(ReleaseAssetSchema),
    /**
     * The IG AST cache commit compiled from this release's tag, where one was
     * seeded (fhir-harness#329): a page reads the release's resources by raw
     * URL at it. Absent for a release cut before the cache kept its commits
     * (#326); its AST is in its `ast-data.zip`.
     */
    ast: z.object({ commit: z.string().regex(/^[0-9a-f]{40}$/) }).strict().optional(),
  })
  .strict();
export type IgRelease = z.infer<typeof IgReleaseSchema>;

export const IgReleasesSchema = z
  .object({
    $schema: z.literal(IG_RELEASES_TAG),
    /** `owner/repo` the releases were read from. */
    repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    /** When they were read (UTC date). A release made later is not here until the next read. */
    readAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Newest first, as GitHub lists them. Drafts are never recorded: they are not published. */
    releases: z.array(IgReleaseSchema),
  })
  .strict();
export type IgReleases = z.infer<typeof IgReleasesSchema>;

/** The fields of a GitHub REST `release` object this module reads. */
export interface GitHubRelease {
  tag_name: string;
  name?: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  target_commitish?: string;
  assets: Array<{ name: string; browser_download_url: string; size: number; digest?: string | null; content_type?: string }>;
}

/** GitHub's release list, as pointers. Drafts and unpublished releases are left out. */
export function releasesFromGitHub(repository: string, readAt: string, list: GitHubRelease[]): IgReleases {
  return IgReleasesSchema.parse({
    $schema: IG_RELEASES_TAG,
    repository,
    readAt,
    releases: list
      .filter((r) => !r.draft && r.published_at)
      .map((r) => ({
        tag: r.tag_name,
        ...(r.name ? { name: r.name } : {}),
        url: r.html_url,
        publishedAt: r.published_at!,
        prerelease: r.prerelease,
        ...(r.target_commitish ? { commitish: r.target_commitish } : {}),
        assets: r.assets.map((a) => ({
          name: a.name,
          url: a.browser_download_url,
          bytes: a.size,
          ...(a.digest ? { digest: a.digest } : {}),
          ...(a.content_type ? { contentType: a.content_type } : {}),
        })),
      })),
  });
}

/**
 * The releases as they stood at `asOf` (those published at or before it),
 * stamped with its date. `ig-index:build` passes the pinned commit's time, so
 * the record moves with the pin and not with the clock (bean fwtz).
 */
export function releasesAsOf(repository: string, asOf: string, list: GitHubRelease[]): IgReleases {
  const cut = Date.parse(asOf);
  if (Number.isNaN(cut)) throw new Error(`releasesAsOf: ${asOf} is not a date`);
  return releasesFromGitHub(repository, new Date(cut).toISOString().slice(0, 10), list.filter((r) => r.published_at && Date.parse(r.published_at) <= cut));
}
