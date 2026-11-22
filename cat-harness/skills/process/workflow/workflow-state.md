---
name: workflow-state
description: >
  Where a running process keeps what it knows, and which store answers which
  question. The three records a step may touch, the one it may not, what
  `<cat-harness.processes:bean op>` actually performs, and why an instance and a work item must be
  one answer rather than two.
graph-typologies:
  - workflow-state
---

# State in a running process

A process instance is not self-contained. It walks a diagram that lives
somewhere else, records its position somewhere else again, and reads facts it
must not change. **Five stores; confusing any two of them is how a work plan
comes to disagree with itself.**

## Which store answers which question

| question | store | graph typology | layer |
|---|---|---|---|
| what does this process DO? | `processes/**/*.bpmn` | `cat-harness` | **content** |
| where did this instance GET TO? | the workflow-state node of the work item graph | `workflow-state` | **state** |
| what is being worked on? | the bean-defs node of the work item graph | `bean-defs` | **state** |
| what does a PERSON still owe? | `todos/` | `todo-items` | **state** |
| what do I already know? | agent memory | `memory` | **context** |

The `layer` column says **what a step may do**. A step
may write to a `state` graph; that is what state is for. **A step that writes
to `context` is a defect**, not an update: memory changes when a human directs
an authoring act, outside any instance.
[`content-context-and-state-graphs`](../../kg/kg-core/content-context-and-state-graphs.md)
carries the axis; `processMayWrite()` is the predicate.

## The diagram is content and the instance is state, and that is the whole model

A `.bpmn` is authored, reviewed, versioned and read by anyone — it stands on
its own. An instance is a **token position in that diagram** plus a history: it
means nothing detached from the file it walks. That is why the two live in
different graphs and why an instance names its process rather than embedding
it.

Two consequences:

**An instance is never edited by hand.** It carries
`"$schema": "folio-workflow-instance/v1"` and the interpreter owns it. Hand-
editing a token is asserting a step happened, which is precisely what the gate
exists to refuse.

**A diagram change does not rewrite history.** An instance records where it got
to under the diagram as it stood. If a step is renamed, the honest answer is
that the old instance names a node that no longer exists — not that it
retroactively took a different path.

## Beans and instances are ONE answer, not two

`bean-defs` says *what is being worked on*; `workflow-state` says *where it got
to*. Those must be one answer or they diverge, and a work plan that disagrees
with itself is worse than one that is merely coarse.

The loop is closed by `<cat-harness.processes:bean op="…">` on an activity. **A bean-marked
step is not a step *about* the work plan — it IS the work-plan operation**, so
completing the step performs it:

| `op` | on completing the step |
|---|---|
| `claim` | status → `in-progress`, idempotent |
| `note` | append the caller's note to the body |
| `resolve` | status → `completed`, **only if the instance itself finished** (or only archive steps are left) |
| `archive` | move a completed or scrapped work item into the archive, **only once the instance finished** |

`claim` is drawn only in `Process_BeanOpen`, and `resolve` and `archive` only
in `Process_BeanClose`; every process that works on a work item calls both
(`check:bean-calls`). `note` is drawn where the work happens.

**`resolve` is the careful one.** A work item is never
closed on somebody else's judgement, so it does not fire on the caller's
say-so: the work item completes only when the instance tracking it has completed,
which is a fact *derived from the process* rather than asserted by the agent
calling it. A still-running instance gets a note.

An `op` the build does not implement **fails at process load**. A step that
says it resolves a work item and quietly does nothing is exactly the divergence the
extension exists to close.

## What state does NOT buy you

**Ordering is not quality.** A completed instance means the gates ran in order
and a person saw the findings. Whether the content is *correct* is what the QA
axes, the build and the validators are for. A green process must never be read
as a reviewed artefact, and any dashboard built on this has to say so.

**A position is not a claim.** An instance at `Task_Commit` says the token
arrived, not that the commit is good.

## Where running instances live — the state graph on the branch store

Running instances are part of the work-plan store (`workflow-state` graph typology;
`positions` in `work-plan-store` (opt-in `cat-harness.work-plan`)).
Where the deployment uses the git state-branch Tool, the store is mounted and
pushed as described in
`work-plan-store-git-branch`.

The container is ephemeral and **a work plan only one agent can see is not a
work plan**. Instance state lives in the shared work-plan store for the same reason
work item definitions do: a sibling session, or the same session resumed in a fresh
container, reads the store to find the position that exists rather than
starting a second one beside it.

When an instance advances, its state is written through the store's Tool
(`bun run cat state:push` when backed by the git state branch).
This keeps instance state globally visible without cluttering code PR diffs on `main`.

Instance ids are **derived from the subject rather than random**, so re-entering
a step finds the instance that is already there: `beans create` is not
idempotent and dedupes on nothing, so an id you can recompute is what prevents
duplicates.

## Reading the state you did not write

Before acting on an instance you did not start, ask what it is waiting on. A
work item's status defaults to **non-blocking**; a real block carries what it waits
on, since when, an **expiry** and a handoff — because a block with no expiry
cannot be told from abandoned work.
`bean-blocking` carries that, and
`bean-coordination` carries the rule that
a claim **announces rather than reserves** until your PR exists.

## See also

- [`bpmn-processes`](bpmn-processes.md) — how to author an activity, strict vs
  advisory, the commit-boundary gate, DMN-backed gateways.
- [`process-state`](process-state.md) — saying which process you are in, the
  five detectors for being out of process, and the recovery.
- [`content-context-and-state-graphs`](../../kg/kg-core/content-context-and-state-graphs.md)
  — the layer each store sits on, and why memory is not writable by a step.
- `todo-manager` — the work plan's own store.
  A todo is a **person's** outstanding item and is not a second work plan.
