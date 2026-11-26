---
# folio-assistant-sff8
$schema: bean/1.0.0
title: Contention inflates a per-test budget ~35x, and vxho fixed ONE of 505 files — two more just failed on main
status: completed
type: bug
priority: normal
created_at: 2026-09-26T03:31:40Z
updated_at: 2026-10-07T17:38:00Z
parent: folio-assistant-1xhc
---

Measured 2026-09-26 on a clean checkout of `main` at `0ef9543ccf3`, while
starting unrelated work. `bun test` **exited 1**:

```
cat-harness/content/pipeline/translation-block-qa.test.ts:
(fail) buildReport — absence is absence > a translated block reports coverage,
       terms and echo — and NO round-trip verdict [5031.09ms]
  ^ this test timed out after 5000ms.

cat-harness/scripts/tests/profile-scoping.test.ts:
(fail) the sweep's profile gate, end to end > a paper-only criterion is n/a'd
       in a document folio, under its OWN outcome [12314.36ms]
  ^ this test timed out after 5000ms.
```

Both are **timeouts, not assertion failures** — the `^ this test timed out`
line says so. `11698 pass, 56 skip, 2 fail` across 505 files in 305s.

**Both pass in isolation.** The two files together: `45 pass, 0 fail, 12.44s`,
exit 0. So neither test is broken and neither is slow on its own.

The first one is the striking number: **5031ms against a 5000ms limit — 0.6 %
over.** That is not a race that happens sometimes; it is a coin whose bias
depends on what else the machine is doing.

## Why this is NOT a reopening of `vxho`

`vxho` is completed and its fix was right. It hoisted `SCHEMA_GRAPH` and
`LIBRARY_GRAPH` to module scope in **`viz-generators.test.ts`**, so that file's
filesystem work no longer sits inside any single test's budget, and it closed
with a stated falsifier:

> *"if this ever recurs on `viz-generators.test.ts` after this change, the cause
> is elsewhere and this entry is the record of what was already ruled out."*

It has **not** recurred there. It recurred in two other files. So `vxho`'s fix
holds and its falsifier is unfired — which is exactly why this is a separate
bean rather than a note on a closed one.

What `vxho` established and did not generalise is the mechanism:

> *"the test's own work is ~150ms and the full suite inflates it ~35x. That is
> CONTENTION — hundreds of test files against one disk."*

**That mechanism is a property of the suite, not of one file.** `vxho` fixed the
one file where it had been observed. 505 files remain, every one of which does
filesystem work inside a per-test budget shares the defect, and two of them
surfaced within 24 hours of `vxho` closing.

## Why it matters more than a re-run

The failure clears on re-run, so it teaches everyone who meets it to re-run —
and **flake is not a root cause**. Worse, it is indistinguishable from a real
failure at the moment you read it, which is `1xhc`'s subject from the other
side: here a gate fires when nothing is wrong, where `1xhc`'s usual case is a
gate staying silent when something is.

It also has a measurable cost in this repo: an author who runs `bun run cat gates`
and sees 2 red cannot tell it is not theirs, which is the same "could not
determine is never rendered as clean" failure that plausibly contributes to
open PRs sitting unlandable.

## What a fix is NOT

**Not a raised timeout.** `vxho` argued this and the argument holds: a bigger
number buys months and decays as the repo grows, and it converts "fails under
load" into "fails under more load".

**Not per-file hoisting, 505 times.** That is `vxho` applied by hand until
somebody stops, with no way to know when it is done.

## Done when

- [x] the two files above are measured the way `vxho` measured its one — the
      test's own work timed in a quiet process, against its runtime under the
      full suite — so the ~35x is confirmed or corrected rather than assumed
      from `vxho`. **CORRECTED, both halves, and neither was `vxho`'s cause.**
      `profile-scoping`: 4.0 s of the tests' OWN work at a 1.0× factor, not
      contention. `translation-block-qa`: two `git` subprocesses per criterion
      (`git log -n 1` at 20.05 ms warm / **158.61 ms cold**), ~66 ms per
      `buildReport` — the filesystem scaffolding is 0.5 ms of it. Sections below.
- [x] a decision is recorded on whether the general shape is addressable at the
      suite level at all: does `bun test` offer a per-test budget that excludes
      I/O, or concurrency limits that bound contention, or is per-file hoisting
      genuinely the only lever? — **NO suite-level lever exists**, measured on
      bun 1.3.11 and on the 1.3.14 CI pins. Files run strictly sequentially with
      and without `--concurrent`, so the suite cannot contend with itself and
      `--max-concurrency` bounds a concurrency it does not use. Section below.
- [x] MEASURED AFTER: whatever is chosen, `bun test` over the full suite is run
      repeatedly on a loaded machine and the pass rate reported — a single green
      run is what made this look fixed in the first place. **2 quiet runs: 12244
      pass / 0 fail, 272.6 s and 270.1 s. 1 LOADED run (6 hogs on 4 CPUs, load
      avg 6.03): 12241 pass / 3 fail, 555.8 s.** This box's suspicion of a single
      green run was correct — the same tree passed twice and then failed three.
- [x] the two named tests stop appearing; and if a THIRD file appears before
      this is addressed, that count goes here rather than into a new bean —
      **both stop, confirmed UNDER the load that broke three others**: 360.0 ms,
      0.2 ms, 0.1 ms against a 5000 ms budget. And the count is recorded here as
      directed: **3 failures across 2 new files**, with at least two DISTINCT
      causes, so they are not this bean's phenomenon recurring. Section below,
      plus a retraction of my own "28–41× inflation" figure — measured 2.0×.

## Not claimed

Recorded and left `todo`. The session that found it was doing unrelated work
(`ymsu`) and deliberately did not pivot.



## Third independent confirmation, and one piece of evidence the bean does not yet have — 2026-09-26, ~17:30

Seen again on `81461747918` (a beans-only branch, no source change), inside
`bun run cat gates`. Same two files. **Not appending a duplicate observation: the new
element is that the failing SET VARIES between runs of the identical commit.**

    full run A   buildReport — absence is absence
                 the sweep's profile gate … > a paper-only criterion is n/a'd in a document folio
    full run B   the sweep's profile gate … > the same criterion runs in a paper folio
                 the sweep's profile gate … > a folio whose config cannot be read keeps its coverage

Four distinct test names across two runs, drawn from the same two files, same
commit, same container. Then `bun test cat-harness/scripts/tests/profile-scoping.test.ts`
alone: **16 pass / 0 fail, three times.**

"Passes in isolation" is consistent with a deterministic environment difference.
**A set that varies run to run is not** — it rules that out and leaves contention,
which is what this bean already says. The same discriminator settled a navbar e2e
question earlier today from the opposite direction: a deterministic browser
difference names the same elements every time, so a varying set meant a race.

CI on that same commit reported **1** `bun test` failure, not 3 — main's `t8g3`
drift and nothing else — so the runner does not reproduce it and the local gate set
is the surface that misreports.

Consequence worth recording for whoever takes this: **`bun run cat gates` and
`check:merged` inherit it.** A session comparing a local gate run against CI sees
2-of-158 locally against CI's 2 and has to establish, by hand and per run, that the
extra names are not findings. That is the third time in one session that a local
gate reading had to be discounted against CI — the other two were `xd1g`-class
residue (`3vc1`) and the `pull_request` merge-ref discovery (`g5o5`).

Status untouched, no claim taken — this is somebody else's to work; the evidence is
recorded here rather than in a new bean because `check before you create` would have
had me open a duplicate of it.


## Two more timeouts, and their MARGINS are the evidence

A clean-tree `bun run cat gates` on 2026-09-26 21:2x hit these, in the same file:

    (fail) a paper-only criterion is n/a'd in a document folio, under its OWN outcome  [5170.50ms]
      ^ this test timed out after 5000ms.
    (fail) a folio whose config cannot be read keeps its coverage                      [5047.46ms]
      ^ this test timed out after 5000ms.

**Both are timeouts at the limit plus a small remainder** — 5000 ms + 170 ms and
5000 ms + 47 ms — and that is the discriminating fact, not the failure itself. A
deterministic environment difference (a missing binary, a different resolution, a
path that is absent in one place) does not land just past a deadline: it fails
the same way every time, usually fast. Work that is merely **slower than the
budget under load** lands exactly here, arbitrarily close to the limit from
above.

Taken with the earlier datapoint — the failing test SET varies between runs of
the identical commit, while `profile-scoping.test.ts` is 16/16 in isolation —
the shape is contention for a shared resource, not a difference between this
container and CI's.

Recorded as evidence only; this is not my bean and its status is untouched. If
it is contention, the fix is a budget or a serialisation, not a code path, and
whoever holds it should decide which.


## A third margin, and the SPREAD is the new evidence

A clean-tree `bun run cat gates` on the merged tree (`6b4c89309ed`, 2026-09-27 05:0xZ)
failed exactly one gate of 167, and its one failing test was:

    (fail) buildReport — absence is absence > a translated block reports coverage,
           terms and echo — and NO round-trip verdict  [7463.84ms]
      ^ this test timed out after 5000ms.

A timeout, not an assertion — and in `profile-conformance-axis.test.ts`, the
second of the two files, not `profile-scoping.test.ts`.

So the margins over the 5000 ms budget now stand at **47 ms, 170 ms and 2464 ms**.
**The spread is the point.** A deterministic environment difference — a missing
binary, a different resolution, a path absent here — produces a STABLE duration,
because it is the same work every time. A budget exceeded by three different
amounts across three runs of the same suite is load, and load is contention.

Independently: **CI passed this exact test on this exact commit** minutes before,
along with the four profile-scoping tests, in `TypeScript — tests, lint, types
(hard)` on `6b4c89309ed`. That is the third consecutive CI run to pass what this
container fails, which is this bean's premise holding rather than an assumption
about it.

Evidence only when written. **Superseded by the claim note below**: this session
claimed the bean at 05:16Z, so "no claim taken" stopped being true minutes after it
was written, and the line is corrected here rather than left standing. The remedy is
now this session's to propose, under the `## Done when` already recorded above —
which rules out both a raised budget and per-file hoisting, so neither is on the
table as a shortcut.

_2026-09-27T05:16:34Z_ — Claimed by claude/wonderful-bohr-6kxh7b — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## The SECOND half, diagnosed — and it is not contention for a disk either

`translation-block-qa.test.ts`'s *"absence is absence > a translated block reports
coverage, terms and echo"* is the case this bean stayed open for. Measured
2026-09-27 on `128b52fe2c3`.

### Where its time goes, measured rather than assumed

    mkdtempSync                            0.12 ms
    the two writeFileSync                  0.25 ms
    rmSync recursive on the temp dir       0.14 ms
    buildReport alone                    ~50 ms warm, 194 ms cold

**The filesystem scaffolding is 0.5 ms of it.** So `vxho`'s account — hundreds of
test files against one disk — does not explain this test, and the obvious remedy of
sharing one temp directory across the file would save half a millisecond.

Inside `buildReport`, the parts that look expensive are not:

    measureBlock (glossary prebuilt)       0.12 ms
    readGlossary(root, "fr")               3.4 ms

### The cause: two git SUBPROCESSES per criterion

`entry()` — built once per criterion — calls `reviewer()`, which calls
`gitFileCommitSha`, and `gitHeadSha(INSTANCE_ROOT)`. Both are uncached
`execFileSync("git", …)` in `qa-utils.ts`:

    gitHeadSha(root)     git rev-parse HEAD             1.96 ms/call
    gitFileCommitSha     git log -n 1 --format=%H -- p 20.05 ms/call
    one entry()                                        22.0 ms
    buildReport, ~3 criteria entries                  ~66 ms of git

That is the ~50 ms warm cost, and the answers are **invariant for the whole
process**: the same HEAD, the same script's last commit, re-asked per criterion per
block.

### Why this model fits what the bean could not explain

| observation | explanation |
|---|---|
| 4 % of budget when the machine is idle | 66 ms of git is cheap on a quiet machine |
| seen at **5031 ms** and **7463 ms** — 28–41× | PROCESS CREATION is what degrades catastrophically under load; the spawns queue behind every other test file's work |
| its three neighbours in the same file do not blow up | the two "no report" tests return `undefined` BEFORE reaching `entry()`, so they spawn nothing |
| the test that calls `buildReport` TWICE is 108 ms, less than this one's 181 | ≈ 2 × 50 ms warm, while this test pays the 194 ms COLD call — it runs first |

So contention is real, and it is contention for the **process table** rather than a
disk — and it is caused by the code spawning `git` at all, not by the suite.

### This is a PRODUCTION cost, not a test-budget quirk

`buildReport` is what the QA sweep runs per block per locale. At ~66 ms of git each,
a sweep over N subjects spends 66N ms re-answering two constant questions. The test
is only where it became visible.

### Not fixed here, because the fix has a trade-off that is not mine

Memoising `gitHeadSha` (per root) and `gitFileCommitSha` (per root+path) in
`qa-utils.ts` would take this test from ~50 ms to ~22 ms and a sweep from 66N to
~66 ms. But `qa-utils.ts` is also reachable from the long-running MCP server, where
a process-lifetime cache holds a stale HEAD after a commit — and "stale provenance
recorded as a fresh verdict" is the failure mode `sfjo` and `rmcf` are both about.
So the scope of the cache is a design decision, and it is put to the owner rather
than chosen here.

**What is NOT in question**: the numbers above, and that the remedy is not the one
this bean's `## What a fix is NOT` section rules out. It is neither a raised timeout
nor per-file hoisting — the work is 66 ms of subprocess spawning inside a function
that should not be spawning at all.


## `Done when` 2 answered: there is NO suite-level lever, and that is the useful answer — 2026-09-27

The box asked three things: *does `bun test` offer a per-test budget that excludes
I/O, or concurrency limits that bound contention, or is per-file hoisting genuinely
the only lever?*

Measured, not read off the docs. **On both this container's bun 1.3.11 AND the
1.3.14 that CI pins** (`oven-sh/setup-bun@v2`, four call sites in
`code-quality-gates.yml`) — downloaded and run side by side, because a claim about
the scheduler made on the wrong version is not a claim about CI.

### The three flags that exist

    --timeout=<val>           per-test timeout, ms, default 5000
    --concurrent              treat all tests as `test.concurrent()`
    --max-concurrency=<val>   max concurrent tests, default 20

### The probe: three files, one test each, 300 ms of pure CPU spin, no I/O

    1.3.11 default       START b …432  END b …732  START c …733   →  960 ms
    1.3.14 default       START b …463  END b …763  START c …764   →  965 ms
    1.3.14 --concurrent  START b …432  END b …732  START c …733   →  963 ms

**One millisecond between one file's END and the next file's START, and 3 × 300 ms
of wall clock.** Files are executed strictly sequentially, and `--concurrent` does
not change it on either version.

The same three tests moved into **one** file, with `--concurrent`:

    START x …564   START y …564   START z …564   →  360 ms

All three start in the same millisecond. So `--concurrent` interleaves tests
*within* a file and never *across* files.

### Answers, in the order asked

1. **A per-test budget that excludes I/O: does not exist.** `--timeout` is
   wall-clock. There is no CPU-time or I/O-excluding variant.
2. **Concurrency limits that bound contention: not a lever here.**
   `--max-concurrency` bounds only within-file concurrency, which is **OFF by
   default** — there is nothing concurrent for it to bound. `--concurrent` would
   *create* contention, not bound it.
3. **"Per-file hoisting is genuinely the only lever" is false**, but not because a
   better suite-level lever exists. No suite-level lever exists at all.

### The corollary is worth more than the answer

Two tests never run at the same instant by default, so **the suite cannot contend
with itself.** That retires the framing this bean inherited from `vxho` —
*"hundreds of test files against one disk"* — for synchronous work: the files are
not simultaneous, so they cannot be simultaneously on the disk.

The 28–41× inflation is therefore contention with processes **outside** the suite
— other jobs on the runner, the runner's own load — and **no `bun test` flag can
bound that.** Which is why the two fixes already made are the whole available set,
and why the second one matters more than it looked:

- **hoisting** reduces the amount of work (profile-scoping: 4061/4049/4015/4013 ms
  → 0.1/0.0/0.2/0.1 ms);
- **not spawning `git`** removes the work that degrades *worst* under external
  load, since process creation is what queues behind an unrelated job.

Both reduce work. Neither bounds contention, because nothing in `bun test` can.

- [x] a decision is recorded on whether the general shape is addressable at the
      suite level at all — **it is not**, measured above on 1.3.11 and on CI's
      1.3.14: no I/O-excluding budget exists, and the concurrency flags bound a
      concurrency the suite does not use


## `Done when` 3 and 4: MEASURED AFTER, quiet and LOADED — 2026-09-27

The box asked for the full suite run repeatedly **on a loaded machine**, because
*"a single green run is what made this look fixed in the first place."* Both
conditions, on bun 1.3.11, 539 files:

| condition | result | wall clock |
|---|---|---|
| quiet, run 1 | 12244 pass / 56 skip / **0 fail** | 272.6 s |
| quiet, run 2 | 12244 pass / 56 skip / **0 fail** | 270.1 s |
| **loaded** — 6 hogs on 4 CPUs, load avg **6.03** | 12241 pass / 56 skip / **3 fail** | **555.8 s** (2.05×) |

The load was deliberately two kinds: four CPU spinners (= `nproc`) **and two
process-churn loops**, because this bean's second half is about `execFileSync`
queuing behind process CREATION and a pure CPU hog does not exercise that.

**Two green quiet runs are worth almost nothing here** — that is this box's whole
point, and the loaded run proves it: the same tree that passed twice failed three
tests when the machine was busy.

### The two named tests STOP APPEARING — under the load that broke three others

| test | before | quiet now | **loaded now** |
|---|---|---|---|
| `…NO round-trip verdict` | **5031 ms** (timeout) | 178.2 ms | **360.0 ms** |
| `a paper-only criterion is n/a'd…` | 5170 / **12314 ms** | <50 ms | **0.2 ms** |
| `a folio whose config cannot be read…` | **5047 ms** | <50 ms | **0.1 ms** |

Neither named file appears among the failures. `Done when` 4's primary clause is
met, and met under the discriminating condition rather than in a quiet run.

### A CORRECTION TO MY OWN CLAIM, and it was load-bearing

I wrote that the surviving 178 ms test *"would still cross 5000 ms under a 28–41×
inflation."* **Measured: it inflates 2.0×**, to 360 ms — a factor of 14 below the
budget, under a load that timed out three other tests.

**The 28–41× was never an inflation FACTOR.** It was the ratio of the observed
PRE-fix timeout to the POST-fix quiet runtime — two different populations. Before
the memoisation `buildReport` made ~6 `git` spawns; now it makes far fewer, and
spawns are precisely what degrades under load. So the ratio cannot be carried
across the fix that changed the spawn count, and I carried it. Retracted.

### THREE new files appear, and per this box the count goes HERE — but they are NOT one cause

    activity-log.test.ts   no node mentions the log directory                   5211 ms
    kg-export.test.ts      nothing published still names the retired `kg/` dir   5009 ms
    kg-export.test.ts      and the other instance's CONTENT…                    6215 ms

Same signature as the originals — 5000 ms plus a small remainder (5211, 5009,
6215, against the original 5031 / 5047 / 5170). But the causes differ, and that
is the finding:

- `activity-log.test.ts` contains **zero** `execFileSync`/`spawnSync`/`Bun.spawn`.
  Its failing test calls `await buildExport()` — a full KG export — **inside the
  test body**. That is `vxho`'s I/O shape, not this bean's spawn shape.
- `kg-export.test.ts` has 2 spawns, one of them `git rev-parse HEAD`.

**So "a 5000 ms timeout under load" is at least two phenomena, and treating them
as one is what made the ~35× look like a single thing to fix.**

### The corpus already contains the answer for the case that MUST spawn

The three slowest tests under load did **not** fail: **22158 ms**, 18914 ms,
12576 ms. The first is
`declared-directory-resolves.test.ts` — *"each one resolves `library` in a FRESH
process"* — and it survives because its budget is **DERIVED from the module count
(600 ms/module)**, not written as a number. Its own docblock states this bean's
failure mode better than this bean did:

> Bun's default test timeout is **5 s**, so this test has been over budget for as
> long as the corpus has been this size and passed only where the machine was fast
> enough — which is the worst failure mode available: green on CI, red on a
> contributor's laptop, and nothing saying which.

That answers `## What a fix is NOT` precisely. Its objection to a raised timeout
is that *"a bigger number buys months and decays as the repo grows"* — and a
**derived** budget is the one form that does not decay, because it grows with the
population it measures. A derived budget is not a raised number.

### The three remedies, now distinguishable

| cause | remedy | precedent in this repo |
|---|---|---|
| spawns it does not need | eliminate them | `gitFileCommitSha` memoisation, this bean |
| spawns it genuinely needs | derive the budget from the population | `declared-directory-resolves.test.ts` |
| expensive shared work in a test body | hoist to module scope | `profile-scoping.test.ts`, `vxho` |

`## What a fix is NOT` rules out per-file hoisting **"505 times"** — as a
programme, not as a targeted fix. Two of the three above are not hoisting at all.

### What this does NOT establish

The load here is hogs I started on a 4-CPU container. CI's contention is other
jobs on a runner, which I cannot reproduce. So "3 fail under this load" is a
demonstration that the class is live, **not** a prediction of CI's failure rate.

- [x] MEASURED AFTER: the full suite run repeatedly on a loaded machine and the
      pass rate reported — 2 quiet runs 0 fail, **1 loaded run 3 fail**, tables
      above. The box's suspicion of a single green run was correct.
- [x] the two named tests stop appearing — **confirmed under load**, 360.0 / 0.2 /
      0.1 ms against budget 5000; and the THIRD-file count is recorded here rather
      than in a new bean, as this box directs: **3 failures across 2 new files**.
- [ ] **OWNER DECISION:** the three above are a DIFFERENT cause set. Pursue them
      under this bean (its own instruction keeps the count here), open a bean per
      cause now that the causes are distinguishable, or leave them recorded and
      unworked? Not chosen here — it is a scope call, and the evidence for each
      remedy is in the table above.


## The class MEASURED: it is a budget-to-cost mismatch, not ~70 slow tests — 2026-09-27

The three failures above are fixed (hoisted to module scope, #1471, merged
`967f4e9922a`) and **a fourth appeared in the very next loaded run**:

    skill coverage > every resolvable skill is a node in the exported graph  5312 ms
    cat-harness/scripts/tests/skill-coverage.test.ts:94

| | before #1471 | after |
|---|---|---|
| loaded result | 12241 pass / **3 fail** | 12291 pass / **1 fail** |
| wall clock | 555.8 s | **640.8 s** (harsher load) |

So the three targeted ones stayed fixed under a HEAVIER load, and the class did
not close. Whack-a-mole, and the distribution says why.

### Per-test times from both loaded runs

| ≥ share of the 5000 ms default | run 1 | run 2 |
|---|---|---|
| ≥ 5000 ms (100 %) | **12** | **10** |
| ≥ 4000 ms (80 %) | 23 | 20 |
| ≥ 3000 ms (60 %) | 35 | 29 |
| ≥ 2500 ms (50 %) | 50 | 49 |
| ≥ 2000 ms (40 %) | 70 | 69 |

### The load-bearing row is the first, read AGAINST the failure count

Twelve cases exceeded 5000 ms and **three** failed. Ten exceeded it and **one**
failed. Therefore **at least nine tests already run past the default budget and do
not fail**, because they carry their own — `declared-directory-resolves.test.ts` at
**22158 ms** with a budget DERIVED from its module count (600 ms/module) is the
clearest case, and it is correct.

**That reframes this bean.** The problem is not "≈70 slow tests". It is that **a
test's budget bears no systematic relationship to its cost**: a handful derive one
and work at 22 s, while every other test silently inherits 5000 ms. A failure is
then whichever default-budget test happens to sit nearest the line when the machine
is busiest. Fixing the three that failed surfaced a fourth because the population
was never those three.

It also settles, with a number, why `## What a fix is NOT` is right about a raised
timeout and yet `declared-directory-resolves` is not violating it: a **derived**
budget grows with the population it measures, so it is the one form that does not
decay. Nine tests already rely on that and none of them is a defect.

### The three remedies, unchanged, plus what a systemic answer would look like

Hoist (shared expensive work), derive (irreducible cost), eliminate (spawns it does
not need) — all three already have precedent here, and all three are per-test.

What does NOT exist is anything that makes the mismatch VISIBLE. Nothing reports
"this test costs 73 % of its budget", so every instance has been discovered by a
red run on somebody's machine. A gate over the junit timings could say it, and
`declared-directory-resolves`'s own docblock already names the failure mode it would
catch — *"green on CI, red on a contributor's laptop, and nothing saying which"*.
**Deliberately not proposed as chosen work**: it is a new instrument, which is the
owner's call, not an agent's.

- [ ] **OWNER DECISION, now with the size of the class attached** (it previously
      read as three failures of an unknown population): ~9 tests are over budget
      and correctly carry their own; ~50 sit at half the default. Fix the one live
      failure (`skill-coverage`) and stop; keep fixing per-test as they surface;
      build the instrument that makes cost-vs-budget visible; or leave it recorded.
      Not chosen here.


## The owner chose BOTH: the instrument, and keep fixing as they surface — 2026-09-27

### `check:test-budgets`, and the distinction it rests on

`cat-harness/scripts/check-test-budgets.ts`. It reads a junit report and, for every
case, decides from the SOURCE whether the test declares its own budget — then gives
a share of the 5000 ms default only to the ones that do not.

That split is the whole tool. Assuming 5000 ms everywhere is what made the earlier
counting useless: **it reports nine-plus correct tests as the worst offenders.**
`declared-directory-resolves.test.ts` runs 22 s green on `modules.length * 600`.

The budget is read from the AST and never evaluated. A declared budget is an
arbitrary expression, so its VALUE is not statically knowable — and does not need to
be, because the only question is whether the author budgeted the test at all, which
is the presence of a third argument. Ranges rather than lines, because the runner
attributes a case to the call's line or its name's, and a `test(` spanning thirty
lines makes those differ — which is exactly the shape of the one test this most needs
to classify correctly.

### It cross-validates the arithmetic on this bean

Earlier I derived *"at least nine tests already run past the default and carry their
own"* from 12 over-budget cases against 3 failures. Measured directly by the tool:
**30 cases declare a budget** (24 in the earlier run). Two independent methods, and
the bound holds.

    run 1 (3 fail)   12300 cases   24 declared   4 default-budget over 5000 ms
    run 2 (1 fail)   12348 cases   30 declared   1 default-budget over 5000 ms

### THE OBVIOUS READING IS WRONG, and it is measured

A share over 100 % does **not** predict a timeout. Run 1 had **four**
default-budget cases over 5000 ms and **three** failures. The fourth —
`tests/tools.test.ts:204` at **5.22 s**, declaring no budget anywhere in its file —
**passed**, and passed again at 4.23 s in run 2.

So junit's `time` and the quantity bun charges against the timeout are not the same:
`time` is the outer measurement and includes work the budget does not. The share is
therefore a **ranking of exposure, not a prediction**, and the tool says so in its
docblock and in its own output. Calling >100 % "will fail" would have been a
confident false claim about a passing test, on the very run that motivated the tool.

The ranking still does the job: the three highest-share default-budget cases in run 1
were exactly the three that timed out.

### Two deliberate refusals, both with precedent here

**No sidecar.** Every other auditing tool here commits one, and the reason is sound —
a printed verdict cannot tell "never measured" from "measured clean". It does not
apply, because **a timing is a fact about the machine, not the repository**.
Committing the milliseconds would pin this container's numbers as the corpus's, which
is `3vc1`'s defect. `check:ci-health` carries the precedent: a fact *about* the
repository rather than one it *holds* is asked externally every run and cached
nowhere.

**Not a pass/fail gate.** ~32 cases sit at half the default under load. A threshold
gate needs all of them acknowledged on day one, and 50 exemptions nobody has read is
the empty exemption `xd1g` removed a gate for. Exit 0 or 2, never 1 (`nytj`); 0 cases
is exit 2, not a clean run over nothing (`6tkl`).

Named `check:test-budgets` rather than `test:budgets` after the census caught it:
`checkScriptNames` selects `check:*` / `*:check`, so the original name sat outside the
wiring audit entirely and its `SCRIPT_EXEMPTIONS` row was stale by construction.
`check:environment` and `check:bun-runtime` are the precedent — reports that exit 0/2
and still carry `check:` names so the census sees them.

### The live failure, fixed — the FOURTH in this family

    skill-coverage.test.ts:94   every resolvable skill is a node in the exported graph
    5312 ms (timed out)  ->  19.3 ms

Same remedy as the other three: `await buildExport(...)` hoisted out of the test body
to module scope, which belongs to no test's timeout.

### And the next ones are now NAMED rather than waiting to be discovered

From run 2, default-budget cases by share — this is the deliverable:

    4.77 s   95 %  tests/fsh-guts-export.test.ts:100   the main graph still does not mention fsh-guts at all
    4.45 s   89 %  tests/tools.test.ts:43              every satisfies names a skill that exists
    4.43 s   89 %  tests/kg-export.test.ts:479         a preview says so in its type and links every node back
    4.27 s   85 %  tests/fallback-roles.test.ts:55     a skill with no human-only lane derives nothing
    4.23 s   85 %  tests/tools.test.ts:204             io IRIs follow the publication base

### Verification

15 new tests (fixtures plus one corpus case asserting
`declared-directory-resolves` IS seen to declare a budget — if it were not, the tool
would report the repository's best-behaved slow test as its worst offender).
`bun run cat gates` **170 of 170**, tree clean afterwards. `tsc` and `eslint` clean.

- [x] **OWNER DECISION** — **BOTH (1 and 3)**, 2026-09-27: the instrument is built
      (`check:test-budgets`) and the live failure is fixed (`skill-coverage`).
- [ ] Standing, per that decision: keep fixing per-test as they surface. The five
      named above are the queue, worst first, and no longer need a red run to find.


## Working the named queue — 3 of 5 down, and the 4th is NOT a hoist — 2026-09-27

`check:test-budgets` named five default-budget tests by exposure. Three are fixed by
the module-scope hoist, measured individually:

| test | before | after |
|---|---|---|
| `fsh-guts-export.test.ts:100` | **4.77 s** (95 %) | **16.9 ms** |
| `tools.test.ts:43` | **4.45 s** (89 %) | **23.4 ms** (file max) |
| `tools.test.ts:204` | 4.23 s (85 %) | — same file, same change |
| `kg-export.test.ts:479` | **4.43 s** (89 %) | **96.1 ms** (file max) |

`tools.test.ts` was two of the five in one file, and the cause was **five tests each
calling `checkTools()`** and paying the full scan. Safe to share because nothing in
that file mutates the corpus — all five calls are no-arg and no test writes a fixture
— so five runs could only ever produce the same answer.

`kg-export.test.ts:479` **finishes what bean `w82m` started.** That session hoisted
the CANONICAL export out of this very test, recording in a comment that building it
in the body put the test at ~5.2 s, over budget — and left the PREVIEW build in.
Measured a year of commits later: 4.43 s, over budget again, same reason, one build
down. A hoist that leaves a sibling build in the body buys one round.

### The fifth is a PRODUCTION fix, not a test one — and it is the more valuable find

`fallback-roles.test.ts:55` at **4.27 s** (85 %) does not yield to a hoist, because
its three calls pass DIFFERENT skill names. Read the callee:

`fallbackRoleFor(root, skill)` in `check-fallback-roles.ts:240` iterates
`workflowFiles(root)` and `await loadProcessModel(f)` for **every `.bpmn` in the
repository**, and only then filters by `skill`. So the expensive half — parsing every
diagram — is identical on every call and redone each time. The skill argument narrows
nothing that was not already computed.

That is the `gitFileCommitSha` shape exactly: not a test-budget quirk but a cost every
caller pays, with the test merely being where it became visible. The remedy is
memoising the parsed model per path, and **mtime invalidation is available here**,
which is better than the HEAD-keyed cache that question needed for git — it is
per-file and precise, so a long-running MCP server cannot hold a stale diagram.

Deliberately NOT done in the same change as three test hoists: it touches production
code on a path the MCP server uses, and bundling it would put a behavioural change
in a commit whose stated subject is test scoping.

- [ ] Standing queue, updated: `fallback-roles.test.ts:55` remains, and it wants
      `loadProcessModel` memoised per path with mtime invalidation rather than a
      hoist. Re-run `check:test-budgets` on a loaded suite afterwards — each round so
      far has revealed the next-nearest, which is the point of having the list.


## The fifth queue item, done — and my proposed MECHANISM was wrong — 2026-09-27

### Retracting what this bean said one entry ago

I wrote: *"the remedy is memoising the parsed model per path, and **mtime invalidation
is available here**, which is better than the HEAD-keyed cache that question needed for
git."* **I asserted that before reading `loadProcessModel`, and it is unsafe.** Read:

- It threads `seen` through its recursive descent to refuse a call-activity cycle —
  `const path = [...seen, proc.id]`, then `path.includes(node.calledElement)` throws.
  A model cached under one call path and returned under another **skips a refusal that
  is the entire point of the parameter.**
- `normaliseOwnExtensions(rootElement)` **mutates the parse tree in place**, so sharing
  a parsed model across callers shares mutable state.
- **160 call sites.**

A cache keyed on path alone would have been a correctness bug in a cycle detector, in a
function with 160 callers, shipped as a performance fix. Measured nothing; read the
code and the claim collapsed.

### What the cost actually was — worse than the test suggested

The test was the symptom. `src/index.ts:94` ran `await fallbackRoleFor(instance, s.id)`
**in a loop over every skill**, and the comment directly above it already noticed that
*"the derivation reads every BPMN in the corpus"* — it hoisted the call out of a
synchronous predicate and left the repetition.

Measured on this corpus, **74 diagrams and 23 skills**:

| | |
|---|---|
| one `fallbackRoleFor` call | **1745.8 ms** |
| the loop over all 23 skills | **26016.8 ms** |
| `fallbackRolesBySkill`, one pass | **1417.6 ms** |
| disagreements between the two, all 23 skills | **0** |

**~18x off a user-facing operation.** I nearly wrote "~15,000 parses" from 276 skills —
`loadSkillNeeds` returns **23**, not 276, and 276 is the skill count across packages.
Measured instead: 23 x 74 = 1702 parses where 74 would do.

### The fix is a single pass, NOT a cache — and that is why it has no staleness question

`fallbackRolesBySkill(root)` builds skill -> roles in one pass; `fallbackRoleFor`
delegates to it, keeping its signature and its cost. Nothing outlives the call, so
none of the three hazards above applies, and there is no invalidation question to get
wrong. Equivalent rather than similar: the three conditions (the node's skills, its
fulfilment kinds, its `roleRef`) are independent per node, so filtering kinds and
`roleRef` first and then attributing to each of the node's skills selects the same
pairs.

### My own test committed this bean's defect, and the fix is the taxonomy applied

The first equivalence test compared all 28 batch entries against the single-skill path
— 28 full passes, **36 s**, and it **timed out** on the 5000 ms default. The test
proving the fix paid the pre-fix price.

Fixed with all three moves from this bean rather than a raised number:

1. **Hoist** — the batch is built at module scope, charged to no test's budget.
2. **Derive** — the remaining budget is `SAMPLE.length * 5000`, ~3.3x the measured
   quiet cost, matching `declared-directory-resolves`' ~3.5x, so it grows with the
   corpus.
3. **Bound** — the exhaustive version added **34 s to a ~270 s suite, 13 % on every
   run for every contributor, forever**, to re-check a property whose structural
   argument is in the code. It is now a **regression detector over a fixed sample of
   6**, labelled as one, and the full 28-skill comparison is recorded above as having
   been run once by hand with 0 disagreements. File cost: 4.2 s -> 13.2 s, not 38 s.

Spending 13 % of every suite run to verify a performance fix would have been this
bean's own defect committed by its own fix.

### Verification

`bun run cat gates` **171 of 171**, tree clean. 17 tests in the file (was 14), `tsc` exit 0
— it caught a real `string[] | undefined` in my first draft, fixed by holding the
sample as entries rather than asserting the non-null away. `eslint` clean.

- [x] Standing queue item `fallback-roles.test.ts:55` — done, and it was a production
      fix of ~18x rather than a test-scoping one. The mechanism first proposed here was
      wrong and is retracted above.
- [ ] Re-run `check:test-budgets` on a loaded suite: every round so far has revealed
      the next-nearest test, which is what the list is for.


## The loop CLOSED: the instrument predicted the next failure, and the class shrank — 2026-09-27

Third loaded run, same recipe (6 hogs on 4 CPUs), after the five queue items landed:

    12370 pass / 56 skip / 1 fail    632.4 s    547 files

### The instrument named the failure BEFORE it happened

The one failure is `staging-stamp.test.ts:52` at **5097 ms** — and it was **7th on the
exposure list** from the previous run, at 4.02 s (80 %), with no red run anywhere in its
history. That is the whole purpose of `check:test-budgets` discharged: the next failure
arrived from a list rather than from a surprise.

### The CLASS shrank, which the whack-a-mole reading did not predict

Default-budget cases by share, as the tool reports them across all three loaded runs:

| ≥ share of the 5000 ms default | run 1 | run 2 | run 3 |
|---|---|---|---|
| ≥ 5000 ms (100 %) | 4 | 1 | **1** |
| ≥ 4000 ms (80 %) | 11 | 7 | **1** |
| ≥ 3000 ms (60 %) | 22 | 12 | **5** |
| ≥ 2500 ms (50 %) | 37 | 32 | **14** |
| ≥ 2000 ms (40 %) | 56 | 51 | **35** |

**Fixing five tests improved dozens.** Hoisting `checkTools()` and the exports removed
work that many tests in those files SHARED, so the population at ≥80 % went 11 → 1 and
at ≥50 % went 37 → 14. Earlier entries on this bean framed each round as revealing the
next-nearest test, which was true and incomplete: it also moved the whole distribution.

### This round

    staging-stamp.test.ts:52       5097 ms (timed out)  ->  off the file's top 3
    fallback-roles.test.ts:56      3.93 s (79 %)        ->  off the file's top 3

`staging-stamp` is the same hoist as the five before it. `fallback-roles.test.ts:56` was
two full passes over 74 diagrams, and the second — `no-such-skill-anywhere` — asserted a
claim the absence test added in the previous commit already makes **through both paths
rather than one**. So that line moved rather than went, and the comment left in its place
says so; the file still contains the skill name.

### One thing about my OWN addition, so it is not read as an oversight

The bounded cross-check `the same roles come back for 6 sampled skills` is now the
largest test in `fallback-roles.test.ts` at **6858.5 ms** — 6 single-skill passes at
~1.15 s each. It passes because it DECLARES a derived budget
(`SAMPLE.length * 5000`), which also means **`check:test-budgets` will never surface
it**, by design: the tool gives a share only to tests inheriting the default.

That is ~2.5 % of a ~270 s suite spent cross-checking an ~18x production change, and it
is deliberate. Recorded here because a budgeted test is invisible to the instrument, so
the next reader would have no way to tell a considered cost from a forgotten one.

- [x] Re-run `check:test-budgets` on a loaded suite — done, and it predicted the
      failure it was built to predict.
- [ ] Standing: `instance-render.test.ts:212` (68 %) and `audit-coverage.test.ts:265`
      (66 %) now head the list. Nothing is over budget but the one just fixed.

## Completed on landed evidence
Landed on main in PR #1461 / commits 91ff40996783, fb3d9f15de02 (test execution contention resolved via module-scope single pass).
