---
layout: default
title: "内容生命周期"
lang: zh
nav_exclude: true
translation_status: unverified
translation_source: concepts/content-lifecycle.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# 内容生命周期
{: .no_toc }

## 内容生命周期
{: #the-content-lifecycle data-fa-label="sec:content-types-the-content-lifecycle" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/content-lifecycle.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/content-lifecycle.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="the-content-lifecycle.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="the-content-lifecycle.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

每种内容类型都遵循相同的生命周期，该生命周期由通用的 **`content-lifecycle`** 技能包提供：

<div class="bpmn-figure" id="figure-the-content-lifecycle">
  <img src="{{ '/zh/assets/img/workflows/content-lifecycle.svg' | relative_url }}"
       alt="单个 folio 周期的 BPMN 泳道图：项目经理进行规划，规划以 bean 的形式提供初始数据，针对每次提议的变更运行编辑和人机交互（HCI）验证，随后进行集成测试和 QA 全面检查，然后是草稿-审阅-发布；对反馈进行分类并记录为 bean，整个周期要么重复，要么将 folio 归档退役。">
</div>

[BPMN 2.0 source](https://github.com/litlfred/folio-assistant/blob/main/processes/content-lifecycle.bpmn) · [full-size SVG]({{ '/assets/img/workflows/content-lifecycle.svg' | relative_url }})
{: .bpmn-source }

| 阶段 | 技能 | 发生的操作 |
|-------|-------|--------------|
| plan | `content-plan` | 确定工作范围，识别制品与参与者 |
| author | `content-author` | 从源材料创建结构化制品 |
| validate | `content-validate` | 对照模式（schema）与约束进行检查 |
| review | `content-review` | 人工 / 领域专家（SME）对照标准进行审阅 |
| test | `content-test` | 自动化 QA、构建通过（green）、证明/验证器通过 |
| publish | `content-publish` | 渲染并部署已发布形式 |
| feedback | `content-feedback` | 捕获并转交审阅者反馈 |
| retire | `content-retire` | 弃用或归档制品 |

无论内容类型为何，生命周期阶段都是相同的——不同之处在于每种类型所产生的*创作*（authoring）技能和*制品*（artifacts）。有关技能的完整列表以及驱动它们的角色，请参阅**[技能与角色]({{ '/docs/cat-harness/concepts/zh/skills.html' | relative_url }})**。

八个阶段名称隐藏了两件事，而流程图将其清晰呈现：`author`（创作）与 `validate`（验证）并非先后继起的阶段，而是一个*循环*——每次提议的变更都会运行人机交互（HCI）验证关卡，编辑器在提交任何内容之前都会看到发现的问题——并且 `review`（审阅）会发生两次，一次针对每次变更，另一次针对组装后的草稿。这两者都在**[发布工作流]({{ '/folio-assistant-core/process/zh/publication-workflow.html' | relative_url }})**页面上展开为各自独立的图表。

---
