---
$schema: folio-methodology/v1
name: consensus-grounded-subject-evaluation
title: Consensus-grounded subject evaluation — independent indexers as the answer key, and a panel instead of one score
origin: >
  Kwok Leong Tang, "LCSHBench: A Multilingual, Consensus-Grounded Benchmark
  for Library of Congress Subject Heading Assignment" (arXiv:2606.04382v1),
  2026. Open access, ingested whole and read before this node was written. The
  method is rendered from that paper. The parallel design it is contrasted
  with is the one used by the shared task the other ingested subject-indexing
  papers were entered in: D'Souza, Sadruddin, Israel, Begoin & Slawig,
  "SemEval-2025 Task 5: LLMs4Subjects — LLM-based Automated Subject Tagging for
  a National Technical Library's Open-Access Catalog" (arXiv:2504.07199v3),
  TIB Hannover. It was ingested and read too, so that design is described
  from its own text.
evidence:
  - library/arxiv-2606.04382v1
  - library/arxiv-2504.07199v3
applies-when: >
  **Judging how good a set of controlled-vocabulary assignments is, when
  qualified people would themselves disagree about the exact answer.** Use it
  to evaluate a subject-indexing system, compare two of them, or decide
  whether one is good enough to draft for a human reviewer. It is also for any
  labelling task whose gold standard is expert judgement with a subjective
  surface. It answers *how to measure*. It does not answer *how to produce the
  assignment*, which is `skill-pipeline-subject-indexing`, a parallel node.
  Not for certainty of evidence behind a recommendation (`grade`), and not for
  choosing among options (`kepner-tregoe`). Not applicable where the answer is
  decidable, meaning a single correct output a checker can verify, because
  then there is no disagreement for a consensus to absorb.
---

# Consensus-grounded subject evaluation: score against where experts agree, and read the panel

**Adopted 2026-09-26** (work item `0js9`). Both sources were ingested through the
library pipeline and read before this node was written.

## The load-bearing idea, in one sentence

> **Experts agree about what a work is about far more than about how to say
> it, so an evaluation must score those two layers separately. It must also
> take its answer key from where independent experts agree, not from one of
> them.**

The source makes this a measured premise rather than an assumption. Its
concordance study (section "Consensus ground truth") compares the headings that
three research libraries assigned independently to 465,187 works that all three
catalogued. It finds two layers. At the concept level (the heading's root,
before the first `--`), the three share a heading 93.3 % of the time and share
nothing 0.2 % of the time. At the exact, fully subdivided level, only 39.4 %
assign identical sets, and 35.6 % of all assertions come from just one of the
three. In the source's words: *"most disagreement is granularity — which
subdivisions, how specific — not topic"*.

Those figures are the source's measurements on its corpus. They are quoted
here as the reason for the design, not as constants this platform relies on.

## The method, as the source constructs it

**1. The answer key is a consensus of independent judges.** A work is admitted
only if at least two cataloguing agencies independently assigned headings. The
source enforces independence *"at the level of the cataloging agency (MARC field
040), not merely the holding library, so that a copy-cataloged record imported
from another institution does not count as a second judgement"*. The rule is
*"strict and never relaxed to enlarge the dataset"*.

**2. Disagreement is kept, not resolved.** Each heading carries a vote: the
number of judges who asserted it. Three answer views are released: per-judge
(the raw evidence), union (the default, which *"rewards finding any heading a
professional used"*), and unanimous (the strictest). **Every result states
which view it was scored against.**

**3. Provenance before validity.** A heading string can look valid in the
vocabulary and still come from somewhere else. The source keeps a heading only
when its record says it is from the target vocabulary. That removes *"most of a
quarter of candidate headings whose strings look like valid LCSH but whose
provenance is not — a distinction string-validity checks miss"*.

**4. Normalise before comparing.** NFC, lower-casing, a canonical subdivision
separator, collapsed whitespace, and no trailing period, *"so systems are judged
on substance, not typography"*.

**5. Two match modes, always both.** Every measure is computed under **exact**
match (the full subdivided heading) and **concept** match (the root only). The
gap between them is diagnostic: *"a high concept but low exact score means the
system found the right topic but not the authorised subdivided form — a
different, specifiable error from a topical miss"*.

**6. A panel, not a headline.** *"The central methodological commitment is that
no single number is trustworthy on its own."* Set metrics (micro and macro
precision, recall, F1) for generation; ranked metrics (recall@k, P@k,
R-precision, MRR) for retrieval; each under both match modes; and each broken
down by language and by heading type, which the source calls *"the panel's most
important safeguard"*.

**7. Never score what the system could not have reached.** Retrieval is scored
against the gold headings that exist in the retrieval vocabulary. The
reachability ceiling is reported explicitly. Records with no reachable gold are
excluded and counted, not scored as zero. *"So that a heading that cannot be
retrieved is never scored as a miss."*

**8. Stage-wise, where the system has stages.** Where a system retrieves,
reranks and then selects, each layer is scored separately. Recall at the first
stage is *"the ceiling for everything downstream"*. The source rejects a
frozen candidate pool because it *"would bake in an arbitrary retriever's
choices"*.

**9. Human agreement is a reference, not a ceiling.** One cataloguer reproduces
roughly 87 % (exact) or 93 % (concept) of their peers' consensus, so *"a
non-trivial share"* of a system's misses are headings a second cataloguer would
also have omitted. The source deliberately does **not** turn this into a recall
ceiling, because a ranked list of 200 and a short final set *"measure different
things"*.

## Why the panel is not optional: the source's own worked case

The source's section "The metric panel is necessary" shows a single aggregate
getting the answer wrong. Its fine-tuned embedder wins on exact recall@200, but
a hosted model wins on concept recall@200. The fine-tune wins on Korean, Arabic,
Japanese, Chinese and German, and the hosted model still wins on English and
Russian. *"A benchmark reporting a single aggregate F1 would have asserted a
clean victory and been wrong about its shape."* This is the case for step 6. It
is not a claim about either model, and this node makes no such claim.

## What it refuses

- **Never score against one indexer's record as though it were the truth.** A
  single library's headings make *"a noisy gold standard"*. The concordance
  numbers are the reason.
- **Never report one number.** Not a headline F1, not one match mode, and not
  an aggregate without the language and type breakdowns.
- **Never count an unreachable heading as a miss**, and never leave out the
  count of what was excluded.
- **Never treat a hashed or held-out answer set as contamination-proof.** The
  source is explicit that hashing over a finite public vocabulary is *"a
  speed-bump, not a guarantee"*, and that genuine control *"would require a
  private evaluation server"*, *"with residual risk reported, not assumed
  away"*.
- **Never compare results across vocabulary versions as though they were
  comparable.** The vocabulary and cataloguing practice change. The source
  versions and dates its benchmark for this reason, and notes that the change
  affects exact match more than concept match.

## The parallel design, and why it is not this node

`methodology-adoption`: parallel tracks are recorded, not blended.

**SemEval-2025 Task 5 (arXiv:2504.07199v3)** evaluates with a single catalogue
as gold: subject annotations by TIB's own subject specialists, 17 of them
across 28 disciplines. Its primary metric is recall, averaged over k from 5 to
50. It adds a **qualitative track** in which subject librarians label each
predicted subject as correct (`Y`), irrelevant but technically correct (`I`),
or wrong. That track is scored twice: once counting `Y` and `I` as correct, and
once counting only `Y`. The organisers note that their precision *"would never
amount to one"* at larger k, because records carry about five true subjects.

This is a sound design for its setting: a single institution, a
specialist team, and a shared task with a deadline. What it does not have is
steps 1 and 2 above. With one catalogue as gold, the concordance finding says
that a large share of "misses" at exact level would be headings another
professional would also have phrased differently. **The two-case qualitative
reading is the part of SemEval's design that LCSHBench does not yet have.**
LCSHBench lists *"the qualitative expert track"* among its deferred components.
Where this platform needs expert ratings, it uses SemEval's protocol **as
SemEval's**, cited as such. It is not grafted into the consensus method as
step 10.

## Where this rendering stops

`methodology-adoption` step 2 requires both halves, so both are given here.

**Adopted:** steps 1–9, the refusals, and the two-layer premise as the reason
for them.

**Not adopted:** the benchmark itself. Its corpus, its three source catalogues,
its answer hashing, its embedders and its fine-tuning recipe are one
instantiation for LCSH. The owner's instruction, 2026-09-23: *"start with
process, determine most appropriate tools."* Nothing in the method depends on
LCSH. A vocabulary without multiple independent indexers cannot supply step 1,
and that is a reason to say the evaluation is single-judge, not to pretend
otherwise.

**Not assessed:** the source's fine-tuning result. The source calls it
*"preliminary"*: it was run on a development subset, not the held-out test, and
at the first stage only. **No claim about any system's performance rests on
this node.** The concordance percentages quoted above are the source's
measurements, attributed as such, and nothing here uses them as parameters.

## How this platform applies it

**It does not apply it yet.** Nothing here assigns subject terms, so nothing is
evaluated this way. The nearest existing machinery is the QA-sidecar
discipline. It shares this node's refusals: never render "could not determine"
as clean, and never quote one number without its basis. That is agreement in
spirit, not an application, and it is recorded so nobody mistakes it for one.
