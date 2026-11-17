---
# folio-assistant-jtfk
$schema: bean/1.0.0
title: 'CI: build the QA working copy once per run, restore it in the 8 consumer jobs (48% of runner-seconds)'
status: completed
type: task
priority: normal
created_at: 2026-10-07T19:39:27Z
updated_at: 2026-10-08T08:05:00Z
parent: folio-assistant-hfag
---

Issue #2456. Owner approved 2026-10-07 ~19:40Z ("1y, 2y, 3y, 4y"). Measurements in the issue body.

_2026-10-07T19:39:38Z_ — Claimed by claude/ci-runner-budget (session https://claude.ai/code/session_013WbQekVypi9A6YQbLDXMmJ).

## Done on claude/ci-runner-budget (PR #2457), 2026-10-07

- New job `qa-working-copy` runs `bun run cat qa:working-copy` once. `cat-harness/scripts/qa-working-copy-bundle.sh` snapshots the checkout before and after and packs EVERYTHING that changed (files, new dirs, deletions), with a sha256 manifest whose own hash is the job output. Measured locally: the build touches ~2,600 paths, well outside `test/results/`, so a directory list would have been partial.
- The 8 readers (4 test shards, gates-kg, gates-docs, gates-unrun, skill-registration-chain) `needs:` it with `if: !cancelled()`. Each checks the producer succeeded, downloads, checks the manifest hash, extracts, and runs `sha256sum -c` in place. A failed build makes them red, never skipped.
- qa-publish restores the same copy instead of running qa:refresh (470 s on run 37659324493). It keeps the kg-export producer step, then `verify`s the copy is unchanged (the sidecar is deterministic: two local runs gave one sha256). It publishes with the producer's `build/qa-refresh.json`.
- BPMN: Task_QaWorkingCopy + GW_Readers; SVG and .pot regenerated; qa-reports-ci.test.ts updated.
- Commits 7702652e6f3, 71c444d0737 (+ regen 03f203c71c9).
- Evidence still owed: the PR's CI run as the after-measurement (before/after table in the PR body).

_2026-10-07, local evidence on d96d3a4a117 (merged with main ea77c253665)_: qa:working-copy exit 0 in 259 s; pack 2,284 files / 34 MB; wiped, restored and verified byte-identical, and qa:working-copy --status reports current. CI run 37683602404's producer failed inside qa:working-copy (main's stale tree, fixed by #2471); readers went red, not skipped. No green CI after-run yet because CI is paused; not ready-to-close until one exists.

## Completed on landed evidence
- Landed on `main` in PR #2457 (`ci: runner budget — QA working copy once, verdict reuse on main, drop roll-up jobs (#2456)`), commit `086cb6b15415` / `7702652e6f3`.
- `code-quality-gates.yml` now runs `qa-working-copy` producer and restores in 8 consumer jobs.
