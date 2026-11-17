import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// Owner, 2026-11-01 (smart-ra Q-RAC-1 B, Q-RAC-8 A): a document's glossary and
// acronyms tables are drawn from its SKOS glossaries, never typed.
export default toolFactory((t) =>
  defineTool({
    id: "glossary-table",
    title: "Glossary and acronyms tables",
    description:
      "Rewrite the glossary and acronyms tables of a document from its folio-glossary/v1 schemes, as `glossary/glossary-tables.json` (folio-glossary-tables/v1) lists them: terms with their altLabels, definitions and editorial notes; acronyms (notation and prefLabel); or element types, the placeholder types an ArchiMate metamodel view shows, with each term's definition and skos:example. The block's caption and footnotes are left alone. `--check` writes nothing and fails when a table is stale.",
    install: { none: true },
    invoke: { shell: "bun run cat glossary:table" },
    io: {
      inputs: [
        { name: "instance", schema: t("RepoPath"), required: true, arg: { flag: "--instance" }, description: "The instance root holding `glossary/glossary-tables.json`." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Fail if a table is stale, instead of writing." },
      ],
      outputs: [{ name: "blocks", schema: t("RepoPath"), description: "The rewritten table blocks, at the paths the config names." }],
    },
    satisfies: ["graph-rendering"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when: "A document's glossary, acronyms or element-types tables should come from its SKOS glossaries (and, for element types, its ArchiMate metamodel view). For a References list use references-render.",
      limits: "Only the tables `glossary/glossary-tables.json` names; captions and footnotes are left alone.",
      cost: "Milliseconds per table; reads the instance's glossary schemes and, for element types, one Archi model; no network.",
    },
  }),
);
