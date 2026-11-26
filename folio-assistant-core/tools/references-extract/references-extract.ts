import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// Owner, 2026-11-11: "i want all who-iris docs that have references put into
// their own biblio". Step Task_References of ingest-build-l1-kg.bpmn.
export default toolFactory((t) =>
  defineTool({
    id: "references-extract",
    title: "Reference lists to reference nodes",
    description:
      "Split each library entry's reference lists (a References, Bibliography or Further reading section or heading, in the six UN languages and Portuguese) into folio-reference/v1 nodes in the instance's declared `references` directory, one per cited work, keyed `<doc-id>.<section>.<n>`: provenance extracted, derivedFrom the section file, printed the entry verbatim, and only the fields read without guessing (URL, DOI, ISBN, year, access date). The bibliography page lists them as the document's own bibliography. `--check` writes nothing and fails when a node is stale.",
    install: { none: true },
    invoke: { shell: "bun run cat references:extract" },
    io: {
      inputs: [
        { name: "instance", schema: t("RepoPath"), required: true, arg: { flag: "--instance" }, description: "The instance root whose library sections are read and whose references directory is written." },
        { name: "entry", schema: t("RepoPath"), required: false, arg: { flag: "--entry" }, description: "One library entry's slug, to extract only its lists." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Fail if a node is stale, instead of writing." },
      ],
      outputs: [{ name: "references", schema: t("RepoPath"), description: "The extracted reference nodes: `<references dir>/<doc-id>.<section>.<n>.json`." }],
    },
    satisfies: ["l1-document-ingestion"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when: "A library entry's source prints a reference list and the document should have its own bibliography. For glossary and abbreviations sections use glossary-from-source.",
      limits: "Reads L1 sections, not the PDF; no title or author is parsed (the node keeps the printed text). Only nodes with provenance extracted are written or removed.",
      cost: "Seconds for a few hundred entries; reads sections, no network.",
    },
  }),
);
