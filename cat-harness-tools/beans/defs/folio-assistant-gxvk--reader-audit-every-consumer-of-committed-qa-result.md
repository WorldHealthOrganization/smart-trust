---
# folio-assistant-gxvk
$schema: bean/1.0.0
title: 'READER AUDIT: every consumer of committed QA results, classified by how it must change when QA leaves main — with one fix bean per reader family'
status: completed
type: task
priority: high
created_at: 2026-10-01T08:15:59Z
updated_at: 2026-10-06T06:09:22Z
parent: folio-assistant-3fva
---

Owner request, 2026-10-01: "do an audit report/analysis on readers and queue up fix them." Arc `3fva`.

Scope: every code path, workflow step, MCP tool, skill and test that READS a file under any `*/test/results/**` or `test/health/results/**`. Writers are in scope only where they also read the prior file.

The output is a report, `cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`, plus one fix bean per reader family, each under `3fva` and blocked by `16ei` (qa-store). The fix beans refine and split `oqe3` and `2ae2`; they do not duplicate them.

Held by branch claude/quirky-davinci-ixuymr, session https://claude.ai/code/session_01LKpuPotV3Ve5Za75DQ3AQR.

## Done when
- [x] every reader is listed with file:line, what it reads, why, and the class it falls in (A gate-compare, B gate-reads-sidecar, C render/publish, D MCP/runtime, E test fixture, F agent/skill instruction, G merge tooling)
- [x] each one has a migration action and its failure mode if the file is absent today: crash, false-clean, or correct unknown
- [x] every false-clean reader is flagged critical
- [x] fix beans are created, and oqe3/2ae2 point at them



## Summary of Changes
Report: `cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md`. It records **95 read sites**: A 20, B 23, C 13, D 6, E 13, F 13, G 7. The counting rule is in its §3.

Method: 26 gates and 21 test files were run twice, once with the files present and once with all 15 QA results directories moved aside. Afterwards everything was restored and `git status` was clean.

**20 rows are false-clean or silent loss, from 11 defects (C1–C11).** All are flagged CRITICAL. Three are live on `main` today:
- C1: three committed `kg-qa` sidecars contain git conflict markers (from `48aab0bd`).
- C2: `check-published-instance-exports` never compares the sidecar.
- C3: `health-check.yml` uploads from the wrong path, and has 0 artifacts.

Fix beans, all under `3fva`. The first eight are blocked by `16ei`:
- `folio-assistant-2gst`: F1, kg-audit carried state and the kg-qa D2 split (critical)
- `folio-assistant-id4s`: F2a, the `qa-results.ts` core and the export comparisons
- `folio-assistant-0dav`: F2b, the self-sidecar gates; audit-coverage false-empty
- `folio-assistant-oq1j`: F3, detangle, LSI and tool runs
- `folio-assistant-8wj1`: F4, block and translation read-modify-write and the D2 split (critical)
- `folio-assistant-c8uq`: F5, corpus walkers that pass empty
- `folio-assistant-tfqf`: F6, docs site, staging and preview publishing
- `folio-assistant-cxcn`: F7, tests that read the committed corpus

Not blocked, because the defect is live today:
- `folio-assistant-de9k`: F8a, conflict markers (critical bug)
- `folio-assistant-r7v6`: F8b, the health artifact, the dead export comparison, `qa-agent-write`'s legacy path, gates that write in check (bug)

Pointers were appended to `oqe3`, `2ae2`, `d6bw` and `7mwa`. `5hox` is now blocked by `2gst` and `8wj1`: the QA files are mixed, so deleting them before the D2 split loses attestations silently.

Two corrections to earlier beans:
- `check:prov-qaqc` (`oqe3`) is not a reader.
- `lsi_query`, `degradation.ts` and the `tools/index.ts` lsi entry (`2ae2`) are not readers.

D2 undercounts: besides the 13 block/translation agent entries, 32 `kg-qa` files carry `pair_attestations` (6 agent, 26 baseline).

## Closed 2026-10-06 on re-measured evidence

Closed by the 3fva QA-readers pass (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze). Every done-when box is ticked; the boxes that waited on a merge or a scheduled run were re-checked against GitHub on 2026-10-06 and carry their evidence inline. Closed on evidence, not authorship (bean-coordination §"Closing a bean whose work has already landed").
