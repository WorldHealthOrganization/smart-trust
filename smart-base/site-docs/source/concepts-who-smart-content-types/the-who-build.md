The FHIR IG Publisher and FHIR content in general are described on the
[FHIR IG Publisher](https://litlfred.github.io/folio-assistant/fhir-harness/fhir/ig-publisher.html)
and [FHIR content](https://litlfred.github.io/folio-assistant/fhir-harness/fhir/fhir-content.html)
pages of the FHIR IG layer. This section covers what is specific to the WHO
SMART Guidelines build. The commands, the publishing pipeline and the
published assets are on
[Building and publishing the SMART Base IG]({{ '/smart-base/guides/smart-base-build.html' | relative_url }}).

**The Publisher is one step of many.** It runs between six pre-processing
invocations and nine post-processing ones. The DAK API, the JSON Schemas and
the JSON-LD vocabularies are produced *after* it exits, by scripts.

**The version floats.** The WHO build downloads `publisher.jar` from the
**latest** release on every run, so two builds of an unchanged commit can
differ, and nothing in the output says which version produced them.

**The dependency closure.** For the DAK layer, the Publisher resolves
`hl7.terminology`, `hl7.fhir.uv.extensions.r4`, `hl7.fhir.uv.cql`,
`hl7.fhir.uv.cpg`, `hl7.fhir.uv.crmi` and `hl7.fhir.uv.sdc`.

The rules are skills; where a skill and this page disagree, the skill wins:

- **`l2-dak-authoring`**: authoring at L2, and deriving rather than retyping.
- **`ig-artifact-ingestion`**: reading a *published* IG back as a knowledge
  graph: which IGs qualify, what to read, what to refuse, the four partial
  views and the two traps.
- **`dak-preprocessing`** and **`dak-postprocessing`**: the WHO-specific
  phases around the Publisher run, step by step.
- **`smart-stack-layering`**: which harness layer a given asset belongs to,
  and the question that settles it.
