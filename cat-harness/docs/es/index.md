---
layout: default
title: Asistente de folio
lang: es
nav_exclude: true
translation_status: unverified
translation_source: index.md
description: "folio-assistant — un marco de habilidades de agente independiente del contenido."
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

{% include landing.html %}

# folio-assistant
{: .fs-9 }


Un marco de habilidades de agente independiente del contenido para la autoría de
contenido riguroso con un modelo de lenguaje grande — artículos científicos y
libros, Directrices SMART de la OMS y Guías de Implementación FHIR —
respaldado por un servidor MCP, control de acceso basado en roles y un modelo
de objetos de contenido tipado.
{: .fs-6 .fw-300 }

<!--
  `View on GitHub` STAYS: it is authored content on this page, not site chrome,
  so removing the site-wide GitHub link does not remove it.
-->
[Comenzar]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Instalar]({{ '/docs/cat-harness/start/installation.html' | relative_url }}){: .btn .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Ver en GitHub](https://github.com/litlfred/folio-assistant){: .btn .fs-5 .mb-4 .mb-md-0 }

{% include harness_details.html %}

---

## Cuatro cosas, en orden

**1. El plan de trabajo es donde dices lo que estás haciendo.**
No un mensaje de chat, no un comentario: [elementos de trabajo]({{ '/docs/cat-harness/guides/beans-and-todos.html' | relative_url }}), un almacén confirmado en el repositorio que cualquier sesión o agente puede leer. Reclama antes de trabajar para que una sesión hermana no tome el mismo elemento; un elemento de trabajo que resulta no ser necesario se marca `scrapped`, con sus razones, y nunca se elimina.

```sh
cat-harness-tools/scripts/install-beans.sh && export PATH="$HOME/.local/bin:$PATH"
beans list                          # lo que está abierto
beans create "<title>"              # …tras comprobar que el título no existe
bun run cat beans:claim <id>        # reclamarlo, de forma visible
```

**2. Crea tu primer folio.** Este repositorio es la *plataforma*; tu contenido vive en el suyo propio. Un solo comando lo prepara — los manifiestos, la declaración, los archivos del agente y el enlace de vuelta aquí:

```sh
bun run cat init-folio --help
```

Después, [Primeros pasos]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }}) acompaña el primer bloque por la validación, el renderizado y la revisión.

**3. Conoce qué tipo de cosa estás escribiendo.** Un *documento* es prosa estructurada; un *artículo* (paper) es eso más los tipos de bloque cuya aserción es una afirmación formal, respaldada por Lean y compuesta con LaTeX. La elección decide qué bloques son válidos y qué controles se ejecutan: [Tipos de contenido]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }}).

**4. El resto de la documentación.**
[Toda ella]({{ '/docs/cat-harness/guides/index.html' | relative_url }}) — las guías de autoría, la arquitectura, el flujo de publicación, la referencia generada de esquemas y habilidades. Léela cuando la necesites; los tres pasos de arriba son los que vale la pena leer ahora.

Cuando lo que te desconcierta es la *maquinaria* y no la autoría — quién hace qué cosa, en qué proceso, con qué habilidad — empieza por [La plataforma]({{ '/docs/cat-harness/platform.html' | relative_url }}).

---

## ¿Qué es folio-assistant?

**folio-assistant** es la *plataforma* — no contiene contenido. Proporciona
las habilidades, los esquemas, las herramientas y un servidor MCP (Model Context
Protocol) que un agente impulsado por LLM utiliza para planificar, redactar, validar,
revisar, probar y publicar un **folio** de contenido que reside en un repositorio independiente.

> **Separación de responsabilidades.** Esta documentación describe el marco y cómo
> usarlo. Cuando aparece contenido en estas páginas, es un *ejemplo*, nunca el
> artefacto canónico.

```mermaid
flowchart LR
    A[Autor + LLM] -->|chat / herramientas MCP| B(folio-assistant)
    B --> C{Adaptador de contenido}
    C -->|artículo| D[Repositorio Lean + LaTeX]
    C -->|WHO SMART DAK| E[L2 BPMN / DMN / Excel]
    C -->|WHO SMART IG| F[L3 FHIR / FSH]
    B --> G[Habilidades + Esquemas + RBAC]
    D & E & F --> H[Sitio publicado / PDF / IG]
```

## Tipos de contenido admitidos

folio-assistant es **extensible** — cada tipo de contenido es gestionado por un
*adaptador* de contenido y un *paquete* de habilidades correspondiente. Los tipos admitidos actualmente:

| Tipo de contenido | Artefactos | Paquete de habilidades |
|-------------------|------------|------------------------|
| **Artículos científicos y libros** | Formalización Lean 4 + LaTeX/Markdown | [`authoring-math`]({{ site.baseurl }}/docs/cat-harness/concepts/content-types.html#scientific-papers--books) |
| **Kits de adaptación digital (DAK) de las Directrices SMART de la OMS** | Artefactos L2 — BPMN, DMN, diccionarios de datos Excel, personas | [`authoring-who-smart-guidelines`](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#who-smart-guidelines-daks-l2) |
| **Guías de implementación SMART de la OMS** | Recursos FHIR L3, FSH, salida de IG Publisher | [`authoring-who-smart-guidelines`](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#who-smart-implementation-guides-l3) |
| **Otros** | Extensible — añade un nuevo adaptador + paquete de habilidades | [Añadir un tipo de contenido]({{ site.baseurl }}/docs/cat-harness/guides/new-content-type.html) |

El paquete transversal [`content-lifecycle`]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }}#the-content-lifecycle)
(planificar → redactar → validar → revisar → probar → publicar → retroalimentación → retirar)
se aplica a cada tipo de contenido. El
[flujo de publicación](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html) lo modela adecuadamente — como
carriles BPMN, con los roles, la puerta de validación HCI y el plan de trabajo compartido.

## A dónde ir a continuación

- **[Instalación]({{ '/docs/cat-harness/start/installation.html' | relative_url }})** — requisitos previos, clonación, `bun install`, verificación de capacidades.
- **[Primeros pasos]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }})** — conecta el servidor MCP a tu LLM y ejecuta tu primera habilidad.
- **[Tutorial: Redactar un artículo con folio-assistant](https://litlfred.github.io/folio-assistant/folio-assistant-sci/guides/writing-a-paper.html)** — un recorrido completo guiado por LLM con una sesión de chat simulada.
- **[Tipos de contenido]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }})** — el formalismo de cada dominio de autoría.
- **[Flujo de publicación](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html)** — diagramas de carriles BPMN de los procesos de edición y publicación: la puerta de validación de HCI, quién revisa qué y el plan de trabajo compartido.
- **[Procesos]({{ '/processes/' | relative_url }})** — todos los diagramas BPMN ejecutables, con búsqueda, cada uno con las instancias de flujo de trabajo que lo ejecutan: abre uno para ver dónde está su token, qué está atascado y los elementos de trabajo y las tareas pendientes (todos) que nombra.
- **[Incorporación del agente]({{ '/docs/cat-harness/guides/agent-onboarding.html' | relative_url }})** — orientación para un agente LLM situado en un folio: primeros pasos, búsqueda de habilidades, el modelo de objetos de contenido, sidecars de QA.
- **[Habilidades y roles]({{ '/docs/cat-harness/concepts/skills.html' | relative_url }})** — cada habilidad y rol, y cómo interactúan junto con el LLM.
- **[Referencia del esquema de habilidades](../reference/skills/)** — contratos de entrada/salida generados para cada habilidad.
- **[Referencia de la API de TypeScript](../api/)** — el modelo de objetos de contenido (`Block`, `Chapter`, `Paper`, builders, restricciones Zod).
- **[Arquitectura]({{ '/docs/cat-harness/concepts/architecture.html' | relative_url }})** — adaptadores, servidor MCP, RBAC, el modelo de bloques.
- **[El Grafo de conocimiento]({{ '/docs/cat-harness/concepts/knowledge-graph.html' | relative_url }})** — la taxonomía de subgrafos, en qué sentido van las referencias y cómo dividen el trabajo los repositorios.
- **[El Arnés]({{ '/docs/cat-harness/concepts/harness.html' | relative_url }})** — la instanciación, el recorrido de dependencias y a qué obliga incorporar un directorio al arnés.

Vale la pena leer dos Habilidades antes que las páginas anteriores, porque todo lo demás
las asume: [`getting-started`](../reference/skill-instructions/getting-started.html)
enruta lo que realmente estás intentando hacer, y
[`placement`](../reference/skill-instructions/placement.html) determina a dónde
pertenece un nuevo nodo antes de crearlo.

## Mapa de la documentación

```mermaid
flowchart TD
    Home[Inicio] --> Install[Instalación]
    Home --> GS[Primeros pasos]
    Install --> GS
    GS --> Tut[Tutorial: redactar un artículo]
    GS --> CT[Tipos de contenido]
    CT --> Skills[Habilidades y roles]
    CT --> WF["Flujo de publicación<br/>carriles BPMN"]
    CT --> Guides[Guías de autoría]
    Guides --> Paper[Artículos: Lean + LaTeX]
    Guides --> DAK[WHO SMART DAK / L2]
    Guides --> IG[WHO SMART IG / L3 FHIR]
    Guides --> New[Añadir un tipo de contenido]
    Skills --> Ref[Referencia de esquemas de habilidades]
    CT --> Ref
    Ref --> API[Referencia de la API de TypeScript]
    Home --> Arch[Arquitectura]

    click Skills "skills.html" "Habilidades y roles"
    click WF "publication-workflow.html" "Flujo de publicación (BPMN)"
    click Install "installation.html" "Instalación"
    click GS "getting-started.html" "Primeros pasos"
    click Tut "guides/writing-a-paper.html" "Tutorial: redactar un artículo"
    click CT "content-types.html" "Tipos de contenido"
    click Guides "guides/" "Guías de autoría"
    click Paper "guides/writing-a-paper.html" "Artículos: Lean + LaTeX"
    click DAK "guides/who-smart-dak.html" "WHO SMART DAK (L2)"
    click IG "guides/who-smart-ig.html" "WHO SMART IG (L3 FHIR)"
    click New "guides/new-content-type.html" "Añadir un tipo de contenido"
    click Ref "reference/skills/" "Referencia de esquemas de habilidades"
    click API "api/" "Referencia de la API de TypeScript"
    click Arch "architecture.html" "Arquitectura"
```

> Los nodos del mapa son clicables en el sitio de documentación.
