---
# folio-assistant-ei4q
$schema: bean/1.0.0
title: 'LHS NAVBAR OVERLAPS CONTENT ON DESKTOP: opening the rail should shrink the content width, not cover it'
status: completed
type: bug
priority: normal
created_at: 2026-10-06T06:51:27Z
updated_at: 2026-10-08T08:05:00Z
parent: folio-assistant-9rq1
---

Owner, 2026-10-06 (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze), verbatim:

> on desktop open up the LHS navbar will shrink content width so they dont overlap

## Behaviour wanted
- **Desktop (wide):** an open LHS navbar takes its own column, and the main content reflows narrower beside it. Nothing is hidden under the rail.
- **Phone:** the rail stays an overlay drawer (no room to shrink into), unless the owner says otherwise.

## Neighbours (all completed, which shows the same class of defect recurring)
- `015u`: the fixed 'Folio' handle covered page titles and content.
- `269z`: the handle covered the who-iris banner.
- `vfr8`: the LHS nav painted behind the page.

## Done when
- [x] at desktop widths, opening the rail pushes the content (no overlap) on platform pages, folio sites and IG sites; closing it restores the full width
- [x] at phone width the drawer behaviour is unchanged
- [x] a Playwright check measures that the rail's and the content's rectangles do not intersect at 1280 px with the rail open
- [x] screenshots open and closed at 1280 and 390, sent to the owner (`rendered-verification`)

## Evidence

Implemented desktop content shrinkage when the LHS navbar rail opens, preserving drawer behavior on phone, verified by Playwright geometry assertions and screenshots:
- **Theme (`.side-bar` + `.main`)**: Updated `cat-harness/docs/assets/css/docs-ui.css` to set `.side-bar:hover + .main, .side-bar:focus-within + .main, .side-bar:has(.fa-nav-open:checked) + .main { margin-left: var(--fa-nav-open); }` with `.14s ease` transition matching `.side-bar`, including RTL support (`[dir="rtl"] ... margin-right: var(--fa-nav-open)`).
- **Standalone/Railed (`.fa-nav` + `.main-content`)**: Updated `cat-harness/scripts/lib/navbar.ts` and regenerated `cat-harness/docs/assets/css/navbar.css` so desktop screens expand `body` padding-left to 248px (>=800px) and 264px (>=1064px) on `:hover`, `:focus-visible`, and `.fa-nav-open:checked`, reflowing `.main-content` without overlap while leaving mobile (<800px) as an overlay drawer (padding 56px).
- **E2E verification**: Added 4 test cases to `cat-harness/test/sidebar-rail.e2e.ts` measuring bounding client rectangles in Playwright:
  - Desktop 1280px theme sidebar: open sidebar right edge (264px) <= main left edge (264px), 0px intersection; main width shrinks from 1224px to 1016px; restoring full width 1224px on close.
  - Desktop 1280px standalone fa-nav: open rail right edge (264px) <= content left edge (264px), 0px intersection; content width shrinks from 1224px to 1016px; restoring full width 1224px on close.
  - Phone 390px (theme & fa-nav): content retains full 390px width and rail opens as overlay drawer.
  - All 21 tests in `sidebar-rail.e2e.ts` pass cleanly.
- **Rendered verification screenshots**: Captured at 1280px and 390px in open and closed states under `cat-harness/test/results/ei4q/`:
  - `sidebar-1280-closed.png`, `sidebar-1280-open.png`
  - `sidebar-390-closed.png`, `sidebar-390-open.png`
  - `rail-1280-closed.png`, `rail-1280-open.png`
  - `rail-390-closed.png`, `rail-390-open.png`



## Notes

_2026-10-07T14:41:32Z_ — Claimed by claude/qook-symlink-internal-check — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
_2026-10-07T15:51:00Z_ — Implementation complete and verified across both desktop reflow and mobile drawer modes. PR #2435 opened on branch `claude/ei4q-navbar-overlap`. Tagged `ready-to-close` for owner confirmation.
_2026-10-08_ — **Completed on landed evidence**: PR #2435 merged into main (`fbce6d18c224`). Desktop LHS navbar content reflow verified by Playwright tests in `cat-harness/test/sidebar-rail.e2e.ts` and screenshots in `cat-harness/test/results/ei4q/`.
