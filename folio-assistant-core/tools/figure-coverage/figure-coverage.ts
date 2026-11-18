import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "figure-coverage",
    title: "Figure coverage and computability",
    description:
      "For every figure a source publication declares, report whether the folio built from it has a block and how computable it is: missing, excluded (signed off), picture (a PNG crop), linked (a picture linked to a model view), computable (a diagram, a table or a figure rebuilt by ArchiMate, BPMN, DMN, Mermaid, a class diagram or a generator), or cited (a picture kept on purpose, signed off). Exits non-zero when any declared figure is missing; `--require-computable` also fails on pictures, linked or not.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/figure-coverage.ts" },
    io: {
      inputs: [
        { name: "entry", schema: t("RepoPath"), required: true, arg: { flag: "--entry" }, description: "The L1 library entry directory; its `sections/*.md` give the declared figures, read with cat-harness-tools `declaredFigureCaptions`." },
        { name: "folio", schema: t("RepoPath"), required: true, arg: { flag: "--folio" }, description: "The folio's document directory; every figure, diagram and table block naming a figure is read." },
        { name: "exclusions", schema: t("RepoPath"), required: false, arg: { flag: "--exclusions" }, description: "JSON `[{figure, scope: block|rebuild, reason, signedOffBy?, signedOffAt?}]`. Without `signedOffBy` an exclusion is a proposal and does not count." },
        { name: "out", schema: t("RepoPath"), required: false, arg: { flag: "--out" }, description: "Where to write the report; stdout when absent." },
      ],
      outputs: [
        { name: "report", schema: t("RepoPath"), description: "A `figure-coverage-report/v1` JSON report: declared count, counts per state, one row per figure with its blocks, blocks naming undeclared figures, and problems. A per-figure table goes to stderr." },
      ],
    },
    satisfies: ["figure-rebuild"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when:
        "A folio has been seeded from an L1 library entry (for example a Digital Transformation Handbook), and somebody needs to know that every figure the publication declares has a block, and which are still only pictures.",
      limits:
        "Figure numbers come from block captions and the first line of each block's Markdown. Whether a rebuild is faithful is a person's review, not this check.",
      cost: "Reads an entry's sections and a folio's blocks; no network.",
    },
  }),
);
