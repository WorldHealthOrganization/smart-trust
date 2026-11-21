---
layout: default
title: Folio assistant
lang: fr
nav_exclude: true
translation_status: unverified
translation_source: index.md
description: "folio-assistant — un cadre de compétences d'agent indépendant du contenu."
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# folio-assistant
{: .fs-9 }


Un cadre de compétences d'agent indépendant du contenu pour la rédaction de
contenus rigoureux avec un grand modèle de langage — articles scientifiques et
livres, Lignes directrices SMART de l'OMS, et Guides d'implémentation FHIR —
appuyé par un serveur MCP, un contrôle d'accès basé sur les rôles, et un modèle
d'objets de contenu typé.
{: .fs-6 .fw-300 }

<!--
  `View on GitHub` STAYS: it is authored content on this page, not site chrome,
  so removing the site-wide GitHub link does not remove it.
-->
[Démarrer]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Installer]({{ '/docs/cat-harness/start/installation.html' | relative_url }}){: .btn .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Voir sur GitHub](https://github.com/litlfred/folio-assistant){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Quatre choses, dans l'ordre

**1. Le plan de travail est l'endroit où vous dites ce que vous faites.**
Pas un message de discussion, pas un commentaire — des [work items]({{ '/docs/cat-harness/guides/beans-and-todos.html' | relative_url }}), un dépôt versionné que toute session ou tout agent peut lire. Réservez avant de travailler, pour qu'une session voisine ne prenne pas le même élément ; un work item qui s'avère inutile est marqué `scrapped`, avec ses raisons, jamais supprimé.

```sh
cat-harness-tools/scripts/install-beans.sh && export PATH="$HOME/.local/bin:$PATH"
beans list                          # ce qui est ouvert
beans create "<title>"              # …après avoir vérifié que le titre n'existe pas
bun run cat beans:claim <id>        # le réserver, visiblement
```

**2. Créez votre premier folio.** Ce dépôt est la *plateforme* ; votre contenu vit dans le sien. Une seule commande le prépare — les manifestes, la déclaration, les fichiers d'agent et le lien vers ici :

```sh
bun run cat init-folio --help
```

Ensuite, [Démarrer]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }}) accompagne le premier bloc à travers la validation, le rendu et la relecture.

**3. Sachez quel genre de chose vous écrivez.** Un *document* est de la prose structurée ; un *article* (paper) est cela, plus les types de blocs dont l'assertion est une affirmation formelle, appuyée par Lean et composée avec LaTeX. Ce choix décide quels blocs sont permis et quels contrôles s'exécutent : [Types de contenu]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }}).

**4. Le reste de la documentation.**
[Toute la documentation]({{ '/docs/cat-harness/guides/index.html' | relative_url }}) — les guides de rédaction, l'architecture, le flux de publication, la référence générée des schémas et des compétences. Lisez-la quand vous en avez besoin ; les trois étapes ci-dessus sont celles qui valent d'être lues maintenant.

Quand c'est la *machinerie* qui vous déroute plutôt que la rédaction — qui fait quoi, dans quel processus, avec quelle compétence — commencez par [La plateforme]({{ '/docs/cat-harness/platform.html' | relative_url }}).

---

## Qu'est-ce que folio-assistant ?

**folio-assistant** est la *plateforme* — elle ne contient pas de contenu. Elle
fournit les compétences, les schémas, les outils et un serveur MCP (Model Context
Protocol) qu'un agent piloté par un LLM utilise pour planifier, rédiger, valider,
réviser, tester et publier un **folio** de contenu qui réside dans un dépôt séparé.

> **Séparation des préoccupations.** Cette documentation décrit le cadre et comment
> l'utiliser. Lorsque du contenu apparaît dans ces pages, c'est un *exemple*, jamais
> l'artefact canonique.

```mermaid
flowchart LR
    A[Auteur + LLM] -->|chat / outils MCP| B(folio-assistant)
    B --> C{Adaptateur de contenu}
    C -->|article| D[Dépôt Lean + LaTeX]
    C -->|WHO SMART DAK| E[L2 BPMN / DMN / Excel]
    C -->|WHO SMART IG| F[L3 FHIR / FSH]
    B --> G[Compétences + Schémas + RBAC]
    D & E & F --> H[Site publié / PDF / IG]
```

## Types de contenu pris en charge

folio-assistant est **extensible** — chaque type de contenu est géré par un
adaptateur de contenu et un ensemble de compétences correspondant. Les types
actuellement pris en charge :

| Type de contenu | Artefacts | Ensemble de compétences |
|-----------------|-----------|-------------------------|
| **Articles scientifiques et livres** | Formalisation Lean 4 + LaTeX/Markdown | [`authoring-math`]({{ site.baseurl }}/docs/cat-harness/concepts/content-types.html#scientific-papers--books) |
| **Kits d'adaptation numérique (DAK) des Lignes directrices SMART de l'OMS** | Artefacts L2 — BPMN, DMN, dictionnaires de données Excel, personas | [`authoring-who-smart-guidelines`](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#who-smart-guidelines-daks-l2) |
| **Guides d'implémentation SMART de l'OMS** | Ressources FHIR L3, FSH, sortie de l'éditeur d'IG | [`authoring-who-smart-guidelines`](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#who-smart-implementation-guides-l3) |
| **Autres** | Extensible — ajoutez un nouvel adaptateur + ensemble de compétences | [Ajouter un type de contenu]({{ site.baseurl }}/docs/cat-harness/guides/new-content-type.html) |

Le cycle transversal [`content-lifecycle`]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }}#the-content-lifecycle)
(planifier → rédiger → valider → réviser → tester → publier → retour → retirer)
s'applique à chaque type de contenu. Le
[flux de publication](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html) le modélise correctement —
en diagrammes BPMN à couloirs, avec les rôles, la porte de validation IHM, et le
plan de travail partagé.

## Où aller ensuite

- **[Installation]({{ '/docs/cat-harness/start/installation.html' | relative_url }})** — prérequis, clonage, `bun install`, vérification des capacités.
- **[Démarrage]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }})** — connectez le serveur MCP à votre LLM et exécutez votre première compétence.
- **[Tutoriel : Rédiger un article avec folio-assistant](https://litlfred.github.io/folio-assistant/folio-assistant-sci/guides/writing-a-paper.html)** — un guide complet piloté par LLM avec une session de chat simulée.
- **[Types de contenu]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }})** — le formalisme de chaque domaine de rédaction.
- **[Flux de publication](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html)** — diagrammes BPMN à couloirs des processus d'édition et de publication : la porte de validation IHM, qui révise quoi, et le plan de travail partagé.
- **[Intégration de l'agent]({{ '/docs/cat-harness/guides/agent-onboarding.html' | relative_url }})** — orientation pour un agent LLM intégré dans un folio : premières étapes, recherche de compétences, modèle d'objets de contenu, side-cars d'assurance qualité.
- **[Compétences et rôles]({{ '/docs/cat-harness/concepts/skills.html' | relative_url }})** — chaque compétence et rôle, et comment ils fonctionnent ensemble avec le LLM.
- **[Référence du schéma de compétences](../reference/skills/)** — contrats d'entrée/sortie générés pour chaque compétence.
- **[Référence de l'API TypeScript](../api/)** — le modèle d'objets de contenu (`Block`, `Chapter`, `Paper`, builders, contraintes Zod).
- **[Architecture]({{ '/docs/cat-harness/concepts/architecture.html' | relative_url }})** — adaptateurs, serveur MCP, RBAC, le modèle de blocs.
- **[Le graphe de connaissances]({{ '/docs/cat-harness/concepts/knowledge-graph.html' | relative_url }})** — la taxonomie des sous-graphes, le sens dans lequel les références s'exécutent, et la manière dont les dépôts répartissent le travail.
- **[Le Harness]({{ '/docs/cat-harness/concepts/harness.html' | relative_url }})** — instanciation, le parcours des dépendances, et ce à quoi oblige le harnachement d'un répertoire.

Deux compétences méritent d'être lues avant les pages ci-dessus, car tout le reste
les présuppose : [`getting-started`](../reference/skill-instructions/getting-started.html)
oriente ce que vous essayez réellement de faire, et
[`placement`](../reference/skill-instructions/placement.html) détermine où doit se
situer un nouveau nœud avant que vous n'en créiez un.

## Carte de la documentation

```mermaid
flowchart TD
    Home[Accueil] --> Install[Installation]
    Home --> GS[Démarrage]
    Install --> GS
    GS --> Tut[Tutoriel : rédiger un article]
    GS --> CT[Types de contenu]
    CT --> Skills[Compétences et rôles]
    CT --> WF["Flux de publication<br/>(BPMN à couloirs)"]
    CT --> Guides[Guides de rédaction]
    Guides --> Paper[Articles : Lean + LaTeX]
    Guides --> DAK[WHO SMART DAK / L2]
    Guides --> IG[WHO SMART IG / L3 FHIR]
    Guides --> New[Ajouter un type de contenu]
    Skills --> Ref[Référence des schémas de compétences]
    CT --> Ref
    Ref --> API[Référence API TypeScript]
    Home --> Arch[Architecture]

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

> Les nœuds de la carte sont cliquables sur le site de documentation.
