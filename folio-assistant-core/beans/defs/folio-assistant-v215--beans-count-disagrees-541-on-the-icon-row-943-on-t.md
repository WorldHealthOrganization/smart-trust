---
# folio-assistant-v215
$schema: bean/1.0.0
title: 'Beans count disagrees: 541 on the icon row, 943 on the glass and launcher tiles'
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
created_at: 2026-10-06T18:52:19Z
updated_at: 2026-10-07T05:10:00Z
parent: folio-assistant-4ccr
---

Recorded in the navbar wireframe's Findings ("Seen on the build, not one of the twelve"), re-drawn in #2295 (bean `folio-assistant-1q4b`).

## Defect

Beans carries two counts. The icon row shows **541** ("Beans — 541 open"). The glass tile and the launcher tile show **943**, and no word says what 943 counts.

## What each number counts (measured from source)

- **Icon row (541).** `navbar-row.js` fetches `assets/beans/count.json`. `gen-docs-pages.ts` writes that file as `beans.filter(b => OPEN_BEAN_STATUSES.has(b.status)).length`, with unit "open beans". `OPEN_STATUSES` is `draft`, `todo` and `in-progress`. This was the owner's choice under `gkv6`: "so the badge reads as what is waiting".
- **Glass and launcher tiles (943).** `docs-ui.js` reads `tile.beans` from the bean index `assets/beans/index.json`, which `sync-docs-harness.ts` copies into `_data/harness.json`. `gen-docs-pages.ts` wrote that as `items.length` with unit "beans". That is every bean ever filed, completed and scrapped ones included.
- **A third number with the same name.** The bean board's counts panel (`work-plan.js` `countsPanel`) shows "open" as `todo + in-progress` and leaves `draft` out. So the board's "open" can differ from the badge's "open" whenever drafts exist (2 do today).

## Decision

**One is wrong, so make them agree.** All three surfaces are labelled "Beans" or "open", and all three are headline numbers for the same destination. The owner has already chosen what the headline number for Beans counts: open work (`gkv6`). A tile count that includes every completed and scrapped bean only grows, and it answers a question nobody asked of the tile. The board's own primary count is "open", so with this change the tile and the page it opens agree, which is the coupling `schemas/tile-count.ts` asks for. The count of every bean is still on the board, split by status.

- The tile count, the icon-row count and the board's "open" all come from one definition: `openBeanCount()` / `OPEN_STATUSES` in `bean-store-read.ts`.
- The tile's unit becomes "open beans", which reaches the tile's accessible name. The tile also gets a hover tooltip naming the count and its unit, so a sighted reader is told what the number counts, as the icon row already is.
- The board's "open" includes `draft`, and the board shows a `draft` count beside the others.

## Done when

- [x] The glass tile, the launcher tile and the icon row show the same number for Beans, with the unit "open beans" in each accessible name and tooltip. PR #2312. On the build all three read 540: icon row "Beans — 540 open", and tile title "Beans · Folio Assistant — 540 open beans". On main's build they read 542 and 951.
- [x] The bean board's "open" equals that number. `work-plan.js` now counts open as `draft + todo + in-progress` and shows a draft count.
- [x] No count is hardcoded. The single definition lives in `bean-store-read.ts`, and the generators are re-run. `openBeanCount` and `OPEN_BEANS_UNIT` are used by `gen-docs-pages.ts` for both projections. `docs:pages` and `docs:harness` were re-run.
- [x] An e2e test fails on the old projections or code and passes on the fix. `beans-count-agrees.e2e.ts` fails 4 of 4 on main (951 against 542, and the board at 540 against 542) and passes 4 of 4 here. The unit test is `open-bean-count.test.ts`.
- [x] There are before and after screenshots at 1280 and 390: `navfix-beans-{before,after}-{1280,390}.png`. Each shows the icon row with its tip on the left, and the glass More panel's Beans tile, outlined, on the right.
- [x] The navbar wireframe's Findings mark this as fixed, citing the PR (#2312).

## Evidence

Work landed on `main` in PR #2312 (merge commit `0cb430276f38`).
All 6 Done-when criteria were implemented, verified, and merged.
Verified against `main`:
1. `bun test cat-harness/scripts/tests/open-bean-count.test.ts`: all 4 tests pass.
2. Projections agree: `index.json`'s tile count equals `count.json`'s icon row count.
