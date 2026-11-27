---
# note on folio-assistant-ob3m from claude/quirky-hypatia-k3aoh4
$schema: folio-bean-note/v1
bean: folio-assistant-ob3m
branch: "claude/quirky-hypatia-k3aoh4"
created: "2026-10-02"
---
## handover: ob3m series driver 2026-10-02

## Handover report: ob3m series driver + site/todos rulings (session_01Cw8JgZEDT5VqQ5ergjdMjB)

- **Session:** https://claude.ai/code/session_01Cw8JgZEDT5VqQ5ergjdMjB
- **Written:** 2026-10-02 ~21:15Z. Asked by the owner: *"Use skill Prepare for Handover as pushed to litlfred/folio-assistant#1912. send to Merge Manager"*.
- **Role and mandate:** drive the ob3m wireframe-findings PRs to green and ready. **Never merge**: the steward ("Separation / Merge Manager") merges. The ready protocol is: mark Ready, add `ready-to-merge`, comment `ready: <sha>`.
- **Owner ruling that binds the in-flight state:** *"stop"*, 18:3xZ. The two merge agents were stopped and the 19:01Z check-in disabled. #1804, #1808 and #1819 have been **paused** since then.

### Where I'm going (current arc)
1. Finish the ob3m series (#1804, #1808, #1819). Once all three land, tell session_013WbQekVypi9A6YQbLDXMmJ ("Smart-base landing page"); that was promised.
2. Carry the owner's 2026-10-02 rulings on the site:
   - stickies panel without the tile icons (#1907);
   - `/todos/` with the stickies panel and without the graph list (#1909);
   - the site landing (#1904);
   - todos as one JSON-LD graph (#1908).

### Done so far (this session)
- **Merged:** #1798, #1822, #1857 (per-PR bean notes), #1856 (merge-main bot crash fix), #1828 (staging orphans). #1805 landed via merge train 4.
- **Closed as landed:** #1799, landed via #1822 (merge commit f77bbc7).
- **Issues filed:**
  - #1904: site root landing; ruling revised, see below.
  - #1908: todos in the KG; slice of bean `h32d`.
  - #1902: sidebar scoping. Filed by session 013Wb, owned by me as a follow-up after #1808.

### In flight
| item | kind | state (pushed SHA) | next action | owner |
|---|---|---|---|---|
| #1804 one-name | PR, paused | head `3ad2870f3`, **conflicts** with main (`document-kinds/index.html`, generated; the bot refuses it) | see the handover-1804 row | needs a driver; **owner said stop** |
| `claude/quirky-hypatia-k3aoh4-handover-1804` | branch (no PR) | `ef5fbc5f9cc`: #1804 head + main `cea2925` merged, conflicts resolved, **regen and gates not run** | verify nothing from main is lost, `bun run cat regen` + `docs:harness` + `viewer:nav:audit`, gates; then fast-forward the PR branch to it | same |
| #1808 sidebar-rail | PR, paused | head `96d11ed6e`, conflicts: ob3m bean + `docs-ui.js` (#1805 tooltips vs `mountSidebarRail`) | see the handover-1808 row | same |
| `claude/quirky-hypatia-k3aoh4-handover-1808` | branch (no PR) | `7b0e9c7e3`: 128 commits ahead of the PR head; "Merge origin/main (#1873) into sidebar-rail", **regen and gates not verified** | merge the current main again, union the ob3m bean, regen, gates; push to the PR branch | same |
| #1819 strip-pinned | PR, paused | head `3ece4fd5d`, conflict: ob3m bean | see the handover-1819 row | same |
| `claude/quirky-hypatia-k3aoh4-handover-1819` | branch (no PR) | `26d23ef1a12`: two merges of main (train 4, then `cea2925`), conflicts resolved, **regen and gates not run** | regen, gates; push to the PR branch | same |
| #1907 stickies: no tile strip | draft PR, issue #1905 | head `6ceea3c76`, CI pending. Earlier reds: skill-registration, `gen-lsi-viz` test, bean-parents. The agent says the skos line is a warning only, and main emits it too | wait for green, then ready protocol | agent `ace9940416103c3e8`, resumed after a 429 |
| #1909 `/todos/` page | draft PR, issue #1906, bean `72gk` | head `806fc6031`, main merged, CI pending | wait for green, then ready protocol | agent `abc54b9ba0202f477`, resumed after a 429 |
| #1908 todos in the KG | issue | not started | starts when #1899 merges (session 013Wb will ping) | me |
| #1902 sidebar scoping | issue | not started | starts after #1808 lands | me |
| #1904 site landing | issue | not started; ruling settled | awaiting the owner's go | me |

### Blockers and dependencies
| blocker | waits on | since | re-check |
|---|---|---|---|
| #1804, #1808, #1819 conflicts | an owner go after *"stop"*, then a driver | 18:3xZ | the next owner message |
| ob3m bean text conflicts (#1808, #1819) | a manual union; the bot refuses `beans/defs/*` by design. Future notes use `beans/notes/` (#1857) | 17:xxZ | on resume |
| #1908 | #1899 merge (shared thin-page shell; library-only IRI fix) | 18:46Z | session 013Wb ping |
| #1902 | #1808 landing | 18:28Z | after #1808 |
| merge-main bot cannot push workflow-file merges (no `workflows` scope) | #1829 | earlier | — |

### Decisions pending (owner)
- **#1904, site landing, ruling (verbatim, 2026-10-02):** *"Flag it, with a default (recommended). The chosen instance's own `<name>.config.json` carries `"site": { "landing": true }`. If exactly one harness is instantiated, it is the landing page and no flag is needed. That covers smart-trust. If there are several and none is flagged, a gate fails. If more than one is flagged, then neutral hub with listing of harnesses, todos,"*. Open question: when to start. Options were after #1808 (recommended), design only now, or full build now. The owner dismissed the question.
- **Todos clutter:** the no-JS "Open notes" tile listing sits in every page footer (`footer_custom.html`, owner ruling 2026-09-21 *"simple tile based listing"*). Options:
  1. move it to the todos page and leave a one-line link in the footer (recommended);
  2. one line per note;
  3. both;
  4. leave it.

  The owner dismissed the question.
- **Six other state pages** (beans, health, issue-marks, qa, swimlane-glossary, uploads) still carry the "State graphs this harness declares" list. #1909 changed only `/todos/`. Raised on #1906.

### Unpushed or at-risk state
- **Scratchpad worktrees** (session-local, lost with the container):
  - `hm-1818`, `hm-1819` and `hm-1822` hold superseded hand-merges. #1818 and #1822 are merged; #1819 is superseded by the handover-1819 branch. Nothing is lost.
  - `onename-wt` and `sub-wt` hold stale regen debris on old heads. Both can be rebuilt; nothing is lost.
- **Scripts in the scratchpad** (lost with the container; each rebuilds in minutes):
  - `ready-once.sh`: applies the ready protocol only if the head is done, core checks pass, the PR is not dirty, and there is no existing `ready:` comment for that SHA.
  - `hand-merge2.sh`: runs main's `merge-base.ts`. **Do not use it when kg-qa and derived-results conflicts coexist**: the deletion defect recorded on #1854.
  - `manual-merge.sh`: plain merge, take `--theirs` for generated files, regen, then verify `comm -23 <(git ls-tree -r --name-only origin/main|sort) <(git ls-files|sort)` is empty.
- **No secrets** are involved.

### How to resume
1. Read the owner's latest message: #1804, #1808 and #1819 are paused under *"stop"*. Do not push to their branches without a go.
2. With a go, take the handover-1804/1808/1819 branches. For each:
   - merge the current `origin/main`;
   - union the ob3m bean (keep every line, one valid `updated_at`);
   - regen (writers → `readme:subgraphs` → `state:visualizer` → `docs:harness` last), then `viewer:nav:audit`;
   - run the `comm` check, then `bun run cat gates`;
   - push to the PR branch, then apply the ready protocol.
3. #1907 and #1909: when CI is green on every job, apply the ready protocol. #1908 starts on the #1899 ping.

## handover: ob3m series driver 2026-10-02

## Handover report: ob3m series driver + site/todos rulings (session_01Cw8JgZEDT5VqQ5ergjdMjB)

- **Session:** https://claude.ai/code/session_01Cw8JgZEDT5VqQ5ergjdMjB
- **Updated:** 2026-10-02 ~21:45Z, at the steward's request, because the owner's weekly budget is at about 3%.
- **Written:** 2026-10-02 ~21:15Z. Asked by the owner: *"Use skill Prepare for Handover as pushed to litlfred/folio-assistant#1912. send to Merge Manager"*.
- **Role and mandate:** drive the ob3m wireframe-findings PRs to green and ready. **Never merge**: the steward ("Separation / Merge Manager") merges. The ready protocol is: mark Ready, add `ready-to-merge`, comment `ready: <sha>`.
- **Owner ruling that binds the in-flight state:** *"stop"*, 18:3xZ. The two merge agents were stopped and the 19:01Z check-in disabled. #1804, #1808 and #1819 have been **paused** since then.

### Where I'm going (current arc)
1. Finish the ob3m series (#1804, #1808, #1819). Once all three land, tell session_013WbQekVypi9A6YQbLDXMmJ ("Smart-base landing page"); that was promised.
2. Carry the owner's 2026-10-02 rulings on the site:
   - stickies panel without the tile icons (#1907);
   - `/todos/` with the stickies panel and without the graph list (#1909);
   - the site landing (#1904);
   - todos as one JSON-LD graph (#1908).

### Done so far (this session)
- **Merged:** #1798, #1822, #1857 (per-PR bean notes), #1856 (merge-main bot crash fix), #1828 (staging orphans). #1805 landed via merge train 4.
- **Closed as landed:** #1799, landed via #1822 (merge commit f77bbc7).
- **Issues filed:**
  - #1904: site root landing; ruling revised, see below.
  - #1908: todos in the KG; slice of bean `h32d`.
  - #1902: sidebar scoping. Filed by session 013Wb, owned by me as a follow-up after #1808.

### In flight
| item | kind | state (pushed SHA) | next action | owner |
|---|---|---|---|---|
| #1804 one-name | PR, paused | head `3ad2870f3`, **conflicts** with main (`document-kinds/index.html`, generated; the bot refuses it) | see the handover-1804 row | needs a driver; **owner said stop** |
| `claude/quirky-hypatia-k3aoh4-handover-1804` | branch (no PR) | `ef5fbc5f9cc`: #1804 head + main `cea2925` merged, conflicts resolved, **regen and gates not run** | verify nothing from main is lost, `bun run cat regen` + `docs:harness` + `viewer:nav:audit`, gates; then fast-forward the PR branch to it | same |
| #1808 sidebar-rail | PR, paused | head `96d11ed6e`, conflicts: ob3m bean + `docs-ui.js` (#1805 tooltips vs `mountSidebarRail`) | see the handover-1808 row | same |
| `claude/quirky-hypatia-k3aoh4-handover-1808` | branch (no PR) | `7b0e9c7e3`: 128 commits ahead of the PR head; "Merge origin/main (#1873) into sidebar-rail", **regen and gates not verified** | merge the current main again, union the ob3m bean, regen, gates; push to the PR branch | same |
| #1819 strip-pinned | PR, paused | head `3ece4fd5d`, conflict: ob3m bean | see the handover-1819 row | same |
| `claude/quirky-hypatia-k3aoh4-handover-1819` | branch (no PR) | `26d23ef1a12`: two merges of main (train 4, then `cea2925`), conflicts resolved, **regen and gates not run** | regen, gates; push to the PR branch | same |
| #1907 stickies: no tile strip | PR, issue #1905, bean `t6ht` | **READY** at `6ceea3c76`: green, `ready-to-merge`, `ready:` posted | steward merges | steward |
| #1909 `/todos/` page | PR, issue #1906, bean `72gk` | **READY** at `d2d5d951b`: green, clean, `ready-to-merge`, `ready:` posted | steward merges | steward |
| #1926 one sticky component | draft PR, issue #1925 | head `e2a1d921a`, red on "Every declared directory's README is current" (`beans/README.md` stale; fix: `bun run cat readme:subgraphs` last). WIP: compact icon row 👁 ✎ pin discard, confirmed "Send to fsh-guts", fsh-guts icon in the LHS navbar top (`gen-navbar-include.ts`, `fa-nav-top`). Staging preview at `da2205f` | finish, green, before/after screenshots to the owner, then ready protocol | agent `ae7955474b2581bae`, told to hand over (budget about 3%) |
| #1922 this handover's first version | PR | merged | — | — |
| #1908 todos in the KG | issue | not started | starts when #1899 merges (session 013Wb will ping) | me |
| #1902 sidebar scoping | issue | not started | starts after #1808 lands | me |
| #1904 site landing | issue | not started; ruling settled | awaiting the owner's go | me |

### Blockers and dependencies
| blocker | waits on | since | re-check |
|---|---|---|---|
| #1804, #1808, #1819 conflicts | an owner go after *"stop"*, then a driver | 18:3xZ | the next owner message |
| ob3m bean text conflicts (#1808, #1819) | a manual union; the bot refuses `beans/defs/*` by design. Future notes use `beans/notes/` (#1857) | 17:xxZ | on resume |
| #1908 | #1899 merge (shared thin-page shell; library-only IRI fix) | 18:46Z | session 013Wb ping |
| #1902 | #1808 landing | 18:28Z | after #1808 |
| merge-main bot cannot push workflow-file merges (no `workflows` scope) | #1829 | earlier | — |

### Decisions pending (owner)
- **#1904, site landing, ruling (verbatim, 2026-10-02):** *"Flag it, with a default (recommended). The chosen instance's own `<name>.config.json` carries `"site": { "landing": true }`. If exactly one harness is instantiated, it is the landing page and no flag is needed. That covers smart-trust. If there are several and none is flagged, a gate fails. If more than one is flagged, then neutral hub with listing of harnesses, todos,"*. Open question: when to start. Options were after #1808 (recommended), design only now, or full build now. The owner dismissed the question.
- **Todos clutter:** the no-JS "Open notes" tile listing sits in every page footer (`footer_custom.html`, owner ruling 2026-09-21 *"simple tile based listing"*). Options:
  1. move it to the todos page and leave a one-line link in the footer (recommended);
  2. one line per note;
  3. both;
  4. leave it.

  The owner dismissed the question.
- **#1925, stickies (verbatim, 2026-10-02):** *"dont treat stickies differently. combine best of each. lower faded avatar/theme looks nicer. upper smaller same size closed looks niceer. icons are a mess on both. make compact underneath. [x] is what? send to fsh-guts? make sure confirmed by user"* and *"(also add fsh-guts icon to LHS top navbar)"*. Implemented on #1926; the owner judges it from the screenshots.
- **Footer build stamp** contrast was 4.38:1 against the required 4.5 in an unstyled stand-in (reported by the #1909 agent). Not verified on the real theme. Possible follow-up; no issue filed.
- **Six other state pages** (beans, health, issue-marks, qa, swimlane-glossary, uploads) still carry the "State graphs this harness declares" list. #1909 changed only `/todos/`. Raised on #1906.

### Unpushed or at-risk state
- **Scratchpad worktrees** (session-local, lost with the container):
  - `hm-1818`, `hm-1819` and `hm-1822` hold superseded hand-merges. #1818 and #1822 are merged; #1819 is superseded by the handover-1819 branch. Nothing is lost.
  - `onename-wt` and `sub-wt` hold stale regen debris on old heads. Both can be rebuilt; nothing is lost.
- **Scripts in the scratchpad** (lost with the container; each rebuilds in minutes):
  - `ready-once.sh`: applies the ready protocol only if the head is done, core checks pass, the PR is not dirty, and there is no existing `ready:` comment for that SHA.
  - `hand-merge2.sh`: runs main's `merge-base.ts`. **Do not use it when kg-qa and derived-results conflicts coexist**: the deletion defect recorded on #1854.
  - `manual-merge.sh`: plain merge, take `--theirs` for generated files, regen, then verify `comm -23 <(git ls-tree -r --name-only origin/main|sort) <(git ls-files|sort)` is empty.
- **No secrets** are involved.

### How to resume
1. Read the owner's latest message: #1804, #1808 and #1819 are paused under *"stop"*. Do not push to their branches without a go.
2. With a go, take the handover-1804/1808/1819 branches. For each:
   - merge the current `origin/main`;
   - union the ob3m bean (keep every line, one valid `updated_at`);
   - regen (writers → `readme:subgraphs` → `state:visualizer` → `docs:harness` last), then `viewer:nav:audit`;
   - run the `comm` check, then `bun run cat gates`;
   - push to the PR branch, then apply the ready protocol.
3. #1907 and #1909: when CI is green on every job, apply the ready protocol. #1908 starts on the #1899 ping.

## handover: ob3m series driver 2026-10-02

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
The before/after PNGs are in the session scratchpad, at `stickies-shots/{before,after}-{panel,window}-{1280,390}.png`, `after-confirm-*.png` and `after-navbar-*.png`. They are local to that session.| #1926 one sticky component | draft PR, issue #1925, bean `dxje` | head `d55651b`: the sticky unification is pushed; the fsh-guts icon is now in the top icon row (cap raised to 7, owner: *"i wanted fsh guts icon here with the others"*); the navbar-row e2e passes. **Not done:** the sticky e2e specs (about 10 files), the new specs, the `board-windows` skill, the window bar's text buttons, full gates. Owner on the screenshots: *"looking good. dont need visualization tiels"*; the strip goes away when #1907 merges | merge main after #1907, finish the specs and the skill, gates, then the ready protocol | open; see the `dxje` handover note on that branch |

## handover: ob3m series driver 2026-10-02

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
The before/after PNGs are in the session scratchpad, at `stickies-shots/{before,after}-{panel,window}-{1280,390}.png`, `after-confirm-*.png` and `after-navbar-*.png`. They are local to that session.| #1926 one sticky component | draft PR, issue #1925, bean `dxje` | head `d55651b`: the sticky unification is pushed; the fsh-guts icon is now in the top icon row (cap raised to 7, owner: *"i wanted fsh guts icon here with the others"*); the navbar-row e2e passes. **Not done:** the sticky e2e specs (about 10 files), the new specs, the `board-windows` skill, the window bar's text buttons, full gates. Owner on the screenshots: *"looking good. dont need visualization tiels"*; the strip goes away when #1907 merges | merge main after #1907, finish the specs and the skill, gates, then the ready protocol | open; see the `dxje` handover note on that branch |

### Update 22:50Z: agents in flight and the beans/todos branch move

**Owner instructions, verbatim:**
- "1 and communicate with NEW merge manager" / "2 + 3" / "then 5"
- "go with cat/cat-harness/todos and cat/cat-harness/beans as their own named sub-graph branches"
- "(not all named subgraphs get own branch, especially not semi-static KG content)"
- "once beans. moves over, neeed to move active beans and update tools"
- "/coordinate on cat/cat-harness/beans w/ Merge Manager and other active siblings"
- "ask Merge Manager to coordinate change over"
- "keep workong. fix gaps"
- "contnue"
- "first handover report"

| item | state (pushed SHA) | owner / next |
|---|---|---|
| #1907, #1909 | in merge train 6 (#1924, head `68e3595`, not landed) | new steward (on #1924; no session id known) |
| #1929 | this note, `3cd231c`, ready | steward |
| #1926 + pin-to-folio-glass | head `d55651b`, dirty; agent finishing pin → folio store, e2e specs, `board-windows` skill, window icons | agent; resume from the `dxje` note |
| #1804 / #1808 / #1819 | unpaused; agent resuming from the handover branches. #1808 is at `c296766` (bean conflict resolved; only docs-ui.js conflicts after main moved); #1819 `3ece4fd`; #1804 `3ad2870` | agent; order 1808 → 1819 → 1804 |
| storage gaps (keyedBy `tip` + generic `branch-store.ts`) | agent building `claude/state-branch-store`, STACKED on #1764. Approved: a type-only edit to `qa-store.ts` line 218 plus a schema rule refusing `tip` on qa dirs. Overlaps #1801 at `directory-storage.test.ts` ~l.127: keep both | agent; 3fva (01LKpuPo) informed |
| #1904 site landing flag + hub | agent building `claude/site-landing-instance` (resolver, `check:landing-instance` gate, `cat-harness` flagged). Avoids docs-ui.js | agent |
| `cat/cat-harness/beans` @ `b3709ad`, `cat/cat-harness/todos` @ `7ad5854` | orphan **seeds**, read by nothing; `main` stays authoritative. `cat/cat-harness/state` untouched | fs43 owner (01KC89) asked to own the tool switch; steward asked to run the freeze; protocol on #1850 |
| #1902, #1908 | not started: #1902 waits on #1808; #1908 waits on #1899 (train 6) and the todos switch | me, next |

**Changeover ledger:** #1850 (protocol comment `5962515204`; 3fva's gap answer `5962532789`). Active sessions told: 01PricYF, 01WmQ8, 013Wb, 01CVVoav, 01DnFZtV, 01KC89, 01LKpuPo.

**Unpushed / at risk:** none in this session's checkouts beyond the agents' own worktrees. Each agent follows prepare-for-handover. Scratch scripts are reproducible: `ready-once.sh` (now marks drafts ready via the CCR route) and `subbr/mk.sh` (seeds a subgraph branch from main).

### Update 2026-10-04 06:45Z: the arc has landed

Every PR this session drove is merged on `main`:

| PR | what | merged |
|---|---|---|
| #1808 | navbar wireframes | 2026-10-03 |
| #1819 | wireframe findings (`ob3m`) | 2026-10-03 |
| #1926 | one sticky component; Pin → folio glass; fsh-guts in the top icon row (#1925) | 2026-10-03 |
| #1937 | `keyedBy: "tip"` + generic `branch-store.ts` (state-branch storage) | 2026-10-03 |
| #1941 | todos as one JSON-LD graph, a page per todo (#1908) | 2026-10-03 |
| #2020 | LHS rail scoped to the instance being viewed; PAGES before FOLDERS; one disclosure arrow (#1902) | 2026-10-03 |
| #1934 | site landing flag + hub (#1904) | 2026-10-04 |
| #1804 | one name per harness; tile labels qualified by owning harness | 2026-10-04 |

**Lesson for the next session:** `main` moved faster than the steward merged, so the last two PRs spent a day being re-merged. The merge-main bot cannot push a merge that touches `.github/workflows/*` (no `workflows` scope, #1829), but a session's own push can — merge by hand when the bot reports that refusal. Run `readme:subgraphs` and `skill:register` LAST after any hand merge; both stale generated files caught the hand merges here.

**Open owner questions (none blocking):**
1. #1902 follow-ups: an "all pages" escape from an instance-scoped rail (default: no — ⌂ and ▦ suffice); FOLDERS out of the Graphs wrapper; what is "not quite" about ON THIS PAGE; the ▦ Harnesses arrow.
2. `dlqu` / `fnx4` adjudication for the beans rollover (#1850) — default: the Merge Manager asks the owning sessions to union.

**Beans changeover (#1850):** owned by session `01EKB1gh` (fs43); `cat/cat-harness/beans` re-seeded at `e79e6f1` per the owner's D4 ruling. Nothing in flight here.

**Unpushed / at risk:** none. The session's scratch worktrees under its scratchpad hold only pushed or merged work; the disk allowance is near full, so a fresh session is the cheaper place for the next arc.
