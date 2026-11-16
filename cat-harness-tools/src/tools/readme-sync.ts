/**
 * `readme_sync` — refresh the generated sections of a folio's README.
 *
 * Generic, not adapter-scoped: a document folio has chapters, simulators and
 * workflows to list for the same reason a paper folio does, and the block
 * kinds never enter into it. The Lean sections simply never appear in a
 * document folio's README, because a folio opts into a section by carrying
 * its markers.
 *
 * The work lives in `pipeline/readme-sections.ts`; this is the MCP
 * surface over it, so an agent can refresh the README after adding a chapter
 * without knowing the script's path or flag spelling.
 *
 * @module src/tools/readme-sync
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runReadmeSync, SECTIONS } from "../../pipeline/readme-sections.ts";

export function registerReadmeSyncTools(server: McpServer): void {
  const markers = SECTIONS.map((s) => s.marker);

  server.tool(
    "readme_sync",
    "Refresh the generated sections of the folio's README. Each section is " +
      "written ONLY where the README already carries its marker pair " +
      "(`<!-- folio:toc:begin -->` … `<!-- folio:toc:end -->`), so nothing " +
      "outside a marked region is ever touched and a folio opts in per " +
      `section. Available: ${markers.join(", ")}. The contents table lists ` +
      "every paper in the folio and verifies each PDF link against the " +
      "publish ref, so an unpublished chapter renders an em dash instead of a " +
      "dead link.",
    {
      check: z
        .boolean()
        .default(false)
        .describe("Report whether any section is stale without writing. Fails when one is."),
      only: z
        .array(z.enum(markers as [string, ...string[]]))
        .optional()
        .describe("Refresh just these sections. Omit for every marker the README carries."),
      link_style: z
        .enum(["blob", "pages", "raw"])
        .optional()
        .describe(
          "Override `<name>.config.json`'s `readme.linkStyle`. 'blob' " +
            "(github.com/<owner>/<repo>/blob/<ref>/<path>) is the only one that " +
            "resolves for a PRIVATE repository — GitHub Pages needs a public site, " +
            "and raw.githubusercontent.com 404s without a token.",
        ),
      fetch: z
        .boolean()
        .default(false)
        .describe(
          "Fetch the publish ref first. Needed in a shallow clone, which has no " +
            "gh-pages and would otherwise render every PDF cell as an em dash.",
        ),
      dir: z
        .string()
        .optional()
        .describe("Folio root. Defaults to the repo the server was pointed at."),
    },
    async ({ check, only, link_style, fetch, dir }) => {
      try {
        const result = await runReadmeSync({
          root: dir,
          check,
          only,
          fetch,
          linkStyle: link_style,
        });
        return {
          content: [{ type: "text" as const, text: result.text }],
          isError: result.exitCode !== 0,
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `readme_sync failed: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
