---
# folio-assistant-7po1
$schema: bean/1.0.0
title: 'WORKFLOWS: bootstrap keeps the bare minimum, cat-harness/workflows elaborates, and workflows/state owns beans+todos'
status: completed
type: task
priority: normal
created_at: 2026-09-20T13:18:23Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-yj32
---


Owner, 2026-09-20, verbatim — three separate instructions in one message:

> workflows/ is declared under the id cat-harness-workflows, content should be
> at graph cat-harness/workflows except the bare minimum declarations (what is
> bpmn, how use) under bootstrap/,
> cat-harness/workflows is for more elboration on use of bpmn and such
> cat-harness/workflows/state should describe beans and todos skills and declare
> todos/ beans/ do create on its initalization process. state manament skills
> and tools go here

## What is true today, measured

- `bootstrap/harness.json` declares `workflows/` under the id
  **`cat-harness-workflows`** (renamed from `workflows`; the rename is why
  `harness:dirs:check` now reports `20 declared, 0 missing` rather than the
  `21 / 1 missing` still written into `cat-harness/harness.json`).
- It holds `initialize-harness.bpmn` and `log-message.bpmn` — its own
  description calls these "the bootstrap PROCESSES".
- `cat-harness` declares no `workflows/` entry of its own. The platform's
  diagrams live at `cat-harness/processes/`, which is inside the `kg`
  graph rather than a graph of its own.

## The three asks

1. **Split the BPMN material by depth.** `bootstrap/` keeps only what an agent
   needs before it knows anything — what BPMN is, how to read one. Everything
   elaborating on *using* BPMN moves to `cat-harness/workflows`.
2. **`cat-harness/workflows/state`** describes the beans and todos skills, and
   is where state-management skills and tools live.
3. **It DECLARES `todos/` and `beans/` and creates them on its initialization
   process.** This is the part that overlaps live code — see below.

## Overlap with `qmjh`, which is now built

`qmjh` added `dependents: "reproduce" | "skip"`, and `beans` and `todos` are
both classified **`reproduce`**. That classification is currently inert: both
are `scope: "repository"`, and `resolveDirectories` never inherits a
repository-scoped entry, so nothing downstream reaches them.

If `workflows/state` becomes the thing that declares and creates them, then
**who owns those two entries moves**, and the `reproduce` classification stops
being inert. Do not re-litigate the classification as part of the move — it is
already the right answer for the case where it starts firing. What needs
deciding is whether the declaration moves out of `cat-harness/harness.json`
entirely, or `workflows/state` names them and the declaration stays.

## Open questions, the owner's

- Is `cat-harness/workflows` a NEW declared directory and graph, or the existing
  `processes/` renamed? The phrase "content should be at graph
  cat-harness/workflows" reads like a graph id, and there is already a graph
  kind called `cat-harness`.
- Does `workflows/state` "declaring" beans and todos mean a `harness.json`
  entry, or a BPMN process with `<folio:bean>` steps that creates them?
- Does this make `bootstrap/` smaller than its two current diagrams, i.e. does
  `log-message.bpmn` stay?

## Depends on / relates to

`603s` (the per-instance navbar renders each instance's declared subgraphs, so
a new `cat-harness/workflows` graph would appear there) and `qmjh` (above).

## Not started

Queued per the owner's standing instruction to queue rather than pivot.

## BLOCKED 2026-09-20 — the owner chose "rename wholesale", and the measurement is 4× what was quoted

The owner was asked whether `cat-harness/workflows` is a new graph or
`processes/` renamed, and chose **rename wholesale**. That answer was
given against a measurement of *"129 files reference that path"*. **The real
number is ~470**, and the difference is not padding — two of the categories
change what "rename" means:

| where | files | what happens on a rename |
|---|---|---|
| `cat-harness/translations/` | **215** | gettext catalogues carrying SOURCE PATH references |
| qa sidecars | 71 | regenerate and relocate — free |
| `beans/` | **48** | historical records of what was true when written |
| `cat-harness/content/` | 37 | code |
| `cat-harness/scripts/` | 28 | code |
| docs, skills, src, schemas, workflows, … | ~70 | code and prose |

**The two that need a decision:**

1. **215 translation files.** A `.po` catalogue references its source location.
   Rewriting 215 of them mechanically risks invalidating translations or
   breaking the gettext pipeline, and this repository has a whole epic
   (`bzyu`) on that pipeline. Whether a path rename should touch catalogues at
   all, or whether they carry stale references until regenerated, is a
   translation-pipeline question rather than a rename question.

2. **48 beans.** A bean is a record of what was true when it was written. Mass
   -rewriting `processes` to `workflows` inside 48 historical records
   makes them describe a tree that did not exist at the time — and this
   repository has already paid for exactly that shape, in comments that
   asserted a state the tree had moved past (`kg-export.ts`'s "COMMITTED
   artefact", `check-undeclared-files.ts`'s stale cross-reference). Beans
   should almost certainly be left alone, and that should be said rather than
   assumed.

**What is NOT a problem, measured:** `processes/` holds 42 `.bpmn` plus
`decisions/` and has **no `package-manifest.json`** — it is not a skill
package. So the rename does not touch the package machinery that made `1hvo`
fail silently (a kg directory holding skills directly is folded into the
instance's own package). That was the risk worth checking first, and it is
absent.

Also unresolved from the original ask, and cheap next to the above:
`WORKFLOW_DIR` in `workflow/store.ts` is one of the two hardcoded paths
`AGENTS.md` names as unavoidable (hot path of every workflow call), so it is a
deliberate edit rather than a sweep.

## DECIDED 2026-09-25 — code and docs are renamed; the beans are left alone

The owner was asked twice, and the second answer is the one that stands.

**First answer**, 2026-09-20: *"Everything, including beans."* Given against the ~470
measurement above, and against a recommendation to leave the beans alone. That
answer was then **lost** — this session was compacted before it reached the
bean, and PR #542 merged without it. Recording it here so the record shows it
was given rather than never asked.

**Second answer**, 2026-09-25, after re-measurement: **code + docs; the beans
stay as historical records.** The re-measurement is why the answer moved, so it
belongs beside it — read from `origin/main` at `b4600df7ec`:

| where | files | what happens on a rename |
|---|---|---|
| `cat-harness/translations/` + `bootstrap/translations/` | **370** | gettext catalogues carrying SOURCE PATH references |
| `cat-harness/docs/` | 283 | largely generated — regenerate, do not sed |
| `cat-harness/test/` | 109 | qa sidecars — regenerate and relocate, free |
| **`beans/`** | **102** | historical records — **NOT renamed, by this decision** |
| `cat-harness/processes/` | 70 | the directory itself |
| `cat-harness/scripts/` | 64 | code |
| `cat-harness/content/` | 45 | code |
| `cat-harness/skills/` | 31 | prose |
| everything else | ~62 | code, prose, workflows, glossary |
| **total** | **1136** | |

**The scope roughly doubled in five days** — 470 to 1136, and the beans from 48
to 102 — which is the fact that moved the decision. It is still growing, so a
count quoted from this table is a measurement with a date on it, not a
property of the repository.

**Why the beans are excluded, in the owner's decision rather than mine.** A bean
records what was true when it was written. Rewriting 102 of them to say
`workflows/` makes them describe a tree that did not exist at the time, and this
repository has already paid for that shape twice in comments that asserted a
state the tree had moved past (`kg-export.ts`'s "COMMITTED artefact",
`check-undeclared-files.ts`'s stale cross-reference). The counter-argument — one
vocabulary everywhere, so no reader ever meets the old word — is real and was
put; a reader meeting `processes/` in a 2026-09 bean is reading history and
should see the word history used.

**The 370 translation catalogues are still not ruled on.** They are neither code
nor history: a `.po` references its source location, so leaving them stale and
rewriting them mechanically are both wrong, and the right answer is that the
gettext pipeline regenerates them (epic `bzyu`). Not this bean's call, and not
blocked on: rename the code, let the pipeline follow.

**Unblocked.** The BLOCKED section above is discharged — the question it named
has an answer.

## Evidence of completion (2026-10-07)
- Landed in PR #1347 (merge commit `5891ada72908`): Workflows declaration hierarchy established under `cat-harness/workflows`.
- Re-derived independently on 2026-10-07: Workflow declarations passing schema checks.
