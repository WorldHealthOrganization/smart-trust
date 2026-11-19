---
name: kg-contribution-offer
description: >-
  Ask whether agreed requirements should become knowledge-graph content, and as
  what — in a form the person can answer by selecting. Use at the end of CRDM
  sign-off, or whenever a body of agreed work could become a skill, a process,
  a schema or a work item and nobody has been asked. Offers "none" as a first-class
  answer.
agents:
  - platform-boundary-guard
---

# Offering the knowledge graph

When a person is done with requirements on some workflow, ask whether and how
to add them to the knowledge graph, and give options. CRDM sign-off is the
usual moment: without this step, agreed requirements exist only as an issue
and a conversation, and no later agent finds them.

## What this skill is NOT

It is **not** a decision procedure for where a node goes. That is
[`placement`](placement.md), and it is an *agent's* procedure: which layer,
which declared graph, which kind of node, which stub convention. Run it **after**
this skill has an answer, not instead of it.

It is **not** general guidance on asking questions. That is
[`interaction-modality`](../../conduct/conduct-core/interaction-modality.md) §4.1, and this skill does not
restate it — it obeys it, and supplies what the options are here.

It is **not** what to do when the author CORRECTS a rule. That is
[`symbiotic-interaction`](../../conduct/conduct-core/symbiotic-interaction.md) §2, and it runs the other
way: the node already exists, the author has just said it is wrong, and the
correction is written into it **in the same turn without an offer**, because
offering there asks the author to repeat a correction already made.

The line between the two is one question: **does the rule already have a home?**
A ruling on something already in the graph is an edit and needs no offer; a
ruling that implies a node which does not exist is this skill's case, unless the
author named the destination themselves.

The division in one line:

> **This skill decides what to offer. `symbiotic-interaction` §2 decides what
> needs no offering. `placement` decides where the answer lands.
> `interaction-modality` decides the shape of the asking.**

## The rule

> **The agent never picks a destination silently.**

An agent that decides on its own that a requirement "is really a skill" and
writes one has made a node nobody asked for, in a graph somebody else
maintains. If the person does not answer, the default applies — and **the
default creates nothing.**

## One question, not two

"Should this enter the knowledge graph at all" and "as what" are asked as
**one** question: destinations as options, **`none` among them**, and a stated
default. Two rounds cost a low-dexterity person a real interaction; listing
`none` keeps the single question from forcing an answer.

## One question for the SET, not one per requirement

A CRDM run can agree many requirements. Asking once per requirement is
redundant entry (WCAG 2.2 SC 3.3.7), so the offer **names the set** and asks
once. If the person wants different
destinations for different items, they say so and the agent asks follow-ups
about the ones that differ. That path is opened by their answer, never assumed.

## The options are DERIVED, never invented

The destinations are the graphs this layer declares, in `<name>.json` —
read at the time of asking, never a list typed from memory.

**Not every declared graph is an authorable destination.** A store that is
*incoming* (`uploads`), *derived* (`qa`, `health`, `translation-sources`) or a
*record of something that already happened* (`issue-marks`, `memory`) is not
somewhere a requirement is authored into. Offer the graphs whose nodes a person
writes:

| offer | because |
|---|---|
| a **skill** (`cat-harness`) | the requirement is a rule an agent must follow |
| a **BPMN process** (`cat-harness`) | it is a sequence with lanes and gateways |
| a **schema** (`schemas`) | it constrains the shape of data |
| a **Tool** (`tools`) | it is a capability with declared io |
| **documentation** (`docs`) | it is a **design-memory asset** — see below |
| a **work item** (`beans`) | it is work to be done, not knowledge to be kept |
| an **`fsh-guts` proposal** | it is a design not yet agreed — and see the warning below |
| **folio content** (`folio`) | it is subject matter, not platform |
| **none** | it is already captured by the issue and the code |

## The design-memory asset, and the question that identifies one

A design record — an asset produced while building a feature, accessing data,
or managing or rendering a type of content, but not the content to be
displayed — goes into `docs/`. **One question separates this class from every
other destination:**

> **Was this produced while BUILDING something, rather than being the thing
> that was built?**

A requirement set, an options analysis, a measured comparison, the reasoning
behind a schema: each is an artefact of the work rather than its output. It is
not subject matter, so it is not `folio`. It is not a rule an agent follows,
so it is not a skill (a skill is read by an agent about to act; a design
record by a person asking *why is it like this*). It is not work outstanding,
so it is not a work item. **It is memory**, and `docs/` is where a layer keeps
memory a person reads.

### Not `fsh-guts`

`fsh-guts` is the declared **non-rendered trashcan**, whose content may be
thrown away or lost. A proposal not yet agreed can afford to be lost; the
reasoning behind something already built cannot.

### WHOSE `docs/` — the owning layer's, not the repository's

**`docs/` is not one place.** It is a declared graph, and the layer that
owns a harness, feature or tool owns its detailed information, design and
planning. Ask [`placement`](placement.md) Step 1's question: **which layer
owns this?** A design record for a `cat-harness` feature files in
`cat-harness/docs/`; one for a folio's own subject matter does not belong in
the platform at all.

### What else belongs there, and the line against a skill

Besides the design record, `docs/` holds:

- **how to reach the data** a piece of content describes — endpoints,
  credentials policy, shapes, quirks of a source;
- **everything past the competence line**, which is the sharp test:

> **A skill carries what a competent practitioner needs IN ORDER TO DO the
> task. Anything beyond that is documentation.**

Background, derivations, options not taken, and an API's full surface when
the task touches three calls are documentation. Conversely, a rule an agent
must follow, filed in `docs/`, is a rule `skill_fetch` will never serve.

**Where in that layer's `docs/`** is [`placement`](placement.md)'s question,
not this one.

`none` is a real answer: a requirement whose whole content is *"the button
should be blue"* becomes a commit and nothing else.

## What the agent does with the answer

1. Run [`placement`](placement.md) for the chosen kind — it decides layer,
   graph and node kind, and catches a hardcoded path or a literal naming one
   folio.
2. Create a **work item** for the authoring work, parented to the feature's epic.
   The offer produces a decision, not a node; writing it is work, and work is
   a work item before it is a file.
3. Record the answer where the next agent will see it — on the issue, with the
   round summary `issue-working` (opt-in `cat-harness.sdlc`) already requires.

On `none`, record that too (*"asked, answered none, because the requirement
is carried by the code"*): otherwise it is indistinguishable from never having
asked.

## Related

| | |
|---|---|
| the shape of the asking | [`interaction-modality`](../../conduct/conduct-core/interaction-modality.md) §4.1 |
| a correction to a rule that already exists — no offer | [`symbiotic-interaction`](../../conduct/conduct-core/symbiotic-interaction.md) §2 |
| where the answer lands | [`placement`](placement.md) |
| the process step | [`crdm-signoff.bpmn`](../../../processes/process/crdm-signoff.bpmn) |
| the round summary that records it | `issue-working` |
| why work becomes a work item first | `todo-manager` (opt-in `cat-harness.work-plan`) |
