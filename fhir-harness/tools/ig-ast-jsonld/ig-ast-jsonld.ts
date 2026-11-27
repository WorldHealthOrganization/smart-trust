import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-jsonld",
    title: "Export an IG AST as JSON-LD",
    description:
      "Write an AST as linked data against `fhir-harness/schemas/ig-ast.context.jsonld`: each resource a node identified by its canonical URL (`urn:fhir:<Type>/<id>` when it has none) and typed by its FHIR resource type, each dependency edge a link to its target, and the manifest's `authority: cache` and `provisional` list carried on the graph. The AST is validated against the Zod declaration the JSON Schemas are generated from before it is exported.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-ast.ts jsonld <ast> > ast.jsonld" },
    io: {
      inputs: [{ name: "ast", schema: t("FilesystemPath"), required: true }],
      outputs: [{ name: "jsonld", schema: t("FilesystemPath"), description: "JSON-LD on stdout." }],
    },
    satisfies: ["ig-ast-delta"],
    selection: {
      when: "Handing an AST to a consumer that reads linked data, or joining it with another graph by canonical URL.",
      limits: "Exports the manifest and edges, not each resource's full JSON; a consumer that needs the resource body reads its `file`. Still a cache: the export carries the provisional mark, it does not remove it.",
      cost: "Reads the manifest and dependency document once.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
