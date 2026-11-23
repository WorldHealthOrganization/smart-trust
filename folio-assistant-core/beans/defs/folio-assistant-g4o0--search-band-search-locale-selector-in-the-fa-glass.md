---
# folio-assistant-g4o0
$schema: bean/1.0.0
title: 'SEARCH BAND: search + locale selector in the fa-glass-band; no overlap, magnifier right, one-click toggle'
status: completed
type: feature
priority: high
created_at: 2026-10-05T15:09:32Z
updated_at: 2026-10-06T05:23:38Z
parent: folio-assistant-o3xy
---

Owner, 2026-10-05 (two screenshots): the open search draws its 'Search everywhere' status line on top of the input; the magnifier jumps left when open; opening search pushes the locale selector to the next line. Wanted: status line below the input, magnifier on the right in both states, one button toggles, text preserved, locale selector on the same line, both controls in the fa-glass-band, Folio tab hidden while a band item is in use. Follow-up to afu3 (#1732).

## Done when
- e2e covers toggle, text preserved, no status/input overlap, locale same line + same top, Folio tab hidden while a band item is active
- before/after screenshots at 1280 and 390, open and closed
- PR green and marked ready

Issue #2201. Branch claude/zealous-gates-3o9ma2-search-band.


## Summary of Changes

Landed in #2211 (follow-up to #2201, now closed): search and the locale globe sit in the fa-glass-band, search starts closed, the magnifier stays on the right, one click opens and one closes, and the text is kept on close.
