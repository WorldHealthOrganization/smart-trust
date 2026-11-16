import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "strip-library-binaries",
    title: "Strip binary payloads from Library resources",
    description:
      "Remove base64 `content.data` from published `Library` resources, so an IG embedding compiled CQL does not ship the bytes twice.",
    install: { none: true },
    invoke: { shell: "python3 fhir-harness/scripts/library-strip/strip_library_binaries.py <igOutput>" },
    io: {
      inputs: [
        { name: "igOutput", schema: t("RepoPath"), required: true, description: "The Publisher's `output/`. It runs AFTER the build — the resources it edits are published ones." },
      ],
      outputs: [
        { name: "stripped", schema: t("Count"), description: "How many resources were altered. Zero is a determined empty when the output directory was found; a missing output directory is a different state." },
      ],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when:
        "The IG depends on `hl7.fhir.uv.cql` or otherwise embeds compiled artefacts in `Library.content`: a property of the dependency, not of any one IG.",
      limits:
        "It edits PUBLISHED output, so what it removes is gone from the deployed artefact but still present in whatever the Publisher validated. The two are no longer byte-identical, which matters to any fixity check pointed at the deployed copy.",
      cost: "Seconds. Deferring it costs the >100MB purge later in the same pipeline, which deletes whole files rather than payloads.",
    },
    requires: { runtime: ["python3"], network: false },
  }),
);
