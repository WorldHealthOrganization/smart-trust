---
name: deterministic-and-agentic
description: >
  Workflow processing is a SPECTRUM, not a switch. The four mechanisms this
  repository uses to sit at different points on it, the four axes an
  answer has to name, what is measured today, and the three research questions
  — which are open, and marked as open.
consulted: true
uses-methodology:
  - hybrid-llm-deterministic
---

# The deterministic-to-agentic spectrum

BPMN state management and workflow processing can sit anywhere on a spectrum
from deterministic to agentic. The research questions: which judgement points
are safety risks, how much needs to be deterministic, and how models compare
across sub-workflows under a controlled overlay of context and memories.

**This page is an agenda, not a result.** Everything below is marked
**measured**, **decided** or **hypothesis**, and there is more of the third
than of the first. Do not read it as settled: a research note that reads as
settled makes the next agent stop looking.

## The spectrum is already being navigated, unnamed

**Measured.** Four distinct mechanisms place a step at a different point, and
none of them refers to the others:

| mechanism | what it fixes | where |
|---|---|---|
| `cat-harness.processes:policy enforcement` | whether a step that is not enabled is **refused** or merely noted | per process, `strict` or `advisory` |
| `relaxable="false"` | whether a package may **negotiate** a base step away | per activity |
| `cat-harness.processes:decision` | whether the branch is **computed** from a table, refusing a hand-supplied outcome | per exclusive gateway |
| `check-corpus-gate` | whether the **write** is refused at the commit boundary, by something that is not the agent | outside the process |

They are not one axis. **At least four questions are being conflated:**

1. **Who decides** the branch — a table, or a reading of intent?
2. **What happens if the decision is wrong** — refused, noted, or nothing?
3. **Who enforces** — the agent asking, or a gate that does not care whether
   anyone asked?
4. **What the output IS** — the result, or a rule that is validated and then
   executed; see §"A fourth axis" for why it does not reduce to (1).

A step can be agentic on (1) and fully deterministic on (3). The commit
boundary is exactly that: an agent decides freely, and a hook refuses the write
regardless. **Any answer to "how much needs to be deterministic" that does not
say WHICH of these it means is not an answer.**

The list is what has been noticed, not what exists.

## What is measured today

**Measured**, by `bun run cat check:workflow-refs` — ask it, not this page:

- Exclusive gateways split three ways: **computed** by a DMN table, **declared
  judgement** (`cat-harness.processes:judgement`, with a reason), and **undeclared**.
- The undeclared set is a **backlog**, not a finding. Every gateway predating
  the marker lands there, and it is the number this agenda most needs to
  shrink: an undeclared gateway is one where nobody has said whether a table
  could exist.

A count of decision points in prose is a claim nothing checks; run the check.

**Decided**, and independently of the above: the steps carrying
`relaxable="false"` (among them the editor seeing the findings, the decision,
the write, the release authorisation, the publish) have been judged
non-negotiable, and that set is a second, differently-derived sample of "must
not be agentic".

## A fourth axis — what the model's output IS

From `methodologies/hybrid-llm-deterministic.md`, rendering Neubauer, Pleiss &
Uekermann (arXiv:2508.05192v2).

The first three axes above are about the DECISION. This one is about the
ARTEFACT, and it is not reducible to them:

> **Does the model emit the RESULT, or a RULE that is then validated and
> executed?**

**Why it is a separate axis.** The commit boundary is agentic on *who decides* and deterministic on
*who enforces* — and what the agent produces there is a **result**, a commit,
checked after the fact. The source's schema-mapping design gives the same two
answers, and produces a **rule**: an expression, checked for syntax, then run.
Two designs, identical on all three of the decision axes, and their failure
profiles are not comparable. A bad result must be caught by inspecting every item; a bad
rule is caught once, before it runs at any volume.

**Hypothesis**, offered because it is testable and cheap to test here:

> Judgement is admissible at a point the recoverability criterion (§1) would
> refuse, WHEN the output is a rule — because validation happens before
> execution rather than after.

The `relaxable="false"` steps are already proposed as §1's test sample. They
can test this at the same time: ask of each whether its output is a result or a
rule.

**What it does not settle.** Which of the four axes dominates, whether "rule"
is even well-defined for the judgements this repository makes (a `cat-harness.processes:raci`
annotation is not obviously either), and whether the distinction survives
contact with a step whose output is prose. **Open.**

## Why the guarding is needed at all — cited, not assumed

Three measurements from outside this repository support the premise,
**second-hand**: cited by the ingested
source, not themselves ingested, so each is an attribution to check rather than
a result this repository holds (`literature-search` §"Never fill the gap with
recall"). Provenance for all three is
[`hybrid-llm-deterministic`](../../../methodologies/hybrid-llm-deterministic.md):

- LLMs **can be distracted by irrelevant context** — Shi et al., ICML 2023.
- Accuracy **drops on low-probability inputs even for deterministic tasks** —
  McCoy et al., arXiv:2309.13638.
- Reasoning **degrades as input length increases, before the context window is
  reached** — Levy et al., arXiv:2402.14848.

**The source itself is a tool paper reporting no baseline, no accuracy measure
and no comparison**, so nothing here rests on a claim about how well its
approach performs, and its node says so. The three findings above are evidence
for the PREMISE — that model output needs guarding — and not for any particular
guard.

## The three questions, open

### 1. Which judgement points are safety risks?

**Open.** A **hypothesis**, offered because it is testable and not because it
is established:

> Judgement is admissible where a wrong branch is **recoverable** — the next
> turn corrects it and nothing downstream was authorised meanwhile — and
> inadmissible where it **authorises the un-authorisable**.

Evidence for it: **two gateways**, both in `session-state-machine`, where it
holds. That is not evidence, it is a worked example. Against it: the criterion
says nothing about a wrong branch that is recoverable but **expensive**, or one
that is recoverable only by a person who will not be looking. Both are
plausible risks the criterion does not see.

What would test it: take the `relaxable="false"` steps, which were classified by
a different route, and ask whether recoverability predicts them. If it does
not, the criterion is wrong or incomplete, and finding that out is the point.

### 2. How much needs to be deterministic?

**Open, and probably malformed as stated** — see the conflation above. A better-formed version, and even this is a guess at the right question:

> For each of *who decides*, *what happens when it is wrong*, *who enforces*,
> and *what the output is*, what is the cheapest mechanism that still refuses
> the failure that matters?

The fourth clause changes the question rather than lengthening it: for a step whose output is a rule, the cheapest mechanism
that refuses the failure may be a validator costing nothing per item, which the
other three axes cannot express.

**Decided** and worth carrying into it: this repository's answer at the commit
boundary is *refuse by default, and refuse when you cannot tell*. A gate that
fails open reports clean by not looking. Whether that generalises is unknown.

### 3. How do models compare across sub-workflows, under a controlled overlay
of context and memories?

**Open, and not yet answerable** — the instrument does not exist. What would be
needed, stated so the gap is visible rather than implied:

- **The same sub-process, run by different models**, with everything else held.
  The engine makes this nearly possible already: a process instance is a
  committed record of which branch was taken at each gateway, so two runs are
  comparable without instrumenting anything.
- **A controlled overlay.** `context` is a named layer —
  agent memory and interaction preferences are `holds: "context"`, read and not
  written by a step — so "the same task with and without this memory entry" is
  expressible. Whether it is *controllable* is untested: nothing yet varies the
  overlay deliberately.
- **A comparison that is not the agent's own report.** A model grading its own
  run is the failure mode this repository already names for QA verdicts.

**A confound.** Second-hand via
`hybrid-llm-deterministic`: Levy et al. report that reasoning degrades with
input LENGTH, *before* the context window is reached. So "the same task with
and without this memory entry" varies two things at once — the entry's content
and the prompt's length — and an overlay comparison that does not hold length
constant cannot say which produced the difference. The overlay bullet above
treats context as something to hold or release; length is a third thing, and it
moves whenever the other two do.

**No experiment has been run here.**

### One external experiment

**Measured, by Borman et al., not here** — arXiv:2607.14456v1, rendered as
[`specification-compiled-agents`](specification-compiled-agents.md). It is an
ingested source that bears on the question above with an experiment
rather than an intuition, and it answers a narrow slice of it: ten BPMN
workflows, three systems, 300 generated agents over 30,543 test cases, holding
the foundation model constant.

What it supports, stated no wider than it was measured:

- **Externalising control flow reduces VARIANCE**, and that is the claim that
  survives their own per-workflow breakdown. The coefficient of variation of
  tool-use exactness across independent generations was 0.63 for the compiled
  system against 0.86 and 1.05 for the two generalist baselines.
- **The generation-side results are the robust ones**: zero repair iterations,
  and an order of magnitude fewer tokens. Those are properties of the pipeline,
  not of the agent it produced, which is why they do not vary the way the run
  metrics do.

What it does NOT answer, which is most of the agenda above:

- **Nothing about safety risk.** The metrics are exactness, adherence, latency
  and cost. "Which are safety risks" is untouched.
- **Nothing about how much needs to be deterministic**, because every workflow
  they evaluated was deterministic by construction. The authors say so. The
  question above is precisely about the part they excluded.
- **Nothing about models compared across sub-workflows**, and nothing about a
  controlled context overlay — though their per-node context scoping is the
  closest thing to an overlay anyone has built, and their citation that
  performance degrades as the window fills is the same confound named above,
  arriving from a second direction.

**And their aggregate is not uniform.** On three of the ten workflows the
compiled system is not best, and on Tournament it is 46.2 % against 94.9 % and
99.4 %. The methodology node carries that reading in full. It matters here
because it is the first hint of an ANSWER to the second question: the two
workflows that invert are both shallow and branch-heavy, which is the regime
where a compiled plan has least to contribute. That is a hypothesis drawn from
their diagrams, not a finding of theirs, and a testable one.

## What this means when you author a step

The practical half, and the only part that is not research:

**Say which point you are at.** A gateway is `cat-harness.processes:decision`, or
`cat-harness.processes:judgement` with a reason, and an undeclared one is a gap somebody will
have to measure later. The reason is what makes the corpus countable — and a
corpus that cannot enumerate its judgement points cannot answer any of the
three questions above.

**Do not reach for `strict` to express a safety concern about a BRANCH.**
Enforcement and who-decides are different axes. A strict process with an
undeclared gateway is rigidly walking a path chosen by nobody-says-what.

**Where the failure is unrecoverable, prefer the mechanism that does not
depend on asking.** The commit boundary bites whether or not the agent
consulted it; `workflow_gate` only answers agents that ask.

## See also

- [`session-state-machine`](session-state-machine.md) — the worked case, and
  where `cat-harness.processes:judgement` came from.
- [`bpmn-processes`](bpmn-processes.md) — strict vs advisory, the steps no
  package may relax, and the commit-boundary gate.
- [`content-context-and-state-graphs`](../../kg/kg-core/content-context-and-state-graphs.md)
  — the layer that makes "a controlled overlay of context" a thing you can name.
- [`bpmn-forced-vs-managed`](../../../docs/research-and-analysis/bpmn-forced-vs-managed.md)
  — two-arm harness (`bun run cat eval:bpmn-forced-vs-managed`) for token-machine step enforcement (`forced`) against full-diagram self-management (`self-managed`) on `test-plan-execution.bpmn`; so far run only with a simulated agent, so it has no results about models yet.
