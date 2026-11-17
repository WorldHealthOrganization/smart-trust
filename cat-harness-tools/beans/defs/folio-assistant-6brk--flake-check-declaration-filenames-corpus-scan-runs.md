---
# folio-assistant-6brk
$schema: bean/1.0.0
title: 'FLAKE: check-declaration-filename''s corpus scan runs 4.2s against a 5000ms test budget on a clean main — any corpus growth tips it'
status: completed
type: bug
priority: normal
created_at: 2026-09-24T06:21:41Z
updated_at: 2026-09-24T19:53:28Z
parent: folio-assistant-1xhc
---

`check-declaration-filename.test.ts` scans the whole markdown and workflow
corpus. **Measured 2026-09-24, directly, three runs per tree:**

| tree | ms per `checkDeclarationFilename()` |
|---|---|
| clean `main` | **4476, 4198, 3927** |
| `main` + ~150 lines of markdown (PR #1188) | **4927, 4216, 4249** |

The test budget is **5000 ms**. So on a clean `main`, before anybody adds
anything, the scan already sits at **84–90 % of its own timeout**.

## Why this is a defect rather than a slow test

**A gate that fails for a reason unrelated to the change teaches people to
re-run reflexively instead of reading the finding.** That is the argument
`xgd8` already made when it dropped `line` from the schema projection — *"if a
red can be caused by a change that alters nothing the artefact describes, the
artefact is carrying something it should not"* — and it applies to a budget as
much as to a payload.

Here the red says *"this test timed out after 5000ms"*, which names nothing a
contributor can act on, and it fires on **whichever** corpus-scanning test
loses the race that run. Observed across three full-suite runs on one branch:
`the markdown corpus … carries no STALE PATH`, then `and was actually examined`,
then `this repository's own workflows carry no USE` — **three different tests,
same cause**. Nothing in any of those messages says "the corpus grew".

## Found how, and the honest attribution

Found while running `bun run cat gates` for PR #1188, which adds ~150 lines of
markdown across 12 files. The suite failed on my branch in 3 of 3 runs and on
clean `main` in 0 of 2, which **looked** like the change causing it.

It is not, and the direct measurement is what settled it rather than the run
counts:

- the other timing-out test, `docs-templates`, scans **6 files in ~90 ms**,
  byte-identical on both trees (same 6 files, same 30 findings) — my diff
  cannot have slowed it at all, so at least one of the three failures had
  nothing to do with the change;
- this one is genuinely corpus-sized, and my markdown adds roughly **250 ms to
  a 4.2 s baseline** — about 6 %;
- the failing test's **identity changed between runs on the same tree**, which
  a deterministic consequence of a diff does not do.

**So the change nudged a flake that was already there.** Saying it more
precisely than "pre-existing, not mine": the baseline is the defect, the diff
is a contribution to it, and the next skill anybody adds will tip it again
with no diff of mine involved.

## Not fixed here, and why not

Three candidate repairs, none taken: raise the budget, memoise the scan
(`docs-templates` calls its scanner **twice**, once per test, unmemoised), or
narrow what is walked. All three are code changes to a gate, and PR #1188 was
authorised for nine **prose** repairs to skills and beans. Changing a test's
timeout inside a documentation PR is how a real signal gets turned off by
somebody who was not looking at it.

## Done when

- [x] the scan's cost and the budget are not within 20 % of each other —
      by memoising, narrowing the walk, or raising the budget **with its basis
      stated**, not by tuning until green
- [x] a timeout in this family names the corpus rather than only the
      milliseconds, so the next contributor can tell "the corpus grew" from
      "my change is slow"
- [x] re-measured after the fix, both trees, three runs — the numbers above are
      the before



## Summary of Changes (2026-09-24)

Most of the fix had already landed (4bc98ea, 041c9d8):
- `check-declaration-filename.test.ts` shares ONE real-corpus scan across its three corpus tests, instead of scanning three times.
- Those tests carry `CORPUS_TIMEOUT = 30_000`, with its measured basis written beside it.

**Re-measured after the fix**, on `main` `324ca67`, three runs of `checkDeclarationFilename()`: **2795, 3252, 3163 ms over 1,379 files**. Against the 30 s budget that is 9–11 %, far from the 20 % line.

This commit adds the two remaining pieces:
- **The scan names the corpus.** `corpus()` times the scan. Past half its budget, it warns with the milliseconds, the file count and a pointer to the budget's basis. So "the corpus grew" is visible before it becomes a timeout, and a slow change can be told apart from a grown corpus.
- `docs-templates.test.ts` shares its scan between its two tests; it was calling the scanner twice with no argument.

Only one tree was measured here, not both of the trees in the table above: the PR #1188 tree is long merged, so the comparison against it is moot.
