---
# folio-assistant-9gyz
$schema: bean/1.0.0
title: 'QA-review schemas: Finding, Decision and AuditNote are three entities, not one'
status: completed
type: task
priority: normal
created_at: 2026-09-18T20:09:07Z
updated_at: 2026-10-07T17:18:00Z
parent: folio-assistant-1swy
---

## Progress — 2026-09-18

Step 1 landed on `claude/festive-galileo-s7ibx0` ([PR #280](https://github.com/litlfred/folio-assistant/pull/280)), two commits.

**`schemas/qa-review.ts`** — `Finding`, `Decision`, `AuditNote` as three
entities. The two severity vocabularies are kept as orthogonal axes:
`critical | major | minor` is what kind of breakage (a machine can assign it),
`blocking | suggestion | praise` is what the reviewer asks of the gate. `praise`
has no image under the machine axis — a checker's only good outcome is silence —
which is the proof they are different axes, and mapping it onto `minor` would
have deleted it. `checkReview` requires whichever axis the reviewer can speak on.
Overruling is a recorded act on the decision, never an edit to the finding. An
audit note with an empty `cites[]` is a reported problem. `resolveCitations`
returns `resolved | dangling | not-checked`, and `not-checked` is never rendered
as `resolved`. 19 tests, each perturbing a clean baseline by exactly one thing.

**`skills/sdlc/sdlc-core/decision-audit.md`** — new skill. Carried by `author`,
`reviewer`, `programme-manager`, `publication-manager`, `authoring-agent`; NOT
by `editor` / `qc-reviewer` / `translation-adjudicator`, which inherit it.

**`processes/editing-hci-validation.bpmn`** — `Task_RecordDecision`
between `Task_ReviewFindings` and `Gateway_EditorDecision`, editor lane,
`relaxable="false"`. One step rather than one per branch: the discard branch is
exactly where "why" most needs recording. DI shifted +220 right of x=2290, pool
and lanes widened to match, SVG regenerated.

**`schemas/skills/content-review/output.schema.json`** rewritten to the
three-entity shape, replacing a flat `decision` + `comments` that could express
neither an overrule nor the reason for one.

Green: `typecheck`, 1717 tests, `eslint`, `render:bpmn:check`, `kg:audit:check`
(exit 0, no new findings), `check:workflow-refs`, `check:workflow-policy`,
`gen-skill-docs --check`, `gen:jsonld:check`, `check:harness-dirs`.

### Not done — steps 2–9

The `tests` graph kind; witnesses as `.ts` KG nodes under `tests/results/`;
migrating the 118 QA criteria from skills to tests; binding a criterion to a
skill's I/O; `translations/qa/` as referenceable nodes; `<folio:qa ref>` in the
BPMNs; and the same audit-note step in `crdm-requirements.bpmn`,
`content-change-review.bpmn` and `draft-to-publication.bpmn`.

_2026-09-19T00:41:16Z_ — Checked 2026-09-19 on main at 17dc1e6 — PARTIAL. Step 1 is landed: schemas/qa-review.ts and schemas/qa-review.test.ts are both on main. The bean records this as 'Step 1' but does not enumerate the later steps, so whether anything remains cannot be determined from here. The bean's owner should say what step 2 is, or close it.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open working branch touches it; the sessions that held theme B (CI reliability, QA instruments, process) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Completed on landed evidence
Landed on main in PR #280 (QA review: a finding, a decision and an audit note are three entities, not one).
