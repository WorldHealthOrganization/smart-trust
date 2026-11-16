import { defineTool, toolFactory } from "../../platform/index.js";

// smart-base owns the `l1-extraction` kind, so its viewer is drawn here.
export default toolFactory((t) =>
  defineTool({
    id: "l1-extraction-pages",
    title: "L1 extraction viewer: a hub and a page per instance with `l1-extraction` directories",
    description:
      "For every visualiser an instance declares with `renderedBy: l1-extraction-pages`, write the hub at `<locale>/<harness>/<id>/` and, with `subgraphs: \"instance\"`, one page per instance that declares an `l1-extraction` directory. Each page shows, from what the files declare: the L1 statements (graph nodes with a `statement`, and an authored L1 source's `recommendations`); the candidate work list's counts, coverage and decisions; each graph document's nodes by type and edges by predicate (L2 scenario candidates included); counts of curation, mapping, vocabulary, exclusions and run context; and a link from every file to its published copy (cat-harness's `library:viz`), when the site has it, and to its source at the pinned commit. A declared directory not on disk is reported UNKNOWN, never zero.",
    install: { none: true },
    invoke: { shell: "bun run smart-base/scripts/gen-l1-extraction-pages.ts" },
    // What this Tool CAN draw. A layer declares that it DOES, in its own
    // `visualisers`, and `check:visualiser-routes` checks the kind is listed here.
    renders: ["l1-extraction"],
    io: {
      inputs: [
        { name: "site", schema: t("RepoPath"), required: false, arg: { flag: "--site" }, description: "The site being built; pages go under it (cat-harness-tools' `visualiser-writers.ts` passes it). Default: the checkout's site directory." },
        { name: "root", schema: t("RepoPath"), required: false, arg: { flag: "--root" }, description: "The checkout whose declarations are read. Default: the checkout holding the working directory." },
        { name: "check", schema: t("Flag"), required: false, description: "Write nothing; exit 1 when a page is stale, missing or orphaned." },
      ],
      outputs: [{ name: "pages", schema: t("Count"), description: "Pages written: the hub and one per instance." }],
    },
    // A page writer, as the other kind viewers are (`bibliography-page`,
    // `glossary-page`, `iris-pages`): it draws what an extraction holds and
    // takes none of `recommendation-extraction`'s inputs (`l1Sources`).
    satisfies: ["graph-rendering"],
    selection: {
      when: "Publishing a site that should show what each L1 extraction holds.",
      limits: "Validates nothing (`l1-recommendation-candidates` and `l1-recommendation-scenarios` do, on every write) and does not re-render the JSON-LD (the library viewer publishes it).",
      cost: "Reads each file of each declared directory once.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
