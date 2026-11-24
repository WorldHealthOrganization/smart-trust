---
name: mcp-contract
description: >
  Verify an MCP service's tools against the Tool nodes and skill declarations
  they came from — I/O equivalence in both directions. Read before shipping a
  projected server, and when a tool call fails with an argument the schema
  said was fine.
---

# MCP contract — the projected service must match what it was projected from

[`mcp-projection`](mcp-projection.md) emits a server. This checks the emitted
server still agrees with its sources, which is a different activity and needs
its own gate: a projector that is correct today drifts the moment a Tool node
is edited and nothing re-runs it.

## What is being checked, and against what

Four checks, and they fail in different directions:

| | source | checked against |
|---|---|---|
| **schema equivalence** | `ToolDefinition.io` | the served `inputSchema` / `outputSchema` |
| **coverage** | the layer's Tool nodes | what `tools/list` actually returns |
| **satisfaction** | `ToolDefinition.satisfies` | the skills that claim the capability |
| **authority** | `ToolInvocation.by` | the role graph — was this actor, in this lane, allowed to run it |

**Schema equivalence is not string equality.** JSON Schema has several
spellings of one constraint, and a generator may legitimately change spelling
between versions. Compare *accepted instance sets*, not serialised text — at
minimum: same required keys, same types per key, same enum members, same
nullability. A test asserting the JSON blob is byte-identical fails on a
harmless `zod-to-json-schema` upgrade and teaches everyone to re-baseline it
without reading, which is worse than having no test.

**Coverage is the direction that goes quiet.** A tool dropped from `tools/list`
does not error — the model simply never calls it, and the capability silently
disappears. So the check is: every Tool node with a projectable `invoke` arm
and met `requires` appears in `tools/list`, and every listed tool traces back
to a node. An unexpected extra is as much a finding as a missing one; it means
something is being served that nothing declares.

**Satisfaction is the KG edge, and it is the one nobody checks.** A skill says
"claim the item before you work". `satisfies` is what says which Tools can do
that. If no served tool satisfies a skill the layer ships, an agent will read
the skill, find no mechanism, and improvise, which is the failure the
skill/Tool separation exists to prevent. Report it; do not fail on it by
default, because a skill may legitimately be satisfied by a manual Tool with
nothing served.

## Three states at the check, too

- **Agrees** — the served tool matches its node.
- **Deliberately absent** — `requires` unmet, or `invoke.mcp` only. Expected,
  and must be reported as *why*, not merely as absent.
- **Could not check** — the server would not start, `tools/list` errored, or an
  `io.*.schema` reference does not resolve. **Never rendered as agreement.**
  This is the same rule `check:ci-health` follows: a checker that cannot see
  has not found that nothing is wrong.

## When a call fails but the schema said it was fine

The common cause, and worth checking before anything else: **the schema
describes what the tool accepts, not what the underlying command accepts.** A
`ToolDefinition` whose `io.inputs` was written by hand against an imagined CLI
will type-check, project cleanly, serve happily, and fail on invocation.

So the contract check is necessary and not sufficient. Equivalence between
`io` and `inputSchema` proves the projection is faithful; it proves nothing
about whether `io` describes the real tool. That second question is answered
by exercising the tool, and a Tool node that has never been called is unverified
however green the schema check is — say so rather than implying coverage the
check does not have.

## Status

**The source side exists; the served side does not.** `schemas/tools/tool.ts`,
`schemas/tools/tool-types.ts` and the Tool nodes under `tools/` are real, and
`bun run cat check:tools` does the *satisfaction* check in this table's third
row: every `satisfies` resolves to a skill that exists.

Schema equivalence and coverage wait on a served projection: the projector
exists as a library ([`mcp-projection`](mcp-projection.md) §"Status") but is
registered on no running server, so there is no served `tools/list` to compare
against. Because `io` ports reference a shared `$defs` document by absolute IRI rather
than restating a structure per tool, "these two Tools accept the same input" is
*identity* rather than a structural comparison. That is what makes the
equivalence check in row one tractable when it is written.
