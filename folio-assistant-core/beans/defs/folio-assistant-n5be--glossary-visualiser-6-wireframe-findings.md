---
# folio-assistant-n5be
$schema: bean/1.0.0
title: 'glossary visualiser: 6 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-glossary
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-10-02T07:14:42Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/glossary/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **There is no way to find a term** except scrolling or the browser's find. The page has no search, no filter and no A–Z jump, and its 46 rows run to about 8,000 px at desktop width and 16,000 px at phone width. (→ `folio-assistant-0fua`)
2. **The order is not alphabetical by the displayed name.** Rows follow the role id, so **Activity log** (`role/log`) comes after **Librarian**, and **Human translator** (`role/translator`) comes after **Translation coordinator**. A reader scanning by title will miss them.
3. **Markdown shows through.** The descriptions are escaped plain text, so inline code appears with literal backticks, for example "Inherits \`reviewer\`" and "\`adjudication\` permission". (→ `folio-assistant-mylx`) (→ `folio-assistant-qgjh`)
4. **The term column is wide and dominated by the path.** Each term is followed by the full `cat-harness/glossary/glossary-ledger.json#role/…` path, which breaks mid-token (`…#role/adjudi / cator`). At 390 px this leaves about 200 px for the definition, the part the reader came for.
5. **The heading is repetitive.** "Glossary `glossary`", the sub-graph path in the lede and the single sibling row all state the same scope three times before the first term.
6. **The count differs from the declaration.** The `glossary` declaration's comment says "44 terms", but the page shows 46.

When fixed, re-draw `cat-harness/docs/wireframes/glossary/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 6 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — No way to find a term: no search, filter or A-Z jump: .wrap input/select/[role=search] count 0; A-Z anchor links 0; 48 rows; scrollHeight 8909 px at 1280, 18908 px at 390. (The separate /glossary/ SKOS page has a filter; this page does not.)
- **STILL-PRESENT** — Order not alphabetical by displayed name (Activity log after Librarian; Human translator after Translation coordinator): tbody tr td:first-child a text order: ... 'Librarian','Activity log','Narrative reviewer' ... 'Translation coordinator','Human translator','User' - identical to the finding.
- **STILL-PRESENT** — Markdown shows through: literal backticks in descriptions: 9 of the 96 tbody td contain a literal backtick, e.g. 'Inherits `reviewer` ... the `adjudication` permission'. There are 0 <code> elements in description cells (the 48 code elements are the term names).
- **STILL-PRESENT** — Term column wide and dominated by the ledger path, breaks mid-token: Each first cell still carries span.p 'cat-harness/glossary/glossary-ledger.json#role/<id>' with line-break:anywhere. Column widths are 435/653 px at 1280 and 89/214 px at 390; at 390 the path span is 156 px tall (about 4 broken lines).
- **STILL-PRESENT** — Heading repetitive: scope stated three times before first term: h1 'Glossary swimlane-glossary'; the lede ends 'Sub-graph cat-harness/glossary.'; ul.subs has 1 row 'swimlane-glossary cat-harness/glossary 48'. The scope still appears three times (renamed from glossary to swimlane-glossary).
- **STILL-PRESENT** — Count differs from declaration (comment says 44, page shows 46): The page has 48 tbody rows and the subs row says 48. cat-harness.json@35402147f _visualiser_comment still says 'a real rendering: 44 terms'. The gap has widened (44 vs 48).

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — No way to find a term: no search, filter or A-Z jump: The page has 0 input/select/[role=search] and 0 A–Z anchor links over 48 rows. scrollHeight is 8909px at 1280 and 18908px at 390. The #1592 table filter does not reach this docs-auto page. (C_gl.mjs, lists.mjs, filt.mjs)
- **STILL-PRESENT** — Order not alphabetical by displayed name (Activity log after Librarian; Human translator after Translation coordinator): The term order still runs … 'Librarian','Activity log','Narrative reviewer' … 'Translation coordinator','Human translator','User'. 45 of 48 names are out of alphabetical position. (C_gl.mjs)
- **FIXED** — Markdown shows through: literal backticks in descriptions: Changed since 2026-09-29. 0 of 96 tbody cells contain a literal backtick (was 9). The 9 affected descriptions now render 30 <code> elements. 11 of those are links to in-page term anchors (e.g. 'reviewer' → #a-cat-harness-glossary-glossary-ledger-json-role-reviewer, across 6 rows), and all 11 anchors resolve. — #1594 (C_gl.mjs, gl2.mjs)
- **STILL-PRESENT** — Term column wide and dominated by the ledger path, breaks mid-token: Each first cell still carries span.p 'cat-harness/glossary/glossary-ledger.json#role/<id>'. The column widths are 435/653px at 1280 and 89/214px at 390. At 390 the path span is 156px tall. (C_gl.mjs)
- **STILL-PRESENT** — Heading repetitive: scope stated three times before first term: h1 'Glossary swimlane-glossary'. The lede still ends 'Sub-graph cat-harness/glossary.', and the subs row reads 'swimlane-glossary cat-harness/glossary 48'. (C_gl.mjs)
- **STILL-PRESENT** — Count differs from declaration (comment says 44, page shows 46): The page has 48 rows. cat-harness.json@3779d5d27 _visualiser_comment still says 'a real rendering: 44 terms'. (C_gl.mjs; source read to compare the count only)

Claimed by claude/visualiser-wireframes (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH) — issue #1838.

## Summary of Changes

Worked on claude/visualiser-wireframes (PR #1839, issue #1838). Re-measured on main cf3e62487 at 1280×800 and 390×844. Pictures are in cat-harness/docs/wireframes/glossary/rendered-2026-10-02/, and the per-finding record is in that wireframe's intent.md.

1. No longer holds: the standalone table filter (0fua) reaches the page.
2. Fixed. Sorted by the displayed term: 0 descending pairs of 55, against 4.
3. No longer holds (#1594).
4. Fixed. The short ledger label replaces the full path. The first column is 20rem, and rows stack below 800 px (390: scrollWidth 390, definition 296 px).
5. Fixed. The one-row sibling list is dropped and its count moved into the lede.
6. Fixed. The declaration comment no longer quotes a count.

Generator: cat-harness/scripts/gen-docs-auto.ts (the shared renderer, so every docs-auto page now stacks on a phone). Comment: cat-harness/cat-harness.json.
