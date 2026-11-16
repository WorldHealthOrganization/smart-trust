---
$schema: folio-memory/v1
id: compose-nothing-resolve-everything
label: trap
summary: "compose nothing; resolve everything"
createdAt: 2026-09-19
archived: true
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
The old contents table built every PDF cell as
`${PAGES}/papers/<paper>/chapters/<dir>.pdf` — by convention, checked against
nothing. The folio's `gh-pages` has no `chapters/` directory, so **all
twenty-three chapter links were 404 and always had been**; three of six
appendix links happened to resolve. Every PDF cell is now looked up in a real
`git ls-tree` of the publish ref, and a chapter with no published PDF renders
`—`.

The same script also **described one folio from inside the platform** (paper
directory, title, badges and a `PAGES` constant as literals) in a repo whose
`folio.ts` lists five papers, and resolved its helpers against the folio root
(`bun run scripts/readme-metadata.ts`) where the platform's scripts are not —
so it could only run from a platform checkout, which has no papers.

**Archived 2026-09-19** (work item `folio-assistant-4kiw`). Superseded by
`skills/kg/kg-core/placement.md` Step 4, which states the rule under this
entry's own name — *"Compose nothing; resolve everything"* — with this
entry's evidence intact (all twenty-three chapter links 404 and always had
been; three of six appendix links happened to resolve) plus a second case
this entry never had, the knowledge-graph navbar tile hand-written as
`/kg/` that 404'd from the day it was added. The second paragraph here is
covered by the same skill's worked failure, which records the helper path
resolved against the folio root. Retained as a node; injected into no
prompt.
