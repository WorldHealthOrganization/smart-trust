---
# folio-assistant-9rq1
$schema: bean/1.0.0
title: 'ONE NAVBAR: every navbar capability is a harness feature, drawn by one mechanism on every layout (.side-bar, .fa-nav rail, viewer pages)'
status: completed
type: feature
priority: normal
created_at: 2026-10-05T05:37:13Z
updated_at: 2026-10-29T07:32:15Z
parent: folio-assistant-rwmf
---

Owner, 2026-10-05, choosing how to fix the missing harness icon row on who-iris pages (#2147): '1... this should be a common navbar funcationliatyt in harness. should be a bean about this'.

## The gap this names
The navbar's capabilities are defined per LAYOUT, not per harness. The harness icon row (mountNavIconRow in docs-ui.js) binds only just-the-docs's .side-bar and reads data that only head_custom.html writes. Pages railed by lib/navbar.ts (who-iris replicas, viewer pages) therefore never get it. Bean 2vpn was the same class of defect for the header mark (two callers, two readers), fixed by one resolver.

## Rule
A navbar capability is declared once for the harness (cat-harness.json navbarIcons, marks, and so on) and drawn by one mechanism wherever a harness navbar appears. A capability that exists on one layout and not another is a defect, not a design.

## Done when
- [x] inventory: every navbar capability x every layout it appears on, measured on built pages (completed in child bean `lhvt`)
- [x] each capability drawn by one mechanism on every layout (first: harness icon row — done, bean wckf / #2149; `navbar-row.js` + `rail-standalone-pages.ts --theme-source` / `harness-rail.ts` replacing `.side-bar` with the server-built folio rail `nav.fa-nav` across all layouts per 2026-10-15 "folio rail everywhere" ruling)
- [x] a gate fails when a harness navbar on any layout lacks a capability its harness declares (`check-navbar-consistency.ts`, `check-viewer-nav.ts`, `navbar-consistency.test.ts`, `rail-section-parity.test.ts`)
- [x] the navbar skill states the rule (`cat-harness/skills/ui/ui-core/harness-tiles.md` §"Neither navbar picks the words", §"The navbar icon row is DECLARED, and three states is not two", §"On a folio's own site, a tile describes the FOLIO")

*Stays `in-progress` until child bean `xka5` completes (10 of 11 children completed: `82qs`, `gpbc`, `ei4q`, `lhvt`, `r2ld`, `gkv6`, `lnoy`, `5rmf`, `7ji4`, `wckf`).*


## Re-parented to GOAL 4 (rwmf), 2026-10-05

Created under p5wm (GOAL 2) at 05:37Z. GOAL 2 was signed off and closed on main at 04:57Z (e6ac11b), and its open UI work was moved to rwmf on the owner's "Move to GOAL 4 PLATFORM". This bean follows that ruling. check:bean-rollup flagged it as the one open child of a completed GOAL 2.

_2026-10-29T07:32:15Z_ — Completed: last child xka5 landed with cat-harness-tools#627 (6bb02ad); 11 of 11 children done.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
status: completed
```

Where: (three-way hunk)

```text
- [x] inventory: every navbar capability x every layout it appears on, measured on built pages (completed in child bean `lhvt`)
- [x] each capability drawn by one mechanism on every layout (first: harness icon row — done, bean wckf / #2149; `navbar-row.js` + `rail-standalone-pages.ts --theme-source` / `harness-rail.ts` replacing `.side-bar` with the server-built folio rail `nav.fa-nav` across all layouts per 2026-10-15 "folio rail everywhere" ruling)
- [x] a gate fails when a harness navbar on any layout lacks a capability its harness declares (`check-navbar-consistency.ts`, `check-viewer-nav.ts`, `navbar-consistency.test.ts`, `rail-section-parity.test.ts`)
- [x] the navbar skill states the rule (`cat-harness/skills/ui/ui-core/harness-tiles.md` §"Neither navbar picks the words", §"The navbar icon row is DECLARED, and three states is not two", §"On a folio's own site, a tile describes the FOLIO")

*Stays `in-progress` until child bean `xka5` (`litlfred/cat-harness-tools#627`, all 4 boxes ticked) merges (10 of 11 children completed: `82qs`, `gpbc`, `ei4q`, `lhvt`, `r2ld`, `gkv6`, `lnoy`, `5rmf`, `7ji4`, `wckf`).*
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
status: completed
```

Where: (three-way hunk)

```text
- [x] inventory: every navbar capability x every layout it appears on, measured on built pages (completed in child bean `lhvt`)
- [x] each capability drawn by one mechanism on every layout (first: harness icon row — done, bean wckf / #2149; `navbar-row.js` + `rail-standalone-pages.ts --theme-source` / `harness-rail.ts` replacing `.side-bar` with the server-built folio rail `nav.fa-nav` across all layouts per 2026-10-15 "folio rail everywhere" ruling)
- [x] a gate fails when a harness navbar on any layout lacks a capability its harness declares (`check-navbar-consistency.ts`, `check-viewer-nav.ts`, `navbar-consistency.test.ts`, `rail-section-parity.test.ts`)
- [x] the navbar skill states the rule (`cat-harness/skills/ui/ui-core/harness-tiles.md` §"Neither navbar picks the words", §"The navbar icon row is DECLARED, and three states is not two", §"On a folio's own site, a tile describes the FOLIO")

*Stays `in-progress` until child bean `xka5` (`litlfred/cat-harness-tools#627`, all 4 boxes ticked) merges (10 of 11 children completed: `82qs`, `gpbc`, `ei4q`, `lhvt`, `r2ld`, `gkv6`, `lnoy`, `5rmf`, `7ji4`, `wckf`).*
```
