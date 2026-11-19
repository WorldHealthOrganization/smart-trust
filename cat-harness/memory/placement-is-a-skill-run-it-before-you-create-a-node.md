---
$schema: folio-memory/v1
id: placement-is-a-skill-run-it-before-you-create-a-node
label: stable
summary: "placement is a SKILL — run it before the first file exists"
createdAt: 2026-09-19
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
`skills/kg/kg-core/placement.md` is a four-step decision procedure with a
stop — **instance → declared graph → kind of node → which of the two
unrelated "stub" conventions**, and when you cannot tell, ask rather than
default to the repo you are standing in. Run it **before** adding a skill,
role, actor, workflow, decision table, schema, tool or content object, and
before writing any literal that names one folio.

Four entries that restated parts of it are archived rather than kept here
(`the-shape-of-every-defect-here`, `adapter-vs-profile`,
`compose-nothing-resolve-everything`,
`the-readme-generator-that-replaced-the-whole-file`) — still nodes in the
declared `memory` graph, in no prompt. **The skill governs; this is a pointer, not
a summary of it.** Where they would disagree, the skill wins — so read it,
and fix it there rather than restating it back into this file.
