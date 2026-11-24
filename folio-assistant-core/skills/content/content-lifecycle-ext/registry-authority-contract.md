---
name: registry-authority-contract
description: >
  The contract the `external-registry` role is held to when a candidate source
  is checked against the body that publishes it: resolve the identifier through
  its own API and return the record, so authority is a resolved fact. When the
  answer is uncertain or absent the verdict is not invented here; the work plan
  records the citation as unverified. A role played by an external party is
  held to a contract, not handed instructions.
tested-by:
  - scripts/tests/registry-authority-contract.test.ts
---

# External registry — confirming a source's authority

`external-registry` (declared below this layer) is played by an **external**
actor: trusted registries and observatories outside this layer's control. A
role played by something we do not run is still a role, and its skills are its
**contract**: what we rely on it to do. This skill is the
part of that contract this layer's evidence diagram relies on, and nothing
more. The registry list, its endpoints and the API bindings are not settled
(the diagram is a STRAWPERSON), so no registry is named here.

## Where the diagrams lean on it

`Lane_Trusted` in `evidence-retrieval` (opt-in `folio-assistant-core.collab`)
names this role and holds `Task_VerifyAuthority` and `Gateway_Authoritative`.
What that lane's documentation and the task's say is the whole contract.

## What it must do

1. **Resolve the identifier at the publisher**, through the standard API of the
   body that publishes the candidate.
2. **Return the record it holds**, so the citation's claim, its version and its
   date can be compared with what the publisher says (the task's documentation
   lists the checks).

## What happens when it does not answer

The decision is a readout of what the external API returns, not this
layer's call. When that answer is uncertain or absent, `Gateway_Authoritative`
takes the `no` branch and `Lane_WorkPlan` opens a bean for the unverified
citation. The lane does not invent a verdict, and the citation is neither
dropped nor silently kept. Whether a publisher is one this folio has declared
trusted is the folio's judgement, not the registry's.

## Tests

The test in `tested-by:` drives the evidence process with the harness's
workflow engine and checks that a `no` from `Gateway_Authoritative` leads to
the bean for the unverified citation and that no step in the registry's lane is
a decision of this layer's. Lines 1 and 2 are the registry's own behaviour,
on endpoints not yet chosen, and are not exercised.
