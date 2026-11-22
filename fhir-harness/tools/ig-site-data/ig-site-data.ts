import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-site-data",
    title: "Populate site.data.fhir for a just-the-docs IG render",
    description:
      "Write the IG Publisher's Jekyll variables (`site.data.fhir.ig.*`, `packageId`, `canonical`) for ONE implementation guide, from `sushi-config.yaml` or a published IG's `fhir-artifact-index`, so pages written for the Publisher render on just-the-docs unchanged. fhir-harness declares `site.data` as a pass-through Liquid prefix; this is what Jekyll then reads.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-site-data.ts" },
    io: {
      inputs: [
        { name: "ig", schema: t("RepoPath"), required: true, description: "The IG root: holds `sushi-config.yaml`, or `fhir-artifact-index/index.json` for a published IG." },
        { name: "out", schema: t("RepoPath"), required: true, description: "`<site>/_data/fhir.json` — Jekyll has one `_data/`, so one IG per site, as under the Publisher." },
        { name: "check", schema: t("Flag"), required: false, description: "Write nothing; exit 1 when the file is stale." },
      ],
      outputs: [
        { name: "written", schema: t("Count"), description: "Fields written, each from a named source." },
        { name: "undetermined", schema: t("Count"), description: "Fields a Publisher build would have that no source here carries. LISTED, never written as empty strings, because Jekyll prints an empty string and an absent value identically." },
      ],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "Rendering an IG's pages through just-the-docs instead of, or beside, the IG Publisher (`ig-publisher-reduction` P0).",
      limits:
        "Only the ImplementationGuide resource's fields plus `packageId` and `canonical`; no fuller Publisher schema is available to copy. A source describing a different package is refused, not merged.",
      cost: "Milliseconds; reads two files.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
