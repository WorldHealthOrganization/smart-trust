---
layout: default
title: Habilidades y roles
lang: es
nav_exclude: true
translation_status: unverified
translation_source: concepts/skills.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Habilidades y roles
{: .no_toc }

Esta página es la lista maestra de cada **habilidad** (*skill*) y **rol** (*role*) en folio-assistant,
y explica cómo encajan entre sí con el LLM. Para conocer el contrato de entrada/salida
tipado de cada habilidad, consulta la [Referencia de esquemas de habilidades]({{ '/reference/skills/' | relative_url }}).

1. TOC
{:toc}

---

## Cómo funciona junto con el LLM

folio-assistant proporciona a un agente LLM una forma estructurada de realizar trabajo de autoría real.
Se compone de cinco conceptos:

```mermaid
flowchart TD
    LLM[Agente LLM] -->|skill_list / skill_fetch| Skill["Habilidad<br/>unidad de trabajo delimitada por esquema"]
    Skill --> Pkg["Paquete de habilidades<br/>agrupa habilidades + dependencias Docker"]
    Skill --> Schema["JSON Schema<br/>entrada/salida tipada"]
    LLM --> Role["Rol / actor<br/>a quién representa el agente"]
    Role -->|RBAC| Cap["Capacidades<br/>lo que el entorno puede hacer"]
    Role --> Stage["Etapa del ciclo de vida<br/>plan→autor→…→retirar"]
    Cap --> Req["Requisitos<br/>condiciones que deben cumplirse"]
```

1. **Habilidad (*skill*)** — una unidad de trabajo documentada y delimitada por un esquema (por ejemplo,
   `lean-formalization`). El agente descubre habilidades con la herramienta MCP
   `skill_list` y carga las instrucciones de una habilidad con `skill_fetch`. Cada habilidad cuenta con un
   [contrato de entrada/salida]({{ '/reference/skills/' | relative_url }}) tipado.
2. **Paquete de habilidades (*skill package*)** — un grupo de habilidades relacionadas que también declara sus
   dependencias de Docker/tiempo de ejecución (`package-manifest.json`).
3. **Rol (actor)** — *a quién* representa el agente. Un **actor** asume un
   **rol** debido al carril BPMN en el que actúa. Lo que el actor puede **hacer** es una
   política ODRL de W3C en `policies/`, no una propiedad del rol. Antes de cada tarea,
   el ejecutor comprueba la autenticación, la asignación de roles, la política y el acceso
   al contenido ([`task-authorization`]({{ '/reference/skill-instructions/task-authorization.html' | relative_url }}));
   las rutas HTTP consultan las mismas políticas a través de `src/core/rbac.ts`.
4. **Capacidad (*capability*)** — una habilidad concreta del entorno (por ejemplo, `latex-compiler`,
   `lean-toolchain`). Las habilidades requieren capacidades; `check_dependencies` las
   sondea.
5. **Requisito (*requirement*)** — una condición (*gate*) que debe cumplirse (por ejemplo, `commit-hygiene`,
   `lean-verification`) antes o durante el avance de una etapa.

El bucle, en la práctica: el agente prepara el plan de trabajo (`work_plan_prime`),
comprueba que cuenta con las capacidades que necesita (`check_dependencies`), lista y carga
la habilidad adecuada (`skill_list` → `skill_fetch`), realiza el trabajo bajo el rol del usuario
(sujeto a RBAC) y valida/compila/publica a través de las herramientas del adaptador de contenido.

---

## Habilidades

### Dónde residen las habilidades (y su estado)

Una habilidad se define a lo largo de varias capas — no en un único archivo. Para cualquier habilidad:

| Capa | Ubicación |
|------|-----------|
| **Definición** (roles, capacidades requeridas, requisitos, patrones de enrutamiento, etapas del ciclo de vida, referencia de esquema) | `skills/skill-definitions/<skill>.json` |
| **Contrato tipado** (JSON Schema de entrada/salida) | `schemas/skills/<skill>/` — consulta la [referencia]({{ site.baseurl }}/reference/skills/) |
| **Cuerpo de instrucciones** (guía práctica en prosa que carga el LLM, servida por `skill_fetch`) — consúltalas en la referencia de [Instrucciones de habilidades]({{ site.baseurl }}/reference/skill-instructions/) | `skills/<tema>/<paquete>/*.md`, `sdlc/skills/<paquete>/*.md`, `work-plan/skills/work-plan/*.md` |
| **Paquete** (dependencias Docker/tiempo de ejecución) | `package-manifest.json` junto a los cuerpos de instrucciones del paquete |

### Transversal: `content-lifecycle`

Las etapas del ciclo de vida que se aplican a **cada** tipo de contenido:

| Habilidad | Etapa | Propósito |
|-----------|-------|-----------|
| [`content-validate`]({{ site.baseurl }}/reference/skills/content-validate.html) | validate | Comprobar esquema + restricciones |
| [`content-review`]({{ site.baseurl }}/reference/skills/content-review.html) | review | Revisión y aprobación formal |
| [`content-test`]({{ site.baseurl }}/reference/skills/content-test.html) | test | QA de extremo a extremo / compilación en verde |
| [`content-feedback`]({{ site.baseurl }}/reference/skills/content-feedback.html) | feedback | Recopilar y clasificar retroalimentación |

La planificación, la autoría, la publicación y la retirada son operativas, así que las aporta la capa de contenido situada por encima de esta.

### Documentos y guías normativas: `folio-document-adapter`

| Habilidad | Propósito |
|-----------|-----------|
| [`document-authoring`]({{ site.baseurl }}/reference/skill-instructions/document-authoring.html) | Crear y revisar bloques en un folio en prosa |
| [`document-structure`]({{ site.baseurl }}/reference/skill-instructions/document-structure.html) | Capítulos y secciones — añadir, eliminar, reordenar |
| [`normative-statements`]({{ site.baseurl }}/reference/skill-instructions/normative-statements.html) | Portar una recomendación, requisito o regla |
| [`document-publishing`]({{ site.baseurl }}/reference/skill-instructions/document-publishing.html) | Markdown → HTML / PDF, sin TeX |

### Artículos y libros: `authoring-math`

| Habilidad | Propósito |
|-----------|-----------|
| [`lean-formalization`]({{ site.baseurl }}/reference/skill-instructions/lean-formalization.html) | Formalizar enunciados/demostraciones en Lean 4 |
| [`latex-authoring`]({{ site.baseurl }}/reference/skill-instructions/latex-authoring.html) | Redactar documentos LaTeX |
| [`proof-verification`]({{ site.baseurl }}/reference/skill-instructions/proof-verification.html) | Verificar demostraciones, auditar `sorry`/axiomas |
| `scientific-visualization` | Figuras y diagramas |
| `hypothesis-generation` | Proponer conjeturas / líneas de investigación |
| `scientific-critical-thinking` | Revisión crítica adversarial de argumentos |

### Directrices SMART de la OMS: `authoring-who-smart-guidelines`

| Habilidad | Propósito |
|-----------|-----------|
| [`l2-dak-authoring`]({{ site.baseurl }}/reference/skill-instructions/l2-dak-authoring.html) | Artefactos DAK L2 (diccionario de datos, etc.) |
| [`l3-fhir-authoring`]({{ site.baseurl }}/reference/skill-instructions/l3-fhir-authoring.html) | Recursos FHIR L3 mediante FSH |
| [`bpmn-authoring`]({{ site.baseurl }}/reference/skills/bpmn-authoring.html) | Procesos de negocio BPMN 2.0 |
| [`dmn-authoring`]({{ site.baseurl }}/reference/skills/dmn-authoring.html) | Tablas de decisiones DMN |
| [`terminology-management`]({{ site.baseurl }}/reference/skill-instructions/terminology-management.html) | Sistemas de códigos / conjuntos de valores |
| [`fhir-validation`]({{ site.baseurl }}/reference/skill-instructions/fhir-validation.html) | Validar contra perfiles FHIR |
| [`ig-publication`]({{ site.baseurl }}/reference/skill-instructions/ig-publication.html) | Compilar y publicar la IG |
| [`quality-control`]({{ site.baseurl }}/reference/skill-instructions/quality-control.html) | Compuertas de control de calidad (*QA gates*) |

### Habilidades de agente/plataforma

Habilidades que el LLM utiliza para trabajar de manera efectiva en el repositorio (cargadas mediante `skill_fetch`):

| Habilidad | Paquete | Propósito |
|-----------|---------|-----------|
| `corpus-grep` | `kg-core` | Buscar en todo el corpus de contenido |
| `editor`, `readability-editing`, `todo-review` | `authoring-core` | Edición y revisión de prosa |
| `symbiotic-interaction` | `conduct-core` | Leer el registro de la aportación del autor |
| `deployment-auth` | `folio-core` | Autenticación de despliegue |

Un folio de artículo (*paper folio*) también requiere las habilidades de `folio-document-adapter`: un artículo *es* un
documento con bloques que contienen Lean, por lo que `document-structure` y
`document-publishing` se aplican a ambos. Los dos paquetes son mitades de un único modelo
de contenido, no alternativas entre las que elegir.

### Habilidades de coordinación (`sdlc-core`, `work-plan`)

| Habilidad | Propósito |
|-----------|-----------|
| `prepare-merge` | Llevar una rama a un estado limpio/en verde/fusionable (consulta también `watch`) |
| `bean-coordination` | Disciplina de reclamación/coordinación multiagente |
| `todo-manager` | Disciplina de work items como tareas pendientes (*beans-as-todos*) |

### Paquetes de habilidades de plataforma (`skills/tools/folio-core`, `folio-assistant-core/skills/content/folio-document-adapter`, `folio-assistant-sci/skills/content/folio-paper-adapter`)

**Paquetes de plataforma** más amplios, independientes del contenido y diseñados
para sincronizarse en cualquier folio:

| Paquete | Habilidades | Alcance |
|---------|------------:|---------|
| **`folio-core`** | 7 | La superficie de herramientas: ensamblaje, contrato y proyección MCP, habilidades y herramientas, autoría de herramientas, cobertura de herramientas, autenticación de despliegue — se aplica a *cualquier* tipo de contenido. |
| **`folio-document-adapter`** | 4 | Folios en prosa: autoría de bloques, estructura de capítulos/secciones, declaraciones normativas y la vía de publicación sin TeX. Se aplica también a artículos. |
| **`folio-paper-adapter`** | 40 | Adaptador para artículos de matemáticas formales (cualquier artículo con Lean 4 + LaTeX): flujo de trabajo de Lean, herramientas de demostración, validación de objetos de contenido, LaTeX, estructura de artículos, importación, simuladores. |

Cada paquete incluye un `package-manifest.json`.

> Los **esquemas** de habilidades (entrada/salida tipada para las habilidades de autoría) se generan
> en la [Referencia de esquemas de habilidades]({{ '/reference/skills/' | relative_url }}) — nunca se desvíen de lo que
> valida el marco de trabajo.

---

## Roles (actores)

Los roles responden a *a quién representa el agente*. El usuario actual se asigna a un rol
mediante `role-assignments.json`, y las capacidades del rol delimitan lo que el agente puede
hacer (RBAC). Los roles **heredan** (por ejemplo, `author` hereda de `reviewer`).

> Para ver estos roles *como carriles* — quién edita, quién revisa, quién da el visto bueno y
> qué pasos puede dar un agente por su cuenta —, consulta
> [Flujo de publicación → Quién es quién](../../process/es/publication-workflow.html#who-is-who).

```mermaid
flowchart LR
    viewer --> reviewer --> author --> admin
```

### Personas

| Rol | Qué pueden hacer |
|-----|------------------|
| `viewer` | Lectura básica únicamente. Ver contenido, sin cambios. |
| `reviewer` | Ver + comentarios de revisión; sin cambios directos. |
| `author` | Crear/modificar contenido (hereda de reviewer). |
| `admin` | Acceso administrativo completo — roles, configuración, todo el contenido. |
| `programme-manager` | Alcance, conformación de equipos, cronograma, gobernanza de partes interesadas. |
| `technical-officer` | Coordinador de área de programa + revisor de primera pasada. |
| `business-analyst` | Autor de DAK L2 (BPMN, diccionarios de datos, lógica de decisiones, indicadores). |
| `clinical-sme` | Validador clínico / proveedor de información de referencia (*ground-truth*). |
| `terminologist` | Gobernanza terminológica (CIE-11, SNOMED CT, LOINC). |
| `fhir-modeller` | Artefactos FHIR L3 (FSH, SUSHI, CQL, IG Publisher). |
| `content-reviewer` | Aprobación formal / visto bueno para la transición de fase. |
| `qc-reviewer` | Control de calidad (QA) de preparación para la publicación en todas las capas. |
| `publication-manager` | Lanzamientos, configuración de IG, compilaciones, versionado, publicación. |
| `translator` | Localización para idiomas oficiales admitidos por la ONU. |

### Actores del sistema

| Actor | Proporciona | No puede |
|-------|-------------|----------|
| `authoring-agent` | Redacta y revisa un cambio **propuesto** a un bloque de contenido | Confirmar (*commit*) — su salida se envía al editor a través de la compuerta de validación |
| `review-agent` | Validación no mecánica: precisión, tono/voz, exposición | Aprobar — únicamente informa hallazgos |
| `lean-mcp` | Comprobación de demostraciones y diagnósticos de Lean 4 mediante MCP | — |
| `ig-publisher-service` | Compilación de FHIR IG Publisher e informes de QA | — |

El lugar que ocupa cada uno de estos en el proceso — y lo que un agente puede y no puede
decidir — está modelado en los diagramas BPMN del
[flujo de publicación](../../process/es/publication-workflow.html).

### Asignación de roles

`role-assignments.json` asigna una identidad de usuario (proveniente de la configuración de Git o de la autenticación) a un rol
según su prioridad. Los valores predeterminados suministrados:

| Patrón | Origen | Rol | Prioridad |
|--------|--------|-----|-----------|
| `litlfred@gmail.com` | git-config | `admin` | 100 |
| `*@who.int` | git-config | `author` | 50 |
| `*` | default | `viewer` | 0 |

---

## Capacidades y requisitos

Las **capacidades** (*capabilities*) son habilidades concretas del entorno que una habilidad puede requerir; la
herramienta MCP `check_dependencies` las sondea:

`bun-runtime` · `node-runtime` · `python3` · `git-push` · `docker` ·
`latex-compiler` · `lean-toolchain` · `lean-mcp` · `ig-publisher` ·
`sushi-compiler` · `java-runtime` · `jekyll` · `plantuml` · `graphviz`

Los **requisitos** (*requirements*) son condiciones (*gates*) que deben cumplirse durante el trabajo:

`commit-hygiene` · `lean-verification` · `fhir-validation` ·
`content-lifecycle` · `session-start`

---

## Véase también

- [Flujo de publicación](../../process/es/publication-workflow.html) — carriles BPMN (*swimlanes*): qué habilidad se ejecuta en cada paso y quién decide
- [Instrucciones de habilidades]({{ '/reference/skill-instructions/' | relative_url }}) — los cuerpos prácticos en prosa que carga el LLM
- [Referencia de esquemas de habilidades]({{ '/reference/skills/' | relative_url }}) — entrada/salida tipada para cada habilidad
- [Tipos de contenido](content-types.html) — qué habilidades utiliza cada tipo de contenido
- [Arquitectura](architecture.html) — RBAC, adaptadores y el servidor MCP
- [Primeros pasos](../../start/es/getting-started.html) — ejecutar tu primera habilidad
