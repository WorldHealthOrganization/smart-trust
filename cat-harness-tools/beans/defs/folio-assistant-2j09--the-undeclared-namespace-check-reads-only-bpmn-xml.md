---
# folio-assistant-2j09
$schema: bean/1.0.0
title: The undeclared-namespace check reads only BPMN xmlns, so a JSON-LD vocabulary can go unpinned forever
status: completed
type: task
priority: normal
created_at: 2026-09-22T11:48:29Z
updated_at: 2026-09-23T19:29:49Z
parent: folio-assistant-1swy
---

Split out of the 2026-09-22 fix to `external-schemas.ts`, deliberately not taken there because it is a much larger decision than the bug beside it.

## The fix that was taken

`unusedNamespaces` was reporting Dublin Core — 43 real uses, live in the glossary's own `@context` — as *"a record outliving its dependency"*, because `namespacesInUse()` reads **only** `processes/*.bpmn|dmn`. A vocabulary can be used in more than one syntax; a reader that knows `xmlns` reports `@context` as absent. Repaired by scanning the corpus for the IRI string, which is syntax-agnostic by construction. Mutation-tested: a record naming an IRI nothing mentions is still reported.

## The question NOT taken

`undeclaredNamespaces` still reads diagram bindings only. So the registry can pin every namespace a **BPMN file** binds, and pin **none** that only a JSON-LD `@context` binds — and report a clean pass over the gap.

Measured on main, 2026-09-22: `skos:`, `owl:`, `rdfs:`, `schema:` and `dcterms:` all appear in emitted `@context` blocks. Before this session only `dcterms:` had a record, and it got one because DC arrives through the catalogue pipeline rather than because anything checked the contexts.

## Why widening it is not obviously right

Widening `undeclared` to every IRI mentioned anywhere would demand a registry record for `owl:`, `rdfs:`, `xsd:` and every other IRI a context happens to bind — including ones this repo merely *names* without conforming to or reading. The `use` enum already distinguishes `conforms` / `reads` / `cites`, so the vocabulary exists to express "we cite this and nothing breaks" — but somebody has to decide which of the unpinned ones are which, and a gate that demands records before that decision is made would be a gate whose remedy is guesswork.

The same argument the OWN-namespace block in that file already makes: a gate whose remedy is wrong is worse than one that says nothing, because somebody follows it.

## Done when

- [x] Decide which JSON-LD-bound namespaces need a record, and at which `use` level — owner, 2026-09-23: every external namespace this instance's emitters bind; RDF, RDFS, OWL, XSD, PROV, Web Annotation, CSVW, SPAR, schema.org at `conforms`, HL7 FHIR and WHO SMART base at `reads`; ingested WHO artefacts of other instances out of scope
- [x] Widened to a declared source set: `jsonLdNamespacesInUse` — `.ts` files under directories declared `code`/`schemas` that write an `@context`, plus committed `.jsonld` in the instance
- [x] It does not: its first run found `…/folio-assistant-core/ns/dspace#`, ours and unlisted, which is now in the own-namespaces code list

## Summary of Changes

Done inside the code-lists feature PR (owner chose one PR for all three stages). `external-schemas:check` now reconciles JSON-LD `@context` bindings as well as BPMN `xmlns`; 11 new records under `cat-harness/external-schemas/` (unpinned editions carry a `note` saying why); the own-namespace test reads the `own-namespaces` code list instead of a hand list.
