/**
 * Where a layer's site and IRIs live, DERIVED from one shared publishing
 * profile and two values the layer declares.
 *
 * @module schemas/kg/publishing-profile
 * @graphNode none — configuration schema and pure functions, no graph node
 *
 * WHO migration, plan step T3 (owner decision Q-WP-1 = A, 2026-11-15;
 * cat-harness-tools#2337). Nothing here knows any particular organisation:
 * the profile is data a higher layer supplies (one file the content layers
 * share), so this layer stays generic.
 *
 * A **profile** (a JSON file in a mounted layer) holds three roots:
 *
 * ```json
 * { "stagingRoot": "https://{owner}.github.io",
 *   "iriRoot": "https://example.github.io",
 *   "publishedRoot": "https://example.org" }
 * ```
 *
 * - `stagingRoot` — where a checkout's own staging site is served; `{owner}`
 *   is the checkout's GitHub owner, derived (`schemas/kg/repo-owner.ts`).
 * - `iriRoot` — the root IRIs are minted under while a layer is staged. It is
 *   FIXED (no `{owner}`), so a fork and the upstream mint the same IRIs.
 * - `publishedRoot` — where a published layer's IRIs and site live.
 *
 * A layer declares only `publish` on its entry in `index.config.json`:
 *
 * ```json
 * { "name": "layer-x", "source": { "local": { "at": "layer-x" } },
 *   "publish": { "id": "x", "stage": "staging", "profile": "<base layer>/schemas/publishing.json" } }
 * ```
 *
 * and its `iriBase` follows: `<iriRoot>/<repository name>/` while staged,
 * `<publishedRoot>/<id>/` once published. The declaration still CARRIES the
 * value, because it travels into every checkout that mounts the layer, where
 * this index is absent; `iri-base:sync` writes it and `iri-base:check` fails
 * when it drifts from what the profile derives.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

const RootSchema = z
  .string()
  .regex(/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/, "an http(s) URL")
  .refine((u) => !u.endsWith("/"), "no trailing slash");

export const PublishingProfileSchema = z
  .object({
    $schema: z.string().optional(),
    _comment: z.string().optional(),
    /** The checkout's own staging site root; `{owner}` is replaced by the checkout's owner. */
    stagingRoot: RootSchema,
    /** The fixed root IRIs are minted under while a layer is staged. */
    iriRoot: RootSchema.refine((u) => !u.includes("{owner}"), "the IRI root is fixed: no {owner}"),
    /** The root a published layer's IRIs and site move to. */
    publishedRoot: RootSchema.refine((u) => !u.includes("{owner}"), "the published root is fixed: no {owner}"),
  })
  .strict();
export type PublishingProfile = z.infer<typeof PublishingProfileSchema>;

export const LayerPublishSchema = z
  .object({
    /** The layer's path under `publishedRoot` (for an IG, the id in its canonical). */
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/, "a path segment or segments, no slashes at either end"),
    /** `staging` until the layer is published; then `published`. */
    stage: z.enum(["staging", "published"]),
    /** The profile file, checkout-relative (usually in a mounted layer). */
    profile: z.string().min(1),
  })
  .strict();
export type LayerPublish = z.infer<typeof LayerPublishSchema>;

/** Read and validate a profile file; throws with the file named. */
export function readPublishingProfile(file: string): PublishingProfile {
  if (!existsSync(file)) throw new Error(`${file}: no publishing profile there`);
  const p = PublishingProfileSchema.safeParse(JSON.parse(readFileSync(file, "utf-8")));
  if (!p.success) throw new Error(`${file}: not a publishing profile: ${p.error.issues[0]?.path.join(".")} ${p.error.issues[0]?.message}`);
  return p.data;
}

/** The profile a `publish` block names, read from the checkout at `root`. */
export function profileFor(root: string, publish: LayerPublish): PublishingProfile {
  return readPublishingProfile(join(root, publish.profile));
}

/** A layer's IRI base, with a trailing slash: `<iriRoot>/<repo>/` while staged, `<publishedRoot>/<id>/` once published. */
export function computeIriBase(profile: PublishingProfile, publish: Pick<LayerPublish, "id" | "stage">, repo: string): string {
  return publish.stage === "published" ? `${profile.publishedRoot}/${publish.id}/` : `${profile.iriRoot}/${repo}/`;
}

/** A checkout's staging site for `repo`, with a trailing slash, under `owner` (GitHub Pages hosts are lower-case). */
export function stagingSiteFor(profile: PublishingProfile, owner: string, repo: string): string {
  return `${profile.stagingRoot.replaceAll("{owner}", owner.toLowerCase())}/${repo}/`;
}
