---
# folio-assistant-8jt6
$schema: bean/1.0.0
title: 'MEMORY & TODOS: notes an agent or a person carries, attached to the graph'
status: completed
type: epic
priority: normal
created_at: 2026-09-19T11:43:44Z
updated_at: 2026-10-29T09:26:58Z
parent: folio-assistant-rwmf
---

Notes that a participant carries, attached to a node of the graph.

`h32d` is the schema both halves share; `5oai` is the relation that lets one
attach to a content block and move between them. The 2x2 that governs this is
memory-vs-workflow and human-vs-agent: todos are human memory, `MEMORY.md` is
agent memory, beans are agent workflow, and human workflow is deliberately
empty.

`4kiw` and `0j8h` are both failures of the injection budget and its tagging —
a 14th entry silently evicting three TRAPs, and an unrecognised spelling of
`archived:` yielding a live untagged node that reaches every agent. Both are
silent, which is what makes them worth grouping rather than fixing ad hoc.

_2026-10-29T09:26:58Z_ — Completed: all 19 child beans are closed (19 completed), including `h32d`, `5oai`, `4kiw` and `0j8h` named above, and the epic holds no scope of its own beyond them. `check:bean-rollup` flagged it as a container with no open children (folio-assistant main CI run 40841080028). Session: https://claude.ai/code/session_01NVW1gLKTQrfffUSgD3GCd5
