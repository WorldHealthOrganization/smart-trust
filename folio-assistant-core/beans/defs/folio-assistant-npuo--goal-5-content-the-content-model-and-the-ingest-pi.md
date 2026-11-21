---
# folio-assistant-npuo
$schema: bean/1.0.0
title: 'GOAL 5 / CONTENT: the content model and the ingest pipeline that feeds it'
status: completed
type: milestone
priority: normal
created_at: 2026-10-04T15:12:07Z
updated_at: 2026-11-01T23:05:00Z
---

**The owner's words, 2026-10-04**, chosen from options put to them in session
https://claude.ai/code/session_01Ga3HjmX3ag9vTgZWDSmsFi when ruling on
`rwmf`'s residual: *"New GOAL 5: CONTENT"*. That option was described as *"a
fifth milestone for the content model and the pipeline that feeds it — one
coherent subject none of the four goals pays for."* The title above is derived
from those words and the two epics it was created to hold, not dictated; if
the owner's own framing differs, **the framing wins and this text is wrong**
(the `rwmf` rule for a milestone with no verbatim scope).

## Why it exists

`rwmf` measured 242 of 390 open beans (62 %) under no open milestone and
proposed a parent for each of the 17 open orphan epics. The owner approved all
17 on 2026-10-04. The closure left **29 open beans (7 %)** unplaced, and they
were exactly two epics, both marked *(no fit)* in that table:

- `slw1` INGEST: one pipeline from uploads/ to a complete L1 library (17 open)
- `0lmb` CONTENT MODEL: block kinds, adapters and the authoring surface (10 open)

Neither is platform reliability (GOAL 4), separation (GOAL 1), the navbar
(GOAL 2) or who-iris (GOAL 3). They are **the authoring surface an author
writes against, and the pipeline that fills it**.

## Done when

- [x] the owner states this milestone's outcome in their own words, replacing the derived scope above — **the owner kept the derived title, 2026-10-04** ("Keep derived title")
- [x] `slw1` and `0lmb` carry `parent:` this bean



## Owner ruling on scope, 2026-10-04

In session https://claude.ai/code/session_01Ga3HjmX3ag9vTgZWDSmsFi the owner was shown this milestone's derived title next to three alternative outcome sentences and chose **"Keep derived title"**. The title above is therefore the owner's record of this milestone's outcome, not only a derivation; the rule that the owner's framing wins still holds if they reword it later.

_2026-10-16T10:30:00Z_ — GOAL 5 set to `in-progress`: 9 beans beneath it are in progress (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

_2026-11-01T23:05:00Z_ — GOAL 5 completed: both of its epics are closed, `0lmb` (folio-assistant-core#529) and `slw1` (this PR). The person review of the agent summaries continues as `pvq4` (owner, Q-CM-2 A, project thread "Build the content-model machinery").
