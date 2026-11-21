---
# note on folio-assistant-dxje from claude/stickies-one-component
$schema: folio-bean-note/v1
bean: folio-assistant-dxje
branch: "claude/stickies-one-component"
created: "2026-10-02"
---
## handover: stickies one component

Handover for issue #1925, draft PR #1926, branch `claude/stickies-one-component`. The work stopped because the budget ran out. Last feature commit: `e2a1d921ab1`. The commit that carries this note follows it.

## Done (committed)
- **One sticky component** in `cat-harness/docs/assets/js/docs-ui.js`:
  - `stickyTile`: the closed square tile. Every tile is `--fa-sticky-tile-size` (9rem) and shows the theme art faded behind `.fa-sticky--backdrop`.
  - `stickyActions`: the icon row under each tile, in the order view, edit, pin, send to fsh-guts. Pin is a toggle (`aria-pressed`) and is its own inverse.
  - Landing stickies (`mountLandingHomes`/`tileLandingCell`) and todo stickies (`mountTodoBoard` → `todoSlot`) both use these two functions.
  - `buildSticky(todo)` no longer has Pin or Discard on the card face.
  - A floating todo card now gets Move and "⌂ Return".
  - Semantic zoom was removed from the board, since every board slot is now a closed tile. It still applies on the glass.
- **Confirmation before discard**: `confirmSendToFshGuts`, a native `<dialog>` opened with showModal.
  - It names the sticky, says the discard is restorable and per-browser, and says where to restore it from.
  - Cancel or Escape closes it and does nothing else. Focus starts on Cancel.
  - The window bar's Discard goes through the same dialog.
- **Landing stickies can be discarded**, stored as `landing/<slot>` in `fa-discarded-todos`, with titles kept in `fa-discarded-titles`. Restoring one un-hides it straight away. The panel count follows (`syncLandingCount`).
- **fsh-guts in the navbar**:
  - `NavbarModel.fshGuts` and `fshGutsHtml` in `cat-harness/scripts/lib/navbar.ts`. `gen-navbar-include.ts` emits it when the `fsh-guts` tile is declared, and the include has been regenerated.
  - Client code: `mountFshGutsNav`. The count has four states: absent "–", zero, n, error "?". Clicking opens the existing list and restore in a `<dialog>`.
  - Page settings shows a pointer instead of a second Discarded control when the navbar icon is present.
  - It renders in the `.fa-nav-top` region of the sidebar footer, which is above ▦ Harnesses and not the very top of the sidebar. The topmost icon row is the declared `navbarIcons` row, which is capped at 6 and already full.
- `landing.html`: `data-fa-art-card` on each article.
- The 3 unguarded hrefs flagged by `href-safety.test.ts` are wrapped in `safeHref`, and the test passes.

## Not done
- **e2e specs are NOT updated yet.** Expect failures in `sticky-home`, `sticky-todos`, `board-windows`, `discarded-items`, `fishbone-relocate`, `glass-zoom-steady` (board half), `a11y`, `panel-chrome`, `glass-devices` and `board-move-filter`. They still reference `.fa-home-pin`, `.fa-sticky-pin`, `.fa-sticky-discard`, `.fa-sticky-recall`, `.fa-landing-tile` and board semantic zoom.
- No new spec yet for:
  - both kinds rendering the same component;
  - the same row in the same order;
  - equal closed sizes;
  - Confirm/Cancel, then restore;
  - the navbar icon and its count.
- Skills not updated: `board-windows` (semantic zoom is now glass-only; pin toggle; the confirm) and `harness-tiles`/`fsh-guts`. The 2026-10-02 ruling should be quoted in each.
- The full `bun run cat gates` has not been run. CI was red on readme:subgraphs (regenerated in this commit) and on href-safety (fixed in this commit).

## Screenshots
The before/after PNGs are in the session scratchpad, at `stickies-shots/{before,after}-{panel,window}-{1280,390}.png`, `after-confirm-*.png` and `after-navbar-*.png`. They are local to that session.

### Update, 2026-10-02 ~22:10Z (parent session, owner said "fix, then prepare for handover")

- **Done at `53ee5a8`:** fsh-guts moved into the top `navbarIcons` row, per the owner: *"i wanted fsh guts icon here with the others"*.
  - `NAVBAR_ICONS` gains `fsh-guts`, and the cap rises from 6 to 7.
  - The `.fa-nav-top` placement is no longer emitted.
  - The `harness-tiles` skill is updated.
  - Verified: navbar-row e2e passes (47), and the unit tests, lint, typecheck, `skill:register:check` and `readme:subgraphs:check` pass.
- **Still open** (unchanged from above): the sticky e2e specs (about 10 files on old selectors), the new specs, the `board-windows` skill (zoom glass-only, pin toggle, confirmation), the window bar's text buttons, and the full `bun run cat gates`.
- **Merge `origin/main` once #1907 has landed.** The Visualisations strip in the screenshots disappears then. The owner said: *"looking good. dont need visualization tiels"*. Do not remove the strip here.

### Update, 2026-10-03 (resumed after the container restart)

- **WIP `74f42c0` reviewed and kept.** Pin writes a `fa-folio-assets` entry (`landing/<slot>` or `todo/<id>`, `shown: true`), drawn by `buildGlassCard` + `dressGlassSticky`. Unpin is `shelveFromGlass`. The old `fa-pinned-stickies` store is migrated once and then removed. `todo/` and not `todos/` is deliberate: it is the key the glass's own Todos panel already uses, so the two ways onto the glass name the same asset.
- **Merged `origin/main` twice** (`7c986f4`, `588edd3`), bringing in #1907 and #1909. `docs-ui.js` merged cleanly, and the Visualisations row stays removed as main has it. The conflicts were generated artefacts only, so they were regenerated.
- **Fixed:** `pinTodo`'s href now goes through `safeHref`, which `href-safety` requires.
- **Verified:** 291 of 291 pass across `sticky-home`, `sticky-todos`, `sticky-one-component`, `sticky-shape`, `board-windows`, `a11y`, `glass-devices`, `glass-filter`, `glass-zoom-steady`, `discarded-items`, `fishbone-relocate`, `panel-chrome`, `board-move-filter` and `navbar-row`. The four specs this note listed as not done needed no change. `bun run cat gates`: 211 of 212 pass. The one failure is `audit-coverage.test.ts` "the report is a fixpoint", which runs over bun's 5s default in this container (5.7s) and is not touched by this branch.
- **Screenshots:** `cat-harness/test/results/screenshots/stickies-pin-1925/pin-{before,after}-{1280,390}.png`.
