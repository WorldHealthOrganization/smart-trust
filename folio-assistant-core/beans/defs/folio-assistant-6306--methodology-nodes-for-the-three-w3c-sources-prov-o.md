---
# folio-assistant-6306
$schema: bean/1.0.0
title: 'METHODOLOGY NODES for the three W3C sources: PROV-O (QA provenance), ODRL (permissions), JSON-LD (KG serialisation)'
status: completed
type: task
priority: normal
created_at: 2026-10-01T08:12:46Z
updated_at: 2026-10-01T09:20:34Z
parent: folio-assistant-scfh
---

#1744 merged red: library-ref.test.ts 'the PLATFORM's library holds ONLY sources its methodologies cite' fails on w3c-2013-prov-o, w3c-2018-odrl-model-2-2, w3c-2020-json-ld-1-1. Owner chose option C (#1614): write three real methodology nodes in cat-harness/methodologies/, each grounded in the held source and in how the platform actually uses the standard.

## Done when
- [x] prov-o node, evidence: library/w3c-2013-prov-o
- [x] odrl node, evidence: library/w3c-2018-odrl-model-2-2
- [x] json-ld node, evidence: library/w3c-2020-json-ld-1-1
- [x] library-ref.test.ts green; check:methodology-evidence reports them; regen fixed point


## Summary of Changes
Three methodology nodes in cat-harness/methodologies/ (prov-o-provenance, odrl-policies, json-ld-serialisation), each quoting the held W3C text and citing the platform code. library-ref.test.ts: 19 pass. Mismatches recorded in the nodes, not fixed: PROV_CONTEXT names prov-o not prov#; @base sits in a context JSON-LD 1.1 §4.1.3 says is ignored when external; ODRL conflict defaults to prohibit where §2.10 says invalid. PR #1769.
