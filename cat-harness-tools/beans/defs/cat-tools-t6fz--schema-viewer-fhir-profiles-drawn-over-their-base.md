---
# cat-tools-t6fz
title: 'SCHEMA VIEWER: FHIR profiles drawn over their base, FHIR core types from fhir-harness'
status: completed
type: feature
created_at: 2026-11-14T12:15:57Z
updated_at: 2026-11-15T07:20:00Z
---

Increment 2 of the one class model (bean cat-tools-4xq6, landed in #2161), owner scope extension 2026-11-14 via the merge manager: 'also FHIR resources in general'.

- [x] A constraint StructureDefinition (a profile) is read as a class generalising its base, its fields the elements the differential constrains (narrowed cardinality, narrowed type, fixed/pattern value, mustSupport)
- [x] Profiles are read from schemas directories and from declared fhir-artifact-index directories, not only logical models
- [x] The profile's box says it is a profile and each constrained field says what changed
- [x] FHIR core types resolve by canonical when a layer declares FHIR core's definitions (fhir-harness#431); until then they stay linked external names
- [x] Tests + Gherkin; before/after screenshots (a smart-trust or smart-base profile)

_2026-11-15T07:20:00Z_ — Completed. Profiles landed in #2164 and FHIR core types in #2181. The RDF vocabularies and OMG metamodels that followed are bean cat-tools-xfd4; publishing FHIR core's definitions at build time is bean cat-tools-fc0r.
