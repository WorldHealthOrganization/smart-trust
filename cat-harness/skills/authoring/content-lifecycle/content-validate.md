---
satisfies:
  - "req:content-lifecycle#validate-before-review"
input: schemas/skills/content-validate/input.schema.json
output: schemas/skills/content-validate/output.schema.json
---

# Content Validation

Validate authored content against schemas, standards, and domain accuracy.

## Responsibilities
- Run schema validation against defined constraints
- Run the active content type's compiler, formal-layer, and package validators
  (supplied by the layer that ships the content type)
- Check cross-component consistency
- Validate vocabulary and terminology bindings

## Actors
- QC Reviewer (lead)
- Technical Modeller / Formal Verifier (supplied by the content-type layer)
- Terminologist / Ontology Specialist (supplied by the content-type layer)
- Domain SME (domain accuracy, supplied by the content-type layer)

## Inputs
- Authored content artifacts
- Validation rules and schemas
- Reference standards

## Outputs
- Validation report (pass/fail per artifact)
- Issue list with severity and remediation guidance
