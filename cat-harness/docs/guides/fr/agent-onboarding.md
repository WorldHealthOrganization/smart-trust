---
layout: default
title: Intégration de l'agent (FR)
parent: Authoring guides
lang: fr
# `lang` above is what makes this a translation -- nothing reads `fr` out of
# the path. `nav_exclude` keeps it out of the statically built nav, and
# `mountNavLocale` (site-chrome/assets/js/docs-ui.js) puts it back in place of its
# source when this locale is selected. There is no `nav_order`: it stands
# where its source stands. library/skills/library-core/translation-manager.md
nav_exclude: true
translation_status: unverified
translation_source: guides/agent-onboarding.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Intégration de l'agent
{: .no_toc }

Vous êtes un agent LLM qui vient d'être placé dans un dépôt utilisant
folio-assistant. Cette page est votre orientation : ce que vous regardez,
ce qu'il faut faire en premier, et où chercher les informations.

Pour l'*architecture* des compétences, des rôles et des capacités, lisez
[Compétences & rôles](../../concepts/skills.html). Cette page en est la version pratique.

1. TOC
{:toc}

---

## 1. Déterminez dans quel dépôt vous vous trouvez

Il en existe deux types, et les confondre est l'erreur la plus fréquente au début.

| | **folio-assistant** (la plateforme) | **Un folio** (le dépôt de contenu) |
|---|---|---|
| Contient | compétences, schémas, pipeline, serveur MCP | le document / la directive / l'IG réel(le) |
| Contient `content/<paper>/` | non — seulement `content/pipeline/` | oui |
| Vous éditez ici pour | modifier le fonctionnement de la rédaction | modifier ce qui est rédigé |

<!-- command-path-ok: a PROBE — whether `content/` is here is the answer, so it must not be required to resolve -->
```sh
ls content/          # pipeline/ seulement  ⇒ plateforme ;  dossiers d'articles ⇒ folio
```

**folio-assistant ne contient aucun contenu.** Si vous vous apprêtez à y
écrire de la matière — un chapitre, une constante, une liste de mots-clés
de chapitre — vous êtes dans le mauvais dépôt, ou ce que vous écrivez
devrait être des données fournies par le folio. Voir §7.

## 2. Vos cinq premières minutes

```sh
beans prime && beans list      # le plan de travail — voir §6
cat-harness-tools/scripts/session-start-coord-sweep.sh  # équivalent indépendant du CLI
bun run cat check-deps                     # ce que cet environnement sait faire
```

Beaucoup de vérifications se replient sur `n/a` au lieu d'échouer lorsqu'un
outil manque (pas de chaîne d'outils Lean, pas d'Atlas, pas de LaTeX). **Un `n/a`
n'est pas une réussite :** dites ce qui a été sauté et pourquoi, car « tout est
propre » sur des vérifications sautées présente l'absence de données comme un
résultat.

## 3. Trouvez la bonne compétence — n'improvisez pas

Les compétences sont ici l'unité de travail. Avant d'improviser une procédure,
vérifiez s'il en existe une. **Demandez-la ; n'allez pas la chercher par un chemin,**
car un chemin codé en dur disparaît dès que l'arborescence change.

```
skill_list                                      # toutes les compétences, avec leur résumé
skill_fetch skill="<id>" package_name="<pkg>"   # le texte d'instructions à suivre
work_plan_prime                                 # le plan de travail — voir §6
```

Pas de serveur MCP attaché ? Le même graphe est sur le disque : ouvrez `<name>.json` à la
racine du dépôt, prenez les entrées `directories[]` dont les `graphTypologies` contiennent
des compétences, et lisez les fichiers `.md` qui s'y trouvent.

**Lisez [`kg-navigation`](../../reference/skill-instructions/kg-navigation.md)
avant votre première recherche.** Elle décrit les deux voies en entier, ce qui compte
comme une compétence (trois types de nœuds sous ces chemins n'en sont pas), et les trois
façons dont la recherche tourne mal — dont celle où vous modifiez la mauvaise copie d'une
compétence qui existe en trois exemplaires.

Où lire davantage — pas par où commencer :

| Où | Ce que ça vous donne |
|---|---|
| [Référence des schémas de compétences]({{ site.baseurl }}/reference/skills/) | contrat d'entrée/sortie généré par compétence |
| [Instructions des compétences]({{ site.baseurl }}/reference/skill-instructions/) | corps d'instructions complets générés |
| [Compétences & rôles](../../concepts/skills.html) | comment les compétences, rôles et capacités se composent |

Les deux répertoires `reference/` sont **générés** — ne les modifiez jamais à la main.
Régénérez-les avec `bun run cat-harness-tools/scripts/gen-schema-docs.ts` et
`bun run cat-harness-tools/scripts/gen-skill-docs.ts`.

## 4. Le modèle d'objets de contenu, en bref

Un bloc de contenu est un **triple** partageant un nom racine :

```
<block>.ts     manifeste — label, kind, uses[], lean.ref, cites[]
<block>.md     le récit qu'un lecteur lit réellement
<block>.lean   la formalisation (quand le type en exige une)
<block>.qa.json  fichier annexe de QA — résultats d'audit, par critère
```

Le manifeste `.ts` fait foi pour la structure. L'*état* de formalisation est dérivé
à la construction, jamais stocké dans le manifeste.

## 5. Deux relations de dépendance — ne les confondez pas

- **`uses[]` est éditorial.** « Qu'un lecteur doit-il avoir lu pour suivre
  ce bloc ? » Rédigé — tenu à jour par un agent ou un humain.
- **Le graphe formel est dérivé automatiquement** de `lean.ref`, jamais
  écrit à la main.

Ils divergent légitimement dans les deux sens : une preuve invoque des lemmes de `simp`
que personne n'a besoin de lire ; un théorème est motivé par un exemple qu'il ne cite
jamais formellement.

**Ne remplissez jamais `uses[]` à partir de Lean.** Cela détruit le signal à partir
duquel chaque métrique d'ordonnancement est calculée. Pour les questions d'impact
(« qu'est-ce qui casse si ceci change ? »), prenez l'union :

<!-- command-path-ok: run IN A FOLIO — the platform carries no content/, which is this guide's own §1 -->
```sh
bun run content/pipeline/content-graph.ts content/<paper>
```

Vérifier que `uses[]` est bien utilisé est une compétence à part entière :
`uses-editorial-review`, plus l'axe de QA mécanique `uses`.

## 6. Suivez le travail dans beans, pas dans votre tête

`beans` est l'**unique** mécanisme de tâches — local à la session *et*
partagé entre agents. `beans/` est conservé sur une branche d'état et monté au
démarrage de la session (`bun run cat state:mount`), si bien qu'un plan survit à
une reprise dans un conteneur neuf.

```sh
beans list
beans create "<title>"
bun run cat beans:claim <id>             # RÉSERVEZ avant de travailler
```

Réservez avant de travailler pour que deux sessions ne prennent pas le même élément,
ne fermez jamais un élément de travail sur lequel une session sœur est en cours (un élément terminé se ferme sur preuves, non sur la paternité), et ne supprimez JAMAIS un élément de travail — abandonnez-le en donnant vos raisons. Ne montez pas de magasin de tâches
parallèle. N'appliquez pas `beans create` aux files d'attente générées en masse par machine (`*.qa.json`,
fichiers témoins) — elles restent en JSON brut.

La discipline complète : `work-plan/skills/work-plan/todo-manager.md`,
`work-plan/skills/work-plan/bean-coordination.md`.

## 7. Fichiers QA et axes

Chaque bloc peut porter `<block>.qa.json`, qui consigne, critère par critère, ce que
chaque relecteur a constaté — `script`, `agent` ou `human`. Les entrées portent les
empreintes des fichiers source au moment de l'audit : une entrée devient **périmée** quand
le bloc est modifié et doit être réévaluée.

**L'endroit où un résultat de QA est conservé dépend de la possibilité de le régénérer.**
Les verdicts dérivés, c'est-à-dire les entrées `script` et tout ce qui se trouve sous
`<instance>/test/results/`, sont une copie de travail. La CI en conserve la trace sur la
branche orpheline `qa-reports`, indexée par commit : il n'y a donc rien à
régénérer ni à committer. Les jugements d'un agent ou d'un humain restent sur `main` dans
`test/attestations/`. Les contrôles qui portent sur eux calculent et jugent : un constat
n'échoue que s'il est nouveau par rapport à une référence enregistrée, et une référence absente vaut
*inconnu*. La compétence est
[`qa-reports`](../../reference/skill-instructions/qa-reports.md).

Les critères sont regroupés en **axes** (`proof`, `voice`, `detangler`,
`uses`, `canonical`, `compute`, `bibliography`, …). Pour en exécuter un :

<!-- command-path-ok: run IN A FOLIO — the platform carries no content/, which is this guide's own §1 -->
```sh
bun run content/pipeline/qa-sweep.ts --axis uses content/<paper>
bun run content/pipeline/qa-staleness.ts content/<paper>
```

Certains critères sont `automated: true` (un script décide) et d'autres
`automated: false` (un agent ou un humain doit trancher). Les seconds
coûtent de vrais tours — voir `semantic-cone.ts` pour les cibler selon ce qu'ils
peuvent réellement affecter.

**Axes optionnels du folio.** Un axe encodant le sujet d'un folio n'est
enregistré que lorsque le folio choisit de l'activer :

```json
// harness.config.json
{ "qaAxes": ["q-usage"] }
```

De même, les *données* propres à un folio appartiennent au folio, pas à la plateforme —
par exemple `content/<paper>/topic-keywords.json` pilote
`detangler-topic-coherence`, et en son absence le vérificateur signale `n/a`.

## 8. Livrer le travail

```sh
/prepare-merge [base]
```

Exécute la recette générique ainsi que les portes de contrôle propres au type de contenu (document →
content_validate / qa_sweep / proof_status / latex_preflight /
lean_build), puis pousse les modifications. **Cela ne fusionne pas.**

Surveiller une PR sœur : `/watch <pr|branch>`.

## 9. Où chercher les informations

| Question | Réponse |
|---|---|
| Commandes du projet, conventions | `AGENTS.md` (la source de vérité, valable pour tout agent) |
| Ce que fait une compétence | `skills/**/`, ou le [texte des instructions]({{ site.baseurl }}/reference/skill-instructions/) généré |
| Le contrat typé d'une compétence | [Référence des schémas de compétences]({{ site.baseurl }}/reference/skills/) |
| Ce que signifie un critère QA | `content/pipeline/qa-criteria-registry.ts` — les descriptions font office de spécification |
| Le schéma des blocs | `schemas/types.ts` |
| Le schéma du fichier QA | `schemas/block-qa.ts` |
| Ce que cet environnement peut faire | `cat-harness/scenarios/capabilities/*.json`, `--check-deps` |

## 10. Habitudes pour éviter les ennuis

- **Ne codez pas en dur le nom d'un article.** Un folio peut en contenir plusieurs ;
  résolvez-le avec `findPapers()` / `soleFolioPaper()` depuis
  `content/pipeline/repo-root.ts`.
- **Lisez la description du critère avant d'agir sur un constat.** Elle
  précise la gravité, l'intention et ce qui, explicitement, *ne* compte *pas*.
