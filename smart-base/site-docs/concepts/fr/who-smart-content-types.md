---
layout: default
title: "DAK des Lignes directrices SMART de l'OMS (L2) · Guides d'implémentation SMART de l'OMS (L3)"
lang: fr
nav_exclude: true
translation_status: unverified
translation_source: concepts/who-smart-content-types.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# DAK des Lignes directrices SMART de l'OMS (L2) · Guides d'implémentation SMART de l'OMS (L3)
{: .no_toc }

## DAK des Lignes directrices SMART de l'OMS (L2)
{: #who-smart-guidelines-daks-l2 data-fa-label="sec:content-types-who-smart-guidelines-daks-l2" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l2-dak-authoring.bpmn){: .fa-node-edit title="Edit processes/l2-dak-authoring.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-guidelines-daks-l2.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-guidelines-daks-l2.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**Ensemble de compétences :** `authoring-who-smart-guidelines` ·
**Guide :** [Rédiger un DAK SMART de l'OMS](../../guides/who-smart-dak.html)

Un **kit d'adaptation numérique (DAK - Digital Adaptation Kit)** est la représentation *L2* (lisible
par machine, mais neutre quant à l'implémentation) d'une ligne directrice de l'OMS. folio-assistant
rédige les artefacts L2 :

- **Processus métier** — flux de travail BPMN 2.0 (`bpmn-authoring`)
- **Logique de décision** — tables de décision DMN (`dmn-authoring`)
- **Dictionnaires de données / éléments de données fondamentaux** — Excel / tableaux structurés
- **Terminologie** — systèmes de codage et jeux de valeurs (`terminology-management`)
- **Personas, scénarios, indicateurs, exigences**

Schémas de compétences pertinents :
[`l2-dak-authoring`]({{ '/reference/skills/l2-dak-authoring.html' | relative_url }}),
[`bpmn-authoring`]({{ '/reference/skills/bpmn-authoring.html' | relative_url }}),
[`dmn-authoring`]({{ '/reference/skills/dmn-authoring.html' | relative_url }}),
[`terminology-management`]({{ '/reference/skills/terminology-management.html' | relative_url }}).

<div class="bpmn-figure" id="figure-who-smart-guidelines-daks-l2">
  <img src="{{ '/fr/assets/img/workflows/l2-dak-authoring.svg' | relative_url }}"
       alt="Diagramme BPMN à couloirs de la rédaction d'un DAK L2 : une passerelle parallèle distribue les personas, les processus BPMN, la logique de décision DMN, le dictionnaire de données et les indicateurs sur le couloir de l'analyste métier aux côtés des liaisons du terminologue, puis la validation par l'expert métier clinique contrôle l'assemblage du DAK.">
</div>

[Source BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/l2-dak-authoring.bpmn) · [SVG en taille réelle]({{ '/assets/img/workflows/l2-dak-authoring.svg' | relative_url }})
{: .bpmn-source }

---

## Guides d'implémentation SMART de l'OMS (L3)
{: #who-smart-implementation-guides-l3 data-fa-label="sec:content-types-who-smart-implementation-guides-l3" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l3-fhir-pipeline.bpmn){: .fa-node-edit title="Edit fhir-harness/collab/processes/content/l3-fhir-pipeline.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-implementation-guides-l3.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-implementation-guides-l3.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**Ensemble de compétences :** `authoring-who-smart-guidelines` ·
**Guide :** [Rédiger un IG SMART de l'OMS](../../guides/who-smart-ig.html)

La couche *L3* transforme un DAK L2 en un **Guide d'implémentation FHIR** calculable :

- **Ressources FHIR** rédigées en **FSH** (FHIR Shorthand) et compilées avec
  **SUSHI** (`l3-fhir-authoring`)
- **Validation** par rapport aux profils FHIR (`fhir-validation`)
- **Publication** avec le **HL7 FHIR IG Publisher** (`ig-publication`)
- Portes de **contrôle qualité** (`quality-control`)

Schémas de compétences pertinents :
[`l3-fhir-authoring`]({{ '/reference/skills/l3-fhir-authoring.html' | relative_url }}),
[`fhir-validation`]({{ '/reference/skills/fhir-validation.html' | relative_url }}),
[`ig-publication`]({{ '/reference/skills/ig-publication.html' | relative_url }}),
[`quality-control`]({{ '/reference/skills/quality-control.html' | relative_url }}).

<div class="bpmn-figure" id="figure-who-smart-implementation-guides-l3">
  <img src="{{ '/fr/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }}"
       alt="Diagramme BPMN à couloirs du pipeline L3 : mapper L2 vers L3, rédiger en FSH, compiler avec SUSHI, valider par rapport aux profils avec une boucle de retour vers FSH en cas d'échec, portes de contrôle qualité qui enregistrent les anomalies sous forme de beans, compilation avec l'IG Publisher, et publication du site de l'IG.">
</div>

[Source BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/l3-fhir-pipeline.bpmn) · [SVG en taille réelle]({{ '/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }})
{: .bpmn-source }

---
