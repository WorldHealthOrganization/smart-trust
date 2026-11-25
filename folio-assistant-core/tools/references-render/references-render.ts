import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// Owner, 2026-11-02 (card Q-REFKG-4, "A Build the renderer"): a document's
// References chapter is drawn from the KG reference nodes its block cites.
export default toolFactory((t) =>
  defineTool({
    id: "references-render",
    title: "Reference list from reference nodes",
    description:
      "Rewrite each reference-list block of a document (a block whose `meta.referenceList` is set) from the folio-reference/v1 nodes its `cites` names, in that order: the node's `printed` text verbatim when it has one, otherwise WHO style (or the short `Authors. Title. Year.` form), as a numbered or bulleted list. The block's `.md` is generated whole. `--check` writes nothing and fails when a list is stale.",
    install: { none: true },
    invoke: { shell: "bun run cat references:render" },
    io: {
      inputs: [
        { name: "instance", schema: t("RepoPath"), required: true, arg: { flag: "--instance" }, description: "The instance root whose folio blocks and references directories are read." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Fail if a list is stale, instead of writing." },
      ],
      outputs: [{ name: "blocks", schema: t("RepoPath"), description: "The rewritten reference-list blocks: each block's `.md`." }],
    },
    satisfies: ["graph-rendering"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when: "A document's References list should come from the reference nodes its block cites. For glossary or acronyms tables use glossary-table.",
      limits: "Only blocks with `meta.referenceList`; the whole `.md` is regenerated. A cited key with no reference node fails the run.",
      cost: "Milliseconds per block; reads the instance's blocks and reference nodes, no network.",
    },
  }),
);
