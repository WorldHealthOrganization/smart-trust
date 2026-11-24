---
$schema: folio-memory/v1
id: qa-sidecars
label: stable
summary: "QA sidecars"
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

`<block>.qa.json` (block-qa/v1) carries per-criterion reviewer entries;
`<criterion-id>.script.json` is qa-script/v1. Producing types are
`schemas/sdlc/block-qa.ts`. `qa-staleness.ts` reports; `qa-sweep.ts` repairs.

<!-- detail -->

A sidecar is **stale** when the recorded source hashes or a reviewer
`script_hash` drift from the current file contents. Refresh by deleting the
stale `criteria.<crit>` entry and re-running
`bun run pipeline/qa-sweep.ts <path> --only <crit>`.

**A standalone library `.lean` file has no sidecar** and escapes every
per-block checker. Nothing but an agent checks it.
