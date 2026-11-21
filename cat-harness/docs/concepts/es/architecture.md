---
layout: default
title: Arquitectura
lang: es
nav_exclude: true
translation_status: unverified
translation_source: concepts/architecture.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Arquitectura
{: .no_toc }

1. TOC
{:toc}

---

## Visión general

> **Las reglas detrás de esta página.** La arquitectura describe la forma; las habilidades
> rigen las decisiones. Adaptadores frente a perfiles —
> [`content-profiles`]({{ '/reference/skill-instructions/content-profiles.html' | relative_url }}).
> A dónde pertenece un nuevo nodo antes de crearlo —
> [`placement`]({{ '/reference/skill-instructions/placement.html' | relative_url }}). La estructura del
> repositorio y cada tipo de grafo —
> [`directory-conventions`]({{ '/reference/skill-instructions/directory-conventions.html' | relative_url }}).
> Composición y verificación de la superficie MCP —
> [`mcp-assembly`]({{ '/reference/skill-instructions/mcp-assembly.html' | relative_url }}) y
> [`mcp-contract`]({{ '/reference/skill-instructions/mcp-contract.html' | relative_url }}).
> Donde esta página y una habilidad discrepen, la habilidad prevalece.

folio-assistant es un **servidor MCP** con una capa conectable de **adaptadores de contenido**,
un sistema de **habilidades**, un **modelo de objetos de contenido** tipado, **RBAC** y una
estrategia de despliegue. El contenido sobre el que opera reside en un repositorio *independiente*:
la plataforma es independiente del contenido.

```mermaid
flowchart TD
    subgraph Harness[Arnés de LLM · Claude Code / Antigravity / Gemini]
      LLM[Agente]
    end
    LLM <-->|MCP stdio/http| Server[FolioServer · src/server.ts]
    Server --> Tools[Herramientas principales<br/>check-deps · skill-fetch · preview · preferences · work_plan_prime]
    Server --> Adapter{Adaptador de contenido}
    Adapter --> Paper[adaptador paper<br/>lean · validate · render]
    Adapter --> Future[otros adaptadores …]
    Server --> RBAC[Acceso · src/core/rbac.ts + access.ts → directivas ODRL policies/]
    Server --> Git[Auxiliar de Git · src/core/git.ts]
    Server --> Feedback[Almacén de retroalimentación · src/core/feedback.ts]
    Tools --> Skills[Paquetes de habilidades<br/>schemas/skills/*]
    Paper --> Model[Modelo de objetos de contenido<br/>schemas/types.ts · constraints.ts · builders.ts]
```

## Separación de responsabilidades — estado actual y futuro

La división de la plataforma en instancias componibles se describe en las
páginas secundarias:

| página | qué responde |
|---|---|
| [Taxonomía de repositorios](../architecture/repo-taxonomy.html) | Qué tipos de repositorios existen — Herramienta, Prueba, Contenido, Consumidor — y qué puede contener cada uno |
| [Estado actual](../architecture/current-state.html) | Qué hay realmente en este repositorio hoy, cuantificado, y dónde se encuentra la mezcla |
| [Estado futuro](../architecture/future-state.html) | Los cinco repositorios de destino y qué directorio va a parar a cuál |
| [Plan de migración](../architecture/migration-plan.html) | Fases 0/I/II/III, las puertas de validación y lo que aún no se ha decidido |
| [`cat-harness` mínimo](../architecture/cat-harness-minimum.html) | Qué sobrevive en el arnés una vez que se aplica «no autodocumentado» como prueba |
| [Instancias de arnés](../architecture/harness-instances.html) | Qué ES una instancia — esquemas, visualizaciones, herramientas; los cuatro directorios; el renderizado por defecto |

La versión mínima dice que un arnés no produce nada que un humano mire, y la
página de instancias dice que una instancia renderiza por defecto; ambas se
cumplen porque el requisito de renderizado es un **suelo que se eleva**: `bootstrap` está exento
del visualizador y proporciona en su lugar su propio `.json`/`.jsonld`, y
`cat-harness` es la capa donde se aplica el resto. Consulta
[Dónde comienza el requisito](../architecture/harness-instances.html#where-the-requirement-starts--bootstrap-is-the-exception).

El resto de esta página describe la arquitectura **tal como es ahora**.

## Estructura del repositorio

La lista autorizada es `cat-harness.json`: cada directorio que declara esta
capa, con el tipo de grafo que contiene. Los que un lector busca primero:

| Ruta | Qué reside aquí |
|------|-----------------|
| `skills/` | El grafo de conocimiento: paquetes de habilidades (`skills/<área>/<paquete>/`, cada uno con un `package-manifest.json`), roles, permisos y requisitos |
| `processes/` | Procesos BPMN ejecutables y las tablas DMN que calculan sus compuertas |
| `schemas/` | Esquemas JSON por habilidad (`schemas/skills/`) y los documentos de esquema que declara el arnés |
| `tools/` | Definiciones de herramientas, un `tools/<id>/<id>.json` por herramienta |
| `policies/` | Lo que un actor puede hacer, como políticas W3C ODRL 2.2 |
| `sdlc/`, `work-plan/` | Los subgrafos de entrega de software y de plan de trabajo |
| `library/`, `uploads/` | Contenido fuente L1 ingerido y la cola desde la que se ingiere |
| `docs/` | Este sitio de documentación |
| `.github/` | Flujos de trabajo de CI |

El código del servidor, los adaptadores y los scripts que nombra esta página
(`src/`, `adapters/`, `scripts/`, `deploy/`) no están en esta capa; se
distribuyen con la capa de herramientas.

## El servidor MCP

`FolioServer` (`src/server.ts`) registra las herramientas principales y luego solicita al
**adaptador de contenido** activo que registre sus herramientas. Admite dos transportes: `--stdio`
(el que inician los arneses) y `--http` (una instancia compartida de ejecución continua). Las llamadas a
herramientas se registran con su tiempo de ejecución.

## Adaptadores de contenido

Un adaptador de contenido encapsula todo lo específico de un tipo: qué artefactos existen,
cómo validarlos, cómo compilarlos/renderizarlos y qué herramientas MCP adicionales
registrar. El adaptador `document` (`adapters/document/`) es la base para folios en prosa;
el adaptador `paper` (`adapters/paper/`) lo extiende y proporciona herramientas del ciclo de vida de Lean
(`lean_setup`/`build`/`check`/`status`), validación y renderizado
(`paper_render_pdf`/`html`, `formula_render`). Los nuevos tipos de contenido añaden un nuevo
adaptador; consulta [Añadir un tipo de contenido](../../guides/new-content-type.html).

## Habilidades y paquetes de habilidades

Una **habilidad** es una unidad de trabajo documentada y delimitada por esquemas (por ejemplo,
`lean-formalization`). Las habilidades se agrupan en **paquetes** que declaran sus
dependencias de Docker/tiempo de ejecución mediante un archivo `package-manifest.json`. El LLM descubre
habilidades con `skill_list` y carga instrucciones con `skill_fetch`. La lista
completa de habilidades y roles —y cómo se combinan con el LLM (RBAC, capacidades,
requisitos)— se encuentra en la página [Habilidades y roles](skills.html); el contrato de
entrada/salida de cada habilidad está publicado en la
[Referencia de esquemas de habilidades]({{ '/reference/skills/' | relative_url }}).

## El modelo de objetos de contenido

Para los artículos, el contenido es un árbol de **bloques** tipados y validados en tiempo de ejecución con Zod:

- `schemas/types.ts` — `Block`, `Section`, `Chapter`, `Paper` y los tipos de bloques
- `schemas/constraints.ts` — esquemas de Zod y reglas de restricciones
- `schemas/builders.ts` — constructores validados (`definition()`, `theorem()`, …)

Estos están documentados en la [Referencia de la API de TypeScript]({{ '/es/api/' | relative_url }}) generada.

## Control de acceso — ODRL, comprobado antes de cada tarea

Existe un único sistema de permisos, y es W3C ODRL 2.2: acciones
en `skills/permissions/permissions.json`, concesiones en `policies/*.jsonld`,
evaluadas por `permits()` / `decide()` en `schemas/odrl.ts`. Dos invocadores lo consultan:

- **El ejecutor de BPMN**, antes de cada tarea y decisión
  (`src/workflow/authorize.ts`): ¿está el actor autenticado, cumple los requisitos para
  el rol del carril, tiene permiso para `perform-task` aquí y se le permite manipular el
  contenido? Actualmente consultivo: un `deny` o una discrepancia de rol genera un rechazo, y
  se registra `unknown`.
- **Las rutas HTTP**, a través de `src/core/rbac.ts`: cada ruta especifica la acción
  que realiza (`content-authoring`, `review-comments`, `adjudication`), y las
  sesiones de la pasarela de autenticación (auth-gateway) se declaran como actores cuyas concesiones son
  `policies/http-gateway.jsonld`. En este caso, `unknown` genera un rechazo.

La disciplina correspondiente es la
habilidad [`task-authorization`]({{ '/reference/skill-instructions/task-authorization.html' | relative_url }}).

## Preparación del plan de trabajo (entre arneses)

El plan de trabajo se almacena en `beans` y se expone de tres formas para que cualquier arnés se
inicialice de manera idéntica:

1. **`AGENTS.md`** — disciplina estática, leída de forma nativa por cada agente.
2. **Hook `SessionStart`** — cada arnés ejecuta el preparador compartido
   `scripts/session-start-coord-sweep.sh`.
3. **Herramienta MCP `work_plan_prime`** — preparación en tiempo real para cualquier agente conectado por MCP.

Consulta `docs/folio-assistant-migration.md` para el diseño completo entre agentes.

## Despliegue

`deploy/` (capa de herramientas) contiene una plantilla de proxy inverso de Caddy, `docker-compose.yml`, un
script de aprovisionamiento, configuración de Google OAuth y un script de actualización automática para ejecutar una
instancia HTTP compartida. Los manifiestos de Docker de los paquetes de habilidades agregan las dependencias de apt/pip/npm
en una sola imagen por cada conjunto de paquetes activo.
