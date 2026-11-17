#!/usr/bin/env bun
/**
 * A layer's NAMED SUBGRAPHS as JSON-LD: under each subgraph's IRI,
 * `index.jsonld` and `index.hydrated.jsonld`, both projected from the one
 * graph `export-graph.ts` builds.
 *
 * @module bootstrap-tools/scripts/subgraph-jsonld
 * @covers code
 *
 * ## Why
 *
 * A reader that lists every process of a Knowledge Graph, or wants "every
 * node of `processes/`", should need one fetch per subgraph, not the whole
 * graph document and a filter.
 *
 * ## The files
 *
 * | IRI | `index.jsonld` | `index.hydrated.jsonld` |
 * |---|---|---|
 * | `<BASE>subgraph/` — the repository | its harness root, by IRI | — |
 * | `<BASE>subgraph/<HARNESS>/` — the layer | its direct members as pointers, its top-level subgraphs by IRI | — (the root is never hydrated: that would be the whole graph in one file) |
 * | `<BASE>subgraph/<HARNESS>/<PATH>/` — each directory | its direct members as pointers (`@id`, `@type`, `name`, `title`), its child subgraphs by IRI | every node of its transitive membership, inline, child subgraphs nested |
 *
 * Every file names one shared context by URL, `<BASE>subgraph/v<major>/context.jsonld`,
 * which this writes too; no file inlines one. `<BASE>` is the publication
 * root: `--base-url`, else the declaration's `iriBase`, else its GitHub Pages
 * address (`processes/render-kg-to-github-pages.bpmn`, step one).
 *
 * ## One graph, two projections
 *
 * Both files are projections of the same in-memory graph, computed in one
 * pass: the pointer projection keeps `@id`, `@type` and the label; the
 * hydrated one keeps the node whole. Every edge between nodes stays an IRI.
 * No `jsonld` framing processor: these tools may not depend on one
 * (`check-closure.ts`), and two fixed projections of a graph we built need
 * none. One term is renamed in the projection, `label` → `name`, both
 * `rdfs:label` in the context: the same triple, in the term a subgraph
 * reader uses — not a second property.
 *
 * Nodes carry no heavy body: the graph holds a skill's path, never its text.
 * A process's `description` is its diagram's documentation, a few paragraphs.
 *
 * ## Membership is containment
 *
 * A subgraph is framed for every directory git accounts for under each
 * declared directory of a kind `export-graph.ts` reads (`COLLECTED_KINDS`),
 * nested ones included. A node with a source path is a direct member of the
 * deepest subgraph whose directory contains that path; a node with none
 * (a process's nodes and flows) is where its `isPartOf` parent is; anything
 * no framed directory contains is a member of the harness root. A declared
 * directory of another kind is named in `omitted`, never framed empty, and a
 * node that cannot be placed is a problem, never left out.
 *
 * ```sh
 * bun run bootstrap-tools/scripts/subgraph-jsonld.ts --root <instance> --out <site dir> [--base-url <url>] [--bootstrap <dir>]
 * bun run bootstrap-tools/scripts/subgraph-jsonld.ts --check --root <instance>… [--out <site dir>]
 * ```
 *
 * `--check` builds in memory, validates every file against
 * `schemas/subgraph-export.ts`, and fails on a problem, a child IRI with no
 * file, a declared diagram with no documented Process node, or a build that
 * is not byte-identical twice; with `--out`, also on any file there that
 * differs from what would be written. Repeat `--root` to check several
 * layers.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { readKnowledgeGraphDeclaration } from "../schemas/declaration.ts";
import { SubgraphHydratedSchema, SubgraphIndexSchema } from "../schemas/subgraph-export.ts";
import { COLLECTED_KINDS, exportGraph } from "./export-graph.ts";
import { gitFiles } from "./git-files.ts";

/** Where the tree sits under the publication root, and the namespace its IRIs are in. */
export const SUBGRAPH_DIR = "subgraph";
export const INDEX_FILE = "index.jsonld";
export const HYDRATED_FILE = "index.hydrated.jsonld";
/** The shared context's file name, under the MAJOR version's directory: `<BASE>subgraph/v<major>/context.jsonld`. */
export const CONTEXT_FILE = "context.jsonld";

/**
 * The context's path below `subgraph/`, from the layer's declared semver
 * (owner, 2026-10-03: "major version from SEMVER"). The same rule as
 * `bootstrap.json`'s `iriBase`: `v<major>/` for what is stable across minor
 * and patch releases. A term change that is not backward compatible is a
 * major bump, so a reader pinned to `v0/` never sees it change under it.
 * `undefined` when the version is absent or not semver — a problem, never a
 * guessed `v0`.
 */
export function contextPath(version: string | undefined): string | undefined {
  const m = /^(\d+)\.\d+\.\d+(?:[-+].*)?$/.exec(version ?? "");
  return m ? `v${m[1]}/${CONTEXT_FILE}` : undefined;
}

/** Terms the projection spells differently from `export-graph.ts`: same IRI, the subgraph reader's term. */
export const RENAMED: Readonly<Record<string, string>> = { label: "name" };

/** Terms of the graph document's context that describe its build, not a node; no subgraph file carries them. */
const BUILD_TERMS = ["omitted", "counts", "problems", "generatedAtTime", "wasDerivedFrom"];

type Node = Record<string, unknown> & { "@id": string; "@type": string };

/** The context every subgraph file names: the graph's, renamed, plus the four subgraph terms — each a published standard's. */
export function subgraphContext(graphContext: Record<string, unknown>): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(graphContext)) {
    if (BUILD_TERMS.includes(k)) continue;
    ctx[RENAMED[k] ?? k] = v;
  }
  ctx["path"] = "dcterms:identifier";
  ctx["holdsGraph"] = { "@id": "dcterms:type", "@type": "@id", "@container": "@set" };
  ctx["hasMember"] = { "@id": "rdfs:member", "@type": "@id", "@container": "@set" };
  ctx["hasSubgraph"] = { "@id": "dcterms:hasPart", "@type": "@id", "@container": "@set" };
  return ctx;
}

/** The publication root: `baseUrl`, else `iriBase`, else the declaration's GitHub Pages address. Ends in `/`. */
export function publicationBase(decl: { iriBase?: string; repository?: unknown } | undefined, baseUrl?: string): string | undefined {
  const pick = baseUrl ?? decl?.iriBase;
  if (pick) return pick.replace(/\/?$/, "/");
  const m = typeof decl?.repository === "string" ? /^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(decl.repository.trim()) : null;
  return m ? `https://${m[1]!.toLowerCase()}.github.io/${m[2]}/` : undefined;
}

/** Keys `@`-first, then by code unit — so two builds are byte-identical whatever order a node was assembled in. */
function sortKeys<T extends Record<string, unknown>>(o: T): T {
  const keys = Object.keys(o).sort((a, b) => (a.startsWith("@") !== b.startsWith("@") ? (a.startsWith("@") ? -1 : 1) : a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(keys.map((k) => [k, o[k]])) as T;
}

/** A node as the hydrated file carries it: whole, its terms renamed. */
function hydrate(n: Node): Node {
  return sortKeys(Object.fromEntries(Object.entries(n).map(([k, v]) => [RENAMED[k] ?? k, v])) as Node);
}

/** A node as the index carries it: `@id`, `@type`, and its label. */
function pointer(n: Node): Node {
  const h = hydrate(n);
  return { "@id": h["@id"], "@type": h["@type"], ...(h["name"] !== undefined ? { name: h["name"] } : {}), ...(h["title"] !== undefined ? { title: h["title"] } : {}) };
}

interface Entry {
  iri: string;
  /** Layer-relative directory ending in `/`; `""` for the harness root. */
  rel: string;
  kinds: string[];
  title?: string;
  description?: string;
  members: Node[];
  children: Entry[];
}

export interface SubgraphBuild {
  /** Path under the site root (`subgraph/…`) → bytes. */
  files: Map<string, string>;
  /** `<BASE>subgraph/` — the one file a reader needs to find every root. */
  repoIri: string;
  /** `<BASE>subgraph/<HARNESS>/`. */
  rootIri: string;
  contextUrl: string;
  /** The context's path under the site root (`subgraph/v<major>/context.jsonld`). */
  contextFile: string;
  /** Declared directories of a kind the graph does not read, so not framed. */
  omitted: string[];
  /** Nodes that could not be placed, or a directory git could not list. A build with any is not to be published. */
  problems: string[];
  /** How many subgraphs, and how many Process nodes they hold. */
  subgraphs: number;
  processes: number;
}

/**
 * Frame `graph` — `export-graph.ts`'s document for the layer at `root`,
 * built with `sourceBase` = `base`, so every `source` is a link — into its
 * subgraph files. Pure over the graph and the files git lists under `root`.
 */
export function frameSubgraphs(root: string, graph: Record<string, unknown>, base: string): SubgraphBuild {
  const decl = readKnowledgeGraphDeclaration(root);
  if (!decl) throw new Error(`${root} carries no Knowledge Graph declaration`);
  base = base.replace(/\/?$/, "/");
  const repoIri = `${base}${SUBGRAPH_DIR}/`;
  const rootIri = `${repoIri}${decl.name}/`;
  const problems: string[] = [];
  const ctxRel = contextPath(decl.version);
  if (!ctxRel) problems.push(`${root}: declared version ${JSON.stringify(decl.version)} is not semver, so the context has no major-version path`);
  const contextFile = `${SUBGRAPH_DIR}/${ctxRel ?? `v0/${CONTEXT_FILE}`}`;
  const contextUrl = `${base}${contextFile}`;
  const dirs = decl.directories ?? [];
  const framed = dirs.filter((d) => d.graphTypologies.some((k) => COLLECTED_KINDS.includes(k)));
  const omitted = dirs.filter((d) => !framed.includes(d)).map((d) => d.id).sort();

  const harness: Entry = { iri: rootIri, rel: "", kinds: [...new Set(framed.flatMap((d) => d.graphTypologies))].sort(), title: decl.title, description: decl.description, members: [], children: [] };
  const byRel = new Map<string, Entry>([["", harness]]);
  const files = gitFiles(root);
  for (const d of framed) {
    const top = d.path.replace(/^\.\//, "").replace(/\/?$/, "/");
    if (files === undefined) {
      problems.push(`${top}: git could not list its files, so its subgraphs are not determined`);
      continue;
    }
    const rels = new Set<string>([top]);
    for (const f of files) {
      const r = relative(root, f).split("\\").join("/");
      if (!r.startsWith(top)) continue;
      const parts = r.slice(top.length).split("/").slice(0, -1);
      if (parts.some((p) => p.startsWith(".") || p === "node_modules")) continue;
      for (let i = 1; i <= parts.length; i++) rels.add(`${top}${parts.slice(0, i).join("/")}/`);
    }
    for (const rel of [...rels].sort()) {
      if (byRel.has(rel)) continue;
      const e: Entry = { iri: `${rootIri}${rel}`, rel, kinds: [...d.graphTypologies].sort(), ...(rel === top ? { title: d.title, description: d.description } : {}), members: [], children: [] };
      byRel.set(rel, e);
      const parent = rel === top ? harness : byRel.get(rel.replace(/[^/]+\/$/, ""));
      if (parent) parent.children.push(e);
      else problems.push(`${rel}: its parent directory was not framed`);
    }
  }

  // Place by path, then through `isPartOf` to a fixed point.
  // A node with no `@type` is not a subject and belongs to no subgraph.
  const nodes = ((graph["@graph"] as Node[]) ?? []).filter((n) => n["@type"] !== undefined);
  const byId = new Map(nodes.map((n) => [n["@id"], n]));
  const placed = new Map<string, Entry>();
  const pathOf = (n: Node): string | undefined => {
    const s = n["source"];
    return typeof s === "string" && s.startsWith(base) ? s.slice(base.length) : typeof s === "string" && !/^[a-z]+:/.test(s) ? s : undefined;
  };
  for (const n of nodes) {
    const p = pathOf(n);
    if (p === undefined) continue;
    let dir = p.endsWith("/") ? p : p.replace(/[^/]*$/, "");
    while (dir !== "" && !byRel.has(dir)) dir = dir.replace(/[^/]+\/$/, "");
    placed.set(n["@id"], byRel.get(dir)!);
  }
  for (let moved = true; moved; ) {
    moved = false;
    for (const n of nodes) {
      if (placed.has(n["@id"])) continue;
      const parent = typeof n["isPartOf"] === "string" ? placed.get(n["isPartOf"]) : undefined;
      if (parent) {
        placed.set(n["@id"], parent);
        moved = true;
      }
    }
  }
  for (const n of nodes) {
    const e = placed.get(n["@id"]);
    if (e) e.members.push(n);
    else problems.push(`${n["@id"]}: no source path, and its isPartOf (${String(n["isPartOf"] ?? "none")}) ${byId.has(String(n["isPartOf"])) ? "is not placed" : "is not a node of the graph"} — its subgraph cannot be determined`);
  }

  const key = (x: { "@id"?: unknown; iri?: unknown }) => String(x["@id"] ?? x.iri);
  const sortById = <T extends { "@id"?: unknown; iri?: unknown }>(xs: T[]) => xs.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  for (const e of byRel.values()) {
    sortById(e.members);
    sortById(e.children);
  }
  const head = (e: Entry) => ({
    "@id": e.iri,
    "@type": "bootstrap:Subgraph",
    name: e.rel === "" ? decl.name : e.rel.replace(/\/$/, ""),
    path: e.rel === "" ? "./" : e.rel,
    ...(e.title ? { title: e.title } : {}),
    ...(e.description ? { description: e.description } : {}),
    ...(e.kinds.length ? { holdsGraph: e.kinds.map((k) => `bootstrap:graphTypology/${k}`) } : {}),
  });
  const indexOf = (e: Entry) =>
    sortKeys({
      "@context": contextUrl,
      ...head(e),
      ...(e.members.length ? { hasMember: e.members.map(pointer) } : {}),
      ...(e.children.length ? { hasSubgraph: e.children.map((c) => c.iri) } : {}),
    });
  const hydratedOf = (e: Entry): Record<string, unknown> =>
    sortKeys({
      ...head(e),
      ...(e.members.length ? { hasMember: e.members.map(hydrate) } : {}),
      ...(e.children.length ? { hasSubgraph: e.children.map(hydratedOf) } : {}),
    });

  const json = (o: unknown) => `${JSON.stringify(o, null, 2)}\n`;
  const out = new Map<string, string>();
  const at = (iri: string, file: string) => `${SUBGRAPH_DIR}/${iri.slice(repoIri.length)}${file}`;
  out.set(contextFile, json({ "@context": subgraphContext((graph["@context"] as Record<string, unknown>) ?? {}) }));
  const repoName = String(decl.repository ?? decl.name).replace(/\.git$/, "").replace(/\/$/, "").replace(/^.*\//, "");
  out.set(at(repoIri, INDEX_FILE), json(sortKeys({ "@context": contextUrl, "@id": repoIri, "@type": "bootstrap:Subgraph", name: repoName, path: "./", hasSubgraph: [rootIri] })));
  for (const e of byRel.values()) {
    out.set(at(e.iri, INDEX_FILE), json(indexOf(e)));
    if (e.rel !== "") out.set(at(e.iri, HYDRATED_FILE), json({ "@context": contextUrl, ...hydratedOf(e) }));
  }
  return {
    files: new Map([...out].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    repoIri,
    rootIri,
    contextUrl,
    contextFile,
    omitted,
    problems,
    subgraphs: byRel.size,
    processes: nodes.filter((n) => n["@type"] === "bootstrap:Process" && placed.get(n["@id"])?.rel !== "").length,
  };
}

/** Build the layer's graph and frame it. `base` as {@link publicationBase} resolves it. */
export function buildSubgraphs(root: string, opts: { baseUrl?: string; bootstrapRoot?: string } = {}): SubgraphBuild {
  const decl = readKnowledgeGraphDeclaration(root);
  if (!decl) throw new Error(`${root} carries no Knowledge Graph declaration`);
  const base = publicationBase(decl, opts.baseUrl);
  if (!base) throw new Error(`${root}: no --base-url, no iriBase and no repository — the subgraph IRIs would be a guess`);
  const graph = exportGraph(root, { docIri: `${base}${decl.name}.jsonld`, sourceBase: base, bootstrapRoot: opts.bootstrapRoot });
  return frameSubgraphs(root, graph, base);
}

/**
 * What `--check` asks of a build: every file validates, every child IRI has
 * its file, every diagram a `processes` directory holds is a documented
 * Process node in a hydrated file, and nothing could not be placed.
 */
export function auditSubgraphs(root: string, b: SubgraphBuild): string[] {
  const problems = [...b.problems];
  const parsed = new Map<string, Record<string, unknown>>();
  for (const [path, text] of b.files) {
    const doc = JSON.parse(text) as Record<string, unknown>;
    parsed.set(path, doc);
    if (path === b.contextFile) continue;
    const r = (path.endsWith(HYDRATED_FILE) ? SubgraphHydratedSchema : SubgraphIndexSchema).safeParse(doc);
    if (!r.success) problems.push(`${path}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    if (doc["@context"] !== b.contextUrl) problems.push(`${path}: its @context is not ${b.contextUrl}`);
    const expected = `${b.repoIri}${path.slice(SUBGRAPH_DIR.length + 1).replace(/[^/]*$/, "")}`;
    if (doc["@id"] !== expected) problems.push(`${path}: its @id ${String(doc["@id"])} is not the directory it sits in, ${expected}`);
    for (const child of (doc["hasSubgraph"] as unknown[] | undefined) ?? []) {
      if (typeof child !== "string") continue;
      if (!b.files.has(`${SUBGRAPH_DIR}/${child.slice(b.repoIri.length)}${INDEX_FILE}`)) problems.push(`${path}: lists ${child}, which has no ${INDEX_FILE}`);
    }
  }
  // Every diagram declared is a documented Process node in some hydrated file.
  const decl = readKnowledgeGraphDeclaration(root);
  const diagrams = new Set<string>();
  for (const d of (decl?.directories ?? []).filter((x) => x.graphTypologies.includes("processes"))) {
    const top = d.path.replace(/^\.\//, "").replace(/\/?$/, "/");
    for (const f of gitFiles(root) ?? []) {
      const r = relative(root, f).split("\\").join("/");
      if (r.startsWith(top) && r.endsWith(".bpmn")) diagrams.add(r);
    }
  }
  const documented = new Map<string, Record<string, unknown>>();
  const sharedTasks = new Set<string>();
  const base = b.repoIri.slice(0, -`${SUBGRAPH_DIR}/`.length);
  for (const [path, doc] of parsed) {
    if (!path.endsWith(HYDRATED_FILE)) continue;
    const walk = (n: Record<string, unknown>) => {
      for (const m of (n["hasMember"] as Record<string, unknown>[] | undefined) ?? []) {
        if (m["@type"] === "bootstrap:Process" && typeof m["source"] === "string") documented.set(String(m["source"]).slice(base.length), m);
        // A file holding no process but a layer's shared global tasks is
        // documented by those Task nodes (owner, 2026-10-20, "a1").
        else if (m["@type"] === "bootstrap:Task" && typeof m["source"] === "string") sharedTasks.add(String(m["source"]).slice(base.length));
      }
      for (const c of (n["hasSubgraph"] as Record<string, unknown>[] | undefined) ?? []) walk(c);
    };
    walk(doc);
  }
  for (const d of [...diagrams].sort()) {
    const m = documented.get(d);
    if (!m && sharedTasks.has(d)) continue;
    if (!m) problems.push(`${d}: declared, and no hydrated subgraph holds a Process node for it`);
    else if (typeof m["summary"] !== "string" || !m["summary"]) problems.push(`${d}: its Process node carries no summary — give the diagram a <bpmn:documentation> of its own`);
  }
  return problems;
}

/** Write a build's files under `out` (a site directory). Returns what it wrote. */
export function writeSubgraphs(out: string, b: SubgraphBuild): string[] {
  for (const [path, text] of b.files) {
    const p = join(out, path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
  return [...b.files.keys()];
}

/** Files under `out` that differ from, or are missing against, a build. */
export function staleSubgraphs(out: string, b: SubgraphBuild): string[] {
  return [...b.files].filter(([path, text]) => !existsSync(join(out, path)) || readFileSync(join(out, path), "utf-8") !== text).map(([path]) => path);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const roots = args.flatMap((a, i) => (a === "--root" && args[i + 1] ? [args[i + 1]!] : []));
  if (roots.length === 0) roots.push(join(import.meta.dir, "..", "..", "bootstrap"));
  const check = args.includes("--check");
  const out = arg("--out");
  if (!check && !out) {
    console.error("usage: subgraph-jsonld.ts --root <instance> (--out <site dir> | --check [--out <site dir>]) [--base-url <url>] [--bootstrap <dir>]");
    process.exit(2);
  }
  let failed = false;
  for (const root of roots) {
    const opts = { baseUrl: arg("--base-url"), bootstrapRoot: arg("--bootstrap") };
    let b: SubgraphBuild;
    try {
      b = buildSubgraphs(root, opts);
    } catch (e) {
      console.error(`✗ ${root}: ${(e as Error).message}`);
      failed = true;
      continue;
    }
    const problems = check ? auditSubgraphs(root, b) : [...b.problems];
    if (check) {
      const again = buildSubgraphs(root, opts);
      if (JSON.stringify([...again.files]) !== JSON.stringify([...b.files])) problems.push("two builds of one tree differ");
      if (out) for (const p of staleSubgraphs(out, b)) problems.push(`${join(out, p)}: stale or missing`);
    } else if (problems.length === 0) {
      writeSubgraphs(out!, b);
    }
    const mark = problems.length ? "✗" : "✓";
    console.log(`${mark} ${root}: ${b.subgraphs} subgraph(s), ${b.files.size} file(s), ${b.processes} Process node(s) — ${b.repoIri}${INDEX_FILE}`);
    if (b.omitted.length) console.log(`  · not framed (a kind the graph does not read): ${b.omitted.join(", ")}`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    if (problems.length) failed = true;
  }
  if (failed) process.exit(1);
}
