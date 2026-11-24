---
name: release-epic-planning
description: >
  Plan and track releases using work item epics. Covers epic creation,
  story/task decomposition, release readiness tracking, and the
  relationship between epics and GitHub milestones. Applies to code
  releases, paper publications, and project milestones.
---

# Release epic planning

A release epic groups all the work for a specific release version.
This skill governs how to create, structure, and track them.

## Epic structure

The work items hierarchy for a release:

```
epic: "Release v0.2.0"
├── feature: "CRDM Phase 4b prioritization"
│   ├── task: "Add Phase 4b to crdm-requirements-workflow.md"
│   └── task: "Update phase table"
├── feature: "Release lifecycle skills"
│   ├── task: "Create release-lifecycle.md"
│   ├── task: "Create code-review-process.md"
│   └── task: "Create branch-freshness.md"
└── bug: "Fix 7 BPMN isMarkerVisible attributes"
    └── task: "Add isMarkerVisible to 5 files"
```

### Bean types in a release context

| Type | Role in release | Granularity |
|---|---|---|
| **epic** | The release itself | 1 per release |
| **feature** | A capability area / user story | 1 per feature |
| **task** | A single PR-sized implementation unit | 1 per PR |
| **bug** | A defect fix included in the release | 1 per fix |
| **milestone** | A session-scoped work container | Not release-scoped |

### Creating the hierarchy

```bash
# 1. Create the release epic
beans create "Release v0.2.0" --type epic

# 2. Create features under it
beans create "CRDM Phase 4b prioritization" --type feature
beans update <feature-id> --parent <epic-id>

# 3. Create tasks under features
beans create "Add Phase 4b to workflow" --type task
beans update <task-id> --parent <feature-id>
```

**Always check before creating** — `beans create` is not idempotent.
See `todo-manager.md` §"Check before you create".

## Ordering within a release

Apply the **Phase 4b formalize-first rule** from `crdm-requirements-workflow.md`:

1. Structural/organizational work first
2. Process/policy formalization second
3. Implementation third
4. Visualization/UI last

Within the epic, number features by dependency order. The first feature
completed should not depend on any later feature.

## Release readiness

### Tracking readiness

The work items visualizer (`<base>/beans/`) shows open work items grouped by epic.
A release is ready when its epic shows **0 open work items**.

### Readiness checklist

Before moving from draft to pre-release:

- [ ] All must-have features resolved (all child work items completed)
- [ ] All should-have features either resolved or deferred to next release
- [ ] CI green on main (`bun run cat gates`)
- [ ] All changed BPMN diagrams re-rendered
- [ ] All changed docs pages regenerated
- [ ] Changelog written (see `release-lifecycle.md`)
- [ ] BA has reviewed accumulated changes

### Deferring to next release

If a should-have or nice-to-have feature won't make the release:

```bash
# Move the feature bean to the next release epic
beans update <feature-id> --parent <next-epic-id>
```

Record the deferral reason in the work item body:

```bash
beans update <feature-id> --body-append "Deferred to v0.3.0: not blocking v0.2.0"
```

## GitHub milestone integration (optional)

A GitHub milestone can mirror the release epic for stakeholder visibility:

```bash
# Create milestone
gh api repos/{owner}/{repo}/milestones --method POST \
  -f title="v0.2.0" -f description="Release v0.2.0"

# Assign PRs to milestone
gh pr edit <number> --milestone "v0.2.0"
```

The milestone's completion percentage gives stakeholders a progress view
without needing access to the work items store.

## Cross-domain applicability

| Domain | Epic title | Features |
|---|---|---|
| **Code** | "Release v0.2.0" | Skills, schemas, pipeline changes |
| **Paper** | "Publication: Chapter 3 revision" | Section rewrites, figure updates |
| **Project** | "Deliverable: Phase 1 report" | Analysis sections, appendices |

The hierarchy and readiness tracking are identical.

## Rules

- **One epic per release** — if scope creeps, split the epic
- **Features are independently reviewable** — each can be a PR
- **Tasks are PR-sized** — one task, one PR, one review cycle
- **Never close an epic without BA approval** — the epic is the release
- **Deferred features move to the next epic** — they are not deleted

## Cross-references

- [`release-lifecycle`](release-lifecycle.md) — semver, release types, changelog
- [`code-review-process`](code-review-process.md) — review within release context
- [`crdm-requirements-workflow`](../../../skills/process/crdm/crdm-requirements-workflow.md) — Phase 4b ordering
- `todo-manager` (opt-in `cat-harness.work-plan`) — work item creation protocol
- `bean-coordination` — cross-session coordination
