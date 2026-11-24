/**
 * A layer's site directory, read from its declaration — the one answer to
 * "where are this instance's pages" (`siteDirFor`), for the callers that used
 * to spell `"docs"` and check whether it existed.
 *
 * `undefined` when the declaration cannot be read OR names a directory that is
 * not on disk: every caller here has a fallback for exactly that case (the
 * base layer's docs, a `_site/` build), and a guessed literal that happened to
 * exist was the defect `check:declared-paths` counts.
 *
 * @module scripts/lib/local-site-dir
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { directoryForGraph, siteDirFor } from "../../schemas/kg/cat-harness.js";

export function localSiteDir(root: string): string | undefined {
  let rel: string;
  try {
    rel = siteDirFor(root);
  } catch {
    return undefined;
  }
  const abs = join(root, rel);
  return existsSync(abs) ? abs : undefined;
}

/**
 * The directory `root`'s declaration names for graph typology `kind`, absolute,
 * when it is declared AND on disk; else `undefined`. The same three outcomes
 * as {@link localSiteDir}, for a graph rather than the site: an unreadable
 * declaration, an undeclared kind and an absent directory all leave the
 * caller's own fallback to answer.
 */
export function declaredDirectory(root: string, kind: string): string | undefined {
  let dir: string | undefined;
  try {
    dir = directoryForGraph(root, kind);
  } catch {
    return undefined;
  }
  return dir !== undefined && existsSync(dir) ? dir : undefined;
}
