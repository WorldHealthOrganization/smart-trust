---
# folio-assistant-dx5j
$schema: bean/1.0.0
title: Nothing indexes a defect to the beans and PRs describing it — three duplicate-work collisions in one window
status: completed
type: bug
priority: normal
created_at: 2026-09-26T14:32:59Z
updated_at: 2026-09-26T17:52:18Z
parent: folio-assistant-1xhc
---

## What was measured, 2026-09-26

Three duplicate-work collisions in one working window, each found only because
somebody happened to read a sibling's PR:

| defect | named as | and also as | how it was found |
|---|---|---|---|
| CI's gates job masked its own steps | `om30` (#1390) | `m5gx` (#1401) | #1401 opened a near file-for-file duplicate ~3h after #1390 |
| the fast gate set was hardcoded | my offer to port #1401's `installsBrowser()` | #1403, a sibling's own PR | listing open PRs while working something else |
| #908's two dependency bumps | #1405 | `x89e` (#1407) | listing open PRs while working something else |

The third one cost measurable work in both directions and is the clearest case:
#1407 caught that `cat-harness/adapters/mcp-server/bun.lock` was stale at
`@anthropic-ai/sdk ^0.80.0` and I did not, and my bump WIDENED that gap by moving
the manifest to `^0.127.0` while leaving the lock; #1405 caught that a playwright
1.63 bump turns main's e2e red without a navbar fix and #1407 did not. Neither
session could have known without reading the other's PR by hand.

## Why the existing mechanisms do not cover it

- **`beans:claim` is branch-local.** `bean-coordination` already says a claim
  ANNOUNCES rather than reserves until the PR exists. Both these sessions claimed
  correctly. The claim was not the failure.
- **A bean id does not appear in the other session's vocabulary.** `om30` and
  `m5gx` describe one defect; nothing relates them, and neither title contains a
  word the other would have searched for.
- **`gh pr list --search` was run in at least one of the three** and did not
  surface the sibling, because the duplicate had not been opened yet at that
  point. A one-shot check at the start of a topic cannot see a PR opened later.

So this is not "agents forgot to look". Looking once is structurally
insufficient, and there is nowhere to look that answers "what else is about
THIS".

## What would need deciding (not decided here)

- Is the index over **beans** (a `describes:` edge between beans naming one
  defect) or over **PRs** (a label, or a line in the PR body) or over neither,
  with the answer being a re-check at a second point in time rather than an index?
- Who writes the edge — the second session to arrive cannot know it is second.

Deliberately left open: this bean records the measurement and the three cases,
because proposing the mechanism is the part that should not be decided by the
session that happened to trip over it.

## Done when

- [x] the owner has chosen whether the relation is over beans, PRs, or time —
      **TIME**, 2026-09-26: a re-check at a second point, not a new relation
- [x] the re-check is written into `bean-coordination`, beside the two checks
      that skill already names — §"And ASK AGAIN before you open the PR"


## A FOURTH collision, and this one cost a wrong finding — 2026-09-26

#1407 (`x89e`) merged first, at `fb62ecdae5c`. It carried the same two bumps AND
its own navbar e2e fix — park the pointer, then wait out the close transition —
authored independently while #1405 was doing the same thing.

**Main's implementation is better than mine in three ways**, and taking it
wholesale was the only defensible resolution:

- it awaits each animation's `finished` promise rather than a CSS-derived timeout
- it FILTERS infinite animations; mine polled `getAnimations({subtree:true})` to
  empty, which on any spinner hangs for its 5s timeout and throws
- it parks at `viewport - 5` rather than a hardcoded (600, 400)

**And it falsified a finding I had already published in three places** — a commit
message, a PR comment and this session's reporting. I claimed the flat
`waitForTimeout(250)` after `page.hover` was never the hover animation's length,
on the measurement that `.fa-harness-tab__label` sits at `opacity: 0` with
`--fa-nav-text: 1` at +250ms and reaches 0.94 only at +350ms. Re-measured at the
same read point under main's settle: **`opacity: 1`**, and the test passes 5/5.
It was an artefact of my own settle, not a property of the app.

So the cost of a collision is not only duplicated effort. **Two independent
implementations of one fix produce two sets of observations, and the weaker
implementation's observations look like findings about the subject.** I had no way
to know which I was holding until the other one landed.

That is the strongest argument yet for whatever mechanism the owner chooses below:
the duplicate was not just waste, it was a source of a false claim about the
application.

## DECIDED: the relation is TIME, not a new edge — owner, 2026-09-26

Asked with four options; the owner chose **a re-check at a second point in time**:

> A session re-runs the PR/bean search before opening its PR, not only at the
> start.

No schema change, no new relation, nothing for a gate to validate. And it is the
option that addresses the measured failure rather than a nearby one: in at least
one of the four collisions the search WAS run and found nothing, because the
duplicate had not been opened yet. **An index would not have helped there. Only
asking again later would.**

The two rejected structural options are recorded rather than dropped, because each
fails in a way worth knowing:

- **an edge between beans** (`describes:`) — the second session to arrive cannot
  know it is second, so nobody is in a position to write the edge
- **a label or line on the PR** — only helps once a PR exists, which is exactly
  the window these collisions open in

### Where it goes

`skills/sdlc/sdlc-core/bean-coordination.md` §"A claim is branch-local" already says a
claim ANNOUNCES rather than reserves until your PR exists, and already names two
checks to run first. This is a THIRD check at a LATER moment, so it belongs beside
them rather than in a new section — and `AGENTS.md` is a pointer, not the home.

NOT written yet, and deliberately not bundled into the PR carrying this bean: that
PR is beans-only by the owner's decision, and a skill edit would make it something
else.

## Implemented, 2026-09-26

`skills/sdlc/sdlc-core/bean-coordination.md` §"And ASK AGAIN before you open the PR —
looking once is not enough", placed inside §"A claim is branch-local" beside the
two checks that section already names, and before `beans:claim`. It carries the
rule, the one collision that settles why it is TIME rather than an edge (the
search ran and found nothing because the sibling's PR did not exist yet), the
three rejected alternatives with why each fails so nobody re-proposes one as new,
and the observation-contamination cost.

Placement, not a new section: `AGENTS.md` is a pointer and this is a third check
at a later moment in a sequence the skill already describes. The generated
reference page and the `kg-qa` sidecar were regenerated with `skill:register`
rather than by hand — 6 artefacts current.

**One cost stated rather than hidden:** that skill was already over the corpus
p90 at 623 lines and its own QA sidecar says *"At this length it is a document"*.
This adds 42 lines. The finding is advisory and pre-existing, the addition was
trimmed once after measuring it, and splitting the skill is not something to do
in passing while implementing somebody else's decision.
