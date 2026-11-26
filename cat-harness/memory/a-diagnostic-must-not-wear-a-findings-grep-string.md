---
$schema: folio-memory/v1
id: a-diagnostic-must-not-wear-a-findings-grep-string
label: trap
summary: "a 'could not check' notice reusing a finding's wording inflates the census it protects"
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

Consumers count findings by grepping the message, so a status line carrying the
finding's phrase is counted as one.

Measured 2026-09-19: a "could not read the results tree" warning worded with
`orphan QA sidecar` turned ten assertions red — it inflated the orphan census
the check exists to keep honest. Name the check by its **id** in a diagnostic,
never by the finding's phrase.
