---
name: issue-working
description: >
  Working a tracked issue — announce the branch when you create it rather than
  when you finish, and re-check the issue for new AND edited comments while you
  work. Both rules are about the gap between your view of an issue and everyone
  else's.
adapters: [document, paper, dak]
profiles: [document, paper]
graph-typologies:
  - issue-marks
---

# Working an issue — announce, then re-check

Two rules. Both exist because **your view of an issue and everyone else's
diverge the moment you start**, and neither side can see that it has happened.

## Announce the branch when you create it, not when you finish

Comment on the issue with **the branch name, the process and phase, and the work
items claimed** — at creation. Before it, run the collision review in
[`coordinate`](coordinate.md) §"Starting new work".

A summary posted after the work lands is not a substitute. **Until the first
comment appears, a sibling session and a human both see an issue with nobody
visibly on it**, which is precisely the state the work plan exists to prevent
and the one no sibling can detect.

Announce **once**, on the single edge into implementation. A process that loops
back into implement re-enters on the same branch, and re-announcing each time is
noise that trains the reader to skip the announcements that matter.

## Re-check the issue while you work

**Checking once at session start is not checking.** Requirements change while
you are heads-down, and the comment that changes direction is the one you are
least likely to see.

Track what you have already read as **two** marks, not one:

- a **comment-id high-water mark**, and
- the **newest edit timestamp** — because an edited comment keeps its id, and
  **an edited requirement is a changed requirement.** A high-water mark alone
  cannot see an edit at all.

**With no stored mark, everything counts as unseen.** A fresh container has read
nothing, and defaulting the other way is exactly how the comments that change
direction get skipped — silently, because nothing distinguishes *read* from
*never looked*.

## When the new material is a large chunk of work, stop

**Do not fold it into the current run.** Say that this is a good stopping point
for review, link the artefact, and confirm priorities before continuing.

Absorbing it buries a scope change inside a diff nobody asked for, and spends
the author's next review on work they have not agreed to. A large new
ask is a decision to hand back, under the usual discipline — context, options with their costs, a marked recommendation,
then the question.

## What an issue is *for*, against its neighbours

They are not synonymous, and conflating them is how an agent closes something it
had no standing to close:

| | what it carries |
|---|---|
| **issue** | stakeholder sign-off |
| **change proposal** | code review |
| **work item** | work-plan tracking |

**Never close an issue without explicit authorisation from the analyst or
stakeholder.** Whether work is done is a judgement, and an agent must never
assume completion on its own say-so — the same rule that stops you closing a
work item a sibling is mid-flight on.

That authorisation may be given **in advance**: an `issue-close` waiver, which
names the issues it covers and expires. It is the stakeholder answering the
same question earlier, which is the whole of what this rule asks for — never
the agent supplying the judgement itself.
[`confirmation-waiver.md`](../../../skills/conduct/conduct-core/confirmation-waiver.md).

After each round of implementation, post a summary on **the issue**, not only on
the change proposal: what was accomplished, what remains, and links to the
updated content for review.

## Milestones and decision points go on the issue, as they happen

A round can be long, and the owner follows the **issue**, not the session or the
PR. So between round summaries, post on the issue at two kinds of moment:

- **A milestone** — a result the owner would want to know before the round
  ends: a method lands, a benchmark number moves, a tool turns out not to
  run here, an approach is replaced because measurement reversed it.
- **A decision point** — whenever you put a choice to the owner in the chat,
  put it on the issue too, in the same shape: context, options with their
  cost, the marked recommendation, and what happens if nobody answers
  ([`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md)).
  A choice made only in the chat leaves no record where the next reader looks.

Not every push: a push is reported on the PR. An issue update is for what a
stakeholder would act on.

Each update must be **readable on its own**, because it is read days later
without the session: status, approach in a line, findings with their numbers
and provenance, what landed, and next steps — and a link to the previous
update rather than a restatement of it.

## A sign-off on the issue becomes a record

When a requirements document is signed off on its issue
— approved, amended, rejected, deferred or cancelled — the comment is the
**evidence**, not the record. The record is a `requirement-signoff`
attestation in the `attestations` graph
(`test/attestations/requirement-signoff/<set>.attestations.json`): who
(`kind`, `id`, `actor`), `at`, `scope`, `outcome`, the `stage` it moves the
requirement set to, the `reason`, and `evidence` — the comment's permalink,
`…/issues/<n>#issuecomment-<id>`. A sign-off given in chat is quoted on the
issue first, dated, so the evidence link exists. The agent writes the record
of a person's decision; it never writes one for a decision nobody made, and
`check:requirements` refuses `approved` or `accepted` without a `human` one.

## Before you publish that something does not exist (STRICT)

An issue comment is **published**, and a false claim in one costs more than a
missing true one: it sends the next reader off to verify an accusation, and
the correction never reaches everybody the original did.

So before an issue comment, PR body or commit message asserts that a file, a
function or somebody's cited precedent **does not exist**, re-read it from the
remote — `git show origin/main:<path>` — in a command of its own, and check
the open branches when the claim is *nobody has built this*.

Grepping your checkout answers *"is this in my base"*, not *"does this exist"*,
and a `git fetch` earlier in the same compound command is not a barrier when
siblings merge every few minutes.
`bean-coordination` (opt-in `cat-harness.work-plan`) §"Re-derive from the REMOTE" has
the two guards. For the third case, a path that exists
only on an open PR's head, ask the
`open-work-lookup` Tool (opt-in `cat-harness.work-plan`, `work-plan/tools/open-work-lookup/`).

## When the work has a BEAN and no issue (STRICT)

> **A round summary is owed either way. With no issue, it goes on the change
> proposal AND into the work item — the work item is the durable artefact a sibling
> reads, and a summary that exists only in a PR thread is invisible to the work
> plan on `main`.**

**And a work item that has an issue carries the link BOTH ways**: a reader arriving
at either object has to be able to reach the other, and a check reports the
ones that cannot.

When to open an issue at all is [`crdm-detect`](../../../skills/process/crdm/crdm-detect.md)
§"Issue association" — **scan before creating one, and never create one without
permission**. This section is about what is owed once the work exists, not
about manufacturing an issue for every work item.
