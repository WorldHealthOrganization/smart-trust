---
name: specification-compiled-agents
description: >
  When a diagram already says what the process is, the model should not be
  planning it. The two gaps between this repository's engine and a compiled
  control plane — typed node contracts and per-node context scope — what to do
  before either exists, and the three things not to adopt with the method.
consulted: true
uses-methodology:
  - specification-compiled-agents
---

# Specification-compiled agents

Renders [`methodologies/specification-compiled-agents.md`](../../../methodologies/specification-compiled-agents.md)
— Borman et al., arXiv:2607.14456v1, SCALE @ ICML 2026 — as something an agent
here can act on. Read the methodology node for what the paper claims, what its
figures actually show, and where the rendering stops; this is the part you do.

**It applies to a step you are performing inside a process**, not to authoring
one. `bpmn-authoring` writes the diagram, `workflow-state` says where the
instance's position is kept, `process-state` says how to report which step you
are on. This says how to behave once you are standing in one.

## The rule

> **The diagram is the plan. Do not produce a second one.**

When `workflow_next` hands you a step, that step's place in the process is
settled: what precedes it, what may follow, which gateway decides. Re-deriving
any of that from the diagram's prose — "I think after this we should…" — is
rediscovering a plan that was compiled for you, the failure this method exists
to remove. Reason **inside** the step, not about the
sequence of steps.

Concretely, three things are not yours while you are in a process:
the **next step** (the control plane's), the **branch** at a gateway carrying
`<cat-harness.processes:decision>` (the table's), and whether a step may be **skipped** (its
`relaxable` and the process's `enforcement`).

## This repository is ahead on policy and behind on contracts

**Ahead.** The paper gives each node one "node local policy". Here that is four
distinct things — `cat-harness.processes:policy enforcement`, `relaxable`, `cat-harness.processes:decision`,
`cat-harness.processes:judgement` — and `deterministic-and-agentic` is explicit that collapsing
them into one axis is the first mistake to make. Do not read the paper's single
policy as a simplification to adopt.

**Behind, and this is what to work around.** Two mechanisms the paper's control
plane has and `workflow_next` does not:

1. **No typed tool contract per node.** `<bootstrap.processes:skill ref>` names an instruction
   body; nothing declares what a step takes or returns, so nothing validates
   what you produced against what the next step needs. Until that exists, **say
   what you produced** in the turn report — a step whose output is only in your
   head is a step nothing downstream can check.
2. **No per-node context scope.** Nothing says what you may or must see at a
   step, so the whole conversation is in scope by default. The paper's evidence
   is that performance degrades as context fills; treat scoping as **your**
   discipline while it is not the engine's. Re-read the step's own
   documentation and its skill rather than working from what you remember of
   twenty steps ago.

Neither is a defect to fix in passing. Both are recorded in the methodology
node's comparison table as the two real gaps, and building either is a
decision with the owner.

## Three things NOT to adopt with it

1. **The code generator.** The paper's system *emits* a deployable FastAPI
   service from a BPMN file. This repository's diagrams **govern** an agent
   doing the work; they do not generate one. Those are different products of
   the same specification, and nothing here is waiting for a compiler.
2. **The numbers.** 57.7 % exactness, "2.5× fewer errors", "95 % fewer tokens" —
   measured on ten workflows the authors built. Worse, the per-workflow chart
   contradicts the prose on three of them and the aggregate is carried by two
   outliers (methodology node, §"What the figures say that the prose does not").
   Quote the *mechanism*; do not quote the margins.
3. **"Specialist beats generalist" as a general finding.** The comparison is one
   specialist pipeline against two coding assistants at their defaults, on
   deterministic workflows only. The authors say both limits plainly. An agent
   citing this as evidence that constrained beats open-ended in general is
   citing something nobody measured.

## What it is evidence FOR, here

`deterministic-and-agentic` asks which judgement points are safety risks and
how much needs to be deterministic. This paper bears on it with an experiment,
and what it supports is narrow:

- **Externalising control flow reduces variance**, not just error. The
  coefficient of variation across independent generations was lowest for the
  specialist system (0.63, against 0.86 and 1.05). Consistency is the claim
  that survives the per-workflow reversals, because it is about the *spread*
  rather than the mean.
- **Where a compiled plan has least to contribute is where the process is
  shallow.** The two workflows that invert the result, Cost and Tournament, are
  both branch-heavy and shallow. That is a hypothesis about *when* to reach for
  this, and it is drawn from the diagrams rather than from anything the paper
  says — so it is a question to test, not a finding.

## See also

- [`deterministic-and-agentic`](deterministic-and-agentic.md) — the spectrum,
  the four mechanisms, and the open questions this is evidence for.
- [`bpmn-processes`](bpmn-processes.md) — how a step is authored, and what
  `<bootstrap.processes:skill ref>` and `<cat-harness.processes:bean>` are required for.
- [`process-state`](process-state.md) — saying which process you are in, and
  the five detectors for being out of one.
- [`hybrid-llm-deterministic`](../../../methodologies/hybrid-llm-deterministic.md)
  — emit a rule, validate it, run it. The same shape one grain down.
