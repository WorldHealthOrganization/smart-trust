---
# note on folio-assistant-ob3m from claude/quirky-hypatia-k3aoh4-sidebar-rail
$schema: folio-bean-note/v1
bean: folio-assistant-ob3m
branch: "claude/quirky-hypatia-k3aoh4-sidebar-rail"
created: "2026-10-02"
---
## merge with #1805: harnesses beside Graphs

**Merging main (#1805) into #1808: ▦ Harnesses stays beside Graphs, not inside it.**

#1805 (finding 1) and #1808 (finding 7) disagreed about one node. #1805 made ▦ Harnesses a mark in the 56px strip at rest, one click from a harness link. #1808 folded the harness group inside the Graphs disclosure, which hides it at rest and puts it two clicks away. That is the state the finding-1 ruling removed.

**Resolution.** `mountSidebarRail` still moves the harness group out of the footer and into the one `.fa-nav-middle` scroller, but as its own folded disclosure (`.fa-nav-harness-group`) after Graphs. Graphs now holds FOLDERS only. This is the viewer rail's own order (`navbarHtml`: graphs in the middle, harnesses below them, then home).
- Both folded headings are pinned to the scroller's bottom edge.
- Graphs sits on top of ▦, offset by ▦'s measured height (`--fa-nav-harness-rest`).
- `margin-top: auto` keeps ▦ under the pointer when the strip widens on a short page.
- There is still one scroll region, with no ☰ and no ×.
- #1805's `data-fa-tip` on the harness rows' ⚙ still applies after the move.

Evidence: `sidebar-rail.e2e.ts` (now asserts the side-by-side layout and the tooltip after the move), `rail-tips.e2e.ts` (landing and viewer: ▦ at rest, one click), `navbar-row.e2e.ts` and `settings-crosslinks.e2e.ts`. All 311 tests in the 14 navbar-related specs pass on Chromium.
