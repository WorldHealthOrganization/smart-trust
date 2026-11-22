---
layout: default
title: Accessibilité
lang: fr
nav_exclude: true
translation_status: unverified
translation_source: start/accessibility.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Accessibilité
{: .no_toc }

Cette page répond à deux questions :

1. Quelles sont les options pour la prise en charge du handicap ici, et quelles sont les bonnes pratiques ?
2. Quelles sont les options pour contraindre les questions-réponses agentiques sous forme de questions guidées qui
   suivent la logique DMN et peuvent servir plusieurs modalités d'interaction ?

Il s'avère qu'il s'agit de la même question posée par deux bouts différents, c'est pourquoi elles
partagent la même page. La compétence qui l'implémente est
[`interaction-modality`]({{ '/reference/skill-instructions/interaction-modality.html' | relative_url }}).

1. TOC
{:toc}

---

## 1. Le problème dont il est question

Un agent qui pose une bonne question sous une forme inutilisable n'a rien demandé du tout.

La forme habituelle : une longue invite ouverte — *« Parlez-moi du folio que vous avez
en tête, des types de contenu que vous attendez et de la façon dont vous souhaitez l'organiser »* — envoyée
à quelqu'un pour qui taper au clavier est lent et douloureux. La réponse revient brève. L'agent
interprète cette brièveté comme un faible engagement et pose une autre question ouverte. Personne
dans cet échange n'a fait quoi que ce soit de manifestement répréhensible, et pourtant la conversation
échoue déjà.

La règle :

> **Le coût d'une question est payé par la personne qui y répond.** Concevez la question
> de manière à ce que la réponse la moins coûteuse possible soit malgré tout une réponse complète.

Des options sélectionnables constituent une meilleure question qu'une question ouverte pour presque tout le monde,
et ne coûtent rien à la personne qui préférerait de toute façon taper du texte. Traiter cela comme un
aménagement plutôt que comme le comportement par défaut explique pourquoi cela finit par n'être appliqué
qu'après que quelqu'un a dû le demander.

## 2. Options pour la prise en charge du handicap — ce qui est réellement envisageable

Quatre axes indépendants. Une personne peut se situer sur plus d'un axe, et aucun d'entre eux ne constitue
un diagnostic — ce sont des choix concernant l'interface.

### 2.1 Fonction manuelle / dextérité limitée

L'axe qui modifie le plus le comportement d'un agent, et celui le plus souvent réduit
à « agrandir les boutons ».

| à faire | pourquoi |
|---|---|
| Chaque question est une **sélection**, numérotée | la saisie au clavier est l'action coûteuse |
| **Quatre options ou moins** | au-delà, scindez la question |
| Une option **recommandée**, énoncée en **premier** et signalée | une personne qui ne souhaite pas trancher peut choisir la première proposition et avoir raison |
| **Indiquer ce qui se passe s'il n'y a pas de réponse**, puis l'exécuter | le silence ne doit jamais bloquer le travail |
| **Regrouper** les décisions pour qu'une seule réponse en couvre plusieurs | chaque aller-retour coûte des frappes de touches |
| Annoncer les tâches de longue durée ; ne pas demander la permission pour les lancer | les invites de confirmation sont la taxe cachée |
| Texte libre toujours *disponible*, jamais *exigé* | la liste d'options est un plancher, pas un plafond |

Dans le rendu final : **WCAG 2.2 SC 2.5.8 Taille de la cible (minimale)** — 24 × 24 px CSS
— et **2.5.7 Mouvements de glissement** : tout élément déplaçable par glisser-déposer doit proposer une alternative
sans glissement.

### 2.2 Malvoyance

Caractères de grande taille, contraste réel, aucune information véhiculée par la seule couleur,
lignes courtes et tableaux étroits — un tableau large est illisible à un zoom de 200 % et encore pire
avec un lecteur d'écran. Les diagrammes ASCII ne subsistent pas non plus ; utilisez une véritable image
avec un véritable texte alternatif.

Critères : **1.4.4 Redimensionnement du texte** (200 % sans perte), **1.4.3 Contraste
(minimum)**, **1.4.1 Utilisation de la couleur**, **1.4.10 Redistribution (Reflow)**, **2.4.7 Visibilité du focus**.

### 2.3 Audio / voix

Des réponses qui se lisent distinctement à voix haute : pas de blocs de code au milieu de la prose, pas de tableaux, pas de « voir
le diagramme ci-dessus », des identifiants épelés lors de leur première utilisation, une idée par phrase,
et **une seule question à la fois**. Une liste de quatre options fonctionne à l'oral ; un tableau
de quatre colonnes, non.

### 2.4 Charge cognitive et langage clair

Des phrases plus courtes, du jargon explicité dès sa première occurrence, pas de propositions imbriquées, et un
ordre des opérations prévisible. C'est de là que provient réellement la limite des « quatre options » — les
recommandations **COGA** du W3C et le critère **WCAG 3.1** — et c'est aussi tout simplement
le bon choix par défaut pour un lecteur dont ce n'est pas la langue maternelle, ce qui représente la plus grande
partie du public pour une directive SMART de l'OMS (WHO SMART Guideline).

### 2.5 Les bonnes pratiques, explicitement nommées pour être vérifiables

Non pas « suivre les directives d'accessibilité », mais des documents précis, afin qu'une affirmation ici
puisse être vérifiée plutôt que simplement crue sur parole :

| norme | ce qu'elle couvre | pourquoi elle s'applique ici |
|---|---|---|
| **WCAG 2.2 Niveau AA** | le rendu final — site de documentation, visionneuse, PDF généré | la référence de base à laquelle tout le reste se rapporte |
| **Nouveaux critères de succès (SC) de WCAG 2.2** — 2.5.7, 2.5.8, 3.3.7 | glissement, taille de la cible, saisie redondante | le 3.3.7 est celui qui modifie la conception de l'agent : **ne faites pas saisir deux fois la même information à quelqu'un** |
| **W3C COGA** | handicaps cognitifs et troubles de l'apprentissage | §2.4 ci-dessus |
| **EN 301 549** | marchés publics dans l'UE | fait de WCAG AA une exigence légale dans les contextes où s'inscrit une directive |
| **Section 508** | marchés publics fédéraux aux États-Unis | la même chose, aux États-Unis |
| **ATAG 2.0** | outils qui *produisent* du contenu | **celle que l'on oublie d'habitude.** folio-assistant est un outil de création de contenu : la partie A concerne l'utilisabilité de l'outil, la partie B concerne l'aide apportée à l'auteur pour produire un rendu accessible |

La partie B d'ATAG est la dimension qu'une plateforme de contenu peut
assurer de manière unique : la présence de textes alternatifs, l'ordre des titres, les en-têtes de tableau et le
balisage de la langue dans les folios *publiés* sont des contrôles que le balayage QA peut exécuter, et aucun
effort pour rendre l'éditeur accessible ne peut s'y substituer.

### 2.6 Ce qui est implémenté aujourd'hui

| | où |
|---|---|
| Préférences destinées à l'agent, commitées, lues au démarrage de la session | `memory/interaction.json`, exposé par `scripts/session-start-coord-sweep.sh` |
| Les règles suivies par un agent lorsqu'il pose des questions | [`interaction-modality`]({{ site.baseurl }}/reference/skill-instructions/interaction-modality.html) |
| Contrôles destinés aux lecteurs sur ce site | la roue dentée dans l'en-tête de la barre latérale — texte plus grand, contraste plus élevé, liens soulignés, animations réduites |
| Prise en compte de la réduction des animations sans qu'on le demande | requête média `prefers-reduced-motion`, qui initialise la valeur par défaut du panneau |

**Les deux dépôts de préférences sont délibérément distincts.** `memory/interaction.json`
est commité, destiné à l'agent, et concerne la conversation. Le réglage du site est enregistré dans le
`localStorage` de chaque visionneur, ne quitte jamais le navigateur, et concerne la lecture. Un
lecteur qui n'est pas l'auteur et qui choisit une taille de police plus grande ne doit pas reconfigurer
silencieusement la manière dont l'agent s'adresse à l'auteur.

### 2.7 Ce qui n'est pas fait

Énoncé explicitement, car une fonctionnalité d'accessibilité proclamée à moitié
est pire qu'une fonctionnalité absente :

- **Aucun contrôle de la partie B d'ATAG dans le balayage QA.** Rien ne vérifie encore qu'un
  folio publié dispose de textes alternatifs, d'un ordre de titres correct ou d'en-têtes de tableau.
- **Aucun audit des PDF générés.** Le chemin de rendu des documents passe par
  weasyprint/prince/wkhtmltopdf et la sortie PDF balisée (tagged PDF) n'a pas été vérifiée.
- **Aucun test avec un lecteur d'écran.** Les contrôles du site sont conçus selon les critères, mais
  n'ont pas été testés avec NVDA, JAWS ou VoiceOver. Conçu selon les spécifications ne signifie pas
  vérifié en pratique.
- **La modalité audio est décrite, mais non implémentée.** Les règles sont documentées ;
  aucun canal vocal n'est raccordé.

## 3. Contraindre les Q/R agentiques sous forme de questions guidées

La réponse réside dans une séparation.

### 3.1 Deux choses qui se ressemblent

**Quelle question poser ensuite** est une *décision*. Les entrées sont les faits connus jusqu'ici ; la sortie
est l'identifiant de la question suivante, ou `none` quand on en sait suffisamment. Cela a sa place dans une
table DMN, peut être révisé par quiconque détient la responsabilité du processus, et est identique pour chaque
utilisateur.

**Comment restituer la question** relève de la *modalité*. Une liste numérotée dans le chat ;
des alternatives énoncées oralement, une par une, en audio ; des boutons radio en gros caractères sur une
page web. La table de décision n'a jamais connaissance de tout cela.

```
 faits ──▶ [ next-question.dmn ] ──▶ id de question ──▶ renderer(profil) ──▶ utilisateur
   ▲                                                                               │
   └────────────────── réponse enregistrée comme nouveau fait ─────────────────────┘
```

Une seule logique, quatre supports. Ajoutez une modalité en ajoutant un moteur de rendu ; l'entretien
ne change pas. Modifiez l'entretien en modifiant une table ; aucun moteur de rendu ne change.

### 3.2 Quatre propriétés apportées par cette approche

1. **L'ensemble des questions est fini et révisable.** Vous pouvez lire la table et
   connaître chaque question que l'agent est susceptible de poser. Un agent qui improvise n'offre aucune
   garantie de ce type, et ne peut pas être passé en revue avant d'être confronté à un utilisateur.
2. **Le processus se termine.** Une table dont la sortie peut être `none` possède une condition
   d'arrêt.
3. **Poser une question devient obligatoire plutôt que facultatif.** C'est l'astuce que
   [`folio-intent.dmn`](getting-started.html#why-two-rules-return-ask-and-why-that-is-the-point)
   utilise déjà : `ask` est un *résultat de la table*, si bien que l'agent ne peut pas contourner
   cette étape. Un agent qui décide de lui-même s'il doit ou non poser une question choisira, dès qu'il
   se sentira obligé d'avoir l'air serviable, de ne pas la poser.
4. **Une question ignorée est vérifiable (auditable).** Les faits sont enregistrés ; rejouez la table
   et observez quelle règle s'est déclenchée.

### 3.3 Les options, et le coût de chacune

Quatre façons de procéder, par ordre d'ambition croissante. Seule la première est implémentée.

| option | de quoi il s'agit | coût |
|---|---|---|
| **A — une décision par passerelle** *(implémenté)* | chaque point de branchement ambigu dans un BPMN porte `cat-harness.processes:decision` ; la table renvoie la branche, `ask` y compris | aucune machine à états d'entretien — le *processus* constitue l'état. Ne peut pas exprimer « poser ces quatre questions dans n'importe quel ordre » |
| **B — un ensemble de questions derrière une seule passerelle** | un `next-question.dmn` bouclant jusqu'à ce qu'il renvoie `none` ; les réponses s'accumulent sous forme de faits | une table supplémentaire et un magasin de faits ; la boucle est propre au processus, rien de nouveau n'est donc exécuté |
| **C — formulaires pilotés par DMN** | la même table génère un formulaire sur le site, pas seulement un échange de chat | nécessite un schéma de faits et un moteur de rendu par modalité ; la table reste inchangée |
| **D — moteur complet d'entretiens DMN/BPMN** | sous-processus par sujet, événements de limite pour « j'ai changé d'avis » | un véritable travail sur le moteur, et le sous-ensemble FEEL devrait être étendu |

### 3.4 Les limites, clairement exposées

- **Le sous-ensemble FEEL est restreint.** `src/workflow/decision-table.ts` implémente
  l'égalité, la comparaison et l'appartenance à un ensemble (one-of). Les plages de valeurs, `not()` et les appels de fonctions sont
  *refusés* plutôt que silencieusement mal évalués — une table qui renvoie une réponse
  qui ne correspond pas à la table affichée sur la page est pire qu'une table qui lève une erreur.
- **Une question ouverte n'est pas une décision.** « De quoi traite cet article ? » n'a
  pas sa place dans une table, et l'y contraindre ne fait que dégrader l'entretien.
- **Une conversation n'est pas un assistant guidé (wizard).** Un utilisateur doit toujours pouvoir dire
  quelque chose que la table n'avait pas anticipé. C'est la raison d'être de l'option « en savoir plus »,
  et ce n'est pas une fioriture facultative.
- **Guidé ne veut pas dire interrogatoire.** Le plus grand gain d'accessibilité
  possible est la question que vous n'avez pas eu à poser — chaque fait que l'agent lit
  depuis le système de fichiers est une question de moins.

## Voir aussi

- [Premiers pas](getting-started.html) — la table de décision d'intention en pratique
- [Compétence `interaction-modality`]({{ '/reference/skill-instructions/interaction-modality.html' | relative_url }})
- [Flux de publication](../../process/fr/publication-workflow.html) — chaque processus au sein du dépôt
