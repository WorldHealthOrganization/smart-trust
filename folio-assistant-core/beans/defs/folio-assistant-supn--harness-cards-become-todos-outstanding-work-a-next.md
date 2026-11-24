---
# folio-assistant-supn
$schema: bean/1.0.0
title: 'HARNESS CARDS BECOME TODOS: outstanding work, a next-action recommendation from initialisation state, and health badges'
status: todo
type: task
priority: normal
tags:
    - rehomed
created_at: 2026-09-20T15:07:23Z
updated_at: 2026-10-31T22:45:00Z
parent: folio-assistant-yj32
---

Owner, 2026-09-20, answering the four options put to them — first "2+ 2",
corrected immediately to:

> 2+3 + recomend....

and, in the same breath:

> recommendatio on what to do based on curent state of where harness go to in
> its intialzaiton. would also have harness health check badges.

## What was chosen

**Option 2 AND option 3, together**, plus a third thing neither option had:

| part | what it means |
|---|---|
| **2** | the harness card stops carrying brochure copy — scope, RTFM links, *"The documentation you will never read"* — and carries that harness's OUTSTANDING WORK instead |
| **3** | the card IS a todo sticky: same visual treatment, same status and priority affordances, not an info panel styled to match |
| **+ recommend** | it says WHAT TO DO NEXT, derived from how far that harness got in its INITIALISATION |
| **+ badges** | harness health-check badges on the card |

So the landing page stops describing the repository and starts showing its
state: per harness, where it got to, what is outstanding, and whether it is
healthy.

## Two blockers, both measured 2026-09-20, and both are "the data does not exist"

**1. Nothing records where a harness got to in its initialisation.**
`beans/workflows/` — the declared `workflow-state` graph, one JSON per running
BPMN instance, committed so a sibling session sees the same position — is
**EMPTY**. `bootstrap/workflows/initialize-harness.bpmn` is the process an
Initiator starts, and no instance state for it exists. So "current state of
where harness got to in its initialization" is not a question anybody can
answer today.

That is the same shape as `v1hw`'s uningested badge: the widget is easy and
the RELATION it displays has never been written down. A recommendation
computed from absent state would be a confident sentence about nothing.

**2. Health checks are repository-wide, not per harness.** `bun run cat health`
has five checks — staging-preview-size, staging-preview-orphans,
repository-size, bean-store, todo-store — and every one is about the
REPOSITORY. `check:ci-health` is per-workflow on the default branch. Neither
is per-instance, so "harness health check badges" needs a per-harness health
notion that does not exist yet. Note the bean-store and todo-store checks are
the closest, and they are still global.

**Neither blocker is a reason to defer the bean** — they are the bean. The
card is a rendering of two facts that must first be made recordable.

## The rule this must not break

`health` **reports and never acts**, and four of its five findings name
something a PERSON does. A badge is a report, so that holds. But
"recommendation on what to do" is one step from an action, and the moment a
card offers to do the thing it recommends it is subject to
`deletion-requires-confirmation` and the rest — the card may say what should
happen; it may not decide that it happens.

## Depends on

- `5y4b` — todo stickies carrying theme art. If the harness card IS a todo,
  these stop being two designs and become one, so do `5y4b` first or together.
- `7po1` — `workflows/state` owning the beans+todos skills; the empty
  `beans/workflows/` is that bean's territory.
- `hfkl` — bootstrap's exemption. Bootstrap gets a card like everyone else,
  and its "health" is whether its `.json`/`.jsonld` exists, since that is what
  its existence means.
- `slw1`, `v1hw` — same "record the relation before rendering it" shape.

## Done when

- [x] Initialisation position is recorded per harness and readable
- [x] A per-harness health notion exists, distinct from repository health
- [ ] The harness card is a todo sticky carrying outstanding work, a
      next-action recommendation, and health badges — and recommends without
      acting

## `aazi` computes the same fact on a different surface

The root README dashboard (`aazi`) needs "initiated / partially initiated" per
instance — which is this bean's blocker exactly: where an instance reached in
`initialize-harness.bpmn`, with `beans/workflows/` empty. **Whichever lands
first should record the relation; the second consumes it.** Two surfaces
computing process position independently is how they start disagreeing.

---

## RE-MEASURED 2026-09-21 — blocker 1 still holds, but not for the stated reason

`beans/workflows/` is **no longer EMPTY**. It holds two committed instances,
both `$schema: "folio-workflow-instance/v1"`:

| instance | process | status | `bean` |
|---|---|---|---|
| `crdm--folio-assistant-6lb8` | `Process_CRDM` | running | `folio-assistant-6lb8` |
| `crdm--issue-607-kg-to-cdn-portal` | `Process_CRDM` | running | `folio-assistant-xies` |

**The blocker survives the correction, narrowed.** Neither instance is
`initialize-harness.bpmn` — both are the CRDM requirements process. So *"where
a harness got to in its initialization"* still has no answer, and this bean's
conclusion is unchanged.

But the REASON matters for whoever picks it up: the store works, the schema is
real, and instances are being written and committed. What is missing is that
nobody has run the initialisation process under the engine. That is a much
smaller gap than "the data does not exist", and it fails differently — an
`initialize-harness` instance would appear the first time one is started,
without any new mechanism.

Recorded rather than left, because a blocker stated more broadly than the
evidence supports is one the next agent takes as impassable.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). Harness cards and next-action recommendations are harness-side. The `beans/workflows/` instances it reads no longer exist in any clone. Design it together with `v49e`. None of it lives in
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
`beans/defs/folio-assistant-supn--*.md`), which is open there. Work it there.
This copy stays open as a pointer, and closes when that one does.


_2026-10-24T08:58:00Z_ — Re-measured, not claimed (https://claude.ai/code/session_01WJw1NBGSTLWvBnyQzJHXjx).
- **Box 1 still unmet.** `beans/workflows/` now holds 12 instances: code-change-review, crdm, merge-train and sampleimport. None of them is `initialize-harness.bpmn`.
- **Box 2 still unmet.** No health check is per-instance.
- **Box 3 now collides with an owner pause.** On 2026-10-24 the owner paused todos and sticky notes, saying "they should be the same thing, that's part of the problem" (bean `95sk`, R29). This box makes the harness card a todo sticky, so it waits on that merge too.
Left `todo`.

## 2026-10-24 — owner ruling: boxes 1 and 2 now, box 3 paused

The owner tapped option A, "Boxes 1-2 now, box 3 paused", at 14:04Z (card in the
"Drain folio-assistant-core beans" thread, https://claude.ai/code/session_01MK9nZ3Gmon4cDBRLSURizU).
Boxes 1 (setup position per harness) and 2 (per-harness health) may be worked now.
Box 3 (the card as a todo sticky) waits until the owner unpauses todos and stickies (95sk R29).
That thread takes boxes 1 and 2 after 0exf.

_2026-10-24T14:50:00Z_ — Boxes 1 and 2 claimed by the "Drain folio-assistant-core beans" thread (https://claude.ai/code/session_01MK9nZ3Gmon4cDBRLSURizU), per the owner ruling above. Box 3 stays paused.

## 2026-10-24 — owner ruling: work it out at publish time (boxes 1 and 2)

The owner tapped "A. Work out at publish time" at 14:31Z (card in the "Drain folio-assistant-core beans" thread, https://claude.ai/code/session_01MK9nZ3Gmon4cDBRLSURizU). A Tool runs bootstrap-tools' read-only setup check (`init.ts --dry-run --offline`) on every mounted harness at site build, and publishes one state file per harness: its setup steps, the next step to take, and health badges (setup steps done of the total, plus that harness's own `health --instance` verdict). Nothing is committed, so nothing goes stale or drifts between bean copies.

_2026-10-24T15:00:00Z_ — Boxes 1 and 2 built (Drain folio-assistant-core beans thread):
- cat-harness-tools#766: `bun run cat harness:state` — bootstrap's setup check, offline and dry-run, one `folio-harness-state/v1` file per harness (position, next step, badges `initialization` and `repository`).
- cat-harness branch `claude/supn-harness-state-tool`: the Tool definition; its PR opens once #766 merges (`check:tools` needs the script).
- folio-assistant branch `claude/supn-harness-state-deploy`: the deploy line; its PR opens once the index pins tools at or after #766.
First run on the composed index: every harness reports, and several layers have declared directories that are absent (e.g. `test/health/results/` in cat-harness, core and who-iris).

## Progress 2026-10-29

cat-harness-tools#766 (harness:state, boxes 1-2) merged 2026-10-29. Left: the cat-harness Tool definition and the folio-assistant site-build line; box 3 stays paused with todos/stickies. (Lane B drain thread.)

_2026-10-30T12:00Z_ — Boxes 1-2 are in draft PRs cat-harness#711 (Tool definition) and folio-assistant#2724 (deploy line), tracked by issue cat-harness#712. Order: merge #711, re-pin, merge #2724. Box 3 stays paused (95sk R29). (https://claude.ai/code/session_01Qmmkt7iaCtGYwZbW9x7eYe)


_2026-10-30T17:55:00Z_ — Boxes 1 and 2 done: [litlfred/cat-harness#711](https://github.com/litlfred/cat-harness/pull/711) (the `harness:state` Tool) merged 12:41Z, and [litlfred/folio-assistant#2724](https://github.com/litlfred/folio-assistant/pull/2724) (the site-build line) merged 12:46Z. Box 3 stays paused by the owner's 2026-10-24 ruling (todos and stickies, `95sk` R29), so this bean stays in progress with nothing to do until that pause lifts. (Thread "Fix publish failure and orphan beans", https://claude.ai/code/session_01Qmmkt5bHqcmhAXH3s3z4s5)

_2026-10-31T22:45:00Z_ — Status set to `todo` (bean drain tidy-up, sibling S3, https://claude.ai/code/session_01Qmmkt5KrQTMk55GWX1YUtj). Boxes 1 and 2 are done (cat-harness#711, folio-assistant#2724). Box 3 is the only work left, and it waits on the owner's pause of todos and stickies (`folio-assistant-r29x`, R29, which is `todo`), so nobody is working this bean. Pick it up when R29 is unpaused. Also removed a second copy of the four 2026-10-24 sections that had been pasted twice; the first copy is unchanged.
