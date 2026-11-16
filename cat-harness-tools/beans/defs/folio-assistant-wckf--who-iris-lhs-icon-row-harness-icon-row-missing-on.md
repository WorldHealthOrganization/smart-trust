---
# folio-assistant-wckf
$schema: bean/1.0.0
title: 'WHO-IRIS LHS ICON ROW: harness icon row missing on .fa-nav rail pages (mountNavIconRow binds .side-bar only)'
status: completed
type: bug
priority: normal
created_at: 2026-10-05T05:32:26Z
updated_at: 2026-10-05T10:14:50Z
parent: folio-assistant-9rq1
---

Owner, 2026-10-05: 'still no LHS icons top navbar on who-iris page' — confirmed it is the harness icon row (todos, beans, processes, kg, fsh-guts, launcher). Likely cause: docs-ui.js mountNavIconRow() requires .side-bar (just-the-docs); who-iris replica pages carry the harness rail nav.fa-nav instead. who-iris.json declares no navbarIcons (absent = inherit cat-harness's). Related, not duplicate: 2vpn (header mark, #2121). Starts after #2120 merges; owner chose 'New PR from me'.

## Done when
- [ ] who-iris pages show the row at the top of the LHS rail
- [ ] one mechanism draws the row for .side-bar and .fa-nav, no second copy
- [ ] a gate fails when an .fa-nav page lacks the row
- [ ] screenshots (desktop + phone) and staging deep link on the PR


## Summary of Changes

Merged in #2149 (merge 0a95260, 2026-10-05; owner: "merge all green and ready").
- lib/harness-rail.ts: injectRail writes the #fa-navbar-row data block (withNavbarRow); mount-instance-docs.ts and viewer-page.ts pass navbarRowData.
- docs-ui.js mountNavIconRow draws into nav.fa-nav as well as .side-bar; docs-ui.css sizes the row in the rail (56px collapsed, flat open, 18px glyphs).
- Tests: navbar.test.ts data-block tests plus a gate over every committed railed page; rail-icon-row.e2e.ts; standalone-rail.test.ts.
- All 92 railed pages regenerated. The rest of the one-navbar work is 9rq1 (under GOAL 4, rwmf).
