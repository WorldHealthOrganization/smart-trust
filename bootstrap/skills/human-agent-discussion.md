---
name: human-agent-discussion
description: >
  Ask a person (or a sibling agent) for what no file holds. First determine
  where you are — the context, the Role you act as and theirs, the Process
  and task (or that you are idle) — and ask about whichever you cannot
  determine before anything else. Then context, the options, a
  recommendation and what happens with no answer, then ONE question.
---

# Asking a person, in one reusable way

**You are the agent that needs something only a person can supply**: a
choice, a judgement, or a step only they have the rights to perform. Every
diagram in bootstrap that needs one calls
[`processes/human-agent-discussion.bpmn`](../processes/human-agent-discussion.bpmn)
as a call activity rather than drawing its own asking.

## Before you ask: determine where you are

The diagram's first three tasks come before any question, and each is declared as a precondition of the first one
(`bootstrap.processes:precondition … before="A_GiveContext"`):

| determine | what you must be able to say | why it comes first |
|---|---|---|
| **the context** (`A_DetermineContext`) | what is already known, each fact with where it came from; which declaration governs it (the layer's `<name>.json`, the diagram you are in, the Skill its task names); and whether the question has **already been decided** — earlier in the conversation, or in a declaration that quotes the person's ruling | a settled question asked again reopens a decision and spends the person's attention twice. Cite what you read, not what you remember |
| **the Roles** (`A_DetermineRoles`) | which Role you are acting as — the lane of the task that called this discussion — and which Role the person you ask holds | an Actor performs a task in a Process **as** a Role; nothing is a Role by nature. Who holds the decision decides whom you may ask: only the Requestor chooses a harness |
| **the Process and task** (`A_DetermineProcess`) | the Process, the lane and the task the question belongs to — *"Process: Initialize a harness, at Determine the harness and repositories, as the Bootstrapping Agent"* — **or** that you are in none: you are **idle**, classifying a request to find the Process it belongs to | a reader who does not know which Process you are in assumes the last one's rules still hold |

Say all three in the message, as the first part of the context. A caller that
already determined them hands them in; you check them rather than re-derive
them.

**You are out of process — the Process is undetermined — when** you cannot
name it, when two candidates fit, when the step you believed was next is not
the one the diagram enables, or when the work in hand is not what you said
you would do. Do not infer your way back in.

### What cannot be determined is asked first

When any of the three cannot be determined, that becomes **the first
question of this same discussion** (`A_AskUndeterminedFirst`), and the
caller's question waits, counted. Ask about the outermost first — the
Process, then the Role, then the context — since the outer answer usually
settles the inner. It goes through the same order as every question below,
and it allows **no default**: a Process or a Role assumed rather than
confirmed is an authority nobody gave you. Its answer is recorded, the three
are determined again, and only then is the caller's question put. If it is
declined or met with silence, record what is still open and stop: a step
completed in the wrong Process records an authority that was never given.

> I am in **Initialize a harness**, at *Determine the harness and
> repositories*, acting as the Bootstrapping Agent. I cannot tell whether you
> are the person who wants this repository set up, or relaying for someone:
> the request came from another agent's message. If you are, I will ask you
> which harness next; if not, I will stop and record that the Requestor is
> unknown, since only the Requestor chooses. **Are you the person who wants
> it set up?** (One more question after this one.)

## The order is the rule

1. **Context.** Where you are (the three determinations above), what is
   being decided, what depends on it, and what you already know, each fact with where it came from. In the message itself:
   a link is where somebody goes for *more*, never where the terms are
   defined.
2. **Options.** Every option still open after you narrowed from context,
   each with what it costs and what it makes hard to undo. An option you
   could have ruled out yourself wastes the reader's attention.
3. **Recommendation.** The option you would take, marked, and why.
4. **What happens with no answer.** Said *before* the question, so silence
   has a meaning both sides agreed to before it happened: the default, when
   the caller allows one, or "the question stays open and the work stops".
5. **One question**, answerable by picking. With several decisions open,
   ask one in full and give a **count** for the rest.

The test before you send it: **can the reader answer without opening
anything?** If not, the question is not ready.

## What can come back, and where each ends

| what came back | what you do | end |
|---|---|---|
| an answer that settles it | record it, and who gave it (a person or an agent) | *Answered* — or, when it answered a question about where you are, determine again and put the caller's question |
| an answer that does not settle it (a kind instead of an option; two options) | follow up **once**, narrower, naming what is still open | back to the answer |
| a refusal | record what was asked and what is still open | *Still open* |
| nothing | apply the default **only if the caller allows one**, and say so; otherwise record what is still open | *Default applied* or *Still open* |

**A default is the caller's to allow, never yours.** A caller allows one
only when the decision is reversible and its own instructions name the
default. It is recorded as *assumed*, with the default named, never as the
person's answer, and the next message tells them it was applied so they can
reverse it. Which harness a repository becomes allows **none**: a wrong
answer does not fail, it succeeds at being the wrong thing
([`confirm-harness`](confirm-harness.md)).

## The record

In the form the caller asks for. For bootstrap's harness question that is a
document conforming to
[`discussion.output.schema.json`](../schemas/discussion.output.schema.json)
([`discussion`](discussion.md)). For a step only the person can perform
([`complete-initialization`](../processes/complete-initialization.bpmn)), it
is the step with the person's word beside it. A person saying "done" is
recorded as their word, and the next check decides whether it holds.

## Symmetric in its participants

The answering lane is a person or a sibling agent that already holds the
answer. The record says which, because the two are evidence of different
weight. Neither is refused, and they are not conflated.
