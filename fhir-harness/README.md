# fhir-harness

The **bare FHIR IG pipeline** — the base layer of the SMART stack, and the one
layer with no WHO in it.

```
input/fsh/          →  SUSHI      →  fsh-generated/resources/
input/pagecontent/  ┐
sushi-config.yaml   ┘  →  IG Publisher (JVM, Docker)  →  output/  →  pages branch
```

No pre-processing, no post-processing: this is what any non-WHO
implementation guide instantiates.

**Contents**

<!-- readme:toc:begin -->

- [Render and publish an IG](#render-and-publish-an-ig)
- [Scope](#scope)
- [Generic steps taken from the WHO build](#generic-steps-taken-from-the-who-build)
- [Skills](#skills)

<!-- readme:toc:end -->

## Render and publish an IG

From an IG repository's root. On a fresh clone the first `bun run cat`
mounts the layers `index.lock.json` pins, then runs:

```bash
bun run cat prepare:fhir-harness             # build the AST (the one IG Publisher run)
bun run cat stage:local --repo . --dry-run   # render the site from it; push nothing
```

The pages that explain it, on the platform's docs site:

- [Render an IG from the command line](https://litlfred.github.io/folio-assistant/fhir-harness/fhir/run-locally.html):
  harnessed or bare, what to install, each step.
- [Publishing an IG](https://litlfred.github.io/folio-assistant/fhir-harness/fhir/publishing.html):
  the workflows, where each output lands, what is published now, and the
  deployment targets (GitHub Pages, Cloudflare).
- [The FHIR IG Publisher](https://litlfred.github.io/folio-assistant/fhir-harness/fhir/ig-publisher.html):
  what it does, and how the harness runs it.

## Scope

| in | out |
|---|---|
| SUSHI, the IG Publisher, Jekyll assembly, publication | `dak.config.json` and the DAK logical model |
| rendering IG content through just-the-docs, including the IG API sidecars an IG publishes (`ig-api-views.ts`) | the DAK API's names and production — the "DAK API" label, `dak-api.html` and its markers, the post-processing that writes the sidecars |
| stripping oversized `Library` payloads; JSON Schemas and JSON-LD vocabularies from what the Publisher emitted | any `smart.who.int` canonical or WHO publisher metadata |
| the artefact-index reconstruction | the DAK pre- and post-processing phases |

## Generic steps taken from the WHO build

`strip_library_binaries.py` and `strip_library_content.py`
([`scripts/library-strip/`](scripts/library-strip/README.md)) are labelled
*"DAK Postprocessing"* in the WHO build, but nothing in either is DAK-shaped:
any IG depending on `hl7.fhir.uv.cql` produces oversized `Library` resources.
The JSON Schemas per logical model and per ValueSet and the JSON-LD
vocabularies (`scripts/ig-api-gen.ts`, from the IG's AST) are here for the
same reason: they reshape what the Publisher already emitted and add no
constraint or profile. The list is in
[`ig-build-pipeline`](skills/fhir-ig-base/ig-build-pipeline.md) §"Five steps
that came DOWN from the WHO build".

## Skills

The full list is in [`AGENTS.md`](AGENTS.md#the-skills-this-layer-publishes).

- [`ig-build-pipeline`](skills/fhir-ig-base/ig-build-pipeline.md) — what the
  layer runs, and the list of what it refuses to know about.
- [`ig-render-jekyll`](skills/fhir-ig-base/ig-render-jekyll.md) — the three
  contracts: JSON only, navigation derived from `sushi-config.yaml`, LHS rail.
- [`smart-launch`](skills/fhir-client/smart-launch.md) — SMART on FHIR EHR and
  standalone launch through the SMARTerFHIR library.
- [`fhir-client-operations`](skills/fhir-client/fhir-client-operations.md) —
  reading, searching and writing FHIR resources through its client.
