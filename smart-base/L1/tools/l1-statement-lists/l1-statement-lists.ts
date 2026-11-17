import { defineTool, toolFactory } from "../../../platform/index.js";

export default toolFactory((t) =>
  defineTool({
    id: "l1-statement-lists",
    title: "L1 extraction → statement lists",
    description:
      "The smart-base collector for core's `publish-extracted-statements` step: an `l1-extraction` directory's authored L1 sources (`recommendations:` rows) and scenario-candidate graphs (`user-scenario` nodes whose `evidence.location` names a row), written as `folio-extracted-statements/v1` lists, each statement with the library entry its L1 source names and the page it was read from. Core's `statements:pages` then renders them with links to the entry and section.",
    install: { none: true },
    invoke: { shell: "bun run smart-base/scripts/l1-statement-lists.ts" },
    io: {
      inputs: [
        { name: "dir", schema: t("RepoPath"), required: true, arg: { flag: "--dir" }, description: "An `l1-extraction` directory." },
        { name: "out", schema: t("RepoPath"), required: true, arg: { flag: "--out" }, description: "Where the lists go." },
        { name: "instance-root", schema: t("RepoPath"), required: false, arg: { flag: "--instance-root" }, description: "The instance the evidence locations are relative to; the working directory when absent." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Compare instead of writing: exit 1 when a list is stale." },
      ],
      outputs: [
        { name: "lists", schema: t("RepoPath"), description: "`<stem>.recommendations.json` per L1 source and `<stem>.scenarios.json` per scenario graph." },
      ],
    },
    satisfies: ["publish-extracted-statements"],
    selection: {
      when: "An L1 extraction's statements are to be published, with links to their sources, in the folio's own pages and the shared viewer.",
      limits:
        "An L1 source that names no library entry is refused. A row's page is its first page. A node citing a file that is not an L1 source (a persona citing the mapping) is not a statement and is skipped.",
      cost: "Seconds, no network.",
    },
  }),
);
