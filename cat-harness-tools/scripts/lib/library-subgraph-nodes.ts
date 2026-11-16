/**
 * Library entries as subgraph members (cat-harness#180).
 *
 * Owner, 2026-10-11 (litlfred/qou): *"the library should be a declared graph
 * with all its dirs as subgraphs as declared"*. Owner, 2026-10-29 (card,
 * option A): each `library/<doc>/` hangs under its layer's `library`
 * subgraph, by the same containment rule as `skills/sdlc/` under `skills/`.
 *
 * kg-export does not read library entries, so the subgraph framing gets
 * their nodes here: one POINTER node per JSON-LD file an entry commits
 * (`manifest.jsonld`, `sections/*.jsonld`, `blocks/*.jsonld`, and any other
 * `*.jsonld` under the entry). A pointer is the node's `@id`, `@type`, `title`
 * and `path`. The `path` is the file, which places the node by containment.
 * Section text and every other body stay behind the node's own IRI (`f233`),
 * never copied into the subgraph files.
 *
 * `@id` and `@type` are read through each file's own `@context`, expanded
 * with a loader that never fetches. One expansion per distinct context and
 * type list keeps the cost to a few hundred expansions for thousands of files.
 *
 * @module scripts/lib/library-subgraph-nodes
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import jsonld from "jsonld";

import { instanceDirectoriesForGraph } from "../../schemas/kg/cat-harness.js";
import { instanceContextUrl } from "../../schemas/kg/jsonld.js";
import { generateInstanceContexts, readInstanceDecls } from "../gen-instance-contexts.ts";
import { localLoader } from "../publish-verify.ts";
import { libraryEntryDirs, nonEntryDirs } from "./library-entry-graphs.ts";

type Node = Record<string, unknown>;
export type Loader = (url: string) => Promise<{ contextUrl: null; documentUrl: string; document: unknown }>;

/**
 * A loader for entry documents that never fetches. An entry names its
 * layer's own context (`<iriBase>ns/context/v1.jsonld`), which is built at
 * publish and so is usually not on disk: it is generated here in memory, by
 * the same function that writes it (`gen-instance-contexts.ts`). Anything else
 * goes to `publish-verify`'s local loader.
 */
export function libraryContextLoader(repoRoot: string): Loader {
  // declared-path-literal: the built site tree publish-verify's loader maps
  // URLs onto — only reached for a URL the in-memory contexts did not answer.
  const fallback = localLoader(join(repoRoot, "docs"));
  let byUrl: Map<string, unknown> | undefined;
  return async (url: string) => {
    if (byUrl === undefined) {
      byUrl = new Map();
      const decls = readInstanceDecls(repoRoot);
      for (const r of generateInstanceContexts(repoRoot).reports) {
        const d = decls.find((x) => x.name === r.instance);
        if (d?.iriBase !== undefined && r.expected !== undefined) byUrl.set(instanceContextUrl(d.iriBase), JSON.parse(r.expected));
      }
    }
    const doc = byUrl.get(url);
    return doc !== undefined ? { contextUrl: null, documentUrl: url, document: doc } : fallback(url);
  };
}

/** Every `*.jsonld` under `dir`, sorted, skipping dot-directories and node_modules. */
function jsonldFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...jsonldFiles(p));
    else if (e.name.endsWith(".jsonld")) out.push(p);
  }
  return out.sort();
}

/** The `@base` an inline context names, if any (last one wins, as in JSON-LD). */
function baseOf(context: unknown): string | undefined {
  let base: string | undefined;
  for (const c of ([] as unknown[]).concat(context ?? [])) {
    if (c && typeof c === "object" && typeof (c as Record<string, unknown>)["@base"] === "string") base = (c as Record<string, string>)["@base"];
  }
  return base;
}

/**
 * Pointer nodes for every library entry `inst` declares, with paths relative
 * to `inst`, and what could not be read. A file whose `@id` or `@type` will
 * not resolve is a problem, never silently dropped.
 */
export async function libraryEntryNodes(inst: string, loader: Loader): Promise<{ nodes: Node[]; problems: string[] }> {
  const nodes: Node[] = [];
  const problems: string[] = [];
  const typeCache = new Map<string, string[] | Error>();
  const failed = new Map<string, { n: number; first: string; why: string }>();
  for (const lib of instanceDirectoriesForGraph(inst, "library")) {
    if (!existsSync(lib) || !statSync(lib).isDirectory()) continue;
    const skip = nonEntryDirs(lib);
    // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`).
    for (const { slug: e, dir } of libraryEntryDirs(lib)) {
      const entry = resolve(dir);
      if (skip.has(entry) || !existsSync(join(entry, "manifest.jsonld"))) continue;
      for (const file of jsonldFiles(entry)) {
        const rel = relative(inst, file).split("\\").join("/");
        let doc: Record<string, unknown>;
        try {
          doc = JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
        } catch (err) {
          problems.push(`${rel}: not JSON (${(err as Error).message})`);
          continue;
        }
        // Not a JSON-LD node document (no `@context`, or no `@id`): a data file, not a node.
        if (!doc || typeof doc !== "object" || Array.isArray(doc) || typeof doc["@id"] !== "string" || doc["@context"] === undefined) continue;
        let id: string;
        try {
          id = new URL(doc["@id"] as string, baseOf(doc["@context"])).href;
        } catch {
          problems.push(`${rel}: @id ${String(doc["@id"])} is not absolute and its context names no @base`);
          continue;
        }
        const rawTypes = ([] as unknown[]).concat(doc["@type"] ?? []).filter((t): t is string => typeof t === "string");
        const key = JSON.stringify([doc["@context"], rawTypes]);
        let types = typeCache.get(key);
        if (types === undefined) {
          try {
            const ex = (await jsonld.expand({ "@context": doc["@context"], "@id": "urn:x", "@type": rawTypes } as never, { documentLoader: loader } as never)) as unknown as Array<Record<string, unknown>>;
            types = (ex[0]?.["@type"] as string[] | undefined) ?? [];
          } catch (err) {
            types = err as Error;
          }
          typeCache.set(key, types);
        }
        if (types instanceof Error) {
          // One line per entry, not one per file: an entry's files share a context.
          const f = failed.get(e) ?? { n: 0, first: rel, why: types.message };
          f.n++;
          failed.set(e, f);
          continue;
        }
        const node: Node = { "@id": id, path: rel };
        // A subgraph member carries ONE type (subgraph-manifest.ts): the first
        // the file names, which is its own kind (a block's `Prose`, say).
        if (types.length) node["@type"] = types[0];
        if (typeof doc.title === "string") node.title = doc.title;
        nodes.push(node);
      }
    }
  }
  for (const [e, f] of failed) problems.push(`library/${e}: ${f.n} file(s) left out, their @type does not expand (first ${f.first}: ${f.why})`);
  return { nodes, problems };
}
