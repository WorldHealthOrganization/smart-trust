---
name: bean-blocking
description: >
  Default to non-blocking when updating a work item's status. Mark blocked only
  when the work genuinely cannot proceed, and then always with what it waits
  on, when the wait expires, and what the next agent should do.
consulted: true
---

# Blocking is a claim about the work, not a mood

`blocked` is the most expensive status a work item can carry, because a blocked work item
**stops being work anyone can pick up** — and unlike a failure, nothing ever
tells you it went stale.

## Default to non-blocking

Before setting `blocked`, ask whether the work is genuinely stopped or merely
*awkward*. These are **not** blocking:

- **Waiting on CI.** End the turn; the result wakes you.
- **Waiting on review.** The PR is the artefact; other work continues.
- **Waiting on a decision you have not yet asked for.** Ask, then continue on
  the parts that do not depend on the answer.
- **Part of the task is unclear.** Do everything that does not depend on the
  unclear part, and state the assumption for the rest.
- **You would rather do something else first.** That is ordering, not blocking.

The test: **is there any remaining work on this work item that could proceed right
now?** If yes, it is not blocked — it is in progress with a question attached.

## When it really is blocked, say four things

A bare `blocked` tells the next agent nothing except not to bother. Carry:

| field | why |
|---|---|
| **what it waits on** | so a reader can tell whether the thing has since happened |
| **since** | so staleness is visible |
| **expires** | a timeout, after which the block is presumed stale |
| **handoff** | what a *different* agent should do on picking it up |

### Write it as a `## Blocked on` section — NOT as a status

```markdown
## Blocked on

- **waits on:** the Tools-schema carrier decision
- **since:** 2026-09-18T17:20Z
- **expires:** 2026-09-20T17:20Z
- **handoff:** if no answer by then, proceed with the JSON-LD carrier as
  recommended and note the assumption in the PR body.
```

The work item's `status` stays `in-progress`. **`status: blocked` does not exist**:
`beans update --status` accepts only `in-progress`, `todo`, `draft`,
`completed` and `scrapped` (`schemas/tools/tool-types.ts` lists the same
five). A prescribed form the tool refuses can never be followed, and a block
written only in prose has no date that can expire.

**`expires` is an ABSOLUTE timestamp, not `+48h`.** A relative offset has to be
read against `since` by whoever finds it, which means a stale block stays
arguable; a timestamp is either in the past or it is not. `check:bean-blocks`
enforces the four fields on any work item carrying this heading.

### An external block's expiry is a RE-ASK date, not a takeover date

A work item waiting on an external party (a standards body finalising a model, for
example) has no honest date on which an agent should "take that over" —
inventing one would fabricate someone else's schedule. So an expiry answers *"when should somebody look at this again"*, and the
**handoff says which kind it is**:

- a block on work inside this repository → on expiry, take it over;
- a block on an external party, an owner ruling, or another work item → on expiry,
  **re-raise and move the date out**, saying so.

Both are checkable, and neither lets a work item sit forever unexamined. What the
gate refuses is an expiry that is *absent*, not one that gets extended with a
reason.

**The expiry is the part that matters.** A block with no expiry is
indistinguishable from abandoned work. An expired block is a *signal* to act on
its handoff — take it over, or re-raise it — rather than a work item quietly sitting
forever.

## Prefer sub-beans to blocking

Most blocks are really "one part of this is stuck". Split it: the stuck part
becomes a child work item carrying the block, and the parent stays in progress.
That keeps the work pickup-able and makes the actual dependency legible instead
of hiding it inside a status.

Sub-beans are also what make parallel work possible without a swarm — see
`swarm-management.md` before deciding you need one.

## Never

- **Never mark a work item blocked to end a turn tidily.** If you are stopping for
  the day, the work item is still in progress; say so in the report.
- **Never leave a block without an expiry.** If you cannot say when it goes
  stale, you have not established that it is a block.
- **Never block on something you have not actually asked for.** Asking is the
  work; waiting to be asked is not a dependency.
