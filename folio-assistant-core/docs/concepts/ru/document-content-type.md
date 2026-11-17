---
layout: default
title: "Документы и нормативные руководства"
lang: ru
nav_exclude: true
translation_status: unverified
translation_source: concepts/document-content-type.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Документы и нормативные руководства
{: .no_toc }

## Документы и нормативные руководства
{: #documents-policy-guidance }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/authoring-a-document.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/authoring-a-document.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="documents-policy-guidance.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/documents-policy-guidance.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**Пакет навыков:** `folio-document-adapter` ·
**Адаптер:** `document` ·
**Руководство:** [Написание документа](../../guides/writing-a-document.html)

Структурированная проза: рекомендации в области политики здравоохранения (скажем, руководство уровня L1), стандарт, отчет, справочник, глава книги. Всё, чем является научная статья, за вычетом формального уровня — и, следовательно, за вычетом двух обслуживающих его инструментальных цепочек.

- **Исходная модель** — то же дерево типизированных *блоков*, что и в статье, ограниченное теми видами, чьим содержимым является проза, а не формальное утверждение: `prose`, `example`, `remark`, `algorithm`, `simulator`, `equation`, `diagram`, `table`.
- **Рендеринг** — `document_render_md` собирает фолио в один Markdown-файл; `document_render_html` и `document_render_pdf` проводят его через pandoc. Путь сборки PDF использует HTML-движок (weasyprint, prince, wkhtmltopdf) и **никогда** не откатывается к `latexmk`, благодаря чему принцип «TeX не требуется» остается истинным, а не превращается в «истинно, пока у кого-то не установлен TeX».
- **Контроль соблюдения** — `content_profile_check` отклоняет математический вид, поле `lean` или соседний файл `.lean`, и выполняется при каждой проверке `content_validate`.

Соответствующие схемы навыков:
[`document-authoring`]({{ '/reference/skills/document-authoring.html' | relative_url }}),
[`document-structure`]({{ '/reference/skills/document-structure.html' | relative_url }}),
[`normative-statements`]({{ '/reference/skills/normative-statements.html' | relative_url }}),
[`document-publishing`]({{ '/reference/skills/document-publishing.html' | relative_url }}).

<div class="bpmn-figure" id="figure-documents-policy-guidance">
  <img src="{{ '/ru/assets/img/workflows/authoring-a-document.svg' | relative_url }}"
       alt="BPMN-диаграмма с дорожками процесса написания документа: автор планирует работу, план заносится в виде beans, агент формирует каркас фолио и создает блоки, конвейер сборки проверяет объявленный профиль перед валидацией и рендерингом в Markdown, HTML и PDF, а рецензент открывает доступ к публикации.">
</div>

[Исходный код BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/authoring-a-document.bpmn) · [полноразмерный SVG]({{ '/assets/img/workflows/authoring-a-document.svg' | relative_url }})
{: .bpmn-source }

### Передача нормативного утверждения
{: #carrying-a-normative-statement data-fa-label="sec:content-types-carrying-a-normative-statement" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/content/docs/content-types/carrying-a-normative-statement.md){: .fa-node-edit title="Edit content/docs/content-types/carrying-a-normative-statement.md" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="carrying-a-normative-statement.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/carrying-a-normative-statement.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span></span>

Рекомендация, требование или правило — это блок, на который ссылаются читатели и к которому обращаются разработчики реализации. Ему необходимы метка, стабильный идентификатор и место в графе зависимостей — всё то же самое, что есть у `theorem` — но это категорически не теорема, поскольку ее ничто не доказывает.

Отдельного **первоклассного вида блока `recommendation` не существует**. Сегодня его носителем выступает блок `prose` с меткой и заголовком; соглашение и его ограничения описаны в навыке [`normative-statements`]({{ '/reference/skill-instructions/normative-statements.html' | relative_url }}). Более ранние указания в `document-intake` сопоставляли рекомендации руководств с видом `definition` — это предшествовало появлению данного типа контента и неверно для фолио документа, где `definition` является математическим видом, у которого поле `lean` обязательно.

---
