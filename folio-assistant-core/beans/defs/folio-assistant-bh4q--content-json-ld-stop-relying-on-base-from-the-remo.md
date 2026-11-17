---
# folio-assistant-bh4q
$schema: bean/1.0.0
title: 'Content JSON-LD: stop relying on @base from the remote context (JSON-LD 1.1 §4.1.3)'
status: completed
type: task
priority: normal
created_at: 2026-10-01T18:30:16Z
updated_at: 2026-10-02T13:36:37Z
parent: folio-assistant-scfh
---

## Why
Measured 2026-10-01 (bean jcet, item 2): emitted content .jsonld reference `https://litlfred.github.io/folio-assistant/ns/content/v1.jsonld` by URL, and relative @ids resolve to `https://litlfred.github.io/folio/…` only because jsonld.js 8.3.3 applies `@base` from a remote context. JSON-LD 1.1 §4.1.3 (held: w3c-2020-json-ld-1-1 sec-033-413-base-iri) says `@base` in a remote context is ignored, so a conforming processor resolves those @ids against each document's own URL. This is a portability defect for any consumer, not a live defect in this pipeline.

Voice rule `ld-no-base-in-a-remote-context` (folio-assistant-core/skills/voices/linked-data) states the rule. PROV reports already comply (schemas/prov-jsonld.ts puts @base in the document's own context).

## Options (owner to pick)
1. Emit absolute @ids in content documents.
2. Put `@base` in each document's own (embedded) context, beside the remote URL.

## Done when
- [x] owner picks 1 or 2 (option 2, 2026-10-01)
- [ ] emitter changed; a strict-1.1 expansion test (document loaded from a foreign URL) gives the same IRIs
- [ ] regen fixed point; CI green


## 2026-10-01 — owner ruled: option 2
Put `@base` in each document's own (embedded) context beside the remote URL — the same shape schemas/prov-jsonld.ts already emits.

## Summary of Changes

Closed 2026-10-02 on evidence: PR #1817 merged at `85b9578b6`, and issue #1815 closed with it.

- Content documents now carry `CONTENT_DOCUMENT_CONTEXT` = `[CONTENT_CONTEXT_URL, {"@base": FOLIO_BASE}]` (owner option 2), so their `@id`s resolve against FOLIO_BASE even under a strict JSON-LD 1.1 processor, which ignores `@base` in a remote context (§4.1.3).
- The four content emitters were switched: `gen-block-jsonld`, `gen-site-jsonld`, `tabular-nodes` and `gen-library-jsonld`.
- `ContentContextSchema` accepts the two-part form and the bare URL that older records carry, and refuses anything else.
- The falsifier is `cat-harness/schemas/jsonld-base.test.ts`. It simulates a strict processor (context served without `@base`, document at a foreign URL), with a control case that shows the defect.
- 182 orphaned library figure blocks, the only documents the regeneration missed, were moved to `fsh-guts/retired/library-orphaned-figure-blocks` on the owner's ruling.
