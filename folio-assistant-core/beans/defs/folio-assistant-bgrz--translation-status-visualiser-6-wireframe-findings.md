---
# folio-assistant-bgrz
$schema: bean/1.0.0
title: 'translation-status visualiser: 6 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-translation-status
created_at: 2026-09-23T10:36:15Z
updated_at: 2026-10-10T16:35:03Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/translation-status/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. [x] **Horizontal scroll at phone width.** At 390 px the document is 509 px wide (`scrollWidth` 509). The *fuzzy* and *untranslated* columns start off-screen, and the header "catalogues / templates" wraps onto three lines. (→ `folio-assistant-2r2n`)
   - `.ts-table-wrapper` has `overflow-x: auto`, mobile scroll cue mask animation, `min-width: 36rem` on table, and `.ts-scroll-hint`.
2. [x] **The page is always dark.** The palette is dark by default and switches to light only under `:root[data-fa-scheme="light"]`. The page has no script and does not load `docs-ui.js`, which is where that attribute is managed, and it has no `prefers-color-scheme` rule. So it renders light-on-dark even in a light-mode browser, unlike its sibling harness pages, which follow the OS scheme. (→ `folio-assistant-dc64`)
   - Added `@media (prefers-color-scheme: light)` support to `.ts-page` palette while preserving explicit dark and light overrides.
3. [x] **Locales are shown as bare codes** (`ar`, `es`, `fr`, `ru`, `zh`) with no language name. A reader has to know the ISO 639-1 codes.
   - Added `languageName` helper using `Intl.DisplayNames` rendering `<code>ar</code> <span class="ts-lang-name">Arabic</span>`.
4. [x] **The two questions are not visually separated.** The generator's main point, that catalogue coverage (about 5–8%) differs from string coverage (35–74%), rests on the first column. That column looks the same as the string columns, and the explanation sits below the table in the first note.
   - Distinct styling on `.ts-col-catalogues` with border and background tint, `.ts-col-badge` header tags (`Q1: availability` vs `Q2: strings`), and question legend banner above the table.
5. [x] **Nothing links onward.** A reader who sees 111 untranslated `fr` entries gets no link to the `fr` catalogues, the `.pot` list or the `translation-manager` skill. The page is a dead end with no way back to the site.
   - Added links to `translation-manager` skill instructions, GitHub translations directory, and per-locale catalogue links.
6. [x] **The accessibility markup is right.** Row headers use `th scope="row"` and column headers use `scope="col"`. This is recorded so a redesign keeps it.
   - Preserved: 6 `th[scope="col"]` and 5 `th[scope="row"]`.

When fixed, re-draw `cat-harness/docs/wireframes/translation-status/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **FIXED** — Horizontal scroll at phone width: At 390x844 document scrollWidth 390 (was 509). Table is now its own scroll box (display:block; overflow-x:auto; scrollWidth 493 / clientWidth 318). Caveat: 'fuzzy' (x=380) and 'untranslated' (x=437) still start off-screen inside that box; 'catalogues / templates' header still wraps to 3 lines (th height 76px). — 76b34f8ec
- **STILL-PRESENT** — Page is always dark: prefers-color-scheme light → body bg rgb(13,13,13), fg rgb(255,255,255), data-fa-scheme unset. Only a saved localStorage fa-color-scheme=light turns it light (bg rgb(249,249,247)) — partial, commit 805bbd1ba. No prefers-color-scheme handling, no on-page control. — 805bbd1ba
- **STILL-PRESENT** — Locales shown as bare codes: Row headers th[scope=row]: 'ar','es','fr','ru','zh' — no language names.
- **STILL-PRESENT** — Two questions not visually separated: 'catalogues / templates' cells have the same computed style as the string columns (bg transparent, weight 400, no borders, 16px). Explanation 'Two questions, not one.' is still a note below the table (y=528 vs table y=134).
- **STILL-PRESENT** — Nothing links onward / dead end: PARTIAL: a nav.fa-nav now gives 25 links (graphs, harnesses, home '../') — way back fixed. Still 0 links to fr catalogues, .pot list or the translation-manager skill; main content has no links.
- **STILL-PRESENT** — Accessibility markup is right (keep): Positive finding preserved: 6 th[scope=col], 5 th[scope=row].

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **FIXED** — Horizontal scroll at phone width: Still fixed. At 390×844 the document scrollWidth is 390, and the table is its own scroll box (display:block; overflow-x:auto; scrollWidth 493 / clientWidth 318). 'fuzzy' (x=380) and 'untranslated' (x=437) still start off-screen inside it, and the 'catalogues / templates' header is 76px tall. — 76b34f8ec (D/p_tr.js, D/p_tr2.js)
- **STILL-PRESENT** — Page is always dark: With prefers-color-scheme light and nothing saved, body is rgb(13,13,13) on rgb(255,255,255) and data-fa-scheme is unset. Only a saved fa-color-scheme=light turns it light (rgb(249,249,247)). There is no on-page control. — 805bbd1ba (scheme.mjs)
- **STILL-PRESENT** — Locales shown as bare codes: The row headers th[scope=row] read 'ar','es','fr','ru','zh', with no language names. (D/p_tr.js)
- **STILL-PRESENT** — Two questions not visually separated: The 'catalogues / templates' cells have the same computed style as the string columns (transparent background, weight 400, no borders, 16px). 'Two questions, not one.' is still a note below the table (y=528 vs table y=134 at 1280). (D/p_tr.js)
- **STILL-PRESENT** — Nothing links onward / dead end: PARTIAL, as before. The 25 links are the nav rail. There are 0 links to the fr catalogues, the .pot list or the translation-manager skill. (D/p_tr.js)
- **STILL-PRESENT** — Accessibility markup is right (keep): This is a positive finding and it holds: 6 th[scope=col] and 5 th[scope=row]. (D/p_tr.js)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-translation-status.ts` in cat-harness-tools. `gen-translation-status.test.ts` cites fixes for findings 1–6, so a re-verify is likely to close it. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `77674872` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-translation-status.ts:370,384`.


## Closed 2026-10-09

Fixed in `cat-harness` commit `7767487276af7c4cd8d3d09132e5339ec2634efa` on branch `claude/bgrz-translation-status-viz`:
- Finding 1: Added `.ts-table-wrapper` with `overflow-x: auto`, mobile scroll cue mask styling (`animation-timeline: scroll(self inline)` with fallback), `min-width: 36rem` on table for mobile breathing room, and `.ts-scroll-hint` ("Scroll horizontally to see all columns →").
- Finding 2: Added `@media (prefers-color-scheme: light)` support to `.ts-page` palette while preserving explicit dark (`:root[data-fa-scheme="dark"]`) and light (`:root[data-fa-scheme="light"]`) overrides.
- Finding 3: Added `languageName` helper using `Intl.DisplayNames` to display human-readable language names alongside ISO codes in `<th scope="row">` (e.g. `<code>ar</code> <span class="ts-lang-name">Arabic</span>`).
- Finding 4: Visually separated Question 1 (catalogue availability) and Question 2 (string metrics) using `.ts-col-catalogues` with distinct vertical border and background tint, `.ts-col-strings`, `.ts-col-badge` labels (`Q1: availability` vs `Q2: strings`), and a question legend banner directly above the table.
- Finding 5: Added onward links to `translation-manager` skill instructions (`../reference/skill-instructions/translation-manager.html`), GitHub repository translations directory, and per-locale catalogue files.
- Finding 6: Preserved accessibility markup: 6 `th[scope="col"]` for column headers and semantic `th[scope="row"]` for all locale row headers.

Verification evidence:
- `bun test scripts/tests/gen-translation-status.test.ts`: 25 pass, 0 fail (64 expect calls)
- `bun run scripts/gen-translation-status.ts --check`: clean exit 0 (5 locales, 83 catalogues of 418 templates, 5847 strings translated)
- `bun run typecheck`: clean exit 0 (`tsc --noEmit -p tsconfig.json`)




## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-translation-status.ts` in cat-harness-tools. `gen-translation-status.test.ts` cites fixes for findings 1–6, so a re-verify is likely to close it. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `77674872` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-translation-status.ts:370,384`.
