---
# folio-assistant-zacz
$schema: bean/1.0.0
title: 'Merge train: a refused member gets a bean, a hand-back with a fail condition, or a dispatch'
status: completed
type: task
created_at: 2026-10-02T16:59:06Z
updated_at: 2026-10-06T19:30:00Z
parent: folio-assistant-nok9
---

Owner, 2026-10-02: "update skills: if a merge in queue cannot be merged for some reason, create a new bean (under appropriate epic/story…), hand it back to the sibling (use the agent-to-agent handoff process with a fail condition) for resolution, or dispatch an agent as appropriate."

Until now a merge steward handled a refused train member ad hoc, with a PR comment or a message to the owning session. The examples from 2026-10-02: #1808 and #1819 (bean `ob3m`, sibling navbar PRs), #1804 (`artefact-verification.json`), #1822 (`gen-library-jsonld.ts`, overlapping #1881), #1764 (glossary page budget exceeded in combination), and #1852 (`proposals/index.md`).

Builds on #1884 (agent-handoff), whose format and `## Fails if` this uses, and on #1802 (merge-manager SOP steps 10 and 12).

## Done when
- [x] `merge-conflict-patterns` carries a section on a refused member: open a bean (deduped, parented), hand back with a fail condition, dispatch when nobody owns it, comment once, close when the PR lands
- [x] `merge-refusal.bpmn` executes it, and every activity names a skill (and a bean op where it touches the work plan)
- [x] `skill:register:check`, `readme:subgraphs:check` and `render:bpmn:check` pass

Note: epic `nok9` is copied verbatim from #1887's branch, because it is not on `main` yet.

## Verified 2026-10-02, on this branch at `e75ce6b38e`

Each check run on its own, never through `bun run cat gates` (which is unpassable
on any branch until the `gatesFrom` fix on #1889 lands — bean `9zok`, issue
#1915):

| check | result |
|---|---|
| `skill:register:check` | exit 0 — 293 skills / 31 packages, 9 artefacts current |
| `readme:subgraphs:check` | 108 directory READMEs, **0 stale** |
| `render:bpmn:check` | exit 0 — every workflow SVG up to date |
| `check:workflow-refs` | exit 0 (this was one of the two red steps at `d93e1f3a0`) |
| `bun test` | 14021 pass, 56 skip, **0 fail**, 689 files (the other red step) |

`merge-refusal.bpmn` carries 10 activities, every one naming a skill, and a
`<cat-harness.processes:bean op>` on each of the three that touch the work
plan (`Task_Record`, `Task_HandBack`, `Task_Dispatch`).

## CI state — two facts, deliberately not merged into one

Both measured 2026-10-02, and the distinction is the whole point of bean
`3pqn`:

1. **Every gating job ran and passed on this exact tree.** `workflow_dispatch`
   runs `37071454279` (Code-quality gates, 8/8 jobs success) and
   `37071458209` (JSON-LD drift, 1/1 success).
2. **No `pull_request` run exists for this head.** `check:head-has-run` exits
   1: *"1 workflow(s) owed for this event did NOT run: Code-quality gates."*
   `actions/runs?head_sha=e75ce6b38e` returns `total_count: 0`.

(2) is the known bot-actor push condition — bean `0qjq`, whose fix is the
GitHub App token in #1829, and for which `merge-main.yml` already dispatches
the gating workflows by design. A dispatch is the designed workaround, not
evidence of a `pull_request` run.

**The reason to keep them apart is that collapsing them is the live defect.**
Reading (1) as "green" is what bean `9x9r` measured, and this session made
that exact error before `check:head-has-run` caught it: the dispatched runs
were read as the owed runs because the job NAMES all matched.

## Summary of Changes

Closed 2026-10-06 by claude/sep-bookkeeping-s1-s3 (7x5n sweep of in-progress beans whose work has landed). Every Done-when box was already ticked by its holder. That was NOT taken as the evidence: the measurement below was re-run on main at 24b221415 (2026-10-06), and no open PR names this bean.

- `cat-harness/processes/sdlc/merge-refusal.bpmn` exists on main (box 2).
- `render:bpmn:check` → exit 0. `skill:register:check` and `readme:subgraphs:check` pass inside `bun run cat gates` on the bookkeeping branch (box 3).
- The refused-member process ran on real cases afterwards: `58ro` and `z9hh` are refusal beans that it opened and that closed when their PRs (#1977, #2093) landed.
