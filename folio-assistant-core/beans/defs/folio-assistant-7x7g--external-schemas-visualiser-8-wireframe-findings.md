---
# folio-assistant-7x7g
$schema: bean/1.0.0
title: 'external-schemas visualiser: 8 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-external-schemas
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-10-10T16:35:03Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/external-schemas/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **44 of the 53 operative terms say nothing.** Every DCMI term (22) and every BPMN term (22) reads "derived from the corpus; what this repository does with it is not yet described". The page's third question — "which of its terms this repository branches on" — is answered by 44 rows of the same sentence; only SKOS's 9 terms carry a meaning. The stat box counts them as "operative terms in the graph" without saying so.
2. **The "0 dependents that no longer resolve" box covers 8 of 14.** Six dependents are "not a path" and were not checked, including all three for BPMN and both for DD. The stat grid shows 0 with no hint that the two specifications this repository `conforms` to most directly have no checkable dependent at all; that is only in the prose of region 7.
3. **The namespace check reports DCMI and SKOS as "declared and not in use" by construction.** The in-use set is "read from the BPMN and DMN files themselves", so a namespace used only in `.dc.json` records or JSON-LD exports can never be in use. Three of the page's five declared-namespace findings are this artefact, while the one real gap (`…/folio-assistant/bpmn`, used and undeclared) is a list item mid-page, not in the stat grid.
4. **"Resolves" dependents cannot be opened.** The generator defines *resolves* as "a path in this checkout, openable", but each is rendered as `code` text in a table cell. The reader copies the path to follow it. (→ `folio-assistant-qgjh`)
5. **Section anchors sit below their headings.** The spec table links to `#dcmi-terms` etc., which are `<a id>` elements placed *after* each `### title`. A jump lands with the heading scrolled just above the viewport (and under the fixed "▾ Folio" handle on top of that). (→ `folio-assistant-015u`)
6. **State tags fail contrast on the default dark scheme.** The page's inline `<style>` fixes `.xs-ok #0d6e5e`, `.xs-na #5b5f66`, `.xs-missing #a8200f` on just-the-docs' dark body `#27262b`: 2.44, 2.34 and 2.06 to 1 at .72 rem. The words carry the state, so colour is not the only channel, but the words are hard to read. (→ `folio-assistant-rtuo`)
7. **Mobile: the spec table is four columns in a 358 px column.** "edition" and "how it is used" start off-screen, and nothing says the table scrolls. The 22-row term tables are two columns and fit, but each row repeats the same sentence at 390 px, making the DCMI and BPMN sections several screens of it.
8. **The notes are single long paragraphs in capitals for emphasis** ("THE TRANSCRIPTION CAME FIRST AND THAT WAS THE DEFECT", "NO XSD IS HELD"). The DCMI note is about 900 characters in one block.

When fixed, re-draw `cat-harness/docs/wireframes/external-schemas/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 6 still present, 1 fixed, 1 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — 44 of the 53 operative terms say nothing: Registry grew to 17 specs; 84 of 110 term-table rows read 'not yet described' (tr in tables with th 'term'). Stat box still reads '98 operative terms in the graph' with no qualifier.
- **FIXED** — The '0 dependents that no longer resolve' box covers 8 of 14: Stat grid now: 17 specifications / 98 operative terms / 192 declared uses / 0 declarations naming no record — no 'no longer resolve' box and no 'not a path' text on page. Dependents are now declarations read from the using files ('Every declaration names a record on this page'). — 1b2d10c7e
- **STILL-PRESENT** — The namespace check reports DCMI and SKOS as 'declared and not in use' by construction: Section still says in-use set is 'Read from the BPMN and DMN files themselves — 6 namespace IRI(s)'; '17 declared and not in use' list includes purl.org/dc/elements/1.1/, purl.org/dc/terms/, skos/core#. The real gap (folio-assistant/bpmn undeclared) is gone: 'Every namespace the corpus declares is covered by a recor…
- **STILL-PRESENT** — 'Resolves' dependents cannot be opened: 'What depends on it' tables: 49 td>code path cells, 0 inside an <a>.
- **STILL-PRESENT** — Section anchors sit below their headings: Narrowed: #dcmi-terms is now the H3 itself (id on heading, no trailing <a id>); clicking the spec-table link lands heading top at 0. But no scroll-margin: at 390 the fixed .fa-glass-handle (x154-236, y0-25) overlaps the heading text (x14-390, y0-17), covering 'Terms'. At 1280 no overlap (text x64-285, handle x594-686). — 95d43a483
- **CANNOT-TELL** — State tags fail contrast on the default dark scheme: No .xs-ok/.xs-na/.xs-missing element is rendered on today's page (0 matches), so nothing to measure; the inline <style> still sets #0d6e5e/#5b5f66/#a8200f and body is rgb(39,38,43) in dark, so any tag the generator emits would fail as before.
- **STILL-PRESENT** — Mobile: the spec table is four columns in a 358 px column: At 390: spec table scrollWidth 430 in .table-wrapper 362px (overflow-x auto), no scroll hint text/role/tabindex/shadow. 22-row DCMI and BPMN term tables still repeat 'not yet described' per row.
- **STILL-PRESENT** — The notes are single long paragraphs in capitals for emphasis: Paragraphs containing 'THE TRANSCRIPTION CAME FIRST AND THAT WAS THE DEFECT' (779 ch) and 'NO XSD IS HELD' (792 ch), each one <p>.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 2 fixed, 1 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — 44 of the 53 operative terms say nothing: 86 of 112 term-table rows read 'not yet described' (was 84/110). The stat box reads '100 operative terms in the graph' with no qualifier. (rv-xs.mjs, rv-xs2.mjs)
- **FIXED** — The '0 dependents that no longer resolve' box covers 8 of 14: Still fixed. The stat grid is 17 specifications / 100 operative terms / 191 declared uses / 0 declarations naming no record. There is no 'no longer resolve' box. — 1b2d10c7e (rv-xs.mjs)
- **STILL-PRESENT** — The namespace check reports DCMI and SKOS as 'declared and not in use' by construction: The section still says 'Read from the BPMN and DMN files themselves — 6 namespace IRI(s) are in use'. The '17 declared and not in use' list still includes purl.org/dc/elements/1.1/ and skos/core#. (xs5.mjs)
- **FIXED** — 'Resolves' dependents cannot be opened: Changed since 2026-09-29. The 17 'user | declared by' tables (41 rows) now link the user in 29 of 41 cells (32 of 82 code cells are inside an <a>, to the file on GitHub; was 0 of 49). The 12 unlinked cells are aggregates with no single target, e.g. 'cat-harness/processes/*.bpmn (70)' and 'folio-dublin-core/v1 nodes'. — #1592 (xs5.mjs, qgjh.mjs)
- **STILL-PRESENT** — Section anchors sit below their headings: As on 2026-09-29: #dcmi-terms is the H3 itself, and the jump lands the heading at top 0. There is no scroll-margin, so at 390 the fixed .fa-glass-handle (x154–236, y0–25) overlaps the heading text (x14–390, y0–17). At 1280 there is no overlap (text x64–285, handle x594–686). (rv-xs3.mjs, rv-xs4.mjs)
- **CANNOT-TELL** — State tags fail contrast on the default dark scheme: 0 .xs-ok/.xs-na/.xs-missing elements are rendered, so there is nothing to measure. The inline <style> still defines .xs-ok #0d6e5e, .xs-na #5b5f66, .xs-missing #a8200f. (rv-xs2.mjs, contrast.mjs)
- **STILL-PRESENT** — Mobile: the spec table is four columns in a 358 px column: At 390 the spec table has scrollWidth 430 in a .table-wrapper of 362px (overflow-x auto). There is no scroll hint (no hint text, role, tabindex or shadow). The 22-row term tables still repeat 'not yet described' on every row. (rv-xs3.mjs)
- **STILL-PRESENT** — The notes are single long paragraphs in capitals for emphasis: The paragraphs containing 'THE TRANSCRIPTION CAME FIRST AND THAT WAS THE DEFECT' (779 ch) and 'NO XSD IS HELD' (792 ch) are each still one <p>. (xs5.mjs)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-external-schemas-viz.ts` in cat-harness-tools. Tests there now cite fixes for findings 1, 3, 5, 6, 7 and 8 (`external-schemas-viz.test.ts`), so a re-verify is likely to close it. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `7ebab233` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-external-schemas-viz.ts:127` (scroll-margin), `:137` (scroll cue), `:393` (operative descriptions).


## Closed 2026-10-09

Fixed on branch `claude/7x7g-external-schemas-viz` (commit `7ebab233`):

1. **Operative terms descriptions (Finding 1):** Authored concrete operative descriptions for all 22 DCMI terms and 21 BPMN terms in `external-schemas/dcmi-terms.json` and `external-schemas/omg-bpmn-2.0.json`. Qualified the stat grid to show described terms vs pending (`N described, M pending`), and display `*(pending description)*` for any undescribed term instead of repeating identical 80-character sentences.
2. **0 dependents that no longer resolve (Finding 2):** Already verified fixed on 2026-09-29 (`1b2d10c7e`); dependents read from using files.
3. **Namespace check / DCMI & SKOS (Finding 3):** Broadened namespace usage detection in `scripts/gen-external-schemas-viz.ts` to include `jsonLdNamespacesInUse` and source mentions via `namespaceMentions(unreg)`. DCMI and SKOS are recognized as in-use and no longer falsely flagged as unused.
4. **"Resolves" dependents linkable (Finding 4):** Already verified fixed on 2026-09-30 (PR #1592); code path cells link to GitHub source.
5. **Section anchor scroll margins (Finding 5):** Added `h2, h3 { scroll-margin-top: 2rem; }` to styles in `scripts/gen-external-schemas-viz.ts`, ensuring target headings clear fixed headers and handles on anchor jumps at both desktop and mobile viewports.
6. **State tag dark contrast (Finding 6):** Added dark mode color overrides `.xs-ok { color: #34d399; } .xs-na { color: #a1a1aa; } .xs-missing { color: #f87171; }` achieving 7.8:1, 5.8:1, and 5.4:1 contrast ratios over dark background `#27262b` (all exceeding the 4.5:1 WCAG AA threshold).
7. **Mobile spec table scroll cue (Finding 7):** Added `.table-wrapper` mask-image fade gradient and `.xs-scroll-cue` mobile scroll indicator to hint horizontal scrollability on narrow viewports.
8. **Long all-caps notes paragraphs (Finding 8):** Refactored all-caps emphasis blocks in `external-schemas/dcmi-terms.json` and `external-schemas/omg-bpmn-2.0.json` to clean sentence-case multi-paragraph markdown; updated `gen-external-schemas-viz.ts` to split and render multiple note paragraphs.

### Verification
- `bun test scripts/tests/external-schemas-viz.test.ts`: 7 pass, 0 fail (covering findings 1, 3, 5, 6, 7, 8, and anchor integrity).
- `bun run scripts/gen-external-schemas-viz.ts --check`: clean pass (24 specifications current).
- `bun run typecheck`: clean pass (0 errors).



## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-external-schemas-viz.ts` in cat-harness-tools. Tests there now cite fixes for findings 1, 3, 5, 6, 7 and 8 (`external-schemas-viz.test.ts`), so a re-verify is likely to close it. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `7ebab233` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-external-schemas-viz.ts:127` (scroll-margin), `:137` (scroll cue), `:393` (operative descriptions).
