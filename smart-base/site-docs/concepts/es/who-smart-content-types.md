---
layout: default
title: "DAK de Directrices SMART de la OMS (L2) · Guías de Implementación SMART de la OMS (L3)"
lang: es
nav_exclude: true
translation_status: unverified
translation_source: concepts/who-smart-content-types.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# DAK de Directrices SMART de la OMS (L2) · Guías de Implementación SMART de la OMS (L3)
{: .no_toc }

## DAK de Directrices SMART de la OMS (L2)
{: #who-smart-guidelines-daks-l2 data-fa-label="sec:content-types-who-smart-guidelines-daks-l2" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l2-dak-authoring.bpmn){: .fa-node-edit title="Edit processes/l2-dak-authoring.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-guidelines-daks-l2.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-guidelines-daks-l2.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**Paquete de habilidades:** `authoring-who-smart-guidelines` ·
**Guía:** [Autoría de un DAK de SMART de la OMS](../../guides/who-smart-dak.html)

Un **Kit de Adaptación Digital (DAK)** es la representación *L2* (legible por máquina,
pero neutra respecto a la implementación) de una directriz de la OMS. folio-assistant
genera los artefactos L2:

- **Procesos de negocio** — flujos de trabajo BPMN 2.0 (`bpmn-authoring`)
- **Lógica de decisión** — tablas de decisión DMN (`dmn-authoring`)
- **Diccionarios de datos / elementos de datos esenciales** — tablas estructuradas / Excel
- **Terminología** — sistemas de códigos y conjuntos de valores (`terminology-management`)
- **Personas, escenarios, indicadores, requisitos**

Esquemas de habilidades pertinentes:
[`l2-dak-authoring`]({{ '/reference/skills/l2-dak-authoring.html' | relative_url }}),
[`bpmn-authoring`]({{ '/reference/skills/bpmn-authoring.html' | relative_url }}),
[`dmn-authoring`]({{ '/reference/skills/dmn-authoring.html' | relative_url }}),
[`terminology-management`]({{ '/reference/skills/terminology-management.html' | relative_url }}).

<div class="bpmn-figure" id="figure-who-smart-guidelines-daks-l2">
  <img src="{{ '/es/assets/img/workflows/l2-dak-authoring.svg' | relative_url }}"
       alt="Diagrama de carriles BPMN de autoría de DAK L2: una compuerta paralela despliega personas, procesos BPMN, lógica de decisión DMN, el diccionario de datos e indicadores a lo largo del carril del analista de negocio junto con las vinculaciones del terminólogo; luego, la validación por parte de expertos clínicos (SME) autoriza el ensamblaje del DAK.">
</div>

[Fuente BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/l2-dak-authoring.bpmn) · [SVG a tamaño completo]({{ '/assets/img/workflows/l2-dak-authoring.svg' | relative_url }})
{: .bpmn-source }

---

## Guías de Implementación SMART de la OMS (L3)
{: #who-smart-implementation-guides-l3 data-fa-label="sec:content-types-who-smart-implementation-guides-l3" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l3-fhir-pipeline.bpmn){: .fa-node-edit title="Edit fhir-harness/collab/processes/content/l3-fhir-pipeline.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-implementation-guides-l3.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-implementation-guides-l3.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**Paquete de habilidades:** `authoring-who-smart-guidelines` ·
**Guía:** [Autoría de una IG SMART de la OMS](../../guides/who-smart-ig.html)

La capa *L3* convierte un DAK L2 en una **Guía de Implementación FHIR** computable:

- **Recursos FHIR** creados como **FSH** (FHIR Shorthand) y compilados con
  **SUSHI** (`l3-fhir-authoring`)
- **Validación** frente a perfiles FHIR (`fhir-validation`)
- **Publicación** con el **HL7 FHIR IG Publisher** (`ig-publication`)
- **Compuertas de control de calidad** (`quality-control`)

Esquemas de habilidades pertinentes:
[`l3-fhir-authoring`]({{ '/reference/skills/l3-fhir-authoring.html' | relative_url }}),
[`fhir-validation`]({{ '/reference/skills/fhir-validation.html' | relative_url }}),
[`ig-publication`]({{ '/reference/skills/ig-publication.html' | relative_url }}),
[`quality-control`]({{ '/reference/skills/quality-control.html' | relative_url }}).

<div class="bpmn-figure" id="figure-who-smart-implementation-guides-l3">
  <img src="{{ '/es/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }}"
       alt="Diagrama de carriles BPMN de la canalización L3: mapear L2 a L3, autoría de FSH, compilación con SUSHI, validación frente a perfiles con retorno a FSH en caso de error, compuertas de QC que registran hallazgos como beans, compilación con IG Publisher y publicación del sitio de la IG.">
</div>

[Fuente BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/l3-fhir-pipeline.bpmn) · [SVG a tamaño completo]({{ '/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }})
{: .bpmn-source }

---
