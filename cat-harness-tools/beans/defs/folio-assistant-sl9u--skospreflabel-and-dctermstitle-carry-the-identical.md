---
# folio-assistant-sl9u
$schema: bean/1.0.0
title: skos:prefLabel and dcterms:title carry the identical string on the glossary scheme node, with nothing saying which is authoritative
status: completed
type: task
priority: normal
created_at: 2026-09-22T11:48:29Z
updated_at: 2026-09-23T21:33:41Z
parent: folio-assistant-1swy
---

Measured 2026-09-22 on output shipped the same morning, in PR #841:

```
_kg/cat-harness-glossary.jsonld
   skos:prefLabel : 'cat-harness swimlane glossary'
   dcterms:title  : 'cat-harness swimlane glossary'
   SAME?          : True

_kg/bootstrap-glossary.jsonld   — same, both fields
```

Two predicates, one fact, and nothing declaring which is the source. They agree today and will diverge the first time somebody edits one.

## Why the node carries both at all, and why that part is legitimate

The glossary document is genuinely two things: a **file** (which has a `dcterms:title`) and a **`skos:ConceptScheme`** (which has a `skos:prefLabel`). This is the one node in the corpus where the DC/SKOS overlap is not a modelling error.

[`vocabulary-authority`](../../../cat-harness/skills/kg/kg-core/vocabulary-authority.md) states the rule that resolves it: **DC describes a RESOURCE, SKOS describes a CONCEPT, one object one naming predicate** — and where a node is both, the authoritative one is decided by what the node IS *primarily*. Here that is the concept scheme, so `skos:prefLabel` is the source and `dcterms:title` is a derived copy for resource-metadata consumers.

## What has NOT been decided, and is the reason this is a bean rather than a fix

Whether the derived copy should exist at all. Two defensible answers:

1. **Keep it, derive it.** A DC-only consumer reading the document as a resource finds a title. The copy is emitted from `prefLabel` in one place, so it cannot drift.
2. **Drop `dcterms:title` from the scheme node.** One predicate, no copy, no drift surface. Costs the DC-only consumer, who may not exist.

Not picking one from the implementation side: emitting is what created the ambiguity, and emitting differently would settle it by accident.

## Done when

- [ ] Decide: derived copy, or single predicate
- [ ] If derived — it is emitted FROM `prefLabel`, never assigned separately, and a test asserts they cannot diverge
- [ ] `glossary-export.test.ts` covers whichever is chosen, so the next edit cannot silently reintroduce two independent assignments

## Summary of Changes

Closed 2026-09-23. The owner chose **"Keep both, one source"**, adding: *"this is going to be common pattern... need Tools for this type of ETL procedure depending on source / target content type and other metadata"*.

- `glossary-export.ts` now computes the scheme's label once (`schemeLabel`) and writes it to both `prefLabel` (`skos:prefLabel`) and `title` (`dcterms:title`).
- A new test in `glossary-export.test.ts` asserts `title === prefLabel`.
- Both `glossary:check` runs are current, so the output did not change.
- The general pattern is filed as bean `k74z`: ETL Tools that map a value between metadata vocabularies by source and target content type.
