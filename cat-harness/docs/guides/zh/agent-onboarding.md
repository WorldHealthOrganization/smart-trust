---
layout: default
title: "代理入门 (ZH)"
parent: Authoring guides
lang: zh
# `lang` above is what makes this a translation -- nothing reads `fr` out of
# the path. `nav_exclude` keeps it out of the statically built nav, and
# `mountNavLocale` (site-chrome/assets/js/docs-ui.js) puts it back in place of its
# source when this locale is selected. There is no `nav_order`: it stands
# where its source stands. library/skills/library-core/translation-manager.md
nav_exclude: true
translation_status: unverified
translation_source: guides/agent-onboarding.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# 代理入门
{: .no_toc }

你是一个刚刚被引入使用 folio-assistant 的代码仓库的 LLM 代理。本页面是你的入职指引：你正在面对什么、第一步该做什么，以及在何处查阅资料。

有关技能、角色和能力的*架构*，请阅读[技能与角色](../../concepts/skills.html)。本页面则是其实操版本。

1. TOC
{:toc}

---

## 1. 搞清楚你位于哪个仓库中

仓库有两种类型，在早期将它们混淆是最常见的错误。

| | **folio-assistant**（平台） | **作品集（folio）**（内容仓库） |
|---|---|---|
| 包含内容 | 技能、模式、流水线、MCP 服务器 | 实际的论文 / 指南 / 实施指南（IG） |
| 拥有 `content/<paper>/` | 否 — 仅有 `content/pipeline/` | 是 |
| 你在此编辑以 | 修改创作的工作机制 | 修改正在创作的内容 |

```sh
ls content/          # pipeline/ only  ⇒ platform;  paper dirs ⇒ folio
```

**folio-assistant 不包含任何具体内容。** 如果你发现自己正准备向其中编写具体主题内容——章节、常量、章节关键词列表——说明你位于错误的仓库中，或者你正在编写的内容应当由 folio 提供数据。参见 §7。

## 2. 你的前五分钟

```sh
beans prime && beans list      # the work-plan — see §6
cat-harness-tools/scripts/session-start-coord-sweep.sh  # CLI-independent equivalent
bun run cat check-deps                     # what this environment can do
```

当缺少工具（无 Lean 工具链、无 Atlas、无 LaTeX）时，许多检查项会降级为 `n/a` 而不是直接报错。**`n/a` 并不代表通过：**阐明跳过了什么以及跳过的原因，因为在不清楚跳过内容时报告“一切正常”，就是把数据的缺失当作了结果。

## 3. 寻找合适的技能 — 切勿即兴发挥

技能是这里的工作单元。在手动编写流程之前，先检查是否已存在现成的技能。**通过 `skill_list` 和 `skill_fetch` 获取技能；不要按路径查找。**

| 位置 | 它为你提供的内容 |
|---|---|
| [技能模式参考]({{ site.baseurl }}/reference/skills/) | 每项技能生成的输入/输出契约 |
| [技能指令]({{ site.baseurl }}/reference/skill-instructions/) | 生成的完整指令主体 |
| [技能与角色](../../concepts/skills.html) | 技能、角色与能力如何组合 |

两个 `reference/` 目录都是**自动生成的** — 绝不要手动编辑它们。请使用 `bun run cat-harness-tools/scripts/gen-schema-docs.ts` 和 `bun run cat-harness-tools/scripts/gen-skill-docs.ts` 重新生成。

## 4. 内容对象模型简述

内容块是由共享相同根名称的**三元组**组成的：

```
<block>.ts     manifest — label, kind, uses[], lean.ref, cites[]
<block>.md     the narrative a reader actually reads
<block>.lean   the formalisation (when the kind requires one)
<block>.qa.json  QA sidecar — audit results, per criterion
```

`.ts` 清单文件是结构的单一真实来源。形式化*状态*是在构建时派生出来的，绝不会存储在清单中。

## 5. 两种依赖关系 — 切勿混为一谈

- **`uses[]` 属于编辑层面的依赖。**“读者必须先阅读什么才能理解这个内容块？” 由人工/代理撰写并维护。
- **形式化图是机器派生的**，派生自 `lean.ref`，绝非手动编写。

它们在两个方向上都存在合理的差异：证明可能会调用不需要读者阅读的 `simp` 引理；而定理可能由某个从未被形式化引用的示例所启发。

**绝不要从 Lean 中自动填充 `uses[]`。** 这会破坏计算每项排序指标所依赖的信号。对于影响分析问题（“如果修改此项会破坏什么？”），请取两者的并集：

```sh
bun run content/pipeline/content-graph.ts content/<paper>
```

审计 `uses[]` 是否合理使用属于其专属技能：`uses-editorial-review`，外加机械化的 `uses` QA 轴。

## 6. 在 beans 中跟踪工作，不要凭记忆跟踪

`beans` 是**唯一**的待办事项机制 — 既作用于会话本地，*也*跨代理共享。`beans/` 保存在状态分支上，并在会话开始时挂载（`bun run cat state:mount`），因此工作计划可以在全新容器中恢复会话时留存下来。

```sh
beans list
beans create "<title>"
bun run cat beans:claim <id>             # CLAIM before you work
```

在开始工作前先进行申领，以免两个会话认领同一项任务；并且绝不要解决或删除同伴的 work item。不要建立平行的待办事项存储。不要用 `beans create` 来批量创建机器生成的队列（`*.qa.json`、证据文件等）— 这些应保留为批量 JSON。

完整规范：`work-plan/skills/work-plan/todo-manager.md`、`work-plan/skills/work-plan/bean-coordination.md`。

## 7. QA 附属文件与维度轴

每个内容块都可以附带一个 `<block>.qa.json`，按标准记录每位评审员的发现 — 包括 `script`、`agent` 或 `human`。记录项在审计时带有源文件哈希值，因此在内容块被编辑时，记录项会**过期**，必须重新判定。

评判标准按**维度轴**分组（`proof`、`voice`、`detangler`、`uses`、`canonical`、`compute`、`bibliography` 等）。运行其中一个轴：

```sh
bun run content/pipeline/qa-sweep.ts --axis uses content/<paper>
bun run content/pipeline/qa-staleness.ts content/<paper>
```

有些标准是 `automated: true`（由脚本判定），有些则是 `automated: false`（必须由代理或人工裁决）。第二种会消耗实际交互轮次 — 参见 `semantic-cone.ts`，了解如何根据其实际能影响的范围来界定其执行范围。

**作品集可选维度轴。** 编码某个作品集特定主题的维度轴仅在作品集明确选择启用时才会注册：

```json
// <name>.config.json
{ "qaAxes": ["q-usage"] }
```

同样，作品集专属的*数据*属于作品集本身，而非平台 — 例如 `content/<paper>/topic-keywords.json` 驱动 `detangler-topic-coherence`，若缺少该文件，检查器将报告 `n/a`。

## 8. 交付工作

```sh
/prepare-merge [base]
```

运行通用配方以及特定内容类型的关卡（论文 → content_validate / qa_sweep / proof_status / latex_preflight / lean_build），然后执行推送。**它不会执行合并。**

监视同伴的 PR：`/watch <pr|branch>`。

## 9. 查阅信息的位置

| 问题 | 解答 |
|---|---|
| 项目命令、约定 | `AGENTS.md`（代理通用的单一真实来源） |
| 某个技能的作用 | `skills/**/`，或生成的[指令主体]({{ site.baseurl }}/reference/skill-instructions/) |
| 技能的类型化契约 | [技能模式参考]({{ site.baseurl }}/reference/skills/) |
| QA 判据的含义 | `content/pipeline/qa-criteria-registry.ts` — 其中的描述即为规范 |
| 内容块模式 | `schemas/types.ts` |
| QA 附属文件模式 | `schemas/block-qa.ts` |
| 当前环境能够执行的操作 | `cat-harness/scenarios/capabilities/*.json`、`check-deps` |

## 10. 让你避免陷入麻烦的良好习惯

- **不要硬编码论文名称。** 一个作品集可能包含多篇论文；使用 `content/pipeline/repo-root.ts` 中的 `findPapers()` / `soleFolioPaper()` 解析。
- **在对检查发现采取行动前，先阅读判据描述。** 它们陈述了严重程度、意图以及明确*不*算作违规的情况。
