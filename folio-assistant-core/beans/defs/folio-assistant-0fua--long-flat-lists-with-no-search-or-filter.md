---
# folio-assistant-0fua
$schema: bean/1.0.0
title: Long flat lists with no search or filter
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
    - cross-cutting
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-09-30T16:48:12Z
parent: folio-assistant-4ccr
---

Pages of 46 to 240+ rows are one flat list with no search, filter or grouping, so finding an entry means scrolling tens of thousands of pixels on a phone. Add a filter and grouping in the shared list component.

Observed on: `glossary`, `processes`, `skills-index`, `tools` (see each `cat-harness/docs/wireframes/<kind>/intent.md`). Per-page detail is in each visualiser's task under the epic.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 4 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Long flat list, no search/filter/grouping — glossary: One table, 48 rows (was 46), 0 search/filter inputs, 0 A–Z jump links, 0 h2. docH 8,909px at 1280 and 18,908px at 390. (lists.mjs)
- **STILL-PRESENT** — Long flat list, no search/filter/grouping — processes: 7 tables (4/74/99/105/3/2/14 rows = 301). The only input is the theme site search, with no in-page filter. docH 15,255px at 1280 and 16,299px at 390. (lists.mjs)
- **STILL-PRESENT** — Long flat list, no search/filter/grouping — skills-index: One table, 270 rows, 0 filter inputs, 0 folder headings. docH 22,417px at 1280 and 67,046px at 390. (lists.mjs)
- **STILL-PRESENT** — Long flat list, no search/filter/grouping — tools: The main table has 104 rows (tool|what it does|invoked|satisfies|i/o). The only input is site search. docH 11,690px at 1280 and 22,497px at 390. (lists.mjs)

_2026-09-30T12:08:24Z_ — Claimed by claude/charming-curie-n04agq — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Landed
Merged in #1592 (e8bfa25b5) on 2026-09-30, CI green on head 0b795ca.

Scope: the FILTER half, which the owner chose as one site-wide control (2026-09-30). GROUPING (folder headings, A–Z jumps) is not done here: it is per page, and the bean body routes per-page detail to each visualiser's task under 4ccr.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 2 still present, 2 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Long flat list, no search/filter/grouping — glossary: `/cat-harness/docs-auto/glossary/swimlane-glossary/`: one table, 48 rows, 0 search/filter inputs (the site-wide table filter from #1592 is not on docs-auto pages), 0 A–Z jump links, 0 h2. docH 8,909px at 1280 and 18,908px at 390. (lists.mjs, filt.mjs)
- **FIXED** — Long flat list, no search/filter/grouping — processes: Changed since 2026-09-29. Each of the three long tables now has its own labelled `Filter this table` search input (`.fa-table-filter`, `aria-describedby` to an `aria-live` count). Typing 'review' leaves 11 of 75 process rows, 34 of 103 skill rows and 15 of 106 lane rows, at both widths. Tables are 4/75/103/106/3/2/14 rows; docH 15,659px at 1280 and 16,801px at 390. Grouping and A–Z jumps are still absent, and the bean's Landed note scopes them out. — #1592 (filt.mjs, filt2.mjs)
- **STILL-PRESENT** — Long flat list, no search/filter/grouping — skills-index: `/cat-harness/docs-auto/index/skills/skills/`: one table, 273 rows (was 270), 0 filter inputs, 0 folder headings. docH 22,784px at 1280 and 67,864px at 390. The #1592 filter does not reach docs-auto pages. (lists.mjs, idx.mjs)
- **FIXED** — Long flat list, no search/filter/grouping — tools: Changed since 2026-09-29. The main table (107 rows, was 104) has a `Filter this table` input. 'beans' leaves 3 of 107 rows at both widths. docH 12,665px at 1280 and 24,722px at 390. — #1592 (filt2.mjs)

## Reopened 2026-09-30

Closed too early on #1592's landing. The 2026-09-30 re-run (section above) measured the filter on processes and tools, and NOT on the glossary (48 rows) or the skills index (273 rows): those are docs-auto pages, standalone HTML that does not load docs-ui.js. Done when the docs-auto pages carry the same filter.

## Landed
Filter half, both routes: site pages via docs-ui.js (#1592), docs-auto pages inline (#1643, merged d848b1dc). The glossary (48 rows) and skills index (273) now filter, with an e2e test driving the shipped glossary page. Grouping stays with the per-visualiser beans.
