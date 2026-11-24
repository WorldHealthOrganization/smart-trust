---
name: bootstrap-graph-emission
description: >
  What bootstrap's own Knowledge Graph must be when it is written out as a data
  file, `.jsonld` with a `.json` copy.
consulted: true
---

# Writing out bootstrap's own Knowledge Graph

bootstrap renders nothing for a person to look at. What it owes instead is its
own Knowledge Graph, written out as one data file. `bootstrap.json` records
that trade under `renderExemption`, and its `owes` field names this Skill.

bootstrap runs nothing (FR-7 of the [README](../README.md)), so the file is
written by bootstrap's toolset, a separate repository. It is the one
file bootstrap publishes that names what wrote it, and it says so inside
itself: an `rdfs:comment` that it is generated and not to be edited, and
`prov:wasAttributedTo` naming the toolset's repository. This Skill states what the file
must hold. Its shape is fixed by a schema, and the tool is tested against it.

## In whose terms

Every class is one of bootstrap's own terms (`bootstrap:Skill`,
`bootstrap:Process`, `bootstrap:Subgraph`, …), so the file names nothing above
bootstrap. Every property is a published standard wherever one exists:
`rdfs:label`; Dublin Core for `title`, `description`, `source`, `isPartOf`,
and `type`, which points a Subgraph at the Graph Typologies it holds; BPMN's own
`sourceRef`, `targetRef` and `flowNodeRef` for a Process's arrows and lanes;
and PROV for provenance. Only the link from a step to the Skill it names is
bootstrap's own, because no standard says it.

## What goes in it

The declaration itself, its Subgraphs and their Graph Typologies, the declared
Assets, the Skills in the `skills` Subgraph, the Processes in `processes`
(with their steps and arrows), and the Roles in `scenarios`. The tool finds each Subgraph
**through the declaration**, never by walking the directory tree, so a
Subgraph the declaration does not name is never exported by accident.

## Four properties

Each node's `@id` is a path under the Harness's address, not a `#fragment` of
the file: [`bootstrap-graph-publication`](bootstrap-graph-publication.md)
§"Each subject's own address".

1. **The same input gives the same file.** Two builds of one tree are
   byte-identical.
2. **Nodes are sorted by `@id`.**
3. **The nodes carry no time and no commit.** Where the file was built from
   is recorded once, at the top level, and only in the published copy.
4. **No absolute path from the machine that built it.**

Counts of nodes are not checked.

## What it says it did not look at

Every Subgraph is a node, but not every Subgraph's contents are read. The
file's `omitted` list names each Subgraph whose contents were not exported
(today `models` and `schemas`): a node missing from one of those means "not
looked at", not "absent". Its `problems` list names anything that
could not be read.

## Adding a Skill

Put the `.md` in `skills/` and add its name to `skills/package-manifest.json`.
A `.md` counts as a Skill unless its front matter declares `$schema:`, which
says it is some other kind of file. `README.md` and `AGENTS.md` are declared as
Assets instead, which is why they sit outside `skills/`.

## Related

- [`bootstrap-graph-publication`](bootstrap-graph-publication.md): where the
  file is published, and why its `@id` must equal that address
- [`bootstrap-kg-navigation`](bootstrap-kg-navigation.md): reading a
  Knowledge Graph with nothing installed
