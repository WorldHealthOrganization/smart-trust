---
# folio-assistant-cpe7
$schema: bean/1.0.0
title: 'PR CHECKS: core judges its own graph and QA on every pull request'
status: completed
type: feature
priority: high
created_at: 2026-10-14T16:35:00Z
updated_at: 2026-10-22T16:50:00Z
---

Owner, 2026-10-14: core "should at least be checking the consistency of its own graph using the cat harness tools, if not also adding its own specific QA". Measured that day: `.github/workflows/` held `release-npm.yml` only, so folio-assistant-core#80 (260 imports rewritten) merged on local evidence alone, with no check on the pull request. cat-harness has the same gap (`post-merge-regen.yml`, `release-npm.yml` only).

## Done when
- [x] `pr-checks.yml` runs on every pull request: typecheck; the test suite on main and on the PR, failing only on new failures; and the gates, likewise
- [x] the gates are the harness's graph checks over this instance (kg-audit, check-tools, kg-export, import-direction, declaration-resolution) and core's own QA (every `check:*` / `*:check` in `checkoutScripts`), derived in `.github/scripts/run-gates.py`
- [x] one green run on a pull request, with the step summary listing what is red on main — folio-assistant-core#82, run 38598522451
- [x] the same for cat-harness (its own bean or this one's follow-up) — `litlfred/cat-harness` `.github/workflows/harness-pr-checks.yml` runs on `pull_request` and `push` to `main` and delegates to `litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main` (landed in `cat-harness` `4c184e417bc9`, `#370`, `#382`)

## First run, 2026-10-14 (folio-assistant-core#82, run 38598522451)
- Tests: 718 on each side; 1 failing on main and the PR (`schemas/glossary.test.ts` › bootstrap's terms are one ordered, authored scheme).
- Gates, 10 run. Passing: `check:materialized-fixity`, `check:voices`, `kg:materialize:check`, `import-direction`, `kg-export`. **Red on main** (listed, not counted): `check:glossary`, `glossary:pot:check`, `check-tools`, `declaration-resolution`, `kg-audit`. Each is a follow-up: make it green on main, after which a PR that turns it red fails.

_2026-10-22T16:50:00Z_ — Completed: all 4/4 Done-when boxes met; `litlfred/cat-harness` `.github/workflows/harness-pr-checks.yml` runs on `pull_request` and `push` to `main` and delegates to `litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main` (landed in `cat-harness` `4c184e417bc9`, `#370`, `#382`).
