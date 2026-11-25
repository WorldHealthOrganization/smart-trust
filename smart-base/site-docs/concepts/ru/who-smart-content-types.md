---
layout: default
title: "Комплекты цифровой адаптации (DAK) руководств ВОЗ SMART Guidelines (L2) · Руководства по реализации ВОЗ SMART Guidelines (L3)"
lang: ru
nav_exclude: true
translation_status: unverified
translation_source: concepts/who-smart-content-types.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Комплекты цифровой адаптации (DAK) руководств ВОЗ SMART Guidelines (L2) · Руководства по реализации ВОЗ SMART Guidelines (L3)
{: .no_toc }

## Комплекты цифровой адаптации (DAK) руководств ВОЗ SMART Guidelines (L2)
{: #who-smart-guidelines-daks-l2 data-fa-label="sec:content-types-who-smart-guidelines-daks-l2" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l2-dak-authoring.bpmn){: .fa-node-edit title="Edit processes/l2-dak-authoring.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-guidelines-daks-l2.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-guidelines-daks-l2.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**Пакет навыков:** `authoring-who-smart-guidelines` ·
**Руководство:** [Создание DAK ВОЗ SMART](../../guides/who-smart-dak.html)

**Комплект цифровой адаптации (Digital Adaptation Kit, DAK)** — это представление руководства ВОЗ на уровне *L2* (машиночитаемое, но нейтральное к реализации). folio-assistant создает артефакты уровня L2:

- **Бизнес-процессы** — рабочие процессы BPMN 2.0 (`bpmn-authoring`)
- **Логика решений** — таблицы решений DMN (`dmn-authoring`)
- **Словари данных / основные элементы данных** — Excel / структурированные таблицы
- **Терминология** — системы кодов и наборы значений (`terminology-management`)
- **Персоны, сценарии, индикаторы, требования**

Соответствующие схемы навыков:
[`l2-dak-authoring`]({{ '/reference/skills/l2-dak-authoring.html' | relative_url }}),
[`bpmn-authoring`]({{ '/reference/skills/bpmn-authoring.html' | relative_url }}),
[`dmn-authoring`]({{ '/reference/skills/dmn-authoring.html' | relative_url }}),
[`terminology-management`]({{ '/reference/skills/terminology-management.html' | relative_url }}).

<div class="bpmn-figure" id="figure-who-smart-guidelines-daks-l2">
  <img src="{{ '/ru/assets/img/workflows/l2-dak-authoring.svg' | relative_url }}"
       alt="BPMN-диаграмма с дорожками процесса создания L2 DAK: параллельный шлюз распределяет персоны, процессы BPMN, логику решений DMN, словарь данных и индикаторы по дорожке бизнес-аналитика параллельно с привязками терминолога, затем валидация медицинскими экспертами (SME) открывает шлюз сборки DAK.">
</div>

[Исходный код BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/l2-dak-authoring.bpmn) · [полноразмерный SVG]({{ '/assets/img/workflows/l2-dak-authoring.svg' | relative_url }})
{: .bpmn-source }

---

## Руководства по реализации ВОЗ SMART Guidelines (L3)
{: #who-smart-implementation-guides-l3 data-fa-label="sec:content-types-who-smart-implementation-guides-l3" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l3-fhir-pipeline.bpmn){: .fa-node-edit title="Edit fhir-harness/collab/processes/content/l3-fhir-pipeline.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-implementation-guides-l3.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-implementation-guides-l3.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**Пакет навыков:** `authoring-who-smart-guidelines` ·
**Руководство:** [Создание IG ВОЗ SMART](../../guides/who-smart-ig.html)

Уровень *L3* преобразует DAK уровня L2 в вычислимое **руководство по реализации FHIR (FHIR Implementation Guide)**:

- **Ресурсы FHIR**, создаваемые на **FSH** (FHIR Shorthand) и компилируемые с помощью **SUSHI** (`l3-fhir-authoring`)
- **Валидация** на соответствие профилям FHIR (`fhir-validation`)
- **Публикация** с использованием **HL7 FHIR IG Publisher** (`ig-publication`)
- Шлюзы **контроля качества** (`quality-control`)

Соответствующие схемы навыков:
[`l3-fhir-authoring`]({{ '/reference/skills/l3-fhir-authoring.html' | relative_url }}),
[`fhir-validation`]({{ '/reference/skills/fhir-validation.html' | relative_url }}),
[`ig-publication`]({{ '/reference/skills/ig-publication.html' | relative_url }}),
[`quality-control`]({{ '/reference/skills/quality-control.html' | relative_url }}).

<div class="bpmn-figure" id="figure-who-smart-implementation-guides-l3">
  <img src="{{ '/ru/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }}"
       alt="BPMN-диаграмма с дорожками конвейера L3: сопоставление L2 с L3, написание FSH, компиляция в SUSHI, валидация по профилям с циклом возврата к FSH в случае ошибок, шлюзы контроля качества, регистрирующие замечания в виде beans, сборка в IG Publisher и публикация сайта IG.">
</div>

[Исходный код BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/l3-fhir-pipeline.bpmn) · [полноразмерный SVG]({{ '/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }})
{: .bpmn-source }

---
