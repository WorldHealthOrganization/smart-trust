---
# folio-assistant-v49e
$schema: bean/1.0.0
title: 'WORKFLOW VIEW: cat-harness folio shows where todos and beans sit in the BPMN/DMN, and where a process is breaking down'
status: completed
type: task
priority: normal
tags:
    - rehomed
created_at: 2026-09-20T14:01:05Z
updated_at: 2026-10-29T08:00:00Z
parent: folio-assistant-yj32
---


Owner, 2026-09-20, in two messages:

> cat-harness folio should have function to show workflow mgmt... where
> todso/beans are in bpmn/dmn. should have specialized browser visualzier to
> see where process is breaking down.

> ...it should also be able to see working context/memory based on dependcy
> tree for that task.... see logs associated to it. (do not do this, just bean
> up)

## Why this is buildable rather than speculative

Every piece it needs already exists as committed state:

- **The diagrams are executable.** `.bpmn` under `processes/` are the
  source of truth, and `workflow_list` / `workflow_start` / `workflow_next` /
  `workflow_gate` / `workflow_complete` run them.
- **Position is committed, not in a session.** Running instance state lives in
  `beans/workflows/`, one JSON per instance, tagged
  `"$schema": "folio-workflow-instance/v1"` — so a sibling session sees the same
  position, and so can a renderer.
- **Steps already name their bean.** `<folio:bean op>` on an activity is what
  the engine performs, so "where is this bean in the process" is a join over
  data that is already there rather than a new annotation.
- **`todos/` is the human half** of the same 2×2 — a person's outstanding items
  against the agent's work plan — and both are declared graphs.

So the view is a JOIN, not an invention: instance state × diagram × the beans
and todos those steps name.

## "Where a process is breaking down" — what that means concretely

The interesting states are the ones that look like nothing:

- a step **enabled but not taken** for a long time,
- a bean marked blocked with **no expiry**, which `bean-blocking` already says
  cannot be told from abandoned work,
- an instance whose position has not moved while its bean kept changing,
- a gate that `workflow_complete` keeps refusing.

A visualiser that only draws the happy path will show a tidy diagram for a
process that has been stuck for a week.

## The second half, added by the owner and not to be dropped

**Working context/memory by DEPENDENCY TREE for the task, and the logs
associated with it.** Agent memory is a `context` graph (read at session start,
never written by a process) and `interaction/` is another; logs are their own.
So the view has to resolve, for a given task: which memory entries its
dependency chain makes relevant, and which log entries belong to it. That is a
different join from the diagram one and should be designed with it rather than
bolted on — the owner asked for both in the same breath.

## Done when

- [x] For a running instance: the diagram, the current position, and the beans
      and todos its steps name, together.
- [x] Stuck states are VISIBLE as states rather than inferred from a tidy
      picture — at minimum: enabled-and-not-taken, blocked-without-expiry, and
      a refused gate.
- [x] For a task: the working context/memory its dependency tree implies, and
      its associated logs.
- [x] It reads committed state only, so a sibling session's view agrees.

## Not started

Explicitly per the owner: *"do not do this, just bean up"*.

## `aazi` asks for an adjacent rendering — design them together

The owner beaned this one explicitly rather than starting it ("do not do this,
just bean up"). `aazi` then asked for beans and todos **mapped to their BPMNs,
rendered for project management**, published at a `workflow-statemgmt` path.
That is the same data this bean wants to show "where process is breaking
down". One renderer with two readings, not two renderers.

---

## UNBLOCKED 2026-09-21 — the join this bean describes is now computable

This bean argued it was *"buildable rather than speculative"* because every
piece was committed state. One piece was not, when it was written:
`beans/workflows/` held only `.gitkeep`, which is what `vlhk` was opened about
and what `aazi` and `supn` both record as their blocker.

**It holds two instances now**, both `$schema: "folio-workflow-instance/v1"`
and both `running`:

| instance | process | `bean` |
|---|---|---|
| `crdm--folio-assistant-6lb8` | `Process_CRDM` | `folio-assistant-6lb8` |
| `crdm--issue-607-kg-to-cdn-portal` | `Process_CRDM` | `folio-assistant-xies` |

Each carries `tokens` (where the token sits), `history` (the steps taken),
`arrivals`, `children`, `subject` and `source`. So *"instance state × diagram ×
the beans those steps name"* is a join over real data rather than a plan.

**The caveat to build against is coverage, not existence.** 2 instances against
232 beans, so the overwhelmingly common case is a bean NO instance names — and
the view must render that as a **third state**, not as an empty diagram or a
zero. A process view that draws nothing for 230 beans and says why is honest;
one that draws an empty lane is the failure this repository keeps paying for.

*"Where a process is breaking down"* is also now askable: both instances are
`running` and one has not moved since 06:14, which is exactly the
looks-like-nothing state this bean names.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). Where todos and beans sit in the BPMN/DMN is the cat-harness folio's own view. Design it together with `supn`. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Rehomed 2026-10-10: this copy is now a pointer

By the owner's ruling of 2026-10-10 (move to the code's repo, and keep a
pointer here). The code this bean changes is in cat-harness. Its owning copy is
therefore the **same id in the cat-harness store**
(`litlfred/folio-assistant`, branch `cat/cat-harness/beans`,
`beans/defs/folio-assistant-v49e--*.md`), which is open there. Work it there.
This copy stays open as a pointer, and closes when that one does.


_2026-10-24T08:20:00Z_ — **Claimed** (owner said "start v49e", 2026-10-24). PR 1: cat-harness-tools#684 (per-instance view, stuck states, processes links) and cat-harness#510 (home-page link). Item 3 (memory/logs by dependency tree) follows. Session https://claude.ai/code/session_01UbCbH19GrhqDNakmbgQTF3.

_2026-10-24T11:10:00Z_ — PR 1 merged: cat-harness-tools#684 as 99bbe26 and cat-harness#510 as 4506916. Item 3 (working memory and logs by dependency tree, gate refusals) still open; stays in-progress.

_2026-10-29T08:10:00Z_ — **Claimed** for PR 2 by the Lane B drain thread: item 3 (working context by the task's role and its `inherits` closure, and the committed history as its log) and refused gates recorded on the instance, so `refused-gate` becomes a real state. Session https://claude.ai/code/session_01Qmmkt7rXCDPexdBbNqeJqU.

## Closed 2026-10-29

All four boxes met. PR 1: cat-harness-tools#684 and cat-harness#510 (instance pages, stuck states, committed state only). PR 2: cat-harness-tools#802 (refused steps recorded so `refused-gate` is a state; each step's working context and the memory its role reaches; the history as the committed log), merged 2026-10-29 as 362e21d. The pages show on the site once the tools layer is re-pinned in folio-assistant. (Lane B drain thread.)


_2026-10-24T08:20:00Z_ — **Claimed** (owner said "start v49e", 2026-10-24). PR 1: cat-harness-tools#684 (per-instance view, stuck states, processes links) and cat-harness#510 (home-page link). Item 3 (memory/logs by dependency tree) follows. Session https://claude.ai/code/session_01UbCbH19GrhqDNakmbgQTF3.

_2026-10-24T11:10:00Z_ — PR 1 merged: cat-harness-tools#684 as 99bbe26 and cat-harness#510 as 4506916. Item 3 (working memory and logs by dependency tree, gate refusals) still open; stays in-progress.

_2026-10-29T08:10:00Z_ — **Claimed** for PR 2 by the Lane B drain thread: item 3 (working context by the task's role and its `inherits` closure, and the committed history as its log) and refused gates recorded on the instance, so `refused-gate` becomes a real state. Session https://claude.ai/code/session_01Qmmkt7rXCDPexdBbNqeJqU.

## Closed 2026-10-29

All four boxes met. PR 1: cat-harness-tools#684 and cat-harness#510 (instance pages, stuck states, committed state only). PR 2: cat-harness-tools#802 (refused steps recorded so `refused-gate` is a state; each step's working context and the memory its role reaches; the history as the committed log), merged 2026-10-29 as 362e21d. The pages show on the site once the tools layer is re-pinned in folio-assistant. (Lane B drain thread.)

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
status: completed
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
status: completed
```
