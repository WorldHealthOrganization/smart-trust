import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "jsonld-vocabularies",
    title: "ValueSet expansions → JSON-LD",
    description: "JSON-LD vocabularies built from the ValueSet expansions in the IG's AST (`expansions.json`).",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-api-gen.ts --ast output-ast --out <sidecars> --site <site>" },
    io: {
      inputs: [{ name: "ast", schema: t("RepoPath"), required: true, description: "The IG's AST (`output-ast/`, with the build's `expansions.json`)." }],
      outputs: [{ name: "vocabularies", schema: t("RepoPath"), description: "`*.jsonld` at the published root." }],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "The terminology is to be reachable as linked data rather than only as FHIR.",
      limits:
        "Depends on expansion, and so on the terminology server the build was given. An IG built against a dead or restricted `tx` produces fewer vocabularies and fails nothing: the step warns and continues. A thin output is not evidence of a thin ValueSet; check the expansion first.",
      cost: "Seconds locally; the expansion it depends on is the expensive part and happens in the Publisher run.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
