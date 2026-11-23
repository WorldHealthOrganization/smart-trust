---
# folio-assistant-om30
$schema: bean/1.0.0
title: 'MAIN''S RED-BY-DECISION TEST MASKED 151 GATE INVOCATIONS, lint and tsc among them: bun test was step 2 of 47 with nothing continue-on-error — SPLIT, owner''s choice'
status: completed
type: task
priority: normal
created_at: 2026-09-26T09:42:57Z
updated_at: 2026-10-07T18:03:00Z
parent: folio-assistant-1xhc
---

## What

`main`'s `typescript` job fails at **step 2 of 47**, and GitHub Actions stops a job
at its first failing step. So every later step in that job does not run — and on
`main` that failure is red **by the owner's decision**, not by accident.

Measured on `.github/workflows/code-quality-gates.yml` at `74f27e4c7fb`:

| | |
|---|---|
| `bun test` | step 2 (line 234) of the `typescript` job |
| steps after it in the same job | **45** |
| `bun run` gate invocations inside those steps | **113** |
| steps carrying `continue-on-error` or `if: always()` | **0** |

Confirmed from the log rather than inferred. Run `36231943911` (main's head):
`11790 pass, 44 skip, 1 fail`, the single failure being
`the real corpus … > no NEW drift, and nothing unreadable`, then
`##[error]Process completed with exit code 1` and straight to `Post job cleanup`.
Nothing between them.

**This is not a hypothetical.** The five most recent `code-quality-gates` runs on
`main` all conclude `failure`, and `check:ci-health` reports the workflow
*"last failed 0d ago; file changed since — stale, not green"*.

## Why it matters more than the drift it hides

The drift being red on `main` was a decision with a stated reason: the owner wants
real `.po` catalogues from the `t8g3` campaign, not a record of their absence
(#1364 recorded 25 `UNCATALOGED` entries, #1384 reverted them forty minutes later).
That decision is not in question.

What was never decided is its **side effect**: while that one test is red, CI
answers nothing about 113 other gate invocations on `main`. A green-looking
repository and a repository whose gates were never asked are indistinguishable
from outside, which is bean `xom7`'s shape — *a red workflow looks exactly like a
green one from in here* — one level down, at the STEP rather than the workflow.

## The proof that it is already hiding a real defect

`kg:detangle:check` is **line 663** — inside the masked region. Bean `xd1g` records
the defect it would catch: `cat-harness/schemas`'s pinned `size` is committed as
**1441** where the git-tracked answer is **227**, because `kg-detangle` walks the
filesystem with no gitignore awareness and counted 1214 files of
`block-qa-schema/node_modules` and `dist/` as knowledge-graph nodes.

And the ordering makes CI the *only* place it could have been caught:

- `kg:detangle:check` — line **663**
- `check:published-packages`, which runs `bun install` inside that package — line **823**

A runner reaches line 663 with no nested `node_modules`, so it computes 227 against
a committed 1441, `size` is a `PINNED_FIELDS` member, and `--check` exits 1. **Local
runs cannot reproduce that** — a developer container has the install, so a bare walk
there agrees with the poisoned value. CI was the one instrument positioned to see it,
and it has not run since the drift went red.

Provenance, from `git log -L` on the sidecar: `size` went **225 → 1440 in one
commit**, `4ee67fd2f33` — *"rsi6: the only package this repo publishes did not build
— and four scanners broke proving it."* The commit that fixed four ignore-blind
scanners poisoned a fifth's pinned measurement, and the step that would have said so
was already unreachable.

## Options, none of them chosen here

1. **Split the job** — `bun test` in its own job, the 45 gate steps in another, so a
   red test and an unasked gate are different facts.
2. **`continue-on-error` on the known-red step only**, with the job's conclusion
   derived at the end. Keeps one job; needs the final verdict to stay hard.
3. **Quarantine the drift assertion with a written expiry**, so `bun test` is green
   and the rest runs. This is the one to be careful of: it is close to *skip a test
   to get green*, which this repo forbids — the difference would have to be a dated,
   owner-approved exemption naming the campaign, not an agent's judgement.
4. Leave it, and accept that `main` is unmeasured on 113 invocations until `t8g3`
   lands.

(1) is the only one that changes nothing about what is asserted. But it re-shapes a
gating workflow, so it is the owner's call and not an agent's.

## Done when

- [x] The owner picks among the four, or names a fifth — **split the job**, 2026-09-26
- [x] Whatever is chosen, a red step and an unrun step are distinguishable in CI
      output — 48 individually-concluded steps where there were 47 behind one
- [x] The `xd1g` detangle poisoning is fixed, and the fix is verified by a run that
      actually reaches line 663 — `detangle measurements are current` is step 35 of
      the new job and PASSED on `6f1e445f43e`. Before the split nothing could reach it.
- [x] Re-check whether any OTHER gate in the masked region is red — **five were.**
      `tsc` and the t8g3 drift are main's; `check:glossary`, `kg:audit:check`,
      `check:lockfile-pinning` and `docs:auto:check` were mine, all fixed.
- [x] The residual **6** steps behind step 42 — the drift gate wants its own job, the
      same shape as the decision above. **It does not want one.** Measured 2026-09-27
      on `origin/main` `63a465674a2`: **0** steps sit behind either deliberate-red
      step — `translation:drift:check` is 55 of 55, `bun test` is 6 of 6 — and
      `check:red-gate-is-last` enforces it, so this is a property of the arrangement
      rather than of today's tree. Section below for the method and the scope.
- [ ] **MOOT, 2026-09-30 — bean `1hjm`: the queue cannot go on here.** Kept unchecked rather than deleted because it becomes live again if the repository moves under an organization. **OWNER ONLY:** if the merge queue (`nytj`'s last box) goes on, BOTH check names
      must be required — `TypeScript — tests, lint, types (hard)` and `Repository
      gates (hard)` — or 150 gate invocations run and block nothing.


## The mechanism, pinned to a timestamp — it is ORDER-dependent within ONE run

Measured in this container, not reasoned about. `cat-harness/schemas/block-qa-schema/`:

    node_modules/   created 2026-09-26 09:30:30
    dist/           created 2026-09-26 09:30:31

**Both were created by a gate, partway through a `bun run cat gates` run.** So inside a
single run the corpus CHANGES underneath the gate set: everything before that instant
scans 227 tracked files, everything after scans 1441.

Two consecutive runs in the same container, same commit, demonstrate it:

| run | `bun test` wrote | guard report |
|---|---|---|
| first (residue absent at start) | `size: 227` into the committed sidecars | **6 detangle sidecars mutated** — a true positive |
| second (residue now persists) | nothing | no detangle mutation |

So a pinned measurement whose value depends on whether an earlier gate in the same
run has already installed something is not a measurement of the repository. And the
committed 1441 is only self-consistent in a container that has ALREADY run the gate
that creates the residue — which is why every local re-run after the first agrees
with it and a fresh runner would not.

## Correction to my own instrument, found in its first live outing

The second run's guard report is a **false positive**, and I caused it:

    · bun run cat check:fallback-roles        wrote     ("??")  beans/defs/…om30….md
    · bun run cat translation:block-qa:check  reverted  (was "??")  beans/defs/…om30….md

Neither gate touched that file. I created this bean and then committed it **while the
gates were running**, so `git status` went `??` → absent and the guard attributed
each transition to whichever gate was mid-flight. That is exactly the case
`gate-tree-guard.ts`'s own docblock documents under *"Known limitation: do not run
git WHILE the gates run"* — written because the session building it nearly did this.
It then did it, one day later.

The limitation is real and the docblock's reasoning for not defending against it
stands (voiding the run is worse). But the report gives a reader no way to tell this
case from a true one, and two innocent gates are named. Worth a follow-up: the guard
could record `.git/HEAD` plus the index mtime alongside each snapshot and SAY
"attribution unreliable — the repository moved mid-run" without voiding anything.
That is a third state, not a defence, which is the shape this repo already prefers.

## Verdict on this branch, for the record

`bun run cat gates` — **2 of 154 failed**, verified by NAME: `bun test`
(`no NEW drift, and nothing unreadable`) and `translation:drift:check`. Both are the
same `t8g3` drift that is red on `main` by the owner's decision. `uml:overview:check`
green. Nothing on this branch fails that main does not.


## The masked defect is FIXED; the masking is not (2026-09-26)

`xd1g`'s detangle poisoning is repaired — `kg-detangle` asks git, and
`cat-harness/schemas` reads **229** rather than a committed 1442. So the third
`## Done when` box below is ticked *as a fix*, but **not as a verification**, and the
difference is this bean's whole subject:

**Nothing has yet confirmed the fix on a runner that reaches line 663.** It cannot,
while `bun test` fails at step 2. The fix was verified by running
`kg:detangle:check` directly, which is exactly the instrument CI does not get to.

One thing the merge added as evidence: `main`'s pinned value **rose from 1441 to
1442** during the hours this branch was open. The wrong number is not static — it
tracks whatever the dependency tree holds, so it climbs whenever any session re-runs
the writer in a container that has already installed `block-qa-schema`. A masked
gate does not merely fail to catch a defect once; it lets the defect keep moving.


## IMPLEMENTED on the owner's choice — split the job (2026-09-26)

### First, a CORRECTION to this bean's own headline number

It said **113** masked `bun run` invocations. The real figure is **151**, across the
same 45 steps, identical on `14ec9dd446c` and on current `main`. My count used a line
range whose end boundary a regex had put 25 lines early, so it cut off part of the
job. **Wrong, not stale** — the title and the body both said 113, and so did a commit
message, a PR comment and what I told the owner.

And the 45 masked steps **include `bun run cat lint` and `tsc --noEmit`**. So `main` has
not been linted or typechecked in CI for as long as the drift has been red. That is
worse than this bean claimed, and it changed the fix: my first draft of the split left
lint and tsc behind `bun test`, still masked. They run FIRST now and `bun test` runs
**LAST**, with nothing behind it, and the ordering argument is written into the job.

### The split

`typescript` keeps exactly the three checks its name promises. A sibling job `gates`
(*"Repository gates (hard)"*) takes the 43 gate steps — 150 `bun run` lines — with its
own checkout/bun/python/install and deliberately **no `needs:`**.

**Verified before pushing, because the point is to stop hiding failures rather than to
reveal a heap of them.** 150 gate commands ran in a clean throwaway worktree with NO
`bun test` first, in a checkout with no nested `block-qa-schema` residue — a runner's
condition. **Exactly one failed:** `translation:drift:check`, the same t8g3 drift. The
masked region is otherwise clean.

`FAST_JOBS` had to learn the new job or `bun run cat gates` would have shrunk **154 -> 6**
while printing a confident pass. A new test asserts both jobs contribute.

### SEVEN derived artefacts from one .bpmn edit, in dependency order

`# bpmn-node:` markers are validated, and I invented `Task_RepositoryGates` before it
existed — `check:workflow-coverage` said DRIFTED. Adding the real seventh parallel
branch then cascaded:

    render:bpmn                docs/assets/img/workflows/code-quality-gates.svg
    kg:audit                   test/results/kg-qa/processes/...kg-qa.json
    gen-skill-docs             docs/reference/skill-instructions/platform-gates.md
    processes:viz              docs/processes/code-quality-gates.md + index.md
    translate-bpmn --extract   translations/{ar,es,fr,ru,zh}/processes/...pot
    kg:detangle                two detangle sidecars
    gen-uml-overview           two overview pages, which read those sidecars

A **partial order**, not a set: the last two consume what the earlier ones write. Four
rounds, each caught by a DIFFERENT instrument — `check:workflow-coverage`,
`check:ci-invocations`, `processes-viz.test.ts`, `bpmn-pot-current.test.ts` — and none
of them names a `.bpmn` file in its failure. **I shipped two instances of `ymsu`'s
class inside the commit whose message was about that class.**

`bun run cat skill:register` exists because the same was true of adding a skill. A
`bpmn:register` of that shape is the obvious follow-up; **not built**, because whether
seven steps deserve one command is the owner's call, and guessing is how the last such
list came out wrong three times.

### NOT clean, stated rather than buried

`role-carries-activity-skill` gains a **seventh** finding: `Task_RepositoryGates needs
skill "platform-gates", but its lane's role "build-pipeline" does not carry it.` All
six sibling tasks already carry the identical finding, so this is one more instance of
a pre-existing condition, not a new class. Not fixed — that is role modelling.
`kg:audit:check` passes (not critical) and CI does not run `kg:audit:strict`.

### ONLY THE OWNER CAN DO THIS ONE

`gates` is a NEW check name. Nothing regresses today, because merges land with
`TypeScript — tests, lint, types (hard)` red deliberately, so that check enforces
nothing. **But the moment the merge queue in `nytj`'s last box is switched on, both
names must be listed as required checks** — otherwise 150 gate invocations run and
block nothing.


## The full gate set, and a blind spot in the verification method itself

Three pushes each surfaced one further failure. Cause: I picked the verification
subset by hand each time — the same mistake AGENTS.md records about `bun run cat gates`.
**A subset of the gate set is not the gate set**, and that applies to a list I compose
as much as to one in a file.

Run properly — whole set, throwaway worktree, no nested `block-qa-schema` residue:
**5 of 156 failed**, tree guard **0 mutations**.

| gate | whose |
|---|---|
| `bunx tsc --noEmit` (vitest in the sub-package) | main's — patch proposed, not pushed |
| `bun test` > no NEW drift | main's — t8g3 |
| `translation:drift:check` | main's — t8g3 |
| `check:lockfile-pinning` | **mine** |
| `docs:auto:check` | **mine** — TENTH artefact |

### My prose declared an install

`check:lockfile-pinning` hunts a `bun install` without `--frozen-lockfile` in workflow
YAML, and matched a **comment** I had written to explain that very install. Reworded to
name the effect instead of the command.

Already a known class here rather than a quirk: `audit-coverage` records *"a docblock
that documents a tag necessarily contains the tag"* as something it had to pay for.

### A TENTH artefact, and a running tally

`docs/cat-harness/docs-auto/index/processes/**`. `docs:auto` is a link in the
registration chain, so `kg:audit`, `kg:detangle` and `gen-uml-overview` were re-run
after it in order; all converged.

Counts I have published on this change, each revised exactly once: **113 -> 151**
invocations, **seven -> eight -> ten** artefacts. A chain discovered by breaking is a
lower bound, every time — which is the argument for `bpmn:register` and against any
prose list, including the ones above.

### THE VERIFICATION TECHNIQUE HAS ITS OWN BLIND SPOT — record this

The clean-worktree run also failed `FOLIO_ROOT detection > INSTANCE_ROOT is this
platform checkout`. That test asserts the instance root IS the platform checkout, and
a detached worktree under `/tmp` is not. In the real checkout: **4 pass, 0 fail**.

So the technique that makes **residue-sensitive** gates honest makes **root-sensitive**
ones lie. A failure it reports must be re-checked in place before being believed. I
nearly reported this as a fourth finding.

Both directions now have a named instance: a gate is wrong in a built container
(detangle, 1441 vs 229) and wrong in a throwaway worktree (FOLIO_ROOT). Neither
environment is the truth on its own, which is what `check:merged` is for.


## CONFIRMED on CI, and the honest limit: 45 -> 6, not 45 -> 0

`Repository gates` on `6f1e445f43e`, read from the step list:

- steps **1-41 all green**, including `knowledge-graph audit` at 31 which failed the
  round before
- **step 42 `gates that were registered and never run` FAILED** — `translation:drift:check`,
  the t8g3 drift
- steps **43-48 skipped**

So the pre-push clean-worktree prediction held exactly.

### Six steps are STILL masked

43 `generated docs pages are current`, 44 `voices projection and viewer`, 45 `folio
projection and viewer`, 46 `viewer pages keep the navbar they had`, 47 `handler
namespace index`, 48 `translation index`.

The drift sits at step 42 and Actions still stops the job there. **Splitting moved 43
gates out from behind `bun test`; it cannot move a gate out from behind another gate
in the same job.** That is the limit of this fix and it belongs on this bean rather
than in a reader's head.

What is known about those six is MEASURED: the local clean-worktree run executed all
156 gates regardless of order and reported 5 failures, none of them these. So they
pass today. That is a fact about today's tree, **not a property of the arrangement** —
which is the distinction this bean exists to make, and the reason "they pass" does not
close the gap.

### A NOTE ON THIS BEAN'S OWN CHECKLIST

An earlier revision of this section carried a SECOND, ticked copy of the list above
while the canonical one still read as open. `check:bean-bodies` named it
`[shadow-checklist]` — *"the section a reader and every tool consult says this is not
done"* — and it was right: two checklists that disagree leave the authoritative one
lying. The boxes are ticked in place now and there is one list.

Worth recording HOW it got there, because it is this bean's own subject a third time:
I ran the full gate set, verified, and then edited the tree. The gate that catches this
lives in `bun test`, and `bun test` is behind `tsc` in the new job order — which is red
on main's `vitest` defect — so CI could not have told me. I found it by running the
bean checks by hand, which is the only reason it is not on `main`.

**That is a live consequence of the reordering**: `bun test` runs LAST in `typescript`
now, so while `tsc` is red, `bun test` does not run at all. The ordering assumed lint
and typecheck could not fail for reasons outside their own subject; `tsc` currently
fails for exactly such a reason. Landing the one-line `tsconfig` exclude unmasks it,
which is a second argument for that patch beyond tidiness.


## CI END STATE, confirmed by name on `34af74d5bb9`

**`typescript`** — `bun run cat lint` ✓, **`tsc --noEmit` ✓ (first time in this PR)**, then
`bun test`: **11880 pass / 44 skip / 1 fail**, the one being `the real corpus — and the
gate can actually fail > no NEW drift, and nothing unreadable`.

**`gates`** — steps **1-41 green**, step **42** (`translation:drift:check`) red, 43-48
skipped.

Two jobs, one failure each, **both the same t8g3 drift**. Nothing in the branch is red
for a reason of its own.

### Five failures were hiding in the masked region — all named, all settled

| hidden gate | whose | state |
|---|---|---|
| `tsc --noEmit` (vitest in block-qa-schema's tests) | main's | fixed on this branch |
| `check:glossary` | mine | fixed |
| `kg:audit:check` | mine | fixed |
| `check:lockfile-pinning` | mine | fixed |
| `docs:auto:check` | mine | fixed |

That is the answer to this bean's original question — *"is any OTHER gate in there
red?"* — and it is **five**, not zero and not one.

### Two facts only CI could establish

`tsc` green is the first CI evidence for the tsconfig patch; before this there was only
a local run and a throwaway worktree. And `bun test` executing again matters beyond
tidiness: the `check:bean-bodies` shadow-checklist defect earlier in this branch lives
in `bun test`, and I found it by hand because CI could not.

`detangle measurements are current` is **step 35 and PASSED** — the `xd1g` verification
box, which was deliberately left unticked as *"a fix, not a verification"* because
nothing could reach the check before the split existed.


## The \"45 -> 6\" limit has expired, and the shape of the claim was wrong — `xm31`

This bean's merge commit recorded: *\"the split took the masked region from 45
steps to 6, not to 0. Steps 43-48 still sit behind the drift gate at 42. Local
evidence says all six pass today, which is a fact about today's tree and not a
property of the arrangement.\"*

Measured 2026-09-26, hours later: main's gates job stops at **`check:glossary`,
step 8 of 43**, so 35 steps are masked, not 6. **The masked count is not a
property of the split — it is a property of WHICH step is red, and that moves.**
Five gates fail on `origin/main` with nothing in CI saying so; the measurement
and its method are on `xm31`.

So the caveat was right to be there and still understated the case: it named the
tree as the unstable half when the unstable half is the POSITION of the first red
step.


## The unit was STEPS and it should have been CHECKS — `cpss`, 2026-09-26

Every masking figure on this bean and on `xm31` counted **steps after the failing
one**. Measured independently from the workflow file: the failing step
*"gates that were registered and never run"* (line 928) is a `set -e` batch of
**106 commands**, and `translation:drift:check` is the **3rd**. So **103 gates
inside that one step never run**, on top of the five or six steps after it.

    om30's merge commit   "45 -> 6"                    steps
    xm31                  "35 masked at step 8"        steps
    xm31                  "42 -> 44, count still 6"    steps

All three are the smaller half. `cpss` (sibling, 18:09, `priority: high`) states it
as 108 checks and carries the decision, including the fix that makes the invariant
structural: **a deliberately-red gate must be the LAST step in its job**, not the
3rd command of a batch in the middle.

Recorded here because this bean is where the masking finding started and its own
numbers are the ones a reader will find first.


## The residual box is SATISFIED, and not by a third job — measured 2026-09-27

The box read: *"The residual **6** steps behind step 42 — the drift gate wants its
own job, the same shape as the decision above."*

It does not want one. Parsed from `.github/workflows/code-quality-gates.yml` at
`origin/main` `63a465674a2` — parsed, not read, because this bean's own history is
three hand-counted figures that were each the smaller half:

| deliberate-red step | position | steps behind it |
|---|---|---|
| `translation:drift:check` (`gates` job) | step **55 of 55** | **0** |
| `bun test` (`typescript` job) | step **6 of 6** | **0** |

The job split — this bean's chosen option (1) — plus `cpss`'s move of the drift
gate out of the 106-command batch to the end of its job did the whole thing. `bun
test` went from **step 2 of 47** to step 6 of 6. `check:red-gate-is-last` exits 0
over 8 jobs and 85 steps and reports each as last in its job, so this is a
property of the ARRANGEMENT and not of today's tree — which is exactly the form
this bean's third `Done when` box demanded and the form its "45 → 6" caveat
correctly distrusted.

### Scoped carefully, because the obvious stronger claim is false

This does **not** say nothing can be masked. An *accidentally* red step still
stops every step after it, and it should. What is now structural is narrower and
is the whole of what this bean asked for: **a gate that is red by decision masks
nothing.** The bean's own lesson is why the distinction matters — *"the masked
count is a property of WHICH step is red, and that moves."*

### A gap found while measuring it — bean `dvcx`

`bun test` carries the **same** assertion as the declared drift gate
(`translation-drift.test.ts:168`, under `describe("the real corpus — and the gate
can actually fail")` — the single failure in run 36231943911, i.e. this bean's
own evidence). It was **undeclarable**: `invocations()` could only name a
`bun run <target>`, and `bun test` takes no target. So it was last in its job by
coincidence, not by rule. Fixed on `dvcx`; both are now declared and located.

### Status of the red-by-decision gate itself, dated because it moves

`translation:drift:check` exits **0** today — 70 compared, 0 newly drifted, 0
unreadable, **8 uncatalogued and recorded** (the `t8g3` backlog recorded rather
than failing). `translation-drift.test.ts` is 18 pass / 0 fail. **Neither carrier
is red right now**, so the 113-invocation masking this bean opened on is not live.
Recorded as a fact about 2026-09-27 and not as a property, per the caveat above.

- [x] The residual **6** steps behind step 42 — **0 steps behind either
      deliberate-red step**, enforced by `check:red-gate-is-last` rather than
      observed in a green run. No third job.

## Evidence: Closed on Landed Work

Delivered and landed in PR #1390 (commit `e3264b4c64bb`) and PR #1405 (commit `e13378a2033b`):
- Repository gates split into individually concluded steps.
- 0 masked steps behind deliberate red gates; enforced by `check:red-gate-is-last`.
- Residual queue check mooted by bean `1hjm`.
