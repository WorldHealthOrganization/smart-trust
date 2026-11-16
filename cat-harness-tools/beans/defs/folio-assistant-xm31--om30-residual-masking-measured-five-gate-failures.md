---
# folio-assistant-xm31
$schema: bean/1.0.0
title: 'om30 residual masking MEASURED: five gate failures on main that CI has never reported'
status: completed
type: task
priority: normal
created_at: 2026-09-26T14:46:29Z
updated_at: 2026-09-26T19:34:10Z
parent: folio-assistant-1xhc
---

`om30` recorded a KNOWN LIMIT rather than implying it: the gates-job split took
the masked region from 45 steps to 6, not to 0, and "local evidence says all six
pass today" was explicitly a fact about that day's tree rather than a property of
the arrangement.

That fact has expired, and here is the measurement.

## What is masked today, and how it was established

main's `Repository gates` job stops at **`check:glossary`** (step 8 of 43), so
every step after it has not run in CI since `2c295f8ac06` (2026-09-26 13:51).
Five gates fail on `origin/main` right now and NOTHING in CI says so:

| gate | fails on `origin/main` |
|---|---|
| `check:subgraphs` | yes — 6 dangling links |
| `docs:auto:check` | yes — 5 stale `docs-auto` pages |
| `translation:index:check` | yes |
| `check:ci-invocations` | yes |
| `cat-harness/scripts/gen-docs-pages.ts --check` | yes — 5 stale `.md` pages |

**Method, because "it failed in my branch" would prove nothing:** each was run in
a detached worktree checked out at `origin/main` (`f850f721a06`) with only
`node_modules` symlinked at the root. All five FAIL there. None of them is any
open branch's, and none is visible from a CI run.

`check:subgraphs` is `gw8h`/#1413's six doubled hrefs, so one of the five already
has an owner. The other four do not.

## Why this is not the same finding as `om30`

`om30` was about a job whose FIRST failing step was step 2, so 45 steps never
ran. That is fixed. This is the residual: ONE red step still hides everything
behind it, and the step that happens to be red MOVES. Today it is
`check:glossary` at step 8, which masks 35 steps rather than the 6 the merge
commit predicted — because the prediction assumed the red step stays at 42.

**The masked count is not a property of the split; it is a property of WHICH step
is red.** That is the correction `om30`'s "45 -> 6" needs, and it is why the
number cannot be quoted from a commit message.

## What lands with #1405

#1405 regenerates the three kg-skills glossary artefacts, which turns
`check:glossary` green. So merging it UNMASKS the five above: CI will start
reporting failures that have been there and silent. That is the gate working,
not a regression #1405 introduced, and it is stated here in advance so nobody
reads the first red run as its fault.

## Done when

- [x] the owner has decided whether the remaining steps get `continue-on-error`,
      a second split, or nothing — **MOVED to `cpss`**, which measures the same
      thing correctly (108 checks, not 6 steps) and carries the two candidate
      fixes. Not decided here; decided there.
- [x] the four unowned failures each have a bean or an owner — all five fixed by
      #1414, #1410 and #1413


## The five are fixed — by a sibling, within the hour (2026-09-26)

#1414 (bean `1h6u`, \"make main green — docs pages, indexes and harness.json
regenerated\") and #1410 (`lvw0`) landed, and `gw8h`/#1413 closed. Re-measured on
main merged into this branch, all five PASS:

    check:subgraphs            PASS
    docs:auto:check            PASS
    translation:index:check    PASS
    check:ci-invocations       PASS
    gen-docs-pages --check     PASS

Closed on EVIDENCE rather than authorship, per `bean-coordination`: none of this
is my work and the beans that did it are the siblings' to close.

**Two of the four I called unowned already had beans I had not found** — `k3tw`
(\"gate red on main: docs/_data/translations.json is stale\") is
`translation:index:check`, and `1h6u` covers the docs pages. That is `dx5j` again,
one level down: I measured five failures and could not tell which were already
somebody's, because nothing indexes a failing gate to the bean about it.

## What stays open, and it is the part that is not about today's tree

The general finding is unaffected by all five being green: **the masked count is a
property of WHICH step is red, not of the split.** `om30`'s merge commit said 6
steps were masked because it assumed the red step stays at 42; hours later it was
step 8 and 35 steps were masked. Today it is step 42 again and 6 are skipped. That
number will move again at the next unrelated red.

So the owner decision below is the whole remaining content of this bean.

(The resolution above is recorded against this bean's ONE `## Done when` list at
the top, ticked in place. A second ticked list is the `check:bean-bodies`
shadow-checklist defect — the same one this session already paid for on `om30`,
made again here.)


## The step number moved 42 -> 44 under an unrelated change — 2026-09-26, 18:59

Direct confirmation of this bean's thesis from a run that had nothing to do with
it. On `168d5ed926a` (a branch carrying one skill edit and two beans, with main
merged in), `Repository gates` reports:

    steps 6-43   ALL SUCCESS — including two gates main had just added:
                 step 22  no rendered label shows a character reference as literal text
                 step 43  translated pages' links resolve at their own depth
    step 44      gates that were registered and never run   ← the ONLY failure
    steps 45-50  skipped

**The drift gate was step 42 this morning and is step 44 now**, because two gates
were inserted ahead of it. The masked count happens to still be 6, so a reader
comparing only the number would conclude nothing had changed — while the masked
SET has a different identity and a different first element.

So the thesis holds in both directions: the count moves when the red step moves
(35 masked this morning at step 8), and the *set* moves when the gate list grows
even though the count does not. **Neither number is a property of the split.**
That is the whole argument for the owner deciding the arrangement rather than
anyone quoting a figure from a commit message.

## SUPERSEDED by `cpss`, and my unit was wrong — 2026-09-26 19:35

A sibling opened `cpss` at 18:09 on exactly this subject and measured it properly.
**I counted STEPS. The unit that matters is CHECKS.**

Verified here independently from `.github/workflows/code-quality-gates.yml`, not
taken on their word:

    the step "gates that were registered and never run"   line 928
    commands inside that ONE step                         106
    position of translation:drift:check in that batch      3

It is a `set -e` batch, so **103 gates inside the failing step never run**, on top
of the five or six steps after it. `cpss` puts the total at 108.

So every number this bean and `om30` published was the smaller half:

| claim | unit | what it missed |
|---|---|---|
| `om30`: "45 -> 6" | steps | the batch inside the failing step |
| this bean: "35 masked at step 8" | steps | same |
| this bean: "42 -> 44, count still 6" | steps | same |

The observation this bean adds is still true — the step number moves under
unrelated changes, so no figure is stable — but it is a small point beside 103
gates that cannot fire. **And `cpss` made the identical mistake first and corrected
itself in place**, from 6 to 108, having published the smaller number twice. Two
sessions counted steps because steps are what the CI UI shows; the batch is only
visible by reading the YAML.

The one that proves the cost is theirs, not mine: **"translation index is current"
is masked by the translation drift**, and a stale `docs/_data/translations.json`
was found and fixed BY HAND the same day in #1408 while CI reported green. The gate
existed the whole time.

**Seventh collision of the day**, and found by the `dx5j` re-check rather than by
luck — the search before opening a PR returned main's new bean.

Closing this on evidence: its own findings (the five failures, all since fixed; the
step-number instability) are recorded, and its open decision is better posed on
`cpss`, which is `priority: high` and unclaimed. Not claiming or resolving theirs.
