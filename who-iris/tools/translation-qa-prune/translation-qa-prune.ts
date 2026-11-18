import { defineTool, toolFactory } from "../../platform.ts";

export default toolFactory((t) =>
  defineTool({
    id: "translation-qa-prune",
    title: "Prune round-trip rulings of removed strings",
    description:
      "Drop the translation-semantic-roundtrip rulings of strings the catalogues no longer hold, and renumber the rest to catalogue order. Rulings are paired with strings by the hash of their msgid, so removing strings invalidates none and needs no agent re-run; this is the upkeep that follows. It only drops or renumbers: a verdict is never changed or invented, and a ruling for a string the ref's history never held (one recorded ahead of its PR) is kept.",
    install: { none: true },
    invoke: { shell: "bun run cat translation-qa:prune" },
    io: {
      inputs: [
        { name: "write", schema: t("Flag"), required: false, arg: { flag: "--write" }, description: "Apply the change to test/attestations/translation-qa/. Absent, it is a dry run that prints each dropped ruling and the renumbered spans." },
        { name: "ref", schema: t("Branch"), required: false, arg: { flag: "--ref" }, description: "Whose catalogues decide what was removed. Default origin/main: the state branch serves main and every branch, so a ruling goes only once main no longer holds its string." },
      ],
      outputs: [{ name: "attestations", schema: t("RepoPath"), description: "With --write, the rewritten `test/attestations/translation-qa/<catalogue>.<locale>.attestations.json`, to be pushed to `cat/who-iris/attestations`." }],
    },
    satisfies: ["translation-manager"],
    requires: { runtime: ["bun", "git"], network: false },
  }),
);
