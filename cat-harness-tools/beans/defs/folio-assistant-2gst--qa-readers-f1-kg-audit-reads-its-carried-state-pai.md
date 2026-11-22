---
# folio-assistant-2gst
$schema: bean/1.0.0
title: 'QA READERS F1: kg-audit reads its carried state (pair attestations, voice reviews, test runs) from qa-store — two false-cleans, and the kg-qa D2 split'
status: completed
type: task
priority: critical
created_at: 2026-10-01T08:47:12Z
updated_at: 2026-10-23T13:35:00Z
parent: folio-assistant-3fva
---

Arc `3fva`, from reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`, §5.1 family F1). Refines `oqe3` 3.1a. Blocked on the qa-store bean `16ei`.

**Holds two of the audit's CRITICAL rows.** It must land before `5hox`: deleting the kg-qa tree before this lands destroys the attestations without a word.

## Readers
- `cat-harness/scripts/kg-audit.ts:2751`: `--check` staleness over every `kg-qa/**` (A). Absent today: loud, 488 stale.
- `kg-audit.ts:2620-2623`: `kg-qa.manifest.json`, own or hosted (A). Absent today: loud.
- `cat-harness/scripts/kg-audit-all.ts`: R01 run per instance, 17 instances (A). Absent today: loud.
- **C4** `kg-audit.ts:2721` → `cat-harness/scripts/prose-code-pairs.ts:147-149,173-181` (`evaluatePairs`, `readAttestations`): `pair_attestations` (B). **Absent today: FALSE-CLEAN + LOSS.** `prose-reviewed-since-code-changed` goes 13 → 0 under `--check`; the write path re-baselines and drops the 6 agent attestations. Measured.
- `kg-audit.ts:2738` → `cat-harness/scripts/skill-voice-review.ts:131-139` (`readVoiceReviews`): `voice_reviews` (B). None are committed today. It has the same `[]`-on-missing shape.
- **C5** `kg-audit.ts:1716` → `cat-harness/scripts/test-run-conformance.ts:77`: `crdm-detect-eval.test-run.json` (B). **Absent today: FALSE n/a.** Three criteria go from `pass` to `n/a` through `entry(findings, any=false)` (`kg-audit.ts:286-289`).
- `kg-audit.ts:2671,2780` `sweepOrphans` / `relocateSidecars` (`schemas/kg-qa.ts:272`) (B). Absent today: quiet, 0 orphans.
- `cat-harness/scripts/eval-crdm-detect.ts:141,171`: the prior test run (B, a writer that reads its prior). Absent today: handled.

## Migration action
1. **D2 split.** Move `pair_attestations` (32 entries in 32 files: 6 `by: agent`, 26 `by: baseline`) and any `voice_reviews` out of the mixed `kg-qa/v1` files into `test/attestations/`, which stays on main. The owner has not ruled whether the 26 baselines count as attestations. The audit recommends that they do, because a regenerated baseline forgets the drift it recorded.
2. `readAttestations`, `readVoiceReviews` and the test-run read go through `qa-store`. A miss or a corrupt read is `unknown`. It is never a re-baseline and never `n/a`.
3. `--check` becomes compute-and-judge with `--against qa-reports:main/<merge-base>`. The manifest and the orphan sweep are judged against the fetched tree.

## Done when
- [x] the attestations live in `test/attestations/`, and `kg:audit` on a tree with no `test/results/` still reports the `prose-reviewed-since-code-changed` findings it reports today. Measured: 12 with the results present and 12 with them absent. Main reports 12 today; the audit's 13 was at an earlier commit.
- [x] with `test/results/` absent and no fetch, the test-run criteria read `unknown`, not `n/a` — **done 2026-10-06: `checkTestRuns` returns `looked: false` for an absent directory and `kg-audit` `testRunCriteria` records all three criteria as `unknown` with the remedy (`qa:refresh` / `qa:fetch`); an existing-but-empty directory stays a determined `n/a`. Tests: `cat-harness/scripts/tests/test-run-conformance.test.ts`.**
- [x] `kg:audit:check` and `kg:audit:all:check` pass on `main` with `test/results/` absent from the checkout — **`bun run cat kg:audit:all:check --against main` exits 0; `litlfred/cat-harness-tools#575` (merged `e83679b` / `2026-10-23T09:57:50Z`) wired `testRunCriteria` / `checkTestRuns` to read `*.test-run.json` from `qa-store` (`readQaTree`) when `test/results/` is absent and `--against` is set (returning `unknown` on store miss/corrupt/unknown), so `kg:audit:check --against main` exits 0 with `test/results/` absent too.**
- [x] a seeded new finding fails a PR, and an inherited one is reported but does not fail — **done (`cat-harness-tools/scripts/qa-tree-judge.ts` + `cat-harness-tools/scripts/tests/qa-tree-judge.test.ts`, 16 pass, 0 fail).**


## Owner ruling 2026-10-01 — the 26 baseline pair attestations count as JUDGEMENTS
Asked with three options, recommended first. The owner chose "count as judgements". The 26 `baseline` pair attestations stay on main beside the 6 agent ones, under D2 (a). The kg-qa split therefore keeps all 32 `pair_attestations` files' attestation halves on main. Live-defect fixes `de9k` and `r7v6` start after `gurh` reports, so the two agents don't rewrite the same kg-qa files.


## Store layout and schema: one convention for every QA family (sibling `8wj1`, match this)
- **Directory:** a declared `attestations` directory at `<instance>/test/attestations/`. It is a new graph kind, `attestations`, with `holds: "state"` and `recordsWork: false`, and validator `schemas/qa-attestations.ts#QaAttestationsSchema`. It is declared in `cat-harness.json` and `folio-assistant-sci.json`.
- **Path:** `<attestations dir>/<family>/<mirrored subject path>/<stem>.attestations.json`. `<family>` is the derived family the file sits beside: `kg-qa`, `block-qa` or `translation-qa`. The mirror below it is EXACTLY that family's own derived-tree mirror, so the path is the sidecar path with the tree root and the suffix swapped. Use `attestationPathFor(sidecarAbs, derivedTree, attHome, family, derivedSuffix)`. A hosted instance uses `<host attestations dir>/<stub>/…` (`attestationsHomeFor`, which mirrors `kgQaHomeFor`).
- **Envelope `qa-attestations/v1`:** `{ $schema, family, subject: {kind, id, path}, …family arrays }`, strict. kg-qa adds `pair_attestations` (each pins `prose_hash` and `code_hash`) and `voice_reviews` (each pins `skill_hash` and `voice_hash`). `8wj1`: add your family's member to the `QaAttestationsSchema` discriminated union and keep the envelope.
- **Reads:** `readAttestationFile(path, storeRoot)` returns `hit`, `miss`, `corrupt` or `unknown`. `unknown` means the declared store directory is absent. Only `miss` is "never attested". A hit returns the RAW object, so a writer keeps each entry's key order (zod would reorder it).

## Summary of Changes (2026-10-01, worktree branch `worktree-agent-adcc44d2465a8b308`, NOT pushed)
- `6762bfc6`: `schemas/qa-attestations.ts` (schema, paths, four-state read) plus its tests, and the `attestations` graph kind and its avatar.
- `104959d8`: readers and writers.
  - `kg-audit` reads and writes judgements through the store. It accepts `--init-attestations`. A relocated sidecar takes its attestation file with it. Attestation orphans are reported, never deleted, and they fail `--check`.
  - `readAttestations` and `readVoiceReviews` return the four states, never `[]` for a corrupt file (de9k). `evaluatePairsFrom` and `evaluateVoiceReviewsFrom` turn corrupt or unknown into an `unknown` criterion and write nothing back.
  - `pairs:attest` and `voice:review` write to the store and refuse a corrupt file.
  - `qa-graph-integrity` sweeps the `attestations` directories too.
- `003e07fb`: the migration (`scripts/migrate-kg-attestations.ts`, one-shot and idempotent: verify, then strip). It moved **32 pair attestations from 32 sidecars: 26 baseline and 6 agent** (18 in cat-harness, 14 in folio-assistant-sci). There were 0 voice reviews. The before and after fingerprints (kind, prose and code, plus the compact JSON of each entry) are identical, and a second run moves 0.
  - `KgQaReportSchema` now refuses a sidecar that carries a judgement.
  - `migrate-kg-attestations.test.ts` round-trips the real store, and it checks 32 / 26 / 6 against `5d64d4d8` when history is present.
- `27d45f8a` and `5d0af32d`: kg-audit declares `@covers attestations`. The kg-qa refusal uses `z.never` so the schema still converts to JSON Schema. The `layout-norms` baseline gains `cat-harness: test contains test/attestations`, which is the owner-ruled path and the same nesting as `test/results`. Then the regen, which reached a fixed point. The final commit on this branch adds the `directory-conventions` table row, the partition rule, the state-visualizer list and this bean.
- Measured: with `cat-harness/test/results/` moved aside, `kg:audit:check` still reports **12** `prose-reviewed-since-code-changed` findings, the same as with the results present. Main reports 12 today; the audit's 13 was at an earlier commit. Before this change the same run gave 0 (C4).

## Done-when status (the rest)
- [x] the test-run criteria read `unknown`, not `n/a` (C5, `test-run-conformance.ts`): done 2026-10-06, see above
- [x] `kg:audit:check` / `kg:audit:all:check` pass with `test/results/` absent: `kg:audit:all:check --against main` exits 0; `litlfred/cat-harness-tools#575` (`e83679b`) wires `testRunCriteria` / `checkTestRuns` to read `*.test-run.json` from `qa-store` (`readQaTree`) when `test/results/` is absent and `--against` is set.
- [x] a seeded new finding fails a PR and an inherited one does not: done (`qa-tree-judge.ts` + `qa-tree-judge.test.ts`).

## Owner ruling 2 (2026-10-01, binding) — auto-move on first save, every family
A folio with no store yet does NOT refuse and wait for a manual migration: a writer that finds judgements in a prior derived file and no store entry moves them into the store as it saves. Applies to kg-qa too. Nothing is ever silently dropped; a corrupt store is still UNKNOWN and refused. (Ruling 1 the same day: 2gst's declared design is the one design, and `8wj1` adapts to it. Ruling 3: the store stays at `<instance>/test/attestations/`.)

## Summary of Changes — ruling 2 and the 8wj1 merge (2026-10-01, `claude/quirky-davinci-ixuymr`, NOT pushed)
What changed in this bean's path:
- `readAttestationFile` answers `absent` when the store directory is not there (it answered `unknown`, which made `kg-audit` refuse and wait for `--init-attestations`). A store path that is not a directory is still `unknown`.
- `readAttestations` (pairs) and `readVoiceReviews` take the PRIOR sidecar. On `miss`/`absent` they return the judgements it still carries (read raw by `priorKgJudgements`, since `KgQaReportSchema` refuses them), so `evaluatePairsFrom` neither re-baselines nor drops them: C4's drift is still a finding. A prior sidecar that does not parse is `unknown`. On a `hit` the sidecar is never read.
- `kg-audit` now writes the store BEFORE the sidecars; a moved entry the evaluation did not carry (a pair no longer declared) is kept verbatim; a subject whose prior sidecar cannot be parsed while the store has no entry is UNKNOWN, and neither file is written (writer exit 4, `--check` exit 1). `--init-attestations` is kept but no longer needed. `recordReview` seeds a new store file from the prior sidecar.
- `migrate-kg-attestations.ts` is now `migrate-qa-attestations.ts`, covering block-qa and translation-qa as well; `qa:attestations:migrate:check` gates it in CI.
- **Measured end to end on the real corpus:** with `cat-harness/test/attestations/` moved aside and the 18 cat-harness judgements put back into their sidecars, one `kg:audit` run printed "moved 18 judgement(s)", recreated the 18 store files byte-identical (`diff -r` clean), and left every sidecar byte-identical to the committed (clean) one. Restored afterwards.
- **Counts:** 32 files, 32 entries (26 baseline + 6 agent), unchanged; `migrate-qa-attestations.test.ts` also checks that the readers return all 32 verbatim from prior sidecars with no store.
- Commits: `b18799fb` (code and tests), `9f858484` (declaration and conventions text), `604ef031` (regen).

_2026-10-16T06:30:00Z_ — Block lifted: `16ei` is completed in every store. Owner ruling 2026-10-16 (item 1): lift the stale blocks on claimed beans whose blocker is closed; the claim itself is untouched. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
