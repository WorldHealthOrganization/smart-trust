---
# folio-assistant-uoij
$schema: bean/1.0.0
title: kind:register — one command performs the SEVEN artefacts adding a graph kind obliges, the way skill:register does for a skill
status: completed
type: task
priority: normal
created_at: 2026-10-04T05:32:27Z
updated_at: 2026-10-07T17:32:00Z
parent: folio-assistant-0lmb
---

Owner chose this on 2026-10-04, as item 2 of three ("1 2 3") after #2032 went green.

## The measurement that makes it a bean rather than an idea

Adding the `docs-auto` kind on #2022, I ran **six hand-picked `check:*` commands** and
they all passed. `bun run cat gates` then found **5 failures across 217**, and `bun test`
found two more:

| obligation | found by | generated? |
|---|---|---|
| `readme:subgraphs` — two READMEs whose regions count files | `gates` | yes |
| `handler:index` — `published-graphs.md` | `gates` | yes |
| `docs:harness` — `docs/_data/harness.json`, which the navbar reads | `gates` | yes |
| `avatars:css` — the generated stylesheet, both schemes | **`bun test`** | yes |
| `navbar:include` | `gates` | yes |
| the **avatar** — glyph, hue, a sentence | `gates` | **authored** |
| the kind table in `directory-conventions.md` | **`bun test`** | **authored** |

**Seven, five generated and two authored.** `skill:register` performs exactly this
chain for a skill and `skill:register:check` is what makes the obligation binding;
there is no equivalent for a kind, so the chain is performed from memory — and
`skill-registration`'s own record is that the list *"was recalled wrong four times
before it was measured"* (beans `v625`, `nfv3`).

## Why a subset reporting clean is the whole problem

Each stale artefact's failure names a **generated file**, never the kind you added, so
the cause is invisible from the symptom. That is why `skill-registration` says the
remedy is a command rather than a list.

And `gates` alone is not the check: `bun test` found two of the seven, which is bean
`ymsu` — `bun test` *runs* some writers, so a gates run can report their artefacts
current when they are not. `skill:register` already answers this by verifying each
check **on its own, never through `gates`**; this must do the same.

## Done when

- [ ] `bun run cat kind:register` performs every derived artefact a new graph kind owes and
      verifies each one landed, each check run on its own rather than through `gates`
- [ ] `kind:register:check` is a CI gate, since an unenforced obligation is the state
      this bean exists to leave
- [ ] the **two authored** artefacts are reported rather than written — an avatar's hue
      is a design decision (the `docs-auto` glyph collided with `requirements` at 164°
      and was only caught by rendering them side by side), and a kind-table row is
      prose. A command that invents either would be worse than one that names them.
- [ ] a hue-collision check, or a recorded reason there is none: that collision was
      invisible to every gate
- [ ] mutation-checked — remove one artefact, confirm the command names THAT artefact
      and not a generated file downstream of it

## Explicitly not in scope

Not a second answer to `skill:register`. A kind and a skill oblige different artefacts
and share no writer; folding them into one command would mean one list that is wrong
for both.

## Completed on landed evidence
Landed on main in PR #2032 (kg(docs): declare the two uml-overview routes — and the dh4f gap that made the declaration unverifiable).
