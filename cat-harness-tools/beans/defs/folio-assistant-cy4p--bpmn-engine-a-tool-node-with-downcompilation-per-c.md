---
# folio-assistant-cy4p
$schema: bean/1.0.0
title: 'BPMN ENGINE: a Tool node, with downcompilation per coding agent'
status: completed
type: task
priority: normal
created_at: 2026-09-19T17:04:01Z
updated_at: 2026-10-23T13:35:00Z
parent: folio-assistant-ahvw
---


**Uncaptured owner requirement, found 2026-09-19T17:0x** while checking
[#363](https://github.com/litlfred/folio-assistant/issues/363) for replies.
The ask was made at 09:20 and had reached no bean in eight hours — the
`issue-working` re-check is what surfaced it, which is the case that skill
exists for.

Owner, [#363 comment](https://github.com/litlfred/folio-assistant/issues/363#issuecomment-5740727385):

> as part of tools, if bpmn-engine (including skills to downcompile to
> different languages per coding agent need).

## Two halves

**The engine as a Tool node.** BPMN execution already exists here —
`workflow_start` / `workflow_next` / `workflow_complete` over
`src/workflow/`, with state committed under `beans/workflows/`. What does
not exist is a **Tool** declaration for it. "as part of tools" reads as:
the engine should be a first-class node other instances can discover and
depend on, not an implementation detail of this repo's MCP server.

**Downcompilation "per coding agent need".** The harder half, and the one
to scope before building. Different coding agents consume instructions in
different forms, so a diagram may need emitting AS something a given agent
can follow — a skill body, a checklist, a state machine in its own config
format. This is a generator FROM the BPMN, not a second source of truth.

## The trap this must not fall into

**A downcompiled artefact is a rendering, never an authority.** The moment
one can be edited and fed back, there are two answers to "what is the
process" and they are free to disagree. That is `render:bpmn`'s existing
discipline — the SVGs are generated and `render:bpmn:check` fails if
stale — and the same must hold here, including a staleness gate.

## Before drawing anything

Ask what a target agent actually cannot do with the diagram today. If the
answer is "read XML", the fix may be a projection rather than a compiler.

## Done when

- [x] the scope question above is answered: which agents, needing what form (answered by owner rulings 2026-10-10 and 2026-10-16: Option 1, checklist-as-skill through `skills:install`, engine over MCP)
- [x] the engine is declared as a Tool node and the declaration is audited
      by `kg:audit` (`cat-harness#132`, `bpmn-engine` in `cat-harness-tools/tools/index.ts:25` and `bpmn-checklist` in `cat-harness/tools/bpmn-checklist/bpmn-checklist.ts`)
- [x] any downcompiled artefact is generated, with a `--check` gate, and
      carries in its own text that it is generated (`cat-harness-tools#106`, `bpmn-checklist.ts` + `bpmn:checklist:check` in `code-quality-gates.yml:3873` across 104 committed `.checklist.md` files)

## Owner ruling (2026-10-10, drain session ml9h)

**Both:** (1) declare the engine as a Tool node now; (2) generate a checklist projection per diagram. Owner asked how an agent following a checklist takes the BPMN edges correctly — the answer (below) is the design to build to.

### How a checklist follows the edges

The checklist is NOT a flat list; it is the diagram walked as a state machine, with the engine still the authority:

1. **Each task is a step that names its outgoing edge(s).** A step ends with 'next: <task id>' — the sequence flow written out, so the agent never infers order from position.
2. **Each gateway is a decision step, not a step to do.** Exclusive gateway → 'Decide: <condition A> → go to X; <condition B> → go to Y', the conditions copied from the flow's conditionExpression (or the DMN it calls, by id). Parallel gateway → 'Do all of X, Y; join at Z before continuing'.
3. **Events become entry/exit lines:** start event = 'Begin here when…', end events = 'Done — record completion', boundary/timer events = 'If <trigger> while in this step → go to …'.
4. **The agent records where it is.** Every step says which workflow_next / workflow_complete call to make, so the engine's committed state under beans/workflows/ — not the agent's memory of the list — says which edge was taken. A wrong turn is then visible and refusable.
5. **Generated and gated.** The checklist is emitted from the .bpmn, says so in its own text, and a :check fails when it is stale, so it can never become a second source of truth.

For an agent with no MCP, steps 1–3 are enough to walk the graph by hand; step 4 is what makes the walk auditable.

## Assigned (2026-10-10 17:5x UTC, drain ml9h)

Owner asked lane A to dispatch more to lane B; assigned to lane B (session_01QmRtjQNyHiH2RuimTfuJDu), whose repo (litlfred/cat-harness-tools) holds the code. Lane A will not start it.

## Summary of Changes

Done by drain lane B on the owner's ruling (Tool node + checklist projection): cat-harness-tools#106 (bpmn-checklist generator + :check; 98 diagrams render) and cat-harness#132 (bpmn-engine Tool node with inProcess registrar + workflow_* MCP arm; bpmn-checklist Tool node). Committing the generated checklists waits on a registered regen writer (follow-up).

_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo). Evidence: closed in the folio-assistant store copy (2026-10-11); cat-harness#132 merged 2026-10-11, cat-harness-tools#106 merged 2026-10-11. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Reopened (2026-10-16, owner)

Status `completed` → `in-progress`. Owner, thread "BPMN engine status", chose to reopen: only the first slice shipped. The cat-harness copy had also lost the owner ruling and the summary above; both copies now carry the same body.

Still open:

- [x] **Checklists committed and gated.** Corrected 2026-10-16 13:5x: the reopen note was wrong, because it looked only in cat-harness-tools. 104 checklists are committed next to their diagrams (cat-harness 73, folio-assistant-core 17, smart-base 6, fhir-harness 5, folio-assistant-sci 3), and folio-assistant's code-quality-gates has run `bpmn:checklist:check` since 2026-10-14. After cat-harness#327 and cat-harness-tools#429 merged, the only stale checklist was fhir-harness `ig-incremental-build`, which fhir-harness#116 regenerates (98 of 98 current).
- [x] **Per-agent downcompile targets scoped.** Owner ruling below.
- [x] The three "Done when" boxes above ticked with evidence.

Session https://claude.ai/code/session_01WisJFefMYG4g6iFhtgCUYG.

## Owner ruling on scope (2026-10-16 12:31 UTC, thread "BPMN engine status")

**Option 1: checklist-as-skill through `skills:install`, engine over MCP.** No per-agent compiler. Every host `skills:install` targets (Claude Code, Antigravity; Gemini CLI, Cursor, Copilot pending in `folio-assistant-x4mt`) consumes Markdown, and the generated checklist already is Markdown. So the downcompile is: install each diagram's committed `<stem>.checklist.md` as one skill per host, prefixed per harness (x4mt ruling). Agents with MCP use `bpmn-engine`, which refuses a wrong turn; agents without it walk the checklist by hand. Rejected for now: a Claude Code hook that blocks tool calls when the step is not enabled (option 2), and a native format per agent (option 3).

- [x] `skills:install` emits one skill per committed checklist, for every host it supports, and the installed text says it is generated from the `.bpmn`
- Depends on: checklists committed and gated (item above); further hosts arrive with x4mt.

_2026-10-23T08:00:00Z_ — The remaining box is built and 100% green in CI on `litlfred/cat-harness-tools#441` (`skills:install: install each committed BPMN checklist as a process skill (cy4p)`, head `2d291d909c`), with `litlfred/cat-harness-tools#445` (`skills:install: Gemini CLI, Cursor and Copilot hosts (0nxe)`, head `7f61ce4833`, also 100% green) stacked on top. Closes once `#441` merges.

_2026-10-23T13:35:00Z_ — Closed. Owner said "merge all three": `litlfred/cat-harness-tools#441` merged (b22e3a7, one `process-<stem>` skill per committed checklist), `#445` merged (cdfce51, Gemini CLI, Cursor and Copilot hosts), and `litlfred/folio-assistant-core#149` merged (5f1662e). Every box is ticked. Session https://claude.ai/code/session_01WisJFefMYG4g6iFhtgCUYG.
