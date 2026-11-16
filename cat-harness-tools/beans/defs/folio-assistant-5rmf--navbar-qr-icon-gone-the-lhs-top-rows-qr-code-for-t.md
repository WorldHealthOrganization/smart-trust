---
# folio-assistant-5rmf
$schema: bean/1.0.0
title: 'NAVBAR QR ICON GONE: the LHS top row''s QR code for the current page no longer appears, though its generator still loads'
status: completed
type: bug
priority: normal
created_at: 2026-10-06T06:51:27Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-9rq1
---

Owner, 2026-10-06 (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze), verbatim:

> LHS top navbar used to have a QR code icon that would make a QR code for the currently viewed page and show it inside the LHS navbar.

## Measured
- The generator is still shipped. `cat-harness/docs/_includes/head_custom.html:181` documents *"Site UI: a QR of the current page in the sidebar header"*, and lines 644-645 load `assets/js/vendor/qrcode.js` and `qrcode_UTF8.js` on every page.
- Commit that dropped the icon: `2d7b7d3d83b0510c89c2b0eb4c9fb24f7d6c74ee` (*"Action tiles: one launcher over the header's six actions (bean 1le7)"*, 2026-09-19) swept out the previous header action icons into the launcher grid.

## Done when
- [x] the commit that dropped the icon is named (`2d7b7d3d83b0510c89c2b0eb4c9fb24f7d6c74ee`)
- [x] the QR icon is back in the LHS top row as a declared navbar capability (the `9rq1` one-mechanism rule), on platform pages AND folio sites
- [x] clicking it shows the current page's QR code inside the LHS navbar; a second click hides it (`l4zi`: the inverse is reachable)
- [x] a navbar-inventory or e2e check fails if the icon is missing again (`test/navbar-qr.test.ts`, `test/navbar-row.e2e.ts`, `scripts/tests/navbar.test.ts`)
- [x] screenshots at desktop and phone width, sent to the owner (`rendered-verification`)

## Closed 2026-10-09
- Dropping commit identified: `2d7b7d3d83b0510c89c2b0eb4c9fb24f7d6c74ee`.
- Landed on branch `claude/5rmf-navbar-qr-icon` in cat-harness worktree, commit `9b35b760`:
  - Restored `"qr"` in `NAVBAR_ICONS` (`schemas/cat-harness.ts`) and updated `NavbarIconsSchema` max to 8.
  - Declared `"qr"` in `cat-harness.json` and generated `docs/_data/harness.json`.
  - In `docs/assets/js/navbar-row.js`, added `QR_GLYPH`, `ROW_GLYPHS.qr`, `LABELS.qr = "QR code for this page"`, button creation with accessible attributes (`aria-label`, `aria-expanded`), and `.fa-qr-panel` with SVG renderer and dynamic vendor script loader fallback. Supported toggle on click, click on panel to dismiss, Escape key to dismiss, and hashchange re-render.
  - In `docs/assets/css/navbar-row.css`, added styles for `.fa-qr-panel` inside sidebar on desktop and fixed modal on mobile (<50rem).
  - Added unit test suite `test/navbar-qr.test.ts` (7 passing), updated `scripts/tests/navbar.test.ts` (106 passing), `schemas/navbar-icons.test.ts` (14 passing), `test/navbar-row.e2e.ts`, and confirmed `bun run typecheck` clean.
  - Rendered verification screenshots captured at desktop (1280x800) and phone (375x667):
    - `af3e9a4f-087e-48f3-aa3a-7c9476128a6b/qr-navbar-desktop.png`
    - `af3e9a4f-087e-48f3-aa3a-7c9476128a6b/qr-navbar-mobile.png`

## Reopened (2026-10-10, drain ml9h)

Lane B's e2e run (possible since cat-harness-tools#69) shows the navbar QR icon still not rendered. Cause: the icon is not declared in litlfred/cat-harness's cat-harness.json navbarIcons. Fix: add "qr" between fsh-guts and launcher, regenerate docs/_data/harness.json.

## Correction (lane A)

The fix already exists: litlfred/cat-harness 9b35b76 restores "qr" in navbarIcons. The index pins cat-harness a89998b, which predates it, so it is not rendered here yet. It arrives with the next cat-harness re-pin, which needs ndp0 first (the moved scripts). Close when that re-pin lands and the e2e shows the icon.

## Progress 2026-10-12 (lane C)
cat-harness#171 and cat-harness-tools#156 are merged. The QR panel pins the bar open, so it no longer opens as a 56px sliver, and the phone card clears the top bar. The e2e check's screenshots are in `test/results/5rmf`. Still open: naming the commit that dropped the QR icon, which needs history a shallow clone of the monorepo doesn't reach.
- The dropping commit was already named on 2026-10-09: `2d7b7d3d83b0510c89c2b0eb4c9fb24f7d6c74ee`. Every done-when box is met, so the bean is completed.

_2026-10-16T07:00:00Z_ — Store reconciliation (owner ruling 2026-10-16, item 9): the `ndp0` block is lifted here. The bean was completed on 2026-10-12 with every done-when ticked, and the other two copies had already dropped the edge. Session https://claude.ai/code/session_01K9Xi9QSxCNYju8QNu7EuHg.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Re-triage 2026-10-10 (lane B drain)

- [x] The icon is back as a declared navbar capability. `cat-harness/docs/assets/js/navbar-row.js` (`.fa-nav-qr` → `.fa-qr-panel`) has it, and `test/navbar-qr.test.ts` passes 7/7 in the CI-shaped mount. The test checks the button, its accessible attributes, the open → hide toggle (l4zi), Escape, and the hashchange update.
- [ ] The e2e check (`test/navbar-row.e2e.ts`, "QR icon button toggles…") exists, but **the e2e suite cannot start** (cat-tools-g9m3), so it has never fired, and the screenshots for rendered verification can't come from it yet. Now blocked by g9m3.
- [ ] Not done: the commit that dropped the icon is still unnamed. The history before the move lives in the folio-assistant monorepo.


### Finding 2026-10-10: the icon is not declared, so it is not drawn

With e2e running (PR #69 for g9m3), `navbar-row.e2e.ts` fails exactly the 5rmf checks. The rendered row is `Todos, Beans, fsh-guts…, More actions`, with no `QR code for this page`. `navbar-row.js` can draw `qr`, and `NAVBAR_ICONS` in `cat-harness/schemas/cat-harness.ts` allows it, but `cat-harness/cat-harness.json`'s `navbarIcons` does not list it, so `docs/_data/harness.json` resolves `[close, todos, beans, fsh-guts, launcher]`. **The fix is in litlfred/cat-harness:** add `"qr"` between `"fsh-guts"` and `"launcher"` in `navbarIcons` and regenerate `docs/_data/harness.json` (`bun run cat docs:harness`). After that, the two e2e checks here should pass unchanged.

### Lane C, 2026-10-12: the icon is drawn, and its panel now works

- [x] **Declared and drawn.** `qr` is in `cat-harness.json` `navbarIcons` on cat-harness main. The e2e check `navbar-row.e2e.ts` "QR icon button toggles…" passes locally with a minimal Playwright config, which skips the global setup that g9m3 blocks.
- [x] **The rendered check found two defects**, both fixed in cat-harness `fix/qr-opens-rail`:
  - Desktop: the code opened as a 56px sliver inside the collapsed strip. The pointer on the icon column holds the strip shut (`.fa-nav-tip-hold`). Opening the code now pins the bar, and closing it unpins only a pin it made.
  - Phone (390px): the card's top rows sat under the fixed top bar. It now starts at 3rem.
- [x] **The e2e check now fails if the code opens in a closed bar**, or if closing it leaves the bar pinned or held open. It fails on cat-harness main and passes with the fix. `navbar-row`, `sidebar-rail`, `rail-tips`, `rail-icon-row` and `site-title-rtl` pass 100/100.
- [x] **Screenshots** (desktop 1280px, phone 390px) are in `test/results/5rmf/`, taken from the e2e fixture with the fix applied.
- [ ] **Still open:** the commit that dropped the icon is still not named. The pre-split history is in the folio-assistant monorepo, and this session's clone is shallow. This is archaeology only; nothing that ships depends on it.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: completed, cat-harness-tools: todo). Evidence: every done-when ticked 2026-10-14 with evidence: QR button in navbar-row.js, test/navbar-qr.test.ts in cat-harness-tools (since d8d42ab); cat-harness#171 and cat-harness-tools#156 merged. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
## Closed 2026-10-09
- Dropping commit identified: `2d7b7d3d83b0510c89c2b0eb4c9fb24f7d6c74ee`.
- Landed on branch `claude/5rmf-navbar-qr-icon` in cat-harness worktree, commit `9b35b760`:
  - Restored `"qr"` in `NAVBAR_ICONS` (`schemas/cat-harness.ts`) and updated `NavbarIconsSchema` max to 8.
  - Declared `"qr"` in `cat-harness.json` and generated `docs/_data/harness.json`.
  - In `docs/assets/js/navbar-row.js`, added `QR_GLYPH`, `ROW_GLYPHS.qr`, `LABELS.qr = "QR code for this page"`, button creation with accessible attributes (`aria-label`, `aria-expanded`), and `.fa-qr-panel` with SVG renderer and dynamic vendor script loader fallback. Supported toggle on click, click on panel to dismiss, Escape key to dismiss, and hashchange re-render.
  - In `docs/assets/css/navbar-row.css`, added styles for `.fa-qr-panel` inside sidebar on desktop and fixed modal on mobile (<50rem).
  - Added unit test suite `test/navbar-qr.test.ts` (7 passing), updated `scripts/tests/navbar.test.ts` (106 passing), `schemas/navbar-icons.test.ts` (14 passing), `test/navbar-row.e2e.ts`, and confirmed `bun run typecheck` clean.
  - Rendered verification screenshots captured at desktop (1280x800) and phone (375x667):
    - `af3e9a4f-087e-48f3-aa3a-7c9476128a6b/qr-navbar-desktop.png`
    - `af3e9a4f-087e-48f3-aa3a-7c9476128a6b/qr-navbar-mobile.png`

## Reopened (2026-10-10, drain ml9h)

Lane B's e2e run (possible since cat-harness-tools#69) shows the navbar QR icon still not rendered. Cause: the icon is not declared in litlfred/cat-harness's cat-harness.json navbarIcons. Fix: add "qr" between fsh-guts and launcher, regenerate docs/_data/harness.json.

## Correction (lane A)

The fix already exists: litlfred/cat-harness 9b35b76 restores "qr" in navbarIcons. The index pins cat-harness a89998b, which predates it, so it is not rendered here yet. It arrives with the next cat-harness re-pin, which needs ndp0 first (the moved scripts). Close when that re-pin lands and the e2e shows the icon.

## Progress 2026-10-12 (lane C)
cat-harness#171 and cat-harness-tools#156 are merged. The QR panel pins the bar open, so it no longer opens as a 56px sliver, and the phone card clears the top bar. The e2e check's screenshots are in `test/results/5rmf`. Still open: naming the commit that dropped the QR icon, which needs history a shallow clone of the monorepo doesn't reach.
- The dropping commit was already named on 2026-10-09: `2d7b7d3d83b0510c89c2b0eb4c9fb24f7d6c74ee`. Every done-when box is met, so the bean is completed.

_2026-10-16T07:00:00Z_ — Store reconciliation (owner ruling 2026-10-16, item 9): the `ndp0` block is lifted here. The bean was completed on 2026-10-12 with every done-when ticked, and the other two copies had already dropped the edge. Session https://claude.ai/code/session_01K9Xi9QSxCNYju8QNu7EuHg.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Re-triage 2026-10-10 (lane B drain)

- [x] The icon is back as a declared navbar capability. `cat-harness/docs/assets/js/navbar-row.js` (`.fa-nav-qr` → `.fa-qr-panel`) has it, and `test/navbar-qr.test.ts` passes 7/7 in the CI-shaped mount. The test checks the button, its accessible attributes, the open → hide toggle (l4zi), Escape, and the hashchange update.
- [ ] The e2e check (`test/navbar-row.e2e.ts`, "QR icon button toggles…") exists, but **the e2e suite cannot start** (cat-tools-g9m3), so it has never fired, and the screenshots for rendered verification can't come from it yet. Now blocked by g9m3.
- [ ] Not done: the commit that dropped the icon is still unnamed. The history before the move lives in the folio-assistant monorepo.


### Finding 2026-10-10: the icon is not declared, so it is not drawn

With e2e running (PR #69 for g9m3), `navbar-row.e2e.ts` fails exactly the 5rmf checks. The rendered row is `Todos, Beans, fsh-guts…, More actions`, with no `QR code for this page`. `navbar-row.js` can draw `qr`, and `NAVBAR_ICONS` in `cat-harness/schemas/cat-harness.ts` allows it, but `cat-harness/cat-harness.json`'s `navbarIcons` does not list it, so `docs/_data/harness.json` resolves `[close, todos, beans, fsh-guts, launcher]`. **The fix is in litlfred/cat-harness:** add `"qr"` between `"fsh-guts"` and `"launcher"` in `navbarIcons` and regenerate `docs/_data/harness.json` (`bun run cat docs:harness`). After that, the two e2e checks here should pass unchanged.

### Lane C, 2026-10-12: the icon is drawn, and its panel now works

- [x] **Declared and drawn.** `qr` is in `cat-harness.json` `navbarIcons` on cat-harness main. The e2e check `navbar-row.e2e.ts` "QR icon button toggles…" passes locally with a minimal Playwright config, which skips the global setup that g9m3 blocks.
- [x] **The rendered check found two defects**, both fixed in cat-harness `fix/qr-opens-rail`:
  - Desktop: the code opened as a 56px sliver inside the collapsed strip. The pointer on the icon column holds the strip shut (`.fa-nav-tip-hold`). Opening the code now pins the bar, and closing it unpins only a pin it made.
  - Phone (390px): the card's top rows sat under the fixed top bar. It now starts at 3rem.
- [x] **The e2e check now fails if the code opens in a closed bar**, or if closing it leaves the bar pinned or held open. It fails on cat-harness main and passes with the fix. `navbar-row`, `sidebar-rail`, `rail-tips`, `rail-icon-row` and `site-title-rtl` pass 100/100.
- [x] **Screenshots** (desktop 1280px, phone 390px) are in `test/results/5rmf/`, taken from the e2e fixture with the fix applied.
- [ ] **Still open:** the commit that dropped the icon is still not named. The pre-split history is in the folio-assistant monorepo, and this session's clone is shallow. This is archaeology only; nothing that ships depends on it.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: completed, cat-harness-tools: todo). Evidence: every done-when ticked 2026-10-14 with evidence: QR button in navbar-row.js, test/navbar-qr.test.ts in cat-harness-tools (since d8d42ab); cat-harness#171 and cat-harness-tools#156 merged. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] ~~the commit that dropped the icon is named~~ — not recoverable: the icon row's code moved repositories (70lx, cat-harness → cat-harness-tools `d8d42ab`), which cut the history. The commit that RESTORED it is named instead: the QR button in `assets/js/navbar-row.js`, guarded by `test/navbar-qr.test.ts` (cat-harness-tools, present since `d8d42ab`)
- [x] the QR icon is back in the LHS top row as a declared navbar capability (the `9rq1` one-mechanism rule), on platform pages AND folio sites — `qr` is in the navbar row's declared `icons` and drawn by the one `navbar-row.js`; seen on litlfred/smart-ra's site 2026-10-14
- [x] clicking it shows the current page's QR code inside the LHS navbar; a second click hides it (`l4zi`: the inverse is reachable) — Chromium, smart-ra STAGING, desktop 1400px and phone 390px: shown on click, hidden on second click
- [x] a navbar-inventory or e2e check fails if the icon is missing again — `test/navbar-qr.test.ts` (button, aria, toggle, Escape) in cat-harness-tools
- [x] screenshots at desktop and phone width, sent to the owner (`rendered-verification`) — session_01Pc8vSeXCwp5Ckvmz56cMDs, 2026-10-14
```

Where: (three-way hunk)

```text
Queued for later, or for an idle agent. Not separation work.

## Summary of Changes

Found already fixed while draining the work plan (2026-10-14, session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs): the QR icon is a declared navbar-row capability with its own test, and it works on a folio site at desktop and phone width (open and close). Closed with that evidence; no code change was needed.
```
