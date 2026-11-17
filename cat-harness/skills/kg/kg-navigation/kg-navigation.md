---
name: kg-navigation
description: >
  How a cold agent finds and loads the skill that governs its task. The two
  Tools that serve the knowledge graph — the MCP pair and the filesystem
  fallback — what counts as a skill, and the three ways the search goes wrong.
adapters: [document, paper, dak]
profiles: [document, paper]
consulted: true
---

# Reading the knowledge graph — how to find the skill you need

You are in a fresh container. You have a task, a filesystem, and no memory of
how this repository is laid out. **This is the route**: ask for a skill
rather than opening a file, because a hardcoded path is how a skill goes
missing the moment the layout moves.

## The one fact everything else follows from

**Skills are content in a declared graph, not files in a directory you
memorise.** A layer says where its graph is, in its declaration at its
repository root. It may put it anywhere. In *this* layer the entry reads:

```json
{ "id": "skills", "path": "skills/", "graphTypologies": ["skills"] }
```

Read that as three separate things, because they change independently:

| | what it is | stable? |
|---|---|---|
| `id` | this layer's name for the directory | stable across a relocation — that is its job |
| `path` | where it happens to be **here** | not stable, and not yours to assume |
| `graphTypologies` | what kind of graph lives there | the vocabulary, shared across layers |

An agent that learned `skills/` learned the one column that is allowed to
change. Ask for the graph; do not navigate to the path.

> **`kg` is a deprecated alias.** `GRAPH_TYPOLOGY_ALIASES` in
> `schemas/kg/cat-harness.ts` maps `kg` → `cat-harness`, so a declaration or a
> query using `kg` resolves and is marked deprecated. **Do not read `kg` as a
> directory `id`** — in this layer the id is `skills`.
>
> **A Subgraph id is its name inside its Harness**, and the Harness name
> qualifies it: `cat-harness.skills`, `bootstrap.skills`.
> `RENAMED_DIRECTORY_IDS` in `schemas/kg/cat-harness.ts` reads a legacy id
> `cat-harness` as `skills`.

## Tool 1 — the MCP pair

When an MCP server is attached, two calls answer the whole question.

1. **`skill_list`** — every servable skill **with its one-line summary**,
   grouped by package. The summary is what lets you pick without fetching.
2. **`skill_fetch skill="<id>" package_name="<package>"`** — the instruction
   body, to follow.

For the work plan rather than a skill, **`work_plan_prime`** returns the work items
and each running process's position beside its work item.

**What `skill_list` serves is the package registry.** `LOCAL_PACKAGES` in
`scripts/skill-packages.ts` is built from `resolveSkillDirs`
(`schemas/kg/harness-config.ts`), which computes the cross-layer overlay
from the declarations, so **a dependency's skills are reachable**. A package
the registry omits is invisible to `skill_fetch`, and `workflow_next` would
hand an agent a skill that answers *"package not found"*; `kg:audit`'s
`skill-servable` criterion checks for that.

## Tool 2 — the filesystem, when there is no MCP

**The harness is designed to work with nothing but files.** Same graph, same
content, no server:

1. Read `<name>.json` at the repository root.
2. Take every `directories[]` entry whose `graphTypologies` includes `skills`
   (in a declaration with no `skills` entry, `cat-harness`, accepting `kg` as
   its deprecated spelling).
3. Read the `.md` files under each — one skill per file, the id being the
   basename.

Both Tools serve the same nodes. Neither is the skill: *knowing that a fallback
exists* is the capability, and an agent that only knows the MCP route is an
agent that stops when the server is absent. See
[`skills-and-tools`](../../tools/folio-core/skills-and-tools.md) for why that distinction is enforced
rather than merely preferred, and [`directory-conventions`](../kg-core/directory-conventions.md)
for the declaration's schema and the full list of graph typologies.

## Not everything under the path is a skill

Three rules, each a **declaration** rather than a guess about a filename. `scripts/known-skills.ts`
is the single implementation; `kg-audit` and `check-workflow-refs` both read it
so they cannot disagree.

- **`.claude/skills/` is not uniformly skills.** `actors/`, `capabilities/`,
  `roles/`, `hooks/` and `requirements/` are other node kinds that live there;
  reading the tree as skills makes a skill ref resolve to, say, a capability
  probe.
- **A `.md` under the skills path that declares its own `$schema` is not a
  skill.** The agent-memory nodes under `memory/` declare
  `folio-memory/v1`; read as skills, they would get bogus QA sidecars.
  Declaration over location.
- **Some skills exist in three copies and only two are checked.**
  `skills/tools/folio-core/<name>.md` is hand-authored;
  `docs/reference/skill-instructions/<name>.md` is **generated** from it and
  CI-gated, so editing the source without running
  `bun run cat-harness-tools/scripts/gen-skill-docs.ts` takes `main` red;
  `.claude/skills/local/<name>.md` is hand-authored and gated by **nothing**,
  while carrying the most inbound references. **Read the `skills/` copy. Edit
  the `skills/` copy. Regenerate the mirror in the same commit.**

## When the skill you want does not exist

Say so; do not improvise one silently. Coverage is a measured property here and
a gap is information: `skill-in-role-or-process` reports how many skills no role
carries and no activity names, and that number is **not** a defect list — a
skill invoked directly by name is doing its job without appearing in any
diagram. The same applies in reverse. A procedure you had to invent is worth one
sentence in your turn report and, if it will be needed again, a work item.

## How you know you did this right

You can name the graph you read, the Tool you read it with, and the skill you
are following — without having typed a path you learned somewhere else.
