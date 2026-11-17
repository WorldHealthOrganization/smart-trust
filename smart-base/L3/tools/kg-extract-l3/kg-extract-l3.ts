import { defineTool, toolFactory } from "../../../platform/index.js";

export default toolFactory((t) =>
  defineTool({
    id: "kg-extract-l3",
    title: "FHIR IG → L3 knowledge graph",
    description:
      "Extract the L3 index from a SMART Guidelines IG's source tree (`smart-base/L3/schemas/extract-l3.ts`, ported from WHO smart-kg `tools/extract-l3.mjs`): one thin node per FHIR artefact (PlanDefinition, ActivityDefinition, Library, Measure, Questionnaire, StructureMap/Definition, ValueSet, CodeSystem, ConceptMap, ActorDefinition, Requirements, CQL) read from FSH, FML and JSON with RuleSets expanded, the real `uses` and `citesSource` canonical references, and the `implementedBy` edges that tie each artefact to the L2 component its Title names by the SOP's id convention. Coverage is reported across every artefact type.",
    install: { none: true },
    invoke: { shell: "npx --prefix smart-base/L1/schemas tsx smart-base/L3/schemas/extract-l3.ts" },
    io: {
      inputs: [
        { name: "ig", schema: t("RepoPath"), required: true, arg: { flag: "--ig" }, description: "The IG root (holds `sushi-config.yaml` and `input/`)." },
        { name: "out", schema: t("RepoPath"), required: false, arg: { flag: "--out" }, description: "Where the graph document goes; stdout when absent." },
      ],
      outputs: [{ name: "graph", schema: t("RepoPath"), description: "The L3 graph document; each node carries the SHA-256 of the file it came from." }],
    },
    satisfies: ["smart-base-tools"],
    selection: {
      when: "A built or source IG's FHIR artefacts are to be indexed as the L3 subgraph and tied back to the L2 components and L1 recommendations they implement.",
      limits:
        "Reads the FSH/FML/JSON source, not a built package; the L2 joins are the SOP's Title-and-id conventions (no back-pointer extension exists), so they are recorded unresolved with the rule that matched them. Only artefact types with committed instances are modelled; ExampleScenario, TestPlan and TestScript are reported absent.",
      cost: "Seconds, no network.",
    },
  }),
);
