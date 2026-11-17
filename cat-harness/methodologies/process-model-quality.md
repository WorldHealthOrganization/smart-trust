---
$schema: folio-methodology/v1
name: process-model-quality
title: Process model quality — what the comprehension and error research supports for BPMN
origin: >
  The process-model quality literature, chiefly Mendling, Reijers and van der
  Aalst, "Seven Process Modeling Guidelines (7PMG)", Information and Software
  Technology 52(2), 2010; its threshold study, Mendling, Sánchez-González,
  García and La Rosa, Journal of Systems and Software 85(5), 2012; and the
  guideline review of Avila et al., Business Process Management Journal 27(1),
  2021. The other sources below test single guidelines. Most are publisher
  copyright and RECORDED, not held: the library keeps their bibliographic
  record and structured notes, not their text.
evidence:
  - library/mendling-2010-7pmg
  - library/mendling-2012-thresholds-error-probability
  - library/avila-2021-process-modeling-guidelines-slr
  - library/mendling-2010-activity-labeling
  - library/leopold-2016-bpmn-quality-issues-industry
  - library/arxiv-2106.12880v1
  - library/figl-strembeck-2015-flow-direction-experiment
  - library/arxiv-2504-10971v1
  - library/reijers-2011-syntax-highlighting
  - library/zur-muehlen-recker-2008-how-much-language
applies-when: >
  A BPMN diagram is being written, reviewed or checked, and the question is
  which readability rules rest on evidence and how strong it is. It is the
  source behind the rules in the `bpmn-authoring` skill and the
  `diagram-quality` checks.

  Not for layout geometry the owner set as house style (fixed task size, text
  size, right-angle edges, loop-backs below the lane): those are policy, and
  this methodology does not claim evidence for them. Not for DMN tables (`dmn`).
---

# Process model quality

**What this adds.** The `bpmn-authoring` skill already states the rules. This
node says where each rule comes from and how strong its evidence is, so a rule
is not tightened or loosened on the strength of lore.

Two kinds of evidence appear below, and they answer different questions:

- **Error probability.** Large corpora of real models (EPCs mostly), checked
  for formal errors such as deadlocks. These predict whether a model is likely
  to be *wrong*, not whether it is easy to read.
- **Comprehension.** Experiments where people answer questions about models.
  These are smaller, often with students.

## Rule by rule

| Rule (`bpmn-authoring`) | Source | What was measured | Strength |
|---|---|---|---|
| Separate routing from work: a task never has two outgoing flows | `leopold-2016-bpmn-quality-issues-industry`; `arxiv-2106.12880v1` | Leopold: 585 industry BPMN models, 22% with deadlocks and 42% with multi-merges. PMCF: in 5 paired models, the explicit start event, end event, loop gateway and parallel gateway, and the subprocess version, each scored higher in comprehension than the implicit or flat version | Moderate |
| Keep it small; decompose large models | `mendling-2010-7pmg` (G7); `mendling-2012-thresholds-error-probability`; `avila-2021-process-modeling-guidelines-slr` | 7PMG G7: above 50 elements, error probability tends to exceed 50%. The 2012 ROC study on 2,003 EPCs puts the cut at 31 nodes (AUC 0.84). Avila rates size limits as strongly supported | Strong for error probability; the house 20 is style |
| One start event per process level | `mendling-2010-7pmg` (G3); `mendling-2012-thresholds-error-probability` | 7PMG G3 asks for one start and one end. The 2012 thresholds allow up to 2 of each | Moderate. Several named end events are a house choice the evidence tolerates up to 2 |
| No inclusive (OR) gateways | `mendling-2010-7pmg` (G5); `avila-2021-process-modeling-guidelines-slr` | OR-splits and OR-joins raise error probability | Strong. Enforced at load |
| Gateways either split or join, not both | `mendling-2010-7pmg` (G4); `avila-2021-process-modeling-guidelines-slr` | G4: model as structured as possible, each split matched by a join of the same type. Avila rates block-structuredness as strongly supported | Indirect: a mixed gateway is one way to break that structure |
| Verb-object activity labels | `mendling-2010-activity-labeling`; `mendling-2010-7pmg` (G6) | 29 students rated 12 labels. Verb-object labels were judged ambiguous least often (0.13 against 0.24 and 0.45) and as most useful. Speed and accuracy were not measured | Weak. Reported, never gated |
| Use a small part of the notation | `zur-muehlen-recker-2008-how-much-language` | 126 real BPMN diagrams use about 9 distinct constructs each; 9 of the 50 BPMN 1.x constructs were never used | Descriptive |

## What the evidence does not support

- **A mandated flow direction.** Figl & Strembeck 2015 (`figl-strembeck-2015-flow-direction-experiment`,
  44 students, 4 directions) found left-to-right most accurate (92% against
  79% for right-to-left), but the difference was not significant at that
  sample size; the authors' power analysis asks for 270. Avila's review and the
  visualisation review (`arxiv-2504-10971v1`) support a *consistent*
  direction. So: keep one direction per diagram, left-to-right by house
  choice, without claiming it reads faster.
- **Colour as a rule.** Reijers et al. 2011 (`reijers-2011-syntax-highlighting`,
  68 people) coloured matching split and join gateways. Novices answered more
  questions correctly (78% against 67%); experts were no more accurate but
  about 15% faster. That supports optional highlighting of gateway pairs, not
  a fixed palette.
- **A word cap on labels and a gateway fan-out cap of 4.** No source above
  states either. The nearest numbers are the 2012 study's average connector
  degree of 3 and Avila's gateway degree of 5, both from error-probability
  work.

## Refusals

- **Do not quote an error-probability threshold as a readability result.**
  31 and 50 predict formal errors in a model, not reading time.
- **Do not cite a source for a number it does not state.** Each number above
  is in the entry's notes with its page; check there before adding one.
