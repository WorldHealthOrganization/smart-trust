---
name: data-modelling
description: >
  Build a data model: identify the entities a body of work is actually about,
  the relations between them, and the cardinalities — then declare it where
  the tools can read it. Process-agnostic technique; the CRDM phase that
  invokes it is `crdm-data-model`.
allowed-tools: Read Grep Glob Bash
---

# Data modelling — the entities, before the fields

**One question, and everything else follows from it:**

> **What are the things, and what is true of each of them exactly once?**

A model is wrong in a way no schema check can catch when a fact that belongs
to one thing is written on another. Typical shapes: a fact about a capability
(*what substitutes for it*) copied onto every skill that uses it; a fact a BPMN
diagram already states executably (*which role takes over*) repeated on a
skill; a field naming performers in a vocabulary that resolves against
nothing. Each is a field on the wrong entity, or a second copy of a fact that
already has a home. Modelling first catches them, and costs far less than
unwinding them later.

## The procedure

### 1. Name the entities, as nouns a domain expert already uses

Not the tables you expect to build. If the people who do this work say
"attestation", the entity is Attestation, even when it will be stored beside
something else. A name you invented is a name nobody will look up.

**Stop when two candidate entities have the same identifier.** They are one
entity with two names, and carrying both is how a codebase ends up with a
Role registry and an actor-id vocabulary that do not resolve against each
other.

### 2. For each entity, say what identifies it

An entity with no identifier is an attribute of something else — that is the
test, and it is decisive. If you cannot say what makes two of these the *same
one*, you have found a field rather than a thing.

### 3. Put each fact on the entity it is about

For every fact, ask **whose property is this?** The question that settles the
hard cases:

> If this entity disappeared, would the fact still be true of anything?

*What substitutes for X* survives the disappearance of every skill that uses
X, so it belongs to X. *What this skill does when X is missing* does not —
it is the skill's.

### 4. State cardinality in both directions, and mean it

"One attestation per report" and "one report per attestation" are different
claims, and a model that states only the first cannot tell you whether a
re-signature is an update or a second row. Write both. Where the answer is
"many", say what ORDERS them or admits there is no order.

### 5. Say which facts are derived, and never store those

A derived fact stored is a cache, and an unvalidated cache is worse than no
cache. If a value can be computed from the model, computing it is the
declaration — the role a process falls back to, for example, is recoverable
from the diagram that executes it.

### 6. Declare it where a tool can read it

A model in prose is a proposal. A model in the declaration is a model. In this
repository that means a graph typology in `<name>.json`, a Zod schema under the
declared `schemas` directory, and a node kind that `kg-export` knows —
`placement` is the skill that decides which.

**And ship a reader in the same change**, because a field that is only
documentation goes inert. A field with no consumer is not a model, it is a
comment with punctuation.

### 7. Model VARIATION as inheritance, and earn a new kind with BEHAVIOUR

Two things are nearly the same. Do they get one type with a discriminator, two
types, or one type and an override?

> **A new KIND is earned by a BEHAVIOUR difference — a consumer has to DO
> something different. Everything else is an OVERRIDE on an inherited
> default.**

So the default posture is **inherit everything, override anything**. A variant
declares what it CHANGES; every unstated field comes from its parent. A variant
that states no new behaviour is not a new kind, however different it looks.

**The test is on the consumer, not the values.** Ask: *does any reader of this
model take a different code path?* Different colours, sizes, labels or
thresholds are the same behaviour with different inputs — one kind. Different
FIELDS, different units, or a field whose meaning changes — the reader must
branch, and that is a kind.

#### Worked example: `Theme`

`Theme` dresses three surfaces: sticky notes, a website, a print publication.

| variant | kind? | why |
|---|---|---|
| `iris-web` vs the default web theme | **no** | different hex values, same fields. Nothing branches. An override. |
| `publication` vs `sticky` | **yes** | a sticky theme's geometry is `{minWidth, padding, fontScale}` across `laptop \| mobile \| card`; the WHO style guide states `A4 \| A5 \| A5 landscape` with trim size and margin, and no column width anywhere in 66 sections. `minWidth` means "before the grid reflows" — a fixed page does not reflow. A renderer MUST branch. |

Reusing `{minWidth, padding, fontScale}` for print, reading `minWidth` as trim
width, would typecheck and mean nothing. **A shape that typechecks is not a
shape that models.**

And the palette stays SHARED across all three kinds, which is the other half
of the rule: three kinds each with their own palette vocabulary would be three
spellings of "accent colour", free to disagree about what an accent is.

#### What inheritance costs, and what it must not hide

A required field stays required **after resolution**, never before. "All three
layouts, or invalid" is a property of the RESOLVED variant; a declaration that
states one and inherits two is complete. Checking requiredness on the
declaration instead is how inheritance turns into optionality by accident.

And an inherited value is still a fact somebody must be able to trace. A
variant that overrides a value **cites why**, the same as any other asserted
fact — otherwise the model records what the value is and loses where it came
from, which is the failure the `uses[]` rule exists to prevent elsewhere.

### 8. Point from the dependent at the general node

A relation between two entities is written on ONE of them. Write it on the
entity that DEPENDS, pointing at the one it depends on. **A general, reused
node never holds a field naming the things that use it.**

The test is the step-3 question applied to the relation: **if every user of
this node disappeared, would the node still be complete?** A skill with no
task implementing it is still a skill; a task with no skill is not a task. So
the pointer lives on the task.

| relation | written on | never on | why |
|---|---|---|---|
| a task implements a skill | the BPMN task (`<bootstrap.processes:skill ref>`) | the skill | a skill is reused by many tasks in many processes; listing them makes every new process an edit to the skill |
| a voice speaks for a role | the voice (`activeIn.roles`) | the role (`voice`) | a role is what an actor does in a lane; how it sounds is a separate, swappable thing |
| a lane names a role | the lane (`partitionElementRef`) | the role (`lanes`) | the role names diagrams it cannot know about |
| a user story is for a role | the story (`role`, in `scenarios/stories.json`) | the role (`useCases`) | stories are added by whoever writes them, not by editing the role |
| a Tool satisfies a skill | the Tool (`satisfies`) | the skill (`scripts`, `validators`, `mcpServices`) | several Tools may satisfy one skill, and a script is added without editing the skill |
| a skill or capability discharges a requirement statement | the skill's front matter or the capability (`satisfies: req:<id>#<key>`) | the statement (`satisfiedBy`) | a requirement is written once; what discharges it arrives later |
| a skill says how to read a graph typology | the skill's front matter (`graph-typologies:`) | the kind (`skill`) | a kind is registered once; skills that read it come and go |
| a skill takes and produces a contract | the skill's front matter (`input:`, `output:` — a path into the layer or an https IRI) | a directory named after the skill | the skill can then say its contract is elsewhere, and a contract no skill names is visible as unclaimed |
| a test checks a skill's contract | the test run (`skill`, with its `cases` checked against the skill's `input:`/`output:`) | the skill | tests come and go; the contract does not |

**Prose counts.** A skill body that says *"the only step of
initialize-harness"* knows its caller just as surely as a field does, and goes
stale the same way. Say what the skill does, not who calls it; the caller's
own declaration says the rest.

**The general node owns its CONTRACT.** What a skill takes and returns is a
fact about the skill, so it is declared there: an **input** and an **output**
schema reference, each either a KG schema or a pinned external schema. Tasks,
Tools and tests point at the skill and are checked against that contract. That
is how a general node stays complete without naming its users.

**Declare which nodes are general, and let the audit hold the line.** Which
nodes are general is a modelling decision, so it is written down: the schema
declaration's doc comment carries `@general`. The general nodes are Role,
Skill, Requirement statement, Graph typology, Capability, Actor and Process.
`kg:audit`'s `arrow-direction` criterion then reports two things: a `@general`
schema whose `@ref` names a declaration that is not general, and a BPMN
`<folio:…>` element pointing from a process at anything but a skill, role,
decision table, convention or precondition. It cannot see a bare string field
with no `@ref` (step 9 is how those become visible) or prose, so a clean run
is a claim about declared pointers only.

**Prose may name a dependent; data may not.** The rule governs references,
the things a tool follows. A general node's prose can still name a
dependent to explain itself. For example, a process's documentation may say
"`feature-staging.yml` publishes the branch" so the reader knows why a step
exists; deleting such an explanation loses the reason a step exists. If the
relation matters to a
tool, it must also exist as data held by the dependent, like a workflow's
`# bpmn:` line. The prose then explains that data and does not replace it.
What prose cannot do is notice a rename, so `kg:audit`'s advisory
`prose-names-resolve` criterion lists a named path whose directory exists
and whose file does not. A bare name that nothing in the repository carries
is left undetermined, because it could be a run's output, a folio's file or
an example.

### 9. Make every cross-node reference a typed KG reference

A reference is a claim that another node exists. A bare string makes that
claim in a vocabulary nothing resolves: a typo, a rename or a deleted node
reads exactly like a valid name.

So a field that names another node holds a **KG reference**: the target's
kind and id, resolvable in the knowledge graph, and projected by `kg-export`
as an `@id` link, never a literal. The IRI that link carries is
`<doc dir>/<kind>/<id>`, never `….jsonld#<kind>/<id>` — minted by the
exporter, not by the model; [`kg-export`](kg-export.md) §"Subject IRIs — a
path, not a `#fragment`" owns that rule. Use the helpers that already exist rather
than inventing one:

| helper | shape | for |
|---|---|---|
| `KgRefSchema` (`schemas/kg/carried-note.ts`) | `{kind, id, note?}` | any KG node |
| `TaskRefSchema` (`schemas/kg/carried-note.ts`) | `{process, task}` | a BPMN task: the pair, never a bare task id |
| `VoiceRefSchema` (`schemas/content/voices.ts`) | `{instance?, voiceId}` | a voice, possibly in another layer |
| `SkillNameSchema` (`schemas/tools/tool-types.ts`) | kebab id | a skill id, where a whole ref is not needed |
| `module#Export`, `instance:module#Export` (`parseValidatorRef`) | string with a checked grammar | a schema |

A reference that crosses into another layer says which layer. And a
reference is **resolved by a check**, not trusted: the audit that reads the
field fails on one that points at nothing.

**Free text stays free text** only when it is not a claim about another node:
a description, a note, a persona. Free text that names things the graph cannot
point at is a reference that should be a node.

## What falsifies a model

Write these down as you go and check them at the end. A model nobody tried to
break is a diagram.

| test | what it catches |
|---|---|
| name two layers that differ only in a field you called an identifier | the identifier is not one |
| find a fact you would have to update in two places | it is on the wrong entity, or duplicated |
| find a relation whose cardinality changes under a plausible future | the model states today's data, not the domain |
| count the facts nothing reads | the part you modelled for its own sake |
| find two kinds whose consumers take the SAME code path | one of them is an override wearing a discriminator |
| find a required field a variant can never state | requiredness is being checked before resolution, not after |
| delete every user of a general node; is it still complete? | a field on the general node names its users (step 8) |
| rename a node; does anything still read as valid? | a reference is a bare string, not a KG reference (step 9) |

## What this skill is NOT

**Not a storage design.** Tables, files, indices and formats come after, and a
model that assumed one of them has usually smuggled a storage constraint in as
a domain fact.

**Not domain content.** folio-assistant is the platform. A model of *clinical
recommendations*, *FHIR profiles* or any one folio's vocabulary belongs in
that folio — this skill is the procedure, and the procedure carries no
subject matter. See the platform-boundary rule in
[`placement`](placement.md).
