import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// ── Tabular extraction — bean `eief`, declarations moved here by `cat-tools-1wre` ──
//
// Declared in cat-harness as STUBS until the extractors existed. Tabular
// metadata is content vocabulary, so the working tools live with the code,
// as `dublin-core-render` does. Both write one `folio-tabular-csvw/v1`
// record, validated before it is written, and refuse (exit 2) a file not
// shown to be a table rather than guess.
export default toolFactory((t) =>
  defineTool({
    id: "tabular-csv",
    title: "CSV tabular metadata",
    description:
      "Read a delimited text file into a `folio-tabular-csvw/v1` record: one table, its columns and their CSVW datatypes, each measured or explicitly undetermined. Routing is by content, never by extension: the first rows must agree on one field count of two or more, under exactly one of `,` `;` TAB `|`. A CSV's `fac:anchor` sheet and cell are a determined null. Governed by the `tabular-metadata` skill.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/tabular-csv.ts" },
    io: {
      inputs: [
        { name: "file", schema: t("DelimitedTextPath"), required: true, arg: { positional: 0 }, description: "Path to the delimited text file." },
        { name: "doc-id", schema: t("DocId"), required: false, arg: { flag: "--doc-id" }, description: "The record's `doc_id`. Default: the file name without its extension." },
        { name: "out", schema: t("RepoPath"), required: false, arg: { flag: "--out" }, description: "Where to write `tabular.csvw.json`. Default: stdout." },
      ],
      outputs: [
        { name: "record", schema: t("Text"), description: "A `folio-tabular-csvw/v1` document. Exit 2 when the file is not shown to be a table." },
      ],
    },
    satisfies: ["tabular-metadata"],
    requires: { runtime: ["bun"], network: false },
  }),
);
