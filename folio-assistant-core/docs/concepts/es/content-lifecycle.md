---
layout: default
title: "El ciclo de vida del contenido"
lang: es
nav_exclude: true
translation_status: unverified
translation_source: concepts/content-lifecycle.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# El ciclo de vida del contenido
{: .no_toc }

## El ciclo de vida del contenido
{: #the-content-lifecycle data-fa-label="sec:content-types-the-content-lifecycle" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/content-lifecycle.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/content-lifecycle.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="the-content-lifecycle.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="the-content-lifecycle.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

Cada tipo de contenido avanza a través del mismo ciclo de vida, proporcionado por el
paquete transversal de habilidades **`content-lifecycle`**:

<div class="bpmn-figure" id="figure-the-content-lifecycle">
  <img src="{{ '/es/assets/img/workflows/content-lifecycle.svg' | relative_url }}"
       alt="Diagrama de carriles BPMN de un ciclo de folio: el responsable del programa planifica, el plan se siembra como beans, la edición y la validación de HCI se ejecutan por cada cambio propuesto, sigue una prueba de integración y un barrido de QA, luego borrador-revisión-publicación; la retroalimentación se clasifica y registra como beans, y el ciclo se repite o el folio se retira.">
</div>

[Fuente BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/content-lifecycle.bpmn) · [SVG a tamaño completo]({{ '/assets/img/workflows/content-lifecycle.svg' | relative_url }})
{: .bpmn-source }

| Etapa | Habilidad | Qué ocurre |
|-------|-----------|------------|
| plan | `content-plan` | Delimitar el alcance del trabajo, identificar artefactos y actores |
| author | `content-author` | Crear artefactos estructurados a partir del material fuente |
| validate | `content-validate` | Verificar frente al esquema y las restricciones |
| review | `content-review` | Revisión humana / por expertos (SME) frente a criterios |
| test | `content-test` | QA automatizado, compilación en verde, demostraciones/validadores aprobados |
| publish | `content-publish` | Renderizar y desplegar la versión publicada |
| feedback | `content-feedback` | Capturar y canalizar la retroalimentación de los revisores |
| retire | `content-retire` | Desaprobar o archivar un artefacto |

Las etapas del ciclo de vida son las mismas independientemente del tipo de contenido; lo que
varía son las habilidades de *autoría* y los *artefactos* que produce cada tipo. Para consultar
la lista completa de habilidades y los roles que las impulsan, consulta **[Habilidades y roles]({{ '/docs/cat-harness/concepts/es/skills.html' | relative_url }})**.

Dos cosas que los ocho nombres de etapa ocultan, y el diagrama no: `author` y
`validate` no son fases consecutivas sino un *bucle* —cada cambio propuesto pasa
por la compuerta de validación de HCI, y el editor ve los hallazgos antes de que se
confirme nada—, y `review` ocurre dos veces, una por cambio y otra sobre el
borrador ensamblado. Ambos se amplían en sus propios diagramas en la página del
**[flujo de publicación]({{ '/folio-assistant-core/process/es/publication-workflow.html' | relative_url }})**.

---
