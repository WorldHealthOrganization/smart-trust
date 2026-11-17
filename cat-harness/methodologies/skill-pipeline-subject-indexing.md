---
$schema: folio-methodology/v1
name: skill-pipeline-subject-indexing
title: Skill-pipeline subject indexing — one policy-grounded stage per cognitive step, each output inspectable
origin: >
  Eric H. C. Chow, "A Skill-Based Agentic Pipeline for Library of Congress
  Subject Indexing" (arXiv:2605.03537v1), School of Humanities, The University
  of Hong Kong. Open access, ingested whole and read before this node was
  written. The method is rendered from that paper alone. Two parallel tracks,
  both entrants in SemEval-2025 Task 5, were ingested beside it and read so
  that §"The parallel tracks, and why they are not this node" rests on the
  papers and not on how Chow summarises them: Suominen, Inkinen & Lehtinen,
  "Annif at SemEval-2025 Task 5: Traditional XMTC augmented by LLMs"
  (arXiv:2504.19675v2), National Library of Finland; and Bayrami Asl Tekanlou
  et al., "Homa at SemEval-2025 Task 5: Aligning Librarian Records with
  OntoAligner for Subject Tagging" (arXiv:2504.21474v1).
evidence:
  - library/arxiv-2605.03537v1
  - library/arxiv-2504.19675v2
  - library/arxiv-2504.21474v1
applies-when: >
  **Assigning terms from a closed, rule-governed controlled vocabulary to a
  work: deciding what it is about and saying so in the vocabulary's own
  authorised form.** Use it when the vocabulary comes with a written policy
  manual (LCSH has the Subject Headings Manual; MeSH, AAT and FAST are the
  source's own named candidates) and an authority file that can be queried,
  and a wrong but plausible term would be acted on in cataloguing, retrieval
  or linking. It answers *how to produce the assignment*. It does not answer
  *how to tell whether an assignment is good*: that is
  `consensus-grounded-subject-evaluation`, which is a parallel node and is not
  folded into this one. Not for choosing between options (`kepner-tregoe`), a
  recurring decision rule (`dmn`), or making a model emit a rule instead of a
  result (`hybrid-llm-deterministic`); §"Against hybrid-llm-deterministic"
  explains why the last is a separate method and not this one's parent. Not
  for free keywording with no vocabulary to validate against, because the
  authority step is what the method rests on.
---

# Skill-pipeline subject indexing: decompose the cataloguer's stages and validate each

**Adopted 2026-09-26** (work item `0js9`). All three sources were ingested through
the library pipeline, and the primary was read whole before this node was
written.

## The load-bearing idea, in one sentence

> **Prior systems found the right topics and still got the headings wrong. The
> failures were in applying the rules, and a single prompt gives rule
> application nowhere to happen.**

The source reviews the earlier LLM studies and states the diagnosis directly
(its section "Present Contribution"): the documented accuracy failures *"are not
primarily failures of topic identification — they are failures of rule
application"*. The models *"produce unauthorized heading forms, omit required
subdivisions, use deprecated subfield practices, and fail to verify headings
against authority files"*, and every prior study *"treats subject assignment as
a single-step task"*.

The remedy is structural. A professional cataloguer works through distinct
stages, so the pipeline gives each stage its own skill, and each skill passes a
**structured intermediate output** to the next. The source's own framing is *"an
externalized, architecturally enforced form of chain-of-thought reasoning"*: the
intermediate outputs are *"inspectable and correctable at each step before
proceeding to the next"*, and that is what a single prompt *"cannot"* provide.

## The four stages, as the source defines them

Section "The Four-Skill Pipeline" and its Figure 1. Each stage names the policy it encodes, which is the point:
**every stage is small enough to be checked against its own source document.**

| # | stage | receives → emits | what it encodes |
|---|---|---|---|
| 1 | **Conceptual analysis** | title, abstract, table of contents → an aboutness statement and a flat list of candidate concepts, each justified | Wilson's four methods of subject determination (purposive, figure-ground, objective, cohesion), Langridge's three questions, the Joudrey–Taylor framework, via Holley & Joudrey's review |
| 2 | **Quantitative filtering** | concept list → an *ordered* list of candidate headings, each with its intended MARC field | SHM H 180: the 20 % rule, the rule of three, specificity, depth of indexing; H 80: order by predominance; the 2026 LC genre/form policy |
| 3 | **Authority validation** | candidates → authorised forms, with variants redirected through their UF references | a local index over the LCSH and LCGFT authority files; a live query against LCNAF for names; H 830 for geographic subdivision |
| 4 | **Field synthesis** | validated headings → MARC 21 6xx fields | H 1075 subdivision order, H 830 indirect geographic subdivision, H 405 and H 430 for name headings, J 105 and J 110 for genre/form |

Two design choices inside the stages are part of the method, not details:

- **Stage 1 over-generates on purpose.** The source: *"The skill intentionally
  over-generates at this stage — filtering is deferred to Skill 2."* Recall is
  one stage's job and precision is the next stage's. A stage 1 that filtered as
  it went would be doing stage 2's job with none of stage 2's rules.
- **Authority validation is a lookup, not a judgement.** Stage 3 asks whether
  each candidate exists as an authorised form in the file. It does not ask the
  model whether the candidate looks authorised. That makes it the one stage
  whose output is deterministic given its input.

## How the skills were made: the construction discipline is part of the method

Section "Source Material and Skill Construction": each of eleven LC policy documents and one review article was *"read in
full and its normative content — rules, exceptions, decision criteria, and
worked examples — was translated into structured instructions"*. The resulting
skills *"are not simply prompts; they are multi-section documents that define
terminology, enumerate decision steps, specify output formats, and include
validation checks."*

This is what makes the method survive a change of vocabulary. The pipeline shape
stays fixed, and moving to another vocabulary means re-reading that vocabulary's
policy manual into the same four stages. The source names MeSH, AAT and FAST as
the next candidates. **A stage whose instructions cannot be traced back to a
clause in the vocabulary's own policy is not this method.**

## What it refuses

- **Never go from the work to the finished fields in one pass.** That is the
  failure the method exists to correct.
- **Never rely on the model's internalised knowledge of the vocabulary.** The
  source contrasts itself with single-prompt approaches on exactly this point:
  it *"explicitly encodes SHM rules at each stage rather than relying on the
  model's internalized knowledge of LCSH conventions"*.
- **Never emit a heading that stage 3 did not find in the authority file.** If
  a validator is never allowed to say no, the stage is only there for show.
- **Never ship the output as final.** The source's conclusion: the output
  *"would serve as a draft for review by a subject cataloger rather than as a
  final product, consistent with the human-in-the-loop workflow advocated
  throughout the literature"*.
- **Never read a difference from an existing record as an error.** The source's
  baseline records *"may reflect subject indexing decisions made years or
  decades ago — potentially under different LC policies"*. Its largest
  systematic difference, genre/form in 655 fields rather than as `$v`
  subdivisions, is the pipeline applying the *current* policy correctly.

## The parallel tracks, and why they are not this node

`methodology-adoption`: parallel tracks are recorded, not blended. Two ingested
sources take a different route to the same task. Each is recorded here as it
presents itself.

**Trained extreme multi-label classification, with LLMs in support (Annif,
arXiv:2504.19675v2).** A toolkit of XMTC backends is trained on catalogued
records, and its suggestions are merged by ensemble. Omikuji uses partitioned
label trees; MLLM does lexical matching; XTransformer is a fine-tuned
transformer. Language models are used *around* the classifier and do no
classifying themselves: they translate records between languages and generate
synthetic training records. It placed first in the task's all-subjects
quantitative ranking. **It needs a large body of already catalogued records to
train on.** Chow names this as the line: the skill pipeline *"does not require
training data or corpus-level pattern learning"*. Use Annif's track where that
corpus exists and the vocabulary's policy is not written down in a form a
stage could encode.

**Retrieve, then let a model judge each candidate (Homa / OntoAligner,
arXiv:2504.21474v1).** Subject indexing is recast as ontology alignment: embed
the record, retrieve the top 30 subjects by cosine similarity, and ask a small
fine-tuned model whether each one matches. The authors report that recall held
up and precision did not: *"the system retrieves a broad set of candidate
subjects, but many are not relevant"*. The retrieval step does real work.
**What this track lacks is any stage that applies the vocabulary's rules:**
nothing in it filters by policy, orders by predominance, or constructs a
subdivided heading. For a flat vocabulary that may not matter. For LCSH, it is
exactly the gap Chow diagnoses.

Neither is refused as wrong. They answer the same question under different
conditions, and which one applies depends on the context. Composing them into
"Annif's candidates, filtered by Chow's stage 2" would be a house method that
cites nobody.

## Against `hybrid-llm-deterministic`

These are parallel nodes, and the difference is worth stating because the two
look alike. `hybrid-llm-deterministic` has the model emit a **rule** that
machinery then executes. The model never touches the data at scale, because a
generated result would have to be checked item by item. This method has the
model emit **results**, the headings themselves, and checks each one.

That is sound here, and it is sound for a reason the other node does not
cover: **checking a result costs one authority-file lookup when the answer
must come from a closed, enumerable vocabulary.** The expensive per-item
verification that the rule/result inversion avoids becomes a membership test
here. Where results come from an open space, that argument fails and
`hybrid-llm-deterministic` is the node to reach for.

## Where this rendering stops

`methodology-adoption` step 2 requires both halves, so both are given here.

**Adopted:** the diagnosis (rule application, not topic identification); the
decomposition into four stages, each with a structured output; the
over-generate-then-filter split; authority validation as a lookup; the
construction discipline of reading each policy document into a stage; and the
refusals above.

**Not adopted, and deliberately:** every tool in the paper. Claude Code, its
skill file format, the local TF-IDF index over NDJSON dumps from `id.loc.gov`,
the LC `suggest2` API, and MARC 21 as the output encoding are one
instantiation. The owner's instruction on ingesting a tool paper, 2026-09-23:
*"do not need to match tools in paper, start with process, determine most
appropriate tools (known or which can be added)."* The same holds for the
specific LCSH rules: they are the *content* of stages 2–4 **for LCSH**, and
another vocabulary's policy supplies its own.

**Not assessed:** the source's evaluation is ten titles, one or two per
discipline, compared with existing Harvard records along four dimensions. The
source calls the comparison *"interpretive rather than strictly quantitative"*
and says ten comparisons *"are insufficient for statistical generalization"*.
**No claim about how well this method performs rests on this node.** It also
cites a 26–35 % alignment figure for single-prompt approaches from Tang & Jiang
(2025). That paper is not ingested here, so the figure is second-hand and is
not repeated as a finding.

**Named by the source as open, and left open here:** under-subdivision
(geographic `$z` and chronological `$y`), choosing among overlapping authorised
headings, the missing step of consulting peer records for the same ISBN, and
overlapping population groups in conceptual analysis. These are the source's
own stated limitations (section "Limitations and Areas for Improvement"). They are listed so that a skill built on this
node does not rediscover them.

## How this platform applies it

**It does not apply it yet, and says so.** No skill here assigns controlled
vocabulary terms. Library entries produced by the L1 ingest (epic `slw1`)
carry structure, sections, images and labels, but no subject field. This node
exists so that the day one is added, the method is chosen by adoption and not
improvised. A skill that implements it names this node and does not restate it.
