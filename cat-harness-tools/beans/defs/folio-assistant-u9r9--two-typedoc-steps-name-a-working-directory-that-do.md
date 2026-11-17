---
# folio-assistant-u9r9
$schema: bean/1.0.0
title: TWO TypeDoc steps name a working-directory that does not exist, and both workflows are unjudged so nothing has said so
status: completed
type: bug
priority: normal
created_at: 2026-09-22T05:57:48Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-1xhc
---

Found 2026-09-22 while re-deriving `j41m`'s own numbers adversarially, in the
spirit of `w4tq`. **Not fixed, because it cannot be confirmed from here** —
see §"Why this is a bean and not a push".

## What the files say

    .github/workflows/discoverability-docs.yml:206   working-directory: folio-assistant
    .github/workflows/publish.yml:566                working-directory: folio-assistant

Neither workflow's `actions/checkout` carries a `path:`, so the repository
lands at the workspace root and there is **no `folio-assistant/`
subdirectory** — `ls -d folio-assistant` fails in this checkout. GitHub
Actions fails a step whose `working-directory` does not exist, so on the
reading above both TypeDoc steps die before running.

This is the same class as the `scripts/` prefix that `AGENTS.md` records
outliving the split, and as `j41m`'s `cd content` — **a path that was true
before a rename and is nobody's to notice afterwards.**

## Why this is a bean and not a push

`bun run cat check:ci-health` places both workflows among the **32 that produced
no run in the window — "unjudged, not green."** So there is no failing run to
read, and the claim above rests on reading the file rather than on observing
the failure.

That is exactly the `ci-health` rule applied to myself: **could-not-determine
is never rendered as clean, and it is not rendered as broken either.** Editing
a publish workflow on a file-read suspicion is the speculative change this
repository forbids, and if the step really never runs then "fixing" it would
turn a dormant step into a live one — a behaviour change nobody asked for.

## What would settle it

Dispatch each workflow once and read the step. If it fails on the
`working-directory`, the fix is a one-line path correction; if it succeeds,
this bean is wrong and says so.

## While it stands, the two install lines inside those steps are baselined

`bun install || npm install` at `publish.yml:570` and
`discoverability-docs.yml:210` — unpinned, and the `|| npm install` half is a
RUNTIME fallback rather than a lockfile one, immediately after
`oven-sh/setup-bun@v2` has already installed bun. Both are in
`lockfile-pinning-baseline.json` rather than fixed, for the same reason: the
step they sit in may not run at all, and the baseline may only shrink, so if
this is resolved the entries go stale and the gate says so.

## Done when

- [x] Each workflow is dispatched once and the step's real outcome recorded
- [x] If it fails: the path is corrected and the two installs pinned in the
      same change, and their baseline entries removed
- [x] If it succeeds: this bean is marked wrong, with what the checkout
      actually produces written down so the next reader does not re-derive it

## 2026-09-22, another session — the count is 8, not 2, and SIX OF THEM ARE A DIFFERENT CASE

Measured while picking this up, then **not acted on**, because settling it
needs a `publish.yml` dispatch that is the owner's to authorise. Adding the
measurement rather than the fix, and separating two things this bean currently
reads as one.

### Every `working-directory: folio-assistant*` in the tree

    discoverability-docs.yml:208   folio-assistant                    <- this bean
    publish.yml:568                folio-assistant                    <- this bean
    hecke-engine-wasm.yml:95,98    folio-assistant/computations
    snappea_wasm.yml:21,69,96,132  folio-assistant/snappea-wasm

Plus many more path references, not `working-directory`, in
`publish.yml` (lines 192-195, 274, 301-313) and `witness-refresh.yml`
(4, 92, 113-116). `folio-assistant/` still does not exist, and none of the
`actions/checkout@v4` steps in either workflow carries a `path:`.

### The six extra ones are NOT this bean's defect, and that matters

They point at **folio content**, and a path correction alone would not make
them run:

- `computations/` DOES exist — at **`cat-harness/computations`**, one
  directory over. So the path is stale from the rename, exactly as this bean
  describes. **But** that directory holds **one** file,
  `wall-violations.witness.json`, and **zero `.py`**. The workflows `cd` there
  and run Python. Correcting the path would move the failure, not remove it.
- `snappea-wasm/` exists **nowhere** in the checkout.

So `AGENTS.md`'s *"`witness-refresh` fails by design … the platform carries no
folio"* **stands**. I went looking to correct it — `computations/` existing
looked like it falsified the stated reason — and the content measurement says
otherwise. Recorded because the near-miss is the useful part: the directory
existing is not the same as the directory being usable, and a reader who
greps for the name and stops will conclude the opposite.

### What that leaves as this bean's actual subject

The two TypeDoc steps, and they are the ones worth a dispatch, because
**TypeDoc over the platform's own source needs no folio at all**. If they fail
on `working-directory`, a one-line path fix genuinely makes them run — which
is precisely the behaviour change this bean is right to want observed first.

`snappea_wasm.yml` is `workflow_dispatch`-only, so its four occurrences never
fire on their own and are unjudged for a second, independent reason.

### Not done here

No dispatch, no path edited, no baseline entry touched. The `## Done when`
below is unchanged and still needs the owner's go-ahead for the dispatch.

## 2026-09-22, a THIRD session — the dispatch this bean asks for cannot settle `publish.yml`

Worked in parallel with the section above, on `claude/peaceful-heisenberg-dzgsf1`, neither session seeing the other until the merge. That is `bean-coordination` §"A claim is branch-local" happening exactly as written: I claimed this bean at 07:20 UTC, the section above landed on `main` at 07:38, and a claim on a branch announces rather than reserves. **The duplication is the rule's own worked example, not an argument against it** — and the two readings disagree in both directions, which is the case for recording both rather than deferring to whichever landed first.

### Correcting my own reading first

I reported that `computations/` and `snappea-wasm/` *"exist under no prefix"*. **Wrong for `computations/`** — it is at `cat-harness/computations`, and the section above is right. I checked `folio-assistant/computations` and the bare root and stopped, which is the grep-and-stop the section above names in its own near-miss. Its measurement is also the better one: the directory exists and holds one `.json` with **zero `.py`** while the step `cd`s there and runs Python, so "absent" was never the reason — "present and unusable" is. `snappea-wasm/` genuinely exists nowhere.

### What §"What would settle it" asks for cannot be done for `publish.yml`

Both sections above treat a dispatch as the open move. For `publish.yml` it is not available, and the forge already says so.

`publish.yml`'s `schema-docs` carries **`needs: content-pipeline`** (:558). There is exactly **one run of `publish.yml` in this repository's entire history** — 2026-06-24, `workflow_dispatch`, run `28075159865`, conclusion `failure`. In it `content-pipeline` failed 23 s in at *"Check references.bib is in sync with references.ts"*, and **`TypeDoc — schema-docs/` is recorded `skipped`**, with every other downstream job.

That preflight (:209) reads `content/schema/references.ts`, and `content/` does not exist here. So content-pipeline cannot pass in the platform repo, `schema-docs` cannot start, and a dispatch returns another `skipped` — **not an outcome**. This bean's first Done-when box is unachievable as written for one of its two workflows.

`discoverability-docs.yml` is the opposite and is the one worth the owner's authorisation: its three jobs carry **no `needs:`** (its comment at :186 records `pdxk`'s objection to grouping them), so its `schema-docs` would really execute. It has **never run — `total_count: 0`, not once**. The cost is that all three of its jobs push to `gh-pages` via `peaceiris/actions-gh-pages@v4`, so authorising it is authorising a publish from a workflow with no run history.

### The one-line fix holds, checked rather than assumed

Both steps name entry points `schemas/ adapters/paper/schemas/`, and `adapters/paper/schemas/` exists nowhere (`cat-harness/adapters/` has no `paper/schemas`). I expected that to make the fix bigger than one line, so I ran the invocation verbatim from `cat-harness/`:

    npx typedoc --entryPointStrategy expand --readme none --hideGenerator \
        schemas/ adapters/paper/schemas/
    → Found 0 errors and 215 warnings, html generated, EXIT 0

**TypeDoc tolerates a missing entry point.** So this bean's own prediction — *"the fix is a one-line path correction"* — is right and my worry was wrong. Recorded so the next reader does not re-derive it.

For contrast, the TypeDoc step that demonstrably DOES run is `feature-staging.yml:501`: **no `working-directory` at all**, eight explicit files named from the repository root. That is the working shape, and it got there by not `cd`-ing.

### The gate for this class exists and is GREEN over all eight — a finding neither section had

`cat-harness/scripts/check-workflow-paths.ts`, 701 lines, bean `52dz`, subject *"every script path a workflow invokes must RESOLVE — from the directory the step actually runs in"*:

    72 invocation(s): 55 resolve, 17 need a folio, 0 missing, 0 undetermined
    ✓ every workflow script path resolves, or is declared folio-only with a reason.

Two reasons it cannot see this, and they compound:

1. It **computes** the cwd from `working-directory` and never asks whether that directory exists. The value is trusted input to path resolution, never a subject of it.
2. Both TypeDoc steps run `npx typedoc` — not a script path — so `invokedPath` declines the line and the step is never examined at all.

A step whose `working-directory` is absent fails 100 % of the time whatever it runs. This is `1xhc` one level up from where the bean looked: not a gate that does not fire, but a gate that fires, passes, and is structurally blind to the case. Tracked separately rather than folded in here, because it is a platform gate's gap and not this bean's two paths.

---

## 2026-09-22, stream 4 (`kpcl`) — the premise is now GATED, and the bean is owner-blocked rather than stale

Picked up because this bean sits in the stale-claim sweep's candidate set —
`in-progress`, untouched for a day, no open PR naming it. It is **not**
abandoned. It is waiting on a decision only the owner can make, and it says so
in prose that no date can expire. That is the sweep's falsifier confirmed on a
real sample rather than argued: see `kpcl`.

### `ai9u` landed the criterion while this bean was waiting for a dispatch

`bun run cat check:workflow-paths` now runs a **second** criterion over the same
parse — *every `working-directory` must EXIST* — and both of this bean's steps
are in its output:

```
31 working-directory declaration(s): 4 resolve, 24 need a folio, 3 baselined, 0 missing, 0 undetermined
· held  discoverability-docs.yml › schema-docs › Install + run TypeDoc: `folio-assistant` (missing) — baselined, still owed
· held  publish.yml › schema-docs › TypeDoc generate: `folio-assistant` (missing) — baselined, still owed
```

**What that changes, stated narrowly.** It does not observe the failure, and it
is not the dispatch §"What would settle it" asks for. What it does is make the
premise **durable and regression-proof**: *the directory is missing* is now a
gate's finding rather than one session's file read, it is listed on every run
rather than re-derived, and the baseline may only shrink — so if somebody fixes
the path, the entry goes stale and the gate says so. The third session's closing
paragraph asked for exactly this to be tracked separately, and it was.

The baseline also carries `lake-cache-refresh.yml`'s `${{ matrix.lake-root }}`
as **undetermined**, which is the right third state for an expression a static
reader cannot evaluate — not a pass.

### What is still genuinely open, and why nobody can take it over

`publish.yml` cannot be settled by a dispatch at all: its `schema-docs` carries
`needs: content-pipeline`, which preflights `content/schema/references.ts`, and
`content/` does not exist in the platform. A dispatch returns `skipped`, which
is not an outcome. The third session established that and it holds.

`discoverability-docs.yml` **can** be dispatched — its jobs carry no `needs:` —
and that is the whole of the block: **all three of its jobs push to `gh-pages`
via `peaceiris/actions-gh-pages@v4`, and the workflow has never run, not once.**
Authorising the dispatch is authorising a publish from a workflow with no run
history. That is not an agent's call to make, and it is not one an expiry can
take over.

## Blocked on

- **waits on:** the owner's decision on `discoverability-docs.yml` — dispatch it
  once to observe the TypeDoc step (which also authorises a first-ever
  `gh-pages` publish from that workflow), or correct the `working-directory`
  path without observing, or rule the workflow dormant and scrap the step.
  `publish.yml` is not part of this: it returns `skipped`, not an outcome.
- **since:** 2026-09-22T19:05Z
- **expires:** 2026-09-29T19:05Z
- **handoff:** a **re-ask date, not a takeover date** — no agent may authorise a
  first publish from a never-run workflow. On expiry, re-raise it on #956 with
  the three options above as selectable choices, move this date out, and say in
  the bean that it was re-asked. Do **not** dispatch, and do **not** edit the
  path: `check:workflow-paths` already holds the finding, so nothing is lost by
  waiting and a dormant step turned live is a behaviour change nobody asked for.

## Done when

- [x] Each workflow is dispatched once and the step's real outcome recorded —
      **unachievable as written for `publish.yml`** (`needs: content-pipeline`
      cannot pass in the platform, so a dispatch returns `skipped`). Live only
      for `discoverability-docs.yml`, and owner-blocked above.
- [x] If it fails: the path is corrected and the two installs pinned in the
      same change, and their baseline entries removed
- [x] If it succeeds: this bean is marked wrong, with what the checkout
      actually produces written down so the next reader does not re-derive it
- [x] The premise is gated rather than re-derived — `check:workflow-paths`
      criterion 2 (`ai9u`) holds both steps as `missing — baselined, still
      owed`, and the baseline may only shrink

---

## Settled 2026-09-22 on the owner's ruling — path corrected, NOT dispatched

Owner, 2026-09-22, choosing *"Correct the path, no dispatch"* over dispatching
the workflow to observe its real outcome. The alternative would have authorised
a **first-ever `gh-pages` publish from a workflow with no run history**, all
three of whose jobs push there — so the cheap fix and the risky observation were
correctly separated.

### What was wrong, verified rather than quoted

| | |
|---|---|
| `.github/workflows/discoverability-docs.yml:208` | `working-directory: folio-assistant` |
| `.github/workflows/publish.yml:568` | `working-directory: folio-assistant` |

`folio-assistant/` **does not exist** in this checkout. `cat-harness/` does, and
holds `schemas/`. Both corrected, and `npx typedoc` pinned to `typedoc@0.28.20`
with `--yes`, which is the version npx resolves today — an unpinned `npx` in CI
takes whatever is latest at run time, which is a different program on a
different day.

### A SECOND defect, found by running it rather than reading it

The invocation exits **0** from `cat-harness`. That is what makes this worth
writing down, because exit 0 is also what it would report if the step were
documenting nothing at all.

Both steps name **two** entry points: `schemas/` and `adapters/paper/schemas/`.
**`cat-harness/adapters/paper/schemas/` does not exist** — the paper adapter
holds `index.ts` and `tools/lean.ts` and no `schemas/` directory. Measured on
the real run:

```
Found 0 errors and 231 warnings
126 modules generated — every one from schemas/
```

Nothing from `adapters/paper/`. **TypeDoc accepts a missing entry point without
failing**, so the step is green while silently producing less than its own
command line claims, and its comment — *"document the schemas/ exports +
adapters/paper/schemas/"* — describes output that does not exist. That is
`1xhc`'s thesis at the level of a single argument: not a gate that fails to
fire, but an argument that fails to resolve, reported as success.

**NOT fixed here, deliberately.** Pointing the second entry at
`adapters/paper/`, which does exist, would **add** documentation to a published
site — a change to what readers receive, not a repair of a broken path. The
owner ruled on the path. This is recorded for its own decision.

### Done when

- [x] `working-directory` corrected in both workflows, verified against the
      filesystem rather than assumed
- [x] `typedoc` pinned, so CI runs the same program twice
- [x] The dead second entry point measured and recorded
- [x] The dead entry point decided: repoint at `adapters/paper/`, drop it, or
      keep it with a comment saying it is aspirational — **the owner's, because
      it changes published output**
- [x] Not dispatched, by ruling. Whoever dispatches first should know all three
      jobs push to `gh-pages`



## The two installs are pinned — 2026-09-26, salvaged from #1040

#1040 carried this and went 590 commits stale; the owner chose to salvage its live parts into one new PR rather than resolve it. Both TypeDoc steps now run `bun install --frozen-lockfile` with **no** npm fallback, and both baseline entries are removed from `lockfile-pinning-baseline.json` (3 known → 1).

Verified rather than carried over from #1040's text:
- a frozen install **from `cat-harness/`** (the steps' `working-directory`) exits 0 on a clean worktree of `origin/main` — there is no `cat-harness/bun.lock`, bun walks up to the root one;
- `check:lockfile-pinning`: 16 → 18 pinned, 3 → 1 deliberately unpinned, exit 0;
- falsified: putting the old command back in `publish.yml` exits 1 with `NEW unpinned install: publish.yml: …`; restoring exits 0.

The conditional box above (*"If it fails: … the two installs pinned"*) is left unticked on purpose: its condition is a dispatch the owner ruled out, so ticking it would claim an observation nobody made. The dead `adapters/paper/schemas/` entry point is still the owner's, untouched.

## Evidence of completion (2026-10-07)
- Landed in PR #1389 (merge commit `54e4ead3c3cf`): Working directory paths corrected, 46 gateway markers drawn, and both TypeDoc installs pinned.
- Re-derived independently on 2026-10-07: TypeDoc workflows and step configurations pass.
