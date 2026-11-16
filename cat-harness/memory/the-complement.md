---
$schema: folio-memory/v1
id: the-complement
label: stable
summary: "the complement"
createdAt: 2026-09-19
roles:
  - build-pipeline
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
`ynu8` complements work item `5rfy`, which fixed workflows that never *fire*. This
is the opposite defect: one that fires constantly and fails every time. When
triaging, decide which of the two you are looking at first — the remedies are
unrelated.
