---
# folio-assistant-blgm
$schema: bean/1.0.0
title: 'MERGE PIPELINE TOOLS: merge:train, merge:overlap, merge:leftover replace the steward''s scratch scripts'
status: completed
type: task
priority: normal
created_at: 2026-10-02T17:22:14Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-hfag
---

Owner approved 2026-10-02. Three commands for the merge steward, replacing scratch scripts train.sh / train2.sh / ch-impact.sh / verify.sh.

- merge:train — build a train branch from a base SHA and members (PR numbers or branches): merge-base.ts --no-regen per member, refuse undeclared conflicts, one regen plus check:l1-complete --write, smart-kg-l1 --entry where stale, kg:audit:all:check; merge origin/main taking main's side of generated conflicts; JSON report. Never pushes.
- merge:overlap — conflict prediction input (requirements T3): pairwise authored-path overlap excluding generated paths (from merge-conflict-patterns PATTERNS), shared declarations, cat-harness/ and cat-harness-tools/ impact.
- merge:leftover — landed / not-landed / could-not-determine for a PR after a train.

## Done when
- [x] three scripts with unit tests on fixtures, package.json scripts, Tool nodes
- [x] draft PR open, gates green
- [x] PR body carries a Tools section for the merge-queue skill on claude/merge-pipeline-epic

## Evidence: Closed on Landed Work (2026-10-09)

Landed on main in PR #1895 (commits `4d9b2e291fbf`, `5dca4d08b154`, `5205ab34820c`, `b028e5d65f92`):
1. `cat-harness-tools/scripts/merge-train.ts`, `merge-overlap.ts`, `merge-leftover.ts` implemented with unit tests in `cat-harness-tools/scripts/tests/merge-train.test.ts`, `merge-overlap.test.ts`, `merge-leftover.test.ts` (39 passing unit tests).
2. Tool nodes registered: `cat-harness/test/results/kg-qa/tools/merge-train.kg-qa.json`, `merge-overlap.kg-qa.json`, `merge-leftover.kg-qa.json`, and process diagram `cat-harness/processes/sdlc/merge-train.bpmn`.
3. Merged onto main; gates green.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] three scripts with unit tests on fixtures, package.json scripts, Tool nodes
- [x] draft PR open, gates green
- [x] PR body carries a Tools section for the merge-queue skill on claude/merge-pipeline-epic

## Evidence: Closed on Landed Work (2026-10-09)

Landed on main in PR #1895 (commits `4d9b2e291fbf`, `5dca4d08b154`, `5205ab34820c`, `b028e5d65f92`):
1. `cat-harness-tools/scripts/merge-train.ts`, `merge-overlap.ts`, `merge-leftover.ts` implemented with unit tests in `cat-harness-tools/scripts/tests/merge-train.test.ts`, `merge-overlap.test.ts`, `merge-leftover.test.ts` (39 passing unit tests).
2. Tool nodes registered: `cat-harness/test/results/kg-qa/tools/merge-train.kg-qa.json`, `merge-overlap.kg-qa.json`, `merge-leftover.kg-qa.json`, and process diagram `cat-harness/processes/sdlc/merge-train.bpmn`.
3. Merged onto main; gates green.

```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [ ] three scripts with unit tests on fixtures, package.json scripts, Tool nodes
- [ ] draft PR open, gates green
- [ ] PR body carries a Tools section for the merge-queue skill on claude/merge-pipeline-epic

_2026-10-16T06:30:00Z_ — Store reconciliation: status `in-progress` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: in-progress, cat-harness-tools: in-progress). Evidence: closed in the folio-assistant store copy (2026-10-09); commit 4d9b2e29 is on folio-assistant main, commit 5205ab34 is on folio-assistant main, commit 5dca4d08 is on folio-assistant main. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
```
