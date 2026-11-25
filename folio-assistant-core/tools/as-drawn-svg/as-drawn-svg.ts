import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "as-drawn-svg",
    title: "Figure redrawn as drawn, from its PDF vector layer",
    description:
      "Draw a figure as SVG from `as-drawn-figure/v1` data: the drawing `scripts/pdf-as-drawn.py` transcribes from the source PDF's vector layer (every path, clip, text run and image in the L1 figure region, at its printed position, colour and size). The SVG keeps the original's layout and style; labels are SVG text held to their printed width, and labels that name a glossary concept link to it.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/as-drawn-svg.ts" },
    io: {
      inputs: [
        { name: "data", schema: t("RepoPath"), required: true, arg: { positional: 0 }, description: "An as-drawn-figure/v1 file, or a directory of them." },
        { name: "out-dir", schema: t("RepoPath"), required: true, arg: { flag: "--out-dir" }, description: "Where to write as-drawn-fig-<N>.svg." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Write nothing; fail when data is invalid or an SVG is stale." },
      ],
      outputs: [
        { name: "svg", schema: t("RepoPath"), description: "One SVG per data file, named after the figure labels it draws." },
      ],
    },
    satisfies: ["figure-rebuild"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when: "A folio's L1 figure has no model route (ArchiMate, BPMN, DMN, FHIR, a figure-data family) or needs an as-drawn companion to its model view, and should be an SVG that looks like the printed figure rather than a PNG crop.",
      limits: "Transcribes; does not interpret. Soft-masked paints (drop shadows) are left out and counted in `omitted`. Fonts fall back to Source Sans or Arial, held to the printed width.",
      cost: "Reads JSON files; no network.",
    },
  }),
);
