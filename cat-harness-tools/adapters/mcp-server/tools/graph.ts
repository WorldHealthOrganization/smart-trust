/**
 * The graph-aware MCP tools, extracted so they can be tested.
 *
 * They began life inside `server.ts`'s `executeTool` — a nested function in a
 * request handler, reachable only by driving the whole server. That left the
 * wiring between a tool declaration and its implementation covered by nothing
 * but `tsc`, which is precisely where the last two defects in this work turned
 * out to be hiding: a placeholder `@id` that collided twelve blocks, and a
 * `paths` object that never carried the companions the type system had learned
 * about. Both typechecked.
 *
 * Everything here is a pure function of the index plus the tool input, so a
 * test can call it the way the server does.
 *
 * @module adapters/mcp-server/tools/graph
 */

import {
  loadGraphIndex,
  searchGraph,
  neighbors,
  graphStats,
  type GraphIndex,
} from "../../../pipeline/graph-index.ts";
import { GRAPH_EDGE_TERMS, type GraphEdgeTerm } from "../../../schemas/kg/jsonld.ts";
import { graphSearch, formatPath } from "../../../pipeline/graph-search.ts";

/** Tool names this module owns. */
export const GRAPH_TOOL_NAMES = [
  "search_graph",
  "get_neighbors",
  "get_graph_stats",
  "corpus_search",
] as const;
export type GraphToolName = (typeof GRAPH_TOOL_NAMES)[number];

export function isGraphTool(name: string): name is GraphToolName {
  return (GRAPH_TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * Cached index over `content/` and `library/`.
 *
 * Built lazily and reused: a walk of every `.jsonld` on each call would
 * dominate response time — measured at 29,780 nodes on the qou corpus. The
 * cache is therefore *stale by design* between edits, which is fine for these
 * read-only queries and wrong for anything reflecting an in-flight write, so
 * `get_graph_stats` takes an explicit `refresh` and any future write path must
 * call {@link invalidateGraphIndex}.
 */
let cache: GraphIndex | undefined;
let cachedRoots: string | undefined;

export function getGraphIndex(
  roots: Array<{ name: string; dir: string }>,
  refresh = false,
): GraphIndex {
  const key = roots.map((r) => `${r.name}:${r.dir}`).join("|");
  if (refresh || !cache || cachedRoots !== key) {
    cache = loadGraphIndex(roots);
    cachedRoots = key;
  }
  return cache;
}

/** Drop the cached index. Call after anything writes a `.jsonld`. */
export function invalidateGraphIndex(): void {
  cache = undefined;
  cachedRoots = undefined;
}

/**
 * Run one graph tool and return its JSON string, exactly as the server does.
 *
 * Returns `undefined` for a name this module does not own, so the caller's
 * dispatch can fall through rather than this guessing.
 */
export function executeGraphTool(
  name: string,
  input: Record<string, unknown>,
  roots: Array<{ name: string; dir: string }>,
): string | undefined {
  if (!isGraphTool(name)) return undefined;

  switch (name) {
    case "search_graph": {
      const idx = getGraphIndex(roots);
      return JSON.stringify(
        searchGraph(idx, typeof input.query === "string" ? input.query : "", {
          provenance: typeof input.provenance === "string" ? input.provenance : undefined,
          searchText: input.searchText === true,
          limit: typeof input.limit === "number" ? input.limit : 20,
        }),
      );
    }

    case "get_neighbors": {
      const idx = getGraphIndex(roots);
      const raw = input.edges;
      // Silently dropping an unknown edge term would answer a narrower
      // question than was asked, so an unrecognised one is reported instead.
      const requested = Array.isArray(raw) ? raw.filter((e): e is string => typeof e === "string") : undefined;
      const unknown = requested?.filter(
        (e) => !(GRAPH_EDGE_TERMS as readonly string[]).includes(e),
      );
      if (unknown?.length) {
        return JSON.stringify({
          error: `Unknown edge term(s): ${unknown.join(", ")}`,
          known: GRAPH_EDGE_TERMS,
        });
      }
      return JSON.stringify(
        neighbors(idx, typeof input.id === "string" ? input.id : "", {
          direction:
            input.direction === "in" || input.direction === "both" || input.direction === "out"
              ? input.direction
              : undefined,
          hops: typeof input.hops === "number" ? input.hops : undefined,
          edges: requested as GraphEdgeTerm[] | undefined,
        }),
      );
    }

    case "get_graph_stats":
      return JSON.stringify(graphStats(getGraphIndex(roots, input.refresh === true)));

    // `search_graph` and `get_neighbors` are disjoint: one answers "which nodes
    // contain these words", the other "what is adjacent to this node". Using
    // them together means searching, copying an id, walking, and repeating per
    // hit — so in practice the graph contributes nothing to a search, which is
    // the one thing it is uniquely able to do. This composes them: seed
    // lexically, expand structurally, and say which is which.
    case "corpus_search": {
      const idx = getGraphIndex(roots);
      const r = graphSearch(idx, typeof input.query === "string" ? input.query : "", {
        hops: typeof input.hops === "number" ? input.hops : 1,
        direction:
          input.direction === "in" || input.direction === "out" || input.direction === "both"
            ? input.direction
            : "both",
        provenance: typeof input.provenance === "string" ? input.provenance : undefined,
        searchText: input.searchText === true,
        limit: typeof input.limit === "number" ? input.limit : 20,
      });
      // The reason is flattened to a string here rather than left structured:
      // it is what a reader has to act on, and `~uses` vs `uses` — traversed
      // backwards vs forwards — is the difference between "this depends on the
      // seed" and "the seed depends on this".
      return JSON.stringify({
        query: r.query,
        summary: r.summary,
        emptyRoots: r.emptyRoots,
        dangling: r.dangling.slice(0, 20),
        truncated: r.truncated,
        hits: r.hits.map((h) => ({
          id: h.id,
          label: h.label,
          title: h.title,
          kind: h.kind,
          provenance: h.provenance,
          why:
            h.reason.via === "match"
              ? `match:${h.reason.matchedIn}`
              : `${h.reason.hops}hop via ${formatPath(h.reason.path) || "?"}` +
                ` from ${h.reason.seed}`,
        })),
      });
    }
  }
}
