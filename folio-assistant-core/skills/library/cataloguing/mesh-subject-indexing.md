---
name: mesh-subject-indexing
description: >
  Assign Medical Subject Headings (MeSH) to a work as a DRAFT for a person to
  review, in the four stages of skill-pipeline-subject-indexing: over-generate
  concepts, filter them by NLM's own rules, validate every heading against
  NLM's MeSH authority with Tool `mesh-authority`, and write the reviewed list.
  Never emits a heading the authority does not hold.
uses-methodology:
  - skill-pipeline-subject-indexing
---

# MeSH subject indexing

Use this when a work in a layer's library (a paper, a guideline, a report)
needs subject headings from **MeSH**, the controlled vocabulary NLM uses to
index MEDLINE. The output is a draft list of headings for a person to accept or
change. It is not a catalogue record, and it is never published as final.

The method is [`skill-pipeline-subject-indexing`](../../../../cat-harness/methodologies/skill-pipeline-subject-indexing.md):
four stages, each traced to the vocabulary's own policy. The policy is held as
`library/nlm-mesh-indexing-policy-2026`, nine NLM pages captured on
2026-11-10, cited below by page.

## What is held, and what is not

| policy | held | where |
|---|---|---|
| use the most specific descriptor available | ✅ | *MeSH Tree Structures* |
| precoordinated descriptor, then descriptor/qualifier, then two descriptors | ✅ | *MeSH Record Types* |
| entry terms are equivalent to the preferred term for indexing | ✅ | *Entry Terms* |
| what each qualifier is for | ✅ | *MeSH Qualifiers with Scope Notes* |
| check tags (only Male and Female remain) and publication types | ✅ | *MeSH Record Types*, *Publication Characteristics* |
| NLM indexes from title and abstract; people review selected sets | ✅ | *FAQ about Indexing for MEDLINE* |
| how many headings, and which are major topics | ❌ | the MEDLINE Indexing Online Training Course, which NLM now serves only from an archive host this environment cannot reach |

**Stage 2 is therefore incomplete.** It applies the rules that are held and
says, in its output, that heading count and major-topic marking were not
applied. It does not guess them.

## Stage 1: conceptual analysis

Read the title, the abstract and the table of contents. NLM's automated
indexing reads the title and abstract (*FAQ*), so do not go beyond them unless
the person asks. Write:

- one sentence saying what the work is about;
- a list of candidate concepts, each with the passage that supports it.

Over-generate on purpose. Filtering is stage 2's job, not this one's.

## Stage 2: filtering by NLM's rules

For each concept, choose the form NLM's policy asks for:

1. **The most specific descriptor.** If the work is about *Streptococcus
   pneumoniae*, propose that, not *Streptococcus* (*MeSH Tree Structures*).
2. **Precedence for a complex concept.** Use a precoordinated descriptor if
   MeSH has one (*Heart Surgery*). Otherwise use a descriptor with a qualifier
   (*Muscles/injuries*). Only otherwise use two descriptors (*Jejunal
   Diseases* + *Enteritis*) (*MeSH Record Types*; *Use of MeSH in Indexing*).
3. **A qualifier only for its scope.** Pick it by its scope note (*MeSH
   Qualifiers with Scope Notes*). Stage 3 checks that the descriptor allows it.
4. **Check tags and publication types** only when the work states the fact:
   *Male*, *Female*, and a publication type from *Publication Characteristics*.

Order the list by how central each concept is to the aboutness sentence. Write
it as a draft file:

```json
{ "candidates": [
  { "label": "Measles", "qualifier": "prevention & control", "why": "abstract, sentence 1" },
  { "label": "Measles Vaccine", "why": "title" }
] }
```

## Stage 3: authority validation, a lookup

```sh
bun run folio-assistant-core/scripts/mesh-authority.ts validate draft.json          # review table
bun run folio-assistant-core/scripts/mesh-authority.ts validate draft.json --json   # the report
```

Tool `mesh-authority` looks up every candidate in NLM's MeSH authority
(`id.nlm.nih.gov/mesh`, current year) and returns one status each:

| status | what happens |
|---|---|
| `resolved` | kept, in the authority's preferred form; an entry term is replaced by its preferred heading |
| `qualifier-not-allowed` | the descriptor is kept and the qualifier is dropped |
| `ambiguous` | nothing is kept; a person picks one of the listed descriptors |
| `not-found` | dropped. **The skill never emits a heading the authority does not hold** |

This stage is a lookup, not a judgement. Do not overrule it from what you
think MeSH contains.

## Stage 4: the reviewed list

Hand the person the review table and the `validated` list from the report.
Say which candidates were dropped and why, and that heading count and
major-topic marking were not applied (stage 2). The person decides. Where the
headings are stored is the layer's catalogue choice and is not set here.

## What this skill refuses

- Going from the work to finished headings in one pass.
- A heading from memory that stage 3 did not resolve.
- Treating a difference from an existing MEDLINE record as an error. NLM's
  records come from automated indexing with human review of selected sets
  (*FAQ*), under the policy of their year.
