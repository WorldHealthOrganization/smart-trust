---
$schema: folio-memory/v1
id: block-verdicts-moved-to-the-results-tree
label: trap
summary: "a block's QA verdict is no longer beside the block — scanning its directory finds nothing"
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

`${block.root}.qa.json` has found nothing since work item `2634`, and finding
nothing reads as "never audited" rather than as an error — a false pass.

Never compose the path; the helpers in `pipeline/qa-paths.ts` are the
one answer, and they differ for reading and writing.

<!-- detail -->

`pipeline/qa-paths.ts` is the contract:

- **read** → `existingBlockQaPath(repoRoot, blockRoot)` — results tree first,
  legacy sibling second, `undefined` ONLY when there is genuinely no verdict.
- **write** → `blockQaPath(repoRoot, blockRoot)` — results tree only. Writing
  the legacy location too creates two verdicts for one block that can
  disagree, with nothing saying which is current.
- **invert** → `blockOfQaPath(repoRoot, qaPath)`, which `no-orphan-sidecar`
  depends on to find the manifest a verdict belongs to.

`repoRoot` is the CONTENT repo root (`findContentRepoRoot()`), never the
platform checkout.

The legacy fallback is not politeness. A downstream folio has its verdicts
committed beside its blocks; a reader that consults only the results tree
reports every block in that folio as unaudited the day it upgrades.

`saveQaReport` mkdirs, because the mirrored directory is not guaranteed to
exist — the legacy sibling's always did, being the block's own. Work item `2634`.
