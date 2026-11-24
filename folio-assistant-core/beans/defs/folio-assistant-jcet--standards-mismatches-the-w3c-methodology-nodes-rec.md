---
# folio-assistant-jcet
$schema: bean/1.0.0
title: 'STANDARDS MISMATCHES the W3C methodology nodes recorded: PROV_CONTEXT IRI, JSON-LD @base in an external context, ODRL conflict default'
status: completed
type: bug
priority: normal
created_at: 2026-10-01T12:32:06Z
updated_at: 2026-10-01T16:32:32Z
parent: folio-assistant-scfh
---

Found while writing the three W3C methodology nodes (bean 6306, PR #1769), each quoted against the HELD spec in cat-harness/library/. None is fixed: each needs a decision, not a mechanical edit.

1. **PROV_CONTEXT** (cat-harness/schemas/prov.ts:29) = "http://www.w3.org/ns/prov-o". That IRI is the PROV-O OWL ontology document; the namespace is http://www.w3.org/ns/prov# and W3C's JSON-LD context is http://www.w3.org/ns/prov.jsonld. Nothing imports the constant today. Decide what it NAMES, then rename or re-value it. Also: provDocument (scripts/prov-qaqc.ts) does not coerce prov:agent / prov:hadRole / prov:hadPlan to @id, so a JSON-LD processor reads them as strings; ProvActivitySchema allows actedOnBehalfOf on an Activity (spec domain: prov:Agent).
2. **@base in an external context.** schemas/jsonld.ts sets @base inside the published context; JSON-LD 1.1 §4.1.3 (held: library/w3c-2020-json-ld-1-1/sections/sec-033-413-base-iri.md): "@base will be ignored if used in external contexts". If documents reference the context by URL, relative @ids resolve against each document's own location. Verify with publish-verify before deciding.
3. **ODRL conflict default** is odrl:prohibit (schemas/odrl.ts FOLIO_DEFAULT_CONFLICT); ODRL 2.2 §2.10 says a policy with no conflict property defaults to invalid. Also: target optional (ODRL requires it), circular inheritFrom tolerated (§2.9 MUST NOT), cross-policy any-deny-wins vs ODRL's void. These are permission-policy choices; the methodology node odrl-policies.md lists each departure.

## Done when
- [x] PROV_CONTEXT decided and fixed; @id coercion for the three object properties (owner: PROV-JSONLD, held locally; PR #1791)
- [x] @base verified against a real resolution; moved or documented (documented: bean text, voice rule `ld-no-base-in-a-remote-context`; PROV moved in #1791; content documents → bean `bh4q`)
- [x] Owner ruling on the ODRL conflict default (keep prohibit as a stated profile departure, or follow §2.10)


## 2026-10-01 — @base measured (item 2)
Emitted .jsonld reference the context BY URL ("@context": "https://litlfred.github.io/folio-assistant/ns/content/v1.jsonld"), i.e. the external case. Expanding {"@id": "papers/x/blocks/def-foo"} with jsonld.js 8.3.3, the published context served by a local documentLoader and the document loaded from https://example.org/somewhere/else/: the @id resolves to https://litlfred.github.io/folio/papers/x/blocks/def-foo — the SAME as with the context inline. So jsonld.js applies @base from a remote context, which the held JSON-LD 1.1 text (§4.1.3) says is ignored. Our IRIs are correct today only through that processor's behaviour; a strictly conforming 1.1 processor would resolve relative @ids against each document's own URL. Not a live defect in this repo's pipeline; a portability defect for any consumer. Options: emit absolute @ids, or put @base in each document (or an embedded context) rather than in the remote one.

_2026-10-01T15:57:39Z_ — Claimed by claude/fervent-brahmagupta-rbwhzm — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## 2026-10-01 — item 3 ruled: keep prohibit, documented (owner, option 1)
The owner chose to keep odrl:prohibit as the default conflict strategy, as a STATED profile departure from ODRL 2.2 §2.10's invalid. Recorded at FOLIO_DEFAULT_CONFLICT (schemas/odrl.ts, with the §2.10 quote), in methodologies/odrl-policies.md departure 4, and pinned by a test in schemas/odrl.test.ts. Also fixed: policies/folio-defaults.jsonld's comment named scripts/tests/odrl-policies.test.ts, which never existed; the check it describes is schemas/odrl.test.ts.


## 2026-10-01 — item 1 done (PR #1791)
Owner chose PROV-JSONLD (W3C Member Submission 2024-08-25; W3C publishes no JSON-LD context for PROV-O), held locally: the spec ingested as library/w3c-2024-prov-jsonld, its context.jsonld beside it pinned by sha256 811d5e94…, served by publish:verify's localLoader, never fetched. PROV_CONTEXT is now that context's URL. provDocument emits PROV-JSONLD Activity + Association nodes with agent/role/plan at their release addresses (check:node-iris rule). Measured on the 9 reports, links before→after: agent 0→99/100, hadRole 0→100, hadPlan 0→71, activity↔association 0→100. The 30 that stay literal are 'unaddressed' findings with reasons: 29 plans whose owner (large-datasets) declares no iriBase, 1 agent that is a GitHub login. prov:used (27) left as it was, for the owner.


## Summary of Changes (closed 2026-10-02, session_01CVVoavPoCHMLA7AASxG8cH)
All three standards mismatches are resolved, merged in #1791, with follow-ups in #1817:
1. **PROV context**: PROV is emitted as PROV-JSONLD (W3C Member Submission 2024-08-25), with the context held locally and sha256-pinned. Agent, role and plan are links at their owners' release addresses (0 → 99/100/71 of 100). `prov:used` is linked at IRIS Handles in #1817.
2. **@base in a remote context**: measured, and documented in voice rule `ld-no-base-in-a-remote-context`. PROV carries `@base` in its own context (#1791), and content documents do too (bean `bh4q`, #1817).
3. **ODRL conflict default**: owner ruled to keep `prohibit` as a stated profile departure from §2.10, pinned by odrl.test.ts.
