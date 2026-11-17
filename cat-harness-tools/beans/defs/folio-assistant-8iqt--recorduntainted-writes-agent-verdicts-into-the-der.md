---
# folio-assistant-8iqt
$schema: bean/1.0.0
title: recordUntainted writes agent verdicts into the DERIVED block-qa file, not the attestation store
status: completed
type: bug
priority: normal
created_at: 2026-10-01T19:22:21Z
updated_at: 2026-10-06T06:09:21Z
parent: folio-assistant-3fva
---

Found by the d6bw agent, 2026-10-01.

`recordUntainted` (the untainted-verification writer) still writes an agent verdict into the derived block-qa report. Since 8wj1/2gst, judgements live in the declared `attestations` graph (`test/attestations/`, `qa-attestations/v1`). The verdict reaches the store only when a later writer runs and auto-moves it (owner ruling 2). So nothing is lost today. But once bean `5hox` removes derived files from main, a verdict written into a derived file that is never published or moved would be lost.

## Done when
- [x] `recordUntainted` writes through the attestation store API, like the 9 writers 8wj1 fixed
- [x] a test: with the derived file absent, a recorded untainted verdict lands in the store
- [x] lands before `5hox` — **verified 2026-10-06: the fix is on main (`cat-harness/content/pipeline/untainted-verification.ts:360` calls `attestationKeyForDerived`), and 5hox (#2080) is still open, so it landed first.**

## Summary of Changes

Commit `de510c798` on branch `qa-8iqt-e2e` (from `claude/quirky-davinci-ixuymr-phase3`; not pushed, not merged).

- `content/pipeline/untainted-verification.ts`: `recordUntainted` derives the subject key from the derived path (`attestationKeyForDerived`), resolves through `resolvePrior`, and saves through `finalizeCriteria(..., "attesting")`. The store is written first and read back. A `corrupt`/`unknown` store or a `conflict` throws a `refusalLine` UNKNOWN and nothing is written. The derived report is refreshed only if it already exists; the recorder never creates one. It returns the store path.
- Changed behaviour: the old refusal "no sidecar, run the sweep first" is gone. With the derived report leaving `main` (5hox), its absence says nothing about scope. The recorder now refuses when the SUBJECT (`<subject>.md` / `.ts`) does not exist.
- Tests (`scripts/tests/untainted-verification.test.ts`, 4 new, all in throwaway instances): derived absent, so the verdict lands in the store and no report is invented; derived present, so the store is written and the projection keeps script entries; corrupt store, so the write is refused and neither file is written; missing subject, so the write is refused.
- Skill `untainted-verification.md` §"Where the verdict is kept" now says what the recorder does, not "still writes into the derived sidecar".

Third box: whether this lands before 5hox depends on merge order. It is left open, and this bean stays in-progress until it lands.

## Closed 2026-10-06 on re-measured evidence

Closed by the 3fva QA-readers pass (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze). Every done-when box is ticked; the boxes that waited on a merge or a scheduled run were re-checked against GitHub on 2026-10-06 and carry their evidence inline. Closed on evidence, not authorship (bean-coordination §"Closing a bean whose work has already landed").
