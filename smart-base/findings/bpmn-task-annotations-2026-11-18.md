---
title: "DAK BPMN task annotations: where they are, and how to make them computable"
description: "Findings for the owner (2026-11-18): the per-task 'notes and annotations' of WHO DAK business processes are ingested only as flattened prose; nothing links them to BPMN tasks, though the KG already declares the join. Counts for IMMZ, TB and CHUD, and four options with costs."
status: draft
---

# DAK BPMN task annotations: where they are, and how to make them computable

> Asked by the owner on 2026-11-18: *"All of the DAK documents have annotations
> for the BPMNs that describe the tasks. Are all of those ingested and attached
> to the BPMN's tasks appropriately/computably?"*
>
> **Short answer: no.** The annotations are ingested as text in who-iris, for
> the three DAKs it holds (ANC, FP, IMMZ). None of them is a structured record,
> none is linked to a BPMN task, and nothing checks them. The knowledge graph
> already declares the link (`dak-task describes bpmn-task`), but nothing
> produces it.

## What a task annotation is

Every DAK business process has a workflow figure followed by a block headed
`<letter>. <PROCESS> BUSINESS PROCESS NOTES AND ANNOTATIONS`. The block is a
numbered list, one item per step of the figure. Each item has the step's name
and `»` bullets that describe it. The bullets carry the step's persona, the data
it captures, the decision tables it uses (for example
`FP.DT.01 "Reason for visit"`) and implementation notes. For example, in the
IMMZ DAK (WHO 2024, ISBN 9789240099456, p. 37), item 1 of process B is *Review
past vaccination records to estimate vaccines needed* (step `IMMZ.B1`).

In these DAKs (2021–2024) this numbered list *is* the task table. There is no
separate per-task table. The step number is the join key: figure box "1." is
annotation item 1, which is activity `IMMZ.B1` in the DAK spreadsheets.

## 1. Where the annotations are now

| Place | Annotation present? | Evidence |
|---|---|---|
| **L1 text in who-iris** | **Yes, as flattened prose** for ANC (`10665-339745`), FP (`10665-341997`) and IMMZ (`9789240099456-eng`). The items survive, but page footers, running heads and side-tab labels are mixed in. | e.g. `who-iris/library/9789240099456-eng/sections/sec-004-how-to-use-this-digital-adaptation-kit.md:1522` (IMMZ B), `:1977` (IMMZ D); FP `sec-010…md:571` |
| L1 structured tables in who-iris | No. ANC and FP have CSV tables for the process overview (Table 5), data elements by activity (Table 7), decision tables (FP Table 10) and requirements (Table 15), but not for the annotations. IMMZ has no tables at all. | `who-iris/library/10665-341997/tables/`, `tabular.csvw.json` |
| L1 KG (JSON-LD) | Only as one `prose-sec-NNN` block per section. There are no per-item nodes. | `who-iris/library/9789240099456-eng/blocks/prose-sec-004.jsonld` |
| Other DAKs | HIV is catalogued but not extracted. TB, PNC, CHUD, SRV, SMBP and STI are not in who-iris at all. | `who-iris/uploads/9789240085138-eng/intake.json` |
| **BPMN XML in the DAK repositories** | **No.** In WHO's `smart-dak-immz`, `smart-dak-tb` and `smart-dak-chud`, 0 of 283 tasks have `bpmn:documentation` and none has a `textAnnotation`. The only exception is 2 of 32 tasks in a duplicate IMMZ.D draft. | table below |
| BPMN `extensionElements` | Only `zeebe:calledDecision decisionId="IMMZ.D2.DT.BCG"`, on IMMZ.D business-rule tasks (76 of 87 tasks). That is the only machine-readable task link in any DAK BPMN. | `smart-dak-immz/input/business-processes/IMMZ.D.Administer Vaccine.bpmn` |
| DAK spreadsheets (L2 web annexes) | **Partly, indirectly.** The data dictionary, the functional requirements and the decision-support logic each key their rows by an *"Activity ID and name"* string such as `IMMZ.A1.Obtain vaccination location info` or `TB.A5. Search for the client record`. This carries the data-element, requirement and decision-table links, but not the description. | `smart-dak-immz/input/{dictionary,system-requirements,decision-logic}/*.xlsx` |
| DAK logical model (FSH) | The field exists but is empty. `BusinessProcessWorkflow.task 0..*` has `identifier`, `name` and `description` and nothing else. No DAK fills it. | `input/fsh/models/BusinessProcessWorkflow.fsh:12-15` |

## 2. Is anything extracted and linked? No.

- **L1 ingestion.** No who-iris or folio-assistant-core script recognises an
  annotations block. `folio-assistant-core/scripts/tabular-dak.ts` reads
  decision-table workbooks only. The `smartbase-dak-l1-library` skill states
  that the L1 library does not extract lists or flowcharts.
- **L2 KG.**
  - `smart-base/L2/schemas/l2.ts:325-333` declares the class `dak-task` and the
    predicate `listsTask`.
  - `smart-base/L2-bpmn/schemas/l2-bpmn.ts:265-267` declares
    `dak-task describes bpmn-task`. Its own note at `:62` says *"today nothing
    does"*.
  - No extractor emits any of the three.
- **BPMN extractor.** `smart-base/L2-bpmn/schemas/extract-bpmn.ts:196` matches
  only `<bpmn:task>`. It misses `userTask`, `businessRuleTask` and the other
  subtypes, which are 69 of the 87 tasks in IMMZ.D. It also does not read lanes,
  `documentation`, `extensionElements` or `textAnnotation`.
- **DMN to task.** `smart-base/L2-dmn/schemas/extract-dmn.ts:126-159` links
  `usingTask/@href` to the task by `@name`, not by `@id`. Its documented
  resolution is 0 of 1 (`smart-base/L1/schemas/docs/OVERVIEW.md:165`).
- **QA.** No gate checks that a DAK task has a description, that
  `task.identifier` equals a BPMN `@id`, or that a task's requirements and
  decision tables resolve.
  - `pipeline/qa-checkers-dak.ts:239-255` checks only that the BPMN parses and
    declares a process.
  - cat-harness-tools' `activity-documented` criterion covers harness processes,
    not DAK BPMN, and is not gated.

### End-to-end sample: three DAKs

**Can a BPMN task be joined to the DAK's activity code?** And if so, does any
spreadsheet row reference that code? WHO repositories, shallow clones,
2026-11-18. Duplicate drafts are excluded.

| DAK | BPMN tasks | Key on the task | Tasks that yield an activity code | Linked to ≥1 spreadsheet row | Data dictionary / requirements / decision logic |
|---|---|---|---|---|---|
| IMMZ (`smart-dak-immz`) | 137 | `@id` is the activity code (`IMMZ.D2`) | 125 | **111** | 82 / 106 / 48 |
| TB (`smart-dak-tb`) | 107 | `@id` is a Modeler default (`Activity_0abc…`). The code has to be rebuilt from the label's step number plus the file's letter (`a-registration.bpmn` + "5." gives `TB.A5`) | 95 | **64** | 49 / 33 / 16 |
| CHUD (`smart-dak-chud`) | 39 | same as TB | 35 | **0**: the CHUD data dictionary's Activity ID column is empty | 0 / 0 / 0 |

**Do the IMMZ annotation items match BPMN tasks?** In who-iris, IMMZ processes
A–F, after dropping page numbers that the naive parse took for item numbers:

| Process | Annotation items | BPMN nodes with a coded id | Matched by number |
|---|---|---|---|
| A | 9 | 12 | 9 |
| B | 7 | 7 | 7 |
| C | 6 (+ sub-steps) | 14 | 6 |
| D | 9 parsed of 21 expected | 21 | 9 |
| E | 6–8 | 6 | 6 |
| F | 9 | 10 | 9 |

G, H and I have annotations but no BPMN in `smart-dak-immz`. litlfred's
`smart-immunizations` has them, with ids in the form `IMMZ.G.1`, so the dot
convention differs between the two repositories.

**Not attached anywhere: 0 tasks out of 283 carry their annotation.** The join
key is recoverable for about 90% of them. The naive parse also shows the
traps: page footers look like item numbers, two-column pages split items, and
sub-steps (`C2.1`–`C2.5`) are drawn but not annotated one by one.

## 3. Which schema should define the link

The link has a declared home in three places, and all three are still empty:

1. **DAK logical model.** `BusinessProcessWorkflow.task`
   (`input/fsh/models/BusinessProcessWorkflow.fsh:12-15`), mirrored in
   `smart-base/schemas/dak-blocks.ts:197-212` (`BusinessProcessTask`) and its
   Zod schema at `:396-399`. It has `identifier`, `name` and `description`. It
   needs these fields:
   - `bpmnTask` (the BPMN `@id`; today this is only implied by "Task ID")
   - `persona 0..*` (Canonical to the persona, the mechanism that already
     resolves 46/46 for requirements)
   - `dataElement 0..*`
   - `requirement 0..*`
   - `decisionTable 0..*`
   - `source` (page and citation in the L1 document)
2. **KG.**
   - `dak-task` (`l2.ts`) and `describes` (`l2-bpmn.ts`) exist. The JSON-LD
     context already maps `TaskEntry` to `sgkg:dak-task`, `BPMNTask` to
     `sgkg:bpmn-task`, and the predicates `listsTask` and `describes`
     (`L2-bpmn/schemas/generated/l2-bpmn.context.jsonld`).
   - Missing terms: task to persona, task to data element, task to requirement,
     and task to decision table. Only the DMN-side `invokedBy` exists.
3. **BPMN extension namespace.** There is no smart-base namespace. The nearest
   precedent is `cat-harness.processes:narrative`
   (`cat-harness/processes/ns.jsonld:121-124`), a pointer from a task to the
   heading that holds its narrative.

## 4. Options

| | Option | What it gives | Cost | Weakness |
|---|---|---|---|---|
| **A** | Write annotations into BPMN: `bpmn:documentation`, plus `extensionElements` in a new smart-base namespace | The description travels with the diagram, and Modeler shows it | **High**: 3–4 days, plus a pull request to every WHO DAK repository. Needs a new namespace and edits to files that WHO owns and Modeler rewrites. | It does not produce the data; something still has to extract it. Copies the prose into a second place. |
| **B** | A sidecar JSON per BPMN, keyed by task id, with a JSON schema | Reviewable, diffable, and validated by a schema | **Medium**: about 2 days for the schema and gate | It does not produce the data either. It is a fourth format next to FSH, the dak block and the KG. |
| **C** | KG-only nodes: emit `dak-task` with `describes` to the task IRI | The classes are already declared; cheapest to wire | **Low**: about 1 day | There is nothing to emit until the annotations are extracted, and authors cannot review the result. |
| **D** | Extend L1 ingestion to extract each annotations block, match its items to tasks, and adjudicate the unmatched | The only option that produces the data | **Highest**: about 4–6 days | Matching is heuristic: page noise, letter-from-filename keys, and sub-steps |

### Recommendation: D, written into the schema that already exists, emitted as C, and gated

1. **Extract.** Write a DAK annotations extractor over the who-iris section
   text. It removes page headers, footers and tab labels and splits each block
   into numbered items with their bullets. It outputs one
   `BusinessProcessWorkflow.task` record per item, with its source page.
2. **Match.** Each record is keyed by activity code
   (`<DAK>.<process letter><step>`), which is matched to the BPMN task in this
   order: by `@id`, then by the label's step number plus the file's letter,
   then by name. Unmatched or ambiguous items go to an adjudication list for a
   person, using cat-harness's `cat-adjudication`, rather than being guessed.
3. **Enrich.** Join the spreadsheets' "Activity ID" columns to each record to
   fill `dataElement`, `requirement` and `decisionTable`. Fill `persona` from
   the task's lane.
4. **Emit.** Emit `dak-task`, `listsTask` and `describes`, plus the new task
   predicates. Fix `extract-bpmn.ts` to read all task subtypes and lanes; that
   fix is needed under any option.
5. **Gate.** Add `dak-task-annotated` (every BPMN task has a `dak-task`) and
   `dak-task-links-resolve` (persona, requirement, decision table and data
   element ids exist). Warn first, then gate once the three sampled DAKs pass.

Option A can follow later as a derived projection: render `bpmn:documentation`
from the records for Modeler users. It is never the source.
