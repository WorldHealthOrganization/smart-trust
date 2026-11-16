import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "valueset-schemas",
    title: "ValueSets → JSON Schema",
    description:
      "A JSON Schema per ValueSet, plus the enumeration-response schemas published at the IG root.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-api-gen.ts --ast output-ast --out <sidecars> --site <site>" },
    io: {
      inputs: [{ name: "ast", schema: t("RepoPath"), required: true, description: "The IG's AST (`output-ast/`, with the build's `expansions.json`)." }],
      // Named for what it is (#1168, B9a): as `schemas` it matched
      // `logical-model-schemas` port for port, and the two would derive as
      // alternatives when they write different schema families.
      outputs: [{ name: "valueSetSchemas", schema: t("RepoPath"), description: "One schema per ValueSet, plus the enumeration-response schemas at the IG root." }],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "An IG is to expose its terminology as JSON Schema.",
      limits:
        "The root `ValueSets.schema.json` it writes is a SCHEMA describing an enumeration response, carrying an `example` that holds the list. It is not an index instance: no FHIR IG publishes an artefact-index instance.",
      cost: "Seconds; output size scales with the IG's ValueSets.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
