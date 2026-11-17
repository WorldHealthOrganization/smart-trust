---
input: schemas/skills/content-author/input.schema.json
output: schemas/skills/content-author/output.schema.json
---

# Content Authoring

Create and develop content artifacts according to the project plan.

## Responsibilities
- Translate source material into structured digital artifacts
- Create business process diagrams (BPMN 2.0)
- Author data dictionaries and core data elements
- Develop decision-support logic
- Create user scenarios and personas
- Author functional and non-functional requirements
- Define indicators and measures
- **Verify authored content against the repo's own CI before opening a PR** —
  dispatch the relevant workflow on your branch and record the result (see
  below)

## Don't hand off on a workflow nobody ran

Authoring is not finished at "it builds here". Before the PR, push and
dispatch the repo's verification workflow against your branch
(`gh workflow run <wf>.yml --ref <branch>`, or `actions_run_trigger`), wait
for it, and put the **run URL and conclusion** in the PR body. Red → fix and
re-dispatch. If you lack `actions: write`, state that in the PR along with the
command a maintainer should run.

Check when that workflow **last ran**, too: a CI file that nothing dispatches
can sit red on `main` while the content it checks stops compiling, and nothing
catches it because nothing runs.

## Actors
- Author / Content Developer (authoring lead)
- Business Analyst (process and data-element modelling)
- Domain / Technical Specialists (supplied by the active content-type layer)

## Inputs
- Project plan
- Source guidelines/recommendations
- Existing content (if iterating)

## Outputs
- Authored content artifacts
- Draft versions ready for validation
