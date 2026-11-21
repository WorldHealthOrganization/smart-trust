import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-release",
    title: "Cut an IG release as a GitHub draft that carries its packages and AST, and report a version left untagged or unreleased",
    description:
      "Gather a release's files from a full Publisher build (package.tgz and its R4/R4B variants, and ast-data.zip, the IG's AST with the Libraries' ELM), say from sushi-config.yaml whether it is a pre-release, and make or refresh the GitHub DRAFT release for the tag with the files uploaded. The owner publishes the draft; a published release is never changed. `check` is the catch-up the AST refresh of the default branch runs (advisory): it reports a current version with no `v<version>` tag, naming the commit that set it for the owner to tag, and a tag with no release, for the owner to run `ig-release.yml` by hand. It never tags and never releases: the tag is the owner's governance step (`ig-release.bpmn`).",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-release.ts assets|kind|draft|check …" },
    io: {
      inputs: [
        { name: "output", schema: t("FilesystemPath"), required: false, description: "`assets`: the Publisher's output/ directory." },
        { name: "ast", schema: t("FilesystemPath"), required: false, description: "`assets`: the AST directory (its manifest.json)." },
        { name: "tag", schema: t("Text"), required: false, description: "`draft`: the git tag the release is for." },
        { name: "ig", schema: t("FilesystemPath"), required: false, description: "`kind`, `check`: the IG root (its sushi-config.yaml and git history)." },
        { name: "repo", schema: t("Text"), required: false, description: "`draft`, `check`: the repository (`owner/repo`) whose releases are read or written." },
      ],
      outputs: [{ name: "release", schema: t("Text"), description: "The files with size and SHA-256 (`assets`), `prerelease`/`release` (`kind`), what was done (`draft`), or what the owner should do (`check`)." }],
    },
    satisfies: ["ig-binary-artefacts"],
    selection: {
      when: "When the owner tags an IG version: the IG's `ig-release.yml` caller runs it after a full AST build of the tag. `check` runs in every AST refresh of the default branch.",
      limits: "Makes drafts only; publishing is the owner's step on GitHub. Needs a token that may write the repository's releases.",
      cost: "One full Publisher build (in the workflow), then a few REST calls and the uploads.",
    },
    requires: { runtime: ["bun", "zip", "gh"], network: true },
    remedies: [{ host: "github.com", none: "The releases and tags ARE GitHub's; offline, `assets` and `kind` still run, and `check` reports the tag from the local clone and the release as unknown." }],
  }),
);
