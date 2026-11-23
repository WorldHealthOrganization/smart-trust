---
layout: default
title: "Documentos y directrices de políticas"
lang: es
nav_exclude: true
translation_status: unverified
translation_source: concepts/document-content-type.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Documentos y directrices de políticas
{: .no_toc }

## Documentos y directrices de políticas
{: #documents-policy-guidance }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/authoring-a-document.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/authoring-a-document.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="documents-policy-guidance.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/documents-policy-guidance.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**Paquete de habilidades:** `folio-document-adapter` ·
**Adaptador:** `document` ·
**Guía:** [Redacción de un documento](../../guides/writing-a-document.html)

Prosa estructurada: directrices de políticas de salud (por ejemplo, una guía L1), un estándar,
un informe, un manual, el capítulo de un libro. Todo lo que es un artículo, menos la capa
formal —y, por lo tanto, menos las dos cadenas de herramientas que la atienden—.

- **Modelo fuente** — el mismo árbol de *bloques* tipados que un artículo, restringido
  a los tipos cuyo contenido es prosa en lugar de una afirmación formal: `prose`,
  `example`, `remark`, `algorithm`, `simulator`, `equation`, `diagram`,
  `table`.
- **Renderizado** — `document_render_md` ensambla el folio en un único archivo
  Markdown; `document_render_html` y `document_render_pdf` lo procesan a través de
  pandoc. La ruta para PDF utiliza un motor HTML (weasyprint, prince, wkhtmltopdf)
  y **nunca** recurre a `latexmk`, de modo que «no se requiere TeX» se mantiene verdadero
  en lugar de convertirse en «verdadero hasta que alguien instale TeX».
- **Control de cumplimiento** — `content_profile_check` rechaza cualquier tipo matemático,
  campo `lean` o archivo hermano `.lean`, y se ejecuta en cada `content_validate`.

Esquemas de habilidades pertinentes:
[`document-authoring`]({{ '/reference/skills/document-authoring.html' | relative_url }}),
[`document-structure`]({{ '/reference/skills/document-structure.html' | relative_url }}),
[`normative-statements`]({{ '/reference/skills/normative-statements.html' | relative_url }}),
[`document-publishing`]({{ '/reference/skills/document-publishing.html' | relative_url }}).

<div class="bpmn-figure" id="figure-documents-policy-guidance">
  <img src="{{ '/es/assets/img/workflows/authoring-a-document.svg' | relative_url }}"
       alt="Diagrama de carriles BPMN de autoría de documentos: el autor planifica, el plan se siembra como beans, un agente genera la estructura del folio y redacta los bloques, la canalización de compilación comprueba el perfil declarado antes de validar y renderizar a Markdown, HTML y PDF, y un revisor autoriza la publicación.">
</div>

[Fuente BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/authoring-a-document.bpmn) · [SVG a tamaño completo]({{ '/assets/img/workflows/authoring-a-document.svg' | relative_url }})
{: .bpmn-source }

### Portar una declaración normativa
{: #carrying-a-normative-statement data-fa-label="sec:content-types-carrying-a-normative-statement" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/content/docs/content-types/carrying-a-normative-statement.md){: .fa-node-edit title="Edit content/docs/content-types/carrying-a-normative-statement.md" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="carrying-a-normative-statement.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/carrying-a-normative-statement.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span></span>

Una recomendación, requisito o regla es el bloque que los lectores citan y
al que los implementadores dan seguimiento. Requiere una etiqueta, una identidad estable y un lugar en el
grafo de dependencias —todo lo que tiene un `theorem`— y enfáticamente no es un
teorema, porque nada lo demuestra.

No existe **un tipo de bloque `recommendation` de primera clase**. Hoy en día, el portador es un
bloque `prose` con una etiqueta y un título; la habilidad
[`normative-statements`]({{ '/reference/skill-instructions/normative-statements.html' | relative_url }})
establece la convención y sus límites. Las orientaciones anteriores en
`document-intake` mapeaban las recomendaciones de las guías a `definition` —eso
es anterior a este tipo de contenido y es incorrecto para un folio de documento, donde
`definition` es un tipo matemático cuyo campo `lean` es obligatorio.

---
