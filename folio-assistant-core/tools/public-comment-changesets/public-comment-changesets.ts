import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "public-comment-changesets",
    title: "Public-comment change-sets",
    description:
      "Bring a public review's change-sets back in line with GitHub: open the primary issue of each change-set somebody has engaged with, link the other issues that discuss it, and re-render each issue's change-set section from its `changesets/CS-*.json` record. The nightly half of what the folio's public-comment workflow does on each issue event (`github`); `check` validates the records without writing.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/public-comment-changesets.ts" },
    io: {
      inputs: [
        // `ChangeSetAction` is added in cat-harness-tools#1761; cast until index.lock.json re-pins it.
        { name: "operation", schema: t("ChangeSetAction" as Parameters<typeof t>[0]), required: true, arg: { positional: 0 }, description: "The command: `reconcile` (the nightly run), `check` (validate the records, write nothing) or `github` (one issue event, as the workflow does)." },
        { name: "store", schema: t("RepoPath"), required: false, arg: { flag: "--store" }, description: "The record's directory in the repository. Default `review/public-comment`." },
      ],
      outputs: [
        { name: "changesets", schema: t("RepoPath"), description: "The updated `changesets/CS-*.json` records under the store; the issues are updated on GitHub." },
      ],
    },
    satisfies: ["public-comment"],
    requires: { runtime: ["bun", "gh"], network: true },
    remedies: [
      {
        host: "github.com",
        none: "The issues live on GitHub; offline, `check` still validates the records and nothing is opened or re-rendered.",
      },
    ],
    selection: {
      when:
        "Change-set records and their GitHub issues may have drifted: a recommendation made from the CLI, an issue edited by hand, or a missed workflow run.",
      limits: "Writes only under the store and to issues of the current repository. One run at a time, like the workflow it backs.",
      cost: "Seconds plus one GitHub API call per change-set that has issues.",
    },
  }),
);
