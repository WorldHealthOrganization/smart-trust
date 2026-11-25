/**
 * Where a document is written when a deploy still names the address it MOVED
 * from.
 *
 * @module scripts/lib/moved-document
 *
 * litlfred/cat-harness-tools#603 decision 1b (owner, 2026-10-23): the host is
 * no longer special. Its documents left the site root for `<site>/<name>/`,
 * like every other layer's. Nothing is published at the old addresses any
 * more: the one-release tombstones that forwarded them are gone, a clean
 * break (owner, 2026-11-02, cat-harness-tools#1378). What stays is
 * {@link placedOut}, so a deploy step written for the old layout still writes
 * the document where its `@id` says it is.
 */

/**
 * The site root `out` implies, when it ends in `path` (site-relative,
 * forward slashes); `undefined` when it does not, because a root that is a
 * guess puts the document where no consumer looks.
 */
export function siteRootOf(out: string, path: string): string | undefined {
  const norm = out.replace(/\\/g, "/");
  if (norm !== path && !norm.endsWith(`/${path}`)) return undefined;
  return out.slice(0, out.length - path.length);
}

/**
 * Where a document is written, given the `--out` a deploy passed.
 *
 * A deploy step written for the OLD layout passes the old path,
 * `<site>/<legacy path>`. Written there as asked, the document would sit at
 * an address its own `@id` does not name, and its subjects would land
 * beside the wrong directory. So an `--out` ending in the old
 * path is read as naming the same site, and the document goes to its
 * published path under it. This keeps a deploy written for either layout
 * correct while the index's workflows and this layer are re-pinned in
 * separate changes (#603 decision 1b). Remove it once no deploy step names
 * an old path.
 */
export function placedOut(out: string, path: string, legacyPath: string | undefined): { out: string; moved: boolean } {
  if (legacyPath === undefined || legacyPath === path || siteRootOf(out, path) !== undefined) return { out, moved: false };
  const root = siteRootOf(out, legacyPath);
  // `siteRootOf` keeps the root's trailing separator, so the two concatenate.
  return root === undefined ? { out, moved: false } : { out: `${root}${path}`, moved: true };
}
