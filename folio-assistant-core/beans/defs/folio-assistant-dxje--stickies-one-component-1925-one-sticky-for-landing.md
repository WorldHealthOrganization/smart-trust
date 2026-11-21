---
# folio-assistant-dxje
$schema: bean/1.0.0
title: 'STICKIES ONE COMPONENT (#1925): one sticky for landing + todo, faded theme, compact icon row underneath, confirmed discard to fsh-guts'
status: completed
type: task
priority: normal
created_at: 2026-10-02T21:16:11Z
updated_at: 2026-10-04T19:55:09Z
parent: folio-assistant-6lb8
---

Issue #1925. Owner ruling 2026-10-02: "dont treat stickies differently. combine best of each. lower faded avatar/theme looks nicer. upper smaller same size closed looks niceer. icons are a mess on both. make compact underneath. [x] is what? send to fsh-guts? make sure confirmed by user"

## Done when
- one renderer for landing and todo stickies; same size closed; faded avatar/theme on all
- one icon row under each sticky: view, edit, pin, send to fsh-guts; same order
- discard asks for confirmation (Cancel/Escape keep the sticky)
- e2e covers the four; before/after screenshots at 1280 and 390


## Closed on evidence, 2026-10-04

Landed in #1926 (`64af5229`); issue #1925 is closed. Re-derived on `main` (session https://claude.ai/code/session_01Ga3HjmX3ag9vTgZWDSmsFi): one renderer `stickyTile` (`docs-ui.js:4400`), one icon row `stickyActions` (`:4434`), discard confirms first `confirmSendToFshGuts` (`:4528`), and 12 screenshots under `test/results/screenshots/stickies-redesign-1925/`. `sticky-one-component.e2e.ts` covers all four items and is not skipped; End-to-end is green on `main` @ `84a36a8`. One caveat: #1941 later added a leading page link for todos with their own page, so landing and todo rows can differ by that link, and this spec's fixture likely does not exercise it.
