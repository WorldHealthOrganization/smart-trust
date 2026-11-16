/**
 * `readme_audit` — check that a folio README's links still resolve.
 *
 * Companion to `readme_sync`, and deliberately the other half of it: sync owns
 * the generated regions and writes them; audit owns everything the author
 * wrote and never writes anything. Between them, no link in the file is
 * unaccounted for.
 *
 * @module src/tools/readme-audit
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runReadmeAudit } from "../../pipeline/readme-links.ts";

export function registerReadmeAuditTools(server: McpServer): void {
  server.tool(
    "readme_audit",
    "Verify every Markdown link in the folio's README (or another file) still " +
      "resolves: relative paths against the working tree, links naming one of " +
      "the repo's own refs against a real listing of that ref, and GitHub " +
      "Pages URLs against the publish ref the site is served from. External " +
      "URLs, in-page anchors, and refs this checkout cannot read are reported " +
      "as NOT CHECKED rather than dead. Read-only — it never edits the file.",
    {
      file: z
        .string()
        .optional()
        .describe("Markdown file to audit. Defaults to the folio's README.md."),
      fetch: z
        .boolean()
        .default(false)
        .describe(
          "Fetch a repo ref that is missing locally, so its links can be checked " +
            "instead of counted as unchecked. Needed in a shallow clone.",
        ),
      dir: z
        .string()
        .optional()
        .describe("Folio root. Defaults to the repo the server was pointed at."),
    },
    async ({ file, fetch, dir }) => {
      try {
        const result = runReadmeAudit({ root: dir, file, fetch });
        return {
          content: [{ type: "text" as const, text: result.text }],
          isError: result.exitCode !== 0,
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `readme_audit failed: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
