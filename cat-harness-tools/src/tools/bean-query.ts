/**
 * Oxigraph-Powered Bean Query MCP Tool.
 *
 * Exposes fast in-memory SPARQL 1.1 and named queries over the beans knowledge graph
 * to MCP-connected agents.
 *
 * @module cat-harness-tools/src/tools/bean-query
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildBeanStore,
  queryBeanStore,
  formatTable,
  NAMED_QUERIES
} from "../../scripts/beans-query.ts";
import { BeanQueryRowsSchema } from "../../schemas/tools/store-tool-results.ts";

export function registerBeanQueryTool(server: McpServer, repoRoot: string): void {
  server.tool(
    "bean_query",
    "Query the beans knowledge graph using named graph analytics or arbitrary SPARQL 1.1. " +
      "Available named queries: " + Object.keys(NAMED_QUERIES).join(", "),
    {
      named: z
        .string()
        .optional()
        .describe(
          `Pre-defined named query: ${Object.keys(NAMED_QUERIES).join(", ")}`
        ),
      sparql: z
        .string()
        .optional()
        .describe("Arbitrary SPARQL 1.1 SELECT query over the bean store"),
      format: z
        .enum(["table", "json", "ids"])
        .default("table")
        .describe("Output format: table, json, or ids")
    },
    async ({ named, sparql, format }) => {
      let queryText = sparql;
      if (named) {
        const nq = NAMED_QUERIES[named];
        if (!nq) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown named query: "${named}". Available queries: ${Object.keys(NAMED_QUERIES).join(", ")}`
              }
            ],
            isError: true
          };
        }
        queryText = nq.sparql;
      }

      if (!queryText) {
        queryText = NAMED_QUERIES.safe_drain_candidates!.sparql;
        named = "safe_drain_candidates";
      }

      try {
        const t0 = performance.now();
        const { store, beans, quadsCount } = buildBeanStore(repoRoot);
        const loadMs = (performance.now() - t0).toFixed(1);

        const t1 = performance.now();
        const results = queryBeanStore(store, queryText);
        const queryMs = (performance.now() - t1).toFixed(1);

        let output = "";
        if (format === "json") {
          output = JSON.stringify(results, null, 2);
        } else if (format === "ids") {
          output = results.map(r => r.id ?? Object.values(r)[0]).join("\n");
        } else {
          output = [
            named ? `**Named Query**: \`${named}\` (${NAMED_QUERIES[named]?.description})` : `**Custom SPARQL Query**`,
            `*Loaded ${beans.length} beans (${quadsCount} quads) in ${loadMs}ms; query executed in ${queryMs}ms. Results: ${results.length}*\n`,
            "```",
            formatTable(results),
            "```"
          ].join("\n");
        }

        // The rows as data too (cat-harness-tools#1259, group 1): a caller
        // checks `structuredContent.rows` against `BeanQueryRows` whatever
        // text format it asked for.
        return {
          content: [
            {
              type: "text" as const,
              text: output
            }
          ],
          structuredContent: { rows: BeanQueryRowsSchema.parse(results) }
        };
      } catch (err: unknown) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error executing bean query: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
