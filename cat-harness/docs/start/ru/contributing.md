---
layout: default
title: Участие в проекте
lang: ru
nav_exclude: true
translation_status: unverified
translation_source: start/contributing.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Участие в проекте
{: .no_toc }

1. TOC
{:toc}

---

## Настройка среды разработки

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
bun test          # модульные тесты
bun run cat lint      # eslint
bun run cat test:e2e      # e2e (test:e2e)
```

## План работы с `beans`

Этот проект использует [`beans`](https://github.com/hmans/beans) в качестве единого
механизма todo / плана работы (см. `AGENTS.md`). **Не** создавайте отдельное хранилище
задач.

```sh
cat-harness-tools/scripts/install-beans.sh
beans list
beans create "<title>"
bun run cat beans:claim <id>   # зарезервируйте задачу перед началом работы
```

`beans ≠ sidecars`: никогда не выполняйте `beans create` для массовых автоматически
сгенерированных очередей (QA, witness, watcher) — они должны оставаться в виде bulk JSON.

## Руководство для агентов

`AGENTS.md` — это единый источник истины, не привязанный к конкретному агенту (нативно читается Claude Code,
Gemini CLI, Antigravity, Cursor, Copilot). `CLAUDE.md` / `GEMINI.md` — тонкие
заглушки, указывающие на него. При изменении руководства для агентов обновляйте `AGENTS.md`,
а не файлы конкретных инструментов.

## Документация

- Текстовая документация размещена в `docs/` (этот сайт на Jekyll).
- **Справочник схем навыков** генерируется автоматически — никогда не редактируйте
  вручную файлы `docs/reference/skills/*.md`. Редактируйте схемы JSON Schema в
  `schemas/skills/<skill>/` и запускайте повторную генерацию:

  ```sh
  bun run cat-harness-tools/scripts/gen-schema-docs.ts
  ```

- **Инструкции навыков** (`docs/reference/skill-instructions/*.md`) также
  генерируются автоматически — никогда не редактируйте их вручную. Редактируйте тела навыков в
  `skills/`, `sdlc/skills/` и `work-plan/skills/` и запускайте повторную генерацию:

  ```sh
  bun run cat-harness-tools/scripts/gen-skill-docs.ts
  ```

- **Справочник по TypeScript API** (`/api/`) генерируется с помощью TypeDoc в CI.
- Сайт собирается и развертывается на GitHub Pages с помощью
  `.github/workflows/docs-site.yml` при каждом push в ветку `main`, который затрагивает документацию,
  схемы или исходный код.

Локальный предпросмотр:

```sh
cd docs
bundle install
bundle exec jekyll serve
```

## Отправка изменений

Откройте PR с первого коммита; перед слиянием: проверка → подтверждение возможности слияния → push. См.
`sdlc/skills/sdlc-core/prepare-merge.md`. Держите **формализм фреймворка отдельно
от контента** — контент должен находиться в собственном репозитории, а любой контент
в этой документации носит чисто иллюстративный характер.
