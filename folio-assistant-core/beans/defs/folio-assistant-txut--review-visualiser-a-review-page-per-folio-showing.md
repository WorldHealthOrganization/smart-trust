---
# folio-assistant-txut
$schema: bean/1.0.0
title: 'REVIEW VISUALISER: a review/ page per folio showing what changed from main, grouped by the folio/ graph'
status: completed
type: task
priority: normal
created_at: 2026-09-22T21:02:54Z
updated_at: 2026-10-07T18:03:00Z
parent: folio-assistant-q4jm
blocked_by:
    - folio-assistant-jwox
    - folio-assistant-ojcx
---

Owner: *"need a new visualizer under the harness maybe, like review/ which
shows things in folio diff from main"*.

**What.** A `review/` page per folio, reached from the navbar tile for that
folio and from the STAGING banner. It reads the ChangeSet (child 02) and shows:
- the changed blocks, grouped by the folio/ graph's chapter/section tree;
- counts per change kind;
- the MAIN and STAGING URLs for each block, looked up in the publish ref (as
  `staging-review` already does).

**Home.** `cat-harness/scripts/gen-review-viz.ts`, beside the eleven other
`gen-*-viz.ts` generators. It is declared as a `coverage.visualiser` so
`graph-tiles` lists it. It is a view OF the folio graph, not a new graph kind.

**Relations.**
- 7ofc: the folio/ visualiser. review/ is a MODE of viewing folio/, so the two
  should share the tree component rather than build two.
- 7m6g: the visualiser filter.
- sjic: the navbar component.

## Done when
- [x] the page renders for a folio on STAGING with a non-empty ChangeSet, and on MAIN with an explicit message rather than a blank list. MAIN has NO ChangeSet, so it says "nothing to compare against main". A ChangeSet with zero changes says "No block changed" with the count compared
- [ ] it is declared, and `graph-tiles` lists it without an undeclared-projection finding. **Does not apply as written** (see round 1): the page lives in a FOLIO's preview site, and graph-tiles lists the platform's own declared visualisers. It is linked from the folio site's index. Whether a folio should declare it as a visualiser is open
- [x] it is keyboard-operable end to end: `j`/`k` plus button twins, Tab through plain links, visible focus, and a live status. Verified in Chromium keyboard-only. The full keyboard map is eb4l
- [x] rendered and inspected in a browser: Chromium, light and dark, on a scaffolded folio's preview (not `preview:site`, which builds the platform's docs). Screenshots were given to the owner in the session

## Round 1: 2026-09-23

**Built.** `cat-harness/scripts/gen-review-page.ts` is a static page that fetches `../changeset.json` and `../staging.json` when opened, because in `folio-staging.yml` the ChangeSet is computed AFTER the site build. `build-document-site` writes it to `<site>/review/index.html` and links it from the index. The generator is harness (rendered surface; 7ofc's ruling), and it is called from core, which is the allowed direction.

**What it shows.**
- The summary: base → branch, with counts per kind.
- Changes grouped by section, each a WORD (added, removed, reworded, edited, moved, renamed; "was X" for a rename).
- A before/after pair per changed block: a preview link, plus a `main` link built from `staging.json`'s `mainSite`. An added block gets only the preview link; a removed block only the main link.

The list is built with DOM APIs only, so a block label can never become markup.

**Verified in Chromium** on an init-folio-scaffolded document folio, with one block added and one reworded. That run covered the site build, the ChangeSet, the banner, and a static serve:
- both changes listed with word labels;
- `j`,`j` reached change 2 of 2, and the status announced it;
- the preview link returned 200 with the `prose:scope` anchor present;
- a build with no ChangeSet shows the explanatory message;
- light and dark screenshots were checked, and the button row and branch naming were fixed after looking at them.

**Not here:** renderer choice (d903), heat map (qbfi), comments (423d), outline and minimap (eb4l).



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Evidence: Closed on Landed Work

Delivered and landed in PR #1000 (commit `2a76df611f57`):
- `cat-harness/scripts/gen-review-page.ts` generates `review/index.html` per folio showing diff against main.
- Verified in Chromium: change categories, preview links, keyboard navigation (`j`/`k`).
