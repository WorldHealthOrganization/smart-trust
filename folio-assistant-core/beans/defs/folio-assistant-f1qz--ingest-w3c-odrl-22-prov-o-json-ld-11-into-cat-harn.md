---
# folio-assistant-f1qz
$schema: bean/1.0.0
title: INGEST W3C ODRL 2.2, PROV-O, JSON-LD 1.1 into cat-harness/library (#1614 sources 4-6)
status: completed
type: task
priority: normal
created_at: 2026-10-01T06:40:55Z
updated_at: 2026-10-01T11:29:42Z
parent: folio-assistant-scfh
---

Issue #1614 item 4: methodology literature the KG / folio-asst deck relies on and no library holds. ODRL Information Model 2.2 (REC 2018-02-15; actor permissions, before/after check), PROV-O (REC 2013-04-30; QA/QC reports as provenance, bun run cat prov:qaqc), JSON-LD 1.1 (REC 2020-07-16; every manifest is JSON-LD). w3.org is blocked from the container; the REC publication snapshots are in each WG's GitHub repo (w3c/poe, w3c/prov, w3c/json-ld-syntax), printed to PDF offline and ingested with bun run cat ingest.

## Done when

- [x] three entries under cat-harness/library/ with licence.json (W3C licence read off each document)
- [x] source repo@commit/path recorded, and whether it is the REC text
- [x] evidence wired only where a methodology node really relies on the spec
- [x] check:l1-complete, check:source-licence, check:methodology-evidence, tsc pass

Claimed by agent worktree branch worktree-agent-a4eb97cb997f2156b, session_019rLS387FZZzjPJsNQhfALA, 2026-10-01.

## Outcome (2026-10-01)

- [x] three entries under cat-harness/library/, each HELD in full: w3c-2018-odrl-model-2-2 and w3c-2020-json-ld-1-1 under the W3C Software and Document License (W3C-20150513, permits copy and modify with notice); w3c-2013-prov-o under the W3C Document License ("document use rules"; copy in any medium permitted, no right to modify), held verbatim with the reading recorded in its licence.json for the owner to overrule.
- [x] source recorded in each licence.json `note`: the WG's REC publication snapshot (w3c/poe snapshots/REC-odrl-model-20180215, w3c/prov ontology/releases/REC-prov-o-20130430, w3c/json-ld-syntax publication-snapshots/REC), REC text not editor's draft, not compared byte for byte with w3.org (blocked). Printed to PDF offline with headless Chromium; PDFs retired to fsh-guts/uploads/ with sidecars.
- [x] evidence: NO methodology node relies on ODRL, PROV-O or JSON-LD (grep of all four methodologies/ dirs), so no `evidence:` was added. The specs are relied on by skills and docs (role-model, task-authorization, bpmn-execution, odrl-prov-actor-model proposal, prov-qaqc), which carry no evidence field.
- [x] check:l1-complete, check:source-licence, check:methodology-evidence, tsc, library tests pass. Shared regenerated indexes left for the coordinator.

## Superseded 2026-10-01 (owner, relayed in S0 / bean hx65)
Owner chose "Add methodology citations": the three W3C sources are now cited by methodology nodes (prov-o-provenance, odrl-policies, json-ld-serialisation; bean 6306, #1769, ported into #1774). The reading above that no methodology relies on them is superseded.
