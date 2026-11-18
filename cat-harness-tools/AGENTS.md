# AGENTS.md — cat-harness-tools

What **implements** the harness's Tool definitions: the MCP servers, their tool
registrars, and the routes that serve them. The definitions themselves — the
`tools` graph and its reader — stay in `cat-harness/tools/`.

## The one rule

**Definitions there, implementations here**, the split `bootstrap` and
`bootstrap-tools` already use. A new tool's contract goes in the harness; the
code that runs it comes here.

## Which way the dependencies run

```
bootstrap → bootstrap-tools → cat-harness → cat-harness-tools → (the content layers)
```

This layer may import `cat-harness` and `bootstrap-tools`, and **nothing above
it**. The content core may import this layer; this layer does not name it,
since a lower layer naming a higher one is itself the wrong direction
(`check:reference-direction`). The order is declared, not written here: it is
the `needs` of each `<instance>.json`, and `check:import-direction` enforces it
from them.

Any part of the server that needs the content core moves up into the core
rather than coming here, and a content package's own server half lives with
that package.

## What is here

Every directory is declared in `cat-harness-tools.json`, and each has a
generated README saying what it holds. The main ones: `adapters/mcp-server/`
(the standalone MCP server and its Dockerfile), `src/` (the MCP and HTTP
server), `scripts/`, `pipeline/` (the content pipeline), `schemas/` (the Zod
schema corpus) and `test/`. Declare only directories that exist: a declared
but absent directory is a defect.

The layout mirrors `cat-harness/`, so imports between modules keep the same
relative paths.

## The libraries of the layers below the kind are held here

`libraries/` holds this layer's own `software-library` nodes, and
`libraries/held/<layer>/` holds the nodes of each layer below the kind.
bootstrap-tools needs only bootstrap, so it may not name cat-harness's
`software-library` kind or declare a `libraries/` of its own. This layer owns
the writer and the gate (`scripts/libraries.ts`), so it records them, keyed by
the layer each node describes (`layer`, `software-library/1.2.0`), the same
rule core uses for the glossary schemes of the layers below its typology.

The held set is derived, not listed: every layer with a `package.json` that
declares no `software-library` directory and does not reach cat-harness
through `needs`. The nodes are derived at this layer's pins, so a re-pin of
bootstrap-tools runs `bun run cat libraries:derive` in the same PR, and
`libraries:check` fails until it does. Never hand-edit a held node, and never
add a `libraries/` to bootstrap-tools.
