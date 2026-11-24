---
# folio-assistant-zpso
$schema: bean/1.0.0
title: Glass settings panel opens under the tile dock (navbar wireframe, seen on the build)
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
created_at: 2026-10-06T18:52:19Z
updated_at: 2026-10-07T17:15:00Z
parent: folio-assistant-4ccr
---

Recorded in the navbar wireframe's Findings ("Seen on the build, not one of the twelve"), re-drawn in #2295 (bean `folio-assistant-1q4b`); first noted in #1810 as "found, not fixed".

## Defect

At 1280×800, opening ⚙ Glass settings from the tile dock puts the panel at y = 591. Its body sits under the fixed tile dock until the reader scrolls the glass. The controls the tile has just opened cannot be reached.

## Root cause

`.fa-glass-panel` was in the glass sheet's normal flow, AFTER the shelf. The shelf has `min-height: 50vh` (it is a surface to grab even when empty), so the panel always started at least half a viewport down. The dock is `position: fixed` at the bottom and overlays that region. Focusing the panel title scrolled only the title into view (the sheet has `scroll-padding-bottom`), never the body. Every panel the strip opens (Todos, More, Filter, Glass settings) had the same placement. Glass settings is the tallest, at about 910 px in one column.

## Done when

- [x] At 1280×800, Glass settings opens wholly above the dock's visible top edge, with the dock shown and with it hidden. Every control can be reached with no scrolling. PR #2312. On a `preview:site` build with the dock shown, the panel runs from y = 116 to 637 against the dock's top at 656, and its body is 455 of 455 px, so nothing scrolls. Asserted in `glass-panel-in-view.e2e.ts` by hit-testing every control, on a bare page and on a page with the launcher.
- [x] At 390×844 the panel frame, its title and its × are wholly above the dock in both dock states. The content (about 940 px) is taller than the room, so the panel's own body scrolls. The glass does not scroll. On the build: frame from y = 37 to 706 against the dock at 718, and body 823 of 610 px. The e2e reaches every control by scrolling the body only, and asserts that the glass's scroll positions do not change.
- [x] An e2e test fails on the old placement and passes on the fix. The existing `glass*.e2e.ts`, `search-band`, `folio-mount` and `mounted-locale` e2e tests stay green. On main, `glass-panel-in-view.e2e.ts` failed 6 of 8 in its first form. The regression set ran 233 tests and found 1 real regression: `glass-pop-outs` "so does every other tile's pop-out — Settings", where a 64rem panel covered the empty glass the test drags. The fix was to cap the width at 60rem. After that the set is green.
- [x] There are before and after screenshots at 1280 and 390: `navfix-settings-{before,after}-{1280,390}.png`, taken on `preview:site` builds of main and of this branch. Before: the panel top is at 614 at 1280, under the dock at 656.
- [x] The navbar wireframe's Findings mark this as fixed, citing the PR (#2312). `wireframe:check` and `check:wireframes` pass.

## Completed
All 5 acceptance criteria completed and verified. Settings panel layering under tile dock fixed and verified.
