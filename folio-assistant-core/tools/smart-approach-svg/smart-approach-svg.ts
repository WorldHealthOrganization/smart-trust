import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "smart-approach-svg",
    title: "WHO SMART Guidelines approach chart",
    description:
      "Draw the WHO SMART Guidelines approach chart (knowledge layers L1–L5 with their products, and their country adaptations, between the research, localisation and impact bands) as SVG from `smart-guidelines-approach-figure/v1` data on a who-iris library entry, such as the product catalogue handbook's Fig. 5. Every label comes from the data.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/smart-approach-svg.ts" },
    io: {
      inputs: [
        { name: "figure", schema: t("RepoPath"), required: true, arg: { positional: 0 }, description: "A smart-guidelines-approach-figure/v1 file." },
        { name: "out", schema: t("RepoPath"), required: false, arg: { flag: "--out" }, description: "Where to write the SVG; stdout when absent." },
      ],
      outputs: [
        { name: "svg", schema: t("RepoPath"), description: "The chart, with text as SVG text, one `<g id=\"cell-l<n>-<name>\">` per layer cell." },
      ],
    },
    satisfies: ["figure-rebuild"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when: "A folio reprints the SMART Guidelines approach chart and should draw it from the one transcription instead of a picture.",
      limits: "Draws the three-band, two-row layout only. Whether the transcription matches the published figure is a person's review of the data.",
      cost: "Reads one JSON file; no network.",
    },
  }),
);
