import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-pages",
    title: "Generate an IG instance's reader-facing pages from its artefact index",
    description:
      "Write `<instance>/docs/` — an index page, one page per artefact, a page per over-large category and per menu group — from `fhir-artifact-index/index.json` (and `menu.json` when ingested), styled by the template chrome an owning instance ingested. For an instance whose docs declare `igSite` it writes no index, menu or category pages — the IG site's own replace them — and only a front-matter `artifacts.md` naming the Tool that drew it. `build-ig-site` renders an IG's narrative pages from source; this Tool writes the artefact pages for every IG instance (`stage-ig-sites` copies them in).",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/gen-ig-pages.ts" },
    // What this Tool CAN draw. A layer declares that it DOES, in its
    // own `visualisers` (`renderedBy: ig-pages`), and
    // `check:visualiser-routes` checks the covered kind is listed here.
    renders: ["fhir-artifact-index"],
    io: {
      inputs: [
        { name: "instance", schema: t("RepoPath"), required: true, arg: { flag: "--instance" }, description: "The instance directory: holds `fhir-artifact-index/` and receives `docs/`." },
        { name: "site", schema: t("RepoPath"), required: false, arg: { flag: "--site" }, description: "Where an instance declares a visualiser `renderedBy: ig-pages`, the Tool writes that visualiser's route page. With this site directory it writes ONLY those route pages (`<locale>/<harness>/<id>/` and, per instance, `…/<instance>/`) under it: not `docs/`, not the instance. Each opens the IG's artefact index." },
        { name: "label", schema: t("Text"), required: false, description: "The IG's display name. The index carries only the package id, which stands in when this is absent." },
        { name: "chrome-owner", schema: t("Text"), required: false, description: "The instance whose `chrome.json` styles the pages. Absent, the pages are unstyled and the build says so. The banner's identity is always the index's; a chrome ingested from another IG lends its tokens, never its status." },
        { name: "summary", schema: t("Flag"), required: false, description: "Open the index page with the instance's own declaration (`harness_details.html` with `instance=`), making it the instance's landing page." },
        { name: "full-pages", schema: t("Flag"), required: false, description: "Default: each artefact page is a thin shell at the same address, with its JSON-LD node, the index node (`artifact/index.jsonld`) and the shared renderer `assets/ig-artifact.js`. With it: full pages, no JSON-LD." },
        { name: "jsonld-base", schema: t("Url"), required: false, description: "Thin pages only: the docs root's published URL, so each node's IRIs are absolute. Absent, they are relative to the node's own file." },
        { name: "compiled-data", schema: t("RepoPath"), required: false, description: "Where a compiled index's resource files are served, as a path from the docs root. `.` means each is served once at the docs root as `<Type>-<id>.json`, as the IG site does; a docs root beside the AST passes `../ast-data`." },
        { name: "check", schema: t("Flag"), required: false, description: "Write nothing; exit 1 when any page is stale or orphaned." },
      ],
      outputs: [
        { name: "pages", schema: t("Count"), description: "Pages written; the menu and chrome are reported as present or COULD NOT DETERMINE, never silently absent." },
      ],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "Building the docs site or a staging preview: an IG instance needs its artefact pages.",
      limits:
        "Narrative pages are not held — the harvest keeps artefacts — so menu entries link upstream. Bodies are still partly HTML inside markdown.",
      cost: "Seconds; one file per artefact.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
