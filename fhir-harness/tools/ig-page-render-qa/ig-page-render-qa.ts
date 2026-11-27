import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-page-render-qa",
    title: "Scan every page of a built IG site in a headless browser for markup shown as text",
    description:
      "The checkout script `ig-site:page-render-qa`, the IG site build's last final step: it serves the built site locally, opens the root pages and the artefact pages (not the JSON views, mappings views or redirect stubs) in headless Chromium, waits for each to draw, and lists every text block that shows markdown as text (bold, list markers, links, images, code, headings, tables, HTML tags), code and preformatted text left out. It writes `assets/fhir-qa/page-render.json` and the script the QA report's \"Page scan\" panel draws it with. It reports and never fails the build: without a browser it writes why.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-page-render-qa.ts" },
    io: {
      inputs: [
        { name: "site", schema: t("RepoPath"), required: true, description: "The built site directory." },
        { name: "limit", schema: t("Count"), required: false, arg: { flag: "--limit" }, description: "Scan at most this many pages." },
        { name: "concurrency", schema: t("Count"), required: false, arg: { flag: "--concurrency" }, description: "Pages open at once; 4 by default." },
      ],
      outputs: [{ name: "findings", schema: t("Count"), description: "Text blocks that show markup as text." }],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "After an IG site is built, so the QA report shows what its pages show a reader.",
      limits: "Needs Playwright and Chromium; without them it records why and scans nothing. Pages that do not finish drawing in 15 s are listed as unfinished.",
      cost: "About 20 s for 200 pages.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
