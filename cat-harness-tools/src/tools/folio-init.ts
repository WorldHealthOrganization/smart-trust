/**
 * `folio_init` — scaffold a new folio from within an agent session.
 *
 * This is the tool behind "initialize a new paper using litlfred/folio-assistant"
 * typed into a bare repository. It is a thin wrapper over
 * `scripts/init-folio.ts`, which holds the templates and the layout decisions;
 * everything here is about being callable safely from an agent.
 *
 * ## Registered as a generic tool, deliberately
 *
 * It sits beside `check_dependencies` and `skill_fetch` rather than in a
 * content adapter, because it runs *before* the folio has a content type. A
 * bare repo has no `harness.config.json`, so adapter selection falls back to
 * `paper` — and a tool that only the document adapter registered would be
 * unreachable in exactly the situation it exists for.
 *
 * @module folio-assistant/src/tools/folio-init
 */

import { folioDir } from "../../schemas/kg/cat-harness.js";
import { z } from "zod";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { writableWithin } from "../core/safe-path.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  initFolio,
  formatInitResult,
  isValidSlug,
  slugify,
  type InitFolioOptions,
} from "../../scripts/init-folio.js";
import { readEffectiveConfig } from "../../schemas/kg/harness-config.ts";

/**
 * Is this directory already a folio?
 *
 * Checked before writing anything. Re-running `folio_init` on a live folio is
 * a plausible mistake — an agent resuming in a fresh container, a user asking
 * twice — and while the scaffolder itself never overwrites without `force`,
 * an author deserves to be told they already have a folio rather than handed
 * a list of seventeen "already present" lines to interpret.
 */
function existingFolio(root: string): string | undefined {
  // Index first (bean `ymvt`): a layer configured by its
  // `index.config.json` entry is a folio as much as one with a legacy file.
  const cfg = readEffectiveConfig(root);
  if (cfg.from !== undefined && (cfg.state !== "absent" || cfg.via === "index")) return cfg.from;
  const folioRoot = folioDir(root);
  if (existsSync(folioRoot)) {
    const docs = readdirSync(folioRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(resolve(folioRoot, d.name, `${d.name}.ts`)))
      .map((d) => d.name);
    if (docs.length) return `folio/${docs[0]}/${docs[0]}.ts`;
  }
  return undefined;
}

export function registerFolioInitTools(server: McpServer): void {
  server.tool(
    "folio_init",
    "Scaffold a new folio (content repository) that uses folio-assistant: " +
    "folio/, uploads/, library/, the document + chapter + first block " +
    "manifests, <slug>.json and index.config.json (the instance config inline in its entry), the builder shim, AGENTS.md with CLAUDE.md " +
    "and GEMINI.md stubs, .mcp.json, and the beans work plan. Run this in an " +
    "empty repo before authoring anything. Pass content_type 'paper' for a " +
    "folio with Lean-backed mathematics, 'document' for prose (policy " +
    "guidance, standards, reports) with no Lean and no required TeX.",
    {
      title: z.string().min(1)
        .describe("Document title, e.g. 'Cold Chain Guidance'"),
      authors: z.array(z.string().min(1)).min(1)
        .describe("Author names. At least one — the manifest's `authors` may not be empty."),
      content_type: z.enum(["paper", "document"]).default("document")
        .describe(
          "'document': structured prose, no Lean, no TeX needed to publish. " +
          "'paper': a document PLUS blocks whose assertion is a formal claim, " +
          "backed by Lean 4 and rendered through LaTeX. Choose 'paper' only if " +
          "the folio will actually carry machine-checked mathematics — it adds " +
          "elan and texlive as dependencies.",
        ),
      slug: z.string().optional()
        .describe("Directory name under folio/. Derived from the title when omitted."),
      dir: z.string().default(".")
        .describe("Folio root to scaffold into, relative to the repo the server was pointed at."),
      link: z.enum(["submodule", "sibling", "remote"]).default("submodule")
        .describe(
          "How the folio reaches folio-assistant. 'submodule' pins it at " +
          "folio-assistant/ inside the folio, so a clone gets the exact platform " +
          "revision the content was authored against. 'sibling' uses a checkout " +
          "beside the folio — right when one platform copy serves several folios. " +
          "'remote' declares the platform layers as pinned source.remote mounts in index.config.json.",
        ),
      assistant_path: z.string().optional()
        .describe("Override the path to folio-assistant, relative to the folio root."),
      force: z.boolean().default(false)
        .describe("Overwrite files that already exist. Off by default — this never clobbers an author's AGENTS.md silently."),
      dry_run: z.boolean().default(false)
        .describe("Report what would be written without writing it."),
    },
    async ({ title, authors, content_type, slug, dir, link, assistant_path, force, dry_run }) => {
      const root = resolve(process.cwd(), dir);
      // `dir` is a tool argument: refuse a folio root outside the repository
      // rather than scaffold (AGENTS.md, .mcp.json, …) wherever it points.
      if (!writableWithin(process.cwd(), root)) {
        return {
          content: [{ type: "text" as const, text: `Error: dir '${dir}' is not inside the repository the server was pointed at.` }],
          isError: true,
        };
      }
      // `assistant_path` is written into generated code and config, so it is a
      // plain relative path or nothing: no quotes, `$`, backticks or spaces.
      if (assistant_path !== undefined && !/^[A-Za-z0-9._][A-Za-z0-9._/-]*$/.test(assistant_path)) {
        return {
          content: [{ type: "text" as const, text: `Error: assistant_path '${assistant_path}' must be a plain relative path.` }],
          isError: true,
        };
      }
      const resolvedSlug = slug ?? slugify(title);

      if (!isValidSlug(resolvedSlug)) {
        return {
          content: [{
            type: "text" as const,
            text:
              `Error: '${resolvedSlug}' is not a usable slug. It is a directory name, a ` +
              `TypeScript module name and a URL path at once, so it must be lowercase ` +
              `words joined by single hyphens — e.g. 'cold-chain-guidance'. ` +
              `Pass \`slug\` explicitly.`,
          }],
        };
      }

      const already = existingFolio(root);
      if (already && !force && !dry_run) {
        return {
          content: [{
            type: "text" as const,
            text:
              `This is already a folio — ${already} exists at ${root}.\n\n` +
              `folio_init scaffolds a new one and will not modify what is here. If you ` +
              `meant to add a document to this folio, add a directory under folio/ and ` +
              `a manifest named after it; if you meant to re-scaffold, pass force (it ` +
              `overwrites AGENTS.md, <slug>.json, index.config.json and the starter block). ` +
              `Pass dry_run to see exactly what would change.`,
          }],
        };
      }

      const options: InitFolioOptions = {
        targetDir: root,
        contentType: content_type,
        slug: resolvedSlug,
        title,
        authors,
        link,
        assistantPath: assistant_path,
        force,
        dryRun: dry_run,
      };

      try {
        const result = initFolio(options);
        const header = dry_run ? "DRY RUN — nothing was written.\n\n" : "";
        return { content: [{ type: "text" as const, text: header + formatInitResult(result, options) }] };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `folio_init failed: ${e instanceof Error ? e.message : String(e)}`,
          }],
        };
      }
    },
  );
}
