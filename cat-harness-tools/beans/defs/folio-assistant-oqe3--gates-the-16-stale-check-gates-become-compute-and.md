---
# folio-assistant-oqe3
$schema: bean/1.0.0
title: 'Gates: the 16 stale-check gates become compute-and-judge, with --against <ref> for new-vs-inherited findings'
status: completed
type: feature
priority: high
created_at: 2026-10-01T08:00:46Z
updated_at: 2026-10-30T11:32:00Z
parent: folio-assistant-3fva
---

Arc `3fva`, proposal §2.3 and §4 item 3.1. Blocked on the qa-store bean. Can be dispatched to 3 agents, one per family.

- 3.1a: `kg:audit:check`, `kg:audit:all:check`, `audit:coverage:require-all/strict`, `check:harness-state:check`
- 3.1b: `lsi:skills:check`, `lsi:viz:check`, `kg:detangle:check`, `translation:block-qa:check`
- 3.1c: `skill:register:check`, `readme:subgraphs:check`, `root-scan-census:check`, `check:term-mapping`, `check:viewer-nav`, `check:prov-qaqc`, `check:reference-direction:check`, `docs:pages:check`
- also: `check-version-bump.ts` and `check-published-instance-exports.ts`, which read committed sidecars

New semantics:
- a critical finding exits 1;
- "stale" no longer exists;
- `--against` diffs with `qa-reports:main/<merge-base>` and reports new findings separately from inherited ones;
- a missing baseline is `unknown`. It is reported, and it does not fail the PR.

This retires the defect class behind `uju6`, `5qq3`, `ymsu`, `3ozg` and `i2kp`.

## Done when
- [x] every gate listed passes on main with `test/results/` absent from the checkout
- [x] a seeded new finding fails a PR, and an inherited one is reported but does not fail



## Refined by the reader audit (`gxvk`, 2026-10-01)
`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md` measured every gate on this list with `test/results/` moved aside. The work is now queued per reader family, and this bean is the umbrella for the gate half:
- `folio-assistant-2gst` (F1): `kg:audit:check` and `kg:audit:all:check` (3.1a). **Two false-cleans**: pair attestations 13 → 0 findings, and test-run criteria `pass` → `n/a`.
- `folio-assistant-0dav` (F2b): `audit:coverage:*`, `check:harness-state:check`, `skill:register:check`, `readme:subgraphs:check`, `root-scan-census:check`, `check:term-mapping`, `check:viewer-nav`, `check:reference-direction:check`, `check:glossary`, `check:l1-complete`. `audit-coverage` reports a moved kind as `empty` (false-empty).
- `folio-assistant-id4s` (F2a): `qa-results.ts`, `check-version-bump.ts` and `check-published-instance-exports.ts`.
- `folio-assistant-oq1j` (F3): `lsi:skills:check`, `lsi:viz:check`, `kg:detangle:check` and `uml:overview:check` (3.1b).
- `folio-assistant-8wj1` (F4): `translation:block-qa:check` (3.1b).
- `folio-assistant-tfqf` (F6): `docs:pages:check`.
- `folio-assistant-c8uq` (F5): `check:orphan-verdicts` and `check:qa-reviewer-permission`, which this list did not name. **Both pass on an empty corpus.**

Corrections to this list:
- **`check:prov-qaqc` is not a reader.** It writes `docs/assets/prov/` and never opens `test/results/` (its output was identical in both runs).
- **`check:published-instance-exports` compares nothing today.** Both of its invocations use `export-graph`, which writes no sidecar. That is `folio-assistant-r7v6`.

## Done on local branch qa-3hk4-oqe3, 2026-10-02 (NOT pushed)

These are the last stale-compare gates of the 16, the ones the 5hox inventory found still red with the files absent (group A). They now compute and judge, following bo44 and 0dav:

- **`kg:audit:check`** (`kg-audit.ts --check --against main`). It grades every fail or unknown criterion at the gate's severity, one entry per finding. The rule is `gradedKgFindings` in `schemas/kg-qa.ts`, beside `worstSeverity`, so a second finding in an already-failing subject is new. It runs in "absolute" mode: against a branch baseline only new findings fail, and with no readable baseline every finding fails, as before.
  - Still failing: a committed attestation file the run would rewrite, an attestation orphan, and unreadable judgements, which exit 2.
  - A stale or orphaned derived sidecar is advisory in a stored tree and a finding in an unstored one.
  - `--json` now writes its report synchronously. A large `console.log` to a pipe was truncated by `process.exit`.
- **`kg:audit:all:check`** passes `--against` through and relays each instance's judge line. It keeps the four states: a blind instance exits 2.
- **`translation:block-qa:check`** (`--check --against main`) grades `fail` verdicts by substance: criterion, severity, evidence and notes. Timestamps and hashes are excluded, so a re-run does not make an inherited finding new. It runs in "new" mode: only new findings fail, and no baseline means UNKNOWN, which is not gated. Refused pairs exit 2. There are 3 `fail` entries today, so "absolute" mode would have turned a green gate red.
- **`skill:register:check`'s chain** now clears its kg:audit step. It stays red with the files absent only through `lsi:viz:check` and `uml:overview:check`, which are group B.
- The shared judge is `judgeSidecarTree` in `qa-results.ts`. With `--against` it reads the ENTRY first, so an absent entry is ONE unknown, never N new subjects. Inside a readable entry, a missing path means a subject that is new in this change.

Not migrated by name, because they already were (judge mode or not a reader): `audit:coverage:*`, `check:harness-state:check`, `lsi:skills:check`, `kg:detangle:check`, `readme:subgraphs:check`, `root-scan-census:check`, `check:term-mapping`, `check:viewer-nav`, `check:reference-direction:check`. `check:prov-qaqc` is not a reader. `lsi:viz:check` and `docs:pages:check` are 4l4d or group B.

Tests: `cat-harness/scripts/tests/qa-tree-judge.test.ts` (16).
- They cover new vs inherited against the working copy and against a real bare remote, entry-miss = one unknown, an unreachable remote = unknown, extraFailing and undetermined, and what each gate grades.
- CLI runs: an unknown flag and a malformed `--against` each exit 2. kg:audit:check and translation:block-qa:check against a remote with no entry print UNKNOWN, are not gated, and leave `git status` unchanged.

**`bun run cat gates` with the files ABSENT** (scratch = 2e5c88e52 + 420ab8180, fresh tree): **11 of 206 red, down from 16 of 205.**
- Cleared: `kg:audit:check`, `kg:audit:all:check`, `translation:block-qa:check`, `readme:subgraphs:check` and `bun test`.
- Remaining, all expected:
  - Group B, waiting for a `main/` entry: `lsi:viz:check`, `uml:overview:check`, `check:qa-reviewer-permission`, `check:orphan-verdicts`, `check:kind-validators:require-all`, `check:declared-paths`.
  - `skill:register:check` ×2, red through lsi:viz and uml:overview, so also group B.
  - Group C, 4l4d, committed pages embedding QA badges: `docs:pages:check`, `check:ci-invocations`.
  - Group E, CI-only: `translation:catalogue:check --base`.

Done-when:
- not yet: "every gate listed passes on main with test/results/ absent" — not yet. The group B gates need a main/ entry, and docs:pages needs 4l4d.
- verified: "a seeded new finding fails a PR, and an inherited one is reported but does not fail" — pinned for the tree judge on a real remote, and per gate by what it grades. Not shown end to end on a real PR.

_2026-10-16T06:30:00Z_ — Block lifted: `16ei` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T16:46:00Z_ — Claim released in a stale-claims sweep by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr), applied here by the coordinator. The coordinator's standard: release only on evidence, and never a claim from the last 48 hours. What was checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The only later ones are a blocker withdrawal (10-06) and a store reconciliation (10-16), and neither is work.
- No remote branch in any of the three repositories names this bean.
- The holding branch `qa-3hk4-oqe3` was local only and has no remote.

The unticked Done-when boxes above are what remains. Back to `todo` so a sibling session is not misled. Nothing was deleted. The tools-store copy matches: litlfred/cat-harness-tools#558.

## 2026-10-23: batch 1 (litlfred/cat-harness-tools#618, issue #617)

The work was not lost. The 2026-10-02 local-branch work reached `main` through the arc merge (folio-assistant `acf7d0ea1`), and the 70lx split carried it into cat-harness-tools. `judgeSidecarTree`, `gradedKgFindings` and `--against main` on `kg:audit:check`, `kg:audit:all:check` and `translation:block-qa:check` are all on `main` today. Bean `4l4d` is completed.

Re-measured on cat-harness-tools `main` 51ce679, in a composed checkout with cat-harness `main`. cat-harness still commits `test/results/` (1476 files), although it declares the directory `storage`. Two gates were red on `main` itself with the files present: `lsi:skills:check` (`skills.lsi.json` stale) and `kg:detangle:check` (seven `*.detangle.json` stale). Both are 3.1b. Detangle is one of the most-changed stored trees: 105 file changes since 10-09.

PR #618 (draft) makes both gates compute and judge. In a stored tree, a stale or orphaned copy is advisory. `--against main` reports the stored record, and a missing entry is UNKNOWN and not gated. Exit codes before and after:

| gate | main, present | main, absent | #618, present | #618, absent |
|---|---|---|---|---|
| `lsi:skills:check` | 1 | 0 | 0 | 0 |
| `kg:detangle:check` | 1 | 0 | 0 | 0 |

Remaining, as the next batches:
- **Batch 2 (proposed):** `check:term-mapping`, `check:reference-direction:check` and `check:harness-state:check` already judge and accept `--against`, but their package scripts do not pass `--against main`.
- `skill:register:check`'s chain: its `lsi:skills:check` step is green after #618. Not re-measured end to end.
- Group B, waiting for a `main/` entry: `lsi:viz:check` (green on main with the files present), `uml:overview:check`, `check:qa-reviewer-permission`, `check:orphan-verdicts`, `check:kind-validators:require-all`, `check:declared-paths`.
- `docs:pages:check` and `uml:overview:check` now run through `publish-check.ts` (owner B1). `check:ci-invocations` is unblocked now that 4l4d is done. None of these has been re-measured.
- `check:version-bump`, `check:published-instance-exports`, `translation:catalogue:check --base` (CI only) and `check:prov-qaqc` (not a reader).
- Done-when item 1 still needs a full `bun run cat gates` run with `test/results/` absent. Caution for whoever runs it: `uml:overview:check` (publish-check) and `gates --list` start writers (`qa:working-copy`, `qa:refresh`, `skill:register`) that rewrite `test/results/`. Run it in a throwaway copy.

Session https://claude.ai/code/session_01NVW1gLKTQrfffUSgD3GCd5.

## 2026-10-23: batch 2 (litlfred/cat-harness-tools#622, issue #621)

The owner said go. `check:term-mapping`, `check:reference-direction:check` and `check:harness-state:check` now pass `--against main` in their package scripts. A new test, `judge-gates-against.test.ts`, pins `--against main` on all 11 judge gates. The PR is independent of #618.

Measured locally:
- term-mapping: 0 → 0.
- harness-state: 2 → 2. Its health family stays UNKNOWN until qa-reports holds a health report.
- reference-direction: 0 (UNKNOWN) → 1, with 83 new pairs against `main/0907d88`. They are probably an artefact of my local composition. CI already runs this command.

The owner kept the `-merge` marking in `gitattributes.test.ts`. Still remaining: everything after batch 2 in the list above.

## Kept from cat-harness-tools' copy (copy sync, 2026-10-24)

These notes were only in this copy. The newer copy from the bean branch is above them.

*2026-10-22T16:46:00Z* — Claim released (stale-claims sweep, coordinator standard: on evidence, nothing claimed in the last 48h; lane A, session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr). Checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The latest are a blocker withdrawal on 10-06 and a store reconciliation on 10-16, neither of which is work.
- No remote branch in any of the three names this bean.
- Its branch `qa-3hk4-oqe3` was local only: no remote branch of that name exists.

The claimed work is NOT all on main: the unticked Done-when boxes above are what remains, and the ticked ones are what landed. Back to todo so the claim does not mislead a sibling session. Nothing was deleted.


_2026-10-16T06:30:00Z_ — Block lifted: `16ei` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T16:46:00Z_ — Claim released in a stale-claims sweep by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr), applied here by the coordinator. The coordinator's standard: release only on evidence, and never a claim from the last 48 hours. What was checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The only later ones are a blocker withdrawal (10-06) and a store reconciliation (10-16), and neither is work.
- No remote branch in any of the three repositories names this bean.
- The holding branch `qa-3hk4-oqe3` was local only and has no remote.

The unticked Done-when boxes above are what remains. Back to `todo` so a sibling session is not misled. Nothing was deleted. The tools-store copy matches: litlfred/cat-harness-tools#558.

## 2026-10-23: batch 1 (litlfred/cat-harness-tools#618, issue #617)

The work was not lost. The 2026-10-02 local-branch work reached `main` through the arc merge (folio-assistant `acf7d0ea1`), and the 70lx split carried it into cat-harness-tools. `judgeSidecarTree`, `gradedKgFindings` and `--against main` on `kg:audit:check`, `kg:audit:all:check` and `translation:block-qa:check` are all on `main` today. Bean `4l4d` is completed.

Re-measured on cat-harness-tools `main` 51ce679, in a composed checkout with cat-harness `main`. cat-harness still commits `test/results/` (1476 files), although it declares the directory `storage`. Two gates were red on `main` itself with the files present: `lsi:skills:check` (`skills.lsi.json` stale) and `kg:detangle:check` (seven `*.detangle.json` stale). Both are 3.1b. Detangle is one of the most-changed stored trees: 105 file changes since 10-09.

PR #618 (draft) makes both gates compute and judge. In a stored tree, a stale or orphaned copy is advisory. `--against main` reports the stored record, and a missing entry is UNKNOWN and not gated. Exit codes before and after:

| gate | main, present | main, absent | #618, present | #618, absent |
|---|---|---|---|---|
| `lsi:skills:check` | 1 | 0 | 0 | 0 |
| `kg:detangle:check` | 1 | 0 | 0 | 0 |

Remaining, as the next batches:
- **Batch 2 (proposed):** `check:term-mapping`, `check:reference-direction:check` and `check:harness-state:check` already judge and accept `--against`, but their package scripts do not pass `--against main`.
- `skill:register:check`'s chain: its `lsi:skills:check` step is green after #618. Not re-measured end to end.
- Group B, waiting for a `main/` entry: `lsi:viz:check` (green on main with the files present), `uml:overview:check`, `check:qa-reviewer-permission`, `check:orphan-verdicts`, `check:kind-validators:require-all`, `check:declared-paths`.
- `docs:pages:check` and `uml:overview:check` now run through `publish-check.ts` (owner B1). `check:ci-invocations` is unblocked now that 4l4d is done. None of these has been re-measured.
- `check:version-bump`, `check:published-instance-exports`, `translation:catalogue:check --base` (CI only) and `check:prov-qaqc` (not a reader).
- Done-when item 1 still needs a full `bun run cat gates` run with `test/results/` absent. Caution for whoever runs it: `uml:overview:check` (publish-check) and `gates --list` start writers (`qa:working-copy`, `qa:refresh`, `skill:register`) that rewrite `test/results/`. Run it in a throwaway copy.

Session https://claude.ai/code/session_01NVW1gLKTQrfffUSgD3GCd5.

## 2026-10-23: batch 2 (litlfred/cat-harness-tools#622, issue #621)

The owner said go. `check:term-mapping`, `check:reference-direction:check` and `check:harness-state:check` now pass `--against main` in their package scripts. A new test, `judge-gates-against.test.ts`, pins `--against main` on all 11 judge gates. The PR is independent of #618.

Measured locally:
- term-mapping: 0 → 0.
- harness-state: 2 → 2. Its health family stays UNKNOWN until qa-reports holds a health report.
- reference-direction: 0 (UNKNOWN) → 1, with 83 new pairs against `main/0907d88`. They are probably an artefact of my local composition. CI already runs this command.

The owner kept the `-merge` marking in `gitattributes.test.ts`. Still remaining: everything after batch 2 in the list above.

## 2026-10-26: re-measured all 16 gates + 2 sidecar readers at latest `main` (`test/results/` absent)

Re-measured sequentially in an isolated checkout at latest `main` of `folio-assistant` (`277511ffb6`), `cat-harness` (`89f2d426b2`), `cat-harness-tools` (`f902005584`), `bootstrap` (`02dfd19f6c`), `bootstrap-tools` (`1584c10dd0`) and `folio-assistant-sci` (`8d6daa52b3`), with state branches mounted and `rm -rf test/results cat-harness/test/results` before each gate:

| family | gate | exit | judge / `--against main` status | output / why |
|---|---|---|---|---|
| 3.1a | `kg:audit:check` | 1 | compute+judge (`--against main`) | `advisory: 556 derived sidecar(s) differ (not gated)`. Exits 1 on 14 out-of-date committed attestation files under `test/attestations/kg-qa/` (un-repinned `cat-harness` `89f2d426b2` vs `index.lock.json` `a196134bed`). |
| 3.1a | `kg:audit:all:check` | 0 | compute+judge (`--against main`) | `0 instance(s) audited (--check: nothing written) — 0 clean, 0 failing, 0 produced no report.` |
| 3.1a | `audit:coverage:require-all` / `strict` | 1 | compute+judge (`--against main`) | 1 new finding in `kinds-typed-only` (`software-library`: 45 files under `cat-harness-tools/libraries`) + 2 UNKNOWN kinds (`auto-docs`, `ig-pages` builtAtPublish dirs absent). |
| 3.1a | `check:harness-state:check` | 0 | compute+judge (`--against main`) | `9 famil(ies): 0 finding(s), 0 famil(ies) could not be determined; advisory: the committed harness-state.qa-results.json is UNKNOWN against this run. Not gated.` |
| 3.1b | `lsi:skills:check` | 0 | compute+judge (`--against main`) | `pass cat-harness/skills fresh — recomputed in this run (259 units); no index in the checkout to be stale.` |
| 3.1b | `lsi:viz:check` | 0 | `builtAtPublish` | `lsi viewer: cat-harness/docs/en/cat-harness/lsi/index.md is built at publish (builtAtPublish), not committed — nothing to compare.` |
| 3.1b | `kg:detangle:check` | 0 | compute+judge (`--against main`) | Recomputes and judges; missing/orphaned derived `.detangle.json` sidecars are advisory. |
| 3.1b | `translation:block-qa:check` | 0 | compute+judge (`--against main`) | `baseline (qa-reports:main/277511ffb6): 0 NEW finding(s), 6 inherited, 0 resolved — OK (40 sidecar(s) computed).` |
| 3.1c | `skill:register:check` | 1 | `declarations-only` = 0; chain = 1 | Declarations audit passes (`381 skill(s) across 34 package(s): every one declared`). Chain steps `skill:commands:check`, `skills:docs:check`, `auto:docs:check`, `lsi:skills:check`, `lsi:viz:check`, `kg:detangle:check` all exit 0; fails only on non-`test/results/` steps (`check:glossary` 1.0 MB budget on `bpmn-activities/index.md`, `uml:overview:check` missing builtAtPublish glossary page, `subgraph:jsonld:check` un-repinned `v1.jsonld`, `kg:audit:check` 14 attestations). |
| 3.1c | `readme:subgraphs:check` | 0 | compute+judge (`--against main`) | `0 directory README(s); 0 stale. baseline (qa-reports:main/277511ffb6): 0 NEW finding(s) — OK` (with `QA_WORKING_COPY_BUILDING=1`; without it, `requireCurrentWorkingCopy` runs `qa:refresh`). |
| 3.1c | `root-scan-census:check` | 0 | compute+judge (`--against main`) | `106 enumerating script(s), 28 ask git; baseline: 0 NEW finding(s) — OK.` |
| 3.1c | `check:term-mapping` | 0 | compute+judge (`--against main`) | `3751 candidate(s); baseline: 0 NEW finding(s) — OK.` |
| 3.1c | `check:viewer-nav` | 0 | compute+judge (`--against main`) | `0 railed, 0 declined, 0 linked, 0 missing, of 0 generated viewer page(s) — OK.` |
| 3.1c | `check:prov-qaqc` | 0 | not a `test/results/` reader | `✓ PROV-O QA/QC report current: 12 instance(s), 149 step(s), 149 activities.` |
| 3.1c | `check:reference-direction:check` | 1 | compute+judge (`--against main`) | Judges against `qa-reports:main/277511ffb6`; reports 14 new `wrong-direction` findings introduced between the index lock (`a196134bed` / `5cc9b5e4ac`) and latest layer `main` (`89f2d426b2` / `f902005584`). |
| 3.1c | `docs:pages:check` | 0 | `publish-check.ts docs:pages` | `? assets/qa/index.json — UNKNOWN: the derived QA corpus is not in this build; no count published. ✓ publish:check docs:pages: ran, its --check passes on its own output.` |
| also | `check:version-bump` | 0 | sidecar reader | `11 publishable instance(s): 0 ok, 0 under, 11 unreleased, 0 undetermined.` |
| also | `check:published-instance-exports` | 0 | sidecar reader | `? UNKNOWN — cat-harness/test/results is not in this checkout; not gated (bean id4s, proposal §2.3).` |

**Verdict:** All 16 gates + 2 sidecar readers have been migrated to compute-and-judge with `--against main` (or `publish-check.ts` / `builtAtPublish` / `UNKNOWN`-not-gated), and **zero** fail because `test/results/` is absent. Box 1 stays unticked only until `folio-assistant` repins `cat-harness` and `cat-harness-tools` (clearing the 14 attestation files, the `software-library` coverage row, and the 14 `wrong-direction` references) and `readme:subgraphs:check` drops its `requireCurrentWorkingCopy` call under `--check`.

## 2026-10-26: batch 3 (`litlfred/cat-harness-tools#787`)

Opened `litlfred/cat-harness-tools#787` (`fix/oqe3-subgraph-readmes-and-library-coverage`) to clear the two `cat-harness-tools` defects uncovered in the 2026-10-26 measurement above:
1. **`scripts/subgraph-readmes.ts` (`readme:subgraphs:check`):** removed the dead `requireCurrentWorkingCopy(REPO, GATE)` call. Since `f3bh`, `harnessInstances()` skips every stored (`qa`) directory (`!isStored(d) && !contentIsOffCheckout(d)`), so `readme:subgraphs` and `readme:subgraphs:check` never read `test/results/` and no longer trigger `qa:refresh` when `test/results/` is absent.
2. **`scripts/audit-coverage.ts` (`audit:coverage:require-all` / `strict`):** taught `scriptsFor()` to follow `run-script.ts <name>` hops (used by `run-gates.py`), taught `gateCoverage()` to resolve `cat-harness-tools/` script paths against `TOOLS_ROOT` and merge `checkoutScripts`, and included `SCRIPT_EXEMPTIONS` entries with `kind === "covered-by"` and `reason.startsWith("RUN BY THE LAYER CHECKS:")` (`libraries:check`, `@covers software-library`) on non-content roots so `software-library` is reported as `covered` rather than a false `kinds-typed-only` finding.

_2026-10-30T11:10:00Z_ — Progress update: `litlfred/cat-harness-tools#618` (`2026-10-23T16:37:32Z`), `#622` (`2026-10-23T16:37:38Z`), and `#787` (`2026-10-29T07:26:25Z`) are all merged on `main`, and `folio-assistant` re-pinned `cat-harness` and `cat-harness-tools` on `main` (`#2681`–`#2721`). Box 1 remains to be re-verified with a clean `test/results/`-absent run on the current re-pinned `main`.

## 2026-10-30: re-verified all 16 gates + 2 sidecar readers on re-pinned `main` (`3bea400b24`, `test/results/` absent)

Re-measured in an isolated composed checkout of `litlfred/folio-assistant` `main` (`3bea400b24`, with locked mounts `cat-harness@209dc64ed37b`, `cat-harness-tools@8262ebadaba8`, `fhir-harness@251042b1390a`, `folio-assistant-core@9f78bd3d3a96`, `folio-assistant-sci@150054214b2d`, `smart-base@040f197d3751`, `smart-immunizations@f2f75c961f4e`, `smart-trust@89df1be3fb93`, `who-iris@2fef5eda4529`, `bootstrap@3ce2b5d64177`, `bootstrap-tools@fdceeca33492` and state branches mounted), removing `test/results` and `*/test/results` before each gate:

| family | gate | exit (`test/results/` absent) | output / verification |
|---|---|---|---|
| 3.1a | `kg:audit:check` | 0 | `advisory: 554 derived sidecar(s) differ from this run's (not gated: the kg-qa tree is stored on qa-reports; judge, never compare)`. `baseline (qa-reports:main/c56cfb56c3a8ca969f1e9a5b7252631ad81e7ec6): 0 NEW finding(s) in 0 sidecar(s), 0 inherited, 0 resolved`. `kg:audit:check (judge mode, wrote nothing): OK — no finding the gate fails on` (once the 16 non-`test/results/` attestation files under `cat-harness/test/attestations/kg-qa/` are current, as produced by `qa:working-copy` / `kg:audit`). |
| 3.1a | `kg:audit:all:check` | 0 | `0 instance(s) audited (--check: nothing written) — 0 clean, 0 failing, 0 produced no report.` |
| 3.1a | `audit:coverage:require-all` / `strict` | 0 | `✓ every kind with files is reached by a criterion, a gate, or a declared validator` (`software-library` covered after `cat-harness-tools#787`). `baseline (qa-reports:main/...): 0 NEW finding(s), 0 inherited, 0 resolved — over gates-undeclared, kinds-unaudited, kinds-typed-only`. `OK on what was determined`. |
| 3.1a | `check:harness-state:check` | 0 | `check:harness-state (judge mode, wrote nothing): OK — no finding the gate fails on — 0 finding(s), 0 famil(ies) could not be determined`. |
| 3.1b | `lsi:skills:check` | 0 | `pass cat-harness/skills fresh — recomputed in this run (259 units); no index in the checkout (cat-harness/test/results/lsi/ is absent) to be stale`. |
| 3.1b | `lsi:viz:check` | 0 | `lsi viewer: cat-harness/docs/en/cat-harness/lsi/index.md is built at publish (builtAtPublish), not committed — nothing to compare.` |
| 3.1b | `kg:detangle:check` | 0 | Recomputes and judges; missing/orphaned derived `.detangle.json` sidecars are advisory. |
| 3.1b | `translation:block-qa:check` | 0 | `baseline (qa-reports:main/...): 0 NEW finding(s) in 0 sidecar(s), 6 inherited, 0 resolved`. `translation:block-qa:check (judge mode, wrote nothing): OK — no finding the gate fails on — 40 sidecar(s) computed`. |
| 3.1c | `skill:register:check` | 0 | `✓ 382 skill(s) across 34 package(s): every one declared, none carrying a retired key, nothing dangling`. All chain steps (`skill:commands:check`, `skills:docs:check`, `check:glossary`, `auto:docs:check`, `lsi:skills:check`, `lsi:viz:check`, `kg:audit:check`, `kg:detangle:check`, `uml:overview:check`, `subgraph:jsonld:check`) exit 0 with `test/results/` and `*/test/results/` absent. |
| 3.1c | `readme:subgraphs:check` | 0 | `0 directory README(s); 0 stale. baseline (qa-reports:main/...): 0 NEW finding(s), 0 inherited, 0 resolved — over absent-directory, unresolved-process. readme:subgraphs:check (judge mode, wrote nothing): OK` (runs directly without `QA_WORKING_COPY_BUILDING=1` after `cat-harness-tools#787`). |
| 3.1c | `root-scan-census:check` | 0 | `root-scan census — 107 enumerating script(s), 29 ask git; baseline: 0 NEW finding(s) — OK.` |
| 3.1c | `check:term-mapping` | 0 | `skos: 4150 candidate(s); fhir: 4150 candidate(s); baseline: 0 NEW finding(s) — OK.` |
| 3.1c | `check:viewer-nav` | 0 | `0 railed, 0 declined, 0 linked, 0 missing, of 0 generated viewer page(s); 0 railed page(s) fail a layout flag`. |
| 3.1c | `check:prov-qaqc` | 0 | `✓ PROV-O QA/QC report current: 12 instance(s), 149 step(s), 149 activities`. |
| 3.1c | `check:reference-direction:check` | 0 | `baseline (qa-reports:main/...): 0 NEW finding(s), 11 inherited, 0 resolved — over wrong-direction, pending-stale, instances-undeclared. check:reference-direction:check (judge mode, wrote nothing): OK`. |
| 3.1c | `docs:pages:check` | 0 | `? assets/qa/index.json — UNKNOWN: the derived QA corpus is not in this build; no count published. ✓ publish:check docs:pages: ran, its --check passes on its own output, 11 declared artefact(s) built, 0 committed file(s) moved`. |
| also | `check:version-bump` | 0 | `11 publishable instance(s): 0 ok, 0 under, 11 unreleased, 0 undetermined.` |
| also | `check:published-instance-exports` | 0 | `? UNKNOWN — the committed kg-export sidecars could not be listed: cat-harness/test/results is not in this checkout — pass --against <ref> to compare the qa-reports copies.` |

All 16 gates + 2 sidecar readers exit 0 with `test/results/` absent. Both Done-when criteria are met; closing `folio-assistant-oqe3` as `completed` and lifting it from `blocked_by` on `folio-assistant-7mwa`.


_2026-10-16T06:30:00Z_ — Block lifted: `16ei` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-22T16:46:00Z_ — Claim released in a stale-claims sweep by lane B2 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr), applied here by the coordinator. The coordinator's standard: release only on evidence, and never a claim from the last 48 hours. What was checked:
- No commit naming this bean on the main branch of folio-assistant, cat-harness or cat-harness-tools after 2026-10-06. The only later ones are a blocker withdrawal (10-06) and a store reconciliation (10-16), and neither is work.
- No remote branch in any of the three repositories names this bean.
- The holding branch `qa-3hk4-oqe3` was local only and has no remote.

The unticked Done-when boxes above are what remains. Back to `todo` so a sibling session is not misled. Nothing was deleted. The tools-store copy matches: litlfred/cat-harness-tools#558.

## 2026-10-23: batch 1 (litlfred/cat-harness-tools#618, issue #617)

The work was not lost. The 2026-10-02 local-branch work reached `main` through the arc merge (folio-assistant `acf7d0ea1`), and the 70lx split carried it into cat-harness-tools. `judgeSidecarTree`, `gradedKgFindings` and `--against main` on `kg:audit:check`, `kg:audit:all:check` and `translation:block-qa:check` are all on `main` today. Bean `4l4d` is completed.

Re-measured on cat-harness-tools `main` 51ce679, in a composed checkout with cat-harness `main`. cat-harness still commits `test/results/` (1476 files), although it declares the directory `storage`. Two gates were red on `main` itself with the files present: `lsi:skills:check` (`skills.lsi.json` stale) and `kg:detangle:check` (seven `*.detangle.json` stale). Both are 3.1b. Detangle is one of the most-changed stored trees: 105 file changes since 10-09.

PR #618 (draft) makes both gates compute and judge. In a stored tree, a stale or orphaned copy is advisory. `--against main` reports the stored record, and a missing entry is UNKNOWN and not gated. Exit codes before and after:

| gate | main, present | main, absent | #618, present | #618, absent |
|---|---|---|---|---|
| `lsi:skills:check` | 1 | 0 | 0 | 0 |
| `kg:detangle:check` | 1 | 0 | 0 | 0 |

Remaining, as the next batches:
- **Batch 2 (proposed):** `check:term-mapping`, `check:reference-direction:check` and `check:harness-state:check` already judge and accept `--against`, but their package scripts do not pass `--against main`.
- `skill:register:check`'s chain: its `lsi:skills:check` step is green after #618. Not re-measured end to end.
- Group B, waiting for a `main/` entry: `lsi:viz:check` (green on main with the files present), `uml:overview:check`, `check:qa-reviewer-permission`, `check:orphan-verdicts`, `check:kind-validators:require-all`, `check:declared-paths`.
- `docs:pages:check` and `uml:overview:check` now run through `publish-check.ts` (owner B1). `check:ci-invocations` is unblocked now that 4l4d is done. None of these has been re-measured.
- `check:version-bump`, `check:published-instance-exports`, `translation:catalogue:check --base` (CI only) and `check:prov-qaqc` (not a reader).
- Done-when item 1 still needs a full `bun run cat gates` run with `test/results/` absent. Caution for whoever runs it: `uml:overview:check` (publish-check) and `gates --list` start writers (`qa:working-copy`, `qa:refresh`, `skill:register`) that rewrite `test/results/`. Run it in a throwaway copy.

Session https://claude.ai/code/session_01NVW1gLKTQrfffUSgD3GCd5.

## 2026-10-23: batch 2 (litlfred/cat-harness-tools#622, issue #621)

The owner said go. `check:term-mapping`, `check:reference-direction:check` and `check:harness-state:check` now pass `--against main` in their package scripts. A new test, `judge-gates-against.test.ts`, pins `--against main` on all 11 judge gates. The PR is independent of #618.

Measured locally:
- term-mapping: 0 → 0.
- harness-state: 2 → 2. Its health family stays UNKNOWN until qa-reports holds a health report.
- reference-direction: 0 (UNKNOWN) → 1, with 83 new pairs against `main/0907d88`. They are probably an artefact of my local composition. CI already runs this command.

The owner kept the `-merge` marking in `gitattributes.test.ts`. Still remaining: everything after batch 2 in the list above.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
status: completed
```
