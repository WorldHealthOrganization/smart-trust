# test

Part of [C@T Harness](../README.md) 0.1.0. Holds the declared QA, attestation and test-plan subgraphs of [`cat-harness.json`](../cat-harness.json).

| directory | what it holds |
|---|---|
| [`attestations/`](attestations/README.md) | The judgement half of every QA verdict (`qa-attestations/v1`), declared as `attestations` in [`cat-harness.json`](../cat-harness.json). |
| [`plans/`](plans/README.md) | Test plans this layer certifies against (`test-plan/v1`), declared as `test-plans` in [`cat-harness.json`](../cat-harness.json). |
| [`results/`](results/) | Derived QA reports, witnesses and KG audit sidecars (`qa-results/v1`, `qa-witness/v1`, `kg-qa/v1`, `kg-qa-manifest/v1`), declared as `qa` in [`cat-harness.json`](../cat-harness.json). |
