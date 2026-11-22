---
satisfies:
  - "req:content-lifecycle#review-before-test"
input: schemas/skills/content-review/input.schema.json
output: schemas/skills/content-review/output.schema.json
---

# Content Review

Formal review and approval of validated content before publication.

## Responsibilities
- Review structured domain models before machine-readable encoding begins (phase gate)
- Review encoded artifacts before publication (phase gate)
- Assess breaking vs. non-breaking changes
- Ensure alignment with source material and requirements
- Approve draft publications for stakeholder circulation
- Provide final publication release sign-off

## Actors
- Content Reviewer (lead, approval authority)
- Technical Officer (first-pass review)
- Domain SME (domain sign-off, supplied by the content-type layer)
- Programme Manager (governance oversight)

## Inputs
- Validated content artifacts
- Validation reports
- Change log / diff from previous version

## Outputs
Findings and a decision — two things, not one. See
[`decision-audit`](../../process/process-core/decision-audit.md) and
[`schemas/sdlc/qa-review.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/sdlc/qa-review.ts).

- **Findings** — one per observation, each carrying the axis this reviewer can
  speak on: `blocking | suggestion | praise` for a person, `critical | major |
  minor` for a checker. Neither defaults into the other, and `praise` has no
  machine equivalent.
- **A decision** — `approve | request-changes | reject`, naming every finding it
  weighed and every one it overruled. An overruled finding stays on the record.
- **Audit notes** — why this outcome, and why each overruled finding was left.
  At least one per decision, each citing corpus evidence. Approving over an open
  `critical` or `blocking` finding without overruling it is a reported problem.

## Translations are reviewed in their own loop

A content review judges the source text. A translation of it is judged
string by string in
[`translation-adjudication`](../../../library/skills/library-core/translation-adjudication.md):
anyone proposes from the review page or a block's 🌐 pane, and an owner,
member or collaborator adjudicates. Approving a source change does not
approve its translations. When the change rewrites source text, those strings
go stale and re-enter that loop; that does not hold back the content review.

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](feedback-deep-links.md).
