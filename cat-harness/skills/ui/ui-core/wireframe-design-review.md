---
name: wireframe-design-review
description: >
  Design a user interface (a page, a visualiser, a navbar) by the WireGen
  methodology: a written design intent, at least two mid-fidelity HTML
  candidates, each with a web AND a mobile layout, mechanical checks at both
  viewports, a blind per-criterion review, adjudication where reviewers
  disagree, and a recorded choice. Also how an EXISTING visualiser is
  wireframed as-is, so that every declared visualiser has a wireframe with a QA
  sidecar. Process: processes/ui/wireframe-design-review.bpmn. Called for
  Design use from CRDM (Process_CRDM_Requirements, Call_Wireframe) whenever a
  requirement changes a rendered surface, before anything is built.
input: schemas/skills/wireframe-design-review/input.schema.json
output: schemas/skills/wireframe-design-review/output.schema.json
uses-methodology:
  - wiregen
---

# Wireframe design review

Method: [`wiregen`](../../../methodologies/wiregen.md). Process: [`processes/ui/wireframe-design-review.bpmn`](../../../processes/ui/wireframe-design-review.bpmn).

## Where wireframes live

| use | directory |
|---|---|
| **As-is** | `<instance>/docs/wireframes/<topic>/`, in the layer that declares the visualiser: `cat-harness/docs/wireframes/<topic>/` for this harness's own pages, and a content layer's own `docs/wireframes/<topic>/` for a page it declares |
| **Design**, from a CRDM request | `docs/proposals/<slug>/wireframes/`, beside the request's proposal `docs/proposals/<slug>.md`: the candidates are **assets of the proposal**. When the proposal is filed (`git mv` to `docs/requirements/`, `crdm-requirements-workflow` (opt-in `cat-harness.sdlc`)), its asset directory moves with it in the same commit. |

Either directory holds:
- `intent.md`
- one HTML file per candidate
- `authors.json`, which reviewers are not shown
- `checks/`: screenshots and the checker's report
- `reviews/`: one file per reviewer

Each layer's `docs/wireframes/index.json` maps the visualiser refs that layer declares to the wireframe that covers each. `bun run cat check:wireframes` reads every such index in the checkout, writes the QA sidecar (`test/results/wireframes.qa-results.json`) and fails on any gap. A wireframe sits with its page because an index naming another layer's page reads as an undeclared ref wherever that layer is not mounted; another layer's wireframes are reported as `<instance>/<topic>`.

## Input and output

The contract is [`input.schema.json`](../../../schemas/skills/wireframe-design-review/input.schema.json) and [`output.schema.json`](../../../schemas/skills/wireframe-design-review/output.schema.json).

- **In:** the `use` (`design` or `as-is`), the `topic` (for CRDM, the proposal slug), the `surface`, and, from CRDM, the `requirements` that change it, the `proposal` path, the `humanReviewer` (requester or BA), the `channels` the candidates are shown in, and the `branch`.
- **Out — the renderings:** `assetDir`, `intent`, and one `candidates[]` entry per candidate: its `source` HTML path, its `screenshots.web` and `screenshots.mobile` paths (from `wireframe-check`), their `staging` deep links, its per-criterion `entries`, and its `outcome` with the `reason`. `chosen` names the candidate, who chose it and the comment that records it; it is absent until a person chooses.
- **Out — as changed assets:** `changedAssets[]` lists every wireframe file the branch adds, changes or removes (candidate HTML, screenshots, intent, reviews) in the record shape a staging preview's graph carries (`change`, `kind`, `title`, `before`, `after`, `source`, `pages` or `pagesUnknown`; `ChangedAsset` in cat-harness-tools `scripts/kg-changed-assets.ts`). The review therefore lists the drawings the same way it lists every other changed asset.
- **Out — staging links:** `stagingLinks`, the shape every request for feedback carries (`staging-review`), copied inline as `definitions.stagingLinks`.

## Two uses

| use | candidates | review |
|---|---|---|
| **Design**: a new or changed UI | at least two, compared blind | per-criterion, then adjudication, then options analysis |
| **As-is**: an existing visualiser, drawn as it renders on `main` | exactly one, marked `as-is` | the same criteria. A finding becomes a work item against the visualiser, not a redesign |

## 1. Intent

A few sentences: **who** the screen is for, **what they need to do**, and **what it must show**. For an as-is wireframe, the intent is read off the visualiser's own declaration and generator, not invented.

## 2. Candidates

- **Mid-fidelity HTML:** monochrome, **real content** from the graph it shows, semantic icons, and no placeholder text.
- **Web and mobile in every candidate**, through responsive CSS or two layouts. A candidate with one layout does not enter review.

## 3. Mechanical checks ([`wireframe-viewport-check`](wireframe-viewport-check.md))

```sh
bun run cat wireframe:check --use as-is --topic <topic> --surface <visualiser ref>
bun run cat wireframe:check --use design --topic <slug> --surface <surface>
```

The three flags are this skill's input. `--topic` picks the directory in the table above and every candidate in it (name candidates to check fewer; one outside it is refused), and the report goes to its `checks/`. `--use design` needs at least two candidates; `--use as-is` needs each marked `as-is` in its file name, and a `--surface` that is the topic or a ref `index.json` says it covers. The use, topic and surface are recorded in `report.json`.

This renders each candidate at web (1280×800) and mobile (390×844) sizes. It records `script` entries for *renders*, *no-overflow* and *no-placeholder*, each `pass` or `fail` with a note, and writes a screenshot per viewport. Any `fail` sends the candidate back to step 2.

## 4. Blind review, per criterion

Reviewers include at least one agent that did not author the candidate and one human. **For Design use called from CRDM, the human is the requester or the BA** who owns the request: the person who will accept the delivered feature chooses its design. They see the intent, the screenshots and the HTML, without the authors. For each criterion they record `pass`, `warn` or `fail`, with a reason:

| criterion | question |
|---|---|
| intent-fit | Does it do what the intent says, for the person it names? |
| web usability | Can the task be done at desktop width? |
| mobile usability | Can the task be done at phone width, by touch? |
| accessibility | Contrast, a non-colour channel, accessible names, keyboard, reading order |
| alternatives | Do the candidates differ in the ways that matter? (Design use only) |

There are no scores and no averages (`methodology-adoption`, Refusals).

## 5. Adjudication and choice

- When entries for one criterion disagree, call **`Process_Adjudication`**. The adjudication leads, the checker's entry is kept, and a dispensation needs its reason.
- The choice between surviving candidates is **`Process_OptionsAnalysis`**. Rejected candidates stay, each with the reason it lost.

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](../../authoring/content-lifecycle/feedback-deep-links.md).

## Showing it to the requester

Design use from CRDM ends in a person's choice, so the candidates must be in front of that person before implementation starts:

1. **Commit** the candidates, `intent.md`, `checks/` (screenshots) and `reviews/` under `docs/proposals/<slug>/wireframes/` **on the feature branch**, so `feature-staging` publishes them with the rest of the branch.
2. **Show** them where the requester will look, chosen from context: the conversation, the issue the request came from, the pull request, or more than one of these. Where it goes is a judgement ([`feedback-deep-links`](../../authoring/content-lifecycle/feedback-deep-links.md), point 5); every place chosen carries the same content: a short narrative of what each candidate does differently; branches/ deep links to each candidate's HTML (not the site root); and its web and mobile screenshots shown as images, not only linked. Say which could not be linked or rendered, and why.
3. **Ask** the requester or BA to choose, with the comparison (one row per candidate, from `A_CompareOptions`) and a recommendation, per [`interaction-modality`](../../conduct/conduct-core/interaction-modality.md) where it applies.
4. **Record** their choice in the proposal and in the output's `chosen`. An agent never chooses on their behalf. Implementation (CRDM Phase 6) builds against the chosen candidate, and the delivery summary links it beside the after-screenshot.

## Related

- [`theme-ui-review`](theme-ui-review.md): reviews the **ingested graphical assets** in their design, also at both viewports. At ingestion only; it does not review the built result.
- `adjudication`
- [`methodology-adoption`](../../process/process-core/methodology-adoption.md)
