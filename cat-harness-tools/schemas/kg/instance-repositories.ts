/**
 * The `owner/repo ↔ instance` map — DERIVED, never kept by hand.
 *
 * Layer references are `owner/repo` everywhere, keyed by each layer's
 * PLANNED repository. Each declaration says what it is (`repository`) and,
 * pre-split, where it sits today (`livesAt`); this module reads those over a
 * checkout and over the folio's dependency overlay and answers the lookups.
 *
 * Every entry keeps `name` alongside `repository` because the name is still
 * what `needs` edges, filenames and `declaredBy` resolve against; the
 * repository is the identity a reference outside the layer uses.
 *
 * @module schemas/instance-repositories
 * @graphNode schema
 */
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { layerRootsIn, readDeclaration, type InstanceLocation } from "./cat-harness.js";
import { declarationChain } from "./harness-config.js";
import { instanceNamespaceOf } from "./namespaces.js";
import { mountScopeFor } from "./remote-mount.js";
import { RepoFullNameSchema, type RepoFullName } from "./repo-full-name.js";

export interface InstanceRepository {
  /** The declaration's machine name — what `needs` resolves against. */
  name: string;
  /** The planned repository, `owner/name` — the identity references use. */
  repository: RepoFullName;
  /** Where it sits today, when not at the root of `repository`. */
  livesAt?: InstanceLocation;
  /** Absolute path of the layer root in this checkout or overlay. */
  root: string;
  /** The vocabulary namespace its terms are minted under — {@link instanceNamespace}. */
  namespace: string;
}

export interface InstanceRepositoryMap {
  entries: InstanceRepository[];
  byRepository: ReadonlyMap<RepoFullName, InstanceRepository>;
  byName: ReadonlyMap<string, InstanceRepository>;
  /** Roots whose declaration names no `repository` — reported, never guessed. */
  undeclared: Array<{ name: string; root: string }>;
}

/**
 * Build the map from every layer under `checkoutRoot` plus, when
 * `folioRoot` is given, every layer its dependency overlay reaches.
 *
 * Throws when two layers claim one repository or one name, since either
 * makes a reference resolve to whichever was read first.
 */
export function instanceRepositories(checkoutRoot: string, folioRoot?: string): InstanceRepositoryMap {
  const roots = new Set<string>(layerRootsIn(checkoutRoot).map((r) => resolve(r)));
  if (folioRoot !== undefined) for (const link of declarationChain(folioRoot)) roots.add(resolve(link.root));

  const entries: InstanceRepository[] = [];
  const undeclared: InstanceRepositoryMap["undeclared"] = [];
  const byRepository = new Map<RepoFullName, InstanceRepository>();
  const byName = new Map<string, InstanceRepository>();
  for (const root of [...roots].sort()) {
    const decl = readDeclaration(root);
    if (decl === undefined) continue;
    if (decl.repository === undefined) {
      undeclared.push({ name: decl.name, root });
      continue;
    }
    const entry: InstanceRepository = {
      name: decl.name,
      repository: decl.repository,
      ...(decl.livesAt !== undefined ? { livesAt: decl.livesAt } : {}),
      root,
      namespace: instanceNamespace(decl),
    };
    const clash = byRepository.get(entry.repository);
    if (clash !== undefined) {
      throw new Error(
        `instance-repositories: ${entry.repository} is declared by both ${clash.root} and ${root}`,
      );
    }
    const nameClash = byName.get(entry.name);
    if (nameClash !== undefined) {
      throw new Error(`instance-repositories: name ${entry.name} is declared by both ${nameClash.root} and ${root}`);
    }
    byRepository.set(entry.repository, entry);
    byName.set(entry.name, entry);
    entries.push(entry);
  }
  return { entries, byRepository, byName, undeclared };
}

/**
 * The namespace a layer's terms are minted under — ONE rule, so the
 * glossary, the vocabulary and the `owner/repo → IRI` map cannot disagree.
 *
 * A layer that declares an `iriBase` mints under its own release,
 * `<iriBase>v<major>/ns/` (`release-iri.ts`). One that declares none mints
 * under the platform's site, `<stem><stub>/ns/`. Owner, 2026-09-30: the map
 * is "dynamic generated based on overlays", which is why it is read from each
 * declaration here rather than listed.
 */
export function instanceNamespace(decl: { name: string; stub?: string; iriBase?: string; version?: string }): string {
  return instanceNamespaceOf(decl);
}

/**
 * The `owner/repo → namespace` map over a checkout and, when given, the
 * folio's dependency overlay.
 */
export function repositoryNamespaces(checkoutRoot: string, folioRoot?: string): Map<RepoFullName, string> {
  return new Map(instanceRepositories(checkoutRoot, folioRoot).entries.map((e) => [e.repository, e.namespace]));
}

/**
 * Resolve a layer reference. `owner/repo` is the form references take;
 * a bare name is accepted while the references are converted (bean `6rmv`
 * phase 2) and will be refused once none remain.
 */
export function resolveInstance(map: InstanceRepositoryMap, ref: string): InstanceRepository | undefined {
  return RepoFullNameSchema.safeParse(ref).success ? map.byRepository.get(ref) : map.byName.get(ref);
}

/**
 * Where `livesAt` says a layer is, checked against where it was found:
 * the directory relative to the host checkout. `undefined` when they agree.
 * A layer with no `livesAt` must sit at the checkout root itself.
 */
export function locationMismatch(entry: InstanceRepository, checkoutRoot: string): string | undefined {
  // A layer that is its OWN repository — a submodule, like bootstrap and
  // bootstrap-tools since 2026-09-30 (bean `xsqm`) — sits at that repository's
  // root, which is exactly what an absent `livesAt` says.
  if (entry.livesAt === undefined && ownWorkTreeRoot(entry.root)) return undefined;
  // ...and so does one a REMOTE MOUNT laid down (the submodule's successor,
  // bean `nn8e`, #2462): no `.git` of its own, but a lock that put it there.
  // WITH a `livesAt` too: a mounted layer's `livesAt` describes where it
  // sits in its OWN repository (an IG layer at a subdirectory of
  // its own repository), while where it sits HERE is the lock's to say.
  // Comparing the two failed every correct post-split declaration, and passed
  // only the stale ones that still named the monorepo (measured 2026-10-09).
  if (mountScopeFor(entry.root) !== undefined) return undefined;
  const actual = relative(resolve(checkoutRoot), entry.root).split("\\").join("/");
  const declared = entry.livesAt?.path ?? "";
  if (actual === declared) return undefined;
  return `${entry.repository} declares livesAt.path ${JSON.stringify(declared)} but sits at ${JSON.stringify(actual)}`;
}

/** Is `dir` the top of its own git work tree (a repository, or a submodule of one)? */
function ownWorkTreeRoot(dir: string): boolean {
  // input-site: tree #1c1a3465 — rev-parse --show-toplevel: a fact about the checkout
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir, encoding: "utf-8" });
  return r.status === 0 && resolve(r.stdout.trim()) === resolve(dir);
}
