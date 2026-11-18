---
# folio-assistant-cpss
$schema: bean/1.0.0
title: The deliberately-red drift gate masked 104 checks from inside a `set -e` batch — moved to last, and enforced
status: completed
type: bug
priority: high
created_at: 2026-09-26T18:09:12Z
updated_at: 2026-09-27T05:14:00Z
parent: folio-assistant-1xhc
---

Measured while fixing an unrelated finding (bean `9x01`), so the population below
is exact and the recommendation is not.

## What is unreachable

`.github/workflows/code-quality-gates.yml`, job `gates`: **46 steps**, and the
step named *"gates that were registered and never run"* is **step 40**. A job
stops at its first failing step, and that step's batch contains
`translation:drift:check`, which is **deliberately red** — the owner's decision,
bean `ngxj`, issue #206, after #1364 merged 25 `UNCATALOGED` entries and #1384
reverted them.

So six steps have not run on any PR, or on any push to `main`, for as long as the
drift has been red:

| line | step |
|---|---|
| 1446 | generated docs pages are current — **moved above the batch by this bean's sibling change** |
| 1460 | voices projection and viewer are current |
| 1471 | folio projection and viewer are current |
| 1483 | viewer pages keep the navbar they had |
| 1496 | handler namespace index is current |
| 1538 | translation index is current |

Five remain below it.

## The one that proves the cost

**"translation index is current" is masked by the translation drift.** The gate
that would catch a stale `docs/_data/translations.json` cannot fire while the
catalogues are missing — and a stale `translations.json` was found and fixed BY
HAND earlier the same day (#1408), after CI reported green on the branch that
carried it. The gate existed the whole time.

That is the argument that this is not a tidiness issue: a deliberately-red gate
does not cost one red check, it costs every gate after it, and the ones after it
are not chosen — they are whatever happens to be later in the file.

## Prior art, and why this is not `fjwi`

`fjwi` (completed) asked *"where can the registration-chain check go in CI? Every
placement today is masked or red on arrival"* and answered it for ONE gate, by
measuring that every placement available bought nothing. It brushes this problem
and does not state it: its subject is where a specific new gate belongs, and its
conclusion is about that gate. **This bean's subject is the six steps already
registered in the masked region**, which `fjwi` neither counted nor named — and
the count is the argument, because six is not a placement question, it is a
standing hole.

Worth reading together: `fjwi`'s step numbers (17, 33, 37, 40, 45) are from the
same job and show the masked boundary from the other side.

## Precedent, twice in this file already

- `om30` is named in the file's own comments as the original instance.
- `ee964c7411` (merged 2026-09-26) moved `translated-links:check` above the batch,
  with the comment *"ABOVE the drift gate DELIBERATELY. It was first registered
  below it"*.

So the convention exists. What does not exist is anything that ENFORCES it, which
is why the count reached six.

## Two candidate fixes, and why the second is better

**(a) Move each masked step above the batch.** What the precedent does, one step at
a time. Works, and leaves the next person to rediscover the rule.

**(b) Split `translation:drift:check` out of the batch and make it the LAST step in
the job.** A gate that is deliberately red must be last, or it masks whatever
follows. The batch's other ten gates keep their place; the six unmask at once; and
the invariant becomes structural rather than remembered.

I did (a) for the one step my own change touched and stopped there: restructuring
five gates that are not mine is the owner's call, not a side effect of a bean about
`available_locales`.

## Done when

- [x] Decided between (a) and (b), or a third option, with the reason recorded —
      **(b)**, on the owner's instruction 2026-09-27. `translation:drift:check` is
      out of the batch and is now the `gates` job's LAST step
- [x] Every step in the `gates` job can fire while the drift is red — verified by
      reading the job's step order, not by a green run (a green run proves nothing
      here: the drift makes the job red either way). **`check:red-gate-is-last`
      reports it as step 52 of 52**, so the set it can mask is empty BY
      CONSTRUCTION rather than by a passing run — which is what this box asked for
      and why it asked for it that way
- [x] A gate refuses a NEW step registered below a known-red one, or the
      convention is written where somebody adding a step will read it — **both**.
      `check:red-gate-is-last` refuses it, and the comment above the moved step
      says why it is last and that anything appended after it re-creates the defect
- [x] falsified by breaking: registering a step below the red one must be caught —
      **17 tests**, and one control better than any of them: run against the
      workflow as it stood on `main` BEFORE this change, the check reports both
      defects independently of this bean — `shares-a-step` with **106 other
      gates**, and `not-last` at **step 46 of 51 with 5 steps following**. Those
      match the 107 invocations and 5 trailing steps measured by hand on
      2026-09-26, from a different direction


---

## Correction, 2026-09-26 18:40Z: it is not six, it is **one hundred and eight**

This bean counted the **steps** after the failing one. That was the smaller half
of the defect, and I published the smaller number twice — on this bean and in a
comment on #1420, where I wrote that the batch *"runs eleven gates"*. Both were
wrong, and wrong in the direction that makes the problem look survivable.

**The failing step is itself a batch of 106 gates under `set -e`, and the
deliberately-red one is the THIRD.**

Measured on `4c86165bdd`, `.github/workflows/code-quality-gates.yml`:

| fact | line | value |
|---|---|---|
| step `gates that were registered and never run` begins | 928 | — |
| `set -e` | 930 | no `set +e`, no `\|\| true`, no `if`, no `continue-on-error` anywhere in the block |
| `bun run` invocations in the step, all at indent 10 | 931–1418 | **106** |
| `bun run cat translation:drift:check` | 952 | the **3rd** of the 106 |
| invocations after it, which cannot execute | 955–1418 | **103** |

So the unreachable surface is **103 gates inside the step, plus the 5 whole
steps after it** — 108 checks, not 6. The five steps were only ever the tail of
it.

### Two of the 103 were shipped TODAY, by me, into a place they can never run

- **`check:workflow-injection`** (line 1185) — the `${{ }}`-into-shell scanner
  built and merged today across #1408 and #1415. `grep -rn` over
  `.github/workflows/`: **one** call site, and it is line 1185. The scanner has
  never executed in CI, on any PR or any push to `main`.
- **`check:artefact-verification`** (line 1184) — red on `main` itself until
  `4c86165bdd` declared `translated-links:check`. CI never reported that red and
  cannot report the fix; the repair is verified **locally only** (`exit 0`,
  measured 18:33Z). A sibling session found the same red the same way, by
  running `bun run cat gates` by hand.

That is the cost stated without an analogy: **a gate merged into this batch is a
gate that does not run, and its author gets a green PR saying otherwise.** The
existing entry's example — a stale `translations.json` hand-fixed after CI went
green — was one gate's worth of that. This is the general case.

### Why the recommendation gets stronger rather than changing

Still the same fix: split `translation:drift:check` out of the batch and make it
the **last step in the job**. The argument no longer rests on the five steps
being valuable, which was arguable — it rests on the batch being the place gates
get registered. `ot9a` wired 106 gates here precisely because they were declared
and run by nowhere, and `no check script is unrun` pushes every new gate into
this step to satisfy it. So the masked region is not a backwater: **it is the
default destination**, and it is downstream of a check that is red by decision.

A second measure worth considering alongside, not instead of: the step's own
name is not a diagnosis. 106 commands under one name means a red tells the
reader nothing about which gate failed, which is why the failing member had to
be identified by running candidates by hand — twice today, by two sessions.

### Provenance

Every number above is from `grep`/`sed` over the committed file at
`4c86165bdd`, counted rather than read off prose, after a control pass for
error suppression and conditionals that found none. The CI side is job
`108460536992` (run `36262379984`): step #45 fails, its log ends at
`translation:drift:check` exit 1, and steps #46–#50 are `skipped`.


---

## 2026-09-26 20:05Z — the batch went GREEN, and its first live run caught a real defect

`translation:drift:check` now exits 0. #1411 (`9rrb`) replaced the CLI's
hard-coded list of five page names with discovery from the tree — 5×5 to 13×5 —
and took drift from 36 findings to 0 new. Measured on a merged tree, not read
off the PR title.

So the 103 gates this bean counted are **live for the first time since they were
registered**. What happened on the very first run is the argument this bean was
making, in one line:

> `check:partition` — workflow line **1366**, which is **414 lines after** the
> drift gate at 952 — failed immediately, on a real omission: a script added
> hours earlier (`scripts/check-available-locales.ts`, #1431) was `unassigned`,
> with 2 import edges the tool declined to judge.

The gate was correct, the finding was mine, and it was **one command away from
being caught at any point that afternoon.** It could not fire, so it did not.
Fixed by classifying the module in `partition/instance-rules.ts`; the gate now
reports 0 unassigned and 0 wrong-direction edges.

That is the cost of masking stated without any need for analogy: **a gate in the
masked region does not merely fail to protect, it accumulates unreported
defects, and they all arrive at once when the mask lifts.** A sibling session's
commit message the same day lists `check:partition` among the gates its chosen
subset had missed — so this gate has now caught two sessions' omissions in one
afternoon, having been unable to report either.

## This bean does NOT close

The masking is **latent, not fixed.** The step is still one `run: |` block of 106
gates under `set -e`, and `translation:drift:check` is still its third member.
Nothing structural changed: the next member that goes red — deliberately or
otherwise — re-masks every gate after it, and which gates those are is still not
chosen but merely whatever happens to be later in the file.

What changed is the **price of the fix**, and it went down. Splitting
`translation:drift:check` out and making it the LAST step in the job can now be
done while the batch is green, so the change is verifiable end to end: every one
of the 106 can be observed passing before and after. Doing it while the batch was
dead meant moving gates whose behaviour nobody could see.

**So this is the moment to do it, and it is still not mine to do** — it
restructures 106 gates that are not mine, on the owner's call. Recorded here
rather than acted on.


---

## CORRECTION 2026-09-26 20:12Z — the anecdote above is wrong, and the count moved again

Two errors in the entry directly above, both mine, both published before they
were checked.

### 1. `check:partition` was NOT unreachable. It has an unmasked test twin.

I wrote that its finding was *"one command away from being caught at any point
that afternoon, by a gate that could not run."* False.
`scripts/tests/adapter-layering.test.ts:42` calls the **same** `analyse()` and
asserts `nothing is unassigned`, and it runs under `bun test` — the `TypeScript`
job, which masking never touched. CI proved it: on `f54e8c812c` the TypeScript
job failed naming that exact test, alongside the gate.

So the defect was catchable the whole time, and the real cause of its late
discovery was **mine**: I pushed after running a chosen handful of gates and
killed the full run before it reached the test phase. That is
*"a subset of the gate set is not the gate set"* — committed while writing a bean
entry about masking, which is the more useful lesson and the reason the wrong
version stays here rather than being edited away.

### 2. 106 and 103 are now 107 and 104

Re-measured by locating the step **by name** rather than by the line numbers
recorded above — which had shifted, because this branch inserted a step of its
own at line 941:

| | |
|---|---|
| step `gates that were registered and never run` | lines 944–1498 (555 lines) |
| `bun run` invocations | **107** |
| `translation:drift:check` | **#3**, line 968 |
| masked after it | **104** |
| `check:partition` | line 1366 |

One of the two is main's 39-commit merge adding a gate to the batch; the other is
that my original extraction overran the step boundary into the next step's `run:`
block. **That is the third time a count in this bean has gone stale inside two
hours**, which is the strongest available argument for its own standing rule: do
not quote a count from prose, re-derive it.

### What replaces the anecdote — a bounded measurement

For each of the 104 masked gates, whether any test file references the same
script (matched on script basename):

- **86** — a test references it. Masking removes one of two lines of defence.
- **18** — no test references it. **Masking is their only line of defence**, and
  these are the gates where a red in the batch genuinely means nothing is
  watching: `landing:data:check`, `check:declaration-claims`,
  `check:ready-to-close`, `check:waivers`, `check:artifact-index`,
  `smart-trust:pages:check`, `check:theme-art:check`,
  `check:workflow-script-paths`, `check:portable-paths`,
  `check:instance-config`, `check:avatar-instances`, `check:folio-mount`,
  `check:instance-graph`, `check:ci-invocations`, `check:schema-nodes`,
  `check:source-licence`, `check:wireframes`, `gen:jsonld:check`.

**Both numbers are bounds, not counts.** A test that merely mentions the script's
basename counts as a twin, so 86 is an UPPER bound on protection and 18 a LOWER
bound on the truly unprotected. Stated as bounds because the alternative is a
precise-looking number that a reader would take for a census — the same mistake
the entry above made.

So the cost of masking is **18 gates outright**, not 104. Smaller than I claimed,
still worth fixing, and now stated in a form that does not need retracting.

## The un-masking, OBSERVED rather than predicted

CI on `897129e7e9`, `Repository gates`, all steps green:

- step 46, the batch: **84 seconds** (20:03:44 → 20:05:08) rather than dying in
  one — so all 107 members ran.
- steps 47–51: **success**, where every prior run recorded `skipped`. Among them
  step 51, **`translation index is current`** — the gate this bean singled out,
  whose masking is why a stale `docs/_data/translations.json` had to be repaired
  by hand earlier the same day. It had never executed.

That is the whole of this bean's claim, confirmed by observation. The
recommendation is unchanged and the masking is still latent, for the reasons in
the entry above.

_2026-09-27T04:55:37Z_ — Claimed by claude/sleepy-babbage-ls90iz — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

---

## Summary of Changes — 2026-09-27, option (b) on the owner's instruction

**The batch no longer contains the gate that can empty it.**
`translation:drift:check` is out of the 107-line `set -e` block and is now the
LAST step of the `gates` job. The comment that used to justify putting
`translation:pot:check` *before* it — *"anything placed after it never runs"* —
is gone, because the thing it worked around is gone.

### Why the placement is the fix and the comment is not

Three earlier changes each moved ONE gate to just above the red one
(`ee964c7411` for `translated-links:check`, then `docs:pages:check` and
`check:available-locales`). Each was correct. None scaled: *"put your gate above
the drift check"* is a rule every future author has to be told, and the cost of
not being told is invisible — a green PR. *"The deliberate red is last"* is a
rule a file can enforce.

So it is enforced: **`check:red-gate-is-last`**, wired near the top of the same
job, asserting three separate things about every gate declared red-by-decision:

1. it is **found** — a renamed gate is a finding, not a pass, or this check
   reports clean the day its subject stops existing;
2. it occupies a step **alone** — bundling re-creates the masking INSIDE the
   step, where job-level ordering cannot see it. **This is the case that
   matters**: a check comparing only step indices would have called the original
   defect clean, because the batch step was near the end of the job;
3. its step is **last**, reported with what follows it, because "not last" is not
   actionable and "5 steps follow it, named" is.

The list of deliberate-red gates is hardcoded and one entry long. A declaration
file for a single row would be a second place to look; this list IS the check.

### The control

Run against `.github/workflows/code-quality-gates.yml` **as it stood on `main`**,
the check reports both defects without being told what to look for:

    [shares-a-step]  shares step "gates that were registered and never run"
                     of job `gates` with 106 other gate(s)
    [not-last]       is step 46 of 51 ... and 5 step(s) follow it

106 + 1 = the 107 invocations measured by hand on 2026-09-26, and the 5 trailing
steps are the five this bean named. Two independent routes to the same numbers,
which is the first time any count in this bean has been confirmed rather than
corrected.

### What this does NOT do

It does not make `translation:drift:check` green — it is green today because
#1411 (`9rrb`) replaced a hard-coded five-page list with discovery, and that is
`ngxj`/#206's subject, not this bean's. The point of the placement is that the
next time it is red, on purpose or otherwise, it costs one red check instead of
104.

Nor does it reorder the other 106. They remain one `set -e` block, so a member
that fails still masks the members after it — bounded now by that step rather
than by the rest of the job. Whether that block should be split further is a
separate question, and `check:red-gate-is-last` will say so the moment anything
in it is declared red by decision.

## The six steps HAVE now run — latent when written, STRUCTURALLY CLOSED since

> **Superseded, and by the right thing.** This section was written at 05:09Z warning
> that the six steps ran only because the corpus happened to be undrifted, and that
> one new drifted translation would hide them again — so the bean must not be closed
> on green steps alone. The holder then landed option (b) (#1436): the drift is no
> longer in the batch at all, it is the LAST step, and a gate enforces that it stays
> there. **That is the structural fix, not the lucky state**, so the warning below no
> longer applies to this bean — it applies to anyone who later moves a
> deliberately-red gate back into a batch, which is now what the new gate refuses.
> The measurement is left standing because it is the before-and-after.

Evidence appended by another session (PR #1422). **Status deliberately untouched;
this is not mine to resolve** — and as of 04:55Z it is held by
`claude/sleepy-babbage-ls90iz`, so this is addressed to them. It is written because
a reader who sees the six steps green may conclude the bean is done, which would be
the wrong reading.

**The claim above and this append collided**, which is worth one line since #1422
is the PR that implements the rule for it: their claim landed on `main` at 04:55
and this append was written at 05:09 on a branch, so the two met as a merge
conflict in this file. Resolved by keeping both, their claim first. That is
`dx5j`'s scenario exactly — the open-PR search would not have found them, because
they pushed the claim to `main` precisely *because* their branch had no PR yet
(their note says so, bean `35nj`). Two mechanisms aimed at the same window from
opposite ends, and they still crossed.

### What is now observed

`translation:drift:check` is currently **passing** — 70 compared, 0 NEWLY drifted,
0 could not be read, 0 drifted and recorded, 8 uncatalogued and recorded — so the
`set -e` batch reaches its end and every step after it executes. Measured by step
NAME in `Repository gates (hard)` on two runs (`66f5f09cab6` at 21:37Z and
`6b4c89309ed` at 04:57Z, both green):

| step | name | |
|---|---|---|
| 45 | generated docs pages are current | success |
| 49 | voices projection and viewer are current | success |
| 50 | folio projection and viewer are current | success |
| 51 | viewer pages keep the navbar they had | success |
| 52 | handler namespace index is current | success |
| 53 | translation index is current | success |

All six of this bean's population, including the one it singled out as proving
the cost — *"translation index is current"*. The batch step itself now takes **81
seconds** (21:37:43 → 21:39:04) where it previously died at its 3rd command, which
is the same fact from the other side.

### Why that does not close it

**The gate did not stop being red by decision; the corpus stopped being drifted.**
`ngxj` and issue #206 are untouched, and the 8 uncatalogued are *recorded* rather
than resolved. So the batch is green for a reason that a single new drifted
translation reverses — at which point all six steps silently vanish again, and
nothing in CI will say so.

That is this bean's own argument, now with a second demonstration: the masking is
not a state somebody chose, it is **whatever happens to be later in the file**, and
it came and went here without anybody deciding either transition. A hole that
closes by luck is still a hole.

### One partial instance of the remedy has landed

#1422 adds `translation:catalogue:check` **above** the batch, for exactly this
reason, stated in its docblock: registered below it, a check about the drift's
silence would itself be silenced by it. That is one gate placed correctly, not a
fix for the six — the ordering question this bean raises is untouched.

### A correction to a figure this bean is cited alongside

`om30` and `xm31` counted masked **steps**; the unit is **checks**. Verified
independently from the workflow: the failing step is a `set -e` batch of **106**
commands with `translation:drift:check` the **3rd**, so **103** gates inside one
step never ran. This bean's title already says 108 checks and is right; the sibling
beans' "45 → 6" and "35 masked at step 8" were the smaller half, and `xm31` has
been closed with its decision moved here.
