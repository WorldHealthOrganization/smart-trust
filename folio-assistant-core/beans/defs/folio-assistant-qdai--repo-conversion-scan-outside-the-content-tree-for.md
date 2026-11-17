---
# folio-assistant-qdai
$schema: bean/1.0.0
title: 'repo-conversion: scan OUTSIDE the content tree for math (docs/, .lean/.py under docs/audits, .tex-only tables and macros)'
status: completed
type: feature
priority: normal
created_at: 2026-10-04T15:52:14Z
updated_at: 2026-10-10T15:45:55Z
parent: folio-assistant-slw1
---

Recorded from the qou orphaned-content census, 2026-10-04 (ORPH report; session https://claude.ai/code/session_01NdDGeP1SyShmoUssLuRZ91, issue #2106). qou: 30 docs/audits/*.lean (several are refutations of paper claims, e.g. skein-mass-relation-is-false), 68 docs/audits/*.py computations and 272 derivation notes live outside folio/ and are linked by no block. A conversion that carries only the content tree drops the evidence that some claims are false. The repo-conversion skill should classify these as candidates, read-only, like the rest of its scan.


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on evidence. The scan
ships in `litlfred/cat-harness-tools`, where the repo-conversion scanner lives
after the separation (checked at `80e46e7`). Nothing was changed in this
repository.

- `scripts/scan-repo-content.ts` (module doc § "Outside-content mathematical
  evidence & refutations (folio-assistant-qdai)"): `scanMathCandidates`
  classifies files outside the content tree as read-only candidates:
  - formal proofs (`.lean/.v/.thy`)
  - computations (`.py/.sage/.ipynb`)
  - derivation notes
  - audit refutations (e.g. `docs/audits/skein-mass-relation-is-false.lean`)
  
  Each candidate carries a link status. `scanRepo` returns them as
  `mathCandidates`, and `formatScan` reports them with an unlinked count.
- `scripts/tests/repo-conversion-math-scan.test.ts` covers the classification
  with unit tests and runs a git-fixture scan.

Not re-run here: the qou census itself (qou is a separate private repo).


## Closed 2026-10-09

Extended the repo-conversion scanner and candidate classifier to scan outside the content tree for mathematical evidence, computation scripts, and refutations:

1. **Scanner Extension (`scripts/scan-repo-content.ts`):**
   - Implemented `classifyMathCandidate` classifying outside-content artifacts into 5 candidate categories:
     - `math_proof`: Formal Lean (`.lean`), Coq (`.v`), Isabelle (`.thy`) proofs outside the content tree.
     - `computation_script`: Numerical and symbolic calculation / verification scripts (`.py`, `.sage`, `.ipynb`, `.jl`, `.m`).
     - `macro_definition`: TeX macro definitions, preamble commands, and standalone tables (`.tex`, `.sty`, `.cls`).
     - `audit_refutation`: Mathematical claim refutations and counterexamples (e.g. `docs/audits/skein-mass-relation-is-false.lean`, `audits/counterexample.py`).
     - `derivation_note`: Mathematical derivation notes and scratchpads (`.md`, `.tex`, `.rst`, `.txt`).
   - Implemented `scanMathCandidates` with content-tree link detection (`linkStatus: "linked" | "unlinked"`) to flag unlinked/orphaned mathematical evidence at risk of being dropped.
   - Updated `scanRepo` to include `mathCandidates` in `ScanResult`, and updated `formatScan` to report candidate counts, classifications, rationales, and unlinked warnings.
   - Preserved strict read-only discipline: the scanner never moves, deletes, or writes any files.

2. **Skill Documentation (`skills/conduct/conduct-core/repo-conversion.md`):**
   - Documented outside-content math scanning discipline, candidate categories, and link status.
   - Documented the danger of dropping refutations showing paper claims are false.
   - Added anti-pattern 8 ("Dropping outside-content math artifacts or unlinked audit refutations").

3. **Verification & Tests (`scripts/tests/repo-conversion-math-scan.test.ts`):**
   - Added 10 unit and integration tests covering:
     - All 5 candidate classifications and rationales.
     - Scanning fixtures with outside `.lean`, `.py`, `.tex` macros, and markdown notes.
     - Content-tree link status (`linked` vs `unlinked`) and `formatScan` warnings.
     - Negative controls: clean content-only repos, repos with non-math outside files, and content-internal math files.
     - Read-only preservation check.
   - Test results: 10 pass, 0 fail (77 assertions).
   - Typecheck: `tsc --noEmit -p tsconfig.json` clean (exit code 0).

4. **Commit & Branch:**
   - Worktree: `/Users/litlfred/space_cats/folio-assistant-backup/.claude/worktrees/cat-harness-qdai`
   - Branch: `claude/qdai-scan-outside-content`
   - Commit: `7184a839121a5e83e10732a404b25853e27950ae`
   - Pushed to `origin/claude/qdai-scan-outside-content`.




## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on evidence. The scan
ships in `litlfred/cat-harness-tools`, where the repo-conversion scanner lives
after the separation (checked at `80e46e7`). Nothing was changed in this
repository.

- `scripts/scan-repo-content.ts` (module doc § "Outside-content mathematical
  evidence & refutations (folio-assistant-qdai)"): `scanMathCandidates`
  classifies files outside the content tree as read-only candidates:
  - formal proofs (`.lean/.v/.thy`)
  - computations (`.py/.sage/.ipynb`)
  - derivation notes
  - audit refutations (e.g. `docs/audits/skein-mass-relation-is-false.lean`)
  
  Each candidate carries a link status. `scanRepo` returns them as
  `mathCandidates`, and `formatScan` reports them with an unlinked count.
- `scripts/tests/repo-conversion-math-scan.test.ts` covers the classification
  with unit tests and runs a git-fixture scan.

Not re-run here: the qou census itself (qou is a separate private repo).
