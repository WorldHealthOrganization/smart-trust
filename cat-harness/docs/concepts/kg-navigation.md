---
layout: default
title: KG navigation
nav_order: 43
lang: en
---

# kg-navigation

> The skill itself is [`skills/kg/kg-navigation/kg-navigation.md`](../../skills/kg/kg-navigation/kg-navigation.md).
> This page is the package's README, kept here because a skill package holds
> skills only.

**How an agent finds the knowledge graph, and the skill that governs its task,
before it knows the layout.**

A skill package of the cat-harness knowledge graph, under `skills/kg/`. It is
not a top-level layer, because a layer that declares no `needs` has no
layer, and `kg:detangle` can then only report its edges as undetermined.

It sits under the declared `skills/` graph rather than in
`cat-harness/kg-navigation/skills/` because `skill_fetch` names a
directly-held `skills` directory after its layer, which would serve this
package as `cat-harness`. A subdirectory of `skills/` takes its own basename as
its package name, as `folio-core` and `crdm` do, so `skill_fetch` serves it as
`kg-navigation`. It is not a declaration inside a declaration: `skills/` owns
this directory like every other package.

## If you are cold, read the skill, not the directory

Ask for it: `skill_list`, then `skill_fetch`. **Do not open a path under
`skills/` from memory.** The graph a layer declares is what resolves, and
a hardcoded path is how a skill goes missing the moment the layout moves.

## Two bodies, one subject — do NOT delete one as a duplicate

| where | precondition |
|---|---|
| [`bootstrap/skills/bootstrap-kg-navigation.md`](../../../bootstrap/skills/bootstrap-kg-navigation.md) | **nothing installed** — no MCP server, no `skill_fetch`, no `beans`, no build |
| [`kg-navigation.md`](../../skills/kg/kg-navigation/kg-navigation.md) | the tooling is reachable — the MCP pair, and the filesystem fallback |

They answer the same question **under different preconditions**, so neither is
a copy of the other, and merging them would leave one caller unable to run
what it was given. Bootstrap's **must** stay in bootstrap: it is phase one with
nothing installed, and a bootstrap that reached into another layer for its
first skill would fail in the cold-start case it exists for. Keeping the two
as separately named skills lets both be **addressed** without either shadowing
the other.

If you are about to "consolidate" these, first answer: **which precondition
does the surviving body assume?** Whichever you pick, the other caller is
broken.

**Do not put a count in either body.** A count in prose is a claim nothing
checks.

## Known gap

`bun run cat kg:audit` reports, in `kg-qa/scenarios/kg.kg-qa.json` under
`test/results/` (kept on the `qa-reports` branch):

> no role carries `"kg-navigation"` and no activity names it — reached, if at
> all, by direct invocation.

and five findings in `bootstrap.kg-qa.json` of the form *"needs skill
`kg-navigation`, but its lane's role `onboarding-agent` does not carry it."*
The bootstrap diagram asks for this skill five times and the role in that lane
does not have it. The fix is a role-graph binding, not a location.
