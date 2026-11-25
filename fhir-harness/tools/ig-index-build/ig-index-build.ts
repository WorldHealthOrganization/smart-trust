import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-index-build",
    title: "Build each IG instance's artefact index from the IG's cached AST",
    description:
      "Write each IG instance's `fhir-artifact-index/` at publish, so no IG instance commits one. Indexes each instance that needs this layer and whose `repository` has an AST cache branch; others are skipped and named. Per instance: `index.json` from the AST `ig-cache.sh restore` lays down from the IG repository's cache branch (`authority: \"cache\"`), `menu.json` from the IG's `sushi-config.yaml` at the commit cloned (recording the `source.of` and `source.ref` that `stage-ig-sites` clones from), `releases.json` from the repository's GitHub releases (a failed read writes nothing, never an empty list), `package.tgz` from the AST's resources, and the JSON-LD contexts the IG publishes. The first step of process `ig-docs-site-compose`.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/build-ig-indexes.ts" },
    io: {
      inputs: [
        { name: "root", schema: t("RepoPath"), required: false, description: "The checkout whose IG instances are indexed. Default: the current directory's checkout." },
        { name: "only", schema: t("Slug"), required: false, description: "Index one IG instance." },
        { name: "work", schema: t("RepoPath"), required: false, description: "Scratch directory for each IG's clone and restored AST. Default: a fresh temporary directory." },
        { name: "plan", schema: t("Flag"), required: false, arg: { flag: "--plan" }, description: "Write nothing; say which instances would be indexed, and why any is skipped." },
      ],
      outputs: [
        { name: "indexes", schema: t("Count"), description: "IG instances indexed; each skipped instance is named with its reason, never silently absent." },
      ],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "Building the docs site or a staging preview, before any page step reads an IG instance's artefact index.",
      limits: "Needs the IG repository's AST cache branch: an IG with none is skipped, and the index is only as current as that cache (`ig-ast-cache`).",
      cost: "A shallow clone and an AST restore per IG, then seconds of indexing.",
    },
    requires: { runtime: ["bun", "git"], network: true },
    remedies: [{ host: "github.com", none: "It clones each IG's repository and reads its AST cache branch and releases from GitHub; no declared Tool builds an IG's index without it." }],
  }),
);
