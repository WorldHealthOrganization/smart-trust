---
$schema: folio-memory/v1
id: the-commands-that-do-exist-here
label: stable
summary: "the commands that do exist here"
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

```sh
bun install
bun run src/index.ts --http      # the assistant (HTTP); --stdio for stdio MCP
bun test                         # unit tests
bun run cat test:e2e                 # e2e  (npm script: test:e2e)
bun run cat lint
bun run src/index.ts --check-deps   # probe environment capabilities
bun run cat init-folio --help           # scaffold a new folio
bun run cat readme:sync[:check] | readme:sections
bun run cat check:ci-health | check:corpus-gate | check:workflow-policy
bun run typecheck | lint | gen:jsonld[:check] | render:bpmn[:check]
```
