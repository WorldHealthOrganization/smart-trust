---
# folio-assistant-fjwi
$schema: bean/1.0.0
title: Where can the registration-chain check go in CI? Every placement today is masked or red on arrival
status: completed
type: bug
priority: normal
created_at: 2026-09-26T10:24:13Z
updated_at: 2026-09-26T11:23:18Z
parent: folio-assistant-1xhc
---

Split out of `v625` rather than blocking it: the command itself, its flags and
its QA sidecar all landed, so the parent has work that can proceed. What cannot
proceed without a decision is **whether the chain gets a CI gate, and where** —
because every placement available today is either masked or red on arrival.

## Why the obvious placement does not work

`skill:register:check` runs the five `--check` commands individually. That is
exactly what makes it useful locally — `bun run cat gates` masks two of them,
because `bun test` runs the `kg-audit` and `detangle` writers before their
checks read the artefacts (bean `ymsu`).

I wired it into `code-quality-gates.yml` after `kg:detangle:check`, then
measured what that would actually buy. **Nothing.** All five commands are
already their own steps in that same job:

| step | gate | also in the chain |
|---|---|---|
| 17 | glossary page and SKOS | `check:glossary` |
| 33 | knowledge-graph audit | `kg:audit:check` |
| 37 | detangle measurements are current | `kg:detangle:check` |
| 40 | generated docs are current | `docs:auto:check` |
| 45 | generated docs pages are current | `gen-skill-docs --check` |

A step appended after those can only go red in a tree where one of them is
already red — and GitHub Actions then **skips** it, since no step carries
`if: always()`. So the step is structurally incapable of failing
independently: a gate that looks like coverage and is not. The wiring was
reverted before the PR, unpushed.

## The one placement that would be real, and its cost

**Before `bun test`.** That is the only point in the job where the five
artefacts are read against the tree as checked out, unrepaired and
unmasked — a verdict no existing step produces.

It is **red on arrival**. Measured 2026-09-26 on `e53bba8028466cf8093e546a18945b1da05094a0`:
`kg:detangle:check` alone exits 1 with six stale sidecars, pre-existing (the
stale axes on `cat-harness/schemas` are `size`/`internal`/`outbound`/`cohesion`,
functions of files no branch of mine touches). The sidecars were pinned at
08:54:47Z and main moved after.

And it is red on arrival *in a way that recurs*: `v625` already records the
chain going stale again forty minutes after being fixed, and this repository
sees ~20–40 commits/hour on main across ~8 concurrent sessions. A gate pinning
generated measurements over a corpus moving that fast is red a large fraction
of the time by construction.

## Options

1. **(Recommended) Add the step before `bun test`, and regenerate the five
   artefacts in the same PR so it arrives green.** Gains the only unmasked read
   of those artefacts in CI. Cost: the PR carries generated-artefact churn, and
   the step will go red again whenever main outpaces a branch — which is the
   true state, so arguably the point. Downstream: conflicts with any open PR
   also carrying regenerated detangle sidecars. That collision has already
   happened once this session, on #1364/#1381, and was reverted on the owner's
   instruction — which is why this is not being done unprompted.
2. **Add the step before `bun test` and leave it red**, treating it like the
   `no NEW drift` gate main already carries by decision (`ngxj`, issue #206).
   Honest, and costs no corpus churn. Cost: a second standing red, and main's
   job already skips 45 gates behind the first one, so this one would sit in
   front of them and skip them all itself. **That is the fatal objection** — a
   red first step turns the existing 45-gate skip cascade into a 50-gate one.
3. **No CI step. `skill:register` stays a local command.** What ships today.
   Zero risk, and the command's real audience is the author adding a skill, who
   runs it before pushing. Cost: nothing verifies the chain in CI, so the
   `v625` recurrence is caught by the five separate gates as before — which is
   what already failed to make the cause legible.
4. **Add `if: always()` to the job's steps first**, so no gate is skipped, then
   place the chain step anywhere. Fixes the larger defect (`ymsu`'s third
   instance) rather than working around it. Cost: much bigger change, 45 steps
   affected, and a job that runs every gate after a broken `bun install` emits
   45 failures with one cause.

**Recommendation: 1.** It is the only option that produces a verdict nothing
else produces, and the churn objection is about *when* to pay a cost the repo
has decided to pay elsewhere. **Option 4 is the right fix to the wrong bean** —
it belongs to `ymsu`, and doing it there would then make option 2 viable here.

**Default if no answer:** option 3, which is what is pushed. The command is
useful without the gate and nothing regresses.

- **waits on:** the owner's choice among the four above — specifically whether a
  PR of mine may carry regenerated detangle sidecars, after #1384 reverted
  exactly that on instruction
- **since:** 2026-09-26T10:30Z
- **expires:** +72h
- **handoff:** if no answer by then, take the default (option 3, already
  pushed) as settled and close this bean as `scrapped` with that reason —
  do NOT add the gate on your own judgement, because the cost being weighed is
  a collision with other sessions' PRs rather than a technical unknown. If
  `ymsu`'s `if: always()` clause has landed in the meantime, option 2 becomes
  cheap and this bean should be re-opened rather than scrapped.

## Done when

- [ ] the owner has chosen among the four options, or the expiry has passed and
      the default is recorded as settled
- [ ] if a gate is added: it is measured red on a deliberately staled artefact
      and green on a clean tree, in CI and not only locally. MEASURED AFTER —
      a gate that has only ever been green has not been shown to fire


## RESOLVED, and the premise above was FALSE — corrected within the hour, before this bean was ever pushed

The block above says the only real placement is *"red on arrival"*, cites
`kg:detangle:check` exiting 1 with six stale sidecars, and puts four options to
the owner on the strength of it. **That measurement does not reproduce.** Kept
rather than rewritten, because the way it failed is the useful part.

Re-measured on the same commit, committed sidecars byte-identical to `HEAD`:

| | |
|---|---|
| `bun run cat kg:detangle:check` | **exit 0** — `✓ 28 pinned measurement(s) current`, three times |
| `bun run cat skill:register:check` (all five steps) | **exit 0**, and the working tree untouched afterwards |
| wall time | **13s** |

So there was never a red to arrive with, and the cost objection was wrong by an
order of magnitude too — 13s against the ~2.5min the `typescript` job takes.
Both of the things that made this a decision for the owner were artefacts of my
own measurement. Recorded on `ymsu` as its own finding: a check that answered
`stale` and `current` on one commit is a check whose verdict is not a function of
the committed tree, which is that bean's subject arriving from a third
direction.

### What was built instead of asking

**A separate job**, `skill-registration-chain` — which was not among the four
options, and is better than all of them:

- It **cannot be masked**: it never runs `bun test`, so the five artefacts are
  read against the tree as checked out. That is the verdict no existing step
  produces, and it was option 1's entire justification.
- It **cannot widen the skip cascade**, which was the fatal objection to option
  2. A separate job's failure skips nothing; a step in front of `bun test` would
  have left steps 6-50 unevaluated, measured at 45 gates on main's run
  36234052354.
- It costs **no wall-clock**, running in parallel — which was option 4's problem
  in reverse.
- It needs **no corpus churn**, which was option 1's cost and the reason this
  bean existed: nothing is regenerated, so nothing collides with a sibling PR.

`processes/code-quality-gates.bpmn` gains `Task_SkillChain` beside
`Task_Advisories` (every job in that workflow declares a `# bpmn-node:`, so a
job without a drawn element would not have been a job here), the lane bounds
extend by one row, and `render:bpmn` re-renders the one SVG.

The `SCRIPT_EXEMPTIONS` entry drafted for the un-wired case was **removed
again** before the commit: a wired gate must not also be declared exempt, and
`gates.ts` is byte-identical to `HEAD`.

### What this bean cost, and the rule it argues for

Nothing but the writing — no push, no PR, no owner interruption. That is the
cheap outcome, and it happened because the premise was labelled as a measurement
with a named commit, so it was falsifiable in one command. The expensive version
of this bean is the one that says "the baseline is red" without saying how it was
measured: nobody can re-derive it, so the four options get answered instead of
the premise.

**Re-measure the premise before escalating, not after.** Four options and a 72h
expiry were drafted over a number that took thirteen seconds to check.

- **waits on:** nothing. The block above is withdrawn.

## Done when

- [x] the placement is decided — a separate `skill-registration-chain` job,
      measured green and unmasked, no owner decision needed
- [x] the false premise is corrected in place rather than removed
- [ ] the job is green in CI on this PR, not only locally. MEASURED AFTER — a
      gate that has only ever run on one laptop has not been shown to run


## CLOSED — the job is green in CI, and its first run earned its place

`Skill-registration chain, unmasked (hard)`: **success, 9s**, run 36238414800 on
head `34f95b9564`. The last open clause is satisfied by a run on a fresh runner
rather than by a laptop.

It is worth recording what the first run bought, because the case for this job
was theoretical when it was written and is not any more. It went **red**, and the
defect was not in the chain:

`kg-detangle.ts` read the DISK rather than the git corpus, so
`cat-harness/schemas/block-qa-schema/node_modules/` — 2719 gitignored files —
counted as graph nodes wherever a gate had built that subpackage.
`cat-harness/schemas` was committed at **1441** nodes; a clean checkout computes
**227**. A six-fold overcount, pinned in `main`'s sidecar and copied into the
generated UML overview pages.

Nothing had caught it because `kg:detangle:check` is step 37 of the `typescript`
job and has been **skipped, not run** behind main's accepted `bun test` red —
the 45-gate cascade. **This job is the first thing that ever evaluated it**,
which is precisely the property the four options above were weighing, and the
reason option 3 (no gate) would have been the wrong default even though it was
the safe one.

So the bean's own conclusion inverts twice and lands where it started: the
placement question was real, my "red on arrival" premise for it was an artefact,
and the gate that resulted was red on arrival anyway — for a reason worth having
found.

Done when:

- [x] the owner has chosen among the four options — not needed; the premise that
      made it a decision dissolved, and the answer was a shape none of the four
      described (a separate job)
- [x] the false premise is corrected in place rather than removed
- [x] the job is green in CI on this PR, not only locally — run 36238414800
