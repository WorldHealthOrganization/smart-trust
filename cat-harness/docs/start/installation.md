---
layout: default
title: Installation
nav_order: 2
supported_locales: ["ar", "zh", "en", "fr", "ru", "es"]
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Installation
{: .no_toc }

1. TOC
{:toc}

---

> What to run **before you push** is
> [`platform-gates`]({{ '/reference/skill-instructions/platform-gates.html' | relative_url }});
> `bun test` passing is not the gates passing, because the list is derived from
> the CI workflow. If you are laying folio-assistant over
> a repository that already exists, read
> [`repo-conversion`]({{ '/reference/skill-instructions/repo-conversion.html' | relative_url }}) first.

## Prerequisites

folio-assistant runs on [Bun](https://bun.sh) and connects to an LLM agent over
MCP. The platform itself only needs Bun; individual content types pull in
heavier toolchains (LaTeX, Lean, the FHIR IG Publisher) which are checked at
runtime and can be installed on demand.

| Requirement | Needed for | Install (Linux/macOS) | Install (Windows) |
|-------------|-----------|---------|---------|
| **Bun ≥ 1.0** | the framework (always) | `curl -fsSL https://bun.sh/install \| bash` | `winget install Oven-sh.Bun` |
| Git + git-lfs | content repositories | `apt install git git-lfs` | `winget install Git.Git GitHub.GitLFS` |
| LaTeX (`latexmk`, `texlive`) | rendering papers | `apt install texlive-full latexmk biber` | `winget install MiKTeX.MiKTeX` |
| Lean 4 (via `elan`) | formalizing papers | `curl …/elan-init.sh \| sh -s -- -y` | see [elan releases](https://github.com/leanprover/elan/releases) |
| Java 21 + IG Publisher + SUSHI | WHO SMART IGs (L3) | see [WHO SMART IG guide](https://litlfred.github.io/folio-assistant/smart-base/guides/who-smart-ig.html) | `winget install EclipseAdoptium.Temurin.21.JDK`, then the guide |
| `pandoc`, `ripgrep` | conversions, search | `apt install pandoc ripgrep` | `winget install JohnMacFarlane.Pandoc BurntSushi.ripgrep.MSVC` |

Only Bun is required. Every other row is per content type and is probed at
runtime, so install nothing else until `check-deps` asks for it.

## Clone and install

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
```

### On Windows, there is a script

From a bare machine with only a git client, this installs Bun (via winget where
available), refreshes `PATH`, runs `bun install`, and then hands over to the
capability probe:

```powershell
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
.\cat-harness-tools\scripts\bootstrap.ps1 -CheckOnly   # report only, installs nothing
.\cat-harness-tools\scripts\bootstrap.ps1              # do it
```

It installs Bun and nothing else — LaTeX, Lean, Java and the IG Publisher stay
per content type, reported by `check-deps` with install hints.

The platform's shell scripts are bash. On Windows they run under **Git Bash**,
which [Git for Windows](https://git-scm.com/download/win) installs, so `git`
is the only extra prerequisite. Every script a user runs by hand or wires into
a config has a `.bat` beside it — `cat-harness-tools\scripts\install-beans.bat`,
`cat-harness-tools\scripts\start-folio-assistant.bat`, `cat-harness-tools\scripts\git-hooks\install.bat`,
`cat-harness-tools\scripts\session-start-coord-sweep.bat` and so on — which finds Git Bash
(never the WSL launcher in `System32`) and runs the sibling `.sh` with the same
arguments. Use them from `cmd.exe`, PowerShell, Task Scheduler or an MCP
config entry:

```bat
cat-harness-tools\scripts\install-beans.bat
cat-harness-tools\scripts\upload-to-uploads.bat https://example.org/guideline.pdf
```

Anything the `.sh` needs — `bun`, `curl`, `gh`, `elan` — must be on the
Windows `PATH`, since Git Bash inherits it from the caller. Scripts that only
make sense on a Linux host (`deploy/`, `install-tex.sh`, `setup-sage.sh`,
`setup-singular.sh`) have no wrapper on purpose. The list lives in
`cat-harness-tools/scripts/gen-bat-wrappers.sh`; `bun run cat bat:sync` regenerates the wrappers
and `bun run cat bat:sync:check` fails CI if one is missing or stale.

### On Linux/macOS, there is also a script

`cat-harness-tools/scripts/start-folio-assistant.sh` installs Bun if it is missing and
then starts the server, and
`cat-harness-tools/adapters/mcp-server/install.sh` is a fuller installer covering TeX
Live as well.

## Check your environment

The `--check-deps` probe reports which capabilities are present and gives an
install hint for anything missing:

```sh
bun run cat-harness-tools/src/index.ts --check-deps
# or via the npm script
bun run cat check-deps
```

## Run the server

folio-assistant is an MCP server. It speaks two transports:

```sh
# stdio transport — what LLM harnesses (Claude Code, etc.) launch
bun run cat-harness-tools/src/index.ts --stdio

# HTTP transport — for a long-running shared instance / the web UI
bun run cat-harness-tools/src/index.ts --http

# point it at the content repo you are authoring (defaults to ../.. )
bun run cat-harness-tools/src/index.ts --stdio --repo /path/to/your/content-repo
```

There are convenience scripts in `package.json`:

```sh
bun run cat start          # default (stdio)
bun run cat start:http     # HTTP transport
bun run test           # unit tests (bun test)
bun run cat test:e2e       # Playwright end-to-end tests
bun run cat lint           # eslint
```

## Configure for your folio

Copy the example config into your **content** repository (not into
folio-assistant) and adjust it for your content type:

```sh
# The DESTINATION is named for your instance -- `my-folio.config.json`, not a
# fixed word. The example file keeps its own name: that is what it is called.
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

`contentType` selects both the adapter and the block-kind *profile*. Use
`"paper"` (and `adapters/paper/index.ts`) for a folio with Lean-backed
mathematics — the paper adapter extends the document one, so it offers every
document tool as well. `folio_init` writes this file for you; see
[Start a new folio](https://github.com/litlfred/folio-assistant#start-a-new-folio).

---

## Connecting an LLM harness

folio-assistant exposes its tools over MCP, so any MCP-capable agent harness can
drive it. Below are configurations for the common ones. In every case the agent
launches the server over **stdio**.

### Claude Code

Add folio-assistant as an MCP server. `<tools-layer>` below is the directory of
the layer that implements this harness's tools in your checkout. Project-scoped
config lives in `.mcp.json` at the root of your content repo:

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/<tools-layer>/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

Or register it from the CLI:

```sh
claude mcp add folio-assistant -- bun run /path/to/folio-assistant/<tools-layer>/src/index.ts --stdio --repo .
```

Claude Code also reads `AGENTS.md` / `CLAUDE.md` natively and honours the
`SessionStart` hook in `.claude/settings.json` — so the work-plan primer runs
automatically when a session starts.

### Antigravity

Antigravity reads `AGENTS.md` natively and supports MCP servers and a
`SessionStart` lifecycle hook. Add the server to its MCP config (JSON format
shared with Gemini CLI):

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/<tools-layer>/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

Wire the session-start primer to Antigravity's `SessionStart` hook so each
session is primed with the work-plan — point the hook command at the shared
script `cat-harness-tools/scripts/session-start-coord-sweep.sh` (the same script every harness
uses; only the hook-config format differs per tool).

### Gemini CLI

Gemini CLI reads `AGENTS.md` / `GEMINI.md` natively. Register the MCP server in
its settings and reuse the same `SessionStart` script:

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/<tools-layer>/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

### Any other MCP client

Point your client at the stdio command above, or run the HTTP transport
(`bun run cat start:http`) and connect over HTTP. The MCP server exposes a
`work_plan_prime` tool that any MCP-connected agent can call to get identical
live work-plan priming, regardless of harness.

> **Why this works across harnesses.** The discipline lives in `AGENTS.md` (a
> Linux Foundation agent standard read natively by Claude Code, Gemini CLI,
> Antigravity, Cursor, Copilot, and others); the live state is exposed both as a
> per-harness `SessionStart` hook over one shared script and as the
> `work_plan_prime` MCP tool. See the [architecture](../concepts/architecture.html) page.
