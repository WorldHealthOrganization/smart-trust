---
name: dth-authoring
description: >
  How a WHO Digital Transformation Handbook (DTH) is produced, from sources to
  publication, in the seven stages and milestones of dth-authoring.bpmn — and
  the rules the diagram cannot carry: which review sheet each stage uses, the
  DAK kinds every DTH is written in, and how a term is deprecated. Read before
  starting a new DTH, before moving one to its next stage, and before setting
  up its feedback or public-comment sheet.
---

# dth-authoring

> Skill id: `dth-authoring` · Package: `authoring-who-smart-guidelines` ·
> Process: `dth-authoring.bpmn` (opt-in `smart-base.L2-collab`)
> (generated walk: `dth-authoring.checklist.md` (opt-in `smart-base.L2-collab`)).
> Pilot: `litlfred/dth-hrh`.

**The diagram is the authority for the steps.** This file holds only the rules
that apply across them.

## The stages, in one line each

| stage | ends at | what it is |
|---|---|---|
| 0 · Initiate | M0 · Charter recorded | scope, DIIG phase, TWG, roles and RACI, repository from the dth-hrh layout, work plan seeded |
| 1 · Ingest sources | M1 · Library frozen | every source into `library/` (WHO publications through who-iris), L1 coverage |
| 2 · Outline | M2 · Outline agreed | chapters against the `dth` kind, introduction, glossary candidates, list of processes, roles, decisions and indicators to model |
| 3 · Structured drafting | M3 · Zero draft | content written as DAK-kind blocks, linked to smart-ra ArchiMate and SKOS |
| 4 · Contributor feedback | M4 · Working-group draft | editors and contributors comment; change sets; issues |
| 5 · Public comment | M5, M6 | public draft released, comments dispositioned through change sets |
| 6 · QA and publish | M7 · Final published | editorial, voice and translation QA, then publication |

A milestone is recorded in the work plan when it is reached. It never blocks
work in a later stage that is ready early.

## Which review sheet, by stage

The sheet follows the stage the document is in.

| stage | sheet | template | mode in `review-sheet-script` |
|---|---|---|---|
| 0-3 drafting and authoring, 4 contributor feedback | **Contributor sheet**: one Contributor Feedback tab, each row a change set with its own issue; one `Contributor Feedback (<initials>)` column per person; no TWGs, no public-comment tabs | Folio Assistant - Contributor Template | `drafting` |
| 5 public comment | **Public Comment sheet**: comment source, review of public comments, change sets with TWG and architect feedback | Folio Assistant - Public Comment Review Template | `public-comment` |

How the sheets work, the template links, the generic Code.gs and its Config
tab, and setup are in folio-assistant-core's `review-sheet-script` skill; the
Agent-tab rule is `review-sheet-agent-columns`. Do not set up the Public
Comment sheet before stage 5.

## Every DTH is written in the DAK kinds

Content that has a DAK kind goes in that kind's block, never only in prose or
a Markdown table:

| content | DAK kind |
|---|---|
| user personas, roles, governance bodies as actors | persona, actor-definition |
| user scenarios, walkthroughs | user scenario |
| business processes | business-process (`.bpmn`, by `bpmn-authoring`) |
| decision tables | decision-logic (`.dmn`, by `dmn-authoring`) |
| data elements | core data element |
| functional and non-functional requirements | requirement |
| indicators | program indicator |

The fields of each kind are WHO's DAK logical-model fields, and the `dth`
document kind admits these blocks. Planning kinds that are not DAK kinds
(planning step, RACI, risk register, barrier-to-solution map, stakeholder
analysis, form inventory) have no schema until the architect group and the
handbook owners have reviewed them.

## Terms

- Terms come from the source's own glossary first. See folio-assistant-core's
  `glossary-terms` skill ("Source glossary first").
- **Deprecating a term is a change set, decided later by an editor.** The
  agent records the old term, the new term, the reason and every place the old
  term appears (e.g. "CDE-HRH" replacing "MDS-HRH"), and changes nothing in the
  text. The text changes only after an editor-started agent review decides the
  change set. Quoted source text always stays as published.

## A new DTH from an existing WHO publication

When the DTH already exists as an L1 publication, stages 0-2 are done by
[`dth-l1-to-l2-ingest`](dth-l1-to-l2-ingest.md), which writes the handbook's
workplan first.
