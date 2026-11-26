import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-repo-site",
    title: "Build an IG repository's own site from its cached AST, with no instance declaration",
    description:
      "The three checkout scripts the platform's site build runs for a repository that holds an IG and only mounts layers (`index.config.json`): `ig-site:ast` restores the AST from the IG's cache branch (`ig-cache.sh restore`) and judges it, refusing a stale, cannot-tell or absent one (a stale one is accepted for a preview by default, refused with `SITE_ACCEPT_STALE_AST=0`, and never accepted for the root); `ig-site:compose` derives the artefact index from the AST (binding any IG API sidecars a layer above left in `$SITE_WORK/ig-api/`), writes the thin artefact pages, stages the IG's `input/` and `sushi-config.yaml` (menu read at build time, palette from the webpage theme of the top layer the repository mounts, edit links from its origin) and composes it at the ROOT of the host site source; `ig-site:publisher-pages` serves each of the AST's resources once, as `<Type>-<id>.json` at the root (no `ast-data/` mirror) — reduced (minified, no narrative, no ELM data, the ELM attachment pointing at the full copy) when the pages read the full resources by raw URL from the AST cache commit, and off with `SITE_ROOT_RESOURCES=0` — the artefact index (or `fhir-artifact-index/index.ref.json`, pointing at the cache's copy) and the sidecars (or none, read from the cache), refuses a page wearing the IG Publisher's chrome, repairs repeated element ids and stamps `folio-build.json`. Never runs the Publisher and never reads its output. Compose lists the pages it puts in the site in `FOLIO_SITE_UPSTREAM_PAGES`, so the site build reports the IG's own dead links rather than refusing the publish over them.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-repo-site.ts" },
    io: {
      inputs: [
        { name: "ig", schema: t("RepoPath"), required: false, description: "The IG checkout; the current directory by default." },
        { name: "baseurl", schema: t("RepoPath"), required: false, description: "`compose`: the site's base path; `FOLIO_SITE_BASEURL` from the site build when absent." },
        { name: "plantuml-jar", schema: t("RepoPath"), required: false, description: "`compose`: render `input/images-source/*.plantuml` as the Publisher does." },
        { name: "work", schema: t("RepoPath"), required: false, description: "The site build's work directory (`SITE_WORK` when absent): where `ast` writes its verdict, a layer above leaves the IG API sidecars, and `compose` the index `publisher-pages` serves." },
      ],
      outputs: [
        { name: "pages", schema: t("Count"), description: "Pages composed, or AST files served." },
      ],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "Publishing an IG repository's own site, as `stage-local.ts` does for a harnessed IG repository.",
      limits: "Needs the IG's AST cache branch (`ig-ast-refresh.yml` writes it) and the network to fetch it; asks the IG's origin for its default branch for edit links (absent, pages carry none). Never runs the Publisher.",
      cost: "Seconds to restore and compose; serving the AST is proportional to its size.",
    },
    requires: { runtime: ["bun", "git"], network: true },
    remedies: [{ host: "github.com", none: "The AST IS a fetch of the IG's cache branch; offline, an AST already restored into `output-ast/` is judged and used as it is." }],
  }),
);
