---
# folio-assistant-lqo9
$schema: bean/1.0.0
title: 'GLOSSARY: a coded, versioned glossary content kind in core, a defined-terms index in docs/ from every KG asset, translatable — roast first'
status: completed
type: feature
priority: normal
tags:
    - roast
created_at: 2026-09-20T18:03:45Z
updated_at: 2026-09-30T12:41:47Z
parent: folio-assistant-0lmb
---

Owner, 2026-09-20 (session_017PqeiS4JYySSWGAYLedmus), queued for a ROAST before anything is built:

> justthedocs docs/ rendering should include an index of all defined terms extracted from KG assets in the docs/ (e.g. a bpmn diagram swimlane has title/description). make translatable like all assets. make coded-glossary content kind that can be used in KG extraction and visualisation, re-used when looking at asset metadata. glossary can also be a content asset in a paper, document, L1 asset etc. so should be in core asset there. i want (but realistically can't require) coded and versioned glossary assets so those should be in schema. any good standards for this glossary maintenance? i know dcat? others pros cons/recommendations. what fits well with KG?

## The ask, as four separable pieces

1. **A defined-terms index in the docs/ rendering** — every KG asset that carries a title/description pair (BPMN lanes and activities, DMN decisions, roles, skills, Tool nodes, schema fields with descriptions) contributes its terms; one page indexes them with a link back to the asset.
2. **A `glossary` content kind in core** — a glossary is a content asset in its own right (a paper's glossary, a document's, an L1 asset's), so the kind lives in folio-assistant-core's schemas, not in a renderer.
3. **Coded and versioned, in the schema** — each term carries a notation (code) and the glossary carries a version; wanted, not required, so both are optional fields with a QA axis that reports coverage rather than a gate that refuses.
4. **Translatable like every asset** — labels and definitions go through the existing gettext pipeline; the term's IRI stays stable across languages.

## ROAST HELD, 2026-09-20 — measured before proposing anything

The bean's own last line said *"check what it already does before adding a second
mechanism."* It was checked, and it changes the shape of the work. **Three of the
four pieces are genuinely new; one already exists and is aimed somewhere else.**

### A glossary pipeline already exists, and it is paper-scoped

| file | what it does |
|---|---|
| `content/pipeline/build-glossary.ts` (332 ln) | walks every block **in a paper**, resolves each block's `defines[]` to chapter/section/block/Lean, emits `glossary.json` + `chapters/glossary.tex` |
| `content/pipeline/glossary-candidates.ts` (298 ln) | proposes an owner block per unowned slug, ranked by mention count |
| `content/pipeline/apply-glossary-curation.ts` | applies the human's choices |
| `ui/glossary-curator.html`, `src/routes/glossary.ts` | the human-in-the-loop half |
| `skills/library/library-core/glossary-build.md` | the governing skill |

Its input is `BlockBase.defines[]`, which **is** schema-backed
(`schemas/constraints.ts:261`, `schemas/types.ts:612`). Its output is a LaTeX
chapter. So the authored half of a *paper's* glossary is built and gated.

**It is not the thing the owner asked for.** The ask is over **KG assets** — BPMN
lanes, DMN decisions, roles, skills, Tool nodes — rendered into **`docs/`**. The
existing builder reads paper blocks and writes TeX. Different corpus, different
output, different consumer. Reusing it would mean teaching a paper-scoped LaTeX
builder to walk the knowledge graph, which is the wrong direction.

### There are already TWO `GlossaryEntry` types, and they share not one field

| | `content/pipeline/build-glossary.ts` | `schemas/formalization-types.ts:175` |
|---|---|---|
| fields | `slug`, `chapter`, `chapterTitle`, `section`, `block`, `kind`, `lean` | `narrative_term`, `lean_name`, `kind`, `lean_type`, `narrative_definition`, `latex_label`, `chapter`, `mathlib_type`, `mathlib_import`, `universes`, `depends_on`, `ambiguity` |
| what it is | a **location index** — where in the paper is this slug defined | a **Lean mapping** — which Mathlib type does this narrative term mean |
| where | pipeline-local `interface` | pipeline-local `interface` |

`kind` and `chapter` appear in both under the same names meaning different things
(block kind vs Lean decl kind; chapter *directory* vs chapter *number*).

**Neither is a content kind, and neither is a Zod schema.** So the owner's piece 2
— *"make coded-glossary content kind … should be in core asset there"* — is not a
rename of an existing type. It is the first schema-backed glossary object in the
repo, and it arrives into a namespace where the name is already taken twice by
two incompatible interfaces. **Naming a third `GlossaryEntry` is the single
easiest way to make this worse.**

### The sharpest finding: `skos:` is published in the `@context` and emitted by nothing

`SKOS_NS` is declared at `schemas/jsonld.ts:90` and bound as `skos:` in the
published context at `schemas/jsonld.ts:551` **and** in the shipped
`ns/content/v1.jsonld:11`. And `schemas/tabular-csvw.ts:10` states in prose that
this graph *"already speaks eight published vocabularies — doco, deo, cito, oa,
prov, **skos**, dcterms, fhir"*.

Measured across the repository, excluding `node_modules`, `.git` and `beans/`:

| vocabulary | nodes emitting a predicate |
|---|---|
| `doco:` | 1111 |
| `dcterms:` | 4 |
| `prov:` | 2 |
| `cito:` | 2 |
| **`skos:`** | **0** |

So the claim "this graph speaks skos" is **false**, and has been since the context
was written. A consumer that dereferences the context is told to expect SKOS terms
and will never meet one — the `dh4f` shape exactly (a declaration whose consumer
scans nothing and reports a clean run), one level up in the vocabulary rather than
in a directory.

**This turns the standards recommendation from a cost into a repair.** Adopting
SKOS is not adding a ninth vocabulary; it is making the eighth true. If the owner
overturns SKOS, the honest consequence is that `skos:` comes **out** of both
contexts and out of that sentence — a bound prefix nothing emits should not
survive this bean either way.

### What the measurement settles, and what it does not

Three of the five roast questions are now answerable from evidence:

- **Extraction vs authoring** — settled by precedent, not by argument.
  `glossary-candidates.ts` already models exactly this distinction for papers: a
  *candidate* with a rank and a reason is a different object from an owned
  `defines[]` entry, and a human promotes one to the other. The KG index should
  reuse that three-state shape (`authored` / `candidate, seen in N assets` /
  `could not extract`), not invent a second one. **`could not extract` must be a
  visible third state**, per the rule this repo applies everywhere else.
- **Coverage axis: report or refuse** — report. The owner's words are *"i want
  (but realistically can't require)"*, and `types.ts:914` already records that
  `defines` was measured **absent from all four** blocks that needed it. A gate
  over a field with known-zero coverage is a gate somebody switches off.
- **One glossary per instance or per asset** — both, and SKOS already has the
  answer: `skos:ConceptScheme` per instance, `skos:Collection` per content asset,
  a concept `skos:inScheme` one and `skos:member` of many. A paper's glossary
  reuses a core term by **membership**, never by copying the definition. This is
  why the model has to be SKOS-shaped rather than a flat list.

Two remain genuinely open and are the owner's to rule on:

- **Where a term's IRI lives** — instance namespace (`ns/`) or the asset that
  first defined it. Recommendation: the **instance namespace**, because the
  owner's constraint *"moving the asset must not move the term"* is exactly what
  an asset-derived IRI cannot promise. But this is a decision with a cost — it
  means a term outlives the asset that motivated it, and something has to say
  when a term is retired.
- **Whether the existing paper glossary converges on the new kind or stays
  separate.** Converging means `build-glossary.ts` eventually emits SKOS and the
  TeX chapter becomes a projection of it; staying separate means two glossary
  mechanisms live side by side permanently, which is what the bean was told to
  avoid. Recommendation: **converge, but not in the first PR** — build the KG
  index on the new kind first, and only then re-point the paper builder, so a
  working gated pipeline is never broken for a refactor.

### What this does to the plan

1. **Do not touch `build-glossary.ts` in the first change.** It is gated, it
   works, and it serves a different corpus.
2. **The new kind gets a name that is not `GlossaryEntry`.** There are two
   already.
3. **The first deliverable is the schema + the `skos:` emission**, because that
   is what retires the false claim. The `docs/` index is second and reads it.
4. `defines[]`'s measured-zero coverage is the honest baseline for the coverage
   axis, and is reported rather than gated.

## SLICE 1 SHIPPED, 2026-09-20 — and the roast had missed a THIRD mechanism

The roast enumerated two glossary mechanisms and warned that `GlossaryEntry` was
taken twice. **There is a third, and it is the one that mattered**:
`schemas/vocabulary.ts`, 421 lines, `CLASS_GLOSSES` + `PROPERTY_GLOSSES` —
**110 authored terms**, each a `TermGloss` with a one-sentence definition and a
layer. `scripts/ns-export.ts` already emits one node per term with an `@id`, a
type, a label and a definition, and `ns:check` already gates it.

That is a glossary. The roast's own instruction — *"check what it already does
before adding a second mechanism"* — was followed for `build-glossary.ts` and
not for this, which is the failure mode the instruction exists to catch, one
level over.

**It changes the slice, and for the better.** `TermGloss` maps onto SKOS almost
term for term:

| `TermGloss` | SKOS |
|---|---|
| the key (`FshGutsNode`) | `skos:prefLabel` |
| `gloss` | `skos:definition` |
| `layer` | which `skos:ConceptScheme` it is `skos:inScheme` of |
| the prefixed name (`cat:FshGutsNode`) | `skos:notation` — **the owner's "coded", already present** |

So slice 1 is not a new schema with zero content. It is **135 real concepts in
3 concept schemes**, no new authoring burden, and `notation` answers the coded
requirement with a value that is structurally unique rather than one somebody
has to remember to type.

### The ruling turned out not to be load-bearing here

`lqo9` listed *"where does a term's IRI live"* as blocking. Sourcing slice 1
from `vocabulary.ts` **dissolves it**: those terms already live in the instance
namespaces (`bs:`, `cat:`, `fac:`), so the recommendation — instance namespace —
is the status quo rather than a choice being made. The ruling still matters for
terms extracted from BPMN lanes and DMN decisions, which is slice 2. It is not
owed before slice 1, and this bean said it was.

### What shipped

`ns-export.ts` only. Each term node gains `skos:Concept` alongside its
`rdfs:Class`/`rdf:Property` type, plus `prefLabel`, `definition`, `notation`
and `inScheme`. Three `ConceptScheme` nodes are emitted, **derived from the
terms actually present** rather than from the three layers that exist — a
scheme with no members is `dh4f` in miniature, so a `--layer bootstrap`
slice carries exactly one. In `--exact` mode the document IS its layer's
scheme and carries both types, rather than a node sharing its own `@id`.

**The punning is named rather than hidden.** A term is both a thing the graph
has instances OF and a unit of meaning a reader looks UP. Two types on one node
is sound in RDFS and OWL-Full and is what published vocabularies do; it is
**not** sound under an OWL-DL reasoner. Nothing here runs one. The line to
revisit is marked in the source, with the usual repair named.

**The RDFS facts are untouched.** `prefLabel`/`definition` restate
`label`/`comment` rather than replacing them — `skos:prefLabel` is a declared
sub-property of `rdfs:label`, so the two agreeing is the spec's expectation —
and a test asserts they cannot drift.

### Falsified by mutation, five ways

| mutation | tests red |
|---|---|
| drop `skos:Concept` from `@type` | 7 of 10 |
| drop `inScheme` | 4 |
| stop emitting scheme nodes | 3 |
| let `prefLabel` drift from `label` | 1 |
| make `notation` non-unique | 1 |

Every count is checked against **zero before anything else**, because a suite
asserting "every concept has a definition" passes perfectly over a document
with no concepts — which is precisely the state `fd6i` measured and this change
exists to make impossible. That is `6tkl`, already introduced once this evening
by a change whose own tests were meant to guard it.

### Not done, and named

`fd6i` is **widened, not closed**: re-measuring all eight bound vocabularies
rather than the five it had showed `deo:`, `oa:` and `fhir:` each emit **0**.
The eight-vocabulary sentence in `tabular-csvw.ts` is still false; this repairs
one quarter of it. Recorded there.

## Standards — what fits a knowledge graph, and what does not

| standard | what it is for | fit here |
|---|---|---|
| **SKOS** (W3C) | concept schemes: `skos:Concept`, `prefLabel`/`altLabel` per language, `definition`, `scopeNote`, `notation` (the code), `broader`/`related`, `skos:Collection` | **Recommended core.** Native RDF/JSON-LD, so it drops into the existing `@context`; `notation` is exactly "coded"; multilingual labels are first-class; the thesaurus standard ISO 25964 was designed to be carried by it. |
| **schema.org `DefinedTerm` / `DefinedTermSet`** | lightweight web vocabulary for glossary entries | **Recommended as the rendered projection** of the same nodes — the docs index emits it in JSON-LD so the page is indexable; too thin to be the authoring model (no notes, no relations). |
| **Dublin Core Terms** | provenance and versioning metadata on the asset (`dcterms:hasVersion`, `modified`, `source`, `license`) | **Use on the glossary asset itself** — already in the instance's vocabulary (who-iris records are qualified Dublin Core). |
| **FHIR `CodeSystem` / `ValueSet`** | coded, versioned terminologies with per-language designations | **The export for WHO SMART Guideline folios.** A SKOS ConceptScheme maps to a CodeSystem one-to-one (concept ↔ concept, notation ↔ code, prefLabel ↔ display, altLabel ↔ designation, Collection ↔ ValueSet). Do not author in it: it carries clinical-terminology machinery a paper never uses. |
| **DCAT** | catalogues of datasets and their distributions | **Not a term model.** Right for describing the glossary as a published dataset in a catalogue (the who-iris catalogue-by-reference already speaks this shape), wrong for defining what a term is. |
| **ISO 25964** | thesaurus construction and interoperability | The rules; SKOS is its carrier. Read for the relation semantics, do not implement separately. |
| **TBX (ISO 30042)** | terminology interchange for translators | Heavy XML; only worth an exporter if a translation vendor asks for it. gettext already covers this instance's pipeline. |
| **OWL** | formal ontologies with reasoning | Overkill; definitions here are prose, not axioms. |
| **SKOS-XL** | labels as resources, so a label can carry provenance | Reach for it only if a translated label needs its own audit trail; otherwise plain SKOS. |

**Recommendation:** SKOS for the model (with `notation` for the code and `dcterms` on the scheme for version and provenance), schema.org `DefinedTerm` as the rendered JSON-LD, FHIR CodeSystem as a generated export for guideline folios, DCAT only where the glossary is listed in a catalogue. Versioning at two levels: the scheme carries `owl:versionInfo`/`dcterms:hasVersion` and a `skos:changeNote` log; a concept carries `dcterms:modified`. Translation keeps the concept IRI stable and treats `prefLabel`/`definition` per language as the translatable strings the existing `.pot` extraction already handles for BPMN labels.

## Roast questions — three settled by measurement, two with the owner

- Extraction vs authoring: a term extracted from a BPMN lane's description is not a curated definition. Does the index show extracted candidates in a third state ("undefined, seen in N assets") distinct from authored entries?
- Where does a term's IRI live — under the instance namespace (`ns/`) or under the asset that first defined it? Moving the asset must not move the term.
- One glossary per instance or per content asset, and how does a paper's glossary reuse a core term without copying its definition?
- Coverage axis: which asset kinds MUST contribute terms for the index to be called complete, and what does "could not extract" look like?
- Does the coded/versioned field pair become a QA criterion (report) or a profile rule (refuse)? The owner's words: wanted, not required.

## Done when

- [x] The roast above is held and its answers recorded here (2026-09-20) — three of five questions settled by measurement. Of the two rulings then outstanding, **where a term's IRI lives is settled** (2026-09-21: the instance namespace, retirement in the first extracting slice); **whether the existing paper glossary converges on the new kind is still open**
- [x] `glossary` exists as a content kind in core with optional `notation` and scheme-level version fields, validated by schema — **named something other than `GlossaryEntry`**, which is taken twice (2026-09-23: `folio-glossary/v1`, `Term`/`Glossary` in `folio-assistant-core/schemas/glossary.ts`; the harness's kind renamed `swimlane-glossary`)
- [x] The docs/ rendering carries a defined-terms index built from KG assets, with extracted-vs-authored distinguished (2026-09-24, piece 1 as posed: 2,421 `candidate` terms from skills, Tools, BPMN activities, DMN decisions and schema fields, shown apart from the 7 authored ones; see "PIECE 1 AS POSED SHIPPED" below)
- [x] Labels and definitions are extracted to `.pot` like BPMN labels (2026-09-24, owner: *"Authored terms only"*: 14 msgids from the 7 authored terms, one template per locale under `translations/<locale>/glossary/`, gated by `glossary:pot:check`; see "TRANSLATION AND RULING 2 SHIPPED" below)
- [x] ... and render per locale (2026-09-30, child bean `c592`: `glossary-page.ts` reads each locale's `.po`, writes `docs/<locale>/glossary/index.md` for ar/es/fr/ru/zh with the page chrome translated through `glossary-page.po`, and emits multilingual SKOS labels; drafted translations marked UNOFFICIAL, `translation:drift` passes)
- [x] Ruling 2: the paper `build-glossary.ts` converges on SKOS (2026-09-24, owner: *"Converge on SKOS"*): it writes a `folio-glossary/v1` scheme into the paper instance's glossary directory, and the page picks it up through `collect()`
- [x] The standards choice above is recorded as a decision (or overturned with reasons) — and either way `skos:` stops being a bound prefix that nothing emits (SKOS adopted; slice 1 took it 0 → 135, slice 2 adds 48 more concepts)

Related: `0lmb` (content model), `zzmr` (KG structure and publication), `bzyu` (translation pipeline), the who-iris catalogue work on PR #477, the existing `glossary-build` skill (folio-core) — check what it already does before adding a second mechanism.

## `docs-auto` — the owner's framing for where this lands, 2026-09-20

Owner (this session), reframing the ask as a HANDLER rather than a one-off page:

> in cat-harness needs to be harness/handler at `cat-harness/docs-auto/<auto-doc-type>/<path>`
> defined. which will auto-generate extracatable documentation at `<path>` sub-graph.
> extracablle = bpmn, tasks, glossary, etc. ther is a glosarry bean... this could clarify
> it lives at `cat-harness/docs-auto/glossary/<path>`

So piece 1 of this bean (*"a defined-terms index in the docs/ rendering"*) is not
its own renderer: it is **one `auto-doc-type` among several**, served by a single
handler that takes a sub-graph path and emits derived documentation for it. The
glossary index for a sub-graph lives at `cat-harness/docs-auto/glossary/<path>`.

Proposed `auto-doc-type` values, as the owner gave them:
`glossary`, `index`, `index/bpmn`, `index/dmn`, `index/skills`, `index/tasks`,
`index/processes`, `index/roles`.

**`toc` is OUT.** It was in the owner's first list and withdrawn in the same
session: *"no toc,... ther is no meanging at folio level/. (mayber later)"* — a
table of contents is a document-order notion and a folio has no single order to
take one over. Recorded here rather than dropped silently, because the next
agent reading the original list would otherwise re-add it.

Pieces 2–4 (the `glossary` content kind in core, coded + versioned in the
schema, translatable) are unchanged by this and are still this bean's.

**Not started.** Queued behind the who-iris ingestion work; the roast above still
holds and still gates any build.

## SLICE 2 — swimlane terms. Scoped 2026-09-21, prerequisites landed

Issue #596 names the source in the owner's own words: *"a bpmn diagram
swimlane has title/description"*. That input now exists and is gated —
**157 of 157 task-containing lanes carry a `<bpmn:documentation>`** (bean
`sqtq`, PR #782), with `check:lane-documentation` in the gate set so it stays
that way.

### The mapping is THREE predicates, not two

Measuring before writing found that 156 of the 157 lanes already resolve to a
role carrying a `description`. So a persona blurb per lane would have
duplicated `roles.json` — twelve times over for the lane named `Agent`.

| SKOS | source | answers |
|---|---|---|
| `prefLabel` | the lane's `name` | what is this called |
| `definition` | the **role's** `description` | who is this persona, in every diagram |
| `scopeNote` | the lane's `<bpmn:documentation>` | what is this lane accountable for **in this process** |

The owner's *"name, documentation → glossary"* holds — both feed it, at
different predicates. The lane text is SUPPOSED to differ per diagram; that is
its content, not drift.

### Owner's ruling, 2026-09-21: its own document

`ns-export.ts` already unions TWO sources — the `termIri("Name")` scan and the
registry-minted terms — with a test asserting the union is not redundant. So a
third source was *structurally* fine, and that is why it was a question rather
than a constraint.

The objection is editorial: a persona like `Board renderer` is a `skos:Concept`
but **not** an `rdfs:Class`, and folding personas in would make one document
answer two different questions — "what can the code mint" and "what does this
word mean to a reader" — falsifying its own docstring.

So: **a separate glossary document, in the same instance namespace.** Ruling A
is untouched; `conceptSchemeIri` and the layer model do not change. Cost,
stated: a second generator and a second staleness check.

### `laneBinding` is what makes the honest case expressible

Bean `ug4r` (PR #800) gives five answers where there were two. A lane whose
performer varies BY DESIGN emits a term with a `scopeNote` and **no**
`definition` — which is true — instead of being indistinguishable from a lane
nobody got round to binding. Without it the extractor would have had to guess,
and a guessed definition-less term reads as a defect.

### Retirement, per the earlier ruling

A term whose defining lane is gone becomes `deprecated`, **reported and never
deleted** — `deletion-requires-confirmation`, and the same reason a scrapped
bean is not a deleted one: retirement and accident must not look alike.

### SHIPPED 2026-09-21 — and measuring first corrected the mapping above

`scripts/glossary-export.ts`, run once per instance (`--instance <root>`, the
shape `kg-export` and `translate-bpmn` already use — never one wider scan,
which is `7u3g`). cat-harness: **43 concepts, 150 usages**. bootstrap: **5
concepts, 7 usages**.

**A concept is a ROLE, not a lane name, and the table above is wrong.** That
table is mine, not the owner's ruling — the ruling was "its own document", and
it stands untouched. Measured before writing:

| | |
|---|---|
| task-containing lanes | 157 |
| distinct lane names | 85 |
| distinct roles those names resolve to | **36** |
| roles reached by more than one distinct lane name | 17 |

`build-pipeline` is named **ten** ways across the corpus — *"CI/CD Pipeline"*,
*"Build pipeline — validate · render · publish"*, *"Scheduled log sweep"*,
*"Graph audit (system)"* and six more. `reviewer` is named nine. A concept per
lane name mints 85 terms for 36 meanings and copies one authored definition
onto ten of them — the exact duplication of `roles.json` this bean set out to
avoid, avoided per lane OCCURRENCE (157 → 85) and **not** per lane NAME. The
ten names are `skos:altLabel`, which is what `altLabel` is for and what makes
*"Reviewer / SME"* findable as *"Reviewer"* instead of a rival entry.

Both halves of the owner's *"name, documentation → glossary"* still land:
`name` as `prefLabel`/`altLabel`, `documentation` as `scopeNote`.

### `scopeNote` sits on the USAGE, never on the concept

Measured: of the **26** lane names appearing in more than one diagram, **26 of
26** carry different `<bpmn:documentation>` per occurrence — zero
counter-examples. A scope note answers *"what is this lane accountable for IN
THIS PROCESS"*, which is a fact about the appearance. Ten unattributed notes on
one concept would read as ten contradictions.

So each appearance is a `LaneUsage` node: the process, the label that process
gave the lane, and the note **verbatim**. Verbatim is not a style preference —
the lane documentation is a `.pot` msgid, so a note stored exactly as the
diagram wrote it has a translation waiting in all five locales. Wrapping it
(`In "<process>": <note>`) reads well in English and produces a string no
catalogue contains, breaking `jmpb` before it is built.

### No second name for one thing

A concept's `@id` is the IRI `kg-export` ALREADY mints —
`makeIri(docIri, "role", id)`, imported rather than re-spelled. `kg-export` has
emitted registry-derived `Role` nodes since 2026-09-19, and `performedBy` links
point at exactly those IRIs; a parallel `cat:reviewer` would be two names for
one resource and would leave the glossary unjoinable with the graph. Checked
rather than assumed: **0 of 47 role ids collide with any of the 111 vocabulary
term names**, exactly and case/hyphen-insensitively.

### Retirement needed a LEDGER, which the design above had not accounted for

A derived document has no memory. Delete a role and its concept stops
appearing — which is what *"never existed"* also looks like, so "reported and
never deleted" is unimplementable without storing the one non-derivable fact:
that a term was once minted.

`glossary/glossary-ledger.json`, declared as graph kind `glossary`
(`holds: "state"`) in both instances. Keyed on the IRI's **local part**, never
the absolute IRI: the publication base is a deploy-time variable, and a stored
absolute IRI would rot the day it moved and take every retirement record with
it. `glossary:check` in the gate set is what keeps it current.

**Usages are not ledgered**, deliberately: a usage is an occurrence,
regenerated wholesale, while a concept is a term somebody may have cited.
Ledgering 157 occurrences would bury the 36 records that matter.

### `laneBinding` used as the only route from a lane to a concept

So `variable` cannot be read as `unbound` by accident. bootstrap's one varying
lane emits `bs:…#lane/Actor` with a usage and **no** `definition` — an
assertion, not a gap.

### Reported, never gated

- **11 declared roles no swimlane draws.** They are still concepts (omitting
  them would be `dh4f`) and are named in the report. 8 declare no `lanes[]` at
  all — agent personas nothing draws, by design.
- **1 dangling lane binding** was reported: `translation-adjudicator` binding
  *"Human reviewer / adjudicator"*. **THAT FINDING WAS FALSE**, corrected
  2026-09-22 while roasting `7pdi`. The lane is real; the extractor could not
  see it, because `translation-workflow.bpmn` declares BPMN as the DEFAULT
  namespace and writes `<lane>` with no `bpmn:` prefix, which every prefixed
  regex here missed. A false finding is worse than none — the next agent goes
  looking for a lane to add that is already there.

  Fixed with the namespace-tolerant readers; the corpus is **159**
  task-containing lanes, not 157, and the glossary is **43 concepts / 152
  usages**.

  **And 159 has since moved too — `check:lane-documentation` reports 186 on
  2026-09-24.** Every lane figure above this line is a *dated observation*,
  not a property of the corpus: this bean has now been behind twice (157, then
  159), and `swimlane-glossary` carried the original 157 with no correction at
  all until the same date. **Re-derive it — `bun run cat check:lane-documentation`
  — rather than quoting any number from this bean.** None of the arguments
  here depends on the figure; they depend on there being far more lane names
  than roles, which holds at any scale. `log` and `session-record` remain correctly reported as declared
  roles no swimlane draws: their lanes exist but hold no task, which is not a
  defect — an `actedUpon` lane holds none by construction.

### Falsified by mutation, six ways

| mutation | tests red |
|---|---|
| drop the deprecated node | 1 |
| re-stamp `retiredOn` every run | 1 |
| key the ledger on the absolute IRI | 4 |
| read `variable` as `unbound` | 3 |
| move `scopeNote` onto the concept | 1 |
| drop `altLabel` | 1 |

Every count is asserted against **zero first** — a suite checking "every
concept has a definition" passes perfectly over a document with no concepts,
which is `6tkl`.

### Not done, and named

- The **docs/ rendering** (piece 1) is not built. It is one `docs-auto`
  auto-doc-type, per the owner's framing above, and reads this document.
- The **content kind in core** (piece 2) is untouched: this is the harness's
  KG glossary, not a paper's.
- **Per-locale rendering** is `jmpb`. This document is English-only today, and
  the verbatim scope notes are what make it translatable without a re-extract.
- Ruling 2 — does `build-glossary.ts` converge? — still open, still untouched.

## PIECE 1 SHIPPED 2026-09-22 — the defined-terms index in docs/

The owner's first piece — *"justthedocs docs/ rendering should include an index
of all defined terms extracted from KG assets"* — reframed by them later as one
`docs-auto` auto-doc-type at `cat-harness/docs-auto/glossary/<path>`.

Built as exactly that. `gen-docs-auto.ts`'s own header had listed it as
*"declared but NOT built: `glossary` (bean `lqo9` holds a roast that gates
it)"*. **That roast is held and slice 2 shipped**, so the gate lifted and the
type went in beside `index/skills` and `index/processes`. No new URL rule, no
fourth pruner — `viewerPlacement` and `orphanSubjectPages` already route it.

**44 terms across 1 sub-graph**, every one carrying its real definition.

### It reads the LEDGER, joined with the REGISTRY

Two sources, each for what only it has:

| source | gives | why not the other |
|---|---|---|
| `glossary/glossary-ledger.json` | identity, `firstSeen`, retirement | the glossary DOCUMENT lives in `_kg/`, absent from a checkout — an index built from it would be empty locally and full in CI |
| `scenarios/roles.json` | the definition | copying definitions into the ledger would be a second copy free to drift from the authored source |

Same join `glossary-export.ts` makes. `glossary-export.ts` itself is
deliberately NOT imported: it builds the whole KG export to do its job, which
is seconds of work for a page needing four fields — and `06e3`'s own rule is
that an index reuses assets rather than recomputing them.

### The first version defined nothing, and only the PAGE showed it

It read the ledger alone, and all 44 rows said *"no description in the
artefact"* — a glossary index that defines nothing, which is the opposite of
what #596 asked for. The generator ran clean, the count was right, and the
defect was visible only by opening the page. `continual-progress` again:
a description of a rendered artefact is not the artefact.

### And it found a defect in the sibling index

`index/processes` shared the `<bpmn:`-prefixed regexes — the fourth reader
with that blind spot — so `translation-workflow.bpmn` appeared in the index
with **its filename for a name and no lanes, skills or summary**. Worse than
absent: a row is there, so nothing looks missing.

Fixing it exposed a second, larger one: the summary regex took the first
`<documentation>` anywhere after the process opened, so **16 of 61 diagrams
were showing a LANE's documentation as the process summary** — which became
true the day `sqtq` wrote 157 lane documentations. Filed as `7rna`; the
extractor now takes only a DIRECT child and the 16 say so honestly.

### Done when — status

[x] The docs/ rendering carries a defined-terms index built from KG assets

Extracted-vs-authored is not yet distinguished on the page: every term here is
AUTHORED (a role in the registry), because slice 2 mints a concept only from a
declared role or a declared varying lane. The *candidate* state the roast
described arrives with a source that can produce one, which this is not.

## RULING 2 — FULL ANALYSIS, 2026-09-22, on the owner's ask

Owner: *"2 need full analysis, SKOS vs DCAT vs others... anything json(ld)
centric for our ecosytem or has pre-exsting warppers? need something robust to
handle medical codeings (a la ICD) with versision of tersm, translation,
releases, etc."*

### The question changed, because the measurement did

Ruling 2 was *"does `build-glossary.ts` converge on the new kind?"* — a
question about two glossary mechanisms. **Measured before answering: this
repository already has TWO TERMINOLOGY SYSTEMS, each incumbent in its own
layer**, and the ICD requirement lands squarely on the one nobody was talking
about.

| | what it is | where |
|---|---|---|
| **SKOS** | the harness's KG glossary — 135 vocabulary terms (slice 1) + 44 swimlane roles (slice 2) | `ns-export.ts`, `glossary-export.ts` |
| **FHIR CodeSystem / ValueSet / ConceptMap** | a folio's CLINICAL terminology | `terminology-management` skill, `schemas/skills/terminology-management/`, a `Terminologist` lane in `l2-dak-authoring.bpmn` |

The FHIR half is not a candidate. Its input schema's `operation` enum is
already `create-codesystem` / `create-valueset` / `create-conceptmap` /
`validate-bindings` / `map-to-standard`, and its `targetStandard` enum is
already **`ICD-11`, `SNOMED-CT`, `LOINC`, `IPS`, `WHO-FIC`, `WHO-ATC`**. The
`terminologist` has their own swimlane because *"a wrong binding is invisible
downstream"*. `fhir-validation` validates the output, `smart-base-tools` runs
the toolchain.

So the ICD question has an incumbent answer in this repository, and the real
ruling is about the RELATION between the two, not a choice between them.

### What ICD-class codings actually demand

The discriminator list, because "robust" has to mean something checkable:

1. **Concept-level versioning** — a code's meaning can change between releases
2. **Release / edition management** — ICD-11 has dated releases; ICD-10 is a
   different system, not an older version
3. **Designations with a USE** — a fully-specified name, a synonym and a
   display are different things in the same language
4. **Per-language designations**, not just a label with a language tag
5. **Post-coordination** — ICD-11 builds compound expressions from a stem plus
   extension codes
6. **Foundation vs linearization** — ICD-11 separates the semantic network
   from the tabular list you actually code against
7. **Deprecation with a successor**, not just a `deprecated` flag
8. **Mapping with equivalence semantics** — "narrower than" is not "equals"
9. **Licensing** — SNOMED requires an affiliate licence, which constrains what
   may be redistributed in a published graph

### The scorecard

**SKOS** — *right for a glossary, structurally insufficient for ICD.*
Native RDF/JSON-LD, drops into the existing `@context`; multilingual labels are
first-class; `notation` IS the code; `broader`/`narrower` handles
poly-hierarchy. But: **no versioning model at all** (1, 2), no designation
*use* (3), no post-coordination (5), and its mapping properties
(`exactMatch`, `broadMatch`) carry no provenance or confidence (8). Reaching
for extensions to cover those is rebuilding FHIR's terminology layer in a
vocabulary that was designed not to have one.

**DCAT** — *not a term model, and the best answer to a question SKOS and FHIR
both answer badly.* It says nothing about what a concept means. What it IS
good at is (2): `dcat:Dataset` + `dcat:Distribution` +
`dcterms:hasVersion` + `adms:versionNotes` is exactly how you describe a
RELEASE of a terminology as a published, discoverable, versioned artefact.
Complementary, never competing. The who-iris catalogue-by-reference work
already speaks this shape.

**FHIR CodeSystem / ValueSet / ConceptMap** — *the only candidate that meets
the list.* `CodeSystem.version` + `status` + `date` (1, 2);
`concept.designation` with `use` and `language` (3, 4); `property` for typed
concept properties including `inactive` and `notSelectable` (7);
`ValueSet.expansion` with a timestamp, which IS a pinned release artefact (2);
`ConceptMap.relationship` with equivalence semantics (8); and `$lookup`,
`$validate-code`, `$subsumes`, `$translate` — an OPERATIONAL layer, not only a
data model. Post-coordination (5) and foundation-vs-linearization (6) are
handled by the code system's own rules, which is the honest answer: FHIR
carries them rather than solving them.

Costs, stated: JSON is native and **RDF/JSON-LD is a defined but second-class
serialization**; and it carries clinical machinery a paper glossary never uses.

**Others, named so they are ruled out by a reason rather than by silence:**

- **SKOS-XL** — labels as resources, so a label can carry provenance. Fixes
  part of (3). Still nothing for (1), (2), (5).
- **ISO 25964** — the thesaurus rules; SKOS is its carrier. Adds version
  notes, not a version model.
- **OWL** — ICD-11's foundation is OWL-shaped, so this is not absurd. Overkill
  here: definitions in this repository are prose, not axioms, and nothing runs
  a reasoner.
- **CTS2** (OMG) — explicitly designed for versioned terminology services, and
  genuinely covers (1) and (2). Superseded in practice by FHIR terminology
  services; adopting it would mean leaving the ecosystem this repo is in.
- **SSSOM** — Simple Standard for Sharing Ontological Mappings. TSV/JSON with
  a JSON-LD context, biomedical, and **better than `ConceptMap` at recording
  HOW a mapping was made** — confidence, justification, author, date. Worth
  naming as a complement for (8) where provenance of a mapping matters more
  than its operational use.
- **schema.org `DefinedTerm` / `DefinedTermSet`** — too thin to author in; the
  right RENDERED projection for a docs page, because it is what a search
  engine reads.
- **OMOP / ATHENA** — relational, not JSON-LD, and a research-analytics model
  rather than an authoring one.
- **Wikibase** — statements with qualifiers and references give per-assertion
  provenance and validity dates, which is genuinely more than any of the
  above. It is a whole platform, not a vocabulary.

### JSON-LD centricity, and the wrappers — MEASURED

The owner asked what is JSON-LD-centric *for this ecosystem* and what has
pre-existing wrappers. The measurement is blunt:

**This repository has 28 dependencies and NOT ONE of them is an RDF, JSON-LD,
SPARQL or FHIR library.** Every JSON-LD document here — the content context,
`ns-export`, `kg-export`, `glossary-export` — is hand-rolled object literals
with a hand-written `@context`. Nothing validates them as RDF, and no
`jsonld.js` expands them.

That is a real finding independent of this ruling: the graph is JSON-LD by
*convention*, not by *construction*, and a malformed `@context` would be
caught by no test here.

| standard | JSON-LD | wrapper, if adopted |
|---|---|---|
| SKOS | native | none needed; `jsonld.js` to validate |
| DCAT | native | same |
| SSSOM | JSON-LD context published | reference impl is Python |
| FHIR | RDF is defined; **`smart-base` already carries `generate_jsonld_vocabularies`** | `sushi` (FSH→FHIR) is ALREADY in this ecosystem — `l3-fhir-authoring`, `fhir-validation` |
| ICD-11 | WHO publishes a REST API (OAuth) with per-release URIs | thin clients only; the API is the integration point |

The FHIR bridge is the one that matters and it already exists upstream:
`smart-base`'s `generate_jsonld_vocabularies`.

### Recommendation — three layers, and the bridge is the answer

**1. SKOS stays the harness's glossary.** A swimlane persona has no release,
no designation use and no post-coordination, and never will. Adding a version
model to it would be machinery for a requirement that does not exist here.

**2. FHIR stays a folio's clinical terminology.** It is incumbent, it is the
only candidate meeting the ICD list, and the `Terminologist` lane already
exists to work it.

**3. DCAT describes a RELEASE of either**, when one is published as a dataset
somebody else consumes. This is the piece neither of the other two does, and
the one genuinely missing today.

**The bridge is `ConceptMap` (operationally) or SSSOM (for provenance):** a
harness glossary term MAY map to a clinical code, and that mapping is a third
object with its own equivalence semantics. What must not happen is SKOS
growing a `version` field, or a swimlane persona acquiring a `CodeSystem`.

### What this does to Ruling 2 as originally posed

**`build-glossary.ts` should converge on the SKOS kind — and that is now the
SMALL half of the answer.** A paper's glossary and the KG glossary are both
"what does this word mean to a reader", so one mechanism is right and two is
the duplication the bean set out to remove.

**Convergence STOPS at SKOS.** The larger half: a clinical code system is a
different object with different obligations, and the failure mode this
analysis exists to prevent is somebody reading "one glossary mechanism" as
"one terminology mechanism" and binding an ICD-11 code to a `skos:Concept`
with a `notation` and no version. That produces a graph that looks right,
validates, publishes, and is wrong the next release.

### Open, and genuinely the owner's

- **Does DCAT get built, or only named?** Nothing publishes a release
  descriptor today. It is the missing third layer, and it is also the least
  urgent because nothing outside this repo consumes these graphs yet.
- **Is the hand-rolled JSON-LD worth a real processor?** `jsonld.js` would
  catch a malformed `@context` that nothing catches now. That is a dependency
  decision, not a terminology one, and it wants its own bean.
- **SSSOM alongside `ConceptMap`, or only `ConceptMap`?** Only if mapping
  PROVENANCE has to be queryable. Do not adopt both without that requirement.


## PIECE 2 SHIPPED, 2026-09-23 — core owns `glossary`, and a glossary may be references

Owner: *"put glossary into folio-assistant-core"*, *"part of general pracice w/ glossary/ page"*, *"can glossary be refefences to external skos schema?"* (yes), and on the name clash, *"Rename harness one"*.

- The harness's ledger kind is now `swimlane-glossary` (directory ids too, so core's `glossary/` cannot shadow it through the overlay). Its dashboard moved to `docs/swimlane-glossary/`.
- Core registers `glossary` on load (`cat-harness/schemas/glossary-graph-kind.ts`, the `folio` pattern, one more permitted edge). Schema and SKOS emitter: `folio-assistant-core/schemas/glossary.ts` (`folio-glossary/v1`: the three states, instance-namespace IRIs, `exactMatch`/`closeMatch`/`broadMatch`/`narrowMatch` to external concepts, `members` as a `skos:Collection`). A whole external scheme is a `remoteGraphs` entry with `graphKinds: ["glossary"]`.
- Core declares `glossary/` with `dependents: reproduce`, so every folio on core has one. It holds 7 authored platform terms, each linked to its W3C concept.
- `docs/glossary/` (A–Z, filter, schema.org `DefinedTermSet`) and SKOS JSON-LD per scheme, generated by `folio-assistant-core/scripts/glossary-page.ts`, gated by `check:glossary`. The swimlane ledgers are linked as sources, not re-rendered. This answers `n5be`'s first finding (no way to find a term) for the new page.
- Still open: the docs-auto defined-terms index across all KG assets (piece 1 as posed), translation (piece 3), paper `build-glossary.ts` convergence, and a cross-instance search index (`4pm8`).

## PIECE 1 AS POSED SHIPPED, 2026-09-24: every KG asset with a title and a description

Owner, 2026-09-23: *"everything extracted to glosasay / skos? accesible in ihris page/search?"* and *"it should be part of general pracice w/ glossary/ page"*. The 2026-09-22 piece 1 covered swimlane roles only. This covers the rest of the list the bean opened with.

### What shipped

`folio-assistant-core/scripts/glossary-extract.ts`, called by `glossary:page` and gated by the existing `check:glossary` (no new script in `package.json`, no new CI step). It writes one `folio-glossary/v1` scheme per asset type per instance to `folio-assistant-core/glossary/generated/<instance>/<type>.glossary.json`, resolved from core's declared `glossary` directory. It sits beside the authored file and never over it. The `kg-` scheme prefix is reserved, and an authored scheme that takes it fails the gate.

| asset type | scheme | terms | with a definition |
|---|---|---|---|
| skills (front matter `name` / `description`) | `kg-skills` | 269 | 218 |
| Tool nodes (`title` / `description`) | `kg-tools` | 98 | 98 |
| BPMN tasks and call activities (`name` / own `<documentation>`) | `kg-bpmn-activities` | 530 | 528 |
| DMN decisions (`name` / own `<description>`) | `kg-dmn-decisions` | 9 | 0 |
| schema fields with a doc comment (`Decl.field` / first paragraph) | `kg-schema-fields` | 1515 | 1515 |
| **total** | 19 schemes over 8 instances | **2421** | |

- Every term is `candidate`. Its `source` is the asset (`path#element`), and its definition is the asset's own text, verbatim (whitespace folded, XML entities decoded). An asset with no description gives a term with none: 51 skills with no front-matter description, the 9 DMN decisions (whose `<description>` elements all belong to rules, never borrowed), and 2 activities.
- IRIs are in the namespace of the instance whose root holds the asset (`instanceNs`), so a skill in `folio-assistant-core/skills/` is core's even though `cat-harness.json` declares that directory with `scope: "repository"`.
- A duplicate label is two concepts in their own schemes, never a merge. `id` alone is a field of dozens of schemas.
- **BPMN lanes and roles are NOT re-extracted.** The swimlane ledger carries all 46 role concepts, with lane names as `altLabel`. The page links it, and a test asserts no extracted term comes from `roles.json` or a lane element.
- **Schema fields use the first PARAGRAPH, not `doc`.** The schema-graph reader's `doc` is the first LINE, and 177 of 1,515 documented fields break their first sentence across lines ("OPTIONAL because folio"). A half-sentence is not a definition, so `schema-graph.ts` gained `paragraph` (reader only, not in the published projection).

### The page: extracted distinguished from authored

`docs/glossary/` now shows the counts by state. Each extracted row carries a "candidate, extracted" badge, and a **Show** choice (all / authored only / extracted only) sits beside the text filter. The Sources section splits into authored and extracted, with an instance × asset-type table of counts linked to each SKOS file. schema.org `DefinedTermSet` carries the **authored terms only**: it is what a search engine reads as "this site defines X", and a candidate is not a curated definition. The SKOS carries everything, with `skos:note "candidate"`.

**Size, measured:** the page went from **9 KB (7 terms) to 1.4 MB (2,428 terms)** before compression. It is fetched in one request and the page states that near the top. It keeps A–Z and the filter. No search engine was added (bean `4pm8`: Pagefind only in the large-datasets sub-graph). To keep the size down, an extracted row does not print its term IRI, because that was the largest cost per row. An authored row still prints it. The generated schemes are 1.0 MB and the SKOS 1.9 MB, both committed. `{` is escaped on the page, because an extracted `{{` would be read as Liquid.

**Superseded 2026-09-24 by the split below.** The Show choice is gone and the single page is now an index plus one page per asset type.

### SPLIT PER ASSET TYPE, 2026-09-24 (owner decision)

The owner, asked what to do about the 1.4 MB page (1.5 MB by the time it was split), chose **"Split per asset type"**:

- `docs/glossary/` (the index) keeps the authored terms, the counts, the Sources, and a Pages table linking each asset type's page with its term count and size.
- `docs/glossary/<type>/` for skills, tools, bpmn-activities, dmn-decisions and schema-fields each holds that type's extracted candidates from every instance, with A–Z, the text filter and the "candidate, extracted" badge. The Show choice went: each page now holds one state.
- The SKOS files are unchanged.

**Sizes, measured before compression:**

| page | before | after |
|---|---|---|
| `glossary/` | 1.5 MB (1,522,496 B, all 2,439 terms) | 16 KB (15,998 B; 7 authored terms, in 2 schemes after the ownership rule below) |
| `glossary/skills/` | — | 192 KB (196,833 B; 271) |
| `glossary/tools/` | — | 63 KB (64,772 B; 98) |
| `glossary/bpmn-activities/` | — | 403 KB (412,891 B; 531) |
| `glossary/dmn-decisions/` | — | 7 KB (7,057 B; 9) |
| `glossary/schema-fields/` | — | 823 KB (842,971 B; 1,523) |

**Budgets:** 64 KB for the index and 1 MB for an asset type's page (`PAGE_BUDGET` in `glossary-page.ts`). Each page states its size and budget, and `check:glossary` fails a page over budget. A page that outgrows its budget is split further, not given a larger one. Schema fields is the closest, at 80% of its budget.

**Tests** (`glossary.test.ts`, "the glossary pages"): every term appears exactly once across all the pages, on the page its scheme belongs to; the index holds authored terms only and each type page only its type's extracted terms; each page is under its budget and says so; the index links every type page and each links back; every page keeps the filter and A–Z. Mutation-checked by hand, 4 ways, each red: a type's terms also rendered on the index (4 tests), a type link dropped from the index (1), a budget halved (1), a type page's term list dropped (4).

The wireframe `docs/wireframes/glossary-page/` now has two candidates, `as-is.html` (the index) and `as-is-type-page.html` (Schema fields), each checked at web 1280 and mobile 390.

### Terms minted by the instance that owns their source, 2026-09-24 (owner rule)

Owner: *"make sure all glossary terms properly localed to ihris so [no] collision w/ other subgraphs. general rule/skill"*. A scheme and its terms live in the namespace of the instance whose root holds the source asset. In a folio with sub-instances that is the sub-instance, never the root, even when the `glossary/` directory is declared at the root. A code list extended by several packages belongs to the instance that defines it, which the scheme names with its own `source`. The rule is in `glossary-terms.md` § Conventions.

- `collect()` now places an authored scheme with `schemeOwner`: the instance its own `source` names, otherwise the one instance holding every term's source, otherwise the declaring instance. It refuses a scheme sourced in several instances with no defining source.
- `check:glossary` adds three checks over every instance: (a) no two schemes mint one scheme IRI; (b) no two instances resolve to one namespace; (c) every term with a repository source, authored or extracted, has its IRI in the owning instance's namespace. `glossary.test.ts` recomputes ownership independently of `collect()`. Each check was mutation-tested by hand and went red: a duplicate scheme, `bootstrap` given cat-harness's stub, authored schemes minted in the declaring instance, and extracted schemes minted in core.
- **One authored scheme broke the rule.** Core's `platform` scheme had 6 of its 7 terms sourced in cat-harness. It is now split: `folio-assistant-core/glossary/cat-harness.glossary.json` (cat-harness's `platform`, 6 terms) and core's `platform` (1 term, `glossary`). **Six published IRIs moved** from `…/folio-assistant-core/ns#glossary/platform/<id>` to `…/cat-harness/ns#glossary/platform/<id>`, one day after they were first published. The SKOS gained `cat-harness--platform.skos.jsonld`. Extracted terms were already compliant.

### docs-auto: considered and not used, and why

`gen-docs-auto.ts` has the auto-doc-type mechanism the owner described (`cat-harness/docs-auto/<type>/<path>`), and its `glossary` type already exists for the swimlane ledger. It does not fit this piece. A docs-auto type returns `AutoDocItem[]`, one row per artefact FILE for one sub-graph page, and emits no SKOS. What was asked is per ELEMENT (one diagram holds dozens of activities), needs IRIs in the owning instance's namespace, and must land in the SKOS the glossary page publishes. `index/skills` and `index/processes` already list the same artefacts per sub-graph, so a docs-auto glossary type over them would have been a third rendering. The extraction therefore plugs into core's glossary flow. The docs-auto `glossary` type is unchanged and linked from the page.

### Falsified by mutation, 13 ways

| mutation | tests red |
|---|---|
| skill definition paraphrased | 1 |
| schema-field definition embellished | 1 |
| DMN decision borrows a rule's description | 1 |
| lanes extracted as activities | 1 |
| `@` dropped from local ids (`@id` collides with `id`) | 1 |
| extracted terms marked authored with an invented definition | 3 |
| every extracted IRI put in core's namespace | 1 |
| page stops marking extracted rows | 1 |
| schema.org carries candidates | 1 |
| Tools dropped | 2 |
| skill source written relative to the instance | 3 |
| BPMN anchor not the real element id | 1 |

The `@` mutation survived the first version of the test, which compared qualified keys only. The test now compares bare keys too.

### Found, not fixed (asset defects the extractor reports verbatim)

- Some BPMN activity names hold a double-escaped entity (`1 &amp;#183; Declare in place&amp;#10;…` in `graph-detanglement.bpmn`), so the label reads `&#183;` literally. That is the diagram's text and is not the extractor's to repair.
- 51 skills carry no front-matter `description`, and the 9 DMN decisions carry no decision-level `<description>`. Each is a candidate with no definition, as the rules require. Writing those descriptions is authoring work.

### Still open

- Translation (piece 3, the `.pot` extraction of labels and definitions), `jmpb`.
- Ruling 2: convergence of the paper `build-glossary.ts` onto SKOS.
- Promotion tooling. Promoting a candidate is authoring it by hand in a glossary of one's own. No curator UI exists for KG candidates the way `ui/glossary-curator.html` does for paper slugs.

## TRANSLATION AND RULING 2 SHIPPED, 2026-09-24

Owner, 2026-09-24, structured answers: translation is *"Authored terms only"*,
and ruling 2 is *"Converge on SKOS"*. Owner rule the same day: a glossary IRI is
localised to the instance that OWNS the source asset, a sub-instance's for a
sub-instance, and scheme IRIs are unique across instances.

### Translation (piece 3): the `.pot` half

- `folio-assistant-core/scripts/glossary-pot.ts` (`glossary:pot`, gated by
  `glossary:pot:check` in the "glossary page and SKOS" CI step). It extends the
  BPMN pipeline rather than building a second one: `formatPot`, the shared
  `potWithoutTimestamp` (moved out of `translate-bpmn.ts` into
  `pot-extract.ts` so the two checkers cannot disagree), and cat-harness's
  declared `translation-sources` directory.
- One template per scheme with an authored term:
  `translations/<locale>/glossary/<instance>--<scheme>.pot`, named after the
  SKOS asset. Today that is `folio-assistant-core--platform.pot`, **14 msgids**
  (7 labels, 7 definitions) in each of the 5 locales. None of the 2,431
  extracted candidates is a msgid.
- The term IRI is the translator comment, never a msgid: it stays the same in
  every language.
- `translations/<locale>/glossary.po` is a different, hand-authored file (the
  terminology hints of `he0e`), so the templates use a `glossary/` directory.
- `gen-translation-status.ts` counts every `.pot` under a locale, so the
  status page shows the new templates with no change to it.
- **Next step, not done:** per-locale rendering. The page is built by
  `glossary-page.ts`, which reads no `.po`; rendering per locale means
  teaching it to (and a per-locale SKOS, as `kg-locale-export` does for the
  graph). That file was being split per asset type in a parallel change, so it
  was left alone here.

### Ruling 2: the paper glossary on SKOS

- `build-glossary.ts` now also writes `paper-<paper>.glossary.json`, a
  `folio-glossary/v1` scheme, into the glossary directory the paper's OWN
  instance declares. `collect()` reads it like any other scheme, so the IRIs
  are in that instance's namespace by construction.
- Status by provenance: a term whose owning block is `kind: "definition"`,
  with its `:defterm` paragraph found, is `authored`; one introduced in a
  theorem, remark or other block is `candidate`; one with no `:defterm`
  paragraph (or no `.md`) is `could-not-extract` with its reason. The
  definition is the `:defterm` paragraph verbatim, directives replaced by
  their labels. The slug is the `notation`.
- `glossary.json` and `glossary.tex` are unchanged, byte for byte: the TeX
  chapter and the Lean synonyms module read them, and their `--check` is what
  a paper's CI runs. `--check` now also fails on a stale scheme, on two slugs
  minting one term id, and on a scheme id another document in the directory
  holds. A scheme not yet written is reported, not failed, so a paper that has
  not regenerated keeps a green gate.
- An instance that declares no glossary directory gets a notice and no scheme
  (nothing is guessed). `init-folio` does not declare one yet.
- No paper instance exists in this repository, so the page shows **0** paper
  terms today; the behaviour is proved on a two-instance fixture
  (`build-glossary-skos.test.ts`).
- The two `GlossaryEntry` interfaces: the paper builder's is still the shape
  of `glossary.json`, which downstream `--check` compares, so it is not
  redundant yet. It becomes redundant when the TeX chapter is rendered from
  the SKOS scheme instead; that is a later change.
  `formalization-types.ts`'s `GlossaryEntry` is a Lean mapping and unrelated.

### Open, the owner's

- Is a paper's definition block the right line for `authored`? The
  alternative is that every paper term is a `candidate` until promoted by
  hand, as the KG extraction is.
- Should `init-folio` declare `glossary/` for a new paper folio?



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open branch touches it; the sessions that held theme D (content folios, SMART/FHIR stack, ingest) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.



## Closed 2026-09-30 — every Done-when item ticked
The last one, per-locale rendering, landed as child `c592` on branch claude/brave-hawking-511rrx (PR #1483). Its other two children (`ftu0`, `x5o1`) are completed too, which is what `check:bean-rollup` flagged: a `todo` over three closed children. Open follow-up outside this bean: `c1lo` (translated pages render `<html lang="en-US">`, no `dir="rtl"`).
