---
name: ig-publisher-service-contract
description: >
  The contract the `ig-publisher-service` role is held to: what the JVM
  services an IG build shells out to must produce, and how a caller tells a
  pass from a run that never happened. A mechanical role's skill is a contract
  to test against, not instructions to read.
tested-by:
  - schemas/ig-publisher-service-contract.test.ts
---

# IG publisher + validator — the role's contract

`ig-publisher-service` in `scenarios/roles.json` is played by a
**mechanical** actor (`actorKinds: ["system"]`;
`scenarios/actors/ig-publisher-service.json`, which runs in the
`folio-assistant-smart-guidelines` image). A role played by a machine is
still a role, and its skills are its **contract**: the responsibilities it
must perform, which a test can hold it to. Each line below cites the
declaration it comes from.

## What it must do

1. **Build a FHIR Implementation Guide and report its QA** — the actor's
   description ("FHIR IG Publisher build and QA reporting"), and the
   `qa-reporting` action ODRL grants it in `policies/ig-publisher-service.jsonld`.
2. **Complete the IG Publisher build with no errors in `qa.html`**, after
   SUSHI has compiled the FSH — `req:fhir-validation#ig-publisher-qa`, which
   depends on `#sushi-compile` and which the `ig-publisher` capability
   (`scenarios/capabilities/ig-publisher.json`) declares it satisfies.
3. **Validate individual resources and profiles against a package** between
   builds — the `fhir-validator` capability, distinct from a whole-IG build.
4. **Be detectable**: each capability's `detection` command answers
   `--version` / `-version` on a machine with a Java runtime
   (`requires: ["java-runtime"]`).

## What it is not asked

- To judge. The role is "external in behaviour, internal in configuration"
  (its description): it reports what the publisher found; whether a warning
  matters is the QC reviewer's or the FHIR modeller's call.

No test in this repository runs the services — they run in a folio's build,
not here. The test in `tested-by:` holds lines 1–4 to what this repository
declares: the actor and its ODRL grant, the two capabilities and their
detection, and the requirement statement the publisher satisfies.
