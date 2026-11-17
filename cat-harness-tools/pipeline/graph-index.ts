/**
 * One graph index over both node populations.
 *
 * This is the payoff the `.jsonld` siblings were built for. Authored blocks
 * (`content/**\/<block>.jsonld`, generated from the `.ts` manifest) and
 * ingested document nodes (`library/**\/nodes/*.jsonld`, written directly)
 * carry the same `@context`, the same `@type` vocabulary and the same edge
 * terms — so loading them is one directory walk and one `JSON.parse`, not two
 * code paths where one imports TypeScript and the other parses JSON.
 *
 * ## What this is not
 *
 * Not a replacement for `content-graph.ts`. That builds the authoritative
 * editorial + formal graph by *importing* block manifests, and the import is
 * itself a validation step (`block-module.ts` treats a manifest that throws as
 * a finding). This index reads the published projection instead: cheaper, and
 * it spans ingested documents, which `content-graph.ts` cannot see. The CI
 * drift gate is what lets both be trusted at once.
 *
 * Not a vector store either. Retrieval here is lexical over metadata plus, on
 * request, the companion Markdown — which is what `docs/proposals/rag-document-ingestion.md`
 * §7-bis argues is the right substrate at this corpus size. An embedding index
 * layers on top later and reads the same files.
 *
 * ## Honest emptiness
 *
 * A root that does not exist contributes zero nodes and says so in
 * `GraphIndex.roots`. That matters while the ingest writer is unbuilt: a
 * caller must be able to tell "no library nodes because none have been
 * written" from "no library nodes matched", and the §5 integration contract's
 * rule is that an absent input reads as `n/a`, never as a clean empty result.
 *
 * @module pipeline/graph-index
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, dirname, relative } from "path";
import { GRAPH_EDGE_TERMS, type GraphEdgeTerm } from "../schemas/kg/jsonld.ts";
import { folioDir } from "../schemas/kg/cat-harness.js";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";

export interface GraphNode {
  /** The `@id` — a relative IRI, minted by `resolveLabel` for authored blocks. */
  id: string;
  /** `folio:label`, the authored string. Absent on ingested nodes. */
  label?: string;
  kind?: string;
  title?: string;
  types: string[];
  provenance: string;
  tags: string[];
  /** Absolute path to the `.jsonld`. */
  file: string;
  /** Absolute path to the companion `.md`, when the node declares one. */
  textFile?: string;
  /** Outbound edges by term. */
  edges: Partial<Record<GraphEdgeTerm, string[]>>;
}

export interface GraphIndex {
  nodes: Map<string, GraphNode>;
  /** Reverse adjacency — the direction nothing else in the repo provides. */
  incoming: Map<string, Array<{ from: string; edge: GraphEdgeTerm }>>;
  /** Per-root node counts, and whether the root existed at all. */
  roots: Array<{ name: string; dir: string; present: boolean; nodes: number }>;
  /** Files that would not parse. A malformed node is a finding, not a skip. */
  malformed: Array<{ file: string; error: string }>;
}

const EDGE_TERM_SET = new Set<string>(GRAPH_EDGE_TERMS);

function walkJsonLd(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.startsWith(".") || e === "node_modules") continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkJsonLd(p, out);
    else if (e.endsWith(".jsonld")) out.push(p);
  }
}

function asStrings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

/** Parse one `.jsonld` into a node. Returns undefined when it is not a node. */
export function parseNode(file: string, raw: string): GraphNode | undefined {
  const doc = JSON.parse(raw) as Record<string, unknown>;
  const id = doc["@id"];
  if (typeof id !== "string" || !id) return undefined;

  const edges: Partial<Record<GraphEdgeTerm, string[]>> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (!EDGE_TERM_SET.has(k)) continue;
    const targets = asStrings(v);
    if (targets.length) edges[k as GraphEdgeTerm] = targets;
  }

  const textRel = typeof doc.text === "string" ? doc.text : undefined;

  return {
    id,
    label: typeof doc.label === "string" ? doc.label : undefined,
    kind: typeof doc.kind === "string" ? doc.kind : undefined,
    title: typeof doc.title === "string" ? doc.title : undefined,
    types: asStrings(doc["@type"]),
    provenance: typeof doc.provenance === "string" ? doc.provenance : "unknown",
    tags: asStrings(doc.tags),
    file,
    textFile: textRel ? join(dirname(file), textRel) : undefined,
    edges,
  };
}

/**
 * Load every `.jsonld` node under the given roots.
 *
 * Later roots do not overwrite earlier ones on an `@id` collision — the
 * collision is recorded in `malformed` instead. Two nodes claiming one IRI is
 * a defect that silently picking a winner would hide.
 */
export function loadGraphIndex(
  roots: Array<{ name: string; dir: string }>,
): GraphIndex {
  const nodes = new Map<string, GraphNode>();
  const incoming = new Map<string, Array<{ from: string; edge: GraphEdgeTerm }>>();
  const malformed: GraphIndex["malformed"] = [];
  const rootStats: GraphIndex["roots"] = [];

  for (const root of roots) {
    const present = existsSync(root.dir);
    let count = 0;
    if (present) {
      const files: string[] = [];
      walkJsonLd(root.dir, files);
      for (const f of files.sort()) {
        let node: GraphNode | undefined;
        try {
          node = parseNode(f, readFileSync(f, "utf-8"));
        } catch (e) {
          malformed.push({ file: f, error: String(e).slice(0, 200) });
          continue;
        }
        if (!node) continue;
        const existing = nodes.get(node.id);
        if (existing) {
          malformed.push({
            file: f,
            error: `@id "${node.id}" already claimed by ${existing.file}`,
          });
          continue;
        }
        nodes.set(node.id, node);
        count++;
      }
    }
    rootStats.push({ name: root.name, dir: root.dir, present, nodes: count });
  }

  for (const node of nodes.values()) {
    for (const [edge, targets] of Object.entries(node.edges)) {
      for (const t of targets as string[]) {
        const list = incoming.get(t) ?? [];
        list.push({ from: node.id, edge: edge as GraphEdgeTerm });
        incoming.set(t, list);
      }
    }
  }

  return { nodes, incoming, roots: rootStats, malformed };
}

/** Resolve an `@id` or an authored label to a node. */
export function findNode(index: GraphIndex, idOrLabel: string): GraphNode | undefined {
  const direct = index.nodes.get(idOrLabel);
  if (direct) return direct;
  for (const n of index.nodes.values()) if (n.label === idOrLabel) return n;
  return undefined;
}

export interface SearchHit {
  id: string;
  label?: string;
  kind?: string;
  title?: string;
  provenance: string;
  /** Which field matched — so a caller can tell a title hit from a body hit. */
  matchedIn: string;
  snippet?: string;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Total matches before `limit` — so truncation is visible, never silent. */
  totalMatches: number;
  /** Companion `.md` files actually read, when `searchText` was set. */
  textFilesScanned: number;
  /** True when the text scan hit its cap and stopped early. */
  textScanTruncated: boolean;
  roots: GraphIndex["roots"];
}

export interface SearchOptions {
  /** Restrict by provenance: `authored`, `ingested`, or undefined for both. */
  provenance?: string;
  limit?: number;
  /** Also scan companion Markdown. Off by default — it reads files. */
  searchText?: boolean;
  /** Cap on companion files read in one search. Default 50,000 — see note in searchGraph. */
  maxTextFiles?: number;
}

/**
 * Lexical search over node metadata, and optionally companion Markdown.
 *
 * Deliberately not fuzzy and not ranked by relevance: at this corpus size a
 * substring match over label/title/tags is what an agent actually wants, and
 * a made-up relevance order would obscure that everything matched equally.
 */
export function searchGraph(
  index: GraphIndex,
  query: string,
  opts: SearchOptions = {},
): SearchResult {
  const q = query.trim().toLowerCase();
  const limit = opts.limit ?? 20;
  // Measured on qou: scanning all 20,191 companion files takes 1.6 s and
  // finds 322 matches for "Reidemeister"; the 400-file cap this replaces
  // found 55. It cost 6x the recall to save nothing, and worse, it was
  // *biased* — iteration reaches authored nodes first, so the ingested
  // population, which is the whole reason full-text search exists here, was
  // never scanned at all. The cap remains as a backstop against a
  // pathological tree, set well above any real corpus.
  const maxTextFiles = opts.maxTextFiles ?? 50_000;

  const hits: SearchHit[] = [];
  let totalMatches = 0;
  let textFilesScanned = 0;
  let textScanTruncated = false;

  if (!q) {
    return { hits, totalMatches: 0, textFilesScanned, textScanTruncated, roots: index.roots };
  }

  for (const node of index.nodes.values()) {
    if (opts.provenance && node.provenance !== opts.provenance) continue;

    let matchedIn: string | undefined;
    let snippet: string | undefined;

    const meta: Array<[string, string | undefined]> = [
      ["label", node.label],
      ["title", node.title],
      ["kind", node.kind],
      ["tags", node.tags.join(" ")],
    ];
    for (const [field, value] of meta) {
      if (value && value.toLowerCase().includes(q)) {
        matchedIn = field;
        break;
      }
    }

    if (!matchedIn && opts.searchText && node.textFile) {
      if (textFilesScanned >= maxTextFiles) {
        textScanTruncated = true;
      } else {
        try {
          const body = readFileSync(node.textFile, "utf-8");
          textFilesScanned++;
          const at = body.toLowerCase().indexOf(q);
          if (at >= 0) {
            matchedIn = "text";
            snippet = body.slice(Math.max(0, at - 60), at + 140).replace(/\s+/g, " ").trim();
          }
        } catch {
          // A declared-but-unreadable companion is not a match; the emitter
          // only links files it saw, so this means the tree moved under us.
        }
      }
    }

    if (!matchedIn) continue;
    totalMatches++;
    if (hits.length < limit) {
      hits.push({
        id: node.id,
        label: node.label,
        kind: node.kind,
        title: node.title,
        provenance: node.provenance,
        matchedIn,
        snippet,
      });
    }
  }

  return { hits, totalMatches, textFilesScanned, textScanTruncated, roots: index.roots };
}

export interface NeighborEdge {
  from: string;
  to: string;
  edge: GraphEdgeTerm;
  /** Hop distance from the seed at which this edge was discovered. */
  hop: number;
}

export interface NeighborResult {
  seed: string;
  nodes: SearchHit[];
  edges: NeighborEdge[];
  /** Targets referenced by an edge but absent from the index. */
  dangling: string[];
  truncated: boolean;
}

export interface NeighborOptions {
  hops?: number;
  /** `out` follows dependencies, `in` finds dependents, `both` does both. */
  direction?: "out" | "in" | "both";
  /** Restrict to these edge terms. Undefined means all of them. */
  edges?: readonly GraphEdgeTerm[];
  maxNodes?: number;
}

/**
 * Breadth-first neighbourhood around a node.
 *
 * The reverse direction is the reason this exists. "What must a reader have
 * read first?" is answerable from a block's own `uses[]`; "what breaks if this
 * changes?" is not, and today needs a full corpus scan. The index builds that
 * adjacency once.
 */
export function neighbors(
  index: GraphIndex,
  idOrLabel: string,
  opts: NeighborOptions = {},
): NeighborResult | { error: string } {
  const seed = findNode(index, idOrLabel);
  if (!seed) return { error: `No node for "${idOrLabel}"` };

  const hops = Math.max(1, Math.min(opts.hops ?? 1, 6));
  const direction = opts.direction ?? "out";
  const allowed = opts.edges ? new Set<string>(opts.edges) : undefined;
  const maxNodes = opts.maxNodes ?? 200;

  const seen = new Set<string>([seed.id]);
  const edges: NeighborEdge[] = [];
  const dangling = new Set<string>();
  let frontier = [seed.id];
  let truncated = false;

  for (let hop = 1; hop <= hops && frontier.length; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      const node = index.nodes.get(id);

      if (node && (direction === "out" || direction === "both")) {
        for (const [edge, targets] of Object.entries(node.edges)) {
          if (allowed && !allowed.has(edge)) continue;
          for (const t of targets as string[]) {
            edges.push({ from: id, to: t, edge: edge as GraphEdgeTerm, hop });
            if (!index.nodes.has(t)) {
              dangling.add(t);
              continue;
            }
            if (!seen.has(t)) {
              if (seen.size >= maxNodes) {
                truncated = true;
                continue;
              }
              seen.add(t);
              next.push(t);
            }
          }
        }
      }

      if (direction === "in" || direction === "both") {
        for (const { from, edge } of index.incoming.get(id) ?? []) {
          if (allowed && !allowed.has(edge)) continue;
          edges.push({ from, to: id, edge, hop });
          if (!seen.has(from)) {
            if (seen.size >= maxNodes) {
              truncated = true;
              continue;
            }
            seen.add(from);
            next.push(from);
          }
        }
      }
    }
    frontier = next;
  }

  const nodes: SearchHit[] = [];
  for (const id of seen) {
    const n = index.nodes.get(id);
    if (!n) continue;
    nodes.push({
      id: n.id,
      label: n.label,
      kind: n.kind,
      title: n.title,
      provenance: n.provenance,
      matchedIn: id === seed.id ? "seed" : "neighbor",
    });
  }

  return { seed: seed.id, nodes, edges, dangling: [...dangling], truncated };
}

/** Counts a caller can use to tell "empty" from "not built yet". */
export function graphStats(index: GraphIndex): Record<string, unknown> {
  const byProvenance: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  let withText = 0;
  for (const n of index.nodes.values()) {
    byProvenance[n.provenance] = (byProvenance[n.provenance] ?? 0) + 1;
    if (n.kind) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
    if (n.textFile) withText++;
  }
  let edgeCount = 0;
  for (const n of index.nodes.values()) {
    for (const t of Object.values(n.edges)) edgeCount += (t as string[]).length;
  }
  return {
    nodes: index.nodes.size,
    edges: edgeCount,
    byProvenance,
    byKind,
    nodesWithText: withText,
    roots: index.roots,
    malformed: index.malformed.length,
    malformedDetail: index.malformed.slice(0, 10),
  };
}

/** The standard roots: authored blocks and ingested documents. */
export function defaultRoots(repoRoot: string): Array<{ name: string; dir: string }> {
  // EVERY declared library, not the one.
  //
  // This is an INDEX. Indexing one of several libraries and reporting a clean
  // build is the `dh4f` defect — a consumer scanning nothing and saying so is
  // recoverable; one scanning half and saying nothing is not. `library` has
  // three homes since bean `frs5`, so `directoryForGraph` REFUSES here rather
  // than picking, which is the accessor doing its job and the reason this is
  // plural rather than silently wrong.
  //
  // Named per directory rather than all called "library", because a node's
  // root name is how a message says WHERE it came from, and two roots with one
  // name make that answer useless exactly when there is something to tell apart.
  const libraries = corpusDirectoriesForGraph(repoRoot, "library");
  return [
    { name: "folio", dir: folioDir(repoRoot) },
    // declared-path-literal: the convention fallback, at the call site so the
    // choice is visible. The index is built over whatever is there; a root
    // that resolves to nothing yields fewer nodes rather than an error.
    ...(libraries.length === 0
      ? [{ name: "library", dir: join(repoRoot, "library") }]
      : libraries.map((dir, i) => ({
          name: libraries.length === 1 ? "library" : `library:${relative(repoRoot, dir) || String(i)}`,
          dir,
        }))),
  ];
}

/** Repo-relative path, for messages that should not leak an absolute path. */
export function relPath(repoRoot: string, file: string): string {
  return relative(repoRoot, file);
}

// ── CLI ──────────────────────────────────────────────────────────

/**
 * A human-runnable view of the same index the MCP tools serve, so the graph
 * can be inspected without an MCP client.
 *
 *   bun run cat-harness-tools/pipeline/graph-index.ts --stats
 *   bun run cat-harness-tools/pipeline/graph-index.ts --search "torsion" --text
 *   bun run cat-harness-tools/pipeline/graph-index.ts --neighbors thm:main --in --hops 2
 */
if (import.meta.main) {
  const { findContentRepoRoot } = await import("./repo-root");
  const root = findContentRepoRoot();
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined =>
    argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined;

  const index = loadGraphIndex(defaultRoots(root));

  if (argv.includes("--search")) {
    const q = arg("--search") ?? "";
    const r = searchGraph(index, q, {
      searchText: argv.includes("--text"),
      limit: Number(arg("--limit") ?? 20),
    });
    console.log(JSON.stringify(r, null, 2));
  } else if (argv.includes("--neighbors")) {
    const direction = argv.includes("--in") ? "in" : argv.includes("--both") ? "both" : "out";
    console.log(
      JSON.stringify(
        neighbors(index, arg("--neighbors") ?? "", {
          direction,
          hops: Number(arg("--hops") ?? 1),
        }),
        null,
        2,
      ),
    );
  } else {
    console.log(JSON.stringify(graphStats(index), null, 2));
  }
}
