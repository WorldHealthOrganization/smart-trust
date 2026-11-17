---
$schema: folio-memory/v1
id: do-not-encode-a-rule-against-a-working-setup
label: trap
summary: "never encode an unverified constraint — a rule that refuses a working setup is worse than no rule"
createdAt: 2026-09-19
roles:
  - code-reviewer
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
  - kind: agent
    id: platform-boundary-guard
---
Owner, 2026-09-19: **"dont encode rules against a working setup."**

A constraint is a REFUSAL, and the two failures are not symmetric: a missing
one fails visibly at the point of use; a wrong one refuses a good setup with a
confident message, and nobody investigates a settled question. So an asserted
but unverified constraint stays OUT of the gate.

Encode an entailment of the mechanism, or something measured here with the
command shown. Never "someone said so".

Full rule, the worked case and both lanes:
[`conduct-core/unverified-constraints.md`](../skills/conduct/conduct-core/unverified-constraints.md).
