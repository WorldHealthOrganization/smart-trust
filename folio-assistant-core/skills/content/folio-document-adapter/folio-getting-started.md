---
name: folio-getting-started
description: >-
  The content-folio half of the harness's getting-started skill: binds
  collab/processes/conduct/getting-started.bpmn and decisions/folio-intent.dmn,
  interprets describeRepository() content-type markers (folio, harness, dak,
  sushi), and routes new-content and specialised IG/DAK creation requests.
---

# Folio getting started — content-type triage and routing

The harness skill [`getting-started`](../../../../cat-harness/skills/conduct/conduct-core/getting-started.md)
governs repository triage (`isFolio`, `repoHasContent`, `statedIntent`),
selectable options via [`interaction-modality`](../../../../cat-harness/skills/conduct/conduct-core/interaction-modality.md),
and `gh-pages` provisioning before GitHub Pages is switched on. In a content
folio or a layer stacked on `folio-assistant-core`, apply these rules
alongside it.

Process: `collab/processes/conduct/getting-started.bpmn` (opt-in `folio-assistant-core.collab`).
Decision table: `collab/processes/conduct/decisions/folio-intent.dmn` (opt-in `folio-assistant-core.collab`).

## 1. Repository membership vs. `isFolio`

`describeRepository()` (`schemas/content/content-type.ts`) returns every marker
a repository carries — `folio`, `harness`, `dak`, `sushi` — with the facts each
states and any disagreement between them. `describeRepositoryClosure()`
(`schemas/kg/harness-config.ts`) extends that through the dependency tree,
attributing each membership to the layer that carried it.

- **`folio` and `harness` are distinct memberships.** The declaration
  (`<name>.json`) says *this is a layer*; a config that declares
  `contentType` (`<name>.config.json` or inline in `index.config.json`) says
  *this authors folio content*. `isFolio` in `folio-intent.dmn` tests membership
  of `folio` specifically.
- **Multiple markers do not perturb the five branches.** A folio that is also a
  DAK or carries a `sushi-config.yaml` takes the same branch in
  `folio-intent.dmn` as one that is not: use `describeRepository()` to inspect
  what the repository is, and `isFolio` to drive `Gateway_Intent`.

## 2. Content-type routing on `new-content` and specialised harnesses

- **`new-content` branch:** stop the onboarding process immediately and hand off
  to the folio's content authoring workflow (such as
  [`document-authoring`](document-authoring.md)
  for a document folio, or the paper authoring skills in a paper folio).
  Scaffolding anything on `new-content` is a defect.
- **Specialised IG or guideline creation:** when the user asks to create a
  domain Implementation Guide or guideline in a harness that specialises this
  layer, hand over to that layer's creation skill discovered via `skill_list`.
  In a harnessed repository, default to staging the new sub-KG in place first
  ([`sub-kg-lifecycle`](../../../../cat-harness/skills/kg/graph-management/sub-kg-lifecycle.md))
  until the owner confirms creating or writing to an external repository.
