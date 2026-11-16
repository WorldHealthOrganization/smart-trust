import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "catalogue-from-references",
    title: "Catalogue a library from its bibliography",
    description:
      "Write one `folio-dublin-core/v1` record and one `folio-catalogue-node/v1` item per library entry that the source ledger joins to a CSL-JSON reference, into the folio's declared `catalogue` directory, so `gen-library-jsonld` reads the title from the catalogue's `dc.title` instead of falling to the PDF or the slug. The join is exact: a ledger row naming the entry's `structure.json` source file, one reference id, and the same sha256 where both record one. Unjoined entries are reported and left alone. Never touches a node it did not write.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/catalogue-from-references.ts" },
    io: {
      inputs: [
        { name: "instance", schema: t("RepoPath"), required: true, arg: { positional: 0 }, description: "The folio instance's root. It must declare a `catalogue` and a `library` directory." },
        { name: "apply", schema: t("Flag"), required: false, arg: { flag: "--apply" }, description: "Write the records and nodes, and remove this tool's stale ones. Without it the run is a dry run." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Write nothing. Exit 1 if any record or node on disk differs from what the bibliography gives." },
        { name: "json", schema: t("Flag"), required: false, arg: { flag: "--json" }, description: "Print the plan as JSON." },
        { name: "baseUrl", schema: t("Url"), required: false, arg: { flag: "--base-url" }, description: "Where the bibliography is published. With `--apply`, writes `catalogue.json` when the catalogue directory has none; without it such a run is refused." },
      ],
      outputs: [
        { name: "catalogue", schema: t("RepoPath"), description: "`<catalogue>/records/<slug>.dc.json` and `<catalogue>/nodes/item-<slug>.json` per joined entry; `catalogue.json` when absent and `--base-url` is given. A summary of joined and left-alone entries goes to stdout." },
      ],
    },
    satisfies: ["filing-dublin-core"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when:
        "A folio keeps its bibliography as CSL-JSON and a source ledger, has no catalogue, and its library titles fall to `slug` or the PDF.",
      limits:
        "Bibliographic layer only. Every publication gate is written `unknown`: it records what the bibliography says and decides no licence. Entries the ledger does not join to exactly one reference are left alone, never guessed.",
      cost: "Milliseconds per entry. Reads the bibliography, the ledger and each entry's structure.json; no network.",
    },
  }),
);
