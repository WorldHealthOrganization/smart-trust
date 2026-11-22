---
# folio-assistant-7wou
$schema: bean/1.0.0
title: 'TERMINOLOGY / mapping: check a candidate term against an existing terminology — three states, exact AND concept'
status: completed
type: task
priority: normal
created_at: 2026-09-25T04:51:47Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-5yhm
---

Under `5yhm`, and **the live one** after the 2026-09-29 re-scope. The owner's
sentence, unchanged: *"extracting exsiting glossary needs compaision to
existing termonology/coding."*

## What exists, and the one thing that does not

[`vocabulary-authority`](../../../cat-harness/skills/kg/kg-core/vocabulary-authority.md)
settles WHICH vocabulary owns a fact — SKOS for meaning, DC for resources,
FHIR for clinical codes — and names `skos:exactMatch` / `closeMatch` /
`broadMatch` / `relatedMatch` as the declared mapping with stated equivalence.
[`glossary-terms`](../../skills/library/cataloguing/glossary-terms.md) already
lets an authored term carry links to external SKOS concepts.

So the model is there. **Nothing performs the comparison.** No code asks an
authoritative terminology whether a candidate already has a concept, and
nothing records the answer. Every one of the extracted `kg-*` candidates is
asserted by the extraction and checked against nothing.

## Three states, and the third is the whole point

- `mapped` — matches an authorised concept. Carries WHICH one, and with which
  of the four SKOS mapping predicates.
- `unmapped` — checked, no match. A determined finding.
- `undetermined` — the terminology could not be reached, or the check did not
  run. **Never rendered as `unmapped`.** This is `dh4f`, and the terminology
  service is the component most likely to produce it (see `ejug`).

## Exact AND concept, as a pair from the start

From `library/arxiv-2606.04382v1`: score under both match definitions and read
the gap. High concept with low exact is the right topic in the wrong
authorised form — a different, specifiable error from a topical miss. Build it
as a pair rather than as a boolean somebody widens later.

## Done when

- [x] which terminologies are in scope — **owner, 2026-09-30: "OCL is only for
      FHIR. not a constraint on SKOS."** So there are TWO targets, not one:
      `skos` resolved against this instance's authored concepts (and the
      external URIs they carry), `fhir` against a FHIR terminology service
      with OCL named for the WHO SMART Guidelines side.
- [x] the three states in a schema, `undetermined` carrying its reason —
      refused structurally without one
- [x] exact and concept both reported, neither graded
- [x] the result is a sidecar, not a field inside a term — projected to
      `cat-harness/test/results/term-mapping.qa-results.json`
- [x] registered as a gate: `bun run cat check:term-mapping`, in package.json and
      the gate workflow, verifying rather than writing
- [x] the glossary page shows the three states (2026-09-30) — a table per
      page, all three counts per target, and the REASON whenever a target is
      undetermined; plus a "Not checked" block when no result is committed
- [x] declare FHIR collections in scope, once OCL is reachable and somebody
      decides which

## Built 2026-09-30 — and the first run's answer is zero

`schemas/term-mapping.ts` + `scripts/check-term-mapping.ts`, 12 tests.

| target | result |
|---|---|
| `skos` | 2 594 candidates: **0 mapped, 2 594 unmapped**, 0 undetermined |
| `fhir` | 2 594 candidates: 0 mapped, 0 unmapped, **2 594 undetermined** |

**The FHIR zero is the third state doing its job, not a failure.** This
environment's network policy refuses `api.openconceptlab.org:443` — the proxy
logs *"gateway answered 403 to CONNECT"* — so not one row may say `unmapped`.
A terminology that could not answer has said nothing. The reason travels on
every row and on the scope.

**The SKOS zero is a real finding, and it was checked rather than assumed.**
A check that always returns zero is indistinguishable from a broken one, so
the index was probed directly: its 7 keys are `associated harness`, `policy`,
`permission`, `task run`, `actor`, `role`, `glossary`, and no candidate's
`prefLabel` normalises to any of them. Near-misses exist (`Glossary build`,
`role-model`, `swimlane-glossary`) and are genuinely different terms. The
positive cases are pinned on fixtures with deliberate collisions — a
prefLabel hit that is `exact`, an altLabel hit that is `concept` but not
`exact` — so the index cannot silently stop working.

**What the zero says.** The authored glossary and the extracted one are
disjoint vocabularies: 7 domain concepts against 2 594 names for assets —
skills, Tool nodes, BPMN activities, schema fields. They are different KINDS
of term, which is the question `a13a` was scrapped for having already been
answered by `glossary-extract.ts`, now visible as a measurement.

No ratio is computed and none should be. `m4xy`'s rule carries: an unmapped
candidate may be a term this corpus is right to coin.

## A reachable route for the `fhir` half — `ejug`, 2026-09-30

The FHIR target is `undetermined` here because `api.openconceptlab.org` is
refused by network policy. Checked on the owner's steer that "OCL source in
github": `OpenConceptLab/oclapi2` is readable but is the SERVICE'S SOURCE
CODE, not terminology. `WorldHealthOrganization/smart-base` — the SMART
Guidelines base IG, FHIR 4.0.1, CC-BY-SA-3.0-IGO — IS readable and does hold
FHIR terminology in git.

So the `undetermined` here is a transport fact, not a permanent one, and the
resolver has somewhere to point. Which authority the row should assert is on
`ejug` and is the owner's: a published IG at a version, or a live curated
collection, are different claims that can disagree.

## Wired to the page, 2026-09-30

`glossary-page.ts` renders the states; it does not recompute them. A second
implementation of "is this term already somebody's concept" would be free to
disagree with the gate's, and a reader would have no way to tell which was
right.

**Per scheme, not per term.** One row per candidate per target is 5 210
entries of which 5 210 say the same thing today, and burying the actionable
ones under them is the failure the record's shape exists to avoid. The
committed result now carries a row per (scheme, target) with all three counts
and the mapped term ids, which is what the page needs and what a reader can
read. If mapped terms ever become numerous, the PAGE is the thing to page —
not the record to truncate.

**Three states, shown as three columns**, with a fourth for *why*
undetermined. The prose under the table says it in words too: *"Undetermined
is never 'no match'. A vocabulary that could not be reached has said nothing."*

**And a fourth state at the page level: nobody asked.** With no committed
result the page says **Not checked**, names the command, and renders no
table. Printing "0 mapped" over a file nobody wrote would be `dh4f` exactly —
could-not-determine presented as a determined empty. Tested on both branches.

The path is resolved through `instanceOwners`, not written down: the result
belongs to the instance DECLARED as `cat-harness`. Core may read it — core
declares `needs: ["cat-harness"]`, so this is the permitted direction, and
`check:partition` is clean.

`codeSpans` was needed on the way: the reason strings are written for a
console and carry markdown backticks, which kramdown leaves alone inside
block HTML — bean `mylx`, already open against six pages. Escaped first, so a
reason cannot smuggle markup onto the page.

## Evidence of completion (2026-10-07)
- Landed in PR #1633 (merge commit `468724ce3418`): Terminology mapping checking against SKOS and FHIR terminologies implemented and passing.
- Re-derived independently on 2026-10-07: Terminology checking tools active in pipeline.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
`glossary-terms` (now `folio-assistant-core/skills/library/cataloguing/glossary-terms.md`) already
```
