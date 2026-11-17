---
$schema: folio-memory/v1
id: never-assert-on-a-qa-verdict-from-the-published-corpus
label: trap
summary: "never assert on a QA VERDICT from the published corpus"
createdAt: 2026-09-19
roles:
  - build-pipeline
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
`test/results/witnesses/**` is live state, and leaving `main` for `qa-reports`
(arc `3fva`). A test reading a VERDICT out of it breaks when somebody fixes or
adjudicates the finding (the system working), and when the file is not there.

**Read the document live and flip the ONE criterion you test, BY ID, where it
sits.** Do not freeze a captured copy: freezing the criterion freezes its
witness, so the hash literal outlives the checker. And never hoist the failure
to `criteria[0]` — the generator already sorts worst-first, so a panel that
sorted nothing would pass.

<!-- detail -->

Measured 2026-09-19 (work item `tywj`): `test/qa-panel.e2e.ts` pinned the first row
to `voice-status-leak`/`fail`/`critical`, the fold count to `47` and the checker
hash to `5af6856733f3`. An adjudication in `c8fbad385` turned that criterion
`pass`; four assertions went red for reasons unrelated to the panel.

The settled answer (#319) keeps only the script witness, so the hash the spec
asserts is still the corpus's own.

I tried freezing a captured copy and withdrew it: reading the value out of a
frozen document makes the assertion self-consistent, not correct — the same
defect one field down.

`severity`, `evidence` and `changed` exist only in states the corpus is not in,
so no live sidecar vouches for them. Work items `tywj`, `qjyi`, `iumj`.
