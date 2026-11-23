/**
 * The knowledge-graph tools, served over MCP: `corpus_search`, `search_graph`,
 * `get_neighbors` and `get_graph_stats`.
 *
 * ## Why this module exists
 *
 * The handlers already existed in `adapters/mcp-server/tools/graph.ts`, but the
 * only thing that called them was the viewer server's embedded chat agent, in
 * its own `executeTool` switch. Neither MCP entry point (`src/index.ts` and
 * `adapters/mcp-server/server.ts`) put them on `tools/list`, so an agent session
 * with the MCP server connected got `Tool corpus_search not found`. That is
 * the tool a folio's pre-declaration check runs first. Measured on qou
 * 2026-10-12: 68 tools served, none of them graph tools (qou bean `qou-q261`).
 *
 * This is the registrar for those handlers. Their Tool nodes are declared in
 * `cat-harness/tools/mcp.ts` (`src/tools/graph.ts`) and are served by both
 * entry points through `registerServedToolGroups`. Nothing here re-implements
 * a handler. The MCP surface and the chat agent therefore answer from one
 * function, over the same roots.
 *
 * ## Roots
 *
 * The roots are resolved per call from the repository root the server was
 * started for. That is the declared `folio` directory plus every declared
 * `library`, falling back to `<root>/library`, so the result is the same as
 * the viewer server's `GRAPH_ROOTS`. A hit says which root it came from, so
 * two libraries are named apart rather than both called `library`.
 *
 * @module src/tools/graph
 */
import { join, relative } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { conventionalFolioDir, directoriesForGraph, folioDir } from "../../schemas/kg/cat-harness.js";

import { executeGraphTool } from "../../adapters/mcp-server/tools/graph.js";

/** The roots the graph index is built over, for a repository root. */
export function graphRootsFor(repoRoot: string): Array<{ name: string; dir: string }> {
  return graphRootsResolved(repoRoot).roots;
}

/**
 * {@link graphRootsFor}, plus why the convention was used when it was.
 *
 * The declaration can fail to read in a server process that has not loaded the
 * layer contributing one of its graph typologies. For example, qou.json declares
 * `lake-cache`, which is registered by a layer above this one. Failing the tool
 * for that would make the search unavailable over a directory it never reads.
 * The tool falls back to `<root>/folio` and `<root>/library` instead, and the
 * result says so (`rootsNote`), so the reader knows the roots are the
 * convention and not the declaration.
 */
export function graphRootsResolved(repoRoot: string): {
  roots: Array<{ name: string; dir: string }>;
  note?: string;
} {
  let folio: string;
  let libraries: string[] = [];
  let note: string | undefined;
  try {
    folio = folioDir(repoRoot);
    libraries = directoriesForGraph(repoRoot, "library");
  } catch (e) {
    // The convention, used only because the declaration could not be read,
    // and reported in `note`.
    folio = conventionalFolioDir(repoRoot);
    note =
      `the instance declaration could not be read (${e instanceof Error ? e.message.split(". ")[0] : String(e)}); ` +
      `searched the conventional folio/ and library/ instead`;
  }
  // declared-path-literal: the convention fallback, as in paths.ts LIBRARY_DIRS.
  if (libraries.length === 0) libraries = [join(repoRoot, "library")];
  return {
    roots: [
      { name: "folio", dir: folio },
      ...libraries.map((dir, i) => ({
        name: libraries.length === 1 ? "library" : `library:${relative(repoRoot, dir) || String(i)}`,
        dir,
      })),
    ],
    ...(note ? { note } : {}),
  };
}

const DIRECTION = z.enum(["out", "in", "both"]);
const PROVENANCE = z.enum(["authored", "ingested"]);

/**
 * Register the four graph tools. `repoRoot` is the second argument both
 * servers pass to every registrar. It defaults to the working directory so
 * that the capture script, which passes only the server, can still mount this.
 */
export function registerGraphTools(server: McpServer, repoRoot: string = process.cwd()): void {
  const run = (name: string, input: Record<string, unknown>) => {
    try {
      const { roots, note } = graphRootsResolved(repoRoot);
      const text = executeGraphTool(name, input, roots);
      if (text === undefined) throw new Error(`no graph handler named ${name}`);
      if (!note) return { content: [{ type: "text" as const, text }] };
      // Said in the answer, not only in a log: whoever reads the result has to
      // know the roots were the convention and not the declaration.
      const body = JSON.parse(text) as Record<string, unknown>;
      return { content: [{ type: "text" as const, text: JSON.stringify({ rootsNote: note, ...body }) }] };
    } catch (e) {
      return {
        content: [{ type: "text" as const, text: `${name} failed: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  };

  server.tool(
    "corpus_search",
    "Search the authored corpus AND the ingested library together, then follow the graph out from " +
      "what matched. Reach for this before declaring anything open, unproved or novel. A block one " +
      "`uses` hop from a match is found whatever words it uses, which a lexical search cannot do. " +
      "Each hit says whether it MATCHED or was REACHED, and by which edge. A `~` prefix means the " +
      "edge was traversed backwards, so that node depends on the seed. Counts are split authored " +
      "vs ingested: many ingested hits and no authored ones means cite it, not derive it. " +
      "`emptyRoots` names a root that exists but holds no graph nodes, which is what an " +
      "ungenerated .jsonld corpus looks like. Seeding is lexical, so query with a short phrase: a " +
      "long multi-word query that no node contains seeds nothing (`noSeeds: true`).",
    {
      query: z.string().min(1).describe("Words to seed on. A short phrase works best."),
      hops: z.number().int().min(0).max(4).optional().describe("Expansion depth (default 1). 0 is a plain lexical search."),
      direction: DIRECTION.optional().describe("'out' = what the seeds depend on; 'in' = what depends on them. Default both."),
      provenance: PROVENANCE.optional().describe("Restrict SEEDS to one population. Expansion still crosses both."),
      searchText: z.boolean().optional().describe("Also scan companion Markdown for seeds. Turn it on when a label/title search comes back empty."),
      limit: z.number().int().min(1).optional().describe("Seed cap before expansion (default 20)."),
    },
    async (input) => run("corpus_search", input),
  );

  server.tool(
    "search_graph",
    "Lexical search over the JSON-LD content graph, across authored blocks and ingested library " +
      "documents. No graph expansion; corpus_search composes this with a neighbour walk.",
    {
      query: z.string().min(1).describe("Substring to look for."),
      provenance: PROVENANCE.optional().describe("Restrict to one population. Omit to search both."),
      searchText: z.boolean().optional().describe("Also scan companion Markdown bodies, not just metadata. Slower."),
      limit: z.number().int().min(1).optional().describe("Max hits (default 20)."),
    },
    async (input) => run("search_graph", input),
  );

  server.tool(
    "get_neighbors",
    "Walk the content graph from one node. direction 'out' answers 'what must a reader have read " +
      "first?'; 'in' answers 'what breaks if this changes?'. Accepts an @id or an authored label " +
      "such as 'thm:main'. An unknown edge term is reported, never silently dropped.",
    {
      id: z.string().min(1).describe("Node @id or authored label."),
      direction: DIRECTION.optional().describe("Default out."),
      hops: z.number().int().min(1).max(6).optional().describe("Traversal depth (default 1)."),
      edges: z.array(z.string()).optional().describe("Restrict to these edge terms (uses, interprets, cites, contains, …). Omit for all."),
    },
    async (input) => run("get_neighbors", input),
  );

  server.tool(
    "get_graph_stats",
    "Node and edge counts for the content graph by provenance and kind, and whether each root " +
      "exists. Use it to tell 'nothing matched' from 'that population has not been built yet'.",
    {
      refresh: z.boolean().optional().describe("Rebuild the index from disk first."),
    },
    async (input) => run("get_graph_stats", input),
  );
}
