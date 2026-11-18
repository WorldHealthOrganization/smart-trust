/**
 * The NODES of a node kind, found where its typologies say they are.
 *
 * @module cat-harness/schemas/node-kind-nodes
 * @graphNode none — a reader over declared directories; it defines no schema
 *
 * A kind's page lists its own nodes and its subclasses'. The node-kind index
 * says which typologies hold each kind, and each layer's `<instance>.json`
 * says which of its directories have that typology; this joins the two and
 * reads the files.
 *
 * A file belongs to a kind when the kind ACCEPTS its `$schema` — same name,
 * same major, no newer minor (`acceptsSchemaTag`) — so a node written under an
 * earlier minor still appears. JSON nodes carry the tag as `$schema`; Markdown
 * nodes (todos) carry it in their front matter.
 *
 * Each node is filed under the HARNESS that holds it — the layer whose
 * declaration names the directory — with a path relative to that layer's
 * root and without its extension: `<declaring>/<kind>/<harness>/<path>`. A
 * repository-scoped directory sits OUTSIDE its declaring layer's root, so
 * its nodes are addressed relative to the repository.
 *
 * ## What this does NOT read
 *
 * - **A directory whose content is off the checkout** — a `source` other than
 *   `directory`, e.g. beans and todos kept at the tip of a state branch, which
 *   moves without a commit. The state viewer renders those nodes live. A
 *   NESTED entry (`within`) inherits its parent's source.
 * - Nothing else is skipped. A kind with no typology (a layer declaration)
 *   is found by its NAME RULE instead: see `NAME_RULE_KINDS` in `node-kind-index.ts`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { readDeclaration, resolveDirectories, type ResolvedDirectory } from "./cat-harness.js";
import { parse as parseYaml } from "yaml";
import { findDeclarationFile, layerRootsIn } from "./instance-roots.js";
import { kindAndSubclasses, type NameRule, type NodeKindEntry, type NodeKindIndex } from "./node-kind-index.js";
import { acceptsSchemaTag } from "./node-kind.js";
import { contentIsOffCheckout } from "./subgraph-source.js";

export interface KindNode {
  /** The kind the node IS — the kind asked for, or one of its subclasses. */
  kind: string;
  /** The layer that holds it. */
  harness: string;
  /** Relative to that layer's root, extension dropped: the node's address. */
  path: string;
  /** Repo-relative, for a reader who wants the source. */
  file: string;
  /** The parsed node: a JSON object, or a Markdown file's front matter. */
  node: Record<string, unknown>;
}

function* files(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // a declared-but-absent directory is `check:declared-dirs`'s finding
  }
  for (const e of entries.sort()) {
    if (e.startsWith(".") || e === "node_modules") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (e.endsWith(".json") || e.endsWith(".md")) yield p;
  }
}

/** The node a file holds, or undefined when it is not a node at all. */
export function readNode(file: string): Record<string, unknown> | undefined {
  try {
    const text = readFileSync(file, "utf-8");
    if (file.endsWith(".md")) {
      // Real YAML, not the line-based `parseFrontMatter`: a todo's
      // `references` and `artefacts` are lists of objects, which that reader
      // flattens into strings, and a node page would then show data that
      // is not in the file.
      const m = /^---\n([\s\S]*?)\n---/.exec(text);
      const fm = m ? (parseYaml(m[1]!) as unknown) : undefined;
      return fm && typeof fm === "object" && !Array.isArray(fm) && typeof (fm as { $schema?: unknown }).$schema === "string"
        ? (fm as Record<string, unknown>)
        : undefined;
    }
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The directories of `typologies` a layer holds ON THE CHECKOUT: its
 * resolved entries, nested ones included (`todos/todos.json` declares
 * `items/` — the resolver `check:kind-validators` uses, so the two agree),
 * less any whose content is off the checkout, directly or through the entry
 * it is nested `within`.
 */
function checkoutDirectories(root: string, typologies: readonly string[]): ResolvedDirectory[] {
  const all = resolveDirectories([{ name: "(local)", root, own: true }]);
  const offCheckout = (d: ResolvedDirectory, seen = new Set<string>()): boolean => {
    if (contentIsOffCheckout(d)) return true;
    if (d.within === undefined || seen.has(d.within)) return false;
    seen.add(d.within);
    const parent = all.find((p) => p.id === d.within && p.declaredBy === d.declaredBy);
    return parent !== undefined && offCheckout(parent, seen);
  };
  return all.filter((d) => d.graphTypologies.some((t) => typologies.includes(t)) && !offCheckout(d));
}

/** The layer's own declaration, `<instance>.json`, as an absolute path. */
function declarationPath(root: string): string | undefined {
  const name = findDeclarationFile(root); // a file NAME, not a path
  return name === undefined ? undefined : join(root, name);
}

/**
 * A node's address within its harness: relative to the layer root, or to
 * the repository when the file is outside it (a repository-scoped directory),
 * extension dropped.
 */
function nodePath(root: string, repoRoot: string, file: string): string {
  const fromInstance = relative(root, file);
  const rel = fromInstance.startsWith("..") ? relative(repoRoot, file) : fromInstance;
  return rel.replace(/\.(json|md)$/, "").split("\\").join("/");
}

/**
 * Does a file stamped `tag` belong to kind `k`? A versioned kind by
 * `acceptsSchemaTag`; an UNVERSIONED one by the family its validator node
 * names, exactly (`qa-attestations` holds `qa-attestations/v1`, `qa-script`
 * holds `qa-script/v1`). Until 2026-11-13 an unversioned kind found no nodes,
 * so its nodes had no pages (owner, 2026-11-13, node-kind audit: every listed
 * node kind gets per-node pages).
 */
export function kindAccepts(k: Pick<NodeKindEntry, "id" | "version" | "holdings">, tag: unknown): boolean {
  if (k.version !== undefined) return acceptsSchemaTag(k, tag);
  return typeof tag === "string" && k.holdings.some((h) => h.family === tag);
}

/** Whether a kind can have nodes: a versioned one, or an unversioned one that holds a named family ({@link kindAccepts}). */
export function hasNodes(k: Pick<NodeKindEntry, "version" | "holdings"> | undefined): boolean {
  return k !== undefined && (k.version !== undefined || k.holdings.some((h) => h.family !== undefined));
}

/** Every node of `kindId` and its subclasses in the checkout at `repoRoot`, sorted by harness then path. */
export function nodesOfKind(index: Pick<NodeKindIndex, "kinds">, kindId: string, repoRoot: string): KindNode[] {
  const byId = new Map(index.kinds.map((k) => [k.id, k]));
  const kinds = kindAndSubclasses(index, kindId).map((id) => byId.get(id)!).filter(hasNodes);
  const typologies = [...new Set(kinds.flatMap((k) => k.holdings.map((h) => h.typology)))];
  const byRule = kinds.filter((k): k is NodeKindEntry & { foundBy: NameRule } => k.foundBy !== undefined);
  const out = new Map<string, KindNode>();
  const take = (file: string, harness: string, root: string, candidates: readonly NodeKindEntry[]): void => {
    if (out.has(file)) return;
    const node = readNode(file);
    const kind = node && candidates.find((k) => kindAccepts(k, node.$schema));
    if (!node || !kind) return;
    out.set(file, {
      kind: kind.id,
      harness,
      path: nodePath(root, repoRoot, file),
      file: relative(repoRoot, file).split("\\").join("/"),
      node,
    });
  };
  for (const root of layerRootsIn(repoRoot)) {
    const harness = readDeclaration(root)?.name;
    if (!harness) continue;
    if (typologies.length > 0) {
      for (const { absPath } of checkoutDirectories(root, typologies)) {
        for (const file of files(absPath)) take(file, harness, root, kinds);
      }
    }
    // The one name rule: the layer's own declaration, `<instance>.json`.
    const declaration = byRule.some((k) => k.foundBy === "instance-declaration") ? declarationPath(root) : undefined;
    if (declaration !== undefined) take(declaration, harness, root, byRule.filter((k) => k.foundBy === "instance-declaration"));
  }
  return [...out.values()].sort((a, b) => a.harness.localeCompare(b.harness) || a.path.localeCompare(b.path));
}

/**
 * Every directory `nodesOfKind` can read for ANY kind on the index: each
 * layer's directories of a typology that holds a versioned kind. Absolute.
 * What a page generator over the index reads (bean `ehh6`), so a changed file
 * outside all of them cannot change one of its pages.
 */
export function kindDirectories(index: Pick<NodeKindIndex, "kinds">, repoRoot: string): string[] {
  const typologies = [...new Set(index.kinds.filter(hasNodes).flatMap((k) => k.holdings.map((h) => h.typology)))];
  const byRule = index.kinds.some((k) => k.version && k.foundBy === "instance-declaration");
  const out = new Set<string>();
  for (const root of layerRootsIn(repoRoot)) {
    if (!readDeclaration(root)?.name) continue;
    for (const { absPath } of checkoutDirectories(root, typologies)) out.add(absPath);
    // A name-rule node is a FILE at the layer root, not a directory; the
    // file itself is what a changed-path test compares against.
    const declaration = byRule ? declarationPath(root) : undefined;
    if (declaration !== undefined) out.add(declaration);
  }
  return [...out].sort();
}
