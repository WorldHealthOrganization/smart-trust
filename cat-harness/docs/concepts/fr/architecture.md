---
layout: default
title: Architecture
lang: fr
nav_exclude: true
translation_status: unverified
translation_source: concepts/architecture.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Architecture
{: .no_toc }

1. TOC
{:toc}

---

## Vue d'ensemble

> **Les règles derrière cette page.** L'architecture décrit la forme ; les compétences
> régissent les décisions. Les adaptateurs par rapport aux profils —
> [`content-profiles`]({{ '/reference/skill-instructions/content-profiles.html' | relative_url }}).
> L'emplacement d'un nouveau nœud avant sa création —
> [`placement`]({{ '/reference/skill-instructions/placement.html' | relative_url }}). L'agencement
> du dépôt et chaque type de graphe —
> [`directory-conventions`]({{ '/reference/skill-instructions/directory-conventions.html' | relative_url }}).
> Composition et vérification de la surface MCP —
> [`mcp-assembly`]({{ '/reference/skill-instructions/mcp-assembly.html' | relative_url }}) et
> [`mcp-contract`]({{ '/reference/skill-instructions/mcp-contract.html' | relative_url }}).
> En cas de désaccord entre cette page et une compétence, la compétence l'emporte.

folio-assistant est un **serveur MCP** doté d'une couche d'**adaptateurs de contenu** enfichable,
d'un système de **compétences**, d'un **modèle d'objets de contenu** typé, d'un **RBAC** et d'une
stratégie de déploiement. Le contenu sur lequel il opère réside dans un dépôt *séparé* — la
plateforme est indépendante du contenu.

```mermaid
flowchart TD
    subgraph Harness[Harnais LLM · Claude Code / Antigravity / Gemini]
      LLM[Agent]
    end
    LLM <-->|MCP stdio/http| Server[FolioServer · src/server.ts]
    Server --> Tools[Outils de base<br/>check-deps · skill-fetch · preview · preferences · work_plan_prime]
    Server --> Adapter{Adaptateur de contenu}
    Adapter --> Paper[adaptateur paper<br/>lean · validate · render]
    Adapter --> Future[autres adaptateurs …]
    Server --> RBAC[Accès · src/core/rbac.ts + access.ts → ODRL policies/]
    Server --> Git[Assistant Git · src/core/git.ts]
    Server --> Feedback[Stockage des retours · src/core/feedback.ts]
    Tools --> Skills[Paquets de compétences<br/>schemas/skills/*]
    Paper --> Model[Modèle d'objets de contenu<br/>schemas/types.ts · constraints.ts · builders.ts]
```

## Séparation des préoccupations — état actuel et futur

La division de la plateforme en instances composables est décrite dans les
pages filles :

| page | ce à quoi elle répond |
|---|---|
| [Taxonomie des dépôts](../architecture/repo-taxonomy.html) | Quels types de dépôts existent — Outils, Tests, Contenu, Consommateur — et ce que chacun peut contenir |
| [État actuel](../architecture/current-state.html) | Ce qui se trouve réellement dans ce dépôt aujourd'hui, mesures à l'appui, et où se situe le mélange |
| [État futur](../architecture/future-state.html) | Les cinq dépôts cibles et dans lequel chaque répertoire atterrit |
| [Plan de migration](../architecture/migration-plan.html) | Phases 0/I/II/III, les étapes clés (gates) et ce qui reste à trancher |
| [`cat-harness` minimal](../architecture/cat-harness-minimum.html) | Ce qui subsiste dans le harnais une fois que le critère « non auto-documenté » est appliqué comme test |
| [Instances de harnais](../architecture/harness-instances.html) | Ce qu'EST une instance — schémas, visualisations, outils ; les quatre répertoires ; le rendu par défaut |

Le minimum indique qu'un harnais ne produit rien qu'un humain regarde, et la
page des instances qu'une instance effectue un rendu par défaut ; les deux
tiennent, car l'exigence de rendu est un **plancher qui s'élève** : `bootstrap` est exempté
du visualiseur et fournit ses propres `.json`/`.jsonld` à la place, et
`cat-harness` est la couche où le reste s'applique. Voir
[Où commence l'exigence](../architecture/harness-instances.html#where-the-requirement-starts--bootstrap-is-the-exception).

Le reste de cette page décrit l'architecture **telle qu'elle est actuellement**.

## Agencement du dépôt

La liste qui fait foi est `cat-harness.json` : chaque répertoire que déclare
cette couche, avec le type de graphe qu'il contient. Ceux qu'un lecteur cherche
d'abord :

| Chemin | Ce qui s'y trouve |
|--------|-------------------|
| `skills/` | Le graphe de connaissances : paquets de compétences (`skills/<domaine>/<paquet>/`, chacun avec un `package-manifest.json`), rôles, permissions et exigences |
| `processes/` | Les processus BPMN exécutables et les tables DMN que calculent leurs passerelles |
| `schemas/` | Les schémas JSON par compétence (`schemas/skills/`) et les documents de schéma que déclare le harnais |
| `tools/` | Les définitions d'outils, un `tools/<id>/<id>.json` par outil |
| `policies/` | Ce qu'un acteur peut faire, sous forme de politiques W3C ODRL 2.2 |
| `sdlc/`, `work-plan/` | Les sous-graphes de livraison logicielle et de plan de travail |
| `library/`, `uploads/` | Le contenu source L1 ingéré, et la file d'où il est ingéré |
| `docs/` | Ce site de documentation |
| `.github/` | Les workflows de CI |

Le code du serveur, les adaptateurs et les scripts nommés sur cette page
(`src/`, `adapters/`, `scripts/`, `deploy/`) ne sont pas dans cette couche ; ils
sont livrés avec la couche d'outils.

## Le serveur MCP

`FolioServer` (`src/server.ts`) enregistre les outils de base, puis demande à l'**adaptateur
de contenu** actif d'enregistrer ses propres outils. Il prend en charge deux modes de transport — `--stdio`
(ce que lancent les harnais) et `--http` (une instance partagée à longue durée de vie). Les appels d'outils
sont consignés avec leur temps d'exécution.

## Adaptateurs de contenu

Un adaptateur de contenu encapsule tout ce qui est spécifique à un type : quels artefacts existent,
comment les valider, comment les compiler/effectuer leur rendu, et quels outils MCP supplémentaires
enregistrer. L'adaptateur `document` (`adapters/document/`) constitue la base pour les folios
de prose ; l'adaptateur `paper` (`adapters/paper/`) l'étend et fournit les outils du cycle de vie Lean
(`lean_setup`/`build`/`check`/`status`), la validation et le rendu
(`paper_render_pdf`/`html`, `formula_render`). Les nouveaux types de contenu ajoutent un nouvel
adaptateur — voir [Ajouter un type de contenu](../../guides/new-content-type.html).

## Compétences et paquets de compétences

Une **compétence** est une unité de travail documentée et délimitée par un schéma (par ex.
`lean-formalization`). Les compétences sont regroupées en **paquets** qui déclarent leurs
dépendances Docker/d'exécution via un fichier `package-manifest.json`. Le LLM découvre les
compétences avec `skill_list` et charge les instructions avec `skill_fetch`. La liste complète
des compétences et des rôles — ainsi que la manière dont ils se composent avec le LLM (RBAC, capacités,
exigences) — se trouve sur la page [Compétences et rôles](skills.html) ; le contrat
d'entrée/sortie de chaque compétence est publié dans la
[Référence des schémas de compétences]({{ '/reference/skills/' | relative_url }}).

## Le modèle d'objets de contenu

Pour les articles, le contenu est un arbre de **blocs** typés validés à l'exécution avec Zod :

- `schemas/types.ts` — `Block`, `Section`, `Chapter`, `Paper`, et types de blocs
- `schemas/constraints.ts` — schémas Zod et règles de contraintes
- `schemas/builders.ts` — constructeurs validés (`definition()`, `theorem()`, …)

Ceux-ci sont documentés dans la [Référence de l'API TypeScript]({{ '/fr/api/' | relative_url }}) générée.

## Contrôle d'accès — ODRL, vérifié avant chaque tâche

Il n'existe qu'un seul système de permissions, et il s'agit de W3C ODRL 2.2 : les actions
dans `skills/permissions/permissions.json`, les autorisations dans `policies/*.jsonld`,
évaluées par `permits()` / `decide()` dans `schemas/odrl.ts`. Deux appelants le sollicitent :

- **L'exécuteur BPMN**, avant chaque tâche et décision
  (`src/workflow/authorize.ts`) : l'acteur est-il authentifié, éligible pour le
  rôle du couloir, autorisé à exécuter `perform-task` ici, et autorisé à toucher au
  contenu ? Consultatif aujourd'hui : un refus (`deny`) ou une non-concordance de rôle est rejeté, et `unknown`
  est consigné.
- **Les routes HTTP**, via `src/core/rbac.ts` : chaque route nomme l'action
  qu'elle effectue (`content-authoring`, `review-comments`, `adjudication`), et les
  sessions de la passerelle d'authentification sont des acteurs déclarés dont les droits sont
  définis dans `policies/http-gateway.jsonld`. Ici, `unknown` refuse.

La règle de conduite est définie par la compétence
[`task-authorization`]({{ '/reference/skill-instructions/task-authorization.html' | relative_url }}).

## Amorçage du plan de travail (inter-harnais)

Le plan de travail est stocké dans `beans` et exposé de trois manières pour que tout harnais soit
amorcé de façon identique :

1. **`AGENTS.md`** — discipline statique, lue nativement par chaque agent.
2. **Hook `SessionStart`** — chaque harnais exécute l'amorce partagée
   `scripts/session-start-coord-sweep.sh`.
3. **Outil MCP `work_plan_prime`** — amorçage en direct pour tout agent connecté via MCP.

Voir `docs/folio-assistant-migration.md` pour la conception inter-agents complète.

## Déploiement

`deploy/` (couche d'outils) contient un modèle de proxy inverse Caddy, `docker-compose.yml`, un
script de provisionnement, la configuration de Google OAuth et un script de mise à jour automatique pour exécuter une
instance HTTP partagée. Les manifestes Docker des paquets de compétences regroupent les dépendances apt/pip/npm
dans une image unique par ensemble de paquets actif.
