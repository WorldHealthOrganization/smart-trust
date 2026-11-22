---
layout: default
title: 贡献指南
lang: zh
nav_exclude: true
translation_status: unverified
translation_source: start/contributing.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# 贡献指南
{: .no_toc }

1. TOC
{:toc}

---

## 开发环境搭建

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
bun test          # 单元测试
bun run cat lint      # eslint
bun run cat test:e2e      # 端到端测试 (test:e2e)
```

## 使用 `beans` 管理工作计划

本项目使用 [`beans`](https://github.com/hmans/beans) 作为唯一的待办事项/工作计划机制（参见 `AGENTS.md`）。**切勿**另外建立独立的待办事项存储。

```sh
cat-harness-tools/scripts/install-beans.sh
beans list
beans create "<title>"
bun run cat beans:claim <id>   # 开始工作前先认领
```

`beans ≠ sidecars`：切勿对机器批量生成的队列（QA、witness、watcher）使用 `beans create`——这些应保留为批量 JSON。

## 智能体指引

`AGENTS.md` 是通用的智能体单一事实来源（Claude Code、Gemini CLI、Antigravity、Cursor、Copilot 均原生支持读取）。`CLAUDE.md` / `GEMINI.md` 是指向它的轻量存根。当修改智能体指引时，请更新 `AGENTS.md` 而非针对特定工具的文件。

## 文档

- 说明文档位于 `docs/` 下（即本 Jekyll 站点）。
- **技能模式参考**是自动生成的——切勿手动编辑 `docs/reference/skills/*.md`。请编辑 `schemas/skills/<skill>/` 下的 JSON Schema 并重新生成：

  ```sh
  bun run cat-harness-tools/scripts/gen-schema-docs.ts
  ```

- **技能指令**（`docs/reference/skill-instructions/*.md`）也是自动生成的——切勿手动编辑。请编辑 `skills/`、`sdlc/skills/` 和 `work-plan/skills/` 下的技能正文并重新生成：

  ```sh
  bun run cat-harness-tools/scripts/gen-skill-docs.ts
  ```

- **TypeScript API 参考**（`/api/`）由 CI 中的 TypeDoc 自动生成。
- 每次推送到 `main` 且涉及文档、模式或源码的提交，都会由 `.github/workflows/docs-site.yml` 自动构建该站点并部署到 GitHub Pages。

本地预览：

```sh
cd docs
bundle install
bundle exec jekyll serve
```

## 交付变更

在第一次提交时就发起 PR；合并前：验证 → 确认可合并 → 推送。参见 `sdlc/skills/sdlc-core/prepare-merge.md`。保持**框架的形式化体系与内容分离**——内容应当存放于其独立的代码仓库中，本文档中的任何内容均仅用于演示说明。
