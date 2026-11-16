---
# folio-assistant-7h1c
$schema: bean/1.0.0
title: publish-verify scope misses our own SKOS code-lists document
status: completed
type: bug
priority: normal
created_at: 2026-09-24T05:40:40Z
updated_at: 2026-09-24T11:55:19Z
parent: folio-assistant-1xhc
---

Found 2026-09-24 while working `wg7r`. `publish-verify`'s `isOurs` counts a JSON-LD document as ours only when its `@context` names our content context or binds one of our namespaces. `<stub>-code-lists.jsonld` (glossary-export) binds only `skos`, `dcterms`, `owl` and `rdf`, so the verifier counts it **out of scope (not ours)**, even though its `@id` sits under our published base and we author every code in it. The same holds for any SKOS-only document we publish.

It expands clean today: checked by hand with `expandFindings`, 0 warnings, 12 schemes and 28 GRADE concepts. So nothing is broken; the gap is that nothing would notice if it broke.

## Done when
- [x] A document whose `@id` is under our canonical base (`FOLIO_BASE` / the declaration's `canonicalUrl`) is in scope, whatever its `@context` binds.
- [x] A test pins the code-lists document as checked, not as out of scope.

## Summary of Changes

`isOurs(doc, bases)` now also counts a document as ours when its own `@id` is at or below one of the site's bases. The check respects the path boundary: a lookalike such as `…/folio-assistant-evil/` does not count. The base comes from the instance declaration's `canonicalUrl` by default, and `--base` can be given more than once. Verifiers receive it through a `VerifyContext`, and the report states which bases were used.

**Measured on the live `gh-pages` tree** (non-STAGING), 2026-09-24:

| run | checked | out of scope | result |
|---|---|---|---|
| base = declared `canonicalUrl` | 1,641 | 19 | pass |
| base = `https://example.invalid` | 1,640 | 20 | pass |

Exactly one document moved into scope: the SKOS code-lists document, and it passes. None of the 19 third-party documents has an `@id` under our address, so none of them can start blocking a deploy.

Tests pin the defect both ways. The real code-lists document is counted out of scope without a base, and checked (exit 0) with one.
