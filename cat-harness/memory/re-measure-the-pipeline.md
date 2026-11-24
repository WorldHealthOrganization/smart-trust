---
$schema: folio-memory/v1
id: re-measure-the-pipeline
label: stable
summary: "re-measure, do not quote"
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

| what | command |
|---|---|
| the pipeline's actual entrypoints | `ls pipeline/` |
| the scripts that exist on this side | `bun run` with no args, or read `package.json` |
| block kinds and their classification | read `schemas/content/block-kinds.ts` |
| sidecar staleness | `bun run pipeline/qa-staleness.ts <path>` |

> Relabelled from BASELINE to STABLE, 2026-09-19. `AGENTS.md` defines a
> BASELINE as *"a measured number, stored with the command that produced it
> and the date"* — and this entry stores no number. It is a table of commands
> to RUN, which is the opposite thing: a stable fact about how to measure,
> not a measurement. `MemoryNodeSchema` refused it as a baseline, correctly.
