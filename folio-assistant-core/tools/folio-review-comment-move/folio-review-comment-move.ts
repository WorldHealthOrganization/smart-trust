import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "folio-review-comment-move",
    title: "Move a review comment's status",
    description:
      "A review-process task moves one `review-comment/1.0.0` todo's status (address, send back, resolve, adjudicate, withdraw) through `transition()`, which refuses any move the named BPMN task may not make. The comment is written to the folio's todos graph (its declared `todo-feedback` directory) and, with `--commit`, committed to the edit-set's FEATURE branch. Refused on the base branch and on a detached HEAD.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/review-comment-move.ts" },
    io: {
      inputs: [
        { name: "id", schema: t("NodeId"), required: true, arg: { flag: "--id" }, description: "The review comment's id, `review-pr<N>-c<commentId>`." },
        { name: "to", schema: t("NodeId"), required: true, arg: { flag: "--to" }, description: "The status to move it to: open, addressed, resolved, adjudicated or withdrawn, checked by the script against that closed list." },
        { name: "process", schema: t("ProcessId"), required: true, arg: { flag: "--process" }, description: "The BPMN process whose task is making the move." },
        { name: "task", schema: t("NodeId"), required: true, arg: { flag: "--task" }, description: "The task, in that process, making the move." },
        { name: "decision", schema: t("NodeId"), required: false, arg: { flag: "--decision" }, description: "The Decision that closes it. Required to resolve or adjudicate." },
        { name: "todos", schema: t("RepoPath"), required: false, arg: { flag: "--todos" }, description: "The folio's todos graph root. Default `todos`." },
        { name: "published", schema: t("RepoPath"), required: false, arg: { flag: "--published" }, description: "The published `review-comments.json`, for a comment not committed yet." },
        { name: "commit", schema: t("Flag"), required: false, arg: { flag: "--commit" }, description: "Commit the file to the current feature branch." },
        { name: "base", schema: t("Branch"), required: false, arg: { flag: "--base" }, description: "The base branch a status may NOT be committed to. Default `main`." },
      ],
      outputs: [
        { name: "comment", schema: t("RepoPath"), description: "`<todo-feedback dir>/<id>.json`, the moved node." },
      ],
    },
    satisfies: ["review-comments"],
    requires: { runtime: ["bun", "git"], network: false },
    selection: {
      when:
        "An editor or adjudicator, acting in a review-process task, has decided what happens to a reviewer's comment and the decision must be recorded where the edit is: on the feature branch.",
      limits:
        "Only the moves in `REVIEW_TRANSITIONS`, and only by the task each names. Anchor facts in a committed file are those of the last move; the published file is where re-anchoring shows.",
      cost: "Reads one directory and writes one file; one git commit with `--commit`.",
    },
  }),
);
