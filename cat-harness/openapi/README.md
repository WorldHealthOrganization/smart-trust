# openapi — cat-harness's OpenAPI subgraph

A **named subgraph of cat-harness** (`openapi`, declared in
[`cat-harness.json`](../cat-harness.json); the graphs inside it are declared
from within, in [`graph.json`](graph.json)). Until 2026-10-07 this was an
layer of its own, `cat-openapi`; the owner folded it in: *"put cat-openapi
under cat-harness as named subgraph "openapi", not separate repo."*

A layer that holds an OpenAPI 3 document — an API it documents, depends on
or publishes beside its own content — declares it here and gets, for every
operation in it:

- a **page**, drawn in the browser Swagger-style from the published document:
  method and path, summary and description, parameters, request body,
  responses and their schemas;
- an **IRI**, the address of the operation's own JSON-LD node, which names the
  document it belongs to.

The document itself is held verbatim, with a record of where it was read from.
The first layer is the trust network gateway (`s4ta`), whose API this was
built for.

| graph | path | typology |
|---|---|---|
| `openapi-validators` | [`validators/`](validators/) | `validators` |
| `openapi-typologies` | [`typologies/`](typologies/) | `typologies` — the `openapi` kind |
| `cat-harness-tools-openapi-schemas` | `openapi/schemas/` in [cat-harness-tools](https://github.com/litlfred/cat-harness-tools/tree/main/openapi/schemas) | `schemas`, `code` — the Zod schema, moved by work item `8lcl` |

## The one rule

**The document is the API authors'; the pages are ours, and they copy nothing.**
A document is ingested verbatim beside a `<id>.source.json` naming the
repository, path and commit it came from. Every page is a thin page
(`cat-harness-tools/scripts/thin-page.ts`): identity and a pointer. The operation's
parameters, request body and responses are drawn in the browser by one shared
loader from the served document (`visualizer-loading`). A fix to what an
operation says is a fix upstream, then a re-ingest.

## What a layer declares

1. A directory of graph typology `openapi`, `served: true`, in its `<instance>.json`.
2. `cat-openapi.config.json` — the file keeps its name — at its own root, or
   inside that `openapi` directory, naming the directory and each document's
   source (`schemas/openapi.ts`, `OpenApiConfigSchema`). The root wins when both
   exist (`configPath` in `scripts/ingest-openapi.ts`).
3. `cat-harness` in its `needs` — directly or through its closure.

Then `cat-harness-tools/openapi/scripts/ingest-openapi.ts --instance <dir> --source <checkout>`
brings the bytes in, and `cat-harness-tools/openapi/scripts/gen-openapi-pages.ts --instance <dir>`
writes the pages and JSON-LD into the same graph. Both take `--check`.

## Where the pages and IRIs land — inside the `openapi` graph

| what | path under the graph's directory | |
|---|---|---|
| the document | `<doc>.openapi.json` + `<doc>.source.json` (the ingest's), node `<doc>.jsonld`, page `<doc>/` | lists every operation |
| an operation | `<doc>/<operation>.jsonld`, `.json`, page `<doc>/<operation>/` | its `@id` is that `.jsonld` address |

In the graph and not in `docs/`: an operation is a node OF the openapi graph,
and an IG layer's `docs/` belongs to `gen-ig-pages.ts`, which reports
anything else there as an orphan. The graph is `served`, so it publishes
verbatim at `/<instance>/<path>/` — a thin page needs no Jekyll.

`<operation>` is the document's `operationId`, or `<method>-<path>` when it
gives none (`operationsOf`). Two operations that would share an id are refused,
never suffixed — a suffix would be an IRI nobody chose.

## Which way the dependencies run

```
bootstrap → bootstrap-tools → cat-harness (incl. openapi/) → (instances that hold OpenAPI documents)
```

Code here may import the rest of `cat-harness`, and nothing above it. The
`openapi` graph typology is a node in `typologies/`, loaded by the registry like
every other harness's, with a `nodeSchemas` family whose validator lives in
`validators/`.

Design note and decisions: PR #1976. Work item `s4ta`.
