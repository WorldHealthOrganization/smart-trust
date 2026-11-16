```
input/, sushi-config.yaml, ig.ini
   │  ig-ast-refresh.yml      (reusable; the only writer of the AST cache)
   ▼
cat/fhir-harness/fhir-ast/<package id>    the AST cache branch
   │  site-publish.yml → cat-harness-tools folio-site-publish.yml
   │                   → stage-local.ts   (no Publisher runs here)
   ▼
gh-pages:  /                   from the default branch
           /branches/<branch>/ from any other branch (a preview)
   │  GitHub Pages
   ▼
https://<owner>.github.io/<repo>/
```

| Workflow | Where it lives | What it does |
|---|---|---|
| [`ig-ast-refresh.yml`](https://github.com/litlfred/fhir-harness/blob/main/.github/workflows/ig-ast-refresh.yml) | this layer (reusable, `workflow_call`) | restores the cache and judges it (`valid`, `stale`, `cannot-tell` or `missing`). If it is not valid, it builds the AST: incrementally when it can, in full otherwise. It seeds the cache branch only from a default-branch commit; otherwise it uploads the AST as an `output-ast` run artifact |
| [`templates/ig-repo-site/ig-ast-refresh.yml`](https://github.com/litlfred/fhir-harness/blob/main/templates/ig-repo-site/ig-ast-refresh.yml) | copied into the IG repository | the caller. Runs on a push to `main` that touches `sushi-config.yaml`, `ig.ini` or `input/`, and by hand. A layer above adds its own `pre-export:` step and `template-repos:` here |
| [`templates/ig-repo-site/site-publish.yml`](https://github.com/litlfred/fhir-harness/blob/main/templates/ig-repo-site/site-publish.yml) | copied into the IG repository, unchanged, then pinned with `bun run cat workflow-pins` | runs on every push to `main`, and by hand for a preview. It calls cat-harness-tools' reusable `folio-site-publish.yml`, which mounts the layers and runs `stage-local.ts --repo .`. With `"publishAfter": ["ig-ast-refresh.yml"]` in the IG's `site`, the publish waits for that commit's AST refresh. The `plan` input adds `--plan`. `check:site-publish-caller` reports a copy that differs from the template |
| [`ig-release.yml`](https://github.com/litlfred/fhir-harness/blob/main/.github/workflows/ig-release.yml) and its [caller template](https://github.com/litlfred/fhir-harness/blob/main/templates/ig-repo-site/ig-release.yml) | this layer (reusable), and a short caller in the IG repository | on a `v*` tag: a full build of the tag, then a GitHub **draft** release with the IG's files. See [Releasing](#releasing) |
| [`ast-export-bundle.yml`](https://github.com/litlfred/fhir-harness/blob/main/.github/workflows/ast-export-bundle.yml) | this layer | publishes the compiled AST exporter once per pinned commit, as the release `ast-export-<commit>`. The refresh downloads it when its sha256 matches `scripts/ast-export-bundles.tsv`, and builds from source otherwise, so no IG repository runs Maven in CI |
| [`publish-qa.yml`](https://github.com/litlfred/fhir-harness/blob/main/.github/workflows/publish-qa.yml) | this layer | publishes this layer's QA results to `cat/cat-harness/qa-reports` |

The rules (when an AST is valid, who may seed the cache, what a stale AST
refuses) are in the `ig-build-pipeline` skill, §"The AST cache lifecycle".
