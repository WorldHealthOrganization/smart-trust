/**
 * `stakeholder_map` — CRDM phase 1's mechanical half, as an MCP tool.
 *
 * Agent-generic, not adapter-scoped: skills, roles and BPMN lanes exist in
 * every folio regardless of content type, and a feature request arrives
 * before anyone has decided which adapter it touches.
 *
 * The reasoning about what this reads — and why it does NOT name people —
 * is in src/impact/stakeholder-map.ts.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { stakeholderMap, formatStakeholderMap } from "../impact/stakeholder-map.js";

export function registerStakeholderTools(server: McpServer, repoRoot: string): void {
  server.tool(
    "stakeholder_map",
    "Given the paths a proposed change touches, report which skills change, " +
      "which roles those skills declare, and which BPMN process lanes — i.e. " +
      "which accountable actors — reach work that uses them. Use in CRDM " +
      "phase 1 to sharpen the stakeholder question before putting it to the " +
      "BA. It deliberately does NOT name people: the process says the agent " +
      "does not guess who is affected, and this respects that.",
    {
      paths: z
        .array(z.string())
        .describe("Repo-relative paths the change touches, as `git diff --name-only` prints them."),
    },
    async ({ paths }) => {
      if (!paths || paths.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No paths given, so nothing is mapped. Pass the paths the change touches.",
            },
          ],
        };
      }
      const map = await stakeholderMap(repoRoot, paths);
      return { content: [{ type: "text" as const, text: formatStakeholderMap(map) }] };
    },
  );
}
