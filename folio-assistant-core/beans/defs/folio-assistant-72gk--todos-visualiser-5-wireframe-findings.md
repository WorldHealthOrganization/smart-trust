---
# folio-assistant-72gk
$schema: bean/1.0.0
title: 'todos visualiser: 5 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-todos
created_at: 2026-09-23T10:36:15Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/todos/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **The items are not on the page.** `assets/todos/index.json` carries 3 items, each with a summary, status, priority, target page and `viewHref`/`editHref`: "The human-todos page still says 'Not built yet' — the store now exists" (open, high), "Decide which roles content-pipeline-navigator and platform-boundary-guard take on" (blocked), and "Decide what 'kick off' means mechanically for the two CI-watcher dispatch points" (in_progress). The visualiser shows only "1 open / 3 total". A person cannot find out from it *which* item is open, or reach any item.
2. **"Open" means something different from the beans page beside it.** The counts panel counts only status `open`, so the blocked and in-progress items appear only in "total". On `beans/`, "open" is the resting status plus in-progress. The two sibling dashboards use one word for two definitions.
3. **Most of the first screen is the list of other graphs.** At 1280×800 the counts panel takes about 115 px, and the rest of the viewport is the 7 state-graph cards. At 390 px it is the same pattern.
4. **The heading order skips a level, and the tags run into the names.** These are shared with `beans/`: the panel title is an `h3` directly under the `h1`, and the card headings' text reads "beanslive", "todoslive" and so on, because the tag span has no separator.
5. **No way back to the site.** There is no `nav` or `header` and no link home. The page is dark by default, with no scheme control. (→ `folio-assistant-dc64`)

When fixed, re-draw `cat-harness/docs/wireframes/todos/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Items not on the page (only '1 open / 3 total'): [data-fa-workplan] renders only 'TODOS — THE HUMAN HALF / 1 open / 3 total' (0 links, none of the 3 item summaries present) although assets/todos/index.json has 3 items.
- **STILL-PRESENT** — 'Open' means something different from beans page: Panel still shows '1 open' with 3 items of status open/blocked/in_progress — counts status==open only.
- **STILL-PRESENT** — First screen is mostly the list of other graphs: At 1280x800 the workplan panel is 117px tall (y=112); 'State graphs this harness declares' list starts y=292 and fills the rest (7 cards). Same at 390x844 (panel y=112 h=117, list y=292).
- **STILL-PRESENT** — Heading order skips a level; tags run into names: Headings: H1 'todos' → H3 'Todos — the human half' (skips h2). Card h2 textContent: 'beanslive','healthdeclared','todoslive',… (span.sv-tag has no separator).
- **STILL-PRESENT** — No way back to the site; dark by default, no scheme control: PARTIAL: nav.fa-nav[aria-label=folio-assistant] now present with 3 links home ('../') — way back FIXED (fa-nav, e.g. 805bbd1ba/earlier viewer-nav work). Still dark under prefers-color-scheme: light (body bg rgb(13,13,13), fg #fff); follows only a saved localStorage fa-color-scheme=light (then bg rgb(249,249,247), co… — 805bbd1ba

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Items not on the page (only '1 open / 3 total'): [data-fa-workplan] still renders only 'TODOS — THE HUMAN HALF / 1 open / 3 total', with 0 links and none of the 3 item summaries. assets/todos/index.json has 3 items. (D/p_todo.js)
- **STILL-PRESENT** — 'Open' means something different from beans page: The panel still shows '1 open' for 3 items whose statuses are open/blocked/in_progress, so it counts only status==open. (D/p_todo.js)
- **STILL-PRESENT** — First screen is mostly the list of other graphs: At both 1280×800 and 390×844 the workplan panel is 117px tall at y=112. 'State graphs this harness declares' starts at y=292 and fills the rest (7 cards). (D/p_todo.js)
- **STILL-PRESENT** — Heading order skips a level; tags run into names: The headings go H1 'todos' → H3 'Todos — the human half' → H2, skipping h2. The card h2 textContent runs 'beanslive', 'healthdeclared', 'todoslive', … with no separator. (D/p_todo.js)
- **STILL-PRESENT** — No way back to the site; dark by default, no scheme control: PARTIAL, as on 2026-09-29. nav.fa-nav[aria-label=folio-assistant] is present with 3 home links, so the way back stays fixed. With prefers-color-scheme: light and nothing saved, the body is still rgb(13,13,13) on #fff and data-fa-scheme is null. Only a saved fa-color-scheme=light turns it light (rgb(249,249,247)). There is no scheme button on the page. — 805bbd1ba (scheme.mjs)

_2026-10-02T18:41:04Z_ — Claimed by claude/todos-page-stickies — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Closed 2026-10-09

Closed on landed evidence in `main`.
- Implemented in PR #1909 (`claude/todos-page-stickies`) and merged into `main` via commit `739f5da94fd7`.
- Documented in `cat-harness/docs/wireframes/todos/intent.md` (commit `138ec60d88b3`).
- All 5 wireframe findings verified fixed or retired:
  1. Fixed: Items rendered as stickies on board and in footer no-JS floor.
  2. Retired: Legacy counts panel removed from `/todos/`.
  3. Fixed: State-graph cards list removed from `/todos/`.
  4. Retired: Run-together card tags / h3 panel removed from `/todos/`.
  5. Fixed: Themed Jekyll layout with navbar, home links, and color-scheme support.
- Tests: `cat-harness/test/todos-page-board.e2e.ts`.


_2026-10-16T06:30:00Z_ — Store reconciliation: status `in-progress` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: in-progress). Evidence: closed in the folio-assistant store copy (2026-10-09); commit 138ec60d is on folio-assistant main, commit 739f5da9 is on folio-assistant main. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
