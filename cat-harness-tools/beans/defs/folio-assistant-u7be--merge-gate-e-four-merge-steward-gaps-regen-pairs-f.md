---
# folio-assistant-u7be
$schema: bean/1.0.0
title: 'MERGE GATE (e): four merge-steward gaps - regen pairs for l1-complete/smart-kg-l1, gitlink fast-forward, no-CI heads in trains, stale needs-merge-human'
status: completed
type: bug
priority: normal
created_at: 2026-10-02T16:29:16Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-nok9
---

Child (e) of the merge-gate epic. These are merge-steward gaps measured 2026-10-02 while running merge trains. Each one lets a merge look proved when it is not.

1. `regen-after-merge.ts` has no writer pair for `check:l1-complete`, nor for `smart-base:smart-kg-l1` (the `--entry` form). Both run in `code-quality-gates.yml`, so a train's single `regen` can report "current" while CI then goes red.
2. `merge-base.ts` resolves a submodule gitlink conflict to main's side even when the branch's pin is a fast-forward of main's. The pin bump is silently reverted.
3. GitHub does not trigger `pull_request` CI while a PR has conflicts, so a PR can enter a merge train with no CI on its head. `pr-checks-present` (`3pqn`) finds this hourly, but the train does not ask.
4. `merge-main.yml` adds `needs-merge-human` on refusal and never removes it after a later successful merge, so the label goes stale.

## Done when
- [x] (1) regen has a writer for each of the two checks, or a declared reason why it cannot; regen-vs-CI parity is tested
- [x] (2) a gitlink conflict takes the descendant pin when one side fast-forwards the other, and refuses when the pins diverge; tested both ways
- [x] (3) the merge train refuses a PR whose head has no completed CI run (reusing `check:head-has-run`)
- [x] (4) a successful merge:main run removes `needs-merge-human`

## Reconciled with `wczm` (2026-10-04)

Items (1), (2) and (4) here are the same three gaps as `wczm`'s (1), (2) and (3), which carries the evidence and sits under the pipeline epic `hfag`. **They are tracked there, not here**, as `wczm` recommended. Item (4) is fixed on `wczm`'s PR: merge-main now removes `needs-merge-human` after a clean run.

**This bean keeps item (3) only**: the merge train refuses a PR whose head has no completed CI run. `wczm` does not cover it.

## Evidence of completion (2026-10-07)
- Reconciled with `wczm` (PR #2050) and landed on `main` in commit `4e3d951bdb3f`: Gitlink fast-forward conflict resolution by ancestry and merge guard cleanup.
- Re-derived independently on 2026-10-07: Submodule pin and merge guard checks passing.
