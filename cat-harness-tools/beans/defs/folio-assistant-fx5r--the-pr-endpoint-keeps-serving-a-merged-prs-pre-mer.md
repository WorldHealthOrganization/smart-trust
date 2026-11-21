---
# folio-assistant-fx5r
$schema: bean/1.0.0
title: The PR endpoint keeps serving a merged PR's pre-merge view, and merge_pull_request reports success on it
status: completed
type: bug
priority: high
created_at: 2026-09-25T18:09:14Z
updated_at: 2026-09-26T12:12:45Z
parent: folio-assistant-1xhc
---

## What happened, 2026-09-25

I reported merging PR #1317. **It had been merged an hour earlier, by somebody
else.** Every check I made before saying so came from the PR endpoint, and the
PR endpoint was serving a view from before the merge — with nothing marking it
stale.

## The measurements, in the order they misled me

PR #1317's true state, read later from the same endpoint:

```
state=closed  merged=True  merged_at=2026-09-25T16:04:20Z
merge_commit_sha=d274ef63c70
```

Between **16:50 and 17:05**, three-quarters of an hour after that merge:

| call | answer | truth |
|---|---|---|
| `GET /pulls/1317` | `head.sha=5a02ac4b54d`, `mergeable=None`, `mergeable_state=unknown`, `updated_at=16:04:21Z` | merged at 16:04:20Z |
| `PUT .../update-branch` | *"merge conflict between base and head"* | **no conflict** — see below |
| `PUT .../update-branch` (retry) | *"expected head sha didn't match current head ref"* | its own branch API said otherwise |
| `PUT .../update-branch` (correct sha) | *"There are no new commits on the base branch"* | correct, finally |
| `PUT .../merge` | `{"sha":"d274ef63c70…","merged":true,"message":"Pull Request successfully merged"}` | **the PRE-EXISTING merge commit.** No merge was performed |

Against local git at the same moment:

```
git merge-tree --write-tree origin/main origin/claude/cool-fermi-htir5p   -> clean tree, no conflict
git merge origin/main --no-commit   -> "Automatic merge went well"; 0 unmerged paths
GET /branches/claude%2Fcool-fermi-htir5p  -> tip 57fd738d8b4 (my pushed merge)
```

So the branch API and the PR API disagreed about the same branch, and the PR
API was the stale one.

## The three failures, separated

**1. `merged` is the only field that goes stale-safe.** `head.sha`,
`mergeable`, `mergeable_state` and `updated_at` all keep serving the pre-merge
view, and none carries a staleness marker. An agent that asks "can this merge?"
without first asking "is it already merged?" gets a coherent, confident,
entirely obsolete answer.

**2. `update-branch` reports a CONFLICT for a CLOSED PR.** That is the one that
cost most, because it is not merely stale — it names the wrong cause. I built a
whole diagnosis on "false conflict while mergeability is uncomputed" (a
plausible reading, and `h2s9`'s subject) when the real cause was "this PR is
closed". A wrong error message is worse than a missing one: it is a hypothesis
handed to you with the authority of a measurement.

**3. `merge` on an already-merged PR returns SUCCESS with the old merge
commit.** `{"merged":true,"message":"Pull Request successfully merged"}` is
indistinguishable from having merged it. This is what turned a stale read into
a false report. I cannot tell from here whether that is GitHub or the MCP
wrapper; what is recorded is the observation.

## And a separate defect found in the same episode

**Pushing to a PR's head branch does not re-run its `pull_request`-triggered
gates.** After pushing `57fd738d8b4`:

```
17:04  success  JSON-LD generated-file drift   57fd738d8  (event=push)
04:54  success  Code-quality gates             5a02ac4b5  (event=pull_request)
```

`Code-quality gates` never fired on the new head. The head carried **one green
check and not the one that matters** — bean `3pqn`'s shape ("no checks is not
green") with a new cause: not zero checks, but the wrong subset, which reads as
green to anyone glancing. `workflow_dispatch` against the branch is what
produced a real verdict.

## What actually works

`git merge-base --is-ancestor origin/<branch> origin/main`, before anything
else. Applied to the seven remaining PRs it found **five already merged** —
which the PR endpoint would eventually have agreed with, but had not yet. That
one line is the difference between a merge run and five more false reports.

Same shape as `h2s9`'s remedy (`git ls-remote origin refs/pull/N/merge` rather
than `mergeable`): **when a forge API and git disagree about git, git is the
subject and the API is a cache.**

## Relation to `pesg`

`pesg` says: do not re-derive what an instrument has already computed. This is
the converse and it needs saying separately — **do not accept a remote API's
computed answer as current without a freshness check**, because unlike a local
instrument it has no way to tell you it is behind. Both are "a number that was
true when taken, quoted as if taken now"; they differ only in who took it.

## The call sites, measured 2026-09-26 — and this bean overstated the scope

I wrote "the sweep, `/watch`, `prepare-merge`, any merge helper" from memory.
Checked, two of the three were already right:

| site | state |
|---|---|
| `prepare-merge` (command + skill) | **already correct** — step 4 is `git merge-base --is-ancestor origin/<base> HEAD` |
| `/watch` | **nothing to fix** — it carries no mergeability logic at all |
| `check-head-has-run.ts` | **code correct, prose wrong** |

The sweep's own `mergeStateForHead` asks
`git ls-remote origin refs/pull/N/merge`, exactly as `h2s9` prescribed — but
both of its UNKNOWN messages told the reader to *"check `mergeable_state` by
hand"*. The code had the right instinct and the prose sent the reader the
other way, in the one branch where the operator has nothing else to go on.

Listing three sites when one was defective is the same failure this bean is
about, one level up: a claim written from memory rather than measured. Left
visible rather than quietly edited.

## Done when

- [x] `check-head-has-run.ts`'s two UNKNOWN messages name `merged` and the
      merge ref instead of `mergeable_state`, with the 45-minute measurement
      as the reason.
- [x] `prepare-merge` and `/watch` checked — already correct, nothing to do.
- [x] Refreshing a PR's CI documented as `workflow_dispatch`, not a push, in
      the module whose subject is "is a run owed here".
- [x] `h2s9` cross-references this, and this one says plainly that a wrong
      error string is worse than an absent one.
- [x] Nothing gates the prose: a future edit can point "by hand" back at the
      field. Two tests now pin the REFERENT, which is the cheap half; a
      general rule (no advice string names `mergeable_state` approvingly)
      would be the whole one. **`check:stale-field-advice`, 2026-09-26** —
      see the section below for what it measures instead of "approvingly",
      and the two sites it found that I had not.

---

## 2026-09-26 — a THIRD copy, and it is the answer to this bean's open item

This bean's last unchecked item is *"nothing gates the prose generally"*. It
has now cost something concrete.

PR #1362 fixed the two advice strings in `scripts/check-head-has-run.ts`.
**`.github/workflows/pr-checks-present.yml` carries its own third copy**, and
it was not touched, because nothing links them. Found by reading run 133's log
rather than the file — the pre-`fx5r` text was being posted to live PRs hours
after the fix merged.

The drift is PARTIAL, which is the part worth keeping:

| | the merge-ref probe (code) | the UNKNOWN advice (prose) |
|---|---|---|
| `check-head-has-run.ts` | ✅ correct | ✅ fixed by #1362 |
| `pr-checks-present.yml` | ✅ correct, line 163 | ❌ pre-`fx5r`, line 192 |

**The code was right in both places and the prose in only one.** A reader who
checked whether the fix had landed by grepping for `ls-remote` would have found
it in both and concluded the job was done.

Aligned now. But that is the instance, not the fix: a fourth copy is free to
appear tomorrow. The general rule this bean asks for — *no advice string names
`mergeable_state` approvingly, anywhere* — would have caught this one, and is
still not written.



## 2026-09-26 — the general rule, and it caught two sites I had not

`bun run cat check:stale-field-advice` (`cat-harness/scripts/check-stale-field-advice.ts`),
in `Code-quality gates` beside `check:command-paths`.

**It does not read intent, and that is the design.** "Approvingly" is exactly
what a regex is worst at, and a gate that guessed would be wrong in both
directions and then deleted. So the burden is inverted and the test is
structural: a mention passes when its neighbourhood **says something about the
field's reliability**, and fails when it is bare. That is deliberately wider
than "not approving", because it admits the two shapes that are both
legitimate and that a caution-only rule would have to choose between —

- a **caution**: *"`unknown` means GitHub has not finished computing it, not
  that the PR is fine"*;
- a **measured licence**: *"when it is `dirty`, merge the base in"*, which
  `yv4z` established and which is sound because `dirty` is the one value whose
  falsity costs nothing.

What it refuses is the third shape, which is the one that actually shipped.

### The two it found, neither of which was on my list

I had this bean's scope wrong once already (the three-call-sites table above),
so this time the gate ran before the guess. Both findings are real:

| site | what it said | what it says now |
|---|---|---|
| `pickup.md:79` | `mergeable_state` in a list of fields to read from `pull_request_read get`, **nothing said** | act on it only when it reads `dirty`, with `fx5r` and `h2s9` named and `git merge-base --is-ancestor` given for "has this landed?" |
| `prepare-merge.md:330` | *"Read `mergeable_state` FIRST"* — approving, and **correct**, but silent on which values are worth believing | believe it only when it says `dirty`, because that is the one value whose remedy costs nothing if it is wrong |

`pickup.md` is the sharp one. It is the step-1 instruction an agent follows
when picking up a PR, and it named the field with no caveat at all — a reader
cannot tell from that whether the author knew.

### Falsified before it was trusted, because `yx9p` is four days old

A guard that passes 7/7 and lets its own defect through is this month's
measured failure, so the gate was run against sabotage rather than read:

1. a fourth copy of the advice string, planted as a new workflow → **exit 1**;
2. the caution stripped from `github-state-inspection.md`, a site that passes →
   **exit 1**;
3. restored → **exit 0**, 13 qualified mentions, 0 bare.

All three are pinned in `cat-harness/scripts/tests/stale-field-advice.test.ts`,
with the corpus test itself falsified the same way (planting a bare mention
turns it red).

### What it deliberately does NOT cover, so the coverage is not a guess

- **`mergeable` and `head.sha`** went stale in the same measurement and are
  absent from the table. Both are ordinary words here — `head.sha` is read
  correctly dozens of times off a check-run payload, where it is neither
  served by the PR endpoint nor stale. A gate that cried wolf on those would
  be deleted, and would take the one true rule with it.
- **`beans/`** is out of scope. A bean is a `state` graph: the record of a
  measurement, in the past tense, frequently quoting the very string the fix
  removed — this bean names the field a dozen times and every one is evidence.
  Requiring a qualifier there would either rewrite history or teach authors to
  sprinkle the marker, and a marker sprinkled to satisfy a gate stops meaning
  anything.
- **Five paths declined**, each by whole path with a reason and each COUNTED in
  the summary rather than dropped (`check-command-paths`' rule: what a check
  declines to judge has to stay visible). There is no per-LINE exemption table:
  a line number is invalidated by the next paragraph inserted above it, and an
  exemption protecting a line that has moved protects the wrong text.


## Summary of Changes — closed 2026-09-26

All five `Done when` items are ticked and the evidence is on `main`, not on a
branch: `git merge-base --is-ancestor` confirms both heads.

| what | where it landed |
|---|---|
| the two UNKNOWN advice strings name `merged` and the merge ref | PR #1362 |
| `prepare-merge` and `/watch` checked — already correct | measured, nothing to do |
| refreshing CI documented as `workflow_dispatch`, not a push | PR #1362 |
| `h2s9` cross-references this; a wrong error string is worse than an absent one | PR #1362 |
| **the general rule** — `bun run cat check:stale-field-advice` | PR #1395 |

The last one is the one a test could not close, and it found **two sites this
bean had not**: `pickup.md:79`, the step-1 instruction for picking up a PR,
naming the field with no caveat at all; and `prepare-merge.md:330`, approving
and correct but silent on which values are worth believing. Both now say
`dirty` only, and name this bean and `h2s9`.

Closed on evidence rather than authorship, per `bean-coordination`
§"Closing a bean whose work has already landed".
