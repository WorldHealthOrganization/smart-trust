import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "block-actions",
    title: "Block edit and feedback links",
    description:
      "Each labelled block's links back to where it can be changed: [edit] opens the block's Markdown source in GitHub's editor on `main`, and [feedback] opens a new GitHub issue about the block, from the folio's `.github/ISSUE_TEMPLATE/block-feedback.yml` when it has one (prefilling only the fields it declares: block, section, source, page, url) or as a plain issue whose body carries the same facts. The document build draws these on every block; this Tool prints them as JSON for one block or all. Governed by the `block-actions` skill.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/block-actions.ts" },
    io: {
      inputs: [
        { name: "repo", schema: t("RepoPath"), required: false, arg: { flag: "--repo" }, description: "The folio's repository root. Default: the working directory." },
        { name: "block", schema: t("NodeId"), required: false, arg: { flag: "--block" }, description: "One block's label. Absent: every block of every document. A label no block has exits 1." },
        { name: "github", schema: t("RepoFullName"), required: false, arg: { flag: "--github" }, description: "`owner/name` on GitHub. Default `GITHUB_REPOSITORY`, else the checkout's `origin`. None at all exits 2: no links rather than broken ones." },
        { name: "edit-branch", schema: t("Branch"), required: false, arg: { flag: "--edit-branch" }, description: "The branch [edit] opens. Default `main`." },
        { name: "issue-template", schema: t("RepoPath"), required: false, arg: { flag: "--issue-template" }, description: "The issue form's file name under `.github/ISSUE_TEMPLATE/`. Default `block-feedback.yml`, used only if the folio has it." },
      ],
      outputs: [
        { name: "links", schema: t("RepoPath"), description: "JSON on stdout: one `{ label, source, section, edit, feedback }` per block. A one-line summary goes to stderr." },
      ],
    },
    satisfies: ["block-actions"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when:
        "A reader, reviewer or agent wants to propose a change to, or give feedback on, one block of a document folio, and needs the link that lands on that block rather than on the repository.",
      limits:
        "Builds URLs; it writes nothing to GitHub. Only labelled blocks get links. The issue form's fields are read by a line scan for `id:`, so a form must declare its ids plainly.",
      cost: "Milliseconds: one walk of the document manifests. No network.",
    },
  }),
);
