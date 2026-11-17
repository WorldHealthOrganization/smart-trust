import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ingest-ig-menu",
    title: "Ingest an IG's navigation from its sushi-config",
    description:
      "Read `menu:` (and the page tree) out of an IG source repository's `sushi-config.yaml` into `fhir-artifact-index/menu.json`, recording the repository and commit it was read at — the declared source `stage-ig-sites` clones. `--check` re-derives it against a checkout; with no `--source` it reports COULD NOT DETERMINE and exits 2, never 0.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ingest-ig-menu.ts" },
    io: {
      inputs: [
        { name: "source", schema: t("RepoPath"), required: false, description: "A checkout of the IG source repository." },
        { name: "out", schema: t("RepoPath"), required: true, description: "The instance's `fhir-artifact-index/` directory." },
        { name: "check", schema: t("Flag"), required: false, description: "Write nothing; exit 1 when stale, 2 when it cannot compare." },
      ],
      outputs: [
        { name: "groups", schema: t("Count"), description: "Menu groups read, each with its items." },
      ],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "An IG instance gains, or re-pins, the source repository its site is built from.",
      limits: "Reads the config only: a menu item the Publisher generates (a page with no source) is listed, and the site build reports it.",
      cost: "Milliseconds.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
