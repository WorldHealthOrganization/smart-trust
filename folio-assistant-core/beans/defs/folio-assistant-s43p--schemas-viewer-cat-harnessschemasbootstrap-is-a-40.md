---
# folio-assistant-s43p
$schema: bean/1.0.0
title: 'SCHEMAS VIEWER: /cat-harness/schemas/bootstrap is a 404 — dependency instances'' schemas are excluded, and node kinds are not searchable'
status: completed
type: bug
priority: normal
created_at: 2026-10-06T12:09:39Z
updated_at: 2026-10-08T19:57:30Z
parent: folio-assistant-o3xy
---

Owner, 2026-10-06, verbatim:

> i expected https://litlfred.github.io/folio-assistant/cat-harness/schemas/bootstrap to work and show all schemas in bootstrap
> (i also expected to be able to search for node kinds and see them here).
> (following general patern requirements of harness visualizers)

## Measured 2026-10-06 on main d34afab78

- gen-schema-viz.ts publishes one subject page per instance found by readSchemaGraph(cat-harness). schemaRoots() calls corpusDirectoriesForGraph(root, 'schemas'), i.e. checkoutDirectories with stackedOn: the instance and those stacked ON it. Dependencies (bootstrap, bootstrap-tools) are excluded by design, so no bootstrap page is ever written. Subjects today: cat-harness, cat-openapi, fhir-harness, folio-assistant-core, smart-base.
- bootstrap/schemas/ holds JSON Schema files (*.schema.json), and the reader reads *.ts only, so even with the root included bootstrap would be an empty subject.
- bootstrap.json declares nodeSchemas (its node kinds) and no page shows them.

## Todo
- [x] the viewer reads the whole checkout's declared schemas directories (dependencies included), without changing what kg-audit / glossary read
- [x] JSON Schema files are read as declarations
- [x] node kinds shown and searchable on the page
- [x] screenshots of /cat-harness/schemas/bootstrap and one other instance sent to the owner
- [x] PR green and merged

## Landed evidence

- litlfred/cat-harness PR #3 merged into main (`b63128d1d79cf1492a330efd1128221745039d0c`).
- Head commit `64e5369ec9fd402b9b5339a1785174e0526dfa76`:
  - `scripts/schema-graph.ts`: accepts `SchemaGraphScope` (`scope: "checkout"` vs `scope: "corpus"`), parses `*.schema.json` via JSON Schema parser alongside TypeScript schemas, resolving declarations, fields, `$ref`s, and properties.
  - `scripts/gen-schema-viz.ts`: scans checkout scope, indexes node kinds from `nodeKindIndex` and instance `nodeSchemas`, generates subject pages for `bootstrap`, `bootstrap-tools`, `cat-harness`, and `openapi`, and updates projection with searchable node kind rows.
  - Emits 273 modules, 1616 declarations, 1118 edges, 4 subject pages (`bootstrap`, `bootstrap-tools`, `cat-harness`, `openapi`).
  - Verified clean TypeScript checks (`tsc --noEmit`), schema-graph verification, and schema viz generation.
