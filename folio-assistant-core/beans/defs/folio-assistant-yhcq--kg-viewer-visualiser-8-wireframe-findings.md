---
# folio-assistant-yhcq
$schema: bean/1.0.0
title: 'kg-viewer visualiser: 8 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-kg-viewer
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-10-02T07:14:42Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/kg-viewer/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **The page scrolls sideways at phone width on first load.** Measured: `scrollWidth` 606 against a 390 viewport before any facet is chosen, and the Kind and Subgraph count badges render off-screen. After choosing a kind (Tool), the track fits again. The single grid track is sized by content (a long list row or facet), not clamped to the viewport. (→ `folio-assistant-2r2n`)
2. **On mobile the detail is below the whole list.** The order is Kind (15), Subgraph (up to 31), Nodes (a nested scroll box, `max-height: 72vh`), then Detail. With Tool chosen, tapping the first row (`discussion`) put its detail about 630 px further down, below the node list, in a full-page capture 2,063 px tall. Nothing scrolls to it visually. On a phone a swipe inside the 72vh list scrolls the list, not the page, so the reader has to find the edge of the box to get past it. The detail region is `aria-live`, so a screen reader hears it, but a sighted touch reader does not see it.
3. **"No links to or from this node." sits directly under a link.** On Tool `discussion`, `satisfies` renders `skill/discussion` as a followable link, and the next line says the node has no links. The target is `…/bootstrap/bootstrap.jsonld#skill/discussion`, a node in another document. So it is neither a local edge nor listed as dangling, and the short label hides that it leaves this graph.
4. **Two kinds of link look different, and nothing says why.** An IRI outside the document is a plain `<a href>` in the browser's default blue (`kg-viewer.ts` line 925). An edge inside the document is a green in-page button. The styling difference is the only signal that one of them leaves the graph, or the site, and there is no text or icon saying so. The difference in colour is not a contrast failure. (→ `folio-assistant-rtuo`)
5. **A long list with no alphabetical order.** With All selected, the Nodes list is 2,361 rows in document order (SequenceFlow and ProcessNode together are 1,594 of them). Search is the only practical way in, and the facet counts are the only overview.
6. **Neighbourhood labels are cut to 26 characters**, for example "Produce >= 2 candidates, w" and "Mechanical checks, both vi", and on web the labels crowd the edges of the diagram. The full name is in each neighbour's accessible name and in the back-link list above it, so the cut is visual only.
7. **The language switcher never appears.** `.po` catalogues exist for ar, es, fr, ru and zh, but the group stays `hidden`. The skill says *"offer only what the page can show"*, and all five catalogues have 0 translated `msgstr` entries, so `LOCALES` holds only English and `drawLangs` hides the group. This is correct behaviour, but the translation-boundary note the skill requires never gets a chance to show.
8. **No link back to the docs site.** The page is reached from the docs navbar's ⌘ icon, but it carries none of that chrome and no "back to site" link. Returning depends on the browser's Back button.

Related: `folio-assistant-a98i`

When fixed, re-draw `cat-harness/docs/wireframes/kg-viewer/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 8 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Page scrolls sideways at phone width on first load: At 390x844 before any facet: documentElement.scrollWidth 511; main grid-template-columns '510.516px'; 102 descendants of #facets/#subs extend past the right edge (was 606 px wide).
- **STILL-PRESENT** — On mobile the detail is below the whole list; nothing scrolls to it: 390x844, Tool facet, first row clicked: #detail top is at 1028 px in the viewport (off-screen below 844); page 2256 px tall; focus not moved into #detail; #list max-height 607.68 px (72vh).
- **STILL-PRESENT** — 'No links to or from this node.' sits directly under a link: Tool 'discussion' (tool/discuss): #detail shows 'satisfies skill/discussion' as <a href='https://litlfred.github.io/folio-assistant/bootstrap/bootstrap.jsonld#skill/discussion'>, then the text 'No links to or from this node.'
- **STILL-PRESENT** — Two kinds of link look different and nothing says why (external vs in-graph): The external <a> (skill/discussion) has no icon, ::after content 'none', no title and no aria-label. Its colour is now rgb(74,107,82), the same as the in-graph edge buttons, so there is still no signal that it leaves the graph. There is now also no colour difference. — ce6152624
- **STILL-PRESENT** — Long list with no alphabetical order: With All selected, 2701 nodes match (SequenceFlow 912 + ProcessNode 862); 401 li rendered, in document order (first ten are Skills: grade, fhir-validation, smart-base Toolchain...); 205 descending pairs among 401 rows.
- **STILL-PRESENT** — Neighbourhood labels cut to 26 characters: Skill wireframe-design-review: #detail svg text max length 26: 'Produce >= 2 candidates, w', 'Mechanical checks, both vi'. Tool node: 'Review heat map — where to'.
- **STILL-PRESENT** — Language switcher never appears (translation-boundary note never shown): #langs.hidden true and #boundary.hidden true at both widths; translated msgstr count in ar/es/fr/ru/zh kg-viewer.po @35402147f is 0/0/0/0/0.
- **STILL-PRESENT** — No link back to the docs site: The page's only anchors outside the list are 'Skip to results' (#list), 'JSON-LD' (../cat-harness.jsonld) and 'source commit' (GitHub). There is no site or home link and no nav chrome.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 8 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code. The viewer was generated with `kg-viewer.ts --out <site>/cat-harness/index.html`, as `docs-site.yml` does, and served beside the build.

- **STILL-PRESENT** — Page scrolls sideways at phone width on first load: At 390×844 before any facet: documentElement.scrollWidth 511, main grid-template-columns '510.516px', and 108 descendants of #facets/#subs extend past the right edge (was 102). (C_kg.mjs)
- **STILL-PRESENT** — On mobile the detail is below the whole list; nothing scrolls to it: 390×844, Tool facet, first row ('Folio block QA summary') clicked: #detail top is at 1028px in the viewport, off-screen below 844. The page is 2288px tall, focus is not moved into #detail, and #list max-height is 607.68px. (C_kg.mjs)
- **STILL-PRESENT** — 'No links to or from this node.' sits directly under a link: Tool 'discussion' (tool/discuss): #detail shows 'satisfies skill/discussion' as <a href='https://litlfred.github.io/folio-assistant/bootstrap/bootstrap.jsonld#skill/discussion'>, then the text 'No links to or from this node.' (C_kg2.mjs)
- **STILL-PRESENT** — Two kinds of link look different and nothing says why (external vs in-graph): The external <a> (skill/discussion) has no icon, ::after content 'none', no title and no aria-label. Its colour is rgb(74,107,82). — ce6152624 (C_kg2.mjs)
- **STILL-PRESENT** — Long list with no alphabetical order: With All selected, 2859 nodes match (was 2701). 401 li are rendered in document order (first: grade, fhir-validation, smart-base Toolchain, quality-control). There are 205 descending pairs among the 401 rows. (C_kg.mjs, C_kg2.mjs)
- **STILL-PRESENT** — Neighbourhood labels cut to 26 characters: Skill wireframe-design-review: the #detail svg text max length is 26 ('Produce >= 2 candidates, w', 'Mechanical checks, both vi'). Tool node: 'Review heat map — where to'. (C_kg.mjs)
- **STILL-PRESENT** — Language switcher never appears (translation-boundary note never shown): #langs.hidden and #boundary.hidden are true at both widths. (C_kg.mjs)
- **STILL-PRESENT** — No link back to the docs site: The only anchors outside the list are 'Skip to results' (#list), 'JSON-LD' (../cat-harness.jsonld) and 'source commit' (GitHub, commit 3779d5d27). There is no site or home link. (C_kg.mjs)

Claimed by claude/visualiser-wireframes (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH) — issue #1838.

## Summary of Changes

Worked on claude/visualiser-wireframes (PR #1839, issue #1838). Re-measured on main cf3e62487 at 1280×800 and 390×844. Pictures are in cat-harness/docs/wireframes/kg-viewer/rendered-2026-10-02/, and the per-finding record is in that wireframe's intent.md.

1. No longer holds: scrollWidth 390 at first load.
2. Fixed. Below 860 px, select() scrolls #detail into view and focuses it (top 101 px, against 1028).
3. Fixed. A node linking only into another graph gets its own message instead of 'No links…'.
4. Fixed. Outbound links carry ↗, and cross-graph link values say '(in another graph)'.
5. Fixed. The list is alphabetical by the shown name.
6. Fixed. Neighbour labels wrap to two lines, with an ellipsis only when needed.
7. Still holds, by design: 0 translated msgstr in all five catalogues. This is an owner question on the PR, not a viewer change.
8. Fixed. A '← Docs site' link to ../ at the top.

Generator: cat-harness/scripts/kg-viewer.ts, plus three strings in kg-viewer-strings.ts (.pot re-extracted, .po stubs). Four new e2e tests are in cat-harness/test/kg-viewer.e2e.ts.
