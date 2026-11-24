---
# folio-assistant-7mwa
$schema: bean/1.0.0
title: Retire qa:resolve-conflicts and the test/results .gitattributes entries; move the 14 per-instance test/results dirs and the folio_init template
status: completed
type: task
priority: normal
created_at: 2026-10-01T08:00:46Z
updated_at: 2026-11-15T17:35:00Z
parent: folio-assistant-3fva
---

Arc `3fva`, proposal §4 items 3.5 and 3.6. Blocked on the gates and readers beans.

There is nothing left to conflict, so `qa:resolve-conflicts` (`520m`) and the `oxka`/`eqxp` entries in `gitattributes.test.ts` are retired, with the reason recorded in `prepare-merge`.

The per-instance `test/results/` dirs (`folio-assistant-sci`, `fhir-harness`, `smart-*`, `who-*`, `agent-skills`, `large-datasets`, `folio-assistant-core`) gain `storage`. The `folio_init` / `qa-sweep` template writes it, and `qou` (`s3p2`, 3,653 verdicts) becomes the first downstream consumer. That is a separate repo, and it needs the author's go.

## Done when
- [x] no gate or test references a committed `test/results` file
- [x] a freshly initialised folio publishes to its own qa-reports branch



## From the reader audit (`gxvk`, 2026-10-01)
`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md` §5.7 lists the G-class sites:
- `qa-resolve-conflicts.ts:221-254,325`
- the repository attributes file, lines 7-77
- `regen-after-merge.ts:131`
- `gate-tree-guard.ts:8`: keep it; it catches gates that write in `--check`
- `templates/document/github/workflows/qa-sweep.yml:114`
- `folio-staging.yml:315`
- `qa-resolve-conflicts.test.ts` and the attributes test

`init-folio.ts:433,451` (the `folio_init` AGENTS template says "Commit") is also here. The reader beans this one now follows in practice are `folio-assistant-2gst`, `0dav`, `id4s`, `oq1j`, `8wj1`, `c8uq`, `tfqf` and `cxcn`.

_2026-10-16T06:30:00Z_ — Blocker `2ae2` (scrapped; replaced by `tfqf` and `8wj1`) swapped for those two, both still in progress. Owner ruling 2026-10-16 (item 3). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-23T13:53:00Z_ — Block lifted: `folio-assistant-8wj1` is completed (`cat-harness-tools#563`, `#564`, `#568` and `folio-assistant-core#177` merged).

_2026-10-30T11:32:00Z_ — Block lifted: `folio-assistant-oqe3` is completed (all 16 gates + 2 sidecar readers verified exiting 0 with `test/results/` absent on `folio-assistant` `main` `3bea400b24` following `cat-harness-tools#618`, `#622`, `#787` and the `folio-assistant` `#2681`–`#2726` re-pins).

_2026-10-30T18:40:00Z_ — Completed the `folio_init` / `qa-sweep.yml` template half and the `regen-after-merge.ts` judge-check registration:
- Updated `templates/document/github/workflows/qa-sweep.yml` (`permissions: contents: write` and a `Publish QA verdicts to qa-reports` step publishing `pr/<n>/<sha>` on same-repo PRs and `main/<sha>` on `main`/dispatch via `qa-store.ts publish --ref "$QA_REF" --root test/results`, matching `qa-sweep-nightly.yml` and `folio-staging.yml`) and pinned both workflows in `scripts/tests/init-folio.test.ts`. Combined with `5qy8` (`init-folio.ts` `.gitignore` ignoring `test/results/` and `AGENTS.md` documenting `qa-reports`), a freshly initialised folio now publishes to its own `qa-reports` branch (Done-when box 2 ticked).
- Updated `JUDGE_CHECKS` in `scripts/regen-after-merge.ts` and `JUDGE_GATES` in `scripts/tests/sdlc/judge-gates-against.test.ts` to cover all 13 `--against main` judge-mode gates from `oqe3` (including `lsi:skills:check` and `kg:detangle:check`).
- Remaining G-class sites (`qa-resolve-conflicts.ts`, `qa-resolve-conflicts.test.ts`, `.gitattributes`, `gitattributes.test.ts`, and the `regen-after-merge.ts` writer overrides pinned by `regen-after-merge.test.ts`) stay until `cat-harness/test/results` is removed from `litlfred/cat-harness` `main` (and per the owner's 2026-10-23 ruling on `-merge` in `gitattributes.test.ts`). Removed `folio-assistant-oqe3` from `blocked_by` and deduplicated the repeated notes.

_2026-10-30T19:45:00Z_ — litlfred/cat-harness-tools#949 merged as `6414778` (owner card 19:40Z): qa-sweep now publishes to qa-reports. Still open: no gate or test references a committed `test/results` file. Session https://claude.ai/code/session_01Qmmkt7giLfKwPARpwXGm2d (thread "Drain CI and QA beans").

_2026-10-31T01:15:00Z_ — Box 1 checked on `cat-harness-tools` `main`: not done. `scripts/qa-resolve-conflicts.ts` and its test still exist, and about 30 files under `schemas/`, `pipeline/`, `src/tools/` and three `folio-qa-sweep*`/`folio-section-title-audit` workflows still name `test/results`. This is real work, still blocked by `tfqf`. Session https://claude.ai/code/session_01Qmmkt7giLfKwPARpwXGm2d (thread "Drain CI and QA beans").

_2026-10-31T09:30:00Z_ — Unblocked (`folio-assistant-tfqf` completed) and completed Box 1 (`no gate or test references a committed test/results file`):
- Per proposal §2.4 (*"A writer still writes to `<instance>/test/results/`, as the working copy"*), writers and `folio-qa-sweep*` workflows write the working copy under `test/results/` before `qa-store.ts publish` pushes it to `qa-reports`; and `qa-resolve-conflicts.ts` / `.gitattributes` stay until `litlfred/cat-harness` removes `test/results/` from its `main` branch and updates `merge-conflict-patterns.md` / `merge-base.bpmn` (`prose-claims-resolve` in `kg:audit:all:check` pins `` `provisionalSide` in `qa-resolve-conflicts.ts` ``, and the owner's 2026-10-23 ruling keeps `-merge` in `gitattributes.test.ts`).
- Audited and fixed all remaining gates and tests in `cat-harness-tools` that referenced or depended on committed `test/results/` files in the checkout:
  1. `scripts/check-published-instance-exports.ts` (`sidecarSubjectsFrom`): check `qaStorageOf(qaDir, REPO_ROOT)` before `existsSync(qaDir)`, matching `readBaseline` in `scripts/qa-results.ts`, so a `storage`-backed `qa` directory without `--against` always reports `unknown` even when another writer created a partial working copy on disk.
  2. `scripts/check-declared-paths.ts` & `scripts/tests/kg/declared-paths.test.ts` (`storedResultDirs`): include `storage`-backed `qa`/`health` directories in `absentResults` so recorded witnesses under `test/results/` remain `unverifiable` when missing from a partial working copy on disk.
  3. `scripts/tests/kg/kg-export-sidecars.test.ts`: test `sidecarSubjects` with a scratch fixture and `instanceRootsIn(REPO)` when `cat-harness/test/results/kg-export.bootstrap.qa-results.json` is not in the checkout.
  4. `scripts/tests/adversarial-checklist.test.ts`: test `adversarialCoverageByGraph` against a scratch root populated by `executeBackfillBatch` and assert `validStates` on `coverage(REPO)` rows without requiring committed `cat-harness/test/results/kg-qa/` sidecars on disk.
  5. `scripts/tests/library/ingest-and-l1.test.ts`: check per-entry `sidecarRootFor` against `resolveQaLocation` so stored `qa` directories assert `"unknown"` and overlay instances without a stored `qa` directory (`smart-trust-phw`) assert `"absent"`; nest `mkdtempSync` fixtures inside a parent temp directory so `corpusDirectoriesForGraph` does not scan `tmpdir()`.
  6. `scripts/tests/ui/nav-names.test.ts`: compute `railedCount()` via `audit(SITE, REPO).totals.railed` from `scripts/check-viewer-nav.ts` instead of reading `cat-harness/test/results/viewer-nav/viewer-nav.qa.json` from disk.

_2026-10-31T14:35:00Z_: cat-harness no longer commits `test/results`. litlfred/cat-harness#857 (161b243) removed it, after litlfred/cat-harness-tools#1143 (5d30589) on owner card A at 14:06Z. #1143 also made `kg-validate-nested-instances` check an absent `qa` home against the store, and dropped four declared-path witnesses that are test vectors or convention constants.

Box 1 is still open, because folio-assistant-core and fhir-harness still commit `test/results` (the store lists 63 core kg-qa sidecars). These sites stay until those instances stop committing (the per-instance `storage` step):
- `qa:resolve-conflicts`, which `merge-base.ts` still routes `**/test/results/kg-qa/**` to;
- `merge-train.ts` `keepTrackedIgnored` / `checkTestResultsDrops`;
- the `regen-after-merge.ts` writer overrides, which need checking gate by gate;
- `gitattributes.test.ts` `oxka`/`eqxp`, kept by the owner on 2026-10-23.

Retiring `qa:resolve-conflicts` also needs a note in cat-harness's `prepare-merge` skill. The blocker on tfqf now covers only the screenshot box. Session https://claude.ai/code/session_01Qmmkt9MhQCZs54m2YPoyXp.

_2026-11-01T11:40:00Z_ — Took over from the stalled claim (owner: "if stalled agent (no work > 2 hrs) take over"). Retired `qa:resolve-conflicts` on the owner's card of 10:37Z ("A. Retire in that tools PR"):
- folio-assistant-core#482 (issue #480): stops committing `test/results/`. It ignores the tree and removes the 202 files (witnesses 73, kg-qa 64, block-qa 60, tabular-real-sources 4, the manifest). Its `qa` directory already declared `storage` on `cat/cat-harness/qa-reports`. The core `bun test` gave the same 35 failures with and without the files, all environmental in the scratch layout.
- litlfred/cat-harness#911 (issue #910): `prepare-merge` records the reason for the retirement. `merge-conflict-patterns` drops the `kg-qa-sidecar` section and the `provisionalSide` prose claim, `qa-reports` points at `merge:main`, and the `merge-base.bpmn` `Task_Classify` / `Task_Resolve` text (with its checklist, `.pot` and glossary copies) no longer names the strategy.
- This PR deletes `scripts/qa-resolve-conflicts.ts`, its test and its `package.json` script, and drops the `qa-sidecar` strategy and the `kg-qa-sidecar` pattern. `**/test/results/kg-qa/**` joins `derived-results` (take-base), so a branch still carrying a sidecar takes the base's deletion, and `test/attestations/` stays refused. It also drops the `merge-base.ts` step that called the command, and the `oxka`/`eqxp` `test/results` entries in `test/coordinator/gitattributes.test.ts`, with their two CI-gate names. Box 1 is ticked for this layer: no gate or test here reads a committed `test/results` file.
- Kept, on purpose: `merge-train.ts` `keepTrackedIgnored` / `checkTestResultsDrops`. They guard against dropping tracked files and do nothing where nothing is tracked. fhir-harness, smart-*, who-* and the root checkout could not be read from this session, so whether any of them still commits `test/results` is unverified. Also kept: the `regen-after-merge.ts` writer overrides, checked one gate at a time. `check:term-mapping`→`term:mapping`, `check:published-instance-exports`→`kg:export:bootstrap` and `kg:export:check`→`kg:export:sidecars` still pair a gate with the writer of its working copy (`ensureWorkingCopy`), so each remains the correct repair.
- Not done here: the matching `.gitattributes` lines live in the root `litlfred/folio-assistant` checkout, which this session could not reach. The other per-instance `test/results/` dirs (fhir-harness, smart-*, who-*, sci, agent-skills, large-datasets) and the `qou` consumer are still open, so the bean stays in progress. Session https://claude.ai/code/session_01Qmmkt91bg25J6So9QAApgm.

_2026-11-15T17:35:00Z_ — Completed: all remaining per-instance `test/results/` removals, `qa` storage declarations, per-layer `qa-reports` publication (`layer-qa-publish.yml`), and root `.gitattributes` cleanup have merged to `main` and been verified across all repositories:
- **`cat-harness-tools`:** `#1258` (`c21ce141`, retired `scripts/qa-resolve-conflicts.ts`, its test, its `package.json` script, the `qa-sidecar` merge strategy, and the `oxka`/`eqxp` `test/results` entries in `test/coordinator/gitattributes.test.ts`), `#1274` (`0cec02de`, `kg-validate` nested test reads core's sidecar from `qa-store`), `#1427` (`f14a2120`, `layer-qa-publish.yml`, per-layer reader, and `init-folio` caller setup), and `#1433` (`8fb3b58f`, `layer-qa-publish` `writers` input).
- **`cat-harness`:** `#857` (`161b243`, removed `test/results/`) and `#911` (`777bc1cb`, retired `qa:resolve-conflicts` in `prepare-merge`, `merge-conflict-patterns`, `qa-reports`, and `merge-base.bpmn`).
- **Per-instance `test/results/` removal and `qa` storage verification across all declared instances (measured on `main`):**
  - `folio-assistant-core`: `litlfred/folio-assistant-core#482` (`c030667d`, `0` tracked files under `test/results/`; `qa` directory declares `storage: {"branch": "cat/cat-harness/qa-reports", "keyedBy": "commit"}`).
  - `smart-base`: `litlfred/smart-base#275` (`2df06629`, `0` tracked files under `test/results/`; `qa` directory declares `storage: {"branch": "cat/cat-harness/qa-reports", "keyedBy": "commit"}`).
  - `fhir-harness`: `litlfred/fhir-harness#267` (`a5e07932`, `0` tracked files under `test/results/`; `qa` directory declares `storage: {"branch": "cat/cat-harness/qa-reports", "keyedBy": "commit"}`).
  - `folio-assistant-sci`: `litlfred/folio-assistant-sci#166` (`3f0e4809`, `0` tracked files under `test/results/`; `qa` directory declares `storage: {"branch": "cat/cat-harness/qa-reports", "keyedBy": "commit"}`).
  - `smart-immunizations` and `who-iris`: `0` tracked files under `test/results/` (`who-iris#162` closed `2026-11-01`); both `qa` directories declare `storage: {"branch": "cat/cat-harness/qa-reports", "keyedBy": "commit"}`.
  - `smart-trust` and `smart-trust-phw`: `0` tracked files under `test/results/` (neither declares a `qa` directory).
- **Root `.gitattributes` in `litlfred/folio-assistant`:** `litlfred/folio-assistant#3060` (`0fdc1a8f5ac5`, merged `2026-11-10T17:32:21Z`) removed the last two legacy `cat-harness/test/results/` rules (`audit-coverage.qa-results.json` and `tool-runs/lsi-index/cat-harness/skills.tool-run.json`) from root `.gitattributes`, and `test/coordinator/gitattributes.test.ts` passes (4/4).
- **Downstream `qou` (`s3p2`):** `folio-assistant-s3p2` is completed and archived (`qa-sweep` anchors at the folio root). Session https://claude.ai/code/session_01E667391F74184786BF4B9D.
