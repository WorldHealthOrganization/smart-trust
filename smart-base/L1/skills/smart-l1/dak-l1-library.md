---
name: dak-l1-library
description: >
  Build a DAK's library from the L1 sources its Component 1 cites, and the L1
  knowledge graph that records them. Read when starting or extending a DAK
  library, when a DAK's guidance changes, and before writing any L1 graph for a
  DAK. Covers fetching a cited WHO IRIS item, ingesting it, deciding whether it
  is L1 (declared > context > inferred), extracting the Component 1 graph, the
  L1 graph of each L1 source as a specialisation of its library entry, and the
  layering rule: the library is upstream of L1.
input: L1/schemas/skills/dak-l1-library/input.schema.json
output: L1/schemas/skills/dak-l1-library/output.schema.json
---

# dak-l1-library

> Skill id: `dak-l1-library` · Package: `authoring-who-smart-guidelines` ·
> Named by `l2-dak-authoring.bpmn` step **Build the L1 library from
> Component 1**, in the `Business analyst` lane.

**Every library built for a DAK starts from the DAK's own Component 1**,
"Health interventions and recommendations": §1.1 lists the interventions, and
§1.2 names the WHO guidelines and guidance the DAK operationalises, each with
a printed `(n)` into the DAK's reference list. Those sources are the DAK's
L1. Without them the library cannot answer what an L1 graph is for: *which
recommendation does this decision rule implement?*

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/dak-l1-library/input.schema.json) and [`output.schema.json`](../../schemas/skills/dak-l1-library/output.schema.json).

- **In:** where to look: the `useCase` (stage 1 of [`smart-guideline-end-to-end`](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md), [`guideline-use-case`](../../../skills/content/authoring-who-smart-guidelines/guideline-use-case.md)'s output), a `dak` whose Component 1 cites the sources (`l2-dak-authoring.bpmn`), or both; and whether to `ingest` what is not in `library/` yet.
- **Out:** `l1Sources`: the candidates, Component 1 sources first, then WHO IRIS and the jurisdiction's own, each `in-library`, `in-kg` or `not-yet`, `included` or not with a one-sentence `reason`. Stage 2 ([`recommendation-extraction`](recommendation-extraction.md)) takes it as its `l1Sources`.

## The layering rule

Every layer points only upstream: L3 → L2 → L1 → **library**. An L1 node may
name the library node it was read from; nothing in the library names L1. So an
L1 document's publication, sections and elements are **specialisations**
(`prov:specializationOf`) of its library entry, sections and blocks, and L1
inherits whatever sectioning the ingest produced: an outline, inferred
contents, or pages. The schema is smart-base's `l1-library` layer
(`smart-base/L1/schemas/l1-library.ts`), which imports smart-kg L1 3.0 unchanged.

## L1 or not — three sources, one precedence

A document is L1 when it is WHO guideline content: a guideline,
implementation guidance, a summary table, a position paper, a classification.
A DAK is **not** (it is L2); neither is a technical specification. The answer
is a `classifications[]` entry on the document's `intake.json` (scheme
`https://smart.who.int/kg/layer`, code `l1`), from up to three sources:

| source | written by | smart-kg derivation |
|---|---|---|
| `declared` | a person, with `by` and `at` | `decided` |
| `context` | this step: §1.2 introduces every card as guidance the DAK draws on (`--record-context`) | — the publication stays `inferred` |
| `inferred` | `l1-membership.ts` from the IRIS Dublin Core record (series, title words) | `inferred` |

**declared > context > inferred.** A lower record that disagrees is reported
on every run, never dropped: the immunizations DAK's §1.2 cites DDCC (28), so
context says L1, and a declaration says it is not. With no record at all the
document is *undetermined*: the L1 step does nothing and says what to record.

## The pattern

**The DAK itself is library-only**: it is L2, so it gets no L1 graph.
Reading its Component 1 is how the L1 sources are found; each of those is
ingested individually and gets its own L1 graph.

1. **Fetch the DAK** from WHO IRIS with
   `bun run folio-assistant-core/scripts/fetch-dspace-item.ts <handle URL> --out uploads`.
   It writes the PDF, the item's Dublin Core record (`folio-dublin-core/v1`)
   and an `intake.json` whose licence is the record's `dc.rights`, stated
   only when the repository states it.
2. **Ingest it**: `bun run cat ingest uploads/<doc_id>/<doc_id>.pdf --library <lib>`.
   A WHO PDF with no outline goes to `pdf-structure`, which keeps its inferred
   contents only if they pass the trust tests, else falls back to pages.
3. **Read Component 1**:
   `bun run smart-base/L1/scripts/extract-dak-l1-references.ts --entry library/<doc_id> --context-only`.
   It lists §1.2's citations and the reference each printed number names,
   with its URL, and flags those that rest on the printed number alone. Those
   references are the fetch list.
4. **Fetch every L1 source, one by one, by where it lives:**
   - an IRIS or PAHO IRIS handle → `fetch-dspace-item.ts`;
   - a who.int item page (`/publications/m/item/…`) →
     `bun run folio-assistant-core/scripts/fetch-who-publication.ts <URL> --out uploads`,
     which reads the page's title, date, type, overview, page count and
     copyright into the Dublin Core record and takes its one PDF;
   - a reference whose URL is a **listing** (the summary-tables page lists
     Tables 1–4, each cited by its own card) → fetch each listed item, and
     record on each intake how it was reached.

   A source that is not a publication (a data portal, a blank reporting
   form) is not fetched; say so. Then ingest each (step 2).
5. **Record the context decision**: run step 3 again with `--record-context`.
   Each held source's intake gets §1.2's `context` classification, matched by
   handle or by its record's `dc.identifier.uri`.
6. **For each held source that is L1, run the L1 step**:
   `bun run smart-base/L1/scripts/l1-specialise.ts --entry library/<doc_id> --validate-zod <smart-base checkout>`.
   It writes `smart-kg-l1-library.jsonld` beside the entry. A source that is
   not L1 gets no L1 graph; its library entry is its only representation.
7. **Check the edition.** A who.int page serves the CURRENT edition, which may
   be newer than the one the DAK cites ("updated in 2024" against a
   1 December 2025 table). Note it on the intake; do not treat them as one.
8. **Leave fidelity to a person.** The run lists each citation whose words
   differ from its reference title. Someone opens the DAK page and the source
   and confirms it; nothing marks that check passed automatically.

## What an L1 graph holds

`smart-kg-l1-library.jsonld`, beside each L1 source's entry: `publication`,
`publication-section` (one per library section, front matter excepted, with
the ingest's confidence in its note) and `publication-element` (each figure,
table and box the ingest's figure reader found), joined by `contains`, each
`specializationOf` its `library-node`. Section IRIs use the number as the
contents page **prints** it (`Annex 1`, `Section 2`), so an annex does not
collide with a chapter of the same number; a heading printed many times
("Analysis" under every chapter) takes its position among its namesakes. A
publication with no ISBN or handle is identified by its page URL.

**It is JSON-LD that survives as RDF.** Its `@context` is
`http://smart.who.int/kg/l1-library.context.jsonld`, the layer's identity,
never fetched at run time. `smart-base/L1/schemas/` generates that context from the
same Zod source as the FHIR models and serves it through `src/loader.ts`;
expand a graph with jsonld.js and that `documentLoader`. smart-kg's own L1
context would drop every node class and property name and any predicate it
does not know; the library context keeps all three (`@vocab`, `properties` as
`@nest` with Dublin Core terms, predicates by declared IRI).

**A citation resolves by its printed number** into the numbered list that
holds every cited number with the most title agreement; a DAK has several
numbered lists. Title agreement is only corroboration: a card often
*describes* its source rather than naming it, so low agreement is flagged for
step 8, not treated as a miss.

**publicationType comes from a declaration or the title's own words**
(`summary tables`, `guidance`, `position paper`, `classification`). A
guideline's subtype turns on its GRC history, which a title does not carry,
and a data portal has no type at all; neither is forced into the nearest code.

## Where the files go

Each L1 graph is written beside its entry; `smart-kg-l1.json` is the
recommendation extractor's (`extract-smart-kg-l1.ts`). The DAK repository
holds the library: `library/<doc_id>/` for each entry, and
`uploads/<doc_id>/intake.json` plus the Dublin Core record for each fetched
item. The PDFs are pinned by sha256 and not committed.

## What it cannot do yet

- **Element types the library does not extract**: table rows, footnotes,
  charts, images, flowcharts, lists. L1 3.0 defines nine; the L1 step emits
  the three the ingest finds and names the other six in the publication's
  note.
- **Recommendations** in an L1 source are `extract-smart-kg-l1.ts`'s, which
  writes L1 1.0 and finds only printed labels. For a source with none, and
  for each recommendation's scenario (persona, process, user story), see
  [`recommendation-extraction`](recommendation-extraction.md).
- **The position papers behind a summary table.** (29) in the immunizations
  DAK is the routine-immunization summary tables, which cite the WHO vaccine
  position papers; following them is a fetch per paper, not automated.
- **Sources neither fetcher reads.** `fetch-dspace-item.ts` speaks DSpace 7
  and `fetch-who-publication.ts` reads who.int item pages; a PAHO IRIS item
  behind a different network policy, or a spreadsheet, is recorded with its
  URL and reported, not fetched.

## Schemas this rests on

- L1 3.0 and the `l1-library` layer: `smart-base/L1/schemas/` — Zod, from WHO
  smart-kg main `3f5e477`, generating the `KG*` logical models, code systems
  and value sets;
- IRIs: `smart-base/L1/scripts/l1-kgid.ts`, smart-kg's `kgid.mjs` as tested;
- the Dublin Core record: `folio-assistant-core/schemas/dublin-core.ts`;
- the intake, its licence and its classifications:
  `cat-harness-tools/schemas/library/intake.ts`,
  `cat-harness-tools/schemas/library/source-licence.ts`.
