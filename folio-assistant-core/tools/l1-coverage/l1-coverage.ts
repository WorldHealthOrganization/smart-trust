import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "l1-coverage",
    title: "L1 extraction coverage",
    description:
      "Of the normative sentences in a publication (the closed marker list of the methodology `l1-coverage` §1), count how many an L1 extraction CAPTURED, how many are EXCLUDED for a fixed-list reason a person signed off, and how many are UNACCOUNTED — per page and in total. Writes the contract's §4 report and exits non-zero below 100% accounted-for.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/l1-coverage.ts" },
    io: {
      inputs: [
        { name: "text", schema: t("RepoPath"), required: true, arg: { flag: "--text" }, description: "The publication's body text, page-tagged: `{\"pages\":[{\"page\":n,\"text\":\"…\"}]}` JSON, or plain text with a form feed between pages (what `pdftotext` writes). Headers, references and tables of contents are stripped by the caller." },
        { name: "captured", schema: t("RepoPath"), required: true, arg: { flag: "--captured" }, description: "JSON `[{\"id\",\"text\"}]`: every statement the extraction captured, verbatim." },
        { name: "exclusions", schema: t("RepoPath"), required: false, arg: { flag: "--exclusions" }, description: "JSON `[{location|text, reason, signedOffBy?, signedOffAt?}]`. An exclusion without `signedOffBy` is a proposal and leaves its sentence unaccounted." },
        { name: "out", schema: t("RepoPath"), required: false, arg: { flag: "--out" }, description: "Where to write the report; stdout when absent." },
      ],
      outputs: [
        { name: "report", schema: t("RepoPath"), description: "An `l1-coverage-report/v1` JSON report: definitionVersion, matchMethod, source and graph sha256, totals, pages[] and sentences[]. A per-page table goes to stderr." },
      ],
    },
    satisfies: ["l1-coverage"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when:
        "An L1 extraction of a publication (recommendations, remarks, schedule entries) is about to be reviewed or promoted, and somebody needs to know — rather than assume — that no normative sentence was silently missed.",
      limits:
        "Matching is normalised substring, so a paraphrased capture reads as unaccounted. Body-text filtering is the caller's. The marker list is English.",
      cost: "Reads three files; no network.",
    },
  }),
);
