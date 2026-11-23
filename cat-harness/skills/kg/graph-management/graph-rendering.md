---
name: graph-rendering
description: >-
  Draw any graph in a harness (schemas, processes, a folio's block graph and
  any formal relation its content type adds, a detangle partition) so the picture is derived,
  checkable and readable. Ten rules, which engine to lay a graph out with and
  why, and how each graph typology here applies them.
---

# Graph rendering: one set of rules for every drawn graph

> Skill id: `graph-rendering` · Package: `graph-management`

One set of rules applies to every drawn graph, so that each drawing does not
follow conventions of its own. This skill is the general part. It says what any drawing of a graph owes its
reader. The per-graph skills say how one generator meets it:
[`uml-overview`](../kg-core/uml-overview.md) for schemas,
[`bpmn-authoring`](../../process/workflow/bpmn-authoring.md) for processes, and
[`content-graph`](../../authoring/authoring-core/content-graph.md) for a folio's blocks.

A drawing is how a person READS a graph. [`graph-detanglement`](graph-detanglement.md)
is how the graph is RESTRUCTURED, and it needs the drawing: a partition you
cannot see is a partition you argue about from numbers alone.

## The ten rules

The failure each rule prevents is stated beside it.

1. **Draw from a declared graph, never by hand.** Every node and edge in the
   picture is read from a source: a schema, a declaration, a BPMN file, a
   `uses[]` list, a dependency cache. A wrong picture is fixed at its
   source. A hand-edited diagram is overwritten on the next run, and a check
   fails while it is stale.
2. **Groups are declared sub-graphs.** A box around nodes is a named
   sub-graph (a `directories[]` entry, a chapter, a package), never a
   grouping the renderer invented.
3. **No empty box without a reason.** A node drawn with nothing in it reads
   as a rendering fault. A node with no fields to show carries one line saying
   why. A node whose shape could not be determined is drawn dashed, as a
   finding, never as a quiet empty shape.
4. **Edge kinds are drawn distinctly and never merged.** A graph has more
   than one kind of edge (`edge-kinds-and-blast-radius` (opt-in `cat-harness.kg-ops`)).
   Editorial `uses[]` and a content type's formal edges, enforced and prose-only
   references, and a field-carried link versus one declared elsewhere (the
   UML's dashed `bootstrap.processes:skill` edge) each get their own line style and a
   legend. Merging two kinds into one line destroys the signal every metric
   on that graph is computed from.
5. **Pick the layout engine by what the graph is, and write down why.**
   See §"Layout engines" below. The choice is a claim with a measurement
   behind it, not a taste.
6. **Offer two orientations from one source.** A tall graph on a wide screen
   and a wide graph on a phone are both unreadable. Derive the second view
   from the first (`landscapeOf` in `scripts/plantuml-render.ts`) rather than keeping
   two sources that can drift apart.
7. **Declare colour once.** Colour a node by its family (for the UML: schema,
   scenario, process, state, test) in one stylesheet, and have every renderer
   read that stylesheet (`uml-palette.ts`). A second palette is a second answer
   free to disagree with the first.
8. **Stamp the output with its source's hash.** A rendering whose staleness
   check needs the renderer is a check CI cannot run: Java, a browser, or a
   font set that measures text a pixel differently. Write the sha256 of the
   exact source text into the output and compare stamps. The UML and
   block-graph SVGs do this through `scripts/plantuml-render.ts`, which every
   PlantUML generator shares, with its pinned jar and one JVM for all diagrams.
9. **Show it in a zoomable figure.** On the site, use the `bpmn-figure`
   markup so `docs-ui.js` adds zoom, reset and full-width controls, and the
   export ones: download the SVG, download a 2× PNG, or copy it (as an image
   where the browser allows, else as SVG text, and it says which). A pages
   template missing `layout: default` renders with no site script and so no
   controls, and nothing reports it.

   **There is ONE viewer, and every diagram on a folio or IG page gets it.**
   It is `mountFigure` in `docs-ui.js`; `mountFigures` decides what is a
   figure. Do not write a second one for a new kind of page. Extend what
   `mountFigures` and `inlineDiagrams` recognise instead. It takes each way a
   page embeds a drawing:

   | embedded as | taken by | where it appears |
   |---|---|---|
   | `.bpmn-figure` markup | always | the process pages |
   | an inline `<svg>` | always (an icon-sized one, or one inside a link or nav, is not a figure) | Mermaid, an IG's `{% include x.svg %}` (PlantUML) |
   | `<img src="x.svg">` | always; inlined first | UML overviews, workflow figures |
   | `<object data="x.svg">` | always; inlined first, and its fallback text becomes the name | the IG Publisher's convention for a pre-rendered diagram |
   | a raster `<img>` | only on a page that opts in with `data-fa-figure-images`, and only when the column has shrunk it | an IG's `.drawio.png` architecture drawings |

   The raster row is an **opt-in** because a raster image on the platform's
   own pages is as often a card face or a photo. A site build that knows its
   images are drawings stamps the attribute on the page. The IG site build
   does this on every IG page, and its own skill (`ig-site-links`) says
   where. This skill names no layer, because the viewer belongs to the
   platform.

   At 100% a plain figure is shown at its **own** width, capped at the column.
   It is not stretched to fill the column. A figure that is wider than its
   column scrolls inside its card and never runs past the page's edge.

   **The viewer is keyboard-operable, because the profile is low-dexterity.**
   Drag-to-pan is an accelerator, never the only way to pan
   ([`board-windows`](../../ui/ui-core/board-windows.md) §"The floor"). The
   figure takes focus (Tab from its toolbar). While it has focus, the arrow
   keys pan it, `+` and `-` zoom, and `0` resets. An arrow key is taken only
   when the figure can scroll in that direction. Otherwise the page scrolls as
   usual. The tools layer's `test/ig-diagram-viewer.e2e.ts` checks all of this on
   a fixture page.
10. **Put the measurement on the drawing.** When a graph is being partitioned,
    show each group's detangle numbers (size, cohesion, links in and out)
    beside the group, so the picture and the metric are read together. The UML
    overview pages do this through `detangleResultsDir` (`schemas/kg/detangle-sidecar.ts`),
    the same function the detangler writes through. A number shown without its
    picture invites arguing about the number.

## Layout engines

Measured on the UML overview. Re-measure before relying on it for a different
graph.

| engine | use it for | what it gets wrong |
|---|---|---|
| **stored layout** (BPMN DI) | a graph whose author placed the nodes | nothing to choose: never re-lay a graph that carries its own layout |
| **ELK** (`!pragma layout elk` in PlantUML) | the compact, portrait default; it routes edges around boxes | it lays everything top to bottom and **ignores `left to right direction` and arrow hints** (output byte-identical). Unconnected groups end up in one wide row. |
| **ELK + hidden links** | a grid of unconnected groups (an overview) | nothing, if the column count suits the orientation: `ceil(√(n/2))` for portrait, `ceil(√(2n))` for landscape |
| **Graphviz dot, left to right, polyline edges** | the landscape view of a connected graph | it can route a long edge across a box, which is why ELK stays the portrait default. Use `nodesep 70`, `ranksep 160`. |
| Graphviz with **orthogonal** edges | avoid | it places edge labels away from their edges and runs lines through boxes. |
| Mermaid (dagre) | a secondary view where CSS classes on nodes matter | the same model came out three times taller than ELK's |
| **Graphviz dot in the browser** (WASM, `unflatten` then `dot`) | the interactive view a reader rearranges by dragging nodes ([`kg-subgraph-layout`](kg-subgraph-layout.md)) | like ELK it sets unconnected clusters, and unconnected nodes in one cluster, on one rank: fold both into grids with invisible, marked anchors |

## Applying it

| graph | source | groups | edge kinds | renderer today | owes |
|---|---|---|---|---|---|
| **schemas** | graph-typology registry, Zod schemas | `<instance>/<sub-graph>` | composition; field-carried vs declared elsewhere | `gen-uml-overview.ts` (PlantUML, Mermaid and the DOT of the Interactive view), `gen-object-model-uml.ts` | meets all ten |
| **processes** | `.bpmn` files | pools and lanes | sequence, message, call | `render-bpmn.ts` (stored layout) | rule 6 (orientation) does not apply: the author placed it |
| **folio blocks** and any **formal relation** the content type adds | `buildContentGraph` in `pipeline/content-graph.ts`; status from the content type's status source | chapters | `editorial` (`uses[]`, `interprets`), solid, vs `formal` (the content type's own edges), dashed purple | `gen-content-graph-uml.ts` (Tool `content-graph-uml`), run from a folio | meets rules 1 to 8. Rule 9 waits on a folio page to show it; rule 10 on detangle scanning a folio |
| **detangle partition** | the sidecars under `detangleResultsDir` | detangle groups | enforced / recorded / prose | numbers only; the UML pages show them (rule 10) | a drawing of the cross-group edges themselves |

A folio is **content**, and content lives in a folio repository, not here.
Apply the rules there through the platform's generator, and ask the owner
before a PR in a content repository the owner has said to ask about.

**The editorial and formal relations are one drawing, not two.**
`buildContentGraph` holds both over the same blocks, so `gen-content-graph-uml.ts`
draws them together and keeps them apart by line style. Status fills come from
the same stylesheet as the family colours (`--fa-uml-status-*` in `uml.css`). A
human review outranks an agentic one, which outranks a machine-derived status.
For a paper folio, where the formal relation is Lean's, the science layer's
`lean-formal-graph` (`skill_fetch lean-formal-graph`) says what that edge and
status source are, and which older drawings this one supersedes.

**Never populate `uses[]` from a formal graph to make a drawing look
connected.** The editorial relation is authored; see `AGENTS.md` and
[`uses-editorial-review`](../../authoring/authoring-core/uses-editorial-review.md). Rule 4 is how
the drawing keeps them apart.

## Related

- [`graph-detanglement`](graph-detanglement.md): restructuring the graph this
  skill draws.
- `edge-kinds-and-blast-radius`: why edge
  kinds must stay distinct (rule 4).
- [`uml-overview`](../kg-core/uml-overview.md): the schema diagrams, where
  these rules were first learned.
- [`kg-viewer`](../../ui/ui-core/kg-viewer.md): the shared rule for an HTML
  viewer that fetches its projection by a path relative to itself.
- [`kg-subgraph-layout`](kg-subgraph-layout.md): one declared sub-graph as one
  Graphviz diagram in the i2ce Form Documentor's convention, laid out in the
  browser with draggable nodes. Its viewer is the one exception to rule 9's
  "one viewer", because it re-lays and moves a graph rather than zooming a
  picture, and it keeps the same keyboard floor.
