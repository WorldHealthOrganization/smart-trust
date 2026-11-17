---
graph-typologies:
  - fhir-artifact-index
---

# ig-artifact-ingestion

> Skill id: `ig-artifact-ingestion` · Package: `authoring-who-smart-guidelines` ·
> Covers fhir-harness's `fhir-artifact-index` graph typology (schema
> `fhir-harness/schemas/fhir-artifact-index.ts`).

The artefact index of a FHIR Implementation Guide is a knowledge graph keyed
by the IG's own canonical URLs, linking each artefact to its JSON, JSON Schema
and JSON-LD representations. No IG publishes such an index itself, so it is
always **assembled**, and it records what each part was built from. This
skill says how an index is assembled in this harness; it does not judge
whether an IG's content is correct (that is `fhir-validation`'s job).

## Which IGs carry the IG API overlay

Every IG gets an index; the JSON Schema and JSON-LD links come only from an
**IG API** (WHO calls it the DAK API): the per-artefact sidecars and the
enumeration schemas (`ValueSets.schema.json`, `LogicalModels.schema.json`)
that [`dak-postprocessing`](dak-postprocessing.md) steps 3–6 produce. The
index's `sidecarApi` says which:

- `present` — sidecars were found and bound to artefacts;
- `absent` — the source was read and held none;
- `unknown` — nobody looked. **`unknown` is not a kind of `absent`**: only
  `absent` is a reason to stop.

An IG with no IG API is a thin index, not an error.

## Where the index is built: at publish, from the AST

An IG layer does not commit its `fhir-artifact-index/`. fhir-harness's
`ig-index:build` (`fhir-harness/scripts/build-ig-indexes.ts`) writes it at
publish:

| document | schema | built from |
|---|---|---|
| `index.json` | `folio-fhir-artifact-index/v2` | the IG's cached AST, by `ast-to-artifact-index.ts`; its manifest says `authority: "cache"` |
| `menu.json` | `folio-ig-menu/v1` | the IG's own `sushi-config.yaml` `menu:`, at the commit the checkout's lock pins (`buildMenu`) |
| `releases.json` | `ig-releases/v1` | the repository's GitHub releases, as pointers to their assets; a failed read writes no file, because no list is not an empty list |
| `package.tgz` | — | the AST's resources, as `package/<Type>-<id>.json`, with a `package/package.json` from `sushi-config.yaml` |
| `sidecars/` | — | the IG API sidecars a layer above writes (`ig-site:sidecars`), bound to the artefacts |
| `contexts/` | — | each `.jsonld` under `input/images/` whose only key is `@context` |

The IG's **status** sits in `index.json` beside its version, from its own
ImplementationGuide. An index that records none has no status this pipeline
can state and draws no watermark; that is not "published". (A separate
`ig-identity.json` once held it and drifted from the IG's sushi-config; it was
excised on 2026-11-14.)

Each document has a **different source**, so each carries its own
provenance. Folding two together would give one file two answers to "where
did this come from".

### The menu is the IG's own ordering of itself

`sushi-config.yaml`'s `menu:` is a nested **map**, and order is the file's
order. Never sort it: that would re-navigate somebody else's IG. Read it from
the source config, never from a screenshot: a picture carries no hrefs, and a
closed dropdown looks like an empty one.

### The chrome comes from a chain, and only part of it is the IG's own

An IG declares its appearance in **no file it owns**: it comes from the
`fhir.template` chain its `ig.ini` names, for example

```
local-template  →  who.template.root 0.5.0  →  fhir.base.template 1.0.0
```

So the chrome (`folio-ig-chrome/v2`) is keyed by the chain's top template and
lives once, in smart-base's `themes/chrome.json`, worn by every IG on that
chain. It carries `layers` base-first, and every token records which package
**won** it and what it **overrode**, which is how to answer *whose value is
this?* For example `who.css` styles no `#publish-box`, so the yellow box is
HL7's: the token comes out `from: "fhir.base.template"` with `overrides: []`.

**An overlay is not a merge.** `--toc-box-border` is `1px solid navy` in HL7
and `navy` in WHO — each right in its own layer, but together they make HL7's
rule resolve to `border: navy`, which is invalid. Every layer parses on its
own, so a naive merge ships a broken rule silently.

### Upstream defects are recorded, never corrected

The chrome mirrors its sources, defects included, and records whose each
defect is:

- **`shape`** — one token name carrying different kinds of value across
  layers, as above.
- **`malformed`** — a value that is not valid CSS on its own terms, such as
  `--breadcrumb-text-color: ##555555` (a doubled `#` in HL7's
  `project.css`).

A carried defect shows up in generated pages looking exactly like an ingest
bug, which is why the record names its owner. The detector matches one
narrow pattern: a false positive would accuse someone else's stylesheet of a
fault it does not have.

`ingest:ig-chrome:check` compares the committed chrome with the template
chain. CI cannot fetch the template repositories, so with no source it exits
**2** (`could not determine`), never 0, and it is registered as a `report`,
not a gate. Run it by hand after cloning the IG and its templates.

## What the AST does not carry

- **Category.** The Publisher assigns editorial categories when it writes
  `artifacts.html`, after the AST is taken. The index uses the Publisher's
  default grouping by resource type and names every artefact where a
  published grouping differs (`--keep-published-grouping` keeps the grouping
  of a committed index still on disk).
- **Where it is published.** A canonical URL is an identity, not an address.
  The published base is the committed copy's `source.of` when that names a
  published site, else the layer declaration's `iriBase`, else none, and
  the run says which. Never derive either the published base or
  `canonicalBase` from the other.

AST-built artefacts are `materialized` with purpose `compiled`, and carry the
gates of `folio-assistant-core/schemas/materialization.ts`. `sourceLoss` and
`copyright` stay `unknown` until someone establishes them; a `permitted` there
would claim "no restrictions known" without having looked.

## What is never invented

- **`canonical` is optional.** Examples and instance resources have no
  canonical URL and are most of a large IG. Minting one produces an
  identifier that resolves to nothing while looking authoritative.
- **`category` absent never means "Other".** The IG's own artefact page has a
  literal `Other` section; a second one would make the word mean two things.
- **A lossy field is left absent, not repaired.** An absent field is a fact; a
  repaired one is a guess.

## When the source is a published site

The schema also accepts an index read from a published IG (`source.kind`
`gh-pages`, `output` or `url`), with `provenance` naming the published file
each part came from. These are different evidence: `output/` is a **local
build**, `gh-pages` is **what the world can see**; never label one as the
other. A published IG offers four partial views, none sufficient alone:

| file | holds | misses |
|---|---|---|
| `canonicals.json` | canonical URL, version, name | every artefact without a canonical |
| `package.tgz` → `package/.index.json` | every artefact's type and id | titles, categories, canonicals |
| `artifacts.html` | the editorial **category** and human title (per-row `title` is `ResourceType/id`) | anything machine-readable |
| `package.manifest.json` | package id, version, FHIR version, build date | — |

Traps:

- **Read the source, not the page about it.** `dak-api.html` links the
  enumeration schemas under `schemas/`, but they sit at the published root.
- **`openapi/openapi.json` is not the IG API.** On the WHO SMART Trust IG it
  is the DDCC Gateway API, subject matter that lives there. Key the overlay
  off each artefact's own stem (`<ResourceType>-<id>.openapi.json`), never a
  directory scan.
- **`.index.json` is lossy** (Organization entries can carry a truncated
  `"type": "["`). `canonicals.json` is the spine for anything canonical; a
  field seen only in `.index.json` stays absent.

## Running it

```sh
bun run cat ig-index:build -- [--only <instance>] [--work <dir>] [--plan]
```

`--plan` prints what would be built and touches nothing. Exit 0: every IG
found was built; 1: one or more failed (each named); 2: usage.

An IG layer is found, with no declaration of its own, when it needs
fhir-harness (directly or through a layer above), declares a `repository`,
and that repository carries an AST branch family. A layer missing any of
the three is skipped, and the run says which and why. To add an IG, give it
those three; never commit or hand-edit the index it produces.
