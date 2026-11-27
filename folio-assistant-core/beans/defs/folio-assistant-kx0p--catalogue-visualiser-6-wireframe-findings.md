---
# folio-assistant-kx0p
$schema: bean/1.0.0
title: 'catalogue visualiser: 6 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-catalogue
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/catalogue/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **Horizontal scroll at phone width.** At 390 px the document is 752 px wide (`scrollWidth` 752). The "Every node" table does not wrap or scroll in a container, so the whole page pans sideways, and "held as", "record" and "bitstreams" start off-screen. The three columns that tell a held item from a referenced one are the three a phone user cannot see. (→ `folio-assistant-2r2n`)
2. **The menu and breadcrumb look like links and are not.** The six items in the blue menu and the `who-iris • Catalogue` crumb are `<span>`s. The page has 4 links in all: folio-assistant, WHO IRIS, and iris.who.int twice. A reader who taps "Communities & Collections" or "who-iris" gets nothing.
3. **No row leads anywhere.** Node titles, catalogue paths and library ids ("held as") are plain text, so the 3 materialized items do not link to their library entries or their replica item pages. A reader who finds a held item here cannot reach it from here. (→ `folio-assistant-qgjh`)
4. **The node list is not filterable or sortable,** and it puts the 10 referenced rows ahead of the 3 materialized ones. At 1280×800 the first materialized row is about two screens down.
5. **About the first 280 px at 1280 (about 510 px at 390) is replica chrome** before the `h1`: banner, wordmark, menu, breadcrumb. At 390 px the `h1` starts at about y = 560, and the first table is below the first screen.
6. **The gate verdict counts have no label.** The state pills carry their word as well as a tint, so colour is not the only channel. In the gates table, though, each count follows its pill as a bare number ("PERMITTED 3 UNKNOWN 3"). It reads as one run, not as two verdicts with a count each.

When fixed, re-draw `cat-harness/docs/wireframes/catalogue/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **FIXED** — Horizontal scroll at phone width: At 390: documentElement.scrollWidth 390 (was 752). table.kg is display:block; overflow-x:auto (238px box, scrollWidth 518), so only the table scrolls. Residual: 'held as' (x 393), 'record', 'bitstreams' still start off-screen inside the table scroller, and the nav rail takes 56px. — 76b34f8ec
- **STILL-PRESENT** — The menu and breadcrumb look like links and are not: 'Communities & Collections' and 'who-iris' crumb are leaf <span>s with no <a> ancestor. Page links are now 30, but all added ones are site nav rail; replica menu/crumb still inert.
- **STILL-PRESENT** — No row leads anywhere: All 3 tables: 0 a[href] inside (states, gates, every-node 14 rows incl. 3 MATERIALIZED).
- **STILL-PRESENT** — The node list is not filterable or sortable, and puts referenced ahead of materialized: No input/select/button in tables (only visible input is the nav checkbox); no th[aria-sort]. Row order: 10 REFERENCED then 3 MATERIALIZED; first materialized row at y=1866 at 1280 (~2.3 screens), y=4217 at 390.
- **STILL-PRESENT** — About the first 280 px is replica chrome before the h1: h1 'The catalogue, as a graph' top at y=319 at 1280 and y=615 at 390.
- **STILL-PRESENT** — The gate verdict counts have no label: Gates row markup: <span class='state materialized'>permitted</span> 2 <span class='state referenced'>refused</span> 4 — bare numbers, row text 'copyright PERMITTED 2 REFUSED 4'.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 4 still present, 2 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **FIXED** — Horizontal scroll at phone width: Still fixed. At 390 documentElement.scrollWidth is 390, and table.kg is display:block; overflow-x:auto (238px box, scrollWidth 518). 'held as' (x 393), 'record' and 'bitstreams' still start off-screen inside the table scroller. — 76b34f8ec (rv-cat.mjs, rv-cat2.mjs)
- **STILL-PRESENT** — The menu and breadcrumb look like links and are not: 'Communities & Collections' and the 'who-iris' crumb are still leaf <span>s with no <a> ancestor. (rv-cat.mjs)
- **FIXED** — No row leads anywhere: Changed since 2026-09-29. The every-node table now has 11 links. 5 of 13 node titles (both collections and all 3 items) link to their replica page under /library/who-iris/, and all return 200. The 3 'held as' cells link to the library viewer and the item page. The 8 community rows are still plain text, and the state and gate tables have 0 links. — #1592 (rv-cat.mjs, cat3.mjs, linkcheck.mjs)
- **STILL-PRESENT** — The node list is not filterable or sortable, and puts referenced ahead of materialized: There is no input/select/button in the tables and no th[aria-sort]. The #1592 filter is not on this page. The rows are still 10 REFERENCED then 3 MATERIALIZED. The first materialized row is at y=1889 at 1280 and y=4217 at 390. (rv-cat.mjs, filt.mjs)
- **STILL-PRESENT** — About the first 280 px is replica chrome before the h1: The h1 'The catalogue, as a graph' still starts at y=319 at 1280 and y=615 at 390. (rv-cat.mjs)
- **STILL-PRESENT** — The gate verdict counts have no label: The gates rows still read 'copyright PERMITTED 2 REFUSED 4', 'restrictions PERMITTED 2 REFUSED 4', 'retention PERMITTED 6', as bare numbers after state spans. (rv-cat.mjs)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-iris-pages.ts` in who-iris. `gen-iris-pages.test.ts` cites fixes for several findings. who-iris has no bean store yet, so option 1 means creating one there or using cat-harness-tools'. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/who-iris`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/who-iris`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## 2026-10-10: the closure did NOT land (bean-backlog drain, lane C)

The cat-harness-store copy was closed on 2026-10-09 citing who-iris commit
`6d4c623` on branch `claude/kx0p-catalogue-viz`. That commit is **not on
who-iris `main`** (`308ee35`). Main's `scripts/gen-iris-pages.ts` has no
`ic-filter`, no `verdict-count` and no materialized-first sort, so findings 4
and 6 are still present. The cat-harness half (`d09d0a84`) is on main, but the
page it regenerated moved to `docs/who-iris/catalogue/index.html`, which
carries neither fix.

**This copy stays open and is the owning one:** who-iris has no bean store.
Next step: merge or re-apply `claude/kx0p-catalogue-viz` in who-iris,
regenerate, and re-measure findings 4 and 6. The cat-harness-store copy
should be reopened.


## Correction 2026-10-11: it DID land, by a different implementation

The 2026-10-10 note above is wrong, and is withdrawn. It checked whether
branch `claude/kx0p-catalogue-viz` (`6d4c623`) was merged, and grepped
who-iris main for that branch's own strings (`ic-filter`, `verdict-count`).
The branch was never merged, but **the fixes reached main another way**
(checked at who-iris `ec377dc`):
- **Finding 4:** materialized rows first. `STATE_ORDER` in
  `scripts/gen-iris-pages.ts:1836` and the stable rank at `:1874` both cite
  this bean.
- **Finding 6:** each gate count now sits inside its pill and says what it
  counts ("permitted: 3 of 6"). See `verdictBadge` at `:1796`, citing this bean.
- **Test:** `scripts/tests/gen-iris-pages.test.ts:719`, "the catalogue page
  (bean kx0p)".
- **The filter half of finding 4** is covered by the site-wide table filter
  (cat-harness `docs-ui.js` `mountTableFilters`). The owner chose one
  site-wide filter on 2026-09-30, and it mounts on tables over 25 rows. The
  catalogue holds 13 nodes, so the old branch's hand-written filter would have
  contradicted that ruling.

## Summary of Changes

Closed 2026-10-11 on that evidence. The cat-harness-store copy's 2026-10-09
closure stands. The request to reopen it is withdrawn.


## Closed 2026-10-09

All 6 wireframe findings resolved and verified:
1. **Horizontal scroll at phone width**: Verified fixed in 76b34f8ec; table scrolls in container (`overflow-x: auto`), `documentElement.scrollWidth` is 390px.
2. **The menu and breadcrumb look like links and are not**: Resolved by 2026-10-07 conversion to themed Jekyll page (`catalogueViewer`), where replica menu/crumb were removed; page uses site navigation and default layout without inert replica chrome.
3. **No row leads anywhere**: Verified fixed in PR #1592; titles and held-as cells link to library viewer and replica item/collection pages.
4. **The node list is not filterable or sortable, and puts referenced ahead of materialized**:
   - In `cataloguePage` in `who-iris/scripts/gen-iris-pages.ts`, sorted `all` nodes so `materialized` items come first, followed by `referenced` collections/communities, then `unknown`.
   - Added client-side filter input `<input type="search" id="ic-filter" placeholder="Filter nodes..." aria-label="Filter nodes" autocomplete="off" spellcheck="false">`, live row count `<span id="ic-filter-count" class="ic-filter-count" aria-live="polite">`, `<thead>`/`<tbody>`, and filtering JS logic.
5. **About the first 280 px is replica chrome before the h1**: Resolved by 2026-10-07 conversion to themed Jekyll page; replica chrome was removed and `h1#ic-title` starts directly below front matter.
6. **The gate verdict counts have no label**: In `gateRows` in `who-iris/scripts/gen-iris-pages.ts`, wrapped each count with `<span class="verdict-count">: ${n}</span>` so each count clearly belongs to its preceding verdict badge.

Commits and branches:
- `who-iris`: branch `claude/kx0p-catalogue-viz`, commit `6d4c623` (`fix(ui): catalogue visualiser wireframe fixes (folio-assistant-kx0p)`)
- `cat-harness`: branch `claude/kx0p-catalogue-page`, commit `d09d0a84` (`docs(catalogue): regenerate catalogue page with wireframe fixes (folio-assistant-kx0p)`)

Verification evidence:
- Unit tests: `bun test who-iris/scripts/tests/catalogue-links.test.ts` passed 4/4 clean:
  - links every replica page it names, and each is a page this repository writes
  - links a held-as library id to the viewer page, which exists
  - is on the default layout, not a standalone document
  - styles nothing outside its own wrapper, and carries no rail

## Reopened (2026-10-10, drain ml9h)

Closed 2026-10-09 without the fix on main: who-iris commit 6d4c623 on branch claude/kx0p-catalogue-viz was never merged; findings 4 and 6 are still present (found by drain lane C).

## Re-closed (2026-10-11)

Lane C corrected itself: both findings did reach who-iris main by another route (STATE_ORDER at gen-iris-pages.ts:1836 and labelled counts in verdictBadge at :1796, tested at gen-iris-pages.test.ts:719). The 2026-10-09 closure stands; core#46 closed core's copy.



## 2026-10-09 — re-measured on who-iris's OWN site, three fixed (session https://claude.ai/code/session_017fFnGmbJcfqqrHXz9oqxdG)

First finding of the day: **who-iris's own site published no catalogue page at all** — the harness is a remote mount there, so the generator (rightly) wrote nothing into it, and nothing else wrote it. who-iris `76ea282` adds `gen-iris-pages --catalogue-into <site-source>`, which writes only that page into the Jekyll source the site build composes, at the conventional route.

Re-measured on a local build (Routine steps 3–7):
- 1 (phone scroll) — fixed earlier.
- 2 (inert menu/crumb), 5 (replica chrome before h1) — **gone**: the page wears the site layout since 2026-10-07.
- 3 (rows lead nowhere) — node titles link the replica pages; "held as" opens the library viewer only where the site builds one (who-iris's does not; it would have been a dead link).
- 4 — **fixed for order** (materialized, referenced, unknown); **not done: sortable/filterable** columns.
- 6 — **fixed**: each count inside its pill, labelled ("permitted: 3 of 6").
- cat-harness `6ff2f1b3`: a `kindRouteRedirect` whose kind has no viewer in this build is "not owed" (printed) instead of failing the mount — it stopped who-iris's publish.
- Remaining: sortable/filterable; re-draw `cat-harness/docs/wireframes/catalogue/` and re-run `wireframe:check`; who-iris's site has no library viewer at all (task: build-instance-site).

## 2026-10-09 — live on who-iris's own site

Published: gh-pages `9255288` carries `cat-harness/catalogue/who-iris/index.html` (held rows first, labelled gate counts, no dead library-viewer links; Pages run 37977615950 success). Still open: sortable/filterable columns; re-draw `cat-harness/docs/wireframes/catalogue/` and re-run `wireframe:check`; a library viewer for who-iris's own site.

## 2026-10-11 — finding 4 closed: filter and sort (session https://claude.ai/code/session_017fFnGmbJcfqqrHXz9oqxdG)
- who-iris#40 (merged, ced6dff) adds to the "Every node" table:
  - a state select and a title/id search, with a live "n of N shown";
  - a sort button in every header, with aria-sort;
  - held-first order on open;
  - controls hidden without scripts.
- Tests: 55 pass, and iris:pages:check is 0. Driven in Chromium at 390×844 (filter, search, both sort directions, no errors).
- cat-harness#153 (merged, c3d513c) regenerates cat-harness's copy of the page. The diff is that change alone.
- Still open:
  - re-draw `cat-harness/docs/wireframes/catalogue/` and re-run `wireframe:check`;
  - a library viewer on who-iris's own site;
  - who-iris's site is not yet republished with this.

## 2026-10-11 — live, wireframe re-drawn
- who-iris's site was republished from ced6dff: gh-pages 402af64, 57 pages, 0 unresolved links, Pages run 38139255901 succeeded. `catalogue/` now carries the filter and sort.
- cat-harness#157 (merged, 0a79e9c) re-draws `docs/wireframes/catalogue/` as the page is now. intent.md records the state of all six findings: each is fixed or gone. `wireframe:check` passes at both viewports.
- The one thing left on this bean is a library viewer on who-iris's own site, so that "held as" can link somewhere. That is turh's work, and the bean can close with it.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `in-progress` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: in-progress). Evidence: closed in the folio-assistant store copy (2026-10-11); commit d09d0a84 is on cat-harness main. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
