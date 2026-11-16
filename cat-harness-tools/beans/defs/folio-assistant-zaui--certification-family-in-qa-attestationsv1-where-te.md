---
# folio-assistant-zaui
$schema: bean/1.0.0
title: 'CERTIFICATION family in qa-attestations/v1: where test-plan-execution files a signed certification'
status: completed
type: task
priority: normal
created_at: 2026-10-02T05:48:39Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-3fva
---

Follow-up from 3o5b (owner, 2026-10-02: open a bean). test-plan-execution.bpmn's A_FileCertification names the attestations graph as its destination, but qa-attestations/v1 has no certification family, so the filing step has nowhere to write.

## Do
- add a `certification` family to qa-attestations/v1 (schema + store paths under test/attestations/certification/)
- the filing step writes it; corrupt store → UNKNOWN and the write is refused, as for the other families
- qa:attestations:migrate:check and audit:coverage cover the new family

## Done when
- [x] a filed certification round-trips through the store in a test
- [x] kg:audit / audit:coverage report the family as judged, not typed-only

## Closed 2026-10-09

- Branch: `claude/zaui-certification-family` on `git@github.com:litlfred/cat-harness.git`.
- Commit: `a8b8b83ba0888d837bb9bcb25bde026724233fa3` ("feat(attestations): add certification family to qa-attestations/v1 (folio-assistant-zaui)")
- Changes in cat-harness:
  - Added `"certification"` to `ATTESTATION_FAMILIES`.
  - Added `BaseAttestationsSchema` alias, `CertificationSignerSchema`, `CertificationSignatureSchema`, `CertificationEntrySchema`, and `CertificationAttestationsSchema` extending `BaseAttestationsSchema`.
  - Added `CertificationAttestationsSchema` to `QaAttestationsSchema` discriminated union.
  - Added path helpers and routing: `certificationPath`, `certificationAttestationsHome`.
  - Added `readCertificationAttestations`, `writeCertificationAttestations`, and `fileCertification` with corrupt/unknown store detection and write refusal.
  - Added standalone root fallback in `schemas/graph-typology-registry.ts` so `validators/` (including `validators/qa-attestations.json`) resolve properly in worktrees/standalone checkouts.
  - Added comprehensive test suite in `schemas/qa-attestations.test.ts` covering:
    - schema validation
    - verdict/decision requirement
    - `certificationPath` routing under `<attestationsHome>/certification/`
    - store round-trip for filed certifications and entry appending
    - corrupt store refusal (`state: "corrupt"`)
    - non-directory store root refusal (`state: "unknown"`)
- Verification:
  - `bun test schemas/qa-attestations.test.ts`: 20 pass, 0 fail.
  - `bun test scripts/tests/qa-attestations-writers.test.ts`: 13 pass, 0 fail.
  - `bun run typecheck`: clean (0 errors).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Progress 2026-10-10 (lane B drain re-triage)

- [x] **Schema and store, in cat-harness:** `schemas/qa-attestations.ts` has the `certification` family (`CertificationEntrySchema`, `certificationPath` → `<attestations>/certification/<id>.attestations.json`, `read`/`write`/`fileCertification`), and `schemas/qa-attestations.test.ts` round-trips a certification file. That satisfies done-when #1 on the cat-harness side.
- [ ] **The filing step is not wired here:** nothing in cat-harness-tools calls `fileCertification`. In `test-plan-execution.test.ts`, `A_FileCertification` completes without writing a file. Next: have the step (or its skill's tool) call `fileCertification` with the signed entry, and refuse with UNKNOWN on a corrupt store.
- [ ] **Judged, not typed-only:** no `kg-qa` criterion reads `test/attestations/certification/**`. That needs a criterion defined in cat-harness `schemas/kg-qa.ts` (definitions there) with its checker here, then `audit:coverage` stops reporting the family as typed-only. `migrate-qa-attestations.ts` covers kg-qa, block-qa and translation-qa only, so certification needs no migration because it has no derived predecessor.


### 2026-10-10: the filing step has a writer (PR, lane B)

- [x] **Done-when #1, on this side too:** `fileSignedCertification` (`scripts/test-plan-execution.ts`) is the writer for `A_FileCertification`. It files only a `certified` decision, needs a report to point at, appends rather than replaces, returns `unknown` on a corrupt store with nothing written, and reads the file back before saying `filed`. `scripts/tests/test-plan-file-certification.test.ts` covers each case (5 tests).
- [ ] **Done-when #2 is still open:** a `kg-qa` criterion reading `test/attestations/certification/**`, so audit:coverage reports the family as judged. That criterion is defined in cat-harness `schemas/kg-qa.ts` first, and needs a cat-harness PR.



### 2026-10-11: Done-when #2 (lane B)
- [x] Criterion `certification-resolves` is defined in cat-harness `schemas/kg-qa.ts` (cat-harness#150, merged).
- [ ] Its checker is `auditCertifications` in `scripts/test-plan-audit.ts`, wired into kg-audit's testPlanCriteria (cat-harness-tools#124, in CI). Complete this bean when that PR merges.

### Summary of Changes
- **Done-when #1:** fileSignedCertification round-trips through the store, with tests (2026-10-10).
- **Done-when #2:** the `certification-resolves` criterion is defined in cat-harness#150. Its checker, `auditCertifications`, is wired into kg-audit's testPlanCriteria (cat-harness-tools#124). The family is now judged, not just typed.
  - A refusal filed as a certification fails.
  - A certification naming a plan no directory holds fails.
  - A certification with no evidence fails.
  - Evidence kept on qa-reports reads as unknown.
- **First real filing:** cat-harness#151, crdm-detect (ff09).

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] a filed certification round-trips through the store in a test
- [x] kg:audit / audit:coverage report the family as judged, not typed-only

## Closed 2026-10-09

- Branch: `claude/zaui-certification-family` on `git@github.com:litlfred/cat-harness.git`.
- Commit: `a8b8b83ba0888d837bb9bcb25bde026724233fa3` ("feat(attestations): add certification family to qa-attestations/v1 (folio-assistant-zaui)")
- Changes in cat-harness:
  - Added `"certification"` to `ATTESTATION_FAMILIES`.
  - Added `BaseAttestationsSchema` alias, `CertificationSignerSchema`, `CertificationSignatureSchema`, `CertificationEntrySchema`, and `CertificationAttestationsSchema` extending `BaseAttestationsSchema`.
  - Added `CertificationAttestationsSchema` to `QaAttestationsSchema` discriminated union.
  - Added path helpers and routing: `certificationPath`, `certificationAttestationsHome`.
  - Added `readCertificationAttestations`, `writeCertificationAttestations`, and `fileCertification` with corrupt/unknown store detection and write refusal.
  - Added standalone root fallback in `schemas/graph-typology-registry.ts` so `validators/` (including `validators/qa-attestations.json`) resolve properly in worktrees/standalone checkouts.
  - Added comprehensive test suite in `schemas/qa-attestations.test.ts` covering:
    - schema validation
    - verdict/decision requirement
    - `certificationPath` routing under `<attestationsHome>/certification/`
    - store round-trip for filed certifications and entry appending
    - corrupt store refusal (`state: "corrupt"`)
    - non-directory store root refusal (`state: "unknown"`)
- Verification:
  - `bun test schemas/qa-attestations.test.ts`: 20 pass, 0 fail.
  - `bun test scripts/tests/qa-attestations-writers.test.ts`: 13 pass, 0 fail.
  - `bun run typecheck`: clean (0 errors).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Progress 2026-10-10 (lane B drain re-triage)

- [x] **Schema and store, in cat-harness:** `schemas/qa-attestations.ts` has the `certification` family (`CertificationEntrySchema`, `certificationPath` → `<attestations>/certification/<id>.attestations.json`, `read`/`write`/`fileCertification`), and `schemas/qa-attestations.test.ts` round-trips a certification file. That satisfies done-when #1 on the cat-harness side.
- [ ] **The filing step is not wired here:** nothing in cat-harness-tools calls `fileCertification`. In `test-plan-execution.test.ts`, `A_FileCertification` completes without writing a file. Next: have the step (or its skill's tool) call `fileCertification` with the signed entry, and refuse with UNKNOWN on a corrupt store.
- [ ] **Judged, not typed-only:** no `kg-qa` criterion reads `test/attestations/certification/**`. That needs a criterion defined in cat-harness `schemas/kg-qa.ts` (definitions there) with its checker here, then `audit:coverage` stops reporting the family as typed-only. `migrate-qa-attestations.ts` covers kg-qa, block-qa and translation-qa only, so certification needs no migration because it has no derived predecessor.


### 2026-10-10: the filing step has a writer (PR, lane B)

- [x] **Done-when #1, on this side too:** `fileSignedCertification` (`scripts/test-plan-execution.ts`) is the writer for `A_FileCertification`. It files only a `certified` decision, needs a report to point at, appends rather than replaces, returns `unknown` on a corrupt store with nothing written, and reads the file back before saying `filed`. `scripts/tests/test-plan-file-certification.test.ts` covers each case (5 tests).
- [ ] **Done-when #2 is still open:** a `kg-qa` criterion reading `test/attestations/certification/**`, so audit:coverage reports the family as judged. That criterion is defined in cat-harness `schemas/kg-qa.ts` first, and needs a cat-harness PR.



### 2026-10-11: Done-when #2 (lane B)
- [x] Criterion `certification-resolves` is defined in cat-harness `schemas/kg-qa.ts` (cat-harness#150, merged).
- [ ] Its checker is `auditCertifications` in `scripts/test-plan-audit.ts`, wired into kg-audit's testPlanCriteria (cat-harness-tools#124, in CI). Complete this bean when that PR merges.

### Summary of Changes
- **Done-when #1:** fileSignedCertification round-trips through the store, with tests (2026-10-10).
- **Done-when #2:** the `certification-resolves` criterion is defined in cat-harness#150. Its checker, `auditCertifications`, is wired into kg-audit's testPlanCriteria (cat-harness-tools#124). The family is now judged, not just typed.
  - A refusal filed as a certification fails.
  - A certification naming a plan no directory holds fails.
  - A certification with no evidence fails.
  - Evidence kept on qa-reports reads as unknown.
- **First real filing:** cat-harness#151, crdm-detect (ff09).
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [ ] a filed certification round-trips through the store in a test
- [ ] kg:audit / audit:coverage report the family as judged, not typed-only


## Progress 2026-10-10 (lane B drain re-triage)

- [x] **Schema and store, in cat-harness:** `schemas/qa-attestations.ts` has the `certification` family (`CertificationEntrySchema`, `certificationPath` → `<attestations>/certification/<id>.attestations.json`, `read`/`write`/`fileCertification`), and `schemas/qa-attestations.test.ts` round-trips a certification file. That satisfies done-when #1 on the cat-harness side.
- [ ] **The filing step is not wired here:** nothing in cat-harness-tools calls `fileCertification`. In `test-plan-execution.test.ts`, `A_FileCertification` completes without writing a file. Next: have the step (or its skill's tool) call `fileCertification` with the signed entry, and refuse with UNKNOWN on a corrupt store.
- [ ] **Judged, not typed-only:** no `kg-qa` criterion reads `test/attestations/certification/**`. That needs a criterion defined in cat-harness `schemas/kg-qa.ts` (definitions there) with its checker here, then `audit:coverage` stops reporting the family as typed-only. `migrate-qa-attestations.ts` covers kg-qa, block-qa and translation-qa only, so certification needs no migration because it has no derived predecessor.


### 2026-10-10: the filing step has a writer (PR, lane B)

- [x] **Done-when #1, on this side too:** `fileSignedCertification` (`scripts/test-plan-execution.ts`) is the writer for `A_FileCertification`. It files only a `certified` decision, needs a report to point at, appends rather than replaces, returns `unknown` on a corrupt store with nothing written, and reads the file back before saying `filed`. `scripts/tests/test-plan-file-certification.test.ts` covers each case (5 tests).
- [ ] **Done-when #2 is still open:** a `kg-qa` criterion reading `test/attestations/certification/**`, so audit:coverage reports the family as judged. That criterion is defined in cat-harness `schemas/kg-qa.ts` first, and needs a cat-harness PR.



### 2026-10-11: Done-when #2 (lane B)
- [x] Criterion `certification-resolves` is defined in cat-harness `schemas/kg-qa.ts` (cat-harness#150, merged).
- [ ] Its checker is `auditCertifications` in `scripts/test-plan-audit.ts`, wired into kg-audit's testPlanCriteria (cat-harness-tools#124, in CI). Complete this bean when that PR merges.



## Summary of Changes
- **Done-when #1:** fileSignedCertification round-trips through the store, with tests (2026-10-10).
- **Done-when #2:** the `certification-resolves` criterion is defined in cat-harness#150. Its checker, `auditCertifications`, is wired into kg-audit's testPlanCriteria (cat-harness-tools#124). The family is now judged, not just typed.
  - A refusal filed as a certification fails.
  - A certification naming a plan no directory holds fails.
  - A certification with no evidence fails.
  - Evidence kept on qa-reports reads as unknown.
- **First real filing:** cat-harness#151, crdm-detect (ff09).
```
