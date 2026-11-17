import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "terminology-index",
    title: "Write an IG site's static terminology index from the IG's own cache",
    description:
      "Read the IG Publisher's `expansions.json` and `txcache/`, as `ig-cache.sh restore` leaves them, and write `index.json` (gzipped as `index.json.gz` over 1 MB): every code with its system and display, and each value set's codes. The IG site's service worker answers the self-hosted Form Builder's LOINC search from it, and its UCUM search from the vendored full UCUM list, so the site makes no cross-site call. `build-ig-site` runs it for every IG with a Questionnaire.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/terminology-index.ts --expansions <expansions> --txcache <txcache> --out <out>" },
    io: {
      inputs: [
        { name: "expansions", schema: t("FilesystemPath"), required: false, description: "`output-ast/expansions.json`." },
        { name: "txcache", schema: t("FilesystemPath"), required: false, description: "`input-cache/txcache/`." },
        { name: "out", schema: t("FilesystemPath"), required: true, description: "Where `index.json` (or `index.json.gz`) is written." },
      ],
      outputs: [{ name: "index", schema: t("FilesystemPath"), description: "The index file, and a count of codes and value sets on stdout." }],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "Building an IG site whose Questionnaires are edited in the self-hosted Form Builder, or whose form views need `answerValueSet` expanded without a terminology server.",
      limits: "Only what the IG's own Publisher run looked up: a LOINC code the IG never used is not in it, and the site says so (\"not in this IG's terminology cache; add it via the FSH source\") rather than asking a server. A cache entry that does not parse is skipped.",
      cost: "Reads the cache once; seconds.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
