import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "publish-extracted-statements",
    title: "Publish extracted statements with source links",
    description:
      "Render each declared page (a `folio-statement-page/v1` spec naming `folio-extracted-statements/v1` lists) as Markdown: every statement extracted from a library source, verbatim, with its kind and status, linked to its library entry and to the section it came from, labelled in the source's own unit (\"Catch up schedule, slide 7\"). A statement whose source does not resolve fails the run and nothing is written. `--check` fails when a committed page is stale.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/publish-extracted-statements.ts" },
    io: {
      inputs: [
        { name: "page", schema: t("RepoPath"), required: true, arg: { flag: "--page" }, description: "A `folio-statement-page/v1` spec (`schemas/extracted-statement.ts`): the statement lists to publish, the page to write, its title and introduction, the library viewer's and the sources' URL prefixes, and the content type's table look. Repeat the flag for several pages. A spec, not flags, because those are free text." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Compare instead of writing: exit 1 when a page is stale." },
        { name: "instance-root", schema: t("RepoPath"), required: false, arg: { flag: "--instance-root" }, description: "The citing instance, against which a source naming no instance resolves; the repository root when absent." },
      ],
      outputs: [
        { name: "page", schema: t("RepoPath"), description: "A generated Markdown page, one table per list: Id, Statement, Kind, Status, Source." },
      ],
    },
    satisfies: ["publish-extracted-statements"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when:
        "Source documents were added to a folio's working artifact (ingestion promoted an entry, or authoring took up a source) and the statements extracted from them must be readable with a link to where each came from, in the artifact and in the shared viewer.",
      limits:
        "It renders what a collector hands it; turning a folio's own extraction format into a statement list is the collector's job. Pages and slides resolve to a section; a page several sections start on names only the page.",
      cost: "Reads the lists and each entry's structure.json; no network.",
    },
  }),
);
