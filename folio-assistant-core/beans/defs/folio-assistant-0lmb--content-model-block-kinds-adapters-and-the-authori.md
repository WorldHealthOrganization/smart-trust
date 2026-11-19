---
# folio-assistant-0lmb
$schema: bean/1.0.0
title: 'CONTENT MODEL: block kinds, adapters and the authoring surface'
status: completed
type: epic
priority: normal
created_at: 2026-09-19T11:43:44Z
updated_at: 2026-11-01T21:10:00Z
parent: folio-assistant-npuo
---

The block kinds and adapters an author actually writes against.

`55ao` is the one with the largest blast radius — a real `recommendation` kind
means a builder, a Zod schema, a label prefix, viewer registration, constraint
rows and QA criteria, about thirty files — and it is tracked rather than
half-done for exactly that reason. `cz17` brings the DAK type in properly.

`6xaz` and `bqrg` are the authoring surface misbehaving: a TOC inferred from a
worked EXAMPLE and shipped as the document's own structure, and one lexer
implemented six times.

## Closed 2026-11-01

All ten children are closed in this store: `55ao`, `cz17`, `6xaz`, `bqrg`, `06e3`, `5yhm`, `jg8s` and `vrfx` are `completed`, and `k660` is `scrapped`. Nothing open names this epic as its parent. (The `cat/cat-harness/state` copy still shows several as `todo`, but it was last written on 2026-10-03 and is stale.) Closed under the MVP epic litlfred/folio-assistant#2894, Phase 2c, in the project thread "Build the content-model machinery".
