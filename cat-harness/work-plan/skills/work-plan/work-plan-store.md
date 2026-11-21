---
name: work-plan-store
description: >
  The contract the work plan (work items) keeps as a data store, as operations any
  Tool must provide: get, list, create, update with ifMatch, note, history,
  and where a work item is in its processes. Give back a work item exactly as written,
  keep ids unique and links whole, keep status and type to their closed lists,
  lose nothing to concurrent writers, and answer a work item's history. A
  mechanical Actor plays this Role through whichever Tool the deployment names.
---

# The work plan's contract

**The work plan is a data store, and this is its contract.** `work-plan` in
[`scenarios/roles.json`](../../../scenarios/roles.json) is a mechanical Role
with a `store` block: what it holds, and how it is reached. This skill is the
other half, what it must do. How an agent USES the plan is
[`todo-manager`](todo-manager.md); this file says what the plan promises back.

**This contract names no Tool.** A process or skill that touches the work plan says which operation below it
performs ("note the bean", "claim it"), never which command does it. How one
Tool performs an operation belongs on that Tool's page, listed in §"Tools".
The Tool in use is chosen by the deployment description, per checkout.

A diagram draws the store as a data store, never a lane: a
`dataStoreReference` with `dataStoreRef="work-plan"`, declared once in
[`processes/global-tasks.bpmn`](../../../processes/global-tasks.bpmn). A task
that opens or closes a work item writes to it with a `dataOutputAssociation`; a
task that reads the plan has a `dataInputAssociation` from it. The task sits
in the lane of whoever does it.

## What it holds

| Kind | What |
|---|---|
| `bean-defs` | work items (`$schema: bean/1.0.0`), shaped by [`schemas/kinds/bean-defs.schema.json`](../../../schemas/kinds/bean-defs.schema.json) |
| `bean-notes` | addenda to a work item, one per writer, never rewritten |
| `workflow-state` | running and finished BPMN instances (`folio-workflow-instance/v1`) |

## Operations

Every Tool provides these. Each line says what a caller can rely on.

| Operation | Guarantee |
|---|---|
| `get(id)` | the work item as last written, or "none". A short id resolves to exactly one work item or to none |
| `list(filter)` | work items by status, type, tag or parent; archived work items only when the filter asks for them |
| `create(bean)` | the id is unique; the work item is readable by `get` once `create` returns |
| `update(id, change, ifMatch)` | refused when `ifMatch` names a version that is no longer current; a retry on the current version lands. `archived: true` archives the work item |
| `note(id, text, by)` | appended to the work item's notes, never rewriting earlier ones |
| `history(id)` | every change to the work item, oldest first: when, by whom, what changed, and which process step made it when one did |
| `positions(id)` | every workflow instance that names the work item: process, step(s), instance status, last move |
| `beansAt(process, step?)` | the work items with a token at that process (and step) |

**Archiving is a field, not an operation.**
`update(id, { archived: true }, ifMatch)` is refused unless the work item is
`completed` or `scrapped`, and the work item keeps its status. `get` still finds an
archived work item; `list` leaves it out unless asked. Where an archived work item lives
is the Tool's choice, stated on its page.

**A work item's position lives only in the workflow instances.** The work item records no process or step of its own;
`positions` and `beansAt` read the instances the store holds. A tag such as
`process:code-change-review` may label a work item for people, and is never read
as its position.

## Responsibilities

Each line is something a test can check against any Tool.

1. **Give back what was written.** `get` after `create` or `update` returns,
   byte for byte, the work item written.
2. **Keep ids unique.** No two work items share an id.
3. **Keep links whole.** `parent`, `blocking` and `blocked_by` name work items that
   exist.
4. **Keep the lists closed.** `status` and `type` take only the values the
   schema declares.
5. **Lose nothing to a race.** Two writers at once both land: the second
   `update` with a stale `ifMatch` is refused, retried on the current version,
   and lands. Nothing is overwritten unread.
6. **Keep the history.** `history(id)` answers who changed what and when, and
   which process step did it.
7. **Archive only what is finished.** `archived: true` on a work item that is not
   `completed` or `scrapped` is refused.
8. **Know where a work item is.** `positions` and `beansAt` agree with the
   instances the store holds.

## Tools

| Tool | Backed by | Page |
|---|---|---|
| git state branch | a branch per graph (`cat/<harness>/beans`), mounted at `beans/`, written with the `beans` CLI (`beans-cli`) or by hand (`beans-manual`), read with `bean-query` | [`work-plan-store-git-branch`](work-plan-store-git-branch.md) |
| work items server | `beans-serve` GraphQL ([schema](https://github.com/litlfred/beans/blob/main/internal/graph/schema.graphqls)); its mutations already take `ifMatch` | proposed |
| MCP service | an MCP server over the same operations | proposed |
| run-scoped store | in memory or a scratch branch, one per benchmark run, never the real plan (`req:model-benchmark`) | proposed |

## Tests

The conformance suite lives in the tools layer
(`scripts/tests/sdlc/work-plan-store-conformance.ts`, one `describe` per
responsibility above) and runs against both of the git Tool's access modes.
Until this file carries a `tested-by:` line, `kg-audit` reports this role as
`mechanical-role-untested`.

## Not its responsibility

Deciding what to work on, who claims a work item, or whether work is done. Those
are judgements made in the lanes of the people and agents who read and write
the plan.
