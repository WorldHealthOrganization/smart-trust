---
# folio-assistant-0dav
$schema: bean/1.0.0
title: 'QA READERS F2b: the eleven self-sidecar gates compute and judge; audit-coverage stops reporting a moved kind as empty'
status: completed
type: task
priority: high
created_at: 2026-10-01T08:47:13Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-3fva
---

Arc `3fva`, from reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`, family F2b). Refines `oqe3` 3.1c and part of 3.1a. As of 2026-10-06 this is not blocked on `16ei`: it completed (qa-store landed; CI publishes `main/` and `pr/` entries and the prune runs on schedule), so the block is withdrawn. Its write-in-check fixes to `skill-register.ts` and `check-harness-state.ts` come from the live-defects bean, which must land first.

## Readers
Every one of these compares its OWN committed sidecar with a fresh run:
- `cat-harness/scripts/audit-coverage.ts:538`: `audit-coverage.qa-results.json` (A). Loud when absent.
- **C8** `audit-coverage.ts:301` `census`: the `qa` and `health` directories (B). **Absent today: FALSE-EMPTY.** The `qa` row goes from `covered`, 278 files, to `empty`, 0, and so does `health`. Masked only because the same run fails on its absent self-sidecar.
- `cat-harness/scripts/root-scan-census.ts:246-249` (A). Loud: exit 0 → 1.
- `cat-harness/scripts/check-reference-direction.ts:936-939` (A). Loud.
- `cat-harness/scripts/check-term-mapping.ts:424` (A). Loud.
- `cat-harness/scripts/subgraph-readmes.ts:155-160` (A). Loud. The absent run also counted 14 `test/results/` directories as absent.
- `cat-harness/scripts/check-viewer-nav.ts:75,161-189` (A). Loud on a missing sidecar; a stale one exits 0.
- `cat-harness/scripts/check-l1-complete.ts:1288-1300` (`--check`, `library-qa/**`) (A). Loud.
- `cat-harness/scripts/skill-register.ts:665` and its verify chain (A). Loud. It writes in check.
- `folio-assistant-core/scripts/glossary-page.ts:595` (`check:glossary`, `term-mapping.qa-results.json`) (A/C). Loud.
- `cat-harness/scripts/check-harness-state.ts:151-161` (the health report) (B). Correct unknown: exit 2. It writes in check.

## Migration action
- Compute and judge. "Stale" stops existing. `--against qa-reports:main/<merge-base>` reports new findings separately from inherited ones. A missing baseline is `unknown`.
- `audit-coverage` honours `ContentDirectory.storage`: a kind stored on the branch is census-ed from the fetch, or reported `unknown`. It is never `empty`.

## Done when
- [x] every gate above passes on `main` with `test/results/` and `test/health/results/` absent from the checkout
- [x] with no fetch, `audit:coverage` reports `qa` and `health` as `unknown`, not `empty`
- [x] a seeded new finding fails a PR, and an inherited one does not


## Summary of Changes (2026-10-01, branch `qa-readers-f2-id4s-0dav`, not pushed)

`judgeQaResult` (in `qa-results.ts`) is the shared compute-and-judge rule:
- `failOn` families fail outright. Against a branch baseline, only NEW ones fail.
- `failOnNew` families fail only when NEW against a baseline. The baseline is the committed working copy before the move and `--against <ref>` after.
- A missing baseline is reported UNKNOWN and is never gated (proposal §2.3). Stale is advisory only.

Changes by gate (behaviour with results absent: before → after):
- `audit:coverage` (19d18bda): exit 1 on the absent self-sidecar → judged. **C8:** a declared directory that is neither stored nor present is now `uncounted`, and the `qa` and `health` rows read `unknown` instead of `empty, 0`.
- `root-scan-census:check` and `check:reference-direction:check` (521ab243): exit 1 → each fails only on a NEW exposed scan / unlisted multi-destination file / unqualified PENDING entry / undeclared instance. Reference-direction was already red on this branch's head; it now names the files.
- `check:term-mapping` and `check:glossary` (ba589a2b): exit 1 and six stale pages → the glossary computes the mapping with check-term-mapping's own `run`/`perScheme`. Pages are byte-identical in both states.
- `readme:subgraphs:check` (c9996538): judges its sidecar, and a `qa`/`health` directory may leave main. `absent-directory` findings go from 15 to 0.
- `check:viewer-nav` (7189cc4d): regresses against a baseline. A missing baseline used to exit 1; it is now UNKNOWN, and the regression half is explicitly not claimed.
- `check:l1-complete --check` (1d99b8e4): exit 1 → the committed verdicts are advisory. The UNMET exit is unchanged.
- `check:harness-state:check` (57f2877e): exit 2 → the health report is a stored record. It is read via `readQaTree` with `--against`, otherwise `Family.stored` reports UNKNOWN.
- `skill:register`: its own sidecar is unchanged (r7v6 already stopped the write in check).

### Done when
- [x] every gate above passes on `main` with `test/results/` and `test/health/results/` absent: **13 of 15 runs pass.** The two left:
  - `readme:subgraphs:check`: `cat-harness/test/README.md` lists `results/` and `health/` with file counts. This is a docs README of the tree, and it goes stable once 5hox untracks and gitignores the results and regenerates it.
  - `skill:register:check`: its verify chain is red on `lsi:*`, `kg:detangle` (oq1j), `kg:audit` (F1) and `uml:overview`. Those are other families.
- [x] with no fetch, `audit:coverage` reports `qa` and `health` as `unknown`, not `empty`
- [x] a seeded new finding fails a PR, and an inherited one does not (`tests/qa-baseline.test.ts`, against the working copy and against a real `qa-reports` remote)

## Re-triage 2026-10-10 (lane B drain)

The compute-and-judge work is on main: `judgeQaResult` is used by audit-coverage, root-scan-census, check-reference-direction, check-term-mapping and subgraph-readmes in cat-harness-tools/scripts, and `scripts/tests/qa-baseline.test.ts` covers it. The one open done-when (every gate green with the results directories absent) now waits on:

- **skill:register:check**: its verify chain is red on kg:detangle/LSI (`oq1j`, in progress) and kg:audit (`2gst`, in progress). Both are now set as blockers.
- **readme:subgraphs:check**: with `cat-harness/test/results`, `cat-harness/test/health/results` and `folio-assistant-core/test/results` moved aside, it exits 2 (UNKNOWN) before it reaches its own check. The cause is `bun run cat qa:refresh`: folio-assistant's root `"cat"` script still points at `cat-harness/scripts/run-script.ts`, which now lives at `cat-harness-tools/scripts/run-script.ts`. That fix belongs to the folio-assistant root, and I have passed it on.

Re-run done-when #1 once oq1j and 2gst close.

_2026-10-15T16:49Z_ — Block lifted: `16ei` is completed (qa-store landed via #1764, closed 2026-10-06 on re-measured evidence). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-16T07:00:00Z_ — Store reconciliation (owner ruling 2026-10-16, item 9: "based on semantic content"): the 2026-10-10 re-triage, which was only in the cat-harness-tools copy, is copied in, with its blockers `oq1j` and `2gst` (both still in progress; `skill:register:check` is red on them). All three copies now agree. Session https://claude.ai/code/session_01K9Xi9QSxCNYju8QNu7EuHg.

_2026-10-21T19:15:00Z_ — Completed: all 11 self-sidecar gates pass on `main` (`3d586f5794`) with `*/test/results` and `*/test/health/results` absent from the checkout (`audit:coverage`, `root-scan-census:check --against main`, `check:reference-direction:check --against main`, `check:term-mapping --against main`, `readme:subgraphs:check --against main`, `check:viewer-nav --against main`, `check:l1-complete --check`, `skill:register:check` and its full verify chain, `check:glossary --against main`, `check:harness-state:check --against main`). Blockers `oq1j` (completed) and `2gst` (`skill:register:check` verify chain green) lifted.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Re-measured 2026-10-20 — status `todo` is correct; the section above is a work log, not a close

Checked against origin/main, prompted by the coordinator's sweep for "todo
with a Summary of Changes". The 2026-10-01 summary records branch work; the
2026-10-10 re-triage confirmed it is on main (`judgeQaResult` is used by
`audit-coverage.ts`, `root-scan-census.ts`, `check-reference-direction.ts`,
`check-term-mapping.ts` and others). Done-when #1 is still open and still
blocked: `oq1j` and `2gst` are both `in-progress`. The folio-assistant root's
`cat` script now points at `cat-harness-tools/scripts/run-script.ts`, so the
`qa:refresh` cause named in the re-triage is gone. Re-run done-when #1 once
the two blockers close.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).


## Re-triage 2026-10-10 (lane B drain)

The compute-and-judge work is on main: `judgeQaResult` is used by audit-coverage, root-scan-census, check-reference-direction, check-term-mapping and subgraph-readmes in cat-harness-tools/scripts, and `scripts/tests/qa-baseline.test.ts` covers it. The one open done-when (every gate green with the results directories absent) now waits on:

- **skill:register:check**: its verify chain is red on kg:detangle/LSI (`oq1j`, in progress) and kg:audit (`2gst`, in progress). Both are now set as blockers.
- **readme:subgraphs:check**: with `cat-harness/test/results`, `cat-harness/test/health/results` and `folio-assistant-core/test/results` moved aside, it exits 2 (UNKNOWN) before it reaches its own check. The cause is `bun run cat qa:refresh`: folio-assistant's root `"cat"` script still points at `cat-harness/scripts/run-script.ts`, which now lives at `cat-harness-tools/scripts/run-script.ts`. That fix belongs to the folio-assistant root, and I have passed it on.

Re-run done-when #1 once oq1j and 2gst close.

_2026-10-15T16:49Z_ — Block lifted: `16ei` is completed (qa-store landed via #1764, closed 2026-10-06 on re-measured evidence). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-16T07:00:00Z_ — Store reconciliation (owner ruling 2026-10-16, item 9: "based on semantic content"): the 2026-10-10 re-triage, which was only in the cat-harness-tools copy, is copied in, with its blockers `oq1j` and `2gst` (both still in progress; `skill:register:check` is red on them). All three copies now agree. Session https://claude.ai/code/session_01K9Xi9QSxCNYju8QNu7EuHg.

_2026-10-21T19:15:00Z_ — Completed: all 11 self-sidecar gates pass on `main` (`3d586f5794`) with `*/test/results` and `*/test/health/results` absent from the checkout (`audit:coverage`, `root-scan-census:check --against main`, `check:reference-direction:check --against main`, `check:term-mapping --against main`, `readme:subgraphs:check --against main`, `check:viewer-nav --against main`, `check:l1-complete --check`, `skill:register:check` and its full verify chain, `check:glossary --against main`, `check:harness-state:check --against main`). Blockers `oq1j` (completed) and `2gst` (`skill:register:check` verify chain green) lifted.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Re-measured 2026-10-20 — status `todo` is correct; the section above is a work log, not a close

Checked against origin/main, prompted by the coordinator's sweep for "todo
with a Summary of Changes". The 2026-10-01 summary records branch work; the
2026-10-10 re-triage confirmed it is on main (`judgeQaResult` is used by
`audit-coverage.ts`, `root-scan-census.ts`, `check-reference-direction.ts`,
`check-term-mapping.ts` and others). Done-when #1 is still open and still
blocked: `oq1j` and `2gst` are both `in-progress`. The folio-assistant root's
`cat` script now points at `cat-harness-tools/scripts/run-script.ts`, so the
`qa:refresh` cause named in the re-triage is gone. Re-run done-when #1 once
the two blockers close.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).


## Re-triage 2026-10-10 (lane B drain)

The compute-and-judge work is on main: `judgeQaResult` is used by audit-coverage, root-scan-census, check-reference-direction, check-term-mapping and subgraph-readmes in cat-harness-tools/scripts, and `scripts/tests/qa-baseline.test.ts` covers it. The one open done-when (every gate green with the results directories absent) now waits on:

- **skill:register:check**: its verify chain is red on kg:detangle/LSI (`oq1j`, in progress) and kg:audit (`2gst`, in progress). Both are now set as blockers.
- **readme:subgraphs:check**: with `cat-harness/test/results`, `cat-harness/test/health/results` and `folio-assistant-core/test/results` moved aside, it exits 2 (UNKNOWN) before it reaches its own check. The cause is `bun run cat qa:refresh`: folio-assistant's root `"cat"` script still points at `cat-harness/scripts/run-script.ts`, which now lives at `cat-harness-tools/scripts/run-script.ts`. That fix belongs to the folio-assistant root, and I have passed it on.

Re-run done-when #1 once oq1j and 2gst close.

_2026-10-15T16:49Z_ — Block lifted: `16ei` is completed (qa-store landed via #1764, closed 2026-10-06 on re-measured evidence). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-16T07:00:00Z_ — Store reconciliation (owner ruling 2026-10-16, item 9: "based on semantic content"): the 2026-10-10 re-triage, which was only in the cat-harness-tools copy, is copied in, with its blockers `oq1j` and `2gst` (both still in progress; `skill:register:check` is red on them). All three copies now agree. Session https://claude.ai/code/session_01K9Xi9QSxCNYju8QNu7EuHg.

_2026-10-21T19:15:00Z_ — Completed: all 11 self-sidecar gates pass on `main` (`3d586f5794`) with `*/test/results` and `*/test/health/results` absent from the checkout (`audit:coverage`, `root-scan-census:check --against main`, `check:reference-direction:check --against main`, `check:term-mapping --against main`, `readme:subgraphs:check --against main`, `check:viewer-nav --against main`, `check:l1-complete --check`, `skill:register:check` and its full verify chain, `check:glossary --against main`, `check:harness-state:check --against main`). Blockers `oq1j` (completed) and `2gst` (`skill:register:check` verify chain green) lifted.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Re-measured 2026-10-20 — status `todo` is correct; the section above is a work log, not a close

Checked against origin/main, prompted by the coordinator's sweep for "todo
with a Summary of Changes". The 2026-10-01 summary records branch work; the
2026-10-10 re-triage confirmed it is on main (`judgeQaResult` is used by
`audit-coverage.ts`, `root-scan-census.ts`, `check-reference-direction.ts`,
`check-term-mapping.ts` and others). Done-when #1 is still open and still
blocked: `oq1j` and `2gst` are both `in-progress`. The folio-assistant root's
`cat` script now points at `cat-harness-tools/scripts/run-script.ts`, so the
`qa:refresh` cause named in the re-triage is gone. Re-run done-when #1 once
the two blockers close.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).
