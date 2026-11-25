/**
 * `render_order` — the repository's renders, in the order their dependencies
 * imply.
 *
 * The MCP surface over `scripts/render-pipeline.ts`, which is itself the one
 * caller of the generic flattener in `schemas/kg/dependency-order.ts`. An agent
 * asking "what runs before what, and what happens if one fails" gets an
 * answer it can read rather than a YAML file it has to interpret.
 *
 * Generic, not adapter-scoped: the order is a property of the harness
 * instance's declarations, and no block kind enters into it.
 *
 * @module src/tools/render-order
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { instanceRootFor, repoRootFor } from "../../schemas/kg/cat-harness.js";
import { runPipeline } from "../../scripts/render-pipeline.js";

export function registerRenderOrderTools(server: McpServer): void {
  server.tool(
    "render_order",
    "Flatten this repository's renders into the order their `needs` imply, " +
      "and run them unless `dry_run`. Stage 1 — the current declared state as " +
      "json/jsonld, then the README derived from it — is FATAL: a graph that " +
      "does not render is an unknown build, not a degraded one, and a README " +
      "generated from a half-read graph states a wrong fact in the file a " +
      "reader opens first. The dynamic renderers skip and log instead, and a " +
      "failure skips what NEEDED it rather than what merely follows it. A " +
      "cycle or a missing dependency yields no order at all.",
    {
      dry_run: z
        .boolean()
        .default(false)
        .describe("Print the order and each step's failure policy; run nothing."),
    },
    async ({ dry_run }) => {
      try {
        const repoRoot = repoRootFor(instanceRootFor(import.meta.dir));
        const report = runPipeline(repoRoot, { dryRun: dry_run });
        return {
          content: [{ type: "text" as const, text: report.text }],
          isError: report.exitCode !== 0,
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `render_order failed: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
