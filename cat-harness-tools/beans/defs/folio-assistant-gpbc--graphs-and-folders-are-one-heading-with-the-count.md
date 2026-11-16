---
# folio-assistant-gpbc
$schema: bean/1.0.0
title: Graphs and Folders are one heading, with the count badge
status: completed
type: task
priority: normal
created_at: 2026-10-05T14:39:33Z
updated_at: 2026-10-06T05:55:27Z
parent: folio-assistant-9rq1
---

Owner, 2026-10-05: 'graphs containing ONLY folders is weird. combine w/ badge of count.' mountSidebarRail wraps mountInstanceGraphs' 'Folders N' details in a second 'Graphs' details. Make one disclosure titled Graphs carrying the count.

## Done when
- [ ] one 'Graphs N' disclosure on the theme sidebar; the rail already has one
- [ ] e2e updated

_2026-10-05T15:25:10Z_ — Claimed by claude/vibrant-darwin-r6im60 — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

Done in this branch: the count moves onto the Graphs heading and Folders is held open with its heading hidden (rows still Folders' nodes, moved; the group's pin rules unchanged). Rendered: one 'GRAPHS 28' that opens straight to the list. 94 e2e pass across navbar-row, sidebar-rail, rail-icon-row, action-tiles.

Merging main (2026-10-05 16:20): #2152 (graphs-nav) had already removed the Graphs wrapper — Folders now sits in the scroller as ONE disclosure, 'FOLDERS N' with its count badge, opening on arrival when the page is one of its rows. That meets the owner's 'combine w/ badge of count'; this branch's wrapper-based version was dropped in favour of main's.

## Summary of Changes — closed on evidence, 2026-10-06
Main's #2152 version won (see the note above). Measured on gh-pages build.json sha f4f5910 (built 2026-10-06T05:36Z), served from git and rendered in Chromium at 1280x800 and 390x844, session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92: the theme sidebar has ONE 'FOLDERS 29' disclosure with its count badge, and no Graphs wrapper around it. The rail keeps its own '▤ Graphs'. Meets the owner's 'combine w/ badge of count'.
