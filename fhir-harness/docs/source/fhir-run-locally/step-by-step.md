`stage-local.ts` runs these named steps in order. The layers supply them, so
you can also run any one of them on its own with `bun run cat <step>`:

| # | Step | Script | What it does |
|---|---|---|---|
| 1 | `ig-site:ast` | `ig-repo-site.ts ast` | restores the AST from the cache branch `cat/fhir-harness/fhir-ast/<package id>` (or keeps a valid `output-ast/`), and refuses a stale one |
| 2 | `ig-site:sidecars` | the landing layer's own | *optional*: API sidecars from the AST, when the landing layer has this step |
| 3 | `ig-index:build` | `build-ig-indexes.ts` | the artefact index, menu and releases in `fhir-artifact-index/` |
| 4 | `render:bpmn` | cat-harness-tools | *optional*: draws the site's process diagrams, which are built at publish and not committed |
| 5 | `ig-site:compose` | `ig-repo-site.ts compose` | first the **content gate** (below), then the thin artefact pages, with the IG's own pages composed at the site root |
| 6 | `ig-site:openapi` | cat-harness-tools | *optional*: a page per OpenAPI operation, when the IG has `openapi/cat-openapi.config.json` |
| 7 | `ig-site:publisher-pages` | `ig-repo-site.ts publisher-pages` | serves the AST's data, guards against leftover Publisher chrome, stamps the build |
| 8 | `ig-site:bar` | `ig-repo-site.ts bar` | the language picker and the IG's slim bar |
| 9 | `ig-site:page-render-qa` | `ig-page-render-qa.ts` | *optional*: opens every page in a headless browser and lists markup shown as plain text, for the QA report. It never fails the build |

**The content gate.** Before anything is staged, `ig-site:compose` checks the
IG's narratives, markdown fields and pages for injection attempts. It needs a
review recorded by an agent in `qa/ig-content-qa.json` for exactly the
content being published, and that file must be listed in
`contentTypes.ig.include`. It refuses a missing or stale review, an open
finding, or any hit of its fixed pattern list. Record a review with:

```bash
bun run cat ig-content-qa:scan                       # what the reviewer reads
bun run cat ig-content-qa:record --reviewer <who>    # write qa/ig-content-qa.json
bun run cat check:ig-content-qa                      # the gate on its own
```

How to do the review is the `ig-content-qa` skill.

The scripts' own usage lines:

```text
ig-repo-site.ts ast [--ig <checkout>] [--work <dir>]
ig-repo-site.ts compose <site source> [--ig <checkout>] [--baseurl <base>] [--plantuml-jar <jar>] [--work <dir>]
ig-repo-site.ts publisher-pages <built site> [--ig <checkout>] [--work <dir>]
ig-repo-site.ts bar <built site> [--ig <checkout>]

ig-ast-build.sh [--ig-root DIR] [--tx URL] [--ast-export-ref SHA] [--work DIR] [--template-repo ID=OWNER/REPO]…
```

To publish an AST you built yourself to the cache branch, so the next render
and CI can reuse it (only from a default-branch commit):

```bash
bash fhir-harness/scripts/ig-cache.sh seed --ig-root . --push
```
