The taxonomy above is what the Knowledge Graph is *for*. What the registry can
actually produce is narrower: the taxonomy is not an inventory.

**Re-derive rather than quote**: `bun run cat kg:export` dumps the graph, and
`instanceRootsIn` plus `readDeclaration` give the directory census directly.
Each registered kind is in one layer of `holds` — `content`, `state`, `context`
or `derived`.

Two kinds are `renderable`: `docs` and `folio`. Renderability is what wires a
graph to the site build; every other graph reaches a reader through a
visualiser the Harness layer builds *over* it, never by being published
directly.

**Skills, Workflows and Scenarios are separate kinds** — `skills`, `processes`
and `scenarios` — so *"give me the Workflows"* is a query on kind, not a match
on a path.

**`cat-harness` is still a kind and is not deprecated.** An alias cannot
express a split: `GRAPH_TYPOLOGY_ALIASES` maps one name to one name. On an
entry declaring `["schemas", "cat-harness"]` it means *a schema IS a
knowledge-graph node*, which is why the skill scanner tests for the kind
**exactly** rather than for its presence. It now means harness knowledge-graph
content whose directory holds more than one part of it. A downstream
declaration still saying `["cat-harness"]` keeps parsing and keeps being
scanned for Skills; it does not get the finer query.

**A directory inside another declared directory is not reached by
convention.** It declares its own kind, or a consumer filtering on kind never
finds it. The generated process index reports such a directory as an
**orphan** rather than quietly indexing fewer diagrams.

**One mismatch between the axes:** `fsh-guts` is registered `context`, though
it is topically Dynamic State. It is read by processes and not written by
them, which is what `context` asserts.

**How a dependent contributes into a shared body of knowledge.** Through the
**kind**, and that is the mechanism rather than a stopgap. Each layer that contributes a Voice declares its own `voices/`
directory of kind `voices`, and the overlay resolves them together. A new
contributor declares a directory, names the kind, and is done: no nesting, no
subgraph declaration, nothing added to the schema. Nested subgraph directories
are not used because they buy a hierarchy nothing needs, at the cost of a
schema change and a migration of every declaration, while the overlay already
delivers the outcome.
