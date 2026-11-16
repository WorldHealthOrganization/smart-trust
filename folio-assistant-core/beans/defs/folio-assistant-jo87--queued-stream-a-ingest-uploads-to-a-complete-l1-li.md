---
# folio-assistant-jo87
$schema: bean/1.0.0
title: 'QUEUED STREAM A: INGEST — uploads/ to a complete L1 library (slw1, 13 open beans)'
status: completed
type: task
priority: normal
created_at: 2026-09-22T18:29:28Z
updated_at: 2026-10-10T16:40:52Z
parent: folio-assistant-slw1
---

## What this is

A **queued** stream: not claimed, not started. The owner asked on 2026-09-22
that as one active stream ends, the next be launched rather than leaving an
agent idle — this is one of three such queue entries covering the 49 beans the
three-GOAL split parked.

Status is `todo` **deliberately**. It becomes `in-progress` when a session is
actually launched against it, because the whole subject of stream 4 (`upgd`'s
sibling) is that 76 of 98 `in-progress` beans had nobody behind them. A queue
entry that claims itself in advance is that defect, committed by the bean
meant to document it.

## Scope

**`slw1` — INGEST: one pipeline from uploads/ to a complete L1 library** (13 open).

`apui` (one pipeline entry point — uploads/ to library/ through a single
documented path), `d5f1` (narrative description per image, localized, including
images extracted from PDFs), `p67i` (CSV and spreadsheet), `r8br` (**blocker**:
pdf-images classifies browser-print nav icons as figures, so 7 documents cannot
be completed), `rkqp`, `1r0p` (audio), `3psh`, `eief` (CSVW), `ktt2`
(round-trip translation QA), `r279` (which transcription backend, and what CI
pays for it), `v1hw`, `xeg6`, and the `slw1` epic itself.

## Why this one is first in the queue

**It has a named external consumer that is already blocked.** PR #881
(stream 3's surface) recorded finding `m4xy` and did not act on it:

> WHO's conceptual figures are **vector** and invisible to the raster
> extraction arm. `9789240120747-eng` declares six figures and eighteen tables
> and extracts **zero** images, reporting a *determined empty*. An entry can be
> L1-complete, gate-green, and missing every figure it declares.

That is an ingest defect surfaced by a goal stream that correctly declined to
widen its PR to fix it. `r8br` is the same shape from the other direction — the
classifier admitting the wrong things while `m4xy` is it missing the right ones.

**An L1-complete entry that is missing its figures is the `1xhc` defect wearing
an ingest hat**: a gate that reports a determined empty over content it cannot
see. Coordinate with stream 4, which owns that thesis.

## Before starting

- Re-measure. This entry was written 2026-09-22 and its counts are only as good
  as that timestamp.
- `r279` and the `deletion-requires-confirmation` questions in `fgkb`
  (`qou/uploads/` still holds #881's originals) are **owner decisions**, not
  yours. Ask them as selectable options.

## Done when

- [x] A session is launched against this entry and moves it to `in-progress` —
  2026-09-23, session_01VDGHtziYnxbEkZEcNBz2PD
- [x] `m4xy` and `r8br` both have a root cause, not a workaround — **both already
  do**, see below. Neither is the open work this entry described.
- [ ] `apui`'s single documented path exists and is the only one

## Re-measured on launch, 2026-09-23 — this entry is wrong in three places

Its own first instruction is *"Re-measure. This entry was written 2026-09-22
and its counts are only as good as that timestamp."* Doing so changed what the
stream is.

**1. `r8br` is not a blocker. It is done bar one step.** `is_capture_print()`
is at `cat-harness/scripts/pdf-images.py:90`, keyed on `Skia/PDF` **and**
`Mozilla/` — both signals, never either. That is option 3, the browser-print
rung, which `r8br` itself called the only fix addressing the cause rather than
the symptom. Three of its four done-whens are ticked. The one left is promoting
seven staged documents; `cat-harness/ingest-staging/` is gitignored and so is
absent from any fresh container, but the source PDFs are still in `uploads/`,
which makes it re-doable rather than lost.

**2. `m4xy` has a root cause and its reporting fix shipped** —
`declaredFigureLabels()` plus a third outcome in `check-l1-complete.ts`. What
remains on it is **two owner decisions**, not implementation.

**3. The `1xhc` framing above is backwards, and this is the correction that
matters.** This entry says an L1-complete entry missing its figures is *"the
1xhc defect wearing an ingest hat: a gate that reports a determined empty over
content it cannot see."* It is the opposite. From
`cat-harness/test/results/library-qa/9789240120747-eng.qa-results.json`:

> `notDerivable` — *"no raster image was placed, and the text declares at least
> 6 captioned figure(s) — they are drawn in vector and no arm reads them (bean
> m4xy)"*

The gate names exactly what it cannot see, and names the bean for it. That is
`1xhc` **satisfied**, not breached. An agent sent here to fix the reporting
would find nothing to fix — and would be at risk of "fixing" an honest report
into a silent one.

**Claims checked before touching anything.** All five `in-progress` children of
`slw1` — `r8br`, `apui`, `d5f1`, `p67i`, `rkqp` — are **abandoned claims**:
each has commits in merged history and **no live branch**
(`bean-coordination` §"A claim is branch-local"). Not re-set here, because that
is not this session's call; recorded so the next reader does not count five as
live.

**So the agent-actionable work in this stream** is `apui`, `r8br`'s promotion
step, `3psh`, `v1hw`, `eief` and `xeg6` — and *not* the two headline items,
which wait on the owner.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open branch touches it; the sessions that held theme D (content folios, SMART/FHIR stack, ingest) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C). This is a queue/tracker
entry, not work in itself. Its last open Done-when item was `apui`'s single
documented path, and `apui` is completed. The stream's still-open beans
(`d5f1`, `1r0p`, `eief`, `ktt2`, `r96p`) are tracked on their own under
`slw1`, which stays open, so closing the queue entry loses no work.


## Summary of Changes

Mirror copy. Owned by litlfred/folio-assistant-core's store, where drain lane C closed it (folio-assistant-core#28; its last item, apui, is done). Closed here so no lane repeats it.



## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C). This is a queue/tracker
entry, not work in itself. Its last open Done-when item was `apui`'s single
documented path, and `apui` is completed. The stream's still-open beans
(`d5f1`, `1r0p`, `eief`, `ktt2`, `r96p`) are tracked on their own under
`slw1`, which stays open, so closing the queue entry loses no work.
