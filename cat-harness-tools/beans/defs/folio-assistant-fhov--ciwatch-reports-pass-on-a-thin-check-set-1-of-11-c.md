---
# folio-assistant-fhov
$schema: bean/1.0.0
title: 'ci:watch reports PASS on a THIN check set: 1 of 11 checks looks identical to all green'
status: completed
type: task
priority: normal
created_at: 2026-09-30T19:07:23Z
updated_at: 2026-09-30T19:48:42Z
parent: folio-assistant-1xhc
---

Found by the tool's own author, one session after building it, while using it
to decide a merge. That is the interesting part: `check-verdict.ts` was written
this session **specifically** to stop CI state being misread, and it handled
the zero case on purpose while leaving the one case wide open.

## Measured

PR #1671, head `a3e27f6b0e1`, 2026-09-30:

```
$ bun run cat ci:watch a3e27f6b0e1
19:05:47  a3e27f6b0e1  PASS — 1 check(s) completed clean
```

The commit's full check set at that moment:

```
total_count: 1
  completed  success  .jsonld siblings in sync with .ts manifests
```

`pull_request` workflows had not fired at all. Comparable PRs the same hour
carried **9 to 11** checks. Other branches' `pull_request` runs were firing
normally, so this was not a repo-wide outage — #1671 simply had none.

**The verdict was `pass` and the PR was untested.**

## Why the existing guard did not catch it

`verdictOf` already treats an EMPTY list and an unreadable response as
`undetermined` — bean `dh4f`, *"a check set that is vacuously satisfied is not
a green one"*. One passing check is not vacuous, so it falls straight through
to `pass` at the end.

That is `3pqn` restated with a different denominator: *a PR that opens with
ZERO checks looks exactly like one whose checks are green* — and a PR that
opens with ONE looks even more like it, because the zero guard fires and this
one does not.

## What it cannot know, and what it can

The function takes a check list and nothing else, so it has no notion of how
many checks to EXPECT. Three ways to give it one:

1. **A named minimum set.** A hardcoded list of hard gates. Rejected on the
   same grounds `gates.ts` derives its list from the workflow file rather than
   restating it: a list is a thing that drifts, and this one would drift
   silently toward being satisfiable.
2. **The BASE BRANCH's own check set as the expectation.** Derived, not
   declared. If `main`'s head carries eight hard gates and this commit carries
   one, the set is thin and the answer is `undetermined` — the same third state
   the file already has, reached by a second route.
3. **Report the count and leave it to the reader.** Weakest: it makes the tool
   correct only when somebody notices, which is what already failed here.

(2) looks right and is the only one that cannot rot, but it is a real design
question — it makes the verdict depend on a second fetch, and on a base branch
that may itself be mid-flight. **Not decided here.**

## Interim discipline, since the tool is in use now

Do **not** merge on `PASS` alone. Read the count in the same line and compare
it against what comparable PRs on this repo carry (9–11 today). A single-digit
count that is not the full set is `undetermined` whatever the word says.

## Done when

- [ ] a thin check set is `undetermined` rather than `pass`, by a rule that is
      derived rather than listed
- [ ] the rule is FALSIFIED — a commit with a deliberately reduced set must
      make it exit 2, or it is a guard that cannot fire, which is this epic
- [ ] the `because` string says how many were expected and from where, since a
      reader cannot act on "thin" without the denominator

## Not established

Why #1671's `pull_request` workflows never fired. That is a separate question
from this one, and conflating them would let a tool fix stand in for an
infrastructure answer. This bean is about the REPORT being wrong, which would
matter even if every workflow always fired.


## CLOSED by evidence — `main` already fixed this, independently

Recorded 2026-09-30. Closed on **evidence, not authorship**
(`bean-coordination` §"Closing a bean whose work has already landed").

`main` carries **`32779147214`** — *"ci:watch reads a partial check set as
green — ask the machinery that already answers it (#1646)"*. Another session
found the same defect and fixed it, on an owner ruling from 2026-09-24:
*"derive the owed workflows"* rather than list them — which is (2) of the three
options weighed above, and for the reason given there: a list is a thing that
drifts.

### The evidence, from a live run rather than from reading the commit

The fix reported on my own PR while I was still writing this bean:

```
19:20:39  67d1d9432a2  UNDETERMINED — every registered run is clean, but
          1 workflow(s) OWED for this event have no run — a partial check set,
          not a green one   Code-quality gates
```

That is this bean's subject, caught, named, and given the third state. A green
run also now says *"and every workflow owed for this event ran"*, so the
denominator is stated rather than implied — which is the third `Done when`
above, met.

### What I got wrong, recorded because it is the useful part

I wrote this bean claiming an open defect **while the fix was already on
`main`**, and only noticed when its output appeared in my own terminal. That is
the third time in one hour I duplicated a sibling session's work, and the
common cause is not the tool: it is that I did not re-read before acting.

### Not closed by this

**Why #1671's `pull_request` workflows never fired.** Separate question,
answered separately and NOT conflated with the report being wrong: the PR was
`mergeable_state: dirty`, so GitHub could not compute a merge commit and the
workflows had nothing to test. The report would still have been wrong if every
workflow always fired — which is why this bean was worth writing even though
its fix already existed.
