import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-pages",
    title: "Write the IG AST viewer: a page per instance holding `ig-ast` directories, and a hub",
    description:
      "For every visualiser an instance declares `renderedBy: ig-ast-pages`, write the hub at `<locale>/<harness>/<id>/` and, with `subgraphs: \"instance\"`, one page per instance that declares an `ig-ast` directory, at `…/<instance>/`. Each lists the ASTs the directory holds: the IG's package id, resources in total and by type, dependency edges (resolved inside the IG, by origin, by kind), the rebuild plan when one is recorded, and what stays provisional. A declared directory not on disk — a branch-family member not restored, which is the normal case — is reported UNKNOWN with the family it would be restored from, never as zero ASTs. `ig-ast-list` summarises one AST it is handed; this Tool needs no AST path.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/gen-ig-ast-pages.ts" },
    // What this Tool CAN draw. A layer declares that it DOES, in its own
    // `visualisers`, and `check:visualiser-routes` checks the kind is listed here.
    renders: ["ig-ast"],
    io: {
      inputs: [
        { name: "site", schema: t("RepoPath"), required: false, arg: { flag: "--site" }, description: "A site being built: the pages go under it (`visualiser-writers.ts` in cat-harness-tools passes it). Absent, they go under the checkout's site directory." },
        { name: "root", schema: t("RepoPath"), required: false, arg: { flag: "--root" }, description: "The checkout whose declarations are read. Default: the checkout holding the working directory." },
        { name: "check", schema: t("Flag"), required: false, description: "Write nothing; exit 1 when a page is stale, missing or orphaned." },
      ],
      outputs: [{ name: "pages", schema: t("Count"), description: "Pages written: the hub and one per instance." }],
    },
    satisfies: ["ig-ast-delta"],
    selection: {
      when: "Publishing a site that should show which IG ASTs each instance holds.",
      limits: "Counts what the cache holds; it does not check an AST against its IG's inputs (`ig-ast-validity` does) or diff two (`ig-ast-diff`).",
      cost: "Reads each AST's manifest and dependency document once.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
