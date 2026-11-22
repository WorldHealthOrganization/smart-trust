# archimate — cat-harness's ArchiMate subgraph

A **named subgraph of cat-harness** (`archimate`, declared in
[`cat-harness.json`](../cat-harness.json); the graphs inside it are declared
from within, in [`graph.json`](graph.json)), on the pattern of the
[`openapi`](../openapi/README.md) subgraph. Owner, 2026-10-09: *"need new
specialixed harness (like openapi) for archimate content in the KG"*.

A layer that holds ArchiMate models — an architecture it documents, drawn
in [Archi](https://www.archimatetool.com/) — declares them here and gets, for
the model and for every **view, element and relationship** in it:

- an **IRI**, the address of the node's own JSON-LD, keyed by Archi's own id,
  so an element keeps its IRI across versions wherever Archi kept its id;
- a **page**, drawn in the browser from the model: a model's views and its
  elements by layer; an element's documentation, properties, relationships and
  the views it appears in; a relationship's ends;
- for every view, a **drawing**: SVG made from the bounds and bendpoints the
  model stores, in ArchiMate's notation, every box a link to its element.

**No Java, no Archi CLI, no Archi HTML report — anywhere in the pipeline.**
Archi's command line needs a JVM, a virtual display and a ~200 MB download per
run, which is too heavy for CI and impossible in a web client, and what it
draws is not addressable in the graph (owner, 2026-10-09: *"do not do java
200mb... that's not usable for webclients and is too heavy"*). Authors draw in
Archi on their own machines; everything published is made here, in
TypeScript. The discipline is the skill
[`archimate-models`](../skills/ui/ui-core/archimate-models.md); the Tools are
`archimate-check` and `archimate-pages` (`tools/index.ts`).

| graph | path | typology |
|---|---|---|
| `archimate-validators` | [`validators/`](validators/) | `validators` |
| `archimate-typologies` | [`typologies/`](typologies/) | `typologies` — the `archimate` kind |
| `cat-harness-tools-archimate-schemas` | `archimate/schemas/` in [cat-harness-tools](https://github.com/litlfred/cat-harness-tools/tree/main/archimate/schemas) | `schemas`, `code` — the Zod schema, moved by work item `8lcl` |

## The one rule

**The model is its authors'; the pages and drawings are renderings of it, and
copy nothing.** A model is authored in Archi and committed where it is held —
unlike an OpenAPI document, which is ingested from somebody else's
repository, which is why this kind is `content` where `openapi` is
`derived`. Every page is a thin page (`cat-harness-tools/scripts/thin-page.ts`):
identity and a pointer. What a page shows is drawn by one shared loader from
the model, normalised (`<model>/model.json`). A fix to a view is made in
Archi, and shows on the next build.

## What a layer declares

1. A directory of graph typology `archimate` in its `<instance>.json` —
   `served: true` only if the pages are written into the graph itself.
2. `cat-archimate.config.json`, at its root or inside that directory, naming
   the directory and each model by its `file` there
   (`schemas/archimate.ts`, `ArchimateConfigSchema`).
3. `cat-harness` in its `needs` — directly or through its closure.

Then:

```sh
# the gate: every configured model is held, parses, and resolves; no other is held
bun run cat-harness-tools/archimate/scripts/check-archimate.ts --instance <dir>
# into a site being built — what a folio's staging build runs
bun run cat-harness-tools/archimate/scripts/gen-archimate-pages.ts --instance <dir> --out _site
# or into the graph itself, gated with --check
bun run cat-harness-tools/archimate/scripts/gen-archimate-pages.ts --instance <dir> [--check]
```

`--out` exists because a model is large: smart-ra's four versions are 5,809
pages and 131 drawings, about 24 MB, written in under two seconds. They belong
in a build, not a commit.

## Where the pages and IRIs land, under the graph's path

| what | path | |
|---|---|---|
| the model | `<m>.jsonld`, page `<m>/`, data `<m>/model.json` | `archimate:Model` |
| a view | `<m>/views/<id>.jsonld`, page `<m>/views/<id>/`, drawing `<m>/views/<id>.svg` | `archimate:Diagram` |
| an element | `<m>/elements/<id>.jsonld`, page `<m>/elements/<id>/` | `archimate:<Type>` |
| a relationship | `<m>/relationships/<id>.jsonld`, page `<m>/relationships/<id>/` | `archimate:<Type>` |

Types are the Open Group exchange format's names in its namespace
(`http://www.opengroup.org/xsd/archimate/3.0/`); nothing is minted here. A
view's SVG links relative to its own address, so it works standalone, in its
page, or embedded in a document as a figure.

In a site build (`--out`) the data stays at the graph's path, so no IRI moves,
and the **pages** go to the route of the visualiser the layer declares for
the `archimate-pages` Tool, `<locale>/<harness>/<id>/` (owner, 2026-10-09:
every visualiser page at `<base>/<harness>/<visualiser>`). smart-ra declares

```json
"visualisers": [{ "id": "archimate", "renderedBy": "archimate-pages", "covers": ["archimate"] }]
```

so its pages are at `en/dpi-h-ra/archimate/`. A layer that declares none
gets no site pages: the run stops and says what to declare, rather than write
to a route nobody declared. Every site page carries `rendered-by`, which is
how `check:visualiser-routes` holds it to the route.

## What is read, and what is not yet

Archi's native format, plain or zipped. Not yet: the Open Group exchange
format; custom images and fonts on a diagram (a box is drawn in the notation's
colours with its type named in the corner, not with Archi's icons); sketch and
canvas views; ingesting a model from another repository, which would add a
`source` to the config as the openapi config has.

## Which way the dependencies run

```
bootstrap → bootstrap-tools → cat-harness (incl. archimate/) → (instances that hold ArchiMate models)
```

Code here may import the rest of `cat-harness`, and nothing above it.
