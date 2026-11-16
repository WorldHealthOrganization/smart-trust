#!/usr/bin/env bun
/**
 * WHERE TO READ A DECLARED GRAPH FROM — the checkout, or its mount.
 *
 * @module scripts/graph-read
 * @covers cat-harness
 *
 * Readers of `beans/`, `todos/`, `issue-marks/` and the health results ask
 * here: **given a declared directory id, which directory do I actually
 * read.** The same call answers before and after a cutover to a branch, so no
 * reader changes at cutover.
 *
 * ## It REFUSES rather than returning a plausible empty directory
 *
 * The states come from {@link tipPresence} and {@link routePresence}, and each
 * maps onto exactly one read decision:
 *
 * | state | read from | why |
 * |---|---|---|
 * | not branch-keyed, or `commit`-keyed | the checkout | nothing moved |
 * | `route`-keyed, files still tracked | the checkout | pre-cutover: **here** is the store |
 * | `route`-keyed, cut over | **refused** | no route store is mounted, so there is no local path to give |
 * | `not-cut-over` | the checkout | the declaration points at a branch and the files are still tracked here, so **here** is the store |
 * | `mounted` | the marker's `into` | the cutover happened and the mount is the store |
 * | `unmounted` | **refused** | cut over, nothing mounted: the only honest answer is not a path |
 *
 * A reader handed `repoRoot/beans` after the cutover would get an empty
 * directory and an empty `beans list` reading as "there is no work". So
 * {@link graphReadPath} returns a REFUSAL a caller must handle, and
 * {@link mustReadGraph} throws with the remedy for callers that should stop.
 *
 * ## Resolution, and what it does not do
 *
 * The declaration is resolved through `resolveSubgraphSource`, so both the
 * `source: { kind: "branch" }` spelling and the legacy `storage` reach the
 * same answer, and a future source kind lands in the default arm. Presence is
 * read from `git ls-files` and the mount marker, never from the branch, so
 * this is **offline**.
 *
 * It resolves the directory and nothing inside it. `beans/beans.json`'s nested
 * declaration still says where `defs` is *within* the graph, and
 * `resolveBeanDefs` answers that (a nested declaration is invisible to the
 * mount).
 */
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { layerRootsIn, resolveDirectories } from "../schemas/kg/cat-harness.js";
import "../schemas/kg/folio-graph-typology.js";
import { resolveSubgraphSource, type ResolvedSubgraphSource } from "../schemas/kg/subgraph-source.js";
import { absenceAt } from "./branch-store.ts";
import { routePresence, tipPresence } from "./check-declared-dirs.ts";

export type GraphReadFrom = "checkout" | "mount";

export type GraphRead =
  | {
      state: "ok";
      /** The absolute directory to read. */
      at: string;
      from: GraphReadFrom;
      /** The declared directory id. */
      id: string;
      /**
       * The DECLARED repository-relative path (e.g. `beans`), with `/`
       * separators — which is not `relative(repoRoot, at)` once the graph is
       * mounted somewhere else.
       *
       * Carried because a caller holding a path FURTHER IN (`.beans.yml`'s
       * `beans/defs`) can only rebase it onto `at` if it knows which prefix of
       * it the graph accounts for. Deriving that from `at` works in the
       * checkout case and silently breaks for a mount.
       */
      path: string;
      /**
       * Set when the answer is the checkout although the declaration names a
       * branch — the pre-cutover state. Carried rather than hidden so a caller
       * that wants to report which store it read can.
       */
      notCutOver?: true;
    }
  | {
      state: "refused";
      id: string;
      reason: string;
      /**
       * The declared repository-relative path, when it is known.
       *
       * Carried on a REFUSAL because a caller holding a path of its own
       * (`.beans.yml`'s) must be able to ask "is mine even inside this
       * graph?" before inheriting the refusal. Without it, an unreachable
       * `beans` graph refuses a `.beans.yml` pointing somewhere else
       * entirely — which my own tests caught.
       *
       * Absent when the entry could not be resolved at all (a declaration
       * carrying both `source` and `storage`), because then there is no
       * trustworthy path to report.
       */
      path?: string;
      /**
       * Set when a mount DETERMINED the graph absent from this checkout (bean
       * `x5e0`; owner, 2026-10-14: "Report as absent"), as opposed to nobody
       * having mounted it. Still a refusal, so a reader that has not decided
       * what absence means for it keeps stopping; one that has (a gate that
       * is then not applicable) asks this.
       */
      absent?: true;
    }
  | { state: "undeclared"; id: string; reason: string };

/**
 * The declared directory `id` across this checkout's layers, as the
 * presence checks see it.
 *
 * `resolveDirectories` is existence-filtered for `DEFAULT_DIRECTORIES` and for
 * MEMBERS, but **not** for a layer's own declared entries — those are
 * `byId.set` with no `existsSync` guard. That distinction is load-bearing
 * here and is asserted in the tests rather than taken on trust: a cut-over
 * directory has no files in the checkout, so if a declared entry vanished
 * from this lookup it would vanish at exactly the moment it starts to matter.
 */
function declaredEntry(
  id: string,
  repoRoot: string,
): { absPath: string; resolved: ResolvedSubgraphSource } | undefined {
  for (const inst of layerRootsIn(repoRoot)) {
    for (const d of resolveDirectories([{ name: "(local)", root: inst, own: true }])) {
      if (d.id !== id) continue;
      return { absPath: d.absPath, resolved: resolveSubgraphSource(d) };
    }
  }
  return undefined;
}

/**
 * The checkout that holds `root`: the nearest directory at or above it with a
 * `.git`. Mount markers live in THAT checkout's git directory, so a caller
 * that passes a layer root (`test/health/run.ts` passes cat-harness's)
 * must be looked up there: in an index the layer is a mount with no `.git`
 * of its own, and asking it for markers found none, so a mounted `health`
 * read as "not mounted" and the report could not be written. With no `.git`
 * anywhere above, `root` itself, as before.
 */
export function enclosingCheckout(root: string): string {
  let dir = resolve(root);
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const up = dirname(dir);
    if (up === dir) return resolve(root);
    dir = up;
  }
}

/**
 * Which directory to read for the declared graph `id`.
 *
 * Never throws for a declaration it merely dislikes: an unknown id is
 * `undeclared` and an unreachable graph is `refused`, both carrying the
 * reason, so a caller chooses between stopping and reporting. See
 * {@link mustReadGraph} for the caller whose only honest move is to stop.
 */
export function graphReadPath(id: string, repoRoot: string): GraphRead {
  let found;
  try {
    found = declaredEntry(id, repoRoot);
  } catch (err) {
    // `resolveSubgraphSource` throws on a contradiction (both `source` and
    // `storage`; a tip-keyed `qa`). A reader must not pick one and carry on.
    return { state: "refused", id, reason: (err as Error).message };
  }
  if (!found) {
    return { state: "undeclared", id, reason: `no declared directory has id "${id}" in ${repoRoot}` };
  }
  const { absPath, resolved } = found;
  const declaredPath = relative(repoRoot, absPath).split(sep).join("/");
  if (resolved.kind === "branch" && resolved.keyedBy === "route") {
    const r = routePresence({ id, branch: resolved.branch, keyedBy: resolved.keyedBy }, absPath, enclosingCheckout(repoRoot));
    // Same answer as `not-cut-over` below, and for the same reason: the files are
    // still tracked here, so HERE is the store.
    if (r.state === "not-cut-over") return { state: "ok", at: absPath, from: "checkout", id, path: declaredPath, notCutOver: true };
    return {
      state: "refused",
      id,
      path: declaredPath,
      reason:
        `${declaredPath} is kept per ROUTE on \`${resolved.branch}\` and is not tracked in this checkout, ` +
        `and a route store has no mount — \`state:mount\` only walks tip-keyed entries, so there is no local ` +
        `copy for this to resolve to. The branch is read by the route's own generator \`--check\`, which ` +
        `fetches; this resolver is offline. Returning the declared path would hand you an EMPTY directory and ` +
        `a clean run over nothing (bean \`dh4f\`), which is the one answer this module exists to refuse.`,
    };
  }
  if (resolved.kind === "family") {
    // A FAMILY (bean `lehh`) is one branch per key, and nothing here says which
    // key the caller means. The declared path would be an empty directory read
    // as a clean graph (bean `dh4f`) — the else-arm below is exactly that
    // answer, which is why this arm comes first.
    return {
      state: "refused",
      id,
      path: declaredPath,
      reason:
        `"${id}" is a FAMILY of branches (\`${resolved.branchPrefix}<key>\`, one per ${resolved.keyFrom}), ` +
        `not one branch, so there is no single graph at ${declaredPath} to read. Name the member you mean ` +
        `and read that branch.`,
    };
  }
  if (resolved.kind !== "branch" || resolved.keyedBy !== "tip") {
    return { state: "ok", at: absPath, from: "checkout", id, path: declaredPath };
  }
  const t = tipPresence({ id, branch: resolved.branch, keyedBy: resolved.keyedBy }, absPath, enclosingCheckout(repoRoot));
  switch (t.state) {
    case "mounted":
      return { state: "ok", at: t.into, from: "mount", id, path: declaredPath };
    case "not-cut-over":
      // The declaration names the branch and the files are still tracked
      // here, so HERE is the store. `check:declared-dirs` reports the
      // inconsistency; a reader's job meanwhile is to read the real files.
      return { state: "ok", at: absPath, from: "checkout", id, path: declaredPath, notCutOver: true };
    case "unmounted": {
      const absent = absenceAt(repoRoot, declaredPath, id);
      if (absent) {
        return { state: "refused", id, path: declaredPath, absent: true, reason: `"${id}" is absent from this checkout: ${absent.reason}` };
      }
      return {
        state: "refused",
        id,
        path: declaredPath,
        reason:
          `"${id}" is on ${resolved.branch} and is not mounted in ${repoRoot}, so there is no directory to read. ` +
          `Mount it (\`bun run cat state:mount\`). Reading ${relative(repoRoot, absPath).split(sep).join("/")} instead ` +
          `would report an EMPTY graph, and "nothing here" is not "could not reach it" — ${t.detail}`,
      };
    }
  }
}

/**
 * {@link graphReadPath}, or a throw carrying the remedy.
 *
 * For the many readers whose honest behaviour when the graph is unreachable is
 * to stop: a crash with this message is strictly better than a clean run over
 * an empty directory, which is the failure the whole row exists to prevent.
 */
export function mustReadGraph(id: string, repoRoot: string): { at: string; from: GraphReadFrom } {
  const r = graphReadPath(id, repoRoot);
  if (r.state !== "ok") throw new Error(`cannot read graph "${id}": ${r.reason}`);
  return { at: r.at, from: r.from };
}
