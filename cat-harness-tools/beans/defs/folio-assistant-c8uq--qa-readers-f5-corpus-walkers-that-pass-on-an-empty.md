---
# folio-assistant-c8uq
$schema: bean/1.0.0
title: 'QA READERS F5: corpus walkers that pass on an empty corpus (orphan-verdict sweep, validate orphan check, reviewer permission)'
status: completed
type: task
priority: high
created_at: 2026-10-01T08:47:14Z
updated_at: 2026-10-06T06:09:22Z
parent: folio-assistant-3fva
blocked_by:
    - folio-assistant-16ei
---

Arc `3fva`, from reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`, family F5). Blocked on `16ei`. **CRITICAL: two silent passes.**

These gates walk the QA corpus and judge what they find. Once the corpus is gone, they find nothing and call it clean.

## Readers
- **C6** `cat-harness/content/pipeline/orphan-verdict-sweep.ts:76,98` (`check:orphan-verdicts`, CI `code-quality-gates.yml:1853`) (B). **Absent today: FALSE-CLEAN.** It prints `✓ no orphaned block verdicts` and exits 0. Measured.
- **C7** `cat-harness/content/pipeline/validate.ts:297-305` (`content_validate`) (B/D). **Absent today: FALSE-CLEAN by design.** "An ABSENT mirror directory is a determined zero."
- `cat-harness/scripts/check-qa-reviewer-permission.ts:65,132,206` (CI `:1694`) (B). Absent today, it exits 1 only through the stale-baseline rule. It prints "stale baseline entry, remove it" five times, and obeying that makes the next run pass over **0 entries**. HIGH.
- `cat-harness/scripts/check-declared-paths.ts:514-557` + `cat-harness/scripts/declared-path-baseline.json:46,49,57,116,128` (B). Loud: 6 literals stop resolving.

## Migration action
- Each walker reads through `qa-store`, and refuses when it examined zero subjects (`scripts/vacuity-refusal.ts`, bean `iym1`).
- The orphan checks judge the fetched tree against the content tree. Without a fetch they report `unknown`.
- `check-qa-reviewer-permission` also reads `test/attestations/`. Agent and human entries are what it exists to judge.
- Rebaseline the declared-path literals as they move into `qa-store`.

## Done when
- [x] with `test/results/` absent and no fetch, `check:orphan-verdicts`, `content_validate`'s orphan check and `check:qa-reviewer-permission` each exit non-zero, or report `unknown` by name; none of them prints a pass
- [x] with the branch fetched, each gives today's answer

## Summary of Changes

Branch `qa-readers-f5-f6-c8uq-tfqf` (commit `1d82ae83`), not pushed.

| reader | before (corpus absent) | after |
|---|---|---|
| `check:orphan-verdicts` | `✓ no orphaned block verdicts`, exit 0 | `vacuityRefusal`: "examined 0 members", names `qa:fetch`, exit 2 |
| `content_validate` no-orphan-sidecar | determined zero "by design" | warning `could not determine orphans … run qa:fetch` once per call; a present tree with no mirror is still a determined zero |
| `check:qa-reviewer-permission` | 5x "stale baseline entry, remove it", exit 1 (obeying → pass over 0) | reads derived results + declared `attestations`; absent derived tree → exit 2, no baseline entry judged stale; `--write-baseline` refuses; `forbidden` still exit 1 |
| `check:declared-paths` | "6 witnessed literals no longer resolve", exit 1 | 7 witnesses under absent `qa`/`health` dirs listed as `?`, not lost, not new debt; exit 2; `--update` refuses |

Verified by moving all 15 results directories aside and restoring them: every gate exits 2 and none prints a pass. With the corpus present each gives today's answer (122 verdicts examined, 0 orphans; 5974 entries, 0 forbidden; 0 lost witnesses). The fetched `qa-reports` entry `pr/1764/a4c54517…` is byte-identical to the committed corpus (diff -rq over all 14 trees), so "with the branch fetched" is the same answer.

## Closed 2026-10-06 on re-measured evidence

Closed by the 3fva QA-readers pass (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze). Every done-when box is ticked; the boxes that waited on a merge or a scheduled run were re-checked against GitHub on 2026-10-06 and carry their evidence inline. Closed on evidence, not authorship (bean-coordination §"Closing a bean whose work has already landed").
