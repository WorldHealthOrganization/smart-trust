---
satisfies:
  - "req:content-lifecycle#feedback-collected"
input: schemas/skills/content-feedback/input.schema.json
output: schemas/skills/content-feedback/output.schema.json
---

# Content Feedback Collection

Gather and triage feedback on published content for future iterations.

## Responsibilities
- Collect feedback from implementers and users
- Triage feedback by severity and scope
- Map feedback to specific content components
- Create issues/tickets for actionable feedback
- Prioritize feedback for next iteration
- Coordinate with domain subject-matter experts on domain feedback
- Track feedback resolution across versions

## Actors
- Technical Officer (triage lead)
- Programme Manager (prioritization)
- Domain SME (domain feedback assessment, supplied by the content-type layer)
- Business Analyst (implementer feedback)

## Inputs
- Published content (current version)
- User/implementer feedback (issues, comments, surveys)
- Country implementation reports

## Outputs
- Triaged feedback log
- Prioritized backlog for next iteration
- Change requests linked to feedback

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](feedback-deep-links.md).
