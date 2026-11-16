---
name: mcp-assembly
description: >
  Compose several Tool nodes into one MCP service — naming, collisions,
  grouping and versioning. Read when a service will expose more than one tool,
  or when two layers' tools land in the same namespace.
---

# MCP assembly — many Tools, one service, one namespace

[`mcp-projection`](mcp-projection.md) maps **one** Tool node to one MCP tool.
This is what happens when there are several, which is the normal case and where
the problems are: a flat namespace shared by tools from a layer, its
dependencies, and whatever else the agent has mounted.

## Naming — the model reads these, so they are an interface

An MCP tool name is what a model pattern-matches against when deciding what to
call. It is not an identifier that merely has to be unique.

**`<subject>_<verb>`, lower snake case.** `bean_claim`, `bean_list`,
`folio_render`. Subject first, because an agent scanning `tools/list` is
looking for the *thing* before the *action*, and because it groups related
tools adjacently in a flat list with no grouping mechanism.

- **Verbs are from a closed set**, and a new one needs a reason:
  `list`, `get`, `create`, `update`, `delete`, `run`, `check`, `sync`.
  `bean_fetch` beside `folio_get` costs a model a guess on every call.
- **Never encode the transport, the vendor or the binary.** `github_pr_create`
  names a forge in a name a skill is supposed to reach generically; the
  neutral `pr_create` with per-forge Tool nodes behind it is the shape
  [`skills-and-tools`](skills-and-tools.md) asks for.
- **Never version in the name.** `bean_claim_v2` beside `bean_claim` asks the
  model to choose, and it will sometimes choose wrong. See versioning below.

## Collisions are refused, not resolved

Two Tool nodes projecting to one name is an **error at assembly time**, not
something to paper over by prefixing the loser.

`ContributionRegistry` and `GraphTypologyRegistry` follow the same rule:
automatic disambiguation means the name a caller
gets depends on load order, and load order is not something anybody reasons
about. Refuse, name both contributors, and make somebody choose.

**One exception, and it is the diamond case**: the *identical* Tool node
reached twice through a dependency graph is a no-op, not a collision. Identical
means same `id`, same `io`, same `invoke` — not merely the same name.

## Prefixing across layers

A layer inherits its dependencies' Tool nodes the same way it inherits
their skills. When two *different* layers contribute a tool of the same
name, the collision rule above applies — but the fix is a **declared prefix on
the contributing layer**, not an ad-hoc rename at the consumer:

```
fa_bean_claim        # folio-assistant's
qou_bean_claim       # the folio's, if it genuinely has its own
```

A prefix belongs to the layer and is written down once, so the same tool has
the same name everywhere it appears. A consumer that renames what it imports
produces a namespace nobody else's documentation matches.

## Versioning

**The service is versioned; the tool name is not.** A breaking change to a
tool's schema is a version bump on the server, announced in its metadata, not a
second tool beside the first.

When both must run at once — a migration window — run **two servers**, not one
server with two generations of tool. The agent's mount configuration then says
which it is talking to, which is a place a human can look, rather than the
model choosing from a list where both look plausible.

## Grouping, given MCP has none

MCP's tool list is flat: there is no namespace, no category, no folder. The
`kg/` grouping this harness uses for skills has **no counterpart** in the
protocol.

So the grouping has to survive in two places instead. **The name carries it**
via the subject-first rule — `bean_*` sort together and read as a family. **The
description carries the rest**: the first clause of `tools[].description` should
make the subject unambiguous without the name, because a model that has
truncated or reordered the list is reading descriptions.

Do not attempt to recreate grouping with separators (`bean/claim`,
`bean.claim`). Clients render names literally and some validate them against a
restricted character set, so a separator is a portability bug.
