---
# folio-assistant-xb4p
$schema: bean/1.0.0
title: 'skills-index visualiser: 7 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-skills-index
created_at: 2026-09-23T10:36:15Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/skills-index/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **Horizontal scroll at phone width.** At 390 px the `cat-harness` page is still 421 px wide (`scrollWidth` 421, table 402 px). The description column's text runs past the viewport from the very first rows ("no description in the artefact" is cut to "…artefac"), so the right edge of every description is cut until the reader pans. The three one- and two-row siblings do not overflow. (→ `folio-assistant-2r2n`)
2. **One very long flat list.** 240 rows run to 20,126 px at 1280 and 40,578 px at 390. The page has no folder headings (the folder is visible only inside each path), no search and no filter. Finding `wireframe-design-review` among 137 folio-core skills means scrolling or using the browser's find. (→ `folio-assistant-0fua`)
3. **50 of 240 skills say *no description in the artefact***, among them `latex-authoring`, `fhir-validation`, all nine content-lifecycle skills, all four new folio-document-adapter skills and `dmn-authoring`.
4. **Long descriptions are cut at 220 characters, with no way to read the rest here.** 31 descriptions end in "…", for example `wireframe-design-review` ("…mechanical checks at both vie…"). Only the GitHub source has the full text.
5. **Markdown shows through.** 22 descriptions have literal backticks, for example "Pointer to the bean-based session work-plan system (the \`beans\` CLI flat-file issue tracker, data under \`beans/\`)". (→ `folio-assistant-mylx`)
6. **The phone layout favours the path.** At 390 px the name and path column takes 147 px on `cat-harness` and the path breaks at any character (`cat-harness/skil / ls/authoring-mat / h/latex-authorin / g.md`). On the one-row siblings it is worse: the path column takes 260 px and the description column is 92 px, so "How a cold agent finds and loads the skill that governs its task." wraps to one or two words a line.
7. **The small siblings get the same heavy page shell.** `kg-navigation` and `who-iris-skills` have one row each, but they repeat the full lede, note and four-row sibling list above it. At 390 px their only row starts at y ≈ 655.

When fixed, re-draw `cat-harness/docs/wireframes/skills-index/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 7 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — 1. Horizontal scroll at phone width; descriptions cut: 390x844: the document itself no longer scrolls sideways (scrollWidth 390, was 421). But the table is now overflow-x:auto with a right-edge fade mask (scrollWidth 344 vs clientWidth 296), and the description cell is at left 164, width 255, right edge 419 > 390. 39 of the first 39 rows are cut ('no description in the …
- **STILL-PRESENT** — 2. One very long flat list: 270 rows (was 240), 0 folder headings, 0 filter/search inputs. docH 22,417px at 1280 and 67,046px at 390 (was 40,578).
- **STILL-PRESENT** — 3. Skills with no description: 49 of 270 rows read 'no description in the artefact' (was 50/240). latex-authoring is still the first such row.
- **STILL-PRESENT** — 4. Descriptions cut at 220 chars with no way to read the rest: 34 descriptions end in '…'. wireframe-design-review still ends '…mechanical checks at both vie…'.
- **STILL-PRESENT** — 5. Markdown shows through (literal backticks): 24 descriptions contain literal backticks, e.g. 'Declare a harness this one knows about and does not hold (`associatedHarnesses`)…'.
- **STILL-PRESENT** — 6. Phone layout favours the path: On the main skills page at 390 the balance flipped: name+path cell 89px, description 255px. The path breaks anywhere (overflow-wrap:anywhere, 'latex-/authori/ng'). On the small siblings it is still path-heavy: who-iris-skills 180px vs 115px description, large-datasets-skills 184px vs 112px.
- **STILL-PRESENT** — 7. Small siblings get the same heavy page shell: 1 row, still preceded by the lede, the note and a now 5-row sibling list. At 390 the only row starts at y≈811 (was ≈655). Same for large-datasets-skills (3 rows, first at y≈811).

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 7 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — 1. Horizontal scroll at phone width; descriptions cut: 390×844: the document does not scroll sideways (scrollWidth 390). The table is overflow-x:auto with a right-edge fade mask (scrollWidth 344 vs clientWidth 296). The description cell is at left 164, width 255, right edge 419 > 390, and 39 of the first 39 rows are cut. (idx.mjs, idx2.mjs, idx3.mjs)
- **STILL-PRESENT** — 2. One very long flat list: 273 rows (was 270), 0 folder headings, 0 filter/search inputs. The #1592 table filter is not on docs-auto pages. docH is 22,784px at 1280 and 67,864px at 390. (idx.mjs, filt.mjs)
- **STILL-PRESENT** — 3. Skills with no description: 48 of 273 rows read 'no description in the artefact' (was 49/270). latex-authoring is still the first such row. (idx.mjs, bt.mjs)
- **STILL-PRESENT** — 4. Descriptions cut at 220 chars with no way to read the rest: 36 descriptions end in '…' (was 34). wireframe-design-review still ends '…mechanical checks at both vie…'. (idx.mjs)
- **STILL-PRESENT** — 5. Markdown shows through (literal backticks): Narrowed since 2026-09-29: 1 of 273 descriptions shows a literal backtick (was 24), and 26 descriptions now render <code>. The one left is a 220-char cut that splits an inline-code span: 'Structural-QA integration watcher … edited uses[] / kind / label'. (idx.mjs, bt.mjs)
- **STILL-PRESENT** — 6. Phone layout favours the path: On the main skills page at 390, the name+path cell is 89px and the description 255px, and the path breaks anywhere (overflow-wrap:anywhere; 3 lines). The small siblings are still path-heavy: who-iris-skills 180px vs 115px, large-datasets-skills 184px vs 112px. (idx.mjs, idx2.mjs)
- **STILL-PRESENT** — 7. Small siblings get the same heavy page shell: who-iris-skills (1 row) and large-datasets-skills (3 rows) are still preceded by the lede, the note and the sibling list. At 390 the first row starts at y≈931 (was ≈811). (idx.mjs, idx2.mjs)

## Completed on landed evidence
Landed on main in PR #1592 (References become links; replica band; dark-theme tag contrast).
