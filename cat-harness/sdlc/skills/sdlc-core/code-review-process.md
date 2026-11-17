---
name: code-review-process
description: >
  Where code review sits in the release lifecycle. Review types, who reviews
  what, how feedback maps to work items, and the path from review to approval to
  release. Works with prepare-merge-auto for mechanics and release-lifecycle
  for the broader flow.
---

# Code review process — from PR to release approval

Code review is a **quality gate**, not a release gate. It happens at the
PR level, before merge to main. Release approval is a separate step that
happens on the pre-release (RC).

## Review types

| Type | Who | What | When |
|---|---|---|---|
| **Behavioural** | BA | Tests behaviour vs acceptance criteria. Does NOT read code. | Every feature PR |
| **Code** | Agent or human dev | Implementation correctness, style, coverage, schema conformance | Every PR |
| **Visual** | BA or stakeholder | Before/after via staging preview URLs | PRs changing rendered content |
| **CI** | Automated | Tests, lint, BPMN render, docs generation | Every PR (automated) |
| **Release** | BA + stakeholders | Tests accumulated RC against full requirement set | Before named release |

## Review feedback → beans

| Severity | Action |
|---|---|
| **Nit** (typo, style) | Fix in same PR, same commit batch |
| **Defect** (wrong behaviour) | Fix in same PR, new commit |
| **Scope expansion** (new requirement) | New work item. Do NOT fix in current PR. |
| **Design disagreement** | Escalate to BA. Agent does not overrule reviewer. |

The acceptance criteria from Phase 3 (`crdm-requirements-template`) are
the arbiter. If ambiguous, ask the BA.

## Who reviews what

| Artefact | Primary reviewer | Secondary |
|---|---|---|
| Schema (`schemas/*.ts`) | Code review | BA (type ↔ requirement) |
| Pipeline (`pipeline/*.ts`) | Code review + tests | BA (output correctness) |
| Skills (`cat-harness/skills/**`) | BA (guidance sense) | Code review (cross-refs) |
| BPMN (`cat-harness/processes/**/*.bpmn`) | BA (process ↔ reality) | Code review (compliance) |
| Docs (`cat-harness/docs/**`) | BA (content accuracy) | Visual (staging preview) |
| Tests | Code review | — |
| CI/workflows | Code review | CI health check |

## Review vs release approval

| | Code review (PR) | Release approval (RC) |
|---|---|---|
| **Scope** | One PR | All PRs since last release |
| **Who** | BA + code reviewer | BA + stakeholders |
| **Gate** | "Does this PR work?" | "Does this release meet our needs?" |
| **Outcome** | Merge to main | Publish named release |

## Rules

- **Never merge without explicit BA confirmation**
- **Review comments go on the PR** (audit trail), not in chat
- **Respond to every review comment** — even "acknowledged, fixed in abc123"
- **Self-review is real review** — check diff vs acceptance criteria
- **Review scope is the PR diff**, not the total branch state

## Cross-references

- [`release-lifecycle`](release-lifecycle.md) — the broader release flow
- [`prepare-merge-auto.md`](prepare-merge-auto.md) — merge mechanics
- [`staging-review.md`](../../../skills/ui/ui-core/staging-review.md) — visual comparison
- [`skills/process/crdm/crdm-requirements-template.md`](../../../skills/process/crdm/crdm-requirements-template.md) — acceptance criteria

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](../../../skills/authoring/content-lifecycle/feedback-deep-links.md).
