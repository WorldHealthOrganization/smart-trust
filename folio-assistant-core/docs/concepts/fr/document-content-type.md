---
layout: default
title: "Documents & orientations politiques"
lang: fr
nav_exclude: true
translation_status: unverified
translation_source: concepts/document-content-type.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Documents & orientations politiques
{: .no_toc }

## Documents & orientations politiques
{: #documents-policy-guidance }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/authoring-a-document.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/authoring-a-document.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="documents-policy-guidance.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/documents-policy-guidance.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**Ensemble de compétences :** `folio-document-adapter` ·
**Adaptateur :** `document` ·
**Guide :** [Rédiger un document](../../guides/writing-a-document.html)

Prose structurée : orientations de politiques de santé (une ligne directrice L1, par exemple), une norme, un
rapport, un manuel, un chapitre de livre. Tout ce qu'est un article, moins la couche
formelle — et donc moins les deux chaînes d'outils qui la desservent.

- **Modèle source** — le même arbre de *blocs* typés qu'un article, restreint aux
  genres dont le contenu est de la prose plutôt qu'une affirmation formelle : `prose`,
  `example`, `remark`, `algorithm`, `simulator`, `equation`, `diagram`,
  `table`.
- **Rendu** — `document_render_md` assemble le folio en un unique fichier
  Markdown ; `document_render_html` et `document_render_pdf` le passent par
  pandoc. Le chemin PDF utilise un moteur HTML (weasyprint, prince, wkhtmltopdf)
  et ne bascule **jamais** vers `latexmk`, de sorte que « aucun TeX requis » reste vrai plutôt
  que de devenir vrai-jusqu'à-ce-que-quelqu'un-ait-TeX-d'installé.
- **Application des règles** — `content_profile_check` rejette tout genre mathématique, tout champ
  `lean` ou fichier frère `.lean`, et s'exécute à chaque `content_validate`.

Schémas de compétences pertinents :
[`document-authoring`]({{ '/reference/skills/document-authoring.html' | relative_url }}),
[`document-structure`]({{ '/reference/skills/document-structure.html' | relative_url }}),
[`normative-statements`]({{ '/reference/skills/normative-statements.html' | relative_url }}),
[`document-publishing`]({{ '/reference/skills/document-publishing.html' | relative_url }}).

<div class="bpmn-figure" id="figure-documents-policy-guidance">
  <img src="{{ '/fr/assets/img/workflows/authoring-a-document.svg' | relative_url }}"
       alt="Diagramme BPMN à couloirs de la rédaction d'un document : l'auteur planifie, le plan est initialisé sous forme de beans, un agent échafaude le folio et rédige les blocs, le pipeline de compilation vérifie le profil déclaré avant de valider et de restituer en Markdown, HTML et PDF, et un relecteur contrôle l'accès à la publication.">
</div>

[Source BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/authoring-a-document.bpmn) · [SVG en taille réelle]({{ '/assets/img/workflows/authoring-a-document.svg' | relative_url }})
{: .bpmn-source }

### Porter un énoncé normatif
{: #carrying-a-normative-statement data-fa-label="sec:content-types-carrying-a-normative-statement" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/content/docs/content-types/carrying-a-normative-statement.md){: .fa-node-edit title="Edit content/docs/content-types/carrying-a-normative-statement.md" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="carrying-a-normative-statement.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/carrying-a-normative-statement.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span></span>

Une recommandation, une exigence ou une règle est le bloc que les lecteurs citent et
auquel les responsables de mise en œuvre se réfèrent. Il a besoin d'une étiquette, d'une identité stable et d'une place dans le
graphe de dépendances — tout ce que possède un `theorem` — et ce n'est catégoriquement pas un
théorème, car rien ne le prouve.

Il n'existe **pas de genre de bloc `recommendation` de premier ordre**. Aujourd'hui, le support est un
bloc `prose` doté d'une étiquette et d'un titre ; la compétence
[`normative-statements`]({{ '/reference/skill-instructions/normative-statements.html' | relative_url }})
énonce la convention et ses limites. Les directives antérieures dans
`document-intake` faisaient correspondre les recommandations des lignes directrices à `definition` — cela
précédait ce type de contenu et s'avère incorrect pour un folio de type document, où
`definition` est un genre mathématique dont le champ `lean` est obligatoire.

---
