---
layout: default
title: "Жизненный цикл контента"
lang: ru
nav_exclude: true
translation_status: unverified
translation_source: concepts/content-lifecycle.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Жизненный цикл контента
{: .no_toc }

## Жизненный цикл контента
{: #the-content-lifecycle data-fa-label="sec:content-types-the-content-lifecycle" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/content-lifecycle.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/content-lifecycle.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="the-content-lifecycle.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="the-content-lifecycle.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

Каждый тип контента проходит через один и тот же жизненный цикл, предоставляемый сквозным пакетом навыков **`content-lifecycle`**:

<div class="bpmn-figure" id="figure-the-content-lifecycle">
  <img src="{{ '/ru/assets/img/workflows/content-lifecycle.svg' | relative_url }}"
       alt="BPMN-диаграмма с дорожками одного цикла фолио: руководитель программы планирует работу, план заносится в виде beans, редактирование и валидация HCI выполняются для каждого предлагаемого изменения, затем следуют интеграционное тестирование и прогон QA, после чего — черновик, рецензирование и публикация; обратная связь проходит триаж и регистрируется в виде beans, и цикл либо повторяется, либо фолио выводится из эксплуатации.">
</div>

[Исходный код BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/content-lifecycle.bpmn) · [полноразмерный SVG]({{ '/assets/img/workflows/content-lifecycle.svg' | relative_url }})
{: .bpmn-source }

| Этап | Навык | Что происходит |
|-------|-------|--------------|
| plan | `content-plan` | Определение границ работы, выявление артефактов и действующих лиц |
| author | `content-author` | Создание структурированных артефактов из исходного материала |
| validate | `content-validate` | Проверка на соответствие схеме и ограничениям |
| review | `content-review` | Рецензирование человеком / экспертом предметной области (SME) по критериям |
| test | `content-test` | Автоматизированный контроль качества (QA), успешная сборка («зеленый» билд), прохождение доказательств и валидаторов |
| publish | `content-publish` | Рендеринг и развертывание опубликованного формата |
| feedback | `content-feedback` | Сбор и маршрутизация отзывов рецензентов |
| retire | `content-retire` | Объявление артефакта устаревшим или его архивация |

Этапы жизненного цикла одинаковы независимо от типа контента — различаются лишь навыки *создания* (authoring) и *артефакты*, создаваемые каждым типом. Полный список навыков и ролей, которые их выполняют, см. в разделе **[Навыки и роли]({{ '/docs/cat-harness/concepts/ru/skills.html' | relative_url }})**.

Две вещи, которые скрывают названия восьми этапов, но наглядно показывает диаграмма: `author` и `validate` — это не последовательные фазы, а *цикл*: каждое предлагаемое изменение проходит через шлюз валидации HCI, и редактор видит результаты до фиксации изменений (commit); кроме того, этап `review` выполняется дважды: один раз для каждого изменения и один раз для собранного черновика целиком. Обе эти ветки подробно раскрываются на собственных диаграммах на странице **[Процесс публикации]({{ '/folio-assistant-core/process/ru/publication-workflow.html' | relative_url }})**.

---
