---
# folio-assistant-18p1
$schema: bean/1.0.0
title: EXPORT test-plan/v1 → FHIR R5 TestPlan in fhir-harness, once SMART Guidelines IG content is complete
status: draft
type: feature
priority: normal
created_at: 2026-10-01T09:12:25Z
updated_at: 2026-10-26T13:20:00Z
parent: folio-assistant-3fva
---

Owner, 2026-10-01: *"https://www.hl7.org/fhir/testplan.html is a downstream target in fhir context … we should be able to map to fhir test plan when we have full smart guidelines IG content."*

## What
`test-plan/v1` (platform, `cat-harness/schemas/test-plan.ts`, bean `ygzh`) stays FHIR-free. In the FHIR context a SMART Guidelines IG gets its test plans **exported as FHIR TestPlan resources**:
- `scope` → `TestPlan.scope`
- `requirements[]` → `TestPlan.scope` / `Requirements` refs
- `testCases[]` → `TestPlan.testCase`, with assertions → `testCase.assertion`
- test data → `testCase.testData`
- Gherkin `.feature` → `testCase.testRun.script`
- `dependencies[]` → `TestPlan.dependency`

The mapping table already in `test-plan.ts`'s docstring is the starting point.

## Where
The export lives in **fhir-harness**, an adapter or profile, not in the platform (platform-boundary rule). Inputs are the DAK block kinds `test-scenario` (L2, Gherkin companion) and `test-case` (L3) from `schemas/dak-blocks.ts`.

## When
Draft until a SMART Guidelines IG has complete L2/L3 test content. smart-immunizations is the likely first; see proposal §3.3 dogfood 3. CWA 16408 (GITB, `y4uj`) is a sibling target for ITB interop.

## Done when
- [ ] an IG with complete DAK test content exists (the trigger)
- [ ] fhir-harness exports its test plans as TestPlan resources that validate with the FHIR validator / IG Publisher
- [ ] a round-trip test: the exported TestPlan carries every case and assertion id of its source plan
- [ ] `check:reference-direction` confirms that no platform module imports the export

_2026-10-26T13:20:00Z_ — Block lifted: `folio-assistant-ygzh` is completed (`2026-10-01T09:30:19Z`). Remains `draft` awaiting an IG with complete DAK L2/L3 test content.
