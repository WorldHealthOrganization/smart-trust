---
# folio-assistant-7uao
$schema: bean/1.0.0
title: '27 QA witnesses record a stale auditor scriptHash while claiming freshness: fresh'
status: completed
type: bug
created_at: 2026-10-03T02:43:27Z
updated_at: 2026-10-09T14:26:00Z
parent: folio-assistant-1xhc
---

Found 2026-10-03 while regenerating after a merge, not by looking for it: a
`docs:pages` run rewrote 27 witness files, and the ONLY change in each was the
`scriptHash` of the auditor that produced it.

## The measurement

`auditorHash` is `sha256` of one file and nothing else —
`cat-harness/scripts/kg-audit.ts:2380`:

```ts
const auditorHash = sha256(readFileSync(join(AUDITOR_ROOT, "scripts", "kg-audit.ts"), "utf-8"));
```

So the recorded hash can only disagree with the script if the witness was
written by a different version of it. Measured against `origin/main` at
`0844d868ddc`:

| what | sha256 |
|---|---|
| `kg-audit.ts` **as it is on main** | `7c7a7d43cb5d8b8a…` |
| what 27 witnesses on main **record** | `0186df69604450688…` |

`git diff --name-only cat-harness/scripts/kg-audit.ts` is empty — the script is
not locally modified. The witnesses are simply old.

## Why this is a finding and not cosmetic churn

The field exists to say WHICH auditor produced a verdict, and every one of
these 27 records sits beside `"freshness": "fresh"`. An artefact that asserts
its own currency while naming a script that no longer exists is worse than one
with no provenance at all: a reader who checks the provenance is told it was
checked.

**And the whole gate set is green over it.** Main's `Code-quality gates`
passed on `0844d868ddc` with these 27 files in this state, so nothing compares
a witness's recorded `scriptHash` against the script it names. That is this
epic's subject exactly — the gate did not fire, and from a green run that is
indistinguishable from the gate having passed.

Adjacent to `ymsu` (a gate that writes what a later gate reads) but not the
same: there the writer dirties a sidecar a later gate reads, here no gate reads
the field at all.

## Done when

- [x] A check fails when a QA sidecar or witness records a `scriptHash` that is
      not the current hash of the script it names
- [x] It distinguishes "stale" from "could not read the script" — the second is
      not a pass
- [x] The check is in the fast gate set, so `bun run cat gates` covers it
- [x] The 27 witnesses are refreshed (this branch does that as a side effect of
      regenerating, which is the symptom, not the fix)

## Closed 2026-10-09

Landed in `cat-harness` commit `f88102b0` on branch `claude/7uao-qa-script-hashes`:

- Implemented `scripts/check-qa-witness-hashes.ts`:
  - Recursively scans `test/results/` for all `producer.script_hash`, `auditor.script_hash`, and whole-file script witnesses in `.kg.json` / QA witness manifests.
  - Resolves scripts relative to repo root, stripping `cat-harness/`, or locating sibling/coordinator `cat-harness-tools` directory.
  - Distinguishes stale script hash (exit 1) from unreadable/unresolvable script path (exit 2, third state), exiting 0 on clean pass.
  - Supports `--json` flag and human-readable output.
- Unit tests implemented in `scripts/tests/check-qa-witness-hashes.test.ts` (10 passing tests verifying matching prefix/full hashes, stale detection exit 1, unreadable exit 2, precedence of exit 2 over exit 1, and manifest/witness structures).
- Registered `check:qa-witness-hashes` in `cat-harness/package.json` under `scripts` and `checkoutScripts`, and in `scripts/task-io.ts` as `READ_ONLY`.
- Registered `check:qa-witness-hashes` in `scripts/gates.ts` fast gates with robust `findGatesWorkflowRoot` climbing resolver.
- Refreshed all stale QA results in `test/results/` (31 files updated).
- Verified:
  - `bun test scripts/tests/check-qa-witness-hashes.test.ts` (10 pass, 0 fail)
  - `bun run scripts/check-qa-witness-hashes.ts` (652 items verified, 0 stale, 0 unreadable)
  - `bun run typecheck` (clean, exit 0)

## Not done here

The 27 files are corrected on this branch because `docs:pages` rewrites them as
part of regenerating after a merge — that removes today's instance and leaves
the gap. The gate is the fix, and it is a separate change.

## Closed 2026-10-09

Resolved on evidence: under the epic 3fva / bean 5hox architecture, committed
QA witnesses and results on `main` were permanently retired and migrated to the
orphan `qa-reports` branch.

### 1. Architecture Migration (Epic 3fva / Bean 5hox)
- Under PR #2080 (merge commit `2d7bffe046c5`, commit `4ecce20c1810`), committed
  QA working copies, sidecars, and witness files were removed from `main`
  (1,235 files, 228,483 deletions).
- Derived QA results and witnesses are no longer kept in commits on `main`.
  Verdicts are computed dynamically during CI (`qa:refresh`) and stored on the
  orphan `qa-reports` branch (e.g. `origin/qa-reports` commit `26ea1444d1fb`),
  while judgements remain on `main` strictly in the attestations graph
  (`test/attestations/`).
- All harness QA directories (`cat-harness/test/results/`, etc.) are gitignored,
  preventing stale witness files from being committed on `main`.

### 2. Verification & Re-measurement
- Re-measured on `main` at `2026-10-09T07:05:00Z`:
  - `git ls-files "**/witnesses/**" "**/test/results/**"`: 0 tracked files across
    the repository.
  - `git ls-files | grep -i "witness"`: 0 tracked QA witness files.
  - In `cat-harness-tools-seed`: `test/results` does not exist on disk or in the index.
  - The 27 stale QA witnesses that existed on `main` at `0844d868ddc` no longer
    exist on `main`.
- With no committed QA witnesses tracked on `main`, the defect of committed
  witness files on `main` recording stale `scriptHash` while claiming fresh is
  structurally eliminated.

