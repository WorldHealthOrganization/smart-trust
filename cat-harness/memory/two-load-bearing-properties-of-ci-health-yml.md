---
$schema: folio-memory/v1
id: two-load-bearing-properties-of-ci-health-yml
label: stable
summary: "two load-bearing properties of `ci-health.yml`"
createdAt: 2026-09-19
roles:
  - build-pipeline
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
Not incidental; do not simplify either away.

- **`fetch-depth: 0`.** The `superseded` rule asks `git log` when a workflow
  file last changed, and a shallow clone cannot answer — which would
  resurrect the false fires the rule exists to retire.
- **On "could not check" (exit 2) it leaves the tracking issue UNTOUCHED and
  fails the job**, rather than closing it. A watchdog going blind must not
  read as good news. A red `ci-health.yml` is itself reported by next week's
  run.
