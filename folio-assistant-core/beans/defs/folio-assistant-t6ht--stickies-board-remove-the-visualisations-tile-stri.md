---
# folio-assistant-t6ht
$schema: bean/1.0.0
title: 'STICKIES BOARD: remove the Visualisations tile strip (owner 2026-10-02, reverses v0jv) — issue #1905'
status: completed
type: bug
priority: normal
created_at: 2026-10-02T18:39:58Z
updated_at: 2026-10-04T19:55:09Z
parent: folio-assistant-6lb8
---

Owner, 2026-10-02: "stickies panel shouldnt have all those icons". Remove .fa-board-strip from every sticky board; tiles stay reachable via navbar + glass. Issue #1905.


## Closed on evidence, 2026-10-04

Landed via #1907, merged in train #1924 (`225b7cf`); issue #1905 is closed. Re-derived on `main` (session https://claude.ai/code/session_01Ga3HjmX3ag9vTgZWDSmsFi): `fa-board-strip` appears in no live JS, include or script, only in a CSS comment and in `graph-tiles.e2e.ts:313-315`, which asserts it is ABSENT (count 0) while navbar tiles remain. End-to-end is green on `main`.
