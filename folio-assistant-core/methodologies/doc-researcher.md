---
$schema: folio-methodology/v1
name: doc-researcher
title: Doc-Researcher — parse for multiple granularities, then research iteratively against a sufficiency threshold
origin: >
  Kuicai Dong, Shurui Huang, Fangda Ye, Wei Han, Zhi Zhang, Dexun Li, Wenjun
  Li, Qu Yang, Gang Wang, Yichao Wang, Chen Zhang and Yong Liu, "Doc-Researcher:
  A Unified System for Multimodal Document Parsing and Deep Research"
  (arXiv:2510.21603v1, Huawei Technologies, 24 October 2025). Open access.

  THE PRIMARY IS HELD AND PROMOTED, at `library/arxiv-2510.21603v1`, which is
  what `evidence:` below points at. It was staged and unpromotable for a day:
  the extractor reported **383** images, 335 of them on page 3, and its
  `image-descriptions` requirement could not be met. It holds **fifty**. See
  §"What this checkout holds" — the first reading of those 383 was wrong, and
  the correction is kept there rather than tidied away.

  It is a SYSTEM paper reporting one implementation against a benchmark its own
  authors built, so what is adopted below is the METHOD, and §"Where this
  rendering stops" says which parts were left behind.
evidence:
  - library/arxiv-2510.21603v1
applies-when: >
  **A question must be answered from documents this folio has ingested, and one
  retrieval pass will not do it.** Use it when the answer is spread across
  several documents, or across text and figures within one, or when the asker
  will follow up. It answers *how to search a corpus you already hold*, never
  *what to hold* — `library-ingestion` and the L1 completeness gate answer
  that, and this method assumes their output.

  Do NOT reach for it for a single lookup in a known document. The loop below
  costs iterations, and a method whose cheapest path is more expensive than
  reading the page is the wrong method.
---

# Doc-Researcher

Two modules, and the paper's own claim is that the second cannot work without
the first: *"effective document research requires not just better retrieval,
but fundamentally deep parsing that preserve multimodal integrity and support
iterative research."*

## 1 — Parsing produces FOUR granularities, not one

The part worth taking, and the part this checkout is furthest from.

A document is parsed once into layout elements — text, table, figure, equation
— each carrying its page and bounding box. Then it is assembled at **four**
levels: `chunk` (layout-aware merges within section boundaries), `page` (all
elements of a page, or its raw screenshot), `full` (everything), and `summary`
(an LLM summary of the full text).

**The four exist so that a later step can CHOOSE.** That is the whole
mechanism: a broad question is answered from summaries, a specific one from
chunks, and the choice is made per query rather than fixed by the pipeline.
A corpus parsed at one granularity has made that choice for every question in
advance.

Visual elements are converted to text **once**, at parse time, rather than on
every retrieval — tables and figures to both a coarse summary and a fine
description, equations to LaTeX. The paper's reason is cost, and it is worth
restating as a design rule: *a conversion that will be needed many times is
done at write time.*

## 2 — Research is four roles and a sufficiency threshold

| role | what it does |
|---|---|
| **Planner** | filters the corpus against document summaries, picks the granularity, and decomposes the question into sub-queries |
| **Searcher** | retrieves for one sub-query at the chosen granularity |
| **Refiner** | deduplicates and filters what came back to what is actually relevant |
| **Reporter** | synthesises the accumulated evidence, with citations to page and bounding box |

The loop is `Search → Refine → Evaluate`, and **it is the evaluation that makes
it a method rather than a habit**: a sufficiency measure σ over everything
accumulated so far, against the original question, with the loop continuing
until `σ ≥ τ` or `t = T_max`. Sub-queries are re-derived each iteration rather
than fixed at the start.

**Both stopping conditions are load-bearing.** Threshold alone never
terminates on a question the corpus cannot answer; iteration cap alone stops an
answerable question early. A loop with only one of them is a different and
worse method.

## What the paper measured, and what it did not

**Measured**, on M4DocBench — 158 expert-annotated questions over 304
documents, built by the same authors: 50.6% accuracy, which they report as
3.4× the best baseline they tried. Planner filtering reduced the search space
by 60–80% "while maintaining high recall".

**Not measured, and it matters for adoption here:** the benchmark is the
authors' own, so the headline ratio compares their system against baselines on
ground they chose. 50.6% is also the absolute number — on a benchmark built to
be answerable, roughly half the questions are not answered correctly. Neither
observation makes the METHOD wrong; both make "3.4×" the wrong thing to quote,
and this node quotes the structure instead.

## What this checkout already does, and where it differs

`methodology-adoption` §"Extract the PROCESS, not the paper's tools" requires
this comparison before any tool is proposed. Read from the pipeline, not
assumed:

| the method asks for | this checkout has | gap |
|---|---|---|
| layout-aware parse with page + bbox provenance | `pdf-structure.py` → `structure.json`, images placed with page ids | **none of substance** |
| visual elements described once at parse time | `pdf-images.py` + the image-verdict and narrative state machine, where an agent drafts and only a person confirms | **stricter here**, deliberately — see below |
| four granularities `{chunk, page, full, summary}` | `l1-blocks.ts` produces **blocks**; sections exist; no `summary` level and no per-query granularity choice | **the real gap** |
| retrieve text-only / vision-only / hybrid | not modelled | open |
| Planner / Searcher / Refiner / Reporter with a sufficiency threshold | not modelled as a process | **the second real gap** |

**Where this checkout is STRICTER, and should stay so.** The paper generates
figure descriptions with a VLM and uses them. Here, a description an agent
wrote is a `draft` and only a person may confirm it, because — in
`apply-image-verdicts.ts`'s words — *"an uncited narrative is indistinguishable
from a transcription of the source, and the two have very different
standing."* Adopting the method must not quietly adopt machine descriptions as
fact. The four-granularity idea is separable from that and is what is worth
taking.

## What this checkout holds, and what it does not

The paper is at `library/arxiv-2510.21603v1` and **promoted**, L1 complete: 24
chapters read from the embedded outline, and fifty images each carrying a
description drafted from inspection. `evidence:` points at it.

**It took a day and a correction to get there**, and the correction is the part
worth reading.

## CORRECTED 2026-09-24 — the first reading of those 383 was wrong

This section said the 383 were *"fragments of one composite architecture
figure"*, *"many byte-identical in size"*, and that writing 383 descriptions
*"would be the fabrication `document-image.ts`'s inspection basis exists to
refuse."* **All three claims were wrong**, and they were wrong in the way that
matters: they were inferred from counts and file sizes rather than from looking
at the images.

Looking at them:

- They are **clip-art icons** — a newspaper, a picture placeholder, and so on:
  the icons the paper's Figure 1 uses to depict document types flowing through
  its pipeline. Distinct, meaningful, individually describable.
- **383 placements are 50 DISTINCT images** by content hash. Page 3's 335 are
  **22** distinct, each placed about fifteen times.

So the defect is not fragmentation of a composite. It is that the extractor
emits one entry per **placement** rather than per distinct image. And the
conclusion that followed from the wrong reading does not hold: describing 50
images is ordinary work, not fabrication. This document is promotable once the
duplicates are collapsed.

Bean `j820` carries the measurement across all 29 ingested documents, including
the same ratio in three other entries (`9789241509510-eng` 161→102,
`9789241511766-eng` 99→44, `arxiv-2312.07755v1` 84→28). It was a general
extractor defect with a mechanical fix, and issue #1234 shipped it:
`pdf-images.py` now emits one entry per distinct image, keyed on the PDF's own
`xref`, with every placement recorded in `placements[]`.

**Each of the fifty was then opened and described.** Four are `logo` — the
Word, PowerPoint, Excel and Wikipedia marks, stock glyphs rather than content
the authors drew. Every narrative is a `draft`: only a person may confirm one,
which is the rule this node argues for two sections above.

**Why the wrong reading is left on the record rather than deleted.** It is the
exact failure this node warns about two sections above, committed by the node
itself: a description asserted from measurement rather than from inspection.
Two file reads falsified it. That is worth more as a worked example than as a
clean paragraph.

## Where this rendering stops

- **No implementation is adopted.** MinerU, Qwen2.5-VL and UniMERNet are the
  paper's tools, not obligations; `methodology-adoption` is explicit that the
  process is extracted and the tools chosen separately.
- **M4DocBench is not adopted.** A benchmark of 158 questions over somebody
  else's 304 documents measures their corpus, not this one.
- **The retrieval paradigms are recorded, not chosen.** Text-only, vision-only
  and hybrid are a real trade-off, and nothing here has measured which suits a
  folio corpus. Choosing one from the paper's numbers would be adopting a
  result obtained on other documents.
- **σ is not defined here.** The paper gives sufficiency a symbol and a
  threshold and does not say how it is computed. That is the load-bearing
  quantity in the whole loop, and this node will not invent one.
