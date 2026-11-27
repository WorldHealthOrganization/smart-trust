import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-binary-audit",
    title: "Measure the IG Publisher's binary outputs on a pages branch",
    description:
      "Read a pages branch's git tree and report the Publisher's binary outputs (full-ig.zip, package.tgz and variants, package.db, validator packs, the definitions/examples/expansions zips, spreadsheets) by name: copies, bytes, and how much of it sits in branch previews. Reads the tree, never a checkout, so a multi-gigabyte branch costs a depth-1 fetch.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-binary-audit.ts --repo <checkout> [--ref origin/gh-pages] [--previews branches/] [--json]" },
    io: {
      inputs: [
        { name: "repo", schema: t("FilesystemPath"), required: false, description: "A clone that has the pages branch fetched." },
        { name: "ref", schema: t("Text"), required: false, description: "Default `origin/gh-pages`." },
      ],
      outputs: [{ name: "audit", schema: t("Text"), description: "A table, or `ig-binary-audit/v1` JSON with `--json`." }],
    },
    satisfies: ["ig-binary-artefacts"],
    selection: {
      when: "Before configuring an IG's deploy or release step, when a pages branch nears its size limit, or before linking a download from a page.",
      limits: "Counts only the Publisher's own binary names; another large file is in `total` but not itemised. It measures, and deletes nothing.",
      cost: "One `git ls-tree` over the branch; seconds for 64,000 files.",
    },
    requires: { runtime: ["bun", "git"], network: false },
  }),
);
