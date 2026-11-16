The DAK logical model (SMART Base 1.0.0) is a complete kit with its metadata
(id, name, title, description, version, status, publication, preview and
canonical URLs, licence, copyright year, publisher) and its components: nine in this model, ten in this repository's count (see slide 3). Each
component is held as a **source reference**, not inline: by URL, by canonical or
as a layer. That indirection is what lets the kit's parts be nodes of a
larger graph.

<a href="{{ '/assets/img/kg-deck/img-p005-2.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p005-2.webp' | relative_url }}" alt="Screenshot of the SMART Base 1.0.0 page for the logical model Digital Adaptation Kit (DAK) — &quot;a complete DAK with metadata and all 9 DAK components&quot;. Its key-elements table lists id, name, title, description (string or URI), version, status, publicationUrl, previewUrl, canonicalUrl, license, copyrightYear, publisher (name, url) and the start of healthInterventions (HealthInterventionsSource, 0..*)." loading="lazy"></a>

<a href="{{ '/assets/img/kg-deck/img-p005-1.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p005-1.webp' | relative_url }}" alt="Screenshot of the SMART Base 1.0.0 release page for the logical model Decision Support Logic Source (http://smart.who.int/base/StructureDefinition/DecisionSupportLogicSource, active as of 2026-08-27): the source reference must be exactly one of url, canonical or instance, it is used by the Digital Adaptation Kit (DAK) model, and its key-elements table lists url (0..1), canonical (0..1) and instance (0..1)." loading="lazy"></a>

**Sources:** <https://smart.who.int/base/StructureDefinition-DAK.html>;
[WHO SMART content types — the DAK API surface](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#the-dak-surface).
