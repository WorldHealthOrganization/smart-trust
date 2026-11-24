---
# folio-assistant-vxho
$schema: bean/1.0.0
title: A test 14% under the default timeout is a gate that fails on a busy machine, not a red one
status: completed
type: task
priority: normal
created_at: 2026-09-24T12:19:24Z
updated_at: 2026-09-25T16:37:25Z
parent: folio-assistant-1xhc
---

Recorded 2026-09-24 while running `bun run cat gates` on a two-markdown-file diff.

```
cat-harness/schemas/viz-generators.test.ts:
(fail) the readers agree with what the generators publish > a queue's
       declared intake is ONE unit, not one per file it carries [5683.71ms]
  ^ this test timed out after 5000ms.
```

**It is not a correctness failure and it was not the diff's.** The diff was two
bean markdown files. A re-run of the same tree gave `11228 pass, 0 fail`, and
the file alone passes in 1.52s.

**What makes it worth a bean rather than a shrug.** 5683ms against a 5000ms
default is not a race that happens once — it is a test whose *normal* runtime
is within a small factor of the limit, so whether the gate passes depends on
what else the machine is doing. That is the worst kind of red: it clears on
re-run, so it teaches everyone who meets it to re-run, and the rule here is
that flake is not a root cause.

**Why it is slow is the actual question**, and it should be measured before
anything is changed. The likely answer is that the test walks real repository
directories rather than a fixture, so it gets slower every time the repo grows
— which would mean the timeout is a symptom and raising it buys a few months.

## Done when

- [x] the test's runtime is MEASURED, not estimated, and the cause of the 5.6s named
- [x] if it walks the real tree, decide whether that is the point of the test or an accident of how it was written
- [x] the gate no longer depends on machine load — by making the test fast, or by an explicitly-reasoned timeout, never by a bare number

## MEASURED, and the guess in the paragraph above was RIGHT for the wrong reason

The bean guessed *"it walks real repository directories rather than a fixture,
so it gets slower every time the repo grows."* It does walk the real tree — but
growth is not what made it slow, and the fix that follows from growth (raise
the timeout, buy a few months) would have been the wrong one.

| measurement | |
|---|---|
| `readLibraryGraph` over the real repo, warm, quiet process | **~150ms** (142, 162, 167 over three calls) |
| the whole file in isolation | **1.55s** for 16 tests |
| the failing run, under the full suite | **5683ms** for ONE test, against a 5000ms limit |

So the test's own work is ~150ms and the full suite inflates it ~35x. That is
CONTENTION — hundreds of test files against one disk — not a test that has
quietly grown.

## The fix is structural, not a bigger number

`bun test` applies its timeout **per test**. The two graph readers were called
INSIDE test bodies, so that filesystem work sat inside the budget. They are now
read once at MODULE scope, before any test starts, and no test's budget
contains them.

That is not a trick to get under the number. These graphs are a **fixture**:
every test in the file asserts about the same repository, and reading it four
times was four answers to one question that were only ever equal by luck.
`readLibraryGraph` was called twice and `readSchemaGraph` twice; each is now
read once.

| | before | after |
|---|---|---|
| whole file, three runs | 1.58s, 1.55s, 1.55s | **1.03s, 1.06s, 1.11s** |

A third faster, variance under 5%.

## What is NOT demonstrated, said plainly

**The 5683ms failure was not reproduced.** It needs a loaded runner, and this
container could not be made to produce it on demand. So the fix rests on the
mechanism plus the reduction, not on watching the red turn green:

- the failure text attributes the 5683ms to the TEST, so the I/O was inside a
  per-test budget — that is what the fix removes;
- the same file now does half the filesystem work it did.

A check that would settle it: if this ever recurs on `viz-generators.test.ts`
after this change, the cause is elsewhere and this entry is the record of what
was already ruled out.

## Summary of Changes

`cat-harness/schemas/viz-generators.test.ts` — `SCHEMA_GRAPH` and
`LIBRARY_GRAPH` hoisted to module scope; four call sites became two reads.
No assertion changed.


---

## Re-derived and closed by another session, 2026-09-25

Found by `bun run cat beans:landed` as `done-ticked`. Closed on evidence re-run
here, not on the ticks — `bean-coordination.md` §"Closing a bean whose work has
already landed".

**Not mid-flight**: no `Claimed by` note, no open PR, and the last commit on
`main` touching this bean is its own merge (`c349c374`).

**Box 1 — runtime MEASURED.** Three standalone runs, 2026-09-25:

```
run 1: 2.02s   16 pass  0 fail
run 2: 2.40s   16 pass  0 fail
run 3: 2.02s   16 pass  0 fail
```

Against bun's 5000ms per-test default that is better than **2× headroom**,
where the bean opened at 5.6s — 14 % under, which is the margin that made it a
gate failing on a busy machine rather than a red one.

**Boxes 2 and 3 — the mechanism, read rather than assumed.**
`cat-harness/schemas/viz-generators.test.ts:33` carries it in the file itself:

> *THE GRAPHS ARE READ ONCE, HERE — not inside the tests that assert on them.*

`SCHEMA_GRAPH` and `LIBRARY_GRAPH` are module-level, so the filesystem work
happens once at import and sits outside any single test's budget. That is the
"explicitly-reasoned" half box 3 required, as against a bare raised number —
and it is why the fix does not decay as the repository grows, which was the
bean's own objection to raising the timeout.

The bean's diagnosis (**contention**, not growth) is consistent with what I
measured: the same test standalone is fast, so nothing about the test itself
was slow.
