The CRDM workflow is supported by skills and tools that the agent uses at each
phase. Some exist today; others are proposed.

### Existing capabilities

| Capability | Used in phase | How |
|---|---|---|
| **GitHub issue management** | All phases | Issues are the primary artefact for requirements, impact analysis, and sign-off. Agents reach GitHub through the MCP tools, not the `gh` CLI, which is not available in every harness |
| **BPMN workflow authoring** (skill: `bpmn-authoring`) | Phase 2 | Agent can create and modify BPMN 2.0 process diagrams |
| **Content graph** (`content-graph.ts`) | Phase 4 | Dependency analysis across blocks and chapters |
| **QA criteria registry** (`qa-criteria-registry.ts`) | Phase 3, 4 | Register and scope new QA checks |
| **Work items** (`beans` CLI) | Phase 5, 6 | Work-plan creation and tracking |
| **Content validation** (`content_validate` MCP tool) | Phase 6 | Verify changes against schema and constraints |
| **Schema types** (`schemas/*.ts`) | Phase 3 | Define new types, constraints, and builders |
| **Document ingestion** (`uploads/` → `library/` pipeline) | Phase 2 | Ingest source documents for review |

### CRDM skills

| Skill | Phase | Purpose |
|---|---|---|
| **`crdm-detect`** | Trigger | Recognise when a request is a feature rather than content. Five categories of detection phrasing, an explicit "not a feature request" list, and the session-state rules |
| **`crdm-requirements-workflow`** | All phases | The six-phase process, the actors table, and the issue-association rules |

Both are guidance, not instrumentation: they tell an agent what to do, and
nothing checks that it did.

### Proposed skills

| Skill | Phase | Purpose |
|---|---|---|
| **`crdm-needs-assessment`** | Phase 1 | Guide the user through needs articulation; identify stakeholders |
| **`crdm-impact-analysis`** | Phase 4 | Automated scan of affected schemas, pipeline scripts, adapters, and folios |
| **`crdm-requirements-template`** | Phase 3 | Generate structured requirements from conversation |
| **`review-triage`** | Phase 6 | Triage review comments from ingested documents (e.g. public consultation feedback) |

### Running the process

**Do not build `crdm_start` or `crdm_status`.** The generic workflow tools run
this process, because
`processes/process/crdm-requirements.bpmn` is a loadable BPMN process like every
other diagram in this repository:

| Instead of | Use |
|---|---|
| `crdm_start` | `workflow_start` with `crdm-requirements` and the work item the work hangs on |
| `crdm_status` | `workflow_next` — what is enabled now, which lane owns it, which skill implements it |
| a phase checklist | `workflow_complete`, which **refuses a step that is not enabled**, so phases cannot be claimed out of order |

A second set of tools over the same diagram would be a second answer to
"where are we", free to disagree with the first. State lives under
`beans/workflows/` and is committed, so a sibling session sees the same
position.

Every activity in the agent's lane carries the skill that implements it, so
`workflow_next` returns something actionable rather than a step name:

| Step | Skill |
|---|---|
| Detect feature request | `crdm-detect` |
| Scan / link / ask about the issue | `crdm-requirements-workflow` |
| Phase 1 — stakeholders, synthesise needs | `crdm-requirements-workflow` |
| Phase 2 — map the current workflow | `bpmn-authoring` |
| Phases 3–4 — requirements and impact | `crdm-requirements-workflow` + `content-graph` |
| Phase 5 — create work items | `todo-manager` |
| Phase 6 — implement | `prepare-merge` |
| Post the round summary | `delivery-summary` |
| Close the issue | `crdm-requirements-workflow` |

Three steps also carry a work-plan effect the engine performs: implementing
claims the work item, creating work items notes it, and closing resolves it — and
resolve only lands once the instance itself has completed, because whether
work is done is a judgement.

### `stakeholder_map`

This repository has no CODEOWNERS file, and `schemas/harness-config.ts`
declares no role, owner, maintainer or contact field. A tool reading those would
report no stakeholders for every change and look like it worked, so
`stakeholder_map` reads what the repository has:

1. **Skills declare `roles:`** in their front matter — reader, collaborator,
   owner, auditor. Change a skill and you affect whoever holds its roles.
2. **BPMN lanes name the accountable actor**, and each activity names the
   skill that implements it. So a changed skill reaches a set of lanes across
   the whole process corpus — editors, the publication manager, clinical SMEs.

For example, changing `todo-manager.md` reaches the work-plan lane in six separate processes,
which is a far better prompt for "who should hear about this?" than a list
of file owners.

**It does not name people, deliberately.** `crdm-requirements.bpmn` documents
its own stakeholder step as *"The agent asks the BA who is affected by this
change. The BA knows the domain — the agent does not guess."* The tool
respects that: it enumerates roles, lanes and processes so the BA is asked a
sharper question, and it never outputs a list of humans as "the
stakeholders". Every report ends with a **NOT DETERMINED** section naming the
people half, any changed path that maps to no skill (unknown impact, not
absent impact), and any skill whose `roles:` are undeclared.

`bun run cat stakeholder-map <path>...` or `--since <ref>`; `stakeholder_map` as
an MCP tool.
