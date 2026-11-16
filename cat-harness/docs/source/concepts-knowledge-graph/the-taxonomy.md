### Schema

Every managed node has a definition — Zod authoritative, JSON Schema and JSON-LD
generated from it — saying what shape it takes and what its fields mean. The
Schema subgraph holds those definitions.

It arrives **empty except for what is self-describing**. A bare harness knows
how to describe a declaration, a directory and a kind; everything else is
contributed by the layer that introduces it. A harness that adds a content kind
adds its Schema in the same change, or the kind is unvalidated and its documents
are told apart by shape — which is the failure
[`directory-conventions`]({{ '/reference/skill-instructions/directory-conventions.html' | relative_url }})
names when it says **the files declare what they are**.

*Used for*: validation at read time, the generated schema reference, and the
`@context` a published Knowledge Graph is parsed against.

### Content

Instances of knowledge assets — the authored material a Schema describes and a
Skill governs. Catalogues, documentation pages, themes, boards, translation
sources, artefact indexes. Four subgraphs below are kinds of Content, listed
separately because they are referenced differently, not because they are
something else.

*Used for*: everything a reader or a renderer consumes.

#### Scenarios

Actors, the Roles they can take, and the User Stories those Roles are there to
serve.

An **Actor** is a concrete participant — person, agentic or mechanical — and
persists across Workflows. A **Role** is the swimlane: a persona an Actor takes
on *because of the lane it is acting in*, carrying the Skills that lane needs.
Nothing *is* a reviewer; somebody **acts as** reviewer for the duration of a
lane, and the same Actor is a different Role in the next diagram.

*Used for*: binding a lane to what its occupant is expected to know, and
auditing whether a Role's Skills actually cover its lanes.

#### Workflows

Business process as BPMN, with DMN for the decisions. **Prefer *Workflow* over
*process*** throughout, because using both interchangeably costs more than the
synonym buys.

The diagrams are executable rather than illustrative. A lane binds a Role, an
activity names the Skill to run, and a gateway MAY compute its branch from a
DMN table. Instance state is committed, so a sibling session reads the same
position rather than inferring one.

*Used for*: running the work, and being the single answer to "where are we".

#### Skills

A **Capability with defined inputs and outputs** — the instruction body an
Actor needs to perform a Task, stated **generically** so that it is portable
across forges, binaries and machines by construction. A Content repository MUST
constrain those inputs and outputs with a Schema; why is in
[Repositories](#repositories) below.

A Skill MAY be designated mechanical, human, or either. That is a property of
the Capability, not of whoever happens to run it today.

#### Tools

The concrete mechanisms. A Tool names the Skills it satisfies through its
`satisfies` field, and **one Skill MAY be satisfied by several Tools**.

*Used for*: keeping the mechanism out of the instruction. A Skill that names a
vendor, a CLI or an endpoint has swallowed a Tool, and the swallowing is what
makes a layer un-portable.

#### Tests

What adjudicates whether a Skill was performed, and how well. A Test exercises a
Skill; the Tools associated with that Skill are what a Test runs it through. So
the chain reads **Test → Skill → Task**, and a Test that names a Tool directly
has jumped the Skill and measures a mechanism rather than a Capability.

*Used for*: quality control, compliance testing, and comparing model
performance across modalities. Tests are the third repository class below.

#### Context

README files, memories, methodologies, recorded confirmations: what changes the
conditions a Workflow executes **in**, without changing during execution.
Applying a set of it deliberately — a **Context Overlay** — is what lets the
same Workflow be run twice and the difference attributed to the context rather
than to chance.

*Used for*: repeatable testing across conditions. Covered in full by
[Managing agent context](../guides/managing-agent-context.html).

### Harness

The layer that renders the rest: the JSON-LD export, the visualisers, and the
documentation. Its obligation is stated as four separate requirements because
they fail differently — nothing serves it, nothing draws it, nothing says what
it is for, nothing an agent can invoke against it.

*Used for*: making a declared directory something a person can actually look
at. A directory nobody can see is one nobody checks.

### Dynamic Context

What is being worked on and how far it got. Written by processes as they run,
committed so it survives a fresh container. It splits by **who the state is
for**, which is a sharper line than what the state holds:

- **work items — agentic state management.** Used by Agents to coordinate and track
  internal state within a Workflow. *"Changes to the vaccination schedule are
  ready for review at staging."*
- **todos — human state management.** Attached to a step in a Workflow **or to
  a knowledge asset**, for human Actors. *"Please review this change in
  medication."*

A todo attaching to a knowledge asset and not only to a step is what makes the
two stores genuinely different rather than one store with an audience field: a
work item without a Workflow position is incomplete, and a todo on a chapter has no
Workflow position to be missing.

Workflow instances, QA sidecars and health results are Dynamic Context too,
written by the process that produces them.

*Used for*: the work plan, and the evidence that a claim about the corpus was
measured rather than remembered.
