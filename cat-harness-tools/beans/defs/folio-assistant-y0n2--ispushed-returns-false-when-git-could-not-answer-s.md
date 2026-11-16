---
# folio-assistant-y0n2
$schema: bean/1.0.0
title: isPushed() returns false when git COULD NOT ANSWER, so a transient git failure reads as 'you never pushed' — and it made a test fail in the suite and pass alone
status: completed
type: bug
priority: normal
created_at: 2026-09-27T05:11:35Z
updated_at: 2026-09-27T07:46:48Z
parent: folio-assistant-1xhc
---

Found 2026-09-27 while hunting `9v4m`'s remaining clause. Not the test I was
looking for, and a better finding than the one I was after.

## The defect

`isPushed` in `cat-harness/scripts/check-head-has-run.ts:360`:

    export function isPushed(repo: string, sha: string): boolean {
      try {
        return execFileSync("git", ["-C", repo, "branch", "-r", "--contains", sha], {
          encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
        }).trim() !== "";
      } catch {
        return false;
      }
    }

**`catch { return false }` conflates two different facts**: "git answered, and no
remote-tracking branch contains this commit" with "git did not answer". The
second is a could-not-determine, and this repository states the rule in a dozen
places — `ci-health`, `health`, `audit-coverage`, `readme-sections` — as
*could-not-determine is never rendered as clean*. Here it is rendered as a
VERDICT, and the verdict is the wrong one.

It is also silenced twice over: `stdio: ["ignore", "pipe", "ignore"]` discards
stderr, so the reason git failed is not merely unreported, it is unavailable.

## Why it matters beyond a test

This boolean chooses what a person is TOLD. Bean `sddf` is about exactly that
advice — the old message asserted *"It IS pushed, so this is bean 3pqn: the event
was dropped"* and told the reader to dispatch a workflow, which `yv4z` measured
as unsafe on a conflicted PR. So a `false` from a transient git failure sends
somebody down the "you have not pushed" branch when they have, and a `true` is
the branch `sddf` already had to make safe.

## The measurement

Full `bun test`, clean tree, 2026-09-27: **12104 pass / 56 skip / 1 fail**, and
the one failure was

    (fail) pushed or not, because the two need different advice >
           a commit on a remote-tracking ref reads as pushed [22671.80ms]

`cat-harness/scripts/tests/head-has-run.test.ts:135`. Run directly, the same
logic passes:

    origin/main resolves: 81586293ea5f
    sha used:             81586293ea5f    isPushed: true
    git branch -r --contains <origin/main>  ->  origin/claude/brave-hypatia-r820sf, origin/main   rc=0

So `git` agrees the commit is on a remote-tracking ref. The only route to `false`
is the `catch`. **22.7 seconds** for two git calls is the corroborating detail:
consistent with git blocking under contention — a 523-file suite runs plenty of
concurrent git, and `.git` locking is exactly the transient this `catch` eats.

NOT established: which git invocation failed, or why. That is unavailable BY
CONSTRUCTION, because stderr is discarded — which is itself the strongest
argument for the fix.

## A red herring worth recording, because I nearly followed it

The failure line sits immediately after these, in the same file's output:

    … attempt 1 failed (network is unreachable); retrying in 1367ms
    … attempt 2 failed (transient failure); retrying in 2279ms

They look like the cause and are not: that file STUBS `fetch` and those lines are
a deliberately-passing test exercising the retry path (`a thrown fetch is retried,
and THEN cannot-ask with the reason`). Expected output from a green test, adjacent
to a red one. The identical trap cost this session time once already — the
`✗ no-such-doc` line on bean `9v4m`, also a passing test's own diagnostic.

## Candidate fix — NOT applied, it is somebody's API decision

Return a third state rather than a boolean: `"pushed" | "not-pushed" | "cannot-tell"`,
with the caller saying what it does on the third. Capture stderr instead of
discarding it so the reason survives. That changes a signature other code reads,
so it is not a drive-by.

Cross-references: `sddf` (the advice this boolean selects), `9x9r` (the same
script passing on ANY run naming the sha), `h2s9` (a neighbouring check whose
`unknown` was collapsed the same way), `9v4m` (the suite-only/isolation-passes
shape).

## Done when

- [x] `isPushed` cannot return a verdict when git did not answer. MEASURED AFTER:
      with `git` made to fail (an unreadable `.git`, or a stubbed failing
      `execFileSync`), the caller reports could-not-tell and NOT "not pushed"
- [x] the failure reason is available — stderr captured rather than discarded
- [x] the test no longer depends on a boolean that swallows errors, so it stops
      being suite-only flaky


## Summary of Changes

Landed on `claude/brave-hypatia-r820sf` (commit `97c11285841`), and CI green on that
head and every one since. Closed on EVIDENCE re-measured after the fact rather than
on authorship — the three boxes above were ticked against the tree, not from memory.

`isPushed(): boolean` became `pushedState(): "pushed" | "not-pushed" | "cannot-tell"`,
using `spawnSync` so a non-zero exit is DATA rather than a throw. The caller exits
**2** on `cannot-tell`, matching the `cannot-ask` idiom already used elsewhere in the
same script, so a transient git failure can no longer be read as "you never pushed".

`lastPushedReason()` exposes the reason, which was previously discarded outright:
the old call passed `stdio: ["ignore", "pipe", "ignore"]`, so stderr went nowhere and
a failure had no diagnosis at all.

The test now asserts `toBe("pushed")` rather than `not.toBe("not-pushed")`. That is
the point of the third box and not a style preference: with three states, a negative
assertion is satisfied by `cannot-tell`, which would reinstate exactly the defect
this bean is about. A new case, *"git unable to answer is `cannot-tell`, NOT
`not-pushed`"*, points the function at a non-repository and pins the third state.

Verified on the current head: `pushedState` present at 2 call sites, no `isPushed`
function remains, and both assertions are in `head-has-run.test.ts`.
