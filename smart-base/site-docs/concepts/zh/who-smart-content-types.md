---
layout: default
title: "WHO SMART 指南 DAK（L2） · WHO SMART 实施指南（L3）"
lang: zh
nav_exclude: true
translation_status: unverified
translation_source: concepts/who-smart-content-types.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# WHO SMART 指南 DAK（L2） · WHO SMART 实施指南（L3）
{: .no_toc }

## WHO SMART 指南 DAK（L2）
{: #who-smart-guidelines-daks-l2 data-fa-label="sec:content-types-who-smart-guidelines-daks-l2" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l2-dak-authoring.bpmn){: .fa-node-edit title="Edit processes/l2-dak-authoring.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-guidelines-daks-l2.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-guidelines-daks-l2.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**技能包：** `authoring-who-smart-guidelines` ·
**指南：** [创作 WHO SMART DAK](../../guides/who-smart-dak.html)

**数字适应套件**（Digital Adaptation Kit，简称 **DAK**）是 WHO 指南的 *L2*（机器可读，但独立于具体实现）表示。folio-assistant 负责创作以下 L2 制品：

- **业务流程**——BPMN 2.0 工作流（`bpmn-authoring`）
- **决策逻辑**——DMN 决策表（`dmn-authoring`）
- **数据字典 / 核心数据元素**——Excel / 结构化表格
- **术语**——代码系统与值集（`terminology-management`）
- **人物画像、场景、指标、需求**

相关的技能模式：
[`l2-dak-authoring`]({{ '/reference/skills/l2-dak-authoring.html' | relative_url }})、
[`bpmn-authoring`]({{ '/reference/skills/bpmn-authoring.html' | relative_url }})、
[`dmn-authoring`]({{ '/reference/skills/dmn-authoring.html' | relative_url }})、
[`terminology-management`]({{ '/reference/skills/terminology-management.html' | relative_url }})。

<div class="bpmn-figure" id="figure-who-smart-guidelines-daks-l2">
  <img src="{{ '/zh/assets/img/workflows/l2-dak-authoring.svg' | relative_url }}"
       alt="L2 DAK 创作的 BPMN 泳道图：并行网关将人物画像、BPMN 流程、DMN 决策逻辑、数据字典和指标分流到业务分析师泳道，同时由术语专家进行绑定，随后临床领域专家（SME）的验证把关 DAK 的组装。">
</div>

[BPMN 2.0 source](https://github.com/litlfred/folio-assistant/blob/main/processes/l2-dak-authoring.bpmn) · [full-size SVG]({{ '/assets/img/workflows/l2-dak-authoring.svg' | relative_url }})
{: .bpmn-source }

---

## WHO SMART 实施指南（L3）
{: #who-smart-implementation-guides-l3 data-fa-label="sec:content-types-who-smart-implementation-guides-l3" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l3-fhir-pipeline.bpmn){: .fa-node-edit title="Edit fhir-harness/collab/processes/content/l3-fhir-pipeline.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-implementation-guides-l3.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-implementation-guides-l3.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**技能包：** `authoring-who-smart-guidelines` ·
**指南：** [创作 WHO SMART IG](../../guides/who-smart-ig.html)

*L3* 层将 L2 DAK 转换为可计算的 **FHIR 实施指南**（Implementation Guide）：

- **FHIR 资源**——以 **FSH**（FHIR Shorthand）编写并使用 **SUSHI** 进行编译（`l3-fhir-authoring`）
- **验证**——对照 FHIR Profile 进行验证（`fhir-validation`）
- **发布**——使用 **HL7 FHIR IG Publisher** 发布（`ig-publication`）
- **质量控制**——质控关卡（`quality-control`）

相关的技能模式：
[`l3-fhir-authoring`]({{ '/reference/skills/l3-fhir-authoring.html' | relative_url }})、
[`fhir-validation`]({{ '/reference/skills/fhir-validation.html' | relative_url }})、
[`ig-publication`]({{ '/reference/skills/ig-publication.html' | relative_url }})、
[`quality-control`]({{ '/reference/skills/quality-control.html' | relative_url }})。

<div class="bpmn-figure" id="figure-who-smart-implementation-guides-l3">
  <img src="{{ '/zh/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }}"
       alt="L3 流水线的 BPMN 泳道图：将 L2 映射到 L3、编写 FSH、SUSHI 编译、针对 Profile 进行验证（失败时循环回到 FSH）、将发现的问题记录为 bean 的质控把关、IG Publisher 构建，以及发布 IG 站点。">
</div>

[BPMN 2.0 source](https://github.com/litlfred/folio-assistant/blob/main/processes/l3-fhir-pipeline.bpmn) · [full-size SVG]({{ '/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }})
{: .bpmn-source }

---
