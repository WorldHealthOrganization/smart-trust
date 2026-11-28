---
name: docs-generation
description: >
  How a checkout of this harness generates and publishes its docs site:
  regenerating derived references, composing the docs layers and each
  layer's site into one Jekyll source, building it with just-the-docs,
  the post-build passes, the TypeDoc API reference, the knowledge-graph
  export, and the full-replace publish to gh-pages and its branches/ previews.
---

# Docs generation

The docs site is one Jekyll site built from the checkout's sources and
published to `gh-pages`. The host checkout's `.github/workflows/docs-site.yml`
runs it on a push to the default branch that touches its inputs, or on
dispatch. Its steps, gateways and alerts are drawn in
`docs-site-publish.bpmn` (opt-in `cat-harness.sdlc`).

## Regenerate derived references

Nothing derived is published from a committed copy. Before the build, each
generator rewrites its pages from source, among them:

| What | Command |
|------|---------|
| Pages derived from branch-kept graphs | `bun run cat derive:publish` |
| Skill contract reference | `bun run cat schema:docs` |
| Skill instruction pages | `bun run cat skills:docs` |
| Content-backed docs pages | `bun run cat docs:pages` |
| Graph projections and viewers | `schema:viz`, `library:viz`, … |
| Handler and translation indexes | `handler:index`, `translation:index` |
| BPMN drawings and process pages | `render:bpmn`, `processes:viz` |

Several are Tools in `tools/` that satisfy this skill (`schema-docs`,
`skill-docs`, `bpmn-render`); a Tool's declaration says what it reads and
writes.

## Compose one source

`cat-harness-tools/scripts/compose-docs.ts --out ./_docs` lays the checkout
root's `docs/` over `cat-harness/docs/`, the base. A layer that builds a
site of its own then has its Tool compose that site into the host source at
`<instance>/`. For example, the FHIR IG layer's `stage-ig-sites.ts
--compose-into ./_docs` stages each IG whose layer records its source.
Which layers compose is data in their declarations. The result is one site
with one sidebar, one search and one language selector.

## Build

`bundle exec jekyll build --source ./_docs --destination ./_site` runs Jekyll
4 with the just-the-docs remote theme and the gems in
`.github/pages-jekyll/Gemfile`. Post-build passes then run over `_site`:

- each composing Tool's own pass (for IGs, `build-ig-site.ts --dedupe-ids`);
- `mount-instance-docs.ts`, which mounts every other layer's rendered
  pages under its kind;
- the inline PDF viewer, `set-html-lang.ts`, `search-split.ts` and
  `minify-site.ts`;
- the TypeScript API reference, built into `_site/api` by TypeDoc through
  `.github/actions/typedoc-api`.

## Export the knowledge graph

`kg-export.ts` writes the layer's graph to `<stub>/<stub>.jsonld`, with a
`.json` copy so that Pages serves a JSON media type.
`harness-schema-export.ts` writes its schema, and `kg-viewer.ts` writes the
viewer. Where each endpoint lives and which media type it carries:
[`serving-renderings`](serving-renderings.md) and
[`instance-publication`](../../kg/kg-core/instance-publication.md). The
layer that owns the site root is `site.landing` in `index.config.json`
([`index-config`](../../kg/kg-core/index-config.md)).

## Check and publish

`check:maintained-artefacts`, `check:escaped-markup` and `publish-verify.ts`
check the built tree. `node-views:report -- --site <built tree>` reports,
beside them and without gating, which nodes have no IRI, `.jsonld`, page or
folder-page row (the `node-view-coverage` Tool, `test/results/node-views/`). `publish-gh-pages.sh` then replaces `gh-pages`
wholesale. Before each push attempt it copies in every open pull request's
`branches/<slug>/` preview (`restore-staging.ts`). After the push,
`restore-staging.ts --verify` confirms that the previews survived. Any failure
opens or comments on one publication-manager alert, and the next clean publish
closes it.

## Previews

`.github/workflows/feature-staging.yml` builds the same site for a pull
request and publishes it under `branches/<slug>/`, replacing only that
directory. It removes the preview when the pull request closes.

## Locally

`bun run cat preview:site` builds the site in a sandbox.
`bun run cat-harness-tools/scripts/generate-schema-manifest.ts` writes
`build/schema-manifest.json` for the viewer and the MCP server. Paper PDFs
and Lean API docs belong to the paper layer: see `build-pdf` and
`lean-html-docs` where that layer is mounted.

## Read next

- `feature-staging`: previews and
  build types.
- `publish-verification`: the
  verifier set and the alert.
- [`render-kg-to-cdn`](../../process/workflow/render-kg-to-cdn.md): the
  general publish step that `gh-pages` instantiates.
- `before-after-preview` and
  `rendered-impact`: reviewing a
  rendered change.
