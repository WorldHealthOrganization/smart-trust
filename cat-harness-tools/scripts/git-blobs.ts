/**
 * Each path's git blob id at a ref, in one `git ls-tree`: what a rendered
 * file's pin is made of (`pinImpact`). Shared by every renderer's CLI, so
 * they cannot disagree on what "the version of an input" means.
 *
 * @module cat-harness/scripts/git-blobs
 */
import { execFileSync } from "node:child_process";

/** Paths are relative to `root`; a path absent at `head` is absent from the map. */
export function gitBlobs(root: string, head: string, paths: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const text = execFileSync("git", ["-C", root, "ls-tree", "-r", head, "--", ...paths], { encoding: "utf-8" });
  for (const line of text.split("\n")) {
    const m = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);
    if (m) out.set(m[2]!, m[1]!);
  }
  return out;
}
