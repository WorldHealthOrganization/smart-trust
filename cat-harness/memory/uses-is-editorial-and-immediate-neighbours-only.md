---
$schema: folio-memory/v1
id: uses-is-editorial-and-immediate-neighbours-only
label: stable
summary: "`uses[]` is EDITORIAL, and immediate-neighbours only"
createdAt: 2026-09-19
archived: true
---
> **Archived 2026-09-19.** Its only reader, the `content-pipeline-navigator`
> subagent, was retired. Kept rather than deleted: the record of what was
> learned outlives the mechanism that carried it, which is why a work item is
> `scrapped` and not removed. Not injected into any agent's prompt —
> `platform-boundary-guard` was already at 189 of its 200 lines, so there
> was nowhere to put it without pushing an entry past the line the harness
> silently truncates at.

`uses[]` and `interprets` state what a *reader* must have read to follow a
block — agent/human maintained, part of the authored content. It lists
**immediate neighbours only**: if A→B and B→C, A lists only B. It is not the
import graph and not a transitive closure.
