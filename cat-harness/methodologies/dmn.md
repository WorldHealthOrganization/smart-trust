---
$schema: folio-methodology/v1
name: dmn
title: DMN — Decision Model and Notation
origin: >
  Object Management Group, Decision Model and Notation (DMN) Version 1.5,
  OMG document formal/24-01-01, January 2024 (omg.org/spec/DMN). RECORDED, not
  held: its licence forbids posting copies on a network, so the library entry
  identifies the exact PDF (sha256) and its outline and holds no text.
evidence:
  - library/omg-2024-dmn-1-5
  - library/arxiv-1603.07466v1
  - library/djurica-2024-decision-model-comprehension-emisa
  - library/hasic-2018-5pdm-decision-intelligence
  - library/hasic-2019-complexity-metrics-dmn
applies-when: >
  The criteria RECUR and the inputs are data. A gateway that must branch the same
  way on the same facts every time. Not for a one-off judgement — that is
  `kepner-tregoe`, recorded per `madr`.
---

# DMN — the computable case

**Present in this repository since before this adoption, and never written down as
a methodology.** Five `.dmn` tables exist under `processes/decisions/`, the
BPMN engine evaluates them, and `dmn-authoring` sits on the `business-analyst`
role. What was missing is the statement of *when a decision should be a table at
all* — which is what made it possible to reach for DMN by habit, or to miss it.

## The test, in one line

> **Would the same inputs have to produce the same branch next month?**

Yes → a table. No → a judgement, and a table would lie about its own repeatability.

## What this platform already enforces

**A hand-supplied outcome is refused.** A DMN-backed gateway computes its branch
from the table; an agent cannot assert which way it went. That is a stronger
guarantee than the methodology itself asks for, and it is the reason a table is
worth the ceremony: the decision cannot be quietly overridden at the call site.

See [`bpmn-processes`](../skills/process/workflow/bpmn-processes.md) for the gateway
contract and [`dmn-authoring`](../skills/process/workflow/dmn-authoring.md)
for authoring the table.

## Hit policy is a modelling decision, not a detail

`UNIQUE` says the rules cannot overlap and the engine may check it. `FIRST` says
they may overlap and order decides. `COLLECT` returns every match.

**Prefer `UNIQUE`,** because it is the only policy under which an overlapping pair
of rules is an error rather than a silent precedence. `FIRST` makes rule order
load-bearing, and a reader of the table cannot see that the order was deliberate.

## What the research adds

The specification says what a table means. Four sources say how to use one well:

- **Overlap and gaps can be checked mechanically.** Calvanese et al. 2016
  (`arxiv-1603.07466v1`) give algorithms that find overlapping rules and
  input combinations no rule covers, on tables up to 1,506 rules. This is
  formal analysis, not a user study. `dmn-qa` checks the same two properties
  (`dmn-rule-shadowed`, `dmn-table-complete`), by enumeration.
- **Tables read better than trees, and compact tables best.** Djurica et al.
  2024 (`djurica-2024-decision-model-comprehension-emisa`, 139 participants,
  32 questions): tables beat trees on accuracy, and contracted ("frugal")
  versions beat expanded ones. Colour helped trees but lowered accuracy on
  tables (92.8% to 86.5% for frugal tables). So: keep tables contracted, and
  do not colour their cells.
- **Take decision logic out of the process.** Hasić et al. 2018
  (`hasic-2018-5pdm-decision-intelligence`), principle P2: no cascades of
  exclusive gateways in BPMN; put the logic in a decision table. This is the
  computed gateway above. Their validation is one case study, not an
  experiment.
- **Hit policy and input count drive perceived complexity.** Hasić et al.
  2019 (`hasic-2019-complexity-metrics-dmn`): of 26 metrics, hit-policy usage
  and the number of input variables tracked perceived complexity best. The
  paper sets no cut-off, so this methodology sets none either.

## Where DMN and the other methodologies meet

- A `kepner-tregoe` analysis whose criteria turn out to recur **becomes** a table.
  That promotion is the good case, and the MADR record of the original decision is
  what explains why the table has the columns it has.
- A table can encode *which methodology applies* — a decision about decisions. The
  repo already does this shape in `folio-intent.dmn`.
- **GRADE is not a DMN table.** Certainty of evidence is a judgement over a body of
  evidence; tabling it would assert a repeatability the method explicitly denies.

## Refusals

- **Never table a one-off** to make it look rigorous. A table asserts the decision
  recurs; if it does not, the assertion is false and the next author will trust it.
- **Never hand-supply a gateway outcome.** Already enforced; stated here so the
  reason travels with the methodology.
- **A table with one rule is not a decision model.** It is a constant, and should
  be written as one.
