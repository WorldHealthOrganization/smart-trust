---
layout: default
title: Ассистент фолио
lang: ru
nav_exclude: true
translation_status: unverified
translation_source: index.md
description: "folio-assistant — фреймворк навыков агента, не зависящий от типа контента."
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# folio-assistant
{: .fs-9 }


Не зависящий от контента фреймворк навыков агента для создания строгого контента
с помощью большой языковой модели — научных статей и книг, руководств ВОЗ SMART
Guidelines и руководств по реализации FHIR — на базе MCP-сервера, управления
доступом на основе ролей и типизированной объектной модели контента.
{: .fs-6 .fw-300 }

[Начать работу]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Установить]({{ '/docs/cat-harness/start/installation.html' | relative_url }}){: .btn .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Посмотреть на GitHub](https://github.com/litlfred/folio-assistant){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Четыре вещи, по порядку

**1. План работы — это место, где вы говорите, что делаете.**
Не сообщение в чате и не комментарий, а [work items]({{ '/docs/cat-harness/guides/beans-and-todos.html' | relative_url }}) — хранилище под контролем версий, которое может прочитать любая сессия или агент. Займите задачу до начала работы, чтобы соседняя сессия не взяла её же; ненужный work item помечается `scrapped` с указанием причин и никогда не удаляется.

```sh
cat-harness-tools/scripts/install-beans.sh && export PATH="$HOME/.local/bin:$PATH"
beans list                          # что открыто
beans create "<title>"              # …проверив, что такого заголовка ещё нет
bun run cat beans:claim <id>        # занять задачу, у всех на виду
```

**2. Создайте свой первый folio.** Этот репозиторий — *платформа*; ваш контент живёт в собственном репозитории. Одна команда создаёт его каркас — манифесты, декларацию, файлы агента и ссылку обратно сюда:

```sh
bun run cat init-folio --help
```

Затем раздел [Начало работы]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }}) проводит первый блок через проверку, рендеринг и рецензирование.

**3. Знайте, что именно вы пишете.** *Документ* — это структурированная проза; *статья* (paper) — это то же самое плюс типы блоков, утверждение которых является формальным утверждением, подкреплённым Lean и свёрстанным через LaTeX. Выбор определяет, какие блоки допустимы и какие проверки запускаются: [Типы контента]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }}).

**4. Документация, которую вы никогда не прочтёте.**
[Вся она]({{ '/docs/cat-harness/guides/index.html' | relative_url }}) — руководства по написанию, архитектура, процесс публикации, сгенерированный справочник по схемам и навыкам. Она здесь, она подробная, и честно говоря, вы придёте к ней из поисковика ровно в тот момент, когда что-то сломается. Это нормальный способ ею пользоваться. Три шага выше — те, что стоит прочитать сейчас.

Когда вас озадачивает не написание, а *механизм* — кто что делает, в каком процессе, с каким навыком, — начните с раздела [Платформа]({{ '/docs/cat-harness/platform.html' | relative_url }}). Одно предложение там содержит всю модель, и каждое слово в нём — отдельно объявленный объект.

---

## Что такое folio-assistant?

**folio-assistant** — это *платформа*, она не содержит самого контента. Она
предоставляет навыки, схемы, инструменты и сервер MCP (Model Context Protocol),
которые агент на базе LLM использует для планирования, создания, валидации,
рецензирования, тестирования и публикации **фолио** контента, находящегося в
отдельном репозитории.

> **Разделение ответственности.** В этой документации описан *формализм
> фреймворка* и *способы использования folio-assistant* — намеренно **отделенные
> от какого-либо конкретного контента**. Если контент встречается на этих страницах,
> он носит чисто иллюстративный характер (*пример*) и никогда не является каноническим артефактом.

```mermaid
flowchart LR
    A[Автор + LLM] -->|чат / инструменты MCP| B(folio-assistant)
    B --> C{Адаптер контента}
    C -->|статья| D[Репозиторий Lean + LaTeX]
    C -->|WHO SMART DAK| E[L2 BPMN / DMN / Excel]
    C -->|WHO SMART IG| F[L3 FHIR / FSH]
    B --> G[Навыки + Схемы + RBAC]
    D & E & F --> H[Опубликованный сайт / PDF / IG]
```

## Поддерживаемые типы контента

folio-assistant **расширяем** — каждый тип контента обрабатывается адаптером
контента и соответствующим пакетом навыков. В настоящее время поддерживаются
следующие типы:

| Тип контента | Артефакты | Пакет навыков |
|--------------|-----------|---------------|
| **Научные статьи и книги** | Формализация Lean 4 + LaTeX/Markdown | [`authoring-math`]({{ site.baseurl }}/docs/cat-harness/concepts/content-types.html#scientific-papers--books) |
| **Комплекты цифровой адаптации (DAK) руководств ВОЗ SMART Guidelines** | Артефакты L2 — BPMN, DMN, словари данных Excel, персоны | [`authoring-who-smart-guidelines`](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#who-smart-guidelines-daks-l2) |
| **Руководства по реализации ВОЗ SMART Guidelines** | Ресурсы FHIR L3, FSH, выходные данные IG Publisher | [`authoring-who-smart-guidelines`](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#who-smart-implementation-guides-l3) |
| **Другие** | Расширяемость — добавьте новый адаптер + пакет навыков | [Добавление типа контента]({{ site.baseurl }}/docs/cat-harness/guides/new-content-type.html) |

Сквозной пакет [`content-lifecycle`]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }}#the-content-lifecycle)
(планирование → написание → валидация → рецензирование → тестирование → публикация → обратная связь → вывод из эксплуатации)
применим ко всем типам контента.
[Процесс публикации](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html) моделирует его должным образом —
в виде дорожек BPMN (swimlanes), с ролями, этапом валидации HCI и общим
планом работ.

## Куда перейти дальше

- **[Установка]({{ '/docs/cat-harness/start/installation.html' | relative_url }})** — предварительные требования, клонирование, `bun install`, проверка возможностей.
- **[Начало работы]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }})** — подключите MCP-сервер к вашей LLM и запустите свой первый навык.
- **[Руководство: Написание статьи с помощью folio-assistant](https://litlfred.github.io/folio-assistant/folio-assistant-sci/guides/writing-a-paper.html)** — пошаговое руководство под управлением LLM с имитацией сессии чата.
- **[Типы контента]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }})** — формализм каждого предметного домена создания контента.
- **[Процесс публикации](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html)** — диаграммы дорожек BPMN процессов редактирования и публикации: этап валидации HCI, кто что рецензирует и общий план работ.
- **[Онбординг агента]({{ '/docs/cat-harness/guides/agent-onboarding.html' | relative_url }})** — вводный инструктаж для LLM-агента, подключенного к фолио: первые шаги, поиск навыков, объектная модель контента, вспомогательные QA-файлы.
- **[Навыки и роли]({{ '/docs/cat-harness/concepts/skills.html' | relative_url }})** — описание каждого навыка и роли и их совместная работа с LLM.
- **[Справочник схем навыков](../reference/skills/)** — сгенерированные контракты входных и выходных данных для каждого навыка.
- **[Справочник по TypeScript API](../api/)** — объектная модель контента (`Block`, `Chapter`, `Paper`, строители, ограничения Zod).
- **[Архитектура]({{ '/docs/cat-harness/concepts/architecture.html' | relative_url }})** — адаптеры, MCP-сервер, RBAC, блочная модель.
- **[Граф знаний]({{ '/docs/cat-harness/concepts/knowledge-graph.html' | relative_url }})** — таксономия подграфов, направление ссылок и распределение работы между репозиториями.
- **[The Harness]({{ '/docs/cat-harness/concepts/harness.html' | relative_url }})** — инстанцирование, обход зависимостей и обязательства при оснащении каталога.

Два навыка стоит прочитать до страниц выше, поскольку все остальное опирается на них: [`getting-started`](../reference/skill-instructions/getting-started.html) определяет маршрут того, что вы на самом деле пытаетесь сделать, а [`placement`](../reference/skill-instructions/placement.html) определяет, где должен находиться новый узел, прежде чем вы его создадите.

## Карта документации

```mermaid
flowchart TD
    Home[Главная] --> Install[Установка]
    Home --> GS[Начало работы]
    Install --> GS
    GS --> Tut[Руководство: написание статьи]
    GS --> CT[Типы контента]
    CT --> Skills[Навыки и роли]
    CT --> WF["Процесс публикации<br/>(BPMN с дорожками)"]
    CT --> Guides[Руководства по созданию]
    Guides --> Paper["Статьи: Lean + LaTeX"]
    Guides --> DAK[WHO SMART DAK / L2]
    Guides --> IG[WHO SMART IG / L3 FHIR]
    Guides --> New[Добавить тип контента]
    Skills --> Ref[Справочник схем]
    CT --> Ref
    Ref --> API[Справочник TypeScript API]
    Home --> Arch[Архитектура]

    click Skills "skills.html" "Skills & roles"
    click WF "publication-workflow.html" "Publication workflow (BPMN)"
    click Install "installation.html" "Installation"
    click GS "getting-started.html" "Getting started"
    click Tut "guides/writing-a-paper.html" "Tutorial: writing a paper"
    click CT "content-types.html" "Content types"
    click Guides "guides/" "Authoring guides"
    click Paper "guides/writing-a-paper.html" "Papers: Lean + LaTeX"
    click DAK "guides/who-smart-dak.html" "WHO SMART DAK (L2)"
    click IG "guides/who-smart-ig.html" "WHO SMART IG (L3 FHIR)"
    click New "guides/new-content-type.html" "Add a content type"
    click Ref "reference/skills/" "Skill schema reference"
    click API "api/" "TypeScript API reference"
    click Arch "architecture.html" "Architecture"
```

> Узлы карты кликабельны на сайте документации.
