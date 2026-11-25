---
layout: default
title: "文档与政策指南"
lang: zh
nav_exclude: true
translation_status: unverified
translation_source: concepts/document-content-type.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# 文档与政策指南
{: .no_toc }

## 文档与政策指南
{: #documents-policy-guidance }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/authoring-a-document.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/authoring-a-document.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="documents-policy-guidance.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/documents-policy-guidance.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**技能包：** `folio-document-adapter` ·
**适配器：** `document` ·
**指南：** [编写文档](../../guides/writing-a-document.html)

结构化散文：卫生政策指南（比如 L1 指南）、标准、报告、手册、书籍章节。论文所具备的一切它都有，唯独缺少形式化层——因而也去掉了服务于形式化层的两条工具链。

- **源模型**（Source model）——与论文相同的类型化*块*（blocks）构成的树，仅限于内容为散文而非形式化主张的类型：`prose`、`example`、`remark`、`algorithm`、`simulator`、`equation`、`diagram`、`table`。
- **渲染**（Rendering）——`document_render_md` 将 folio 组装为一个 Markdown 文件；`document_render_html` 与 `document_render_pdf` 则通过 pandoc 进行处理。PDF 路径使用 HTML 引擎（weasyprint、prince、wkhtmltopdf），并且**绝不**回退到 `latexmk`，因此“无需安装 TeX”始终名副其实，而不是变成“直到某人安装了 TeX 为止才名副其实”。
- **强制约束**（Enforcement）——`content_profile_check` 会拒绝数学类型、`lean` 字段或同级的 `.lean` 文件，并在每次 `content_validate` 时运行。

相关的技能模式：
[`document-authoring`]({{ '/reference/skills/document-authoring.html' | relative_url }})、
[`document-structure`]({{ '/reference/skills/document-structure.html' | relative_url }})、
[`normative-statements`]({{ '/reference/skills/normative-statements.html' | relative_url }})、
[`document-publishing`]({{ '/reference/skills/document-publishing.html' | relative_url }})。

<div class="bpmn-figure" id="figure-documents-policy-guidance">
  <img src="{{ '/zh/assets/img/workflows/authoring-a-document.svg' | relative_url }}"
       alt="文档创作的 BPMN 泳道图：作者进行规划，规划以 bean 的形式提供初始数据，智能体搭建 folio 脚手架并创作块，构建流水线在验证和渲染为 Markdown、HTML 及 PDF 之前检查声明的配置文件，最后由审阅者把关决定是否发布。">
</div>

[BPMN 2.0 source](https://github.com/litlfred/folio-assistant/blob/main/processes/authoring-a-document.bpmn) · [full-size SVG]({{ '/assets/img/workflows/authoring-a-document.svg' | relative_url }})
{: .bpmn-source }

### 承载规范性陈述
{: #carrying-a-normative-statement data-fa-label="sec:content-types-carrying-a-normative-statement" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/content/docs/content-types/carrying-a-normative-statement.md){: .fa-node-edit title="Edit content/docs/content-types/carrying-a-normative-statement.md" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="carrying-a-normative-statement.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/carrying-a-normative-statement.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span></span>

建议、要求或规则是读者所引述、实施者所追踪的块。它需要标签、稳定的标识以及在依赖图中的位置——`theorem`（定理）所拥有的一切——但它断然不是定理，因为没有任何东西去证明它。

目前**不存在作为一等公民的 `recommendation` 块类型**。目前它的载体是一个带有标签和标题的 `prose` 块；[`normative-statements`]({{ '/reference/skill-instructions/normative-statements.html' | relative_url }}) 技能阐明了该约定及其限制。早期在 `document-intake` 中的指导意见将指南建议映射到 `definition` 上——这早于当前这种内容类型，并且对文档 folio 而言是错误的，因为在文档 folio 中 `definition` 属于数学类型，且其 `lean` 字段是必填项。

---
