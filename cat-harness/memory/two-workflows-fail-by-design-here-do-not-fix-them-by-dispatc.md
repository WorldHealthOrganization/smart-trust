---
$schema: folio-memory/v1
id: two-workflows-fail-by-design-here-do-not-fix-them-by-dispatc
label: trap
summary: "two workflows fail BY DESIGN here; do not \"fix\" them by dispatching"
createdAt: 2026-09-19
roles:
  - build-pipeline
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
`witness-refresh.yml` and `qa-sweep.yml` failed to **parse** on 2026-08-07 —
which is why GitHub ran them on `push` despite both being
`workflow_dispatch`-only, and why their runs are named by path rather than by
`name:`. They were fixed the next day. They only run on dispatch and the
report only reads the default branch, so nothing will ever run them here
again. Work item `lq7e`.

The platform carries no folio: `witness-refresh` needs `computations/`, and
`qa-sweep` is no longer a workflow here — since work item `52dz` it is a
`folio_init` template (`cat-harness/templates/`), so its red runs predate that.

Without rule 3 these two would be red forever. That is what rule 3 is for.
