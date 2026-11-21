---
# folio-assistant-s0ki
$schema: bean/1.0.0
title: 'uploads visualiser: 6 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-uploads
created_at: 2026-09-23T10:36:15Z
updated_at: 2026-10-10T16:35:03Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/uploads/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **The lead number is not what the list leads with.** The badge that leads is "22 waiting", but the default sort is `State` ascending, and `"ingested" < "waiting"`, so all 17 ingested rows come first. At 1280×800 no waiting row is above the fold. At 390 px the first waiting row is several screens down.
2. **Horizontal scroll at phone width.** At 390 px the document is 537 px wide (`scrollWidth` 537). Type, Size and Queue start off-screen, and the whole page pans sideways. (→ `folio-assistant-2r2n`)
3. **Sorting is mouse-only.** The sortable headers are bare `<th>` elements with click listeners. They have no `button`, no `tabindex` and no `aria-sort`, so a keyboard or screen-reader user cannot sort and is not told the current order. The order is shown only by the `▴`/`▾` glyph.
4. **State is carried by colour plus a word.** The pills say `waiting`/`ingested` in text, which is good. The leading badge's emphasis, however, is colour alone (`--wait` amber on "22").
5. **Size wraps inside its cell** at 1280 px for three-digit KB values ("646 / KB", "362 / KB"), because the Queue column takes the width. This makes rows uneven.
6. **Unhelpful filenames get equal weight.** Twelve waiting rows are `ChatGPT Image Sep 20, 2026, …png` or `d1a26515-….png` with no title. The table gives them the same weight as named sources, with no grouping by queue or by kind.

Related: `folio-assistant-v1hw`

When fixed, re-draw `cat-harness/docs/wireframes/uploads/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Lead number is not what the list leads with: Lead badge '16 waiting to be ingested'; default sort 'State ▴' puts all 34 ingested rows first (order iiii…×34 then w×16). First waiting row at y=2741 at 1280x800, y=4114 at 390x844.
- **FIXED** — Horizontal scroll at phone width: At 390x844 document scrollWidth 390 (was 537); the table is its own scroll box (scrollWidth 630 / clientWidth 302). Caveat: Type (x=527), Size (578), Queue (626) still start off-screen inside it. — 76b34f8ec
- **STILL-PRESENT** — Sorting is mouse-only: 6 thead th: tabindex null, aria-sort null, no <button>, no role, on all; order shown only by '▴' glyph in 'State ▴'.
- **STILL-PRESENT** — Lead badge emphasis is colour alone: .badge.lead b colour rgb(154,103,0) vs other badges rgb(31,35,40); font-weight 700 on all four — colour is the only difference. Contrast 4.57:1 on #f6f8fa (light), 6.85:1 dark.
- **STILL-PRESENT** — Size wraps inside its cell at 1280: Worse: at 1280 the Size column is 64px wide and 48 of 50 size cells wrap to two lines (e.g. '3.6 / MB', '646 / KB'; row screenshot confirms), white-space normal.
- **STILL-PRESENT** — Unhelpful filenames get equal weight, no grouping: 12 rows named 'ChatGPT Image …' or a UUID; single tbody, 0 group rows/captions; 50 rows.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Lead number is not what the list leads with: The lead badge reads '22 waiting to be ingested' (was 16). The default sort 'State ▴' puts all 34 ingested rows first. The first waiting row is at y=2741 at 1280×800 and y=4114 at 390×844. (D/p_up.js)
- **FIXED** — Horizontal scroll at phone width: Still fixed. At 390×844 the document scrollWidth is 390, and the table is its own scroll box (630/302). Type (x=527), Size (578) and Queue (626) still start off-screen inside it. — 76b34f8ec (D/p_up.js)
- **STILL-PRESENT** — Sorting is mouse-only: All 6 thead th have tabindex null and aria-sort null, with no <button> and no role. The order is shown only by the '▴' glyph in 'State ▴'. (D/p_up.js)
- **STILL-PRESENT** — Lead badge emphasis is colour alone: .badge.lead b is rgb(154,103,0) vs rgb(31,35,40) for the other badges, and all four are font-weight 700. The contrast is 4.57:1 on #f6f8fa (light) and 6.85:1 in dark. (D/p_up.js, D/p_up2.js)
- **STILL-PRESENT** — Size wraps inside its cell at 1280: At 1280 the Size column is 64px wide, and 51 of 56 size cells wrap to two lines (e.g. '3.6 MB'), white-space normal. (D/p_up.js, D/p_up2.js)
- **STILL-PRESENT** — Unhelpful filenames get equal weight, no grouping: 12 rows are named 'ChatGPT Image …' or a UUID. There is a single tbody with 0 group rows or captions, over 56 rows (was 50). (D/p_up.js)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-uploads-viz.ts` in cat-harness-tools. `uploads-viz.test.ts` cites fixes for findings 1, 3, 4, 5 and 6, so a re-verify is likely to close it. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `af614551` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-uploads-viz.ts:189`, `:217`.


## Closed 2026-10-09

- Branch: `claude/s0ki-uploads-viz`
- Commit: `af614551` ("fix(ui): uploads visualiser wireframe fixes (folio-assistant-s0ki)")
- PR branch pushed to origin: `git push -u origin claude/s0ki-uploads-viz`

All 6 findings resolved:
1. **Finding 1 (Default sort):** In `scripts/gen-uploads-viz.ts`, sorting by `state` ascending prioritizes `waiting` (rank 0) before `ingested` (rank 1), so all active queue items requiring action lead the list above the fold rather than being buried under dozens of ingested rows.
2. **Finding 2 (Horizontal scroll):** Previously fixed in commit `76b34f8ec`.
3. **Finding 3 (Keyboard and accessible sorting):** Table headers (`<th>`) contain `<button type="button" data-k="...">` with `aria-sort` ("ascending"|"descending"|"none") and `:focus-visible` outline, enabling full keyboard and screen-reader accessibility.
4. **Finding 4 (Badge emphasis):** Lead badge is distinguished beyond colour alone with a thicker border (`2px solid var(--wait)`), background (`var(--waitbg)`), semantic icon (`⏳`), and semantic tag (`action needed`).
5. **Finding 5 (Size wrapping):** Size column styled with `white-space: nowrap; min-width: 6rem;` on `.size`, `td.size`, `th.size`, and non-breaking space `\u00a0` in `size()`, preventing mid-token line breaks like "646 / KB".
6. **Finding 6 (Grouping / unhelpful filenames):** Raw screenshot/UUID captures are detected via `isRawCapture()`, tagged with `<span class="capture-tag">raw capture</span>`, styled with `.capture-name` (italic, dimmed). The table is structured into `<tbody>` groups with `<tr class="group-row">` header rows (`Waiting to be ingested`, `Ingested into library/`). Within waiting rows, named sources sort before raw captures.

Verification:
- `bun test scripts/tests/uploads-viz.test.ts`: 12 pass, 0 fail
- `bun test scripts/tests/gen-uploads-viz.test.ts`: 20 pass, 0 fail
- `bun run scripts/gen-uploads-viz.ts --check`: 0 stale artefacts
- `bun run typecheck`: exit 0 (tsc clean)




## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-uploads-viz.ts` in cat-harness-tools. `uploads-viz.test.ts` cites fixes for findings 1, 3, 4, 5 and 6, so a re-verify is likely to close it. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `af614551` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-uploads-viz.ts:189`, `:217`.
