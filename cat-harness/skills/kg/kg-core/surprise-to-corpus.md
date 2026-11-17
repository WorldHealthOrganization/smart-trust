---
name: surprise-to-corpus
description: >
  What was unexpected in that task, and does it belong in the corpus? Logical
  surprise is the detectable kind, recurrence is the filter that stops this
  generating noise every turn, and the agent PROMPTS — it never writes corpus
  guidance unasked.
allowed-tools: Read Grep Glob AskUserQuestion
---

# Surprise to corpus — notice it, filter it, then ask

> Skill id: `surprise-to-corpus` · Package: `folio-core`

When something unexpected happens during a defined process that runs often,
it may be worth a new skill, guidance or tool refinement: prompt the person to
add it to the corpus.

Three clauses: **notice**, **filter by recurrence**, **prompt**. The first
alone is a diary; the first two are an agent rewriting the corpus on its own
authority; the third without the second is a prompt every turn until people
stop reading them.

## 1. What counts as a surprise

**Ask it as an after-action review asks it:**

> **What did you expect to happen, what actually happened, and why the
> difference?**

This makes the surprise articulable BEFORE you know whether it matters.
"Something felt off" is not reviewable; "I expected the tracer to read the
mask as ink and it read the ground" is. The filter in §2 then operates on a
statement rather than on a feeling, so it can be applied consistently.

**Only LOGICAL surprise is detectable.** Statistical surprise implies a base
rate, and the corpus carries none — nothing records how often a gate fires, a
merge conflicts, or a selector breaks. Do not claim a statistical surprise:
it would assert a distribution nobody measured.

Logical surprise needs no baseline. It is any of:

- **A premise turned out false.** You believed something about the system,
  acted on it, and the system disagreed.
- **A gate fired for a reason nobody predicted** — including a gate that
  passed when you expected red.
- **A command failed and the failure was invisible**, because whatever ran
  next produced plausible output anyway.
- **Two things that looked like one thing**, or one thing that turned out to
  be two.

### Examples of the general shapes

| the surprise | the general shape |
|---|---|
| `potracer` treats ZERO as foreground — the inverse of what the name suggests | a library whose convention is the opposite of its name |
| `Image.crop` past the edge pads with BLACK, which a tracer reads as ink | a default that is invisible until another tool interprets it |
| a CSS class used as an IDENTITY is reused by a second button as a box class, breaking every selector at once | a name doing two jobs, discovered when the second arrives |
| an id sliced one character short fails silently behind a `tail -1` | a truncated identifier that still LOOKS like an identifier |

## 2. The recurrence filter — the part that stops the noise

> **A surprise inside a one-off is an anecdote. The same surprise inside a
> process that runs often is a defect in the process.**

Without this filter the rule fires every turn, because every non-trivial turn
contains something somebody did not expect. With it, the question is narrow
and answerable:

> **Did this happen inside a defined process that runs often — and would the
> next agent running that process hit it too?**

Both halves. A rare process can still be worth guarding if its failure is
expensive, but then say *that* rather than claiming a recurrence you have not
seen. "The next agent would hit it too" separates a fact about the system from
a fact about your own mistake.

Three ways a candidate fails the filter, all of which end in silence rather
than a prompt: it happened once, in a process nobody runs twice; it was your
own slip and the system behaved as documented; or the corpus already says it
and you had not read that part. **The third is the common one**, and checking
costs one `grep`.

### Read the slip blamelessly

A finding is about the SYSTEM rather than about the person. "My own slip"
fails the filter only when the system behaved as documented AND nothing about
the system made the slip easy. Where the system DID make it easy, *would the
next agent hit it too* is true, and the candidate passes. A mis-copied id is
not just a slip: a truncated id is still a well-formed id, and a `| tail -1`
hides a non-zero exit — both properties the next agent meets unchanged.

## 3. PROMPT, never write

**The agent proposes; a person decides.** This is
[`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md) pointed
the other way: that skill governs removing a durable artefact on your own
initiative, this one governs ADDING durable guidance on your own initiative.
The corpus is read by every future session, so the person who has to live
with a line in it should be the one who agreed to it.

What a good prompt contains — the same parts
[`interaction-modality`](../../conduct/conduct-core/interaction-modality.md) §4.1 binds every handed-over
decision to, and the test is identical: **can the reader answer without
opening anything?**

1. **What happened**, concretely, with the measurement or the error text.
2. **Which process it happened in**, named.
3. **Why it will recur** — the filter above, argued rather than asserted.
4. **What you propose**: a new skill, a line in an existing one, or a tool
   change. Say which, and where it would live —
   [`where-does-this-go`](../../conduct/conduct-core/where-does-this-go.md) is how you answer that.
5. **Your recommendation**, marked as such.
6. **What happens if they say nothing**: nothing gets written, and the
   candidate is filed as a work item so it is not lost.

**A work item is the third state** — recorded, unactioned, findable — so silence
is not expensive and an unanswered prompt is something the next session can
pick up rather than rediscover.

## 4. When to run this

**At the end of a task**, not continuously: one pass over what actually
happened. Most turns produce nothing and should say nothing — a loop that
reports "no surprises" every turn is a loop people stop reading.

It pairs with `turn-reporting` (opt-in `cat-harness.sdlc`), which governs the shape
of the report you were already writing.

## What this skill deliberately does not do

- **No severity scale.** Ranking surprises would invite filing the low ones,
  which is the noise the recurrence filter exists to prevent. A candidate
  either passes the filter or is worth a work item at most.
- **No automated corpus change.** A mechanism that could write guidance would
  be used to write guidance.
- **No timeline reconstruction.** The agent was present for the whole turn,
  and the transcript is the timeline.
- **No routing method.** Where a surprise goes is
  [`where-does-this-go`](../../conduct/conduct-core/where-does-this-go.md),
  which needs an index rather than a taxonomy at its size.
