---
name: code-node-review
description: >
  Review the knowledge graph's CODE nodes — Tool definitions in the `tools`
  graph and schema definition nodes under `schemas/` — for the joins a reader
  cannot see: that a node declares what it is, that what it names resolves, and
  that the mechanism it describes is the one that actually runs.
allowed-tools: Read Edit Bash Grep Glob
---

# Code node review

## What you are reviewing, and why it is not ordinary code review

Two node kinds:

| node kind | lives in | declared by | says |
|---|---|---|---|
| **Tool** | `tools/<id>/<id>.json` (the `tools` graph) | `"$schema": "tool-definition/v1"` | one concrete mechanism that exercises a skill |
| **Schema definition** | Zod modules under the tools layer's `schemas/`; their generated JSON Schemas under `schemas/kinds/` here | the module and its exported types | the shape of a content object, and its own place in the KG |

They are *graph nodes that happen to be code*. Ordinary review asks whether the
code is correct; this asks whether the **node** is correct — whether it declares
what it is, whether its references resolve, and whether the mechanism it
advertises is the one that runs. A file can compile, pass its tests, and still
be a broken node.

## Tool nodes

A skill states a capability generically; a Tool carries the concrete mechanism
(`skills-and-tools`). Review a Tool node for:

1. **It names the skills it satisfies, and they exist.** A Tool naming no skill
   is unreachable from the capability it implements; a Tool naming a skill that
   does not exist is a dangling edge `check-tools` can catch but a reader
   cannot.
2. **The mechanism is the one that runs.** A vendor, CLI, binary or endpoint in
   a Tool must be the one the pipeline actually invokes. A Tool describing an
   aspiration is worse than no Tool: it answers "how is this done here?" wrongly
   and with authority.
3. **IRIs are minted, not written out.** `toolTypeIri` forms I/O type IRIs
   against the layer's `canonicalUrl` at load. A hardcoded IRI silently
   breaks when the publication base moves, and nothing fails at build time.
4. **Coverage is a finding, not a score.** Not every skill has a Tool node. A
   skill with no Tool is a gap worth
   naming in review; it is not a defect in the skill.

## Schema definition nodes

Reviewed as nodes, the recurring defect is a file that does not say what it is:

1. **The node declares its own kind.** `kg` (skill front matter), `bean-defs`
   (work item front matter) and `workflow-state` (`$schema`) declare themselves.
   `schemas/*.ts` largely does not — `@module` names the path rather than the
   node type, some files carry none, and `*.test.ts` files sit in the declared
   directory without being schema nodes at all. A consumer then
   tells them apart by filename, which is a coincidence of the current layout
   rather than a contract.
2. **A widened type is a widened contract.** Adding a field to a shared schema
   changes every instance of it, including in downstream folios. Ask what
   happens to a folio that does not set it, and whether the mirror (JSON
   Schema, the Python side, the interchange schema under `tools/`) moves with
   it.
3. **A REMOVED field needs a reason in the file.** The tools layer's
   `schemas/content/translation.ts` carries a comment where `roundTripQA` used to be, saying what it held and
   why it went. Without that, the next author re-adds it in good faith.
4. **Defaults are policy.** `profiles` defaults to *every* profile while
   `adapters` narrows — because narrowing silently stops criteria running and a
   wrong pass is believed where a wrong fail is argued with. When you review a
   default, review which way it fails.

## The audits to run, and what they cannot tell you

```sh
bun run cat check:tools        # Tool nodes: declared skills resolve
bun run cat kg:audit           # the KG joins, per node, into kg-qa/ sidecars
bun run typecheck          # a malformed schema module fails here by design
```

`kg:audit` writes a sidecar per node rather than printing and exiting, so "this
has been broken since it was drawn" and "this broke in the change under review"
are distinguishable. Read the sidecar, not just the summary.

What no audit can tell you: whether the mechanism a Tool describes is the one
that runs, and whether a schema field means what its name suggests. Those are
the two things a human or agent reviewer is for, and why this is a skill rather
than a check script alone.

## Where this runs in a process

`review-code.bpmn` (`Process_CodeReview`) is this skill's subprocess. It is
**called**, not inherited: an actor already acting as a reviewer descends into
it and takes on the `code-reviewer` lane for that call path only, so the skills
are the union along the path rather than a permanent widening of the outer
role. `review-task.bpmn` is the generic entry that routes a change to this
subprocess, to the narrative one, or to both.

The feature-request process calls it too — `crdm-requirements.bpmn` audits the
code nodes an implementation adds before an MVP goes to staging, because a Tool
or schema node shipped in an MVP is the version stakeholders start building
expectations on.

## Do not

- **Do not review a Tool node without checking what it claims to invoke.** The
  failure this catches is a node that documents a mechanism nobody wired.
- **Do not approve a schema widening whose mirrors you have not looked at.**
- **Do not treat a clean `check:tools` as coverage.** It verifies the Tools that
  exist; it says nothing about the skills that have none.
