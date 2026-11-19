---
name: unverified-constraints
description: >-
  Never encode a constraint you have not verified — a rule that refuses a
  working setup is worse than no rule. Read before adding a check to a schema,
  a validator, a gate or an incompatibility table, and whenever you are about
  to write down that something "is not supported".
agents:
  - platform-boundary-guard
  - ci-health-watcher
# consulted: reference material nobody performs — a DISCIPLINE. "Never encode a constraint you have not verified" is a rule that governs other work; its headings are the argument and the worked case. Nobody performs it as a task.
consulted: true
---

# Never encode a constraint you have not verified

**Do not encode rules against a working setup.**

## The asymmetry

A constraint in a schema, validator or gate is a **refusal**, and the two ways
it can be wrong are not symmetric:

| | what happens | who finds out |
|---|---|---|
| a **missing** constraint | a bad setup gets through | it fails at the point of use, with the real error |
| a **wrong** constraint | a good setup is refused at the gate | **nobody** — the message asserts the thing is impossible, and nobody investigates a settled question |

The second is the expensive one because it looks like the system working: a
confident wrong answer costs more than a visible absence.

So an **asserted but unverified** constraint is left OUT of the gate and
written down as an open question. Not encoded "provisionally" — a provisional
refusal refuses exactly as hard as a permanent one.

## The test is the evidence, not the confidence

Encode either of these and nothing else:

- **An entailment of the mechanism.** GitHub Pages has no per-file media-type
  configuration; air-gapped compute cannot reach hosted inference. These follow
  from how the thing works, and you can say why.
- **Something measured here, with the command shown.** Not "someone said so",
  not what was true of one account, one plan or one version.

If you cannot produce one of those, you have a question, not a constraint.

## A worked case

Whether GitHub Pages works on a **private** repository depends on the
account's plan. Unless the account's entitlement has been checked, `private
repo` × `github-pages` stays **out** of an incompatibility table: encoding
"unavailable" would refuse a topology that may well work, with a message
saying it cannot.

## It reads the same in both lanes

- A **watcher** must not render "could not check" as green.
- A **boundary guard** must not encode a constraint that refuses a folio
  nobody has tried.

Both are the same refusal to convert absence of evidence into a confident
answer.

## Related

| | |
|---|---|
| the three states, and never rendering the third as clean | [`ci-health`](../../process/process-core/ci-health.md) |
| where a new rule belongs before you write it | [`placement`](../../kg/kg-core/placement.md) |
| re-measure rather than quoting a number | [`uses-editorial-review`](../../authoring/authoring-core/uses-editorial-review.md) |
