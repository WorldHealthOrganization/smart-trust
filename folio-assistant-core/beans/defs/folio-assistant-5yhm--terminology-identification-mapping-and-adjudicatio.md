---
# folio-assistant-5yhm
$schema: bean/1.0.0
title: 'TERMINOLOGY: identification, mapping and adjudication — a glossary term is CHECKED against an existing terminology, never only minted'
status: completed
type: feature
priority: normal
created_at: 2026-09-25T04:51:06Z
updated_at: 2026-10-24T08:35:00Z
parent: folio-assistant-0lmb
---

Owner, 2026-09-25: *"extracting exsiting glossary needs compaision to existing
termonology/coding. there needs to be a whole set of skills on terminiology
indetificatio. mapping. ajdudication. bean up as todo. we will integrate, for
example, OCL at some point as a Tool"*.

## RE-SCOPED 2026-09-29 against what has since landed on `main`

This bean was written when the glossary only extracted. Three skills landed
while it sat uncommitted, and **two of its three original legs are now
answered**, so what remains is narrower and sharper than the title suggests:

| the ask | where it now lives | still open? |
|---|---|---|
| **identification** — what IS a term | `glossary-extract.ts` + [`glossary-terms`](../../skills/library/cataloguing/glossary-terms.md) §"Extracted terms": per asset type, one `kg-` scheme each, `candidate` status, and a stated exclusion (BPMN lanes and roles go to the swimlane ledger) | **no** — `a13a` is scrapped |
| **which vocabulary owns a fact** | [`vocabulary-authority`](../../../cat-harness/skills/kg/kg-core/vocabulary-authority.md): SKOS authoritative for meaning, DC for resources, FHIR for clinical codes, DCAT for a release, with `exactMatch`/`closeMatch`/`broadMatch`/`relatedMatch` as the declared mapping | **no** |
| **mapping** — is this candidate ALREADY a concept somewhere authoritative? | nothing | **yes** — `7wou` |
| **adjudication** — the extractor and the terminology disagree | nothing | **yes** — `2i5f` |
| **a terminology service as a Tool** | nothing; `OCL` appears nowhere in the codebase | **yes** — `ejug` |

## The gap, stated precisely

The **model** for an external mapping exists — `vocabulary-authority` names
SKOS the hub and the four mapping predicates, and `glossary-terms` already
lets an authored term carry links to external SKOS concepts. **The CHECK does
not.** Nothing anywhere queries an authoritative terminology to ask whether a
candidate the extractor minted already has a concept, and nothing records the
answer. Every extracted term is asserted by the extraction and compared
against nothing, which is the owner's sentence exactly.

That is one stage, not a pipeline, and it is the whole of what this feature
now covers.

## The design observation that survives from the papers

`library/arxiv-2605.03537v1`'s **authority validation is its own skill with a
machine index** — TF-IDF over ~1.01 M authorised LCSH headings plus a live API
for name authorities — not an instruction inside the drafting prompt. Nothing
else in that paper is citable (n = 10 titles, the author comparing his own
system, a baseline decades old under superseded policy, and the paper's own
words: *"interpretive rather than strictly quantitative"*).

`library/arxiv-2606.04382v1` (LCSHBench) supplies the shape of the answer: score
under **two** match definitions, exact and concept, and read the GAP — a high
concept score with a low exact score is the right topic in the wrong
authorised form, a different and specifiable error from a topical miss. Its
two lead systems swap places depending on which mode is used (0.659 vs 0.623
exact; 0.732 vs 0.762 concept) and on the record's language. A mapping stage
returning one boolean cannot express any of that.

## Done when

- [x] `7wou` — the check exists, with three states and an exact/concept pair
      (#1633; the committed record kept only `concept` until #1837, which
      projects `exact` too. `7wou` itself stays open on one item: FHIR
      collections in scope once OCL is reachable)
- [ ] `2i5f` — disagreement has a named outcome set and CALLS `adjudication`
      (outcome set: done, leg 1, #1846; CALLS `adjudication`: leg 2, waiting)
- [x] `ejug` — one terminology service as a Tool node, OCL confirmed first
      (closed 2026-09-30: the Tool is the pin refresher, by owner choice)
- [x] the glossary page reports mapped / unmapped / undetermined per term,
      and grades none of them (#1837: a stated default per target and a mark
      on every term that differs from it, because a mark on every row does not
      fit the 1 MiB page budget)

Claimed by claude/terminology-adjudication (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH) — issue #1836, slice: per-term mapping state on the glossary page.

## Measured 2026-10-02 against `main` at `cf3e62487`, and the slice shipped

`check:term-mapping` reports 2861 candidates, **0 mapped** on both `skos` and
`fhir`, so `2i5f` leg 2's entry condition (non-zero mapped) is still unmet,
and the owner's 2026-09-30 "wait" on `2i5f` stands.

Shipped on #1837 (issue #1836):

- `SchemeState.mappedTerms` now records, for each mapped term, `exact`
  (true/false) and the concept URIs it matched. Before this the projection
  counted `concept` only, so the gap LCSHBench calls the finding never reached
  the committed file.
- `undeterminedTerms` is written only for a row that mixes `unmapped` and
  `undetermined`, where the counts cannot say which term is which.
- `termState()` in `check-term-mapping.ts` is the one function that turns the
  record back into a per-term answer. It answers `unknown` (never `unmapped`)
  when the record cannot say.
- Each glossary type page states a default per target ("every term on this
  page is unmapped on fhir, and unmapped on skos, unless its entry says
  otherwise") and marks each term that differs, exact and concept-only
  worded differently. Today no entry differs, so the visible change is that
  one sentence per page.

## Remaining slices (not code yet)

- [x] `2i5f` leg 1: the extractor and the terminology disagree. Three
      outcomes (change the prose, author a local term with its reason, record
      that the vocabulary is wrong for this domain). Built on #1846 after the
      owner's 2026-10-02 ruling ("split").
- [ ] `2i5f` leg 2: two judges disagree about a mapping. CALLS `adjudication`
      and `untainted-verification`. Blocked on its entry condition: non-zero
      `mapped` on either target.
- [x] publish mapped terms into the scheme's SKOS JSON-LD as
      `skos:closeMatch` (or `exactMatch` where `exact`), in the
      `linked-data` voice. Owner, 2026-10-02: both, each marked automated.
      Built on #1846: a PROV-marked named graph.
- [ ] key the per-scheme record by instance as well as scheme id. A scheme
      id such as `kg-tools` is shared by every instance's extraction, and
      term ids are unique across them only by observation (0 collisions in
      2876). The page answers `unknown` on a collision; the record should
      not depend on it.
- [ ] `7wou`'s last item: FHIR collections in scope once OCL is reachable.



Claimed by claude/terminology-followups (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH), stacked on #1837 — issue #1836. Slices: `2i5f` leg 1, and publishing automated matches into each scheme's SKOS JSON-LD (owner rulings 2026-10-02).

## Shipped 2026-10-02 on #1846 (stacked on #1837), owner rulings of that date

- [x] `2i5f` leg 1 — skill `term-disagreement` + schema
      `folio-term-adjudications/v1`, validated by `check:term-mapping`. Leg 2
      still waits on non-zero mapped.
- [x] publish mapped terms into each scheme's SKOS JSON-LD: `skos:exactMatch`
      where exact, `skos:closeMatch` where concept-only, **in a named graph**
      `<scheme>/_automated-matches` whose PROV-JSONLD says a program made it
      (qualified `Generation` → `Activity` → `Association` → `ci-pipeline`,
      typed `prov:SoftwareAgent`). The default graph keeps only what people
      wrote. `exactMatch` targets only the record's new `exactConcepts`; an
      in-repo `<scheme>:<id>` that names two authored terms is left out and
      reported. Today 0 terms map, so no committed SKOS file changes.

## 2026-10-24 — re-measured
`bun run cat check:term-mapping` at the folio-assistant lock: 3751 candidates, **0 mapped** on both `skos` and `fhir`, 0 adjudication files. So `2i5f` leg 2's entry condition is still unmet. The open slices are unchanged: key the record by instance as well as scheme id (buildable now), and 7wou's FHIR collections (needs OCL). Session https://claude.ai/code/session_01TkFVzHu3LN6P5Nj2psquPU.

## OWNER, 2026-10-24: close for what is built (structured question Q7, 08:29Z: "A + B")

Identification, vocabulary authority, mapping (`7wou`), leg 1 of adjudication and publishing automated matches into SKOS are built. The open slices move out:
- `2i5f` leg 2 goes to `nvhg` (waits on non-zero `mapped`).
- `7wou`'s last item, FHIR collections in scope once OCL is reachable, goes to `q7ds`. The connected agent runs the FHIR target against OCL with ordinary internet, because cloud sessions are refused `api.openconceptlab.org`.
- Keying the per-scheme record by instance as well as scheme id goes to `wvzp`. It isn't blocked.

Session https://claude.ai/code/session_01FABZmtqnNeBaTcHsXrtyK7.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
| **identification** — what IS a term | `glossary-extract.ts` + `glossary-terms` (now `folio-assistant-core/skills/library/cataloguing/glossary-terms.md`) §"Extracted terms": per asset type, one `kg-` scheme each, `candidate` status, and a stated exclusion (BPMN lanes and roles go to the swimlane ledger) | **no** — `a13a` is scrapped |
| **which vocabulary owns a fact** | [`vocabulary-authority`](../../cat-harness/skills/kg/kg-core/vocabulary-authority.md): SKOS authoritative for meaning, DC for resources, FHIR for clinical codes, DCAT for a release, with `exactMatch`/`closeMatch`/`broadMatch`/`relatedMatch` as the declared mapping | **no** |
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
| **identification** — what IS a term | `glossary-extract.ts` + `glossary-terms` (now `folio-assistant-core/skills/library/cataloguing/glossary-terms.md`) §"Extracted terms": per asset type, one `kg-` scheme each, `candidate` status, and a stated exclusion (BPMN lanes and roles go to the swimlane ledger) | **no** — `a13a` is scrapped |
| **which vocabulary owns a fact** | [`vocabulary-authority`](../../cat-harness/skills/kg/kg-core/vocabulary-authority.md): SKOS authoritative for meaning, DC for resources, FHIR for clinical codes, DCAT for a release, with `exactMatch`/`closeMatch`/`broadMatch`/`relatedMatch` as the declared mapping | **no** |
```
