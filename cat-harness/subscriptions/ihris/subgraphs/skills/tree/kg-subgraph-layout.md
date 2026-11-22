---
name: kg-subgraph-layout
description: >
  Lay out a subgraph of the knowledge graph as one Graphviz diagram, in the
  convention of the i2ce Form Documentor (the "giant diagram" of an iHRIS
  site's forms), and show it in the site laid out by Graphviz in WebAssembly,
  with pan, zoom, find and draggable nodes. Generalized from the forms to any
  subgraph through a projection (owner, 2026-10-09). Tool: ihris-kg-layout.
input: src/schemas/skills/kg-subgraph-layout/input.schema.json
output: src/schemas/skills/kg-subgraph-layout/output.schema.json
---

# KG subgraph layout

## Where it comes from

i2ce 4.3.3 shipped a Form Documentor (`i2ce/modules/Forms/modules/FormDocumentor`). Its
`I2CE_Page_FormDocumentor::dot()` wrote every form of a site as Graphviz DOT and piped it through
`unflatten -f -l 2 -c 2 | dot -T gif`. Its colour schemes are in each product's configuration
(`/modules/formDocumentor/schemes/dot/colors`) and its graph options in `FormDocumentor.xml`. `build_kg.py`
extracts both into the module records (`formDocumentorScheme`), with each module's `childForms`.

## The convention (restated over a projection)

`src/tools/kg_layout.py` turns a **projection** into DOT:
`{title, graphOptions, colors, nodes: [{id, header, rows, fill?}], edges: [{from, to, label, kind}]}`.

- A node is an Mrecord table: a boxed header, then one row per property, with its annotation in grey30 (a field's
  label, `*` required, `!` unique, `!∈ {field}` unique with another field).
- Its fill is the colour of the first `substring:colour` that occurs in its id, else `ivory3`. An adapter may set
  `fill` itself, for example from a theme's colours.
- A `ref` edge with one target is labelled unless the property is named after the target. With several targets it
  fans out through a point (a splitter).
- A `child` edge is firebrick.
- The graph carries the declared options, `ratio = auto`, and the title as its label.

## Steps

1. Write an adapter that returns a projection from committed data only (today: `forms_projection(product)` for
   `ihris-manage` and `ihris-qualify`, from the data model and module records).
2. Render it with `to_dot`. The site writes `data-model/graph/<product>.dot` beside a page with the viewer and a
   table twin of the same graph (`site_instances.form_graph_pages`).
3. The viewer, `src/site/kg-graph.js`, lays out the DOT in the browser with `@hpcc-js/wasm-graphviz@1.6.1`
   (`unflatten`, then `dot`). It needs no build step. It adds pan, zoom, fit, find, and node dragging: the edges
   follow, with their ends moved with their nodes and their middles moved in proportion.
4. Check the page in a browser: the graph lays out, find centres a node, and a dragged node keeps its edges.

## Rules

- **Draw only what the data states.** An edge whose target is not in the subgraph is dropped, never invented.
- **Every graph has a table twin** on the same page, for readers who cannot use the diagram.
