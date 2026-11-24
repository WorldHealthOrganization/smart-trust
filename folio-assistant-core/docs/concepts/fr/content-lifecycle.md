---
layout: default
title: "Le cycle de vie du contenu"
lang: fr
nav_exclude: true
translation_status: unverified
translation_source: concepts/content-lifecycle.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Le cycle de vie du contenu
{: .no_toc }

## Le cycle de vie du contenu
{: #the-content-lifecycle data-fa-label="sec:content-types-the-content-lifecycle" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/content-lifecycle.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/content-lifecycle.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="the-content-lifecycle.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="the-content-lifecycle.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

Chaque type de contenu traverse le même cycle de vie, fourni par
l'ensemble transversal de compétences **`content-lifecycle`** :

<div class="bpmn-figure" id="figure-the-content-lifecycle">
  <img src="{{ '/fr/assets/img/workflows/content-lifecycle.svg' | relative_url }}"
       alt="Diagramme BPMN à couloirs d'un cycle de folio : le gestionnaire de programme planifie, le plan est initialisé sous forme de beans, l'édition et la validation IHM s'exécutent pour chaque modification proposée, un test d'intégration et un balayage QA suivent, puis brouillon-relecture-publication ; les retours sont triés et enregistrés sous forme de beans, et le cycle se répète ou le folio est retiré.">
</div>

[Source BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/content-lifecycle.bpmn) · [SVG en taille réelle]({{ '/assets/img/workflows/content-lifecycle.svg' | relative_url }})
{: .bpmn-source }

| Étape | Compétence | Ce qui se passe |
|-------|-------|--------------|
| plan | `content-plan` | Définir la portée du travail, identifier les artefacts et les acteurs |
| author | `content-author` | Créer des artefacts structurés à partir du matériau source |
| validate | `content-validate` | Vérifier par rapport au schéma + contraintes |
| review | `content-review` | Relecture humaine / par un expert métier selon des critères |
| test | `content-test` | QA automatisée, compilation réussie, preuves/validateurs validés |
| publish | `content-publish` | Restituer et déployer la version publiée |
| feedback | `content-feedback` | Recueillir et acheminer les retours des relecteurs |
| retire | `content-retire` | Déprécier ou archiver un artefact |

Les étapes du cycle de vie sont les mêmes quel que soit le type de contenu — ce qui
diffère, ce sont les compétences de *rédaction* et les *artefacts* que chaque type produit. Pour la liste
complète des compétences et les rôles qui les pilotent, voir **[Compétences & rôles]({{ '/docs/cat-harness/concepts/fr/skills.html' | relative_url }})**.

Deux choses que les noms des huit étapes dissimulent, contrairement au diagramme : `author` et
`validate` ne sont pas des phases consécutives mais une *boucle* — chaque modification proposée passe par
la porte de validation IHM, et l'éditeur voit les conclusions avant que quoi que ce soit ne soit
validé — et `review` intervient deux fois, une fois par modification et une fois sur le
brouillon assemblé. Les deux se développent dans leurs propres diagrammes sur la
page du **[flux de publication]({{ '/folio-assistant-core/process/fr/publication-workflow.html' | relative_url }})**.

---
