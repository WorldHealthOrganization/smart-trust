import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// Owner, 2026-11-01 (folio-assistant-core#498, Q-GLO-1 C): one shared ingest
// step for the glossary and abbreviations sections of L1, DTH and DAK sources.
export default toolFactory((t) =>
  defineTool({
    id: "glossary-from-source",
    title: "Glossary candidates from a source",
    description:
      "Read a source's glossary and abbreviations sections (an L1 entry's sections/, or a folio block) into `candidate` terms of a folio-glossary/v1 scheme, verbatim, each with `source: <file>#L<line>`. Acronyms fold into the term they expand as `notation`. The scheme is merged: terms a person owns are never changed. `--check` writes nothing and fails when the scheme would change.",
    install: { none: true },
    invoke: { shell: "bun run cat glossary:from-source" },
    io: {
      inputs: [
        { name: "out", schema: t("RepoPath"), required: true, arg: { flag: "--out" }, description: "The scheme file to write or merge into: `glossary/<scheme>.glossary.json`." },
        { name: "id", schema: t("Slug"), required: false, arg: { flag: "--id" }, description: "The scheme id, for a new file." },
        { name: "title", schema: t("Text"), required: false, arg: { stdin: true }, description: "The scheme title, for a new file: free text, so it goes on stdin." },
        { name: "from", schema: t("RepoPath"), required: false, arg: { flag: "--from" }, description: "A directory whose glossary and abbreviations sections are read: an L1 entry's `sections/`." },
        { name: "terms", schema: t("RepoPath"), required: false, arg: { flag: "--terms" }, description: "A Markdown file read as term and definition rows." },
        { name: "abbreviations", schema: t("RepoPath"), required: false, arg: { flag: "--abbreviations" }, description: "A Markdown file read as acronym and expansion rows." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Fail if the scheme is stale, instead of writing." },
      ],
      outputs: [{ name: "scheme", schema: t("RepoPath"), description: "The merged folio-glossary/v1 scheme." }],
    },
    satisfies: ["glossary-terms"],
    requires: { runtime: ["bun"], network: false },
  }),
);
