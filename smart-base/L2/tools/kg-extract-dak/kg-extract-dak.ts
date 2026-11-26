import { defineTool, toolFactory } from "../../../platform/index.js";

export default toolFactory((t) =>
  defineTool({
    id: "kg-extract-dak",
    title: "dak.json + FSH tree → L2 DAK component graph",
    description:
      "Extract the DAK component layer (L2) from a smart-base-shaped IG (`smart-base/L2/schemas/extract-dak.ts`, ported from WHO smart-kg `tools/extract-dak.mjs`): a `dak` node from dak.json, a `persona` node per ActorDefinition, a `functional`/`non-functional-requirement` node per requirement instance with its `requirement-statement`s, the `hasComponent`/`hasStatement` edges, and the `fulfilledBy` edges that resolve each requirement's `actor = Canonical(...)` against a persona's instance id. Coverage is reported across all nine DAK components, including the empty ones, and files present with no component declaring them are listed. Distinct from the existing `extract-dak` tool (WHO's spreadsheet extractor).",
    install: { none: true },
    invoke: { shell: "npx --prefix smart-base/L1/schemas tsx smart-base/L2/schemas/extract-dak.ts" },
    io: {
      inputs: [
        { name: "dak", schema: t("RepoPath"), required: true, arg: { flag: "--dak" }, description: "The dak.json with the kit's metadata (canonicalUrl, title, version)." },
        { name: "fsh", schema: t("RepoPath"), required: true, arg: { flag: "--fsh" }, description: "The FSH instance tree (e.g. `input/fsh`)." },
        { name: "bpmnDir", schema: t("RepoPath"), required: false, arg: { flag: "--bpmn-dir" }, description: "A BPMN directory; its files are listed as business-process orphans when no component declares them." },
        { name: "dmnDir", schema: t("RepoPath"), required: false, arg: { flag: "--dmn-dir" }, description: "A DMN directory; its files are listed as decision-logic orphans when no component declares them." },
        { name: "out", schema: t("RepoPath"), required: false, arg: { flag: "--out" }, description: "Where the graph document goes; stdout when absent." },
      ],
      outputs: [{ name: "graph", schema: t("RepoPath"), description: "The L2 DAK component graph document, with coverage across all nine components on stderr." }],
    },
    satisfies: ["smart-base-tools"],
    selection: {
      when: "A DAK's component layer is to be read into the knowledge graph from dak.json and the committed FSH instances, with the gaps (components with no instance, files no component declares) made visible.",
      limits:
        "Reads the FSH instance tree, not the DAK spreadsheets; it covers personas and requirements, the components the estate commits as instances. Kit membership is inferred from presence in the input tree, since dak.json declares no component arrays. The `fulfilledBy` join resolves by canonical reference and does not depend on a display title.",
      cost: "Seconds, no network.",
    },
  }),
);
