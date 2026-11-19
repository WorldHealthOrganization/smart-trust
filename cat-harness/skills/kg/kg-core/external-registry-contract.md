---
name: external-registry-contract
description: >
  The contract the `external-registry` role is held to: what a trusted
  registry outside this layer must provide for a portal to verify what it
  received, and what the verifier does when it cannot. The narrowest contract
  the diagrams require. A mechanical role's skill is a contract to test
  against, not instructions to read.
tested-by:
  - schemas/external-registry-contract.test.ts
---

# External registry — the role's contract

`external-registry` in `scenarios/roles.json` is played by an **external**
actor: trusted registries and observatories outside this layer's control.
A role played by something we do not run is still a role, and its skills are
its **contract**: what we rely on it to do. A contract is not an instruction;
it is what the diagrams assume.

## Where the diagrams lean on it

One lane names this role: `Lane_Portal` in `processes/kg/kg-to-portal.bpmn`,
holding `P_Verify` and `GW_Verified`. What that lane's documentation, the
task's, and [`kg-to-portal`](kg-to-portal.md) §"Trust" require of the registry
is the whole contract — nothing more is claimed.

## What it must do

1. **Publish the trust anchors** a verifier resolves a signer's key from — for
   GDHCN, a WHO SMART Trust DID trustlist (`did.json`), served as static JSON
   (PROD: `tng-cdn.who.int/v2/trustlist/…`).
2. **Serve a slice by its hierarchical path**,
   `…/$domain/$participant/$usage/did.json`, with `-` as a wildcard, so a
   verifier fetches only what it needs.
3. Nothing else. Whether a package signature can be expressed for GDHCN
   verifiers at all is an open question in `kg-to-portal`, not a promise of
   this role.

## What the verifier does when the contract is not met

An unreachable registry is `unknown`, never a pass: `GW_Verified` routes it as
it routes a mismatch, to the last good version (`End_Rejected`). This side of
the contract is ours, and it is what makes relying on a party we do not
control safe.

**Needs the owner's review:** this contract is inferred from one diagram.
The test in `tested-by:` holds the side of it that is ours: one lane names
this role, it holds `P_Verify` and `GW_Verified`, and `GW_Verified` serves the
bytes only on a match, sending every other answer to `End_Rejected`. Lines 1
and 2 above are the registry's own behaviour on a network this repository does
not reach, and nothing here tests them.
