---
name: session-context
description: >
  What a state machine tracks across a session, as against one process
  instance. What the record carries, why `actor` is required and the rest are not, why
  the session's view of a node is advisory, and what a sibling session reads it
  for.
graph-typologies:
  - session-state
---

# Session context

A **session** is one actor working, from the moment it picks up until it stops.
A **process instance** is a token's position in one diagram. They are not the
same object and the difference is load-bearing:

> A session **starts before** any instance, may open **several**, switches
> between them, and **outlives** each. A session with nothing open is the
> commonest state there is.

Model the session as a field on an instance and the first process opened owns
facts that belong to the actor — and the idle session, which is most of them,
becomes unrepresentable. So it is its own record, **referencing** instances
rather than containing them.

Shape: `schemas/sdlc/session-context.ts`. Graph typology: `session-state`, layer
`state` — a session writes its own record as it goes, which is exactly what
[`content-context-and-state-graphs`](../../kg/kg-core/content-context-and-state-graphs.md)
means by live state.

## The fields — read them off the schema, never off this page

`SessionContextSchema` in `schemas/sdlc/session-context.ts` is authoritative.
A field list in prose beside a Zod object is a second answer, wrong the first
time somebody adds a field, so this page gives no field count; the sections below say what the main fields
are for.

## `actor` is required, and it is the point of the record

Every other field can be recovered by looking at the repository. Open
instances are in the work item graph; claimed work items carry their own status;
timestamps can be reconstructed from commits. **WHO is acting cannot be
derived from anything.**

The machine keeping the session cannot infer it, which is also why
[`log-message`](../../../../bootstrap/skills/log-message.md) takes `actor`. A
sibling session needs to know **who is answerable** before it touches the same
work item.

**It is a reference with a `declared` flag, not an `ActorDefinition`.** An
agent may act without a node under the actors graph, and requiring one would
make the field unfillable in exactly the cold-start case the record is most
useful for. The two facts — *an id that resolves* and *a name nobody declared*
— are kept apart because a consumer acts differently on each: an audit can
follow the first to a role and a permission set, and can only quote the second.

And `declared` is **written, not inferred at read time**. A reader resolving it
themselves gets a different answer than the writer did if the node was added or
removed in between, and the record says what was true when the session acted.

## The rest of the fields, and what each is for

| field | for | notes |
|---|---|---|
| `id` | naming this session | stable for its life |
| `startedAt` / `updatedAt` | telling a live session from an abandoned one | ISO-8601 UTC |
| `open[]` | which instances this session is inside | **empty is normal**, not a gap |
| `claimed[]` | which work items this session announced | by reference, never copied |
| `waitingOn` | why nothing is moving | `what` + `since`, together |

**`open` empty is the normal state.** An agent answering a question, reading, or
deciding what to do next is in no process at all, and
[`process-state`](process-state.md) calls that idle rather than broken. A
record that treated empty as a defect would report every reading session as one.

**`claimed` is by reference because a claim announces rather than reserves.**
The work item is the authority on its own status
(`bean-coordination` (opt-in `cat-harness.work-plan`)); a status copied
here would be free to contradict it, and a sibling reading the copy would act
on a claim that had already been released.

**`waitingOn` carries `since` or it carries nothing.** A wait with no start
cannot be told from abandoned work — the same argument
`bean-blocking` makes for requiring an
expiry. `what` is free text on purpose: a human answer, a CI run, a sibling's
PR is an open set no enum would survive.

## The session's view of a node is ADVISORY

`open[].atNode` is what the session *believes*. **The instance wins.** The
instance is the authority on its own token; this can be stale by exactly one
step — the gap between a step completing and the session noticing.

It is recorded anyway for two reasons. The commonest question about a session
("what is it doing") should not need a second file read. And a **disagreement**
between the two is itself worth seeing: a session whose view has drifted from
the instance is a session that lost track, which is one of the detectors
[`process-state`](process-state.md) names for being out of process.

## Who reads it, and why it is parsed rather than trusted

**A sibling session**, deciding whether a work item is genuinely being worked or was
claimed by someone who stopped. **A person**, asking what is in flight.
**The session itself** on resume, in a fresh container, where the alternative
is starting a second session beside the one that already exists.

The writer may be an LLM playing the part of a state machine, so the shape
cannot be assumed from the writer's care. `parseSessionContext()` parses at the
boundary, which is what makes a **non-deterministic writer safe to read from**.
The general rule: where a machine may be played rather than executed, the
schema is the contract and the parse is where it is enforced.

## What this is NOT

**Not the work plan.** A work item says what is being worked on and survives the
session; this says who is working and where they are right now. Delete every
session record and the plan is intact.

**Not a log.** [`log-message`](../../../../bootstrap/skills/log-message.md)
records what an actor DID at a moment, append-only. This is the current
position, overwritten as it moves. A log tells you how you got here; this tells
you where you are.

**Not interaction preferences.** `cat-harness/memory/interaction.json` holds how a person
wants to be asked — durable, read at session start, never written by a process.
That is `context`, and this is `state`: the two are on opposite sides of the
layer line and must not be merged, however adjacent they look.

**Not a store yet.** The kind is registered and the shape is defined; nothing
writes one, so no directory is declared for it: a declared-but-empty directory
makes a consumer scan nothing and report a clean run.
