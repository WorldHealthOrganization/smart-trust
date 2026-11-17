/**
 * `nquads_query` — Universal W3C N-Quads and named SPARQL query engine.
 *
 * Implements the `named-query-execution` skill and conforms to
 * `schemas/kg/nquads-distribution.ts`:
 * - Executes pre-compiled, audited named SPARQL queries over partitioned N-Quads distributions.
 * - Enforces Graph Availability Guard to prevent silent partial query results.
 * - Safely binds parameters without SPARQL injection risk.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolve } from "node:path";
import { executeNamedQuery } from "../../scripts/nquads-query.js";
import { realPathWithin } from "../core/safe-path.js";

export function registerNQuadsQueryTools(server: McpServer): void {
  server.tool(
    "nquads_query",
    "Execute an audited, named SPARQL 1.1 query over a partitioned W3C N-Quads dataset distribution (e.g. WHO-IRIS, Beans graph). " +
      "Guarantees graph completeness before evaluation and eliminates SPARQL injection through typed parameter bindings.",
    {
      dataset: z.string().describe("Path to dataset distribution directory or subgraph-manifest.json"),
      query_name: z.string().describe("Identifier of the named query declared in the distribution manifest"),
      bindings: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .default({})
        .describe("Dictionary of parameter values to bind (?$paramName)"),
      format: z.enum(["table", "json", "ids"]).default("table").describe("Output presentation format"),
      limit: z.number().int().positive().optional().describe("Maximum number of rows to return"),
    },
    async ({ dataset, query_name, bindings, format, limit }) => {
      // `dataset` is a tool argument: read only inside the working tree.
      if (realPathWithin(process.cwd(), resolve(process.cwd(), dataset)) === undefined) {
        return {
          content: [{ type: "text" as const, text: `Refused: dataset '${dataset}' is not an existing path inside the repository.` }],
          isError: true,
        };
      }
      try {
        const res = await executeNamedQuery({
          dataset,
          queryName: query_name,
          bindings: bindings as Record<string, string | number | boolean>,
          format,
          limit,
        });

        if (format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(res, null, 2) }] };
        } else if (format === "ids") {
          const ids = res.rows.map((r) => r.id ?? Object.values(r)[0]).join("\n");
          return { content: [{ type: "text" as const, text: ids }] };
        } else {
          let text = `Query: ${res.queryName} (${res.datasetIri})\n`;
          text += `Quads loaded: ${res.quadsLoaded} (${res.loadTimeMs}ms) | Execution time: ${res.executionTimeMs}ms | Rows: ${res.totalRows}\n\n`;
          if (res.rows.length === 0) {
            text += "(0 results returned)";
          } else {
            const cols = Object.keys(res.rows[0]);
            const header = cols.join(" | ");
            const sep = cols.map((c) => "-".repeat(Math.max(c.length, 6))).join("-|-");
            const body = res.rows.map((r) => cols.map((c) => r[c] ?? "").join(" | ")).join("\n");
            text += `${header}\n${sep}\n${body}`;
          }
          return { content: [{ type: "text" as const, text }] };
        }
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `nquads_query failed: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    },
  );
}
