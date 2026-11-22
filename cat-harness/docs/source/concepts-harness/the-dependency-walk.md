### Bottom-up, from the bootstrap

The stack is walked **from the lowest layer up**, and each layer overlays
what the ones beneath it declared. A Skill, a Voice or a directory contributed
low is visible everywhere above it; one contributed high is visible only there.
Where two layers contribute the same name, **the root wins** — it is resolved
last precisely so that it can.

The order is **declared, not computed**, in each layer's `needs` array:

```json
{ "name": "<content-core>", "needs": ["bootstrap", "cat-harness"] }
```

It is declared so that no consumer has to hardcode the layer names.

`needs` is **OPTIONAL**, and an absent value means *undetermined* rather than
*needs nothing*. `[]` is a layer asserting
it sits on nothing, which is true of exactly one layer here, while absent is
nobody having said. A consumer treating absent as `[]` would place every
unlabelled layer on the floor beside the bootstrap. Names are used rather
than paths, because a layer is identified by its `name` everywhere else and
a path breaks the moment a directory moves.

### Three relations, and they are not interchangeable

Between repositories — as opposed to between layers in one checkout — the
[Knowledge Graph page](knowledge-graph.html#repositories) sets out three relations, and a fourth, **associated**, needs no order at all. Each has its
own carrier here:

| relation | runs | carried by |
|---|---|---|
| **depends** | Content → Content | `needs` — the layer stack, foundation first |
| **references** | Tool → Content, Test → Content | `remoteGraphs` — a graph this layer knows about and does not hold |
| **utilizes** | Tool → Tool, Test → Tool, App → Content | `dependencies` in the config — what this layer USES, overlaid |
| **associated** | Content ↔ Content, any harness | `associatedHarnesses` — a harness this one knows, and where it is published; never loaded or materialized (skill `associate-harness`) |

**Only `depends` fixes an order**, so only `depends` can have a cycle in it,
and a cycle there is a defect rather than a shape. A Tool repository
*references* a Content repository without sitting above or below it; a consumer
application *utilizes* a Content repository it may depend on not at all. That
is why a consumer needs all three and collapsing them loses the distinction:
"what must be built first", "what do I know exists", and "what do I read at run
time" are three questions with three answers.

### The bootstrap is the exception, and the floor rises

`bootstrap` sits at the bottom and does not render. It is the navigation
footer; what it owes instead is its own `.json` and `.jsonld` — *"that is its
existence"*. The rendering obligation is a **floor that rises**: it starts at
`cat-harness`, which is obliged because it supplies the layers above it with
`folio/`. A layer below that floor declares its exemption in
`renderExemption` rather than being silently excused, so the exemption is a
statement somebody made and not a gap somebody left.
