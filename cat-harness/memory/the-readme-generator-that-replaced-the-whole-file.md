---
$schema: folio-memory/v1
id: the-readme-generator-that-replaced-the-whole-file
label: trap
summary: "the README generator that replaced the whole file"
createdAt: 2026-09-19
archived: true
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
`scripts/generate-readme.sh` ended in `cp "$OUT" README.md`. It held one
folio's content **in the platform**: the title `# Quantum Observable
Universe`, three `litlfred/qou` badges, a Knot Registry of Alexander-Briggs
indices, a Project Structure table naming
`content/quantum-observable-universe/lean/`, and a CC BY 4.0 licence block.
Run it in any other folio and the author loses their README. Only five of its
sections were derived from the tree at all; the rest was prose, and prose
about a folio belongs to that folio. Deleted, with
`scripts/readme-metadata.ts`, its only consumer.

**The replacement inverts the ownership**: `pipeline/readme-sections.ts`
holds a registry (`folio:toc`, `folio:lean-coverage`, `folio:lean-modules`,
`folio:simulators`, `folio:workflows`) and writes each section **only where
the README already carries its `<!-- marker:begin -->` / `<!-- marker:end -->`
pair**. The folio opts in per section; nothing outside a marked region is
ever touched. Adding a section is one entry in `SECTIONS` — the CLI, the MCP
tool and the staleness check all read the registry.

`readme_sync` is registered among the **generic** tools: a document folio has
chapters, simulators and workflows for the same reason a paper folio does,
and simply never carries the Lean markers.

**Archived 2026-09-19** (work item `folio-assistant-4kiw`). Superseded by
`skills/kg/kg-core/placement.md` §"The worked failure this skill exists to
prevent", which restates this sentence for sentence — the `cp "$OUT"
README.md`, the title, the three badges, the Knot Registry, the Project
Structure table, the CC BY 4.0 block, *"Run it in any other folio and the
author loses their README"*, and the five-of-N sections point — and then
the ownership inversion, the marker pair, and `skip` as a third state. What
it does not restate is the `SECTIONS` registry's member names and
`readme_sync` being registered among the generic tools; it points at
`AGENTS.md` §"README sections" for those, calling it the full post-mortem,
so neither fact becomes unreachable. Retained as a node; injected into no
prompt.
