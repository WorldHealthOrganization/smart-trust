---
# folio-assistant-y4uj
$schema: bean/1.0.0
title: 'Ingest #1614 item 4 sources 7, 8, 11: FHIR TestPlan, ITB docs, CWA 16408, Gherkin ref, MCP spec, hmans/beans README'
status: completed
type: task
priority: normal
created_at: 2026-10-01T06:38:12Z
updated_at: 2026-10-23T13:45:00Z
parent: folio-assistant-scfh
---

Issue #1614 item 4: methodology literature the KG/folio-asst deck relies on but no library holds. Sources 7 (FHIR R5 TestPlan, EC ITB docs, CEN CWA 16408 GITB, Cucumber Gherkin reference), 8 (MCP specification, latest dated version) and 11 (hmans/beans README). Each to the library of the instance that owns it, held where the licence permits, referenced otherwise, with exact repo@commit/path provenance.

## Done when

- [x] each source has a library entry (held or referenced) or an honest record of why it could not be obtained
- [x] check:l1-complete, check:source-licence, check:methodology-evidence pass
- [x] evidence wired only where a node really relies on the source

## Outcome (2026-10-01)

Held in full (licence permits copying), each with repo@commit in structure.json source.upstream:
- cat-harness/library/cucumber-2024-gherkin-reference (MIT) — cucumber/docs@3c93e6ce content/docs/gherkin/reference.md
- cat-harness/library/mcp-2026-specification-2026-07-28 (Apache-2.0 AND MIT) — modelcontextprotocol/modelcontextprotocol@046fa30e docs/specification/2026-07-28/ (latest dated version)
- cat-harness/library/hmans-2026-beans-readme (Apache-2.0) — hmans/beans@99260bf1 README.md
- cat-harness/library/isaitb-2026-interoperability-test-bed-readme (EUPL-1.2) — ISAITB/gitb@e3cb6c00 README.md; the ITB docs site is in no ISAITB repo and its host is blocked
- fhir-harness/library/hl7-2023-fhir-r5-testplan (CC0-1.0) — HL7/fhir@v5.0.0 (eca054db) source/testplan/; TestPlan is absent from master. fhir-harness/library newly declared.

Not obtained: CEN CWA 16408:2012 (GITB). ftp.cen.eu, standards.cencenelec.eu and web.archive.org are refused by the proxy, and GitHub code search finds no copy. No entry was made, because a referenced entry needs the sha256 of a document we hold. Unblocks if the owner uploads the PDF.

New rung: cat-harness/scripts/text-structure.ts, variant text-structure/v1. No methodology node relies on these sources, so no evidence was wired.

## Correction, same day: placement

`library-ref.test.ts` requires the PLATFORM library (cat-harness/library) to hold ONLY sources a platform methodology cites. No methodology cites these, so the four cat-harness entries listed above moved before the first commit:
- mcp-2026-specification-2026-07-28 and hmans-2026-beans-readme → agent-skills/library. That library holds literature on operating agents, already including RFC 2119/8174, which the MCP specification cites.
- cucumber-2024-gherkin-reference and isaitb-2026-interoperability-test-bed-readme → fhir-harness/library, next to the TestPlan source: the WHO-free test-side literature of a FHIR IG.


_2026-10-01_ — Now feeds arc `3fva` (issue #1763, `cat-harness/docs/proposals/qa-reports-branch-and-test-process-2026-10-01.md`).

## 2026-10-01 — paused for placement PR6 (session session_01CVVoavPoCHMLA7AASxG8cH)
Library placement is decided by apcg (library/<group>/<slug>/, owner ruling 2026-09-30). Moving sources now would move them twice.

_2026-10-16T06:30:00Z_ — Block lifted: `apcg` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


_2026-10-16T06:30:00Z_ — Block lifted: `apcg` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-23T13:45:00Z_ — Status synced from `in-progress` to `completed` to match the folio-assistant copy of this bean, which is newer and records the work as done there. Only the status changed; the body here is kept as it was. Owner OK in thread "FHIR beans and WHO migration" (https://claude.ai/code/session_01Bye99WLJxQpyCxh2eMgW19).
