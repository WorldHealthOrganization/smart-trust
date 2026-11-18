/**
 * Where smart-base and the layers built on it (smart-*, dth-*) live on
 * GitHub, and where their sites are served.
 *
 * The roots are DATA, in the shared publishing profile
 * `smart-base/schemas/publishing.json` (WHO migration plan T3, owner decision
 * Q-WP-1 = A, 2026-11-15; smart-base#421). cat-harness-tools'
 * `iri-base:sync` reads the same file to derive each layer's `iriBase`.
 *
 * Three URL roots (owner, 2026-11-11, card Q-MIG-3 "B"):
 *  - STAGING: the building checkout's own GitHub Pages
 *    (`https://<owner>.github.io`), where sites are built and previewed.
 *  - IRI: fixed to the WHO staging root, so a fork and WHO mint the same
 *    IRIs while a layer is staged.
 *  - PUBLISHED: smart.who.int. When a layer is published, a scripted rewrite
 *    moves its IRIs from the IRI root to this one.
 *
 * The owner is DERIVED, never declared: `CAT_REPO_OWNER` (an explicit
 * override, for dry runs), else `GITHUB_REPOSITORY_OWNER` (CI). Outside CI
 * with neither set, the layers' current home is assumed
 * ({@link DEFAULT_SMART_OWNER}). This module stays free of `node:` imports
 * so a browser bundle can load it; a script that needs the owner of a
 * particular checkout asks cat-harness-tools' `checkoutOwner`, which also
 * reads `origin`.
 *
 * The harness (folio-assistant, folio-assistant-core, cat-harness, …) stays
 * under litlfred; its pages are HARNESS_PAGES_ROOT.
 *
 * @module smart-base/schemas/site-roots
 * @graphNode none — configuration constants (owner and site roots), not a schema
 */
import profile from "./publishing.json" with { type: "json" };

/** The shared publishing profile, as `publishing.json` holds it. */
export const PUBLISHING_PROFILE: { readonly stagingRoot: string; readonly iriRoot: string; readonly publishedRoot: string } = profile;

/** Where the smart-* / dth-* layers live when nothing says otherwise: their home until each one's WHO PR merges. */
export const DEFAULT_SMART_OWNER = "litlfred";

/** `CAT_REPO_OWNER`, else `GITHUB_REPOSITORY_OWNER`, from the environment when there is one. */
function ownerFromEnvironment(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.CAT_REPO_OWNER?.trim() || env?.GITHUB_REPOSITORY_OWNER?.trim() || undefined;
}

/** The GitHub owner of the checkout being built: derived (see the module header). */
export const SMART_OWNER = ownerFromEnvironment() ?? DEFAULT_SMART_OWNER;

/** The staging site root: the owner's GitHub Pages, no trailing slash. */
export const STAGING_ROOT = PUBLISHING_PROFILE.stagingRoot.replaceAll("{owner}", SMART_OWNER.toLowerCase());

/** The fixed root IRIs are minted under while a layer is staged, no trailing slash. */
export const IRI_ROOT = PUBLISHING_PROFILE.iriRoot;

/** The published site root, no trailing slash. IRIs move here when a layer is published. */
export const PUBLISHED_ROOT = PUBLISHING_PROFILE.publishedRoot;

/** The GitHub Pages root of the harness layers, which stay under litlfred. */
export const HARNESS_PAGES_ROOT = "https://litlfred.github.io";

/** `<owner>/<repo>` of a smart-* / dth-* repository, under the derived owner. */
export function smartRepository(repo: string): string {
  return `${SMART_OWNER}/${repo}`;
}

/** A layer's staging site under the building owner, with a trailing slash. */
export function stagingSite(repo: string): string {
  return `${STAGING_ROOT}/${repo}/`;
}

/** A staged layer's IRI base under the fixed IRI root, with a trailing slash: the same for a fork and for WHO. */
export function iriSite(repo: string): string {
  return `${IRI_ROOT}/${repo}/`;
}
