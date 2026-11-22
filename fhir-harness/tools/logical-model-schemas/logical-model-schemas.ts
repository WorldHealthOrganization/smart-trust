import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// ── An IG's JSON surface ─────────────────────────────────────────────
//
// Moved down from the layer above (#1767, stage B′). Each turns ANY IG's
// published output into JSON Schema or JSON-LD, so — would an IG with no
// overlay need it? — they are this layer's, as the Library strippers
// above already are, and they satisfy `ig-build-pipeline` for the same
// reason. A skill of the layer above cannot be satisfied from here
// without an upward edge. The Python lives in the IG's own `input/scripts/`.
export default toolFactory((t) =>
  defineTool({
    id: "logical-model-schemas",
    title: "Logical models → JSON Schema",
    description: "A JSON Schema per logical model, from the logical models in the IG's AST.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-api-gen.ts --ast output-ast --out <sidecars> --site <site>" },
    io: {
      inputs: [{ name: "ast", schema: t("RepoPath"), required: true, description: "The IG's AST (`output-ast/`, with the build's `expansions.json`)." }],
      outputs: [{ name: "logicalModelSchemas", schema: t("RepoPath"), description: "`schemas/<stem>.schema.json`, one per logical model." }],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "An IG is to expose its logical models as an addressable JSON Schema surface.",
      limits: "It describes what the AST holds. A model the AST does not hold is not reported as missing.",
      cost: "Seconds; reads the AST.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
