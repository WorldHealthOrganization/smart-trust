---
# folio-assistant-xp5j
$schema: bean/1.0.0
title: 'gh-pages is STARVED: staging previews and the published site contend for one serialised Pages deployment, 72 of 100 cancelled'
status: completed
type: task
priority: normal
created_at: 2026-10-04T06:49:11Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-1xhc
---

## How this surfaced

`bun run cat check:ci-health` on `main`, 2026-10-04. The Pages half of that report
exists precisely because a Pages build outcome is a fact GitHub holds *about*
this repository rather than one the repository holds, so it is asked fresh and
cached nowhere. It said:

    - ✓ 27 succeeded
    - ❔ 72 cancelled — neither shipped nor broken
    - ✗ 0 failed
    The newest deployment to settle did NOT succeed (cancelled, 06:43:08Z),
    and the site is as of 06:34:52Z.

and, importantly, ruled out the easy explanation itself: *"No deployment
superseded its own slug in the window — whatever cancelled these builds, it was
not one workflow pushing twice (`bm6d`)."*

## Measured

From `actions/runs?branch=gh-pages`, 100 runs spanning 14.0 h:

    7.1 deployments/hour
    27 success · 72 cancelled · 0 failed
    gap between SUCCESSFUL deployments: median 9.6 min, **max 396.2 min**
    longest consecutive cancellation streak: **24**

**396 minutes is 6.6 hours with nothing reaching the published site.** That is
the number that makes this a defect rather than ordinary coalescing: a
superseded preview leaving the previous one in place is harmless, but a
published site six hours behind `main` is a site nobody can trust to read.

Every one of the 100 runs is the SAME workflow — GitHub's built-in
`pages build and deployment`. There is no second deployer to blame.

## The mechanism

Recent `gh-pages` commits, 20 in ~41 minutes:

    18 × staging(<branch>)      previews, from ~15 DIFFERENT branches
     2 × docs(gh-pages): site   main's published site

Each push triggers the built-in Pages deployment, whose concurrency group
cancels the build in flight. The pushes arrive in bursts — 06:21:30, 06:21:57,
06:22:16 is three in 46 seconds — so a burst cancels everything before its last
member, and the next burst can cancel that one too.

So **`main`'s published site competes with every open branch's staging preview
for one serialised deployment slot, and loses.** With ~40 open PRs the
contention is structural, not incidental: it gets worse as the repo gets busier,
which is the opposite of what a publishing path should do.

This is the `bm6d` question asked one level out. `bm6d` was one workflow pushing
twice and superseding itself; here it is MANY producers sharing one consumer,
and the report already distinguishes them.

## Options — the owner's call, because this is publishing configuration

1. **Point Pages at a custom workflow with `concurrency: { group: pages,
   cancel-in-progress: false }`**, so deployments QUEUE instead of cancelling.
   This is the standard remedy and the only one that keeps both previews and the
   site. Cost: deployments serialise, so a burst takes longer to drain, and the
   built-in deployer is replaced by `actions/deploy-pages`.
2. **Debounce the staging pushes** — coalesce per branch, or push previews on a
   timer rather than per commit. Keeps the built-in deployer; reduces preview
   freshness.
3. **Move staging previews off `gh-pages`** to a separate host or ref, leaving
   `gh-pages` for the published site alone. Largest change; cleanest separation.
4. **Accept it**, recording that previews are best-effort and the published site
   may lag by hours. Honest, and costs nothing — but it makes
   `check:ci-health`'s Pages section permanently amber, which trains readers to
   ignore it.

Option 1 is the recommendation. **Default if nobody picks: nothing changes**, the
site keeps lagging, and this bean stays open as the record of why.

## Not done here, deliberately

Nothing was reconfigured. Pages settings decide what the world sees of this
repository, and `check:ci-health` reports the share of cancellations WITHOUT
grading it (bean `3yi4`) for the same reason: the number is a fact, the
threshold is a judgement.

## Owner's ruling, 2026-10-04 — option 1, then RECAST

The owner picked option 1 (queue instead of cancel), then redirected: *"dont
rely on github actions. use merge manager skills/extend/genrelzie/recast?"* and
*"extend merge manager role per watched branch? gh-pages, then the incoming
cat/cat-harness/* branches?"*, and chose **role recast AND gh-pages migration
together**.

That redirect is right, and the reason is measured in this repository already.

### Why option 1 as worded cannot work

`feature-staging.yml` carries the measurement, 2026-09-19:

> `cancel-in-progress: false` governs the RUNNING job, not the pending one.
> GitHub cancels a PENDING job when a newer one queues for the same group. So a
> third arrival silently drops the second.

Three staging runs from three different branches inside 17 seconds: two
cancelled, one ran. **A GitHub concurrency group does not queue.** It keeps at
most one pending run. So `concurrency: { group: pages, cancel-in-progress:
false }` protects a RUNNING deployment and still drops intermediate pending
ones — a partial fix dressed as a complete one.

It is still an improvement, because the 24-cancellation streak was builds killed
IN FLIGHT. It is not the fix.

## Move 1 — the class (`generalise-the-fix`)

**The defect, not the symptom.** The symptom is 72/100 cancelled. The defect is
that **`merge-steward` is declared over an implicit single ref.** Its
description — *"composes a merge train from the queue … landing waits for the
owner's release"* — never names WHICH ref, so a second contended ref cannot
acquire a steward. The abandoned fix shows the skill's own tell: `group: pages`
**names one instance**, and would have left all six `cat/cat-harness/*` refs
exactly as broken.

**The sweep, with its denominator.**

    workflow files parsed                    35 of 35
    workflows that write any ref             10 of 35
    workflows that really push gh-pages       5
       discoverability-docs, docs-site, feature-staging, folio-staging, publish
    workflows using branch-store's route API  0
    remote branches                         809
    shared-store refs, many producers         7   gh-pages + 6 cat/cat-harness/*
       ...of those, with a steward            1   main

Two corrections to this bean's own §"The mechanism", which inferred producers
from commit-message prefixes and named **2**:

- there are **5**, found by parsing the workflows;
- a first pass said 6. `merge-main.yml` has **0** write-markers — a crude
  `'gh-pages' in text` matched a comment. The refined count is 5.

**Right layer.** Workflow concurrency → the contended ref → **the role that owns
writes to a ref.** Stop there. And the design is already in the tree:
`scripts/branch-store.ts` declares `keyedBy: "route"` for exactly this case —
*"nobody authored either side, so the newer generation wins and a `conflict`
would block a push over content no one disagrees about"* (bean `1j3q`).
`gh-pages` IS a route-keyed store that was never migrated: `STAGING/<slug>/` per
branch, `/` for the site, one owning generator each.

## Move 2 — the adversary

**What does this now apply to that the defect did not?** A per-ref steward
would reach all 809 refs, including the 802 with one producer, where it is pure
overhead AND a new single point of failure. Narrowed on both axes: SCOPE — only
refs declared in `scripts/special-branches.json`; STATE — only while a ref has
more than one writer.

**The case that must still fire:** a same-route double write where somebody DID
author both sides must not be lost to "newer wins". On `gh-pages` it cannot
happen today — `/` is written only by `docs-site`, `STAGING/<slug>/` only by the
owning branch — but that is the test the migration owes, not a reason to skip it.

**The adversary reverses the fix.** Route-keying removes CONFLICTS; it does not
remove BURSTS. GitHub still deploys per push and still cancels in flight, so
fewer pushes is a smaller burst, not no burst. **So the migration fixes the
defect and does NOT on its own close this bean's symptom** — that needs the
steward to COALESCE pushes into one per window, which a coordinator can do and a
concurrency policy structurally cannot. That is where the role earns its place
rather than merely being tidier.

## Two gaps found in the declaration itself

`scripts/special-branches.json` is *"the ONE declaration of the names"* and says:
*"INTERIM: bean `rva2` (arc fs43 P7) plans to declare every special branch with
the `storage` field arc 3fva introduces on ContentDirectory. When that field is
on main, this table folds into it."* That field IS on main —
`keyedBy: z.enum(["commit","tip","route"])` in `schemas/cat-harness.ts`. So:

1. **`gh-pages` is the only entry stating no keying**, while `beans`, `todos` and
   `fsh-guts` each say `keyedBy: tip`. It is route-keyed and nothing says so.
2. **Its `writers` list holds 4; the sweep found 5.** `publish.yml` defaults
   `publish_branch: gh-pages` and is unlisted. A declared-writers list that is
   quietly incomplete is the `audit-coverage` shape: nothing compares the
   declaration against the workflows that actually write the ref.

Gap 2's fix is not "add `publish.yml`" — that is the symptom again. It is a gate
that checks the declared `writers` against the measured ones, which is what
would have caught it.

## Design settled 2026-10-04 — `route-family`, a FOURTH keying

The owner chose "teach route keying a dynamic route, then migrate", over the
steward-only coalescing I recommended. Recording the design before building it,
because it crosses 14 sites and a handover mid-way would otherwise lose it.

### Why a fourth keying rather than a flag on `route`

`DirectoryStorageSchema`'s docblock answers the question itself:

> The field is an enum, not a string, **so a fourth keying is a schema change
> somebody has to make rather than a reinterpretation of an existing value.**

And a boolean on `route` would make `keyedBy: "route"` carry two different
write contracts — exactly what that docblock insists `route` and `tip` must
never do ("it is not a synonym for `tip`, and the difference is the write").
`scripts/special-branches.json` already draws the same line one level out, as
`shape: "branch"` against `shape: "family"`.

### What `route-family` is, against `route`

| | `route` | `route-family` |
|---|---|---|
| unit replaced | one declared route | one MEMBER under the directory's prefix |
| member names | declared, fixed | supplied at publish, **untrusted** |
| source of the files | the declared path in the checkout | a separate local path — source and destination differ |
| member removal | not a case: a generator that stops emitting a page stops publishing it | **required** — a member's branch can be deleted |
| `expect` | refused; newer generation wins | refused, for the same reason |

Three things it needs that `route` does not:

1. **A validated member key.** `feature-staging.yml` states the branch name is
   ATTACKER-CONTROLLED on a fork PR. So the member is untrusted input: no
   `..`, no absolute path, no `//`, and **no dot-prefixed segment, tested on
   every segment** per `kg-core/directory-conventions`. One segment only.
2. **A source/destination split.** `publishRoute` conflates them today —
   `loc.path` is both the checkout path and the route on the branch, since "a
   route is published FROM the working tree by the generator that owns it". A
   preview builds into a local dir and publishes to a different, dynamic route.
3. **A removal operation.** `feature-staging.yml` already deletes
   `STAGING/<slug>` on PR close, and `route`'s contract has no case for a
   member whose branch is gone.

### The 14 enumeration sites a new value must not land unhandled in

    schemas/cat-harness.ts:1480      the enum itself
    schemas/cat-harness.ts:1779      the `qa` directory refusal
    schemas/subgraph-source.ts:241   tip + qa guard
    scripts/branch-store.ts:172      BRANCH_KEYINGS
    scripts/branch-store.ts:231      keptAt's route short-circuit
    scripts/branch-store.ts:267      resolveTipLocation's filter
    scripts/branch-store.ts:295      resolveTipLocation's refusal
    scripts/branch-store.ts:716      manifest keying agreement
    scripts/branch-store.ts:826      the `expect` refusal
    scripts/check-declared-dirs.ts:427
    scripts/graph-read.ts:160
    scripts/audit-coverage.ts:393

Nine of the twelve need a decision rather than a mechanical edit; the three
`!== "tip"` guards in the last block are about reading a tip store and are
correct to exclude a family.

### Sequencing, overridden deliberately

`branch-store.ts` says the first route-keyed writer is `docs/uml/`, "a
follow-on bean to `1j3q`, deliberately separate so the mechanism lands before
49 gated checks move". This makes `gh-pages` first instead, ahead of that. The
owner was told and chose it; recorded here so the record shows a decision
rather than an oversight.

### And the adversary's point still stands

Route keying removes CONFLICTS, not BURSTS. Even fully migrated, the published
site lags until the steward coalesces — `schemas/ref-window.ts` is the type for
that, and the window, not the keying, is what closes this bean's symptom.

## Handover for a merge steward — 2026-10-04, PR #2063

The owner's merge manager is **in another account's session**, so session
messaging cannot reach it. This section, `beans/queue/litlfred-folio-assistant-2063.json`
and the PR itself are the channel.

### What the decision table says, unprompted

`bun run cat merge:steward` evaluated `merge-priority.dmn#Decision_MergePriority`
against `origin/main`:

    pr 2063  route "hand back"  class hand-back  rank 90  rule Rule_Refused
             conflict refused   ownCi missing-required
             missingGating ["code-quality-gates.yml"]

It reached independently what this branch had established by hand, which is why
the queue entry records it rather than arguing with it.

### The structural blocker, and it is not this branch's content

`code-quality-gates.yml` has **never run** on #2063, across twelve pushes.
`check:head-has-run` names the mechanism: a conflicted PR has no
`refs/pull/N/merge`, GitHub runs no `pull_request` workflow without one, and
that workflow is `pull_request`-only (`merge_group` cannot fire here, bean
`1hjm`). So the PR is unmergeable → no gates → cannot be shown green.

`merge-main` is labelled and the bot sweeps on every push to `main`, but it
**refuses**, correctly, on the authored paths below. Main moves 25–54 commits
inside one 12–20 min merge+regen cycle, so a hand merge cannot converge either.
That is bean `0mf0`'s territory, not a defect in this PR.

### Three authored resolutions a steward should NOT redo

1. **`scripts/special-branches.json`** — union. Main's `9c7h` rewrote the
   `fsh-guts` entry while this branch added `keyedBy`; both kept.
2. **`schemas/cat-harness.ts`** — **take main's `keyedBy: KeyedBySchema`**, never
   a restated enum. See below.
3. **Both submodule gitlinks** — must be main's (`bootstrap-tools`
   `7ac5150ccbb8`, `bootstrap` `576120449686`). A merge here resolved them to
   the branch's side and broke `subgraph-readmes.ts` in a file this branch never
   touched.

### A defect this branch caused and has fixed, worth carrying forward

Main's `c505ba2cc22` (bean `1j3q`) removed a duplicated keying enum:
`DirectoryStorageSchema.keyedBy` held its own `z.enum([...])` while
`KeyedBySchema` in `subgraph-source.ts` is what every consumer parses through,
they drifted, and a route-keyed declaration parsed then threw a ZodError inside
`resolveSubgraphSource`. Its rule: **a schema change somebody has to make is
only a guard if there is ONE schema to change.**

This branch added `route-family` to the *copy* — reproducing `1j3q` one keying
later, accepted by the declaration and rejected by every consumer. Nothing
caught it; main's fix landing independently is what exposed it at merge.

Now: `route-family` is in `KeyedBySchema` only, `resolveSubgraphSource` accepts
a `route-family` declaration end to end, and `route-member.test.ts` carries the
guard — both value directions plus a structural
`expect(shape.keyedBy).toBe(KeyedBySchema)`, so a restated enum is impossible
rather than merely detected.

## This bean's own defect class, found one level out — measured 2026-10-04T13:20Z

While trying to land #2063, the thing blocking it turned out to be the SAME
shape as the thing this bean is about. Recorded here because it is evidence
for the fix, not an aside.

### Measured

    main's velocity            20 commits in 52.4 min = 23/hour (one per ~2.6 min)
    merge-main runs for #2063  8 in the last 100 workflow runs
                               success 1 · skipped 2 · in_progress 2 · pending 1 · queued 2
    one merge+regen cycle      468–1204 s (8–20 min)

`merge-main.yml`'s matrix job:

    group: merge-main-${{ matrix.pr }}-${{ github.event_name }}
    cancel-in-progress: ${{ github.event_name != 'push' }}

### The mechanism, and it is `xp5j`'s

`cancel-in-progress: false` on a push to `main` is deliberate and correct —
it protects the RUNNING sweep. But it is the same half-measure this bean
already measured for `gh-pages`: **it governs the running job, not the pending
one.** GitHub cancels a PENDING job when a newer one queues for the same
group. With a trigger every ~2.6 min and a sweep taking 8–20 min, each newer
push to `main` drops the previous pending sweep, which is why five runs stood
stacked for one PR.

So the EFFECTIVE sweep rate is far below the trigger rate, and worse: a sweep
merges the `main` it saw when it STARTED, so by the time its push lands, 3–8
further commits exist. The merge is stale on arrival even when it succeeds.

Side by side:

| | `gh-pages` (this bean) | `merge-main` bot |
|---|---|---|
| many producers | ~15 branches' previews + the site | every push to `main` |
| one serialised consumer | the built-in Pages deployment | one sweep per PR per event |
| the half-fix | `cancel-in-progress: false` | the same, already set |
| what it protects | the running build | the running sweep |
| what still drops | every pending deployment but the newest | every pending sweep but the newest |

### Why it is evidence rather than a coincidence

The remedy this bean settled on — **coalesce into one write per window, with a
hard close, because "no more arrivals" has no observation** — is the remedy
here too, and for the identical reason. A concurrency group cannot coalesce;
only a coordinator can. `skills/sdlc/sdlc-core/ref-stewardship.md` already
says this in the abstract; this is the second instance in the same repository
within one day, which is what makes the generalisation earned rather than
asserted.

**Not acted on.** Changing how `merge-main.yml` is triggered is merge-pipeline
configuration and belongs to whoever owns bean `d33q` and `0mf0`, not to this
bean. Recorded so the next agent does not re-derive it from five stacked runs.

## Done when
- [x] owner picks an option
- [x] `gh-pages` declares `keyedBy: "route"` in `scripts/special-branches.json`
- [x] a gate compares each special branch's declared `writers` with the measured
      writers, and fails on a disagreement in either direction
- [x] `merge-steward` is recast to steward a NAMED watched ref, with the ref
      named by the lane instance rather than by the role
- [x] the steward skill carries the coalesce-into-one-push-per-window discipline
      (`skills/sdlc/sdlc-core/ref-stewardship.md`)
- [x] the window is TYPED for handover — `schemas/ref-window.ts`, `expires` and
      `handoff` required, no `extend`, the host's facts refused by name
- [ ] the 5 gh-pages producers write through `branch-store`'s route keying
- [ ] a test covers the same-route double write that must still be reported
- [ ] a successful deployment lands within one burst of a push to `gh-pages`
- [ ] `check:ci-health`'s newest-settled line reads success rather than cancelled

_2026-10-04T08:00:34Z_ — Claimed by claude/xp5j-ref-steward — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Completed on landed evidence
Landed on main in PR #2063 (xp5j: a steward per watched ref — recast merge-steward, migrate gh-pages).
