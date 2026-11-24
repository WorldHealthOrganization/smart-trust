---
name: where-does-this-go
description: >
  The router for filing decisions. This repository answers "where does this
  go?" ten separate times; this says WHICH question you are asking, so an agent
  who does not know a rule exists can find it. One discriminating question per
  row, and the skill that owns the answer.
allowed-tools: Read Grep Glob
graph-typologies:
  - code
consulted: true
---

# Where does this go? — the question, then the skill that answers it

> Skill id: `where-does-this-go` · Package: `folio-core`

**This skill answers nothing.** It is a switchboard: you arrive knowing you
have something to put somewhere, and it tells you which of this repository's
filing rules you are actually standing in front of. The rule itself lives in
its skill: every row below is a **question and a pointer**, never a summary of
the answer, because a summary would be free to disagree with its skill.

## Why a router at all

Each specialised answer is well argued in isolation, but an agent who has not
realised they are, say, choosing a graph kind files by resemblance to the last
thing they filed. **An agent who does not know a rule exists cannot look it
up**; this table puts the rules side by side.

## The ten questions

Read down the middle column until one matches what you are actually deciding.
If two match, you have two decisions, not one — take them in the order below,
because the earlier rows decide the object and the later ones decide its
placement.

| # | the question you are actually asking | who answers it |
|---|---|---|
| 1 | Is this a work item, a sign-off, or a code review? | `issue-working` (opt-in `cat-harness.sdlc`) §"What an issue is *for*, against its neighbours" |
| 2 | Is this feature work that needs a GitHub issue first? | `crdm-detect` §"Issue association" |
| 3 | What TYPE of work item is it, and under which parent? | `todo-manager` (opt-in `cat-harness.work-plan`), and `check:bean-parents` enforces it |
| 4 | Does a work item for this already exist? | `todo-manager` §"Check before you create" |
| 5 | May I claim it — is a sibling already on it? | `bean-coordination` §"Claims are global via the branch store" |
| 6 | Which directory, and what KIND of graph does it hold? | [`content-context-and-state-graphs`](../../kg/kg-core/content-context-and-state-graphs.md) and [`directory-conventions`](../../kg/kg-core/directory-conventions.md) |
| 7 | Is this an adapter, a profile, or a visualiser? | [`content-profiles`](../../authoring/authoring-core/content-profiles.md) |
| 8 | Does this belong in `AGENTS.md` or in a skill? | [`AGENTS.md`](../../../AGENTS.md) §"What is specific to THIS layer" — **always the skill** |
| 9 | Is this a skill, or an agent's memory? | [`agent-memory`](agent-memory.md) |
| 10 | Am I adding a new LAYER (a harness) or a new graph TYPOLOGY — and what does it owe, and how does it relate to the layers it sits beside? | [`instance-kinds`](../../kg/kg-core/instance-kinds.md) first (most new things are not a new kind; the `cat-` / `folio-assistant-` / `who-` prefixes), then [`harness-requirements`](../../kg/kg-core/harness-requirements.md) (the five obligations, and a node's `.json` / `.jsonld` / `.schema.json` IRIs), [`associate-harness`](../../kg/kg-core/associate-harness.md) (`needs` vs `associatedHarnesses`) and [`instance-publication`](../../kg/kg-core/instance-publication.md) (ids and release IRIs, and which graph is published where, under which IRI, with which schema, and what is stripped) |

The count in the heading is a claim about the table beneath it: when a row is
added, update it.

## Two rows that are easy to confuse, and the discriminator for each

**Rows 1 and 3.** "Bean or issue?" and "what type of bean?" feel like one
question and are not. The first asks what KIND OF OBJECT this is — a work item is
the work plan, an issue is where a human signs off, a PR is where code is
reviewed. The second only arises once row 1 has answered "bean".

**Rows 6 and 7.** Both sound like "what is this thing?". Row 6 is about a
DIRECTORY and its graph; row 7 is about a CONTENT TYPE and its vocabulary.
The discriminator: row 6 asks *what does a running process do with this —
produce it, read it, or write it as it goes*; row 7 asks *whose vocabulary is
this word from, and may this folio use it*. A directory has no vocabulary and
a block kind has no `holds`.

## When no row matches

**That is a finding, not a licence to improvise.** Say so — in the turn, to
the person — and propose where it would go if a new row existed.

If the same unmatched question recurs, it has earned a row, and the route to
adding one is [`surprise-to-corpus`](../../kg/kg-core/surprise-to-corpus.md): the recurrence is
the evidence, and the person decides.

## What this skill is NOT

It is not a decision procedure you run every turn: a router consulted for
every obvious filing gets skipped, taking the non-obvious cases with it. Reach
for it when you
notice yourself **about to guess** — the same trigger
`opening-brief` uses.
