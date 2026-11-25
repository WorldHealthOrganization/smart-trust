/**
 * Which layer owns a glossary scheme: the one rule, shared by the record and the page.
 *
 * A scheme id such as `kg-tools` is every layer's Tool extraction, so the
 * id alone names no one scheme. The owner ruled on bean `q3n9` (2026-10-24,
 * option A) that a scheme is keyed by **(instance, scheme)**, with the
 * layer taken from the scheme's source by this function. There is no
 * `instance` field in the glossary file and no rule from its path: a file
 * that moves keeps its owner, and the index and a standalone checkout agree.
 *
 * It lives here, below both of its readers, so there is one implementation:
 * `check-term-mapping.ts` (this layer) keys the term-mapping record by it, and
 * the content core's `scripts/glossary-page.ts` (a layer above) mints IRIs
 * and places terms by it. The page used to hold the only copy, which the
 * record could not import without reading upward.
 */
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";

import { readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { layerRootsIn } from "../../schemas/kg/instance-roots.ts";
import { mountedInstancesCached } from "./layer-output.ts";

/** A layer's root and its declared name. */
export interface InstanceRoot {
  root: string;
  name: string;
}

/** The part of a glossary scheme the owner rule reads. */
export interface OwnedScheme {
  source?: string;
  terms: readonly { id: string; source?: string }[];
}

/** A `source` that names a file in the repository, without its fragment; `undefined` for a URL or a missing file. */
export function repoPathOf(src: string | undefined, repo: string): string | undefined {
  if (!src || /^[a-z][a-z0-9+.-]*:\/\//i.test(src)) return undefined;
  const path = src.split("#", 2)[0]!;
  return path && existsSync(resolve(repo, path)) ? path : undefined;
}

/** Every layer root with its name, longest first, so a path resolves to the MOST specific layer holding it. */
export function instanceRoots(repo: string): InstanceRoot[] {
  const out: InstanceRoot[] = [];
  for (const root of layerRootsIn(repo)) {
    const decl = readDeclaration(root);
    if (decl) out.push({ root: resolve(root), name: decl.name });
  }
  return out.sort((a, b) => b.root.length - a.root.length);
}

/** The layer whose root holds a repository path. `owners` must be longest root first. */
export function ownerOfPath(repo: string, path: string, owners: readonly InstanceRoot[] = instanceRoots(repo)): string | undefined {
  const p = resolve(repo, path);
  return owners.find((o) => p === o.root || p.startsWith(`${o.root}/`) || p.startsWith(`${o.root}\\`))?.name;
}

/**
 * The root of every repository in the checkout at `repo`: the checkout itself
 * and each layer its `index.lock.json` mounts, longest first, so a path
 * resolves to the most specific repository holding it. A mount is another
 * repository's bytes laid down at its pin; the checkout's own layers, a
 * folio's sub-layers included, are one repository.
 */
export function repositoryRoots(repo: string): string[] {
  const root = resolve(repo);
  const mounts = [...mountedInstancesCached(root).values()].map((p) => resolve(root, p)).filter((d) => d !== root);
  return [...new Set([root, ...mounts])].sort((a, b) => b.length - a.length);
}

/** Every layer `name` needs, directly or through the layers it needs, read from each declaration. */
function neededBy(name: string, owners: readonly InstanceRoot[]): Set<string> {
  const seen = new Set<string>();
  const queue = [name];
  while (queue.length) {
    const next = queue.shift()!;
    const root = owners.find((o) => o.name === next)?.root;
    const needs = root === undefined ? [] : ((readDeclaration(root) as { needs?: unknown } | undefined)?.needs ?? []);
    for (const n of Array.isArray(needs) ? needs : []) {
      if (typeof n === "string" && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

/** The repository whose root holds `path`; `repositories` must be longest first. */
function repositoryOf(path: string, repositories: readonly string[]): string | undefined {
  const p = resolve(path);
  return repositories.find((r) => p === r || p.startsWith(`${r}${sep}`) || p.startsWith(`${r}/`));
}

/**
 * The layer that owns a scheme.
 *
 * 1. The scheme's own `source`, when it is a repository path: the layer
 *    that DEFINES the scheme. A code list extended by several packages is the
 *    defining layer's, and each term's `source` still names the package
 *    that contributed it.
 *    A relative path the repository does not hold (a mount that does not
 *    carry it: dth-pc mounts only dth-sc's `glossary/`, so dth-sc's
 *    `folio/dth-sc` is absent there) still names a path in the declaring
 *    layer, so the scheme is `declaredBy`'s. Only a URL `source` says
 *    nothing about the owner.
 * 2. Otherwise the one layer whose root holds every term's `source`.
 * 3. No repository source at all: `declaredBy`, the layer whose directory
 *    holds the file.
 *
 * Terms sourced in several layers with no defining `source` have no one
 * owner, and that is an error rather than a guess: split the scheme per
 * layer, or name the layer that defines it.
 *
 * A source in a layer mounted from ANOTHER REPOSITORY that the declaring
 * layer does not `need` (directly or through the layers it needs) is a
 * citation, and the scheme stays the declaring layer's (2026-11-23). That
 * layer's site is built from its own repository, which never holds this
 * file, so an IRI minted in its namespace would be served by no site: a
 * folio's scheme citing the library layer it mounts for its documents was
 * 17 404s. A layer the declarer needs is the stack it extends, and its
 * vocabulary stays its own, as the layers below name it. Within one
 * repository a sub-layer still owns what it holds (owner, 2026-09-24).
 * `repositories` is {@link repositoryRoots}; a declaring layer `owners` does
 * not name is not checked.
 */
export function schemeOwner(
  repo: string,
  g: OwnedScheme,
  declaredBy: string,
  owners: readonly InstanceRoot[] = instanceRoots(repo),
  repositories: readonly string[] = repositoryRoots(repo),
): { owner: string } | { error: string } {
  const home = owners.find((o) => o.name === declaredBy)?.root;
  const homeRepository = home === undefined ? undefined : repositoryOf(home, repositories);
  /** The layer credited with a source `o` holds: `o`, unless it is another repository's. */
  const credit = (o: string): string => {
    if (homeRepository === undefined) return o;
    const root = owners.find((x) => x.name === o)?.root;
    if (root === undefined || repositoryOf(root, repositories) === homeRepository) return o;
    return neededBy(declaredBy, owners).has(o) ? o : declaredBy;
  };
  const defining = repoPathOf(g.source, repo);
  if (defining) {
    const o = ownerOfPath(repo, defining, owners);
    return o ? { owner: credit(o) } : { error: `its source ${defining} is in no instance` };
  }
  if (g.source && !/^[a-z][a-z0-9+.-]*:\/\//i.test(g.source) && !/\s/.test(g.source)) return { owner: declaredBy };
  const held = new Set<string>();
  for (const t of g.terms) {
    const path = repoPathOf(t.source, repo);
    if (!path) continue;
    const o = ownerOfPath(repo, path, owners);
    if (!o) return { error: `term "${t.id}" has source ${path}, which is in no instance` };
    held.add(credit(o));
  }
  if (held.size > 1) {
    return {
      error: `its terms are sourced in ${held.size} instances (${[...held].sort().join(", ")}) and the scheme names no defining source; split it per instance, or set the scheme's source to the instance that defines it`,
    };
  }
  return { owner: [...held][0] ?? declaredBy };
}
