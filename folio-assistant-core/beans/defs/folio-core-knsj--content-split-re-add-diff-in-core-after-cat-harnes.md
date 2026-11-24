---
# folio-core-knsj
$schema: bean/1.0.0
title: 'Content split: re-add diff in core after cat-harness drops it'
status: completed
type: task
created_at: 2026-11-08T09:15:25Z
updated_at: 2026-11-08T14:35:00Z
parent: folio-assistant-vuip
---

Content split step 3, the `diff` half, as its own cross-layer pair. `diff` stays in cat-harness for now (cat-harness#1136 `65a6723`): removing it there before core holds it left core's `folio-changeset` Tool (`satisfies: ["diff", …]`) pointing at nothing, and `graph:check-tools` failed. The pair: core adds `diff` (and `/diff`, the session-coordinator extension), cat-harness removes it, landed back to back like #676/#1136, then a re-pin.

Why a follow-up: adding `diff` here while cat-harness still declared it made the composed checkout declare it twice, and `skill:commands`, `uml:overview` and `skills:docs` failed on folio-assistant-core#676. The content is `skills/content/content-lifecycle-ext/diff.md` and `.claude/commands/diff.md` as committed in core `8917d63`.

- [x] cat-harness#1136 and core#676 merged and re-pinned
- [x] cat-harness: remove `diff`, `.claude/commands/diff.md`, the session-coordinator binding (PR paired with the core one)
- [x] core: `diff.md`, `.claude/commands/diff.md`, manifest entry, session-coordinator extension
- [x] `skill:commands:check` green
