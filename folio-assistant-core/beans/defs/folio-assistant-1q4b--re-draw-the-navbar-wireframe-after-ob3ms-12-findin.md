---
# folio-assistant-1q4b
$schema: bean/1.0.0
title: Re-draw the navbar wireframe after ob3m's 12 findings landed
status: completed
type: task
created_at: 2026-10-06T05:55:48Z
updated_at: 2026-10-06T18:30:00Z
parent: folio-assistant-4ccr
---

ob3m's closing step, split out when ob3m closed on 2026-10-06: 'When fixed, re-draw cat-harness/docs/wireframes/navbar/ and re-run wireframe:check and check:wireframes.' intent.md's Observed and Findings sections still describe main with #1010/#1022 (before #1762, #1804, #1805, #1807, #1808 and #1819), so the wireframe documents a navbar that no longer exists.

## Done when
- [x] as-is.html and intent.md Observed re-drawn from a built page (preview:site or gh-pages), not from source — drawn from the gh-pages build of main 7ef9d3a (its build.json: built 2026-10-06T15:04:58Z), extracted from the gh-pages branch because the proxy refuses the published URL, served at /folio-assistant/ and driven in Chromium at 1280×800 and 390×844. Method and every measurement: intent.md §"How this was drawn" and §Observed.
- [x] Findings marks each of the 12 as fixed / ruled-as-is, with the PR — all 12 fixed on the built page: 1 #1805, 2 #1762, 3 #1762 + #1807, 4 #1762, 5 #1762, 6 #1804, 7 #1808, 8 #1762 + #1808, 9 #1762, 10 #1819, 11 #1762 (gates #1589, #1723), 12 #1810. The C@T sticky's authored `bodyAppend` is ruled-as-is. Two residuals recorded that are not among the twelve: the Glass settings body sits under the dock at 1280, and Beans reads 541 on the icon row but 943 on the tile.
- [x] wireframe:check on as-is.html and check:wireframes pass — `as-is.html: web/renders=pass web/no-overflow=pass web/no-placeholder=pass mobile/renders=pass mobile/no-overflow=pass mobile/no-placeholder=pass`; `wireframes: 51/51 declared visualiser(s) covered`; judge mode `OK … 0 gap(s)`.

_2026-10-06T15:44:13Z_ — Claimed by claude/1q4b-navbar-wireframe — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

_2026-10-06_ — Two corrections to ob3m's record, found while re-checking on the build. (1) The `check:navbar-consistency` gate (finding 11, declared half) landed in **#1589** ("Goal-review arc + the navbar QA check"), not #1687, which is an adapters PR. (2) ob3m's closing summary says finding 3's sticky half was "left as authored"; on the build it is fixed by #1807 — both cards open on the declaration's summary.

## Merged 2026-10-06 (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92)
#2295 merged as cd0e90e after CI PASS on its head (`ci:watch`); every Done-when box above was ticked with evidence, re-checked before merging.
