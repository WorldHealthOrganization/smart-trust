---
# folio-assistant-1swy
$schema: bean/1.0.0
title: 'QA: verdicts, sidecars and the audited review record'
status: completed
type: epic
priority: normal
created_at: 2026-09-19T11:43:44Z
updated_at: 2026-10-29T09:36:22Z
parent: folio-assistant-rwmf
---

Where a verdict lives, what shape it has, and who is allowed to change it.

`2634` is the placement rule (provenance decides: a QA reviewer's output lives
under `test/results/`), `9gyz` is the shape (Finding, Decision and AuditNote are
three entities), and `cflw`/`nytj` are the two ways concurrent work corrupts the
record — 218 sidecars rewritten by one edit, and two PRs green alone but red
together because a sidecar records its auditor's hash.

`iumj` is the same failure reaching CI: an e2e fixture that reads the LIVE
corpus turns red when somebody adjudicates a finding, which punishes the review
it exists to support. `nba0` and `lfxa` are gaps in coverage; `sopq` is where
the DAK criteria come from.

_2026-10-29T09:36:22Z_ — Completed: all 45 child beans are closed (45 completed: 32 live, 13 archived), including `2634`, `9gyz`, `cflw`, `nytj`, `iumj`, `nba0`, `lfxa` and `sopq` named above, and the epic holds no scope of its own beyond them. `check:bean-rollup` flagged it as a container with no open children (folio-assistant main, after #2698). Session: https://claude.ai/code/session_01NVW1gLKTQrfffUSgD3GCd5
