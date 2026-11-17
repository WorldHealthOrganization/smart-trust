SMART Base publishes a JSON Schema, and an OpenAPI description, for every DAK
logical model and value set. Examples are the decision-support logic, health
interventions, functional and non-functional requirements, program indicator,
core data element, persona and business-process workflow models, the Dublin
Core metadata set, and value sets such as the classification of digital health
interventions. A source reference such as `DecisionSupportLogicSource` must give
exactly one of `url`, `canonical` or an inline `instance`.

<a href="{{ '/assets/img/kg-deck/img-p004-1.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p004-1.webp' | relative_url }}" alt="Screenshot of the SMART Base DAK API documentation page: sections 8.2.16–8.2.22 list ValueSet JSON schemas (digital health interventions for managers, providers and data services; SMART Guidelines authoring skills; service and application types), and section 8.3, &quot;Logical Model Schemas (25 available)&quot;, lists cards such as Decision-Support Logic, Health Interventions and Recommendations, Functional and Non-Functional Requirements, Program Indicator, Core Data Element, Dublin Core Metadata Element Set, SUSHI Configuration, User Scenario Source, Test Scenario Source, Persona and Business Process Workflow. Each card carries FHIR, JSON Schema and OpenAPI badges." loading="lazy"></a>

<a href="{{ '/assets/img/kg-deck/img-p004-3.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p004-3.webp' | relative_url }}" alt="Screenshot of a JSON Schema (draft 2020-12) for &quot;Decision Support Logic Source&quot;, $id under worldhealthorganization.github.io/<dak-layer>/branches/v1.0.0: an object whose properties are resourceType (const DecisionSupportLogicSource), url and canonical (both URI strings) — exactly one of url, canonical or an inline instance must be provided." loading="lazy"></a>

<img src="{{ '/assets/img/kg-deck/img-p004-2.webp' | relative_url }}" alt="A QR code with a small pixel-art dinosaur in its centre. It was not decoded for this description; the slide prints https://smart.who.int/base/dak-api.html beside it." height="140" style="height:140px;width:auto;display:inline-block;vertical-align:middle" loading="lazy">

On the slide the JSON Schema is drawn over the list as a callout of one entry,
`DecisionSupportLogicSource`, so it reads as "this is what one of these
entries holds". The QR code beside it points at the API page.

**Source:** <https://smart.who.int/base/dak-api.html>; the artefact index
in the DAK layer's `fhir-artifact-index`, built at publish from the IG's
source.

> **Aligned in count, not checked item by item:** the slide shows "Logical
> Model Schemas (25 available)". The index is built from the IG's source at
> publish, so it holds at least those 25 logical models and may hold more
> (45 on 2026-10-24).
