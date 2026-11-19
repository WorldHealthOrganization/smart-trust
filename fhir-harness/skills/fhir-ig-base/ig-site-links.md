---
name: ig-site-links
description: >
  What happens to an IG's links when its pages are rendered on our site rather
  than by the IG Publisher: which are rewritten (artefact pages, a case-only
  mismatch, the Publisher's downloads and pages, files of the IG's repository,
  the OpenAPI index), which are reported as the IG's own dead links, and the
  gate that keeps a generator from linking a page it does not write. Read
  before changing build-ig-site's relinking, gen-ig-pages' links, or before
  concluding an IG page's broken link is ours.
---

# ig-site-links

> Skill id: `ig-site-links` · Package: `fhir-ig-base` · Layer:
> `fhir-harness`

An IG's pages are written for the IG Publisher's output directory: a flat
folder of the IG's pages, every artefact page, its QA report, its download
archives, and whatever its template copies. Our site renders the same pages
inside just-the-docs and holds only some of that. **Every link a page makes
therefore resolves somewhere specific, or is said to resolve nowhere.**

## Where each link goes

| a link to | goes to | by |
|---|---|---|
| an artefact page (`StructureDefinition-X.html`) | `artifact/…` on our site | `relinkArtifacts` |
| …differing only in CASE (`-hcert` for `-HCert`) | the one page it can mean; two candidates leave it alone | `relinkArtifacts` |
| a resource's JSON (`StructureDefinition-X.json`) | the reduced copy at our site's root, as the Publisher names it; the full one is the AST cache's by raw URL (each node's `mirror` encoding) and the release's `package.tgz` | `publisher-pages` (`serveAstData`, `reduceForSite`) |
| a Publisher download (`package.tgz`, `*.zip`) | the IG's published site (sushi `canonical`) | `relinkPublisherOutputs` |
| `qa.html`, on a site that holds the harness's QA report | that page on our site (the FHIR QA and the knowledge graph's, `ig-qa-page.ts`) | `stageIgSite` `qaPage` |
| a Publisher-only page (`qa.html`, `toc.html`, …) | the published site | `relinkOffSite`, `PUBLISHER_PAGES` |
| a FILE of the IG's repository (`.github/…`, `bpmn/x.bpmn` from `input/bpmn/`) | that file on GitHub, at the edit branch | `relinkOffSite` |
| `openapi/index.html` (Swagger's deep links too) | the OpenAPI graph's own index, which forwards `#/<tag>/<operationId>` — on an IG repository's own site too, where `publish-served` puts the graph at `openapi/` | `gen-openapi-pages`, `publish-served` |
| a `.html` page nothing serves | **left as written and reported** — `DEAD in the IG's own source` in the stage log | `relinkOffSite` |

The last row is deliberate. A page that is in no source anywhere is dead on
the IG's own published site too; pointing it there would trade our visible
dead link for an invisible one. Report it to the IG instead.

## A resource's JSON at the root is reduced

A link to `<Type>-<id>.json` resolves on our site, as it does on the
Publisher's (fhir-harness#359), but the file there is reduced: minified, no
`text` narrative, and a Library's ELM attachments without `data` (their
`url` names the full resource in the AST cache; the CQL is a `url` too, to the
IG's `.cql` source or else the full resource). A reader
who needs the narrative or the ELM follows the JSON-LD node's `mirror`
encoding or takes the release's `package.tgz`. The artefact pages read the
full copy themselves.

## Liquid the Publisher accepts and Jekyll does not

The Publisher's Liquid (Java) reads `"<a href=\"x.html\">X</a>"` with escaped
quotes; Ruby Liquid has no escapes and ends the string at the first `\"`.
`rubyLiquidStrings` writes such an `{% assign %}` single-quoted with plain
quotes — the same string in both engines — and leaves one holding an
apostrophe as written, since it has no faithful Ruby form. Without this, a
page shows `<a href=\` for every such link variable.

## The gate: a generator never links what it does not write

`gen-ig-pages` refuses (exit 1) when a page it generates links, within its own
directory, a page that run does not write. The rule for any generator here:
**write a link and the page it points to under ONE condition, and check
it.** A link and its page decided by two conditions (for example a view
written only when the index is `served`) dangle whenever the conditions
disagree.

## Verify on the built site, not on the source

These are found by link-checking the BUILT pages, not by reading the
generator: a full site build, and a check over every relative link in the IG
sections. The stage log's `DEAD` line is the start,
not the whole — it cannot see what a later step (the mount pass) serves.

## An IG's diagrams get the platform's figure viewer

An IG page embeds a diagram in three ways: inline (`{% include x.svg %}`), as
`<object data="x.svg">`, or as an `<img>`, often a `.drawio.png`. All three get
the same pan, zoom, full-width and export viewer as the platform's BPMN
figures. Every IG page carries the `data-fa-figure-images` stamp
(`IG_FIGURE_IMAGES_STAMP` in `build-ig-site.ts`, written by the standalone
layout and by the composed pages' top include), so a raster
drawing that the column has shrunk also gets the viewer. Which embed is
taken, the opt-in, and the keyboard controls are covered in
[`graph-rendering`](../../../cat-harness/skills/kg/graph-management/graph-rendering.md)
rule 9. Do not give IG pages a viewer of their own.

## The chrome's links are not the IG's, and are scoped to the IG's site

The harness rail, the tiles, the navbar icon row and the folders around an IG
page are the PLATFORM's chrome, so none of the rows above covers them. On an
IG repository's own site they come from the platform's `_data/harness.json`,
which `compose-docs --shell --instance <ig>` scopes to that IG: its own paths
resolve under its baseurl, the platform's graphs link to the platform's site,
and no other layer's state graph or count is shown: a tile counts the IG
repository's own graphs, not the platform's. The rule, and why an undeclared
graph shows no number rather than zero, is in
[`harness-tiles`](../../../cat-harness/skills/ui/ui-core/harness-tiles.md)
§"On a folio's own site, a tile describes the FOLIO".
