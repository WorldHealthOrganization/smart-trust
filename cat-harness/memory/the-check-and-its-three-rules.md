---
$schema: folio-memory/v1
id: the-check-and-its-three-rules
label: stable
summary: "the check and its three rules"
createdAt: 2026-09-19
roles:
  - build-pipeline
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
`bun run cat check:ci-health` reports each workflow's state on the **default
branch**: consecutive failures, days since the last green, whether it has run
recently at all. The session-start sweep prints it, so it lands where you
already look.

1. **"Could not check" is never rendered as green.**
2. A red that has not re-run in a week is flagged **possibly stale**, not an
   active fire.
3. A red whose **workflow file changed after the failing run** is reported
   `superseded` — a later edit is evidence the failing version is gone, not
   evidence the new one works. Never green, never a live failure.
