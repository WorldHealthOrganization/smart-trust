---
# folio-assistant-1l13
$schema: bean/1.0.0
title: witness-pipeline.yml has never run — keep, template, or retire?
status: completed
type: task
priority: normal
created_at: 2026-09-24T06:47:37Z
updated_at: 2026-10-23T08:00:00Z
parent: folio-assistant-1xhc
---

Split from 52dz (2026-09-24). 52dz's owner decisions moved section-title-audit into folio_init templates, but witness-pipeline.yml was not part of that decision and still sits in .github/workflows with ZERO runs all time (measured 2026-09-20), so check:ci-health cannot see it by construction.

## Done when
- [x] measured: does it run against the platform at all, or only a folio's computations? (measured 2026-10-05 below: invokes `python3 folio-assistant/computations/<script>`, which exists only in a folio checkout such as `qou`, never on the platform)
- [x] owner: keep here, move to folio_init templates (paper/), or retire to fsh-guts/ — retire (2026-10-20)


## Measured 2026-10-05 (first checkbox)
It CANNOT run against the platform. Every step invokes `python3 folio-assistant/computations/<script>`, i.e. a folio checkout with the platform symlinked beside it. On platform main, `git ls-tree -r origin/main` holds **0** files under `folio-assistant/computations/` and 0 matches for `hyperbolic_volumes.py` or `codata_masses.py` anywhere. Both scripts exist only in qou, at `computations/`. So its zero runs are not a billing artefact: dispatched here, it would fail at the first script.

Relevant to the owner question: qou now has an executable replacement for the refresh half. litlfred/qou#7514 adds `processes/content/witness-refresh.bpmn` (plan → parity → owner approval → run → gates → commit) and a `witness-refresh-plan` Tool, with the per-producer Tools generated from the block manifests (205). That points toward 'move to folio_init templates or retire', not 'keep here'. This is the agent's reading; the decision is the owner's, and the second checkbox stays open.

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## OWNER, 2026-10-20 (session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6)

Chose **retire to fsh-guts/** ("Retire to fsh-guts (Recommended)"; the question stated it cannot run on the platform and qou's witness-refresh BPMN replaces the refresh half).

## 2026-10-20 — retired (pending merge of litlfred/folio-assistant#2609)

Removed from `.github/workflows/`; kept verbatim on the `fsh-guts` state branch at `retired/workflows/witness-pipeline.yml` with the note `retired/witness-pipeline.md`. Follow-up left open on purpose: `build-clarabel-mpfr.yml` existed only to feed this pipeline — its header now says so; whether its weekly build still earns its keep is a separate call. Three comments in cat-harness-tools still name this workflow as a caller.

## 2026-10-21 — retirement backed out on #2609 (`b6ddbca39f`); needs paired cat-harness-tools change

Commit `b6ddbca39f` in `#2609` restored `.github/workflows/witness-pipeline.yml` before merge because removing it alone causes `cat-harness-tools/scripts/check-workflow-paths.ts` (`FOLIO_PATHS` entries for `trivial-skeleton-audit.ts` and `codemod-leanval.ts`) to fail on 0 matching invocations. Retiring `witness-pipeline.yml` requires removing those two `FOLIO_PATHS` entries in `cat-harness-tools` and re-pinning `cat-harness-tools` in the same PR.

## 2026-10-22 — paired change opened

The tools half is litlfred/cat-harness-tools#546 (head `adcc95f`). It removes the 2 `FOLIO_PATHS` entries and the 3 `gates.ts` step exemptions, and puts 3 comments in the past tense. The index half (delete `.github/workflows/witness-pipeline.yml`, pin tools to `adcc95f`) is handed to lane C, to be cut from a current index in an owner window. The order is the one cat-harness#409 used: the index lands first, then #546 is re-run and merged with a merge commit, then the index is re-pinned to that merge.

## 2026-10-22 — done

Index half: litlfred/folio-assistant#2619 (workflow deleted, tools pinned d753967). Tools half: litlfred/cat-harness-tools#546, merged as `00527df`. It removes the 2 `FOLIO_PATHS` entries and 5 `gates.ts` step exemptions (trivial-skeleton-audit, conditional-class-banner-audit, codemod-leanval, audit-wiring, section-story-audit) that matched only this workflow, and adds corpus budgets for two slow tests. The index re-pin to `00527df` rides lane C's follow-up. Still open, as noted above: `build-clarabel-mpfr.yml`, which only fed this workflow.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It asks whether folio-assistant's `.github/workflows/witness-pipeline.yml` should be kept, templated or retired, and the remaining box is an owner decision about that repository. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository"; the witness-pipeline keep/template/retire decision is still the owner's. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## OWNER, 2026-10-20 (session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6)

Chose **retire to fsh-guts/** ("Retire to fsh-guts (Recommended)"; the question stated it cannot run on the platform and qou's witness-refresh BPMN replaces the refresh half).

## 2026-10-20 — retired (pending merge of litlfred/folio-assistant#2609)

Removed from `.github/workflows/`; kept verbatim on the `fsh-guts` state branch at `retired/workflows/witness-pipeline.yml` with the note `retired/witness-pipeline.md`. Follow-up left open on purpose: `build-clarabel-mpfr.yml` existed only to feed this pipeline — its header now says so; whether its weekly build still earns its keep is a separate call. Three comments in cat-harness-tools still name this workflow as a caller.

## 2026-10-21 — retirement backed out on #2609 (`b6ddbca39f`); needs paired cat-harness-tools change

Commit `b6ddbca39f` in `#2609` restored `.github/workflows/witness-pipeline.yml` before merge because removing it alone causes `cat-harness-tools/scripts/check-workflow-paths.ts` (`FOLIO_PATHS` entries for `trivial-skeleton-audit.ts` and `codemod-leanval.ts`) to fail on 0 matching invocations. Retiring `witness-pipeline.yml` requires removing those two `FOLIO_PATHS` entries in `cat-harness-tools` and re-pinning `cat-harness-tools` in the same PR.

## 2026-10-22 — paired change opened

The tools half is litlfred/cat-harness-tools#546 (head `adcc95f`). It removes the 2 `FOLIO_PATHS` entries and the 3 `gates.ts` step exemptions, and puts 3 comments in the past tense. The index half (delete `.github/workflows/witness-pipeline.yml`, pin tools to `adcc95f`) is handed to lane C, to be cut from a current index in an owner window. The order is the one cat-harness#409 used: the index lands first, then #546 is re-run and merged with a merge commit, then the index is re-pinned to that merge.

## 2026-10-22 — done

Index half: litlfred/folio-assistant#2619 (workflow deleted, tools pinned d753967). Tools half: litlfred/cat-harness-tools#546, merged as `00527df`. It removes the 2 `FOLIO_PATHS` entries and 5 `gates.ts` step exemptions (trivial-skeleton-audit, conditional-class-banner-audit, codemod-leanval, audit-wiring, section-story-audit) that matched only this workflow, and adds corpus budgets for two slow tests. The index re-pin to `00527df` rides lane C's follow-up. Still open, as noted above: `build-clarabel-mpfr.yml`, which only fed this workflow.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It asks whether folio-assistant's `.github/workflows/witness-pipeline.yml` should be kept, templated or retired, and the remaining box is an owner decision about that repository. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository"; the witness-pipeline keep/template/retire decision is still the owner's. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-23T08:00:00Z_ — Follow-up `build-clarabel-mpfr.yml` noted above is also resolved: moved to `folio-assistant-sci` as a reusable workflow in `litlfred/folio-assistant-sci#49` (`31d8cdf761`) and removed from `litlfred/folio-assistant` in `#2625` (`0f8d6d1f67`).


## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## OWNER, 2026-10-20 (session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6)

Chose **retire to fsh-guts/** ("Retire to fsh-guts (Recommended)"; the question stated it cannot run on the platform and qou's witness-refresh BPMN replaces the refresh half).

## 2026-10-20 — retired (pending merge of litlfred/folio-assistant#2609)

Removed from `.github/workflows/`; kept verbatim on the `fsh-guts` state branch at `retired/workflows/witness-pipeline.yml` with the note `retired/witness-pipeline.md`. Follow-up left open on purpose: `build-clarabel-mpfr.yml` existed only to feed this pipeline — its header now says so; whether its weekly build still earns its keep is a separate call. Three comments in cat-harness-tools still name this workflow as a caller.

## 2026-10-21 — retirement backed out on #2609 (`b6ddbca39f`); needs paired cat-harness-tools change

Commit `b6ddbca39f` in `#2609` restored `.github/workflows/witness-pipeline.yml` before merge because removing it alone causes `cat-harness-tools/scripts/check-workflow-paths.ts` (`FOLIO_PATHS` entries for `trivial-skeleton-audit.ts` and `codemod-leanval.ts`) to fail on 0 matching invocations. Retiring `witness-pipeline.yml` requires removing those two `FOLIO_PATHS` entries in `cat-harness-tools` and re-pinning `cat-harness-tools` in the same PR.

## 2026-10-22 — paired change opened

The tools half is litlfred/cat-harness-tools#546 (head `adcc95f`). It removes the 2 `FOLIO_PATHS` entries and the 3 `gates.ts` step exemptions, and puts 3 comments in the past tense. The index half (delete `.github/workflows/witness-pipeline.yml`, pin tools to `adcc95f`) is handed to lane C, to be cut from a current index in an owner window. The order is the one cat-harness#409 used: the index lands first, then #546 is re-run and merged with a merge commit, then the index is re-pinned to that merge.

## 2026-10-22 — done

Index half: litlfred/folio-assistant#2619 (workflow deleted, tools pinned d753967). Tools half: litlfred/cat-harness-tools#546, merged as `00527df`. It removes the 2 `FOLIO_PATHS` entries and 5 `gates.ts` step exemptions (trivial-skeleton-audit, conditional-class-banner-audit, codemod-leanval, audit-wiring, section-story-audit) that matched only this workflow, and adds corpus budgets for two slow tests. The index re-pin to `00527df` rides lane C's follow-up. Still open, as noted above: `build-clarabel-mpfr.yml`, which only fed this workflow.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It asks whether folio-assistant's `.github/workflows/witness-pipeline.yml` should be kept, templated or retired, and the remaining box is an owner decision about that repository. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository"; the witness-pipeline keep/template/retire decision is still the owner's. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-23T08:00:00Z_ — Follow-up `build-clarabel-mpfr.yml` noted above is also resolved: moved to `folio-assistant-sci` as a reusable workflow in `litlfred/folio-assistant-sci#49` (`31d8cdf761`) and removed from `litlfred/folio-assistant` in `#2625` (`0f8d6d1f67`).
