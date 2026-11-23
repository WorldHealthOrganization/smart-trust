---
# cat-tools-yylt
$schema: bean/1.0.0
title: 'FOLIO SCAFFOLD NAMES MOVED CODE: templates and init-folio wire new folios to <assistant>/cat-harness/{src,content,scripts,viewer}, which moved to cat-harness-tools in 70lx'
status: completed
type: bug
priority: high
created_at: 2026-10-10T16:37:41Z
updated_at: 2026-10-10T16:37:41Z
parent: folio-assistant-1xhc
---

A folio scaffolded by `folio_init` / `scripts/init-folio.ts` is wired to platform code at `<assistant>/cat-harness/…`. That code moved to `cat-harness-tools/` in 70lx, so every one of those references resolves to nothing:

- **14 template lines** (`templates/document`, `templates/paper`), for example `bun run "{{assistant}}/cat-harness/content/pipeline/qa-sweep.ts"`, `…/scripts/qa-store.ts`, `…/content/pipeline/build.ts` and `…/scripts/lake-cache.sh`. Each target exists only under `cat-harness-tools/`.
- **8 generated strings in `init-folio.ts`**: the MCP server (`src/index.ts`, ×3), the viewer dir, the QA sweep, `install-beans.sh`, the SessionStart hook (`session-start-coord-sweep.sh`) and `state-mount.ts`.

`init-folio.test.ts` **pinned the stale path** (`vendor/fa/cat-harness/content/pipeline/qa-sweep.ts`). The test checked that the placeholder was substituted, not that the result exists, so it passed while every scaffolded workflow was broken.

## Done when

- [x] Code paths name `cat-harness-tools/`, and `schemas/` stays under `cat-harness/`.
- [x] A test fails if a template or the scaffolder names a platform path that does not exist in the index.

## Summary of Changes

- `scripts/init-folio.ts`: added `toolsDir()` (`<assistant>/cat-harness-tools`) for the MCP server, viewer, QA sweep, `install-beans.sh`, the SessionStart hook and `state-mount.ts`. `platformDir()` stays for `schemas/` and the adapter lookup.
- `templates/**`: 14 `{{assistant}}/cat-harness/…` lines and 8 provenance comments now point at `cat-harness-tools/`.
- `scripts/tests/init-folio.test.ts`: new test resolving every platform file a scaffolded document or paper folio names against the index. It fails on the old templates, listing `cat-harness/content/pipeline/qa-sweep.ts`, `…/qa-axis-summary.py` and `…/qa-staleness.ts`. Updated the two pins that held the stale path (`init-folio.test.ts`, `init-folio-qa.test.ts`).
- Pre-existing and unchanged: `init-folio-qa.test.ts` "swept from the repository root…" fails on main too (the `qa-sweep` child exits 1).
