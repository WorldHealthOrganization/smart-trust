| Output | Where | Notes |
|---|---|---|
| the site | `gh-pages` root | the default-branch publish replaces the root and keeps `branches/` and `_render-log/` (and anything else the IG lists in `site.build.keep`) |
| a preview | `gh-pages:branches/<branch>/` | carries no binaries |
| the AST | branch `cat/fhir-harness/fhir-ast/<package id>` | one orphan commit: the AST, `expansions.json` and `txcache/` |
| the artefact index | `<site>/fhir-artifact-index/` | `index.json`, `menu.json`, `releases.json`, and `package.tgz` |
| per-artefact data | `<site>/artifact/<Type>-<id>.{html,jsonld,json}`, `<site>/<Type>-<id>.json` | the thin pages load these |
| build stamp | `<site>/folio-build.json` | which commit and toolchain built the site |
| release files | GitHub **release assets** of the tag's release | `package.tgz` (and `package.r4.tgz`, `package.r4b.tgz` when built), `ast-data.zip` and `SHA256SUMS`. They are never put on `gh-pages`; `releases.json` records each asset's URL and SHA-256 |
| QA reports | `<site>/assets/fhir-qa/` and the QA report page | includes the content scan and the page scan (below) |

Why binaries stay off `gh-pages`: GitHub Pages serves at most 1 GB. On one
measured IG, 966.5 MB of its `gh-pages` was Publisher binaries copied into
branch previews. See the `ig-binary-artefacts` skill.
