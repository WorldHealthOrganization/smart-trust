---
# folio-assistant-5hox
$schema: bean/1.0.0
title: REMOVE moved QA files from main — only on the owner's explicit go, after the branch holds a hash-verified copy
status: completed
type: task
priority: normal
created_at: 2026-10-01T08:00:47Z
updated_at: 2026-10-16T10:30:00Z
parent: folio-assistant-3fva
---

Arc `3fva`, proposal §4 item 3.7 and decision D4. **Never on an agent's own initiative** (`deletion-requires-confirmation`).

Preconditions:
- every reader is migrated;
- the gates have been green on the branch for 7 days (D4 default);
- the `qa-reports:main/<head>` tree is byte-identical to main's `test/results` for every moved path, checked by blob hash;
- attestations stay in place (D2 default).

Report before asking: file count, bytes, and the age of the oldest file. Then wait.

## Done when
- [ ] the owner has said go, quoted here
- [ ] `git rm` is done, `.gitignore` is set, and the gates are green


## Owner ruling 2026-10-01 — D4 "Right away"
Asked as D4 with four options. The owner chose **right away** over the recommended 7-day soak. This is the explicit go: remove the moved files as soon as every reader is migrated (`oqe3`, `2ae2`, `7mwa`) and `qa-reports:main/<head>` is hash-identical for every moved path. Attestations stay (D2 (a)). The 7-day precondition above is void.



## Added by the reader audit (`gxvk`, 2026-10-01)
**Do not `git rm` before `folio-assistant-2gst` (F1) and `folio-assistant-8wj1` (F4) land.** The QA files are MIXED: 12 block/translation files hold 13 agent verdicts, and 32 `kg-qa` files hold `pair_attestations` (6 agent, 26 baseline), each beside script verdicts. Their readers re-baseline or drop those entries silently when the file is absent (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md` C4 and C11). Both are added as blockers here.


_2026-10-01_ — Also wait for the recordUntainted store fix (filed under 3fva by the parent session) before removing derived files.

## Prepared on local branch qa-5hox, 2026-10-02 (NOT pushed)

Inventory (derived from the declarations via resolveQaLocation, the same roots qa:publish uses): **1,186 files, 8,520,910 bytes** under the twelve declared qa directories (cat-harness 1,012 / 8.23 MB; folio-assistant-sci 81; fhir-harness 33; smart-base 20; folio-assistant-core 15; who-style-guide 6; who-iris 4; smart-dak, -ig, -immunizations, -l1, -trust 3 each). Oldest file by last change: 6 days (2026-09-26); oldest at its current path: 13 days (2026-09-19). Excluded: test/attestations/ (48 files, D2 (a)), test/health/results/ (2 files; qa:publish does not carry it, so it cannot be hash-verified). Full table: cat-harness/docs/proposals/5hox-removal-inventory.md.

Hash verification: bun run cat qa:verify-moved --key <entry> (exit 0 identical, 1 differs, 2 unknown, 3 usage; a fetch miss is UNKNOWN). Dry run against pr/1801/51e40d7c4: IDENTICAL, 1,186 of 1,186. main/<head>: UNKNOWN, no main/ entry exists until the arc PR merges. The D4 hash precondition is therefore NOT yet met.

Wiring (files present): storage declared on all twelve qa dirs; working copies ignored (directory-storage.test.ts keeps that equal to the declarations); five judge scripts take --against main in package.json. bun run cat gates green apart from the CI-only translation:catalogue:check --base.

Deletion is its own final commit. bun run cat gates with files absent: 16 of 205 red. Groups: (A) stale-compare gates not migrated, bean oqe3: kg:audit:check, kg:audit:all:check, translation:block-qa:check, skill:register:check x2; (B) UNKNOWN for want of a main/ entry: lsi:viz:check, uml:overview:check, check:qa-reviewer-permission, check:orphan-verdicts, check:kind-validators:require-all, check:declared-paths; (C) committed docs pages embed QA badges: docs:pages:check, check:ci-invocations; (E) noise: translation:catalogue:check.

Blocker beyond the gates: after removal, qa-publish has no producer for the working copy (a fresh CI checkout holds nothing under test/results), so main/<sha> entries after the removal would hold one file.

The owner's go: only the D4 ruling quoted above. The first Done-when box is not ticked here.

## Completed on landed evidence
Landed on main in PR #2080 (Derived QA results off main — CI and gates consume working copy).

_2026-10-16T10:30:00Z_ — Dead blocks removed: `blocked_by: 2gst, 7mwa, 8wj1, oqe3`, since this bean is already closed. Recorded on the `fsh-guts` state branch (`retired/bean-blocks-2026-10-16.md`) (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).
