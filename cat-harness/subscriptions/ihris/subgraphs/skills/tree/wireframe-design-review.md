---
name: wireframe-design-review
description: >
  Design a user interface by the WireGen methodology: a written design intent,
  at least two mid-fidelity HTML candidates each with a web and a mobile
  layout, mechanical checks at both viewports, a blind per-criterion review,
  adjudication where reviewers disagree, and a recorded choice. Process:
  processes/wireframe-design-review.bpmn.
input: src/schemas/skills/wireframe-design-review/input.schema.json
output: src/schemas/skills/wireframe-design-review/output.schema.json
---

# Wireframe design review

Method: [`methodologies/wiregen`](../../methodologies/wiregen/wiregen.md). Process: [`processes/wireframe-design-review.bpmn`](../../processes/wireframe-design-review.bpmn).

## 1. Intent

Write the intent in a few sentences: **who** the screen is for, **what they need to do**, and **what it must show**. Store it beside the candidates as `intent.md`. It is the criterion for *intent-fit*.

## 2. Candidates

- **At least two**, or state why only one exists.
- **Mid-fidelity HTML:** monochrome, real folio content (for the data-model site: real form classes, fields and lists from `src/*/data-model/`), semantic icons, and **no placeholder text**.
- **Web and mobile in every candidate**, through responsive CSS or two layouts. A candidate with one layout does not enter review.
- Candidates live in `docs/design/wireframes/<topic>/<candidate>.html`, named by letter. The author is recorded in a separate `authors.json` that reviewers are not shown.

## 3. Mechanical checks (Tool `ihris-wireframe-check`)

```sh
node src/tools/wireframe_check.mjs docs/design/wireframes/<topic>/*.html --out .build/wireframes/<topic>
```

This renders each candidate at web (1280×800) and mobile (390×844) and records `script` entries: *renders*, *no-overflow* and *no-placeholder*, each `pass` or `fail` with a note. It also writes a screenshot per viewport. Any fail sends the candidate back to step 2.

## 4. Blind review, per criterion

Reviewers (at least one agent and one human) see the intent, the screenshots and the live HTML, shuffled and without authors. They record `pass` / `warn` / `fail` with a reason for each criterion:

| criterion | question |
|---|---|
| intent-fit | Does it do what the intent says, for the person it names? |
| web usability | Can the task be done at desktop width? |
| mobile usability | Can the task be done at phone width, by touch? |
| accessibility | Contrast, a non-colour channel, names, keyboard, reading order. |
| alternatives | Do the candidates differ in the ways that matter? |

There are no scores and no averages.

## 5. Adjudication and choice

- When entries for one criterion disagree, call folio-assistant's `Process_Adjudication`. The adjudication leads, the checker's entry is kept, and a dispensation needs its reason.
- The choice between surviving candidates is `Process_OptionsAnalysis`. Every rejected candidate stays in the folder with the reason it lost.
- Revising the intent starts a new round, and the old round is kept.
