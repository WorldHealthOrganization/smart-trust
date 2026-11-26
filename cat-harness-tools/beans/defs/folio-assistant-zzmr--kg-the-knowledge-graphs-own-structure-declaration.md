---
# folio-assistant-zzmr
$schema: bean/1.0.0
title: 'KG: the knowledge graph''s own structure, declaration and publication'
status: completed
type: epic
priority: normal
created_at: 2026-09-19T11:43:44Z
updated_at: 2026-10-31T22:45:00Z
parent: folio-assistant-vuip
---

The graph's own structure — how it declares itself, and how it reaches a reader.

`1dfh` publishes it and `ovkk` is why the publication is currently lossy: the
`@context` declares 19 terms while the graph uses 53, so a conforming JSON-LD
processor drops thousands of property occurrences. Publishing a graph nobody
can parse is worse than not publishing it, so these two move together.

`z4mq` and `ce65` are the node kinds that are half-declared (Zod modules, Tool
nodes for 11 of 138 skills), `x89g` and `c4rz` finish moving two stores into
declared graphs, and `wlqd` is a directory that is declared while nothing syncs,
serves or registers what it holds — the `dh4f` defect by another name.

_2026-10-31T22:45:00Z_ — Closed: all 54 child beans are `completed` (none open, none scrapped), across the folio-assistant and cat-harness-tools stores. The named ones this epic was opened for are done: `1dfh` and `ovkk` (the published `@context` now declares the terms the graph uses), `z4mq` and `ce65` (Zod modules and skill Tool nodes declared), `x89g` and `c4rz` (bean and state stores are declared graphs), and `wlqd` (remote-packages). Closed by the bean drain tidy-up (sibling S3, https://claude.ai/code/session_01Qmmkt5KrQTMk55GWX1YUtj).
