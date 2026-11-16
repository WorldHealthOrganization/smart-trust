---
name: glossary-terms
description: >
  Add terms to a layer's glossary: local SKOS terms (folio-glossary/v1) with
  a definition, a code and links to external SKOS concepts, and references to
  whole external schemes. Rendered on the glossary/ page; gated by
  check:glossary. Authored terms go to gettext (.pot) for translation; a
  paper's glossary is one more scheme.
adapters: [document, paper, dak]
profiles: [document, paper]
consulted: true
graph-typologies:
  - glossary
uses-methodology:
  - automatic-term-extraction
---

# Glossary terms

A glossary can reference external SKOS schemes, and that is the preferred
way.

## Where terms go

Core declares the `glossary` directory in `folio-assistant-core.json`. Its
graph typology is `perInstance`, so every folio built on core has a
`glossary/`. Each `*.glossary.json` is one SKOS concept scheme, `$schema: "folio-glossary/v1"`
(`folio-assistant-core/schemas/glossary.ts`).

## Reference first, define second

| you have | write |
|---|---|
| a term somebody else already defines in SKOS (ISCO-08, an EU authority table, a W3C vocabulary) | a local term with `exactMatch` (or `closeMatch`, `broadMatch`, `narrowMatch`) to the external concept IRI. **Do not copy its definition.** |
| a list of external terms this folio uses | `members`: the external concept IRIs, emitted as a `skos:Collection` |
| a whole external scheme | a `remoteGraphs` entry in the declaration with `graphTypologies: ["glossary"]`: known about, not held |
| a term only this folio defines | a local term with `prefLabel`, `definition`, and `notation` for its code |

## Three states, never two

- `authored`: a person wrote or approved the definition. It must have one.
- `candidate`: extracted from a source and not yet curated. It may have no
  definition, and the page marks it.
- `could-not-extract`: the source names a term the extractor could not read.
  It carries a `reason` a person can act on.

A candidate is never presented as a definition. An extractor writes
candidates; only a person moves one to `authored`. A paper's definition block
counts as that person: its author wrote the definition and marked it (see
"A paper's glossary" below).

## How a term is linked: the workflow

Terms are linked across the glossary, the narrative and the knowledge graph
with a few shared joins, not a framework.

**One join key: the SKOS term** (its id, or its IRI from another layer).
Everything else points at it, and nothing copies it.

| thing | how it names the term |
|---|---|
| the defining site | the term's `source`: its glossary row (an L1 section line, or the document's glossary table block). One node-kind structure for every term. |
| a narrative block that explains the term at length | the block's `defines: [<term id>]` (and `:defterm[...]{#id}` inline). Provenance, not a second definition. |
| other uses in prose | nothing to write: matched at build time (`term-passages.ts`) and linked by `--link-terms` |
| an acronym | `notation` on the term, never a second list. The acronyms table is drawn from it (`glossary:table`). |
| an organization | `focus` (W3C ORG), shared ones in smart-ra `organizations.glossary.json` |
| an ArchiMate element | the element's `skosConcept` property (`glossary-archimate.ts`) |
| a BPMN lane or task, DMN decision, skill, Tool | the generated candidate schemes (`glossary-extract.ts`); `exactMatch` when one is the same concept |
| a FHIR code | `exactMatch` / `closeMatch` to the CodeSystem concept; the code stays a CodeSystem |
| an external glossary | `exactMatch` to its IRI, `members`, or a whole scheme in `remoteGraphs` |

**Where terms come from.**

- *Ingesting a source* (L1, DTH, DAK): `bun run cat glossary:from-source`
  reads its glossary and abbreviations sections into verbatim `candidate`
  terms with `source: <file>#L<line>` (`l1-document-ingestion`). No
  per-handbook script.
- *Authoring in the narrative* (dth-hrh): the glossary file is edited, and the
  chapter is drawn from it (`glossary:table`, or the folio's own build). A
  block that explains a term lists it in `defines`.
- *External*: reference, don't copy (below).

**What a reader gets.** Every authored-scheme term has a page
(`glossary:page`, `glossary/instance/<instance>/<scheme>/<term>/`). It shows the
definition and acronym, **Defined in** (its glossary row), broader, narrower
(computed), related terms, matches, ArchiMate elements, and **In the
narrative**: the blocks that explain it, then those that use it. A
Capitalized label in prose links to that page when the document build passes
`--link-terms`, which `dth-init` sets for every DTH.

**Warnings, never failures.** `bun run cat glossary:links` reports a `source`
that is missing from a mounted layer, and a `defines` id that no scheme holds.
With `--all` it also lists terms the narrative never uses. The acronym report is
`glossary:acronyms`.

## Conventions

Every folio follows these; none re-decides them.

**The layer namespace.** A term's IRI is
`<instance namespace>glossary/<scheme id>/<term id>`. The layer namespace is
built from the layer's declaration (`iriBase`, `version`, and the stub of a
sub-layer) by `instanceNs` in `folio-assistant-core/scripts/glossary-page.ts`;
`schemeIri` and `termIri` are in `folio-assistant-core/schemas/glossary.ts`.
For example:

| layer | namespace |
|---|---|
| `folio-assistant-core` | `https://litlfred.github.io/folio-assistant-core/v0/ns/` |
| `ihris` (its own site) | `https://litlfred.github.io/ihris/ihris/ns/` |

The namespace is never the asset's path: moving the asset must not move the
term.

**A term is minted by the layer that owns its source.** A scheme and its terms live
in the namespace of the layer whose root holds the SOURCE ASSET, not of the
layer whose `glossary/` directory holds the file:
- In a folio with sub-layers, that is the sub-layer
  (`instanceNs(<sub-stub>)`, under the folio's own publication root). It is
  never the root layer, even when the `glossary/` directory is declared at
  the root. In ihris, a term drawn from `ihris-manage` is minted in
  `ihris-manage`'s namespace, not `ihris`'s.
- A code list extended by several packages belongs to the layer that
  DEFINES it. Say so with the scheme's own `source` (a repository path in that
  layer). Each term's `source` still points at the package that
  contributed it.
- A scheme whose terms are sourced in several layers and that names no
  defining `source` is refused, never guessed: split it, one scheme per
  layer. `folio-assistant-core/glossary/` holds two `platform` schemes for
  that reason, core's and cat-harness's.
- No two layers share a namespace, and a scheme IRI is unique across every
  layer.

`check:glossary` enforces all of this (`schemeOwner` and `collect` in
`glossary-page.ts`, and the checks in `glossary.test.ts`); `glossary-extract.ts`
mints extracted terms by the same rule. When a check fails, fix the generator
or split the authored scheme. Never edit the output.

**One ConceptScheme per code list.** This follows `schemas/code-list.ts`
(`codeListToSkos`): *"a code is addressable and two lists may share a code
without sharing a concept"*. The same code in two lists gives two concepts.
A relation between them is a SKOS match, never a merge.

**The basis of a match is recorded, never assumed.** A match comes from a
mapping the repository verified, such as a FHIR `ConceptMap` whose
equivalence implies one:
- `equal`/`equivalent` gives `exactMatch`;
- `wider`/`subsumes` gives `broadMatch`;
- `narrower`/`specializes` gives `narrowMatch`;
- nothing else gives a match.

Any other basis needs the owner's explicit acceptance. One example is a
`ValueSet` that binds a local code list to the external code system itself,
so that the local code *is* the external code. Once accepted:
- the scheme's `description` names the basis and the ruling;
- the builder lists the accepted systems explicitly;
- QA recomputes the matches from the same source.

ihris's ISCO-08 lists to ESCO are the worked example. An IRI built from a
publisher's pattern but never dereferenced says so.

## Then

`bun run cat glossary:page` writes the index, `docs/glossary/index.md` (the
authored terms with A–Z and a filter box, the counts, the sources, schema.org
`DefinedTermSet` JSON-LD, and a link to every asset type's page), one page per
asset type at `docs/glossary/<type>/index.md` (skills, tools, bpmn-activities,
dmn-decisions, schema-fields: that type's extracted terms, with A–Z and a
filter box), and one SKOS JSON-LD file per scheme under
`docs/assets/glossary/`. Each term is on exactly one page. `bun run
check:glossary` is the gate: it fails on a document that does not validate, on
a stale page, and on a page over its size budget (64 KB for the index, 1 MB
for an asset type's page).

**A page over budget is split further, never given a bigger budget.**

The harness's swimlane-role terms (`swimlane-glossary`, the
[`swimlane-glossary`](../../../../cat-harness/skills/process/process-core/swimlane-glossary.md) skill) are one more source the page
links to, not copies of.

## Extracted terms

`glossary:page` also extracts a `candidate` term from every knowledge-graph
asset that carries a title and a description
(`folio-assistant-core/scripts/glossary-extract.ts`): skills, Tool nodes, BPMN
tasks and call activities, DMN decisions, and schema fields with a doc
comment. One scheme per asset type per layer (`kg-skills`, `kg-tools`,
`kg-bpmn-activities`, `kg-dmn-decisions`, `kg-schema-fields`), written to
`generated/<instance>/<type>.glossary.json` inside core's `glossary/`.

- They are generated. Never edit them: fix the asset, then re-run.
- The `kg-` scheme prefix is reserved for them. An authored scheme that takes
  it fails `check:glossary`.
- A definition is the asset's own text, verbatim. An asset with no
  description gives a candidate with no definition.
- To promote one, author a term in a glossary of your own with a definition
  you have checked, `status: authored`, and the same `source`.
- BPMN lanes and roles are not extracted: the swimlane ledger carries them.
- Extracted terms are on their asset type's page, never on the index, and
  each carries the "candidate, extracted" badge. Only authored terms go into
  the schema.org `DefinedTermSet`, which is on the index.

## Ordered glossaries — logical order, not A–Z

Some glossaries (bootstrap's, for one) are read top to bottom: each term is
defined only by terms above it, and never by itself. Do not sort them A–Z.

- **`ordered: true`** on a glossary says its `terms` array IS the order. Each
  term's **`requires`** lists the local ids its definition uses; the schema
  refuses one that is later, itself, or not in the glossary.
  `checkDeclaredOrder` (`schemas/dependency-order.ts`) is the same check for
  any authored order.
- **In SKOS** the order is a `skos:OrderedCollection` (`memberList` as an
  RDF list), each use is `dcterms:requires`, and **`isDefinedBy`** — the
  schema or standard that defines the term — is `rdfs:isDefinedBy`.
- **On the page** an ordered scheme is its own numbered section at the top of
  the index, with its "Uses" links, and is not repeated under the A–Z bar.
- **A schema whose `$defs` carry `uses` IS an ordered glossary**, read by
  `termsOfSchema` in `glossary-page.ts`: the definitions stay in one place,
  the schema, and the glossary cannot drift from it. They are `authored`,
  not `candidate`: a person wrote and approved them in the schema's source,
  and the collector only reads them out.
- **The uses list is authored, not inferred.** A text matcher over the
  definitions is a guard that the list and the prose agree (`graph.test.ts`);
  a word can appear without being used as a term.

## Translation: authored terms only

`bun run cat glossary:pot` writes one gettext template per scheme that has an
authored term, to `translations/<locale>/glossary/<instance>--<scheme>.pot`
under cat-harness's declared `translation-sources` directory, beside the BPMN
templates in `processes/`, through the same pipeline (`formatPot`, the same
timestamp-blind comparison); the translation status page counts them.
`bun run cat glossary:pot:check` is the gate.

- Only `authored` terms are extracted: `prefLabel`, each `altLabel`, and the
  `definition`, in the source language (`en` when given per language). A
  `candidate` reaches a template once a person promotes it.
- The term's IRI is the translator comment, never a msgid. It stays the same
  in every language; only labels and definitions are translated.
- `translations/<locale>/glossary.po` is a different file (terminology hints
  for `translation-block-qa`). Do not confuse it with the `glossary/` directory.

### Translations and the per-locale pages

A translation is a `.po` **beside its template**:
`translations/<locale>/glossary/<instance>--<scheme>.po`. `bun run
glossary:page` reads every such file (`readGlossaryTranslations`, through
`glossary-pot.ts`'s `potPath`) and produces two things:

- **a page per locale**, `docs/<locale>/glossary/index.md`, listing every
  authored term with its translated label, alternative labels and
  definition. An entry with no translation shows the **source text marked
  _(untranslated)_** — never silently English, never dropped — and the page
  states how many terms are fully translated;
- **language-tagged SKOS**: the published `<instance>--<scheme>.skos.jsonld`
  carries `skos:prefLabel` and `skos:definition` once per language
  (`@language`), the source as `en`.

`check:glossary` covers both, stale and orphan alike.

**A translation is UNOFFICIAL until a person signs it off.**
Every glossary `.po` says so in its header and records
`Last-Translator: folio-assistant agent (drafted, unofficial)` when an agent
drafted it; every locale page carries `translation_status: unverified`.
Keep code, identifiers and standard names (BPMN, SKOS, ODRL, PROV-O, JSON,
IRI, `$schema`, `needs`) as written, and give each capitalised defined term
ONE rendering per locale across every scheme.

### Subject areas and fixed translations

Owner, 2026-11-07 (glossary review, "scoped fixed terms"). Three fields and
one rule, in `schemas/glossary.ts`:

| field | where | meaning |
|---|---|---|
| `subject` | scheme, optionally a term | the subject area the translations bind in (`dcterms:subject`), a local id: `harness-vocabulary`, `digital-health-trust`, `who-health-guidance`. A term's overrides its scheme's; with neither, the term binds only within its own scheme. |
| `translationStatus` | term | per locale, `official` or `unofficial`; a locale not listed is `unofficial`. It records sign-off, never the translation. |
| (none) | the scheme's `.po` | the translation itself. |

**A fixed translation is derived, never flagged**: an `authored` term whose
scheme catalogue holds a non-empty, non-fuzzy `msgstr` for its `prefLabel`
(`isFixedTranslation`). There is no `#, fixed` flag and no label in the JSON,
so the `.po` stays the one place a translation lives.

**Precedence applies within a subject area.** Across the layers a layer
`needs`, the more authoritative (lower) layer fixes a term's translation for
its subject area, and a higher layer only adds. A match in a different
subject area — the harness's `policy` (`策略`) in a health guide's sentence
(`政策`) — is a **sense check** note for a person, never a violation.
`translation:glossary:check` reads these fields. Use `scopeNote` for the
prose a reader needs; it is never compared.

## Source glossary first

When a folio is written from a source document (a WHO handbook, say), its terms
come from **that source's own glossary** before anyone writes one.

1. **Latest edition.** Use the most recent edition in the library. If it
   lacks something an older edition has, use the older one and say so on the
   term.
2. **Verbatim, as candidates.** Extract every glossary entry as a
   `folio-glossary/v1` term, status `candidate`, the definition copied word
   for word with its page. Keep the source's spelling as an `altLabel` when the
   `prefLabel` is normalised.
3. **Read the PDF when the ingest missed it.** A glossary the library entry
   does not hold (a missed section, a missing indicator sheet) is read from the
   PDF, and the scheme says so.
4. **Structure the source gives is kept.** Modules, indicators and the like
   become concepts too, linked (`broader`, `related`) to the glossary terms
   they cite.
5. **Record what the source never defines.** A term the source uses but does
   not define is a `candidate` with no definition and a `scopeNote` saying so,
   not a definition we write.
6. **Place the scheme with the source.** It lives beside the document's
   library entry (for WHO publications, in the WHO publications IG), so every
   folio that cites the source shares one scheme.
7. **Use the source's words downstream.** Blocks, diagrams and ArchiMate names
   use the source's terms and link to their concepts, not a paraphrase.

A conflict between the source's definition and another scheme's is raised as
an issue on the repository that owns the other scheme, quoting both. Neither
is chosen by the agent.

## Deprecating a term: a change set, decided later

Replacing one term with another (for example "Core Data Element" replacing
"MDS-HRH") is **proposed, not applied**. The agent records a change set with the
old term, the new term, the reason, and every place the old term appears. It
changes no text and no glossary entry. An agent review, started later by an
editor, decides it. Once decided:

- the old term stays in the scheme, so old links still resolve, with a
  `scopeNote` saying it is deprecated and why, and `related` to the new term
  (`folio-glossary/v1` has no deprecated status yet; adding one is a schema
  change, not part of this rule);
- the folio's own prose moves to the new term;
- **quoted source text is never changed**: a quote keeps the term it was
  published with.

## A paper's glossary

The paper builder (`folio-assistant-core/scripts/build-glossary.ts`, skill
`glossary-build`) also writes the paper's terms as one
`folio-glossary/v1` scheme, `paper-<paper directory>`, into the glossary
directory the paper's OWN layer declares. The page picks it up through
`collect()` like any other scheme, so the IRIs are in that layer's
namespace (a sub-layer's for a paper in a sub-layer, never the root's).

| the owning block | its `:defterm` paragraph | status |
|---|---|---|
| `kind: "definition"` | found | `authored`: the author wrote the definition |
| any other kind | found | `candidate`: extracted from a theorem, remark, … |
| any | not found | `could-not-extract`, with the reason |

The definition is the `:defterm` paragraph, verbatim, with directives replaced
by their labels. The slug is the term's `notation`. Never edit the scheme:
edit the paper and re-run the builder. A layer that declares no glossary directory gets a notice and
no scheme; add `{ "id": "glossary", "path": "glossary/", "dependents": "reproduce", "graphTypologies": ["glossary"] }`.

## Organizations and acronyms

An organization (WHO, HL7, ISO, GS1, a national regulator) is a glossary term
like any other, plus a `focus`: SKOS's `foaf:focus` link from the concept to
the organization, which is typed with W3C ORG. The concept keeps the words:
`prefLabel` is the full name, `notation` is the acronym, and `altLabel` holds
other spellings. The organization keeps the facts about the organization.

```json
{
  "id": "who",
  "prefLabel": "World Health Organization",
  "notation": "WHO",
  "definition": "…quoted from its source…",
  "status": "candidate",
  "focus": { "type": "FormalOrganization", "homepage": "https://www.who.int/", "subOrganizationOf": ["un"] }
}
```

- `type` is a W3C ORG class: `Organization`, `FormalOrganization`,
  `OrganizationalUnit` or `OrganizationalCollaboration`.
- `subOrganizationOf` names a local term that has a `focus`, or an
  organization's IRI. `sameAs` links the same organization in another
  register, such as ROR or Wikidata. Give an identifier only when you have
  checked it; never guess one.
- Without `iri`, the organization's IRI is `<term IRI>/_focus`.

**One home per organization.** An organization that several handbooks
use (WHO, HL7, ISO, GS1, UNICEF, USAID) is defined once, in the shared
reference architecture's organizations scheme. A handbook lists it under
`members` and does not copy it. An organization only one handbook names,
such as a country's regulator, stays in that handbook's glossary.

**An acronym is scoped to its meaning.** Use the document's own expansion,
and check it in context. In the WHO product catalogue handbook, "FDA" is the
Rwanda Food and Drugs Authority, not the US Food and Drug Administration. When
the document's acronym would mislead a reader, record it as a candidate and
raise it in the document's review log. Do not fix the quoted text yourself.

**Finding the acronyms that are missing.** The QA criterion
`acronym-in-glossary` warns, block by block, about an acronym that no
glossary the folio can see holds as a `notation`, `prefLabel` or `altLabel`.
It warns and never fails. For the whole folio, with counts and the expansion
the document gives (its abbreviations table, or "Long Name (ACR)"), run:

```sh
bun run folio-assistant-core/scripts/glossary-acronyms.ts --folio folio
```

Each row is a candidate for a person to decide on. Words set in capitals
(`RESOURCES` in a figure), plural forms (`GTINs`) and the folio's own ids
(`PC-R-05`) are left out.

## Architecture elements: the model drawn from the graph

A reference architecture's elements live in the knowledge graph, and the
ArchiMate model is drawn from it, with the relationships on each glossary
term. A term that names an element is a glossary term like any
other, plus a `focus` that is the element: its ArchiMate type, and its
relationships to other terms' elements.

```json
{
  "id": "client-registry",
  "prefLabel": "Client Registry",
  "definition": "…quoted from the document…",
  "status": "candidate",
  "focus": {
    "archimate": "ApplicationComponent",
    "relationships": [
      { "type": "Realization", "target": "client-identification" },
      { "type": "Access", "target": "client-record", "accessType": "read" }
    ]
  }
}
```

- `archimate` is the element type, as ArchiMate's exchange format names it.
- `relationships[].type` is one of ArchiMate 3.2's eleven. `target` is a
  local term whose focus is an element, or an element's IRI. `accessType` is
  only for `Access`.
- In JSON-LD the element is `<term IRI>/_focus`, typed `archimate:<Type>`,
  and each relationship is a predicate such as `archimate:serving`.

The Tool `archimate-from-glossary` (`bun run cat archimate:from-glossary
--instance <dir> --model <id> [--write] [--prune] [--check]`) makes the model
agree. It matches each element by its `skosConcept` property, never by name.
It names and documents the element from the term, creates any element the
model lacks (on no view: place it in Archi, or with `archimate-detangle`), and
adds the relationships the terms list. A type that disagrees is reported, and
a person decides. A relationship between linked elements that no term lists
is removed only with `--prune`. Archi keeps the layout: no box moves. Its
report counts the elements that still point at no term.

**An authored ArchiMate model is never a source of the glossary.** Never write a term, label, definition, `focus` or relationship
into a glossary from a model someone authored in Archi. The words come from
the source documents; the model only depicts them.

The one exception is a model that was **ingested**: received from elsewhere
and held as a source under the layer's `library/`. Such a model can seed
the glossary once with `--seed --from library/<entry>/<file>.archimate`
(`--write` to write). Every term an element of it already points at, and
that has no `focus` yet, takes the element's type and its relationships to
the other linked elements. From then on, the glossary is the source. The
Tool refuses `--seed` on any model outside `library/`.

The read-only "depicted by" links on a term's page (`glossary-archimate`)
read the model's `skosConcept` on each build and write nothing into the
glossary, so they are allowed.

## Not here

A clinical code system is FHIR `CodeSystem`/`ValueSet`, not a glossary:
convergence stops at SKOS. A glossary term may `exactMatch` a
clinical concept; it does not become one.
