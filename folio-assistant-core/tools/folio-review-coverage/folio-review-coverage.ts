import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "folio-review-coverage",
    title: "Folio review coverage",
    description:
      "Compute the two facts `content-change-review.bpmn`'s coverage gate (`GW_Covered`) reads: `uncoveredBlocks`, the changed blocks with no reviewer verdict on their CURRENT hash, and `openDefects`. Reads a preview's `changeset.json`, `blocks.json` and `review-comments.json`. With `--commit`, writes the ingested `folio-review-verdict/v1` verdicts into the todos graph's declared `review-verdicts` directory and commits them to the edit-set's FEATURE branch; refused on the base branch and a detached HEAD. Prints the facts as JSON on stdout.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/review-coverage.ts" },
    io: {
      inputs: [
        { name: "changeset", schema: t("RepoPath"), required: true, arg: { flag: "--changeset" }, description: "The preview's `changeset.json`: which blocks changed." },
        { name: "blocks", schema: t("RepoPath"), required: true, arg: { flag: "--blocks" }, description: "The preview's `blocks.json`: each head block's current hash." },
        { name: "comments", schema: t("RepoPath"), required: true, arg: { flag: "--comments" }, description: "The preview's `review-comments.json`: open defects, and the ingested verdicts." },
        { name: "out", schema: t("RepoPath"), required: false, arg: { flag: "--out" }, description: "Also write the full `folio-review-coverage/v1` report, with the uncovered labels and the stale verdicts." },
        { name: "todos", schema: t("RepoPath"), required: false, arg: { flag: "--todos" }, description: "The folio's todos graph root. Verdicts committed under its `review-verdicts` directory win over the published copy." },
        { name: "commit", schema: t("Flag"), required: false, arg: { flag: "--commit" }, description: "Write the published verdicts into the declared directory and commit them to the current feature branch. Needs `todos`." },
        { name: "base", schema: t("Branch"), required: false, arg: { flag: "--base" }, description: "The base branch verdicts may NOT be committed to. Default `main`." },
      ],
      outputs: [
        { name: "coverage", schema: t("RepoPath"), description: "The `folio-review-coverage/v1` report at `out`. Its `facts` field, `{\"uncoveredBlocks\": n, \"openDefects\": n}`, is also printed alone on stdout: what `workflow_complete` takes for `GW_Covered`. The summary goes to stderr." },
      ],
    },
    satisfies: ["review-comments"],
    requires: { runtime: ["bun", "git"], network: false },
    selection: {
      when:
        "The review coordinator reaches `GW_Covered` and needs to know, rather than guess, whether every changed block has been read at its current version and no defect is still open.",
      limits:
        "Counts only what reviewers recorded as verdicts. A block nobody tagged is uncovered even if somebody read it. A verdict on an older hash is reported as stale and not counted.",
      cost: "Reads three JSON files and one directory; one git commit with `--commit`.",
    },
  }),
);
