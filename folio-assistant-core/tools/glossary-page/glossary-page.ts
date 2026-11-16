import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// The glossary page, as the Tool core's `glossary` VISUALISER is
// `renderedBy` (owner, 2026-10-09: "Need harness to declare visualizer is
// renderedBy"). `renders` is what it CAN draw; the harness declaration in
// `folio-assistant-core.json` says what it DOES, and where:
// `<base>/en/folio-assistant-core/glossary/` (under the page locale since
// 2026-10-16; the old address forwards there).
export default toolFactory((t) =>
  defineTool({
    id: "glossary-page",
    title: "Glossary page",
    description:
      "Render every declared glossary — authored SKOS schemes, the swimlane ledger and the terms extracted from knowledge-graph assets — as the glossary page and one page per asset type, at the route of the visualiser core declares for it.",
    install: { none: true },
    invoke: { shell: "bun run cat glossary:page" },
    io: {
      inputs: [
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Fail if a page is stale, instead of writing." },
        { name: "site", schema: t("RepoPath"), required: false, arg: { flag: "--site" }, description: "A site being built: write the pages at their declared route under it instead of under cat-harness's docs, as a repository's own site build does (`visualiser-writers.ts`)." },
        { name: "scope", schema: t("IdList"), required: false, arg: { flag: "--scope" }, description: "A scoped site build: the comma-separated instances whose pages this writer writes (the IG and the layer it lands on); every other instance's pages are linked on that layer's own site. Passed by the tools layer's `visualiser-writers.ts` (owner, 2026-11-08, Q-SZ-2 \"B\"). Absent: every instance." },
      ],
      outputs: [{ name: "pages", schema: t("RepoPath"), description: "The glossary pages, under the published site directory." }],
    },
    satisfies: ["graph-rendering"],
    renders: ["glossary"],
    requires: { runtime: ["bun"], network: false },
  }),
);
