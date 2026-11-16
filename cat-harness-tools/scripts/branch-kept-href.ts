/**
 * Where a repository-relative file can be READ on the forge.
 *
 * A published page links each bean, todo or milestone to its source file,
 * and some graphs live on their own branch rather than `main` (e.g. `beans/`
 * on `cat/cat-harness/beans`). A link must not name a branch the file is not
 * on, so this asks the declaration — the same `tipLocations` the state mount
 * reads — which branch keeps the directory the file is in, and where the file
 * sits on that branch. A file in no branch-kept directory is on `main`.
 */
import { posix } from "node:path";
import { branchPathOf, tipLocations, type TipLocation } from "./branch-store.js";

export interface BranchKeptLocation {
  /** `https://github.com/<owner>/<repo>`, no trailing slash. */
  web: string;
  /** The branch the file is on. */
  ref: string;
  /** The file's path on {@link ref}. */
  path: string;
}

/** The locations, read once per repository root; a generator asks thousands of times. */
const cache = new Map<string, TipLocation[]>();

function locationsFor(repoRoot: string): TipLocation[] {
  let locs = cache.get(repoRoot);
  if (locs === undefined) {
    try {
      locs = tipLocations(repoRoot, "tip");
    } catch (err) {
      // A declaration this cannot read is reported by `check:declared-dirs`;
      // here it would be one bad link, not a failed build. Said, not swallowed.
      console.warn(`  ! branch-kept-href: could not read branch locations (${(err as Error).message}); links default to main`);
      locs = [];
    }
    cache.set(repoRoot, locs);
  }
  return locs;
}

/**
 * Map a repository-relative `file` to the branch and path it is kept at.
 *
 * The LONGEST matching location wins, so a directory declared inside another
 * resolves to its own branch rather than its parent's.
 */
export function branchKeptLocation(repoRoot: string, file: string, repoWeb: string, locations: readonly TipLocation[] = locationsFor(repoRoot)): BranchKeptLocation {
  const norm = file.replace(/\\/g, "/").replace(/^\.\//, "");
  let best: TipLocation | undefined;
  for (const l of locations) {
    if (norm === l.path || norm.startsWith(`${l.path}/`)) {
      if (!best || l.path.length > best.path.length) best = l;
    }
  }
  if (!best) return { web: repoWeb, ref: "main", path: norm };
  const rest = norm.slice(best.path.length).replace(/^\//, "");
  return {
    web: best.repository ? `https://github.com/${best.repository}` : repoWeb,
    ref: best.branch,
    path: rest ? posix.join(branchPathOf(best), rest) : branchPathOf(best),
  };
}

/** `<web>/<blob|edit>/<ref>/<path>`, each path segment encoded; the ref's `/` kept. */
export function branchKeptHref(loc: BranchKeptLocation, kind: "blob" | "edit" = "blob"): string {
  const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
  return `${loc.web}/${kind}/${enc(loc.ref)}/${enc(loc.path)}`;
}
