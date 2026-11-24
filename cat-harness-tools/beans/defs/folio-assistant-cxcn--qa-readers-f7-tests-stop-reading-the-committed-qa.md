---
# folio-assistant-cxcn
$schema: bean/1.0.0
title: 'QA READERS F7: tests stop reading the committed QA corpus (15 tests in 6 files fail when it is absent)'
status: completed
type: task
priority: normal
created_at: 2026-10-01T08:47:14Z
updated_at: 2026-10-02T08:02:57Z
parent: folio-assistant-3fva
blocked_by:
    - folio-assistant-16ei
---

Arc `3fva`, from reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`, §5.5 family F7). Blocked on `16ei`. Do it last: the fixtures follow the APIs that the other reader beans settle.

Measured on the same 21 test files: with the corpus present, 8 tests fail, none of them about a missing file. With it moved aside, 20 fail. **15 tests fail only when the corpus is absent, in 6 files** (`comm -13` over the sorted `(fail)` lines). One test, `kg-qa.test.ts` "no critical criterion is failing on main", fails with the corpus present and passes vacuously with it absent.

## Readers (tests that read the COMMITTED corpus)
- `cat-harness/scripts/tests/qa-results.test.ts:40,119,269,298,369`: the `qa` dir, `witnesses/**`, `qa-index.json`, the badge tree. 5 fail. (`:60` fails at baseline too.)
- `cat-harness/schemas/kg-qa.test.ts:128,328`: `kg-qa/**`, the hosted bootstrap manifest. 2 fail, and "no critical criterion" goes vacuously green. **It never walks the hosted homes** (`test/results/bootstrap/`, `bootstrap-tools/`, `cat-harness-tools/`), which is why the 3 conflict-marked sidecars on `main` went unseen.
- `cat-harness/schemas/kind-validator.test.ts:224`. 1 fails.
- `cat-harness/scripts/tests/tool-qa-subjects.test.ts:53`. 4 fail.
- `cat-harness/scripts/tests/gen-lsi-viz.test.ts:33`. 2 fail; a third fails at baseline too.
- `cat-harness/schemas/test-run.test.ts:232`. 1 fails.
- `cat-harness/scripts/tests/subgraphs.test.ts` (entanglement, the `../` count) and `audit-coverage.test.ts` (fixpoint) read the declared directories and the sidecar, but they already fail at baseline, so the run does not discriminate. Re-check them once `main` is green (`gurh`).
- `cat-harness/test/qa-badge.e2e.ts:49`, `cat-harness/test/qa-panel.e2e.ts:46,181`: read corpus witnesses at load. Not run here (Playwright).
- `cat-harness/test/health/workflow.test.ts:122`: asserts the health upload path only `toContain`s the file name, and passes over the wrong path. The live-defects bean fixes the assertion.

## Migration action
- A test asserts on a FRESH run or a fixture, never on the committed corpus (memory: *never assert on a QA verdict from the published corpus*; guard `e2e-corpus-coupling.test.ts`).
- Corpus-validation tests (e.g. "every committed kg-qa validates") move to a gate over the fetched tree, and walk every hosted home.

## Done when
- [ ] `bun test` passes with `test/results/` absent from the checkout
- [ ] a validation gate over the fetched tree covers the hosted homes, and fails on a planted conflict marker


## Result (2026-10-02, branch `qa-readers-f7-cxcn`, commits 5d8822e3f..285b5220e, not pushed)

**Measured.** "Absent" = every `<instance>/test/results/` moved aside (14 instances), then restored.

- The audit's six reader files plus `qa-graph-integrity.test.ts`, at the original test code: 0 fail with the corpus present, **14 fail with it absent**.
- A FULL `bun test` with it absent, after the first fixes, found **13 more failures in 7 files the audit's 21-file run never ran**: `qa-attestations-criteria.test.ts` (6), `declared-paths.test.ts` (2), `declared-dirs.test.ts`, `check-declaration-filename.test.ts`, `regen-writers.test.ts`, `qa-fixture.test.ts`, `subgraphs.test.ts`.
- Final full `bun test` with the corpus absent: **13924 pass, 0 fail** (678 files). With it present, the bun test inside `bun run cat gates` is green after the last commit.

**Done when, both verified:**

- [x] `bun test` passes with `test/results/` absent from the checkout (the full suite, every instance's results directory).
- [x] `bun run cat check:qa-corpus` validates the fetched tree (`--dir <tree>`, `--ref <ref>`, or `--github`). It walks every declared `qa` directory and every `kgQaHomeFor` home: own, hosted (`bootstrap/`, `bootstrap-tools/`, `cat-harness-tools/`) and convention. It checks conflict markers and unparseable JSON, the kg-qa schema, applicable criteria, `fail` without findings, a failing critical criterion, the home manifest, and the witness tree against the generated badge pages. `check-qa-corpus.test.ts` plants an 8-wide conflict marker in a hosted home: exit 1. A miss or an empty tree is UNKNOWN, exit 2.

**CI.** It runs in the `qa-publish` job, after the publish, as `check:qa-corpus --github`, over the entry that job just stored. A fork PR skips with the same notice the publish gives. Any other miss is UNKNOWN (exit 2). `gates.test.ts` names it as a publisher-job step, the way it names `qa:publish`.

**What each reader became.**

| file | now |
|---|---|
| `kg-qa.test.ts` | the corpus walks are `check:qa-corpus` |
| `kind-validator.test.ts` | fixture nodes |
| `tool-qa-subjects.test.ts` | a fresh `kg-audit --check --json` |
| `gen-lsi-viz.test.ts` | a fixture index |
| `test-run.test.ts` | a fresh round trip and a legacy fixture |
| `qa-results.test.ts` | the witness tests are in the gate; kg-export is rendered fresh |
| `qa-graph-integrity.test.ts` | the attestation store only |
| `qa-attestations-criteria.test.ts` | a fixture corpus |
| `regen-writers.test.ts` | the writer produces an absent artefact first |
| `qa-fixture.test.ts` | the corpus guard is removed |
| `declared-paths.test.ts` | the gate's own unverifiable rule |
| `declared-dirs.test.ts` | sets aside the off-main absent finding only |

Production changes:

- `git-corpus.ts`: a tracked file that is not on disk is not part of the corpus.
- `check-subgraphs.ts`: a link into an absent off-main directory is counted as `unverifiable`, not as dangling.

**Left / noted:**

- R72 `qa-badge.e2e.ts:49` and R73 `qa-panel.e2e.ts:46,181` (Playwright) still read corpus witnesses at load. Not touched. Their fix is a fixture.
- R75 `test/health/workflow.test.ts` is the live-defects bean's work.
- `check:declared-dirs` still reports an absent `qa` directory as `absent`, as 16ei decided (`directory-storage.test.ts`). It goes away when 5hox declares `storage`.
- Locally, `bun run cat gates` also fails `translation:catalogue:check -- --base "$base"`. That step is CI-only: `$base` is unset outside CI. It is not this change.

## E2E item done (R72, R73)

Commit `069ca4632` on branch `qa-8iqt-e2e` (not pushed). `qa-badge.e2e.ts` (R72) and `qa-panel.e2e.ts` (R73, both reads) now read committed copies under `cat-harness/test/support/fixtures/qa-e2e/` (`badge-index.json`, `block-witness.json`, `kg-witness.json`). They still go through the verdict-pinning helpers.

- `scripts/tests/qa-e2e-fixtures.test.ts` holds the copies to the generator's shape: `QaIndexSchema`, and the `QaWitnessDoc` / `QaCriterionView` / `QaWitness` keys.
- `e2e-corpus-coupling.test.ts` gains rule 3: no e2e spec reads a derived results tree at all, raw or through a helper. Run against the pre-change specs, it fires on all three reads.
- `bunx playwright test` on both specs: 14/14 pass, both with `cat-harness/test/results` present and with it moved aside.
