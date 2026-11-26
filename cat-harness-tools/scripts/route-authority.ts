#!/usr/bin/env bun
/**
 * WHICH COPY a route-keyed generator's `--check` must compare against — the
 * checkout, the branch, or both — and why "neither" is a verdict rather than a
 * pass.
 *
 * @module scripts/route-authority
 * @graphNode none — a resolver, read by a generator's `--check`
 *
 * A generator's `--check` reads its own output off disk and compares. That is
 * wrong once a declaration says the output lives on a branch, so authority is
 * RESOLVED:
 *
 * | declaration | branch manifest | authority |
 * |---|---|---|
 * | no `storage` | — | `checkout` |
 * | `storage` | `authoritative: false` | `both` |
 * | `storage` | `authoritative: true` | `branch` |
 *
 * `both` covers the cutover window, when the same bytes exist on the branch
 * and on `main`: it compares both copies and reports a disagreement, which
 * nothing else does (`offCheckoutFindings` skips `route`).
 *
 * ## `unknown` is not `stale`, and never `current`
 *
 * A branch that cannot be fetched reports `unknown`. The caller is expected to
 * exit non-zero on `unknown` AND to say it could not determine — a different
 * sentence from "stale".
 *
 * ## Nothing is flipped by adopting this
 *
 * No declaration in this repository sets `storage`, so every caller resolves
 * `checkout`. `route-authority.test.ts` pins that the `checkout` verdict over
 * a given file map equals the direct on-disk comparison, file for file.
 */
import { existsSync, readFileSync } from "node:fs";
import { overlayPath } from "./lib/layer-output.ts";
import { join } from "node:path";

import { BranchStore, resolveTipLocation, type TipLocation } from "./branch-store.ts";

export type Authority = "checkout" | "branch" | "both";

export interface RouteVerdict {
  /** `unknown` is NOT a pass and NOT `stale`; the caller must say which it got. */
  state: "current" | "stale" | "unknown";
  authority: Authority;
  /** Paths whose content differs from the authoritative copy, repo-relative. */
  stale: string[];
  /** Set when `authority` is `both` and the two copies disagree. */
  drift?: string[];
  /** Set on `unknown`: what could not be determined, verbatim from the store. */
  reason?: string;
}

/** Where the declaration says this directory's content lives. */
export function authorityOf(id: string, repoRoot: string): { authority: Authority; loc?: TipLocation; reason?: string } {
  let loc: TipLocation;
  try {
    loc = resolveTipLocation(id, repoRoot, "route");
  } catch {
    // Not route-keyed, or not stored at all: `main` holds it, which is the
    // default for "no declaration" and the state of every directory here today.
    return { authority: "checkout" };
  }
  const store = BranchStore.open(loc.branch, { repoRoot, keyedBy: "route" });
  const m = store.readJson<{ authoritative?: unknown }>("manifest.json");
  if (m.state !== "hit") {
    // A declared branch that cannot be read is NOT "so use the checkout". The
    // declaration says the content is elsewhere; failing to reach elsewhere is
    // a could-not-determine, and resolving it to the checkout would be the
    // vacuous pass.
    return { authority: "branch", loc, reason: `${loc.branch}:manifest.json: ${m.state}: ${m.reason}` };
  }
  return { authority: m.value?.authoritative === true ? "branch" : "both", loc };
}

/**
 * Compare a generator's output against whichever copy is authoritative.
 *
 * @param files the generator's output, repo-relative path → content. The same
 *   map its `--check` would have compared against disk.
 */
export function compareRoute(id: string, files: ReadonlyMap<string, string>, repoRoot: string): RouteVerdict {
  const a = authorityOf(id, repoRoot);
  if (a.reason !== undefined) return { state: "unknown", authority: a.authority, stale: [], reason: a.reason };

  const onDisk = (p: string): string | undefined => {
    // Through the layer output overlay: a mounted layer's computed pages are
    // at its output root (bean `cat-tools-sm8r`, item 4), else the pinned copy.
    const abs = overlayPath(join(repoRoot, p), repoRoot);
    return existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
  };

  if (a.authority === "checkout") {
    const stale = [...files].filter(([p, text]) => onDisk(p) !== text).map(([p]) => p);
    return { state: stale.length ? "stale" : "current", authority: "checkout", stale };
  }

  const loc = a.loc!;
  const store = BranchStore.open(loc.branch, { repoRoot, keyedBy: "route" });
  const at = store.readTreeEntries(loc.path);
  // `miss` is a branch with no content under the route — a real answer for a
  // seeded-but-unpublished route, and still not a pass: the generator's output
  // is not there. `corrupt` and `unknown` are returned as themselves.
  if (at.state === "corrupt" || at.state === "unknown") {
    return { state: "unknown", authority: a.authority, stale: [], reason: `${loc.branch}: ${at.state}: ${at.reason}` };
  }
  const onBranch = at.state === "hit" ? at.files : new Map<string, { blob: string; mode: string; bytes: Buffer }>();
  const branchText = (p: string): string | undefined => onBranch.get(p)?.bytes.toString("utf8");

  const stale = [...files].filter(([p, text]) => branchText(p) !== text).map(([p]) => p);
  if (a.authority === "branch") {
    return { state: stale.length ? "stale" : "current", authority: "branch", stale };
  }

  // `both`: the checkout decides staleness, because it is still authoritative —
  // but the two copies are compared, and a disagreement is reported. Without
  // this the cutover window is a blind spot, which is the whole reason the
  // window is supposed to be short.
  const staleOnDisk = [...files].filter(([p, text]) => onDisk(p) !== text).map(([p]) => p);
  // Drift is computed over the generator's OWN paths, not over the union of the
  // two copies: a path neither copy should hold is an orphan, which each side's
  // own sweep owns (`umlOrphans` here, wholesale replacement on the branch).
  const driftPaths = [...files].filter(([p]) => onDisk(p) !== branchText(p)).map(([p]) => p);
  return {
    state: staleOnDisk.length ? "stale" : "current",
    authority: "both",
    stale: staleOnDisk,
    ...(driftPaths.length ? { drift: driftPaths } : {}),
  };
}
