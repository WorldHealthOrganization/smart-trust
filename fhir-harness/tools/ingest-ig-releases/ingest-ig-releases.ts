import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ingest-ig-releases",
    title: "Record an IG's GitHub releases as pointers to their binary assets",
    description:
      "Read an IG repository's GitHub releases and write `fhir-artifact-index/releases.json` (`ig-releases/v1`): each asset's name, size, SHA-256 digest and download URL, never its bytes. The IG site's generated `releases` page lists them.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ingest-ig-releases.ts --instance <dir> [--repo owner/repo] [--from releases.json]" },
    io: {
      inputs: [
        { name: "instance", schema: t("FilesystemPath"), required: true },
        { name: "repo", schema: t("Text"), required: false, description: "`owner/repo`; default the instance menu's recorded IG source, else its declaration's `repository`." },
      ],
      outputs: [{ name: "releases", schema: t("FilesystemPath"), description: "`<instance>/fhir-artifact-index/releases.json`." }],
    },
    satisfies: ["ig-binary-artefacts"],
    selection: {
      when: "After an IG repository cuts a release, so its pages list the new assets.",
      limits: "A record of what GitHub reported on the day it was read; a later release is absent until the next run. Drafts are never recorded.",
      cost: "One GitHub API call per 100 releases.",
    },
    requires: { runtime: ["bun"], network: true },
    remedies: [{ host: "api.github.com", none: "Pass `--from <releases.json>`, saved where GitHub is reachable." }],
  }),
);
