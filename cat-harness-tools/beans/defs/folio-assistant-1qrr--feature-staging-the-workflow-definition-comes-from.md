---
# folio-assistant-1qrr
$schema: bean/1.0.0
title: 'FEATURE-STAGING: the workflow definition comes from the BASE but the checkout is the PR HEAD, so a newly-added step fails every branch that predates it'
status: completed
type: bug
priority: normal
created_at: 2026-10-03T15:33:32Z
updated_at: 2026-10-22T17:10:00Z
parent: folio-assistant-1xhc
---

## The split

`.github/workflows/feature-staging.yml:190` checks out the PR **head**:

```yaml
ref: ${{ github.event.pull_request.head.ref || inputs.branch || github.ref }}
```

But for a `pull_request` event GitHub takes the workflow **definition** from the
BASE branch. So the steps that run are `main`'s, while the tree they run
against is the PR's head. Those two disagree the moment a step is added that
invokes something new.

## Measured 2026-10-03

A step `Publish the identifier lookup` landed on `main` in `d8207832fea` at
**14:24:38** (bean `1br0`, #1972 step 3). PR #2001's head `11ae41ee55a`
branched before that:

```
$ git cat-file -e 11ae41ee55a:cat-harness-tools/scripts/publish-id-lookup.ts
fatal: path '...' does not exist in '11ae41ee55a'
$ git cat-file -e origin/main:cat-harness-tools/scripts/publish-id-lookup.ts
(exists)
```

So the run executed `main`'s step 17 against a tree with no such script, and
`stage` failed at exactly that step. The seven runs that passed between 15:01
and 15:14 were all on branches that had merged `main` after 14:24:38; the one
that failed, at 15:21, had not.

## Why it is worse than a plain stale-branch failure

**The failure names a file the author never touched**, so the natural reading
is "my branch broke the staging build". It was nearly read that way here: the
failing branch was the ONLY failure in 30 runs of this workflow against 7
successes, and a 1-in-30 statistic points hard at the one. The branch was
innocent; it was merely old.

This is the one place in this repository where *"the workflow is the
authority"* and *"the checkout is the head"* disagree, and nothing says so.

It also fires in **bursts**: an arc landing in steps (#1972 is landing in
steps) adds a step, and from that instant every open PR that has not merged
`main` fails staging until it does. With ~20 open PRs that is ~20 misleading
failures per added step.

## Not fixed here, and the options are not equivalent

Three shapes, and they differ in what they give up:

1. **Check out the merge ref** instead of the head, so the definition and the
   tree come from the same place. Closest to correct; changes what a preview
   previews (the merge result, not the branch) — which may be what a reviewer
   wants anyway, or may not.
2. **Guard each step** on the existence of what it invokes. Keeps previewing
   the branch; pays a conditional per step forever, and a skipped step is the
   `1xhc` shape unless it reports.
3. **Leave it and document it**, so the next reader is not misled.

Option 1 changes the meaning of a preview and that is a decision, not a fix.

## Done when

- [x] the owner picks a shape, or rules that documenting it is enough
- [x] whichever lands, a stale branch's staging run no longer names a script
      its author never touched
- [x] the hazard is written where somebody debugging a red `stage` will find
      it, not only in this bean (landed on `main` in `folio-assistant#2618`, `7b7d0736b2`, in `.github/workflows/feature-staging.yml`)

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

_2026-10-22T00:40Z_ — Lane C (session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): still live on main (`feature-staging.yml` checks out the PR head under the base's step list). Done-when #3 is up as folio-assistant#2618, a comment on the checkout step and no behaviour change. The owner decision is in that PR: (1, recommended) check out the merge ref, (2) guard each step, (3) document only. Default 3.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns folio-assistant's `.github/workflows/feature-staging.yml` (definition from BASE, checkout from HEAD), and its first done-when is the owner choosing one of its three shapes for that workflow. The copy of this bean in the `cat/cat-harness/beans` store (litlfred/folio-assistant) sits with that subject and is the live one. It should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository"; the owner has not chosen among the three feature-staging shapes. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T17:10Z_ — Lane C (session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): **resolved.** The owner chose option 1 on 2026-10-22 ("Check out merge ref"). folio-assistant#2624 (merged as 6cf10d9) makes `feature-staging.yml` check out `github.sha` on `pull_request`, which is the PR's test merge commit: the steps and the tree they run against now come from the same merge, so a step added on main runs against a tree that has its script. Push and workflow_dispatch are unchanged. Its own staging run built from the merge commit (0aa9d5f), not the head. The comment from #2618 stays on the checkout step (done-when 3).

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the hazard is written where somebody debugging a red `stage` will find
      it, not only in this bean (landed on `main` in `folio-assistant#2618`, `7b7d0736b2`, in `.github/workflows/feature-staging.yml`)

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

_2026-10-22T00:40Z_ — Lane C (session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): still live on main (`feature-staging.yml` checks out the PR head under the base's step list). Done-when #3 is up as folio-assistant#2618, a comment on the checkout step and no behaviour change. The owner decision is in that PR: (1, recommended) check out the merge ref, (2) guard each step, (3) document only. Default 3.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns folio-assistant's `.github/workflows/feature-staging.yml` (definition from BASE, checkout from HEAD), and its first done-when is the owner choosing one of its three shapes for that workflow. The copy of this bean in the `cat/cat-harness/beans` store (litlfred/folio-assistant) sits with that subject and is the live one. It should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository"; the owner has not chosen among the three feature-staging shapes. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T17:10Z_ — Lane C (session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): **resolved.** The owner chose option 1 on 2026-10-22 ("Check out merge ref"). folio-assistant#2624 (merged as 6cf10d9) makes `feature-staging.yml` check out `github.sha` on `pull_request`, which is the PR's test merge commit: the steps and the tree they run against now come from the same merge, so a step added on main runs against a tree that has its script. Push and workflow_dispatch are unchanged. Its own staging run built from the merge commit (0aa9d5f), not the head. The comment from #2618 stays on the checkout step (done-when 3).
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the hazard is written where somebody debugging a red `stage` will find
      it, not only in this bean (landed on `main` in `folio-assistant#2618`, `7b7d0736b2`, in `.github/workflows/feature-staging.yml`)

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

_2026-10-22T00:40Z_ — Lane C (session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): still live on main (`feature-staging.yml` checks out the PR head under the base's step list). Done-when #3 is up as folio-assistant#2618, a comment on the checkout step and no behaviour change. The owner decision is in that PR: (1, recommended) check out the merge ref, (2) guard each step, (3) document only. Default 3.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns folio-assistant's `.github/workflows/feature-staging.yml` (definition from BASE, checkout from HEAD), and its first done-when is the owner choosing one of its three shapes for that workflow. The copy of this bean in the `cat/cat-harness/beans` store (litlfred/folio-assistant) sits with that subject and is the live one. It should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository"; the owner has not chosen among the three feature-staging shapes. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T17:10Z_ — Lane C (session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): **resolved.** The owner chose option 1 on 2026-10-22 ("Check out merge ref"). folio-assistant#2624 (merged as 6cf10d9) makes `feature-staging.yml` check out `github.sha` on `pull_request`, which is the PR's test merge commit: the steps and the tree they run against now come from the same merge, so a step added on main runs against a tree that has its script. Push and workflow_dispatch are unchanged. Its own staging run built from the merge commit (0aa9d5f), not the head. The comment from #2618 stays on the checkout step (done-when 3).
```
