---
$schema: folio-methodology/v1
name: wiregen
title: "WireGen: wireframing from a written design intent"
origin: >
  Sidong Feng, Mingyue Yuan, Jieshan Chen, Zhenchang Xing and Chunyang Chen,
  "Designing with Language: Wireframing UI Design Intent with Generative Large
  Language Models", arXiv:2312.07755v1 [cs.HC], 12 Dec 2023. Ingested in full at
  `cat-harness/library/corpus/ui/arxiv-2312.07755v1/`. The source states no licence, and
  its licence could not be established (see `check:source-licence`).
evidence:
  - library/arxiv-2312.07755v1
applies-when: >
  Designing a USER INTERFACE, for example a page layout, a navigation scheme or a
  visualiser, where the choice between candidate designs has to be reviewed
  and, when reviewers disagree, adjudicated. It is a design-generation and
  design-evaluation method. It does not choose between non-UI options (use the
  decision-analysis methodology) or grade evidence. It does not by itself
  settle a disagreement: that is `adjudication`.
---

# WireGen: from a written intent to a reviewed, mid-fidelity wireframe

**Adopted in part, 2026-09-23, by the owner's direction.** In the owner's words: *"make methodology/utilize/integrate into existing processes. need both web and mobile layouts in usability reviews. wireframe is part of design process for adjudication"*.

**Integrated into CRDM, 2026-10-14.** `crdm-requirements-definition.bpmn` calls `Process_WireframeDesignReview` (`Call_Wireframe`) whenever a requirement changes a rendered surface, before anything is built; the candidates become assets of the request's proposal, and the requester or BA chooses one at `BA_ReviewReqs`. See [`wireframe-design-review`](../skills/ui/ui-core/wireframe-design-review.md).

**Placed in cat-harness** (owner, 2026-09-23: *"put wireframe in cat-harness, not folio-assist(-core)"*). The method is domain-neutral, and `methodology-adoption` §4 puts a domain-neutral method in the harness. It was first drafted in litlfred/ihris, and its first use was that folio's data-model site. Issue #1023.

## What the method says (rendered faithfully)

Section numbers below are the paper's.

1. **Design intent comes first, as language** (§3, §5.2). A short natural-language description of what the screen is for and what it holds.
2. **Mid-fidelity is the target** (§3.1.1). The wireframe is monochrome and simplified, but it carries **real content**, **semantic icons** and interactive elements, not boxes and placeholder text.
3. **HTML is the carrier** (§3.1.2, §3.3). The screen is expressed as a UI-specific HTML-like language. Raw output is post-processed against UI guidance: icons chosen by meaning, typography, and layout guidelines (§3.3).
4. **Evaluation is blind and comparative** (§4.3). Independent raters with design background see the description and a **shuffled grid** of candidates, without knowing which generator produced which. They mark candidates significantly better or significantly worse.
5. **Usefulness is asked separately** (§5.2): whether a wireframe is effective for inspiration, whether it relates to the description, and whether the candidates are diverse. These are rated on a 5-point scale.
6. **Refinement is iterative** (§6). Intent, then wireframe, then a revised intent, then a revised wireframe.

## What this platform adopts, and what it refuses

| | adopted | refused, with the reason |
|---|---|---|
| intent statement | **yes**: every candidate set starts from one, and it is the criterion candidates are judged against | none |
| mid-fidelity with real content | **yes**: real content from the folio (for iHRIS: real form classes, fields, lists) | none |
| HTML carrier + guideline post-processing | **yes**: wireframes are HTML, and the mechanical checks are the post-processing gate | none |
| fine-tuning an LLM on Rico / Screen2Words (§3.1, §3.2) | no | That is how the authors *generate*; it is not a review method. Candidates here may come from a person, an agent or any tool. The method applies to what they produce. |
| blind, shuffled comparison | **yes**: reviewers are not told a candidate's author | none |
| better/worse marks and Likert ratings | **the structure, not the arithmetic** | `methodology-adoption` refuses scoring and summing. A mean of Likert ratings reads as a measurement of a judgement. Reviewers record per-criterion `pass` / `warn` / `fail` with a reason. |
| mobile only (the paper's data is Android, §3.1.1) | **extended**: **both web and mobile layouts are required** in every usability review (owner, 2026-09-23) | The source's scope is narrower than our need. We state the extension rather than claim the paper supports it. |
| the reported numbers (77.5%, the user study) | no | They describe the authors' model and datasets. Nothing here depends on them. |

## How it plugs into existing processes

- **Review record:** each criterion gets entries from a `script` (the mechanical checks), an `agent` and a `human`, in `block-qa/v1` sidecars. This is folio-assistant's existing multi-reviewer primitive.
- **Disagreement:** when entries for one criterion disagree, the candidate set enters **`Process_Adjudication`** (`processes/process/adjudication.bpmn`). The adjudication leads, the checker's entry is kept, and the dispensation carries its reason.
- **Choice between surviving candidates:** a one-off choice, so it uses the decision-analysis methodology. Rejected candidates are kept with the reason they lost.
- **After build:** the rendered result does **not** go through `theme-ui-review.bpmn` any more. Theme and UI review moved to ingestion only, by owner ruling (work item `9fdi`, 2026-09-24): it runs when the graphical assets arrive, from `ingest-theme.bpmn`, and still requires both web and mobile layouts (#1023). A post-build visual look for a wiregen output is therefore not provided by that process — recorded so it is not assumed.

The executable form is [`processes/ui/wireframe-design-review.bpmn`](../processes/ui/wireframe-design-review.bpmn). The operating skill is [`wireframe-design-review`](../skills/ui/ui-core/wireframe-design-review.md). The mechanical checks are the Tool `wireframe-check`.

## Refusals

- **Never review a single candidate as if it were a choice.** The method is comparative; at least two candidates, or say why only one exists.
- **Never accept a wireframe reviewed at one viewport.** A web-only or mobile-only review is incomplete, not passed.
- **Never show a reviewer who made a candidate.** Blindness is the method's evidence of fairness.
- **Never let placeholder text through.** Lorem ipsum makes it a low-fidelity wireframe, and the method is about mid-fidelity.
- **Never average the ratings into a score.**
