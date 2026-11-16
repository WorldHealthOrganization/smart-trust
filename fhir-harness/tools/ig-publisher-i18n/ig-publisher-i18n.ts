import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-publisher-i18n",
    title: "Put the IG Publisher's QA messages in each language an IG translates into, from the Publisher's own translations first",
    description:
      "Fetches the IG Publisher's own message bundles (`Messages_<lang>.properties` in `org.hl7.fhir.utilities-<core>.jar`, Maven Central) at exactly the core version the AST recorded, and translates each QA message by its `message-id`: the Publisher's translation where it has one whose placeholders match the English, else this layer's catalogue `translations/<locale>/publisher/messages.po` (machine translation, marked as such), else the English. `needs --merge` appends to each locale's catalogue the strings a build lacks, each with an example and deep links to the rows that print it. The site build (`ig-qa-page.ts`) calls it for every locale the IG translates its pages into and publishes `qa-messages.<locale>.json` and `i18n-usage.json` beside the QA report.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-publisher-i18n.ts" },
    io: {
      inputs: [
        { name: "command", schema: t("Text"), required: true, description: "`fetch <core-version> <dir>`, or `needs <qa-messages.json> <bundle-dir> <translations-dir> <locale>...`." },
        { name: "merge", schema: t("Flag"), required: false, arg: { flag: "--merge" }, description: "With `needs`: append what each locale lacks to its catalogue." },
        { name: "site", schema: t("Url"), required: false, arg: { flag: "--site" }, description: "With `needs`: the published site's URL, so a catalogue's links open the rendered rows." },
      ],
      outputs: [{ name: "needs", schema: t("Count"), description: "Strings each locale lacks a translation for." }],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "When an IG's QA report is built for its translated locales, or to see and fill what a locale's catalogue lacks.",
      limits: "Needs curl and unzip and Maven Central for the bundles; without them every message falls back to this layer's catalogue or English, and the build says why. Never substitutes another core version.",
      cost: "One jar download (about 3 MB) per core version, cached under ~/.fhir/publisher-i18n.",
    },
    requires: { runtime: ["bun"], network: true },
    remedies: [
      {
        host: "repo1.maven.org",
        none: "No declared Tool replaces Maven Central for the Publisher's bundles. Put `org.hl7.fhir.utilities-<core>.jar`'s `Messages*.properties` in `~/.fhir/publisher-i18n/<core>/` from a machine that reaches it; without them each message falls back to this layer's catalogue, then English.",
      },
    ],
  }),
);
