---
name: raci
description: >
  RACI over this repository's processes — who is Responsible, Accountable,
  Consulted and Informed for each activity. Three declared edge kinds over
  the roles and BPMN activities that already exist, not a new party
  registry. Use it to work out involvement when a project is initiated, and
  to sketch its breakdown.
allowed-tools: Read Grep Glob Bash
consulted: true
uses-methodology:
  - raci
---

# RACI — involvement, over the graph that already exists

**The method is not in this file.** It is the `raci` node in the `methodology`
graph — [`methodologies/raci.md`](../../../methodologies/raci.md) — which carries
the four letters, the exactly-one-Accountable constraint, and what RACI is not
for. This file carries how *this platform* applies it (`methodology-adoption`'s
split): the method's text lives once, so two skills quoting it cannot drift
apart. **Read the node first**; everything here assumes it.

**R is already declared, and that is this platform's contribution.** A BPMN
lane says who performs an activity; that IS Responsible, so the overlay does
not restate it and declares only the other three:

| letter | where it comes from HERE |
|---|---|
| **R**esponsible | read from the BPMN **lane**, never declared |
| **A**ccountable | `cat-harness.processes:raci`, exactly one per activity, gated |
| **C**onsulted | `cat-harness.processes:raci` |
| **I**nformed | `cat-harness.processes:raci` |

```xml
<bpmn:task id="A_Entities" name="Identify entities">
  <bpmn:extensionElements>
    <bootstrap.processes:skill ref="crdm-data-model"/>
    <cat-harness.processes:raci ref="business-analyst" involvement="accountable"/>
    <cat-harness.processes:raci ref="stakeholder" involvement="consulted"/>
  </bpmn:extensionElements>
</bpmn:task>
```

`bun run cat raci` prints the chart across every declared process;
`bun run cat check:raci` enforces the rule and is a gate.

## Why an overlay and not a registry

RACI needs tasks and parties. **This repository already declares both** —
BPMN activities under the declared workflow directories, and roles in
`scenarios/roles.json`. RACI adds only the relation between them, and only
three quarters of it. A RACI implemented as its own table of names would be a
**second answer to "who is the reviewer"**, free to disagree with
`roles.json`.

**Every letter names a ROLE, not an actor.** `role-model.md`'s rule is that
nothing IS a reviewer — somebody acts as one for the duration of a lane —
and naming a concrete actor would bind a process to one participant. That
holds for *informed* too, where the temptation to name a person is
strongest.

## Exactly one Accountable — the method's rule, ENFORCED here

The constraint itself is the node's; what this section adds is that
`check:raci` fails on a breach rather than advising against one.

**Zero is also a breach**, once an activity declares any RACI at all. An
activity declaring nothing is `n/a`, because annotation is incremental: the gate
is on what a diagram CLAIMS, never on how much it has claimed so far. That is
the platform's choice; RACI says nothing about partially annotated corpora.

**A role cannot be both accountable and consulted on one activity**, and the
gate enforces that too.

## Using it to initiate a project

The chart is the second half. The first is a conversation, and the order
matters:

1. **Enumerate the activities.** From the BPMN if a process exists; from
   the breakdown if it does not. An activity nobody can name is a gap in
   the breakdown, not a gap in the chart — finding those is the point.
2. **Ask who is Accountable, one activity at a time.** Not a list: one
   question per row. The answer *"the team"* means the activity is not yet
   decomposed far enough, and that is the most valuable finding this
   produces.
3. **Then Consulted, then Informed.** In that order, because C is the
   expensive one — every name added is a round trip before the work can
   proceed — and a long C list is a signal to re-read step 2.
4. **Read the columns, not the rows.** A role that is C on everything is
   a bottleneck; a role that appears nowhere was not a stakeholder after
   all, and saying so is cheaper than discovering it late.

**The agent enumerates; the person decides.** CRDM states this for
stakeholder identification — *"the BA knows the domain, the agent does not
guess"* — and it applies here with more force, because a wrong A is
invisible until something goes wrong and somebody has to answer for it.

## What this is NOT — the platform's half

The method's own refusals are in the node. These three are about the
overlay, and each names the declaration RACI must not be mistaken for:

**Not an approval mechanism.** Gates are BPMN — a `userTask` in a lane, with
the `fulfilmentKindsForBpmnType` rule that a system actor cannot fill one.

**Not permissions.** What an actor may DO is an ODRL rule in `policies/`
(actions in `skills/permissions/permissions.json`), and cross-cuts roles.
Being R for a task says who is expected to do it; performing it also needs a
rule that permits `perform-task` there.

**Not a substitute for the lane.** If the chart and the lane disagree about who
performs something, the lane is right and the chart is stale — which is why R
is read rather than declared.
