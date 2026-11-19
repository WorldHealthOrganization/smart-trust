---
title: "The tool graph"
nav_order: 41
description: "What a Tool is, how it differs from a skill, and how the two are joined without being conflated."
documents:
  - cat-harness/tools
---

# The tool graph

{: .fs-6 .fw-300 }
A **Tool** is one concrete way to exercise a capability. A **skill** states
that capability generically. They are two graphs, and this page is about the
first one.

[Browse the tools]({{ '/tools/' | relative_url }}){: .btn .btn-primary }

---

## One sentence, and every word in it is a different object

> **An actor performs a task in a process as a role, using that role's skills —
> and a tool is one concrete way to exercise one.**

The first half is the [role model](skills.md). This page is the last clause.

| | what it is | authored as |
|---|---|---|
| **Skill** | the instruction body an actor reads — what you need to *know* | markdown in the `kg` graph |
| **Tool** | one way to *do* it — an installation, an invocation, typed inputs and outputs | JSON, `tools/<id>/<id>.json` |

A skill may be satisfied by several tools. A tool may satisfy several skills.
Neither contains the other.

## The relation is `satisfies`, and it has a direction

A Tool node carries `satisfies`, naming the skills it is a way of exercising.
The arrow runs **from a tool to a skill** and never back:

```
tool  --satisfies-->  skill
```

Read tool-to-skill it says *"this is one way to do that"*; reversed it would
say *"this skill is a tool"*, which is false, so tools and skills are kept
separate. A skill does **not** list its tools: "what can exercise this skill?"
is a query over the tool graph, not a field on the skill, because the answer
changes whenever a tool is added and a skill's correctness must not depend on
the tooling around it.

The tools graph has its own page because an absent `docs` reference is a
legible gap, while one that resolves to a page about something else reports
coverage that does not exist.

## How a Tool node is authored

A Tool node is a JSON file, `tools/<id>/<id>.json`, declaring
`"$schema": "tool-definition/v1"`, one folder per Tool. The tools layer's
`defineTool` (`schemas/tools/tool.ts`) validates a definition against the same
schema, so a malformed node is refused when it is loaded. The JSON-LD and JSON
Schema renderings and the [generated view]({{ '/tools/' | relative_url }}) are
generated from them.

## What the generated page reports

Beyond the census, two questions it answers rather than assumes:

**Does every `satisfies` name a skill that exists?** A dangling one is a tool
advertising a capability the graph cannot locate. The page prints "all resolve"
when none dangles, rather than leaving it implied by an absent warning, because
*nothing unresolved* and *the check did not run* are different facts.

**Does any tool satisfy nothing?** A separate gap: the tool exists and nothing
says what capability it is a way of exercising.

## See also

- [Skills & roles](skills.md) — the other graph, and the role model
- [`skills-and-tools`](../reference/skill-instructions/skills-and-tools.md) — the
  governing skill
