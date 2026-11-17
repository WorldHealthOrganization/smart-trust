import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "folio-review-comments",
    title: "Folio review comments",
    description:
      "Ingest a pull request's tagged conversation comments (`block: <label>` on the first line) into `review-comment/1.0.0` todos, and write them as `review-comments.json`. Idempotent over its previous output, whose statuses it keeps. Re-anchors every comment against the head's blocks, following `renamedFrom`, and orphans a comment whose block is gone rather than dropping it.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/review-comments.ts" },
    io: {
      inputs: [
        { name: "repo", schema: t("RepoFullName"), required: true, arg: { flag: "--repo" }, description: "`owner/name` of the repository the pull request is in." },
        { name: "pr", schema: t("ChangeProposalNumber"), required: true, arg: { flag: "--pr" }, description: "The edit-set's pull request." },
        { name: "out", schema: t("RepoPath"), required: true, arg: { flag: "--out" }, description: "Where to write `review-comments.json`." },
        { name: "folio", schema: t("RepoPath"), required: false, arg: { flag: "--folio" }, description: "Read the head's blocks from the folio's manifests (as text; nothing is executed). Give this OR `blocks`." },
        { name: "blocks-out", schema: t("RepoPath"), required: false, arg: { flag: "--blocks-out" }, description: "With `folio`: also write `blocks.json`, so a later run can anchor without checking the folio out." },
        { name: "blocks", schema: t("RepoPath"), required: false, arg: { flag: "--blocks" }, description: "A published `blocks.json`. The comment-triggered refresh uses this, so it never checks out the pull request's code." },
        { name: "existing", schema: t("RepoPath"), required: false, arg: { flag: "--existing" }, description: "The previous `review-comments.json`. Every comment in it is kept, with its status." },
        { name: "commit", schema: t("CommitSha"), required: false, arg: { flag: "--commit" }, description: "The head commit. Default `GITHUB_SHA`, else `git rev-parse HEAD`." },
        { name: "todos", schema: t("RepoPath"), required: false, arg: { flag: "--todos" }, description: "The folio's todos graph root. Review comments committed under its `todo-feedback` directory, on the feature branch, win over the previously published copy." },
        { name: "comments", schema: t("RepoPath"), required: false, arg: { flag: "--comments" }, description: "Read comments from this JSON file instead of GitHub: offline runs and tests." },
      ],
      outputs: [
        { name: "review-comments", schema: t("RepoPath"), description: "A `folio-review-comments/v1` file whose `comments` are `review-comment/1.0.0` todos. Its one-line summary goes to stderr." },
      ],
    },
    satisfies: ["review-comments"],
    requires: { runtime: ["bun"], network: true },
    remedies: [{ host: "api.github.com", none: "Reviewer comments are held by GitHub; without it the review page keeps its last ingested set." }],
    selection: {
      when:
        "A pull request that edits a folio has reviewer comments, and the review page, the heat map, or an editor needs them as structured todos anchored to blocks.",
      limits:
        "Reads conversation comments only, not line review comments (those anchor to a file line). A reviewer's edit to a comment after it was ingested is not re-read. Statuses are moved by review-process tasks, not by this Tool; it keeps whatever `existing` says.",
      cost: "One paginated GitHub API call per 100 comments, plus a text walk of the manifests when `folio` is given.",
    },
  }),
);
