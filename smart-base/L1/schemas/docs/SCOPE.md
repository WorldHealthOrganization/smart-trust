# What this graph holds, and what it refuses to

> **Migrated from WorldHealthOrganization/smart-kg `docs/SCOPE.md` at 3f5e477** (issue #359). smart-kg is deprecated (owner, 2026-10-16); this copy is the one to edit. Paths now point at smart-base: each layer is a named subgraph, `smart-base/<Layer>/schemas/` (L1, L2, L2-bpmn, L2-dmn, L3), the engine and these docs are in `smart-base/L1/schemas/`, and the generated JSON, contexts, Turtle and Cypher are in each layer's `generated/`. A command written `npx tsx <path>` runs from the repository root after `npm ci` in `smart-base/L1/schemas/`.

Read this before adding anything.

## The rule

> Graph a relationship only when it has **no other representation** *and* a **named consumer that
> will traverse it**. Cheap generation is not justification. An artefact with no reader is a
> liability regardless of how it was produced.

The second clause is the one that gets skipped. A relationship can be genuinely unrepresented
elsewhere and still not belong here, if nobody will ever query it. This repository has already been
rebuilt once for failing exactly that test: an earlier version generated a 102-class ontology from
WHO's ArchiMate model, faithfully and at almost no cost, and every reference to it was inside this
repository. It was deleted.

### The corollary

> **Graph what has no other query layer; index what does.**

BPMN and DMN internals live only in XML, which nothing can query across files — so they may be
graphed. FHIR internals live in FHIR, which has canonical references, a validator and a publisher —
so they are indexed by URL and never re-represented. Applying this consistently is what stops the
graph becoming a worse copy of the artefacts it points at.

---

## Three hard boundaries

### 1. Terminology is cross-referenced, never modelled

The `terminology-code` class carries `system`, `code`, `display` and `version`. Nothing else.

It is a **leaf**: the ontology licenses edges *into* it and none *out of* it, and
`smart-base/L1/schemas/validate.ts` enforces that. No hierarchy, no subsumption, no synonyms, no post-coordination,
no expansions.

ICD-10, ICD-11, SNOMED CT and ATC each have their own authority, release cycle, licensing and
tooling. A partial copy here would be wrong within one release and would be trusted anyway, because
it would look authoritative. Resolve meaning against a terminology server. This graph records only
that a code was *cited*.

The same applies to WHO's own classifications. CDHI gets a `classifiedAs` edge — kept separate from
`crossReferences` because classification is an assertion about the intervention rather than a
mention of a code — but it is still just a code, not a copy of the classification.

### 2. No patient data, ever

A `PlanDefinition` is a definition. A `CarePlan` is its execution against a real person. The moment
a graph reaches that layer it stops being a documentation artefact and becomes a data-governance
problem with an entirely different review process, legal basis and threat model.

L4 execution artefacts — `CarePlan`, `ServiceRequest`, `Observation`, `Patient`,
`QuestionnaireResponse` holding real answers — are out of scope permanently, not pending a decision.

### 3. No DAK instance data in this repository

The schema lives here. A DAK's own graph is produced by that DAK's Implementation Guide build and
published with it. See [`STORAGE.md`](STORAGE.md).

There are no fixtures either. `smart-base/L1/schemas/test/negative.test.ts` builds the smallest documents that exercise
every rule, in memory, and CI checks those. A committed fixture large enough to be interesting is a
dataset wearing a fixture's name, and this repository was rebuilt once already for keeping something
nobody read.

---

## What L2 holds, in three graphs

L2 is the opposite problem to L1. L1 has no representation; L2 has several — and no joins between
them. But it is also not one layer, and modelling it as one was a mistake worth naming.

`DAK.fsh` declares a Digital Adaptation Kit as **nine components**, each of which points at a file
by URI and asserts nothing about that file's interior. That boundary is the natural seam:

| Graph | Holds | Vocabulary | Reads |
|---|---|---|---|
| `l2` | the nine DAK components and their cross-references | WHO's | `dak.json`, the FSH tree |
| `l2-bpmn` | one BPMN file's interior | OMG's | BPMN XML |
| `l2-dmn` | one DMN file's interior | OMG's | DMN XML |

They are separate because their failure modes are separate. A DAK component is wrong when it points
at a file that is not there; a BPMN subgraph is wrong when it misreads the file it did find. One
graph mixing both would need a reader to hold two vocabularies and two notions of correctness at
once, and would make "which components does this DAK have" unanswerable amid 60 task nodes.

The dependency runs one way and only where the artefacts do: `l2-dmn` imports `l2-bpmn` because
`dmn:usingTask` names the BPMN task that invokes a decision. Nothing points back.

Applying the rule and its corollary decides the contents:

| | Other representation? | Other query layer? | Verdict |
|---|---|---|---|
| The nine components and their links | Only as FSH fields and bare ids | No | **Graph** (`l2`) |
| BPMN flows, pools, gateways | No — only the XML | No | **Graph** (`l2-bpmn`) |
| DMN clauses and rules | No — only the XML | No | **Graph** (`l2-dmn`) |
| A FHIR canonical's contents | Yes — FHIR | Yes — validator, publisher | **Index by URL** |
| Decision-table cells | Yes — the table | The table | **Carry as properties** |
| A Gherkin feature file's interior | Yes — the file | No | **Not yet** — no instance exists |

### Every join says how confident it is

A DAK links its components four ways, by two different mechanisms. One is a canonical reference —
`actor = Canonical(SGAuthoring.Persona.BusinessAnalyst)` — and it resolves exactly: 46 of 46. The
other three are string matching across file formats, and they resolve when the strings agree.

So a match made by string equality is a **judgement**: `inferred`, never `derived`, carrying
`resolutionStatus` of `unresolved`, `resolved` or `ambiguous`. `ambiguous` is terminal — two
ActorDefinitions with one title is a question for a person, not a tie-break for a matcher.

An unresolved reference still gets a node, marked unresolved. A dangling edge would be dropped by
any store and the finding with it; a placeholder makes *"roles a process names that nothing
defines"* a query rather than a warning nobody kept.

### An edge with no instance is not licensed

Each ontology carries a `deliberatelyOmitted` list. The entries are not hypotheticals — they are
relationships that looked obviously right and had nothing behind them. A `writes` edge from a DMN
output clause to a data element is the natural mirror of `reads`, and no committed artefact exhibits
one. A `derivedFrom` edge from a data element to a recommendation is plausible and unrecorded
anywhere. Both are omitted, with the reason, so the next person does not re-derive the argument.

### A Care Plan column is not a care plan

The BCG table declares an output column labelled "Care Plan". That is a column definition inside a
decision table — a definition, like a `PlanDefinition`. Boundary 2 above is unaffected: nothing in
any L2 graph reaches an execution artefact, and `dmn-output-clause` has no edge that could.

---

## What L1 is for

Three questions, in priority order. Generation is not among them.

1. **Impact analysis.** A recommendation changes — which artefacts are affected? Today this is
   answered by reading PDFs and grepping.
2. **Coverage.** Which recommendations have no DAK representation at all? Currently unanswerable.
3. **Citation resolution.** WHO's own tooling already provides an L1 reference column per
   decision-table rule. In `DAK.DT.IMMZ.D2.DT.BCG.dmn` the output column's description reads
   *"Reference for the source content (L1)"*, and one of its 25 rules carries *"WHO recommendations
   for routine immunization – summary tables (March 2023) (1)"*. No tool can follow that string —
   and no tool reports the 24 rules that have none. Making the first followable and the second
   countable is the cheapest large win available.

   Note which of these is which: turning a citation into a link is *citation resolution*; finding
   the rules with no citation is *coverage*, question 2 above, measured over the same data.

### What L1 is explicitly not for

**Deriving L2 from L1.** The step from a recommendation to a business process with lanes, tasks and
a data dictionary is *adaptation* — the "A" in Digital Adaptation Kit. It requires contextual
judgement about who acts, in what order, with what data, under which local constraints. A
recommendation that derived predictably into a workflow would not need adapting.

The graph makes that step **traceable and reviewable**. It does not make it automatic, and no
document here should imply otherwise.

---

## Provenance is stricter here than anywhere else in the estate

Everywhere else the source is structured. Here it is a PDF.

Extraction from prose is **`inferred` at minimum, never `derived`**. Every recommendation node
carries:

- `statement` — a **verbatim** quote. A paraphrased recommendation is a different recommendation.
- `evidence.location` — the publication and page.
- the guideline PDF's SHA-256, in the document's `wasDerivedFrom`.

`smart-base/L1/schemas/generated/recommendation-graph.schema.json` rejects an `inferred` or `decided` node without a `note`
and `evidence`, and `smart-base/L1/schemas/validate.ts` rejects a `citation` that claims `resolved` without a
`resolvesTo` edge. `ambiguous` is a legitimate terminal state for a citation and must never be
collapsed to `resolved` — two publications with similar titles is a question for a person, not a
tie-break for a matcher.

### Vocabularies are closed, and inline for now

GRADE strength, certainty and direction, the handbook's guideline types, recommendation status and
citation resolution are **value sets** in `l1.json`, each code with a definition and a source.
`smart-base/L1/schemas/validate.ts` rejects any other value — `"Strong"` is not `strong`, and a coverage query
filtering on one silently misses the other. It also enforces GRADE's own rules: a strength always
has a direction (a direction alone is fine — ANC 2016 prints "Recommended" with no strength), and a
good practice statement or a decision to make no recommendation carries no grade.

The GRADE lists are copied here rather than referenced. folio-assistant publishes the same
vocabularies as SKOS code lists; pointing at those, pinned by hash, is deliberately deferred so
this repository takes on no external dependency yet.

### L1 points nowhere

Since 3.0, L1 holds what WHO says and where it is printed, and nothing in it points out of it. A
DAK's files (`external-artifact`) and the edges into them (`appearsIn`, `implementedBy`) are L2's,
and point down at L1. Keeping a second copy of those edges in L1 gave the question "which artefacts
implement this recommendation?" two paths, and each extractor would have picked one.

### Identity is built from what WHO prints

An L1 IRI is minted by `smart-base/L1/schemas/kgid.ts` from the publication's ISBN (or IRIS handle, DOI, ISSN) and
the published number — `…/publication/isbn-9789241549912/recommendation/A.1.1` — under one WHO-wide
namespace. The same guideline extracted twice yields the same nodes, and the ANC recommendations
cited by several DAKs are one set of nodes, not one per DAK. A new edition has a new ISBN, so it is a
new publication linked by `supersedes`; renumbering between editions cannot collide. The validator
rejects an L1 node whose IRI does not have its class's shape.
