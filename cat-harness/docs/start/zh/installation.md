---
layout: default
title: 安装
lang: zh
nav_exclude: true
translation_status: unverified
translation_source: start/installation.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# 安装
{: .no_toc }

1. TOC
{:toc}

---

> 在**推送之前**需要运行的是
> [`platform-gates`]({{ '/reference/skill-instructions/platform-gates.html' | relative_url }})；
> `bun test` 通过并不代表关卡通过，因为关卡列表是从 CI 工作流中派生出来的。如果你是在已有仓库之上搭建
> folio-assistant，请先阅读
> [`repo-conversion`]({{ '/reference/skill-instructions/repo-conversion.html' | relative_url }})。

## 前置要求

folio-assistant 运行在 [Bun](https://bun.sh) 之上，并通过 MCP 连接到 LLM 智能体。平台本身仅需要 Bun；具体的内容类型会引入更重的工具链（LaTeX、Lean、FHIR IG Publisher），这些工具链会在运行时进行检查，并可按需安装。

| 依赖项 | 用途 | 安装（Linux/macOS） | 安装（Windows） |
|-------------|-----------|---------|---------|
| **Bun ≥ 1.0** | 框架（始终必需） | `curl -fsSL https://bun.sh/install \| bash` | `winget install Oven-sh.Bun` |
| Git + git-lfs | 内容仓库 | `apt install git git-lfs` | `winget install Git.Git GitHub.GitLFS` |
| LaTeX (`latexmk`, `texlive`) | 渲染论文 | `apt install texlive-full latexmk biber` | `winget install MiKTeX.MiKTeX` |
| Lean 4 (via `elan`) | 形式化论文 | `curl …/elan-init.sh \| sh -s -- -y` | 参见 [elan 发布页面](https://github.com/leanprover/elan/releases) |
| Java 21 + IG Publisher + SUSHI | WHO SMART IG（L3） | 参见 [WHO SMART IG 指南](https://litlfred.github.io/folio-assistant/smart-base/guides/who-smart-ig.html) | `winget install EclipseAdoptium.Temurin.21.JDK`，然后参见指南 |
| `pandoc`, `ripgrep` | 转换、搜索 | `apt install pandoc ripgrep` | `winget install JohnMacFarlane.Pandoc BurntSushi.ripgrep.MSVC` |

你不需要安装上述所有工具——只需安装你所创作的内容类型所需要的工具。内置的能力探测工具会告知你缺少什么。

> **只有 Bun 是必需的。** 其他各行都属于特定内容类型并在运行时进行探测，因此在 `check-deps` 提示之前无需安装任何其他工具。


## 克隆与安装

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
```

### 在 Windows 上，有一个脚本

在一台仅装有 git 客户端的干净机器上，该脚本会安装 Bun（在可用时通过 winget）、刷新 `PATH`、运行 `bun install`，然后移交给能力探测工具：

```powershell
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
.\cat-harness-tools\scripts\bootstrap.ps1 -CheckOnly   # 仅报告，不安装任何内容
.\cat-harness-tools\scripts\bootstrap.ps1              # 执行安装
```

它仅安装 Bun，而不安装其他任何内容——LaTeX、Lean、Java 和 IG Publisher 仍然按内容类型区分，由 `check-deps` 报告并附带安装提示。

该平台的 shell 脚本均为 bash。在 Windows 上，它们在 **Git Bash** 下运行，[Git for Windows](https://git-scm.com/download/win) 会安装 Git Bash，因此 `git` 是唯一的额外前置要求。用户手动运行或接入配置的每个脚本旁边都有一个对应的 `.bat` 文件——例如 `cat-harness-tools\scripts\install-beans.bat`、`cat-harness-tools\scripts\start-folio-assistant.bat`、`cat-harness-tools\scripts\git-hooks\install.bat`、`cat-harness-tools\scripts\session-start-coord-sweep.bat` 等——它会寻找 Git Bash（绝不会使用 `System32` 中的 WSL 启动器）并以相同的参数运行同级 `.sh` 脚本。你可以从 `cmd.exe`、PowerShell、任务计划程序（Task Scheduler）或 MCP 配置条目中使用它们：

```bat
cat-harness-tools\scripts\install-beans.bat
cat-harness-tools\scripts\upload-to-uploads.bat https://example.org/guideline.pdf
```

`.sh` 所需的任何工具——`bun`、`curl`、`gh`、`elan`——都必须位于 Windows 的 `PATH` 中，因为 Git Bash 会从调用方继承环境变量。特意未为仅在 Linux 主机上有意义的脚本（`deploy/`、`install-tex.sh`、`setup-sage.sh`、`setup-singular.sh`）提供包装器。脚本列表维护在 `cat-harness-tools/scripts/gen-bat-wrappers.sh` 中；`bun run cat bat:sync` 会重新生成这些包装器，如果缺少或过期，`bun run cat bat:sync:check` 会导致 CI 失败。

### 在 Linux/macOS 上，也有一个脚本

`cat-harness-tools/scripts/start-folio-assistant.sh` 会在 Bun 缺失时自动安装，然后启动服务器；`cat-harness-tools/adapters/mcp-server/install.sh` 是一个更完整的安装程序，同时也涵盖了 TeX Live。

## 检查你的环境

`--check-deps` 探测会报告当前具备哪些能力，并为缺失的任何组件提供安装提示：

```sh
bun run cat-harness-tools/src/index.ts --check-deps
# 或通过 npm 脚本
bun run cat check-deps
```

## 运行服务器

folio-assistant 是一个 MCP 服务器。它支持两种传输协议：

```sh
# stdio 传输 —— LLM harness（Claude Code 等）所启动的协议
bun run cat-harness-tools/src/index.ts --stdio

# HTTP 传输 —— 适用于长期运行的共享实例 / Web UI
bun run cat-harness-tools/src/index.ts --http

# 将其指向你正在创作的内容仓库（默认为 ../.. ）
bun run cat-harness-tools/src/index.ts --stdio --repo /path/to/your/content-repo
```

`package.json` 中提供了便捷脚本：

```sh
bun run cat start          # 默认（stdio）
bun run cat start:http     # HTTP 传输
bun run test           # 单元测试（bun test）
bun run cat test:e2e       # Playwright 端到端测试
bun run cat lint           # eslint
```

## 为你的 folio 进行配置

将示例配置复制到你的**内容**仓库中（而不是复制到 folio-assistant 中），并根据你的内容类型进行调整：

```sh
# 目标文件名以你的实例命名 —— 例如 `my-folio.config.json`，而不是一个固定单词。
# 示例文件保留其自身名称：这就是它的称谓。
cp cat-harness/docs/reference/harness.config.example.json /path/to/your/content-repo/<your-name>.config.json
```

```json
{
  "contentType": "document",
  "adapter": "document",
  "adapterModule": "./folio-assistant/adapters/document/index.ts",
  "feedbackDir": ".folio-feedback",
  "skills": ".claude/skills/local"
}
```

`contentType` 同时选择了适配器和块类型*配置文件*（profile）。对于包含由 Lean 提供支持的数学内容的 folio，请使用 `"paper"`（以及 `adapters/paper/index.ts`）——paper 适配器扩展了 document 适配器，因此它也提供所有 document 工具。`folio_init` 会替你编写该文件；参见[启动一个新 folio](https://github.com/litlfred/folio-assistant#start-a-new-folio)。

---

## 连接 LLM harness
{: #connecting-an-llm-harness }

folio-assistant 通过 MCP 暴露其工具，因此任何支持 MCP 的智能体 harness 都可以驱动它。以下是常见 harness 的配置。在所有情况下，智能体都通过 **stdio** 启动服务器。

### Claude Code

将 folio-assistant 添加为 MCP 服务器。项目级配置位于内容仓库根目录下的 `.mcp.json` 中：

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/cat-harness-tools/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

或者从 CLI 注册：

```sh
claude mcp add folio-assistant -- bun run /path/to/folio-assistant/cat-harness-tools/src/index.ts --stdio --repo .
```

Claude Code 也会原生读取 `AGENTS.md` / `CLAUDE.md` 并响应 `.claude/settings.json` 中的 `SessionStart` 钩子 —— 这样当会话启动时，工作计划启动引导（work-plan primer）就会自动运行。

### Antigravity

Antigravity 原生读取 `AGENTS.md`，并支持 MCP 服务器和 `SessionStart` 生命周期钩子。将服务器添加到其 MCP 配置中（与 Gemini CLI 共享的 JSON 格式）：

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/cat-harness-tools/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

将会话启动引导挂接到 Antigravity 的 `SessionStart` 钩子，以便每个会话在启动时都载入工作计划 —— 将钩子命令指向共享脚本 `cat-harness-tools/scripts/session-start-coord-sweep.sh`（所有 harness 都使用同一个脚本；仅每个工具的钩子配置格式有所不同）。

### Gemini CLI

Gemini CLI 原生读取 `AGENTS.md` / `GEMINI.md`。在其设置中注册该 MCP 服务器并复用相同的 `SessionStart` 脚本：

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/cat-harness-tools/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

### 任何其他 MCP 客户端

将你的客户端指向上述 stdio 命令，或者运行 HTTP 传输（`bun run cat start:http`）并通过 HTTP 连接。MCP 服务器暴露了一个 `work_plan_prime` 工具，任何已连接 MCP 的智能体都可以调用它以获取相同的实时工作计划引导，无论使用何种 harness。

> **为什么这能在不同 harness 之间通用。** 规程存在于 `AGENTS.md` 中（这是一个由 Linux 基金会制定的智能体标准，可被 Claude Code、Gemini CLI、Antigravity、Cursor、Copilot 等原生读取）；实时状态既通过单个共享脚本作为针对不同 harness 的 `SessionStart` 钩子暴露，也作为 `work_plan_prime` MCP 工具暴露。参见[架构](../../concepts/zh/architecture.html)页面。
