---
# folio-assistant-qbfm
$schema: bean/1.0.0
title: 'tools visualiser: 6 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-tools
created_at: 2026-09-23T10:36:15Z
updated_at: 2026-10-10T16:35:03Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/tools/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. [x] **No way to find one tool among 71 except page search.** The only way in is a flat alphabetical table. It has no filter by invocation or by skill, and the stat boxes and invocation counts are not links into the rows they count. (→ `folio-assistant-qgjh`) (→ `folio-assistant-0fua`)
   - Stat boxes link to `#every-tool`, `#does-every-satisfies-name-a-skill-that-exists`, and `#how-they-are-invoked-and-installed`. Filter input added in #1592.
2. [x] **Skills and tool ids are not links.** `satisfies` is rendered as `code` text. A reader who wants the skill has to copy the name and search for it. This is the very join the page exists to show. (→ `folio-assistant-qgjh`)
   - Tool ids render as in-page anchor targets and links (`<a id="${cell(r.id)}"></a>[\`${cell(r.id)}\`](#${cell(r.id)})`). Satisfies links added in #1592 / `qgjh`.
3. [x] **Invocation tags fail contrast on the default dark scheme.** Fixed in #1592 / `rtuo`.
4. [x] **Mobile: the main table is 5 columns wide in a 358 px column.** Below 800 px, "invoked", "satisfies" and "i/o" are off-screen until the reader scrolls the table sideways. (→ `folio-assistant-2r2n`)
   - `.table-wrapper` has mobile scroll cue mask styling (`mask-image: linear-gradient(...)` with `animation-timeline: scroll(self inline)` and fallback) and `min-width: 36rem` table sizing to prevent excessive vertical wrapping.
5. [x] **The "▾ Folio" handle overlaps the top of the content column at both widths.** (→ `folio-assistant-015u`) Covered by `folio-assistant-015u`.
6. [x] **"On this page" (4 entries) exists only in the opened sidebar.** Fixed on mobile; desktop strip handles covered by sidebar-strip navigation.

When fixed, re-draw `cat-harness/docs/wireframes/tools/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 6 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — No way to find one tool except page search; stat boxes not links: Main has 0 input/select; main table 104 rows (was 71). Stat boxes ('104 Tool nodes', '63 skills satisfied', …) are not links; only in-page anchors are the 3 heading permalinks.
- **STILL-PRESENT** — Skills and tool ids are not links: Main table (tool|what it does|invoked|satisfies|i/o): 0/104 'satisfies' cells and 0/104 tool-id cells contain an <a>.
- **STILL-PRESENT** — Invocation tags fail contrast on dark scheme: prefers-color-scheme dark (data-fa-scheme=dark, cell bg rgb(48,45,54)): .tg-shell 2.19, .tg-mcp 2.29, .tg-inproc 2.09, .tg-manual 2.24 :1 at 11.52px (<4.5). Light scheme passes (6.16/5.91/6.45/6.04). Default now follows OS, so fails only for dark-mode readers.
- **STILL-PRESENT** — Mobile: 5-column table in 358px column, off-screen columns, no scroll cue: At 390x844 page scrollWidth 390, but .table-wrapper scrollWidth 570 vs clientWidth 362; headers at x: invoked 263, satisfies 370, i/o 477 (last two off-screen). Wrapper mask-image none (narrow-viewport.css cue excludes .table-wrapper > table). 'what it does' column 138px; tallest row 536px.
- **STILL-PRESENT** — '▾ Folio' handle overlaps top of content column: .fa-glass-handle position:fixed, top centre: 1280 → rect (594,0,93x28), min-height now 28px; #main-content starts y=140 so no overlap with content, only the empty header. 390 → rect (154,0,82x25) overlaps a.site-title 'C@T Harness' box (0,2,244x49) in the top bar. Improved on desktop, still over the top bar on mobile.
- **STILL-PRESENT** — 'On this page' (4 entries) only in the opened sidebar: details.fa-doc-index (4 links): at 390 summary visible at rest (y=96, hit-test true) — fixed on mobile. At 1280 summary at (0,299,55x58) in the collapsed strip fails hit-test (covered) and is not visible at rest.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — No way to find one tool except page search; stat boxes not links: Narrowed since 2026-09-29: the main table (107 rows) now has a 'Filter this table' input ('beans' → 3 of 107). The stat boxes are still not links, and the only in-page anchors in main are the 3 heading permalinks. — #1592 (D/p_tools.js, filt2.mjs)
- **STILL-PRESENT** — Skills and tool ids are not links: Narrowed since 2026-09-29: 105 of 107 'satisfies' cells now link to skill pages (136 links, all 61 targets return 200). 0 of 107 tool-id cells contain an <a>. — #1592 (D/p_tools.js, qgjh.mjs, linkcheck.mjs)
- **FIXED** — Invocation tags fail contrast on dark scheme: Changed since 2026-09-29. Dark (cell bg rgb(48,45,54)): .tg-shell 7.40, .tg-mcp 6.35, .tg-inproc 6.53, .tg-manual 6.53 :1 at 11.52px (10.08px at 390). Light is unchanged and passes: 6.16/5.91/6.45/6.04. — #1592 / rtuo (D/p_tools.js, contrast.mjs)
- **STILL-PRESENT** — Mobile: 5-column table in 358px column, off-screen columns, no scroll cue: At 390×844 the page scrollWidth is 390, and .table-wrapper has scrollWidth 570 vs clientWidth 362. The headers are at x invoked 263, satisfies 370, i/o 477 (the last two off-screen). The wrapper has mask-image none. The 'what it does' column is 138px, and the tallest row is now 788px (was 536). (D/p_tools.js, D/p_tw.js)
- **STILL-PRESENT** — '▾ Folio' handle overlaps top of content column: At 1280 the handle rect is (594,0,93×28) and #main-content starts at y=140, so there is no overlap with content. At 390 the rect is (154,0,82×25), over a.site-title 'C@T Harness' (0,2,244×49) in the top bar. (D/p_tools.js, D/p_handle.js)
- **STILL-PRESENT** — 'On this page' (4 entries) only in the opened sidebar: details.fa-doc-index (4 links). At 390 the summary is visible at rest (y=96, hit-test true). At 1280 the summary is at (0,299,55×58) in the collapsed strip and fails the hit-test. (D/p_tools.js)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-tools-viz.ts` in cat-harness-tools. Some findings are fixed (`tools-viewer.test.ts`). Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on verified evidence. The
fixes were made and recorded on this bean's cat-harness-store copy (closed
2026-10-09). This copy was checked separately to confirm they reached the
default branches:
- fix commit `dd43f9fc` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-tools-viz.ts:302-303` (stat links).


## Closed 2026-10-09

Fixed in `cat-harness` commit `dd43f9fc3bbe4386cc62acbec48356603a0ac8a5` on branch `claude/qbfm-tools-viz`:
- Stat boxes now render as clickable `<a>` links to `#every-tool`, `#does-every-satisfies-name-a-skill-that-exists`, and `#how-they-are-invoked-and-installed`.
- Tool IDs in the main table render as in-page anchor targets and links (`<a id="${cell(r.id)}"></a>[\`${cell(r.id)}\`](#${cell(r.id)})`).
- `.table-wrapper` has mobile scroll cue styling with horizontal fade mask (`animation-timeline: scroll(self inline)` with fallback) and table column min-width.
- Added tests in `scripts/tests/tools-viewer.test.ts` verifying stat box links, tool id in-page anchors and links, and table-wrapper mobile scroll cue.

Verification evidence:
- `bun test scripts/tests/tools-viewer.test.ts`: 13 pass, 0 fail (308 expect calls)
- `bun run scripts/gen-tools-viz.ts --check`: `✓ tools viewer is current — 142 tool(s)`
- `bun run typecheck`: clean exit 0 (`tsc --noEmit -p tsconfig.json`)




## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-tools-viz.ts` in cat-harness-tools. Some findings are fixed (`tools-viewer.test.ts`). Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on verified evidence. The
fixes were made and recorded on this bean's cat-harness-store copy (closed
2026-10-09). This copy was checked separately to confirm they reached the
default branches:
- fix commit `dd43f9fc` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-tools-viz.ts:302-303` (stat links).
