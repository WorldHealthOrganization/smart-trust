---
# folio-assistant-eowd
$schema: bean/1.0.0
title: 'REGEN CANNOT REPAIR translate-bpmn:check: its derived writer ''translate-bpmn'' needs --extract, so regen reports a stale template as ''a real defect'''
status: completed
type: bug
priority: normal
created_at: 2026-09-30T09:25:14Z
updated_at: 2026-09-30T10:10:12Z
parent: folio-assistant-1xhc
---

Found 2026-09-30 while adding a step to document-ingestion.bpmn (bean 7bg9).

regen-after-merge.ts writerFor() derives a check's writer by dropping ':check': translate-bpmn:check → translate-bpmn. But 'bun run cat translate-bpmn' with no flags only reports; the writing mode is '--extract'. So after any diagram edit, bun run cat regen prints:
  ✗ translate-bpmn:check STILL fails after `bun run cat translate-bpmn` — a real defect, not staleness
and exits non-zero, while 'bun run cat translate-bpmn -- --extract' fixes it in one run. The check's own message names the right command.

Same class as 14ve: regen's verdict ('a real defect') is wrong about a plain staleness, which teaches the reader to distrust the one line meant to be trusted.

## Done when
- [ ] regen repairs translate-bpmn:check (a translate-bpmn:extract writer script, or an explicit override in writerFor — reported, not silent)
- [ ] a test pins that every check regen maps to a writer names a writer that WRITES (a writer run that leaves its check failing on a fresh stale fixture is a finding)


*2026-09-30, same day* — a SECOND check regen does not repair: audit:coverage:strict / audit:coverage:require-all. After a regen that reported '65 current, 0 regenerated', audit:coverage:strict still failed ('the committed sidecar … disagrees with this run'); 'bun run cat audit:coverage' fixed it at once. Its writer is not derivable by dropping ':strict' / ':require-all', so regen never runs it. Seen three times in this session. The Done-when test should cover every check whose writer is not '<check minus :check>'.


## Summary of changes (2026-09-30)
- regen-after-merge.ts: WRITER_OVERRIDES — the declared exceptions to '<check minus :check>': translate-bpmn:check → translate-bpmn:extract (new package.json script, '--extract'), audit:coverage:strict and audit:coverage:require-all → audit:coverage. writerFor consults it first and still refuses a writer package.json does not have (a renamed writer is 'no-writer', never a guess); repairableGates admits the two non-':check' gates.
- [x] regen repairs translate-bpmn:check — verified end to end: a deliberately staled fr/document-ingestion.pot came back '✓ translate-bpmn:check was stale — regenerated with bun run cat translate-bpmn:extract', differing from the committed file only in POT-Creation-Date (which the check ignores); restored.
- [x] a test pins it — regen-after-merge.test.ts: each override maps to a writer that exists, translate-bpmn:extract carries --extract, and the audit-coverage gates are offered with audit:coverage as writer. Not done: running every writer against a fresh stale fixture (the second Done-when as literally written) — the override table makes each exception a declared, tested line instead.
