---
name: mcp-projection
description: >
  Generate an MCP server from Tool nodes — the mapping from this harness's
  skill/Tool vocabulary onto the current MCP standard. Read before exposing a
  CLI tool over MCP, or when asked how an agent stands a service up.
consulted: true
---

# MCP projection — turning a Tool node into an MCP service

**The harness does not require MCP. It knows how to emit it.** `agentic-harness` runs on a filesystem alone (see
[`skills-and-tools`](skills-and-tools.md) §"The harness assumes no MCP"), and
MCP is something a layer *produces* from its Tool nodes when it wants
agents to reach them over a protocol rather than by reading files.

So this is a **bootstrap skill**: it stands a service up. An agent with a CLI
tool and a Tool node describing it should be able to produce a working MCP
server without inventing the mapping each time.

## Why the projection is nearly free

Because the pieces already line up, as a result of the Tool schema's carrier
convention (Zod authoritative, JSON Schema generated):

```
schemas/tools/tool.ts  (Zod, authoritative)
  └─→ JSON Schema                    ← already generated; MCP speaks JSON Schema
        └─→ MCP tool.inputSchema
ToolDefinition.io.inputs/outputs      ← already the I/O contract
        └─→ MCP tool.inputSchema / outputSchema
ToolDefinition.invoke.shell           ← already the mechanism
        └─→ what the server executes on tools/call
```

An MCP tool declaration is a name, a description and a JSON Schema for its
input (plus an output schema in recent spec revisions). A `ToolDefinition`
carries all four in `id`, `summary` and `io`. **The projection is a rename, not
a translation**, which shows the Tool schema was shaped correctly, not that MCP
is trivial.

## The mapping

| Tool node field | MCP | notes |
|---|---|---|
| `id` | `tools[].name` | subject to the naming rules — see [`mcp-assembly`](mcp-assembly.md) |
| `title` | `tools[].title` | human-facing; omit rather than duplicate `name` |
| `summary` | `tools[].description` | what the model reads to decide whether to call it |
| `io.inputs` | `tools[].inputSchema` | object schema; `required: true` → the `required` array |
| `io.outputs` | `tools[].outputSchema` | omit entirely when the tool returns unstructured text |
| `invoke.shell` | what the server runs on `tools/call` | the harness's arm |
| `io.inputs[].arg` | position in argv, or stdin | `{flag}`, `{positional}` or `{stdin}` — explicit per input, never a template |
| `io.inputs[].repeated` | `"type": "array"` in the input schema | the flag is emitted once per element; a repeated positional is the trailing words |
| `invoke.container` | same, in a container | for a tool with host dependencies |
| `invoke.inProcess` | the function the server calls directly | the projection **source**, not something to proxy |
| `invoke.mcp` | **nothing** | already MCP; projecting it would be circular |
| `requires` | not expressible | becomes a startup precondition, not a tool field |
| `satisfies` | not expressible | a KG edge; it has no MCP counterpart and must not be smuggled into the description |

Three rows are the ones that go wrong.

**`invoke.mcp` is not a source for projection.** A Tool already reachable over
MCP is not re-wrapped; the projector skips it. A generator that treats every
arm uniformly will emit a server that proxies itself.

**`invoke.inProcess` is the opposite case, and looks deceptively similar.** It
is a function in the layer's own code, so the server calls it directly rather
than spawning anything — there is no argv, and asking for one is an error rather
than a gap in the node. Most of a mature layer's Tools are in-process, and
few have a shell equivalent, so a projector that handles `shell` alone finds
little to project.

**A repeated input's elements are parsed individually.** A list of an injection-safe type cannot contain an element that
is a payload, because the element type already made one unrepresentable — so
cardinality needs no new check. What it does need is the projection rule: emit
the flag once per element, **never comma-joined**. Joining invents a separator
the tool never agreed to, and makes an element containing that separator
ambiguous.

**`requires` does not become a tool.** An agent cannot satisfy "needs network"
by calling something. It is checked when the server starts, and a tool whose
requirements are unmet is **not listed** rather than listed-and-failing —
`tools/list` is what the model plans against, and advertising a tool that
cannot run makes every plan containing it wrong.

## Three states, at the boundary

Easy to lose in a generator:

- **Projected** — the Tool has a `shell`, `container` or `inProcess` arm and a
  complete `io` block. It is listed.
- **Deliberately not projected** — `invoke.mcp` only, or `requires` unmet on
  this host. Omitted, and the omission is *reported* at startup.
- **Could not determine** — the Tool node will not parse, or its `io.*.schema`
  reference does not resolve. **This is not "omit quietly".** Fail the
  projection loudly: a server that silently drops a tool it could not read is
  indistinguishable from a layer that never had it.

## What a projector must not do

- **Do not invent a schema.** A Tool whose `io.inputs` is empty projects a tool
  taking no arguments. Guessing parameters from the shell string produces a
  contract nothing checks.
- **Do not shell-interpolate arguments.** Model-supplied values reach the
  process as an argv array, never spliced into a string a shell parses. This is
  the whole attack surface of the projection, and the one place a bug is a
  vulnerability rather than a defect. `src/mcp/project.ts` has **no code path
  that produces a command string**, which is the point: a caller cannot hand one
  to a shell because it never has one.
- **Do not project a Tool whose argv input is unconstrained.** The argv array is
  the *second* line of defence — it is a property of the caller, and a caller is
  one refactor away from a template literal. The first line is that the value
  cannot be a payload: `BeanStatus` is an enum, `BeanId` is `^[a-z0-9-]+$`. A
  Tool with a free-text argv input is **omitted with a reason**, and free prose
  goes on stdin. Full rule, and the GitHub Actions form of the same defect:
  [`untrusted-input`](../../conduct/conduct-core/untrusted-input.md).
- **Do not let the projection become the source of truth.** The generated
  server is a rendering, like the JSON Schema and the JSON-LD. A fix lands in
  `schemas/tools/tool.ts` or the Tool node, never in the emitted server — see
  [`directory-conventions`](../../kg/kg-core/directory-conventions.md) §"What lives in the
  `schemas` graph".

## Transport, and what the harness cares about

MCP servers speak stdio or streamable HTTP. **The harness has no preference and
should express none**: stdio is what a local agent spawns, HTTP is what a shared
service exposes, and the choice belongs to the layer deploying it. Record it
in the deployment, not in the Tool node — a Tool that names a transport has
swallowed a deployment decision the same way a skill that names a forge has
swallowed a Tool.

## Status

**Built, as a library.** `src/mcp/project.ts` implements this mapping:
`project()` returns declarations plus the omissions and their reasons,
`buildArgv()` produces argv (always an array) with every value parsed by its
declared type first, and `recordInvocation()` writes the audit record.

**It is deliberately not registered on a running server.** The harness is meant
to carry no tools of its own, and the hand-written MCP tools in `src/tools/`
are content to be migrated out, so wiring this to them would build on the thing
being removed. Turning it on is one call, once that migration
lands.

Three of the rules above are enforced rather than remembered:
`ToolDefinitionSchema` refuses a Tool whose only invocation is `invoke.mcp`;
`project()` omits a Tool with an unconstrained argv input and says why; and
`check:tools` fails CI on one.
