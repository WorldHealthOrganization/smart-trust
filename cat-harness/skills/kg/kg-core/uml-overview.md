---
name: uml-overview
description: >
  Read, regenerate or extend the UML class diagrams of a harness: one per
  harness and one per named sub-graph it declares, plus the harness object
  model. Every box is generated from a declaration and a schema, never drawn
  by hand, so a wrong diagram is fixed at the declaration or the schema, and a
  dashed "could not determine" box is a finding about the registry.
consulted: true
---

# UML overview: generated from declarations and schemas, never drawn

**Every UML diagram here is generated.** Nothing in a class box is typed by
hand. If a diagram is wrong, the fix belongs in a harness declaration, a graph
kind's registry entry, or a schema, and then you regenerate. Editing a `.puml`,
`.mmd` or page under `docs/uml/` is overwritten on the next run, and CI fails
while it is stale.

## What is drawn, and from where

| Diagram | Written by | Tool |
|---|---|---|
| one per harness, and one per **named sub-graph** it declares | `scripts/gen-uml-overview.ts` | `uml-overview` |
| the harness **object model** (Actor, Role, Skill, Process, Task, Todo, Work item, Test, …) | `scripts/gen-object-model-uml.ts` | `uml-object-model` |
| the harness **schemas**: the object model without Work item and Todo, shown at the top of the UML overview page | `scripts/gen-uml-overview.ts`, from `schemasViewPuml` in `gen-object-model-uml.ts` | `uml-overview` |

**Content models get their class diagrams the same way.** A diagram of the
types a CONTENT model uses is derived from that model by its own Tool, never
drawn: an ArchiMate model's "Metamodel in use" page is written by
`archimate-metamodel` and `archimate-pages` (skill
[`archimate-models`](../../ui/ui-core/archimate-models.md)).

**A family no file carries can still be drawn: mark it `derived`.** The
overview draws only the `$schema` families a directory's files carry, so a
kind whose source files are read into a shape in memory (an `.archimate` file
read into Model, Element, Relationship and View) draws nothing of that shape
by default. Register the shape as a family with `derived: true` in the kind's
`nodeSchemas`, give it a validator node naming its Zod schema, and the
overview draws it wherever the kind is: the `archimate` kind's
`archimate-model/v1` (`ArchimateModelSchema`). Never invent a
`$schema` tag on files to get a box drawn.

**A group is a named sub-graph,** meaning one entry of a harness's declaration
(`<instance>.json` `directories[]`), drawn as `<instance>/<entry id>`, for
example `bootstrap/processes`. The generator never invents a grouping.

**A class comes from a node schema,** resolved in this order:

1. the graph typology's `nodeSchemas`, keeping only the `$schema` tags actually
   present under that directory (see
   [`directory-conventions`](directory-conventions.md) §"Node schemas, one per
   `$schema` family");
2. the kind's `validator`: a Zod schema, converted by
   `schemas/kg/to-json-schema.ts`;
3. the kind's `schema` field: an external-schema record (BPMN's terms), or a
   module named with no fields.

When none of these applies, the kind is drawn **dashed, as "could not
determine"**, with the reason. That box is a finding about the registry, not an
empty shape. Close it by registering a node schema, not by editing the diagram.

## Where the output lives

- `uml/overview/<instance>.puml|.mmd`: every sub-graph of one harness, stacked
  vertically, with every data field.
- `uml/overview/<instance>/<sub-graph>.puml|.mmd`: one sub-graph.
- `docs/assets/img/uml/overview/…svg`: the PlantUML rendering of each
  `.puml`, laid out by ELK. This is the figure each page shows, in the same
  `bpmn-figure` markup as the BPMN diagrams, so it gets the same zoom,
  full-width and export controls (download SVG, download PNG, copy). An
  overview with more than three sub-graphs is folded into a near-square grid
  by hidden links between packages, because ELK otherwise lays unconnected
  packages in one row.
- `docs/assets/img/uml/overview/…dot`: the same model as Graphviz DOT,
  written by `dot()` from the same sections as the `.puml` and `.mmd`, and
  published beside the SVG because the reader's browser fetches it. Each page
  offers it as a third view, **Interactive**, beside Portrait and Landscape:
  `assets/js/kg-graph.js` lays it out with the site's vendored Graphviz WASM,
  and the reader can pan, zoom, find and drag nodes. The convention and the
  viewer are [`kg-subgraph-layout`](../graph-management/kg-subgraph-layout.md).
- `docs/uml/overview/…`: the pages. Each shows the SVG, then a table of its
  sub-graphs, then the same model drawn by Mermaid, and links both source
  files. The table carries each sub-graph's detangle numbers (nodes,
  cohesion, links in and out), read from `detangleResultsDir` in
  `schemas/kg/detangle-sidecar.ts`, the same function the detangler writes
  through, or *not measured* where the detangler does not
  scan. So a change to `detangle/results/` makes these pages stale, and
  `uml:overview` must be re-run with `kg:detangle`. Every page carries
  `layout: default`, or it renders bare, with no site script and so no zoom
  controls. Published at
  `<site>/uml/overview/<instance>.html`; the index is
  `<site>/uml/overview/index.html`. The site menu has a **UML overview** entry
  with one child per harness. The sub-graph pages stay out of the menu and are
  linked from their harness page, because a menu listing every sub-graph would
  be too long to scan.
- `uml/harness-object-model.puml`: the object model, and
  `docs/assets/img/uml/harness-object-model.svg`, shown second on the UML
  overview page. `gen-object-model-uml.ts` writes the `.puml` only where the
  `beans` CLI is installed, so `gen-uml-overview.ts` renders the committed
  file and never rewrites it. Its stamp check needs neither Java nor work items.
- `uml/harness-schemas.puml` and `docs/assets/img/uml/harness-schemas.svg`:
  the schemas view: Schema, Role, Actor, Skill, User Story, Process, Task
  and Test. It leaves out Work item, the one class read from the `beans` CLI, so
  unlike the full model it is checked in CI.

**Colours are declared once, in `site-chrome/assets/css/uml.css`**, one CSS class per
graph typology in five families: schema, scenario, process, state and test. The
Mermaid pages take them from CSS directly. The `.puml` files write the same
colour onto each class, read from that stylesheet by `scripts/uml-palette.ts`,
because PlantUML's SVG has no CSS hooks and ELK drops package colours. To
recolour a kind, edit `uml.css`, never a diagram.

## Portrait, landscape and interactive views

Every figure is rendered twice, and the page has a **Portrait / Landscape**
switch above it: radio buttons and CSS in `uml.css`, no script, with portrait
as the default. A third choice, **Interactive**, shows the DOT laid out in the
browser ([`kg-subgraph-layout`](../graph-management/kg-subgraph-layout.md));
without script it says so and links the DOT, and the portrait SVG is still
the default.

- **The committed `.puml` is the portrait view.** The landscape view is
  derived from it by `landscapeOf` in `scripts/plantuml-render.ts`, shared with
  every PlantUML generator, and rendered to
  `<name>.landscape.svg`. It is not committed as a second source, so the two
  views cannot say different things.
- **ELK ignores direction.** `left to right direction` and arrow hints left
  its output byte-identical (measured). So landscape comes two ways:
  - a grid of unconnected packages (an overview page) stays on ELK with more
    columns. The `' grid:` comment line in the `.puml` names the packages;
  - a diagram with edges between classes switches to Graphviz, left to
    right, with straight-segment (polyline) edges, `nodesep 70` and
    `ranksep 160` — not orthogonal edges, whose labels Graphviz places away
    from the lines. Graphviz can route an edge across a box, which is why ELK
    stays the portrait default.

## Regenerating

```sh
bun run cat uml:overview           # write every overview diagram, page and SVG
bun run cat uml:overview:check     # CI: fail if any is stale or orphaned
bun run cat-harness-tools/scripts/gen-object-model-uml.ts           # the object model
bun run cat-harness-tools/scripts/gen-object-model-uml.ts --check   # needs the beans CLI
```

**The SVGs need Java,** and the generator fetches the pinned PlantUML jar
(checked against its sha256) into `~/.cache/folio-assistant/`, or uses
`PLANTUML_JAR`. Without Java it writes everything else and exits 2. The check
needs no Java: each SVG is stamped with the sha256 of the `.puml` it was drawn
from, and `--check` compares stamps. Comparing SVG bytes would fail on any
runner whose fonts measure text a pixel differently.

Run `uml:overview` after changing a declaration's `directories[]`, a graph
kind's `nodeSchemas`, `validator` or `schema`, or any schema those point at.

**The object model's `--check` needs the `beans` CLI**, because the Work item class is
read from `beans graphql --schema`. Without it the check exits 2, "could not
check", and never passes. That is why it is not a CI gate.

## Invariants the generators keep

- **No silently empty box.** A converter change can return empty schemas for
  every box, so the overview throws on a resolved schema with no properties,
  and the object model refuses to write if a relationship's field is missing.
- **A family is drawn only where it lives.** Each sub-graph draws only the
  `$schema` tags found in its own directory, not the kind-wide `nodeSchemas`
  map.
- **A JSON Schema document is its own class.** A sub-graph of JSON Schema
  files is not drawn as its draft-07 metaschema. Documents with no properties
  (value sets, `$ref` compositions) are listed one line each in a single
  summary class; a composed field stays a line in its parent; a kind with no
  readable shape carries one italic line saying why. No generated class is
  empty, and a new empty one is a regression.
- **Importing a generator writes nothing.** Each main block is guarded by
  `import.meta.main`, because a write on import dirties the tree in CI. A new
  generator needs the same guard.

## Related

- [`graph-rendering`](../graph-management/graph-rendering.md): the general
  rules this generator is the first full application of.
- [`graph-detanglement`](../graph-management/graph-detanglement.md): the
  practice whose numbers (size, cohesion, links in and out) each page shows
  beside its sub-graphs, read from `detangle/results/`.

## A 404 on a page you just merged

The site build writes the page to `gh-pages`, but GitHub Pages deploys from that
branch **separately**, and every staging-preview push cancels the deploy before
it. Before calling a page missing, look for the file on `gh-pages`
(`git ls-tree -r origin/gh-pages | grep uml/`). If it is there, wait for a
"pages build and deployment" run that is not cancelled.
[`ci-health`](../../process/process-core/ci-health.md) treats `cancelled` as a third state for this reason.
