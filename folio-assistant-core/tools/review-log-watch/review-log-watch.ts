import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "review-log-watch",
    title: "Check a review log and its repository's issues for changes",
    description:
      "The mechanical check a review-log watcher runs on every poll. Given a drafting sheet's Contributor Feedback values and the folio repository, it reads the repository's open and closed issues (leaving out pull requests, issues labelled `no-sheet` and, with `--author`, issues someone else opened) and compares a digest of them and of the cells people set (Title, Selected Sections, Contributor Feedback, Disposition, Ready for agent, Ready for merge, Dispositions confirmed; on a public-comment log also Committee Feedback, TWG (CS), TWG (human) and Change Set (human)) with the last check's. Unchanged: it prints `{\"status\":\"unchanged\"}` and exits 0. Changed: it exits 10 and lists what changed (issue opened, updated or closed; a cell's old and new text), the Contributor Feedback rows to append, one per issue that no row's Issue cell links yet (Title the issue's title, the first Contributor Feedback column `@login (#N): first paragraph`, Issue the issue's URL; a closed issue's row marked `closed`), and `closedRows`, the rows linking a closed issue, which the watcher hides with their text struck through. A read with no Issue column (a public-comment log's Review Change Sets) tracks only issues labelled `change-set` unless `--label` says otherwise, and appends no rows: each open issue is reported as an `issue-unlinked` change instead. It writes no sheet and no issue: the watcher appends the rows and does the agent pass. With `--accept` it stores the new state for the next poll to compare against.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/tools/review-log-watch/watch.ts" },
    io: {
      inputs: [
        { name: "repo", schema: t("RepoPath"), required: true, arg: { flag: "--repo" }, description: "The folio repository, `owner/name`, whose issues, open and closed, are read with `gh api`." },
        { name: "sheet", schema: t("RepoPath"), required: true, arg: { flag: "--sheet" }, description: "The Contributor Feedback tab's values (a public-comment log: Review Change Sets) as JSON: the Sheets API `values` array (or the whole `get_values` answer), from row 1, so the header row (first cell `Change-set`) is found." },
        { name: "state", schema: t("RepoPath"), required: true, arg: { flag: "--state" }, description: "The last check's state file. Missing on the first check, which reports every open issue as opened." },
        { name: "issues", schema: t("RepoPath"), required: false, arg: { flag: "--issues" }, description: "Issues as JSON (the issues API's shape), instead of reading them with `gh api`. For tests and offline runs." },
        { name: "author", schema: t("RepoPath"), required: false, arg: { flag: "--author" }, description: "Only issues this GitHub login opened. Default every author." },
        { name: "sheetHash", schema: t("RepoPath"), required: false, arg: { flag: "--sheet-hash" }, description: "The sheet script's hash of the person-set cells, Watch!G1. Given, it stands for the cells, so `--sheet` needs only the header row and the Issue column." },
        { name: "label", schema: t("RepoPath"), required: false, arg: { flag: "--label" }, description: "Only issues with this label, e.g. `change-set`. Default every issue on a read with an Issue column, and `change-set` on one without (a public-comment log)." },
        { name: "skipLabel", schema: t("RepoPath"), required: false, arg: { flag: "--skip-label" }, description: "The label that keeps an issue off the sheet. Default `no-sheet`." },
      ],
      outputs: [
        { name: "result", schema: t("RepoPath"), description: "JSON on standard output: `status` (`unchanged` or `changed`), `digest`, and when changed `changes`, `append` (rows aligned to the header, each with `closed`), `closedRows` and `state`. Exit 0 unchanged, 10 changed, 2 usage." },
      ],
    },
    satisfies: ["review-log-watch"],
    requires: { runtime: ["bun"], network: true },
    remedies: [{ host: "api.github.com", none: "The issues are held by GitHub. Without it, pass `--issues` with a saved copy of the issues API answer; the check then compares the sheet against that copy." }],
    selection: {
      when: "On every poll of a review-log watcher, before any agent work: the agent pass runs only when this reports `changed`.",
      limits: "Reads one tab and one repository's issues; it never writes the sheet or GitHub. It sees an edit only in the watched headers, so the agent's own Green columns and the script's Grey ones never wake the watcher.",
      cost: "One `gh api` call per 100 issues and one small JSON file; well under a second.",
    },
  }),
);
