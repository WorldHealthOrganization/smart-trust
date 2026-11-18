---
$schema: folio-memory/v1
id: re-measure-ci-health
label: stable
summary: "re-measure, always"
createdAt: 2026-09-19
roles:
  - build-pipeline
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
Nothing about workflow state should ever be quoted from this file. Run
`bun run cat check:ci-health` and report what it returns today.

| what | command |
|---|---|
| per-workflow state on default branch | `bun run cat check:ci-health` |
| workflow trigger policy | `bun run cat check:workflow-policy` |
| the tracking issue | issues labelled `ci-health` |

<!-- detail -->

> Relabelled from BASELINE to STABLE, 2026-09-19. `AGENTS.md` defines a
> BASELINE as *"a measured number, stored with the command that produced it
> and the date"* — and this entry stores no number. It is a table of commands
> to RUN, which is the opposite thing: a stable fact about how to measure,
> not a measurement. `MemoryNodeSchema` refused it as a baseline, correctly.
