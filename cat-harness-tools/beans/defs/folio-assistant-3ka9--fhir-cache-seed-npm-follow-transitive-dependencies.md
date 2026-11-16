---
# folio-assistant-3ka9
$schema: bean/1.0.0
title: 'fhir-cache-seed-npm: follow transitive dependencies, and mirror smart-base''s 4 missing packages'
status: completed
type: bug
priority: normal
created_at: 2026-10-06T16:04:40Z
updated_at: 2026-10-08T01:15:00Z
parent: folio-assistant-rwmf
---

Split from 6mk7 on 2026-10-06 (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92).

SUSHI on smart-base still fails here, because 4 TRANSITIVE packages are not in the cache: crmi#2.0.0, cql#2.0.0, sdc#4.0.0 and terminology#7.3.0. The seeder reads only the IG's own `dependencies:`, so it never lists them. That means `--missing-out` never asks fhir-package-mirror for them either.

## Done when
- [x] the seeder resolves each installed package's own `dependencies` (package.json), recursively, and lists the missing ones in `--missing-out`
- [x] the four packages are in litlfred/fhir-package-mirror. This needs a machine that reaches packages.fhir.org: the owner's local agent runs `fhir-package-mirror`
- [x] MEASURED: in a container with packages.fhir.org blocked, SUSHI on smart-base exits 0 using only documented tools

## Landed evidence (PR #2428)
- Completed and merged to main in PR #2428 (commit `c683b820d6f7`).
- `fhir-cache-seed-npm` follows transitive dependencies recursively. Verified on main.
