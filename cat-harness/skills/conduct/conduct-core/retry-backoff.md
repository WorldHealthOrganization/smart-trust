---
name: retry-backoff
description: >-
  Every error gets a falling-off retry rate — each wait doubles, with jitter.
  Read before writing any call that can fail transiently, and before deciding
  that a failure is worth retrying at all. Exhausting the retries does not
  change the verdict.
# consulted: reference material nobody performs — a PRINCIPLE, not a procedure: every heading is an argument ("Retrying a definitive answer is not caution", "Jitter is not decoration here"), and it names no actor and no trigger. It is read when writing retry code, never performed as a step.
consulted: true
---

# A falling-off retry rate, on every error

**Every error gets a falling-off retry rate.** `src/core/retry.ts` is that
rule as code — `withBackoff`, `classifyResponse`,
`waitFor`. Use it rather than writing a loop; a retry policy invented per
call site is a policy nobody can change in one place.

## From a shell script or a workflow, call `backoff-sleep.ts`

**"Use `retry.ts`" does not cover a `run:` body**, which cannot import
TypeScript.

So, from shell:

```sh
bun run cat-harness-tools/scripts/backoff-sleep.ts --attempt "$attempt"
```

It calls `waitFor` directly, so a workflow and `withBackoff` compute the same
number from the same code. Do **not** write a shell function instead: copied
into several `run:` bodies it is several implementations again, and copies
drift apart with nothing saying so.

`retry-backoff-in-workflows.test.ts` is the enforcement, and it pins the
*property* — a loop that retries does not compute its own wait — rather than
any spelling. A loop reaching the shared implementation some other way passes.

One number to read correctly: the cap applies to the **ideal** wait, before
jitter. `waitFor` caps `baseMs * 2 ** (attempt - 1)` and then multiplies by
`[0.5, 1.5)`, so an actual wait runs to 1.5x the cap — 24 s against a 16 s
cap.

## Retrying a definitive answer is not caution

A retry is for a **transient** failure. Re-reaching a `404` only delays the
report of it.

| retry | do not retry |
|---|---|
| the call threw — socket, DNS, timeout | `400`, `401`, `404`, `422` — an answer |
| `5xx` — the far side is unwell, the question stands | `403` **permission** — more tries will not grant it |
| `429`, honouring `Retry-After` over the doubling | `403` **rate limited** — the reset outlives any backoff |

`403` means two different things and the response says which:
`x-ratelimit-remaining: 0` is a rate limit, anything else is permission.
Neither is retried, and they are reported differently.

## Exhausting the retries does NOT change the verdict

When the last attempt still fails, the answer is **could not determine** — the
same third state it would have been with no retry at all. Backoff makes that
state rarer. It never converts it into a pass or a finding.

A check that retried and still could not look has **not** established
anything, and must not render as clean
([`ci-health`](../../process/process-core/ci-health.md)).

## Jitter is not decoration here

Several agent sessions run against this repository at once, for example
pushing to `gh-pages`. Sessions that fail together and retry on the same doubling schedule retry **together**,
which is the thundering herd that keeps the far side down. Each wait is
multiplied by a random factor in `[0.5, 1.5)`.

## Inject the clock, or the code is untestable

A retry loop with real sleeps takes 1 + 2 + 4 + 8 s, past any sane test
timeout.

So `withBackoff` takes `sleep` and `rand`, and any function wrapping it should
pass its options through. A test then asserts **how many attempts were made**
and **which failures were retried**, which is the behaviour worth pinning —
not that a timer elapsed.

## Where it is already applied

| call site | why it matters there |
|---|---|
| `scripts/check-head-has-run.ts` | asks GitHub whether a commit has a run; a blip would read as could-not-ask |
| `scripts/check-prs-have-runs.ts` | the PR listing fails the WHOLE sweep, where one PR's failure only makes that row `unknown` |

Git operations follow the same shape by convention —
`git push -u origin <branch>`, retried with 2s, 4s, 8s, 16s on a **network** error, never on a
rejected push.

## Related

| | |
|---|---|
| the three states, and never rendering the third as clean | `ci-health` |
| do not encode a constraint you have not verified | [`unverified-constraints`](unverified-constraints.md) |
