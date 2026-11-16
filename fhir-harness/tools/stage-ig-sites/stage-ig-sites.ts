import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "stage-ig-sites",
    title: "Stage every IG whose instance records its source, one Jekyll site each",
    description:
      "Clone each IG whose instance records a sushi-config source in `fhir-artifact-index/menu.json`, at the recorded commit, and stage it with `build-ig-site` (theme, artefact pages, post-processing fills, edit links to the IG's default branch). Served at `/<instance>/` when its docs declare `igSite` (its artefact pages copied in; a collision is refused), else `/<instance>/ig/`. Prints one `<instance> <jekyll source> <at>` line per IG for the caller's `jekyll build`.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/stage-ig-sites.ts" },
    io: {
      inputs: [
        { name: "work", schema: t("RepoPath"), required: true, description: "Scratch directory: each IG's clone and its Jekyll source." },
        { name: "baseurl", schema: t("RepoPath"), required: true, description: "The site's base URL; each IG is served under it at `/<instance>/` or `/<instance>/ig/`." },
        { name: "plantuml-jar", schema: t("RepoPath"), required: false, description: "Render `input/images-source/*.plantuml` as the Publisher does." },
        { name: "remote-theme", schema: t("Text"), required: false, description: "`owner/repo@ref` for Jekyll's remote-theme plugin, instead of the `just-the-docs` gem." },
        { name: "changed-files", schema: t("RepoPath"), required: false, description: "Build only the IGs a changed file reaches (the staging cone)." },
        { name: "compose-into", schema: t("RepoPath"), required: false, description: "Move each staged IG into this host Jekyll source at `<instance>/`, so the host's build renders it: in the thin layout with the host's rail linked (the default), or with the host's full chrome (sidebar, search, language selector) under `--full-pages`." },
        { name: "compose-at-root", schema: t("Flag"), required: false, arg: { flag: "--compose-at-root" }, description: "With `--compose-into` and `--only`: the IG IS the site — compose it at the host's ROOT, based at `--baseurl` itself. An IG repository's own site uses this with a `compose-docs --shell` host, so it wears the main site's chrome." },
        { name: "only", schema: t("Slug"), required: false, description: "Build one IG instance." },
        { name: "source", schema: t("RepoPath"), required: false, description: "With `--only`: a local checkout of the IG's source to build from instead of cloning the recorded commit — an IG repository building its own site in CI." },
        { name: "full-pages", schema: t("Flag"), required: false, arg: { flag: "--full-pages" }, description: "Default: `artifacts.html` and `toc.html` are thin pages over the artefact index node, and composed pages link the host's chrome. With it: full pages; needs `gen-ig-pages --full-pages` too (a mismatch is refused)." },
      ],
      outputs: [
        { name: "sites", schema: t("Count"), description: "IGs staged, one stdout line each; an instance with no recorded source is skipped and reported, never silently." },
      ],
    },
    // Satisfies `docs-generation`: docs-site-publish's Call_InstanceSites descends into `ig-docs-site-compose`.
    satisfies: ["ig-build-pipeline", "docs-generation"],
    subprocesses: ["ig-docs-site-compose"],
    selection: {
      when: "Building the docs site or a staging preview: every IG with a recorded source is staged, and with `--compose-into` composed into the host site.",
      limits: "Needs network to clone each IG at its pinned commit, and to ask its default branch for edit links (absent, pages carry none and the run says so).",
      cost: "Seconds per IG plus the clone; the Jekyll build is the caller's.",
    },
    requires: { runtime: ["bun", "git"], network: true },
    remedies: [{ host: "github.com", none: "It clones each IG's source repository from GitHub; no declared Tool stages an IG without it." }],
  }),
);
