---
$schema: folio-memory/v1
id: empty-corpus-guard-is-disarmed-by-any-advisory-issue
label: trap
summary: "validateObjects detects 'validated nothing' via issues.length === 0, so any advisory issue turns invalid into valid"
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

`validateObjects` refuses success over a corpus it read nothing from, detected
as `allBlocks.size === 0 && issues.length === 0`. **Any** issue raised in
`loadBlocksFromDir` disarms it — including a warning that a check could not run.

Measured 2026-09-19: a third-state notice on `no-orphan-sidecar` flipped "an
empty directory is INVALID" to `valid: true`. Suppressed there; the fragility
remains for the next check that adds an advisory issue.
