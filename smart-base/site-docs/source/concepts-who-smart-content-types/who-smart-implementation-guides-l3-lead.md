**Skill package:** `authoring-who-smart-guidelines` ·
**Guide:** [Authoring a WHO SMART IG](../guides/who-smart-ig.html)

The *L3* layer turns an L2 DAK into a computable **FHIR Implementation Guide**:

- **FHIR resources** authored as **FSH** (FHIR Shorthand) and compiled with
  **SUSHI** (`l3-fhir-authoring`)
- **Validation** against FHIR profiles (`fhir-validation`)
- **Publication** with the **HL7 FHIR IG Publisher** (`ig-publication`)
- **Quality control** gates (`quality-control`)

Relevant skill schemas:
[`l3-fhir-authoring`]({{ '/reference/skills/l3-fhir-authoring.html' | relative_url }}),
[`fhir-validation`]({{ '/reference/skills/fhir-validation.html' | relative_url }}),
[`ig-publication`]({{ '/reference/skills/ig-publication.html' | relative_url }}),
[`quality-control`]({{ '/reference/skills/quality-control.html' | relative_url }}).
