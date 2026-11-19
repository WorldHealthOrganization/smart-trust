import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-list",
    title: "Summarise one IG AST",
    description:
      "Counts per resource type, edges in total and resolved inside the IG, edges by origin (upstream's DependencyAnalyser or ast-export's LogicEdges), whether the AST is mixed-provenance and how many resources each revision built, and what the manifest declares provisional.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-ast.ts list <ast>" },
    io: {
      inputs: [{ name: "ast", schema: t("FilesystemPath"), required: true }],
      outputs: [{ name: "resources", schema: t("Count") }],
    },
    satisfies: ["ig-ast-delta"],
    selection: {
      when: "Before diffing or rendering, to see what an AST holds; after a merge, to see how mixed it is.",
      limits: "Counts only; it does not check the AST against the IG's inputs (`ig-ast-validity` does).",
      cost: "Reads the manifest and dependency document once.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
