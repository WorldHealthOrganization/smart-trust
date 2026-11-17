---
# folio-assistant-ymsu
$schema: bean/1.0.0
title: kg:detangle:check CANNOT FAIL inside bun run cat gates — bun test repairs the sidecar 1140 lines earlier in the same run
status: completed
type: bug
priority: normal
created_at: 2026-09-25T18:38:34Z
updated_at: 2026-10-07T05:08:00Z
parent: folio-assistant-1xhc
---

Measured 2026-09-25, while establishing whether PR #1348 still had anything to
fix. It is the ROOT CAUSE of #1348's own subject: the detangle staleness that
broke `main` was invisible to `bun run cat gates` and surfaced only because a test
run left the working tree dirty.

## The mechanism

`bun run cat gates` runs 152 gates in order. Gate 1 is `bun test`. Somewhere in that
suite the detangle **writer** runs, not the checker:

    gates3.log:56    wrote 28 pinned measurement(s) to cat-harness/test/results/detangle/
    gates3.log:57    updated  cat-harness/skills/folio-core.detangle.json — internal

Gate 152 is `kg:detangle:check`, 1137 lines of output later:

    gates3.log:1194  ▸ bun run cat kg:detangle:check
    gates3.log:1233  ✓ 28 pinned measurement(s) current in cat-harness/test/results/detangle/

It reads the file gate 1 just repaired. It is comparing the writer's output to
the writer's output.

## Measured both ways, so this is not inference

Committed sidecar at `internal: 154`, working tree's true value `153`:

| invocation | result |
|---|---|
| `bun run cat kg:detangle:check` **alone** | **exit 1** — `STALE  …folio-core.detangle.json — internal` |
| `bun run cat gates` (same tree, same commit) | **exit 0** — `✓ 152 gate(s) pass` |

Same tree, same stale value, opposite verdicts. The checker is not broken —
run alone it catches the defect exactly as designed. What is broken is that
inside `gates` its subject no longer exists by the time it looks.

## Why this is worse than an absent gate

`1xhc`'s line is *"a gate that does not fire is indistinguishable from one that
passed."* This is a third state, and worse than either: the gate **does** fire,
reports specifically and by name, and the report is unfalsifiable. An absent
gate at least leaves `package.json` honest. This one is advertised, wired,
running, green, and load-bearing for nothing.

It also **destroys the evidence as it goes**: the repair is a working-tree write,
so an agent who runs `gates`, sees green and pushes has silently taken the
generated file's true value with them or left it behind depending on whether
they ran `git add -A`. That is how a wrong `internal` count reaches `main` at all.

## Scope — the 28 sidecars are the known instance, not the boundary

The writer emits **28** pinned measurements, so every one of them is inside the
blind spot, not just `folio-core`. The general question this raises for `1xhc`:
**which other `:check` gates run after a test that writes their subject?** That
is answerable mechanically — run each `:check` alone against a deliberately
staled input and compare with its verdict inside `gates` — and it has not been
asked.

## Not the same as two neighbours

- **`061n5`/intermittent-under-gates** is a test whose result varies with the run;
  this one is perfectly reproducible in both directions.
- **`v556`** is a generator with no `--check` at all, so nothing looks. Here
  something looks, at the wrong thing.

## Done when

- [x] the writer does not run during `bun test` — a test needing detangle output
      computes it in a temp dir, as the profile-conformance tests already do
      (`/tmp/profile-axis-*`), rather than writing into
      `cat-harness/test/results/`.
      **PR #1616, 2026-09-30.** The writer was reached by
      `src/tools/degradation.ts#loadSkillNeeds` importing every `.ts` under the
      declared kg roots; `kg-detangle.ts` now guards its write on
      `import.meta.main` and that loader imports only a file naming the field it
      collects. `wrote 28 pinned measurement(s)` appears 0 times in the fixed
      run's `bun test` and once in the baseline's
- [x] `gates` fails when the tree is entered with a staled pinned measurement.
      MEASURED AFTER: stale one `internal` by hand, `bun run cat gates` exits
      non-zero.
      **Both runs done, same tree, `internal: 999`.** `origin/main`
      `e718627f198`: the check PASSED inside `gates`, 1 of 182 failed and none
      of it the staleness. This branch: `kg:detangle:check` FAILED inside
      `gates` naming `STALE … — internal`, 4 of 186 failed, three of them the
      planted staleness. Earned by the gate itself, not by the mutation guard
- [x] `gates` refuses, or at minimum reports loudly, when a gate has MODIFIED
      tracked files — a gate run that changes the tree it is judging is the
      general form of this defect and would have caught it without knowing
      about detangle.
      **Shipped in #1363 (clause 3).** Ticked on evidence rather than on
      memory: `scripts/gate-tree-guard.ts` read, and watched fire in both runs
      above — naming `bun test` and `check:published-instance-exports` in the
      baseline, and only `skill:register:check` after the fix
- [x] the other 27 sidecars are confirmed covered by the same fix, rather than
      assumed to be.
      **Structural, not sampled:** all 28 are written by one `writeFileSync`
      call in one writer, and the guard is on that call, so no sidecar can be
      outside it
- [x] swept for siblings: which other `:check` gates have their subject written
      by an earlier gate in the same run.
      **SWEPT 26 of 26 `.ts` under 11 declared kg roots: 0 import-time writers,
      0 unimportable**, with the control that the same sweep reports 1 and names
      `kg-detangle.ts` when the guard is removed. The gate-level half is the
      `gates` mutation report: `check:published-instance-exports` and
      `check:version-bump` fixed, and a FIFTH site found and left open —
      `skill:register:check` writing `skill-register.qa-results.json`, which
      fires only when a verdict moves

## Second instance, found by the same measurement — a `--check` that omits a field

Different mechanism, same consequence, so it is filed here rather than as its own
bean: above, the checker looks at a subject a predecessor already repaired; here
the checker looks at the subject but **not at the field that is wrong**.

`cat-harness/docs/assets/beans/index.json` carries a `tile.beans.count` badge for
the site. Measured on `origin/main`, 2026-09-25:

| | |
|---|---|
| committed `tile.beans.count` | **327** |
| non-archive beans actually in `beans/defs/` | **339** |
| `gen-docs-pages --check` on that tree | **"generated pages are up to date"** |

The badge is twelve beans behind and its own generator's `--check` calls it
current. `harness.json` then copies 327 out of it, so `docs:harness:check` is
green too — **two consistent gates over one wrong number**, because both compare
downstream-to-upstream and neither compares upstream-to-reality.

It surfaced only because I ran the writer (`gen-docs-pages` without `--check`)
for an unrelated reason; the tile count jumped 327 → 340 and `docs:harness:check`
went red on the *correct* value. A gate going red when you fix something is the
signature of this whole family.

Worth noting against the code: `scanTileCounts`' docblock already reasons
carefully about **absence** — *"Every failure is ABSENCE, never zero … `dh4f`"* —
and gets that right. A stale non-absent number is the case it does not consider,
and absence is the one this design made safe.

### Adds to "Done when"

- [ ] `gen-docs-pages --check` compares `tile.*.count` against what a fresh run
      computes, not only the page bodies. MEASURED AFTER: hand-edit the count,
      `--check` exits non-zero
- [ ] the sweep item above is widened: for each `:check`, ask both *"could a
      predecessor have repaired its subject?"* and *"does it compare every field
      it writes?"* — this instance answers the second question wrongly and the
      first one fine

## Clause 3 IMPLEMENTED and falsified, 2026-09-26

`gates` now fails when one of its own gates changes the repository.
`cat-harness/scripts/gate-tree-guard.ts` snapshots `git status --porcelain`
between gates and attributes each change to the gate that made it; the runner
refuses to print its clean line when any gate did.

### The falsification, end to end

`folio-core.detangle.json`'s `internal` set to `999` by hand, then:

| | |
|---|---|
| `kg:detangle:check` **alone** | exit non-zero — `STALE … — internal` |
| `kg:detangle:check` **inside `bun run cat gates`** (line 1215 of the run) | **passed**, over `internal: 999` |
| the new guard | `✗ 1 gate(s) CHANGED THE REPOSITORY` → `bun test`, naming the exact sidecar |

So the bean's central claim is now reproduced on demand rather than only
remembered, and the blind spot it describes is closed by the runner rather than
by any gate.

### The direction that mattered, and would have been missed

The change `bun test` made was a **revert**, not new dirt: the file was ` M`
before gate 1 and CLEAN after it, because the writer put the correct value back.
So the entry *disappeared* from porcelain.

A guard asking *"did anything get dirtier?"* — the obvious first design — would
have reported nothing here. It would have missed its own test case. `diffReadings`
counts appearances, status transitions and disappearances for that reason, and
the disappearing case has its own test.

### Why it is safe as a HARD failure

Measured before committing to it: a full `bun test` on a clean `main` left the
tree **byte-identical**. A generator rewriting identical bytes does not appear in
`git status`, so the guard is silent on a healthy tree and fires exactly when a
committed artefact was stale.

The predicate is a per-gate **delta**, never "the tree is dirty" — running
`gates` on your own uncommitted work is the normal case, and a guard that failed
on that would be switched off the same day.

### Cost, measured rather than guessed

`git status --porcelain` over this repository's 13,529 tracked files is **~29ms**
(five runs: 29, 27, 29, 27, 29). 152 snapshots is **~4.4s**. That is what bought
per-gate attribution instead of a single before/after pair — the difference
between "the tree changed" and "gate 1 changed what gate 152 reads".

### Not done here, and still open above

Clause 1 — `bun test` should not run the detangle writer at all; a test needing
that output should compute into a temp directory, as the profile-conformance
tests already do. This guard makes that defect *visible and fatal*; it does not
fix it. Clauses 2 and 4 and the `:check` sweep are likewise untouched.

One limitation is documented in the module rather than defended against: a git
operation performed WHILE the gates run moves what is being measured, so it
would attribute an author's own `git add` to whichever gate was running. Commit
before or after a run, not during.

_2026-09-26T04:54:43Z_ — Claimed by claude/ymsu-gates-tree-guard — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## 2026-09-26 — a MEASURED instance, with the numbers, and it is the inverse direction

Found while merging `origin/main` (87 commits) into `claude/wonderful-gauss-7frcrw`
for PR #1369. AGENTS.md states this hazard as *"`bun test` runs two of the five
writers, so gates reports their artefacts current when they are not"*. Here it ran
the other way, and the consequence is worse than a false green on a stale file: the
gate cannot see a WRONG file that `main` is carrying.

### The file, and the two regimes

`cat-harness/test/results/detangle/cat-harness/schemas.detangle.json` exists in two
populations, ~6x apart:

| | size | internal | cohesion |
|---|---|---|---|
| what `main` carries | 229 | 125 | 0.82 |
| what the real generator produces here | **1443** | **709** | **0.96** |

Both grew by exactly **+2** across the 87-commit merge (1441→1443, 227→229), so
these are not two moments of one measurement drifting — they are **two different
scopes**, tracking the same corpus in parallel.

### The decisive test

    with main's 229 committed   → kg:detangle:check FAIL
    with the generated 1443     → kg:detangle:check PASS

So `main` is carrying a sidecar its own check rejects.

### Why no gate catches it

`bun run cat gates` reported **3** failures on this tree and `kg:detangle:check` was
not among them — because `bun test` runs earlier in the same gate set and
**rewrites the sidecar to the 1443 values**, so the check that runs afterwards
validates a file the run itself had just repaired. The gate set is self-healing
for exactly the artefact it is supposed to be judging.

That is why this bean's rule — *measure one check at a time* — is not a
convenience. Run in isolation, `kg:detangle:check` FAILS on main's file. Run inside
`gates`, it passes. Neither run is lying; they are answering different questions,
and only the isolated one answers the question a reviewer thinks they asked.

### Not diagnosed here

**Why** the two scopes differ by 6x. Both are produced by writers in this
repository, and a difference that large is a difference in what is being scanned
rather than in the corpus — bean `xd1g` (*"11 root-rooted scans have no gitignore
awareness"*) is the obvious candidate and is NOT established as the cause. Stated
as a candidate rather than asserted.

I committed the 1443 values, because they are what the check requires in a clean
run. If CI disagrees, the scope difference is environmental and that is the finding.


## CORRECTION 2026-09-26 — I had the two populations BACKWARDS

The instance recorded above says `main` was *"carrying a sidecar its own check
rejects"*, with 229 wrong and my 1443 right. **That is inverted.** 229 was correct
and 1443 was mine, inflated.

### What established it

Merging 40 more commits of `main` and regenerating gave **230**, and
`kg:detangle:check` passes with it. The cause is in that range —
`a0f7719032e`, *"xd1g: kg-detangle asks git for its corpus"*. Before it, the
generator WALKED THE FILESYSTEM and so counted untracked and ignored content;
after it, it asks git, and only the tracked corpus counts. 1443 was an
ignore-blind scan; 229/230 is the corpus.

So the check genuinely failed with 229 in my container and passed with 1443 — I
measured that correctly — but the fault was in the SCAN, not in the sidecar, and I
attributed it to the sidecar. Beans `xd1g` and `biz4` had this right while I was
writing the opposite.

### The part of my own reasoning that failed

I tested the hypothesis that an untracked `_kg/` (4.8 MB, gitignored) explained the
inflation, moved it aside, still got 1443, and concluded the inflation was not
ignore-blindness. **The test was too narrow rather than wrong**: removing one
ignored directory does not remove the others an ignore-blind walk also sees, so
1443 barely moved and I read "barely moved" as "not the cause". A negative result
from removing ONE member of a set says nothing about the set.

The right control was the one `biz4` names — a clean checkout, which has none of
them — and I had used exactly that control earlier in the session for a different
question and did not reach for it here.

### What survives

The observation this bean is actually about is untouched and still correct:
`bun run cat gates` did not report the failing `kg:detangle:check` because `bun test`
runs earlier in the same set and rewrites the sidecar first, so the check validated
a file the run itself had just written. That is this bean's subject, it is
independent of which value was right, and it is why the discrepancy was invisible
until I measured one check at a time.

## Two sessions reached the same root cause independently — and that is the strongest evidence in this bean

Merge note, 2026-09-26. The two blocks above arrived from PR #1369
(`claude/wonderful-gauss-7frcrw`); the three below were written here, on PR
#1399, without either session seeing the other's work. **They converge on the
same cause from opposite starting points, and neither is a copy of the other.**

| | #1369 | #1399 (below) |
|---|---|---|
| entered by | merging 87 commits of `main` | deciding where a new chain gate could go |
| first reading | `main` carries a sidecar its own check rejects | `kg:detangle:check` is stale on `main` |
| numbers seen | 229 committed vs **1443** generated | 227 committed vs **1441** generated |
| first reading was | withdrawn, then re-established inverted | withdrawn, then re-established as first written |
| cause found | `a0f7719032e` — the generator walked the filesystem | `walk()`'s bare `readdirSync`; 2719 gitignored `node_modules` files |

Both pairs of numbers differ by exactly the 2 commits between the two
measurements, so they are the same two populations, and both sessions traced
them to the same commit's subject: an ignore-blind scan, not a wrong sidecar.

**What the convergence buys that neither session could alone.** Each of us
withdrew a correct reading on the strength of a local re-run and then had to
reinstate it — which is a pattern, not an accident, and it is this bean's
subject seen from the observer's side rather than the artefact's. A check whose
verdict depends on what a previous gate installed produces a sequence of
honest, contradictory measurements, and the natural response to a contradiction
is to distrust the *earlier* reading. Both of us did that, and both times the
earlier reading was right.

**Recorded, not fixed.** The remedy is the corpus rule (`gitCorpus`), which is
`xd1g`'s subject and already applied to the detangler. What stays open here is
the ten remaining scanners, already a `Done when` clause below.
## Third instance, and it is CI's step sequence rather than a writer — 45 gates unevaluated on main

Measured 2026-09-26 while deciding where a new chain gate could go. The bean's
open sweep clause asks *"which other `:check` gates have their subject written
by an earlier gate in the same run"*. This is the same consequence reached by a
different mechanism, so it is filed here: in CI the subject is not repaired, it
is **never looked at**.

`Code-quality gates` run 36234052354, head `e53bba8028466cf8093e546a18945b1da05094a0`
— main's latest completed run, and the base of this session's branch. Job
`TypeScript — tests, lint, types (hard)`:

| step | name | conclusion |
|---|---|---|
| 5 | `bun test` | **failure** |
| 6 | `bun run cat lint` | skipped |
| … | … | skipped |
| 33 | knowledge-graph audit | skipped |
| 37 | detangle measurements are current | skipped |
| … | … | skipped |
| 50 | translation index is current | skipped |

**Steps 6 through 50 are all `skipped`** — 45 gates — because step 5 failed and
no step carries `if: always()`. The job reports as one red.

### Why this is the same defect and not a new subject

The bean's parent `1xhc` line is *"a gate that does not fire is
indistinguishable from one that passed."* From the job summary a reader sees
`TypeScript — tests, lint, types (hard): failure` and one named failing test.
Nothing says that forty-five further gates returned no verdict. So the same
third state this bean describes — advertised, wired, load-bearing for nothing —
is reached without any writer being involved.

It matters right now because `main` has been red on ONE deliberately-accepted
test (`no NEW drift`, bean `ngxj` / issue #206) since 2026-09-25. For as long as
that holds, **every gate after `bun test` in that job has been unevaluated on
main.** `kg:detangle:check`'s state on main is therefore not "green" and not
"red" — it is unknown from CI, and the only first-hand evidence is a local run.

### Measured locally, on that same commit

`bun run cat kg:detangle:check` alone, tree clean apart from three files outside any
declared graph directory (`scripts/skill-register.ts`, `package.json`, a
workflow): **exit 1**, six sidecars STALE —

    bootstrap/skills — proseMentions
    cat-harness/schemas — size, internal, outbound, cohesion, recordedBoundary, proseMentions
    cat-harness/skills/folio-core — inbound, recordedBoundary, proseMentions
    cat-harness/skills/authoring/folio-paper-adapter — inbound, recordedBoundary
    cat-harness/skills/hypothesis-generation — proseMentions
    cat-harness/skills/scientific-critical-thinking — proseMentions

Pre-existing rather than caused by those three files, and that is structural
rather than asserted: `size`, `internal`, `outbound` and `cohesion` on
`cat-harness/schemas` are functions of files under `cat-harness/schemas/`, which
this tree does not touch. The sidecars were last committed
2026-09-26T08:54:47Z and main has moved since.

### What I am NOT claiming

That the skip cascade caused the staleness — it did not, it **hid** it. And not
that `if: always()` is the remedy: 45 steps that each `bun install`-depend on a
green tree may fail for reasons that are all one cause, which is a different
report rather than a better one. The remedy is a decision, recorded on the child
bean of `v625` rather than assumed here.

### Adds to "Done when"

- [ ] the sweep clause above is widened a second time: for each `:check`, ask
      also *"is it reachable in CI when an earlier step in its job fails?"* —
      45 of this job's steps answer no today
- [ ] main's job reports which gates returned NO VERDICT, distinctly from those
      that passed and those that failed. MEASURED AFTER: with one test failing,
      the run's own summary names a count of unevaluated gates rather than only
      the failure


### CORRECTION to the block above — the "six stale sidecars" measurement does not reproduce

Written the same session, before pushing. The §"Measured locally, on that same
commit" block above reported `bun run cat kg:detangle:check` exiting 1 with six
STALE sidecars, and drew from it that `kg:detangle:check` is stale on `main`.
**Re-measured three times on the same commit with the committed sidecars
byte-identical to `HEAD`: exit 0, `✓ 28 pinned measurement(s) current`.**

The reading is withdrawn. What the two observations jointly establish is
weaker and more interesting than either:

| run | committed sidecar (`cat-harness/schemas`) | verdict |
|---|---|---|
| earlier this session | `size: 1441` (= `HEAD`) | **exit 1**, six STALE |
| three times after | `size: 1441` (= `HEAD`) | **exit 0**, 28 current |

Same commit, same committed bytes, opposite verdicts — so **the check's verdict
is not a function of the committed tree alone.** That is this bean's subject
arriving from a third direction, and it is worse than the masking already
recorded: masking made the check unable to fail, and this makes it able to
fail spuriously.

**The mechanism is NOT established and is not guessed at here.** The candidate
is some earlier writer run in this session's working tree, but `git status`
showed the sidecars unmodified at the time of the red run, which does not fit.
Recorded as could-not-determine rather than as a cause.

One consequence IS established, and it is the useful half: a downstream artefact
inherits the instability. After a `bun run cat gates` in this tree, `bun test`
repaired the six sidecars (1441 → 227), and `uml:overview:check` — whose page
carries the detangler's pinned numbers — went **red**, naming
`cat-harness/docs/uml/overview/cat-harness.md` and `.../cat-harness/schemas.md`
as stale. On the restored tree it is green. So `bun test`'s repair does not only
hide a failure in the gate that reads the sidecar; it **manufactures** one in
the gate that reads the sidecar's consumer. I regenerated that page and reverted
it once the cause was traced — committing it would have pinned 227 into a page
whose sidecar says 1441.

### Adds to "Done when"

- [ ] `kg:detangle:check` gives the same verdict twice on one commit with a
      clean tree. MEASURED AFTER — the two runs above disagree today, and until
      that is reproducible nothing else in this bean can be confirmed or
      refuted
- [ ] the spurious direction is covered too: after a `bun test`, no `:check`
      over a DOWNSTREAM artefact goes red on a tree that was clean before it.
      `uml:overview:check` is the measured instance


## THE WITHDRAWAL ABOVE IS ITSELF WITHDRAWN — CI settled it, and the cause is a filesystem walk

Same day, after the correction above. The §"CORRECTION … does not reproduce"
block withdrew the six-stale-sidecar reading on the strength of three local runs
exiting 0 over byte-identical committed bytes. **CI, on a fresh checkout of the
same commit, agrees with the ORIGINAL reading.** Job 108392401874 on head
`9549e285425`, the first thing that has ever evaluated `kg:detangle:check` in CI
here — six STALE, the same six, the same axes.

So the sequence was: right, then wrongly withdrawn, then right again. The cause
makes all three consistent, and it is not this bean's masking mechanism.

### The cause — `kg-detangle.ts`'s `walk` read the DISK

| `cat-harness/schemas` | `size` |
|---|---|
| fresh checkout (CI) | **227** |
| this container, after a gate ran `bun install` in a publishable subpackage | **1441** |
| committed sidecar | 1441 |

`cat-harness/schemas/block-qa-schema/node_modules/` — **2719 gitignored files**
— were being counted as graph nodes. `walk()` was a bare `readdirSync`
recursion, so the measurement moved when `check:published-packages` built that
package. My first run happened BEFORE that install (saw 227, committed 1441 →
stale, correct); my later runs happened after (saw 1441 == 1441 → current,
also correct, over a polluted corpus).

**The instrument changed under me, and the corpus never did.** That is why
"same commit, same bytes, opposite verdicts" was a true observation with a false
explanation: nothing about the committed tree varied, and nothing about
`bun test`'s repair was involved either.

Fixed by calling `gitCorpus` — which existed, and whose own docblock already
named this failure (`rsi6`: *"the moment a gate installed a publishable
package's devDependencies, it descended into `node_modules/`"*) and recorded
that `xd1g` counted **11** such scanners. The detangler was one of the eleven.
Local now computes CI's 227 and the check exits 0.

### What this means for THIS bean, which is narrower than it looked

Three of the instances recorded above are the masking mechanism — `bun test`
repairing an artefact a later gate reads. **This one is not**, and conflating
them would have been the error: it is an environment-dependent measurement, and
the remedy is a corpus rule rather than test isolation. Filed here because the
symptom was identical from the outside (a `:check` whose verdict could not be
trusted) and because the previous entry pointed at this bean's mechanism as the
suspected cause. Left in place so the next reader sees that the obvious
explanation was wrong.

The §"uml:overview manufactures a red" instance above **stands** and is
independent: that one really was `bun test` writing 227 into the sidecar
mid-run. What changes is which number was right — 227 was, all along.

### Adds to "Done when"

- [ ] the other TEN `xd1g` scanners are checked against `gitCorpus`, since one
      of eleven being fixed leaves ten measurements that move with the disk.
      MEASURED AFTER: install a subpackage's devDependencies, re-run each, and
      confirm no committed artefact changes
- [x] `kg:detangle:check` gives the same verdict on one commit in two
      environments — local and a fresh CI checkout now both compute 227


## The cascade did not vanish with the job split — it shrank from 45 to 6, and MOVED

Correcting a claim of mine from earlier today, before it is quoted. I wrote that
`main`'s workflow split had eliminated the skip cascade. **Half right, and the
half that is wrong is the half with a number in it.**

Measured 2026-09-26 on the merged tree, by parsing the workflow:

| | |
|---|---|
| `typescript` job | 6 steps, `bun test` is the LAST one |
| steps skipped by a `bun test` failure | **0** — this part of the claim holds |
| `gates` job | 48 steps |
| `translation:drift:check` position | step **41** |
| steps skipped when it fails | **6** |

So the cascade is not gone. It is **six steps instead of forty-five**, and it now
sits in a different job behind a different failure. A 45→6 reduction is a large
improvement and worth having; "gone" is a different claim and it is false.

### Why this matters beyond the arithmetic

`main` carries `translation:drift:check` red BY DECISION (bean `ngxj`, issue
#206). So on `main` today, six gates at the end of the `gates` job return no
verdict, permanently, for the same structural reason the forty-five did. The
remedy the split delivered is a smaller blast radius, not a fixed mechanism —
nothing yet makes a failing step report the steps behind it as UNEVALUATED
rather than as absent.

One consequence is already visible on PR #1399: the accepted drift red now
surfaces as **two** red checks with different names — `TypeScript` (the
`no NEW drift` test) and `Repository gates (hard)` (the
`translation:drift:check` script) — which is one root cause wearing two faces, a
thing a reviewer has to be told rather than shown.

### The useful side effect, and how it was verified

`check:rendered-labels` is step **20** of that job, ahead of the drift check at
41, so it runs. That its verdict is a PASS needs no separate query: GitHub runs
steps in order and skips only after a failure, so the drift check reaching step
41 is itself proof that every step before it passed. The position of the failure
is the evidence.

### Adds to "Done when"

- [ ] a failing step's successors are reported as UNEVALUATED rather than
      silently `skipped`. The split reduced the count; it did not make the third
      state legible, which is this bean's and `1xhc`'s actual subject. MEASURED
      AFTER: with one step red, the run's summary names how many gates returned
      no verdict


## The 6-step cascade CONFIRMED in CI, and it is no longer a parse of the workflow

The block above measured the cascade at 6 by parsing `code-quality-gates.yml`.
CI has now produced it directly. Run 36250420858, head `a21d2fcbb40`, job
`Repository gates (hard)`:

| step | name | conclusion |
|---|---|---|
| 43 | gates that were registered and never run | **failure** |
| 44 | generated docs pages are current | skipped |
| 45 | voices projection and viewer are current | skipped |
| 46 | folio projection and viewer are current | skipped |
| 47 | viewer pages keep the navbar they had | skipped |
| 48 | handler namespace index is current | skipped |
| 49 | translation index is current | skipped |

**Six, named.** A parse said "six steps" and could not say which; the run says
which, and that matters because a reader can now see that `translation index is
current` — a gate about the very subject the failing step is about — is one of
the six returning no verdict. The instrument and the run agree, which is the
first time on this bean that a prediction of mine about the cascade has been
confirmed rather than corrected.

## And the position-of-the-failure argument held a second time

`translation:pot:check` had only ever run on one laptop, which by this bean's own
standard is not evidence that it runs. It is line 910 of that step, three lines
above `translation:drift:check`, and the step opens with `set -e`. So the drift
check producing its 36 findings PROVES `translation:pot:check` exited 0 — the
failure's position is the verdict on everything before it, the same reasoning
used for `check:rendered-labels` at step 22.

That is worth naming as a general move, because it is the cheap way around this
bean's whole subject: **inside a `set -e` step, a later command's output is a
pass certificate for every earlier one.** It does not work across steps, which is
exactly why the cascade above is opaque and this is not.

All three gates added on this branch ran in that CI run and passed:
`check:rendered-labels` (step 22), `translation:pot:check` (step 43, by the
argument above), and the whole `Skill-registration chain, unmasked (hard)` job
(10s, green).


## The declaration gate CANNOT FIRE in CI — which is how `main` landed a gate without one

2026-09-26, PR #1425. A clean instance of this bean's mechanism, and the
consequence is already visible on `main`.

`check:artefact-verification` exists to catch exactly one thing: a NEW
generated-artefact check registered with no statement of what verifies it for a
consumer. It is red right now, naming `translated-links:check`, which `main`
landed the same day.

**It is red on `main` too** — measured in a clean worktree of `origin/main`, not
inferred. So `main` shipped a gate without its declaration, and the gate whose
whole purpose is catching that omission did not stop it.

### Why it could not stop it

Both live in step 44 of the `gates` job, `gates that were registered and never
run`, which opens `set -e`. The command order inside it:

| position in the step | command |
|---|---|
| 3rd | `translation:drift:check` — **RED on `main` by decision** (bean `ngxj`) |
| … | … |
| far below | `check:artefact-verification` |

So the step dies at the third command and `check:artefact-verification` is never
executed in CI, on `main` or on any branch. It is registered, it is wired, and it
has no reachable verdict — this bean's third state exactly, and `1xhc`'s
sentence: a gate that does not fire is indistinguishable from one that passed.

### The part that makes this measurable rather than theoretical

`bun run cat gates` locally reported **3** failures; CI's `Repository gates` reports
**1**. The difference is not the tree — it is that bun's script runner executes
every gate while a GitHub step stops at its first failure. So the only instrument
that saw `main`'s missing declaration was a local full run, and nothing in CI
will report it until the accepted drift red clears.

That inverts the usual worry on this bean. The familiar hazard is CI being
LENIENT where local is strict (`bun test` repairing an artefact). Here local is
strictly more informative than CI, for a structural reason, and an agent that
trusts CI over its own gate run will conclude the repository is cleaner than it
is.

### Adds to "Done when"

- [ ] `check:artefact-verification` is reachable — moved ABOVE the accepted drift
      red, or given its own step. MEASURED AFTER: with drift still red, CI reports
      the missing-declaration failure by name
- [ ] the count of gates in step 44 that sit BELOW the drift command is reported
      somewhere a reader sees. They are all in the same position and none of them
      can fail today


## The blast radius is 109 CHECKS, not 6 steps — my own framing corrected, twice over

I have described this cascade as **45 steps**, then corrected it to **6 steps**, and
both numbers were answers to the wrong question. Measured 2026-09-26 with the step
boundaries verified:

| | |
|---|---|
| the step | `gates that were registered and never run`, workflow lines **911–1433** |
| `bun run` invocations inside it | **106** |
| `translation:drift:check` position | **3rd** |
| unreachable INSIDE the step, under `set -e` | **103** |
| whole steps skipped AFTER it | **6** |
| **checks that cannot run at all** | **109** |

`set -e` is present; there is no `|| true` and no `set +e` anywhere in the step, so
nothing resets the failure. Controlled for.

### Why my earlier numbers were the wrong unit

45 and 6 both count **STEPS**. A step is not a check: this one step holds 106
checks. So "the cascade shrank from 45 to 6" was true of steps and badly misleading
as a statement of how much goes unevaluated — the real figure went from a
job-sized cascade to a **step-sized one that is larger than the job cascade it
replaced**, because 103 gates were consolidated into a single `run: |` block.

That is the same error I made on `cell()` the same day (recorded on `li5y`: "one
instance" was 238). Both times I counted the coarse unit that was easy to see and
published it as the exposure. **The unit a reader cares about is the CHECK, and it
is never the unit a workflow makes convenient to count.**

### Two verification notes, because the measurement itself nearly went wrong

**My first slice was wrong and gave the right answer by luck.** I detected the
step's end with an indentation heuristic that ran to line 1683 instead of 1433,
swallowing the `rust-wildcard` and `dependency-advisories` steps. It still reported
106 — because those later steps use raw shell rather than `bun run`, so the
over-wide slice contained no extra matches. I only noticed because the same scan
reported `|| true` and `continue-on-error` present, which contradicted the claim I
was checking. **A count that survives a boundary bug is not a count that was
measured correctly**, and the thing that exposed it was an incidental flag, not the
number.

**The figure reached me second-hand first.** Another session's check-in asserted
106/3rd/103. I re-derived it rather than adopting it, which is what caught the
boundary bug. The independent agreement is worth more than either measurement
alone; the adoption would have been worth nothing.

### Done when

- [x] the count of gates below the drift command is measured and recorded —
      **103 inside the step, 6 steps after, 109 checks total**
- [ ] `check:artefact-verification` is reachable. Unchanged, and now with a number:
      it is one of the 103
- [ ] the 103 are not a single `run: |` block. The remedy a sibling session
      proposes on `cpss` — split `translation:drift:check` out and make it the LAST
      step — is recorded here as the candidate, NOT adopted: it restructures gates
      that are not mine, and it is an owner decision

## 2026-09-27 — measured on pristine main, and the runner now DETECTS it

`bun run cat gates` on a pristine `origin/main` worktree at `c6960465301`
reported, as its own finding:

```
✗ 1 gate(s) CHANGED THE REPOSITORY while the gates were running:
  · bun test   (72 path(s))
      wrote (" M")  cat-harness/content/pipeline/script-sidecars/assertions_are_falsifiable.script.json
      wrote (" M")  cat-harness/content/pipeline/script-sidecars/bib-cite-resolves.script.json
      …and 64 more path(s) not listed
```

Two things this adds to the bean, neither of which was in it.

**The population is 72 paths, and they are `script-sidecars/`.** This bean was
written about ONE victim — `kg:detangle:check` reading a sidecar `bun test`
repaired 1140 lines earlier. The writes are not one file: they are 72, all
under `cat-harness/content/pipeline/script-sidecars/`. Every gate that reads a
script sidecar after `bun test` in the same run reads a repaired copy. The
blast radius is the whole family, not the one gate that happened to be noticed.

**The runner reports it now, so the invisible half of this bean is closed.**
The detection did not exist when the bean was written — that is why three stale
artefacts reached `main` green. It is now a named finding with the path list and
the remedy, and the remedy it prints is the right one:

> If a gate writes here as part of doing its job, that is the defect to fix:
> compute into a temp directory, as the profile-conformance tests already do,
> rather than into the tree under test.

**What is still open is the fix, not the detection.** Nothing yet stops
`bun test` writing into the tree it is being judged on; the runner only tells
you afterwards that it happened. So a reader still cannot trust any gate
ordered after `bun test` in a single `gates` run, and the guidance in this
bean — measure one check at a time, never through `bun run cat gates` — stands
unchanged.

Provenance: pristine detached worktree at `origin/main` `c6960465301`, leaf
directory named `folio-assistant` (the name matters — see below), symlinked
`node_modules` confirmed git-ignored first so the `qook` corpus defect could
not confound it. `git status --porcelain` after the run: 72 paths; after
`git checkout -- .`: 0.


## 2026-09-27 — clause 3's exit code is RIGHT; `check:merged`'s MESSAGE was wrong

Coordination first, because this bean is claimed. `bun run cat beans:claim
folio-assistant-ymsu` refused: *ALREADY CLAIMED by
claude/ymsu-gates-tree-guard*. That session is not reachable from here
(`ListAgents`: none running). Basis for proceeding on clause 1 anyway, recorded
rather than assumed: **PR #1363 is MERGED and its own Scope paragraph scopes
clause 1 OUT** — *"Clause 1 is untouched … This guard makes that defect visible
and fatal; it does not fix it."* The holder delivered clause 3 and said clause 1
is not theirs. The owner authorised taking it 2026-09-27.

### A proposal I made and then withdrew — read this before making it again

I proposed making `gates.ts`'s mutation path exit **2** instead of 1, on the
grounds that verdicts describing a repaired tree are a could-not-determine, and
that `gates` already reserves 2 for "could not tell".

**That is wrong, and #1363 says why in its own words.** The exit is fatal ON
PURPOSE, to force clause 1 rather than let a writing gate be tolerated.
Softening it to a could-not-determine would defeat the guard exactly where it is
working. Recorded here because the argument for 2 is genuinely tempting — it
cites this repository's own three-state discipline — and the next agent will
reach for it.

### What WAS wrong, and is now fixed

`check-merged.ts` branched on `gates.status !== 0` and nothing else, so it
printed the same thing for both meanings of that exit:

```
✗ the MERGED tree fails the gates, though this branch may pass alone.
Merge the base into the branch, regenerate what the failing gates name, ...
```

Measured on `claude/qook-verify-backwards`: **every gate passed**, one gate
changed the tree, and that was the message. It names failing gates that do not
exist and prescribes regenerating nothing.

Fixed by OBSERVATION, not by exit code: `check:merged` owns the merge worktree,
so it reads porcelain before and after and reports the mutation case in its own
words, pointing at clause 1. Extracted as `mutatedDuring(before, after)` so it
is testable.

**Unreadable is not a sighting.** If either reading fails, `mutatedDuring`
answers `false` — "no mutation observed", not "none happened" — and the caller
falls through to the ordinary message. That is the safe direction: telling
somebody to look at their own branch is recoverable, sending them hunting a
writer that may not exist is not.

Falsified: 6 tests including the anti-vacuity pair; always-`true` fails 4,
always-`false` fails 2, the real implementation passes 6. The
disappearing-entry direction (#1363's own near-miss, where a writer restoring a
correct value makes the entry vanish from porcelain) has its own case.

### Clause 1 — the writer is NOT yet identified, and that is a finding

`bun test` on a clean pristine worktree at `410199a1de2` left it **clean**, and
`portable-path.test.ts` and `qa-witness.test.ts` each write nothing. Yet inside
`bun run cat gates` the guard attributes **72** `content/pipeline/script-sidecars/`
paths to `bun test`. So the write is conditional on something the gates run sets
up earlier, not on `bun test` alone — which means clause 1 cannot be fixed by
reading the test files and needs the gates context reproduced. Not yet done; do
not assume a single test file is the culprit.

### CORRECTION, same day — `bun test` alone DOES write the 72 paths

The paragraph above says `bun test` on a clean pristine worktree leaves it clean
and the write must be conditional on gates setup. **False.** I read
`git status` MID-RUN, before the writing test had executed, and took that as
clean. Measured to completion on a clean pristine worktree at `410199a1de2`:

```
bun test rc=0
72 dirty paths
 M cat-harness/content/pipeline/script-sidecars/assertions_are_falsifiable.script.json
```

Clause 1 is reproducible with ONE command and no gates context. That makes it
easier to fix than I said, not harder.

**A status read taken while the thing is still running is not a measurement of
the thing.** Same family as the vacuous same-commit comparison recorded on
`qook` today: both looked like evidence and neither was.

### What changes, and why the obvious fix is ALSO wrong

```diff
-  "last_run_at": "2026-09-26T19:43:36.482Z",
-  "last_run_sha": "abee3acee29e15ad7ae540e254fe31f2cf31cc40",
-  "engine_version": "bun-1.3.14"
+  "last_run_at": "2026-09-27T05:52:05.836Z",
+  "last_run_sha": "410199a1de2ed5725af1705434cecce0007c04e8",
+  "engine_version": "bun-1.3.11"
```

Per-run provenance — timestamp, HEAD, engine version. Unstable by construction.

I first read that as `do70`'s shape (a recorded value that moves on every commit,
which `AGENTS.md` rules against: *"counts are printed rather than recorded"*) and
concluded the fields should come out. **Withdrawn.** They belong to
`block-qa-schema`, a PUBLISHED dual-language contract with a `dist/` and a
Pydantic parity half; removing fields there breaks two languages. The fields
legitimately record a real sweep.

So #1363's prescription stands and my reframe was half-true: the defect is that
a TEST performs a real sweep into the tree, not that the fields exist.

### Narrowing, for whoever takes it next

| | dirty |
|---|---|
| full `bun test` | **72** |
| `bun test cat-harness/content/pipeline/` (holds both the sidecars and `script-sweep.ts`) | **0** |
| `qa-witness.test.ts`, the only test importing `script-sweep` | **0** |

The writer is OUTSIDE `content/pipeline/` and fires only in the full suite. Not
identified. Do not assume it is one of the three above — each was measured to
write nothing.

## A SECOND witness, 2026-09-30 — and this one reddens a DIFFERENT gate

Found while porting the uploads-page diagram (PR #1529). Same mechanism, one
consumer along: it is not only `kg:detangle:check` that reads the repaired
file.

The gate set runs `kg:detangle`, which rewrites

    cat-harness/test/results/detangle/cat-harness/schemas.detangle.json

**inside the tree being judged** (`size` 230 -> 231, already stale before the
change under test). `gen-uml-overview` then reads the repaired copy, so
`uml:overview:check` fails — green at the branch's baseline, red inside the
run, for a reason belonging to neither.

It reproduces exactly by running `kg:detangle` on the pre-change head, which
is how it was told apart from a real regression.

### Why this widens the bean rather than repeating it

The original measurement is about a checker comparing the writer's output to
the writer's output — a gate that CANNOT FAIL. This is the inverse: a gate
that fails for something that is not its subject and not the diff's. Both come
from the same cause, a gate writing into the tree the rest of the run is
judging, and a fix that only stops `kg:detangle:check` reading its own writer
leaves this one standing.

### Not committed, on purpose

The repaired sidecar was left uncommitted. It is `main`'s staleness, not the
PR's, and committing it would put an unrelated change under that PR's name —
which is how a shared artefact's churn gets attributed to whoever happened to
run the gates.


## A THIRD witness pair, 2026-09-30 — and a third SYMPTOM, not a third instance

`check:version-bump` and `check:published-instance-exports` both regenerate

    cat-harness/test/results/kg-export.qa-results.json
    cat-harness/test/results/kg-export.bootstrap.qa-results.json

inside the tree being judged. Found on `origin/main` @ `408f9982265` (PR #1570):

```
✗ 2 gate(s) CHANGED THE REPOSITORY while the gates were running:
  · bun run cat check:version-bump                 (1 path)  cat-harness/test/results/kg-export.qa-results.json
  · bun run cat check:published-instance-exports   (1 path)  cat-harness/test/results/kg-export.bootstrap.qa-results.json

✗ every gate passed, and the run is NOT clean — 2 gate(s) changed the tree.
```

**178 of 178 verdicts green, exit 1.** The whole diff was a `script_hash` and an
`updated_at`, twice — no finding changed. `git log -1 -- cat-harness/scripts/kg-export.ts`
gives `56114cfe1a0`, PR #1548, which edited the script whose hash these two
sidecars record without regenerating them.

### Why this is a third symptom rather than a third example

The three are distinguishable from the outside, which matters because an agent
diagnoses from the symptom:

| witness | symptom | what a reader sees |
|---|---|---|
| `kg:detangle:check` | a gate that **cannot fail** | ✓, always |
| `uml:overview:check` | a gate that fails for something **not its subject** | ✗ on a gate the diff never touched |
| this pair | the staleness reaches **only the final mutation guard** | **every verdict green, exit 1** |

The third is the one that most resembles a broken harness rather than a stale
artefact, because no gate reports a finding at all. A reader who trusts the
verdict count concludes the run passed and the wrapper is buggy.

### The part worth recording is that it was masked, not fixed

`main` then moved to `0417c070a67` (PR #1550), which **touched `kg-export.ts`
and regenerated both sidecars in the same commit**. Verified from git blobs
(`script_hash` is `sha256(bytes)[:12]`, `cat-harness/scripts/qa-results.ts:96`):

```
kg-export.ts on origin/main:                    b539167517cb
kg-export.qa-results.json            recorded=  b539167517cb   MATCH
kg-export.bootstrap.qa-results.json  recorded=  b539167517cb   MATCH
```

So the repair landed **by luck** — the next edit to `kg-export.ts` that forgets
the sidecars reproduces it exactly. PR #1570, which fixed it deliberately, was
made obsolete by that accident and became actively harmful: its branch carries
`d4b2d9e423e4`, the pre-#1550 hash, so merging it would overwrite a correct
hash with a stale one and re-trigger the same guard in the opposite direction.
Recommended for closure 2026-09-30; the owner ruled *"close it, keep the
diagnosis as a bean"*, which is this section.

**A defect that gets masked by unrelated work is worse than one that stays
red**, because the red one is on somebody's list. This one left no trace on
`main` at all.

### What the fix has to cover, now measured at four gates

`check:version-bump` and `check:published-instance-exports` join
`kg:detangle` — so the fix (compute into a temp directory, as the
profile-conformance tests already do, and **report** rather than repair) has
four call sites, not one. A fix scoped to `kg:detangle` leaves three standing.

### One more reason this bean is not academic

Three `Unblock main:` PRs landed within a week — #1563, #1568, #1570 — and this
mechanism is why none of them could have been caught before merge by running
`bun run cat gates` on the branch: the gate that would notice repairs the file
first. Of the nine red-`main` incidents on 2026-09-30, five were corpus-walking
artefacts staled by the merge *sequence* (bean `391j`) and this mechanism is
what made them invisible on each branch in isolation.


## 2026-09-30 — clause 1 FIXED and falsified end to end, and the writer was never a test file

PR #1616, issue #1610, branch `claude/ymsu-gates-no-repair-in-tree`. Owner asked
for this directly. Coordination note: `bun run cat beans:claim ymsu` still refuses
with *ALREADY CLAIMED by claude/ymsu-gates-tree-guard*, the clause-3 holder from
#1363 — whose own PR scopes clause 1 OUT in as many words. Proceeded on that
basis plus the owner's ask, as the 2026-09-27 entry above did.

### The writer, identified — and the bean's own warning was right

This bean says *"the writer is NOT yet identified … do not assume it is one of
the three above — each was measured to write nothing"*, and then narrows to
`content/pipeline/`. **It is not in `content/pipeline/` and it is not a test
file.**

`src/tools/degradation.ts#loadSkillNeeds` walks every declared knowledge-graph
root and `await import()`s each `.ts` to read the skills declaring the
capabilities they require. A knowledge-graph root holds **scripts** as well as
declarations, and `skills/graph-management/kg-detangle.ts` does its work at
module top level. So *capability detection executed the detangler*, and
`src/tools/degradation.test.ts` does it three times over the real corpus.

That is why the earlier narrowing could not find it. `bun test
cat-harness/content/pipeline/` was clean and `qa-witness.test.ts` was clean
because the writer sits in `src/tools/`, reached through a loader that has no
idea it is running a script.

**The general defect is one line: importing a module executes it, and a
knowledge-graph directory is not a directory of inert data.**

### Fixed at two layers, each independently justified

| layer | change |
|---|---|
| the script | `kg-detangle.ts` guards its sidecar write on `import.meta.main` — a module in a kg directory is importable by anything that scans the graph, so its side effects must be conditional on being the entry point |
| the consumer | `loadSkillNeeds` reads source first and imports only a file naming the field it collects — the predicate its own `catch` already used, asked before the side effect instead of after it |

Fixing only the consumer would leave the next scanner to rediscover this.

### THE measurement this bean has been waiting for

Same tree, `folio-core.detangle.json` `internal` hand-staled to `999`, whole
gate set both times:

| | `kg:detangle:check` ALONE | the same check INSIDE `bun run cat gates` | run verdict |
|---|---|---|---|
| `origin/main` `e718627f198` | exit 1, `STALE … — internal` | **PASSED** | 1 of 182 failed — a pre-existing `bun test`, nothing about the staleness |
| this branch | exit 1, `STALE … — internal` | **FAILED**, `STALE … — internal` | 4 of 186 failed: three name the planted staleness, one is that same pre-existing `bun test` |

The bean's central claim — *same tree, same stale value, opposite verdicts* — is
now false in the direction it should be. `skill:register:check` reports it red
too, in both of the jobs that run it.

Corroborating: the string `wrote 28 pinned measurement(s)` appears **0** times in
the fixed run's `bun test` output and once in the baseline's.

### The other three call sites, each falsified alone

| call site | staled | `origin/main` | with the fix |
|---|---|---|---|
| `bun test` → capability detection → detangle writer | `internal` = 999 | **repaired to 157** (2.83 s) | **999, untouched** (0.50 s) |
| `check:version-bump` | `kg-export.qa-results.json` `script_hash` | exit 0, **repaired** | exit 0, untouched, and the gate now PRINTS `STALE` |
| `check:published-instance-exports` | `kg-export.bootstrap.qa-results.json` same | exit 0, **repaired** | **exit 1**, names it STALE, file untouched |
| `bun test` → `init-folio-qa.test.ts` → `qa-sweep` | `assertions_are_falsifiable.script.json` | **repaired** | **untouched** |

### Removing the write alone would have been a WEAKENING, and that is the part to read

Before this, a stale `kg-export` sidecar did surface — accidentally, as the
runner's mutation guard reporting that a gate had changed the tree. Take the
write away and nothing sees it: a worse gate wearing a cleaner run. So the
repair is **replaced by a comparison** (`qaResultState` in `scripts/qa-results.ts`,
holding out `updated_at` for the same reason the churn guard does, and keeping
`absent` and `unreadable` distinct from `current`).

Where each reports differs on purpose:

- `check:published-instance-exports` **fails**. Nothing else in the gate set
  produces or reads `kg-export.<stub>.qa-results.json`, so if this gate waves it
  through, no gate ever looks at it.
- `check:version-bump` **notes** it. A QA sidecar's currency is not that gate's
  subject, and a gate that reddens for something a reader did not ask it about
  teaches them to stop reading it.

**That leaves the host sidecar with no owning gate, and that is a finding rather
than a tidy ending**: `kg:export` is a writer with no `:check` anywhere in the
set. Recorded here; inventing a gate for it would have been a second subject
smuggled into that change.

### `main` was carrying the defect, and the value is diagnostic

`origin/main` @ `7b685b667b3`:

| | |
|---|---|
| `cat-harness/scripts/kg-export.ts` true hash | `0456470f68c8` |
| `kg-export.qa-results.json` records | `0456470f68c8` — current |
| `kg-export.bootstrap.qa-results.json` records | **`7a7d02611be6` — stale** |

`7a7d02611be6` matches **no version of `kg-export.ts` on `main`** — not its tip,
and not `e718627f198`, where the same file recorded `b539167517cb`. It is a hash
some branch's container computed while `check:published-instance-exports`
repaired the sidecar mid-run, committed by whoever ran the gates. The only
producer of that file was also its only reader. With the branch the gate goes
red on that state instead.

### Sweep — the bean's last Done-when box, with its denominator

Every `.ts` under every declared knowledge-graph root, imported in its own
subprocess, git asked what moved:

```
SWEPT 26 of 26 .ts file(s) under 11 declared kg root(s)
IMPORT-TIME WRITERS: 0
DID NOT IMPORT (not a clearance - not measured): 0
```

**Control, because a sweep that cannot find the known instance measures
nothing:** with the `import.meta.main` guard removed, the same sweep reports
**1** and names `kg-detangle.ts`.

Separately, the only other walk-and-import-everything consumer: there is none.
`generate-index.ts`, `find-dangling-remarks.ts` and `capture-mcp-tools.ts` all
import NAMED files; `degradation.ts` was the only site that walked a directory
and imported whatever it found.

### A FIFTH call site, and it was invisible until the other four were fixed

The fixed run's mutation report:

```
✗ 1 gate(s) CHANGED THE REPOSITORY while the gates were running:
  · bun run cat skill:register:check   (1 path(s))
      wrote     (" M")  cat-harness/test/results/skill-register.qa-results.json
```

`check:published-instance-exports` is gone from that list and `skill:register:check`
has taken its place. It is the same shape — a `:check` gate writing a committed
artefact into the tree under test — with one mitigating property measured here:
on a tree whose verdicts have not moved it writes **identical bytes** and does
not appear at all (it is absent from the baseline run's report over the same
staled tree, because there the detangle check still passed). It fires only when
a verdict CHANGES, which is to say only when the run is already red.

**Left open rather than fixed**, because it is a different subject: that sidecar
is `skill:register`'s own QA record and the gate is its only producer, so the
remedy is the `check:published-instance-exports` one — compare rather than
write — and it belongs with whoever owns `skill-registration`. Recorded so the
next reader does not read the fixed run's single remaining mutation as a
regression from this work.

### Two traps hit while doing this, both now recorded in the code

1. The first `kg-detangle.ts` docblock **spelled the field name** the loader now
   selects on, which put the script straight back into its candidate set. *A
   docblock that documents a tag necessarily contains the tag* — `audit-coverage`
   already records this and it still caught me.
2. The first falsification of the new loader tests **passed against what I
   thought was `origin/main`**: I had already committed the fix, so
   `git checkout --` restored the fixed version. Against
   `git show origin/main:…` it is **1 fail** vs **17 pass**. A guard nobody has
   watched fail is not a guard, and "I reverted it" is not the same as "I
   reverted it to the baseline".

### What this earns, and what it does not

**All five of the original `## Done when` boxes are ticked, up in that section
and only there** — each with the measurement that earns it. This paragraph
deliberately does not restate them: `check:bean-bodies` caught a restated,
separately-ticked copy here while the canonical list was still open, which is
exactly the drift it exists to stop, and it was right.

NOT earned, and untouched by this: the CI skip-cascade clauses (103 checks below
the accepted drift red in one `run: |` block, `if: always()`, "report which gates
returned NO VERDICT"), and `gen-docs-pages --check` comparing `tile.*.count`.
Those restructure gates that are not this change's subject and the bean records
the first as an owner decision.

_2026-09-30_ — measured on `origin/main` `e718627f198` and, after merge,
`7b685b667b3`. Every number above is from a run in this container, reported as
measured.

## Evidence

Work landed on `main` in PR #1616 (merge commit `da6302d3a5a6df610271d77e710a607e10333c14`, head commit `2197bc7f7dab`), satisfying all five Done-when criteria with extensive falsification and sweep measurements recorded above.
Verified against `main`:
1. `bun run cat kg:detangle:check`: passes with 69 pinned measurements current.
