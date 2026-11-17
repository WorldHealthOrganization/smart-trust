---
# folio-assistant-b7wh
$schema: bean/1.0.0
title: INGEST arXiv:2607.14456v1 (specialist BPMN-compiled agents) as evidence + a skill on the processes subgraph
status: completed
type: task
priority: normal
created_at: 2026-09-23T22:25:37Z
updated_at: 2026-09-24T00:15:16Z
parent: folio-assistant-slw1
---

Owner, 2026-09-23: *"ingest into library for use as evidence and skills as
subgraph on processes in cat-harness"*.

Borman, Wandabwa, Yu, Kannangara, Liu, Leontjeva and Ng, **"Beyond Generalist
LLMs: Specialist Agentic Systems for Structured Code Workflow Execution"**,
Commonwealth Bank of Australia. Workshop paper at SCALE, ICML 2026 (PMLR 306);
arXiv:2607.14456v1 [cs.SE], 16 July 2026. Open access.

## Why this one is different from the others in this graph

It is not adjacent to what this repository does — **it is the same thing**. The
paper compiles BPMN 2.0 into a ReAct control graph where the control plane
enforces branches and joins; `processes/` plus
`workflow_start`/`next`/`gate`/`complete` is a control plane over 69 BPMN
diagrams. So `methodology-adoption`'s comparison step was load-bearing rather
than ceremonial, and it came out mixed:

| | |
|---|---|
| **ahead here** | the paper has one "node local policy"; this repo has four distinct mechanisms (`folio:policy enforcement`, `relaxable`, `folio:decision`, `folio:judgement`) and `deterministic-and-agentic` is explicit that collapsing them is the first mistake |
| **gap 1** | no typed tool contract per node — `<folio:skill ref>` names an instruction body, nothing declares what a step takes or returns |
| **gap 2** | no per-node context scope — nothing says what an agent may or must see at a step |
| **out of scope** | the code generator. Their system EMITS a service; ours GOVERNS an agent. Different products of the same specification |

## The finding: the paper's own figures contradict its prose

Read off Figure 3 while writing the image descriptions. Recorded as a reading of
the chart, not as a claim about the authors' work.

The text says of tool-use exactness that the advantage *"holds consistently
across all ten workflows regardless of complexity."* **It does not.**

| workflow | specialist | Cline | Roo |
|---|---|---|---|
| Cost | 49.6 | **76.0** | 67.6 |
| Tournament | 46.2 | **99.4** | 94.9 |
| Weather | 81.8 | **90.1** | 61.0 |

The same two invert in tool-call errors and process adherence. And the aggregate
is carried by two outliers: on Risk the specialist shows 0.20 errors against
13.19 and 11.94, and 98.6% exactness against 0.4% and 0.9%.

Separately §4.3.1 gives aggregate repair iterations as "2.08 for Roo and 1.89
for Cline" where Figure 2(d) is labelled 2.04 and 1.85.

**None of it makes the method wrong.** It makes the aggregate run metrics the
wrong thing to quote, which is why both nodes quote the generation metrics
(zero repair iterations, an order of magnitude in tokens) and the coefficient of
variation instead — the results that are about spread and pipeline rather than
about a mean over ten.

It also suggests a question the paper does not ask: Cost and Tournament are both
shallow and branch-heavy, the regime where a compiled plan has least to
contribute. A hypothesis from their diagrams, not a finding of theirs.

## What went in

| | |
|---|---|
| `cat-harness/library/arxiv-2607.14456v1/` | **PROMOTED**, L1 complete — 24 pages, 24 blocks, 14 images all described |
| `cat-harness/library/image-verdicts.json` | NEW. This library had none; every other has had one since `frs5` |
| `cat-harness/methodologies/specification-compiled-agents.md` | the method, with `evidence:` pointing at the promoted entry |
| `cat-harness/skills/process/workflow/specification-compiled-agents.md` | the skill, on the processes subgraph as asked |
| `deterministic-and-agentic.md` | §"One experiment now exists, and it is somebody else's" |

**All 14 images were opened and read**, and the figure-number mapping was
checked against each diagram's content rather than inferred from page order —
inferring it is exactly the assumption `document-image.ts`'s inspection basis
exists to refuse. 14 placed images against 15 captioned figures, and the
unplaced one is Figure 5, the base prompt, which is a text listing.

Three things noted in the drafts as drawn, not resolved: Figure 8's gateway has
two outgoing edges both labelled "In-Store" going to different tasks; Figure
14's registration gateway has No reaching "Inform Registered" and Yes reaching
"Provide Hot line number to call and register"; Figure 13 is captioned "Customer
promotion workflow" at the alphabetical position of the workflow the results
call "Spam".

## A test defect this surfaced

`library-ref.test.ts` §"the PLATFORM's library holds ONLY sources its
methodologies cite" read every NAME in the library directory, so the new
`image-verdicts.json` was reported as an uncited entry. It passed until now
only because `cat-harness/library/` was the one library with no verdict file —
the `1xhc` shape, the path nothing had walked. Narrowed to directories, which
is what a library entry is; folio content still arrives as one, so the teeth
are intact.

## Done when

- [x] promoted, L1 complete, 14 descriptions from inspection
- [x] methodology node with `evidence:`, skill on the processes subgraph
- [x] `bun run cat gates` 136/136
- [ ] issue + PR
- [ ] owner merges
