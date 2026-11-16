/**
 * The KG sub-graphs DECLARED INSIDE one library entry, and where they are
 * published — bean 8pzh item 1.
 *
 * Owner, 2026-10-12, on where L1 extraction output lives: *"a and b"* — keep it
 * committed beside the library entry (`<entry>/l1-extraction/`) AND publish it
 * with the source — and: *"why does b not happen already? if its a part of the
 * KG it should be published."*
 *
 * It did not happen because the output was not part of the declared KG. An
 * entry's own nodes are its manifest, sections and blocks (the `library`
 * typology); a directory of other files inside it was in the repository and
 * named by no typology, so nothing published it. The fix is a declaration, not
 * a list of filenames here: a layer declares the directory inside the
 * entry, with a typology that is `within: "library"` (a content layer's
 * `l1-extraction`, say), and this module finds every such declaration. So the rule
 * the publisher follows is the owner's own — declared KG content is published —
 * and this layer never names a kind a higher layer owns.
 *
 * ## Where a file lands
 *
 * Beside the entry's manifest, at its path relative to the entry:
 * `<entry>/l1-extraction/recommendations.l1.json` is published at
 * `assets/library/jsonld/<instance>/source/<entry>/l1-extraction/recommendations.l1.json`.
 * That is the layout `schemas/library/library-iri.ts` reserved for exactly this — *"the
 * entry's other nodes have an obvious place to be published under the same
 * directory later"* — and it keeps the source layout, so a relative reference
 * between two files of the sub-graph still resolves on the site.
 *
 * The bytes are copied as they are. A graph document carries its own `@id`
 * (an L1 IRI, not a site path), so nothing here rewrites it; and the
 * committed file stays the single source, validated where it is written by
 * the layer that owns its vocabulary.
 *
 * @module scripts/lib/library-entry-graphs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { findInstanceRoot, instanceDirectories, readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { defaultGraphTypologies, type GraphTypologyRegistry } from "../../schemas/kg/graph-typology-registry.ts";
import { findDeclarationFile } from "../../schemas/kg/instance-roots.ts";
import { libraryEntrySitePath } from "../../schemas/library/library-iri.ts";
import { presentGroupsIn } from "../concern-groups.ts";

/** One file of a sub-graph declared inside a library entry. */
export interface EntryGraphFile {
  /** The typology of the declaring directory (e.g. `l1-extraction`). */
  kind: string;
  /** The source on disk. */
  abs: string;
  /** Its path relative to the entry directory, `/`-separated — also its path under the entry's published directory. */
  rel: string;
  /** A JSON-LD document — parses as JSON and carries `@context` — and so a graph a reader is linked to. */
  jsonld: boolean;
}

/** The nearest directory at or above `dir` that holds a layer declaration, or `undefined`. */
function declaringInstanceRoot(dir: string): string | undefined {
  for (let d = resolve(dir); ; d = dirname(d)) {
    if (findDeclarationFile(d) !== undefined) return d;
    if (dirname(d) === d) return undefined;
  }
}

type DeclaredDirectories = ReturnType<typeof instanceDirectories>;

/**
 * One layer's declared directories, read once per declaration text.
 *
 * `check:l1-complete` asks {@link entrySubgraphDirs} once per library entry,
 * and every entry of a library has the same declaring layer. Re-reading and
 * re-resolving that declaration for each one made `checkAll` over the corpus
 * slow enough to time a test out (`ingest-and-l1`, 5.8 s against bun's 5 s).
 * The key is the declaration's TEXT as well as its root, and the registry's
 * size (kinds are registered at runtime), the same key `readDeclaration` uses:
 * an edited declaration, such as a test fixture rewritten in place, is read
 * again rather than answered from a stale copy. `undefined` is an unreadable declaration, cached
 * the same way: it is `check:harness-dirs`'s finding, not this one's.
 */
const declaredDirectoriesCache = new Map<string, { text: string; registry: GraphTypologyRegistry; kinds: number; dirs: DeclaredDirectories | undefined }>();

function declaredDirectoriesOf(instRoot: string, registry: GraphTypologyRegistry): DeclaredDirectories | undefined {
  let text = "";
  try {
    const file = findDeclarationFile(instRoot);
    text = file === undefined ? "" : readFileSync(join(instRoot, file), "utf-8");
  } catch {
    text = "";
  }
  const hit = declaredDirectoriesCache.get(instRoot);
  if (hit !== undefined && hit.text === text && hit.registry === registry && hit.kinds === registry.names().length) return hit.dirs;
  let dirs: DeclaredDirectories | undefined;
  try {
    dirs = instanceDirectories(instRoot, readDeclaration(instRoot, registry), registry);
  } catch {
    dirs = undefined;
  }
  declaredDirectoriesCache.set(instRoot, { text, registry, kinds: registry.names().length, dirs });
  return dirs;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else out.push(p);
  }
  return out;
}

function isJsonLd(abs: string): boolean {
  if (!/\.(json|jsonld)$/.test(abs)) return false;
  try {
    const v = JSON.parse(readFileSync(abs, "utf-8")) as unknown;
    return typeof v === "object" && v !== null && !Array.isArray(v) && "@context" in v;
  } catch {
    return false;
  }
}

/** One directory DECLARED inside a library entry with a kind that is a sub-graph of `library`. */
export interface EntrySubgraphDir {
  /** The typology that makes it a library sub-graph (e.g. `l1-extraction`). */
  kind: string;
  /** The directory on disk. */
  abs: string;
  /** Whether that kind is published (`published !== false`). */
  published: boolean;
}

/**
 * Every directory DECLARED inside `entryDir` whose typology is a sub-graph of
 * `library` (`within: "library"`) and exists on disk — published or not. The
 * one declaration lookup {@link entryGraphFiles} publishes from and
 * `check:l1-complete` accepts as entry contents, so the two cannot disagree.
 * Empty when the entry holds none, or its layer cannot be read — an
 * unreadable declaration is `check:harness-dirs`'s finding, not this one's.
 */
export function entrySubgraphDirs(entryDir: string, registry: GraphTypologyRegistry = defaultGraphTypologies): EntrySubgraphDir[] {
  const entry = resolve(entryDir);
  const instRoot = declaringInstanceRoot(dirname(entry));
  if (instRoot === undefined) return [];
  const dirs = declaredDirectoriesOf(instRoot, registry);
  if (dirs === undefined) return [];
  const out: EntrySubgraphDir[] = [];
  for (const d of dirs) {
    if (d.scope === "repository") continue;
    const abs = resolve(instRoot, d.path);
    if (!abs.startsWith(entry + sep) || !existsSync(abs) || !statSync(abs).isDirectory()) continue;
    const kinds = (d.graphTypologies ?? []).filter((k) => registry.get(k)?.within === "library");
    if (kinds.length === 0) continue;
    const pub = kinds.find((k) => registry.get(k)?.published !== false);
    out.push({ kind: pub ?? kinds[0], abs, published: pub !== undefined });
  }
  return out;
}

/**
 * Every file of every directory DECLARED inside `entryDir` whose typology is a
 * sub-graph of `library` (`within: "library"`) and is published. Sorted by
 * `rel`. Empty when the entry holds none, or its layer cannot be read.
 */
export function entryGraphFiles(entryDir: string, registry: GraphTypologyRegistry = defaultGraphTypologies): EntryGraphFile[] {
  const entry = resolve(entryDir);
  const byRel = new Map<string, EntryGraphFile>();
  for (const d of entrySubgraphDirs(entry, registry)) {
    if (!d.published) continue;
    for (const f of filesUnder(d.abs)) {
      const rel = relative(entry, f).split(sep).join("/");
      if (!byRel.has(rel)) byRel.set(rel, { kind: d.kind, abs: f, rel, jsonld: isJsonLd(f) });
    }
  }
  return [...byRel.values()].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

/** Where `rel` (from {@link entryGraphFiles}) is published, SITE-relative: under the entry's IRI. */
export function entryGraphSitePath(instance: string, docId: string, rel: string): string {
  const base = libraryEntrySitePath(instance, docId);
  return `${base}/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * The directories directly inside the library `lib` that its layer
 * declares with kinds that do not include `library` — absolute, without a
 * trailing separator. They are other graphs kept in the library, not entries:
 * a DAK IG keeps its L1 scenario worked example at
 * `library/l1-recommendation-scenarios/` as `l1-extraction`, and a reader that
 * walked it as an entry graded it for a manifest and sections it never had.
 */
export function nonEntryDirs(lib: string, registry: GraphTypologyRegistry = defaultGraphTypologies): Set<string> {
  const out = new Set<string>();
  const inst = findInstanceRoot(lib);
  if (inst === undefined) return out;
  // The RESOLVED directories, not the declaration file alone: a library names
  // a directory of another kind FROM WITHIN (`library/library.json`'s
  // `directories`, the #980 shape `check:layout-norms` sanctions), and a
  // reader of the root file alone graded that directory as an entry missing
  // its manifest, sections and blocks (cat-harness-tools#281). The raw
  // declaration stays the fallback for a declaration the resolver refuses.
  const resolved = declaredDirectoriesOf(inst, registry);
  const entries: { path: string; graphTypologies?: readonly string[]; scope?: string }[] =
    resolved ?? readDeclaration(inst)?.directories ?? [];
  for (const e of entries) {
    if (e.scope === "repository") continue;
    const abs = join(inst, e.path).replace(/[/\\]+$/, "");
    if (resolve(abs, "..") === resolve(lib) && !(e.graphTypologies ?? []).includes("library")) out.add(abs);
  }
  return out;
}

/** One library entry directory, flat or filed in a concern group. */
export interface LibraryEntryDir {
  /** The entry's slug: its directory name, and the `docId` every id is minted from. */
  slug: string;
  /** The entry directory, absolute when `lib` is. */
  dir: string;
  /** Its path relative to the library, `/`-separated: `<slug>` or `<group>/<slug>`. */
  rel: string;
  /** The concern-group code it is filed in, when it is filed. */
  group?: string;
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    // Vanished between readdir and stat: not an entry this walk can read.
    return false;
  }
}

/**
 * Every entry directory of the library `lib`, FLAT OR GROUPED — bean `6fez`,
 * placement ruling 3 (2026-09-30, option A): sources are filed at
 * `library/<group>/<slug>/`, and a new upload lands UNFILED at
 * `library/<slug>/`. So both layouts are permanent, side by side, and a walker
 * that reads `library/*` one level deep would take a group for an entry and
 * miss everything filed in it.
 *
 * A group is told from an entry by the library's own declaration
 * (`library/library.json`, `concern-groups/v1`) or by inheritance from the
 * same-named library below — {@link presentGroupsIn}, the answer
 * `groupedChildrenIn` gives every other grouping kind. Nothing is guessed from
 * a directory's name or contents.
 *
 * Sorted by slug, with the plain code-unit order `readdirSync().sort()` gives,
 * so a flat library lists exactly as every walker listed it before. Every
 * subdirectory is returned; another kind's directory kept in the library is
 * the caller's to drop, with {@link nonEntryDirs}, as before. Empty when `lib`
 * is not a directory.
 */
export function libraryEntryDirs(lib: string, registry: GraphTypologyRegistry = defaultGraphTypologies): LibraryEntryDir[] {
  if (!isDirectory(lib)) return [];
  const groups = presentGroupsIn(lib, "library", registry);
  const out: LibraryEntryDir[] = [];
  for (const name of readdirSync(lib)) {
    const dir = join(lib, name);
    if (!isDirectory(dir)) continue;
    const code = groups.get(name);
    if (code === undefined) {
      out.push({ slug: name, dir, rel: name });
      continue;
    }
    for (const inner of readdirSync(dir)) {
      const d = join(dir, inner);
      if (isDirectory(d)) out.push({ slug: inner, dir: d, rel: `${name}/${inner}`, group: code });
    }
  }
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return out.sort((a, b) => cmp(a.slug, b.slug) || cmp(a.rel, b.rel));
}

/**
 * Where the entry `slug` sits in the library `lib` — `library/<slug>/` or
 * `library/<group>/<slug>/` — or `undefined`. The resolver for every
 * slug-keyed reference (`library/<bib-slug>` evidence, `heldEntries`, an
 * image-verdicts docId): the slug is the identity, the group is only where it
 * is filed (bean `6fez`).
 */
export function libraryEntryDir(lib: string, slug: string, registry: GraphTypologyRegistry = defaultGraphTypologies): string | undefined {
  if (slug === "" || slug.includes("/") || slug.includes("\\")) return undefined;
  const groups = presentGroupsIn(lib, "library", registry);
  const flat = join(lib, slug);
  if (!groups.has(slug) && isDirectory(flat)) return flat;
  for (const g of [...groups.keys()].sort()) {
    const d = join(lib, g, slug);
    if (isDirectory(d)) return d;
  }
  return undefined;
}

/**
 * The library an entry directory belongs to: its parent, or — when the entry
 * is filed in a concern group — its grandparent (bean `6fez`). For a caller
 * that holds an entry and needs the whole library it is a member of, such as
 * a corpus-wide index whose weights must not shrink to one group.
 */
export function libraryOfEntry(entryDir: string, registry: GraphTypologyRegistry = defaultGraphTypologies): string {
  const parent = dirname(resolve(entryDir));
  const grand = dirname(parent);
  return presentGroupsIn(grand, "library", registry).has(basename(parent)) ? grand : parent;
}
