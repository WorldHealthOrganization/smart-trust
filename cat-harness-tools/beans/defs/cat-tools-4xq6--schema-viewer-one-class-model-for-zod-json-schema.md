---
# cat-tools-4xq6
title: 'SCHEMA VIEWER: one class model for Zod, JSON Schema and FHIR logical models, drawn by schema:viz'
status: completed
type: feature
priority: normal
created_at: 2026-11-14T10:19:11Z
updated_at: 2026-11-14T12:15:53Z
---

Owner, 2026-11-14 (card answer B): 'Is there a schema viewer page that shows a UML-like diagram derived from schemas such as logical models or JSON schemas that are in the reference schema node kind? Or TypeScript? A consistent visualization.'

Today schema:viz draws Zod (schema-graph.ts) and reads *.schema.json shallowly; FHIR logical models (StructureDefinition kind=logical) get no class diagram.

- [x] Class model: fields carry cardinality (min..max) as well as type; every reader fills the same SchemaDecl/SchemaEdge
- [x] Reader registry (scripts/class-model/): one reader per source, dispatched by file content, never by folio name
- [x] JSON Schema reader: $ref, allOf, properties, items (array cardinality from minItems/maxItems), nested definitions
- [x] FHIR logical-model reader: StructureDefinition kind=logical, differential/snapshot elements, a type reference becomes an edge, backbone elements become classes
- [x] Undetermined stays explicit: a source the reader cannot model is a stated undetermined declaration, never an empty box
- [x] schema:viz draws every source with one look: box fill and ink from uml.css (--fa-uml-schema / --fa-uml-edge)
- [x] Tests + Gherkin; before/after screenshots (Zod, JSON Schema, FHIR logical model) in the PR

## Summary of Changes

Landed in cat-harness-tools#2161 (merged 2026-11-14):
- `schema-graph.ts`: fields carry cardinality (`min`/`max`, `?..?` when unknown) and type links; JSON Schema reader nests inline objects, merges `allOf`, reads `oneOf`/`anyOf` as members, keeps `$id` as canonical, states a shapeless schema as undetermined; one resolver for every JSON reader (canonical first).
- `fhir-logical-model.ts`: StructureDefinition (logical, or a resource/complex-type specialisation) → classes; read from schemas directories and declared `fhir-artifact-index` directories (unbuilt → `unread`).
- `class-diagram.ts`: one renderer for the viewer, skill pages and Tool pages (incl. MCP input schemas); source label upper right, `name : Type [min..max]`, uml.css colours, every box and type a link; banded layout with edges routed through gaps.
- `type-links.ts`: built-in types link to HL7 datatypes, JSON Schema, XML Schema, Zod; `umlType` shows Zod as UML.
- `class-model-qa.ts` (`schema:qa`): kg-qa/v1 report on what each reader could not determine.

Follow-ups (owner scope extension 2026-11-14, via the merge manager): FHIR profiles and FHIR core types (fhir-harness#431); one RDFS/OWL reader for SKOS, DCMI, DCAT, ODRL; BPMN, CSVW and the rest; skill pages listing the Tools that satisfy them.
