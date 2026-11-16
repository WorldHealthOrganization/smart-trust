---
name: crdm-impact-analysis
description: >
  Guide for CRDM Phase 4 — Impact Analysis and Migration Planning.
  Systematic scan across 7 dimensions: schema, pipeline, adapter, folio,
  skill, migration, and test/documentation impact. Produces a structured
  assessment for posting to the GitHub issue.
---

# Phase 4 — Impact analysis (detail)

This skill expands the Phase 4 summary in `crdm-requirements-workflow.md`.

## The 7 impact dimensions

### 1. Schema impact

Scan `schemas/*.ts`:
- `types.ts` — are any types added, removed, or changed?
- `block-kinds.ts` — does a block kind change? (triggers adapter cascade)
- `constraints.ts` — new or modified constraints?
- `builders.ts` — new or modified builders?
- `folio-config.ts` — does the config schema change? (affects all folios)

```bash
rg "YourChangedConcept" schemas/
```

### 2. Pipeline impact

Scan `pipeline/*.ts`:
- Validators (`validate.ts`, `profile-check.ts`)
- Renderers (`render-markdown.ts`, `render-latex.ts`)
- Extractors/codemods (`pot-extract.ts`, `po-inject.ts`, `citations.ts`)
- Content graph (`content-graph.ts`)
- QA criteria (`qa-criteria-registry.ts`)

### 3. Adapter impact

Check `adapters/` routing and inheritance:
- `PaperContentAdapter` extends `DocumentContentAdapter`
- `adapterForKind` must stay total and unambiguous
- Adding a kind: which adapter owns it?
- Profile vs adapter distinction (AGENTS.md §"Content types, and starting a folio")

### 4. Folio impact

For each active downstream folio:
- Does it use the changed schema/pipeline?
- Does it need a migration?
- Will `content_validate` still pass?
- Is `init-folio` affected?

### 5. Skill impact

```bash
rg "affected_file_or_concept" cat-harness/skills/
```

Check `.claude/agent-memory/` for rules/traps that reference the changed area.

### 6. Migration assessment

- Does this need a codemod? (`codemod-*.ts`)
- Schema version bump? (`schemas/package.json`)
- Data migration for existing folios?
- Rollback strategy — what if the migration fails?

### 7. Test and documentation impact

- `scripts/tests/` — which tests need updating?
- E2E tests — affected scenarios?
- Jekyll docs under `cat-harness/docs/` — pages to update?
- BPMN diagrams in `cat-harness/processes/**/*.bpmn` — workflows affected?

## Structured output format

Post this table to the GitHub issue:

```markdown
## Impact assessment — [Feature name]

| Dimension | Affected? | Files | Risk | Migration needed? |
|---|---|---|---|---|
| Schema | Yes/No | `schemas/types.ts` | High/Med/Low | Yes/No |
| Pipeline | Yes/No | `pipeline/validate.ts` | ... | ... |
| Adapter | Yes/No | `adapters/paper/` | ... | ... |
| Folio | Yes/No | `qou`, `who-smart` | ... | ... |
| Skills | Yes/No | `skills/process/crdm/` | ... | ... |
| Migration | Yes/No | — | ... | ... |
| Tests/Docs | Yes/No | `scripts/tests/` | ... | ... |

### Consumer impact
- [List fields added/removed from published artefacts]
- [List IRIs or filenames that move]
- [List conventions a consumer must learn]

### Test plan
- [Tests to add or update]
```

## Scanning checklist

```bash
# 1. Schema
rg "CONCEPT" schemas/

# 2. Pipeline
rg "CONCEPT" pipeline/

# 3. Adapters
rg "CONCEPT" adapters/ content/adapters/

# 4. Folios
# Check folio.config.json in each active folio

# 5. Skills
rg "CONCEPT" cat-harness/skills/

# 6. Tests
bun test 2>&1 | tail -20

# 7. Docs
rg "CONCEPT" cat-harness/docs/
```

## Cross-references

- [`crdm-requirements-workflow`](crdm-requirements-workflow.md) — Phase 4
- [`crdm-requirements-template`](crdm-requirements-template.md) — Phase 3 feeds this
- [`crdm-detect`](crdm-detect.md) — detection
- `../../sdlc/skills/sdlc-core/staging-review.md` (opt-in `cat-harness.sdlc`) — staging
- `../../work-plan/skills/work-plan/todo-manager.md` (opt-in `cat-harness.work-plan`) — work items
