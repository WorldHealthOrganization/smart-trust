---
name: session-state-machine
description: >
  An agent PLAYING a state machine rather than an engine executing one. Where
  the non-determinism actually lives, why the diagram stays strict, the
  `cat-harness.processes:judgement` marker that makes a judgement point countable, and what the
  machine must never do on the actor's behalf.
---

# Playing a state machine

An agent can play a non-deterministic state machine as a tool, managing state
during a human and agentic discussion. The diagram is `processes/process/session-state-machine.bpmn`. It keeps a
session's context current across a discussion: establish who is acting, open
the record, and on each turn decide whether anything changed.

## The non-determinism is in the TRANSITIONS, not the shape

A machine whose **shape** were non-deterministic could not be drawn here. The
interpreter supports nine BPMN element types and **throws** on the rest, on
purpose: skipping an unrecognised element yields a process that runs, reports
progress, and is silently not the process on the diagram.

So the shape is strict and enumerable. What varies is **which enabled branch
the agent takes**, and what it writes.

An exclusive gateway carrying `<cat-harness.processes:decision>` is computed
and `workflow_complete` *refuses* a hand-supplied outcome; one without it means
the caller supplies the answer.

## Saying that a judgement is deliberate

A gateway with no decision table can be two different things:

- **somebody's call**, which no table can make, and
- **a table nobody has written yet.**

`<cat-harness.processes:judgement reason="…"/>` declares the first, with the
same three rules as `cat-harness.processes:no-skill` on activities: the reason is **required** and a declaration without one
does not load; it is refused on anything but an exclusive gateway; and it is
refused **alongside** `cat-harness.processes:decision`, because a gateway claiming both that a
table decides it and that a person does leaves a reader unable to tell which
the author meant.

**Why this matters more than the activity case.** A step with no skill is a
documentation gap. A gateway with no table is a point where an LLM decides the
branch — and *how many of those there are, and which*, is exactly the question
the deterministic-to-agentic spectrum is about
([`deterministic-and-agentic`](deterministic-and-agentic.md)), and a mechanism
that cannot enumerate its own judgement points cannot answer it.

`check:workflow-refs` prints the three-way split (computed, declared judgement,
undeclared) from the models. **Ask the checker, not this page.** An undeclared
gateway is a backlog entry rather than a defect: every gateway that predates the
marker lands there, and a gate that failed on an un-annotated corpus would be
turned off.

## What the machine must never do

**It claims nothing.** No `cat-harness.processes:bean` appears anywhere in the diagram. The
process RECORDS that an actor claimed a work item; it does not claim one. A machine
that claimed on the actor's behalf would make the claim's owner unrecoverable
— and a claim *announces rather than reserves* precisely so a reader can tell
who announced it.

**It closes nothing but itself.** `A_CloseSession` records that the actor
stopped. It does not resolve work items or complete instances: those outlive the
session by design, and a machine that tidied them away on exit would be
asserting that work finished because somebody went away.

**It is advisory, not strict.** An agent keeping its own session record must
never be refused. A missing update is a gap in a record, not an unauthorised
write — and the base content processes are the ones that gate.

## The two judgement points, and why each is safe to be one

**`Gateway_ActorKnown`** — only the discussion says who is acting, and it
rarely says so in a field. A table would need a name to read; this branch *is*
the reading.

**`Gateway_TurnEffect`** — whether a turn changed the session's state is a
reading of intent. *"I might look at X later"* and *"start X"* differ by
nothing a table can key on.

Both are safe to be judgement for the same reason, which will not hold
everywhere: **getting one wrong is recoverable.** The next turn corrects it,
and nothing downstream has been authorised in the meantime. Contrast the steps
the base processes mark `relaxable="false"` — the editor seeing the findings,
the decision, the write, the release authorisation — where a wrong branch
authorises something that cannot be un-authorised.

*Recoverability* is one candidate criterion for where judgement is
admissible; whether it is the right one is open research
([`deterministic-and-agentic`](deterministic-and-agentic.md)).

## Writing state a non-deterministic machine produced

The record's shape cannot be assumed from the writer's care, because the
writer is an LLM playing a part. `parseSessionContext()` parses at the
boundary.

**Where a machine may be PLAYED rather than executed, the schema is the
contract and the parse is where it is enforced** — at the point the value
crosses in.

## See also

- [`session-context`](session-context.md) — the record this machine keeps, and
  why `actor` is its required field.
- [`workflow-state`](workflow-state.md) — which store answers which question,
  and why an instance and a work item must be one answer.
- [`bpmn-processes`](bpmn-processes.md) — authoring an activity, strict vs
  advisory, and DMN-backed gateways.
- [`process-state`](process-state.md) — the five detectors for being out of
  process. A session whose view has drifted from its instances is one of them.
