---
consulted: true
---

# Where a proposal goes — `docs/proposals/`

**A design proposal is a document in `docs/proposals/<slug>.md`**, with
`kind: proposal` and a row in `docs/proposals/index.md` (opt-in `cat-harness.proposals`).
Its assets go beside it, in `docs/proposals/<slug>/` (wireframe candidates in
`docs/proposals/<slug>/wireframes/`). It is committed on the feature branch, so
the branch's staging preview publishes it with the rest of the change.

A proposal is kept and addressable because the decision it produced is cited
later, and a citation needs a stable path.

## What a proposal is, and what it is not

A proposal is the **argument about what to build**: the needs, the options,
what each costs, and what was agreed. It is not reader documentation, so a
page for a reader never depends on it:

- a reader-facing page states the rule and its reason, and does not link into
  `docs/proposals/` for either;
- the **rule that came out of a proposal** goes in the skill it governs, in a
  paragraph, because that is where an agent looks it up;
- who decided it and when goes in that skill's provenance log
  (`<skill>.prov.jsonld`), not in its narrative.

## Where each thing goes

| what | where |
|---|---|
| a design proposal, an options analysis, an impact assessment | **`docs/proposals/<slug>.md`** |
| the discussion while it is open | a comment on the **issue** it is for |
| a harness feature's agreed requirements, once the feature ships | **`docs/requirements/<slug>.md`**, by `git mv` from `docs/proposals/` ([`crdm-requirements-workflow`](../../../skills/process/crdm/crdm-requirements-workflow.md)) |
| the rule a decision established | the **skill** it governs |
| who decided, when, and under which issue | the skill's **provenance log** |
| structured content worth keeping but not publishing | **`fsh-guts/`** — see [`fsh-guts`](../../../skills/kg/kg-core/fsh-guts.md) |
| what a reader of the folio needs | **`docs/`**, outside `proposals/` |

## Related

- [`placement`](../../../skills/kg/kg-core/placement.md) — the same row: options
  for a decision not yet taken go in `<instance>/docs/proposals/`
- [`crdm-requirements-workflow`](../../../skills/process/crdm/crdm-requirements-workflow.md) — how a
  proposal is filed as a requirement when its feature ships
- [`symbiotic-interaction`](../../../skills/conduct/conduct-core/symbiotic-interaction.md)
  — a ruling goes in the governing skill, its quote and date in the provenance log
