---
layout: default
title: Contribuir
lang: es
nav_exclude: true
translation_status: unverified
translation_source: start/contributing.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Contribuir
{: .no_toc }

1. TOC
{:toc}

---

## Configuración de desarrollo

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
bun test          # pruebas unitarias
bun run cat lint      # eslint
bun run cat test:e2e      # e2e (test:e2e)
```

## Plan de trabajo con `beans`

Este proyecto utiliza [`beans`](https://github.com/hmans/beans) como el mecanismo único
de tareas pendientes/plan de trabajo (el skill `todo-manager`). **No** configures un almacén
de tareas separado.

```sh
cat-harness-tools/scripts/install-beans.sh && export PATH="$HOME/.local/bin:$PATH"
beans list
beans create "<título>"
bun run cat beans:claim <id>      # reclama antes de trabajar
```

`beans ≠ sidecars`: nunca uses `beans create` para colas masivas generadas por máquinas (QA,
witness, watcher); esas se mantienen como JSON masivo.

## Guía para agentes

`AGENTS.md` es el punto de entrada genérico para agentes (leído de forma nativa por Claude Code,
Gemini CLI, Antigravity, Cursor, Copilot); `CLAUDE.md` / `GEMINI.md` son stubs mínimos
que apuntan a él. Las reglas viven en los skills: para cambiar cómo se comportan los agentes,
edita el skill, no `AGENTS.md`.

## Documentación

- La documentación en prosa se encuentra en `docs/` (este sitio Jekyll).
- La **referencia de esquemas de habilidades** es generada — nunca edites a mano
  `docs/reference/skills/*.md`. Edita los esquemas JSON en
  `schemas/skills/<skill>/` y vuelve a generar:

  ```sh
  bun run cat-harness-tools/scripts/gen-schema-docs.ts
  ```

- Las **instrucciones de habilidades** (`docs/reference/skill-instructions/*.md`) también son
  generadas — nunca las edites a mano. Edita el cuerpo de las habilidades en
  `skills/`, `sdlc/skills/` o `work-plan/skills/` y vuelve a generar:

  ```sh
  bun run cat-harness-tools/scripts/gen-skill-docs.ts
  ```

- La **referencia de la API de TypeScript** (`/api/`) es generada por TypeDoc en CI.
- El sitio se compila y despliega en GitHub Pages mediante
  `.github/workflows/docs-site.yml` en cada push a `main` que modifique la documentación,
  los esquemas o el código fuente.

Previsualizar localmente:

```sh
cd docs
bundle install
bundle exec jekyll serve
```

## Publicar un cambio

Abre el PR en el primer commit y haz push de incrementos pequeños
(`skills/conduct/conduct-core/continual-progress.md`); lleva la rama a un estado limpio, en verde
y publicado con `sdlc/skills/sdlc-core/prepare-merge.md`. Mantén el **formalismo del marco de trabajo
separado del contenido** — el contenido pertenece a su propio repositorio, y cualquier contenido
en esta documentación es solo ilustrativo.
