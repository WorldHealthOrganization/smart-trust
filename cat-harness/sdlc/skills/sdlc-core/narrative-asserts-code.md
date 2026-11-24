---
name: narrative-asserts-code
description: >-
  Judge whether the prose side of a declared prose ↔ code pair still says what
  the code does, when the machine could not settle it. Reads the two mechanical
  signals first — staleness and resolvable claims — and settles what is left
  in one of three ways, sending a disagreement with a checker to adjudication.
  General: the Lean case is a specialisation with its own skill.
---

# Does the prose say what the code does?

A reader acts on what the prose says. When prose and code disagree, the reader
either avoids a working feature or rebuilds it. This skill is the **judgement** step. The
machine has already done everything it can, and your job is the rest.

## The pairs this applies to — declared, never inferred

| pair | prose | code | declared by |
|---|---|---|---|
| diagram ↔ workflow | a `.bpmn` diagram's `<documentation>` | the `.github/workflows/*.yml` it draws | `# bpmn: <diagram>` in the workflow (+ `# bpmn-node: <id>` per job) |
| skill ↔ code | a skill `.md` | the same-stem `.ts` beside it | the file sitting there |
| proof ↔ Lean | a paper block's `.md` | its `lean.ref` | the block manifest — **see below, it has its own skill** |

A pair nothing declares is out of scope. Do not go looking for prose that
"seems to describe" some code: an inferred pair is a guess, and a finding on a
guess is how a check gets switched off.

## Read the machine's output first — it is already in the sidecar

Two kg-qa criteria on the subject's sidecar tell you what is open:

- **`prose-reviewed-since-code-changed`**. `fail` means the code
  changed and the prose did not. It says nothing about truth, only that
  nobody re-read the prose.
- **`prose-claims-resolve`**. Each claim the prose makes about the
  code comes out `holds`, `false` or `undetermined`. `bun run cat pairs:claims`
  prints the whole list, including what it did not check.

What you judge is exactly the **stale pairs**, the **false claims** and the
**undetermined claims**. A claim that holds and a pair that is not stale need
nothing from you.

## Three outcomes, and each leaves a record

1. **The prose holds.** Say why, in one sentence, and attest the pair:
   `bun run cat pairs:attest -- --sidecar <sidecar> --by agent|human --reason "…"`.
   A reason is required because an attestation nobody can review is not
   evidence. Name what you compared: *"the TypeScript step describes the
   repository gates and `bun run cat gates` derives its list from this job"* is a
   reason; *"looks fine"* is not.
2. **The prose and the code really disagree.** Raise a finding against the
   side that is wrong. Usually that is the prose, because the code is what runs,
   but not always: a skill can state the intended behaviour correctly while the
   code has regressed. Say which side, and why that side.
3. **You disagree with a checker's `false`.** The machine says a claim is false
   and you read it as true, or the other way round. Do not overrule it quietly.
   That disagreement is exactly what `adjudication` exists for: call
   `Process_CriterionAdjudication` (the QA-criterion specialisation of
   `adjudication`, whose outcomes are: the finding stands, the criterion is
   scoped, or a dispensation is granted), and the checker's entry is kept beneath the
   verdict, because a disagreement between a checker and a reviewer is
   information.

## Lean is the specialisation, not the model

For a **proof ↔ Lean** pair, a proof assistant can settle the formal claim
mechanically, which no other pair kind allows. That work belongs to
`proof-narrative-lean-equivalence` (the science layer):
stub-weakening, overreach, hypothesis mismatch and notation drift. This skill
states the question for every pair kind, and that one answers it for Lean.
Nothing Lean-specific goes here, so a pair kind added later
inherits the general question without inheriting Lean's machinery.

## Where it runs

`narrative-code-review.bpmn`, entered from `review-task.bpmn` when a change is
**prose and the code it describes**. The review dispatcher's gateway is
exclusive, so a change that is both goes through this branch.
