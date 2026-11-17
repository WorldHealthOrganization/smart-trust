---
name: release-lifecycle
description: >
  Governs the release lifecycle: semver policy, draft/named releases,
  changelogs, release gating, and the relationship between feature
  branches, PRs, work items, and releases. Applies to code releases,
  paper publications, and project milestones. Complements package-release
  (which handles the mechanics of cutting a release) with the process
  and policy layer.
---

# Release lifecycle — process and policy

This skill governs **when and why** to create releases. For the **how**
(tagging, notes, `gh release create`), see
[`package-release.md`](package-release.md).

## Semver policy

folio-assistant follows [Semantic Versioning 2.0.0](https://semver.org/):

| Version part | When to bump | Examples |
|---|---|---|
| **Major** (X.0.0) | Breaking change to MCP tools, schema types, or public API. Requires downstream folios to update. | Rename a block kind, remove a pipeline stage |
| **Minor** (0.X.0) | New backward-compatible capability. New skills, tools, block kinds, BPMN workflows. | Add a skill, add a docs page |
| **Patch** (0.0.X) | Bug fix, typo, documentation correction, CI fix. No new capability. | Fix a BPMN marker, fix a broken link |

## Release types and their gates

| Type | Gate | Who decides |
|---|---|---|
| **Draft** | First PR for a planned release merges | Agent creates, BA approves |
| **Pre-release (RC)** | All must-have work items resolved, the full suite green on the candidate (§"The release gate") | BA decides when to test |
| **Named release** | Stakeholder sign-off on the RC | BA + stakeholders |

## The release gate: the full suite runs for a release

Owner, card Q-CIB-4 A, 2026-11-08: *"not all CI needs to run unless doing a
release build"*, *"you can merge to main and not be release build"*, *"CI
not gate on non-release merge to main"*. So CI has three lanes, and only the
last one gates:

| lane | what runs | gates? | where it shows |
|---|---|---|---|
| **Pull request** | the fast tier: types, lint, and the tests and gates the change can reach; no re-run of `main` | no: shown on the PR, advisory | a preview at `branches/<slug>/`, on request, and always for content PRs |
| **`main`** | the integration run: the full suite on main's tip, batched (one run per repository per hour, not one per merge) | no: a red run files ONE fix issue naming the merges in its range | the staging root of the site, not the live root |
| **Release** | the full tier as an absolute gate: every test, every gate, derive:publish, e2e, the standalone measure, the index at released layer pins | **yes**: nothing publishes from a red release candidate | the live site, the registry, the GitHub release |

**What makes a merge a release:** the PR carries the `release` label (or
`merge:guard` runs with `--release`). The guard's check 5 then gates the
merge on green owed CI, as it did for every merge before 2026-11-08. A
release candidate is cut from `main` after that merge, and only a green
candidate is published ([`package-release`](package-release.md) step 3).

**What does not change:** content still needs the owner's authorisation;
committee content never merges; the WHO repositories are not changed without
the owner; CodeQL keeps its schedule. Those are authorisation and security
rules, not CI tiers.

**What it replaces:** for non-release merges, main-green-first (card Q-CIB-1
B, 2026-11-08), the 2026-10-23 ruling that a layer PR merges only on a green
index run, and "merge non-content when green" in the merge window rules.

**Rollout** (phased, owner's choice A): 1. these skills, the merge DMNs and
`merge:guard` (check 5 advisory unless a release); 2. cat-harness-tools'
layer checks (PR fast tier, the hourly integration run, the release run);
3. folio-assistant's Code-quality gates, previews on request, the site's
staging root; 4. the other layers and the re-pin train. Until a phase lands,
its workflows still run in full: they are simply no longer a merge gate.

## Release planning with epics

A **release epic** groups all work for a specific release. Its structure, the
commands that build it, and the readiness checklist are in
[`release-epic-planning`](release-epic-planning.md).

## Where code review sits

Code review happens at the **PR level** (before merge to main).
Release approval happens at the **RC level** (after many PRs merge).

```
PR → code review → merge → accumulate in draft release
                                    ↓
                         draft → RC → stakeholder test → named release
```

See [`code-review-process`](code-review-process.md) for the review detail.

## Changelog format (Keep a Changelog)

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- New `release-lifecycle` skill

### Changed
- Updated CRDM workflow with Phase 4b prioritization

### Fixed
- Added `isMarkerVisible` to BPMN gateways
```

Derived from conventional commits:
- `feat:` → **Added**
- `fix:` → **Fixed**
- `docs:` → **Changed**
- `BREAKING CHANGE:` → **⚠ Breaking**

## Cross-domain applicability

| Domain | "Release" | "RC" | "Tag" |
|---|---|---|---|
| **Code** | GitHub release | Staging deployment | Git tag |
| **Paper** | Publication milestone | Draft circulation | DOI assignment |
| **Project** | Deliverable milestone | Stakeholder review round | Completion report |

The process is identical; the artefacts differ.

## Rules

- **Never create a release without BA approval**
- **Never skip the pre-release step** — even for patches
- **Never publish a red release candidate.** The full suite is the release gate; a merge to `main` is not a release and is not gated by CI
- **The changelog is written for humans** — no commit hashes or work item IDs
- **One release per epic** — if scope creeps, split the epic
- **Draft releases are mutable; named releases are immutable**

## Cross-references

- [`package-release.md`](package-release.md) — release mechanics
- [`code-review-process.md`](code-review-process.md) — review in release context
- [`crdm-requirements-workflow.md`](../../../skills/process/crdm/crdm-requirements-workflow.md) — Phase 6 feeds into release
- [`staging-review.md`](../../../skills/ui/ui-core/staging-review.md) — staging previews for RCs
- [`release-epic-planning.md`](release-epic-planning.md) — epic structure and readiness checklist
- `todo-manager.md` (opt-in `cat-harness.work-plan`) — work item management within epics
