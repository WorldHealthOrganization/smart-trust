---
# folio-assistant-krmw
$schema: bean/1.0.0
title: 'docs-index visualiser: 6 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-docs-index
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-10-10T16:35:03Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/docs-index/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **Most rows say nothing.** 187 of 217 rows read *no description in the artefact*, so the table is mostly a list of paths.
2. **Non-pages are indexed as "authored documentation pages".** The six `cat-harness/docs/_includes/*.html` layout partials still come first in the table, ahead of every real page. The index now also lists 99 generated UML overview pages, 33 wireframe files (candidates and intents) and two generated visualiser pages. Together these are 140 of the 217 rows.
3. **Names collide.** 17 rows are named `index`, 17 `intent`, 16 `as-is` and 6 `agent-onboarding`. The link text is identical, so the rows can be told apart only by the path under each name. The link list a screen reader announces is ambiguous.
4. **The YAML quotes are kept.** Twelve descriptions are shown wrapped in literal quotation marks, for example `"folio-assistant — 内容无关的智能体技能框架。"`.
5. **The table cannot be searched, filtered or grouped.** Locale copies (`ar`, `es`, `fr`, `ru`, `zh`) sit among the English pages by path order, and the 99 UML pages and 33 wireframe files sit between `translation-support` and `zh/index`. Both `docs` (217 rows) and `smart-trust-docs` (676 rows) are single pages.
6. **The phone layout favours the path.** At 390 px the first column (`width: 26rem`, capped by the viewport) takes about 220 px for the name and path. That leaves about 130 px for the description, so *no description in the artefact* wraps over several lines.

When fixed, re-draw `cat-harness/docs/wireframes/docs-index/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 6 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — 1. Most rows say nothing: 258 of 296 rows read 'no description in the artefact' (was 187/217).
- **STILL-PRESENT** — 2. Non-pages indexed as authored documentation pages: The first 4 rows are still cat-harness/docs/_includes/{footer_custom,harness_details,head_custom,landing}.html (6 _includes rows in all). There are also 124 uml/overview rows and 44 wireframes/ rows.
- **STILL-PRESENT** — 3. Names collide: Duplicate link texts: intent ×21, index ×20, as-is ×19, qa ×15, skills ×8, accessibility ×6.
- **STILL-PRESENT** — 4. YAML quotes kept: 13 descriptions are wrapped in literal quotes, e.g. '"folio-assistant — إطار عمل مهارات وكيل مستقل عن المحتوى."'.
- **STILL-PRESENT** — 5. Table cannot be searched, filtered or grouped: 296 rows in one table with 0 filter inputs and 0 h2/h3 grouping. 40 locale (ar/es/fr/ru/zh) rows are interleaved by path. docH 22,424px at 1280 and 39,202px at 390.
- **STILL-PRESENT** — 6. Phone layout favours the path: 390x844, first body row: name+path cell 164px, description cell 132px, so 'no description in the artefact' still wraps over several lines. There is no page-level horizontal scroll (scrollWidth 390).

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 6 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — 1. Most rows say nothing: 267 of 305 rows read 'no description in the artefact' (was 258/296). (idx.mjs)
- **STILL-PRESENT** — 2. Non-pages indexed as authored documentation pages: The first 4 rows are still cat-harness/docs/_includes/{footer_custom,harness_details,head_custom,landing}.html (6 _includes rows in all). There are 131 uml/overview rows (was 124) and 44 wireframes/ rows. (idx.mjs)
- **STILL-PRESENT** — 3. Names collide: Duplicate link texts: index ×21, intent ×21, as-is ×19, qa ×14, skills ×8, accessibility ×6. (idx.mjs)
- **STILL-PRESENT** — 4. YAML quotes kept: 13 descriptions are still wrapped in literal quotes, e.g. '"folio-assistant — إطار عمل مهارات وكيل مستقل عن المحتوى."'. (idx.mjs)
- **STILL-PRESENT** — 5. Table cannot be searched, filtered or grouped: 305 rows in one table, with 0 filter inputs (the #1592 table filter is not on docs-auto pages) and 0 h2/h3. 40 locale rows are interleaved by path. docH is 23,230px at 1280 and 40,715px at 390. (idx.mjs, filt.mjs)
- **STILL-PRESENT** — 6. Phone layout favours the path: 390×844, first body row: the name+path cell is 164px and the description cell 132px. There is no page-level horizontal scroll (scrollWidth 390). (idx.mjs, idx2.mjs)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `autoDocPage` in cat-harness-tools `scripts/gen-auto-docs.ts`. Nothing there cites a fix yet. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `40d06f6c` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-auto-docs.ts:1030,1173` (the table filter, whose threshold was later raised to 25 rows).


## Closed 2026-10-09

Resolved on branch `claude/krmw-docs-index-viz` in `cat-harness` commit `40d06f6c`.

All 6 wireframe findings addressed:
- Finding 2: Excluded non-pages (`_includes/*.html`, partials, wireframes, generated UML overview pages, generated visualisers, redirect stubs) via `isNonPage()` in `gen-auto-docs.ts`. Authored documentation pages down from 217+ noise to 126 authentic pages.
- Finding 3: Extracted real page titles from front matter, HTML `<title>`, or Markdown `# heading`, and disambiguated colliding names with parent directory / section (e.g. `Architecture (concepts)`).
- Finding 4: Stripped literal surrounding quotes from descriptions in `frontMatterDescription()` and `firstSentence()`.
- Finding 5: Added active, responsive table filter box (`.fa-table-filter`) when table has >= 10 rows (`TABLE_FILTER_MIN = 10`), with live count and text matching across name and description.
- Finding 6: Desktop sets `max-width: 40%` on first column (`td:first-child`). Mobile `@media (max-width: 799.98px)` stacks cells as full-width blocks (`width: 100% !important; max-width: 100%`) with header hidden and row borders separating items.

Verification evidence:
- `cat-harness-tools/scripts/tests/gen-auto-docs.test.ts`: 54 passed, 0 failed.
- Worktree `tsc --noEmit -p tsconfig.json`: clean exit 0.
- `cat-harness/scripts/wireframe-check.mjs`: all 6 viewports pass (web/renders=pass web/no-overflow=pass web/no-placeholder=pass mobile/renders=pass mobile/no-overflow=pass mobile/no-placeholder=pass).
- Re-drawn `docs/wireframes/docs-index/as-is.html`, `intent.md`, `checks/report.json`, screenshots, and updated `docs/wireframes/index.json`.




## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `autoDocPage` in cat-harness-tools `scripts/gen-auto-docs.ts`. Nothing there cites a fix yet. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `40d06f6c` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-auto-docs.ts:1030,1173` (the table filter, whose threshold was later raised to 25 rows).
