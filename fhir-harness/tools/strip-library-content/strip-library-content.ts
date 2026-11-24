import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "strip-library-content",
    title: "Replace inline Library content with URL references",
    description:
      "Replace inline CQL/ELM in `Library` resources with a URL reference to the published copy.",
    install: { none: true },
    invoke: { shell: "python3 fhir-harness/scripts/library-strip/strip_library_content.py <igOutput>" },
    io: {
      inputs: [{ name: "igOutput", schema: t("RepoPath"), required: true }],
      outputs: [
        { name: "rewritten", schema: t("Count") },
        { name: "references", schema: t("Url"), description: "The base the replacement references resolve against. If it is wrong, every rewritten Library points at nothing and the resource still validates." },
      ],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "Same condition as `strip-library-binaries`; upstream runs the two as adjacent steps.",
      limits:
        "A reference is only as good as what serves it. This trades a self-contained resource for a dereferenceable one, which is the right trade for a published IG and the WRONG one for an air-gapped consumer — `network-reach` is a declared topology axis here, and this tool is not safe under `air-gapped` without the referenced copies travelling too.",
      cost: "Seconds, and a permanent dependency on the publication base staying served.",
    },
    requires: { runtime: ["python3"], network: false },
  }),
);
