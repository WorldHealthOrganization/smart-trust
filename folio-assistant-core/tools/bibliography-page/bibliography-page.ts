import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// The bibliography page, as the Tool core's `bibliography` VISUALISER is
// `renderedBy` (bean folio-assistant-63q4). Like the glossary: every
// reference in the checkout, per sub-graph, with its exports.
export default toolFactory((t) =>
  defineTool({
    id: "bibliography-page",
    title: "Bibliography page",
    description:
      "Render every reference in the checkout (each declared `references` directory's folio-reference/v1 nodes and each `catalogue` directory's Dublin Core records) as the bibliography page and one page per sub-graph, each with its BibTeX, CSL-JSON, RIS and Dublin Core JSON-LD exports and a per-reference export, at the route of the visualiser core declares for it.",
    install: { none: true },
    invoke: { shell: "bun run cat bibliography:page" },
    io: {
      inputs: [
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Fail if a page or export is stale, instead of writing." },
        { name: "site", schema: t("RepoPath"), required: false, arg: { flag: "--site" }, description: "A site being built: write the pages at their declared route under it instead of under cat-harness's docs, as a repository's own site build does (`visualiser-writers.ts`)." },
        { name: "scope", schema: t("IdList"), required: false, arg: { flag: "--scope" }, description: "A scoped site build: the comma-separated instances whose pages this writer writes (the IG and the layer it lands on); every other instance's pages are linked on that layer's own site. Passed by the tools layer's `visualiser-writers.ts` (owner, 2026-11-08, Q-SZ-2 \"B\"). Absent: every instance." },
      ],
      outputs: [{ name: "pages", schema: t("RepoPath"), description: "The bibliography pages and their exports, under the published site directory." }],
    },
    satisfies: ["graph-rendering"],
    renders: ["references", "catalogue"],
    requires: { runtime: ["bun"], network: false },
  }),
);
