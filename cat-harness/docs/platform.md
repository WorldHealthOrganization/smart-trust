---
layout: default
title: The platform — actors, roles, processes, skills
lang: en
description: "What the platform does, and how its processes, roles, tasks and skills fit together."
nav_exclude: true
---

<!--
  AUTHORED. Two rules for this page:

  1. REFERENCE the generated indexes, never restate them. If a sentence here
     could be produced by reading a generated page, delete it, because a second
     copy is free to drift from the first.
  2. NO COUNTS IN PROSE. The indexes carry live counts; link, and let the
     index say how many, because a typed number is wrong the next time a
     diagram is added and nothing checks it.

  `nav_exclude` is deliberate; the page is reached from the Home page link,
  because a page reachable only by typing its URL is a page nobody reads.
-->

# The platform
{: .fs-9 }

The platform half of folio-assistant: the skills, schemas, processes and MCP
server an agent uses to author a folio. **It holds no subject matter.** A paper,
a WHO SMART Guideline, an Implementation Guide — those live in their own
repositories and layers, and this one is the machinery they run on.
{: .fs-6 .fw-300 }

---

## One sentence, and every word in it is a declared object

> **An actor performs a task in a process as a role, using that role's skills.**

The five nouns are five different things:

| | what it is | why it is not the one next to it |
|---|---|---|
| **Actor** | a concrete participant — a person, an agent session, a scheduled job | persists across processes; a role does not |
| **Role** | the BPMN **swimlane** — a persona an actor takes on for the duration of a lane | nobody *is* a reviewer; somebody **acts as** one, here, now |
| **Task** | one activity in one diagram | the unit of work, not the ability to do it |
| **Process** | the diagram itself: lanes bind roles, activities name skills, gateways may compute a branch | the shape of the work, not an instance of it |
| **Skill** | the instructions the actor needs to perform the task | knowledge, not permission — what an actor *may do* is a W3C ODRL policy in `policies/` |

The full model is the
[`role-model`]({{ '/reference/skill-instructions/role-model.html' | relative_url }}) skill.

## Processes — every one is BPMN, and the diagrams are executable

The `.bpmn` file **is** the source of truth: `workflow_start`, `workflow_next`,
`workflow_gate` and `workflow_complete` run it, `workflow_complete` refuses a
step that holds no token, and the running instance is stored so a sibling
session sees the same position. A diagram that disagrees with what the tools do
is therefore a defect in the diagram.

**Entry point or step inside another — the distinction is derived, not
labelled.** A process that no other diagram *calls* is somewhere work begins:
you enter it deliberately. A process named by a `callActivity` somewhere else is
a step inside that larger one, and entering it directly means starting in the
middle of something. Nothing marks this in the file; it falls out of who calls
whom, which is why it stays true as diagrams are added.

For example, **Content acquisition** is an entry point: nothing calls it.
**Adjudication** is not — it is called from the **Translation Workflow**, from
the **Ingestion subprocess — the L1 completeness gate**, and from **Refresh
materialized remote content**, and is what one of those reaches when it needs a
decision. **Criterion adjudication** is a level further in, called by
**Wireframe design review** and **Voice overlay review**. A process whose title
sounds like a verb is not evidence that you may enter it; ask the index who
calls it.

Before you open one:

- **A lane is an accountability boundary.** When a token crosses into another
  lane, who is answerable for the next step changes, which is why "say which
  process you are in" is a rule rather than a courtesy.
- **An activity names the skill that performs it.** A step whose skill is
  missing is a finding rather than a blank.
- **A gateway may be computed.** Where a branch is backed by a DMN table, the
  agent supplies the *facts* and the table returns the branch. A hand-supplied
  outcome is refused, so nobody talks their way past a gate.

**[Every process, with its lanes, its activities and the skills they name →]({{ '/cat-harness/auto-docs/index/processes/' | relative_url }})**
That index is generated from the diagrams on every build, so it is what the
repository contains rather than what this page remembers.

## Roles, tasks and skills

Skills are knowledge-graph content, not a directory to memorise. An agent asks
for one — `skill_list` for what exists, `skill_fetch` for a named skill's
instructions — and a layer **inherits** its dependencies' skills through
the same declaration, so what is reachable depends on where you are standing.

**[Every skill, by sub-graph →]({{ '/cat-harness/auto-docs/index/skills/' | relative_url }})**

Roles are declared in `scenarios/roles.json` and bound to lanes by the
diagrams; what an actor may do is an ODRL policy in `policies/`, because it
cross-cuts the lanes the actor acts in. `bun run cat kg:audit` checks one
criterion per join between them and writes its findings as sidecars rather than
console output, because a printed verdict is gone, and without it "unbound
since it was drawn" and "broken in the commit under review" look the same.

**[Every role, with the skills its lane carries →]({{ '/cat-harness/auto-docs/index/roles/' | relative_url }})**

**[Every task, by the process that draws it →]({{ '/cat-harness/auto-docs/index/tasks/' | relative_url }})**

A role is as likely to be **mechanical** as human. **Adjudicator** and
**Business analyst** are personas a person or an agent takes on; **Build
pipeline**, **Attestation service** and **Activity log** are lanes held by
something that is not a person at all, and they share one list because a
swimlane does not care.

Tasks are the individual steps inside a diagram — **Read the sidecar
findings**, **Classify what changed**, **Accept, or send back**, **Authorise
the extraction**. There are an order of magnitude more tasks than processes,
which is why the task index is a reference rather than a reading list. Open it
when you want to know which diagram a step belongs to; the lane it sits in says
who is answerable for it.

## What the handler publishes

`/cat-harness/` is a **handler namespace**. Every route under it is
`<base>/<handler>/<kind>/` — the platform rendering one declared graph — and the
handler segment is read from the layer's declared `name`, never composed.
`<base>/<instance>/` is a layer presenting itself; where the two rules meet
at one path, the handler wins.

| | what it shows | generated by |
|---|---|---|
| [auto-docs]({{ '/cat-harness/auto-docs/' | relative_url }}) | derived indexes over a sub-graph — [processes]({{ '/cat-harness/auto-docs/index/processes/' | relative_url }}) and [skills]({{ '/cat-harness/auto-docs/index/skills/' | relative_url }}) | `gen-auto-docs.ts` |
| [library]({{ '/cat-harness/library/' | relative_url }}) | the L1 corpus: what is ingested, how far, what references it, and what is still queued | `gen-library-viz.ts` |
| [schemas]({{ '/cat-harness/schemas/' | relative_url }}) | the schema graph — declarations and the edges between them | `gen-schema-viz.ts` |
| [voices]({{ '/cat-harness/voices/' | relative_url }}) | every voice a layer declares, and the passage each rule was read from | `gen-voices-viz.ts` |

Each is regenerated from the tree it describes, so a stale one is a build
problem rather than an editing problem. **This page is not**: if you
change how processes, roles or skills relate to each other, change it here too.

## Where to go next

- [Getting started]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }}) — the first five minutes
- [Agentic harness]({{ '/docs/cat-harness/concepts/agentic-harness.html' | relative_url }}) — the agent–user interaction model, idle and workflow states
- [Publication workflow](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html) — the normative picture of the review and publish path
- [Work items and todos]({{ '/docs/cat-harness/guides/beans-and-todos.html' | relative_url }}) — the work plan
- [CRDM]({{ '/docs/cat-harness/process/crdm-methodology.html' | relative_url }}) — what happens when a request is a feature request rather than content work
