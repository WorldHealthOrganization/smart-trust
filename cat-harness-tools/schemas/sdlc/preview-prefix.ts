/**
 * Where a branch's preview is published on the publish branch: `branches/<slug>/`.
 *
 * @module schemas/sdlc/preview-prefix
 * @graphNode none — one path constant and its readers
 *
 * ## The ruling (owner, 2026-11-05)
 *
 * *"switch to BRANCHES in the stubs for preview build … a release build ALSO
 * goes to BRANCHES"*. Previews were published under `STAGING/<slug>/`; they
 * are now published under `branches/<slug>/`, the directory the FHIR IG
 * Publisher's own workflows already use for a branch. On an IG repository the
 * folio's preview and the IG Publisher's branch preview SHARE that folder
 * (owner's choice, same day): the later deploy replaces the earlier.
 *
 * Whether a build is a preview or a release is not in the path. It is the
 * build type (`lib/build-type.ts`) in `staging.json`, which the banner reads:
 * green for `preview`, purple for `full`.
 *
 * ## The old prefix is still READ
 *
 * Previews already published under `STAGING/` are left where they are and age
 * out as their pull requests close (owner, 2026-11-05). So every reader —
 * what a root deploy carries, what a link check skips, what the banner
 * recognises as a preview — accepts both prefixes, and every writer writes
 * {@link PREVIEW_PREFIX} only. Drop {@link LEGACY_PREVIEW_PREFIX} when the
 * publish branch no longer has a `STAGING/`.
 */

/** The directory every new preview is written under. */
export const PREVIEW_PREFIX = "branches";

/** The directory previews were written under until 2026-11-05; read, never written. */
export const LEGACY_PREVIEW_PREFIX = "STAGING";

/** Every preview directory a reader must recognise, the current one first. */
export const PREVIEW_PREFIXES: readonly string[] = [PREVIEW_PREFIX, LEGACY_PREVIEW_PREFIX];

/** A regular-expression alternation of {@link PREVIEW_PREFIXES}, for a reader's pattern. */
export const PREVIEW_PREFIX_ALT = `(?:${PREVIEW_PREFIXES.join("|")})`;

/** `branches/<slug>`: the path of one preview, relative to the publish root. */
export function previewPath(slug: string): string {
  return `${PREVIEW_PREFIX}/${slug}`;
}

/** Whether a path relative to the publish root is inside some preview directory, current or legacy. */
export function isPreviewPath(rel: string): boolean {
  return PREVIEW_PREFIXES.some((p) => rel === p || rel.startsWith(`${p}/`));
}
