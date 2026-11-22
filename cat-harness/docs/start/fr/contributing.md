---
layout: default
title: Contribuer
lang: fr
nav_exclude: true
translation_status: unverified
translation_source: start/contributing.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Contribuer
{: .no_toc }

1. TOC
{:toc}

---

## Configuration du développement

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
bun test          # tests unitaires
bun run cat lint      # eslint
bun run cat test:e2e      # e2e (test:e2e)
```

## Plan de travail avec `beans`

Ce projet utilise [`beans`](https://github.com/hmans/beans) comme unique
mécanisme de tâches et de plan de travail (le skill `todo-manager`). Ne mettez **pas** en
place de système de tâches séparé.

```sh
cat-harness-tools/scripts/install-beans.sh && export PATH="$HOME/.local/bin:$PATH"
beans list
beans create "<title>"
bun run cat beans:claim <id>      # prendre en charge avant de commencer
```

`beans ≠ sidecars` : ne faites jamais `beans create` pour des files générées automatiquement en masse
(QA, witness, watcher) — celles-ci restent au format JSON brut.

## Directives pour les agents

`AGENTS.md` est le point d'entrée générique pour les agents (lu nativement par Claude Code,
Gemini CLI, Antigravity, Cursor, Copilot) ; `CLAUDE.md` / `GEMINI.md` sont de légers stubs
qui pointent vers lui. Les règles vivent dans les skills : pour changer le comportement des
agents, modifiez le skill, pas `AGENTS.md`.

## Documentation

- La documentation rédigée se trouve sous `docs/` (ce site Jekyll).
- La **référence des schémas de compétences** est générée — ne modifiez jamais
  manuellement `docs/reference/skills/*.md`. Modifiez les schémas JSON sous
  `schemas/skills/<skill>/` et régénérez :

  ```sh
  bun run cat-harness-tools/scripts/gen-schema-docs.ts
  ```

- Les **instructions de compétences** (`docs/reference/skill-instructions/*.md`) sont également
  générées — ne les modifiez jamais manuellement. Modifiez le corps des compétences sous
  `skills/`, `sdlc/skills/` ou `work-plan/skills/` et régénérez :

  ```sh
  bun run cat-harness-tools/scripts/gen-skill-docs.ts
  ```

- La **référence de l'API TypeScript** (`/api/`) est générée par TypeDoc dans la CI.
- Le site est construit et déployé sur GitHub Pages par
  `.github/workflows/docs-site.yml` à chaque push sur `main` qui modifie la documentation,
  les schémas ou le code source.

Aperçu local :

```sh
cd docs
bundle install
bundle exec jekyll serve
```

## Livrer une modification

Ouvrez la PR dès le premier commit et poussez de petits incréments
(`skills/conduct/conduct-core/continual-progress.md`) ; amenez la branche à un état propre, vert
et poussé avec `sdlc/skills/sdlc-core/prepare-merge.md`. Maintenez le **formalisme du framework
séparé du contenu** — le contenu a sa place dans son propre dépôt, et tout contenu
dans cette documentation n'est fourni qu'à titre d'illustration.
