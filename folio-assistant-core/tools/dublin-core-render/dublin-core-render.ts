import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "dublin-core-render",
    title: "Dublin Core renderings",
    description:
      "Render every `folio-dublin-core/v1` record a catalogue item names as Dublin Core XML (qualified DC, per DCMI's XML guidelines) and as JSON-LD bound to DCMI Metadata Terms. Both are written into the instance's published root (`<instanceRoot>/dublin-core/<stem>.dc.xml` and `.dc.jsonld`), so the site mount publishes them beside the item pages. Deterministic. `--check` fails on a missing, stale or orphaned rendering. Governed by the `dublin-core-renderings` skill.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/dc-render.ts" },
    io: {
      inputs: [
        { name: "instance", schema: t("RepoPath"), required: true, arg: { positional: 0 }, description: "The catalogue instance's root, e.g. an IRIS mirror's directory. It must hold `catalogue/catalogue.json` and declare a directory with `instanceRoot: true`." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Write nothing. Exit 1 if any rendering is missing, stale or orphaned." },
      ],
      outputs: [
        { name: "renderings", schema: t("RepoPath"), description: "`<published root>/dublin-core/`: one `.dc.xml` and one `.dc.jsonld` per record. A one-line summary goes to stdout." },
      ],
    },
    satisfies: ["dublin-core-renderings"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when:
        "A catalogue record changed, a catalogue item was added or removed, or the DCMI mapping changed. The renderings must then be regenerated before the gate passes.",
      limits:
        "Renders only records a catalogue item names. Fields with no DCMI term keep a minted predicate in JSON-LD and are reduced to their DC element in XML. A non-`dc` schema field cannot appear in XML at all, and is listed in a header comment. Not OAI-PMH `oai_dc`.",
      cost: "Milliseconds per record. Reads the catalogue nodes and records; no network.",
    },
  }),
);
