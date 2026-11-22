---
name: pending-show
description: Show the current session's pending work — work items list + ledger intent. Read-only.
user_invocable: true
---

# /pending-show — what is this session working on?

Quick status display. Read-only. Run any time to answer "where am I?"
or "what did I say I was going to do?".

## What it shows

In order:

1. **Current branch + PR.** Branch name, PR number (if open), PR title.
2. **Work items list.** Current in-progress or todo work items for this session (via `beans list`).
3. **Goal scope.** From `STATUS.md`: which goal(s) the current PR touches.
4. **Master ledger intent.** The "INTENT" cell of the current session-log row in `docs/coordination/<goal>.md`.

## Output format (compact)

```
## Session pending — 2026-01-01 14:32 UTC

Branch:  claude/<feature-slug>
PR:      #1580 — <PR title>

Beans (via `beans list`):
  [epic-123] Session tracker (In Progress)
  [task-124] Subtask 1 (Completed)
  [task-125] Subtask 2 (In Progress)

Goal: <goal-slug> (also touches: <other-goal>)

Ledger intent (docs/coordination/<goal>.md):
  (1) create ledger + STATUS.md, (2) coord with #1577,
```

## Implementation

This is a thin reader. No writes. Sources (read order):

1. `git branch --show-current`
2. `mcp__github__list_pull_requests({head: "<branch>"})` for PR number
3. Run the CLI tool `beans list` to find tasks matching the current scope.
4. `STATUS.md` — find row where "Active PRs" contains current PR
5. `docs/coordination/<goal>.md` — find session-log row for current branch

## When to invoke

- User asks "what are you working on?" / "what's left?" / "status?".
- Mid-session checkpoint — ensure ledger is consistent with Work items state.
- Before a context handoff (compaction event, end of session).
