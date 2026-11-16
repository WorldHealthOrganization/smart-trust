/**
 * THE DIRECTORIES AN UPSTREAM LAYER DECLARES AT A PIN — its own entries and
 * the ones it declares FROM WITHIN them — read from a {@link RemoteTree}
 * without checking the layer out.
 *
 * @module scripts/upstream-directories
 * @graphNode none — a library: it reads declarations at a pin and judges nothing
 *
 * A remote mount (and anything else naming a subgraph of a layer it has
 * not got) needs the id → path map of the layer AT THE PIN. The top-level
 * `directories` of `<name>.json` are only half of it: an entry declared from
 * within (`skills/skills.json` naming `voices/`; `"subgraph": true`) is a
 * layer directory too, so a reader of only the top-level list would refuse
 * a nested id as "not declared".
 *
 * It does not walk the nesting itself. It checks out the declaration files
 * only — `<name>.json` and every file a known kind names as its
 * `declarationFile` — in one sparse checkout, and hands that skeleton to
 * cat-harness's `instanceDirectories`, so the remote answer and the on-disk
 * answer come from one resolver.
 *
 * What it cannot see, it says: a declaration this checkout's schema or kind
 * registry cannot read (a kind contributed by a layer not mounted here yet)
 * is `{ ok: false, detail }`, never an empty list read as "declares nothing
 * from within".
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { defaultGraphTypologies, GraphTypologyRegistry, instanceDirectories, readDeclaration } from "../schemas/kg/cat-harness.js";
import { ownDeclaredDirectories } from "../schemas/kg/declared-nodes.js";
import { GraphTypologyNodeSchema, kindDefOf } from "../schemas/kg/graph-typology-node.js";
import type { RemoteTree } from "./remote-tree.ts";
import { groupsOfDeclaration } from "./concern-groups.ts";

/** One directory as a planner needs it: the id, its instance-relative path, and the fields that say it is not where its path says. */
export interface UpstreamDirectory {
  id: string;
  path: string;
  source?: unknown;
  storage?: unknown;
  /** The id of the directory that declared this one from within; absent for an entry of `<name>.json`. */
  within?: string;
  /** An opt-in sub-graph (`opt-in-subgraphs.ts`): off for a downstream that has not enabled it. */
  optIn?: boolean;
}

export type UpstreamDirectories = { ok: true; directories: UpstreamDirectory[] } | { ok: false; detail: string };

/** Every file name a known kind declares its nested entries in (`skills.json`, `docs.json`, `graph.json`, …). */
export function declarationFileNames(registry: GraphTypologyRegistry = defaultGraphTypologies): string[] {
  const names = new Set<string>();
  for (const k of registry.names()) {
    const f = registry.get(k)?.declarationFile;
    if (f) names.add(f);
  }
  return [...names].sort();
}

/**
 * Check the layer's declaration files out at the pin, WITH the kinds the
 * layer declares itself. A layer may declare a kind of its own in its own
 * `typologies/` graph (a document-kind layer's `l1-extraction`, `web-annex`) and use it
 * in its own `<name>.json`. On disk that graph is read before the
 * declaration; at a pin only the declaration files were checked out, so the
 * kind was "unknown" and every downstream re-pin of the layer was refused
 * (2026-11-14, a folio re-pinning such a layer at main). So the layer's own
 * `typologies/` files are checked out too, and its kinds this checkout does
 * not know are added to a PRIVATE copy of `registry` — never to the shared
 * one, whose kinds must keep pointing at files that still exist once the
 * tree is closed. A kind this checkout already knows keeps this checkout's
 * definition, as the checkout under inspection wins on disk.
 */
function checkoutWithOwnKinds(
  tree: RemoteTree,
  at: string,
  declarationFile: string,
  registry: GraphTypologyRegistry,
): { work: string; registry: GraphTypologyRegistry } {
  const under = at ? `${at}/` : "";
  const declarations = (r: GraphTypologyRegistry) => [declarationFile, ...declarationFileNames(r).map((f) => `${under}**/${f}`)];
  let work = tree.checkout(declarations(registry));
  const dirs = ownDeclaredDirectories(join(work, at), "typologies", work).map((d) => relative(work, d).replace(/\/+$/, ""));
  if (dirs.length === 0) return { work, registry };
  const kindFiles = dirs.map((d) => `${d}/*.json`);
  work = tree.checkout([...declarations(registry), ...kindFiles]);
  const own: [string, ReturnType<typeof kindDefOf>][] = [];
  for (const d of dirs) {
    const dir = join(work, d);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      const parsed = GraphTypologyNodeSchema.safeParse(JSON.parse(readFileSync(join(dir, f), "utf-8")));
      if (!parsed.success) throw new Error(`${d}/${f} is not a folio-graph-typology/v1 node: ${parsed.error.message}`);
      if (!registry.has(parsed.data.kind)) own.push([parsed.data.kind, kindDefOf(parsed.data)]);
    }
  }
  if (own.length === 0) return { work, registry };
  const local = new GraphTypologyRegistry(Object.fromEntries(registry.names().map((n) => [n, registry.get(n)!])));
  for (const [kind, def] of own) local.register(kind, def);
  // A kind of the layer's own may name a declaration file of its own.
  if (declarationFileNames(local).length !== declarationFileNames(registry).length) work = tree.checkout([...declarations(local), ...kindFiles]);
  return { work, registry: local };
}

/**
 * `registry` plus the kinds layer `at` declares in its own `typologies/` at the
 * tree's pin, as a PRIVATE copy ({@link checkoutWithOwnKinds}); `registry`
 * itself when the layer declares none or they cannot be read.
 *
 * A planner folds this over EVERY layer it plans, before it reads any one's
 * nesting, so a kind one layer contributes is known while another layer that
 * uses it is read, whatever order the mounts are listed in. Without it a
 * downstream's standing re-pin refused a layer whose declaration names a kind
 * only a layer it depends on registers, because the using layer comes before
 * the registering one in the lock (2026-11-15, runs 43686466920 and
 * 43688289116, exit 2).
 *
 * Side effect, stated: it sets the tree's sparse checkout, as
 * {@link upstreamDirectories} does.
 */
export function withKindsOf(
  tree: RemoteTree,
  root: string,
  declarationFile: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): GraphTypologyRegistry {
  try {
    return checkoutWithOwnKinds(tree, root.replace(/\/+$/, ""), declarationFile, registry).registry;
  } catch {
    // Unreadable kinds: the layer's own read reports it, with the reason.
    return registry;
  }
}

/**
 * The directories layer `root` (repository-relative, `""` for the root)
 * declares at the tree's pin, `<name>.json`'s own first, then those declared
 * from within, each with an instance-relative `path`.
 *
 * Side effect, stated: it sets the tree's sparse checkout to the declaration
 * files. A later {@link RemoteTree.checkout} replaces that set, so a mount that
 * checks out afterwards gets exactly the paths it asks for.
 */
export function upstreamDirectories(
  tree: RemoteTree,
  root: string,
  declarationFile: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): UpstreamDirectories {
  const at = root.replace(/\/+$/, "");
  let work: string;
  try {
    ({ work, registry } = checkoutWithOwnKinds(tree, at, declarationFile, registry));
  } catch (e) {
    return { ok: false, detail: `could not check the declaration files out at ${tree.sha.slice(0, 12)}: ${(e as Error).message}` };
  }
  try {
    return {
      ok: true,
      // The declaration is read with `registry` too: read with the shared one,
      // a kind only `registry` holds was refused before the nesting was walked.
      directories: instanceDirectories(join(work, at), readDeclaration(join(work, at), registry), registry).map((d) => ({
        id: d.id,
        path: d.path,
        ...(d.source !== undefined ? { source: d.source } : {}),
        ...(d.storage !== undefined ? { storage: d.storage } : {}),
        ...(d.within !== undefined ? { within: d.within } : {}),
        ...((d as { optIn?: unknown }).optIn === true ? { optIn: true } : {}),
      })),
    };
  } catch (e) {
    return { ok: false, detail: `its declaration at ${tree.sha.slice(0, 12)} could not be resolved here: ${(e as Error).message}` };
  }
}

/**
 * A CONCERN NAME at a pin (bean `mo75`): the kind-first members of concern
 * group `code` — `processes/sdlc/`, `skills/sdlc/`, `schemas/sdlc/` … — that
 * layer `root` declares. Each top-level directory whose kind groups by
 * concern is read through its own declaration file (`processes.json`
 * `groups`, `skills.json` `topics`); a group it names `code` is one member,
 * with the id `<directory id>/<code>`. `[]` when no directory names the code.
 * Like {@link upstreamDirectories}, it sets the sparse checkout to the
 * declaration files.
 */
export function upstreamConcernMembers(
  tree: RemoteTree,
  root: string,
  declarationFile: string,
  top: ReadonlyArray<{ id: string; path: string; graphTypologies?: unknown }>,
  code: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): UpstreamDirectories {
  const at = root.replace(/\/+$/, "");
  let work: string;
  try {
    ({ work, registry } = checkoutWithOwnKinds(tree, at, declarationFile, registry));
  } catch (e) {
    return { ok: false, detail: `could not check the declaration files out at ${tree.sha.slice(0, 12)}: ${(e as Error).message}` };
  }
  const out: UpstreamDirectory[] = [];
  for (const d of top) {
    const kinds = Array.isArray(d.graphTypologies) ? d.graphTypologies.filter((k): k is string => typeof k === "string") : [];
    for (const kind of kinds) {
      const def = registry.get(kind);
      if (def?.concernGroups !== true || def.declarationFile === undefined) continue;
      const file = join(work, at, d.path, def.declarationFile);
      if (!existsSync(file)) continue;
      try {
        for (const g of groupsOfDeclaration(JSON.parse(readFileSync(file, "utf-8")), kind, file)) {
          if (g.code !== code) continue;
          const path = `${d.path.replace(/\/+$/, "")}/${g.path.replace(/\/+$/, "")}/`;
          if (!out.some((o) => o.path === path)) out.push({ id: `${d.id}/${code}`, path, within: d.id });
        }
      } catch (e) {
        return { ok: false, detail: `${d.path}${def.declarationFile} at ${tree.sha.slice(0, 12)} could not be read: ${(e as Error).message}` };
      }
    }
  }
  return { ok: true, directories: out };
}
