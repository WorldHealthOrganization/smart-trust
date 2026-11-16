---
$schema: folio-methodology/v1
name: specification-compiled-agents
title: Specification-compiled agents — the control flow comes from the diagram, not from the model's plan
origin: >
  Harris Borman, Herman Wandabwa, Fusun Yu, Sandeepa Kannangara, Justin Liu,
  Anna Leontjeva and Ritchie Ng, "Beyond Generalist LLMs: Specialist Agentic
  Systems for Structured Code Workflow Execution", Commonwealth Bank of
  Australia. Published as a workshop paper at SCALE, ICML 2026 (PMLR 306);
  arXiv:2607.14456v1 [cs.SE], 16 July 2026. Open access, ingested whole and
  read before this node was written.

  It is a SYSTEM paper reporting one implementation against a benchmark its own
  authors built, so what is adopted below is the METHOD, and §"Where this
  rendering stops" says which parts were left behind. §"What the figures say
  that the prose does not" carries a reading of the paper's own charts that
  changes how its headline numbers should be used, and it is the reason this
  node quotes almost none of them.
applies-when: >
  **A process is already written down as a diagram, and something must now
  EXECUTE it.** Use it when the control flow is external and authored — a BPMN
  process, a DMN table, a pipeline someone drew — and the question is how an
  LLM should act inside it. It answers *where the plan comes from*, never *what
  the plan should be*: authoring the diagram is `bpmn-authoring`, deciding a
  branch from a table is `dmn`, and choosing between options is
  `kepner-tregoe`.

  Its companion is `hybrid-llm-deterministic`, and the two are the same shape
  at different grains: that one has the model emit a RULE that machinery
  validates and runs; this one has the model act inside a CONTROL GRAPH that
  machinery derived from a specification. Reach for this one when the artefact
  that constrains the model already exists as a diagram.

  Do NOT reach for it where no specification exists, or where the process is
  genuinely open-ended. The paper's own evaluation is scoped to deterministic
  workflows and says so; a setting with ambiguity, stochasticity or open-ended
  human decision-making is outside what it measured, and outside what this node
  claims.
evidence:
  - library/arxiv-2607.14456v1
  - library/kg-folio-asst-2026-09-30
  - library/omg-2013-bpmn-2-0-2
---

# Specification-compiled agents

**Adopted 2026-09-23**, on the owner's *"ingest into library for use as
evidence and skills as subgraph on processes in cat-harness"*.

The authors' own sentence for the mechanism:

> *"we compile an industry standard BPMN 2.0 process model into a ReAct style
> control graph. Each BPMN node provides a typed tool contract and a node local
> policy, while the control plane enforces branches and joins, scopes context
> per node, and applies contract derived runtime validation with targeted
> retries."*

## The load-bearing idea, in one sentence

> **The control flow is COMPILED from a specification the model did not write,
> so the model never rediscovers the plan at runtime.**

Everything else in the paper follows from that. The model still reasons — it is
a ReAct agent, not a state machine — but it reasons *locally*, inside a node,
against a typed contract, with the branches and joins enforced by something
that is not it.

## Three principles, and they are separable

The paper names them together; they are three distinct commitments and a reader
may take one without the others.

| principle | what it does | what it costs |
|---|---|---|
| **constrained execution** | branches and joins come from the diagram, not from a plan the model produced | the diagram must exist and be right |
| **targeted context management** | each node sees the minimum it needs, rather than the accumulated transcript | somebody must decide, per node, what that minimum is |
| **modular decomposition** | prompt, tools and orchestration are generated as separate artefacts | more upfront authoring than a single prompt |

The second is the one with an argument behind it rather than an intuition. The
paper cites evidence that model performance **degrades as more of the context
window is consumed**, and observes that a generalist system cannot scope
context per subtask because it does not know, at construction time, what each
subtask will need. A specification does know — which is why scoping is
available to this design and not to the other.

## What the paper measured

Ten workflows, **9 to 52 nodes**, all deterministic, spanning e-commerce,
costing, risk, labelling, news, social, promotion, tournament registration and
weather. Ten successful agents per workflow per system, evaluated across all
control-flow paths — **300 agents over 30,543 test cases**, from 371 generation
attempts.

Baselines: **Roo** and **Cline**. AutoGen, MetaGPT and FLOW were tried and
produced nothing executable — MetaGPT emitted prompts and tools but no agent,
AutoGen needed manual wiring even with GraphFlow, FLOW produced decompositions
rather than code — so they were excluded rather than scored, which is the
honest handling.

Aggregates (Figure 4), specialist vs Cline vs Roo:

| | specialist | Cline | Roo |
|---|---|---|---|
| tool-use exactness ↑ | 57.7 % | 48.6 % | 38.1 % |
| tool-call errors ↓ | 1.27 | 3.19 | 3.22 |
| latency (s / effective step) ↓ | 2.49 | 6.59 | 9.08 |
| process adherence ↑ | 54.7 % | 51.6 % | 42.4 % |
| repair iterations ↓ | **0.00** | 1.85 | 2.04 |
| total tokens | 53.8 k | 1 021.8 k | 1 468.6 k |

**The two robust results are the last two rows**, and they are robust because
they are not close: zero repair iterations across every successful generation,
and an order of magnitude in tokens. Those are properties of the *pipeline*
rather than of the generated agent, which is why they do not vary the way the
run metrics do.

## What the figures say that the prose does not

**Read off Figure 3 directly, 2026-09-23, as part of ingesting the images.**
This is a reading of the paper's own chart, not a claim about the authors'
work, and it is recorded because the surrounding text does not say it.

The paper writes of tool-use exactness that *"the per-workflow breakdown in
Figure 3(a) confirms this advantage holds consistently across all ten workflows
regardless of complexity."* **Figure 3(a) does not show that.** On three of the
ten the specialist system is not best:

| workflow | specialist | Cline | Roo |
|---|---|---|---|
| Cost | 49.6 | **76.0** | 67.6 |
| Tournament | 46.2 | **99.4** | 94.9 |
| Weather | 81.8 | **90.1** | 61.0 |

Tournament is not a near miss — it is 46.2 against 99.4. The same two workflows
invert in panels (b) and (d): on Cost the specialist has the *most* tool-call
errors (1.43 against 0.55 and 0.34) and the *lowest* process adherence (57.2
against 87.1 and 76.2), and Tournament repeats both.

**And the aggregate advantage is carried disproportionately by two workflows.**
On Risk the specialist shows 0.20 tool-call errors against 13.19 and 11.94, and
98.6 % exactness against 0.4 % and 0.9 %; Social contributes a smaller version
of the same. A mean over ten workflows, two of which contain an order-of-
magnitude gap, is a mean dominated by those two.

Separately, §4.3.1 gives the aggregate repair figures as *"2.08 for Roo and
1.89 for Cline"* where Figure 2(d) is labelled **2.04** and **1.85**. Small, and
noted only because this node quotes one of them.

**None of this makes the method wrong.** It makes the *aggregate run metrics*
the wrong thing to quote, and it is the reason the section above marks the
generation metrics as the robust pair. It also suggests a real question the
paper does not ask: what do Cost and Tournament have in common that inverts the
result? Looking at their diagrams, both are shallow and branch-heavy — the
regime where a compiled control graph has least to contribute, because there is
barely a plan to rediscover.

## What this checkout already does, and where it differs

`methodology-adoption` §"Extract the PROCESS, not the paper's tools" requires
this comparison before any tool is proposed. Read from the repository, not
assumed:

| the method asks for | this checkout has | gap |
|---|---|---|
| BPMN 2.0 as the authored control flow | `processes/`, 69 diagrams, `.bpmn` as the source of truth | **none — this is already the premise** |
| a control plane that enforces branches and joins | `workflow_start` / `workflow_next` / `workflow_gate` / `workflow_complete`, with `workflow_complete` refusing a step that is not enabled | **none of substance** |
| a node-local policy | `cat-harness.processes:policy enforcement`, `relaxable`, `cat-harness.processes:decision`, `cat-harness.processes:judgement` — four mechanisms, already finer than the paper's one | **this checkout is AHEAD** |
| a typed tool contract per node | `<bootstrap.processes:skill ref>` names the instruction body; there is no typed input/output contract | **the real gap** |
| context scoped per node | not modelled. A step returns a skill; nothing says what the agent may or must see | **the second real gap** |
| contract-derived runtime validation with targeted retries | nothing. A step that goes wrong is not caught by the control plane | follows from the first gap |
| compilation to an executable agent | nothing, and deliberately: the diagrams here govern agents rather than generating them | **out of scope, not a gap** |

**The last row is the one to be careful about.** The paper's system *emits* a
deployable service; this repository's engine *runs alongside* an agent doing the
work. Those are different products of the same specification, and adopting the
method here means taking the first three principles, not the code generator.

## Where this rendering stops

- **No implementation is adopted.** ReAct, FastAPI, LangGraph and Langfuse are
  the paper's tools, not obligations.
- **The benchmark is not adopted.** Ten workflows the authors built themselves,
  and they say so: *"author-constructed workflows may introduce design bias"*.
  A benchmark of somebody else's processes measures their processes.
- **The numbers are not adopted as evidence for anything here.** See the figures
  section: three of ten workflows invert, and the aggregate is dominated by two.
  What survives is the *shape* — zero repair iterations and an order of
  magnitude in tokens — and even those were measured on that corpus.
- **The deterministic scope is inherited, not argued away.** Every workflow
  evaluated is deterministic by construction. The authors state the limit
  plainly; this node does not extend the result past it, and
  `deterministic-and-agentic` is where the open question lives.
- **"Specialist beats generalist" is not a conclusion this node draws.** The
  paper compares one specialist pipeline against two general coding assistants
  operating unconstrained at their defaults, and says future work will examine
  *"more heavily optimised baseline configurations"*. That is a fair comparison
  of realistic low-configuration usage and it is not a claim about ceilings.

## The owner's own statement of the two ends

`library/kg-folio-asst-2026-09-30` is the owner's deck of 2026-09-30. It is
cited as evidence of **intent, not of effect**. Slide 7 draws the axis this node
sits on: *"BPMN Execution Skill: given a Process, Context, State, Role utilize
one or more Skills in order [to] execute a Task"*, run by either of two Tools.
One is an open-source BPMN engine with "state and swimlanes strictly enforced".
The other is "an agentic swarm with ungoverned state", mitigated by
mechanical and agentic QA/QC reports. This node is the method for the first
end. The deck measures nothing, so it says where the owner wants the harness
to go and nothing about how well either end works. That is what the paper
above is for.

The diagrams this method executes are OMG BPMN 2.0.2 (formal/2013-12-09),
recorded as `library/omg-2013-bpmn-2-0-2`. The entry identifies the exact
specification and its clause outline, so a citation can name a clause and page.
It holds none of the text, because OMG's licence forbids posting copies on a
network.

## See also

- [`specification-compiled-agents`](../skills/process/workflow/specification-compiled-agents.md)
  — the part an agent here acts on.
- [`deterministic-and-agentic`](../skills/process/workflow/deterministic-and-agentic.md)
  — the open research agenda this is evidence for, and the four mechanisms this
  repository already has.
- [`hybrid-llm-deterministic`](hybrid-llm-deterministic.md) — the same shape at
  a different grain: emit a rule, validate it, run it.
