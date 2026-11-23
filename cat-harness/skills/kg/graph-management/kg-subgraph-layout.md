---
name: kg-subgraph-layout
description: >-
  Lay out one declared sub-graph of a knowledge graph (a harness's schema
  overview, one named sub-graph, a declaration's kinds) as a single Graphviz
  diagram in the i2ce Form Documentor's convention, and show it on the site
  laid out in the reader's browser by Graphviz in WebAssembly, with pan, zoom,
  find, keyboard control and draggable nodes. The DOT is a third rendering of
  the model the PlantUML and Mermaid already draw, coloured from the same
  stylesheet. Tool `uml-overview`.
---

# KG subgraph layout: one diagram per declared sub-graph, laid out in the browser

> Skill id: `kg-subgraph-layout` · Package: `graph-management`

This is the general part. [`graph-rendering`](graph-rendering.md) says what
any drawing of a graph owes its reader, and [`uml-overview`](../kg-core/uml-overview.md)
says how the schema diagrams are generated. This skill says how a declared
sub-graph becomes ONE Graphviz diagram a person can rearrange.

## Where the convention comes from

The convention is the **i2ce Form Documentor**:
`I2CE_Page_FormDocumentor::dot()` in i2ce 4.3.3
(`i2ce/modules/Forms/modules/FormDocumentor`). It wrote every form of an iHRIS
site as Graphviz DOT and piped it through `unflatten -f -l 2 -c 2 | dot`. Here
the projection is the UML overview's own model, so the drawing is of a
harness's KG declaration schema rather than of forms.

What is kept from the Form Documentor:

- **A node is a rounded box whose label is a table**: a header, then one row
  per property. The Form Documentor declared `shape="Mrecord"`; here the shape
  is `box` with `style="rounded,filled"`, the same look, because a record
  shape makes Graphviz split the label at every `|`, so a union type
  (`unverified | self-reported`) would come out as three fields.
- **A node is filled by its family.** The Form Documentor read colour schemes
  from configuration; here the colour is the kind's family in `uml.css`, read
  by `scripts/uml-palette.ts`, the one place a kind gets its colour. No second
  palette.
- **The layout is `unflatten`, then `dot`**, run by the viewer, not at build
  time.

## The rules

1. **Draw a declared sub-graph, never the whole graph.** One harness's
   overview or one of its named sub-graphs (a `directories[]` entry).
   [`kg-viewer`](../../ui/ui-core/kg-viewer.md) §"Do not draw the whole graph"
   binds: a layout of everything is a hairball that answers no question.
2. **The DOT is written from the same model as the other renderings**, by the
   same generator, never by hand and never re-parsed from another rendering.
   For the UML overview that is `dot()` in `scripts/gen-uml-overview.ts`, fed
   the same `Section` list as `puml()` and `mmd()`. A wrong DOT is fixed where
   a wrong `.puml` is: in the declaration, the registry or the schema.
3. **Map the model, do not reinterpret it**:

   | model | DOT |
   |---|---|
   | named sub-graph | `subgraph "cluster_<pkg>"`, labelled `<instance>/<id>` and its kinds |
   | class | a rounded-box node, filled with its family colour, with `class="fa_uml_kind_<kind>"` so CSS can find it |
   | field | a row, `name [mult] : type`; a remark row is italic |
   | composition | an edge with a diamond at the whole (`dir=both, arrowtail=diamond`), labelled with the field and its multiplicity |
   | could-not-determine kind | a dashed node that says why; never an empty box (`graph-rendering` rule 3) |

4. **Layout scaffolding is invisible and marked.** `dot` lays unconnected
   clusters, and the unconnected classes inside one, side by side on one rank,
   the same failure ELK has. The generator folds both into near-square grids
   with invisible anchors and edges (the portrait column count of `gridLinks`),
   each carrying `class="kg-graph-anchor"`. The viewer neither lists nor drags
   them, and they assert nothing about the graph.
5. **Publish the DOT where the browser can fetch it**, beside the SVG it is a
   third view of: `docs/assets/img/uml/overview/<instance>[/<sub-graph>].dot`.
   The `.puml` and `.mmd` stay under `uml/overview/` because the page only
   links them. One copy, one writer.
6. **The interactive view is a choice, never the default.** The page keeps the
   static SVG as the first view, so it works without script. The **Interactive**
   choice beside Portrait and Landscape shows a `.kg-graph` element whose own
   text says it needs JavaScript and links the DOT.
7. **No third party at runtime.** Graphviz in WebAssembly is
   `@hpcc-js/wasm-graphviz`, pinned EXACTLY as a devDependency and vendored by
   `bun run cat kg-graph:vendor` into `site-chrome/assets/js/vendor/wasm-graphviz/`,
   with a `LICENSE.txt` (the wrapper is Apache-2.0; the Graphviz compiled into
   it is EPL-1.0) and an entry in `NOTICE`. `kg-graph:vendor:check` fails when
   the copy differs from the pinned package. The viewer imports it relative to
   its own URL and only when a graph is first shown, so a page that is never
   switched to Interactive never fetches 740 KB.

## The viewer: `site-chrome/assets/js/kg-graph.js`

One shared site script for every `.kg-graph[data-dot-src]` element. Do not
write a second one. It:

- lays the DOT out (`unflatten` with `data-unflatten`, default `2,1,2`, then
  `dot`) and inserts the SVG;
- pans (drag the background, arrow keys) and zooms (wheel, `+` / `-`, the
  buttons) by rewriting an aspect-locked `viewBox`; `0` and **Fit** fit;
- drags a node with the pointer: every edge whose `<title>` is `a->b` follows,
  its ends moved with their nodes, its middle in proportion, and each arrowhead
  with the end it is nearer (a composition's diamond is at its TAIL);
- finds a node by its header (or id) and centres it; Shift and the arrow keys
  then move the found node, so dragging is never pointer-only;
- **Reset layout** puts every node back;
- says so, with the DOT's link, when the graph could not be laid out: never an
  empty stage (`kg-viewer` §"Three states").

It carries `fa-figure-scope`, so the site figure viewer (`mountFigure` in
`docs-ui.js`, `graph-rendering` rule 9) leaves it alone: this element has its
own pan and zoom. That is the one exception to "one viewer": the figure viewer
zooms a picture, this one re-lays and moves a graph. It owes the same keyboard
floor.

Colours: none are written in the script. The fills come from the DOT, the
chrome from `uml.css` (`.kg-graph`). Like every diagram on the site the card is
light in both colour schemes, which is what the family tints were measured on.

## With or without the dependent sub-graphs

The overview draws the sub-graphs a layer **itself** declares
(`instanceDirectories`), one diagram per layer. It does not compose an
layer with the layers it `needs`, so a "with dependencies" view does not
exist yet. Composing one is a union of declared sub-graphs along `needs`, and
it belongs in the generator's model, so that all three renderings gain it
together, not in the DOT alone.

## Regenerating and checking

```sh
bun run cat uml:overview            # .puml, .mmd, .dot, pages and SVGs from one model
bun run cat uml:overview:check      # stale or orphaned, the .dot included
bun run cat kg-graph:vendor         # after bumping @hpcc-js/wasm-graphviz in package.json
bun run cat kg-graph:vendor:check   # the vendored copy is the pinned package
bun test cat-harness-tools/scripts/tests/ui/uml-overview-dot.test.ts   # every DOT is its .puml's model, and lays out
```

The browser check is `test/kg-graph.e2e.ts`: on a committed overview page it
asserts Graphviz is fetched only when Interactive is picked, every class is
drawn, find centres a node, a dragged node takes its edge and arrowhead,
**Reset layout** restores them, the arrow keys pan, nothing is fetched from
another origin, and without script the page still shows its picture.

## Related

- [`graph-rendering`](graph-rendering.md): the rules every drawing owes; this
  skill applies rules 1, 2, 3, 4, 7 and 9 to a browser layout.
- [`uml-overview`](../kg-core/uml-overview.md): the generator whose model this
  draws.
- [`kg-viewer`](../../ui/ui-core/kg-viewer.md): no third-party CDN, shared site
  assets, and why the whole graph is never drawn.
