/**
 * Hash of a chapter's `uses[]` edge set — the invalidation signal for
 * graph-scoped QA criteria.
 *
 * The detangler axis answers questions about the GRAPH: forward references,
 * dependency cycles, cone depth, graph energy. Editing block A's `uses[]`
 * therefore changes block B's verdict while B's own `.md` / `.ts` / `.lean` are
 * untouched. Keyed only on its own files, B stays `fresh-skip` and keeps a
 * verdict that is now wrong — observed live in qou, where breaking three
 * dependency cycles left 15 blocks still recording
 * `detangler-no-dependency-cycle: fail` for cycles that no longer existed.
 *
 * Criteria opt in via `also_invalidated_by: ["graph"]`; only their entries
 * carry and compare the resulting `field_hash.graph`.
 *
 * Its own module rather than part of `qa-sweep` so it is importable without
 * executing that CLI, and rather than part of `qa-utils` because
 * `content-graph` already imports `walkBlocks` from there — this would close an
 * import cycle.
 *
 * @module pipeline/uses-graph-hash
 */

import { readFileSync } from "fs";
import { relative } from "path";
import { createHash } from "crypto";
import { walkBlocks } from "./qa-utils";
import { parseUses } from "./content-graph";

/**
 * 12-char hash of the `uses[]` edge set beneath `root`.
 *
 * Defined here rather than in `qa-utils` because `content-graph` already
 * imports `walkBlocks` from there; putting it in `qa-utils` would close an
 * import cycle. `qa-sweep` is a leaf consumer of both.
 *
 * Hashes the EDGES, not the manifests: an edit to a `.ts` that leaves `uses[]`
 * alone must not invalidate the detangler axis, or this would reintroduce the
 * churn that per-criterion `script_hash` was added to remove. Sorted so the
 * hash is independent of walk order.
 */
export function usesGraphHash(root: string): string {
  const edges: string[] = [];
  for (const block of walkBlocks(root)) {
    let src = "";
    try {
      src = readFileSync(block.ts, "utf-8");
    } catch {
      continue;
    }
    const uses = parseUses(src);
    // Label the edge by a path RELATIVE to the sweep root, never the absolute
    // one: an absolute path bakes the checkout location into the hash, so the
    // same corpus would hash differently on another machine or in a worktree
    // and invalidate the whole axis for no reason. Same rule `deps_hash`
    // already follows.
    if (uses.length) {
      edges.push(`${relative(root, block.root)} ${[...uses].sort().join(",")}`);
    }
  }
  edges.sort();
  return createHash("sha256").update(edges.join("\n")).digest("hex").slice(0, 12);
}
