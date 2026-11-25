---
name: vocabulary-authority
description: >-
  One vocabulary is authoritative for one kind of fact, and every other is a
  derived rendering reached by a declared mapping. Which vocabulary owns what
  here, the pros and cons behind each ruling, how DC and SKOS overlap and what
  stops them drifting, and the normalisation-first rule for any modelling or
  mapping exercise.
conformsTo:
  - w3c-skos
  - dcmi-terms
  - hl7-fhir
  - schema-org
  - w3c-dcat-3
---

# Vocabulary authority — one fact, one home, N renderings

> Skill id: `vocabulary-authority` · Package: `folio-core`

## The rule

> **A fact has ONE authoritative vocabulary. Every other vocabulary that
> carries it is a RENDERING, reached by a declared mapping with stated
> equivalence — never a second copy of the fact.**

| the fact | authoritative | why not the others |
|---|---|---|
| what a term **MEANS** | **SKOS** | the only candidate here whose subject IS a meaning |
| a **resource's** metadata | **Dublin Core** | a document has a title; a concept has a preferred label. Different subjects |
| a **clinical code's** operational semantics | **FHIR** `CodeSystem` / `ValueSet` / `ConceptMap` | versioning, designations with a `use`, expansion-as-release. SKOS has none of these |
| a **release** of any of the above | **DCAT** (held, not built) | it is not a term model at all; it describes a published dataset |

```
                      ┌──────────────────────────────┐
   AUTHORITATIVE  ──▶ │  skos:Concept = the MEANING  │
                      └───────────────┬──────────────┘
      skos:exactMatch / closeMatch / broadMatch / relatedMatch
        │            │            │            │           │
        ▼            ▼            ▼            ▼           ▼
   FHIR Code-   Dublin Core   schema.org    TBX        DCAT
   System       (resource     DefinedTerm   termbase   (release of
   (clinical    metadata,     (SEO /        (CAT-tool  any of these
   operations)  bib records)  discovery)    exchange)  as a dataset)
```

**SKOS is the hub because its mapping properties exist for exactly this**, and
because it is the only one of the five whose subject is a meaning rather than
an artefact, a record, or a distribution.

## Pros and cons, as ruled

The reasons are measured against this corpus, not read off the specs.

### SKOS — **adopted, authoritative for meaning**

| | |
|---|---|
| **Pro** | Native JSON-LD. Multilingual labels first-class. `notation` **is** the code — `TermGloss`'s prefixed names. Mapping properties with stated equivalence. Carries the vocabulary terms and swimlane roles here |
| **Con** | **No versioning model at all.** No designation `use`. No post-coordination. Mapping properties carry no provenance |

**The con is why convergence STOPS at SKOS.** The failure this exists to
prevent: reading *"one glossary mechanism"* as *"one terminology mechanism"*
and binding an ICD-11 code to a `skos:Concept` with a `notation` and no
version. That graph validates, publishes, and is wrong the next release.

### Dublin Core — **kept, authoritative for resources**

| | |
|---|---|
| **Pro** | ISO 15836. Qualified, repeatable and language-tagged as IRIS actually uses it — the content core's `schemas/dublin-core.ts` is shaped by one measured record that does all three |
| **Con** | Two predicates overlap SKOS (below) |

### schema.org — **kept at 3 predicates; never a source of truth**

| | |
|---|---|
| **Pro** | Search engines consume it. Native JSON-LD |
| **Con** | A **publishing vocabulary, not a terminology one**. `DefinedTerm` has `name` + `description` and stops: no versioning, no designation concept at all, no mapping semantics, no deprecation-with-successor |

It has no definitions to speak of. **Used for 3 predicates**
(`softwareVersion`, `codeRepository`, `text`).

**Measuring usage:** a naive grep for `schema.org` mostly matches
`json-schema.org` (JSON Schema's `$schema` keyword) and the `schema:viz` npm
script. Never cite that count.

### TBX — **not closed, and still not adopted**

ISO 30042:2019 is published *both* as an ISO standard and as a free open
industry standard; dialects and schemas are public. So "closed" is false and
the ruling does not rest on it.

| | |
|---|---|
| **Pro** | Genuinely open. Purpose-built for multilingual term entries |
| **Con** | Its niche is **CAT-tool termbase interchange**. This repo translates through gettext `.po`, not a termbase. XML-only |

**Legitimate as an export** if translators ever ask for a termbase.

### Rejected outright

**SKOS-XL** — it reifies labels to fix part of the designation gap and nothing
else; the gap it does not fix is the one that matters. **OWL** — overkill:
prose definitions, no reasoner in the pipeline. **DCAT** — held, for the
*render* of whatever is landed on.

## DC ↔ SKOS: the overlap, and what stops the drift

| pair | relation |
|---|---|
| `dcterms:title` ↔ `skos:prefLabel` | **real overlap** |
| `dcterms:description` ↔ `skos:definition` | **real overlap** |
| `dcterms:subject` → `skos:Concept` | **not overlap — the designed JOIN.** DC points *at* a concept |
| `dcterms:hasPart`, `dcterms:source` | no SKOS equivalent |

> **DC describes a RESOURCE. SKOS describes a CONCEPT. One object, one type,
> one naming predicate.**

They collide only where a node is genuinely both — such as the glossary
document, which is a *file* and a `skos:ConceptScheme`, carrying both
`skos:prefLabel` and `dcterms:title`. Two predicates for one fact, with nothing
declaring which is authoritative, drift apart. The node is a concept scheme, so
`skos:prefLabel` is the source and `dcterms:title` is the derived copy for
resource-metadata consumers.

## Guidance for schema and data modelling

1. **Model in an open standard.** Not a proprietary or house schema that
   happens to be convenient.
2. **Proprietary input is mapped, not adopted.** A mapping is a declared
   artefact with stated equivalence — not a rename in a loader.
3. **Normalise FIRST.** The first step of any mapping exercise is data
   normalisation. Mapping un-normalised data encodes the source's accidents
   into the target and they are invisible afterwards.
4. **The exercise runs as a defined process**, not as a one-off script.

## Where the pins live

`cat-harness/external-schemas/` — one record per specification, pinning the
**edition** and carrying the operative terms **derived from the corpus**, never
hand-listed. `bun run cat-harness-tools/scripts/external-schemas.ts --check`.

A vocabulary can be used in more than one syntax (a BPMN file, a JSON-LD
`@context`); a usage check that reads only one reports the other as absent.

## Related

- [`schema-management`](schema-management.md) — the registry's own discipline.
- `terminology-management` (the FHIR IG layer) —
  the FHIR half, for a folio's clinical terminology.
- The content core's `schemas/kg/external-schema.ts` — the record contract, and
  why `conforms` / `reads` / `cites` are different answers.
