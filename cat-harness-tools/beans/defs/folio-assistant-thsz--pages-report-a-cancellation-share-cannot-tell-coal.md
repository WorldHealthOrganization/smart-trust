---
# folio-assistant-thsz
$schema: bean/1.0.0
title: 'PAGES REPORT: a cancellation share cannot tell coalescing from starvation, and it read as alarming to its own author'
status: completed
type: bug
priority: normal
created_at: 2026-09-25T16:28:41Z
updated_at: 2026-09-26T03:54:28Z
parent: folio-assistant-1xhc
---

`3yi4` built the Pages section so somebody could ask *"are the previews
actually building?"*. It reports the counts and deliberately grades no share —
there is no calibrated threshold for "too many cancellations", the same refusal
that stopped `6xaz` inventing a size threshold.

**That refusal was right and it is not enough.** The number it prints is the
one a reader forms a judgement from anyway, and today it led its own author to
the wrong one.

## What happened, 2026-09-25

The section reported **78 cancelled, 21 succeeded** over 21.8h. I read that as
*"the site has not published in ten hours"* and was about to report a live
outage.

It was not one. The measurement that settles it:

| | |
|---|---|
| newest run before the quiet period | **succeeded**, 04:57Z |
| runs between 04:57Z and 15:42Z | **none** — the repository was idle |

The 430-minute "gap" was nobody pushing, not builds failing. The site was
current the whole time.

## The distinction the section cannot draw

GitHub Pages has **one deployment per repository**. Every push to the publish
ref starts a site build and cancels the one in flight, so during any burst most
builds are cancelled *by design* and the last one publishes everything on the
ref. A high cancellation share is the NORMAL shape of a busy hour.

So the same number means two opposite things:

| newest settled run | pushes still arriving | what it means |
|---|---|---|
| **succeeded** | — | coalescing. The site is current; the cancellations behind it shipped their content in the survivor |
| **cancelled** | yes | **starvation**. Nothing is getting through, and the site is as of the last success |

The section prints neither, so the reader supplies the interpretation — and the
first reader to try supplied the alarming one.

## Why this is a floor, not a threshold

It needs no calibration and invents no cutoff. *"Did the most recent deployment
to settle succeed?"* is answerable from the runs already fetched, exactly as
*"is the build directory empty?"* is in `oisv` and *"did any deployment
succeed?"* already is in this same function.

## Done when

- [x] the section says whether the **newest settled** deployment succeeded, and
      when the last success was
- [x] `latest` and newest-settled are kept apart — `latest` is `pages[0]`, which
      is routinely still in flight (it was, in the run that produced this bean)
- [x] a reader can tell coalescing from starvation **without** knowing how
      GitHub Pages schedules deployments
- [x] still no graded share, and no staleness threshold
- [x] a mutation over each new branch is caught by a NAMED test

## Not in scope

Reducing the cancellations. That is the publish-ref contention (`yzsj`, closed;
anything past it is new ground), and this bean is about the report being
readable, not about the number being smaller.

---

## Summary of Changes — re-derived and closed 2026-09-26

Shipped in [PR #1350](https://github.com/litlfred/folio-assistant/pull/1350),
merged. Like `c3d7` beside it, this bean was left `in-progress` with every box
unticked after its work landed — the `4d22` orphan shape, twice in one PR, by
the session that wrote both. Recorded rather than quietly corrected.

Re-derived against merged `main`, not ticked from memory:

| box | evidence |
|---|---|
| the section says whether the **newest settled** deployment succeeded, and when the last success was | live output: *"The newest deployment to settle did NOT succeed (cancelled, 2026-09-26T03:51:39Z), and the site is as of 2026-09-26T03:38:00Z"* |
| `latest` and newest-settled kept apart | `ci-health.ts:981` `latest: pages[0]`; `:994` `newestSettled = pages.find(r => r.status === "completed")` — two different reads |
| a reader can tell coalescing from starvation without knowing how Pages schedules | the same output names both by word and says which applies, with the last-success time to judge from |
| still no graded share, no staleness cutoff | 0 matches for a percentage, `stale for N`, or `more than N minutes` across the whole section |
| a mutation over each new branch caught by a NAMED test | 51 pass in `pages-health.test.ts`; 8 of 8 mutations caught, each named |

**What the live run shows is worth keeping**: 13 minutes behind, newest settled
cancelled, a build in flight. Before this change the same state printed a bare
cancellation share, and the first reader to meet it — me — took it for a
ten-hour outage that was a quiet afternoon.
