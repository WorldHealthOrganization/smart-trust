---
name: smart-guideline-end-to-end
description: >
  The whole road from a use case to a running application on WHO SMART
  Guidelines, for a new guideline or a jurisdiction's adaptation, as an
  orchestrator of ten named stage skills, each with its own input and output
  contract: guideline-use-case, dak-l1-library, recommendation-extraction,
  l2-dependency-choice, l2-dak-authoring, l3-dependency-choice,
  l3-fhir-authoring, l4-application-brief, wireframe-design-review and
  l4-application-build. Each stage's output is the next stage's input. Human
  adjudication follows every stage as QA, not as a gate, but the order of the
  stages is a rule: no L3 asset before the L1 extraction and L2 assets it
  derives from exist with their review requested. Read before starting any
  end-to-end authoring or adaptation, and to find which skill runs each
  stage. A request to adapt a WHO guideline, DAK or IG to a country or
  programme ("adapt the immunization guidelines to Uganda using these
  schedules") is this process, even when it reads like an IG or coding task.
input: schemas/skills/smart-guideline-end-to-end/input.schema.json
output: schemas/skills/smart-guideline-end-to-end/output.schema.json
---

# smart-guideline-end-to-end

> Skill id: `smart-guideline-end-to-end` · Package: `authoring-who-smart-guidelines` ·
> Process: [`smart-guideline-end-to-end.bpmn`](https://github.com/litlfred/smart-base/blob/main/smart-base/collab/processes/content/smart-guideline-end-to-end.bpmn)

This skill holds the order of the stages, the hand-off between them and the
adjudication rule. What a stage does is in its own skill; if a stage needs
something its skill does not say, fix that skill, not this one. Every record
uses an existing schema ([What it reuses](#what-it-reuses)).

## Input and output

The contract is [`input.schema.json`](../../../schemas/skills/smart-guideline-end-to-end/input.schema.json) and [`output.schema.json`](../../../schemas/skills/smart-guideline-end-to-end/output.schema.json).

- **In:** the `request`, verbatim; the `useCase` when stage 0 is already done; the guideline's feature `branch`.
- **Out:** every stage's artefact under the name the stage table gives it (`useCase`, `l1Sources`, `l1Kg`, `l2Dependencies`, `l2Assets`, `l3Dependencies`, `ig`, `applicationBrief`, `wireframes`, `application`), and one `adjudications` entry per stage with its `QaReview` and `outcome`. The guideline is done only when no outcome is `pending`.

## The rule that shapes everything: adjudication is QA, not a gate

Every stage ends in a **fork**: the agent goes on to the next stage while a
person adjudicates the last one.

```
stage n (agent) ──┬──► stage n+1 (agent)          keeps going
                  └──► adjudicate stage n (human)  runs beside it
```

1. **Every stage is adjudicated, and the guideline is not done until every
   adjudication is recorded.** Not waiting is not skipping.
2. **An asset built on unadjudicated input says so.** Each derived KG node
   names its inputs in `wasDerivedFrom` (hash-pinned;
   `smart-base/L1/schemas/graph.ts`); the edge's open `properties` carry
   `adjudication: pending` until the input's review closes.
3. **A rejection reopens the stage, and the flag spreads downstream.** A
   `request-changes` or `reject` decision files a bean against the stage.
   Every asset derived from the rejected item gets
   `adjudication: rejected-upstream` on that edge and is re-derived when the
   stage is redone, not deleted ahead of time: the re-derivation may come out
   the same.
4. **The agent never adjudicates.** It may prepare the review material; the
   verdict is recorded by the person in the role the stage table names.

## The order is a rule: L1, then L2, then L3

QA-not-a-gate is about verdicts. It never licenses skipping a stage.

1. **Each stage's output exists before the next stage starts.** Stage 2
   writes the L1 extraction for every source of the use case; stage 4 writes
   the L2 assets; only then does stage 6 write FSH, CQL or any other L3
   file. Source documents (a schedule poster, a slide deck) are stage-2
   input, never direct input to L3.
2. **Sign-off is requested before the next stage starts.** Each asset's
   review item (`Process_Review`) is opened, staged and handed to its
   adjudicating role. The verdict is not awaited, but an asset whose review
   was never requested has not finished its stage.
3. **Every L3 asset names the L2 asset it implements**, and every L2 asset
   the L1 node it rests on, in `wasDerivedFrom` with the edge's
   `adjudication` state. An L3 asset with no L2 upstream is a finding, even
   with a green build and passing tests.
4. **A request that skips stages is still this process.** "Adapt X to
   <country> using these documents" is stages 0–6. If the request names no
   L1/L2 work, the agent does it anyway and says so.

A new repository carries a pointer to this skill and a platform mount
([`smart-guideline-create`](smart-guideline-create.md) §6).

In [`l2-dak-authoring.bpmn`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/collab/processes/l2-dak-authoring.bpmn)
the **Clinically accurate?** decision runs beside assembly: a parallel fork
after the authoring join starts clinical validation and assembly together.
`changes needed` sends the work round again, re-assembling the DAK;
`validated` ends in its own event.

## The stages

Each stage's **Out** is the next stage's **In**, under the same name and
definition in each standalone contract. The two stages run by other layers'
skills are called through the mapping in their row.

| # | stage | skill | In | Out | adjudicated by |
|---|---|---|---|---|---|
| 0 | Describe the use case | [`guideline-use-case`](guideline-use-case.md) | the `request` | `useCase` | (the requester *is* the source) |
| 1 | Identify L1 guidelines and recommendations | [`dak-l1-library`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/dak-l1-library.md) | `useCase` | `l1Sources`: each candidate in-library / in-kg / not-yet, included or not, and why | Clinical SME |
| 2 | Ingest into an L1 KG the sources not yet in one | [`recommendation-extraction`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/recommendation-extraction.md) (after `bun run cat ingest` and `dak-l1-library`'s generic-document layer for a source not in `library/`) | `l1Sources` | `l1Kg`: per source, `library/<bib>/l1-extraction/`, coverage, every `WARNING` | `l1-extraction-reviewer` (exclusions, coverage), Clinical SME (recommendations) |
| 3 | Choose L2 dependencies (WHO / jurisdiction DAKs) | [`l2-dependency-choice`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/skills/smart-l2/l2-dependency-choice.md), with [`smart-base-tools`](smart-base-tools.md) §*Adapting a DAK* for how each candidate produces each component | `l1Kg` | `l2Dependencies`: one decision row per candidate DAK, and per component the `toolchain` stage 4 will use | Programme manager + Business analyst |
| 4 | Create or adapt the L2 DAK assets | [`l2-dak-authoring`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/skills/smart-l2/l2-dak-authoring.md), once per component, with the stage-3 `toolchain` ([`smart-base-tools`](smart-base-tools.md)), in the steps of [`l2-dak-authoring.bpmn`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/collab/processes/l2-dak-authoring.bpmn), each an edit-then-review call into [`l2-component-edit-review.bpmn`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/collab/processes/l2-component-edit-review.bpmn); pre/post-processing by [`dak-preprocessing`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/skills/smart-l3/dak-preprocessing.md) / [`dak-postprocessing`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/skills/smart-l3/dak-postprocessing.md) as smart-base's overlay on fhir-harness's AST cache refresh | `dakComponent`, `sourceGuideline`, `l1Kg`, `l2Dependencies` | `artifacts` of every pass, which are `l2Assets` | per asset, see [Per-asset review](#per-asset-review) |
| 5 | Choose L3 dependencies (WHO / jurisdiction IGs) | [`l3-dependency-choice`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/skills/smart-l3/l3-dependency-choice.md), indexing with [`ig-artifact-ingestion`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/skills/smart-l3/ig-artifact-ingestion.md), with [`smart-base-tools`](smart-base-tools.md) §*Adapting a DAK* for how each candidate builds and tests its CQL and examples | `l1Kg`, `l2Assets`, `l2Dependencies` | `l3Dependencies`, and per artefact type the `toolchain` stage 6 will use, and the IG `indexes` | FHIR modeller + Terminologist |
| 6 | Produce the L3 assets, only once `Gateway_L3Ready` says yes on [`l3-readiness`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/skills/smart-l3/l3-readiness.md) ([the order rule](#the-order-is-a-rule-l1-then-l2-then-l3)) | fhir-harness `l3-fhir-authoring` with `l2-dak-authoring` and the stage-5 `toolchain`, in [`dak-l3-ig.bpmn`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/collab/processes/dak-l3-ig.bpmn), up to a clean IG build | per artifact: `artifactType`, `sourceModel` = an `l2Assets` path; the adjudicated `l3Dependencies` rows become `sushi-config.yaml` dependencies | `fshFiles`, `sushiResult`, `generatedResources`, read as `ig` with its `igRoot` | per asset, see [Per-asset review](#per-asset-review) |
| 7 | L4: describe the consuming application | [`l4-application-brief`](https://github.com/litlfred/smart-base/blob/main/smart-base/L4/skills/smart-l4/l4-application-brief.md) | `useCase`, `l2Assets`, `ig` | `applicationBrief`, and the `wireframeRequest` | (the requester *is* the source) |
| 8a | L4: wireframe the application | cat-harness `wireframe-design-review`, design use | `wireframeRequest`, unchanged | the candidates and the choice, read as `wireframes` | Business analyst + Clinical SME, with the requester choosing |
| 8b | L4: build the consuming application | [`l4-application-build`](https://github.com/litlfred/smart-base/blob/main/smart-base/L4/skills/smart-l4/l4-application-build.md) | `applicationBrief`, `ig`, `wireframes` | `application`, with its conformance and scenario tests | Business analyst + Clinical SME (does it do what the L2 says?), FHIR modeller (does it conform to L3?) |

Between stages 5 and 6, `Task_L3Ready` runs [`l3-readiness`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/skills/smart-l3/l3-readiness.md)
(in: `l1Kg`, `l2Assets`, the `reviews` requested and the L3 artefacts about
to be written; out: `ready` and the `findings`), and `Gateway_L3Ready`
decides on it. *No* goes back to stage 4.

Publication of the IG (the end of `dak-l3-ig.bpmn`) is not on the path to
stage 8: an application can be built against an unpublished IG.

Every adjudication calls cat-harness's generic review, `Process_Review`
(`processes/content/review-task.bpmn`), which runs the review that fits the
change and accepts or sends back; disagreement goes to
`Process_Adjudication`.

### Staging: every review looks at a staged preview

Each stage commits to the guideline's feature branch, which
[`feature-staging`](https://github.com/litlfred/cat-harness/blob/main/skills/sdlc/sdlc-core/feature-staging.md)
(`Process_FeatureStaging`) stages on the site its section *Which site*
names: a guideline in its own repository on that repository's Pages,
smart-base itself by a staging re-pin on folio-assistant's site. An IG
repository's site needs its AST cache seeded first
([`fhir-ig-create`](https://github.com/litlfred/fhir-harness/blob/main/skills/fhir-ig-base/fhir-ig-create.md),
`new-repo` step 5).

The IG Publisher's `branches/` preview (`ghbuild.yml`, `/deploy`) is never
the preview for this content. A review item links to the staged page through
`staging-review`, which returns **before** (main) and **after** (staging)
URL pairs. A new guideline with no repository yet is
staged inside the current one first (`in-repo`, a staged sub-KG, the
[`smart-guideline-create`](smart-guideline-create.md) default).

## Per-asset review

Every asset a stage **creates or changes** gets its own review item; one
reused unchanged gets none. The review item shows the asset on the staged
preview the way its reviewer reads it, not as source. At L2 it is a run of
[`l2-component-edit-review.bpmn`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/collab/processes/l2-component-edit-review.bpmn),
whose [skill](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/skills/smart-l2/l2-component-edit-review.md) gives each row's checker,
renderer and reviewer:

| level | asset | review shows |
|---|---|---|
| L1 | recommendation / remark / practice | the node beside the printed sentence and page |
| L2 | persona, user scenario | the card: role, goal, setting |
| L2 | business process (BPMN) | the rendered diagram (`render:bpmn` / `dak-swimlanes`) |
| L2 | decision table (DMN) | the table (`dmn2html`), with the L1 recommendation each rule cites, and its test cases |
| L2 | core data elements | data-dictionary rows (`dak-data-dictionary`) and their term diff (`dak-data-dictionary-diff`), and the **chosen wireframe** of each form that captures them (see [Forms are designed as wireframes](#forms-are-designed-as-wireframes-at-l2)) |
| L2 | indicators, requirements | the indicator definition / requirement list, each with the persona and process it serves |
| L3 | Questionnaire | the L2 wireframe it was derived from, beside the Questionnaire's field ↔ item correspondence; this checks fidelity to the design, not the design again |
| L3 | profile, logical model | the IG Publisher's differential view |
| L3 | CQL / PlanDefinition | the logic beside the DMN rule it implements, and its test cases passing or failing |
| L3 | terminology | the expansion, and the mapping to ICD-11 / SNOMED CT / LOINC |
| app | screen / flow | the chosen wireframe beside the running screen, walked through the L2 scenario it serves |

### Forms are designed as wireframes at L2

A data-entry form is designed once, at L2, and the L3 Questionnaire is
derived from that design.

1. **Stage 4: design.** For each business-process activity where a persona
   records data, the agent runs `wireframe-design-review` in its **design
   use**, with intent from the L2 assets: the persona (who), the activity and
   its user scenario (what they do), and the core data elements it captures
   (what it shows). That gives two or more candidates, each with a web and a
   mobile layout, using real content: data-element labels, value sets and
   the DMN rules that show or hide a field. Each field carries the id of its
   core data element in a `data-element` attribute. The agent goes on with
   its recommended candidate; the review and the choice
   (`Process_Adjudication`, `Process_OptionsAnalysis`) are that form's
   stage-4 adjudication.
2. **Stage 6: derive.** The Questionnaire follows the chosen wireframe:
   one item per field, in its order and grouping, each item's `definition`
   pointing at the logical-model element of the same core data element, and
   `enableWhen` taken from the same DMN rules.
3. **Stage 6 review: fidelity.** fhir-harness's skill
   `fhir-questionnaire-wireframe` (`Process_QuestionnaireWireframeReview`)
   runs on each built Questionnaire with the chosen wireframe. Its check,
   `check-wireframe-questionnaire`, pairs the wireframe's `data-element`
   attributes with the items' `definition`s (or `code[].code`), per
   `data-layout`; a field with no item, an item with no field, or a
   different order is a finding:

   ```sh
   bun run fhir-harness/scripts/check-wireframe-questionnaire.ts <wireframe.html> <Questionnaire.json>
   ```

If the chosen wireframe changes later, the Questionnaire derived from it is
flagged `rejected-upstream`. A change request on either side (✍ suggest or
the `questionnaire-change` issue form) says which side was edited, and the
other is brought back in line (`fhir-questionnaire-wireframe`, step 7).

**An adaptation is reviewed as a diff.** When the asset came from a stage-3
or stage-5 dependency with `decision: adapt`, the review item shows
**before** (the upstream asset at its pinned version) and **after** side by
side, with the change highlighted and the L1 node that justifies it. At L3
the diff is fhir-harness's `ig-ast-delta` (element-level, per resource); at
L2 and for anything rendered, `before-after-preview` with a `DiffRenderer`
(`cat-harness-tools/schemas/ui/diff-renderers.ts`). A changed asset with no
L1 justification is a finding: the KG must say whether an adaptation is
local evidence or local policy.

The record of a review item is a cat-harness `QaReview` (`qa-review/v1`,
`cat-harness-tools/schemas/sdlc/qa-review.ts`): `subject` is the asset, and
each verdict is a `Decision` whose `role` is the adjudicator's role id:

| outcome | meaning here |
|---|---|
| `approve` | the asset stands |
| `request-changes` | reopen the stage for this asset. If the reviewer wrote the fix themselves, it goes in an `AuditNote` and the agent applies it as given |
| `reject` | the asset is wrong at the root (wrong source, wrong dependency). Reopen the stage that chose it |

At L1, `recommendation-extraction` keeps its `review: {by, at}` fields on
the mapping; the `QaReview` records the stage's review beside them.

## New guideline or adaptation: one process

An adaptation is this process with stages 3 and 5 returning `adapt`
decisions, so stages 4 and 6 show diffs. A new guideline is the case where
those stages return only `reuse`, `extend` or nothing.

## What it reuses

| need | reused from |
|---|---|
| each stage | the stage skills in [the table](#the-stages) |
| adjudication | cat-harness `Process_Review`, then `Process_Adjudication` on disagreement |
| review record and verdict | cat-harness `qa-review/v1`: `QaReview`, `Decision` (`approve` · `request-changes` · `reject`), `AuditNote` |
| who adjudicates | role ids `clinical-sme`, `programme-manager`, `business-analyst`, `fhir-modeller`, `terminologist`, `reviewer`, and smart-base's `l1-extraction-reviewer` |
| staged preview, before/after links | `feature-staging`, `staging-review` |
| diffs | `ig-ast-delta` (L3); `before-after-preview` with a `DiffRenderer` (L2, rendered pages); smart-base's `dak-data-dictionary-diff.ts` (data-dictionary terms) |
| form and app design | `wireframe-design-review`, design use; fhir-harness `fhir-questionnaire-wireframe` and `check-wireframe-questionnaire` for stage-6 fidelity |
| dependency row | `DependsOnRecord`, `DependsOnGap` and KG `evidence`, plus `decision`, `reason` and `toolchain` ([`l2-dependency-choice`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/skills/smart-l2/l2-dependency-choice.md)) |
| component tooling | the tools graph (`bun run cat check:tools`), the upstream repository's own scripts, WHO's DAK toolchain ([`smart-base-tools`](smart-base-tools.md)) |
| provenance flag | KG `wasDerivedFrom` edge `properties`, with the values `pending` and `rejected-upstream` |

## What this does not change

- The WHO DAK component set and L1–L4 layering: [`smart-stack-layering`](smart-stack-layering.md).
- How a new repository or IG is set up: [`smart-guideline-create`](smart-guideline-create.md).
  Run it before stage 4 if the guideline has no home yet.
- The persona-swimlane lifecycle (planning, QC, translation, publication) on
  the IG's [Authoring Process](https://worldhealthorganization.github.io/smart-base/authoring-process.html)
  page. This process says what goes *into* its phases 2a and 2b, and what
  comes before and after them.
