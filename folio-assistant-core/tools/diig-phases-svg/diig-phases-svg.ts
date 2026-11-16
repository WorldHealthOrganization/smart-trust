import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "diig-phases-svg",
    title: "DIIG phases, steps and resources chart",
    description:
      "Draw a DIIG \"phases, steps and resources\" chart as SVG from `diig-phases-figure/v1` data on a who-iris library entry (DIIG Fig. 1.1.1, or a handbook's republished version such as the product catalogue handbook's Fig. 4), or from a folio's `diig-phases-adaptation/v1` file that adds its own tiles and marks itself \"(this document)\". Every label comes from the data; tiles link to their library entry or glossary concept.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/diig-phases-svg.ts" },
    io: {
      inputs: [
        { name: "figure-or-adaptation", schema: t("RepoPath"), required: true, arg: { positional: 0 }, description: "A diig-phases-figure/v1 file, or a diig-phases-adaptation/v1 file whose `adapts` is a repository-root path to one." },
        { name: "out", schema: t("RepoPath"), required: false, arg: { flag: "--out" }, description: "Where to write the SVG; stdout when absent." },
      ],
      outputs: [
        { name: "svg", schema: t("RepoPath"), description: "The chart, with text as SVG text, one `<g id=\"tile-<resource>\">` per tile." },
      ],
    },
    satisfies: ["figure-rebuild"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when: "A folio shows the DIIG phases chart (every Digital Transformation Handbook does) and should draw it from the one transcription instead of a picture or a hand-kept copy.",
      limits: "Draws the seven-row DIIG layout only. Whether the transcription matches the published figure is a person's review of the data.",
      cost: "Reads one or two JSON files; no network.",
    },
  }),
);
