---
# folio-assistant-0g7s
$schema: bean/1.0.0
title: 'processes visualiser: 7 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-processes
created_at: 2026-09-23T10:36:15Z
updated_at: 2026-10-07T17:32:00Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/processes/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **"Searchable" in the H1, but the page has no search or filter control.** The only search is the site-wide theme search. Finding one of 68 processes means scrolling or using the browser's find. (→ `folio-assistant-0fua`)
2. **The index is five long tables stacked on one page** (68 + 92 + 103 rows, plus three short ones). "On this page" (7 entries) is only in the opened sidebar. At rest (56 px strip) and on mobile (behind the theme's Menu), there is no visible way to jump between sections.
3. **The index's skill → process column is not linked.** `run by` lists `.bpmn` filenames as code text. The per-process pages exist, but a reader cannot follow "which process runs `adjudication`" to the page for that process. (→ `folio-assistant-qgjh`)
4. **At phone width the BPMN diagram is unreadable at rest.** A 1330 px-wide viewBox scaled to about 358 px is about 0.27×, so the diagram's text of about 12 px renders at about 3 px. The zoom and Full width controls exist, but the diagram offers nothing until they are used.
5. **The purpose is a single paragraph of about 330 words, above the diagram.** On mobile the diagram, which is what the page is for, begins more than a screen down. The lanes and steps cells hold 40 to 190 words each, and on mobile they scroll sideways inside the table wrapper. (→ `folio-assistant-2r2n`)
6. **The "undocumented steps" column mixes "—" with numbers.** "—" means zero, but a reader cannot tell it from "not computed". Now that 66 of 68 rows read "—", the column is almost all dashes.
7. **`nav_exclude: true` on all 69 pages.** The pages are reachable only through the Processes icon (a glyph with an accessible name but no visible label at rest), the Folders list, the C@T Harness divider's "processes" link, or search. The theme's own navigation never lists them.

When fixed, re-draw `cat-harness/docs/wireframes/processes/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 7 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — 'Searchable' in H1 but no search/filter control: H1 still 'Processes — every executable diagram, searchable'. Only input on page is the theme's site search #search-input ('Search folio-assistant', outside main, now shown at top of content). No filter input/select inside main (0). 7 tables, process table 74 rows.
- **STILL-PRESENT** — Index is five long tables; 'On this page' only in opened sidebar: Tables now 4/74/99/105/3/2/14 rows. details.fa-doc-index 'ON THIS PAGE 8' is visible at rest at 390x844 (summary at y=96, full width, elementFromPoint hits it) — FIXED on mobile. At 1280x800 the summary sits in the 55px collapsed strip at (0,299) but elementFromPoint at its centre hits a.nav-list-link, and screensho…
- **STILL-PRESENT** — Skill -> process 'run by' column not linked: Table 'skill | run by': 99 rows, 0 cells contain an <a>; values are <code>*.bpmn</code> text.
- **STILL-PRESENT** — BPMN diagram unreadable at phone width at rest: At 390x844 inline svg is 346px wide for viewBox width 830 → scale 0.42; 12px diagram text renders ≈5px (was ≈3px at 1330 viewBox). Zoom controls (−,+,Reset,Full width,SVG,PNG,Copy) still needed to read it. Improved but still unreadable.
- **STILL-PRESENT** — Purpose ~330 words above diagram; lanes/steps cells long and scroll sideways on mobile: At 390: purpose now 4 paragraphs (86+110+68+44 ≈ 308 words) at y=685–1500; diagram starts y=1639 (≈1.9 screens down). Longest td cells 172/146/137 words. One .table-wrapper scrollWidth 456 > clientWidth 362.
- **STILL-PRESENT** — 'undocumented steps' column mixes '—' with numbers: Column 'undocumented steps': 72 cells '—', 2 cells '1' (74 rows).
- **STILL-PRESENT** — nav_exclude on all process pages; reachable only via unlabeled icon etc.: Source: 75 of 75 cat-harness/docs/processes/*.md carry nav_exclude: true. Theme .nav-list contains 0 links to processes/. Navbar a.fa-nav-icon[href$='/processes/'] has innerText '' (aria-label/title 'Processes' only) at 1280.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 2 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **FIXED** — 'Searchable' in H1 but no search/filter control: Changed since 2026-09-29. The H1 still reads 'Processes — every executable diagram, searchable', and the page now has 3 in-main `input[type=search]` controls labelled 'Filter this table' (#fa-table-filter-1..3) over the process, skill→run-by and lane tables. They work: 'review' filters 75→11, 103→34, 106→15. — #1592 (D/p_idx.js, filt2.mjs)
- **STILL-PRESENT** — Index is five long tables; 'On this page' only in opened sidebar: Tables are now 4/75/103/106/3/2/14 rows. At 390 the details.fa-doc-index summary ('ON THIS PAGE 8') is visible at rest (y=96, full width), and the hit-test lands in the summary. At 1280 the summary sits in the 55px collapsed strip at (0,299,55×58), and elementFromPoint at its centre hits a.nav-list-link, not the summary. (D/p_idx2.js, D/p_idx3.js)
- **FIXED** — Skill -> process 'run by' column not linked: Changed since 2026-09-29. Table 'skill | run by': 103 rows, 103 of 103 run-by cells contain an <a> (237 links), and 98 of 103 skill cells link. All 173 distinct local targets return 200. The 5 unlinked skills are bootstrap's own, which publish no page. — #1592 (D/p_idx.js, qgjh.mjs, linkcheck.mjs)
- **STILL-PRESENT** — BPMN diagram unreadable at phone width at rest: `processes/adjudication.html` at 390×844: the inline svg is 346px wide for viewBox width 830, a scale of 0.42, so 12px diagram text renders at about 5px. The zoom controls (−, +, Reset, Full width, SVG, PNG, Copy) are unchanged. (D/p_adj.js)
- **STILL-PRESENT** — Purpose ~330 words above diagram; lanes/steps cells long and scroll sideways on mobile: At 390 the purpose is still 4 paragraphs (86+110+68+44 ≈ 308 words) at y=685–1500, and the diagram starts at y=1639. Longest td cells are 172/146/137 words. One .table-wrapper has scrollWidth 456 > clientWidth 362. (D/p_adj.js)
- **STILL-PRESENT** — 'undocumented steps' column mixes '—' with numbers: Column 'undocumented steps': 73 cells '—' and 2 cells '1' (75 rows). (D/p_idx.js)
- **STILL-PRESENT** — nav_exclude on all process pages; reachable only via unlabeled icon etc.: Source @3779d5d27: 76 of 76 cat-harness/docs/processes/*.md carry nav_exclude: true. The theme .nav-list contains 0 links to processes/. The navbar a.fa-nav-icon[href$='/processes/'] has innerText '' (aria-label/title 'Processes' only). (D/p_idx.js, D/p_idx2.js)

## Completed on landed evidence
Landed on main in PR #1592 (References become links; replica band; dark-theme tag contrast (qgjh, g9r2, rtuo)).
