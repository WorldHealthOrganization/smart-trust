/**
 * Bibliography / reference mechanical tools for the paper adapter.
 *
 * Read-only checks (metadata QA, cross-references) plus a bibtex export
 * (transform). Wraps content/pipeline bibliography scripts via {@link runPipeline}.
 *
 * Tools:
 *   bib_validate        — bibliography metadata QA (offline cross-check by default;
 *                         opt into network modes: doi / crossref / arxiv / pandoc)
 *   references_validate — validate \cite ↔ bibliography reference integrity
 *   bib_export          — export the bibliography to a .bib file (transform)
 *
 * @module adapters/paper/tools/bib
 */

import { writableWithin } from "@litlfred/cat-harness-tools/src/core/safe-path.js";
import { z } from "zod";
import { join, resolve } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../paths.js";
import { runPipeline, asToolText, refuseTool } from "./_pipeline.js";

const BIB_MODES = ["cross-check", "doi", "crossref", "arxiv", "pandoc", "all"] as const;

export function registerBibTools(server: McpServer): void {
  // ── bib_validate ─────────────────────────────────────────────
  server.tool(
    "bib_validate",
    "Bibliography metadata QA. Offline `cross-check` by default; opt into network " +
      "modes (doi / crossref / arxiv / pandoc, or all). Read-only.",
    {
      modes: z
        .array(z.enum(BIB_MODES))
        .default(["cross-check"])
        .describe("Checks to run. Network modes need outbound access."),
    },
    async ({ modes }) => {
      const args = (modes.length ? modes : ["cross-check"]).map((m) => `--${m}`);
      return asToolText("bib_validate", runPipeline("validate-bib", args));
    },
  );

  // ── references_validate ──────────────────────────────────────
  server.tool(
    "references_validate",
    "Validate citation ↔ bibliography integrity (every \\cite resolves; no orphan " +
      "entries). Read-only; set strict=true to treat warnings as failures.",
    {
      strict: z.boolean().default(false).describe("Exit non-zero on warnings"),
    },
    async ({ strict }) => {
      const args = strict ? ["--strict"] : [];
      return asToolText("references_validate", runPipeline("validate-references", args));
    },
  );

  // ── bib_export ───────────────────────────────────────────────
  server.tool(
    "bib_export",
    "Export the bibliography to a BibTeX (.bib) file (transform/publication step).",
    {
      out: z.string().optional().describe("Output path (default: build/references.bib)"),
    },
    async ({ out }) => {
      const root = get.REPO_ROOT();
      if (out !== undefined && out.includes("\0")) {
        return refuseTool("bib_export", "output path contains NUL byte");
      }
      const target = out !== undefined ? resolve(root, out) : join(root, "build", "references.bib");
      if (!writableWithin(root, target)) {
        return refuseTool("bib_export", `output path '${out}' escapes repository root`);
      }
      return asToolText("bib_export", runPipeline("export-bibtex", ["--out", target]));
    },
  );
}
