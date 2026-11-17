1. **Map L2 → L3** — `l3-fhir-authoring`: turn each data element into a FHIR
   profile, each value set into a `ValueSet`, each decision into a
   `PlanDefinition` / `Library` as appropriate.
2. **Author FSH** — the agent writes FHIR Shorthand; SUSHI compiles it to FHIR
   resources.
3. **Validate** — `fhir-validation` runs the validator against the profiles.
4. **QC** — `quality-control` enforces the IG's quality gates.
5. **Publish** — `ig-publication` runs the IG Publisher and renders the site.
