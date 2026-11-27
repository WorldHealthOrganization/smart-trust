---
layout: default
title: Навыки и роли
lang: ru
nav_exclude: true
translation_status: unverified
translation_source: concepts/skills.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Навыки и роли
{: .no_toc }

Эта страница представляет собой полный перечень всех **навыков** и **ролей** в folio-assistant
и объясняет, как они взаимодействуют с LLM. С типизированным контрактом ввода/вывода
для каждого навыка можно ознакомиться в [Справочнике схем навыков]({{ '/reference/skills/' | relative_url }}).

1. TOC
{:toc}

---

## Как это работает вместе с LLM

folio-assistant предоставляет LLM-агенту структурированный способ выполнения реальной работы по созданию контента.
Взаимодействие строится на пяти концепциях:

```mermaid
flowchart TD
    LLM["LLM-агент"] -->|skill_list / skill_fetch| Skill["Навык (Skill)<br/>ограниченная схемой единица работы"]
    Skill --> Pkg["Пакет навыков (Skill package)<br/>группирует навыки + зависимости Docker"]
    Skill --> Schema["JSON Schema<br/>типизированный ввод/вывод"]
    LLM --> Role["Роль / действующее лицо (Role / actor)<br/>в качестве кого выступает агент"]
    Role -->|RBAC| Cap["Возможности (Capabilities)<br/>что может делать окружение"]
    Role --> Stage["Этап жизненного цикла<br/>plan→author→…→retire"]
    Cap --> Req["Требования (Requirements)<br/>критерии, которые должны выполняться"]
```

1. **Навык (Skill)** — документированная, ограниченная схемой единица работы (например,
   `lean-formalization`). Агент обнаруживает навыки с помощью MCP-инструмента
   `skill_list` и загружает инструкции навыка через `skill_fetch`. Каждый навык имеет
   типизированный [контракт ввода/вывода]({{ '/reference/skills/' | relative_url }}).
2. **Пакет навыков (Skill package)** — группа связанных навыков, которая также объявляет свои
   зависимости от среды выполнения и Docker (`package-manifest.json`).
3. **Роль (действующее лицо / actor)** — *в качестве кого* выступает агент. **Действующее лицо (actor)** принимает
   **роль (role)** в соответствии с дорожкой BPMN, в которой оно действует. То, что действующему лицу
   разрешено **делать**, определяется политикой W3C ODRL в `policies/`, а не свойством роли. Перед каждой
   задачей исполнитель проверяет аутентификацию, назначение роли, политику и доступ к контенту
   ([`task-authorization`]({{ '/reference/skill-instructions/task-authorization.html' | relative_url }}));
   HTTP-маршруты запрашивают те же политики через `src/core/rbac.ts`.
4. **Возможность (Capability)** — конкретная способность окружения (например, `latex-compiler`,
   `lean-toolchain`). Навыки требуют наличия возможностей; инструмент `check_dependencies` проверяет
   их доступность.
5. **Требование (Requirement)** — контрольный рубеж (gate), который должен соблюдаться (например, `commit-hygiene`,
   `lean-verification`) до начала или во время выполнения этапа.

Рабочий цикл на практике: агент инициализирует план работы (`work_plan_prime`),
проверяет наличие необходимых возможностей (`check_dependencies`), находит и загружает
подходящий навык (`skill_list` → `skill_fetch`), выполняет работу в рамках роли пользователя
(с учетом RBAC) и выполняет валидацию, сборку и публикацию с помощью инструментов адаптера контента.

---

## Навыки

### Где располагаются навыки (и их статус)

Навык определяется на нескольких уровнях — это не один отдельный файл. Для любого навыка:

| Уровень | Расположение |
|---------|--------------|
| **Определение** (роли, требуемые возможности, требования, шаблоны маршрутизации, этапы жизненного цикла, ссылка на схему) | `skills/skill-definitions/<skill>.json` |
| **Типизированный контракт** (JSON Schema ввода/вывода) | `schemas/skills/<skill>/` — см. [справочник]({{ site.baseurl }}/reference/skills/) |
| **Тело инструкций** (текстовое руководство, загружаемое LLM через `skill_fetch`) — ознакомьтесь с ними в справочнике [Инструкции к навыкам]({{ site.baseurl }}/reference/skill-instructions/) | `skills/<topic>/<package>/*.md`, `sdlc/skills/<package>/*.md`, `work-plan/skills/work-plan/*.md` |
| **Пакет** (зависимости среды выполнения/Docker) | `package-manifest.json` рядом с телами инструкций пакета |

### Сквозной пакет: `content-lifecycle`

Этапы жизненного цикла, применимые к **каждому** типу контента:

| Навык | Этап | Назначение |
|-------|------|------------|
| [`content-validate`]({{ site.baseurl }}/reference/skills/content-validate.html) | validate | Проверка схемы и ограничений |
| [`content-review`]({{ site.baseurl }}/reference/skills/content-review.html) | review | Официальное рецензирование и утверждение |
| [`content-test`]({{ site.baseurl }}/reference/skills/content-test.html) | test | Сквозной контроль качества (E2E QA) / успешная сборка («зеленый» билд) |
| [`content-feedback`]({{ site.baseurl }}/reference/skills/content-feedback.html) | feedback | Сбор и триаж обратной связи |

Планирование, авторская работа, публикация и вывод из эксплуатации — операционные этапы, поэтому их предоставляет слой контента над этим.

### Документы и нормативные руководства: `folio-document-adapter`

| Навык | Назначение |
|-------|------------|
| [`document-authoring`]({{ site.baseurl }}/reference/skill-instructions/document-authoring.html) | Создание и редактирование блоков в текстовом фолио (prose folio) |
| [`document-structure`]({{ site.baseurl }}/reference/skill-instructions/document-structure.html) | Главы и разделы — добавление, удаление, изменение порядка |
| [`normative-statements`]({{ site.baseurl }}/reference/skill-instructions/normative-statements.html) | Формулирование рекомендаций, требований или правил |
| [`document-publishing`]({{ site.baseurl }}/reference/skill-instructions/document-publishing.html) | Markdown → HTML / PDF, без TeX |

### Статьи и книги: `authoring-math`

| Навык | Назначение |
|-------|------------|
| [`lean-formalization`]({{ site.baseurl }}/reference/skill-instructions/lean-formalization.html) | Формализация утверждений и доказательств в Lean 4 |
| [`latex-authoring`]({{ site.baseurl }}/reference/skill-instructions/latex-authoring.html) | Создание документов LaTeX |
| [`proof-verification`]({{ site.baseurl }}/reference/skill-instructions/proof-verification.html) | Верификация доказательств, аудит `sorry` и аксиом |
| `scientific-visualization` | Рисунки и диаграммы |
| `hypothesis-generation` | Формулирование гипотез и направлений исследований |
| `scientific-critical-thinking` | Критическое (состязательное) рецензирование аргументов |

### Руководства ВОЗ SMART Guidelines: `authoring-who-smart-guidelines`

| Навык | Назначение |
|-------|------------|
| [`l2-dak-authoring`]({{ site.baseurl }}/reference/skill-instructions/l2-dak-authoring.html) | Артефакты L2 DAK (словарь данных и др.) |
| [`l3-fhir-authoring`]({{ site.baseurl }}/reference/skill-instructions/l3-fhir-authoring.html) | Ресурсы L3 FHIR через FSH |
| [`bpmn-authoring`]({{ site.baseurl }}/reference/skills/bpmn-authoring.html) | Бизнес-процессы BPMN 2.0 |
| [`dmn-authoring`]({{ site.baseurl }}/reference/skills/dmn-authoring.html) | Таблицы решений DMN |
| [`terminology-management`]({{ site.baseurl }}/reference/skill-instructions/terminology-management.html) | Системы кодирования / наборы значений |
| [`fhir-validation`]({{ site.baseurl }}/reference/skill-instructions/fhir-validation.html) | Валидация на соответствие профилям FHIR |
| [`ig-publication`]({{ site.baseurl }}/reference/skill-instructions/ig-publication.html) | Сборка и публикация IG |
| [`quality-control`]({{ site.baseurl }}/reference/skill-instructions/quality-control.html) | Рубежи контроля качества (QA gates) |

### Навыки агента и платформы

Навыки, которые LLM использует для эффективной работы в репозитории (загружаются через `skill_fetch`):

| Навык | Пакет | Назначение |
|-------|-------|------------|
| `corpus-grep` | `kg-core` | Поиск по корпусу контента |
| `editor`, `readability-editing`, `todo-review` | `authoring-core` | Редактирование и рецензирование текста |
| `symbiotic-interaction` | `conduct-core` | Распознавание регистра ввода автора |
| `deployment-auth` | `folio-core` | Аутентификация развертывания |

Фолио научной статьи также нуждается в навыках `folio-document-adapter`: статья *является*
документом плюс блоки с кодом на Lean, поэтому `document-structure` и
`document-publishing` применимы к обоим. Эти два пакета представляют собой две половины
единой модели контента, а не взаимоисключающие альтернативы.

### Навыки координации (`sdlc-core`, `work-plan`)

| Навык | Назначение |
|-------|------------|
| `prepare-merge` | Приведение ветки к чистому/«зеленому»/готовому к слиянию состоянию (см. также `watch`) |
| `bean-coordination` | Дисциплина распределения задач и координации между несколькими агентами |
| `todo-manager` | Дисциплина управления задачами beans-as-todos |

### Платформенные наборы навыков (`skills/tools/folio-core`, `folio-assistant-core/skills/content/folio-document-adapter`, `folio-assistant-sci/skills/content/folio-paper-adapter`)

Более крупные **платформенные наборы**; они не зависят от типа контента и
предназначены для синхронизации в любое фолио:

| Набор | Навыки | Область применения |
|-------|-------:|-------------------|
| **`folio-core`** | 7 | Поверхность инструментов: сборка, контракт и проекция MCP, навыки и инструменты, создание инструментов, покрытие инструментов, аутентификация развертывания — применимо к *любому* типу контента. |
| **`folio-document-adapter`** | 4 | Текстовые фолио: создание блоков, структура глав/разделов, нормативные утверждения и путь публикации без использования TeX. Применимо также к научным статьям. |
| **`folio-paper-adapter`** | 40 | Адаптер статей по формальной математике (любые статьи на Lean 4 + LaTeX): рабочий процесс Lean, инструментарий доказательств, валидация объектов контента, LaTeX, структура статьи, импорт, симуляторы. |

Каждый набор поставляется с файлом `package-manifest.json`.

> **Схемы** навыков генерируются в
> [Справочнике схем навыков]({{ '/reference/skills/' | relative_url }}), поэтому
> они никогда не расходятся с тем, что проверяет фреймворк.

---

## Роли (действующие лица / actors)

Роли определяют, *в качестве кого выступает агент*. Текущий пользователь сопоставляется с ролью
с помощью `role-assignments.json`, а возможности роли ограничивают действия, которые агент
может выполнять (RBAC). Роли **наследуются** (например, `author` наследует `reviewer`).

> Чтобы увидеть эти роли *в виде дорожек процесса* — кто редактирует, кто рецензирует, кто утверждает
> и какие шаги агент может предпринимать самостоятельно, — прочтите раздел
> [Процесс публикации → Кто есть кто](../../process/ru/publication-workflow.html#who-is-who).

```mermaid
flowchart LR
    viewer --> reviewer --> author --> admin
```

### Люди

| Роль | Что они могут делать |
|------|----------------------|
| `viewer` | Базовый доступ только для чтения. Просмотр контента, без внесения изменений. |
| `reviewer` | Просмотр + комментарии рецензента; без прямых изменений. |
| `author` | Создание/модификация контента (наследует права `reviewer`). |
| `admin` | Полный административный доступ — роли, настройки, весь контент. |
| `programme-manager` | Определение границ проекта, формирование команды, график, взаимодействие с заинтересованными сторонами. |
| `technical-officer` | Координатор направления программы + первичный рецензент. |
| `business-analyst` | Автор L2 DAK (BPMN, словари данных, логика решений, индикаторы). |
| `clinical-sme` | Клинический валидатор / источник эталонных медицинских данных (ground-truth). |
| `terminologist` | Управление терминологией (МКБ-11 / ICD-11, SNOMED CT, LOINC). |
| `fhir-modeller` | Артефакты L3 FHIR (FSH, SUSHI, CQL, IG Publisher). |
| `content-reviewer` | Официальное утверждение / согласование перехода между фазами. |
| `qc-reviewer` | Контроль качества (QA) готовности к публикации на всех уровнях. |
| `publication-manager` | Релизы, конфигурация IG, сборка, версионирование, публикация. |
| `translator` | Локализация на языки, поддерживаемые ООН. |

### Системные действующие лица

| Действующее лицо | Что обеспечивает | Что не может делать |
|------------------|------------------|---------------------|
| `authoring-agent` | Составляет черновики и дорабатывает **предлагаемое** изменение в блоке контента | Фиксировать коммит — результаты его работы передаются редактору через контрольный рубеж валидации |
| `review-agent` | Немеханическая валидация: точность, тональность, стиль изложения | Утверждать — только сообщает об обнаруженных замечаниях |
| `lean-mcp` | Проверка доказательств Lean 4 и диагностика через MCP | — |
| `ig-publisher-service` | Сборка FHIR IG Publisher и отчетность по контролю качества (QA) | — |

Место каждого из них в процессе — а также то, какие решения агент имеет и не имеет права
принимать, — смоделировано на BPMN-диаграммах
[процесса публикации](../../process/ru/publication-workflow.html).

### Назначение ролей

`role-assignments.json` сопоставляет идентификатор пользователя (из git config / auth) с ролью
на основе приоритета. Поставляемые значения по умолчанию:

| Шаблон | Источник | Роль | Приоритет |
|--------|----------|------|-----------|
| `litlfred@gmail.com` | git-config | `admin` | 100 |
| `*@who.int` | git-config | `author` | 50 |
| `*` | default | `viewer` | 0 |

---

## Возможности и требования

**Возможности (Capabilities)** — это конкретные способности окружения, которые могут требоваться навыку;
MCP-инструмент `check_dependencies` проверяет их наличие:

`bun-runtime` · `node-runtime` · `python3` · `git-push` · `docker` ·
`latex-compiler` · `lean-toolchain` · `lean-mcp` · `ig-publisher` ·
`sushi-compiler` · `java-runtime` · `jekyll` · `plantuml` · `graphviz`

**Требования (Requirements)** — это контрольные рубежи, которые должны соблюдаться во время работы:

`commit-hygiene` · `lean-verification` · `fhir-validation` ·
`content-lifecycle` · `session-start`

---

## См. также

- [Процесс публикации](../../process/ru/publication-workflow.html) — дорожки BPMN: какой навык выполняется на каждом шаге и кто принимает решения
- [Инструкции к навыкам]({{ '/reference/skill-instructions/' | relative_url }}) — текстовые руководства, загружаемые LLM
- [Справочник схем навыков]({{ '/reference/skills/' | relative_url }}) — типизированный ввод/вывод для каждого навыка
- [Типы контента](content-types.html) — какие навыки использует каждый тип контента
- [Архитектура](architecture.html) — RBAC, адаптеры и MCP-сервер
- [Начало работы](../../start/ru/getting-started.html) — запуск вашего первого навыка
