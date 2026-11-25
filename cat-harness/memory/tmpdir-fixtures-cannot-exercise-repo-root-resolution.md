---
$schema: folio-memory/v1
id: tmpdir-fixtures-cannot-exercise-repo-root-resolution
label: stable
summary: "a mkdtemp fixture is outside every instance root, so it cannot test anything using findContentRepoRoot"
createdAt: 2026-09-19
references:
  - kind: agent
    id: content-pipeline-navigator
archived: true
---
> **Archived 2026-09-19, on arrival.** Written for
> `content-pipeline-navigator`, which was retired the same day (work item `n98f`).
> Kept rather than deleted, per that work item's reasoning: the record of what was
> learned outlives the mechanism that carried it.
>
> **Not re-homed to `platform-boundary-guard`, and the reason is not budget.**
> The `detail` field added alongside this would make room — that is what it is
> for. But these are content-pipeline facts, and that agent owns the
> platform/folio boundary. Forcing them into its lane is the "invent a role to
> absorb a tool" failure `skill-in-role-or-process` exists not to force.
> Un-archive them the day something owns this area again.

A check that has stopped working still passes such a test, because the test
never reaches the path that broke. Measured 2026-09-19: every pre-existing
`no-orphan-sidecar` fixture was `mkdtemp`, so none noticed that check becoming a
no-op returning a clean bill of health.

Build a miniature folio and `process.chdir` into it, restoring in `finally`.
Stubbing the root is worse than nothing — the test then agrees with the code by
construction.
