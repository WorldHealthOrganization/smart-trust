---
layout: default
title: Установка
lang: ru
nav_exclude: true
translation_status: unverified
translation_source: start/installation.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Установка
{: .no_toc }

1. TOC
{:toc}

---

> То, что нужно запустить **перед push**, — это
> [`platform-gates`]({{ '/reference/skill-instructions/platform-gates.html' | relative_url }});
> успешное прохождение `bun test` не означает прохождение гейтов платформы, поскольку их список выводится из
> рабочего процесса CI. Если вы разворачиваете folio-assistant
> поверх уже существующего репозитория, сначала прочитайте
> [`repo-conversion`]({{ '/reference/skill-instructions/repo-conversion.html' | relative_url }}).

## Предварительные требования

folio-assistant работает на [Bun](https://bun.sh) и подключается к LLM-агенту через
MCP. Самой платформе требуется только Bun; отдельные типы контента подтягивают
более тяжелые наборы инструментов (LaTeX, Lean, FHIR IG Publisher), которые проверяются
во время выполнения и могут быть установлены по требованию.

| Требование | Для чего требуется | Установка (Linux/macOS) | Установка (Windows) |
|-------------|-----------|---------|---------|
| **Bun ≥ 1.0** | фреймворк (всегда) | `curl -fsSL https://bun.sh/install \| bash` | `winget install Oven-sh.Bun` |
| Git + git-lfs | репозитории контента | `apt install git git-lfs` | `winget install Git.Git GitHub.GitLFS` |
| LaTeX (`latexmk`, `texlive`) | рендеринг статей | `apt install texlive-full latexmk biber` | `winget install MiKTeX.MiKTeX` |
| Lean 4 (через `elan`) | формализация статей | `curl …/elan-init.sh \| sh -s -- -y` | см. [релизы elan](https://github.com/leanprover/elan/releases) |
| Java 21 + IG Publisher + SUSHI | WHO SMART IG (L3) | см. [руководство по WHO SMART IG](https://litlfred.github.io/folio-assistant/smart-base/guides/who-smart-ig.html) | `winget install EclipseAdoptium.Temurin.21.JDK`, затем руководство |
| `pandoc`, `ripgrep` | преобразования, поиск | `apt install pandoc ripgrep` | `winget install JohnMacFarlane.Pandoc BurntSushi.ripgrep.MSVC` |

Обязателен только Bun. Каждая остальная строка относится к конкретному типу контента и проверяется
во время выполнения, поэтому ничего другого устанавливать не нужно, пока об этом не попросит `check-deps`.


## Клонирование и установка

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
```

### Для Windows есть скрипт

На чистой машине, где установлен только git-клиент, этот скрипт устанавливает Bun (через winget, если
доступен), обновляет `PATH`, выполняет `bun install` и затем передает управление
проверке возможностей:

```powershell
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
.\cat-harness-tools\scripts\bootstrap.ps1 -CheckOnly   # только отчет, ничего не устанавливает
.\cat-harness-tools\scripts\bootstrap.ps1              # выполнить установку
```

Он устанавливает Bun и ничего больше — LaTeX, Lean, Java и IG Publisher остаются
привязкой к конкретным типам контента и сообщаются `check-deps` с подсказками по установке.

Шелл-скрипты платформы написаны для bash. В Windows они выполняются в **Git Bash**,
который устанавливается вместе с [Git for Windows](https://git-scm.com/download/win), поэтому `git` —
единственное дополнительное предварительное требование. Рядом с каждым скриптом, который пользователь
запускает вручную или прописывает в конфигурации, находится файл `.bat` —
`cat-harness-tools\scripts\install-beans.bat`, `cat-harness-tools\scripts\start-folio-assistant.bat`,
`cat-harness-tools\scripts\git-hooks\install.bat`, `cat-harness-tools\scripts\session-start-coord-sweep.bat`
и так далее. Этот файл находит Git Bash (ни в коем случае не лаунчер WSL в `System32`) и
запускает соседний `.sh` с теми же аргументами. Используйте их из `cmd.exe`, PowerShell,
Task Scheduler или параметров конфигурации MCP:

```bat
cat-harness-tools\scripts\install-beans.bat
cat-harness-tools\scripts\upload-to-uploads.bat https://example.org/guideline.pdf
```

Все, что требуется скриптам `.sh` — `bun`, `curl`, `gh`, `elan` — должно быть доступно
в Windows `PATH`, поскольку Git Bash наследует его от вызывающего процесса. Скрипты, которые
имеют смысл только на хосте Linux (`deploy/`, `install-tex.sh`, `setup-sage.sh`,
`setup-singular.sh`), намеренно не имеют bat-оберток. Их список находится в
`cat-harness-tools/scripts/gen-bat-wrappers.sh`; команда `bun run cat bat:sync` заново генерирует обертки,
а `bun run cat bat:sync:check` завершает CI с ошибкой, если какая-либо из них отсутствует или устарела.

### Для Linux/macOS также есть скрипт

`cat-harness-tools/scripts/start-folio-assistant.sh` устанавливает Bun, если он отсутствует, а
затем запускает сервер, а
`cat-harness-tools/adapters/mcp-server/install.sh` представляет собой более полный установщик, охватывающий
также и TeX Live.

## Проверка окружения

Проверка `--check-deps` сообщает, какие возможности присутствуют в системе, и дает
подсказку по установке для всего, что отсутствует:

```sh
bun run cat-harness-tools/src/index.ts --check-deps
# или через npm-скрипт
bun run cat check-deps
```

## Запуск сервера

folio-assistant — это MCP-сервер. Он поддерживает два вида транспорта:

```sh
# транспорт stdio — то, что запускают LLM-харнессы (Claude Code и др.)
bun run cat-harness-tools/src/index.ts --stdio

# транспорт HTTP — для долгоживущего общего инстанса / веб-интерфейса
bun run cat-harness-tools/src/index.ts --http

# указать репозиторий контента, над которым вы работаете (по умолчанию ../.. )
bun run cat-harness-tools/src/index.ts --stdio --repo /path/to/your/content-repo
```

В `package.json` есть удобные скрипты:

```sh
bun run cat start          # по умолчанию (stdio)
bun run cat start:http     # транспорт HTTP
bun run test           # модульные тесты (bun test)
bun run cat test:e2e       # сквозные (e2e) тесты Playwright
bun run cat lint           # eslint
```

## Настройка под ваше фолио

Скопируйте пример конфигурации в свой репозиторий **контента** (не в
folio-assistant) и настройте его под ваш тип контента:

```sh
# ЦЕЛЕВОЙ ФАЙЛ именуется по названию вашего инстанса -- `my-folio.config.json`, а не
# фиксированным словом. Пример файла сохраняет собственное имя: именно так он называется.
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

Параметр `contentType` выбирает как адаптер, так и *профиль* типов блоков. Используйте
`"paper"` (и `adapters/paper/index.ts`) для фолио с математическими утверждениями,
подкрепленными Lean, — адаптер paper расширяет адаптер document, поэтому он также предоставляет
все инструменты для документов. Инструмент `folio_init` создает этот файл за вас; см.
[Создание нового фолио](https://github.com/litlfred/folio-assistant#start-a-new-folio).

---

## Подключение LLM-харнесса

folio-assistant предоставляет свои инструменты через MCP, поэтому им может управлять
любой харнесс агентов с поддержкой MCP. Ниже приведены конфигурации для распространенных харнессов.
Во всех случаях агент запускает сервер через **stdio**.

### Claude Code

Добавьте folio-assistant в качестве MCP-сервера. Конфигурация уровня проекта хранится в `.mcp.json`
в корне вашего репозитория контента:

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

Либо зарегистрируйте его через CLI:

```sh
claude mcp add folio-assistant -- bun run /path/to/folio-assistant/cat-harness-tools/src/index.ts --stdio --repo .
```

Claude Code также нативно считывает `AGENTS.md` / `CLAUDE.md` и учитывает
хук `SessionStart` в `.claude/settings.json` — таким образом, прайминг плана работы
запускается автоматически при старте сессии.

### Antigravity

Antigravity нативно считывает `AGENTS.md`, поддерживает MCP-серверы и хук
жизненного цикла `SessionStart`. Добавьте сервер в его конфигурацию MCP (формат JSON,
общий с Gemini CLI):

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

Подключите прайминг при старте сессии к хуку `SessionStart` в Antigravity, чтобы каждая
сессия получала прайминг плана работы: укажите в команде хука общий скрипт
`cat-harness-tools/scripts/session-start-coord-sweep.sh` (тот же самый скрипт, который используют
все харнессы; у каждого инструмента отличается только формат конфигурации хука).

### Gemini CLI

Gemini CLI нативно считывает `AGENTS.md` / `GEMINI.md`. Зарегистрируйте MCP-сервер в
его настройках и используйте тот же скрипт `SessionStart`:

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

### Любой другой MCP-клиент

Направьте ваш клиент на указанную выше команду stdio или запустите транспорт HTTP
(`bun run cat start:http`) и подключитесь по протоколу HTTP. MCP-сервер предоставляет
инструмент `work_plan_prime`, который может вызвать любой подключенный по MCP агент для
получения идентичного актуального прайминга плана работы независимо от используемого харнесса.

> **Почему это работает во всех харнессах.** Регламент зафиксирован в `AGENTS.md`
> (стандарт для агентов от Linux Foundation, нативно считываемый Claude Code, Gemini CLI,
> Antigravity, Cursor, Copilot и другими); актуальное состояние предоставляется как через
> отдельный для каждого харнесса хук `SessionStart` поверх единого общего скрипта, так и через
> MCP-инструмент `work_plan_prime`. См. страницу [архитектуры](../../concepts/ru/architecture.html).
