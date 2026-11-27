---
name: discussion
description: >
  Settle which harness, and which repositories, when no file says: the output
  is a document conforming to `discussion.output.schema.json`.
---

# discussion — settling what an agent cannot read off disk

An agent that has just read bootstrap's `README.md` knows the shape of a
harness and nothing about **this** one. Two questions have no answer in any
file it can reach:

- **which harness** this repository should become: `bootstrap` itself, or
  any Harness built on it;
- **which repositories** are involved — where the dependency is read from,
  where the new declaration is written to, and whether they are the same.

Only whoever asked for the harness can answer them, so the agent **asks**.
This skill says what the asking must produce.
[`processes/discussion.bpmn`](../processes/discussion.bpmn) narrows the
candidates and then calls
[`human-agent-discussion`](human-agent-discussion.md), the one reusable way
bootstrap asks a person anything, with **no default allowed**.

## Inputs and outputs

| | |
|---|---|
| **in** | [`discussion.input.schema.json`](../schemas/discussion.input.schema.json): what the agent already knows, and which of the two unknowns is open |
| **out** | [`discussion.output.schema.json`](../schemas/discussion.output.schema.json): `harness`, `repositories[]`, `outcome`, `determinedBy`, `answeredBy`, and the `exchange` that produced it |

Both are plain JSON Schema in `schemas/`, readable with nothing installed.
The task is finished when a document conforming to the output schema exists,
not when a conversation has taken place.

The participant may be a person or a sibling agent that already holds the
answer; the output records which (`kind: person | agent`), as
[`human-agent-discussion`](human-agent-discussion.md#symmetric-in-its-participants)
says.

## First, say where you are

Before narrowing anything (`A_DetermineWhere`), determine the three things
[`human-agent-discussion`](human-agent-discussion.md#before-you-ask-determine-where-you-are)
requires before any question:

- **the Process**: *Initialize a harness*, inside *Determine the harness and
  repositories*. A Bootstrapping Agent can be nowhere else (FR-2);
- **the Roles**: itself as the Bootstrapping Agent; the person it will ask as
  the Requestor. A request relayed by somebody else leaves the Requestor
  undetermined;
- **the context**: what the request said, and what the checkout holds.

One that cannot be determined is never filled with a default: it is asked
about **first**, and the harness question waits.

## Rules

**Ask the fewest questions that settle it.** Narrow the candidate list from
context first (a repository whose root already holds a declaration,
`<name>.json`, is not a blank slate) and put the rest as one question with the
candidates named. A question a reader must go and research is not ready.

**Never infer the answer from a default.** If nothing is known, the output's
`determinedBy` is `asked`, not `assumed`. `assumed` is permitted only for a
default the README states, and `assumption` then names it.

**Record repositories as pairs, not as a list.** `read from` and `written to`
can be the same repository or two; the point of determining them is to know
where the declaration lands.

**Never infer `written-to` from push access.** A remote repository is
`read-from` until the Requestor authorizes writing to it
([`confirm-harness`](confirm-harness.md)).

**A refusal is an outcome.** If the participant declines, that is
`outcome: "unsettled"` with what was asked and what is still open — not a
guess, and not an error.
