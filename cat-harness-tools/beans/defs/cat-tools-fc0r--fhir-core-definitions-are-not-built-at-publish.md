---
# cat-tools-fc0r
title: 'FHIR core definitions are materialised by hand; the publish step does not build them'
status: todo
type: task
created_at: 2026-11-15T07:20:00Z
updated_at: 2026-11-15T07:20:00Z
---

Follows bean cat-tools-t6fz (#2181). The schemas viewer loads FHIR core types from a declared `fhir-core-definitions` directory (fhir-harness#431), whose bodies are gitignored and fetched by `fhir-core:materialise`. Until they are fetched, a checkout reports `N referenced definition(s) not materialised` in `unread` and the types stay linked external names.

Deliberately NOT done yet (coordinator default, 2026-11-15): making the site publish step materialise and build FHIR core's definitions. Doing it means the publish job downloads the pinned `hl7.fhir.r4.core` package (about 12 MB) on every build.

- [ ] Decide whether the publish step materialises FHIR core, or the viewer keeps showing core types as external names on the published site
